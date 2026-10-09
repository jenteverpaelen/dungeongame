// Hearthfall game server: HTTP (static client + /healthz) and WebSocket (/ws, MessagePack) on one port,
// a global 20 Hz world loop, periodic maintenance, and graceful shutdown that saves every character.

import http from 'node:http';
import type { Socket } from 'node:net';
import { WebSocketServer } from 'ws';
import { CLIENT_DIR, PORT } from './config';
import { Session } from './net/session';
import { createStaticHandler } from './net/static';
import { ensureDataDir, flushSaves } from './persistence';
import { World } from './world';
import { TICK_MS } from '../../shared/src/constants';

const HEARTBEAT_MS = 15_000;
const MAX_CATCHUP_TICKS = 4;
const SLOW_TICK_MS = 45;
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS ?? 1000);

async function main(): Promise<void> {
  ensureDataDir();
  const world = new World();
  await world.init();

  const sessions = new Set<Session>();
  const startedAt = Date.now();
  const serveStatic = createStaticHandler(CLIENT_DIR);

  // ─────────────────────────── HTTP ───────────────────────────

  const server = http.createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/healthz') {
      const body = JSON.stringify({ ok: true, uptimeSec: Math.round((Date.now() - startedAt) / 1000), ...world.stats() });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(body);
      return;
    }
    serveStatic(req, res)
      .then((handled) => {
        if (handled) return;
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Hearthfall game server. The web client is served from dist/client (npm run build) or by the Vite dev server.');
      })
      .catch((err) => {
        console.error('[http] static handler failed:', err);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
  });

  // ─────────────────────────── WebSocket ───────────────────────────

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });
  server.on('upgrade', (req, socket: Socket, head) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    if (wss.clients.size >= MAX_CONNECTIONS) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    socket.setNoDelay(true);
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  wss.on('connection', (ws, req) => {
    const fwd = req.headers['x-forwarded-for'];
    const ip = (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket.remoteAddress || '';
    const session = new Session(ws, world, ip);
    sessions.add(session);
    ws.on('close', () => sessions.delete(session));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, () => { server.off('error', reject); resolve(); });
  });
  console.log(`[server] Hearthfall listening on http://localhost:${PORT} (WebSocket /ws, sim: ${process.env.SIM_STUB === '1' ? 'test stub' : 'real'})`);

  // ─────────────────────────── World loop (20 Hz, drift corrected) ───────────────────────────

  let ticks = 0;
  let nextTickAt = performance.now() + TICK_MS;
  let loopTimer: NodeJS.Timeout | null = null;
  let lastSlowLog = 0;

  const runTick = () => {
    const t0 = performance.now();
    try {
      world.tick();
      ticks++;
      if (ticks % 20 === 0) world.maintain();
      if (ticks % Math.round(HEARTBEAT_MS / TICK_MS) === 0) for (const s of sessions) s.heartbeat();
    } catch (err) {
      console.error('[server] world loop error:', err);
    }
    const took = performance.now() - t0;
    if (took > SLOW_TICK_MS && Date.now() - lastSlowLog > 5000) {
      lastSlowLog = Date.now();
      console.warn(`[server] slow world tick: ${took.toFixed(1)} ms (budget ${TICK_MS} ms)`);
    }
  };

  const loop = () => {
    let now = performance.now();
    let steps = 0;
    while (now >= nextTickAt && steps < MAX_CATCHUP_TICKS) {
      runTick();
      nextTickAt += TICK_MS;
      steps++;
      now = performance.now();
    }
    // Far behind (a long stall): skip the missed ticks instead of spiralling.
    if (now - nextTickAt > TICK_MS * MAX_CATCHUP_TICKS) nextTickAt = now + TICK_MS;
    loopTimer = setTimeout(loop, Math.max(1, nextTickAt - performance.now()));
  };
  loopTimer = setTimeout(loop, TICK_MS);

  // ─────────────────────────── Shutdown ───────────────────────────

  let shuttingDown = false;
  const shutdown = async (reason: string, code: number): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] shutting down (${reason})...`);
    if (loopTimer) clearTimeout(loopTimer);
    const hardExit = setTimeout(() => { console.error('[server] shutdown timed out'); process.exit(code || 1); }, 8000);
    hardExit.unref();
    try {
      server.close();
      for (const s of [...sessions]) s.shutdown('Server restarting');
      await world.shutdown();
      await flushSaves();
      server.closeAllConnections();
      console.log('[server] all characters saved, bye');
    } catch (err) {
      console.error('[server] error during shutdown:', err);
      code = code || 1;
    }
    process.exit(code);
  };

  process.on('SIGINT', () => void shutdown('SIGINT', 0));
  process.on('SIGTERM', () => void shutdown('SIGTERM', 0));
  process.on('uncaughtException', (err) => {
    console.error('[fatal] uncaught exception:', err);
    void shutdown('uncaughtException', 1);
  });
  process.on('unhandledRejection', (err) => console.error('[warn] unhandled rejection:', err));
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
