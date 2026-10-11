# Items, sets and skills depth — foundation (engine and data formats)

Branch `claude/depth`. Plan: [`docs/rework/ITEMS-AND-SKILLS-PLAN.md`](../ITEMS-AND-SKILLS-PLAN.md) (owner-approved M1).
This document is the contract for the content agents: what exists, the data formats, and the recipes. Evidence labels as
in the plan: **[M]** measured in this repo, **[S]** read on a cited page, **[P]** proposal (a number chosen here).
Nothing here adds content: every existing skill, rune, tier, legendary, set and passive behaves exactly as before
(proof in §5). Terse history: [`LOG.md`](LOG.md).

## 1. Where things live (per class, so three class agents rarely touch the same file)

| What | Data (shared, client + server) | Behaviour (server authority) |
|---|---|---|
| Skills, runes, tiers, nodes | `shared/src/data/skills/{warrior,ranger,mage}.ts` (types `skills/types.ts`, registry + helpers `skills/index.ts`) | `server/src/sim/skills/{warrior,ranger,mage}.ts` (plumbing `skills/common.ts`, dispatch `skills/index.ts`) |
| Legendaries, sets | `shared/src/data/powers/{warrior,ranger,mage,shared}.ts` (composed in `data/items.ts`) | interpreted by `server/src/sim/powerRuntime.ts` (no per-item code) |
| Passives | `shared/src/data/passives/{warrior,ranger,mage}.ts` (rules `shared/src/passives.ts`) | same interpreter |
| Summon AI, death hooks | – | class module (`<CLASS>_SUMMONS`, exported `DeathHook`s; hook order fixed in `skills/index.ts`) |
| Point economy | `shared/src/specialization.ts` (`SPEC_POINTS`) | `server/src/commands.ts` (`skillNode`, `skillReset`, `skillPrimary`) |

Registry order is observable (loot rolls and affix rolls pick from registries; RNG order), so new entries are
**appended** at the end of a class file, never inserted in the middle. Ids (skills, runes, nodes, legendaries, sets,
passives) are persisted in saves: never rename a shipped id.

## 2. Recipe: add a skill

1. **Data** — append a `SkillDef` to `shared/src/data/skills/<class>.ts`: `id` (unique across classes), `classId`,
   `name`, `kind` (`primary | spender | channel | cooldown | buff | summon`; a class may have several primaries — the
   player picks one with `skillPrimary`), `unlock` (1–70), `element`, `tags` (mechanic tags, §6), optional `category`
   (display group, e.g. D3-style "Might"), numbers (`coef` weapon-damage multiplier per hit, `cost`, `gen`, `cooldown` s,
   `range`, `radius`, `duration` s, `maxSummons`), `auto` (automatic-cast rule), `desc` (placeholders `{coef} {gen}
   {cost} {duration} {radius} {max} {element}`), `icon`, `runes` (≤ 5, §3), `tiers` (3), optional `nodes` (§4).
   Ground every number in a reference or label it **[P]** in the content bible.
2. **Behaviour** — implement it in `server/src/sim/skills/<class>.ts` and register it in `<CLASS>_BEHAVIOURS`:
   `{ cast }` for slot skills (return `false` when there is nothing to hit: no cost or cooldown is paid), `{ primary }`
   for auto-attacks, `{ channelTick }` for channelled skills. Build strikes with `strikeOf(p, rt)` so runes, tiers, nodes,
   legendary powers, set bonuses and the own bucket all apply. Read modifiers through `server/src/sim/playerctx.ts`
   (`skillRadius`, `skillDurationMs`, `skillCost`, `maxSummonsOf`, `skillElement`, …), behaviour flags through
   `rt.flags.has('flag')` and named numbers through `modVar(rt.mods, 'name')`.
3. **Summons** (if any) — add the type to `SummonType` (`server/src/sim/types.ts`) and an entry to `<CLASS>_SUMMONS`
   (`radius`, `flies`, `actsWhileOwnerDead`, `update`). Art: `client/src/render/art/summons.ts`.
4. **Sub-strikes** (damage ids that are not skills, like `dust_devil`) — add them to `SUB_STRIKES` in
   `shared/src/powers.ts` so templates can target them and they inherit their owner's tags.
5. **Client** — icon glyph in `client/src/ui/panels/skillicons.tsx` (unknown glyphs fall back to the generic rune mark),
   cast flourish in `client/src/render/vfx/casts.ts` (unknown skills get the generic flash + sparks + `cast` sound).
