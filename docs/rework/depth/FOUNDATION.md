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

## 4. Specialization nodes and the point economy

### Data (one node; up to `MAX_NODES = 9` per skill on a 3 × 3 grid, M1 target six)
```ts
nodes: [
  { id: 'gale', name: 'Gale', text: 'Whirlwind deals {dmg}% more damage.', maxRank: 3,
    ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: { col: 1, row: 0 } },
  { id: 'devils', name: 'Devils', text: 'Whirlwind always releases Dust Devils.', maxRank: 1,
    ranks: [{ flags: ['dustDevils'] }], requires: [{ node: 'gale', rank: 2 }], unlock: 20, pos: { col: 0, row: 1 } },
]
```
`ranks[i]` is the **increment** bought with rank i + 1 (any `SkillMods`, including `flags` and named numeric `vars`);
the runtime adds ranks after rune and tiers through `collectSkillMods` → `loadoutMods` → `buildCtx`, the same path runes
and tiers use, so every behaviour helper sees them. Text placeholders `{dmg} {radius} {cost} {cooldown} {duration}
{projectiles} {pierce} {gen} {maxSummons} {var:name}` show the cumulative absolute value at the displayed rank
(`describeNode`). Validation (`contentValidation.ts`): ≤ 9 nodes, ids unique, `maxRank` 1–3 with one `ranks` entry per
rank, finite numbers, prerequisites inside the skill with valid ranks and no cycles, `unlock` within [skill unlock, 70],
`pos` a free cell of the grid, every placeholder resolvable. Shipped data has **no** nodes yet; placeholder trees for
Whirlwind and Meteor exist only in `shared/test/fixtures/depthContent.ts` (tests and the dev gallery).

### Save and commands
* Save **v15** (`SAVE_VERSION`): `skills.nodes: { [skillId]: { [nodeId]: rank } }`. Forward migration in
  `normalizeSave` → `normalizeSkillNodes`: a v14 save gets `{}`; any skill whose allocation is illegal under the current
  data (unknown skill/node, rank outside 1..max, unmet prerequisite or level) is cleared, and if the total exceeds the
  points for the level every tree is cleared. Points are derived from the level, so clearing is a free respec, never a
  loss. Golden fixtures: `server/test/fixtures/saves/v14-collection.json`, `v15-nodes.json`.
* `skillNode { skill, node, delta: 1 | -1 }` buys or refunds one rank (refund refused while a bought node depends on
  it). `skillReset { skill? }` now refunds tiers **and** nodes, for one skill or all. Both are persisted commands
  (`commandState.ts`) with the same receipt/replay custody as `skillTier`; protocol 23.

### Economy (numbers and rationale)
| | Value | Label |
|---|---|---|
| Skill points (tiers) | 1 per level after the first → **69 at level 70** | [M] `skillPointsForLevel` (unchanged) |
| Tier cost per skill | 2 + 4 + 6 = **12** | [M] `TIER_COSTS` (unchanged) |
| Today | 6 skills × 12 = 72 > 69: even now not every tier is affordable | [M] |
| M1 (12 skills) | 144 for all tiers; 69 / 12 = **5.75** skills fully tiered | [M] arithmetic on the M1 count |
| Specialization points | 1 per level after the first → **69 at level 70**, derived from level (not stored) | [P] `specPointsForLevel` |
| Node rank cost | **1** point | [P] `NODE_RANK_COST` |
| Full tree | **14–17 ranks** class average (six nodes × ranks 1–3 = 6–18; owner range) | [P] `TREE_RANKS_TARGET`, test-enforced once a class ships trees |
| Trees completable at 70 | 69 / 17 = **4.1** to 69 / 14 = **4.9** | [P] → "fully develop 4–5 skills" |
| M1 class total | 12 trees × 14–17 = 168–204 ranks → 34–41 % affordable at 70 | [P] |
| A five-skill bar | 5 × 15 = 75 > 69: even at the cap ~6 ranks stay unbought | [P] |

Reference: Last Epoch specializes **five** skills (specialization slots at levels 4/8/20/35/50) and each tree holds more
nodes than one skill's 20 points can buy [S, Maxroll "Passives and skills", cited in the plan]. Our bar also holds five
skills (primary + four slots), so ~4.6 complete trees at the cap mirrors that: you can build your bar deeply, never the
whole class, and switching builds is a free respec. The specialization pool is separate from skill points on purpose:
(1) zero effect on today's balance (no node ships yet), (2) no save migration of a stored currency, (3) quest rewards
that grant skill points keep their meaning. Tune `SPEC_POINTS_PER_LEVEL`, `NODE_RANK_COST` or `TREE_RANKS_TARGET` with
the owner's approval and the leveling bot (`docs/rework/BALANCE.md`) once real trees exist.
