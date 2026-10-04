// Visual test bench for the HUD. Open /gallery-hud.html with optional query params:
//   ?state=default|boss|dead|afk|help|chat|paragon|lowres|town|full|select|connecting|icons
//   &cls=warrior|ranger|mage   &lv=37   &live=1 (20 Hz fake snapshots)   &static=1 (freeze notice fade for screenshots)

import { render } from 'preact';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import '@fontsource/lilita-one/400.css';
import '../ui/styles/tokens.css';
import { HudRoot } from '../ui/hud';
import { GLYPH_IDS, SkillGlyph, ClassEmblem, DashGlyph, BuffGlyph } from '../ui/hud/Glyphs';
import { ui, worldReader, type MinimapEntity } from '../ui/store';
import { createCharacter } from '@shared/character';
import { computeStats } from '@shared/stats';
import { generateMap, zoneSeed, T_WALL, T_WATER, T_PATH, T_PLAZA, type MapData } from '@shared/mapgen';
import { SKILLS } from '@shared/data/skills';
import { CLASSES } from '@shared/data/classes';
import { hex } from '../ui/hud/util';
import type { ClassId } from '@shared/types';
import type { MeState, RiftState, ZoneInfo } from '@shared/protocol';

const q = new URLSearchParams(location.search);
const state = q.get('state') ?? 'default';
const cls = (q.get('cls') ?? 'warrior') as ClassId;
const live = q.has('live');

// ───────────────────────── mock data ─────────────────────────

const LOADOUTS: Record<ClassId, { slots: string[]; runes: Record<string, string>; tiers: Record<string, number> }> = {
  warrior: {
    slots: ['whirlwind', 'ground_stomp', 'rend', 'battle_rage'],
    runes: { whirlwind: 'dust_devils', ground_stomp: 'jarring_slam', rend: 'lacerate', battle_rage: 'marauders_rage' },
    tiers: { whirlwind: 2, ground_stomp: 1, rend: 3, battle_rage: 1 },
  },
  ranger: {
    slots: ['sentry', 'multishot', 'cluster_arrow', 'companion'],
    runes: { sentry: 'chain_of_torment', multishot: 'arsenal', cluster_arrow: 'maelstrom', companion: 'wolf_howl' },
    tiers: { sentry: 3, multishot: 1, cluster_arrow: 2, companion: 1 },
  },
  mage: {
    slots: ['meteor', 'black_hole', 'frost_nova', 'hydra'],
    runes: { meteor: 'meteor_shower', black_hole: 'spellsteal', frost_nova: 'bone_chill', hydra: 'arcane_hydra' },
    tiers: { meteor: 2, black_hole: 1, frost_nova: 3, hydra: 1 },
  },
};

function makeMap(zone: string): MapData {
  return generateMap(zone, zoneSeed(zone, 1));
}

function pickSpot(map: MapData): { x: number; y: number } {
  if (!map.spawns.length) return map.entry;
  const cx = (map.w * 64) / 2, cy = (map.h * 64) / 2;
  const s = [...map.spawns].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  return s[Math.min(3, s.length - 1)];
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function buildEntities(map: MapData, me: { x: number; y: number }): MinimapEntity[] {
  const r = rng(42);
  const out: MinimapEntity[] = [];
  let id = 100;
  for (const sp of map.spawns) {
    if (Math.hypot(sp.x - me.x, sp.y - me.y) > 1700) continue;
    const n = 6 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) out.push({ id: id++, k: 'mob', x: sp.x + (r() - 0.5) * 260, y: sp.y + (r() - 0.5) * 260, el: i === 0 && r() < 0.35 ? (r() < 0.5 ? 1 : 2) : 0 });
  }
  out.push({ id: id++, k: 'mob', x: me.x + 420, y: me.y - 260, el: 4 });
  out.push({ id: id++, k: 'mob', x: me.x - 300, y: me.y + 380, el: 5 });
  out.push({ id: id++, k: 'player', x: me.x - 180, y: me.y + 120 });
  out.push({ id: id++, k: 'player', x: me.x + 260, y: me.y + 210 });
  out.push({ id: id++, k: 'loot', x: me.x + 90, y: me.y - 160, el: 3 });
  out.push({ id: id++, k: 'loot', x: me.x - 240, y: me.y - 90, el: 4 });
  out.push({ id: id++, k: 'portal', x: me.x - 520, y: me.y - 60 });
  return out;
}

