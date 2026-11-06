import { responseSchema, SCHEMA_VERSION, type AtlasBundle } from '../domain/schema';
import { validateBundle } from '../domain/validate';

declare const __DATASET_REVISION__: string;
const unavailable = 'Atlas data is unavailable. Try again.';
export async function decodeResponse(input: unknown, view: string, expectedRevision: string): Promise<AtlasBundle> {
  if (typeof input === 'object' && input !== null && 'schemaVersion' in input && input.schemaVersion !== SCHEMA_VERSION) {
    throw new Error('Unsupported atlas schema version. Reload this page to use the current release.');
  }
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) throw new Error('Invalid atlas response. No map has been loaded.');
  const response = parsed.data;
  if (response.datasetRevision !== expectedRevision || response.bundle.datasetRevision !== expectedRevision) {
    throw new Error('The atlas dataset has changed. Reload this page to load a consistent release.');
  }
  if (response.selection.view !== view || response.selection.component || response.selection.claim) {
    throw new Error('Invalid atlas selection. No map has been loaded.');
  }
  try { return await validateBundle(response.bundle); }
  catch { throw new Error('Invalid atlas data. No map has been loaded.'); }
}
export async function loadAtlas(view: string, signal: AbortSignal, expectedRevision = __DATASET_REVISION__) {
  let input: unknown;
  try {
    const response = await fetch('/api/atlas?view=' + encodeURIComponent(view), {
      signal, mode: 'same-origin', credentials: 'omit', redirect: 'error',
    });
    if (!response.ok) throw new Error(unavailable);
    input = await response.json();
  } catch { throw new Error(unavailable); }
  return decodeResponse(input, view, expectedRevision);
}
