import type { AtlasBundle, Artifact } from '../domain/schema.ts';
import { digestBundle, validateBundle } from '../domain/validate.ts';
import { commitSchema, proposalSchema, requireIntake, reviewSchema, sourceUrl, targetFor,
  type Content, type Observation, type Proposal, type SourceClient, type Target } from './model.ts';
import { affected, assertContentScope, contentFor, fingerprint, hash } from './scope.ts';
import { comparisonId, mergeBindings, mergeContent, recordsFor } from './records.ts';

async function observe(client: SourceClient, target: Target, artifacts: Artifact[], checkedAt: string): Promise<Observation[]> {
  const cache = new Map<string, Promise<string | null>>();
  return Promise.all(artifacts.flatMap(a => a.locations.map(async l => {
    const key = `${a.revision}/${l.path}`;
    if (!cache.has(key)) cache.set(key, client.source(target, a.revision, l.path));
    return { artifactId: a.id, locationId: l.id, path: l.path, revision: a.revision,
      checkedAt, sha256: await cache.get(key)! };
  })));
}
function proposedContent(original: Content, target: Target, revision: string): Content {
  return {
    artifacts: original.artifacts.map(a => ({ ...a, revision,
      version: `Commit ${revision}; no Atlas proof replay.`,
      locations: a.locations.map(l => ({ ...l, url: sourceUrl(target, revision, l.path) })) })),
    claims: original.claims.map(c => ({ ...c, assumptions: { ...c.assumptions, status: 'unknown' },
      dependencies: { status: 'unknown', details: ['Transitive dependencies and axioms have not been audited for this revision.'] } })),
    evidence: original.evidence.map(e => ({ ...e, scope: { ...e.scope,
      configuration: `Pinned ${target.repository}@${revision}; ${e.id}; no Atlas replay.` } })),
    bindings: original.bindings.map(b => ({ ...b, binding: { ...b.binding,
      basis: { kind: 'manual-comparison', checkId: comparisonId(target, revision, b.viewId, b.binding.componentInstanceId) } } })),
  };
}
export async function detectUpdate(bundle: AtlasBundle, target: Target, client: SourceClient, checkedAt: string): Promise<Proposal | null> {
  const original = contentFor(bundle, target);
  const before = original.artifacts[0].revision;
  const after = commitSchema.parse(await client.main(target));
  if (before === after) return null;
  const content = proposedContent(original, target, after);
  const observations = await observe(client, target, [...original.artifacts, ...content.artifacts], checkedAt);
  return proposalSchema.parse({ schemaVersion: 1, target: target.id, repository: target.repository, branch: 'main',
    before, after, baseFingerprint: fingerprint(bundle, target), content, observations, review: null });
}
function parseProposal(input: unknown) {
  const proposal = proposalSchema.parse(input);
  const target = targetFor(proposal.target);
  requireIntake(proposal.repository === target.repository && proposal.before !== proposal.after &&
    proposal.content.artifacts.every(a => a.revision === proposal.after), 'invalid_proposal_identity');
  for (const artifact of proposal.content.artifacts) {
    for (const location of artifact.locations) {
      const expected = sourceUrl(target, proposal.after, location.path);
      requireIntake(location.url === expected || /^#L[1-9]\d*(?:-L[1-9]\d*)?$/.test(location.url.slice(expected.length)) &&
        location.url.startsWith(expected), 'invalid_proposal_source');
    }
  }
  return { proposal, target };
}
function assemble(bundle: AtlasBundle, proposal: Proposal, target: Target): AtlasBundle {
  const { content } = proposal;
  return { ...bundle, artifacts: mergeContent(bundle.artifacts, content.artifacts),
    claims: mergeContent(bundle.claims, content.claims), evidence: mergeContent(bundle.evidence, content.evidence),
    architectureViews: bundle.architectureViews.map(v => ({ ...v, claimBindings: mergeBindings(v.claimBindings, v.id, content) })),
    checkRecords: [...bundle.checkRecords.filter(c => !affected(c, target)), ...recordsFor(proposal)] };
}
export async function acceptUpdate(bundle: AtlasBundle, input: unknown, reviewInput: unknown, client: SourceClient, checkedAt: string) {
  const { proposal, target } = parseProposal(input);
  const review = reviewSchema.parse(reviewInput);
  if (proposal.review) {
    if (fingerprint(bundle, target) !== proposal.baseFingerprint) {
      validateAcceptedUpdate(bundle, proposal);
      return { bundle, proposal };
    }
    assertContentScope(contentFor(bundle, target), proposal.content);
    const resumed = assemble(bundle, proposal, target);
    const result = await validateBundle({ ...resumed, datasetRevision: await digestBundle(resumed) });
    validateAcceptedUpdate(result, proposal);
    return { bundle: result, proposal };
  }
  requireIntake(fingerprint(bundle, target) === proposal.baseFingerprint &&
    contentFor(bundle, target).artifacts[0].revision === proposal.before, 'stale_proposal');
  assertContentScope(contentFor(bundle, target), proposal.content);
  requireIntake(proposal.content.claims.every(c => c.dependencies.status === 'unknown'), 'axiom_audit_not_performed');
  const fresh = await observe(client, target, proposal.content.artifacts, checkedAt);
  requireIntake(fresh.every(o => o.sha256), 'source_unavailable');
  const accepted = proposalSchema.parse({ ...proposal, review: { ...review, checkedAt },
    observations: [...proposal.observations.filter(o => o.revision === proposal.before), ...fresh] });
  const next = assemble(bundle, accepted, target);
  const result = await validateBundle({ ...next, datasetRevision: await digestBundle(next) });
  validateAcceptedUpdate(result, accepted);
  return { bundle: result, proposal: accepted };
}
export function validateAcceptedUpdate(bundle: AtlasBundle, input: unknown) {
  const { proposal, target } = parseProposal(input);
  requireIntake(proposal.review, 'pending_review');
  requireIntake(proposal.content.claims.every(c => c.dependencies.status === 'unknown'), 'axiom_audit_not_performed');
  const actual = contentFor(bundle, target);
  assertContentScope(actual, proposal.content);
  const checks = recordsFor(proposal);
  const sorted = (items: { id: string }[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
  requireIntake(hash(actual) === hash(proposal.content) &&
    hash(sorted(bundle.checkRecords.filter(c => affected(c, target)))) === hash(sorted(checks)), 'unapplied_review');
  requireIntake(proposal.content.artifacts.every(a => a.locations.every(l => proposal.observations.some(o =>
    o.artifactId === a.id && o.locationId === l.id && o.revision === a.revision && o.path === l.path && o.sha256))), 'source_unavailable');
}