function install(): { map: MapData; me: { x: number; y: number }; ents: MinimapEntity[] } {
  const zoneId = state === 'town' ? 'hearthmere' : 'whispering_glade';
  const map = makeMap(zoneId);
  const me = state === 'town' ? { x: map.entry.x, y: map.entry.y - 128 } : pickSpot(map);
  const ents = buildEntities(map, me);
  worldReader.current = {
    map: () => map,
    entities: () => ents,
    myPos: () => ({ x: myX, y: myY }),
  };
  return { map, me, ents };
}

let myX = 0, myY = 0;

function mockState() {
  const { map, me } = install();
  myX = me.x; myY = me.y;

  const save = createCharacter('Aldric', cls, 7);
  save.name = state === 'town' ? 'Aldric' : 'Aldric';
  const lv = Number(q.get('lv') ?? (state === 'paragon' ? 70 : 37));
  save.level = lv;
  save.gold = 1_284_330;
  save.paragon.level = state === 'paragon' ? 112 : 0;
  const L = LOADOUTS[cls];
  save.skills.slots = [...L.slots];
  save.skills.runes = { ...L.runes };
  save.skills.tiers = { ...L.tiers };
  const derived = computeStats(save);
  const def = CLASSES[cls];

  const res = state === 'lowres' ? 11 : cls === 'ranger' ? 92 : cls === 'mage' ? 71 : 64;
  const mres = def.resource.max;
  const meState: MeState = {
    x: me.x, y: me.y, dashMs: 0, dashCd: 1400,
    hp: state === 'lowres' ? 1900 : state === 'full' ? 12480 : 8120, mhp: 12480,
    res: state === 'full' ? mres : res, mres,
    cds: state === 'full' ? [0, 0, 0, 0] : [0, 7400, 0, 0],
    ch: cls === 'ranger' ? [2, 0, 0, 1] : cls === 'mage' ? [0, 0, 0, 1] : [0, 0, 0, 0],
    buffs: [
      { id: cls === 'warrior' ? 'battle_rage' : cls === 'mage' ? 'magic_weapon' : 'companion', ms: 41000 },
      { id: 'hellforge', ms: 22400, st: 1 },
      { id: 'stridewind', ms: 2400 },
      { id: 'spellsteal', ms: 8800, st: 4 },
      { id: 'ouroboros_cold', ms: 3200 },
    ],
    xp: Math.round(0.46 * 42000), lv, pxp: Math.round(0.34 * 7_500_000 * (1 + 0.04 * 112)), pl: save.paragon.level,
    gold: save.gold,
    dead: state === 'dead' ? 3200 : 0,
  };
  if (lv > 0) meState.xp = Math.round(0.46 * (120 * Math.pow(lv, 2.6) + 300 * lv));

  const inRift = state !== 'town';
  const zone: ZoneInfo = state === 'town'
    ? { zone: 'hearthmere', name: 'Hearthmere', kind: 'town', theme: 'town', seed: map.seed, channel: 1, instance: 'a', difficulty: 0 }
    : { zone: 'rift', name: 'Nephalem Rift', kind: 'rift', theme: 'glade', seed: map.seed, channel: 1, instance: 'r1', difficulty: 5 };
  const rift: RiftState | null = inRift
    ? { progress: state === 'boss' ? 100 : 47.3, phase: state === 'boss' ? 'guardian' : 'hunt', level: lv, difficulty: 5, elapsedMs: 312_000, owner: 'Aldric' }
    : null;

  const t0 = performance.now();
  const now = state === 'select' || q.has('static') ? performance.now() + 1e9 : t0;
  const age = (ms: number) => (q.has('static') ? now - ms : t0 - ms);
  void age;

  ui.set({
    screen: state === 'select' ? 'select' : state === 'connecting' ? 'connecting' : 'game',
    connected: true,
    error: null,
    char: save, derived, me: meState, myId: 1, zone, rift,
    world: { online: 218, channels: [{ zone: zone.zone, channel: 1, players: 12 }], riftOpen: true },
    panels: state === 'help' ? { help: true } : {},
    chatOpen: state === 'chat',
    fps: 60, ping: 38, dps: 1_284_900,
    chat: [
      { id: 1, ch: 'system', text: 'Welcome to Hearthfall. Press F1 for controls.', at: t0 },
      { id: 2, ch: 'zone', from: 'Mirela', cls: 'mage', text: 'anyone up for a rift? opening torment II at the obelisk', at: t0 },
      { id: 3, ch: 'zone', from: 'Borric', cls: 'warrior', text: 'omw, need 2 more', at: t0 },
      { id: 4, ch: 'world', from: 'Sylwen', cls: 'ranger', text: 'trading my spare Bloodwake, whisper me', at: t0 },
      { id: 5, ch: 'zone', from: 'Mirela', cls: 'mage', text: 'black hole + meteor is so good', at: t0 },
      { id: 6, ch: 'system', text: 'Aldric has reached level 37.', at: t0 },
      { id: 7, ch: 'zone', from: 'Aldric', cls: cls, text: 'lets go!', at: t0 },
    ],
    notices: state === 'select' ? [] : [
      { id: 21, text: 'The Rift Guardian has appeared!', kind: 'boss', at: now - 1400 + 0 },
      { id: 22, text: 'Bloodwake', kind: 'legendary', at: now - 900 },
      { id: 23, text: state === 'paragon' ? 'PARAGON 113' : `LEVEL ${lv}`, kind: 'level', at: now - 300 },
    ].filter((n) => state === 'boss' ? true : n.kind !== 'boss'),
    pickups: [
      { id: 31, lk: 'gold', name: 'Gold', amount: 1234, at: now - 5000 },
      { id: 32, lk: 'item', name: 'Bloodwake', rarity: 'legendary', at: now - 4200 },
      { id: 33, lk: 'item', name: "Akkhan's Helm", rarity: 'set', at: now - 3000 },
      { id: 34, lk: 'item', name: 'Doom Visage', rarity: 'rare', at: now - 2400 },
      { id: 35, lk: 'gem', name: 'Royal Ruby', at: now - 1800 },
      { id: 36, lk: 'mat', name: 'Arcane Dust', amount: 3, at: now - 1200 },
      { id: 37, lk: 'globe', name: 'Health Globe', at: now - 600 },
    ],
    afk: state === 'afk' ? { ms: (3 * 3600 + 12 * 60) * 1000, xp: 18_400_000, gold: 214_380, kills: 2830, mats: { scrap: 71, dust: 59, crystal: 18, soul: 0, deathsBreath: 0 }, zone: 'whispering_glade', levels: 4 } : null,
    target: state === 'boss'
      ? { id: 9, name: 'Hollowmaw, Rift Guardian', level: lv + 2, elite: 4, affixes: [], hpFrac: 0.71 }
      : state === 'town' || state === 'select' ? null
        : { id: 8, name: 'Gorethorn', level: lv + 1, elite: 2, affixes: ['molten', 'plagued', 'fast'], hpFrac: 0.62 },
    interact: state === 'town' ? { role: 'cube', name: "The Ancients' Cube" } : null,
  });

  if (live) startLive(meState);
}

