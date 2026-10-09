// End-to-end play-test: starts server + Vite, plays in headless Chromium, captures screenshots.
// Usage: node scripts/e2e.mjs [class=warrior] [seconds=40] [outDir]
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const cls = process.argv[2] ?? 'warrior';
const seconds = Number(process.argv[3] ?? 40);
const out = process.argv[4] ?? '/tmp/claude-0/e2e';
const scenario = process.argv[5] ?? 'fresh'; // fresh: level 1 in the glade · endgame: level 70 full set in a Torment rift
mkdirSync(out, { recursive: true });

const procs = [];
const run = (cmd, args, env = {}) => {
  // detached → own process group, so cleanup also kills the node process npx spawns.
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  p.stdout.on('data', (d) => process.env.E2E_VERBOSE && process.stdout.write(`[${args[1] ?? cmd}] ${d}`));
  p.stderr.on('data', (d) => process.stdout.write(`[${args[1] ?? cmd} ERR] ${d}`));
  procs.push(p);
  return p;
};
const cleanup = () => { for (const p of procs) { try { process.kill(-p.pid, 'SIGTERM'); } catch { /* already gone */ } } };
process.on('exit', cleanup);

// Production build served by the game server: immune to dev-server hot reloads.
const PORT = process.env.E2E_PORT ?? '2601';
if (!process.env.E2E_SKIP_BUILD) {
  const b = spawnSync('npx', ['vite', 'build', '--config', 'client/vite.config.ts', '--logLevel', 'error'], { stdio: 'inherit' });
  if (b.status !== 0) { console.error('build failed'); process.exit(1); }
}
spawnSync('fuser', ['-k', `${PORT}/tcp`]); // stale server from an aborted run
run('npx', ['tsx', 'server/src/main.ts'], { PORT, ENABLE_DEBUG: '1', DISABLE_DEBUG: '0', XP_MULT: '3', DATA_DIR: '/tmp/claude-0/e2e-data' });
await new Promise((r) => setTimeout(r, 3000));
const BASE = `http://localhost:${PORT}`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const shot = async (name) => { await page.screenshot({ path: `${out}/${cls}-${scenario}-${name}.png` }); console.log('shot', name); };

await page.goto(`${BASE}/`);
await page.waitForTimeout(2500);
await shot('00-select');
await page.goto(`${BASE}/?autostart=E2E${cls}&class=${cls}`);
await page.waitForFunction(() => window.__game?.world?.map, null, { timeout: 20000 });
await page.waitForTimeout(2500);
await shot('01-town');

// Paced: the server drops clients that exceed 60 messages/s (movement inputs already use 20/s).
const cmd = async (op, a) => { await page.waitForTimeout(80); const r = await page.evaluate(([op, a]) => window.__cmd(op, a), [op, a]); if (!r.ok) console.log('cmd failed', op, r.err); return r; };
if (scenario === 'endgame') {
  for (let i = 0; i < 7; i++) await cmd('debug', { op: 'level', n: 10 });
  await cmd('debug', { op: 'paragon', n: 200 });
  await cmd('debug', { op: 'set' });
  await cmd('debug', { op: 'gold' });
  const inv = await page.evaluate(() => window.__ui.get().char.inventory.filter(Boolean).map((i) => ({ id: i.id, r: i.rarity, k: i.kind })));
  const seen = new Set();
  for (const it of inv) {
    if (it.r !== 'set' && it.r !== 'legendary') continue;
    const key = it.k === 'ring' ? `ring${seen.has('ring1') ? 2 : 1}` : it.k;
    if (seen.has(key)) continue;
    seen.add(key);
    await cmd('equip', it.k === 'ring' ? { itemId: it.id, slot: key } : { itemId: it.id });
  }
  console.log('riftOpen', await cmd('riftOpen', { difficulty: 6 }));
  await page.waitForTimeout(800);
  console.log('riftEnter', await cmd('riftEnter', {}));
} else {
  console.log('travel', await cmd('travel', { zone: 'whispering_glade' }));
}
await page.waitForTimeout(2500);
await shot('02-arrive');

// Wander with WASD toward monsters, dashing occasionally.
const keys = ['KeyD', 'KeyS', 'KeyD', 'KeyW', 'KeyD', 'KeyA'];
const t0 = Date.now();
let i = 0;
while (Date.now() - t0 < seconds * 1000) {
  const target = await page.evaluate(() => {
    const g = window.__game;
    if (!g) return null;
    const me = g.predictor;
    let best = null, bd = 1e9;
    for (const e of g.world.entities.values()) {
      if (e.kind !== 'mob' || e.dying) continue;
      const d = Math.hypot(e.x - me.x, e.y - me.y);
      if (d < bd) { bd = d; best = { dx: e.x - me.x, dy: e.y - me.y, d }; }
    }
    return best;
  });
  let k = keys[i % keys.length];
  const press = [];
  if (target && target.d > (cls === 'warrior' ? 60 : 260)) {
    if (Math.abs(target.dx) > 40) press.push(target.dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(target.dy) > 40) press.push(target.dy > 0 ? 'KeyS' : 'KeyW');
  } else if (!target) press.push(k);
  for (const p of press) await page.keyboard.down(p);
  await page.waitForTimeout(450);
  for (const p of press) await page.keyboard.up(p);
  if (i % 9 === 4) await page.keyboard.press('Space');
  if (i % 12 === 6) await shot(`10-fight-${String(i).padStart(3, '0')}`);
  i++;
}
await shot('20-end');
await page.keyboard.press('KeyI');
await page.waitForTimeout(600);
await shot('30-inventory');
const items = await page.evaluate(() => window.__ui.get().char?.inventory.filter(Boolean).length);
console.log('inventory items', items);
const st = await page.evaluate(() => { const s = window.__ui.get(); return { level: s.char?.level, paragon: s.char?.paragon.level, gold: s.char?.gold, kills: s.char?.stats.kills, rift: s.rift?.progress, fps: s.fps, ping: s.ping, dps: Math.round(s.dps) }; });
console.log('state', st);
console.log('console errors', errors.slice(0, 20));
await browser.close();
cleanup();
process.exit(0);
