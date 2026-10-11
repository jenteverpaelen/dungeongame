// F-OPS-05: trusted-proxy client addresses, per-address connection cap, HTTP security headers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import WebSocket from 'ws';
import { clientAddress, parseTrustedProxies } from '../src/net/clientIp';
import { BASE_SECURITY_HEADERS, PAGE_CSP, createStaticHandler } from '../src/net/static';
import { runDir, startServer } from './serverHarness';

assert.ok(process.env.DATA_DIR, 'Security checks require an isolated DATA_DIR');
const req = (peer: string, xff?: string) => ({ socket: { remoteAddress: peer }, headers: xff === undefined ? {} : { 'x-forwarded-for': xff } }) as unknown as http.IncomingMessage;

test('forwarding headers are ignored unless the peer is a configured proxy', () => {
  const none = parseTrustedProxies(undefined), proxy = parseTrustedProxies(' 10.0.0.2 ,::ffff:10.0.0.3');
  assert.equal(clientAddress(req('203.0.113.4', '1.2.3.4'), none), '203.0.113.4', 'a client cannot spoof its address');
  assert.equal(clientAddress(req('::ffff:203.0.113.4'), none), '203.0.113.4');
  assert.equal(clientAddress(req('10.0.0.2', '198.51.100.1'), proxy), '198.51.100.1');
  assert.equal(clientAddress(req('10.0.0.2', '6.6.6.6, 198.51.100.1, 10.0.0.3'), proxy), '198.51.100.1', 'right-most untrusted hop wins; a forged left entry is ignored');
  assert.equal(clientAddress(req('10.0.0.2', 'not-an-ip'), proxy), '10.0.0.2');
  assert.equal(clientAddress(req('10.0.0.2'), proxy), '10.0.0.2');
  assert.throws(() => parseTrustedProxies('10.0.0.0/8'), /CIDR/);
});

test('static responses carry the security headers, and the page carries a content security policy', async () => {
  const dir = await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'static-'));
  await fs.writeFile(path.join(dir, 'index.html'), '<!doctype html><title>x</title>');
  await fs.mkdir(path.join(dir, 'assets'));
  await fs.writeFile(path.join(dir, 'assets', 'app-abcdefgh12.js'), 'console.log(1)');
  const serve = createStaticHandler(dir);
  const server = http.createServer((q, s) => { void serve(q, s).then(h => { if (!h) s.writeHead(404).end(); }); });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  try {
    const page = await fetch(`http://127.0.0.1:${port}/`);
    for (const [k, v] of Object.entries(BASE_SECURITY_HEADERS)) assert.equal(page.headers.get(k), v, k);
    assert.equal(page.headers.get('content-security-policy'), PAGE_CSP);
    assert.match(PAGE_CSP, /frame-ancestors 'none'/);
    assert.match(PAGE_CSP, /object-src 'none'/);
    const js = await fetch(`http://127.0.0.1:${port}/assets/app-abcdefgh12.js`);
    assert.equal(js.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(js.headers.get('content-security-policy'), null, 'the policy belongs to documents');
  } finally { await new Promise(r => server.close(r)); }
});

test('real server: JSON endpoints are hardened and one address cannot hold more than its share of sockets', { timeout: 60000 }, async () => {
  const dir = await runDir('security-run-');
  const server = await startServer(path.join(dir, 'saves'), { TRUSTED_PROXIES: '127.0.0.1', MAX_CONNECTIONS_PER_IP: '2' });
  const open = (xff: string) => new Promise<WebSocket | number>((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, { origin: `http://127.0.0.1:${server.port}`, headers: { 'X-Forwarded-For': xff } });
    ws.once('open', () => resolve(ws));
    ws.once('unexpected-response', (_q, res) => resolve(res.statusCode ?? 0));
    ws.once('error', () => resolve(-1));
  });
  try {
    const health = await fetch(`http://127.0.0.1:${server.port}/healthz`);
    assert.equal(health.headers.get('x-frame-options'), 'DENY');
    assert.equal(health.headers.get('cache-control'), 'no-store');
    const a = await open('198.51.100.20'), b = await open('198.51.100.20'), c = await open('198.51.100.20'), d = await open('198.51.100.21');
    assert.ok(a instanceof WebSocket && b instanceof WebSocket, 'two sockets per address are fine');
    assert.equal(c, 429, 'the third from the same address is refused');
    assert.ok(d instanceof WebSocket, 'another address is unaffected');
    (a as WebSocket).close();
    await new Promise(r => setTimeout(r, 200));
    const e = await open('198.51.100.20');
    assert.ok(e instanceof WebSocket, 'a closed socket frees its slot');
    for (const w of [b, d, e]) (w as WebSocket).close();
  } finally { await server.stop(); }
});
