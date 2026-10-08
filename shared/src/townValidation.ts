import { PLAYER_RADIUS } from './constants';
import { TownCollision } from './townCollision';
import { closest, inGround, inPolygon } from './townGeometry';
import type { Point, TownData } from './townTypes';

function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return side(a, b, c) * side(a, b, d) < -1e-6 && side(c, d, a) * side(c, d, b) < -1e-6;
}
export function validateTown(t: TownData): string[] {
  const errors: string[] = [], ids = new Set<string>();
  if (t.version !== 1 || t.id !== 'hearthmere') errors.push('unsupported town/version');
  const point = (p: Point, id: string) => { if (p.length !== 2 || !p.every(Number.isFinite) || p[0] < 0 || p[1] < 0 || p[0] > t.size[0] * 64 || p[1] > t.size[1] * 64) errors.push(`${id}: invalid/out-of-bounds point`); };
  const id = (s: string) => { if (ids.has(s)) errors.push(`duplicate id ${s}`); ids.add(s); };
  const polygon = (p: Point[], label: string) => {
    if (p.length < 3) errors.push(`${label}: too few vertices`);
    p.forEach(v => point(v, label));
    for (let i = 0; i < p.length; i++) for (let j = i + 2; j < p.length; j++) {
      if ((j + 1) % p.length === i) continue;
      if (crosses(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length])) errors.push(`${label}: self intersection`);
    }
  };
  for (const f of t.floors) { id(f.id); polygon(f.polygon, f.id); }
  for (const b of t.buildings) {
    id(b.id); polygon(b.footprint, b.id); b.baseline.forEach(p => point(p, b.id));
    if(b.interior){b.interior.floors.forEach(p=>polygon(p,b.id+' interior'));point(b.interior.target,b.id);}
    if (b.look) {
      if (!(b.look.eaveHeight > 0 && b.look.eaveHeight <= 320)) errors.push(`${b.id}: invalid eave height`);
      for (const v of b.look.roof.vertices) {
        point([v[0],v[1]], b.id);
        if (!(v[2] >= b.look.eaveHeight && v[2] <= 384)) errors.push(`${b.id}: invalid roof elevation`);
      }
      for (const face of b.look.roof.faces) if (face.length < 3 || face.some(i => !Number.isInteger(i) || !b.look!.roof.vertices[i])) errors.push(`${b.id}: invalid roof face`);
      const xs=b.footprint.map(p=>p[0]), bx=b.baseline.map(p=>p[0]);
      if (Math.min(...bx)>Math.min(...xs) || Math.max(...bx)<Math.max(...xs)) errors.push(`${b.id}: baseline does not cover footprint width`);
    }
    for (const d of b.doors) {
      id(d.id); [d.a, d.b, d.approach, d.inside].forEach(p => point(p, d.id));
      if (Math.hypot(d.a[0] - d.b[0], d.a[1] - d.b[1]) < PLAYER_RADIUS * 4) errors.push(`${d.id}: opening narrower than two player diameters`);
    }
  }
  for (let i = 0; i < t.buildings.length; i++) for (let j = i + 1; j < t.buildings.length; j++) {
    const a = t.buildings[i], b = t.buildings[j];
    if (a.footprint.some(p => inPolygon(...p, b.footprint)) || b.footprint.some(p => inPolygon(...p, a.footprint)) || a.footprint.some((p, k) => b.footprint.some((q, n) => crosses(p, a.footprint[(k + 1) % a.footprint.length], q, b.footprint[(n + 1) % b.footprint.length])))) errors.push(`${a.id}/${b.id}: overlapping footprints`);
    let gap = Infinity, mid: Point = [0, 0];
    for (const [one, two] of [[a.footprint, b.footprint], [b.footprint, a.footprint]]) for (const p of one) for (let k = 0; k < two.length; k++) {
      const q = two[k], r = two[(k + 1) % two.length];
      const c = closest(...p, { ax: q[0], ay: q[1], bx: r[0], by: r[1], nx: 0, ny: 0, radius: 0 });
      const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
      if (d < gap) { gap = d; mid = [(p[0] + c[0]) / 2, (p[1] + c[1]) / 2]; }
    }
    if (gap > .001 && gap < PLAYER_RADIUS * 4 && inGround(t, ...mid)) errors.push(`${a.id}/${b.id}: gap ${gap.toFixed(2)} u narrower than two player diameters`);
  }
  for (const b of t.barriers) { id(b.id); point(b.a, b.id); point(b.b, b.id); if (!(b.radius > 0)) errors.push(`${b.id}: invalid radius`); }
  for (const p of t.props) { id(p.id); point([p.x, p.y], p.id); if (!(p.radius > 0)) errors.push(`${p.id}: invalid radius`); }
  for (const n of t.npcs) { id(n.id); point([n.x, n.y], n.id); point(n.approach, n.id); if (!(n.r > 0) || !(n.interactionRadius >= 0)) errors.push(`${n.id}: invalid radius`); }
  for(const l of t.lights){id("lights:"+l.id);point(l.position,l.id);if(!(l.radius>0&&Number.isFinite(l.radius))||!Number.isInteger(l.color)||l.color<0||l.color>0xffffff||!(l.flicker>=0&&l.flicker<=1))errors.push(`${l.id}: invalid light`);}
  for(const e of t.emitters){id("emitters:"+e.id);point(e.position,e.id);if(!Number.isInteger(e.rate)||e.rate<0||e.rate>64)errors.push(`${e.id}: invalid particle pool size`);}
  for(const s of t.sounds){id("sounds:"+s.id);point(s.position,s.id);if(!(s.radius>0&&Number.isFinite(s.radius)))errors.push(`${s.id}: invalid sound radius`);}
  for(const r of t.landscape??[]){id("landscape:"+r.id);polygon(r.polygon,r.id);}
  for(const d of t.details??[]){id("details:"+d.id);point(d.position,d.id);if(!(d.width>0&&Number.isFinite(d.width)))errors.push(`${d.id}: invalid detail width`);}
  for(const v of t.villagers??[]){id("villagers:"+v.id);v.path.forEach(p=>point(p,v.id));if(v.path.length<2||!(v.speed>0&&Number.isFinite(v.speed))||!(v.pause>=0&&Number.isFinite(v.pause)))errors.push(`${v.id}: invalid patrol`);}
  if (errors.length) return errors;
  const world = new TownCollision(t), r = PLAYER_RADIUS;
  if (!world.isFree(t.entry.x, t.entry.y, r)) errors.push('entry blocked');
  for (const n of t.npcs) {
    if (!world.isFree(n.x, n.y, n.r, true)) errors.push(`${n.id}: body outside ground/inside solid`);
    if (!world.isFree(...n.approach, r)) errors.push(`${n.id}: approach blocked`);
  }
  for (const b of t.buildings) for (const d of b.doors) {
    const end = world.moveCircle(...d.approach, r, d.inside[0] - d.approach[0], d.inside[1] - d.approach[1]);
    if (Math.hypot(end.x - d.inside[0], end.y - d.inside[1]) > .01 || !world.isFree(...d.inside, r)) errors.push(`${d.id}: doorway blocked`);
  }
  for (const route of t.routes) for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i], end = world.moveCircle(...a, r, b[0] - a[0], b[1] - a[1]);
    if (!world.isFree(...a, r) || Math.hypot(end.x - b[0], end.y - b[1]) > .01) errors.push(`${route.label}: blocked segment ${i}`);
  }
  // Reachability is independent of the hand-authored route list: flood actual circle-clear ground.
  const step = 32, w = Math.ceil(t.size[0] * 64 / step), h = Math.ceil(t.size[1] * 64 / step);
  const seen = new Uint8Array(w * h), queue: number[] = [];
  const sx = Math.round(t.entry.x / step), sy = Math.round(t.entry.y / step);
  const start = world.moveCircle(t.entry.x, t.entry.y, r, sx * step - t.entry.x, sy * step - t.entry.y);
  if (Math.hypot(start.x - sx * step, start.y - sy * step) > .01) errors.push('entry cannot reach validation grid');
  else { seen[sy * w + sx] = 1; queue.push(sy * w + sx); }
  for (let head = 0; head < queue.length; head++) {
    const n = queue[head], x = n % w, y = Math.floor(n / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[k] || !world.isFree(nx * step, ny * step, r)) continue;
      const end = world.moveCircle(x * step, y * step, r, dx * step, dy * step);
      if (Math.hypot(end.x - nx * step, end.y - ny * step) < .01) { seen[k] = 1; queue.push(k); }
    }
  }
  for (const target of [...t.npcs.map(n => ({ id: n.id, p: n.approach })), ...t.portals.map(p => ({ id: p.to, p: [p.x, p.y] as Point })), ...t.buildings.filter(b=>b.interior).map(b=>({id:b.id+' interior',p:b.interior!.target}))]) {
    const sx = Math.round(target.p[0] / step), sy = Math.round(target.p[1] / step);
    let reachable = false;
    for (let y = sy - 1; y <= sy + 1; y++) for (let x = sx - 1; x <= sx + 1; x++) if (seen[y * w + x]) {
      const end = world.moveCircle(x * step, y * step, r, target.p[0] - x * step, target.p[1] - y * step);
      if (Math.hypot(end.x - target.p[0], end.y - target.p[1]) < .01) reachable = true;
    }
    if (!reachable) errors.push(`${target.id}: unreachable from entry`);
  }
  return errors;
}
