// Art gallery (dev only): http://localhost:5173/gallery-art.html?view=chars|monsters|objects|props|map|icons
// Renders every piece of code-drawn art so it can be reviewed (and screenshotted) in isolation.

import '@fontsource/alegreya-sans/700.css';
import '@fontsource/lilita-one/400.css';
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { createCharacter, playerLook } from '@shared/character';
import { CLASSES, CLASS_IDS } from '@shared/data/classes';
import { BASES, LEGENDARIES, SETS } from '@shared/data/items';
import { MONSTERS } from '@shared/data/monsters';
import { generateItem, type EliteTier } from '@shared/items';
import { generateMap, type MapData, type NpcRole } from '@shared/mapgen';
import { Rng } from '@shared/math';
import { F_ATTACK, F_CAST, F_CHANNEL, F_DASH, F_FROZEN, F_MOVING, F_STUN, LOOK_SLOTS, type LookSlot, type PlayerLook } from '@shared/protocol';
import type { ClassId, ItemKind, Rarity } from '@shared/types';
import {
  buildMapLayers, createMonsterView, createNpcView, createPlayerView, createPortalView, createSummonView, initArt, itemIconUrl,
} from '../render/art';
import type { EntityView, ViewState } from '../render/types';
import { bakedPages } from '../render/art/bake';

const qs = new URLSearchParams(location.search);
const VIEW = qs.get('view') ?? 'chars';
const ZOOM = Number(qs.get('zoom') ?? (VIEW === 'map' ? 1.17 : VIEW === 'chars' ? 2 : 1.6));

const app = new Application();
await app.init({ resizeTo: window, antialias: true, background: 0x2b2722, preference: 'webgl', resolution: 1 });
document.getElementById('stage')!.appendChild(app.canvas);
await document.fonts.load('700 14px "Alegreya Sans"').catch(() => undefined);
initArt(app.renderer);

const world = new Container();
app.stage.addChild(world);
const hud = document.getElementById('hud')!;

interface Actor { view: EntityView; x: number; y: number; state: (t: number) => Partial<ViewState>; aps: number; seq: number; next: number; hitEvery?: number; nextHit?: number }
const actors: Actor[] = [];

function label(text: string, x: number, y: number, size = 12, color = 0xe8d9b5, parent: Container = world) {
  const t = new Text({ text, style: { fontFamily: 'Alegreya Sans', fontWeight: '700', fontSize: size, fill: color, stroke: { color: 0x120d0a, width: 3 } } });
  t.anchor.set(0.5, 0);
  t.position.set(x, y);
  parent.addChild(t);
  return t;
}

function addActor(view: EntityView, x: number, y: number, state: (t: number) => Partial<ViewState> = () => ({}), aps = 1.3, parent: Container = world, hitEvery = 0): Actor {
  view.root.position.set(x, y);
  parent.addChild(view.root);
  const a: Actor = { view, x, y, state, aps, seq: 0, next: 0.6, hitEvery, nextHit: hitEvery ? 1 : undefined };
  actors.push(a);
  return a;
}

function ground(x: number, y: number, w: number, h: number, color = 0x86ad5c) {
  const g = new Graphics().roundRect(x, y, w, h, 10).fill(color);
  world.addChild(g);
}

// ─────────────────────────── looks ───────────────────────────

let seed = 11;
function item(cls: ClassId, rarity: Rarity, base?: string, extra: { legendary?: string; set?: string } = {}) {
  return generateItem(new Rng(seed++ * 7919), { ilvl: 60, classId: cls, rarity, base, ...extra, ancientAllowed: false });
}

const SLOT_BASES: Record<ClassId, Partial<Record<LookSlot, string[]>>> = {
  warrior: { head: ['head_helm', 'head_horned', 'head_cap'], shoulders: ['shoulders_plate', 'shoulders_spiked', 'shoulders_pads'], chest: ['chest_plate', 'chest_mail', 'chest_leather'], hands: ['hands_gauntlets', 'hands_gloves'], legs: ['legs_plate', 'legs_leather'], feet: ['feet_greaves', 'feet_boots'], waist: ['waist_belt'], mainhand: ['sword', 'axe', 'mace', 'sword2h', 'axe2h'], offhand: ['shield'] },
  ranger: { head: ['head_hood', 'head_cap', 'head_circlet'], shoulders: ['shoulders_pads', 'shoulders_mantle'], chest: ['chest_leather', 'chest_mail', 'chest_tunic'], hands: ['hands_gloves', 'hands_wraps'], legs: ['legs_leather', 'legs_cloth'], feet: ['feet_boots', 'feet_shoes'], waist: ['waist_belt', 'waist_sash'], mainhand: ['bow', 'crossbow', 'handxbow'], offhand: ['quiver'] },
  mage: { head: ['head_wizard', 'head_hood', 'head_circlet'], shoulders: ['shoulders_mantle', 'shoulders_pads'], chest: ['chest_robe', 'chest_tunic'], hands: ['hands_wraps', 'hands_gloves'], legs: ['legs_cloth', 'legs_leather'], feet: ['feet_shoes', 'feet_boots'], waist: ['waist_sash', 'waist_belt'], mainhand: ['staff', 'wand'], offhand: ['orb'] },
};

