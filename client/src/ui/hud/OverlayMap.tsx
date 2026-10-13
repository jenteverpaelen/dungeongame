// Tab overlay map (owner 2026-10-13: "when pressing tab it should open like path of exile kind of a transparant map of the
// layout that ur in"). Path of Exile's overlay map and Diablo II's automap [K]: the zone's walkable outline drawn see-through
// over the game, centred on the hero, with the places that matter (quest marks, people, waypoints, portals, other players,
// elites and bosses); ordinary monsters stay off it, as in both references. Tab toggles it (game.ts).
import { useEffect, useRef } from 'preact/hooks';
import { useUI, worldReader, type MinimapEntity } from '../store';
import { TILE } from '@shared/constants';
import { isBlockedTile, type MapData } from '@shared/mapgen';
import { mapKey } from '../mapTerrain';
import { bakeMapTerrain } from '../mapTerrain';
import { diamond, dot, markCanvas, meArrow, npcIcon, portalIcon, questInfo, skull } from './Minimap';
import { ui } from '../store';

/** World units shown from the top to the bottom of the screen [P]: about four times the game view (826 units at 1080p). */
const VIEW_UNITS = 3400;
const OPX = 8; // baked overlay pixels per tile
const LINE = 'rgba(190, 228, 255, 0.92)', FILL = 'rgba(150, 196, 228, 0.14)', ROAD = 'rgba(240, 214, 160, 0.5)';
const WATER = 'rgba(90, 160, 210, 0.34)', CLIFF = 'rgba(40, 34, 30, 0.42)';

interface Outline { key: string; canvas: HTMLCanvasElement }

/** The see-through layout: a faint fill of walkable ground, light edges, roads, water and cliffs (baked once per map). */
function bakeOutline(map: MapData): Outline {
  const c = document.createElement('canvas');
  c.width = map.w * OPX; c.height = map.h * OPX;
  const g = c.getContext('2d')!;
  const k = OPX / TILE;
  g.lineJoin = 'round'; g.lineCap = 'round';
  const path = (pts: number[][]) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] * k, p[1] * k) : g.moveTo(p[0] * k, p[1] * k)); g.closePath(); };
  const area = map.adventure ?? null, town = map.town ?? null;
  if (area) {
    for (const f of area.geometry.floors) { path(f.polygon); g.fillStyle = FILL; g.fill(); g.strokeStyle = LINE; g.lineWidth = 2.2; g.stroke(); }
    for (const p of area.paths) { g.beginPath(); p.points.forEach((a, i) => i ? g.lineTo(a[0] * k, a[1] * k) : g.moveTo(a[0] * k, a[1] * k)); g.strokeStyle = ROAD; g.lineWidth = Math.max(2, p.width * k); g.stroke(); }
    for (const b of area.geometry.buildings) {
      const land = area.paint?.landscape.find((l) => l.polygon === b.footprint);
      path(b.footprint);
      g.fillStyle = b.hole ? (land?.kind === 'water' || land?.kind === 'deep' ? WATER : CLIFF) : 'rgba(30, 26, 22, 0.5)'; g.fill();
      g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke();
    }
  } else if (town) {
    for (const f of town.floors) { path(f.polygon); g.fillStyle = FILL; g.fill(); g.strokeStyle = LINE; g.lineWidth = 2.2; g.stroke(); }
    for (const r of town.ground ?? []) if (r.path && r.width && (r.kind === 'cobble' || r.kind === 'flag' || r.kind === 'dirt')) {
      g.beginPath(); r.path.forEach((p, i) => i ? g.lineTo(p[0] * k, p[1] * k) : g.moveTo(p[0] * k, p[1] * k)); g.strokeStyle = ROAD; g.lineWidth = Math.max(2, r.width * k); g.stroke();
    }
    for (const b of town.buildings) { path(b.footprint); g.fillStyle = 'rgba(30, 26, 22, 0.55)'; g.fill(); g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke(); }
  } else {
    // tile maps (rifts): walkable cells faint, a light line on every edge between walkable and blocked
    const open = (x: number, y: number) => x >= 0 && y >= 0 && x < map.w && y < map.h && !isBlockedTile(map.tiles[y * map.w + x]);
    g.fillStyle = FILL;
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (open(x, y)) g.fillRect(x * OPX, y * OPX, OPX, OPX);
    g.fillStyle = LINE;
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (!open(x, y)) continue;
      if (!open(x, y - 1)) g.fillRect(x * OPX, y * OPX, OPX, 1.6);
      if (!open(x, y + 1)) g.fillRect(x * OPX, (y + 1) * OPX - 1.6, OPX, 1.6);
      if (!open(x - 1, y)) g.fillRect(x * OPX, y * OPX, 1.6, OPX);
      if (!open(x + 1, y)) g.fillRect((x + 1) * OPX - 1.6, y * OPX, 1.6, OPX);
    }
  }
  return { key: mapKey(map), canvas: c };
}

