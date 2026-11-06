import { Hono, type Context } from 'hono';
import { SCHEMA_VERSION, type AtlasBundle } from '../domain/schema';
import { parseSelection } from './selection';
import { securityHeaders, structuredLogger, type Logger, type LogEvent } from './security';

type Env = {
  Bindings: { ASSETS: { fetch: (request: Request) => Promise<Response> } };
  Variables: { requestId: string; routeCategory: 'data' | 'asset' };
};
type ErrorStatus = 400 | 404 | 405 | 414 | 500 | 503;
function failure(c: Context<Env>, logger: Logger, eventCode: LogEvent['eventCode'], status: ErrorStatus, message: string) {
  logger({ eventCode, requestId: c.get('requestId'), routeCategory: c.get('routeCategory'), status });
  return c.json({ error: message, requestId: c.get('requestId') }, status);
}
function bodyPresent(request: Request) {
  return request.body !== null || (request.headers.has('content-length') &&
    request.headers.get('content-length') !== '0') || request.headers.has('transfer-encoding');
}
export function createApp(bundle: AtlasBundle | null, logger: Logger = structuredLogger, development = false) {
  const app = new Hono<Env>();
  app.use('*', async (c, next) => {
    c.set('requestId', crypto.randomUUID());
    c.set('routeCategory', c.req.path.startsWith('/api/') ? 'data' : 'asset');
    Object.entries(securityHeaders(development)).forEach(([name, value]) => c.header(name, value));
    c.header('X-Request-ID', c.get('requestId'));
    if (!['GET', 'HEAD'].includes(c.req.method)) {
      c.header('Allow', 'GET, HEAD');
      return failure(c, logger, 'method_not_allowed', 405, 'Only GET and HEAD are allowed.');
    }
    if (bodyPresent(c.req.raw)) return failure(c, logger, 'body_not_allowed', 400, 'Request bodies are not accepted.');
    await next();
    // Asset binding responses have their own headers; apply the policy after routing too.
    Object.entries(securityHeaders(development)).forEach(([name, value]) => c.header(name, value));
    c.header('X-Request-ID', c.get('requestId'));
  });
  app.get('/api/atlas', c => {
    if (!bundle || bundle.schemaVersion !== SCHEMA_VERSION) return failure(c, logger, 'data_unavailable', 503, 'Atlas data is unavailable.');
    const result = parseSelection(c.req.url, bundle);
    if (!result.ok) return failure(c, logger, 'invalid_selection', result.status,
      result.status === 414 ? 'Query is too long.' : result.status === 404 ? 'Selection was not found.' : 'Invalid data selection.');
    return c.json({ schemaVersion: SCHEMA_VERSION, datasetRevision: bundle.datasetRevision, selection: result.selection, bundle });
  });
  app.get('/api/*', c => failure(c, logger, 'not_found', 404, 'Route was not found.'));
  app.get('*', async c => {
    const response = await c.env.ASSETS.fetch(c.req.raw);
    return response;
  });
  app.onError((_error, c) => failure(c, logger, 'request_failed', 500, 'Request failed.'));
  return app;
}
