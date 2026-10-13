// Top-right cluster: zone plate, round bronze minimap (tiles baked once per map into an offscreen canvas,
// entities drawn at 20 Hz in town, ~30 Hz elsewhere) and the rift progress bar.

import { useEffect, useRef, useState } from 'preact/hooks';
import { useUI, worldReader, type MinimapEntity } from '../store';
import { DIFFICULTIES } from '@shared/progression';
import { TILE } from '@shared/constants';
import { clamp01, fmtClock, safeGet, safeSet } from './util';
import { QuestTracker } from '../panels/questTracker';
import { contactSpot, questCategory, questMarker, questObjective, questPoint, trackedQuest, trackerQuests } from '@shared/quests';
import { paintQuestMark, type MarkCat } from '../../render/art/questBadges';
import { boardState, boardUnlocked, boardComplete, bountyDef, BOUNTY_BOARDS } from '@shared/bounties';
import { ui, togglePanel } from '../store';
import { questText } from '@shared/data/questMessages';

const SIZE = 440;
const ZOOMS = [520, 800, 1250];
import { BAKE_PX, mapKey, bakeMapTerrain, type Baked } from '../mapTerrain';

// ───────────────────────── icon painters (canvas px, origin at the marker centre) ─────────────────────────

export function dot(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, halo?: string) {
  if (halo) { g.fillStyle = halo; g.beginPath(); g.arc(x, y, r + 3, 0, 6.2832); g.fill(); }
  g.fillStyle = fill;
  g.strokeStyle = 'rgba(0,0,0,.85)';
  g.lineWidth = 1.6;
  g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); g.stroke();
}

export function skull(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(255,40,30,.28)'; g.beginPath(); g.arc(0, 0, 1.5, 0, 6.2832); g.fill();
  g.fillStyle = '#e8584a'; g.strokeStyle = '#1a0504'; g.lineWidth = 0.22;
  g.beginPath(); g.arc(0, -0.1, 0.85, 0, 6.2832); g.fill(); g.stroke();
  g.beginPath(); g.rect(-0.45, 0.45, 0.9, 0.62); g.fill(); g.stroke();
  g.fillStyle = '#1a0504';
  g.beginPath(); g.arc(-0.33, -0.1, 0.24, 0, 6.2832); g.arc(0.33, -0.1, 0.24, 0, 6.2832); g.fill();
  g.fillRect(-0.04, 0.2, 0.08, 0.3);
  g.restore();
}

export function diamond(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.fillStyle = fill; g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill(); g.stroke();
}

export function npcIcon(g: CanvasRenderingContext2D, role: string, x: number, y: number) {
  switch (role) {
    case 'blacksmith': case 'jeweler': case 'mystic':
      dot(g, x, y, 6, role === 'blacksmith' ? '#dca877' : role === 'jeweler' ? '#77dfc1' : '#c6a2ee');
      g.fillStyle = '#172029'; g.fillText(role[0].toUpperCase(), x, y + 3); break; // font set once by the caller
    case 'cube': diamond(g, x, y, 6, '#e0b45a'); diamond(g, x, y, 2.4, '#fff1c0'); break;
    case 'obelisk': diamond(g, x, y, 6.4, '#a56bff'); diamond(g, x, y, 2.4, '#e9d6ff'); break;
    case 'waypoint':
      g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 4.2; g.beginPath(); g.arc(x, y, 5, 0, 6.2832); g.stroke();
      g.strokeStyle = '#6fc4ff'; g.lineWidth = 2.2; g.beginPath(); g.arc(x, y, 5, 0, 6.2832); g.stroke();
      break;
    case 'stash': g.fillStyle = '#c99a50'; g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 1.5; g.fillRect(x - 5, y - 3.4, 10, 7); g.strokeRect(x - 5, y - 3.4, 10, 7); g.fillStyle = '#5a3a14'; g.fillRect(x - 5, y - 0.6, 10, 1.6); break;
    case 'paragon': {
      g.fillStyle = '#9fb4ff'; g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 1.4;
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -1.5708 + i * 0.6283, r = i % 2 ? 2.8 : 6.4; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.closePath(); g.fill(); g.stroke();
      break;
    }
    case 'healer': g.fillStyle = '#ff6a6a'; g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 1.4; g.fillRect(x - 5, y - 1.8, 10, 3.6); g.fillRect(x - 1.8, y - 5, 3.6, 10); break;
    case 'vendor': dot(g, x, y, 4.6, '#f0c85a'); break;
    default: break; // training dummies etc. stay off the map
  }
}

