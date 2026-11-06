import { describe, expect, it } from 'vitest';
import data from '../data/atlas.json';
import { digestBundle, validateBundle } from '../src/domain/validate';
import { detectUpdate, acceptUpdate, validateAcceptedUpdate } from '../src/intake/updates';
import { sourceUrl, targets, targetFor } from '../src/intake/model';
import { affected } from '../src/intake/scope';
import { proposalReport } from '../src/intake/report';

const head = 'a'.repeat(40);
const now = '2026-11-06T12:00:00Z';
const review = { reviewer: 'curator', notes: 'Reviewed the theorem, assumptions and model applicability at the proposed commit.' };
const client = {
  main: async () => head,
  source: async () => 'b'.repeat(64),
};
const bundle = () => validateBundle(structuredClone(data));

describe('proof update intake', () => {
  it('should leave the release untouched when main has not advanced', async () => {
    const original = await bundle();
    const result = await detectUpdate(original, targets[0], {
      ...client, main: async () => original.artifacts.find(a => a.id === 'gasper-proof')!.revision,
    }, now);
    expect(result).toBeNull();
    expect(original).toEqual(data);
  });

  it('should propose pinned sources without publishing or inventing a review when main changes', async () => {
    const original = await bundle();
    const candidate = (await detectUpdate(original, targets[0], client, now))!;
    expect(candidate.after).toBe(head);
    expect(candidate.review).toBeNull();
    expect(candidate.content.artifacts.every(a => a.revision === head)).toBe(true);
    expect(candidate.content.artifacts.flatMap(a => a.locations).every(l => !l.url.includes('#'))).toBe(true);
    expect(candidate.observations.every(o => o.sha256 === 'b'.repeat(64))).toBe(true);
    expect(original).toEqual(data);
    expect(() => validateAcceptedUpdate(original, candidate)).toThrow('pending_review');
  });

  it('should publish only after explicit review and replace old scoped checks', async () => {
    const original = await bundle();
    const candidate = (await detectUpdate(original, targets[0], client, now))!;
    const beforeReview = structuredClone(candidate);
    const accepted = await acceptUpdate(original, candidate, review, client, now);
    expect(candidate).toEqual(beforeReview);
    await expect(validateBundle(accepted.bundle)).resolves.toEqual(accepted.bundle);
    expect(() => validateAcceptedUpdate(accepted.bundle, accepted.proposal)).not.toThrow();
    expect(accepted.bundle.artifacts.find(a => a.id === 'gasper-proof')!.revision).toBe(head);
    expect(accepted.bundle.checkRecords.some(c => c.id === 'compare-ffg-state')).toBe(false);
    expect(accepted.bundle.checkRecords.some(c => c.kind === 'replay')).toBe(false);
    expect(accepted.bundle.checkRecords.filter(c => c.kind === 'source-review' && c.artifactId === 'gasper-proof'))
      .toEqual([expect.objectContaining({ result: 'reviewed', checkedAt: now, details: expect.stringContaining('curator') })]);
    expect(original).toEqual(data);
  });

  it('should refuse an unavailable new source instead of substituting main or an old check', async () => {
    const original = await bundle();
    const missing = { ...client, source: async () => null };
    const candidate = (await detectUpdate(original, targets[0], missing, now))!;
    expect(candidate.observations.every(o => o.sha256 === null)).toBe(true);
    await expect(acceptUpdate(original, candidate, review, missing, now)).rejects.toThrow('source_unavailable');
    expect(original).toEqual(data);
  });

  it.each(targets)('should retain the other targets and both architecture snapshots when accepting $id', async target => {
    const original = await bundle();
    const proposal = (await detectUpdate(original, target, client, now))!;
    const result = await acceptUpdate(original, proposal, review, client, now);
    expect(result.bundle.checkRecords.filter(c => !affected(c, target)))
      .toEqual(original.checkRecords.filter(c => !affected(c, target)));
    expect(result.bundle.architectureViews.map(({ claimBindings: _bindings, ...snapshot }) => snapshot))
      .toEqual(original.architectureViews.map(({ claimBindings: _bindings, ...snapshot }) => snapshot));
    expect(result.bundle.architectureEdges).toEqual(original.architectureEdges);
    expect(result.bundle.datasetRevision).not.toBe(original.datasetRevision);
  });

  it('should drop a previous successful replay rather than transfer it to the new commit', async () => {
    const original = await bundle();
    const evidence = original.evidence.find(e => e.id === 'ffg-theorem')!;
    original.checkRecords.push({ id: 'old-replay', kind: 'replay', checkedAt: now, details: 'Test fixture replay.',
      artifactId: evidence.artifactId, evidenceId: evidence.id, subjectArtifactIds: ['gasper-model'],
      scope: 'Fixture scope.', configuration: evidence.scope.configuration, result: 'passed' });
    original.datasetRevision = await digestBundle(original);
    const proposal = (await detectUpdate(original, targets[0], client, now))!;
    const result = await acceptUpdate(original, proposal, review, client, now);
    expect(result.bundle.checkRecords.some(c => c.kind === 'replay')).toBe(false);
  });

  it('should preserve reviewed edits to statements and explicitly relocated sources', async () => {
    const original = await bundle();
    const proposal = (await detectUpdate(original, targets[0], client, now))!;
    proposal.content.claims[0].statement = 'A curator-reviewed, more precisely scoped property.';
    const location = proposal.content.artifacts[1].locations[0];
    location.path = 'Renamed/Proof.lean';
    location.url = sourceUrl(targets[0], head, location.path) + '#L12-L20';
    proposal.content.bindings[0].binding.explanation = 'Newly reviewed applicability with revised limits.';
    const result = await acceptUpdate(original, proposal, review, client, now);
    expect(result.bundle.claims.find(c => c.id === targets[0].claimId)!.statement).toBe(proposal.content.claims[0].statement);
    expect(result.bundle.artifacts.find(a => a.id === 'gasper-proof')!.locations[0].url).toBe(location.url);
    expect(result.bundle.checkRecords.some(c => c.details.includes('Newly reviewed applicability'))).toBe(true);
  });

  it('should not invalidate an independent candidate when another repository update was accepted', async () => {
    const original = await bundle();
    const gasper = (await detectUpdate(original, targets[0], client, now))!;
    const ark = (await detectUpdate(original, targets[2], client, now))!;
    const first = await acceptUpdate(original, gasper, review, client, now);
    const second = await acceptUpdate(first.bundle, ark, review, client, now);
    expect(() => validateAcceptedUpdate(second.bundle, first.proposal)).not.toThrow();
    expect(() => validateAcceptedUpdate(second.bundle, second.proposal)).not.toThrow();
  });

  it('should converge without duplicate records when acceptance is repeated or interrupted after the receipt write', async () => {
    const original = await bundle();
    const proposal = (await detectUpdate(original, targets[0], client, now))!;
    const first = await acceptUpdate(original, proposal, review, client, now);
    expect(await acceptUpdate(first.bundle, first.proposal, review, client, now)).toEqual(first);
    expect(await acceptUpdate(original, first.proposal, review, client, now)).toEqual(first);
  });

  it('should not copy a previous reviewer or audit description into a subsequent update', async () => {
    const original = await bundle();
    const proposal = (await detectUpdate(original, targets[0], client, now))!;
    const first = await acceptUpdate(original, proposal, { reviewer: 'old-curator', notes: 'First source review.' }, client, now);
    const next = (await detectUpdate(first.bundle, targets[0], { ...client, main: async () => 'c'.repeat(40) }, now))!;
    expect(JSON.stringify(next.content)).not.toContain('old-curator');
    const second = await acceptUpdate(first.bundle, next, review, client, now);
    const checks = second.bundle.checkRecords.filter(c => affected(c, targets[0]));
    expect(JSON.stringify(checks)).not.toContain('old-curator');
    expect(second.bundle.claims[0].dependencies).toEqual({ status: 'unknown',
      details: ['Transitive dependencies and axioms have not been audited for this revision.'] });
  });

  it('should reject a candidate whose reviewed baseline was edited meanwhile', async () => {
    const original = await bundle();
    const proposal = (await detectUpdate(original, targets[0], client, now))!;
    original.claims[0].statement = 'Changed by another curator.';
    await expect(acceptUpdate(original, proposal, review, client, now)).rejects.toThrow('stale_proposal');
  });

  it('should reject changed entity membership instead of adding an unreviewed claim', async () => {
    const original = await bundle();
    const proposal = (await detectUpdate(original, targets[0], client, now))!;
    proposal.content.claims[0].id = 'invented-claim';
    await expect(acceptUpdate(original, proposal, review, client, now)).rejects.toThrow('changed_update_scope');
  });

  it('should reject forged source identities, incompatible proposals and invented audits', async () => {
    const original = await bundle();
    const proposal = (await detectUpdate(original, targets[0], client, now))!;
    await expect(acceptUpdate(original, { ...proposal, repository: 'other/repo' }, review, client, now)).rejects.toThrow('invalid_proposal_identity');
    await expect(acceptUpdate(original, { ...proposal, schemaVersion: 2 }, review, client, now)).rejects.toMatchObject({ name: 'ZodError' });
    const unsafe = structuredClone(proposal);
    unsafe.content.artifacts[0].locations[0].url = 'https://example.com/arbitrary';
    await expect(acceptUpdate(original, unsafe, review, client, now)).rejects.toThrow('invalid_proposal_source');
    proposal.content.claims[0].dependencies.status = 'known';
    await expect(acceptUpdate(original, proposal, review, client, now)).rejects.toThrow('axiom_audit_not_performed');
  });

  it('should refuse publication when a receipt and the packaged data disagree', async () => {
    const original = await bundle();
    const proposal = (await detectUpdate(original, targets[0], client, now))!;
    const result = await acceptUpdate(original, proposal, review, client, now);
    result.bundle.claims[0].statement = 'Edited after review.';
    expect(() => validateAcceptedUpdate(result.bundle, result.proposal)).toThrow('unapplied_review');
  });

  it('should explain source outages and the explicit review command without claiming a replay', async () => {
    const original = await bundle();
    const proposal = (await detectUpdate(original, targets[0], { ...client, source: async () => null }, now))!;
    const report = proposalReport(proposal);
    expect(report).toContain('Unavailable; review blocked');
    expect(report).toContain('--confirm-reviewed');
    expect(report).toContain('not a published claim or a proof replay');
    expect(report).toContain(`/compare/${proposal.before}...${head}`);
    const changed = structuredClone(proposal);
    changed.observations.filter(o => o.revision === head).forEach(o => { o.sha256 = 'c'.repeat(64); });
    expect(proposalReport(changed)).toContain('Changed or old source unavailable');
  });

  it('should reject unknown targets and unsupported shared artifact scopes', async () => {
    expect(() => targetFor('unknown')).toThrow('unknown_target');
    const original = await bundle();
    original.claims[1].subjectArtifactIds.push('gasper-model');
    await expect(detectUpdate(original, targets[0], client, now)).rejects.toThrow('shared_artifact');
  });
});