function startLive(base: MeState) {
  let hp = base.hp, res = base.res, cds = [...base.cds], dash = base.dashCd;
  let t = 0;
  setInterval(() => {
    t += 0.05;
    hp = Math.max(500, Math.min(base.mhp, hp + Math.sin(t * 0.7) * 120));
    res = Math.max(0, Math.min(base.mres, res + Math.sin(t * 1.3) * 3));
    cds = cds.map((c, i) => (c > 0 ? c - 50 : i === 1 ? 12000 : 0));
    dash = dash > 0 ? dash - 50 : 2800;
    myX += Math.cos(t * 0.6) * 4; myY += Math.sin(t * 0.6) * 4;
    ui.set((s) => ({ me: { ...s.me!, hp, res, cds, dashCd: dash, x: myX, y: myY } }));
  }, 50);
}

// ───────────────────────── backdrop: a quick painted stand-in for the game world ─────────────────────────

function paintBackdrop() {
  const cv = document.getElementById('bg') as HTMLCanvasElement;
  const dpr = 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  cv.style.width = '100%'; cv.style.height = '100%';
  const g = cv.getContext('2d')!;
  const map = worldReader.current?.map();
  const glade = state !== 'town';
  g.fillStyle = glade ? '#2a4a24' : '#4a5e34';
  g.fillRect(0, 0, cv.width, cv.height);
  if (!map) return;
  const zoom = innerHeight / 1150;
  const cx = cv.width / 2, cy = cv.height / 2;
  const R = rng(7);
  const T = 64 * zoom;
  const x0 = Math.floor((myX - cx / zoom) / 64), x1 = Math.ceil((myX + cx / zoom) / 64);
  const y0 = Math.floor((myY - cy / zoom) / 64), y1 = Math.ceil((myY + cy / zoom) / 64);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = tx < 0 || ty < 0 || tx >= map.w || ty >= map.h ? T_WALL : map.tiles[ty * map.w + tx];
      const sx = cx + (tx * 64 - myX) * zoom, sy = cy + (ty * 64 - myY) * zoom;
      const n = R() * 14 - 7;
      let c: [number, number, number] = glade ? [70, 112, 52] : [92, 124, 64];
      if (t === T_PATH) c = glade ? [128, 104, 70] : [140, 118, 80];
      else if (t === T_PLAZA) c = [150, 142, 126];
      else if (t === T_WALL) c = [26, 52, 28];
      else if (t === T_WATER) c = [44, 92, 128];
      g.fillStyle = `rgb(${c[0] + n | 0},${c[1] + n | 0},${c[2] + n | 0})`;
      g.fillRect(sx, sy, T + 1, T + 1);
      if (t === T_WALL && R() < 0.8) {
        g.fillStyle = `rgba(14,40,18,.95)`; g.beginPath(); g.arc(sx + T / 2 + (R() - 0.5) * 20, sy + T / 2, T * 0.62, 0, 6.3); g.fill();
        g.fillStyle = `rgba(52,98,44,.9)`; g.beginPath(); g.arc(sx + T / 2 - 6, sy + T / 2 - 8, T * 0.4, 0, 6.3); g.fill();
      }
    }
  }
  for (const p of map.props) {
    if (p.r === 0) continue;
    const sx = cx + (p.x - myX) * zoom, sy = cy + (p.y - myY) * zoom;
    if (sx < -80 || sy < -80 || sx > cv.width + 80 || sy > cv.height + 80) continue;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(sx, sy + 8, 24 * zoom, 9 * zoom, 0, 0, 6.3); g.fill();
    g.fillStyle = '#6b4a2a'; g.fillRect(sx - 4, sy - 22, 8, 26);
    g.fillStyle = '#2f6a2f'; g.beginPath(); g.arc(sx, sy - 42, 30 * p.s * zoom, 0, 6.3); g.fill();
    g.fillStyle = '#4f9a3f'; g.beginPath(); g.arc(sx - 8, sy - 50, 18 * p.s * zoom, 0, 6.3); g.fill();
  }
  const ents = worldReader.current ? [...worldReader.current.entities()] : [];
  for (const e of ents) {
    if (e.k !== 'mob') continue;
    const sx = cx + (e.x - myX) * zoom, sy = cy + (e.y - myY) * zoom;
    if (sx < 0 || sy < 0 || sx > cv.width || sy > cv.height) continue;
    const big = e.el === 4 ? 2.6 : e.el ? 1.3 : 1;
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(sx, sy + 6, 16 * big * zoom, 6 * big * zoom, 0, 0, 6.3); g.fill();
    g.fillStyle = e.el === 4 ? '#b0392e' : e.el === 2 ? '#d8b43a' : e.el === 1 ? '#5a7cd8' : '#7fc060';
    g.beginPath(); g.ellipse(sx, sy - 6 * big, 15 * big * zoom, 13 * big * zoom, 0, 0, 6.3); g.fill();
    g.fillStyle = '#10100c'; g.beginPath(); g.arc(sx - 5 * big * zoom, sy - 8 * big, 2 * big, 0, 6.3); g.arc(sx + 5 * big * zoom, sy - 8 * big, 2 * big, 0, 6.3); g.fill();
  }
  // the player
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, cy + 10, 22 * zoom, 8 * zoom, 0, 0, 6.3); g.fill();
  g.fillStyle = hex(CLASSES[cls].themeColor); g.fillRect(cx - 9 * zoom, cy - 14 * zoom, 18 * zoom, 22 * zoom);
  g.fillStyle = '#f2c9a0'; g.beginPath(); g.arc(cx, cy - 30 * zoom, 18 * zoom, 0, 6.3); g.fill();
  g.fillStyle = '#6b3a1f'; g.beginPath(); g.arc(cx, cy - 36 * zoom, 18 * zoom, Math.PI, 0); g.fill();
}