6. **Tests** — `server/test/sim.ts` exercises every skill × rune; add a focused test for new flags. Run
   `npm run typecheck`, `npm test`, `npx tsx server/test/sim.ts` with an isolated `DATA_DIR`.

## 3. Runes (up to five per skill)

```ts
{ id: 'dust_devils', name: 'Dust Devils', unlock: 4, tags: ['summon'], desc: '…', mods: { flags: ['dustDevils'] } }
```
`unlock` is the absolute character level (≥ the skill's `unlock`, ≤ 70); `MAX_RUNES = 5`. `tags` are added while the
rune is equipped (a rune's element conversion re-derives the element tag). `mods` is a `SkillMods` (§5). The existing
54 runes keep their levels (skill + 2 / + 5 / + 9; verified).

## 4. Specialization nodes and the point economy

### Data (up to `MAX_NODES = 9` per skill on a 3 × 3 grid; M1 target six)
```ts
nodes: [
  { id: 'gale', name: 'Gale', text: 'Whirlwind deals {dmg}% more damage.', maxRank: 3,
    ranks: [{ dmg: 10 }, { dmg: 10 }, { dmg: 10 }], pos: { col: 1, row: 0 } },
  { id: 'devils', name: 'Devils', text: 'Whirlwind always releases Dust Devils.', maxRank: 1,
    ranks: [{ flags: ['dustDevils'] }], requires: [{ node: 'gale', rank: 2 }], unlock: 20, pos: { col: 0, row: 1 } },
  { id: 'eye', name: 'Eye', text: 'Whirlwind deals more damage to stunned enemies.', maxRank: 3, ranks: [{}, {}, {}],
    effects: [skillMore(['whirlwind'], { roll: 8 }, { targetState: 'stunned' })], pos: { col: 1, row: 2 } },
]
```
`ranks[i]` is the **increment** bought with rank i + 1 (any `SkillMods`: numbers, `flags`, named `vars`); ranks are added
after rune and tiers (`collectSkillMods` → `loadoutMods` → `buildCtx`), the path runes and tiers use. Optional
`effects` are power templates (§5) active while the skill is on the bar; `{ roll: k }` there scales with the rank. Text
placeholders `{dmg} {radius} {cost} {cooldown} {duration} {projectiles} {pierce} {gen} {maxSummons} {var:name}` show
the cumulative absolute value at the shown rank (`describeNode`). Validation: ≤ 9 nodes, unique ids, `maxRank` 1–3 with
one `ranks` entry per rank, finite numbers, prerequisites inside the skill (valid ranks, no cycles), `unlock` within
[skill unlock, 70], `pos` a free grid cell, every placeholder resolvable. **Shipped data has no nodes**; placeholder
trees for Whirlwind and Meteor live only in `shared/test/fixtures/depthContent.ts` (tests and the dev gallery).

### Save and commands
* Save **v15**: `skills.nodes: { [skillId]: { [nodeId]: rank } }`. Forward migration in `normalizeSave` →
  `normalizeSkillNodes`: a v14 save gets `{}`; a skill whose allocation is illegal under the current data (unknown skill
  or node, rank outside 1..max, unmet prerequisite / level, over the tree cap) is cleared; separate pool: if the total
  exceeds the points for the level every tree is cleared (points are derived — a free respec, never a loss); shared
  pool: cleared ranks are refunded to skill points. Golden fixtures `server/test/fixtures/saves/v14-collection.json`,
  `v15-nodes.json`.
* `skillNode { skill, node, delta: 1 | -1 }` buys / refunds one rank (refused while a bought node depends on it);
  `skillReset { skill? }` refunds tiers **and** nodes for one skill or all; `skillPrimary { skill }` picks the
  auto-attack among unlocked primaries. All persisted commands (`commandState.ts`, same receipt/replay custody as
  `skillTier`); protocol 23.

### Economy — one switch: `SPEC_POINTS` in `shared/src/specialization.ts`
```ts
export const SPEC_POINTS = { source: 'separate', perLevel: 1, fromLevel: 2, treeRankCap: Infinity }; // shipped
// content bible (ITEMS-SHARED.md §0):  { source: 'separate', perLevel: 1, fromLevel: 10, treeRankCap: 10 }
// shared with tier points:             { source: 'shared', … }  (nodes cost stored skill points; refunds return them)
```
| | Value | Label |
|---|---|---|
| Skill points (tiers) | 1 per level after the first → **69 at 70** | [M] `skillPointsForLevel` (unchanged) |
| Tier cost per skill | 2 + 4 + 6 = **12**; six skills 72 > 69 already today | [M] |
| M1 (12 skills) | 144 for every tier; 69 / 12 = **5.75** skills fully tiered | [M] arithmetic |
| Specialization points (shipped) | separate pool, 1 per level from L2 → **69 at 70**, derived from level | [P] |
| Node rank cost | **1** point | [P] `NODE_RANK_COST` |
| Full tree | **14–17 ranks** class average after the cap | [P] `TREE_RANKS_TARGET`, enforced by test once a class ships trees |
| Trees completable at 70 | 69 / 17 = **4.1** to 69 / 14 = **4.9** | [P] → "fully develop 4–5 skills, not all 12" |
| M1 class | 12 trees × 14–17 = 168–204 ranks → 34–41 % affordable at 70; a 15-rank bar of five needs 75 > 69 | [P] |
| Bible preset | 61 points (L10+), ≤ 10 of 18 ranks per tree → ≈ 6 trees | [P] owner decision; flips the test on purpose |

Reference: Last Epoch specializes **five** skills and each tree holds more than one skill's points can buy [S, Maxroll,
cited in the plan]; our bar holds five skills (primary + four slots). The separate pool means (1) zero effect on today's
balance (no node ships), (2) no stored-currency migration, (3) quest rewards granting skill points keep their meaning.
Changing `SPEC_POINTS` after release needs a save migration for allocations made under the old rule.

## 5. Power templates (legendaries, set bonuses, passives, node effects)

Library: `shared/src/powers.ts` (types, builders, generated text, text validation). Active sources in canonical order:
`shared/src/powerSources.ts` — **set bonuses → legendary powers → passives → specialization nodes** (of skills on the
bar). One interpreter: `server/src/sim/powerRuntime.ts` (built in `buildCtx`; tag queries and target lists are resolved
there once per stat rebuild, never per hit); sheet templates (`stat`, `dashCooldown`) are read by `shared/src/stats.ts`
so client and server agree (`DerivedStats.dashCdMs` feeds client dash prediction).

| Kind | Does | Example |
|---|---|---|
| `skillMods` | any `SkillMods` on the targets (+ the roll into one field or `var:`) | `rolledDamage('seismic_slam', { cost: -40 })` |
| `skillMore` | ×(1 + pct %) on the targets ("more"); no condition / player condition → own bucket (capped); target condition → per hit | `skillMore(tagged('projectile'), 30, { targetFartherThan: 400 })` |
| `ownMult` | own-bucket ×mult (legacy form of an unconditional `skillMore`) | `ownMult(['meteor'], 8)` |
| `conditional` | +pct % while a condition holds; `bucket` 'own' (cast time) or 'hit'; optional targets | `conditional({ perSummon: 'sentry', max: 4 }, 'own', 250, ['sentry', 'multishot', 'cluster_arrow'])` |
| `stat` | sheet stat (affix keys; `cdr`/`rcr` multiplicative); `perLegendary: { max }` × equipped legendaries; `noSetBonus` | Patchwork Signet: `{ kind: 'stat', stat: 'dmgPct', value: ROLL, perLegendary: { max: 10 }, noSetBonus: true }` |
| `elementStacks` | ×(1 + perStack %) per distinct element dealt within a window | Fallen Star 4pc |
| `elementCycle` | one boosted element at a time, rotating | Ouroboros Loop |
| `proc` | on `spend / kill / eliteKill / crit / dash / cast` (optional `chance`): shorten cooldowns, gain resource, gain a buff | Hellforge, Patient Thief, Stridewind |
| `dashCooldown` | dash cooldown × mult | Stridewind ×0.5 |

**Targets** — named `skills` (and sub-strikes), a tag query `tags: { anyOf, allOf, noneOf }`, or both (union). Builders
take either: `skillMore(['meteor'], …)` or `skillMore(tagged('fire', 'cold'), …)`. **Conditions** — one predicate
shared by `skillMore`, `conditional`, vulnerability and set bonuses: target `targetState` (stunned, frozen, chilled,
bleeding, immobilised = stunned or frozen, inBlackHole), `targetLifeAbovePct`, `targetFartherThan`; player
`channeling` (skill, any, or a tag query), `buff`, `buffStacks` (× stacks, max), `perSummon` (× summons, max),
`standingStill`, `inOwnGround`, `lifeBelowPct`, `lifeAbovePct`; strike `element`. Target conditions are evaluated per hit
in the vulnerability position; the others at cast time (own bucket) or per hit. Unfiltered stunned / frozen bonuses fold
into the existing `stunMult` / `frozenMult` exactly as Vambraces of the Anvil did. Amounts are numbers or `{ roll: k }`
(the legendary's rolled value — Cube: range maximum —, a node's rank, or 1). Behaviour no template can express is a
**flag** / named `var` in `skillMods` plus code in the class module (e.g. `fastSentry`, `moltenDouble`, `var:markPct`).

**Caps** (both [M]: today's largest values, so nothing binds now; lowering them is the M1 retune):
`OWN_BUCKET_CAP = 127` (Cinder Oath 6pc) caps the cast-time own bucket of one strike; `ITEM_COUNT_CAP = { maxSummons: 3,
projectiles: 2 }` (Sapper's Pack + Siegebreaker 2pc; Spindle) caps extra summons / projectiles per skill from items and
set bonuses combined, enforced where those are summed (runes, tiers, passives and nodes are not counted). The bible
proposes ×1.3 effective for 6-piece multipliers and 2 / 2 for counts (BUDGET.md R1, R7).

**Legendary** (`shared/src/data/powers/<class>.ts`):
```ts
{ id: 'thousand_missiles', name: 'Spindle of a Thousand Missiles', base: 'wand', classes: ['mage'],
  power: 'Magic Missile fires 2 additional missiles and deals {v}% increased damage.', range: [100, 150], cubeSlot: 'weapon',
  flavor: '…', colors: { … }, effects: [rolledDamage('magic_missile', { projectiles: 2 })] }
```
**Set** — every bonus threshold carries its text and templates (`parityLoadout` optionally tells the planner what to play):
```ts
bonuses: [
  { count: 2, text: 'Meteor calls down a second meteor on a nearby enemy.', effects: [flags(['meteor'], 'secondMeteor')] },
  { count: 6, text: 'Meteor deals 700% increased damage.', effects: [ownMult(['meteor'], 8)] },
]
```
**Text** — authored texts are validated against the templates (`powerTextIssues`: every literal number / converted
element must appear, `{v}` exactly when a roll is used; number words one…ten count); `powerText(effects)` generates
English for new content (use it, then polish). Validation also checks targets (skills of the owner's class, known tags),
finite amounts, legal buckets, both caps and banned stats (`skillDmg`, `flatMin/Max`, `sockets`).

**1:1 conversion proof.** All 22 legendaries and 9 sets were converted. (a) `server/test/powerTemplates.test.ts`
compares the interpreter with a verbatim copy of the old hard-coded logic for every legendary at four rolls, every set at
1–6 pieces and mixed class kits (157 kits × 3 classes × 18 skills = 8,478 strict comparisons + own-bucket multipliers at 0/1/3/5 sentries + stun factor
+ dash): all strictly equal. (b) `server/test/sim.ts` output is identical to the baseline apart from timing lines (after
every step). (c) `scripts/audit-item-builds.ts` rows (81 encounters: damage per skill, time, max hit) are byte-identical.
One deliberate micro-change: buffs granted by a power now end when that power stops being active (on stat refresh) for
every power; before, only Hellforge and Ouroboros did (Stridewind's 3 s buff and the Fallen Star stack display could
linger after unequipping). Not observable in any test or fingerprint.

## 6. Tags (build-finding by mechanic, not by named skill)

`SKILL_TAGS`: elements (physical, fire, cold, lightning, poison, arcane, holy), kinds (primary, spender, channel,
cooldown, buff, summon) and mechanics (projectile, area, melee, ground, movement, mark, aura, summon). Kind and element are
**derived** (element = after the equipped rune's conversion); data authors only mechanic tags on `SkillDef.tags` and
`RuneDef.tags` (validated). `skillTags(skill, runeId)` / `matchesTags(tags, query)` in `shared/src/data/skills`. The
18 existing skills carry initial mechanic tags [P] (e.g. Multishot projectile + area, Rain of Vengeance area + ground);
no template uses tags yet, so nothing changes in play. Item conversions do not re-tag (tags are resolved before item
powers apply). The Skills window shows mechanic tags next to kind and element.

## 7. Passives (still four slots, levels 10 / 20 / 30 / 70)

Data per class: `shared/src/data/passives/{warrior,ranger,mage}.ts` (the 18 existing written out; values and texts
verified identical for every level). A passive is a **stat passive** (`stat` + optional `skill`, level-scaled head-affix
mean, rule L116/D054), a **build-defining passive** (`effects`: power templates, roll = 1, with `text` validated by
`powerTextIssues` or generated), or both:
```ts
{ id: 'warrior_vortex', classId: 'warrior', name: 'Vortex', unlock: 28, note: 'Spin longer, hit harder.',
  effects: [conditional({ channeling: tagged('channel') }, 'hit', 20), stat('ias', 4)],
  text: 'While channelling you deal 20% increased damage, and attack speed +4%.' }
```
Template passives join the interpreter after items only while slotted and unlocked; stat passives keep their place at
the start of the sheet. The picker shows every class passive on one page (3 columns up to 15, 4 columns beyond).

## 8. Skills window (`client/src/ui/panels/skills.tsx`)

One screen, no scroll region at any count: loadout + point pools on top; left a paged list (2 × 5 cards per page) with
category chips (`SkillDef.category`, else the kind) and the passive slots; right the selected skill with three views —
**Runes & tiers** (3 tiers, ≤ 5 runes in a 3-column grid), **Specialization** (the 3 × 3 tree with prerequisite links,
rank pips, a node panel with Now / Next / Needs, Learn / Refund rank, Reset skill) and **Casting** (auto-cast modes and
rules). The Specialization view and the specialization chip only appear once the class has a tree (no dead feature
before content ships); in `shared` economy mode the chip is hidden. Primary skills that are not the current auto-attack
offer "Use as primary attack". Measured with `scripts/shoot.mjs` and the dev panels gallery (`&depth=12|20` installs
the placeholder fixture): 1920×1080 panel heights 778–882 px (TALLEST_PANEL 915), 1366×768 scaled 557–630 px, zero
scrolling elements in every view. Evidence: `docs/rework/depth/shots/*.jpg`.

## 9. Parity harness (set vs legendary-only vs hybrid)

`server/test/parity/harness.ts` separates **kits as data** (`KitSpec`: class, main skills, loadout, every equipment slot
as set piece / legendary / rare base, Cube powers) from the **runner** (`runKit`: actual 20 Hz encounters — six-mob pack,
three champions, Gorgemaw — × three seeds, Torment II, infinite player HP, mean rolls, 48 tier points, 120 s cap, timeouts
extrapolated as cap × life / damage and labelled) and from today's **planner** (`planParityKits`: per set, SET = six
pieces + the most relevant legendaries elsewhere + three Cube powers; HYBRID = four pieces; LEGENDARY = no set; relevance
= targets a loadout skill by name or tag > generic damage). A future planner can search the item pool for the best kit
per main skill and report how many main skills per class land within 1.25× of the best; `--kits=<file.json>` already
plays arbitrary kits. Variants not built (hooks noted in the harness): dash-driven powers (the bot never dashes) and
"above X % life" powers (the immortal bot sits at 100 %).

* Report: `DATA_DIR=<empty dir> BACKUP_DIR= BACKUP_KEEP=0 npx tsx scripts/audit-parity.ts` → `PARITY.md`,
  `PARITY-MODEL.json` (≈ 15 s).
* Gate: `server/test/parity.test.ts` in `npm run verify` (stage `depth`) asserts legendary-only ≤ 1.25 × set and hybrid
  between them (±5 %) **only** for set-backed skills with `parityReady: true` (validation: only set-backed skills may
  carry it). Today none is flagged, so it reports and passes in ≈ 2 s. Class agents flip the flag per skill once its
  legendaries exist.
* Today [M]: every set kit is 18×–95× faster than the legendary-only kit (Fault Warden 18.6, Fallen Star 27.4, Siege
  33.2, Endless Storm 41.0, Glass Concord 50.4, Cinder Oath 94.6), hybrids sit between — the gap the plan describes.

## 10. Notes for the content agents

* Keep the 1:1 data untouched until the pilot retunes it; rebalancing belongs to the class waves.
* The old `scripts/audit-item-builds.ts` runs at Torment X, where every encounter times out since the ×350 level-70
  toughness pass (BALANCE.md §4); use the parity harness (Torment II) for clear-time comparisons.
* Not supported yet (needs engine work, see the report): Fallen Star 4pc in the generic bucket (bible MAGE §9.2) —
  `elementStacks` multiplies today; strike / summon / ground **procs** (only cooldown, resource and buff grants exist);
  player damage-reduction templates (`defensive`), cheat-death, control immunity; elite-only vulnerability (Watchkeeper's
  Hood) and "controlled in the last 3 s" (Wardkeeper's Cuffs) predicates; per-proc internal cooldowns; moving-distance
  stacks (Ridgewalker Boots).
