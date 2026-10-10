#!/usr/bin/env node
// Reusable screenshot driver for the RUNNING dev client (own app, localhost only).
// Launches the locally installed Chrome headless (visible page target, so requestAnimationFrame runs),
// drives it over the DevTools protocol and writes PNGs. Plain Node (global WebSocket/fetch), no packages.
//
//   node scripts/shoot.mjs <scenario.mjs|builtin> [--base=http://localhost:5211] [--out=docs/rework/shots]
//                          [--w=1920] [--h=1080] [--prefix=] [--keep]
//
// A scenario module exports `default async function (api) {}`. Builtins: `hud` (one fresh character),
// `panels` (every panel, L1 then debug-levelled L40), `town` (establishing shots at fixed camera points).
// The dev server must allow the client origin (WS_ALLOWED_ORIGINS) and run with ENABLE_DEBUG=1 for `api.cmd('debug')`.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(3).map(a => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const scenarioArg = process.argv[2];
if (!scenarioArg) { console.error('usage: node scripts/shoot.mjs <scenario.mjs|hud|panels|town> [--base=] [--out=] [--w=] [--h=] [--prefix=]'); process.exit(2); }
const base = String(args.base ?? 'http://localhost:5211');
const out = path.resolve(root, String(args.out ?? 'docs/rework/shots'));
const W = Number(args.w ?? 1920), H = Number(args.h ?? 1080), prefix = String(args.prefix ?? '');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));

async function until(fn, timeout = 30000, label = 'condition') {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) { last = e; } await wait(120); }
  throw Error(`Timed out waiting for ${label}${last ? `: ${last.message ?? last}` : ''}`);
}
async function cdp(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map(), handlers = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p?.reject(Error(m.error.message)) : p?.resolve(m.result); }
    else for (const h of handlers) h(m);
  };
  return { ws, on: h => handlers.push(h), call: (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); }) };
}

const KEYS = { Escape: 27, Enter: 13, Space: 32, Tab: 9, F1: 112, F2: 113, F3: 114, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 };
function keyInfo(code) {
  if (/^Key[A-Z]$/.test(code)) return { key: code.slice(3).toLowerCase(), vk: code.charCodeAt(3) };
  if (/^Digit[0-9]$/.test(code)) return { key: code.slice(5), vk: code.charCodeAt(5) };
  if (code === 'Space') return { key: ' ', vk: 32 };
  return { key: code, vk: KEYS[code] ?? 0 };
}

// In-page helpers: camera hold (client-only view override for establishing shots) and grid navigation over the
// replicated collision world, so scenarios can walk the hero to a service exactly like a player would.
const PAGE_HELPERS = `(() => {
  if (window.__shoot) return true;
  const g = window.__game, s = g.scene;
  const update = s.update;
  s.update = function (dt, me, mouse) {
    if (window.__shoot.cam) { this.cam.x = window.__shoot.cam.x; this.cam.y = window.__shoot.cam.y; return update.call(this, dt, null, mouse); }
    return update.call(this, dt, me, mouse);
  };
  const move = g.input.move.bind(g.input);
  g.input.move = () => window.__shoot.move ?? move();
  window.__shoot = { cam: null, move: null,
    path(tx, ty) {
      const cw = g.world.collision, map = g.world.map, step = 24, w = Math.ceil(map.w * 64 / step), h = Math.ceil(map.h * 64 / step);
      const free = (x, y) => cw.isFree(x * step, y * step, 16);
      const sx = Math.round(g.predictor.x / step), sy = Math.round(g.predictor.y / step);
      const tgx = Math.round(tx / step), tgy = Math.round(ty / step);
      const prev = new Int32Array(w * h).fill(-1), q = [sy * w + sx]; prev[sy * w + sx] = sy * w + sx;
      let best = q[0], bestD = 1e18;
      for (let i = 0; i < q.length; i++) {
        const n = q[i], x = n % w, y = (n - x) / w, d = (x - tgx) ** 2 + (y - tgy) ** 2;
        if (d < bestD) { bestD = d; best = n; } if (d === 0) break;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
          const nx = x + dx, ny = y + dy, k = ny * w + nx;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || prev[k] >= 0 || !free(nx, ny)) continue;
          if (dx && dy && (!free(x + dx, y) || !free(x, y + dy))) continue;
          prev[k] = n; q.push(k);
        }
      }
      const pts = []; for (let n = best; ; n = prev[n]) { pts.push([(n % w) * step, Math.floor(n / w) * step]); if (prev[n] === n) break; }
      return pts.reverse();
    },
    walkTo(tx, ty, near = 30, timeout = 30000) {
      const pts = this.path(tx, ty); pts.push([tx, ty]);
      return new Promise(resolve => {
        const t0 = performance.now(); let i = 0;
        const tick = () => {
          const px = g.predictor.x, py = g.predictor.y;
          while (i < pts.length - 1 && Math.hypot(pts[i][0] - px, pts[i][1] - py) < 20) i++;
          const [x, y] = pts[i], d = Math.hypot(tx - px, ty - py);
          if (d < near || performance.now() - t0 > timeout) { this.move = null; resolve({ x: px, y: py, d }); return; }
          const l = Math.hypot(x - px, y - py) || 1; this.move = { x: (x - px) / l, y: (y - py) / l };
          setTimeout(tick, 50);
        };
        tick();
      });
    },
  };
  return true;
})()`;

