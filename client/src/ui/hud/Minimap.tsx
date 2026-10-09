// Top-right cluster: zone plate, round bronze minimap (tiles baked once per map into an offscreen canvas,
// entities drawn at 20 Hz in town, every frame elsewhere) and the rift progress bar.

import { useEffect, useRef, useState } from 'preact/hooks';
import { useUI, worldReader, type MinimapEntity } from '../store';
import { DIFFICULTIES } from '@shared/progression';
import { T_FLOOR, T_PATH, T_PLAZA, T_VOID, T_WALL, T_WATER, isBlockedTile, type MapData } from '@shared/mapgen';
import { TILE } from '@shared/constants';
import { clamp01, fmtClock, safeGet, safeSet } from './util';
import { AdventureTracker } from '../panels/adventure';
import { questObjective, questPoint, trackedQuest } from '@shared/quests';
import { ui } from '../store';

type RGB = [number, number, number];
interface Palette { floor: RGB; path: RGB; plaza: RGB; wall: RGB; water: RGB; void: RGB; rim: RGB }

const PALETTES: Record<string, Palette> = {
  glade: { floor: [78, 112, 58], path: [150, 124, 80], plaza: [150, 146, 130], wall: [18, 30, 17], water: [40, 92, 134], void: [5, 7, 5], rim: [128, 176, 92] },
  ashen: { floor: [92, 72, 68], path: [136, 104, 78], plaza: [122, 110, 102], wall: [18, 12, 12], water: [220, 88, 26], void: [5, 4, 4], rim: [196, 100, 52] },
  town: { floor: [92, 120, 64], path: [160, 132, 86], plaza: [146, 138, 120], wall: [26, 38, 20], water: [50, 104, 142], void: [5, 6, 5], rim: [150, 186, 104] },
};

const BAKE_PX = 16;  // pixels per tile in the baked canvas
const SIZE = 440;    // minimap canvas resolution (CSS size is set by hud.css)
const ZOOMS = [520, 800, 1250]; // world-unit radius shown

interface Baked { map: MapData; key: string; canvas: HTMLCanvasElement }
const mapKey = (m: MapData) => `${m.zone}:${m.seed}:${m.w}x${m.h}`;

function bake(map: MapData): Baked {
  const pal = PALETTES[map.theme] ?? PALETTES.glade;
  const c = document.createElement('canvas');
  c.width = map.w * BAKE_PX;
  c.height = map.h * BAKE_PX;
  const g = c.getContext('2d')!;
  if(map.adventure) {
    g.scale(BAKE_PX/TILE,BAKE_PX/TILE);
    g.fillStyle='#243d48';g.fillRect(0,0,map.w*TILE,map.h*TILE);
    const poly=(points:number[][],fill:string)=>{g.beginPath();points.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fillStyle=fill;g.fill();};
    for(const f of map.adventure.geometry.floors)poly(f.polygon,'#69705a');
    for(const p of map.adventure.paths){g.beginPath();p.points.forEach((a,i)=>i?g.lineTo(a[0],a[1]):g.moveTo(a[0],a[1]));g.strokeStyle='#b49d70';g.lineWidth=p.width;g.stroke();}
    for(const b of map.adventure.geometry.buildings)poly(b.footprint,'#30383b');
    return {map,key:mapKey(map),canvas:c};
  }
  if (map.town) {
    g.scale(BAKE_PX / TILE, BAKE_PX / TILE);
    const poly = (points: number[][], fill: string) => {
      g.beginPath(); points.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
      g.fillStyle = fill; g.fill();
    };
    g.fillStyle='#2a3933';g.fillRect(0,0,map.w*TILE,map.h*TILE);
    for(const r of map.town.landscape??[])poly(r.polygon,r.kind==='water'?'#2e4a56':r.kind==='ash'?'#504b44':'#26382b');
    for (const f of map.town.floors) poly(f.polygon, '#777b6b');
    for (const b of map.town.buildings) poly(b.footprint, '#323b44');
    for(const b of map.town.buildings)for(const p of b.interior?.floors??[])poly(p,'#8c7a60');
    g.strokeStyle = '#b1bbc4';
    for (const b of map.town.barriers) { g.lineWidth = b.radius * 2; g.beginPath(); g.moveTo(...b.a); g.lineTo(...b.b); g.stroke(); }
    for (const p of map.town.props) { g.fillStyle = '#323b44'; g.beginPath(); g.arc(p.x, p.y, p.radius, 0, Math.PI * 2); g.fill(); }
    return { map, key: mapKey(map), canvas: c };
  }
  const colorOf = (t: number): RGB => (t === T_FLOOR ? pal.floor : t === T_PATH ? pal.path : t === T_PLAZA ? pal.plaza : t === T_WALL ? pal.wall : t === T_WATER ? pal.water : pal.void);
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const t = map.tiles[y * map.w + x];
      if (t === T_VOID) continue;
      const [r, gg, b] = colorOf(t);
      const n = (((x * 73856093) ^ (y * 19349663)) & 15) - 8; // stable per-tile grain
      const k = t === T_WALL || t === T_WATER ? 0.7 : 1.5;
      g.fillStyle = `rgb(${r + n * k | 0},${gg + n * k | 0},${b + n * k | 0})`;
      g.fillRect(x * BAKE_PX, y * BAKE_PX, BAKE_PX, BAKE_PX);
    }
  }
  // lit rim on the blocked side of every wall / water edge so the walkable shape reads clearly
  g.fillStyle = `rgba(${pal.rim[0]},${pal.rim[1]},${pal.rim[2]},.5)`;
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < map.w && y < map.h && !isBlockedTile(map.tiles[y * map.w + x]);
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      if (!isBlockedTile(map.tiles[y * map.w + x]) || map.tiles[y * map.w + x] === T_VOID) continue;
      const px = x * BAKE_PX, py = y * BAKE_PX;
      if (open(x, y - 1)) g.fillRect(px, py, BAKE_PX, 2.4);
      if (open(x, y + 1)) g.fillRect(px, py + BAKE_PX - 2.4, BAKE_PX, 2.4);
      if (open(x - 1, y)) g.fillRect(px, py, 2.4, BAKE_PX);
      if (open(x + 1, y)) g.fillRect(px + BAKE_PX - 2.4, py, 2.4, BAKE_PX);
    }
  }
  return { map, key: mapKey(map), canvas: c };
}

