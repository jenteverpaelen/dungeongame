// Shared terrain painting for the local map and minimap.
import { T_FLOOR,T_PATH,T_PLAZA,T_VOID,T_WALL,T_WATER,isBlockedTile,type MapData } from '@shared/mapgen';
import { TILE } from '@shared/constants';

type RGB = [number, number, number];
interface Palette { floor: RGB; path: RGB; plaza: RGB; wall: RGB; water: RGB; void: RGB; rim: RGB }

const PALETTES: Record<string, Palette> = {
  glade: { floor: [78, 112, 58], path: [150, 124, 80], plaza: [150, 146, 130], wall: [18, 30, 17], water: [40, 92, 134], void: [5, 7, 5], rim: [128, 176, 92] },
  ashen: { floor: [92, 72, 68], path: [136, 104, 78], plaza: [122, 110, 102], wall: [18, 12, 12], water: [220, 88, 26], void: [5, 4, 4], rim: [196, 100, 52] },
  town: { floor: [92, 120, 64], path: [160, 132, 86], plaza: [146, 138, 120], wall: [26, 38, 20], water: [50, 104, 142], void: [5, 6, 5], rim: [150, 186, 104] },
};

export const BAKE_PX = 16;  // pixels per tile in the baked canvas

export interface Baked { map: MapData; key: string; canvas: HTMLCanvasElement }
export const mapKey = (m: MapData) => `${m.zone}:${m.seed}:${m.w}x${m.h}`;

export function bakeMapTerrain(map: MapData): Baked {
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

