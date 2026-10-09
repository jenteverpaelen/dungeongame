// Actual local Chrome/Web Audio and socket lifecycle; controlled channel presentation fixture.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const before = process.argv.includes('--before');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-audio-lifetime-'));
const dataDir = path.join(tmp, 'saves');
const out = path.join(root, 'docs/phase/P03-foundations/checks/audio-lifetime', before ? 'before' : 'after');
await fs.mkdir(dataDir); await fs.mkdir(out, { recursive: true });
const procs = [], channels = [], logs = [], observations = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, server, browserVersion, passed = false, failure;
async function until(fn) {
  const end = Date.now() + 20000;
  while (Date.now() < end) { const value = await fn(); if (value) return value; await wait(100); }
  throw Error('Audio browser condition timed out');
}
const port = await new Promise((resolve, reject) => {
  const s = net.createServer(); s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});
const origin = `http://127.0.0.1:${port}`;
function launch(args, env = {}, ipc = false, exe = process.execPath) {
  const child = spawn(exe, args, { cwd: root, windowsHide: true,
    env: { ...process.env, DATA_DIR: dataDir, BACKUP_DIR: '', ENABLE_DEBUG: '0', WS_ALLOWED_ORIGINS: origin, ...env },
    stdio: ['ignore', 'pipe', 'pipe', ...(ipc ? ['ipc'] : [])] });
  procs.push(child); child.on('error', error => logs.push(String(error)));
  child.stdout.on('data', data => logs.push(String(data))); child.stderr.on('data', data => logs.push(String(data))); return child;
}
async function connect(url) {
  const ws = new WebSocket(url); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); pending.delete(message.id); message.error ? p?.reject(message.error) : p?.resolve(message.result); }
  };
  const channel = { ws, call: (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params }));
  }) }; channels.push(channel); return channel;
}
try {
  const build = launch(['node_modules/vite/bin/vite.js', 'build', '--config', 'client/vite.config.ts']);
  await new Promise((resolve, reject) => { build.once('error', reject); build.once('exit', code => code === 0 ? resolve() : reject(Error(`Build: ${code}`))); });
  server = launch(['--import', 'tsx', 'server/src/main.ts'], { PORT: String(port) }, true);
  await until(async () => { if (server.exitCode !== null) throw Error(logs.join('')); try { return (await fetch(`${origin}/healthz`)).ok; } catch { return false; } });
  launch(['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(tmp, 'chrome')}`,
    '--window-size=1920,1080', '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check', 'about:blank'], {}, false,
    'C:/Program Files/Google/Chrome/Application/chrome.exe');
  const active = await until(async () => { try { return await fs.readFile(path.join(tmp, 'chrome/DevToolsActivePort'), 'utf8'); } catch { return false; } });
  const [cdpPort, browserPath] = active.trim().split('\n');
  browser = await connect(`ws://127.0.0.1:${cdpPort}${browserPath}`); browserVersion = await browser.call('Browser.getVersion');
  const tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
  const page = await connect(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await page.call('Page.enable'); await page.call('Runtime.enable');
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  // Synthetic browser setting; do not change the owner's profile or play audible test loops.
  await page.call('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('hearthfall.preferences.v1',JSON.stringify({version:1,values:{muted:true}}));` });
  const evaluate = async expression => {
    const r = await page.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  const ready = () => until(() => evaluate('Boolean(window.__game?.world?.me && __ui.get().screen === "game")'));
  const snapshot = () => evaluate(`({screen:__ui.get().screen,hidden:document.hidden,width:innerWidth,height:innerHeight,
    viewHeight:innerHeight/__game.scene.cam.zoom,context:__game.audio.eng?.ctx.state,master:__game.audio.eng?.master.gain.value,
    loops:[...__game.audio.loops.keys()],wanted:[...__game.audio.wantLoops],whirl:__game.whirl,ended:window.__loopEnded??false,
    muted:__game.audio.inspect().muted})`);
  const capture = async name => {
    const state = await snapshot(); observations.push({ name, ...state });
    const shot = await page.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(path.join(out, name + '.png'), Buffer.from(shot.data, 'base64')); console.log(`Captured ${name}`); return state;
  };
  const startChannel = () => evaluate(`(()=>{
    __game.app.ticker.stop();__game.world.me.samples.at(-1).flags|=16;__game.frame(16);
    const loop=__game.audio.loops.get('whirlwind');if(!loop)throw Error('Channel fixture did not start');
    window.__loopEnded=false;loop.src.addEventListener('ended',()=>{window.__loopEnded=true},{once:true});return true;
  })()`);
  await page.call('Page.navigate', { url: `${origin}/?autostart=AudioProbe&class=warrior` }); await ready();
  await until(() => evaluate('(()=>{const g=__game.scene.ground.children[0]?.children[0];return g?.tiles && g.wanted.length===0 && !g.timer})()'));
  await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: 960, y: 500, button: 'left', clickCount: 1 });
  await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 960, y: 500, button: 'left', clickCount: 1 });
  await until(() => evaluate('__game.audio.inspect().state==="running"'));
  await wait(500);
  await startChannel();
  const started = await capture('01-channel-active');
  assert.equal(started.width, 1920); assert.equal(started.height, 1080); assert.equal(started.hidden, false); assert.equal(started.viewHeight, 620);
  assert.deepEqual(started.loops, ['whirlwind']); assert.equal(started.muted, true); assert.equal(started.master, 0);
  // Real WebSocket close invokes the real Game disconnect callback with ticker paused.
  await evaluate('__game.conn.close();true');
  await until(() => evaluate('__ui.get().screen==="select"'));
  await wait(650);
  // Resume rendering for the selection portraits after the paused-boundary wait.
  await evaluate('__game.app.ticker.start();true'); await wait(650);
  const closed = await capture('02-disconnected');
  if (before) {
    assert.deepEqual(closed.loops, ['whirlwind']); assert.deepEqual(closed.wanted, ['whirlwind']); assert.equal(closed.ended, false);
    observations.push({ name: 'reproduced', problem: 'Channel node and wanted intent survive real socket close on selection screen.' });
  } else {
    assert.deepEqual(closed.loops, []); assert.deepEqual(closed.wanted, []); assert.equal(closed.whirl, false); assert.equal(closed.ended, true);
    await evaluate('__game.start("AudioProbe","warrior")'); await ready();
    await until(() => evaluate('__game.world.me!==undefined'));
    await startChannel();
    // Invoke the existing committed-zone handler; no new frame may clean up for it.
    const atEntry = await evaluate(`(()=>{__game.enterZone(__ui.get().zone,__ui.get().myId);return {loops:[...__game.audio.loops.keys()],wanted:[...__game.audio.wantLoops],whirl:__game.whirl}})()`);
    assert.deepEqual(atEntry, { loops: [], wanted: [], whirl: false });
    await wait(650);
    assert.equal((await snapshot()).ended, true);
    observations.push({ name: 'zone-entry-before-next-frame', ...atEntry, ended: true });
    // The direct zone fixture cleared client entities without a server transfer.
    // Reconnect to obtain an ordinary complete welcome/snapshot before proceeding.
    await evaluate('__game.conn.close();true');
    await until(() => evaluate('__ui.get().screen==="select"')); await wait(200);
    await evaluate('__game.start("AudioProbe","warrior")');
    await ready();
    await startChannel();
    assert.deepEqual((await snapshot()).loops, ['whirlwind']);
    await evaluate('__game.world.me.samples.at(-1).flags&=~16;__game.frame(16);true'); await wait(650);
    const stopped = await snapshot();
    assert.deepEqual(stopped.loops, []); assert.equal(stopped.ended, true); assert.equal(stopped.muted, true); assert.equal(stopped.master, 0);
    observations.push({ name: 'channel-restarts-and-stops', ...stopped });
    await evaluate('__game.app.ticker.start();true'); await wait(500);
    await capture('03-reconnected-town');
  }
  passed = true;
} catch (error) { failure = String(error.stack ?? error); console.error(failure); process.exitCode = 1; }
finally {
  if (browser) await browser.call('Browser.close').catch(() => {});
  for (const channel of channels) channel.ws.close();
  if (server?.connected) { server.send('hearthfall:shutdown'); await Promise.race([new Promise(resolve => server.once('close', resolve)), wait(9000)]); }
  for (const child of procs) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await fs.writeFile(path.join(out, 'trace.json'), JSON.stringify({ tmp, dataDir, node: process.version, browserVersion, passed, failure, before,
    scope: 'Installed headless Chrome1920x1080; controlled channel flags/ticker, actual Web Audio ended and local socket close. Muted synthetic profile. No listening, natural combat, dense-load or performance claim.', observations }, null, 2) + '\n');
  await fs.writeFile(path.join(tmp, 'capture.log'), logs.join('')); console.log(`Audio browser evidence: ${tmp}`);
}