// Placeholder "live" previews for the class select cards (main.ts animates the real ones).
function paintPreviews() {
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-preview]').forEach((c) => {
    const id = c.dataset.preview as ClassId;
    const g = c.getContext('2d')!;
    const col = hex(CLASSES[id].themeColor);
    g.clearRect(0, 0, 220, 220);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(110, 196, 52, 12, 0, 0, 6.3); g.fill();
    g.fillStyle = '#1b1410'; g.beginPath(); g.ellipse(110, 152, 38, 40, 0, 0, 6.3); g.fill();
    g.fillStyle = col; g.beginPath(); g.ellipse(110, 150, 34, 37, 0, 0, 6.3); g.fill();
    g.fillStyle = '#1b1410'; g.beginPath(); g.arc(110, 84, 54, 0, 6.3); g.fill();
    g.fillStyle = '#f2c9a0'; g.beginPath(); g.arc(110, 84, 50, 0, 6.3); g.fill();
    g.fillStyle = '#1a1a1a';
    g.beginPath(); g.ellipse(92, 92, 6, 9, 0, 0, 6.3); g.ellipse(128, 92, 6, 9, 0, 0, 6.3); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(94, 88, 2.4, 0, 6.3); g.arc(130, 88, 2.4, 0, 6.3); g.fill();
    g.fillStyle = id === 'mage' ? '#e9e4d8' : id === 'ranger' ? '#2b2b35' : '#6b3a1f';
    g.beginPath(); g.arc(110, 70, 52, Math.PI * 1.05, Math.PI * 1.95); g.fill();
  });
}

