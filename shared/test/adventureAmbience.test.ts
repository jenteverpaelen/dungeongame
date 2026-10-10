import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RILLWAKE } from '../src/data/rillwake';
import { ADVENTURES } from '../src/adventure';
import { validateAdventureAmbience } from '../src/adventureAmbience';
import { AdventureSound } from '../../client/src/audio/adventure';
import { SOUNDS } from '../../client/src/audio/bank';

test('authored water footprints avoid ground; invalid edits fail before shipping', () => {
  for (const a of Object.values(ADVENTURES)) {
    assert.deepEqual(validateAdventureAmbience(a), []);
    for (const e of a.ambience!.sounds) assert(SOUNDS[`town_${e.kind}`]?.loop);
  }
  // Positions come from the zone data since the worlds rebuild (docs/rework/worlds/DECISIONS.md D-W07).
  const a = structuredClone(RILLWAKE), bridge = a.paths.find(p => p.bridge)!, b0 = bridge.points[0], b1 = bridge.points[bridge.points.length - 1];
  const mid: [number, number] = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2];
  const water: NonNullable<typeof a.ambience>['motion'][number] = { id: 'probe', kind: 'ripples', position: mid, width: 40 };
  a.ambience!.motion.unshift(water);
  assert(validateAdventureAmbience(a).some(e => e.includes('water footprint overlaps ground')), 'bridge must not ripple');
  water.position = [mid[0], mid[1] - 260]; water.width = 180;
  assert(validateAdventureAmbience(a).some(e => e.includes('water footprint overlaps ground')), 'water center alone is insufficient');
  water.width = NaN;
  a.ambience!.sounds[0].radius = Infinity;
  assert.equal(validateAdventureAmbience(a).filter(e => e.includes('invalid extent')).length, 2);
});

test('zone ambience stops at destruction and cannot restart from a late frame', () => {
  const live = new Set<string>(); let calls = 0, clears = 0;
  const sound = new AdventureSound(RILLWAKE, {
    positionedLoop(id) { live.add(id); calls++; },
    clearAmbient() { live.clear(); clears++; },
  });
  sound.update(1); assert.equal(live.size, RILLWAKE.ambience!.sounds.length);
  assert([...live].every(id => id.startsWith('rillwake_crossing/')));
  const before = calls; sound.update(1.01); assert.equal(calls, before, 'bounded update rate');
  sound.destroy(); sound.destroy(); sound.update(2);
  assert.equal(live.size, 0); assert.equal(clears, 1); assert.equal(calls, before);
});
