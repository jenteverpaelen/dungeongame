# Items, sets and skills: depth plan (draft for the owner, 2026-10-11)

Owner ask (2026-10-11): "look at Diablo 3 and Path of Exile … people have way more variety to make builds and experiment …
a full set shouldn't always mean it can be better than a full set of relevant legendaries … more skills per class, and a
wider range of runes and skill-point upgrades, like the big MMOs." This document grounds that in references and in
measurements of our own data, then proposes targets, rules and phases. Evidence labels: **[M]** measured in this repo,
**[S]** read on the cited page, **[SN]** from a search-result snippet (not opened; verify before relying), **[P]** proposal.

## 1. What the references do

| Game | Skills | Runes / upgrades | Sets / uniques | Source |
|---|---|---|---|---|
| Diablo 3 (Wizard) | **26** active skills in six categories, 18 passives (unlock 10-68) | **5 runes per skill** (130 runes) | 4 original class sets per class + 1 newer = 5 per class (35 class sets) [SN]; "just over 200" legendary items before release [SN]; 2.4 added "more than 50" legendaries [SN] | [S] [Blizzard Wizard actives](https://eu.diablo3.blizzard.com/en-us/class/wizard/active/), [passives](https://eu.diablo3.blizzard.com/en-us/class/wizard/passive/); [SN] Maxroll set dungeon guide, GameStar, PCGamesN |
| Diablo 3 (Barbarian) | **23** active skills | 5 runes each (115) | same set structure | [S] [Blizzard Barbarian actives](https://eu.diablo3.blizzard.com/en-us/class/barbarian/active/) |
| Diablo 3 Kanai's Cube | – | extract legendary powers from three slots (weapon, armor, jewelry); extracted powers always roll at max; can mix set pieces with a power that lowers a set requirement | – | [SN] Icy Veins / Blizzard Watch Cube guides |
| Path of Exile | no class lock: **531 skill gems + 211 support gems** (poewiki, undated) | supports "link" to a skill and rewrite how it works; gem levels and quality | **1,337** unique items incl. variants (poewiki timeline, lags patches) | [SN] [poewiki Gems](https://www.poewiki.net/wiki/Gems), unique timeline |
| Last Epoch | "more than 100 skills", ~20 per mastery path; **5 on the bar** | every skill has its own **specialization tree**; skill level cap 20; specialization slots 5 (at levels 4/8/20/35/50); 113 passive points | 300+ uniques [SN] | [S] [Maxroll passives and skills](https://maxroll.gg/last-epoch/resources/passives-and-skills) |

Design lesson from D3's own history (all [SN]): when sets carry most of the multiplier, builds collapse onto them.
A Hydra patch note says power was tilted "in favor of the 6-piece set bonus and away from the supplemental Legendary
items"; a two-ring set was tried on the test server at +800 % damage per Ancient item ("to see what would happen") and
lowered to +100 %; a community thread argues set-versus-non-set damage gaps tie players to class sets; and an Icy Veins
report on a Diablo 4 developer Q&A says sets "dominated the meta" in D3 and that D4 moved to smaller set combinations
(2/2/2). Kanai's Cube was D3's structural answer: legendary powers become mix-and-match.

## 2. Where we are [M]

| | Hearthfall today | D3 reference |
|---|---|---|
| Active skills per class | **6** | 23-26 |
| Runes per skill | **3** | 5 |
| Skill-point upgrades | 3 purchasable tiers per skill (2/4/6 points) | none (D3) / own tree (Last Epoch) / supports (PoE) |
| Passives | 6 per class, 4 slots (levels 10/20/30/70), each a plain stat | 18 per class, 4 slots, build-defining |
| Class sets | 3 per class (9 sets, 54 pieces) | 5 per class |
| Legendaries | 22 (16 class-specific: **5-6 per class, so 1-2 per skill**) | 200+ |
| Base item shapes | 42 (rings, amulets, bracers: 1 each) | many per slot |
| Affixes | 33 | – |
| Skill unlock cadence | all six skills by level 12, all runes by level 21 | skills and runes spread to level 60+ |

**Why a full set always wins here (the thing you noticed).** Six-piece set bonuses are separate multipliers on the named
skills (the "own bucket" in `server/src/sim/playerctx.ts`): Endless Storm x51 (+5,000 %), Siegebreaker up to x11
(+250 % per active Sentry, max 4), Fallen Star x8, Cinder Oath x127, Fault Warden x22, Farwatch x30, Rainkeeper x30, Glass
Concord x24, Lantern Garden x24. A legendary power on a skill is "+150-200 % increased damage" (a few are +25-50 %) and is
*added* into the skill's damage bucket together with runes and tiers. Three to five relevant legendaries therefore lift
a skill roughly x3-x6, a six-piece set x8-x127 on top, and a class has only 1-2 legendaries per skill to begin with, so a
legendary-only build cannot even be assembled. Codex's build audit (`docs/phase/P11-itemization`) compares set against
set (nine builds, all within 1.25 of the class median); nobody measures set against legendary kit because that kit does
not exist. It is a content-depth problem and a budget problem at the same time.

## 3. Proposal

### 3.1 Parity rule (acceptance test, not a promise) [P]

For every skill that has a set, the best **legendary-only** kit (no set pieces, same item level and Ancient status, up to
three Cube-extracted powers) must clear the audit encounters within **1.25x** of the set kit, and a **hybrid** (4 set
pieces + legendaries) must sit between them. Sets win on convenience and on transform effects; legendaries win on
flexibility and on the Cube. This reuses `scripts/audit-item-builds.ts` and the 1.25 window the owner already chose, and
it runs in `npm run verify` so the rule cannot rot.

Levers to reach it, in order of preference: (1) more relevant legendaries per skill (3-5) so a kit has enough slots of
relevant power; (2) set 6-piece bonuses become *transformations* (new behaviour, extra projectile, element swap) with a
capped multiplier instead of x22-x127; (3) raise individual legendary magnitudes only if (1) and (2) are not enough.

### 3.2 Targets, in two milestones [P]

| | Today | **M1 (first wave)** | **M2** |
|---|---|---|---|
| Active skills / class | 6 | **12** | 20 |
| Runes / skill | 3 | **5** | 5 |
| Skill upgrades | 3 tiers | tiers + **6 specialization nodes per skill** (ranks 1-3, points from levels) | + supports |
| Passives / class | 6 | **14** (build-defining, not +x %) | 18 |
| Class sets | 3 | **5** | 7+ |
| Legendaries | 22 | **~110** (3 per skill + shared) | 200+ |
| Bases / affixes | 42 / 33 | **80 / 55** (each slot at least 3 shapes) | 120 / 80 |
| Unlock cadence | all skills by L12 | skills at L1, 2, 4, 6, 9, 12, **16, 20, 26, 32, 40, 50** | to L60 |

M2 is the D3/Last Epoch scale; M1 is roughly half and is what the review capacity of one owner can absorb (roadmap §11).
These are targets for you to change; the references above are the anchors, not a quota.

### 3.3 Skill-point upgrades: three models, one recommendation

* D3: no points, five runes per skill, passives. Simple, but leaves our existing point economy unused.
* Path of Exile: support gems linked to a skill. Huge combinatorics, but it needs socket UI and a large support catalogue.
* **Last Epoch: a small specialization tree per skill. Recommended.** We already have skill points, tiers and a `SkillMods`
  data type shared by runes and tiers, so a node is "one more SkillMods"; it fits our no-scroll windows (one page per
  skill); and it is the cheapest way to give "a wider range of skill-point upgrades". Supports can follow in M2 as socketed
  modifiers (our gem system already exists).

### 3.4 How items stay cheap to add [P]

New legendaries and sets should be **data**, not code: a library of power templates (change a skill parameter, add a proc,
swap an element, extra summon, conversion) that a legendary or set bonus composes, exactly like the zone kit did for
worlds. Art stays parametric (shape x palette x tier ornaments x motif) with an optional per-legendary silhouette
override. The expensive parts are therefore power *behaviour* (server) and skill VFX (client), not item art.

### 3.5 Phases (each ends with `npm run verify` green and a short owner playtest)

1. **Foundation** (no new content visible): power-template library; specialization-node data model + server validation +
   save revision; parity harness added to verify; Skills panel that scales to 12-20 skills (categories, pages); legendary
   and set definitions moved to the template format. Old content converted 1:1.
2. **Pilot class (Warrior)**: +6 skills, 5 runes everywhere, nodes, 3 legendaries per skill, 2 new sets, retuned set
   multipliers; parity and TTK audits; owner playtest.
3. **Ranger and Mage** to the same level; shared legendaries and new bases/affixes; unlock cadence spread to L50.
4. **M2** content waves, supports, balance pass with the leveling bot (`BALANCE.md` method).

## 3.6 Owner direction and decisions (2026-10-11, after the content bible v1)

Owner: "i also dont want us to already premake the sets and builds, when people join and start playing i want them to
figure out whats best and then make builds on websites etc like all mmo games have now, but we just need to give them
the ability to do that"; the remaining calls were delegated to the lead ("whatever u feel like that is best, with the
research behind it").

* **Principle:** the game ships building blocks and theorycrafting tools, never prescribed builds. Bible archetypes are
  internal test fixtures; nothing shipped says "this is the X build". Most new powers key off skill **tags** or
  mechanics (PoE-style) rather than one named skill; named-skill signatures stay a minority chase layer.
* **Parity v2** guards diversity: a search picks the best kit per main skill from the item pool and checks how many main
  skills per class land within 1.25× of the best, plus a dominance flag when one set or item is in every top kit.
* **Build tools** (spec in `docs/rework/depth/BUILD-TOOLS.md`, bible v2): exact tooltips, damage breakdown, training
  dummy, respec/loadouts, build codes, opt-in public build API and static data export for fan sites (GDPR: opt-in).
* **Lead decisions:** (a) specialization points from a separate pool (Last Epoch model); (b) no Primal "chase"
  multiplier (parity model; D3 history); (c) Ninefold Gale / Lantern Garden / Frost Nova changes approved.

## 4. Risks and open decisions

* Every new skill needs server behaviour, client VFX, an icon, text, a rune set and tests; quality drifts if rushed (the
  worlds pass showed one reviewer round is not enough). Mitigation: ship one skill family at a time with screenshots.
* Balance: adding skills changes pace; keep `LEVEL_TOUGHNESS` fitted by the engaged-bot fit after each wave.
* Saves: new skills/nodes extend existing records; a save revision with a migration is required (golden-save fixtures exist).
* Owner decisions needed: (a) M1 or M2 first; (b) specialization trees vs support gems; (c) 5 runes everywhere;
  (d) whether set bonuses may stay as large multipliers for a deliberate "chase" tier (e.g. Primal-only) while normal
  sets become transforms.
