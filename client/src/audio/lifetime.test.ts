import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sfx } from './sfx';

test('ending a game context cancels channel intent before browser audio unlock', () => {
  assert.equal(sfx.inspect().state, 'locked');
  sfx.loop('whirlwind', true);
  assert.deepEqual(sfx.inspect().requestedLoops, ['whirlwind']);
  assert.deepEqual(sfx.inspect().channelLoops, []);
  sfx.stopLoops();
  sfx.stopLoops();
  assert.deepEqual(sfx.inspect().requestedLoops, []);
  assert.deepEqual(sfx.inspect().channelLoops, []);
  // New gameplay may request the same channel after a cancelled earlier context.
  sfx.loop('whirlwind', true);
  assert.deepEqual(sfx.inspect().requestedLoops, ['whirlwind']);
  sfx.loop('whirlwind', false);
  assert.deepEqual(sfx.inspect().requestedLoops, []);
});