function randomLook(cls: ClassId, rarity: Rarity, pick: number, skip: LookSlot[] = []): PlayerLook {
  const slots: PlayerLook['slots'] = {};
  for (const s of LOOK_SLOTS) {
    if (skip.includes(s)) continue;
    const opts = SLOT_BASES[cls][s];
    if (!opts) continue;
    const base = opts[(pick + s.length) % opts.length];
    if (s === 'offhand' && slots.mainhand && BASES[Object.values(SLOT_BASES[cls].mainhand!).find((b) => BASES[b].shape === slots.mainhand!.shape)!]?.weapon?.twoHanded && cls === 'warrior') continue;
    slots[s] = item(cls, rarity, base).look;
  }
  return { classId: cls, slots };
}

function setLook(cls: ClassId): PlayerLook {
  const set = Object.values(SETS).find((s) => s.classId === cls)!;
  const slots: PlayerLook['slots'] = {};
  for (const piece of set.pieces) {
    const it = item(cls, 'set', piece.base, { set: set.id });
    const kind = BASES[piece.base].kind as LookSlot;
    slots[kind] = it.look;
  }
  const leg = Object.values(LEGENDARIES).find((l) => l.classes?.includes(cls) && BASES[l.base].weapon)!;
  slots.mainhand = item(cls, 'legendary', undefined, { legendary: leg.id }).look;
  const off = Object.values(LEGENDARIES).find((l) => l.classes?.includes(cls) && BASES[l.base].kind === 'offhand');
  if (off && !(cls === 'warrior' && BASES[leg.base].weapon?.twoHanded)) slots.offhand = item(cls, 'legendary', undefined, { legendary: off.id }).look;
  return { classId: cls, slots };
}

function legendLook(cls: ClassId): PlayerLook {
  const look = randomLook(cls, 'rare', 2);
  for (const l of Object.values(LEGENDARIES)) {
    if (l.classes && !l.classes.includes(cls)) continue;
    const kind = BASES[l.base].kind;
    if (kind === 'ring' || kind === 'neck' || kind === 'wrists') continue;
    const slot = (kind === 'weapon1h' || kind === 'weapon2h' ? 'mainhand' : kind) as LookSlot;
    look.slots[slot] = item(cls, 'legendary', undefined, { legendary: l.id }).look;
  }
  if (cls === 'warrior' && look.slots.mainhand?.shape === 'axe2h') delete look.slots.offhand;
  return look;
}

// ─────────────────────────── views ───────────────────────────

const st = (o: Partial<ViewState>) => () => o;

function charsView() {
  const rows: { name: string; look: PlayerLook }[] = [];
  for (const c of CLASS_IDS) rows.push({ name: `${CLASSES[c].name} · starter`, look: playerLook(createCharacter('g', c, 7)) });
  for (const c of CLASS_IDS) rows.push({ name: `${CLASSES[c].name} · magic`, look: randomLook(c, 'magic', 1) });
  for (const c of CLASS_IDS) rows.push({ name: `${CLASSES[c].name} · rare`, look: randomLook(c, 'rare', 2) });
  for (const c of CLASS_IDS) rows.push({ name: `${CLASSES[c].name} · legendary`, look: legendLook(c) });
  for (const c of CLASS_IDS) rows.push({ name: `${CLASSES[c].name} · full set`, look: setLook(c) });
  const cols: [string, (t: number) => Partial<ViewState>][] = [
    ['idle', st({})],
    ['walk', st({ moving: true, vx: 250, flags: F_MOVING })],
    ['attack', st({ flags: F_ATTACK })],
    ['whirlwind / cast', st({ flags: F_CHANNEL })],
    ['cast', st({ flags: F_CAST })],
    ['dash', st({ flags: F_DASH | F_MOVING, moving: true, vx: 900 })],
    ['facing left', st({ facingLeft: true, moving: true, vx: -250, flags: F_MOVING })],
    ['stun', st({ flags: F_STUN })],
  ];
  const colW = 96, rowH = 84;
  const gx = 150, gy = 30;
  const page = Number(qs.get('page') ?? 0);
  const shown = rows.slice(page * 8, page * 8 + 8);
  for (let ci = 0; ci < cols.length; ci++) label(cols[ci][0], gx + ci * colW, 4, 11);
  shown.forEach((r, i) => {
    const y = gy + 70 + i * rowH;
    label(r.name, 62, y - 30, 11, 0xc9b98f);
    ground(gx - 46, y - 9, cols.length * colW, 18, 0x7ea456);
    cols.forEach(([, fn], ci) => {
      const cls = r.look.classId;
      const view = createPlayerView(r.look);
      const isCh = ci === 3 && cls !== 'warrior';
      addActor(view, gx + ci * colW, y, isCh ? st({ flags: F_CAST }) : fn, ci === 2 ? 1.25 : 1.2);
    });
  });
  world.scale.set(ZOOM * 0.585);
}