export function portalIcon(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 4.4; g.beginPath(); g.ellipse(x, y, 4.4, 6.4, 0, 0, 6.2832); g.stroke();
  g.strokeStyle = `rgba(${150 + 40 * Math.sin(t * 3) | 0},170,255,1)`; g.lineWidth = 2.4; g.beginPath(); g.ellipse(x, y, 4.4, 6.4, 0, 0, 6.2832); g.stroke();
}

export function meArrow(g: CanvasRenderingContext2D, x: number, y: number, heading: number) {
  g.save(); g.translate(x, y); g.rotate(heading + 1.5708);
  g.scale(1.35, 1.35);
  g.fillStyle = 'rgba(242,213,140,.22)'; g.beginPath(); g.arc(0, 0, 14, 0, 6.2832); g.fill();
  g.beginPath(); g.moveTo(0, -11); g.lineTo(7.6, 8); g.lineTo(0, 3.6); g.lineTo(-7.6, 8); g.closePath();
  g.fillStyle = '#f6d98a'; g.strokeStyle = '#1b1008'; g.lineWidth = 2.4; g.lineJoin = 'round';
  g.stroke(); g.fill();
  g.beginPath(); g.moveTo(0, -8); g.lineTo(0, 3.6); g.lineTo(-5, 6); g.closePath();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
  g.restore();
}

