import type { AtlasBundle, ArchitectureView, CheckRecord, SourceReference } from './schema';

export function claimsFor(bundle: AtlasBundle, viewId: string, instanceId: string) {
  const view = bundle.architectureViews.find(v => v.id === viewId);
  const ids = new Set(view?.claimBindings.filter(b => b.componentInstanceId === instanceId).map(b => b.claimId));
  return bundle.claims.filter(claim => ids.has(claim.id));
}
export function availabilityFor(bundle: AtlasBundle, artifactId: string, locationId: string) {
  return bundle.checkRecords.filter((check): check is Extract<CheckRecord, {kind: 'availability'}> =>
    check.kind === 'availability' && check.artifactId === artifactId && check.locationIds.includes(locationId))
    .sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt))[0];
}
export function sourceFor(bundle: AtlasBundle, ref: SourceReference) {
  const artifact = bundle.artifacts.find(a => a.id === ref.artifactId)!;
  return { artifact, location: artifact.locations.find(l => l.id === ref.locationId)! };
}
export function visibleInstances(view: ArchitectureView, expanded: ReadonlySet<string>) {
  const visible = (id: string): boolean => {
    const instance = view.componentInstances.find(i => i.instanceId === id)!;
    return !instance.parentInstanceId || (expanded.has(instance.parentInstanceId) && visible(instance.parentInstanceId));
  };
  return view.componentInstances.filter(i => visible(i.instanceId));
}
export function visibleEdges(bundle: AtlasBundle, view: ArchitectureView, expanded: ReadonlySet<string>) {
  const instances = new Map(view.componentInstances.map(i => [i.instanceId, i]));
  const ids = new Set(visibleInstances(view, expanded).map(i => i.instanceId));
  const ancestor = (id: string): string => ids.has(id) ? id : ancestor(instances.get(id)!.parentInstanceId!);
  return bundle.architectureEdges.filter(e => e.viewId === view.id).map(e => ({
    ...e, source: ancestor(e.source), target: ancestor(e.target),
  })).filter(e => e.source !== e.target);
}
