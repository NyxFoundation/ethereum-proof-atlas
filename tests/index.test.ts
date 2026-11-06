import { describe, expect, it } from 'vitest';
import raw from '../data/atlas.json';
import { validateStructure } from '../src/domain/validate';
import { buildIndex, countBand } from '../src/domain/indexLayout';

const bundle = validateStructure(raw);
const beacon = bundle.architectureViews.find(v => v.id === 'beacon')!;
const lean = bundle.architectureViews.find(v => v.id === 'lean')!;
const execution = bundle.architectureViews.find(v => v.id === 'execution')!;
const build = (view: typeof beacon) => buildIndex(bundle, view);
const cells = (view: typeof beacon) => build(view).bands.flatMap(band => band.cells);
const cell = (view: typeof beacon, instanceId: string) => cells(view).find(c => c.instanceId === instanceId)!;

describe('index table layout', () => {
  it('should derive column bands from stored positions with foundations as the leftmost columns', () => {
    const { bands } = build(beacon);
    expect(bands).toHaveLength(5);
    expect(bands[0].cells.map(c => c.instanceId)).toEqual(['b-kzg', 'b-ssz', 'b-bls']);
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
  it('should assemble the execution view as its own foundation-first table', () => {
    const { bands } = build(execution);
    expect(bands).toHaveLength(3);
    expect(bands[0].cells.map(c => c.instanceId)).toEqual(['x-elp2p', 'x-solc']);
    expect(bands[1].cells.map(c => c.instanceId)).toEqual(['x-evm', 'x-trie']);
    expect(bands[2].cells.map(c => c.instanceId)).toEqual(['x-transition']);
  });
  it('should give every view instance exactly one subdivided component row', () => {
    for (const view of bundle.architectureViews) {
      const rows = build(view).bands.flatMap(band => band.cells.map(c => c.instanceId));
      expect(rows).toHaveLength(view.componentInstances.length);
      expect(new Set(rows).size).toBe(view.componentInstances.length);
      expect(new Set(view.componentInstances.map(i => i.instanceId))).toEqual(new Set(rows));
    }
  });
  it('should expose the component area on each subdivided row', () => {
    expect(cell(beacon, 'b-p2p').area).toBe('networking');
    expect(cell(beacon, 'b-bls').area).toBe('cryptography');
    expect(cell(beacon, 'b-ssz').area).toBe('serialization');
    expect(cell(execution, 'x-elp2p').area).toBe('networking');
    expect(cell(execution, 'x-solc').area).toBe('development');
    expect(cell(execution, 'x-evm').area).toBe('execution');
    expect(cell(lean, 'l-xmss').area).toBe('cryptography');
  });
  it('should expose catalogued claim counts per view without inflating evidence', () => {
    expect(cell(beacon, 'b-state').count).toBe(1);
    expect(cell(beacon, 'b-finality').count).toBe(1);
    expect(cell(beacon, 'b-head').count).toBe(0);
    expect(cell(lean, 'l-state').count).toBe(1);
    expect(cell(lean, 'l-finality').count).toBe(1);
    expect(cell(execution, 'x-transition').count).toBe(0);
  });
  it('should band neutral shading over exact counts', () => {
    expect(cell(beacon, 'b-state')!.band).toBe(1);
    expect(cell(beacon, 'b-head')!.band).toBe(0);
    expect([0, 1, 2, 3, 4, 5, 9].map(countBand)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});