// ───────────────────────── icon painters (canvas px, origin at the marker centre) ─────────────────────────

function dot(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, halo?: string) {
  if (halo) { g.fillStyle = halo; g.beginPath(); g.arc(x, y, r + 3, 0, 6.2832); g.fill(); }
  g.fillStyle = fill;
  g.strokeStyle = 'rgba(0,0,0,.85)';
  g.lineWidth = 1.6;
  g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); g.stroke();
}

function skull(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
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

function diamond(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.fillStyle = fill; g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill(); g.stroke();
}

function npcIcon(g: CanvasRenderingContext2D, role: string, x: number, y: number) {
  switch (role) {
    case 'blacksmith': case 'jeweler': case 'mystic':
      dot(g, x, y, 6, role === 'blacksmith' ? '#dca877' : role === 'jeweler' ? '#77dfc1' : '#c6a2ee');
      g.font = 'bold 8px Arial'; g.fillStyle = '#172029'; g.textAlign = 'center'; g.fillText(role[0].toUpperCase(), x, y + 3); break;
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

function portalIcon(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 4.4; g.beginPath(); g.ellipse(x, y, 4.4, 6.4, 0, 0, 6.2832); g.stroke();
  g.strokeStyle = `rgba(${150 + 40 * Math.sin(t * 3) | 0},170,255,1)`; g.lineWidth = 2.4; g.beginPath(); g.ellipse(x, y, 4.4, 6.4, 0, 0, 6.2832); g.stroke();
}

function meArrow(g: CanvasRenderingContext2D, x: number, y: number, heading: number) {
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
  g.save();
  g.beginPath(); g.arc(C, C, C, 0, 6.2832); g.clip();
  g.fillStyle = '#060504'; g.fillRect(0, 0, W, W);
  if (!baked || !me) { g.restore(); return; }

  const rad = ZOOMS[zoomIdx];
  const s = C / rad; // canvas px per world unit
  const k = s * (TILE / BAKE_PX); // baked px -> canvas px
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.setTransform(k, 0, 0, k, C - (me.x / TILE) * BAKE_PX * k, C - (me.y / TILE) * BAKE_PX * k);
  g.drawImage(baked.canvas, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);

  const px = (x: number) => C + (x - me.x) * s;
  const py = (y: number) => C + (y - me.y) * s;
  const edge = C - 12;
  const clampTo = (x: number, y: number): [number, number, boolean] => {
    const dx = x - C, dy = y - C, d = Math.hypot(dx, dy);
    return d > edge ? [C + (dx / d) * edge, C + (dy / d) * edge, true] : [x, y, false];
  };

  // static map features
  const save=ui.get().char, adventure=baked.map.adventure;
  if(save && adventure) {
    const quest=trackedQuest(save);
    const point=quest&&questPoint(baked.map,questObjective(save,quest));
    if(point){const [x,y]=clampTo(px(point.x),py(point.y));diamond(g,x,y,7,'#ffdb83');}
  }
  for (const n of baked.map.npcs) npcIcon(g, n.role, px(n.x), py(n.y));
  for (const p of baked.map.portals) { const [x, y, off] = clampTo(px(p.x), py(p.y)); if (!off) portalIcon(g, x, y, t); }

  // dynamic entities, drawn in priority order (cheap first)
  const mobs: MinimapEntity[] = [], specials: MinimapEntity[] = [];
  for (const e of ents) {
    if (e.me) continue;
    if (e.k === 'mob') (e.el && e.el > 0 ? specials : mobs).push(e);
    else specials.push(e);
  }
  for (const e of mobs) {
    const x = px(e.x), y = py(e.y);
    if ((x - C) ** 2 + (y - C) ** 2 > C * C) continue;
    dot(g, x, y, 3.2, '#d8453a');
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

  // soft vignette into the ring
  const v = g.createRadialGradient(C, C, C * 0.62, C, C, C);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = v;
  g.beginPath(); g.arc(C, C, C, 0, 6.2832); g.fill();
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
      if (map && baked?.key !== mapKey(map)) { baked = bake(map); lastPaint = -Infinity; }
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
      // Town snapshots arrive at 20 Hz. Avoid repainting the full crowd between them;
      // keep heading sampling above at display cadence and field/rift behavior unchanged.
      if (map?.town && now - lastPaint < 50) return;
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
        {!inRift && <span>Channel {zone.channel}</span>}
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
        <span class="rb-title">{done ? 'Rift Cleared' : guardian ? 'Rift Guardian!' : 'Rift Progress'}</span>
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
      <AdventureTracker />
    </div>
  );
}
