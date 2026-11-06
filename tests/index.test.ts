import { describe, expect, it } from 'vitest';
import raw from '../data/atlas.json';
import { validateStructure } from '../src/domain/validate';
import { buildIndex, COLUMN_GROUPS, countBand } from '../src/domain/indexLayout';

const bundle = validateStructure(raw);
const beacon = bundle.architectureViews.find(v => v.id === 'beacon')!;
const lean = bundle.architectureViews.find(v => v.id === 'lean')!;
const build = (view: typeof beacon) => buildIndex(bundle, view);
const cells = (view: typeof beacon) => build(view).rows.flatMap(row => row.cells);
const cell = (view: typeof beacon, instanceId: string) => cells(view).find(c => c.instanceId === instanceId)!;

describe('index table layout', () => {
  it('should derive rows from stored positions with foundations at the bottom', () => {
    const table = build(beacon);
    expect(table.rows).toHaveLength(5);
    expect(table.rows[0].cells.map(c => c.instanceId)).toEqual(['b-head']);
    expect(table.rows[1].cells.map(c => c.instanceId)).toEqual(['b-da', 'b-state', 'b-execution']);
    expect(table.rows[2].cells.map(c => c.instanceId)).toEqual(['b-finality', 'b-evm', 'b-solc']);
    expect(table.rows[3].cells.map(c => c.instanceId)).toEqual(['b-p2p']);
    expect(table.rows[4].cells.map(c => c.instanceId).sort()).toEqual(
      ['b-bls', 'b-elp2p', 'b-kzg', 'b-ssz', 'b-trie'].sort());
  });
  it('should keep parallel lean rows and their foundation order', () => {
    const table = build(lean);
    expect(table.rows).toHaveLength(6);
    expect(table.rows[0].cells.map(c => c.instanceId)).toEqual(['l-head']);
    expect(table.rows[2].cells.map(c => c.instanceId)).toEqual(['l-finality', 'l-signatures']);
    expect(table.rows[table.rows.length - 1].cells.map(c => c.instanceId)).toEqual(['l-poseidon']);
  });
  it('should place each area in its catalogued column', () => {
    expect(cell(beacon, 'b-state').column).toBe('consensus');
    expect(cell(beacon, 'b-evm').column).toBe('execution');
    expect(cell(beacon, 'b-bls').column).toBe('cryptography');
    expect(cell(beacon, 'b-ssz').column).toBe('serialization');
    expect(cell(beacon, 'b-solc').column).toBe('development');
    expect(cell(lean, 'l-xmss').column).toBe('cryptography');
    expect(cell(lean, 'l-signatures').column).toBe('cryptography');
  });
  it('should resolve networking columns from recorded edges of the selected view', () => {
    expect(cell(beacon, 'b-p2p').column).toBe('consensus');
    expect(cell(beacon, 'b-elp2p').column).toBe('execution');
    expect(cell(lean, 'l-p2p').column).toBe('consensus');
    expect(cells(lean).some(c => c.column === 'development')).toBe(false);
  });
  it('should keep execution-side networking beside trie in one band, not a new row', () => {
    const row = build(beacon).rows.find(row => row.cells.some(c => c.instanceId === 'b-trie'))!;
    expect(row.cells.filter(c => c.column === 'execution').map(c => c.instanceId))
      .toEqual(['b-trie', 'b-elp2p']);
  });
  it('should expose catalogued claim counts per view without inflating evidence', () => {
    expect(cell(beacon, 'b-state').count).toBe(1);
    expect(cell(beacon, 'b-finality').count).toBe(1);
    expect(cell(beacon, 'b-head').count).toBe(0);
    expect(cell(beacon, 'b-p2p').count).toBe(0);
    expect(cell(lean, 'l-state').count).toBe(1);
    expect(cell(lean, 'l-finality').count).toBe(1);
  });
  it('should band neutral shading over exact counts', () => {
    expect(cell(beacon, 'b-state')!.band).toBe(1);
    expect(cell(beacon, 'b-head')!.band).toBe(0);
    expect([0, 1, 2, 3, 4, 5, 9].map(countBand)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
  it('should declare every catalogued column group in fixed order', () => {
    expect(COLUMN_GROUPS.map(group => group.id))
      .toEqual(['consensus', 'execution', 'cryptography', 'serialization', 'development']);
    expect(COLUMN_GROUPS.map(group => group.label))
      .toEqual(['Consensus', 'Execution', 'Cryptography', 'Serialization', 'Development']);
  });
});