let chrome, browser, page, tmp;
const api = {
  base, out, W, H, wait, until,
  async eval(expression, awaitPromise = true) {
    const r = await page.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
    return r.result.value;
  },
  async viewport(w, h) { await page.call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await wait(400); },
  async goto(url) { await page.call('Page.navigate', { url }); await wait(300); },
  /** Fresh character straight into town. Names must be 2–16 letters/numbers. */
  async open({ name = 'Shot' + Math.floor(Math.random() * 1e6), cls = 'warrior', query = '' } = {}) {
    await api.goto(`${base}/?autostart=${encodeURIComponent(name)}&class=${cls}${query}`);
    await api.ready();
    return name;
  },
  async ready() {
    await until(() => api.eval('Boolean(window.__game?.world?.map && window.__ui?.get().screen === "game" && __ui.get().char && __ui.get().me)'), 45000, 'game screen');
    await api.eval(PAGE_HELPERS);
    await api.settle(1800);
    await api.eval('document.activeElement?.blur?.(); true');
  },
  async settle(ms = 600) { await api.eval('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); await wait(ms); },
  async cmd(op, a = {}) { return api.eval(`__cmd(${JSON.stringify(op)}, ${JSON.stringify(a)})`); },
  async debug(op, a = {}) { const r = await api.cmd('debug', { op, ...a }); if (!r?.ok) console.warn(`debug ${op}:`, r?.err); return r; },
  async key(code, { shift = false, ctrl = false } = {}) {
    const { key, vk } = keyInfo(code), modifiers = (shift ? 8 : 0) | (ctrl ? 2 : 0);
    for (const type of ['keyDown', 'keyUp']) await page.call('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers });
    await wait(250);
  },
  async point(target) {
    if (Array.isArray(target)) return { x: target[0], y: target[1] };
    return api.eval(`(() => { const e = document.querySelector(${JSON.stringify(target)}); if (!e) throw Error('missing ' + ${JSON.stringify(target)}); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  },
  async hover(target) { const p = await api.point(target); await page.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p }); await wait(350); },
  async click(target, { button = 'left', count = 1 } = {}) {
    const p = await api.point(target);
    await page.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
    for (const type of ['mousePressed', 'mouseReleased']) await page.call('Input.dispatchMouseEvent', { type, button, clickCount: count, ...p });
    await wait(250);
  },
  /** Click the first element matching `selector` whose text contains `text`. */
  async clickText(selector, text, opts) {
    const i = await api.eval(`[...document.querySelectorAll(${JSON.stringify(selector)})].findIndex(e => e.textContent.includes(${JSON.stringify(text)}))`);
    if (i < 0) throw Error(`no ${selector} containing ${text}`);
    await api.eval(`[...document.querySelectorAll(${JSON.stringify(selector)})][${i}].setAttribute('data-shoot', '1'); true`);
    await api.click('[data-shoot="1"]', opts);
    await api.eval(`document.querySelector('[data-shoot]')?.removeAttribute('data-shoot'); true`);
  },
  async mouseAway() { await page.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: W / 2, y: H / 2 - 40 }); await wait(150); },
  async panel(id, open = true) { await api.eval(`__ui.set(s => ({ panels: { ...s.panels, ${JSON.stringify(id)}: ${open} } })); true`); await wait(350); },
  async closePanels() { await api.eval('__ui.set({ panels: {} }); true'); await wait(200); },
  /** Client-only camera hold for establishing shots (null releases it back to the hero). */
  async camera(x, y) { await api.eval(x === null ? '__shoot.cam = null; true' : `__shoot.cam = { x: ${x}, y: ${y} }; true`); await api.settle(900); },
  async walkTo(x, y, near = 30, timeout = 30000) { return api.eval(`__shoot.walkTo(${x}, ${y}, ${near}, ${timeout})`); },
  async walk(dx, dy, ms) { await api.eval(`__shoot.move = { x: ${dx}, y: ${dy} }; true`); await wait(ms); await api.eval('__shoot.move = null; true'); },
  async shot(name, { clip } = {}) {
    await fs.mkdir(out, { recursive: true });
    const r = await page.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    const file = path.join(out, `${prefix}${name}.png`);
    await fs.writeFile(file, Buffer.from(r.data, 'base64'));
    const info = await api.eval('({ w: innerWidth, h: innerHeight, hidden: document.hidden, fps: __ui?.get().fps })').catch(() => ({}));
    console.log(`shot ${path.relative(root, file)} ${info.w}x${info.h} hidden=${info.hidden} fps=${info.fps}`);
    return file;
  },
  /** Bounding boxes of visible HUD/panel elements, for overlap checks. */
  async boxes(selector) {
    return api.eval(`[...document.querySelectorAll(${JSON.stringify(selector)})].filter(e => e.offsetParent || getComputedStyle(e).position === 'fixed').map(e => { const r = e.getBoundingClientRect(); return { cls: e.className, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })`);
  },
  /** Elements that scroll (overflow with scrollHeight > clientHeight) inside panels: the no-scroll rule. */
  async scrollers(selector = '.pn-root *') {
    return api.eval(`[...document.querySelectorAll(${JSON.stringify(selector)})].filter(e => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY + s.overflowX) && (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2); }).map(e => e.className + ' ' + e.scrollHeight + '/' + e.clientHeight)`);
  },
};

const BUILTIN = {
  async hud(a) { await a.open({ name: 'ShotHud' }); await a.mouseAway(); await a.shot('hud'); },
  async panels(a) {
    await a.open({ name: 'ShotPanels' + Math.floor(Math.random() * 1e4) });
    await a.mouseAway();
    await a.shot('l1-hud');
    for (const [id, name] of [['inventory', 'inventory'], ['skills', 'skills'], ['character', 'character'], ['adventure', 'journal'], ['worldmap', 'worldmap'], ['settings', 'settings'], ['social', 'social'], ['party', 'party'], ['collection', 'collection'], ['paragon', 'paragon']]) {
      await a.closePanels(); await a.panel(id); await a.mouseAway(); await a.shot(`l1-${name}`);
    }
    await a.closePanels();
    await a.debug('level', { n: 39 }); await a.debug('gold', { n: 2500000 }); await a.debug('mats', { n: 400 }); await a.debug('rares', { n: 10 });
    await a.settle(800);
    await a.mouseAway(); await a.shot('l40-hud');
    for (const [id, name] of [['inventory', 'inventory'], ['skills', 'skills'], ['character', 'character'], ['paragon', 'paragon'], ['stash', 'stash'], ['cube', 'cube']]) {
      await a.closePanels(); await a.panel(id); await a.mouseAway(); await a.shot(`l40-${name}`);
    }
    await a.closePanels();
  },
  async town(a) {
    await a.open({ name: 'ShotTown' });
    const pts = await a.eval('(() => { const t = __game.world.map.town; return { entry: t.entry, npcs: t.npcs.map(n => ({ id: n.id, x: n.x, y: n.y })), size: t.size }; })()');
    await a.eval('__ui.set({ panels: {} }); true');
    await a.mouseAway();
    await a.shot('town-entry');
    const byId = Object.fromEntries(pts.npcs.map(n => [n.id, n]));
    for (const id of ['waypoint', 'blacksmith', 'jeweler', 'mystic', 'stash', 'cube', 'rift', 'paragon', 'dummy-0']) {
      const n = byId[id]; if (!n) continue;
      await a.camera(n.x, n.y); await a.shot(`town-${id}`);
    }
    await a.camera(null);
  },
};

try {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-shoot-'));
  chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(tmp, 'chrome')}`, `--window-size=${W},${H}`,
    '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  const active = await until(async () => { try { return await fs.readFile(path.join(tmp, 'chrome', 'DevToolsActivePort'), 'utf8'); } catch { return false; } }, 20000, 'Chrome DevTools port');
  const [port, browserPath] = active.trim().split('\n');
  browser = await cdp(`ws://127.0.0.1:${port}${browserPath}`);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  page = await cdp(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  api.page = page;
  const errors = [];
  page.on(m => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(x => x.value ?? x.description).join(' '));
  });
  await page.call('Page.enable'); await page.call('Runtime.enable');
  await api.viewport(W, H);
  api.errors = errors;
  const scenario = BUILTIN[scenarioArg] ?? (await import(pathToFileURL(path.resolve(scenarioArg)).href)).default;
  await scenario(api);
  if (errors.length) console.log(`page errors (${errors.length}):\n  ` + [...new Set(errors)].slice(0, 12).map(e => String(e).split('\n')[0]).join('\n  '));
} catch (e) {
  console.error(e?.stack ?? e); process.exitCode = 1;
} finally {
  if (!args.keep) {
    await browser?.call('Browser.close').catch(() => {});
    await wait(300);
    if (chrome && chrome.exitCode === null) chrome.kill();
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}