function drawMinimap(g: CanvasRenderingContext2D, baked: Baked | null, ents: Iterable<MinimapEntity>, me: { x: number; y: number } | null, heading: number, zoomIdx: number, t: number) {
  const W = SIZE, C = W / 2;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, W);
  // The NPC letters' font, set outside save()/restore() so it persists: assigning ctx.font resolves the document's style
  // (1.3 ms per paint during fights, ~15 ms on a 4× slower CPU), so it is assigned only when the context lacks it.
  if (g.font !== fontSet.get(g)) { g.font = MM_FONT; fontSet.set(g, g.font); }
  g.textAlign = 'center';
  g.save();
  g.beginPath(); g.arc(C, C, C, 0, 6.2832); g.clip();
  g.fillStyle = '#060504'; g.fillRect(0, 0, W, W);
  if (!baked || !me) { g.restore(); return; }

  const rad = ZOOMS[zoomIdx];
  const s = C / rad; // canvas px per world unit
  const k = s * (TILE / BAKE_PX); // baked px -> canvas px
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  // Blit only the visible part of the baked map: drawing the whole canvas (up to 2,560 x 2,048 px in the rebuilt zones)
  // through a transform every frame was the minimap's main cost.
  const ox = (me.x / TILE) * BAKE_PX, oy = (me.y / TILE) * BAKE_PX, half = C / k;
  const sx = Math.max(0, ox - half), sy = Math.max(0, oy - half);
  const ex = Math.min(baked.canvas.width, ox + half), ey = Math.min(baked.canvas.height, oy + half);
  if (ex > sx && ey > sy) g.drawImage(baked.canvas, sx, sy, ex - sx, ey - sy, C + (sx - ox) * k, C + (sy - oy) * k, (ex - sx) * k, (ey - sy) * k);

  const px = (x: number) => C + (x - me.x) * s;
  const py = (y: number) => C + (y - me.y) * s;
  const edge = C - 12;
  const clampTo = (x: number, y: number): [number, number, boolean] => {
    const dx = x - C, dy = y - C, d = Math.hypot(dx, dy);
    return d > edge ? [C + (dx / d) * edge, C + (dy / d) * edge, true] : [x, y, false];
  };

  // static map features (quest point and markers only change with the character, so they are cached per save object)
  const save=ui.get().char;
  const q = questInfo(baked, save);
  // Every tracked quest's objective in this zone (small, category colour), the focused one large and clamped to the rim.
  for (const o of q.objectives) { const x = px(o.x), y = py(o.y); if ((x - C) ** 2 + (y - C) ** 2 <= (C - 8) ** 2) g.drawImage(markCanvas(o.cat, '◆'), x - 9, y - 9, 18, 18); }
  for (const p of q.points) { const [x, y] = clampTo(px(p.x), py(p.y)); g.drawImage(markCanvas(q.pointCat, '◆'), x - 13, y - 13, 26, 26); }
  const r2 = (C + 12) * (C + 12);
  for (const n of baked.map.npcs) { const x = px(n.x), y = py(n.y); if ((x - C) ** 2 + (y - C) ** 2 <= r2) npcIcon(g, n.role, x, y); }
  for (const m of q.markers) { const x = px(m.x), y = py(m.y) - 12; if ((x - C) ** 2 + (y - C) ** 2 <= r2) g.drawImage(markCanvas(m.cat, m.glyph), x - 12, y - 12, 24, 24); }
  for (const p of baked.map.portals) { const [x, y, off] = clampTo(px(p.x), py(p.y)); if (!off) portalIcon(g, x, y, t); }

  // dynamic entities, drawn in priority order (cheap first)
  const mobs: MinimapEntity[] = [], specials: MinimapEntity[] = [];
  for (const e of ents) {
    if (e.me) continue;
    if (e.k === 'mob') (e.el && e.el > 0 ? specials : mobs).push(e);
    else specials.push(e);
  }
  // the same strokes as dot(g, x, y, 3.2, '#d8453a') per monster, with the shared styles set once (crowds: dozens of dots)
  g.fillStyle = '#d8453a'; g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 1.6;
  for (const e of mobs) {
    const x = px(e.x), y = py(e.y);
    if ((x - C) ** 2 + (y - C) ** 2 > C * C) continue;
    g.beginPath(); g.arc(x, y, 3.2, 0, 6.2832); g.fill(); g.stroke();
  }
  for (const e of specials) {
    const [x, y, off] = clampTo(px(e.x), py(e.y));
    if (e.k === 'mob') {
      if (e.el === 4) { skull(g, x, y, off ? 6 : 9); continue; }
      if (off) continue;
      if (e.el === 1) dot(g, x, y, 4.6, '#7b9bff', 'rgba(110,140,255,.28)');
      else if (e.el === 2) dot(g, x, y, 4.8, '#ffd24a', 'rgba(255,210,74,.3)');
      else if (e.el === 3) dot(g, x, y, 3.2, '#e0b85a');
      else if (e.el === 5) { diamond(g, x, y, 5.4, '#ffe26a'); }
      else dot(g, x, y, 3.2, '#d8453a');
    } else if (e.k === 'player') {
      if (!off) dot(g, x, y, 4, '#58b0ff', 'rgba(88,176,255,.25)');
    } else if (e.k === 'portal') {
      if (!off) portalIcon(g, x, y, t);
    } else if (e.k === 'loot' || e.k.startsWith('loot')) {
      if (off) continue;
      if (e.el === 4 || e.k.includes('set')) diamond(g, x, y, 5.2, '#4fe05a');
      else if (e.el === 3 || e.k.includes('legend')) diamond(g, x, y, 5.6, '#ff8a3a');
    }
  }

  meArrow(g, C, C, heading);
  g.restore();

  // soft vignette into the ring (gradient built once per context)
  let v = vignettes.get(g);
  if (!v) { v = g.createRadialGradient(C, C, C * 0.62, C, C, C); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); vignettes.set(g, v); }
  g.fillStyle = v;
  g.beginPath(); g.arc(C, C, C, 0, 6.2832); g.fill();
}

