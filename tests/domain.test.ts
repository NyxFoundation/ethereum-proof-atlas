import { describe, expect, it } from 'vitest';
import raw from '../data/atlas.json';
import { digestBundle, validateBundle } from '../src/domain/validate';
import { claimsFor, availabilityFor } from '../src/domain/selectors';

const changed = async (mutate: (bundle: any) => void) => {
  const bundle = structuredClone(raw);
  mutate(bundle);
  bundle.datasetRevision = await digestBundle(bundle);
  return bundle;
};

describe('bundle integrity', () => {
  it('should accept the inspected, pinned dataset when all references resolve', async () => {
    expect((await validateBundle(raw)).architectureViews).toHaveLength(2);
  });
  it('should reject tampering when the canonical digest differs', async () => {
    await expect(validateBundle({ ...raw, datasetRevision: '0'.repeat(64) })).rejects.toThrow();
  });
  it.each([
    ['schema version', (b: any) => { b.schemaVersion = 2; }],
    ['dangling component', (b: any) => { b.architectureViews[0].componentInstances[0].componentId = 'missing'; }],
    ['duplicate ID', (b: any) => { b.components.push(b.components[0]); }],
    ['cross-view edge', (b: any) => { b.architectureEdges[0].target = 'only-in-another-view'; }],
    ['unsafe URL', (b: any) => { b.artifacts[0].locations[0].url = 'javascript:alert(1)'; }],
    ['moving source', (b: any) => { b.artifacts[0].locations[0].url = b.artifacts[0].locations[0].url.replace(b.artifacts[0].revision, 'main'); }],
    ['non-finite geometry', (b: any) => { b.architectureViews[0].componentInstances[0].position.x = 999999; }],
    ['unlocated evidence', (b: any) => { b.evidence[0].locationId = 'missing'; }],
    ['unsupported evidence', (b: any) => { b.evidence[0].claimId = 'missing'; }],
    ['no intake observation', (b: any) => { b.checkRecords = b.checkRecords.filter((c: any) => c.kind !== 'availability'); }],
    ['no applicability basis', (b: any) => { b.architectureViews[0].claimBindings[0].basis.checkId = 'missing'; }],
    ['false direct binding', (b: any) => { b.architectureViews[0].claimBindings[0].applicabilityKind = 'direct-subject'; b.architectureViews[0].claimBindings[0].basis = { kind: 'version-match' }; }],
    ['unknown interpreted as absence', (b: any) => { b.claims[0].assumptions = { status: 'known', details: [] }; }],
  ])('should reject %s when the dataset is invalid', async (_name, mutate) => {
    await expect(validateBundle(await changed(mutate))).rejects.toThrow();
  });
  it('should deduplicate claims when multiple evidence records exist', async () => {
    const bundle = await validateBundle(await changed(b => {
      b.evidence.push({...b.evidence[0], id: 'second-supporting-location'});
    }));
    const view = bundle.architectureViews[0];
    const binding = view.claimBindings[0];
    expect(claimsFor(bundle, view.id, binding.componentInstanceId)).toHaveLength(1);
    expect(claimsFor(bundle, bundle.architectureViews[1].id, binding.componentInstanceId)).toHaveLength(0);
  });
  it('should preserve a claim when its source becomes unavailable after intake', async () => {
    const bundle = await validateBundle(await changed(b => {
      const check = b.checkRecords.find((c: any) => c.kind === 'availability');
      b.checkRecords.push({ ...check, id: 'later-outage', checkedAt: '2026-11-07T00:00:00Z', result: 'unavailable' });
    }));
    const proof = bundle.evidence[0];
    expect(availabilityFor(bundle, proof.artifactId, proof.locationId)?.result).toBe('unavailable');
    expect(bundle.claims.length).toBe(raw.claims.length);
  });
});
