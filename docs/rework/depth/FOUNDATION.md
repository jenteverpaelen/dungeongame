# Items, sets and skills depth — foundation (engine and data formats)

Branch `claude/depth`. Plan: [`docs/rework/ITEMS-AND-SKILLS-PLAN.md`](../ITEMS-AND-SKILLS-PLAN.md) (owner-approved M1).
This document is the contract for the content agents: what exists, the data formats, and the recipes. Evidence labels as
in the plan: **[M]** measured in this repo, **[S]** read on a cited page, **[P]** proposal (a number chosen here).

## 1. Where things live (per class, so three class agents rarely touch the same file)

| What | Data (shared, client + server) | Behaviour (server authority) |
|---|---|---|
| Skills, runes, tiers | `shared/src/data/skills/{warrior,ranger,mage}.ts` (types in `skills/types.ts`, registry + helpers in `skills/index.ts`) | `server/src/sim/skills/{warrior,ranger,mage}.ts` (shared plumbing `skills/common.ts`, dispatch `skills/index.ts`) |
| Summon AI | – | same class module, `<CLASS>_SUMMONS` map (generic spawn/move/lifetime stays in `server/src/sim/summons.ts`) |
| Death hooks | – | class module exports a `DeathHook`; `skills/index.ts` lists hooks in a fixed order |

Registry order is observable (item affix rolls pick a random skill of the class; RNG order), so new entries are
**appended** at the end of a class file, never inserted in the middle of existing ones.

## 2. Recipe: add a skill

1. **Data** — append a `SkillDef` to `shared/src/data/skills/<class>.ts`: `id` (unique across all classes), `classId`,
   `name`, `kind` (`primary | spender | channel | cooldown | buff | summon`), `unlock` (character level, 1–70), `element`,
   numbers (`coef` weapon-damage multiplier per hit, `cost`, `gen`, `cooldown` s, `range`, `radius`, `duration` s,
   `maxSummons`), `auto` (automatic-cast rule), `desc` (placeholders `{coef} {gen} {cost} {duration} {radius} {max}
   {element}` are filled from the data and the equipped modifiers), `icon` (`glyph` + colour), `runes`, `tiers`.
   Ground every number in a reference or label it **[P]** in the content bible.
2. **Behaviour** — implement it in `server/src/sim/skills/<class>.ts` and register it in `<CLASS>_BEHAVIOURS`:
   `{ cast }` for slot skills (return `false` when there is nothing to hit: no cost or cooldown is paid), `{ primary }`
   for auto-attacks, `{ channelTick }` for channelled skills. Build strikes with `strikeOf(p, rt)` so runes, tiers, nodes,
   legendary powers, set bonuses and the own-bucket multiplier all apply. Read runtime modifiers through the helpers in
   `server/src/sim/playerctx.ts` (`skillRadius`, `skillDurationMs`, `skillCost`, `maxSummonsOf`, `skillElement`, …) and
   behaviour flags through `rt.flags.has('flag')`.
3. **Summons** (if any) — add the summon type to `SummonType` (`server/src/sim/types.ts`) and an entry to
   `<CLASS>_SUMMONS` (`radius`, `flies`, `actsWhileOwnerDead`, `update`). Client art: `client/src/render/art/summons.ts`.
4. **Client** — icon glyph in `client/src/ui/panels/skillicons.tsx` (unknown glyphs fall back to the generic rune mark), cast
   flourish in `client/src/render/vfx/casts.ts` (unknown skills get the generic flash + sparks + `cast` sound), optional sound.
5. **Tests** — `server/test/sim.ts` already exercises every skill × rune; add a focused test for new behaviour flags.
   Run `npm run typecheck`, `npm test`, `npx tsx server/test/sim.ts` (isolated `DATA_DIR`).

## 3. Runes (up to five per skill)

```ts
{ id: 'comet', name: 'Comet', unlock: 7, desc: 'Deals Cold damage and freezes enemies hit for 1.5 seconds.',
  mods: { element: 'cold', flags: ['freeze'] } }
```
`unlock` is the absolute character level (≥ the skill's own `unlock`, ≤ 70). At most `MAX_RUNES = 5` per skill. Rune
ids are unique within the skill and are persisted in saves (`skills.runes[skillId]`), so never rename a shipped id.
`mods` is a `SkillMods` (§5); behaviour flags are implemented in the class behaviour module. The existing 54 runes keep
their levels (skill + 2 / + 5 / + 9).
