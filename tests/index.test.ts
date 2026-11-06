import { describe, expect, it } from 'vitest';
import raw from '../data/atlas.json';
import { validateStructure } from '../src/domain/validate';
import { buildIndex, COLUMN_GROUPS, countBand } from '../src/domain/indexLayout';

const bundle = validateStructure(raw);
const beacon = bundle.architectureViews.find(v => v.id === 'beacon')!;
const lean = bundle.architectureViews.find(v => v.id === 'lean')!;
const build = (view: typeof beacon) => buildIndex(bundle, view);
const cells = (view: typeof beacon) => build(view).bands.flatMap(band => band.cells);
const cell = (view: typeof beacon, instanceId: string) => cells(view).find(c => c.instanceId === instanceId)!;

describe('index table layout', () => {
  it('should derive column bands from stored positions with foundations as the leftmost columns', () => {
    const { bands } = build(beacon);
    expect(bands).toHaveLength(5);
    expect(bands[0].cells.map(c => c.instanceId).sort()).toEqual(
      ['b-bls', 'b-elp2p', 'b-kzg', 'b-ssz', 'b-trie'].sort());
    expect(bands[1].cells.map(c => c.instanceId)).toEqual(['b-p2p']);
    expect(bands[2].cells.map(c => c.instanceId)).toEqual(['b-finality', 'b-evm', 'b-solc']);
    expect(bands[3].cells.map(c => c.instanceId)).toEqual(['b-da', 'b-state', 'b-execution']);
    expect(bands[4].cells.map(c => c.instanceId)).toEqual(['b-head']);
  });
  it('should keep parallel lean bands and their foundation order', () => {
    const { bands } = build(lean);
    expect(bands).toHaveLength(6);
    expect(bands[0].cells.map(c => c.instanceId)).toEqual(['l-poseidon']);
    expect(bands[1].cells.map(c => c.instanceId)).toEqual(['l-ssz', 'l-xmss']);
    expect(bands[5].cells.map(c => c.instanceId)).toEqual(['l-head']);
  });
  it('should place each area in its catalogued group row', () => {
    expect(cell(beacon, 'b-state').group).toBe('consensus');
    expect(cell(beacon, 'b-evm').group).toBe('execution');
    expect(cell(beacon, 'b-bls').group).toBe('cryptography');
    expect(cell(beacon, 'b-ssz').group).toBe('serialization');
    expect(cell(beacon, 'b-solc').group).toBe('development');
    expect(cell(lean, 'l-xmss').group).toBe('cryptography');
    expect(cell(lean, 'l-signatures').group).toBe('cryptography');
  });
  it('should resolve networking groups from recorded edges of the selected view', () => {
    expect(cell(beacon, 'b-p2p').group).toBe('consensus');
    expect(cell(beacon, 'b-elp2p').group).toBe('execution');
    expect(cell(lean, 'l-p2p').group).toBe('consensus');
    expect(cells(lean).some(c => c.group === 'development')).toBe(false);
  });
  it('should keep execution-side networking beside trie in one band, not a new column', () => {
    const band = build(beacon).bands[0];
    expect(band.cells.filter(c => c.group === 'execution').map(c => c.instanceId))
      .toEqual(['b-trie', 'b-elp2p']);
  });
  it('should expose catalogued claim counts per view without inflating evidence', () => {
    expect(cell(beacon, 'b-state').count).toBe(1);
    expect(cell(beacon, 'b-finality').count).toBe(1);
    expect(cell(beacon, 'b-head').count).toBe(0);
    expect(cell(lean, 'l-state').count).toBe(1);
    expect(cell(lean, 'l-finality').count).toBe(1);
  });
  it('should band neutral shading over exact counts', () => {
    expect(cell(beacon, 'b-state')!.band).toBe(1);
    expect(cell(beacon, 'b-head')!.band).toBe(0);
    expect([0, 1, 2, 3, 4, 5, 9].map(countBand)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
  it('should declare every catalogued group row in fixed order', () => {
    expect(COLUMN_GROUPS.map(group => group.id))
      .toEqual(['consensus', 'execution', 'cryptography', 'serialization', 'development']);
    expect(COLUMN_GROUPS.map(group => group.label))
      .toEqual(['Consensus', 'Execution', 'Cryptography', 'Serialization', 'Development']);
  });
});
