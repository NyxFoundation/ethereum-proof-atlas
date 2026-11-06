import type { AtlasBundle, ArchitectureView, Component } from './schema';
import { claimsFor } from './selectors';

// Stored overview positions closer than this tolerance share one index column band.
const ROW_BAND_TOLERANCE = 60;

export type IndexCell = {
  instanceId: string;
  componentId: string;
  name: string;
  area: Component['area'];
  order: number;
  count: number;
  band: 0 | 1 | 2 | 3;
};
export type IndexBand = { key: string; cells: IndexCell[] };
export type IndexTable = { bands: IndexBand[] };

export function countBand(count: number): 0 | 1 | 2 | 3 {
  return count <= 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : 3;
}

export function buildIndex(bundle: AtlasBundle, view: ArchitectureView): IndexTable {
  const sorted = [...view.componentInstances]
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const ascending: { top: number; cells: IndexCell[] }[] = [];
  for (const instance of sorted) {
    const component = bundle.components.find(c => c.id === instance.componentId)!;
    const count = claimsFor(bundle, view.id, instance.instanceId).length;
    const band = ascending.at(-1);
    if (!band || instance.position.y - band.top > ROW_BAND_TOLERANCE) {
      ascending.push({ top: instance.position.y, cells: [] });
    }
    ascending.at(-1)!.cells.push({
      instanceId: instance.instanceId, componentId: component.id, name: component.name,
      area: component.area, order: instance.position.x, count, band: countBand(count),
    });
  }
  // Foundations (lowest stored positions) become the leftmost columns.
  return { bands: [...ascending].reverse().map((band, index) => ({
    key: `band-${index}`, cells: [...band.cells].sort((a, b) => a.order - b.order),
  })) };
}
