import { describe, expect, it } from 'vitest';
import raw from '../data/atlas.json';
import { validateStructure } from '../src/domain/validate';
import { buildIndex, countBand } from '../src/domain/indexLayout';

const bundle = validateStructure(raw);
const beacon = bundle.architectureViews.find(v => v.id === 'beacon')!;
const lean = bundle.architectureViews.find(v => v.id === 'lean')!;
const execution = bundle.architectureViews.find(v => v.id === 'execution')!;
const build = (view: typeof beacon) => buildIndex(bundle, view);
const rows = (view: typeof beacon) => build(view).rows;
const row = (view: typeof beacon, instanceId: string) => rows(view).find(r => r.instanceId === instanceId)!;

describe('index table layout', () => {
  it('should list each view instance one per row in the recorded order', () => {
    expect(rows(beacon).map(r => r.instanceId))
      .toEqual(['b-head', 'b-state', 'b-finality', 'b-da', 'b-p2p', 'b-ssz', 'b-bls', 'b-kzg']);
    expect(rows(lean).map(r => r.instanceId))
      .toEqual(['l-head', 'l-state', 'l-finality', 'l-p2p', 'l-ssz', 'l-signatures', 'l-xmss', 'l-poseidon']);
    expect(rows(execution).map(r => r.instanceId))
      .toEqual(['x-transition', 'x-evm', 'x-trie', 'x-elp2p', 'x-solc']);
  });
  it('should keep the recorded component identity and area on each row', () => {
    expect(row(beacon, 'b-p2p')).toEqual(expect.objectContaining({
      componentId: 'consensus-network', name: 'Consensus Gossipsub', area: 'networking' }));
    expect(row(beacon, 'b-bls')).toEqual(expect.objectContaining({
      componentId: 'bls', name: 'BLS signatures', area: 'cryptography' }));
    expect(row(execution, 'x-elp2p')).toEqual(expect.objectContaining({
      name: 'Execution ETH / RLPx', area: 'networking' }));
    expect(row(execution, 'x-solc')).toEqual(expect.objectContaining({
      name: 'Solidity / solc', area: 'development' }));
    expect(row(lean, 'l-xmss')).toEqual(expect.objectContaining({ area: 'cryptography' }));
  });
  it('should expose catalogued claim counts per view without inflating evidence', () => {
    expect(row(beacon, 'b-state').count).toBe(1);
    expect(row(beacon, 'b-finality').count).toBe(1);
    expect(row(beacon, 'b-head').count).toBe(0);
    expect(row(lean, 'l-state').count).toBe(1);
    expect(row(lean, 'l-finality').count).toBe(1);
    expect(row(execution, 'x-transition').count).toBe(0);
  });
  it('should band neutral shading over exact counts', () => {
    expect(row(beacon, 'b-state')!.band).toBe(1);
    expect(row(beacon, 'b-head')!.band).toBe(0);
    expect([0, 1, 2, 3, 4, 5, 9].map(countBand)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});
