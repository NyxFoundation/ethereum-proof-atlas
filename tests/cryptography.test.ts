import { describe, expect, it } from 'vitest';
import raw from '../data/atlas.json';
import { buildIndex } from '../src/domain/indexLayout';
import { availabilityFor, claimsFor, sourceFor, visibleEdges, visibleInstances } from '../src/domain/selectors';
import { validateStructure } from '../src/domain/validate';

const bundle = validateStructure(raw);
const view = (id: string) => bundle.architectureViews.find(candidate => candidate.id === id)!;
const cryptoCells = (id: string) => buildIndex(bundle, view(id)).rows.find(row => row.group === 'cryptography')!.cells;

describe('cryptographic function boundaries', () => {
  it('should keep curve membership separate from signatures and KZG when Beacon is indexed', () => {
    expect(cryptoCells('beacon').map(cell => [cell.name, cell.count])).toEqual([
      ['BLS hash-to-G2', 1], ['KZG commitments', 2], ['BLS signatures', 0],
    ]);
    expect(claimsFor(bundle, 'beacon', 'b-bls-hash-to-g2').map(claim => claim.id)).toEqual(['bls-hash-to-g2-valid']);
    expect(claimsFor(bundle, 'beacon', 'b-bls')).toEqual([]);
    expect(claimsFor(bundle, 'beacon', 'b-kzg').map(claim => claim.id)).toEqual(['kzg-correctness', 'kzg-binding-reduction']);
  });

  it('should keep the XMSS theorem on the signature scheme rather than its foundations when Lean is indexed', () => {
    expect(cryptoCells('lean').map(cell => [cell.name, cell.count])).toEqual([
      ['Poseidon hashing', 0], ['XMSS Merkle authentication', 0], ['XMSS hash chains', 0],
      ['XMSS signatures', 1], ['Signature aggregation', 0],
    ]);
    expect(claimsFor(bundle, 'lean', 'l-xmss').map(claim => claim.id)).toEqual(['xmss-signature-correctness']);
    for (const id of ['l-poseidon', 'l-xmss-merkle', 'l-xmss-chains']) {
      expect(claimsFor(bundle, 'lean', id)).toEqual([]);
    }
  });

  it('should retain cell serialization only under PeerDAS without adding an encoding component', () => {
    const bindings = bundle.architectureViews.flatMap(view => view.claimBindings)
      .filter(binding => binding.claimId === 'kzg-cell-roundtrip');
    expect(bindings.map(binding => binding.componentInstanceId)).toEqual(['b-da']);
    expect(bundle.evidence.some(evidence => evidence.claimId === 'kzg-cell-roundtrip')).toBe(true);
    for (const id of ['beacon', 'lean']) {
      expect(buildIndex(bundle, view(id)).rows.find(row => row.group === 'serialization')!.cells.map(cell => cell.componentId))
        .toEqual(['ssz-codec', 'ssz-merkleization']);
    }
  });

  it.each(['beacon', 'lean'])('should show each cryptographic function without expansion in %s', viewId => {
    const visible = visibleInstances(view(viewId), new Set()).map(instance => instance.instanceId);
    for (const cell of cryptoCells(viewId)) expect(visible).toContain(cell.instanceId);
  });

  it('should expose sourced provider-to-consumer dependencies without transferring claims', () => {
    const pairs = (viewId: string) => visibleEdges(bundle, view(viewId), new Set()).map(edge => [edge.source, edge.target]);
    expect(pairs('beacon')).toContainEqual(['b-bls-hash-to-g2', 'b-bls']);
    expect(pairs('lean')).toEqual(expect.arrayContaining([
      ['l-poseidon', 'l-xmss-merkle'], ['l-poseidon', 'l-xmss-chains'],
      ['l-xmss-merkle', 'l-xmss'], ['l-xmss-chains', 'l-xmss'],
    ]));
    expect(pairs('lean')).not.toContainEqual(['l-poseidon', 'l-xmss']);
    for (const id of ['l-poseidon', 'l-xmss-merkle', 'l-xmss-chains']) {
      const instance = view('lean').componentInstances.find(instance => instance.instanceId === id)!;
      for (const ref of instance.sources) {
        const { artifact, location } = sourceFor(bundle, ref);
        expect(location.url).toContain(`/blob/${artifact.revision}/`);
        expect(availabilityFor(bundle, artifact.id, location.id)?.result).toBe('available');
      }
    }
  });

  it('should leave cryptography absent from the Execution view', () => {
    expect(buildIndex(bundle, view('execution')).rows.some(row => row.group === 'cryptography')).toBe(false);
  });
});
