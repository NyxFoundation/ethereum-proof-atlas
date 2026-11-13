import { describe, expect, it } from 'vitest';
import raw from '../data/atlas.json';
import { buildIndex } from '../src/domain/indexLayout';
import { claimsFor, availabilityFor, visibleEdges, visibleInstances } from '../src/domain/selectors';
import { validateStructure } from '../src/domain/validate';

const bundle = validateStructure(raw);
const additions = [
  'varint-codec-roundtrip', 'ffg-churn-intersection-bound', 'lstar-incremental-head',
  'kzg-binding-reduction', 'bls-hash-to-g2-valid', 'xmss-signature-correctness',
  'kzg-cell-roundtrip', 'modexp-output-correctness',
];
const expected = [
  ['beacon', 'b-state', 2, 'ffg-churn-intersection-bound'],
  ['beacon', 'b-finality', 2, 'ffg-churn-intersection-bound'],
  ['beacon', 'b-reqresp', 1, 'varint-codec-roundtrip'],
  ['beacon', 'b-bls-hash-to-g2', 1, 'bls-hash-to-g2-valid'],
  ['beacon', 'b-kzg', 2, 'kzg-binding-reduction'],
  ['beacon', 'b-da', 1, 'kzg-cell-roundtrip'],
  ['lean', 'l-head', 1, 'lstar-incremental-head'],
  ['lean', 'l-varint', 1, 'varint-codec-roundtrip'],
  ['lean', 'l-xmss', 1, 'xmss-signature-correctness'],
  ['execution', 'x-evm', 1, 'modexp-output-correctness'],
] as const;

describe('SSZ component boundaries', () => {
  it.each([['beacon', 'b'], ['lean', 'l']])(
    'should separate codec and Merkle claims in the index and map when %s is selected', (viewId, prefix) => {
      const view = bundle.architectureViews.find(candidate => candidate.id === viewId)!;
      const cells = buildIndex(bundle, view).rows.find(row => row.group === 'serialization')!.cells;
      expect(cells).toEqual([
        { instanceId: `${prefix}-ssz-codec`, componentId: 'ssz-codec',
          name: 'SSZ encoding / decoding', count: 1, band: 1 },
        { instanceId: `${prefix}-ssz-merkleization`, componentId: 'ssz-merkleization',
          name: 'SSZ Merkleization', count: 1, band: 1 },
      ]);
      const visible = visibleInstances(view, new Set()).map(instance => instance.instanceId);
      for (const cell of cells) expect(visible).toContain(cell.instanceId);
      expect(claimsFor(bundle, viewId, cells[0].instanceId).map(claim => claim.id)).toEqual(['ssz-canonical-codec']);
      expect(claimsFor(bundle, viewId, cells[1].instanceId).map(claim => claim.id)).toEqual(['ssz-branch-rebuilds-root']);
      for (const cell of cells) {
        expect(view.claimBindings.find(binding => binding.componentInstanceId === cell.instanceId))
          .toMatchObject({ applicabilityKind: 'direct-subject', basis: { kind: 'version-match' } });
      }
      expect(view.componentInstances.some(instance => instance.componentId === 'ssz')).toBe(false);
    });
  it.each([['beacon', 'b'], ['lean', 'l']])(
    'should route encoding and root consumers to their own providers when %s is mapped', (viewId, prefix) => {
      const view = bundle.architectureViews.find(candidate => candidate.id === viewId)!;
      const edges = visibleEdges(bundle, view, new Set());
      expect(edges.filter(edge => edge.source === `${prefix}-ssz-codec`).map(edge => [edge.target, edge.label]))
        .toEqual([[`${prefix}-gossipsub`, 'SSZ-Snappy']]);
      expect(edges.filter(edge => edge.source === `${prefix}-ssz-merkleization`).map(edge => [edge.target, edge.label]))
        .toEqual(viewId === 'beacon'
          ? [[`${prefix}-state`, 'Hash-tree roots']]
          : [[`${prefix}-state`, 'Hash-tree roots'], [`${prefix}-signatures`, 'Message roots']]);
    });
  it('should omit consensus serialization when the execution view is selected', () => {
    const view = bundle.architectureViews.find(candidate => candidate.id === 'execution')!;
    expect(buildIndex(bundle, view).rows.some(row => row.group === 'serialization')).toBe(false);
    expect(visibleInstances(view, new Set()).some(instance => instance.componentId.startsWith('ssz'))).toBe(false);
    expect(view.claimBindings.some(binding => binding.claimId.startsWith('ssz-'))).toBe(false);
  });
});

