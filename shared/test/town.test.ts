import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import goldens from './fixtures/field-maps.json';
import { generateMap } from '../src/mapgen';
import { CollisionWorld, stepMove, type MoveState } from '../src/movement';
import { TownCollision } from '../src/townCollision';
import { validateTown } from '../src/townValidation';
import type { TownData } from '../src/townTypes';
import { Rng } from '../src/math';

const map = () => generateMap('hearthmere', 42);
const fixture = (): TownData => ({ version: 1, id: 'hearthmere', stage: 'blockout', size: [16, 16], entry: { x: 100, y: 100 },
  floors: [{ id: 'left', kind: 'court', polygon: [[0, 0], [600, 0], [600, 1000], [0, 1000]] }, { id: 'right', kind: 'court', polygon: [[400, 0], [1000, 0], [1000, 1000], [400, 1000]] }],
  buildings: [], barriers: [], props: [], npcs: [], portals: [], districts: [], routes: [], lights: [], emitters: [], sounds: [] });

test('field/rift maps AND legacy movement match pre-town SHA256 fixtures', () => {
  const hash = (o: unknown) => createHash('sha256').update(JSON.stringify(o, (_, v) => v instanceof Uint8Array ? [...v] : v)).digest('hex');
  for (const g of goldens) {
    const m = generateMap(g.zone, g.seed, g.theme as 'glade' | 'ashen' | undefined), w = new CollisionWorld(m);
    assert.equal(hash(m), g.map, `${g.zone}/${g.seed}/${g.theme} geometry`);
    let p = { ...m.entry }; const points = [];
    for (let i = 0; i < 2000; i++) { p = w.moveCircle(p.x, p.y, 16, Math.cos(i * .17) * 68, Math.sin(i * .23) * 68); points.push(p); }
    assert.equal(hash(points), g.movement, `${g.zone}/${g.seed} movement`);
  }
});

test('authored town is seed-independent; schema, doorway, routes and service reachability pass', () => {
  const m = map(); assert.deepEqual(m.town, generateMap('hearthmere', 1977).town);
  assert.deepEqual(validateTown(m.town!), []);
  const bad = structuredClone(m.town!); bad.npcs[0].approach = [0, 0];
  assert.ok(validateTown(bad).some(s => s.includes('approach blocked')));
  const narrow = structuredClone(m.town!), cellar = narrow.buildings.find(b => b.id === 'cellar')!;
  for (const p of cellar.footprint) p[1] -= 42;
  assert.ok(validateTown(narrow).some(s => s.includes('narrower than two player diameters')), 'reject the measured 27 u slit');
});

test('continuous dash hits a thin fence; full doorway passes; road union has no internal seams', () => {
  const t = fixture();
  let w = new TownCollision(t);
  assert.deepEqual(w.moveCircle(100, 500, 16, 800, 0), { x: 900, y: 500 });
  t.barriers = [{ id: 'a', a: [500, 0], b: [500, 468], radius: 4 }, { id: 'b', a: [500, 540], b: [500, 1000], radius: 4 }];
  w = new TownCollision(t);
  assert.ok(w.moveCircle(200, 200, 16, 800, 0).x <= 480);
  assert.deepEqual(w.moveCircle(200, 504, 16, 700, 0), { x: 900, y: 504 });
  assert.equal(w.segmentBlocked(200, 200, 800, 200), true);
  assert.equal(w.segmentBlocked(200, 504, 800, 504), false);
  assert.ok(w.moveCircle(200, 452, 16, 700, 0).x < 500, 'too close to doorway jamb stays outside');
});

test('concave doorway recess admits a hero; back wall and diagonal impact stay solid', () => {
  const t = fixture(); t.buildings = [{ id: 'notched', label: 'test', heightClass: 'test', baseline: [], doors: [], footprint: [[300, 200], [700, 200], [700, 600], [550, 600], [550, 500], [450, 500], [450, 600], [300, 600]] }];
  const w = new TownCollision(t);
  assert.deepEqual(w.moveCircle(500, 800, 16, 0, -250), { x: 500, y: 550 });
  assert.ok(w.moveCircle(500, 800, 16, 0, -600).y >= 516);
  assert.ok(w.moveCircle(200, 800, 16, 500, -600).y >= 616);
  assert.ok(w.isFree(...Object.values(w.resolve(500, 300, 16)) as [number, number], 16));
});

test('every exposed town edge resists randomized walking/dashes without leaks', () => {
  const w = new CollisionWorld(map()), rng = new Rng(773), edges = w.town!.edges;
  let checked = 0;
  for (const e of edges) for (let k = 0; k < 30; k++) {
    const t = rng.range(.1, .9), x = e.ax + (e.bx - e.ax) * t + e.nx * 17, y = e.ay + (e.by - e.ay) * t + e.ny * 17;
    if (!w.isFree(x, y, 16)) continue;
    const a = rng.range(-1.2, 1.2), dx = -e.nx * Math.cos(a) + e.ny * Math.sin(a), dy = -e.ny * Math.cos(a) - e.nx * Math.sin(a);
    const p = w.moveCircle(x, y, 16, dx * 230, dy * 230);
    assert.ok(w.isFree(p.x, p.y, 16), `edge ${e.ax},${e.ay} -> ${e.bx},${e.by}; ${JSON.stringify(p)}`); checked++;
  }
  assert.ok(checked > 5000); console.log('swept wall impacts', checked);
});

test('client/server worlds agree for 10000 random fixed movement steps; no invalid final positions', () => {
  const m = map(), client = new CollisionWorld(m), server = new CollisionWorld(generateMap('hearthmere', 42));
  const state = (): MoveState => ({ ...m.entry, dashMs: 0, dashDx: 0, dashDy: 0, dashCdMs: 0, faceX: 0, faceY: 1 });
  const a = state(), b = state(), rng = new Rng(710);
  for (let i = 0; i < 10000; i++) {
    const input = { mx: rng.range(-1, 1), my: rng.range(-1, 1), dash: i % 73 === 0 };
    stepMove(client, a, input, 0, 2800, 50, 16); stepMove(server, b, input, 0, 2800, 50, 16);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= .5);
    assert.ok(client.isFree(a.x, a.y, 16));
  }
});
