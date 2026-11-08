import type { AtlasBundle, ArchitectureView, Component } from './schema';
import { claimsFor } from './selectors';

const COLUMN_IDS = ['consensus', 'execution', 'cryptography', 'serialization', 'development'] as const;
export type ColumnId = (typeof COLUMN_IDS)[number];
export const COLUMN_GROUPS: ReadonlyArray<{ id: ColumnId; label: string }> = [
  { id: 'consensus', label: 'Consensus' },
  { id: 'execution', label: 'Execution' },
  { id: 'cryptography', label: 'Cryptography' },
  { id: 'serialization', label: 'Serialization' },
  { id: 'development', label: 'Development' },
];
// Stored overview positions closer than this tolerance share one reading band.
const ROW_BAND_TOLERANCE = 60;
// Within a packed group row, cells read foundations first: descending band
// index (low y bands are upper layers) then stored x.
const READING_ORDER = (a: { band: number; order: number }, b: { band: number; order: number }) =>
  b.band - a.band || a.order - b.order;

export type IndexCell = {
  instanceId: string;
  componentId: string;
  name: string;
  band: 0 | 1 | 2 | 3;
  count: number;
};
export type IndexRow = { group: ColumnId; cells: IndexCell[] };
export type IndexTable = { columns: number; rows: IndexRow[] };

export function countBand(count: number): 0 | 1 | 2 | 3 {
  return count <= 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : 3;
}
// A row shorter than the widest row widens its cells across the table width
// instead of leaving empty positions; the first cells absorb the remainder, so
// widths differ by at most one column. Total and valid-plan-only: an empty
// array means no cells, or a geometry where integer table columns cannot give
// every cell at least one column.
export function cellSpans(columns: number, count: number): number[] {
  if (count <= 0 || columns <= 0 || count > columns) return [];
  const base = Math.floor(columns / count);
  const remainder = columns % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}
const byArea: Record<Component['area'], ColumnId> = {
  consensus: 'consensus',
  execution: 'execution',
  cryptography: 'cryptography',
  networking: 'consensus',
  serialization: 'serialization',
  development: 'development',
};

export function buildIndex(bundle: AtlasBundle, view: ArchitectureView): IndexTable {
  const areaOfInstance = new Map(view.componentInstances.map(instance => {
    const component = bundle.components.find(c => c.id === instance.componentId)!;
    return [instance.instanceId, component.area] as const;
  }));
  const group = (instanceId: string, area: Component['area']): ColumnId => {
    if (area !== 'networking') return byArea[area];
    const neighborAreas = new Set<string>();
    for (const edge of bundle.architectureEdges) {
      if (edge.viewId !== view.id) continue;
      if (edge.source === instanceId) neighborAreas.add(areaOfInstance.get(edge.target) ?? '');
      if (edge.target === instanceId) neighborAreas.add(areaOfInstance.get(edge.source) ?? '');
    }
    return neighborAreas.has('execution') && !neighborAreas.has('consensus') ? 'execution' : 'consensus';
  };
  // Stored positions only order the cells inside a row: foundations first.
  const ascending = [...view.componentInstances]
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const cellByGroup = new Map<ColumnId, { cell: IndexCell; band: number; order: number }[]>();
  const bands: number[] = [];
  for (const instance of ascending) {
    const component = bundle.components.find(c => c.id === instance.componentId)!;
    const count = claimsFor(bundle, view.id, instance.instanceId).length;
    const band = bands.at(-1);
    if (band === undefined || instance.position.y - band > ROW_BAND_TOLERANCE) {
      bands.push(instance.position.y);
    }
    const groupIndex = bands.length - 1;
    const cells = cellByGroup.get(group(instance.instanceId, component.area)) ?? [];
    cells.push({ cell: {
      instanceId: instance.instanceId, componentId: component.id, name: component.name,
      band: countBand(count), count,
    }, band: groupIndex, order: instance.position.x });
    cellByGroup.set(group(instance.instanceId, component.area), cells);
  }
  const rows = COLUMN_GROUPS.map(col => ({ group: col.id, cells: (cellByGroup.get(col.id) ?? [])
    .sort((a, b) => READING_ORDER(a, b)).map(entry => entry.cell) }))
    .filter(row => row.cells.length > 0);
  return { columns: Math.max(0, ...rows.map(row => row.cells.length)), rows };
}