function closeupView() {
  const all = [
    playerLook(createCharacter('g', 'warrior', 7)), playerLook(createCharacter('g', 'ranger', 7)), playerLook(createCharacter('g', 'mage', 7)),
    legendLook('warrior'), setLook('ranger'), setLook('mage'), randomLook('warrior', 'rare', 1), randomLook('ranger', 'rare', 3), randomLook('mage', 'magic', 2),
  ];
  const pick = (qs.get('pick') ?? '0,1,2').split(',').map(Number);
  const anim = qs.get('anim') ?? 'idle';
  const fl = anim === 'walk' ? F_MOVING : anim === 'attack' ? F_ATTACK : anim === 'channel' ? F_CHANNEL : anim === 'cast' ? F_CAST : 0;
  pick.forEach((li, i) => {
    const v = createPlayerView(all[li]);
    ground(i * 100 - 45, -8, 90, 16, 0x86ad5c);
    addActor(v, i * 100, 0, st({ moving: anim === 'walk', vx: 200, flags: fl }), 1.1);
  });
  const scr = app.screen;
  world.scale.set(ZOOM);
  world.position.set(scr.width / 2 - ((pick.length - 1) * 100 / 2) * ZOOM, scr.height * 0.78);
}

function monstersView() {
  const which = qs.get('which') ?? 'trash';
  const ids = Object.keys(MONSTERS).filter((id) => (which === 'boss') === MONSTERS[id].family.startsWith('boss'));
  const tiers: [string, EliteTier][] = which === 'boss' ? [['boss', 4]] : [['normal', 0], ['champion', 1], ['rare', 2], ['minion', 3]];
  let y = which === 'boss' ? 200 : 60;
  ids.forEach((id) => {
    const def = MONSTERS[id];
    const big = def.scale > 1.2 || which === 'boss';
    if (big && which !== 'boss') y += 22;
    label(def.name, 60, y - 30, 11, 0xc9b98f);
    tiers.forEach(([tn, el], i) => {
      for (let k = 0; k < 3; k++) {
        const x = 150 + i * 250 + k * (which === 'boss' ? 260 : 72);
        const v = createMonsterView(id, el, el === 1 || el === 2 ? ['molten', 'frozen'] : [], def.scale);
        const fl = k === 1 ? F_MOVING : 0;
        addActor(v, x, y, st({ moving: k === 1, vx: 120, flags: fl | (k === 2 ? F_ATTACK : 0) }), 0.8, world, k === 0 ? 1.4 : 0);
        if (k === 0) label(tn, x + 72, y + 6, 9, 0x9a8a6a);
      }
    });
    y += which === 'boss' ? 260 : big ? 96 : 74;
  });
  world.scale.set(ZOOM * (which === 'boss' ? 0.45 : 0.52));
}

function objectsView() {
  const summons = ['sentry', 'hydra', 'wolf', 'bat', 'raven', 'dust_devil'];
  summons.forEach((s, i) => {
    label(s, 80 + i * 110, 10, 11);
    addActor(createSummonView(s), 80 + i * 110, 110, st({ flags: i % 2 ? F_ATTACK : 0 }), 1);
    addActor(createSummonView(s), 80 + i * 110, 200, st({ moving: true, vx: 150, flags: F_MOVING }), 1);
  });
  const roles: NpcRole[] = ['cube', 'obelisk', 'waypoint', 'stash', 'paragon', 'healer', 'vendor', 'dummy'];
  roles.forEach((r, i) => {
    const v = createNpcView(r, r === 'dummy' ? 'Training Dummy' : r[0].toUpperCase() + r.slice(1));
    addActor(v, 80 + i * 120, 380, st({}), 1, world, r === 'dummy' ? 0.9 : 0);
  });
  addActor(createNpcView('dummy', 'Elite Training Dummy'), 80 + 8 * 120, 380, st({}), 1, world, 0.7);
  addActor(createPortalView('To Hearthmere', 'town'), 160, 560);
  addActor(createPortalView('Nephalem Rift', 'rift'), 400, 560);
  world.scale.set(ZOOM * 0.75);
}

