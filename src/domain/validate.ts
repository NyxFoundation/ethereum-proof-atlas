import { canonicalize } from 'json-canonicalize';
import { bundleSchema, type AtlasBundle, type ArchitectureView, type ClaimBinding, type SourceReference } from './schema.ts';

function requireValid(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(`Invalid atlas: ${reason}`);
}
function unique(values: readonly string[], label: string) {
  requireValid(new Set(values).size === values.length, `duplicate ${label}`);
}
function index<T extends { id: string }>(items: readonly T[]) {
  unique(items.map(item => item.id), 'entity ID');
  return new Map(items.map(item => [item.id, item]));
}
function context(bundle: AtlasBundle) {
  return { bundle, components: index(bundle.components), artifacts: index(bundle.artifacts),
    claims: index(bundle.claims), evidence: index(bundle.evidence), checks: index(bundle.checkRecords),
    views: index(bundle.architectureViews), edges: index(bundle.architectureEdges) };
}
type Context = ReturnType<typeof context>;
function source(c: Context, ref: SourceReference) {
  const artifact = c.artifacts.get(ref.artifactId);
  requireValid(artifact?.locations.some(l => l.id === ref.locationId), 'unresolved source location');
}
function references(c: Context, refs: SourceReference[]) { refs.forEach(ref => source(c, ref)); }
function artifactIds(c: Context, ids: string[]) {
  unique(ids, 'subject artifact');
  ids.forEach(id => requireValid(c.artifacts.has(id), 'unresolved artifact'));
}
function validateArtifacts(c: Context) {
  for (const artifact of c.artifacts.values()) {
    unique(artifact.locations.map(l => l.id), 'artifact location');
    const git = artifact.revisionKind === 'git-commit';
    requireValid(artifact.revision.length === (git ? 40 : 64), 'revision identity');
    const repository = new URL(artifact.repository);
    requireValid(!repository.search && !repository.hash && !repository.port, 'repository identity');
    if (git) requireValid(/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(artifact.repository), 'git repository identity');
    for (const location of artifact.locations) {
      requireValid(!location.path.includes('..') && !location.path.startsWith('/'), 'source path');
      const url = new URL(location.url);
      const expected = `${repository.pathname}/blob/${artifact.revision}/${location.path}`;
      requireValid(git ? url.origin === repository.origin && decodeURI(url.pathname) === expected :
        url.pathname.split('/').includes(artifact.revision), 'source not pinned to artifact identity');
      requireValid(!url.search, 'ambiguous source query');
    }
  }
}
function acyclic(graph: Map<string, string[]>) {
  const visit = (id: string, ancestors: Set<string>) => {
    requireValid(!ancestors.has(id), 'cyclic component hierarchy');
    requireValid(graph.has(id), 'unresolved component hierarchy');
    const next = new Set([...ancestors, id]);
    graph.get(id)!.forEach(child => visit(child, next));
  };
  graph.forEach((_children, id) => visit(id, new Set()));
}
function validateClaims(c: Context) {
  for (const claim of c.claims.values()) {
    artifactIds(c, claim.subjectArtifactIds);
    requireValid(claim.subjectArtifactIds.every(id => c.artifacts.get(id)!.kind !== 'proof'), 'proof is not a subject type');
    requireValid([...c.evidence.values()].some(e => e.claimId === claim.id), 'claim lacks evidence');
    if (!claim.relation) continue;
    const { fromArtifactId, toArtifactId } = claim.relation;
    requireValid(fromArtifactId !== toArtifactId && [fromArtifactId, toArtifactId].every(id => claim.subjectArtifactIds.includes(id)), 'relation subjects');
  }
  for (const evidence of c.evidence.values()) {
    requireValid(c.claims.has(evidence.claimId), 'evidence claim');
    source(c, evidence);
    requireValid(c.artifacts.get(evidence.artifactId)!.kind === 'proof', 'evidence requires proof artifact');
    requireValid([...c.checks.values()].some(check => check.kind === 'availability' &&
      check.artifactId === evidence.artifactId && check.locationIds.includes(evidence.locationId) &&
      check.result === 'available'), 'no accessible proof artifact at intake');
  }
}
function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every(id => b.includes(id));
}
function validateChecks(c: Context) {
  for (const check of c.checks.values()) {
    if (check.kind === 'manual-comparison') {
      references(c, check.sources);
      const view = c.views.get(check.viewId);
      requireValid(view?.claimBindings.some(b => b.claimId === check.claimId &&
        b.componentInstanceId === check.componentInstanceId && b.basis.kind === 'manual-comparison' &&
        b.basis.checkId === check.id), 'comparison binding scope');
      continue;
    }
    requireValid(c.artifacts.has(check.artifactId), 'check artifact');
    if (check.kind === 'availability') {
      unique(check.locationIds, 'availability location');
      check.locationIds.forEach(locationId => source(c, { artifactId: check.artifactId, locationId }));
      continue;
    }
    const evidence = c.evidence.get(check.evidenceId);
    requireValid(evidence && evidence.artifactId === check.artifactId, 'check evidence revision');
    artifactIds(c, check.subjectArtifactIds);
    requireValid(sameIds(check.subjectArtifactIds, c.claims.get(evidence.claimId)!.subjectArtifactIds), 'check subject scope');
    if (check.kind === 'replay') requireValid(check.configuration === evidence.scope.configuration, 'replay configuration scope');
  }
}
function validateBinding(c: Context, view: ArchitectureView, binding: ClaimBinding) {
  const instance = view.componentInstances.find(i => i.instanceId === binding.componentInstanceId);
  const claim = c.claims.get(binding.claimId);
  requireValid(instance && claim, 'binding scope');
  references(c, binding.sources);
  if (binding.applicabilityKind === 'direct-subject') {
    requireValid(binding.basis.kind === 'version-match' &&
      claim.subjectArtifactIds.every(id => instance.subjectArtifactIds.includes(id)), 'direct subject version mismatch');
    return;
  }
  requireValid(binding.basis.kind !== 'version-match', 'related model basis');
  requireValid(claim.subjectArtifactIds.some(id => c.artifacts.get(id)!.kind === 'formal-model'), 'related model subject');
  const refs = binding.sources.map(ref => ref.artifactId);
  requireValid(claim.subjectArtifactIds.every(id => refs.includes(id)) &&
    instance.subjectArtifactIds.some(id => refs.includes(id)), 'comparison lacks both subjects');
  if (binding.basis.kind !== 'manual-comparison') return;
  const check = c.checks.get(binding.basis.checkId);
  requireValid(check?.kind === 'manual-comparison' && check.viewId === view.id &&
    check.claimId === claim.id && check.componentInstanceId === instance.instanceId, 'comparison record scope');
  requireValid(binding.sources.every(ref => check.sources.some(s => s.artifactId === ref.artifactId &&
    s.locationId === ref.locationId)), 'comparison source scope');
}
function validateView(c: Context, view: ArchitectureView) {
  requireValid(view.label === (view.id === 'beacon' ? 'Beacon Spec' : 'Lean Spec'), 'tab identity');
  requireValid(view.experimental === (view.id === 'lean'), 'experimental status');
  references(c, view.sources);
  unique(view.componentInstances.map(i => i.instanceId), 'instance ID');
  const snapshots = new Set(view.sources.map(ref => ref.artifactId));
  const hierarchy = new Map(view.componentInstances.map(i => [i.instanceId, [] as string[]]));
  for (const instance of view.componentInstances) {
    const component = c.components.get(instance.componentId);
    requireValid(component, 'instance component');
    artifactIds(c, instance.subjectArtifactIds);
    requireValid(instance.subjectArtifactIds.every(id => snapshots.has(id)), 'ambiguous snapshot subject');
    references(c, instance.sources);
    requireValid(instance.sources.every(ref => instance.subjectArtifactIds.includes(ref.artifactId)), 'instance source subject');
    if (!instance.parentInstanceId) continue;
    const parent = view.componentInstances.find(i => i.instanceId === instance.parentInstanceId);
    requireValid(parent && c.components.get(parent.componentId)!.childComponentIds.includes(instance.componentId), 'instance parent');
    hierarchy.get(parent.instanceId)!.push(instance.instanceId);
  }
  acyclic(hierarchy);
  unique(view.claimBindings.map(b => `${b.componentInstanceId}:${b.claimId}`), 'claim binding');
  view.claimBindings.forEach(binding => validateBinding(c, view, binding));
}
function validateEdges(c: Context) {
  for (const edge of c.edges.values()) {
    const view = c.views.get(edge.viewId);
    requireValid(view, 'edge view');
    const ids = view.componentInstances.map(i => i.instanceId);
    requireValid(edge.source !== edge.target && ids.includes(edge.source) && ids.includes(edge.target), 'edge endpoints');
    references(c, edge.sources);
    requireValid(edge.sources.every(ref => view.sources.some(s => s.artifactId === ref.artifactId)), 'edge snapshot');
  }
}
export function validateStructure(input: unknown): AtlasBundle {
  const bundle = bundleSchema.parse(input);
  const c = context(bundle);
  requireValid(c.views.has('beacon') && c.views.has('lean'), 'both architecture views required');
  c.components.forEach(component => unique(component.childComponentIds, 'child component'));
  acyclic(new Map(bundle.components.map(component => [component.id, component.childComponentIds])));
  validateArtifacts(c);
  validateClaims(c);
  validateChecks(c);
  c.views.forEach(view => validateView(c, view));
  validateEdges(c);
  return bundle;
}
export async function digestBundle(input: object): Promise<string> {
  const { datasetRevision: _revision, ...content } = input as Record<string, unknown>;
  const bytes = new TextEncoder().encode(canonicalize(content));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function validateBundle(input: unknown): Promise<AtlasBundle> {
  const bundle = validateStructure(input);
  requireValid(await digestBundle(bundle) === bundle.datasetRevision, 'dataset digest mismatch');
  return bundle;
}
