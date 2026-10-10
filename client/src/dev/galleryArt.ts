// Art gallery (dev only): http://localhost:5173/gallery-art.html?view=chars|monsters|objects|props|map|icons
// Renders every piece of code-drawn art so it can be reviewed (and screenshotted) in isolation.

import '@fontsource/alegreya-sans/700.css';
import '@fontsource/lilita-one/400.css';
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { createCharacter, playerLook } from '@shared/character';
import { CLASSES, CLASS_IDS } from '@shared/data/classes';
import { BASES, LEGENDARIES, SETS } from '@shared/data/items';
import { MONSTERS } from '@shared/data/monsters';
import { ADVENTURES } from '@shared/adventure';
import { generateItem, type EliteTier } from '@shared/items';
import { generateMap, type MapData, type NpcRole } from '@shared/mapgen';
import { Rng } from '@shared/math';
import { F_ATTACK, F_CAST, F_CHANNEL, F_DASH, F_FROZEN, F_MOVING, F_STUN, LOOK_SLOTS, type LookSlot, type PlayerLook } from '@shared/protocol';
import type { ClassId, Item, ItemKind, Rarity, Slot } from '@shared/types';
import {
  buildMapLayers, createMonsterView, createNpcView, createPlayerView, createPortalView, createSummonView, initArt, itemIconUrl,
} from '../render/art';
import type { EntityView, ViewState } from '../render/types';
import { bakedPages } from '../render/art/bake';
import { PlayerArt, artDebug, bakePlayerLook } from '../render/art/player';
import { ACTIONS, type ActionSpec } from '../render/actions';
import { NPC_PRESETS, RESIDENT_PRESETS } from '../render/art/npcLooks';
import { F_WINDUP } from '@shared/protocol';
import { GEAR_TIER_COLORS, GEAR_TIER_NAMES, gearLook, gearProfile } from '@shared/gearVisual';
import { SHOWCASE_STAGES, showcaseEquipment, type ShowcaseStage } from '@shared/gearShowcase';
import { gearFxStats } from '../render/art/gearFx';
import { SET_STYLE } from '../render/art/gearStyle';

const qs = new URLSearchParams(location.search);
// baked pages are only retained for the sheet viewer (keeping every page alive would leak in ?view=stress)
(globalThis as { __artDebug?: boolean }).__artDebug = (qs.get('view') ?? 'chars') === 'sheets';
const VIEW = qs.get('view') ?? 'chars';
const SHEETS = ['turntable', 'turn', 'whirl', 'skills', 'rapid', 'mon2', 'walk8'];
const ZOOM = Number(qs.get('zoom') ?? (VIEW === 'map' ? 1.17 : VIEW === 'chars' ? 2 : SHEETS.includes(VIEW) ? 1.74 : 1.6));

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

/** Townsfolk contact sheet (docs/rework/CAST.md): every named preset, then the ambient residents. */
function npcsView() {
  const named = Object.keys(NPC_PRESETS).map((k) => { const [zone, id] = k.split('/'); return { role: zone === 'hearthmere' ? id : 'quest', name: NPC_PRESETS[k].title ?? id, where: { zone, id } }; });
  const residents = Object.keys(RESIDENT_PRESETS).map((k) => ({ role: k, name: RESIDENT_PRESETS[k].title ?? k, where: {} as { zone?: string; id?: string } }));
  const all = [...named, ...residents];
  const per = 9, colW = 120, rowH = 150;
  all.forEach((n, i) => {
    const x = 90 + (i % per) * colW, y = 150 + Math.floor(i / per) * rowH;
    ground(x - 50, y - 9, 100, 18, 0x6a7a4c);
    addActor(createNpcView(n.role, n.name, undefined, undefined, undefined, n.where), x, y, st({}), 1.1);
  });
  world.scale.set(ZOOM * 0.92);
}