function iconsView() {
  const el = document.getElementById('icons')!;
  el.style.display = 'block';
  app.canvas.style.display = 'none';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:12px;font:11px monospace;color:#c9b98f';
  el.appendChild(wrap);
  const rar: Rarity[] = ['normal', 'magic', 'rare', 'legendary', 'set'];
  const cell = (url: string, text: string, border: string) => {
    const d = document.createElement('div');
    d.style.cssText = `width:88px;text-align:center`;
    d.innerHTML = `<div style="width:80px;height:80px;margin:auto;background:radial-gradient(#2a2119,#120d0a);border:1px solid ${border};display:flex;align-items:center;justify-content:center">${url ? `<img src="${url}" width=72 height=72>` : 'EMPTY'}</div><div>${text}</div>`;
    wrap.appendChild(d);
  };
  const cols: Record<Rarity, string> = { normal: '#777', magic: '#6969ff', rare: '#ffff00', legendary: '#bf642f', set: '#00ff00' };
  for (const b of Object.values(BASES)) {
    const cls: ClassId = b.classes?.[0] ?? (b.affinity?.[0] ?? 'warrior');
    for (const r of rar) {
      if (r === 'legendary') {
        const l = Object.values(LEGENDARIES).find((x) => x.base === b.id);
        if (!l) continue;
        const it = item(cls, 'legendary', undefined, { legendary: l.id });
        cell(itemIconUrl(it.look, it.kind as ItemKind, 64), l.name.slice(0, 14), cols[r]);
        continue;
      }
      if (r === 'set') {
        const s = Object.values(SETS).find((x) => x.pieces.some((p) => p.base === b.id));
        if (!s) continue;
        const it = item(s.classId, 'set', b.id, { set: s.id });
        cell(itemIconUrl(it.look, it.kind as ItemKind, 64), `${b.shape} set`, cols[r]);
        continue;
      }
      const it = item(cls, r, b.id);
      cell(itemIconUrl(it.look, it.kind as ItemKind, 64), `${b.shape}`, cols[r]);
    }
  }
}

let mapInfo = '';
function mapView() {
  const which = qs.get('theme') ?? 'town';
  let map: MapData;
  if (which === 'town') map = generateMap('hearthmere', 1234);
  else if (which === 'glade') map = generateMap('whispering_glade', 99);
  else if (which === 'ashen') map = generateMap('ashen_hollow', 77);
  else if (which === 'riftGlade') map = generateMap('rift', 4242, 'glade');
  else map = generateMap('rift', 4243, 'ashen');
  const t0 = performance.now();
  const layers = buildMapLayers(map);
  const t1 = performance.now();
  const ents = new Container();
  ents.sortableChildren = true;
  world.addChild(layers.ground, layers.decals, ents);
  for (const p of layers.sorted) { p.view.zIndex = p.y; ents.addChild(p.view); }
  for (const n of map.npcs) {
    const v = n.role === 'dummy' ? createNpcView('dummy', n.name) : createNpcView(n.role, n.name);
    addActor(v, n.x, n.y, st({}), 1, ents, n.role === 'dummy' ? 1.1 : 0);
    v.root.zIndex = n.y;
  }
  for (const p of map.portals) { const v = createPortalView(p.label, 'town'); addActor(v, p.x, p.y, st({}), 1, ents); v.root.zIndex = p.y; }
  // focus point
  let fx = map.entry.x, fy = map.entry.y;
  const fxq = qs.get('fx'), fyq = qs.get('fy');
  if (fxq) fx = Number(fxq) * 64; if (fyq) fy = Number(fyq) * 64;
  // cast: heroes + a pack of monsters around the focus
  const looks = [playerLook(createCharacter('a', 'warrior', 3)), setLook('ranger'), legendLook('mage')];
  looks.forEach((l, i) => { const v = createPlayerView(l); addActor(v, fx - 120 + i * 90, fy + 40 + (i % 2) * 30, i === 1 ? st({ moving: true, vx: 200, flags: F_MOVING }) : st({}), 1.3, ents); v.root.zIndex = fy + 40 + (i % 2) * 30; });
  const theme = map.theme;
  const fam = Object.values(MONSTERS).filter((m) => m.themes.includes(theme === 'town' ? 'glade' : theme) && m.weight > 0);
  if (which !== 'town') {
    for (let i = 0; i < 10; i++) {
      const m = fam[i % fam.length];
      const x = fx + 160 + (i % 4) * 70 + (i % 3) * 13, y = fy - 120 + Math.floor(i / 4) * 80 + (i % 2) * 20;
      const v = createMonsterView(m.id, (i === 3 ? 2 : i === 6 ? 1 : 0) as EliteTier, i === 3 ? ['frozen'] : [], m.scale);
      addActor(v, x, y, st({ moving: i % 3 === 0, vx: 100, facingLeft: true, flags: i % 3 === 0 ? F_MOVING : 0 }), 1, ents); v.root.zIndex = y;
    }
  }
  const scr = app.screen;
  world.scale.set(ZOOM);
  world.position.set(Math.round(scr.width / 2 - fx * ZOOM), Math.round(scr.height / 2 - fy * ZOOM));
  mapInfo = `${(globalThis as { __mapTiming?: string }).__mapTiming} [${((globalThis as { __chunkT?: number[] }).__chunkT ?? []).map((v) => v.toFixed(0)).join(" ")}] map ${which} ${map.w}x${map.h} props=${map.props.length} sorted=${layers.sorted.length} build=${(t1 - t0).toFixed(1)}ms`;
}

