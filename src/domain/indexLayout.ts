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
// Stored overview positions closer than this tolerance share one index row band.
const ROW_BAND_TOLERANCE = 60;

export type IndexCell = {
  instanceId: string;
  componentId: string;
  name: string;
  column: ColumnId;
  order: number;
  count: number;
  band: 0 | 1 | 2 | 3;
};
export type IndexRow = { key: string; cells: IndexCell[] };
export type IndexTable = { rows: IndexRow[] };

export function countBand(count: number): 0 | 1 | 2 | 3 {
  return count <= 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : 3;
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
  const column = (instanceId: string, area: Component['area']): ColumnId => {
    if (area !== 'networking') return byArea[area];
    const neighborAreas = new Set<string>();
    for (const edge of bundle.architectureEdges) {
      if (edge.viewId !== view.id) continue;
      if (edge.source === instanceId) neighborAreas.add(areaOfInstance.get(edge.target) ?? '');
      if (edge.target === instanceId) neighborAreas.add(areaOfInstance.get(edge.source) ?? '');
    }
    return neighborAreas.has('execution') && !neighborAreas.has('consensus') ? 'execution' : 'consensus';
  };
  const sorted = [...view.componentInstances]
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const bands: { top: number; cells: IndexCell[] }[] = [];
  for (const instance of sorted) {
    const component = bundle.components.find(c => c.id === instance.componentId)!;
    const count = claimsFor(bundle, view.id, instance.instanceId).length;
    const band = bands.at(-1);
    if (!band || instance.position.y - band.top > ROW_BAND_TOLERANCE) {
      bands.push({ top: instance.position.y, cells: [] });
    }
    bands.at(-1)!.cells.push({
      instanceId: instance.instanceId, componentId: component.id, name: component.name,
      column: column(instance.instanceId, component.area), order: instance.position.x,
      count, band: countBand(count),
    });
  }
  return { rows: bands.map((band, index) => ({
    key: `row-${index}`, cells: [...band.cells].sort((a, b) => a.order - b.order),
  })) };
}
