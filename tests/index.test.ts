import { describe, expect, it } from 'vitest';
import raw from '../data/atlas.json';
import { validateStructure } from '../src/domain/validate';
import { buildIndex, cellSpans, countBand } from '../src/domain/indexLayout';

const bundle = validateStructure(raw);
const beacon = bundle.architectureViews.find(v => v.id === 'beacon')!;
const lean = bundle.architectureViews.find(v => v.id === 'lean')!;
const execution = bundle.architectureViews.find(v => v.id === 'execution')!;
const build = (view: typeof beacon) => buildIndex(bundle, view);
const row = (view: typeof beacon, group: string) => build(view).rows.find(r => r.group === group)!;

describe('index table layout', () => {
  it('should pack each group row left to right in foundations-first reading order', () => {
    expect(build(beacon).columns).toBe(5);
    expect(row(beacon, 'consensus').cells.map(c => c.name)).toEqual([
      'Consensus Gossipsub', 'Justification / finalization', 'PeerDAS', 'State transition', 'Fork choice']);
    expect(row(beacon, 'cryptography').cells.map(c => c.name)).toEqual(['KZG commitments', 'BLS signatures']);
    expect(row(beacon, 'serialization').cells.map(c => c.name)).toEqual(['SSZ / Merkleization']);
  });
  it('should order parallel lean rows without stacking or gaps', () => {
    const table = build(lean);
    expect(table.columns).toBe(4);
    expect(row(lean, 'consensus').cells.map(c => c.name)).toEqual([
      'Consensus Gossipsub', 'Justification / finalization', 'State transition', 'Fork choice']);
    expect(row(lean, 'cryptography').cells.map(c => c.name)).toEqual(
      ['Poseidon / Merkle tree', 'XMSS signatures', 'Signature aggregation']);
    expect(row(lean, 'serialization').cells.map(c => c.name)).toEqual(['SSZ / Merkleization']);
  });
  it('should pack the execution view rows independently of other views', () => {
    const table = build(execution);
    expect(table.columns).toBe(4);
    expect(row(execution, 'execution').cells.map(c => c.name)).toEqual(
      ['Execution ETH / RLPx', 'EVM', 'State / Patricia trie', 'Execution transition']);
    expect(row(execution, 'development').cells.map(c => c.name)).toEqual(['Solidity / solc']);
    expect(table.rows.find(r => r.group === 'consensus')).toBeUndefined();
  });
  it('should stretch short group rows across the full table width without empty cells', () => {
    const table = build(beacon);
    expect(table.columns).toBe(5);
    expect(cellSpans(table.columns, 5)).toEqual([1, 1, 1, 1, 1]);
    expect(cellSpans(table.columns, 2)).toEqual([3, 2]);
    expect(cellSpans(table.columns, 1)).toEqual([5]);
    expect(cellSpans(table.columns, 0)).toEqual([]);
    expect(cellSpans(0, 2)).toEqual([]);
    expect(cellSpans(3, 5)).toEqual([]);
    for (const view of [beacon, lean, execution]) {
      const stretched = build(view);
      expect(stretched.columns).toBeGreaterThan(0);
      for (const row of stretched.rows) {
        const spans = cellSpans(stretched.columns, row.cells.length);
        expect(spans).toHaveLength(row.cells.length);
        expect(spans.length).toBeGreaterThan(0);
        expect(spans.reduce((sum, span) => sum + span, 0)).toBe(stretched.columns);
        expect(Math.max(...spans) - Math.min(...spans)).toBeLessThanOrEqual(1);
      }
    }
  });
  it('should resolve networking rows from recorded edges of the selected view', () => {
    expect(row(execution, 'execution').cells.find(c => c.name === 'Execution ETH / RLPx')).toBeTruthy();
    expect(row(beacon, 'consensus').cells.find(c => c.name === 'Consensus Gossipsub')).toBeTruthy();
    expect(row(lean, 'consensus').cells.find(c => c.name === 'Consensus Gossipsub')).toBeTruthy();
  });
  it('should expose catalogued claim counts per view without inflating evidence', () => {
    expect(row(beacon, 'consensus').cells.find(c => c.instanceId === 'b-state')!.count).toBe(2);
    expect(row(beacon, 'cryptography').cells.find(c => c.instanceId === 'b-kzg')!.count).toBe(3);
    expect(row(lean, 'consensus').cells.find(c => c.instanceId === 'l-state')!.count).toBe(1);
    expect(row(execution, 'execution').cells.find(c => c.instanceId === 'x-transition')!.count).toBe(0);
  });
  it('should band neutral shading over exact counts', () => {
    expect(row(beacon, 'consensus').cells.find(c => c.instanceId === 'b-head')!.band).toBe(0);
    expect(row(beacon, 'consensus').cells.find(c => c.instanceId === 'b-state')!.band).toBe(1);
    expect([0, 1, 2, 3, 4, 5, 9].map(countBand)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});