// ───────────────────────── icon sheet ─────────────────────────

function IconSheet() {
  const skillGlyphs = GLYPH_IDS.filter((g) => g !== 'unknown');
  const color = (g: string) => { const s = Object.values(SKILLS).find((k) => k.icon.glyph === g); return s ? hex(s.icon.color) : '#ddd'; };
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#14100c', padding: '24px', overflow: 'auto', pointerEvents: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 190px)', gap: '18px' }}>
        {skillGlyphs.map((g) => (
          <div style={{ textAlign: 'center', color: '#bba' }}>
            <div style={{ width: 150, height: 150, margin: '0 auto', background: 'radial-gradient(circle at 50% 40%, #2c2218, #0b0807 72%)', border: '2px solid #5a4528', borderRadius: 6 }}>
              <SkillGlyph glyph={g} color={color(g)} size={150} />
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
              <SkillGlyph glyph={g} color={color(g)} size={44} />
              <SkillGlyph glyph={g} color={color(g)} size={32} />
              <SkillGlyph glyph={g} color={color(g)} size={24} />
            </div>
            <div style={{ fontFamily: 'Cinzel', fontSize: 13 }}>{g}</div>
          </div>
        ))}
        <div style={{ textAlign: 'center' }}><div style={{ width: 150, height: 150, margin: '0 auto', background: '#0b0807' }}><DashGlyph /></div></div>
        {(['warrior', 'ranger', 'mage'] as ClassId[]).map((c) => (
          <div style={{ textAlign: 'center' }}><div style={{ width: 150, height: 150, margin: '0 auto', background: '#0b0807' }}><ClassEmblem classId={c} color={hex(CLASSES[c].themeColor)} /></div></div>
        ))}
        {['up', 'crit', 'shield', 'flame', 'bolt', 'star'].map((s) => (
          <div style={{ textAlign: 'center' }}><div style={{ width: 90, height: 90, margin: '0 auto', background: '#0b0807' }}><BuffGlyph shape={s} color="#ffd24a" /></div></div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── boot ─────────────────────────

const root = document.getElementById('ui')!;
if (state === 'icons') {
  render(<IconSheet />, root);
} else {
  mockState();
  render(<HudRoot />, root);
  if (q.has('static')) {
    const st = document.createElement('style');
    st.textContent = '.notice, .notice * { animation-delay: -0.9s !important; animation-play-state: paused !important; }';
    document.head.appendChild(st);
  }
  document.fonts.ready.then(() => {
    paintBackdrop();
    addEventListener('resize', paintBackdrop);
    setTimeout(() => { paintPreviews(); (window as unknown as { __ready: boolean }).__ready = true; }, 60);
  });
}
