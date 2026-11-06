export const productionCsp = [
  "default-src 'self'", "script-src 'self'", "connect-src 'self'", "object-src 'none'",
  "base-uri 'none'", "frame-ancestors 'none'", "form-action 'none'",
  "style-src 'self'", "style-src-elem 'self'", "style-src-attr 'unsafe-inline'",
].join('; ');
export function securityHeaders(development: boolean): Record<string, string> {
  return {
    'Content-Security-Policy': development ?
      productionCsp.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
        .replace("style-src-elem 'self'", "style-src-elem 'self' 'unsafe-inline'")
        .replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:* ws://localhost:*") : productionCsp,
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store',
  };
}
export type LogEvent = {
  eventCode: 'method_not_allowed' | 'body_not_allowed' | 'invalid_selection' | 'data_unavailable' | 'not_found' | 'request_failed';
  requestId: string; routeCategory: 'data' | 'asset'; status: number;
};
export type Logger = (event: LogEvent) => void;
export const structuredLogger: Logger = event => console.info(JSON.stringify(event));
