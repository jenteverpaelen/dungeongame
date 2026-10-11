import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '@shared/character';
import { CUBE_FUNCTIONS } from '@shared/cube';
import TOWN from '@shared/data/town/hearthmere.json';
import { TOWN_PROGRESS, visibleTownProgress } from './townProgress';

test('a fresh hero shows nothing extra; each Reliquary unlock and each bought tab adds its own prop', () => {
  const s = createCharacter('Townsfolk', 'mage', 4);
  assert.deepEqual(visibleTownProgress(s), [], 'level 1, one tab: the authored town only');
  assert.deepEqual(visibleTownProgress(null), []);
  let previous = 0;
  for (let level = 1; level <= CUBE_FUNCTIONS.length; level++) {
    s.cube.level = level;
    const n = visibleTownProgress(s).length;
    assert.ok(n >= previous, `never fewer props at level ${level}`);
    // Exactly one prop per unlocked operation after salvage (salvage is the starting state).
    assert.equal(n, CUBE_FUNCTIONS.filter((f) => f.unlock <= level && f.op !== 'salvage').length, `level ${level}`);
    previous = n;
  }
  for (let tabs = 2; tabs <= 5; tabs++) { s.stashTabs = tabs; assert.ok(visibleTownProgress(s).includes(`vault-${tabs}`)); }
  assert.equal(visibleTownProgress(s).filter((id) => id.startsWith('vault-')).length, 4);
});

test('every prop belongs to an authored service NPC and stays off its approach point', () => {
  const npcs = (TOWN as unknown as { npcs: { role: string; x: number; y: number; approach: [number, number] }[] }).npcs;
  for (const p of TOWN_PROGRESS) {
    const npc = npcs.find((n) => n.role === p.role);
    assert.ok(npc, `${p.id}: ${p.role} exists in Hearthmere`);
    const x = npc!.x + p.dx, y = npc!.y + p.dy;
    assert.ok(Math.hypot(x - npc!.approach[0], y - npc!.approach[1]) >= 60, `${p.id} is not on the approach point`);
    assert.ok(y <= npc!.y + 10, `${p.id} stands on the shop front, not in the street`);
  }
  assert.equal(new Set(TOWN_PROGRESS.map((p) => p.id)).size, TOWN_PROGRESS.length);
});
