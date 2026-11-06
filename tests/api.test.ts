import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import raw from '../data/atlas.json';
import { decodeResponse, loadAtlas } from '../src/ui/api';
const response = () => ({schemaVersion: 1, datasetRevision: raw.datasetRevision,
  selection: {view: 'beacon', component: null, claim: null}, bundle: structuredClone(raw)});
describe('browser API boundary', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());
  it('should render only a complete validated release when response identities match', async () => {
    expect((await decodeResponse(response(), 'beacon', raw.datasetRevision)).claims).toHaveLength(raw.claims.length);
  });
  it.each([
    ['incompatible schema', (r: any) => { r.schemaVersion = 2; }, /Unsupported atlas schema/],
    ['invalid shape', (r: any) => { delete r.bundle; }, /Invalid atlas response/],
    ['new release', (r: any) => { r.datasetRevision = 'f'.repeat(64); }, /dataset has changed/],
    ['mixed release', (r: any) => { r.bundle.datasetRevision = 'f'.repeat(64); }, /dataset has changed/],
    ['wrong selection', (r: any) => { r.selection.view = 'lean'; }, /Invalid atlas selection/],
    ['extra selection', (r: any) => { r.selection.component = 'b-state'; }, /Invalid atlas selection/],
    ['tampered content', (r: any) => { r.bundle.claims[0].title = 'Tampered'; }, /Invalid atlas data/],
  ])('should refuse %s before rendering', async (_name, mutate, error) => {
    const value = response(); mutate(value);
    await expect(decodeResponse(value, 'beacon', raw.datasetRevision)).rejects.toThrow(error);
  });
  it('should use only same-origin data requests when loading a view', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(response()));
    await loadAtlas('beacon', new AbortController().signal, raw.datasetRevision);
    expect(fetch).toHaveBeenCalledWith('/api/atlas?view=beacon', expect.objectContaining({mode: 'same-origin',credentials: 'omit',redirect: 'error'}));
  });
  it.each(['network', 'status', 'json'])('should show a generic error when %s fails', async kind => {
    if (kind === 'network') vi.mocked(fetch).mockRejectedValue(new Error('/private/path/token'));
    if (kind === 'status') vi.mocked(fetch).mockResolvedValue(new Response('private', {status: 503}));
    if (kind === 'json') vi.mocked(fetch).mockResolvedValue(new Response('not JSON'));
    await expect(loadAtlas('beacon', new AbortController().signal, raw.datasetRevision)).rejects.toThrow('Atlas data is unavailable. Try again.');
  });
});