const vignettes = new WeakMap<CanvasRenderingContext2D, CanvasGradient>();
const MM_FONT = 'bold 8px Arial';
/** The font value each context reported after MM_FONT was assigned (the browser's serialisation of it). */
const fontSet = new WeakMap<CanvasRenderingContext2D, string>();
/** Quest marks are painted once per category and glyph (setting ctx.font per marker every frame forces style work). */
const marks = new Map<string, HTMLCanvasElement>();
export function markCanvas(cat: MarkCat, glyph: string): HTMLCanvasElement {
  const key = cat + glyph; let c = marks.get(key);
  if (!c) { c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d')!; g.translate(24, 24); paintQuestMark(g, cat, glyph, 20); marks.set(key, c); }
  return c;
}
interface QuestInfo { key: unknown; mapKey: string; points: { x: number; y: number }[]; pointCat: MarkCat; markers: { x: number; y: number; cat: MarkCat; glyph: string }[]; objectives: { x: number; y: number; cat: MarkCat }[] }
let questCache: QuestInfo | null = null;
/** Focused objective, every tracked objective in this zone, contact marks and bounty targets; recomputed only when the
 *  character save object or the map changes. */
export function questInfo(baked: Baked, save: ReturnType<typeof ui.get>['char']): QuestInfo {
  if (questCache && questCache.key === save && questCache.mapKey === baked.key) return questCache;
  const map = baked.map, zone = map.zone;
  const quest = save ? trackedQuest(save) : null, focusObj = save && quest ? questObjective(save, quest) : null;
  // Every remaining target of the focused step (the trail leads to the nearest); another zone's step marks its exit once.
  const points: QuestInfo['points'] = [];
  if (save && focusObj) for (const t of focusObj.targets ?? [focusObj.target]) {
    const p = questPoint(map, { zone: focusObj.zone, target: t }, save);
    if (p && !points.some((q) => q.x === p.x && q.y === p.y)) points.push({ x: p.x, y: p.y });
  }
  const markers: QuestInfo['markers'] = [], objectives: QuestInfo['objectives'] = [];
  if (save) {
    for (const n of map.npcs) {
      // Phased contacts stand where this player sees them (docs/rework/quests/DESIGN.md §4).
      const spot = contactSpot(map.adventure, n.id, save); if (spot && !spot.present) continue;
      const x = spot?.x ?? n.x, y = spot?.y ?? n.y;
      if (n.id === 'bounty_board') { if (boardUnlocked(save, zone)) markers.push({ x, y, cat: 'bounty', glyph: boardComplete(boardState(save, zone)) ? '!' : '' }); continue; }
      const m = questMarker(save, zone, n.id); if (m) markers.push({ x, y, cat: m.cat, glyph: m.glyph });
    }
    for (const q of trackerQuests(save, zone).slice(0, 5)) {
      if (q === quest) continue;
      const o = questObjective(save, q); if (o.zone !== zone) continue;
      for (const t of o.targets ?? [o.target]) { const p = questPoint(map, { zone, target: t }, save); if (p) objectives.push({ x: p.x, y: p.y, cat: questCategory(q) }); }
    }
    if (BOUNTY_BOARDS[zone] && boardUnlocked(save, zone)) {
      const b = boardState(save, zone);
      b.picks.forEach((id, i) => { const d = bountyDef(zone, id); if (!d || b.done & (1 << i) || d.kind === 'hunt') return; const p = questPoint(map, { zone, target: d.target }, save); if (p) objectives.push({ x: p.x, y: p.y, cat: 'bounty' }); });
    }
  }
  questCache = { key: save, mapKey: baked.key, points, pointCat: quest ? questCategory(quest) : 'story', markers, objectives };
  return questCache;
}

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(() => {
    const z = Number(safeGet('hearthfall.minimapZoom'));
    return z >= 0 && z < ZOOMS.length ? z : 1;
  });
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    let raf = 0;
    let baked: Baked | null = null;
    let heading = -Math.PI / 2;
    let lastPaint = -Infinity;
    let last: { x: number; y: number } | null = null;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const wr = worldReader.current;
      const map = wr?.map() ?? null;
      if (map && baked?.key !== mapKey(map)) { baked = bakeMapTerrain(map); lastPaint = -Infinity; }
      else if (!map) baked = null;
      const me = wr?.myPos() ?? null;
      if (me) {
        if (last) {
          const dx = me.x - last.x, dy = me.y - last.y;
          if (dx * dx + dy * dy > 0.25) {
            const target = Math.atan2(dy, dx);
            let d = target - heading;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            heading += d * 0.22;
          }
        }
        last = { x: me.x, y: me.y };
      }
      // Snapshots arrive at 20 Hz: repaint the town at 20 Hz and other zones at ~30 Hz (heading is still sampled every
      // frame above). Repainting at the display rate (up to 165 Hz) cost ~3 ms per frame in the rebuilt zones.
      if (now - lastPaint < (map?.town ? 50 : 33)) return;
      lastPaint = now;
      drawMinimap(g, baked, wr ? wr.entities() : [], me, heading, zoomRef.current, now / 1000);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const next = Math.max(0, Math.min(ZOOMS.length - 1, zoomRef.current + (e.deltaY > 0 ? 1 : -1)));
    setZoom(next);
    safeSet('hearthfall.minimapZoom', String(next));
  };

  return (
    <div class="minimap interactive" onWheel={onWheel}>
      <div class="mm-disc"><canvas ref={ref} width={SIZE} height={SIZE} /></div>
      <div class="mm-ring" />
      <i class="mm-stud n" /><i class="mm-stud e" /><i class="mm-stud s" /><i class="mm-stud w" />
      <span class="mm-n">N</span>
    </div>
  );
}