describe('inspected proof catalogue', () => {
  it.each(expected)('should expose %s/%s with %i claims including %s when indexed', (viewId, instanceId, count, claimId) => {
    const view = bundle.architectureViews.find(candidate => candidate.id === viewId)!;
    const claims = claimsFor(bundle, viewId, instanceId);
    expect(claims).toHaveLength(count);
    expect(claims.map(claim => claim.id)).toContain(claimId);
    const cell = buildIndex(bundle, view).rows.flatMap(row => row.cells)
      .find(candidate => candidate.instanceId === instanceId)!;
    expect(cell.count).toBe(count);
    const binding = view.claimBindings.find(candidate =>
      candidate.componentInstanceId === instanceId && candidate.claimId === claimId)!;
    expect(binding.applicabilityKind).toBe('related-model');
    expect(binding.basis.kind).toBe('manual-comparison');
  });

  it.each(additions)('should retain pinned evidence and unknown replay for %s when published', claimId => {
    const claim = bundle.claims.find(candidate => candidate.id === claimId);
    expect(claim).toBeDefined();
    expect(claim?.dependencies.status).toBe('unknown');
    expect(claim?.relation).toBeNull();
    const evidence = bundle.evidence.filter(record => record.claimId === claimId);
    expect(evidence.length).toBeGreaterThan(0);
    for (const record of evidence) {
      const artifact = bundle.artifacts.find(candidate => candidate.id === record.artifactId)!;
      const location = artifact.locations.find(candidate => candidate.id === record.locationId)!;
      expect(location.url).toContain(`/blob/${artifact.revision}/`);
      expect(location.url).toMatch(/#L\d+-L\d+$/);
      expect(availabilityFor(bundle, artifact.id, location.id)?.result).toBe('available');
      const checks = bundle.checkRecords.filter(check => 'evidenceId' in check && check.evidenceId === record.id);
      expect(checks.some(check => check.kind === 'source-review' && check.result === 'reviewed')).toBe(true);
      expect(checks.some(check => check.kind === 'replay')).toBe(false);
    }
  });

  it('should count one codec property when two leanp2p theorem locations support it', () => {
    expect(bundle.evidence.filter(record => record.claimId === 'varint-codec-roundtrip')).toHaveLength(2);
    for (const [view, instance] of [['beacon', 'b-reqresp'], ['lean', 'l-varint']]) {
      expect(claimsFor(bundle, view, instance).map(claim => claim.id)).toEqual(['varint-codec-roundtrip']);
    }
    for (const other of bundle.architectureViews.flatMap(view => view.componentInstances)
      .filter(instance => !['b-reqresp', 'l-varint'].includes(instance.instanceId))) {
      expect(claimsFor(bundle, bundle.architectureViews.find(view => view.claimBindings.some(
        binding => binding.componentInstanceId === other.instanceId))?.id ?? 'execution', other.instanceId)
        .map(claim => claim.id)).not.toContain('varint-codec-roundtrip');
    }
  });

  it('should preserve scope differences when a related model is bound to a protocol', () => {
    const codec = bundle.claims.find(claim => claim.id === 'varint-codec-roundtrip')!;
    expect(codec).toBeDefined();
    expect(codec.limitations.join(' ')).toContain('63-bit');
    expect(codec.limitations.join(' ')).toContain('64-bit');
    const xmss = bundle.claims.find(claim => claim.id === 'xmss-signature-correctness')!;
    expect(xmss.limitations.join(' ')).toContain('Keccak');
    expect(xmss.limitations.join(' ')).toContain('Poseidon');
    expect(xmss.assumptions.details.join(' ')).toContain('succeeds');
    expect(bundle.architectureViews.find(view => view.id === 'beacon')!.claimBindings
      .some(binding => binding.claimId === xmss.id)).toBe(false);
  });

  it('should not turn OTS research or SSZ conformance tests into protocol guarantees', () => {
    for (const artifactId of ['ots-golf-model', 'ots-golf-proofs', 'ssz-lean']) {
      expect(bundle.claims.some(claim => claim.subjectArtifactIds.includes(artifactId))).toBe(false);
      expect(bundle.evidence.some(record => record.artifactId === artifactId)).toBe(false);
    }
    expect(bundle.claims.filter(claim => claim.id.startsWith('ssz-')).map(claim => claim.id))
      .toEqual(['ssz-canonical-codec', 'ssz-branch-rebuilds-root']);
  });
});
