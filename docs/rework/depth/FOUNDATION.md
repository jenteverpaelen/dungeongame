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
| Data grounds, Inscriptions (wave 2) | `shared/src/data/grounds.ts`, `shared/src/data/inscriptions.ts` | `server/src/sim/groundFx.ts`; same interpreter (+ `powerActions.ts`, `status.ts`) |

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
| `proc` | on `spend / kill / eliteKill / crit / dash / cast` (optional `chance`): shorten cooldowns, gain resource, gain a buff (wave 2 adds triggers, filters, ICDs and strike / summon / ground / status actions: §11.1) | Hellforge, Patient Thief, Stridewind |
| `dashCooldown` | dash cooldown × mult | Stridewind ×0.5 |
| wave 2 | `damageTaken`, `firstHit`, `cheatDeath`, `controlImmunity`, `projectile`, `deflect`, `dot`, `stacking`, `resourceDebt`, `tagGrant`, `rule` | §11 |

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
proposes ×1.3 effective for 6-piece multipliers and 2 / 2 for counts (BUDGET.md R1, R7). The 2 / 2 count cap sits
behind `USE_BIBLE_COUNT_CAP` (default `false`, i.e. today's 3 / 2): §11.12.

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
powers apply). The Skills window shows mechanic tags next to kind and element. **Wave 2:** vocabulary v2 (22 mechanic
tags), rune `addTags` / `removeTags`, sub-strike own tags and `tagGrant` with one fixed resolution order: §11.2.

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
plays arbitrary kits. Wave 2 added the dash and pinned-life variants and a stub item-pool search (§11.11).

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
* Still not supported: Fallen Star 4pc in the generic bucket (bible MAGE §9.2), because `elementStacks` multiplies
  today. Everything else the v1 list named (procs with actions, defensive templates, cheat death, control immunity,
  elite / controlled-recently predicates, internal cooldowns, distance stacks) is now generic data (§11). Remaining gaps
  are in §11.13.

## 11. Engine wave 2 — generic primitives (data formats)

Everything below is plain data in `shared/src/powers.ts` (validated by `shared/src/contentValidation.ts`; text generated
and checked by `describeEffect` / `powerTextIssues`). It is interpreted by these modules:
* `server/src/sim/powerRuntime.ts`: build, conditions, proc dispatch.
* `powerActions.ts`: proc actions, defence, the per-tick hook, rule changes, debt.
* `status.ts`: monster statuses.
* `groundFx.ts`: data grounds.
* Small hooks in `damage`, `players`, `brain`, `kills`, `monsters`, `projectiles`, `grounds` and `effects`.

**Shipped data uses none of it.** With no wave-2 template every hook is a no-op (no RNG draw, no float change). The
`server/test/sim.ts` output, the template-equivalence test and the parity rows are unchanged; an alternating A/B against
the baseline shows no tick-time change.

Tests: `server/test/engineWave2.test.ts` (15 tests), with fixtures in `shared/test/fixtures/depthContent.ts`. Every
number in the examples is a placeholder unless the bible gives it.

### 11.1 Procs

```ts
{ kind: 'proc', on, chance?, icdMs?, skills?, tags?, status?, minHitPct?,           // trigger + filters
  reduceCooldownsMs?, resetCooldowns?, resource?, buff?,                            // v1 effects (+ reset)
  strike?: { id, coef, radius?, element?, at?: 'target'|'self', tags?, visual? },   // actions (wave 2)
  summon?: { type, skill, lifeMs, at?, max? }, ground?: { def, at?, scale? },
  applyStatus?: StatusSpec & { at? }, clearProjectiles?: { range, halfAngleDeg } }
```

**Triggers:** `hit · crit · kill · eliteKill · spend · cast · dash · takeDamage · applyStatus`. Each trigger passes this
context:

| Context | Triggers |
|---|---|
| The strike / skill | hit, crit, kill, eliteKill, spend, cast |
| The enemy | hit, crit, kill, eliteKill, applyStatus; for takeDamage, the attacker |
| The status kind | applyStatus |
| The damage taken | takeDamage |

**Filters:**
* `skills` / `tags` match the triggering strike id. Validation rejects them on dash, takeDamage and applyStatus.
* `status: ['stun', …]` filters applyStatus.
* `minHitPct` on takeDamage is the big-hit hook: the hit must be ≥ N % of max Life.
* `icdMs` is per proc, keyed `<source kind>:<source id>:<effect index>`, so a stat refresh does not reset it. The ICD
  starts only when the proc fires.
* `chance` draws the RNG only when authored.

**Actions** run in this order: cooldown cut → resource → buff → resets → summon → ground → strike → status → projectile
clear. `at` is the enemy (default) or the player.
* **Strike.** A proc strike is a strike id of its own. Its `tags` (+ element) join the tag index, so templates can target
  it by name or tag. Its skill bucket is the template mods of that id; its own bucket is `ownMultiplier(id)`. With
  `radius` it hits every enemy in the circle; without it, the one enemy.
* **Summon.** Only summon types registered by a class module spawn. `max` retires the oldest of that type.
* **Ground.** An id in `GROUND_DEFS` (§11.6).
* **Buff.** New fields: `dr` (% less damage taken), `ccImmune`, and stacking. Stacking uses `maxStacks` with `stackDmg` /
  `stackIas` per stack; each grant adds a stack and refreshes the duration.

