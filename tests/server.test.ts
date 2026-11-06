import { describe, it, expect, vi } from 'vitest';
import raw from '../data/atlas.json';
import { validateStructure } from '../src/domain/validate';
import { createApp } from '../src/server/app';

const bundle = validateStructure(raw);
const log = vi.fn();
const app = createApp(bundle, log);
describe('read-only HTTP boundary', () => {
  it('should return the complete bundle with validated selectors when selection exists', async () => {
    const response = await app.request('/api/atlas?view=beacon&component=b-state&claim=ffg-structural-safety');
    expect(response.status).toBe(200);
    expect((await response.json()).selection.claim).toBe('ffg-structural-safety');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'])('should reject %s before reading a request body', async method => {
    const request = new Request('http://localhost/api/atlas', { method: 'POST', body: 'not JSON' });
    Object.defineProperty(request, 'method', { value: method });
    const response = await app.fetch(request);
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
  });
  it.each([
    ['?view=beacon&view=lean', 400], ['?other=beacon', 400], ['?view=', 400],
    ['?view=%ZZ', 400], ['?view=%E3%81%82', 400], ['?view=%2Fbeacon', 400],
    ['?view=' + 'a'.repeat(129), 400], ['?view=missing', 404],
    ['?component=b-state', 400], ['?claim=checkpoint-forward', 400],
    ['?view=beacon&component=l-state', 404], ['?view=beacon&claim=checkpoint-forward', 404],
    ['?view=beacon&component=b-bls&claim=ffg-structural-safety', 404],
    ['?' + 'a'.repeat(2049), 414],
  ])('should reject invalid selection %s with %s', async (query, status) => {
    expect((await app.request('/api/atlas' + query)).status).toBe(status);
  });
  it('should return headers without data when the method is HEAD', async () => {
    const response = await app.request('/api/atlas', {method: 'HEAD'});
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(response.headers.get('Content-Security-Policy')).toContain("style-src-attr 'unsafe-inline'");
  });
  it('should return generic errors when the packaged bundle cannot be loaded', async () => {
    const response = await createApp(null, log).request('/api/atlas');
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('Atlas data is unavailable.');
  });
  it('should reject body-bearing queries without reading their streams', async () => {
    const request = new Request('http://localhost/api/atlas', {method: 'POST',body: 'secret'.repeat(100000)});
    Object.defineProperty(request, 'method', {value: 'GET'});
    expect((await app.fetch(request)).status).toBe(400);
    expect(request.bodyUsed).toBe(false);
    expect((await app.request('/api/atlas', {headers: {'Content-Length': '1'}})).status).toBe(400);
    expect((await app.request('/api/atlas', {headers: {'Transfer-Encoding': 'chunked'}})).status).toBe(400);
  });
  it('should protect asset responses and conceal internal failures', async () => {
    const env = {ASSETS: {fetch: vi.fn().mockResolvedValue(new Response('asset'))}};
    const response = await app.request('/', undefined, env);
    expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect((await app.request('/api/missing')).status).toBe(404);
    env.ASSETS.fetch.mockRejectedValue(new Error('/private/server/path'));
    const failed = await app.request('/', undefined, env);
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toContain('/private');
  });
  it('should omit sensitive data when a controlled failure is logged', async () => {
    log.mockClear();
    await app.request('/api/atlas?secret=do-not-log-me');
    expect(log).toHaveBeenCalledWith(expect.objectContaining({eventCode: 'invalid_selection',status: 400,routeCategory: 'data'}));
    expect(JSON.stringify(log.mock.calls)).not.toContain('do-not-log-me');
  });
});
