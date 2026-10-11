// Narrow generic engine additions made for the ranger wave (each in its own commit, docs/rework/depth/RANGER-WAVE.md §3):
// projectile hooks + reach override, the targetWithin condition, perSummon by skill id or tag.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { MONSTERS } from '../../shared/src/data/monsters';
import type { PowerEffect } from '../../shared/src/powers';
import type { PowerSource } from '../../shared/src/powerSources';
import { computeStats } from '../../shared/src/stats';
import type { ClassId } from '../../shared/src/types';
import { Instance } from '../src/sim/instance';
import { createMob } from '../src/sim/monsters';
import { buildCtx } from '../src/sim/playerctx';
import { spawnProj, updateProjectiles } from '../src/sim/projectiles';
import type { Mob, Strike } from '../src/sim/types';
import type { Session } from '../src/net/session';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');

function world(classId: ClassId, effects: PowerEffect[] = []) {
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'rangerEngine', channel: 0, seed: 43, theme: 'glade', level: 70, difficulty: 5 });
  inst.spawner.tick = () => {};
  for (const m of [...inst.mobs]) inst.removeEntity(m.id);
  const save = createCharacter('RangerEngine', classId, 9); save.level = 70;
  const s = { save, derived: computeStats(save), sessionId: save.id, send() {}, sendRaw() {}, markDirty() {}, changed() {}, rec: { inst } } as unknown as Session;
  let center: { x: number; y: number } | undefined;
  for (let y = 600; y < inst.heightPx - 600 && !center; y += 160) for (let x = 600; x < inst.widthPx - 600; x += 160)
    if ([-300, 0, 300].every((dx) => [-300, 0, 300].every((dy) => inst.cw.isFree(x + dx, y + dy, 24)))) { center = { x, y }; break; }
  assert(center, 'free arena');
  s.entityId = inst.addPlayer(s, center);
  const p = inst.playerById(s.entityId)!;
  p.invulnMs = 0;
  const extra: PowerSource[] = [{ kind: 'passive', id: 'fx_ranger_engine', roll: 1, effects }];
  // Deterministic hits: no crits and a fixed weapon roll.
  p.ctx = buildCtx(save, { ...computeStats(save), chc: 0, weaponMin: 1000, weaponMax: 1000 }, extra);
  const mob = (dx: number, dy: number) => {
    const m = createMob(inst, MONSTERS.bog_slime, 70, center!.x + dx, center!.y + dy, { dormant: false, difficulty: 5 });
    m.mhp = m.hp = 1e15;
    return m;
  };
  const fly = (ms: number) => { for (let t = 0; t < ms; t += 50) { inst.t += 50; updateProjectiles(inst, 50); } };
  return { inst, p, mob, fly, center };
}

test('projectile hooks: pre replaces the strike, post sees pierce-through, end runs once; reach overrides the skill range', () => {
  const { inst, p, mob, fly } = world('ranger');
  try {
    const a = mob(80, 0), b = mob(160, 0);
    const st: Strike = { skill: 'hungering_arrow', coef: 1, el: 'physical', pct: 0 };
    const seen: [number, boolean][] = [];
    let ends = 0, endHit: boolean | null = null;
    spawnProj(inst, {
      kind: 'multi', v: 'arrow', owner: p, src: p.id, x: p.x, y: p.y, angle: 0, speed: 900, lifeMs: 2000, r: 12, el: 'physical', strike: st, pierce: 1,
      hooks: {
        pre: (_i, _pr, m, s) => (m === a ? { ...s, coef: s.coef * 2 } : s),
        post: (_i, _pr, m, through) => { seen.push([m.id, through]); },
        end: (_i, _pr, hit) => { ends++; endHit = hit; },
      },
    });
    fly(1500);
    const dealt = (m: Mob) => m.mhp - m.hp;
    assert.deepEqual(seen.map((x) => x[0]), [a.id, b.id], 'post after each hit, in flight order');
    assert(seen.every((x) => x[1]), 'a multi arrow flies on (pierces) after each hit');
    assert(Math.abs(dealt(a) / dealt(b) - 2) < 0.05, `pre doubled the first hit (${(dealt(a) / dealt(b)).toFixed(3)})`);
    assert.equal(ends, 1, 'end once');
    assert.equal(endHit, false, 'it ran out of flight');
    // The arrow's flight is capped by Tracking Arrow's 380 range unless `reach` says otherwise.
    const life = (reach?: number) => spawnProj(inst, { kind: 'arrow', v: 'arrow', owner: p, src: p.id, x: p.x, y: p.y, angle: Math.PI, speed: 900, lifeMs: 5000, r: 12, el: 'physical', strike: st, ...(reach ? { reach } : {}) }).lifeMs;
    assert(life(600) > life() * 1.4, `reach 600 flies farther (${life(600)} vs ${life()} ms)`);
  } finally { inst.destroy(); }
});
