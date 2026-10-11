// Test helper for engine-wave-2 tests: one manual slot cast through the real brain, automatic casts and the primary
// attack held back so only the requested cast happens. Returns the cast's error notice (null = cast).
import { playerBrain } from '../../src/sim/brain';
import type { Instance } from '../../src/sim/instance';
import type { Player } from '../../src/sim/types';
import type { GameEvent } from '../../../shared/src/protocol';

export function brainForTest(inst: Instance, p: Player) {
  p.save.skills.autoCast = ['paused', 'paused', 'paused', 'paused'];
  return (slot: number, skill: string): string | null => {
    const notices: string[] = [];
    const emitTo = inst.emitTo;
    inst.emitTo = (id: number, ev: GameEvent) => { if (ev.e === 'notice') notices.push(ev.text); emitTo.call(inst, id, ev); };
    p.atkCdMs = 1e9;
    p.manualCast = { slot, skill };
    try { playerBrain(inst, p, 50); } finally { inst.emitTo = emitTo; }
    return notices[0] ?? null;
  };
}
