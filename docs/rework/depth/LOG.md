# Depth foundation — log (terse)

- 2026-10-11 Baseline (7846e60): `server/test/sim.ts` 380/382 (two perf thresholds, machine load; 382/382 when idle).
  `scripts/audit-item-builds.ts` now times out on **all 81** encounters: Torment X with the ×350 level-70 toughness of
  the 2026-10-10 balance pass (`docs/rework/BALANCE.md` §4) — the P11 numbers are stale. Its rows are still
  deterministic, so they serve as a behaviour fingerprint. Pre-existing failure outside verify:
  `server/test/itemization.test.ts` "Mystic authenticates …" (gear `fx` field in item looks), fails on the baseline too.
- Step 1: skill data split into `shared/src/data/skills/{types,warrior,ranger,mage,index}.ts` (JSON of `SKILLS` and key
  order identical to the old file); server behaviour split into `server/src/sim/skills/{common,warrior,ranger,mage,index}.ts`
  with registries for casts, primaries, channel ticks, summon AI, owner hooks and death hooks (death-hook order kept).
  Proof: sim output identical to baseline except timing lines (`simdiff`), typecheck, shared 54/54, focused server tests.
- Step 2: `RuneDef.unlock` (absolute level, authored per rune; existing runes written as skill+2/+5/+9, verified 0
  mismatches); `MAX_RUNES = 5`; `RUNE_UNLOCK_OFFSETS` removed (UI shows each rune's level). Validation: ≤5 runes, unlock
  integer in [skill unlock, 70]. Skill unlocks were already data (≤70). Sim identical; shared 57/57.
