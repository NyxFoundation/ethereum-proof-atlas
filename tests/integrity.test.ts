import { describe, expect, it } from 'vitest';
import raw from '../data/atlas.json';
import { digestBundle, validateBundle } from '../src/domain/validate';
import { httpsUrl } from '../src/domain/schema';
import { visibleEdges, visibleInstances } from '../src/domain/selectors';

async function fixture(mutate: (bundle: any) => void) {
  const value = structuredClone(raw); mutate(value);
  value.datasetRevision = await digestBundle(value); return value;
}
describe('additional integrity boundaries', () => {
  it.each(['http://example.org','javascript:alert(1)','data:text/html,x','//example.org',
    'https://user:password@example.org/','https:///','not a URL','https://example.org/ a','https://example.org/\\evil'])(
    'should reject unsafe outbound URL %s', value => expect(httpsUrl.safeParse(value).success).toBe(false));
  it.each([
    ['duplicate instance', (b: any) => b.architectureViews[0].componentInstances.push(b.architectureViews[0].componentInstances[0])],
    ['duplicate binding', (b: any) => b.architectureViews[0].claimBindings.push(b.architectureViews[0].claimBindings[0])],
    ['component cycle', (b: any) => { b.components[0].childComponentIds = [b.components[0].id]; }],
    ['missing parent', (b: any) => { b.architectureViews[0].componentInstances[0].parentInstanceId = 'missing'; }],
    ['ambiguous snapshot', (b: any) => { b.architectureViews[0].componentInstances[0].subjectArtifactIds = ['leanspec']; }],
    ['CSS injection field', (b: any) => { b.architectureViews[0].componentInstances[0].style = {background: 'url(https://example.org)'}; }],
    ['unsafe location query', (b: any) => { b.artifacts[0].locations[0].url += '?ref=main'; }],
    ['wrong artifact path', (b: any) => { b.artifacts[0].locations[0].path = 'missing.md'; }],
    ['wrong revision length', (b: any) => { b.artifacts[0].revision = 'a'.repeat(64); }],
    ['unmatched comparison', (b: any) => { b.checkRecords.find((c: any) => c.kind === 'manual-comparison').viewId = 'lean'; }],
    ['unmatched review', (b: any) => { b.checkRecords.find((c: any) => c.kind === 'source-review').artifactId = 'lstar-proof'; }],
    ['unmatched check subjects', (b: any) => { b.checkRecords.find((c: any) => c.kind === 'source-review').subjectArtifactIds = ['lstar-model']; }],
    ['unbounded search without bounds', (b: any) => { b.evidence[0].scope.kind = 'bounded'; }],
    ['claim without evidence', (b: any) => { b.evidence = []; }],
    ['unsupported source language', (b: any) => { b.claims[0].title = '証明'; }],
  ])('should reject %s before packaging', async (_name, mutate) =>
    expect(validateBundle(await fixture(mutate))).rejects.toThrow());
  it('should accept exact multi-subject bindings and separately scoped refinement evidence', async () => {
    const value = await fixture(b => {
      const view = b.architectureViews[0];
      b.claims[0].subjectArtifactIds = ['gasper-model','consensus'];
      b.claims[0].relation = {kind: 'refinement',fromArtifactId: 'gasper-model',toArtifactId: 'consensus',direction: 'Fixture model to specification.'};
      b.checkRecords = b.checkRecords.filter((c: any) => c.kind !== 'manual-comparison' && c.kind !== 'source-review');
      for (const v of b.architectureViews) v.claimBindings = [];
      view.sources.push({artifactId: 'gasper-model',locationId: 'definitions'});
      view.componentInstances[0].subjectArtifactIds = ['gasper-model','consensus'];
      view.claimBindings.push({componentInstanceId: view.componentInstances[0].instanceId,claimId: b.claims[0].id,
        applicabilityKind: 'direct-subject',explanation: 'Synthetic fixture, never published.',sources: view.sources,
        basis: {kind: 'version-match'}});
    });
    expect((await validateBundle(value)).claims[0].relation?.kind).toBe('refinement');
  });
  it('should allow explicit cross-references and pin replay results to exact configurations', async () => {
    const value = await fixture(b => {
      b.checkRecords = b.checkRecords.filter((c: any) => c.kind !== 'manual-comparison');
      for (const v of b.architectureViews)
        for (const binding of v.claimBindings.filter((binding: any) => binding.applicabilityKind !== 'direct-subject'))
          binding.basis = {kind: 'source-cross-reference',explanation: 'Synthetic explicit cross-reference fixture.'};
      const evidence = b.evidence[0];
      b.checkRecords.push({id: 'fixture-replay',kind: 'replay',checkedAt: '2026-11-06T00:00:00Z',
        artifactId: evidence.artifactId,evidenceId: evidence.id,subjectArtifactIds: b.claims[0].subjectArtifactIds,
        scope: 'Fixture theorem only.',configuration: evidence.scope.configuration,result: 'passed',details: 'Fixture only.'});
    });
    expect((await validateBundle(value)).checkRecords.at(-1)?.kind).toBe('replay');
    Object.assign(value.checkRecords.at(-1)!, {configuration: 'Different configuration'});
    await expect(validateBundle(value)).rejects.toThrow('replay configuration');
  });
  it('should hash canonical JSON independently of object key order but preserve array order', async () => {
    expect(await digestBundle({x: 1,y: [1,2],datasetRevision: 'unused'})).toBe(await digestBundle({y: [1,2],x: 1}));
    expect(await digestBundle({y: [1,2]})).not.toBe(await digestBundle({y: [2,1]}));
  });
  it('should reveal children without duplicating or moving the stored overview roles', async () => {
    const bundle = await validateBundle(raw);
    const view = bundle.architectureViews[0];
    const collapsed = visibleInstances(view, new Set());
    const expanded = visibleInstances(view, new Set(['b-state']));
    expect(expanded.length).toBe(collapsed.length + 1);
    expect(visibleEdges(bundle, view, new Set()).some(e => e.source === 'b-finality')).toBe(false);
    expect(visibleEdges(bundle, view, new Set(['b-state'])).some(e => e.source === 'b-finality')).toBe(true);
    expect(collapsed[0].position).toEqual(expanded[0].position);
  });
});