export function ZonePlate() {
  const zone = useUI((s) => s.zone);
  const rift = useUI((s) => s.rift);
  if (!zone) return null;
  const inRift = zone.kind === 'rift';
  const diff = DIFFICULTIES[inRift && rift ? rift.difficulty : zone.difficulty]?.name ?? '';
  return (
    <div class="zone-plate">
      <div class="zp-name">{zone.name}</div>
      <div class="zp-sub">
        {!inRift && <span>{zone.kind==='dungeon'?questText('quest.pump.solo'):zone.kind==='field'?'Private field':`Channel ${zone.channel}`}</span>}
        {inRift && rift && <span class="zp-clock">{fmtClock(rift.elapsedMs)}</span>}
        {diff && <span class="zp-diff">{diff}</span>}
      </div>
    </div>
  );
}

export function RiftBar() {
  const rift = useUI((s) => s.rift);
  if (!rift) return null;
  const pct = clamp01(rift.progress / 100);
  const guardian = rift.phase === 'guardian';
  const done = rift.phase === 'done';
  return (
    <div class={`rift-bar${guardian ? ' guardian' : ''}${done ? ' done' : ''}`}>
      <div class="rb-head">
        <span class="rb-title">{done ? 'Faultline cleared' : guardian ? 'Faultline Keeper!' : 'Faultline progress'}</span>
        {!guardian && !done && <span class="rb-pct">{Math.floor(rift.progress)}%</span>}
        {(guardian || done) && <span class="rb-lv">Lv {rift.level}</span>}
      </div>
      <div class="rb-track">
        <div class="rb-fill" style={{ width: `${((guardian || done ? 1 : pct) * 100).toFixed(2)}%` }}><i /></div>
        <div class="rb-ticks" />
      </div>
    </div>
  );
}

export function TopRight() {
  return (
    <div class="hud-topright">
      <ZonePlate />
      <Minimap />
      <RiftBar />
      <QuestTracker />
    </div>
  );
}