function sheetsView() {
  monstersView();
  for (const a of actors) a.view.root.visible = false;
  let x = 0, y = 0, rowH = 0;
  for (const pg of bakedPages) {
    const sp = new Sprite(new Texture({ source: pg.source }));
    const w = sp.width, h = sp.height;
    if (x + w > 1500 / 0.5) { x = 0; y += rowH + 20; rowH = 0; }
    sp.position.set(x, y + 14);
    const bg = new Graphics().rect(x, y + 14, w, h).fill(0x3a3530);
    world.addChild(bg, sp);
    label(`${pg.label} ${pg.source.pixelWidth}x${pg.source.pixelHeight}`, x + w / 2, y, 10);
    x += w + 16; rowH = Math.max(rowH, h + 14);
  }
  world.scale.set(0.5);
}

function bakeTest() {
  const ids = (qs.get('ids') ?? 'ember_imp').split(',');
  const tiers = (qs.get('tiers') ?? '1').split(',').map(Number);
  let x = 60;
  for (const id of ids) for (const t of tiers) { addActor(createMonsterView(id, t as EliteTier, [], MONSTERS[id].scale), x, 120); x += 90; }
  world.scale.set(2);
}

switch (VIEW) {
  case 'bake': bakeTest(); break;
  case 'sheets': sheetsView(); break;
  case 'chars': charsView(); break;
  case 'closeup': closeupView(); break;
  case 'monsters': monstersView(); break;
  case 'objects': objectsView(); break;
  case 'icons': iconsView(); break;
  case 'map': mapView(); break;
}

let time = 0;
let frames = 0, acc = 0, fps = 0;
app.ticker.add((tk) => {
  const dt = Math.min(0.05, tk.deltaMS / 1000);
  time += dt;
  frames++; acc += tk.deltaMS;
  if (acc > 500) { fps = Math.round(frames * 1000 / acc); frames = 0; acc = 0; }
  for (const a of actors) {
    const o = a.state(time);
    if (time > a.next) { a.seq++; a.next = time + 1 / a.aps; }
    if (a.hitEvery && time > (a.nextHit ?? 0)) { a.view.hit(0.6, false); a.nextHit = time + a.hitEvery; }
    a.view.update(dt, {
      x: a.x, y: a.y, vx: o.vx ?? 0, vy: o.vy ?? 0, moving: o.moving ?? false, facingLeft: o.facingLeft ?? false,
      flags: o.flags ?? 0, attackSeq: (o.flags ?? 0) & (F_ATTACK | F_FROZEN) ? a.seq : (o.attackSeq ?? 0), hpFrac: 1, time, aps: a.aps,
    });
  }
  hud.textContent = `${VIEW}  ${fps} fps  ${mapInfo}`;
});
(window as unknown as { __pages: unknown }).__pages = bakedPages;
(window as unknown as { __ready: boolean; __info: string }).__ready = true;
(window as unknown as { __info: string }).__info = mapInfo;
