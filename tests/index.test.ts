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
      ['b-bls', 'b-kzg', 'b-ssz'].sort());
    expect(bands[1].cells.map(c => c.instanceId)).toEqual(['b-p2p']);
    expect(bands[2].cells.map(c => c.instanceId)).toEqual(['b-finality']);
    expect(bands[3].cells.map(c => c.instanceId)).toEqual(['b-da', 'b-state']);
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
    expect(cell(beacon, 'b-bls').group).toBe('cryptography');
    expect(cell(beacon, 'b-ssz').group).toBe('serialization');
    expect(cell(lean, 'l-xmss').group).toBe('cryptography');
    expect(cell(lean, 'l-signatures').group).toBe('cryptography');
    expect(cells(beacon).some(c => c.group === 'development')).toBe(false);
    expect(cells(beacon).some(c => c.group === 'execution')).toBe(false);
  });
  it('should resolve networking groups from recorded edges of the selected view', () => {
    const execution = bundle.architectureViews.find(v => v.id === 'execution')!;
    expect(cell(beacon, 'b-p2p').group).toBe('consensus');
    expect(cell(lean, 'l-p2p').group).toBe('consensus');
    expect(cell(execution, 'x-elp2p').group).toBe('execution');
    expect(cells(lean).some(c => c.group === 'development')).toBe(false);
  });
  it('should assemble the execution view as its own foundation-first table', () => {
    const execution = bundle.architectureViews.find(v => v.id === 'execution')!;
    const { bands } = build(execution);
    expect(bands).toHaveLength(3);
    expect(bands[0].cells.map(c => c.instanceId)).toEqual(['x-elp2p', 'x-solc']);
    expect(bands[1].cells.map(c => c.instanceId)).toEqual(['x-evm', 'x-trie']);
    expect(bands[2].cells.map(c => c.instanceId)).toEqual(['x-transition']);
    expect(cell(execution, 'x-evm').group).toBe('execution');
    expect(cell(execution, 'x-trie').group).toBe('execution');
    expect(cell(execution, 'x-solc').group).toBe('development');
    expect(cell(execution, 'x-transition').count).toBe(0);
  });
  it('should keep execution-side networking beside trie order in stored x direction', () => {
    const execution = bundle.architectureViews.find(v => v.id === 'execution')!;
    expect(build(execution).bands[1].cells.map(c => c.instanceId)).toEqual(['x-evm', 'x-trie']);
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
  it('should list only the group rows present in each view, in fixed order', () => {
    const execution = bundle.architectureViews.find(v => v.id === 'execution')!;
    expect(build(beacon).groups).toEqual(['consensus', 'cryptography', 'serialization']);
    expect(build(lean).groups).toEqual(['consensus', 'cryptography', 'serialization']);
    expect(build(execution).groups).toEqual(['execution', 'development']);
  });
  it('should declare every catalogued group row in fixed order', () => {
    expect(COLUMN_GROUPS.map(group => group.id))
      .toEqual(['consensus', 'execution', 'cryptography', 'serialization', 'development']);
    expect(COLUMN_GROUPS.map(group => group.label))
      .toEqual(['Consensus', 'Execution', 'Cryptography', 'Serialization', 'Development']);
  });
});
