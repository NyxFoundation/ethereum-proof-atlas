import type { AtlasBundle, ArchitectureView, Component } from './schema';
import { claimsFor } from './selectors';

export type IndexRow = {
  instanceId: string;
  componentId: string;
  name: string;
  area: Component['area'];
  count: number;
  band: 0 | 1 | 2 | 3;
};
export type IndexTable = { rows: IndexRow[] };

export function countBand(count: number): 0 | 1 | 2 | 3 {
  return count <= 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : 3;
}

export function buildIndex(bundle: AtlasBundle, view: ArchitectureView): IndexTable {
  const rows = view.componentInstances.map(instance => {
    const component = bundle.components.find(c => c.id === instance.componentId)!;
    const count = claimsFor(bundle, view.id, instance.instanceId).length;
    return {
      instanceId: instance.instanceId, componentId: component.id, name: component.name,
      area: component.area, count, band: countBand(count),
    };
  });
  return { rows };
}
