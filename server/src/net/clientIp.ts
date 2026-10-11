// Which address is "the client" for rate limits and lockouts. By default the socket peer, never a header: forwarding
// headers are written by the client unless a proxy we trust rewrites them. Behind a reverse proxy set
// TRUSTED_PROXIES to that proxy's address(es); then the right-most X-Forwarded-For entry that is not a trusted proxy
// is the client (the usual right-to-left rule, as MDN documents for X-Forwarded-For [S]).

import type { IncomingMessage } from 'node:http';

const strip = (ip: string) => ip.trim().replace(/^::ffff:/, '').toLowerCase();

export function parseTrustedProxies(value: string | undefined): Set<string> {
  const out = new Set<string>();
  for (const part of (value ?? '').split(',')) {
    const ip = strip(part);
    if (!ip) continue;
    if (!/^[0-9a-f:.]+$/.test(ip)) throw new Error(`TRUSTED_PROXIES: "${part.trim()}" is not an IP address (CIDR ranges are not supported)`);
    out.add(ip);
  }
  return out;
}

export function clientAddress(req: Pick<IncomingMessage, 'headers' | 'socket'>, trusted: ReadonlySet<string>): string {
  const peer = strip(req.socket.remoteAddress ?? '');
  if (!trusted.size || !trusted.has(peer)) return peer;
  const header = req.headers['x-forwarded-for'];
  const hops = (Array.isArray(header) ? header.join(',') : header ?? '').split(',').map(strip).filter(Boolean);
  for (let i = hops.length - 1; i >= 0; i--) if (!trusted.has(hops[i])) return /^[0-9a-f:.]+$/.test(hops[i]) ? hops[i] : peer;
  return peer;
}
