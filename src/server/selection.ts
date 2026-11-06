import { idSchema, type AtlasBundle, type Selection } from '../domain/schema';

type SelectionResult = { ok: true; selection: Selection } | { ok: false; status: 400 | 404 | 414 };
export function parseSelection(url: string, bundle: AtlasBundle): SelectionResult {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  if (new TextEncoder().encode(query).byteLength > 2048) return { ok: false, status: 414 };
  const pairs = [...new URLSearchParams(query)];
  const names = pairs.map(([name]) => name);
  if (new Set(names).size !== names.length || pairs.some(([name, value]) =>
    !['view', 'component', 'claim'].includes(name) || !idSchema.safeParse(value).success)) {
    return { ok: false, status: 400 };
  }
  const params = new Map(pairs);
  const selection: Selection = { view: params.get('view') ?? null,
    component: params.get('component') ?? null, claim: params.get('claim') ?? null };
  if (!selection.view) return selection.component || selection.claim ?
    { ok: false, status: 400 } : { ok: true, selection };
  const view = bundle.architectureViews.find(v => v.id === selection.view);
  if (!view) return { ok: false, status: 404 };
  if (selection.component && !view.componentInstances.some(i => i.instanceId === selection.component)) {
    return { ok: false, status: 404 };
  }
  if (selection.claim && !view.claimBindings.some(b => b.claimId === selection.claim &&
    (!selection.component || b.componentInstanceId === selection.component))) return { ok: false, status: 404 };
  return { ok: true, selection };
}
