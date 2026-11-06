import { createHash } from 'node:crypto';
import { canonicalize } from 'json-canonicalize';
import type { AtlasBundle, CheckRecord } from '../domain/schema.ts';
import { requireIntake, type Content, type Target } from './model.ts';

export const hash = (value: unknown) => createHash('sha256').update(canonicalize(value)).digest('hex');
export function affected(check: CheckRecord, target: Target) {
  const ids: readonly string[] = target.artifactIds;
  if (check.kind === 'manual-comparison') return check.sources.some(s => ids.includes(s.artifactId));
  return ids.includes(check.artifactId) || ('subjectArtifactIds' in check && check.subjectArtifactIds.some(id => ids.includes(id)));
}
export function contentFor(bundle: AtlasBundle, target: Target): Content {
  const ids: readonly string[] = target.artifactIds;
  const artifacts = bundle.artifacts.filter(a => ids.includes(a.id));
  const claims = bundle.claims.filter(c => c.id === target.claimId);
  const evidence = bundle.evidence.filter(e => e.claimId === target.claimId);
  const bindings = bundle.architectureViews.flatMap(view => view.claimBindings
    .filter(binding => binding.claimId === target.claimId).map(binding => {
      const basis = binding.basis;
      requireIntake(basis.kind === 'manual-comparison', 'unsupported_binding');
      const check = bundle.checkRecords.find(c => c.id === basis.checkId);
      requireIntake(check?.kind === 'manual-comparison', 'missing_comparison');
      return { viewId: view.id, binding };
    }));
  requireIntake(artifacts.length === ids.length && claims.length === 1 && evidence.length > 0 &&
    bindings.length > 0 && artifacts.every(a => a.repository === `https://github.com/${target.repository}` &&
      a.revisionKind === 'git-commit') && new Set(artifacts.map(a => a.revision)).size === 1, 'unsupported_target');
  requireIntake(bundle.claims.filter(c => c.subjectArtifactIds.some(id => ids.includes(id)))
    .every(c => c.id === target.claimId) && bundle.evidence.filter(e => ids.includes(e.artifactId))
    .every(e => e.claimId === target.claimId), 'shared_artifact');
  requireIntake(bundle.architectureViews.every(v => v.sources.every(s => !ids.includes(s.artifactId)) &&
    v.componentInstances.every(i => i.subjectArtifactIds.every(id => !ids.includes(id)))) &&
    bundle.architectureEdges.every(e => e.sources.every(s => !ids.includes(s.artifactId))), 'architecture_artifact');
  return { artifacts, claims, evidence, bindings };
}
export function fingerprint(bundle: AtlasBundle, target: Target) {
  return hash({ content: contentFor(bundle, target), checks: bundle.checkRecords.filter(c => affected(c, target)) });
}
export function assertContentScope(original: Content, candidate: Content) {
  const identity = (content: Content) => ({
    artifacts: content.artifacts.map(a => ({ id: a.id, kind: a.kind, repository: a.repository,
      revisionKind: a.revisionKind, locations: a.locations.map(l => l.id) })),
    claims: content.claims.map(c => ({ id: c.id, subjectArtifactIds: c.subjectArtifactIds, relation: c.relation })),
    evidence: content.evidence.map(e => ({ id: e.id, claimId: e.claimId, artifactId: e.artifactId, method: e.method, locationId: e.locationId })),
    bindings: content.bindings.map(b => ({ viewId: b.viewId, componentInstanceId: b.binding.componentInstanceId,
      claimId: b.binding.claimId, applicabilityKind: b.binding.applicabilityKind, sources: b.binding.sources,
      basis: b.binding.basis.kind })),
  });
  requireIntake(hash(identity(original)) === hash(identity(candidate)), 'changed_update_scope');
}
