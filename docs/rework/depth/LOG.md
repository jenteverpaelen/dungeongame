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
- Step 3: `SkillDef.nodes` (NodeDef: id, name, text, maxRank ≤3, per-rank SkillMods incl. flags/vars, requires, unlock,
  pos), `SkillMods.vars`, `shared/src/specialization.ts` (derived spec points = level−1, 1/rank, buy/refund/reset,
  normalisation), save v15 + fixtures v14/v15, `skillNode` + `skillReset {skill?}` persisted, protocol 23. Shipped data:
  no nodes (placeholder trees only in `shared/test/fixtures/depthContent.ts`). Tests: depthFoundation 10, depth 3,
  foundations with the new fixtures; sim identical.
- Step 4: power templates `shared/src/powers.ts` (skillMods, ownMult, conditional own/hit, stat, elementStacks,
  elementCycle, proc, dashCooldown; builders; generated text + `powerTextIssues`), `powerSources.ts` (canonical order
  sets → legendaries → passives → nodes), server interpreter `powerRuntime.ts` replaces the `extraMods` switch, the
  `skillMult` switch and every `ctx.power('<id>')` read (damage, players, kills, brain, projectiles, class modules).
  Legendaries/sets moved to `shared/src/data/powers/{warrior,ranger,mage,shared}.ts` (registry order kept by
  `compose`). `OWN_BUCKET_CAP = 127` (non-binding). `DerivedStats.dashCdMs` (client prediction reads it).
  Proof: powerTemplates equivalence test (all kits strictly equal), sim identical, item audit rows byte-identical.
  Pre-existing failures (baseline too, not in verify): `server/test/midgame.test.ts` 2 story-XP tests (balance pass).
