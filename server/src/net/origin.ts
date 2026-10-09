import type { IncomingMessage } from 'node:http';

/** Exact browser origins. Configuration replaces local defaults; it never extends them silently. */
export function webSocketOrigins(config: string | undefined, port: number): ReadonlySet<string> {
  const values = config === undefined
    ? [port, 5173].flatMap(p => ['localhost', '127.0.0.1', '[::1]'].map(host => new URL(`http://${host}:${p}`).origin))
    : config.split(',').map(value => value.trim());
  for (const value of values) {
    let valid = false;
    try {
      const url = new URL(value);
      valid = (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value && !value.includes('*');
    } catch { /* Invalid configuration must fail closed before the server starts. */ }
    if (!valid) throw new Error('WS_ALLOWED_ORIGINS must contain exact HTTP(S) origins, without paths, credentials or wildcards');
  }
  return new Set(values);
}

export function allowedWebSocketOrigin(req: Pick<IncomingMessage, 'headers' | 'rawHeaders'>, allowed: ReadonlySet<string>): boolean {
  let count = 0;
  // Node may discard duplicate singleton headers in req.headers. Inspect the original list too.
  for (let i = 0; i < req.rawHeaders.length; i += 2) if (req.rawHeaders[i].toLowerCase() === 'origin') count++;
  return count === 1 && typeof req.headers.origin === 'string' && allowed.has(req.headers.origin);
}
