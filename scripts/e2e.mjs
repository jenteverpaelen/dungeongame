// End-to-end play-test: starts server + Vite, plays in headless Chromium, captures screenshots.
// Usage: node scripts/e2e.mjs [class=warrior] [seconds=40] [outDir]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const cls = process.argv[2] ?? 'warrior';
const seconds = Number(process.argv[3] ?? 40);
const out = process.argv[4] ?? '/tmp/claude-0/e2e';
mkdirSync(out, { recursive: true });

const procs = [];
const run = (cmd, args, env = {}) => {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', (d) => process.env.E2E_VERBOSE && process.stdout.write(`[${args[1] ?? cmd}] ${d}`));
  p.stderr.on('data', (d) => process.stdout.write(`[${args[1] ?? cmd} ERR] ${d}`));
  procs.push(p);
  return p;
};
const cleanup = () => { for (const p of procs) p.kill('SIGTERM'); };
process.on('exit', cleanup);

run('npx', ['tsx', 'server/src/main.ts'], { PORT: '2567', XP_MULT: '3' });
run('npx', ['vite', '--config', 'client/vite.config.ts', '--port', '5173', '--strictPort']);
await new Promise((r) => setTimeout(r, 4000));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const shot = async (name) => { await page.screenshot({ path: `${out}/${cls}-${name}.png` }); console.log('shot', name); };

await page.goto('http://localhost:5173/');
await page.waitForTimeout(2500);
await shot('00-select');
await page.goto(`http://localhost:5173/?autostart=E2E${cls}&class=${cls}`);
await page.waitForFunction(() => window.__game?.world?.map, null, { timeout: 20000 });
await page.waitForTimeout(2500);
await shot('01-town');

const cmd = (op, a) => page.evaluate(([op, a]) => window.__cmd(op, a), [op, a]);
console.log('debug level', await cmd('debug', { op: 'level', n: 20 }));
console.log('travel', await cmd('travel', { zone: 'whispering_glade' }));
await page.waitForTimeout(2000);
await shot('02-field');

// Wander with WASD toward monsters, dashing occasionally.
const keys = ['KeyD', 'KeyS', 'KeyD', 'KeyW', 'KeyD', 'KeyA'];
const t0 = Date.now();
let i = 0;
while (Date.now() - t0 < seconds * 1000) {
  const target = await page.evaluate(() => {
    const g = window.__game;
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
  if (target && target.d > 140) {
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
const st = await page.evaluate(() => { const s = window.__ui.get(); return { level: s.char?.level, xp: s.char?.xp, gold: s.char?.gold, kills: s.char?.stats.kills, fps: s.fps, ping: s.ping }; });
console.log('state', st);
console.log('console errors', errors.slice(0, 20));
await browser.close();
cleanup();
process.exit(0);