/** Quest objects (docs/rework/CAST.md): each kind idle, tracked (pulsing ring) and used. */
function questObjectsView() {
  const kinds = ['cart', 'ledger', 'marker', 'mechanism'] as const;
  kinds.forEach((k, row) => {
    label(k, 40, 110 + row * 150, 12);
    (['idle', 'tracked', 'used'] as const).forEach((state, col) => {
      const x = 200 + col * 220, y = 130 + row * 150;
      if (row === 0) label(state, x - 20, 40, 12);
      ground(x - 80, y - 12, 160, 24, 0x6a7a4c);
      const v = createNpcView('clue', k, undefined, undefined, k, { zone: 'gallery', id: `${k}-${state}` }) as unknown as EntityView & { setClueState(t: boolean, u: boolean): void };
      v.setClueState(state === 'tracked', state === 'used');
      addActor(v, x, y, st({}), 1);
    });
  });
  world.scale.set(ZOOM * 0.9);
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
  const selected=qs.get('ids')?.split(',');
  const ids = Object.keys(MONSTERS).filter((id) => selected?selected.includes(id):(which === 'boss') === MONSTERS[id].family.startsWith('boss'));
  const tiers: [string, EliteTier][] = which === 'boss' ? [['boss', 4]] : [['normal', 0], ['champion', 1], ['rare', 2], ['minion', 3]];
  let y = which === 'boss' ? 200 : selected ? 130 : 60;
  ids.forEach((id) => {
    const def = MONSTERS[id];
    const big = def.scale > 1.2 || which === 'boss';
    if (big && which !== 'boss') y += 22;
    label(def.name, 60, y - 30, 11, 0xc9b98f);
    tiers.forEach(([tn, el], i) => {
      for (let k = 0; k < 3; k++) {
        const x = 150 + i * (selected ? 350 : 250) + k * (which === 'boss' ? 260 : selected ? 104 : 72);
        const v = createMonsterView(id, el, el === 1 || el === 2 ? ['molten', 'frozen'] : [], def.scale);
        const fl = k === 1 ? F_MOVING : 0;
        addActor(v, x, y, st({ moving: k === 1, vx: 120, flags: fl | (k === 2 ? F_ATTACK : 0) }), 0.8, world, k === 0 ? 1.4 : 0);
        if (k === 0) label(tn, x + 72, y + 6, 9, 0x9a8a6a);
      }
    });
    y += which === 'boss' ? 260 : selected ? 165 : big ? 96 : 74;
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
  const authored=qs.get('zone');
  if(authored&&Object.hasOwn(ADVENTURES,authored))map=generateMap(authored,1234);
  else if (which === 'town') map = generateMap('hearthmere', 1234);
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
    const v = createNpcView(n.role,n.name,map.town?.npcs.find(a=>a.id===n.id)?.look,map.town?n.r:undefined,map.adventure?.interactions.find(i=>i.id===n.id)?.kind);
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
  const act = !!qs.get('act');
  if (act) looks[0] = legendLook('warrior');
  const heroes: PlayerArt[] = [];
  looks.forEach((l, i) => {
    const v = createPlayerView(l);
    const hy = fy + 40 + (i % 2) * 30;
    // ?act=1: the cast performs at the game camera — warrior whirlwinds, ranger rapid-fires, mage casts
    const state = act ? (i === 0 ? st({ flags: F_CHANNEL }) : st({})) : i === 1 ? st({ moving: true, vx: 200, flags: F_MOVING }) : st({});
    addActor(v, fx - 120 + i * 90, hy, state, 1.3, ents);
    v.root.zIndex = hy;
    heroes.push(v as PlayerArt);
  });
  if (act) {
    let tr = 0, tm = 0, k = 0;
    app.ticker.add((tk) => {
      const dt = Math.min(0.05, tk.deltaMS / 1000);
      tr += dt; tm += dt;
      const r = heroes[1], m = heroes[2];
      if (tr > 1 / 3.5) { tr = 0; r.playAction({ skill: 'hungering_arrow', tx: r.root.x + 260, ty: r.root.y - 70, cycleMs: 1000 / 3.5 }); }
      if (tm > 0.75) { tm = 0; k++; m.playAction({ skill: k % 4 === 0 ? 'meteor' : k % 4 === 2 ? 'black_hole' : 'magic_missile', tx: m.root.x + 230, ty: m.root.y - 40, cycleMs: 700 }); }
    });
  }
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
  mapInfo = `map ${map.zone} ${map.w}x${map.h} props=${map.props.length} sorted=${layers.sorted.length} build=${(t1 - t0).toFixed(1)}ms`;
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
  const tiers = (qs.get('tiers') ?? '0').split(',').map(Number);
  const anim = qs.get('anim') ?? 'idle';
  const fl = anim === 'walk' ? F_MOVING : anim === 'attack' ? F_ATTACK : anim === 'windup' ? 1 << 15 : anim === 'stun' ? F_STUN : anim === 'frozen' ? F_FROZEN : 0;
  let x = 60;
  for (const id of ids) for (const t of tiers) {
    addActor(createMonsterView(id, t as EliteTier, t === 1 || t === 2 ? ['molten'] : [], MONSTERS[id].scale), x, 120, st({ moving: anim === 'walk', vx: 100, flags: fl }), 1.1);
    x += MONSTERS[id].scale > 1.2 ? 110 : 80;
  }
  world.scale.set(ZOOM);
  // ?death=element → every view dies once after 1 s, ?hit=1 → flash every 0.5 s
  const death = qs.get('death');
  if (death !== null) setTimeout(() => { for (const a of actors) a.view.die(Number(death), () => { a.view.root.visible = false; }); }, 1000);
  if (qs.get('hit')) for (const a of actors) { a.hitEvery = 0.5; a.nextHit = 0.4; }
}


// ─────────────────────────── contact sheets (manual advance) ───────────────────────────
// Every cell is its own view simulated offline with a fixed time step to an exact instant, so a whole
// animation is laid out in one frame (no ticker timing involved). ?view=turntable|turn|whirl|skills|rapid|mon2

type Ev = { at: number; fn: (v: EntityView) => void };
const DT = 1 / 240;

function simulate(view: EntityView, x: number, y: number, until: number, state: (t: number) => Partial<ViewState>, events: Ev[] = []): void {
  view.root.position.set(x, y);
  world.addChild(view.root);
  const evs = [...events].sort((a, b) => a.at - b.at);
  let t = 0, seq = 0, ei = 0;
  while (t < until - 1e-9) {
    const step = Math.min(DT, until - t);
    t += step;
    while (ei < evs.length && evs[ei].at <= t + 1e-9) { evs[ei].fn(view); ei++; }
    const o = state(t);
    if (o.attackSeq !== undefined) seq = o.attackSeq;
    view.update(step, { x, y, vx: o.vx ?? 0, vy: o.vy ?? 0, moving: o.moving ?? false, facingLeft: o.facingLeft ?? false, flags: o.flags ?? 0, attackSeq: seq, hpFrac: 1, time: t, aps: o.aps ?? 1.2 });
  }
}

function sheetLooks(cls: ClassId): { name: string; look: PlayerLook }[] {
  return [
    { name: 'starter', look: playerLook(createCharacter('g', cls, Number(qs.get('seed') ?? 7))) },
    { name: 'starter #2', look: playerLook(createCharacter('g', cls, Number(qs.get('seed') ?? 7) + 1)) },
    { name: 'rare', look: randomLook(cls, 'rare', 2) },
    { name: 'legendary', look: legendLook(cls) },
    { name: 'full set', look: setLook(cls) },
  ];
}

function prebake(looks: PlayerLook[]) { for (const l of looks) bakePlayerLook(l); }

function grid(cols: number, cw: number, rh: number, x0 = 120, y0 = 90) {
  return (c: number, r: number) => ({ x: x0 + c * cw, y: y0 + r * rh });
}

function turntableView() {
  artDebug.deterministic = true;
  const cls = (qs.get('cls') ?? 'warrior') as ClassId;
  const rows = sheetLooks(cls);
  prebake(rows.map((r) => r.look));
  const yaws = [0, 45, 90, 135, 180, 225, 270, 315];
  const at = grid(yaws.length, 110, 118);
  yaws.forEach((yw, c) => label(`${yw}°`, at(c, 0).x, 6, 13));
  rows.forEach((r, i) => {
    label(r.name, 46, at(0, i).y - 40, 12, 0xc9b98f);
    yaws.forEach((yw, c) => {
      const v = new PlayerArt(r.look);
      const p = at(c, i);
      ground(p.x - 50, p.y - 7, 100, 14, 0x7ea456);
      v.setYaw(yw);
      simulate(v, p.x, p.y, 0.6, () => ({}));
    });
  });
  world.scale.set(ZOOM * Number(qs.get('k') ?? 1));
}

function turnView() {
  artDebug.deterministic = true;
  const looks = [playerLook(createCharacter('g', 'warrior', 7)), playerLook(createCharacter('g', 'ranger', 7)), playerLook(createCharacter('g', 'mage', 7)), legendLook('warrior')];
  prebake(looks);
  const frames = 12, step = 0.03;
  const at = grid(frames, 96, 118);
  for (let c = 0; c < frames; c++) label(`${Math.round(c * step * 1000)} ms`, at(c, 0).x, 6, 12);
  const kinds = (qs.get('dir') ?? 'rl').split(',');
  let row = 0;
  for (const look of looks) for (const k of kinds) {
    label(`${look.classId} ${k === 'rl' ? 'right→left' : k === 'lr' ? 'left→right' : k === 'up' ? 'right→up' : 'up→down'}`, 56, at(0, row).y - 44, 11, 0xc9b98f);
    for (let c = 0; c < frames; c++) {
      const v = new PlayerArt(look);
      const p = at(c, row);
      ground(p.x - 44, p.y - 7, 88, 14, 0x7ea456);
      const T0 = 0.8;
      const from = k === 'lr' ? { vx: -220, vy: 0 } : k === 'ud' ? { vx: 0, vy: -220 } : { vx: 220, vy: 0 };
      const to = k === 'rl' ? { vx: -220, vy: 0 } : k === 'lr' ? { vx: 220, vy: 0 } : k === 'up' ? { vx: 0, vy: -220 } : { vx: 0, vy: 220 };
      simulate(v, p.x, p.y, T0 + c * step, (t) => {
        const m = t < T0 ? from : to;
        return { moving: true, vx: m.vx, vy: m.vy, flags: F_MOVING, facingLeft: m.vx < 0 };
      });
    }
    row++;
  }
  world.scale.set(ZOOM * Number(qs.get('k') ?? 1));
}

function walk8View() {
  artDebug.deterministic = true;
  const cls = (qs.get('cls') ?? 'warrior') as ClassId;
  const looks = [playerLook(createCharacter('g', cls, 7)), setLook(cls)];
  prebake(looks);
  const dirs: [string, number, number][] = [['→', 1, 0], ['↘', 0.7, 0.7], ['↓', 0, 1], ['↙', -0.7, 0.7], ['←', -1, 0], ['↖', -0.7, -0.7], ['↑', 0, -1], ['↗', 0.7, -0.7]];
  const at = grid(dirs.length, 110, 118);
  dirs.forEach(([n], c) => label(`walk ${n}`, at(c, 0).x, 6, 13));
  looks.forEach((look, r) => dirs.forEach(([, dx, dy], c) => {
    const v = new PlayerArt(look);
    const p = at(c, r);
    ground(p.x - 50, p.y - 7, 100, 14, 0x7ea456);
    simulate(v, p.x, p.y, 1.0 + c * 0.037, () => ({ moving: true, vx: dx * 220, vy: dy * 220, flags: F_MOVING, facingLeft: dx < 0 }));
  }));
  world.scale.set(ZOOM * Number(qs.get('k') ?? 1));
}

function whirlView() {
  artDebug.deterministic = true;
  const looks = [playerLook(createCharacter('g', 'warrior', 7)), legendLook('warrior'), setLook('warrior'), randomLook('warrior', 'rare', 3)];
  // make sure one row shows a two-hander
  const big = randomLook('warrior', 'rare', 1);
  big.slots.mainhand = item('warrior', 'rare', 'axe2h').look; delete big.slots.offhand;
  looks[3] = big;
  prebake(looks);
  const frames = 13, step = 0.035;
  const at = grid(frames, 118, 130, 130, 100);
  for (let c = 0; c < frames; c++) label(`${Math.round(c * step * 1000)} ms`, at(c, 0).x, 6, 12);
  looks.forEach((look, r) => {
    label(['starter', 'legendary', 'set', '2h rare'][r], 56, at(0, r).y - 50, 11, 0xc9b98f);
    for (let c = 0; c < frames; c++) {
      const v = new PlayerArt(look);
      const p = at(c, r);
      ground(p.x - 54, p.y - 7, 108, 14, 0x7ea456);
      const T0 = 0.6;
      simulate(v, p.x, p.y, T0 + 0.5 + c * step, (t) => ({ flags: t > T0 ? F_CHANNEL : 0, moving: false }));
    }
  });
  world.scale.set(ZOOM * Number(qs.get('k') ?? 1));
}

const SKILLS: Record<ClassId, string[]> = {
  warrior: ['cleave', 'rend', 'ground_stomp', 'seismic_slam', 'battle_rage'],
  ranger: ['hungering_arrow', 'multishot', 'cluster_arrow', 'rain_of_vengeance', 'sentry', 'companion'],
  mage: ['magic_missile', 'meteor', 'black_hole', 'frost_nova', 'hydra', 'magic_weapon'],
};

function skillsView() {
  artDebug.deterministic = true;
  const cls = (qs.get('cls') ?? 'warrior') as ClassId;
  const which = qs.get('look') ?? 'starter';
  const look = which === 'legendary' ? legendLook(cls) : which === 'set' ? setLook(cls) : which === 'rare' ? randomLook(cls, 'rare', Number(qs.get('pick') ?? 2)) : playerLook(createCharacter('g', cls, 7));
  if (qs.get('weapon')) { look.slots.mainhand = item(cls, 'rare', qs.get('weapon')!).look; if (cls === 'warrior' && /2h/.test(qs.get('weapon')!)) delete look.slots.offhand; }
  prebake([look]);
  const skills = (qs.get('skills') ?? SKILLS[cls].join(',')).split(',');
  const frames = Number(qs.get('frames') ?? 14), step = Number(qs.get('step') ?? 0.04);
  const start = Number(qs.get('from') ?? -0.04);
  const at = grid(frames, 112, 132, 130, 104);
  for (let c = 0; c < frames; c++) label(`${Math.round((start + c * step) * 1000)}`, at(c, 0).x, 6, 12);
  const facing = qs.get('face') === 'left' ? -1 : 1;
  skills.forEach((name, r) => {
    const single = name.endsWith('!');
    const sk = name.replace('!', '');
    label(single ? `${sk} (1st)` : sk, 60, at(0, r).y - 56, 11, 0xc9b98f);
    const def = ACTIONS[sk];
    const prim = def && (def.pose === 'swing' || def.pose === 'shoot' || def.pose === 'flick') && !single;
    const aps = Number(qs.get('aps') ?? 1.6);
    const cyc = 1 / aps;
    for (let c = 0; c < frames; c++) {
      const v = new PlayerArt(look);
      const p = at(c, r);
      ground(p.x - 54, p.y - 7, 108, 14, 0x7ea456);
      const T0 = 0.6 + (prim ? cyc : 0);
      const tx = p.x + facing * 140, ty = p.y + 10;
      const evs: Ev[] = [];
      const fire = (at2: number) => evs.push({ at: at2, fn: (vv) => (vv as PlayerArt).playAction({ skill: sk, tx, ty, cycleMs: cyc * 1000 } as ActionSpec) });
      if (prim) { fire(0.6); fire(T0); } else fire(T0);
      v.setYaw(facing * 65);
      simulate(v, p.x, p.y, Math.max(0.01, T0 + start + c * step), () => ({ aps, facingLeft: facing < 0 }), evs);
      if (qs.get('dbg')) { const a = v as unknown as Record<string, number>; console.log('DBG', sk, c, a.yawB.toFixed(1), a.yawH.toFixed(1), a.yawTarget); }
    }
  });
  world.scale.set(ZOOM * Number(qs.get('k') ?? 1));
}

function rapidView() {
  // ranger primaries at very high attack speed: every frame of two consecutive cycles
  artDebug.deterministic = true;
  const aps = Number(qs.get('aps') ?? 3.5);
  const cyc = 1 / aps;
  const looks = [playerLook(createCharacter('g', 'ranger', 7)), setLook('ranger'), playerLook(createCharacter('g', 'mage', 7)), setLook('mage')];
  const xb = randomLook('ranger', 'rare', 1); xb.slots.mainhand = item('ranger', 'rare', 'crossbow').look;
  looks.splice(2, 0, xb);
  prebake(looks);
  const frames = 14, step = Number(qs.get('step') ?? 0.025);
  const at = grid(frames, 108, 128, 130, 100);
  for (let c = 0; c < frames; c++) label(`${Math.round(c * step * 1000)}`, at(c, 0).x, 6, 12);
  looks.forEach((look, r) => {
    const sk = look.classId === 'mage' ? 'magic_missile' : 'hungering_arrow';
    label(`${look.classId} ${look.slots.mainhand?.shape} @${aps}/s`, 64, at(0, r).y - 54, 11, 0xc9b98f);
    for (let c = 0; c < frames; c++) {
      const v = new PlayerArt(look);
      const p = at(c, r);
      ground(p.x - 50, p.y - 7, 100, 14, 0x7ea456);
      const evs: Ev[] = [];
      for (let k = 0; k < 8; k++) evs.push({ at: 0.5 + k * cyc, fn: (vv) => (vv as PlayerArt).playAction({ skill: sk, tx: p.x + 200, ty: p.y - 10, cycleMs: cyc * 1000 }) });
      v.setYaw(65);
      simulate(v, p.x, p.y, 0.5 + 3 * cyc + c * step, () => ({ aps }), evs);
      if (qs.get('dbg') && c === 0) { const a = v as unknown as Record<string, number>; console.log('DBG', r, a.yawB, a.yawH, a.yawTarget, a.bodyTarget, a.side); }
    }
  });
  world.scale.set(ZOOM * Number(qs.get('k') ?? 1));
}

function mon2View() {
  // monsters: windup (F_WINDUP) → attack (attackSeq + playAction) → hit flinch, sampled at fixed instants
  const ids = (qs.get('ids') ?? 'bog_slime,gloomshroom,grave_bat,thornling,mossback,ember_imp,bonewalker,cinder_cultist,magma_brute,ash_wisp').split(',').filter((id) => MONSTERS[id]);
  const times = [0, 0.15, 0.3, 0.5, 0.62, 0.66, 0.72, 0.8, 0.95, 1.0, 1.05, 1.12, 1.25];
  const names = ['idle', 'windup', 'windup', 'windup', 'strike', '+40', '+100', '+180', 'hit', '+50', '+100', '+170', '+300'];
  const at = grid(times.length, 92, 104, 130, 96);
  names.forEach((n, c) => label(n, at(c, 0).x, 6, 11));
  ids.forEach((id, r) => {
    const def = MONSTERS[id];
    label(def.name, 60, at(0, r).y - 40, 10, 0xc9b98f);
    times.forEach((tt, c) => {
      const v = createMonsterView(id, 0, [], def.scale);
      const p = at(c, r);
      ground(p.x - 42, p.y - 6, 84, 12, 0x7ea456);
      const tx = p.x + 120, ty = p.y;
      const evs: Ev[] = [
        { at: 0.62, fn: (vv) => (vv as unknown as { playAction?: (a: ActionSpec) => void }).playAction?.({ skill: 'shot', tx, ty, cycleMs: 1000 }) },
        { at: 0.95, fn: (vv) => vv.hit(0.8, false) },
      ];
      simulate(v, p.x, p.y, 0.4 + tt, (t) => ({ flags: (t > 0.4 && t < 1.0 ? F_WINDUP : 0) | (t > 1.0 && t < 1.25 ? F_ATTACK : 0), attackSeq: t > 1.02 ? 1 : 0 }), evs.map((e) => ({ ...e, at: e.at + 0.4 })));
    });
  });
  world.scale.set(ZOOM * Number(qs.get('k') ?? 1));
}

// ─────────────────────────── gear progression (docs/rework/gear) ───────────────────────────

/** A hero's network look at a showcase stage (real items → playerLook, exactly what other clients receive). */
function stageLook(cls: ClassId, stage: ShowcaseStage, seedN = 3): PlayerLook {
  const save = createCharacter('Gear', cls, 5);
  save.equipment = showcaseEquipment(cls, stage, seedN);
  const look = playerLook(save);
  // ?legacy=1: the same loadout without the visual progression = exactly what the game drew before (protocol 21)
  if (qs.get('legacy')) { delete look.jw; for (const l of Object.values(look.slots)) if (l) delete l.fx; }
  return look;
}
const STAGE_LABEL: Record<ShowcaseStage, string> = { starter: 'Starter', L10: 'Level 10', L20: 'Level 20', L30: 'Level 30', L40: 'Level 40', L50: 'Level 50', L60: 'Level 60', L70: 'Level 70', set: 'Full set', ancient: 'Ancient set', primal: 'Primal set' };

/** ?view=gear-ladder: each class from starter rags to a Primal set (the contact sheet of DESIGN.md §1). */
function gearLadderView() {
  const stages = (qs.get('stages')?.split(',') as ShowcaseStage[] | undefined) ?? [...SHOWCASE_STAGES];
  const colW = Number(qs.get("colw") ?? 98), rowH = Number(qs.get("rowh") ?? 186), gx = 64, gy = 140;
  const anim = qs.get('anim') ?? 'idle';
  stages.forEach((stg, ci) => label(STAGE_LABEL[stg], gx + ci * colW, 6, 12));
  CLASS_IDS.forEach((cls, ri) => {
    const y = gy + ri * rowH;
    label(CLASSES[cls].name, 18, y - 90, 12, 0xc9b98f);
    ground(gx - 52, y - 10, stages.length * colW, 20, 0x6f8f4c);
    stages.forEach((stg, ci) => {
      const look = stageLook(cls, stg);
      const p = gearProfile(look);
      const x = gx + ci * colW;
      const v = createPlayerView(look);
      addActor(v, x, y, anim === 'walk' ? st({ moving: true, vx: 220, flags: F_MOVING }) : st({}), 1.2);
      label(GEAR_TIER_NAMES[p.rank] + ' ' + p.rank, x, y + 14, 10, GEAR_TIER_COLORS[p.rank]);
    });
  });
  world.scale.set(ZOOM * Number(qs.get('k') ?? 1.06));
}

/** ?view=gear-vs: the newcomer next to the veteran, on the town ground at the game camera (or ?zoom=). */
function gearVsView() {
  const cls = (qs.get('cls') ?? 'warrior') as ClassId;
  const vet = (qs.get('vet') ?? 'primal') as ShowcaseStage;
  const map = generateMap('hearthmere', 1234);
  const layers = buildMapLayers(map);
  const ents = new Container(); ents.sortableChildren = true;
  world.addChild(layers.ground, layers.decals, ents);
  for (const pr of layers.sorted) { pr.view.zIndex = pr.y; ents.addChild(pr.view); }
  const fx0 = map.entry.x + Number(qs.get('dx') ?? 0), fy0 = map.entry.y + Number(qs.get('dy') ?? 0);
  const classes = qs.get('all') ? CLASS_IDS : [cls];
  const moving = !!qs.get('walk');
  classes.forEach((c, i) => {
    const x = fx0 - (classes.length - 1) * 80 + i * 160;
    ([['starter', 0], [vet, 1]] as const).forEach(([stg, k]) => {
      const v = createPlayerView(stageLook(c, stg));
      const hx = x - 30 + k * 60, hy = fy0 + 30 + k * 4;
      addActor(v, hx, hy, moving ? st({ moving: true, vx: 220, flags: F_MOVING }) : st({}), 1.2, ents);
      const yaw = qs.get('yaw');
      if (yaw !== null && !moving) (v as PlayerArt).setYaw(Number(yaw) * (k === 0 ? -1 : 1));
      v.root.zIndex = hy;
      if (qs.get('labels')) { const p = gearProfile(stageLook(c, stg)); label(GEAR_TIER_NAMES[p.rank], hx, hy + 12, 9, GEAR_TIER_COLORS[p.rank], ents).zIndex = 1e6; }
    });
  });
  const scr = app.screen;
  const z = Number(qs.get('zoom') ?? (1080 / 620) * 0.75);
  world.scale.set(z);
  world.position.set(Math.round(scr.width / 2 - fx0 * z), Math.round(scr.height / 2 - (fy0 + 10) * z));
}

/** ?view=gear-sets: the nine Sets at 2 / 4 / 6 pieces (set identity + layering). */
function gearSetsView() {
  const ids = Object.keys(SET_STYLE);
  const colW = 150, rowH = 150;
  ids.forEach((id, i) => {
    const set = SETS[id];
    const save = createCharacter('Set', set.classId, 5);
    const eq = showcaseEquipment(set.classId, 'set', 7 + i);
    const x0 = 120 + (i % 3) * colW * 3.1, y0 = 150 + Math.floor(i / 3) * rowH * 1.25;
    label(set.name, x0 + colW, y0 - 118, 12, 0xe8d9b5);
    [2, 4, 6].forEach((n, k) => {
      const e: Partial<Record<Slot, Item>> = {};
      let placed = 0;
      for (const piece of set.pieces) {
        const slot = BASES[piece.base].kind as Slot;
        if (placed < n) { e[slot] = generateItem(new Rng(i * 97 + k * 13 + placed), { ilvl: 70, classId: set.classId, rarity: 'set', set: id, base: piece.base }); placed++; }
        else e[slot] = generateItem(new Rng(i * 31 + k * 7 + placed), { ilvl: 70, classId: set.classId, rarity: 'rare', base: piece.base });
      }
      for (const s2 of ['mainhand', 'offhand', 'neck', 'ring1', 'ring2', 'waist', 'wrists'] as const) if (eq[s2] && !e[s2]) e[s2] = eq[s2];
      save.equipment = e;
      const look = playerLook(save);
      const x = x0 + k * colW;
      ground(x - 50, y0 - 9, 100, 18, 0x6f8f4c);
      addActor(createPlayerView(look), x, y0, st({}), 1.2);
      label(n + ' pieces', x, y0 + 12, 10, 0xc9b98f);
    });
  });
  world.scale.set(ZOOM * Number(qs.get('k') ?? 0.62));
}

/** ?view=gear-icons: icons across the tier ladder (tier frames, Set marks, temper stars, Ancient / Primal jewels). */
function gearIconsView() {
  const el = document.getElementById('icons')!;
  el.style.display = 'block';
  app.canvas.style.display = 'none';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;grid-template-columns:120px repeat(10, 84px);gap:6px;padding:14px;font:12px monospace;color:#c9b98f;align-items:center';
  el.appendChild(wrap);
  const steps: { name: string; rarity: Rarity; ilvl: number; ancient?: 0 | 1 | 2; upgrade?: number }[] = [
    { name: 'Threadbare', rarity: 'normal', ilvl: 5 }, { name: 'Homespun', rarity: 'normal', ilvl: 20 }, { name: 'Tempered', rarity: 'magic', ilvl: 20 },
    { name: 'Fine', rarity: 'magic', ilvl: 40 }, { name: 'Masterwork', rarity: 'rare', ilvl: 30, upgrade: 4 }, { name: 'Runic', rarity: 'rare', ilvl: 60, upgrade: 7 },
    { name: 'Storied', rarity: 'legendary', ilvl: 60 }, { name: 'Heroic', rarity: 'set', ilvl: 70, upgrade: 4 }, { name: 'Ancient', rarity: 'legendary', ilvl: 70, ancient: 1, upgrade: 7 },
    { name: 'Primal', rarity: 'set', ilvl: 70, ancient: 2, upgrade: 10 },
  ];
  const head = (t: string) => { const d = document.createElement('div'); d.textContent = t; d.style.textAlign = 'center'; wrap.appendChild(d); };
  head('');
  steps.forEach((st2) => head(st2.name));
  const bases = qs.get('bases')?.split(',') ?? ['head_horned', 'shoulders_spiked', 'chest_plate', 'sword2h', 'bow', 'staff', 'shield', 'feet_boots'];
  for (const b of bases) {
    const base = BASES[b];
    const cls: ClassId = base.classes?.[0] ?? base.affinity?.[0] ?? 'warrior';
    head(base.noun);
    steps.forEach((stp, i) => {
      const set = stp.rarity === 'set' ? Object.values(SETS).find((x) => x.pieces.some((p) => p.base === b)) : undefined;
      const leg = stp.rarity === 'legendary' || (stp.rarity === 'set' && !set) ? Object.values(LEGENDARIES).find((x) => x.base === b) : undefined;
      const rarity: Rarity = set ? 'set' : leg ? 'legendary' : stp.rarity === 'normal' || stp.rarity === 'magic' ? stp.rarity : 'rare';
      const it = generateItem(new Rng(i * 131 + b.length), { ilvl: stp.ilvl, classId: set?.classId ?? cls, rarity, base: b, set: set?.id, legendary: leg?.id, ancientAllowed: false });
      it.ancient = stp.ancient ?? 0; it.upgrade = stp.upgrade ?? 0;
      const url = itemIconUrl(gearLook(it), it.kind as ItemKind, 64);
      const d = document.createElement('div');
      const rc = ({ normal: '#777', magic: '#6969ff', rare: '#e8d83a', legendary: '#bf642f', set: '#2fd048' } as Record<Rarity, string>)[it.rarity];
      d.innerHTML = `<div style="width:80px;height:80px;margin:auto;background:radial-gradient(#2a2119,#120d0a);border:1px solid ${rc};display:flex;align-items:center;justify-content:center">${url ? `<img src="${url}" width=76 height=76>` : ''}</div>`;
      wrap.appendChild(d);
    });
  }
}

let drawCalls = 0, drawCallsShown = 0;
function perfView() {
  mapView();
  const map = generateMap('whispering_glade', 99);
  const fam = Object.values(MONSTERS).filter((m) => m.themes.includes('glade'));
  const scr = app.screen;
  const cx = (scr.width / 2 - world.x) / ZOOM, cy = (scr.height / 2 - world.y) / ZOOM;
  const ents = world.children[2] as Container;
  const NMON = Number(qs.get('monsters') ?? (qs.get('nomon') ? 0 : 150)), NPLAY = Number(qs.get('players') ?? (qs.get('noplayers') ? 0 : 20));
  for (let i = 0; i < NMON; i++) {
    const m = fam[i % fam.length];
    const x = cx + (Math.random() - 0.5) * scr.width / ZOOM * 0.95, y = cy + (Math.random() - 0.5) * scr.height / ZOOM * 0.9;
    const el = (i % 17 === 0 ? 1 : i % 29 === 0 ? 2 : 0) as EliteTier;
    const v = createMonsterView(m.id, el, el ? ['frozen'] : [], m.scale);
    const a = addActor(v, x, y, st({ moving: i % 2 === 0, vx: 90, facingLeft: i % 3 === 0, flags: i % 2 === 0 ? F_MOVING : F_ATTACK }), 0.9, ents, i % 5 === 0 ? 0.6 : 0);
    v.root.zIndex = y; void a;
  }
  for (let i = 0; i < NPLAY; i++) {
    const c = CLASS_IDS[i % 3];
    const gearStage = qs.get('gear') as ShowcaseStage | 'mix' | null;
    const mixStages: ShowcaseStage[] = ['starter', 'L30', 'L60', 'L70', 'set', 'ancient', 'primal'];
    const v = createPlayerView(gearStage ? stageLook(c, gearStage === 'mix' ? mixStages[i % mixStages.length] : gearStage, i) : i % 2 ? randomLook(c, 'rare', i) : legendLook(c));
    const spread = NPLAY > 40 ? 1.9 : 1;
    const x = cx + (Math.random() - 0.5) * 900 * spread, y = cy + (Math.random() - 0.5) * 500 * spread;
    const mode = i % 4;
    addActor(v, x, y, st(mode === 1 ? { flags: F_ATTACK } : { moving: true, vx: 200, flags: F_MOVING | (mode === 0 ? F_CHANNEL : 0) }), mode === 1 ? 2.5 : 1.2, ents);
    v.root.zIndex = y;
  }
  void map;
  const gl = (app.renderer as unknown as { gl?: WebGL2RenderingContext }).gl;
  if (gl) {
    const de = gl.drawElements.bind(gl), da = gl.drawArrays.bind(gl);
    gl.drawElements = (...a: Parameters<typeof de>) => { drawCalls++; de(...a); };
    gl.drawArrays = (...a: Parameters<typeof da>) => { drawCalls++; da(...a); };
  }
}

/** Mimics Scene's lifecycle: die() → update()+hit() every frame → done() destroys synchronously. */
function lifecycleStress() {
  const ids = Object.keys(MONSTERS);
  let spawned = 0, finished = 0, doubleDone = 0;
  const live: { v: EntityView; x: number; y: number; dying: boolean; doneCalls: number; dead: boolean; t: number; el: number }[] = [];
  const spawn = () => {
    const id = ids[spawned % ids.length];
    const el = spawned % 7;
    let v: EntityView;
    const kind = spawned % 5;
    if (kind === 0) v = createPlayerView(randomLook(CLASS_IDS[spawned % 3], 'legendary', spawned));
    else if (kind === 1) v = createSummonView(['sentry', 'hydra', 'wolf', 'bat', 'raven', 'dust_devil', 'molten_pool'][spawned % 7]);
    else if (kind === 2) v = createNpcView('dummy', spawned % 2 ? 'Training Dummy' : 'Elite Training Dummy');
    else v = createMonsterView(id, (spawned % 6) as EliteTier, ['molten'], MONSTERS[id].scale);
    const e = { v, x: 60 + (spawned % 12) * 70, y: 100 + Math.floor((spawned % 60) / 12) * 80, dying: false, doneCalls: 0, dead: false, t: 0, el };
    v.root.position.set(e.x, e.y);
    world.addChild(v.root);
    // half of them die before their first update
    if (spawned % 2 === 0) { e.dying = true; v.die(el, () => { e.doneCalls++; if (e.doneCalls > 1) doubleDone++; if (!e.dead) { e.dead = true; v.root.parent?.removeChild(v.root); v.destroy(); finished++; } }); }
    live.push(e);
    spawned++;
  };
  let time = 0;
  app.ticker.add((tk) => {
    const dt = Math.min(0.05, tk.deltaMS / 1000);
    time += dt;
    for (let i = 0; i < 6; i++) spawn();
    for (const e of live) {
      if (e.dead) continue;
      e.t += dt;
      if (!e.dying && e.t > 0.1) { e.dying = true; e.v.die(e.el, () => { e.doneCalls++; if (e.doneCalls > 1) doubleDone++; if (!e.dead) { e.dead = true; e.v.root.parent?.removeChild(e.v.root); e.v.destroy(); finished++; } }); }
      e.v.update(dt, { x: e.x, y: e.y, vx: 0, vy: 0, moving: true, facingLeft: false, flags: F_ATTACK | F_MOVING, attackSeq: Math.floor(e.t * 3), hpFrac: 0, time, aps: 1 });
      if (!e.dead) { e.v.hit(1, true); e.v.update(0, { x: e.x, y: e.y, vx: 0, vy: 0, moving: false, facingLeft: true, flags: 0, attackSeq: 0, hpFrac: 0, time, aps: 1 }); }
      // the scene may still hold a reference and poke a destroyed view
      if (e.dead && Math.random() < 0.1) { e.v.hit(1, false); e.v.update(dt, { x: 0, y: 0, vx: 0, vy: 0, moving: false, facingLeft: false, flags: 0, attackSeq: 0, hpFrac: 0, time, aps: 1 }); }
    }
    for (let i = live.length - 1; i >= 0; i--) if (live[i].dead && Math.random() < 0.05) live.splice(i, 1);
    (window as unknown as { __stress: string }).__stress = `spawned ${spawned} finished ${finished} doubleDone ${doubleDone} alive ${live.filter((e) => !e.dead).length}`;
  });
  world.scale.set(1);
}

switch (VIEW) {
  case 'stress': lifecycleStress(); break;
  case 'perf': perfView(); break;
  case 'bake': bakeTest(); break;
  case 'sheets': sheetsView(); break;
  case 'chars': charsView(); break;
  case 'npcs': npcsView(); break;
  case 'quest-objects': questObjectsView(); break;
  case 'closeup': closeupView(); break;
  case 'monsters': monstersView(); break;
  case 'objects': objectsView(); break;
  case 'icons': iconsView(); break;
  case 'map': mapView(); break;
  case 'turntable': turntableView(); break;
  case 'turn': turnView(); break;
  case 'walk8': walk8View(); break;
  case 'whirl': whirlView(); break;
  case 'skills': skillsView(); break;
  case 'rapid': rapidView(); break;
  case 'mon2': mon2View(); break;
  case 'gear-ladder': gearLadderView(); break;
  case 'gear-vs': gearVsView(); break;
  case 'gear-sets': gearSetsView(); break;
  case 'gear-icons': gearIconsView(); break;
}

let time = 0;
let frames = 0, acc = 0, fps = 0;
let updMs = 0, heroUpdMs = 0;
const updWin: number[] = [], heroWin: number[] = [];
app.ticker.add(() => { drawCallsShown = drawCalls; drawCalls = 0; }, undefined, -100);
app.ticker.add((tk) => {
  const dt = Math.min(0.05, tk.deltaMS / 1000) * Number(qs.get('slow') ?? 1);
  time += dt;
  frames++; acc += tk.deltaMS;
  if (acc > 500) { fps = Math.round(frames * 1000 / acc); frames = 0; acc = 0; }
  const tu0 = performance.now();
  let heroMs = 0;
  for (const a of actors) {
    const isHero = a.view instanceof PlayerArt;
    const th0 = isHero ? performance.now() : 0;
    const o = a.state(time);
    if (time > a.next) { a.seq++; a.next = time + 1 / a.aps; }
    if (a.hitEvery && time > (a.nextHit ?? 0)) { a.view.hit(0.6, false); a.nextHit = time + a.hitEvery; }
    a.view.update(dt, {
      x: a.x, y: a.y, vx: o.vx ?? 0, vy: o.vy ?? 0, moving: o.moving ?? false, facingLeft: o.facingLeft ?? false,
      flags: o.flags ?? 0, attackSeq: (o.flags ?? 0) & (F_ATTACK | F_FROZEN) ? a.seq : (o.attackSeq ?? 0), hpFrac: 1, time, aps: a.aps,
    });
    if (isHero) heroMs += performance.now() - th0;
  }
  updWin.push(performance.now() - tu0); heroWin.push(heroMs);
  if (updWin.length > 60) { updWin.shift(); heroWin.shift(); }
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1] ?? 0;
  updMs = med(updWin); heroUpdMs = med(heroWin);
  hud.textContent = qs.get('nohud') ? '' : `${VIEW}  ${fps} fps  draws/frame ${drawCallsShown}  actors ${actors.length}  update ${updMs.toFixed(2)} ms (heroes ${heroUpdMs.toFixed(2)} ms)  gearfx ${gearFxStats.heroes}/${gearFxStats.sprites}  ${mapInfo}`;
  (window as unknown as { __info: string }).__info = `${fps} fps, draws/frame ${drawCallsShown}, actors ${actors.length}, update ${updMs.toFixed(2)} ms (heroes ${heroUpdMs.toFixed(2)} ms) ${mapInfo}`;
});
(window as unknown as { __pages: unknown }).__pages = bakedPages;
(window as unknown as { __ready: boolean; __info: string }).__ready = true;
(window as unknown as { __info: string }).__info = mapInfo;