export function OverlayMap() {
  const on = useUI((s) => s.overlayMap && s.screen === 'game');
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!on) return;
    const canvas = ref.current, g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    let raf = 0, outline: Outline | null = null, lastPaint = -Infinity, heading = -Math.PI / 2, last: { x: number; y: number } | null = null;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - lastPaint < 33) return; // ~30 Hz, as the minimap outside town
      lastPaint = now;
      const wr = worldReader.current, map = wr?.map() ?? null, me = wr?.myPos() ?? null;
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      if (!map || !me) return;
      if (outline?.key !== mapKey(map)) outline = bakeOutline(map);
      if (last) { const dx = me.x - last.x, dy = me.y - last.y; if (dx * dx + dy * dy > 0.25) heading = Math.atan2(dy, dx); }
      last = { x: me.x, y: me.y };
      const s = H / VIEW_UNITS, cx = W / 2, cy = H / 2;
      const px = (x: number) => cx + (x - me.x) * s, py = (y: number) => cy + (y - me.y) * s;
      const k = s * (TILE / OPX);
      g.imageSmoothingEnabled = true;
      g.drawImage(outline.canvas, px(0), py(0), outline.canvas.width * k, outline.canvas.height * k);
      g.font = 'bold 8px Arial'; g.textAlign = 'center';
      const baked = { map, key: mapKey(map), canvas: outline.canvas } as ReturnType<typeof bakeMapTerrain>;
      const q = questInfo(baked, ui.get().char);
      for (const o of q.objectives) g.drawImage(markCanvas(o.cat, '◆'), px(o.x) - 11, py(o.y) - 11, 22, 22);
      for (const p of q.points) g.drawImage(markCanvas(q.pointCat, '◆'), px(p.x) - 15, py(p.y) - 15, 30, 30);
      for (const n of map.npcs) npcIcon(g, n.role, px(n.x), py(n.y));
      for (const m of q.markers) g.drawImage(markCanvas(m.cat, m.glyph), px(m.x) - 13, py(m.y) - 25, 26, 26);
      for (const p of map.portals) portalIcon(g, px(p.x), py(p.y), now / 1000);
      for (const e of (wr ? wr.entities() : []) as Iterable<MinimapEntity>) {
        if (e.me) continue;
        const x = px(e.x), y = py(e.y);
        if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
        if (e.k === 'player') dot(g, x, y, 4.6, '#58b0ff', 'rgba(88,176,255,.3)');
        else if (e.k === 'portal') portalIcon(g, x, y, now / 1000);
        else if (e.k === 'mob' && e.el === 4) skull(g, x, y, 9);
        else if (e.k === 'mob' && e.el === 1) dot(g, x, y, 4.6, '#7b9bff', 'rgba(110,140,255,.3)');
        else if (e.k === 'mob' && e.el === 2) dot(g, x, y, 4.8, '#ffd24a', 'rgba(255,210,74,.3)');
        else if (e.k === 'mob' && e.el === 5) diamond(g, x, y, 5.4, '#ffe26a');
      }
      meArrow(g, cx, cy, heading);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); const c = ref.current?.getContext('2d'); c?.clearRect(0, 0, ref.current!.width, ref.current!.height); };
  }, [on]);
  if (!on) return null;
  return <canvas ref={ref} class="overlay-map" aria-hidden="true" />;
}