**Chains.** Actions run one level deeper.
* `hit`, `crit` and `takeDamage` procs fire only from depth 0, so a proc strike's hits never re-trigger hit procs.
* Other triggers fire up to depth 1: a proc strike may kill and trigger a kill proc once.
* Statuses applied by existing skill code also report (Ground Stomp's stun, Frost Nova's freeze, Black Hole's pull…),
  because the CC helpers now take the applying player.

```ts
// Bellwether (WARRIOR.md): stunning grants 2 Fury (max 10 per second) and +4% attack speed for 4 s (max 5 stacks)
{ kind: 'proc', on: 'applyStatus', status: ['stun'], icdMs: 200, resource: 2, buff: { id: 'bellwether', ms: 4000, stackIas: 4, maxStacks: 5 } }
// Second Skin (RANGER.md): a hit above 25% of max Life gives 50% DR for 2 s and a snare at your feet (once per 20 s)
{ kind: 'proc', on: 'takeDamage', minHitPct: 25, icdMs: 20000, buff: { id: 'second_skin', ms: 2000, dr: 50 }, ground: { def: '<snare ground>', at: 'self' } }
// Reaper's Rhythm style: a Cleave kill swings again at the next enemy (ICD 1.2 s)
{ kind: 'proc', on: 'kill', skills: ['cleave'], icdMs: 1200, strike: { id: 'reaper_swing', coef: 1.0, radius: 120, tags: ['strike', 'area'] } }
```

### 11.2 Tags v2 and `tagGrant`: one fixed resolution order

**Vocabulary** (`SKILL_TAGS`, ITEMS-SHARED.md §1.1): 22 mechanic tags plus the elements.
* Mechanic tags: primary, spender, channel, cooldown, buff, movement, strike, projectile, piercing, area, aerial, ground,
  summon, device, beast, trap, bleed, burn, chill, stun, displace, mark.
* v1 `melee` implies `strike` (`TAG_ALIASES`); `aura` stays for v1 data.
* Runes: `addTags` (v1 name `tags`) and `removeTags` ("Flame Lance −Projectile +Area").
* Assigning the v2 tags to skills is content work (the pilot's).

```ts
{ kind: 'tagGrant', tags: { anyOf: ['aerial'] }, add: ['projectile'] }      // "Aerial skills also count as Projectile"
{ kind: 'tagGrant', tags: { anyOf: ['primary'] }, fromSlot: 0 }             // "Primary gains the tags of the skill in slot 1"
```

**Resolution order** (documented in the powerRuntime header and tested):
1. Skill tags: kind + element after the rune + authored tags + rune add/remove (+ aliases).
2. Sub-strikes and data grounds: their own tags ∪ their owner's.
3. Every `tagGrant` is evaluated against the index from step 2 **at once**, so grants never chain. Sub-strikes and
   grounds also receive their owner's grants. `fromSlot` copies all tags of that bar slot's skill.
4. Proc strike ids join with their own tags.
5. Every other tag-keyed effect (targets, `channeling` tag queries, vulnerability scopes) resolves against that final
   index.

Sub-strikes now carry their own tags:
`SUB_STRIKES = { dust_devil: { owner: 'whirlwind', tags: ['summon', 'area'] }, cleave_rupture: { owner: 'cleave', tags: ['area'] } }`.
Dust Devils from an item count as Summons; Whirlwind itself does not.

### 11.3 Defensive templates

```ts
{ kind: 'damageTaken', pct: -20 }                                         // static (negative = less)
{ kind: 'damageTaken', pct: -20, when: { targetState: 'stunned' } }       // target conditions test the ATTACKER
{ kind: 'damageTaken', pct: 10, when: { inDebt: true } }                  // Astral Debt's downside
{ kind: 'damageTaken', pct: -3, perLegendary: { max: 10 }, noSetBonus: true } // Patchwork style (counts from stats.powerCounts)
{ kind: 'firstHit', pct: -60, windowMs: 8000, resetOnStatus: ['freeze'] } // Unbroken Ward
{ kind: 'cheatDeath', lifePct: 40, cooldownMs: 90000, resetCooldowns: ['ground_stomp', 'cairnfall'] } // Second Wind
{ kind: 'cheatDeath', lifePct: 0, invulnMs: 2000, cooldownMs: 60000, when: { inOwnGround: true } }     // Last Rampart (0 = 1 Life)
{ kind: 'controlImmunity', when: { buff: 'iron_root' } }                  // + a proc granting that buff = "for 3 s after X"
```

Incoming-damage order in `damagePlayer`:
1. Weakened attacker (§11.5).
2. Armour, resist, elite DR, Whirlwind DR (unchanged).
3. damageTaken terms.
4. DR buffs.
5. First hit.
6. Apply the damage.
7. Cheat death, if the hit is fatal.
8. takeDamage procs, if the player is alive.
9. Death.

Control immunity blocks `stunPlayer`, `freezePlayer` and `pullPlayer` (elite Frozen, Vortex, stuns). It is evaluated
once per tick. A buff with `ccImmune` gives the same immunity without a template.

### 11.4 Conditions (shared predicate; new entries)

* `{ all: [...] }`: every child must hold; a scaling child scales the result (counts multiply).
* `{ any: [...] }`: the largest child count.
* `{ targetElite: true }`.
* `{ targetControlledWithinMs: 3000 }`: the enemy is stunned, frozen, knocked back or pulled now, or that control ended
  ≤ N ms ago (`Mob.ctrlAgo`).
* `{ standingStillMs: 1000 }`: tracked only while some template uses it.
* `{ inDebt: true }`.
* Target states `marked` and `weakened`.

Own-bucket legality is checked through composites (`isTargetCondition` and `usesElement` recurse).

### 11.5 Statuses (`StatusSpec`) and monster hooks

```ts
{ kind: 'stun'|'freeze'|'chill'|'knockback'|'pull'|'weaken'|'vulnerable'|'taunt'|'bleed'|'burn'|'freezeBuild'|'mark',
  ms?, pct?, dist?, coef?, skills?, tags?, exceptSource?, radius?, windowMs?, origin?: 'owner' }
```

There is one entry point: `applyStatus(inst, player, mob, status, fromX, fromY, sourceId, tauntRef?)`. Control statuses
go through the existing helpers, so bosses, goblins and dummies stay immune and elites take half duration (`ccFactor`).
Per-monster state lives in `Mob.ps` (created on first use) and ticks in `monsters.ts timers()`.

| Status | Behaviour |
|---|---|
| **weaken** | The monster deals pct % less. Applied to `raw` in `damagePlayer`, monster projectiles included. |
| **vulnerable** | Owner-scoped: only the applying player's strikes count. `skills` / `tags` narrow it (Soaked: Rain only); `exceptSource` excludes the applying skill (Overtone: "your other skills"). Applied in `vulnerability()`. |
| **taunt** | Toward a player: the monster fights that player. Toward a summon or ground: it walks there and stands until the target dies or ends. Toward a point: it walks to the point. The only AI change is one branch in the `chase` state (`tauntStep`), kept minimal for F-MON-02. A ground that ticks a taunt with `radius` gives "Bait: snares draw enemies toward them" (steering toward a placed entity). |
| **freezeBuild** | pct points per application inside `windowMs`; 100 points freezes for `ms`. "Six needles in two seconds" = pct 100/6, windowMs 2000. |
| **bleed / burn** | A dot of `coef` × weapon damage over `ms`, attributed to `sourceId`. |
| **mark** | Sets `markMs` (plus `markPct` vulnerability when given). `seekMarked` projectiles home on it. |

**Dot rules:** `{ kind: 'dot', dot: 'bleed', skills?, tags?, stacks?, strengthPct?, carryPct? }`.
* `stacks` > 1 keeps separate instances per (kind, owner, skill) and replaces the one closest to expiring. Open Veins =
  stacks 3, strengthPct 70.
* `carryPct` moves that share of the replaced dot's remaining damage into the new one (Rollover).
* All player dots go through `addOwnedDot`; without rules it behaves exactly like the old `addDot`.

### 11.6 Data grounds (`shared/src/data/grounds.ts`)

```ts
{ id, name, owner?, tags?, shape?: 'circle'|'line', radius, lineLength?, durationMs, element?,
  tick?: { everyMs, coef?, status? }, onEnter?: { coef?, status?, againAfterMs? }, insideFor?: { ms, status },
  pull?: { speed }, follow?: 'owner', maxPerOwner?, visual? }
```

* **Placement:** with a proc (`ground: { def }`) or from class code
  (`placeGround(inst, player, id, x, y, angle, scale)`). A line extends along the angle.
* **Damage:** coef × the ground strike's expected damage, fixed at placement, dealt as dot damage (vulnerability and
  elite bonus live, no on-hit procs). This is Meteor's molten-ground rule.
* **`onEnter`:** fires when an enemy crosses in, or when the ground is placed on it. Once per enemy, or again after the
  enemy left and `againAfterMs` passed.
* **`insideFor`:** needs that long inside in a row (leaving resets the timer); fires once per enemy.
* **`origin: 'owner'`** on a knockback or pull pushes away from / toward the player instead of the ground.
* **`maxPerOwner`** removes the oldest ground first.
* **Tags:** the owner skill's ∪ the ground's own ∪ `ground` (+ element). Damage is attributed to the ground id.
* **`visual`** names the client `aoe` effect; without it no event is sent.
* `inOwnGround` works for data grounds like any other ground.

The six bible grounds (crack, tremor, faultline, cinder, furrow, rime) exist as data in the fixtures.

### 11.7 Projectiles and deflection

```ts
{ kind: 'projectile', skills?, tags?, distBonus?: { pct, atUnits }, bounces?, bounceScale?, retarget?, seekMarked?: { turn, range } }
{ kind: 'deflect', range, halfAngleDeg, when? }                           // Breakwater: when: { channeling: 'ironplough' }
```

* **Merging:** rules merge per strike id at spawn. Pcts and bounces sum; the first scale and homing win.
* **`distBonus`:** scales the strike by distance flown (`Proj.flown`).
* **Bounces:** a wall hit with bounces left reflects per axis and continues as a new projectile with `bounceScale` × coef.
  Clients get `pend` + `proj`.
* **`retarget`:** homing projectiles pick a new target when theirs dies (the existing seek path).
* **`seekMarked`:** homes on the nearest marked enemy at spawn.
* **Deflection:** removes hostile projectiles in the front cone, every tick (template) or once (`clearProjectiles` proc
  action).

### 11.8 Stacking and resource debt

```ts
{ kind: 'stacking', buff: 'stride', source: 'distance', per: 100, max: 5, decayMs: 2000, stackDmg: 2 }        // decay 'all'
{ kind: 'stacking', buff: 'reap', source: 'kills', per: 1, max: 3, decay: 'one', decayMs: 1000, stackIas: 5, skills: ['cleave'], onMax: { buff, reset? } }
{ kind: 'resourceDebt', max: 50, skills: ['meteor', 'stormglass_orb', 'rimefield'], regenPct: -50 }               // Astral Debt
```

**Stacking:**
* Distance counts real movement only; a jump of more than 200 units in one tick is a teleport [P].
* `decay: 'all'`: the buff runs out `decayMs` after the last stack.
* `decay: 'one'`: one stack is lost per `decayMs` without a gain.

**Debt:**
* Casts and channels of the targets may take the resource down to −max.
* While below zero, regeneration is × (1 + regenPct %).
* Fury decay never lifts a debt back to 0.
* The HUD shows the negative number.

### 11.9 Rule changes (`{ kind: 'rule', skills?, tags?, rule }`)

| rule | data | effect |
|---|---|---|
| `charges` | `{ id: 'charges', extra: 1 }` | the recharge clock may run `extra` cooldowns ahead (one charge per cooldown) |
| `channelMove` | `{ id: 'channelMove', pct: 100 }` | while channelling a target, at least pct % move speed; overrides the skill's `vars.channelMovePct` slow |
| `buffUpkeep` | `{ id: 'buffUpkeep', everyMs: 10000 }` | the targets' buffs (id = skill id) do not run out in combat; they cost the skill again every everyMs |
| `spendRefund` | `{ id: 'spendRefund', pct: 30, minHits: 5, windowMs? }` | a cast hitting minHits different enemies within the window [P 1 s] refunds pct % |
| `groundsFollow` | `{ id: 'groundsFollow', scale: 0.5 }` | all your grounds follow you at scale × radius |
| `countsAs` | `{ id: 'countsAs', state: 'chilled', as: 'stunned' }` | for your powers, chilled enemies count as stunned (aliased stunned / frozen bonuses are no longer folded) |

Some Inscriptions are procs rather than rules:
* "Summons inherit your Bleed and Burn":
  `{ kind: 'proc', on: 'hit', tags: { anyOf: ['summon'] }, applyStatus: { kind: 'bleed', coef, ms } }`. The numbers are
  content.
* "Displace also marks":
  `{ kind: 'proc', on: 'applyStatus', status: ['knockback', 'pull'], applyStatus: { kind: 'mark', ms } }`.
* "Stuns also chill": the same proc with `status: ['stun']` and a chill. The other half ("chills count as stuns") is the
  `countsAs` rule.

### 11.10 Inscriptions (Fabled items, ITEMS-SHARED.md §7)

* **Data:** `shared/src/data/inscriptions.ts` holds `INSCRIPTIONS` (empty; entries are
  `{ id, name, text, group, effects }`). Items carry `Item.inscription?` (the id).
* **One active Inscription:** the first equipped item in `SLOTS` order whose inscription is known (`activeInscription`).
* **Source order:** it joins after legendaries: sets → legendaries → inscription → passives → nodes.
* **Validation** allows only rule-changing kinds and checks the text. Allowed: tagGrant, rule, proc without damage buffs,
  flag-only skillMods, projectile behaviour without distBonus, deflect, controlImmunity.
* **Not built:** item generation, migration, and letting the player choose the active Inscription (that needs a save
  field).

### 11.11 Harness variants and search (`server/test/parity/harness.ts`)

`RunOptions { seeds?, dash?, lifePct? }`; the defaults are unchanged.
* `dash`: the bot dashes on cooldown toward the pack while out of reach. Encounter rows report `dashes`.
* `lifePct`: pins the bot's Life (via `Player.debugPinLifePct`, debug-only).

Search, stub-level, following the BUDGET.md §4 method:
* `slotCandidates(class, slot)` and `kitLegal`.
* `searchKit(base, { score, restarts, seed, slots, maxEvals })`: seeded coordinate ascent with a pluggable score. Use
  `runKit(spec).estTotalMs` for the real search; tests use a cheap proxy.
* `classCoverage`: the D1 check.
* Not wired into `audit-parity.ts` or verify yet, because a real search costs minutes.

`buildCtx(save, d, extra)` accepts extra power sources for tools and tests.

### 11.12 Count cap and economy switches

* **Count cap:** `ITEM_COUNT_CAP` stays at today's 3 / 2 while `USE_BIBLE_COUNT_CAP = false`. Flipping the flag selects
  `ITEM_COUNT_CAP_BIBLE` = 2 / 2 (BUDGET.md R7).
* **Economy:** the owner's decision (separate pool, cap 10 ranks per tree, 50 points at L70 from L21) is
  `SPEC_POINTS = { source: 'separate', perLevel: 1, fromLevel: 21, treeRankCap: 10 }`. Verified: 50 points at L70, 0 at
  L20. The Warrior pilot sets it.

### 11.13 Gaps (not built in wave 2)

**Client side:**
* Grounds follow on the server only; the client draws the placement `aoe` where the ground was placed.
* Channel movement slows are server-only. Client prediction would rubber-band once a skill authors `channelMovePct`.
* Charges show the cooldown until all charges are full.
* Tag grants are not shown in the Skills window.
* Negative resource is untested in the HUD.

**Engine limits:**
* Proc strikes cannot be targeted by name from another source's validation; target them by tag.
* applyStatus procs cannot filter by the applying skill, because the CC helpers do not know it.
* Chill strength is fixed at a 40 % slow, so "slows 30 / 50 %" are approximations.
* "Strongest dot at 50 %" (cinder) and "% of the triggering hit" grounds need a strike-relative coefficient.
* "Once per standard" cheat death has a time cooldown only.

**Not built:**
* Returning projectiles and ricochet at maximum range.
* Recasting a skill elsewhere ("cast your Ground skill where the Movement skill ends").
* Consumable marks (Ringing Ears).
* Knockback collision damage, directional DR, proximity vulnerability auras.
* `setReduce` (Journeyman's Ring).
* Item generation and migration for Kindled / Fabled.

### 11.14 Pilot additions (warrior pilot, `WARRIOR-PILOT.md` §3)

* `RuneDef.effects`: power templates active while the rune is equipped (source kind `rune`, after nodes).
* `SkillDef.vars`: base named parameters, merged before runes (e.g. `channelMovePct`).
* Proc `when`: a `Condition` gate on any proc.
* `Buff.cost`: resource-cost factor while the buff lasts (`skillCost` reads `LiveMods.cost`).
* Client prediction of channel slows: the pilot's `MeState.mvf` was replaced by the shared-items wave's `MeState.ms`
  (`powerActions.channelMsPct`) at the merge. The carried Muster Standard is drawn from its own `standard_carry` events
  (class code).
* Grounds placed while grounds update start next tick (no proc chains inside one tick).
* Dot carry-over is exact: `effects.ticksAhead(dot)` counts the ticks a dot will still deal.
* The warrior's Ringing Ears mark and returning hatchet are class code (built before the shared-items wave's
  `vulnerable.consume` and `returns` projectiles; they can move onto those later). Still not built: recast elsewhere,
  directional DR, a chosen-strength slow, elite filters on the takeDamage trigger.
## 12. Shared-items wave (ITEMS-SHARED.md §2, §3, §5, §7)

### 12.1 Shared legendaries (`shared/src/data/powers/shared.ts`, appended after the six v1 items)

| id | base | data (templates) |
|---|---|---|
| `patchwork_signet` | ring | `stat dmgPct ROLL perLegendary{max 10} noSetBonus` + `damageTaken −1 perLegendary{max 10} noSetBonus`; not extractable |
| `journeymans_ring` | ring | `setReduce {by 1, min 2}`; not extractable |
| `watchkeepers_hood` | head_hood | `skillMore tags{projectile, aerial} ROLL when{noEnemyWithin 200}` |
| `kilnwatch_spaulders` | shoulders_plate | `proc cast tags{cooldown} buff{kilnwatch, 5 s, dmg ROLL}` |
| `hearthguard_coat` | chest_mail | `conditional hit ROLL` + `damageTaken −15`, both `when any[channeling, inOwnGround]` |
| `ink_stained_gloves` | hands_gloves | `skillMods tags{primary} rolled dmg` + `proc attack every 5 repeat` |
| `causeway_waders` | legs_waders (new base) | `skillMore tags{summon, ground} ROLL when{standingStillMs 1000}` |
| `ridgewalker_boots` | feet_boots | `stacking distance per 100 max 5 decay 2 s` + `skillMore tags{spender} ROLL when{buffStacks max 5}` |
| `surveyors_plumb` | neck_amulet | `rule markSpread{range 360 [M retarget radius]}` + `conditional hit ROLL when{targetState marked}` |
| `brine_tally` | ring | `stacking kills per 1 max 20 no decay when any[bleeding, burning] onMax{buff brine_surge 10 s ias+cdRecovery ROLL, reset}` |
| `signal_horn_charm` | neck_amulet | `skillMore tags{summon} ROLL` |
| `lockglass_cincture` | waist_belt | `skillMods tags{channel} rolled cost −` + `controlImmunity kinds[pull] when{channeling}` |
| `wardkeepers_cuffs` | wrists_bracers | `proc applyStatus [stun, freeze, chill, knockback, pull] → vulnerable ROLL 3 s` (owner-scoped) |

**Deliberate change of an existing item (owner-visible, bible §2):** Ouroboros Loop 150–200 % → **60–80 %**.

Colours [P] are taken from the motif glow (`gearStyle.motifColor`) and base-material tones. The `LEGENDARY_MOTIF`
entries belong to the gear-visual lane.

The equivalence proof (`powerTemplates.test.ts`) now covers exactly the 22 converted legendaries
(`LEGACY_LEGENDARY_ORDER`).

### 12.2 Engine primitives added for them (all no-ops without content)

* **`setReduce {by?, min?}`.** Used in set counting (`powerSources.setReduction` / `setThreshold`), in
  `powerCounts.setBonus` and in `setBonusesActive`. The rule is `max(min(count, min), count − by)`: 5 pieces + the ring
  give the 6-piece bonus; 1 piece never gives the 2-piece bonus. Worn-piece counts (`DerivedStats.sets`, gear visuals)
  stay as they are.
* **Not extractable.** `LegendaryDef.extractable: false`; the Cube refuses it on both server and client.
* **Conditions.** `{noEnemyWithin: N}`, tracked once per tick by `PowerState.nearDist` and only while used; target
  state `burning`.
* **Procs.**
  * Trigger `attack`: the automatic primary attack, fired in `brain.ts`.
  * `every: N`: per-proc counter.
  * `repeat: true`: the same primary attack again, run at the current depth so its hits behave normally.
* **Stacking.** `when` filters kill stacks by the killed enemy (a target condition).
* **Buffs.** `cdRecovery`: readyAt runs this % faster, applied in `playerTick` only while `live.cdrec > 0`.
* **Control immunity.** `controlImmunity.kinds` limits it to some of stun / freeze / pull (`PowerState.ctrlImmune`
  bits).
* **Marks.**
  * Rule `markSpread {range}`: the nearest other enemy copies the mark, once (no chain).
  * Hunter's Mark now reports as a mark (`effects.markMob`).
* **Vulnerability.** `vulnerable.consume`: removed after the first matching hit by the applying player (Ringing Ears).
* **Projectiles.**
  * `returns`: after its last hit the projectile flies back to the owner once, piercing, able to hit again.
  * `rangeRicochet`: bounces are also spent at maximum range, toward the nearest unhit enemy within 360 [M].
* **Affix plumbing.** The 22 new `StatId`s are fields of `DerivedStats`.
  * Tag-keyed affixes become one `affix` power source (`powerSources.affixPowerSources`), appended last:
    * skill-group damage → `skillMods` dmg on the tag: summon, primary, spender, cooldown;
    * `areaRadius`, `channelCost`, `summonDuration`, `buffDuration`, `pierceChance` → `skillMods` on the tag;
    * `dotDmg` → dot strength on all dot kinds;
    * `vsControlled` → conditional on immobilised targets;
    * `resourceOnKill` → kill proc.
  * The other affixes are small hooks, each gated on a non-zero stat:
    * melee / ranged DR in `damagePlayer` (capped 75 % like eliteDR [M]);
    * `dashCdr` in `computeStats`;
    * `ccDuration` on your stun / freeze;
    * `ccReduction` on stun / freeze on you;
    * `globeHeal` and `globeChance` (elite globe chance through `DropContext.globeChance`);
    * `moveWhileChannel` (`channelMsPct`);
    * `lifeOnControl` (quiet heal on stun / freeze);
    * `chillOnHit` (RNG only with the affix).

### 12.3 Bases and affixes (data, appended)

**Bases: 42 → 80.** The 38 new bases are listed below, with the existing look shape they fall back to:

| New base | Fallback shape |
|---|---|
| head_coif | hood |
| head_mask | cap |
| head_widebrim | cap |
| shoulders_furmantle | pads |
| shoulders_capelet | mantle |
| chest_brigandine | leather |
| chest_vestment | robe |
| chest_apron | leather |
| hands_mitts | wraps |
| hands_fingerless | gloves |
| wrists_cuffs | bracers |
| wrists_vambraces | bracers |
| wrists_wraps | bracers |
| waist_girdle | belt |
| waist_cord | sash |
| legs_chaps | leather |
| legs_tassets | plate |
| legs_waders | leather |
| feet_wraps | shoes |
| feet_sandals | shoes |
| feet_clogs | boots |
| neck_torc | amulet |
| neck_charm | amulet |
| neck_locket | amulet |
| ring_band | ring |
| ring_signet | ring |
| ring_coil | ring |
| cleaver | axe |
| maul2h | axe2h |
| polearm | axe2h |
| sling | handxbow |
| longbow | bow |
| rod | wand |
| sceptre | wand |
| censer | staff |
| warhorn | quiver |
| trap_kit | quiver |
| tome | orb |

Other base changes:
* The materials of the weapons and off-hands are [P].
* The ring ladder's tiers 1 and 2 are now "Loop" and "Circle" (bible §3.2), so tier 3 "Loop" repeats inside the same
  ladder; flagged for the naming pass.
* The off-hand rule is data: `WeaponBase.noOffhand` (staff, censer) and `blocksOffhand(base)`, used in `character.ts`,
  `stats.ts` and the harness.
* Drop tables (`pickBase`), smart-loot class rules (`classes` / `affinity`), the collection keys, the merchant
  (first base per kind, unchanged) and recipes take the new bases automatically.

**Affixes: 33 → 55.** Ranges and labels are the bible's.
* `AffixScale 'fixed'` (resource per kill).
* `AffixDef.ranged`: `pierceChance` only on ranged weapons and the quiver (`affixFits`, used by generation and the
  Mystic pool).
* Magic prefixes and suffixes as listed in the bible.
* **Weights [P]: 3 for the new primaries and 4 for the new secondaries.** These are the existing specialist band
  (element damage, eliteDR / resourceRegen [M]). With the anchor affixes' own weights (up to 9), a level-70 rare kit lost
  about 22 % of its damage and defence affixes, and the sim's mage endgame rift died 15 times. With 3 / 4 the loss is
  about 15 % / 12 % and every sim check passes.
* Measured with a 400-kit sample:

  | Weights | Defence affixes per kit | Damage affixes per kit |
  |---|---|---|
  | Old pool (33 affixes) | 15.6 | 11.5 |
  | 3 / 4 | 13.2 | 10.1 |
  | Anchor weights | 12.0 | 8.9 |

  This dilution is a real balance effect of more affix variety; the owner should know.

### 12.4 Kindled / Fabled (`shared/src/itemGrades.ts`)

**Storage.** `ancient` stays the stored grade: 1 = Kindled, 2 = Fabled (`GRADE_LABEL`). Drop chances are unchanged.

**Generation.**
* Grade ≥ 1 adds one primary affix from the slot's normal pool (`kindledAffix` = its index).
* Grade 2 rolls everything at maximum, the kindled affix included, and picks an Inscription of the slot group.
* No grade multiplies affixes, weapon damage or armour. `ANCIENT_MULT` is legacy only: enchanting a `legacyGrade` item
  keeps its old ranges.

**Inscription pool** (`data/inscriptions.ts`, 10 entries; permanent ids, [P] names):

| Id | Group |
|---|---|
| shared_tags | weapon |
| returning_shot | weapon |
| sky_and_arrow | head / shoulders |
| spare_charge | head / shoulders |
| steady_channel | chest / legs |
| frostbound_stun | hands / feet |
| kept_buffs | belt / bracers |
| spenders_refund | belt / bracers |
| following_ground | jewelry |
| marking_push | jewelry |

* frostbound_stun chills for 2 s [M: the engine's chill on hit].
* marking_push marks for 3 s [M: Hunter's Mark].
* Not in the pool yet:
  * "Summons inherit your Bleed and Burn": the bible defines no amounts.
  * "Cast your Ground skill where a Movement skill ends": needs a recast engine.
* `powerTextIssues` reads "half" as 50 and "full" as 100.

**Save 16** (`migrateItemGrade`, run once in `normalizeSave`):
* Every graded item keeps its stored values and gets `legacyGrade`. That includes old grade 2, so its enchant ranges
  stay consistent; the bible names only grade 1.
* Old grade 2 also gets `inscription` = pool[`fnv1a(id) % n`] of its slot group.
* Golden fixture: `server/test/fixtures/saves/v15-grades.json`.

**Mystic `rekindle` {itemId}.**
* Persisted command; server-verified beside the Mystic (`SERVICE_ROLE`).
* One free conversion of a legacy grade-1 item:
  * affixes re-roll at normal ranges, keeping their stats and skill;
  * plus a kindled affix;
  * weapon damage and armour re-roll without ×1.3;
  * `legacyGrade` is removed.
* Fabled items are not rekindled.

**UI** (minimal; the lead's tooltip pass and gear-v2 own the look):
* the grade name before the rarity;
* an ember dot on the kindled affix;
* an "Inscription" block (marked inactive when another Inscription is the active one);
* set bonuses lit by the effective threshold;
* a Rekindle button in the Mystic's enchant view;
* loot labels say "Kindled …" / "Fabled …".

### 12.5 Engine gaps closed

* Returning projectiles, ricochet at maximum range and consumable marks (§12.2).
* **Client prediction of channel movement.** `MeState.ms`, sent only while it differs from the sheet, feeds the
  predictor.
* **Following grounds on the client.**
  * Data grounds send `aoe.f = 1` and the pool visual follows the owner.
  * Legacy class grounds (Meteor's molten ground) still announce a fixed position. The class agent adds
    `f: g.stick ? 1 : undefined` at its emit site.
* **Charge display.** `MeState.ch` shows the ready charges; the cooldown sweep only runs while none is ready.
* **Skills window.** Shows the v2 tag labels; melee shows as Strike.

### 12.6 Still open

* `shared/test/gearVisual.test.ts` fails 2 tests on this branch: the lead branch's gear descriptor packs legendaries
  into 5 bits (31 maximum, now 35). `claude/gear-v2` (ba1c7d3) widens it to at least 160. Merge gear-v2 with or before
  this wave.
* No protocol bump. `MeState.ms`, `aoe.f` and the `rekindle` op are additive.
* SAVE_VERSION is now 16; renumber if the completion agent also bumps.
* Tag grants still do not show in the Skills window.
* Negative resource still has no HUD test.

## 13. Engine wave 3 — the primitives the warrior pilot was blocked on (data formats)

Each one is a no-op without content: no RNG draw, no float change. Sim output is byte-identical to the wave-3 baseline
(timing lines excluded). Tests: `server/test/engineWave3.test.ts` (verify stage `depth`). Numbers in the tests are
placeholders.

### 13.1 Slow of chosen strength

* **Status `{ kind: 'slow', pct, ms }`.** Movement only: chill also slows attacks, a slow does not.
  * Allowed in procs, grounds (`tick` / `onEnter` / `insideFor`) and `applyStatus` from class code
    (`server/src/sim/status.ts`).
  * The strongest slow wins; an equal one refreshes the duration.
  * Capped at 90 % (validation rejects more).
  * Bosses (tier 4), goblins (tier 5) and dummies ignore it, as they ignore chill.
* **State.** `MobPowerStatus.slowMs / slowPct`. Monster `step()` multiplies speed by `1 − slowPct / 100`.
* **Condition.** Target state `slowed` holds while chilled or slowed.
* **Display.** No new client flag. Content that needs a visual uses its own ground / aoe visual.

### 13.2 Directional damage taken

* **Conditions `{ targetInFront: deg }` and `{ targetBehind: deg }`.** Half angles in (0, 180], measured from your
  facing (`p.mv.faceX / faceY`).
  * On `damageTaken` they test the attacker.
  * On hit terms they test the enemy hit.
  * A hazard (no attacker) never counts.
  * They are target conditions (`isTargetCondition`), so stacking / kill filters may use them.
* **Example** (Furrowmark 4):
  `{ kind: 'damageTaken', pct: -30, when: { all: [{ channeling: true }, { targetInFront: 90 }] } }`.

### 13.3 Triggers `lifeBelow` and `dashEnd`

* **`{ on: 'lifeBelow', lifePct: N }`.** Fires when one hit takes you from at least N % Life to below it, and you
  survive.
  * Fired in `damagePlayer` after the damage.
  * It fires again only after you were healed back to N % or more.
  * `lifePct` lies in (0, 100) and is required. No skill / tag filter (there is no strike).
* **`{ on: 'dashEnd' }`.** Fires the tick a dash (the Movement skill) ends, from both input paths of
  `processInputs`.
  * `at: 'self'` actions happen at the landing point.
  * No skill / tag filter.

### 13.4 Proc action `castSkill`

* **Format.** `castSkill: { skills?, tags?, pick?: 'longestCooldown' | 'first' }`. It casts one ready bar skill that
  matches, for free.
  * No resource is charged.
  * Its cooldown starts (`skillCooldownMs`).
  * Channels are never cast.
  * `longestCooldown` takes the longest base cooldown; `first` takes the first slot.
* **Context.** The cast runs with `p.acting` = that skill, so its own hits, statuses and procs attribute to it.
* **Example** (Slagforged Helm):
  `{ on: 'lifeBelow', lifePct: 35, castSkill: { tags: { anyOf: ['buff'] }, pick: 'longestCooldown' } }`.

### 13.5 Dual dots, strongest dot, grounds that carry a dot

* **Dot rule `alsoKind` / `element`.** `{ kind: 'dot', dot: 'bleed', alsoKind: 'burn', element: 'fire' }` means your
  Bleeds also count as Burns.
  * `Dot.also` makes target states `bleeding` / `burning` and the client status flags see both.
  * `element` sets the dot's damage element.
  * `alsoKind` must differ from `dot`.
  * Class code that calls `hasDot(m, 'burn')` does not see `also`. Use conditions, or check `d.also`.
* **`strongestDot(p, m)`.** Your dot on `m` with the highest damage per second (`perTick / tickMs`), returned as a
  copy (`powerActions.ts`).
* **Ground `carryDot`.** Proc ground `{ def, at, carryDot: true }` stores the strongest dot of the proc's enemy (for
  example the killed one) on the ground (`GroundFx.dot`).
  * The ground's status `{ kind: 'carriedDot', pct }` gives each enemy it reaches a fresh copy at `pct` % strength
    (default 100) through `addOwnedDot`, so dot rules apply.
  * Without a carried dot it does nothing.
  * `carriedDot` is rejected outside grounds.
  * A status with `origin: 'owner'` is applied from the player, not the ground, so `carriedDot` must not set it.

### 13.6 applyStatus procs filtered by the applying skill

* **`Player.acting`.** Holds the skill (or proc strike / ground id) whose code is running. It is set by:
  * the brain around `castSkill`;
  * `channelTick`;
  * `strikeMob`;
  * `castSkill` actions;
  * `applyStatus`, which uses its `source`.
* **Filter.** `{ on: 'applyStatus', status: ['stun'], skills: ['ground_stomp'] }` now validates and filters by that
  skill. Tags work the same way.
* **Still rejected.** `dash`, `dashEnd`, `takeDamage` and `lifeBelow` still reject skill / tag filters.

### 13.7 Cheat death once per cast

* **`cheatDeath.rearmOnCast: string[]`.** Casting one of these skills (brain cast) re-arms that cheat-death entry.
* **"Once per standard".** Combine it with `cooldownMs: Infinity`.
* **`lifePct: 0`.** Leaves you at 1 Life (the text says "1 Life").
* **Example** (Last Rampart):
  `{ kind: 'cheatDeath', lifePct: 0, cooldownMs: Infinity, invulnMs: 2000, rearmOnCast: ['muster_standard'],
  when: { buff: 'muster_standard' } }`.

### 13.8 Rule `noDecay`, stat `maxResource`, `vars.genPct`

* **Rule `noDecay`.** `{ kind: 'rule', rule: { id: 'noDecay' } }`: your resource does not decay out of combat
  (Fury). It takes no skill / tag targets.
* **Stat `maxResource`.** Flat points; the text drops the "%".
* **`vars.genPct`.** An additive % on the resource a skill generates, read by the helper `skillGain(p, rt, amount)` in
  `damage.ts`.
  * Without the var it is exactly `gainResource`.
  * The warrior generators use it. Ranger / mage generators adopt it by replacing `gainResource(p, …)` with
    `skillGain(p, rt, …)`.
  * Example: `{ kind: 'skillMods', tags: { anyOf: ['primary'] }, mods: { vars: { genPct: -15 } } }`.

### 13.9 Channel-fed stacks, buff movement speed

* **Stacking `source: 'channel'`.** Progress is milliseconds of channelling (any channel). `per: 1000` means one stack
  per second.
  * While channelling, the buff does not decay (`decay: 'all'` keeps `ms` at `decayMs`).
  * After the channel it lasts `decayMs`.
  * No skill / tag / when filter.
* **Buff movement speed.** `stackMoveSpeed` (per stack) on stacking, and `moveSpeed` / `stackMoveSpeed` on
  `BuffGrant`. They are summed into `live.mv`.
* **`movePct(p)`.** Sheet movement speed + `live.mv`, or `channelMsPct` while channelling. The server uses it in
  `processInputs`; `MeState.ms` sends it whenever it differs from the sheet, so client prediction matches.
* **Example** (Spinning Top):
  `{ kind: 'stacking', buff: 'spinning_top', source: 'channel', per: 1000, max: 5, decayMs: 1000, stackDmg: 4,
  stackMoveSpeed: 3 }`.

### 13.10 Set reduction in the runtime

* The test (5 pieces + Journeyman's Ring give the same 6-piece power as 6 pieces, and 5 pieces alone do not) runs
  through `buildCtx`, which is the live power runtime.
