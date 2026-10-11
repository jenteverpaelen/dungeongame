# References — how Diablo III, Path of Exile, Last Epoch (and Diablo IV) structure skills, sets and legendaries

Gathered 2026-10-11 for the depth bible. Used for **structure and patterns only**: no names, item names, set names or
exact numbers from these games are copied into Hearthfall content. Evidence labels: **[S]** read on the cited page in
this session · **[SN]** search-result snippet or a secondary summary of a page I could not open · **[K]** general
knowledge, unverified in this session · **[M]** measured in this repo. Many wikis (poewiki) returned bot-protection pages;
official Blizzard pages and Maxroll worked.

## 1. Diablo III — skills, runes, passives, sets, Kanai's Cube

**Skill categories [S].** The official class pages group active skills into six categories with 3–5 skills each and
list unlock levels and resource cost/generation:

| Class | Categories (count) | Unlock span | Source |
|---|---|---|---|
| Barbarian | Primary 4, Secondary 5, Defensive 4, Might 4, Tactics 3, Rage 3 (23) | L1 (Bash) – L61 (Avalanche) | [S] eu.diablo3.blizzard.com/en-us/class/barbarian/active/ |
| Demon Hunter | Primary 5, Secondary 4, Defensive 3, Hunting 4, Devices 4, Archery 4 (24) | L1 – L61 | [S] …/class/demon-hunter/active/ |
| Wizard | Primary 4, Secondary 4, Defensive 4, Force 5, Conjuration 5, Mastery 4 (26) | L1 – L61 | [S] …/class/wizard/active/ |

* Primaries generate resource (e.g. Barbarian primaries 4–6 Fury per attack), secondaries spend it (10–30 Fury),
  defensive/might skills often generate on cooldown (Ground Stomp, Leap +15) [S, Barbarian page].
* **Five runes per skill** [S: the Whirlwind entry lists five runes]; rune unlock levels are not shown on the page.
* Several Hearthfall skills and runes already carry the D3 names listed on these pages (Cleave, Whirlwind, Rend, Ground
  Stomp, Seismic Slam, Battle Rage, Hungering Arrow, Sentry, Multishot, Cluster Arrow, Rain of Vengeance, Companion, Magic
  Missile, Meteor, Black Hole, Frost Nova, Hydra, Magic Weapon, and most rune names) [M vs S] — the separate naming
  question the brief mentions. New content avoids every D3 skill and rune name I could check (e.g. a Ground Stomp rune
  first drafted as "Rolling Thunder" was renamed because D3 uses it on another skill [K]).

**Passives [S].** The Barbarian page lists 19 passives unlocking from L10 to L68 (10, 10, 13, 16, 20, 20, 24, 27, 30,
30, 35, 40, 45, 50, 55, 60, 64, 66, 68). Their structure: mostly *conditional* bonuses — a state (low health, resource
level, weapon type) or an event (globe pickup, fatal damage) triggers damage, resource or defence; some are
skill-specific (a passive that feeds resource when two named skills trigger) and one cheats death [S, summary of the
page]. Pattern used: Hearthfall's 8 new passives per class are triggers/rule changes, never plain stats.

**Class sets and their 6-piece patterns [S].** The patch 2.4.0 PTR notes (news.blizzard.com article 19941042) describe
Set Dungeons "designed entirely around a specific class set" and redesigned 6-piece bonuses. Structures seen there:
stack-and-consume (a skill builds a buff, a spender consumes it), scaling with a count (burning enemies, active Sentries,
allies), "gain every rune effect of a skill", stacking elemental buffs that extend themselves, and plain large damage
increases. Several existing Hearthfall sets copy these structures already (Fallen Star 4-piece = elemental stacks,
Siegebreaker = per-Sentry scaling and Sentries casting your skills, Endless Storm 2-piece = a rune granted) [M].
**Counts:** four original class sets per class plus later additions, about five per class [SN, plan §1]; "just over
200" legendaries before release and 50+ added in 2.4 [SN, plan §1].

**Legendary powers [K].** From 2.4 onward many D3 legendaries carry a power that changes a skill ("Skill X gains rune
effect Y", "Skill X deals 150–200% increased damage"); these powers multiply each other (each is its own multiplier),
while "+x% skill damage" affixes add. The PTR notes confirm the design intent that new legendaries "change how skills
behave rather than just adding numbers" [S, summary]. Hearthfall today puts legendary damage in the *additive* bucket
[M], which is why the new `skillMore` template exists (`ITEMS-SHARED.md` §1).

**Kanai's Cube [SN].** Added in patch 2.3.0 (August 2015): destroying a legendary adds its power to a collection; one
weapon, one armor and one jewelry power can be active at a time, from items the character could equip (Blizzard Watch,
PCGamesN, GameWatcher previews in the search results). Extracted powers roll at maximum [SN, plan §1]. Hearthfall's Cube
already implements this rule [M: `stats.ts`].

## 2. Path of Exile — skill gems, support gems, "increased" vs "more", uniques

* **Skills are gems; supports modify them [S].** The official game page: skills are "gems that grant abilities when
  socketed into equipment"; a wide range of support gems change how skills behave, and **up to five supports can affect
  one skill** (pathofexile.com/game).
* **Increased vs more [SN].** Community explanations (official forum thread 892570 and others in the search): all
  "increased" modifiers add into one pool; each "more" modifier multiplies separately, so one "more" is worth far more than
  the same "increased" once a build stacks a lot of increased. This is exactly Hearthfall's skill bucket vs own bucket [M].
* **Magnitude bands tied to opportunity cost [S, secondary].** GameBanshee's summary of Grinding Gear Games' Expedition
  balance overview: supports that add a useful benefit *and* damage were set below 25% more damage at gem level 20; pure
  damage supports about 30–35%; supports with real downsides 38–48%; the cut targeted players stacking every multiplier
  and ignoring utility. Hearthfall's skillMore band (25–40%, conditional) and the 6-piece cap (×1.25 plus a transform)
  borrow the *principle* (multiplier size scales inversely with utility and with how freely it stacks), not the numbers.
* **Scale [SN, plan §1].** 531 skill gems and 211 supports; 1,337 unique items including variants (poewiki, undated).
* **Build-enabling uniques [K].** Many PoE uniques exist to make one mechanic work (convert, trigger, remove a cost); the
  Hearthfall equivalent is a legendary with a `skillFlag` (e.g. Ninefold Gale, Bellwright's Maul).

## 3. Last Epoch — specialization trees and legendary potential

* **Specialization slots and levels [S].** Maxroll (maxroll.gg/last-epoch/resources/passives-and-skills): up to 5
  specialized skills, matching the 5 bar slots; specialization slots unlock at character levels 4, 8, 20, 35, 50; skills
  gain XP and level to a default cap of 20 (reached around character level 75); items can raise skill levels; respec of
  a skill restarts it at a minimum level that rises with character level (cap 10). Passive trees: one point per level from
  level 3 plus up to 15 from quests, 113 total; a base class tree plus three mastery trees.
* **Node structure [S/SN].** A skill tree starts from the base skill and branches; nodes add damage, change damage type,
  add effects (e.g. stuns), change cost or cooldown, and some major nodes change a skill's core function (single target to
  multishot); powerful nodes need investment in preceding nodes [S, ludo.guide "skill trees explained"]. Nodes with ranks
  in the form "0/3" appear in community examples [SN, forum.lastepoch.com]; a tree holds more nodes than a skill's points
  can buy [K, follows from the level cap of 20].
* **Pattern used:** Hearthfall's 6-node trees with ranks 1–3, prerequisites (N4–N6 need 2 ranks above) and a 10-of-18 rank
  cap per skill [P], plus "at most one plain-number node", follow this structure at a third of the size so a tree fits on
  one page without scrolling (plan §3.3).
* **Legendary potential [SN].** Last Epoch makes a "legendary" by merging a unique (with 1–4 legendary potential) and an
  exalted item in the Temporal Sanctum's Eternity Cache; potential sets how many affixes transfer; high-powered uniques
  rarely roll potential (search results incl. support.lastepoch.com and Maxroll). Pattern noted, not used in M1: power
  and flexibility can be traded off on the same item.

## 4. How the reference games handled set dominance

* **Diablo III's own history [S/SN].** The 2.4.0 PTR notes show the ring set *Legacy of Nightmares* redesigned as a
  "no set" option: its bonus applies only when it is the only set bonus and grows per Ancient item; the figure in the
  notes changes from 800% to 100% per item [S]. Search summaries: the designer said the higher number was a test-server
  experiment and later seasons used other values (750% in 2.6.5) [SN, mein-mmo, Blizzplanet]. Patch 2.6.6 moved the
  same idea into a legendary gem (Legacy of Dreams: 3.75% per equipped legendary while no set bonus is active, scaling
  with gem rank) [SN, Icy Veins guides and Blizzard forum]. Plan §1 also cites a Hydra patch note tilting power "toward
  the 6-piece and away from supplemental legendaries" and a thread on set-vs-non-set gaps [SN].
  → Hearthfall: **Patchwork Signet** (no-set bonus, 2–3% per legendary, capped at 10) [P].
* **Diablo IV [S].** Icy Veins (wp-prod mirror of "Diablo 4 Devs Explain How Sets Will Avoid Diablo 3's Biggest
  Mistake"): sets return as *charms socketed into a Talisman*, so they do not occupy armour slots; smaller combinations
  such as 2/2/2 are allowed; the outlet says sets dominated D3's meta with rigid high-multiplier builds; the developers
  want sets to change how a build plays rather than add "billion-percent multipliers". Earlier, D4's game director said
  sets would not be in the launch version [SN].
  → Hearthfall: 6-pieces become **transforms with a small multiplier**; value moves to the 2- and 4-piece so a hybrid is
  a real option; three sets use a different slot footprint (`ITEMS-SHARED.md` §4) [P].
* **Diablo IV's Codex of Power [SN].** Aspects are extracted from legendaries and imprinted on other items; since Season 4
  salvaging unlocks the aspect in the Codex permanently; Codex aspects apply at their *minimum* roll and aspects do not
  stack (GamesRadar, Game8, GGRecon summaries). Opposite of D3's max-roll Cube; Hearthfall keeps its existing max-roll
  Cube [M] and the parity model assumes it (`BUDGET.md` §2).

## 5. What Hearthfall took, and what it deliberately did not

| Pattern | Reference | Hearthfall M1 decision |
|---|---|---|
| Categories of 3–5 skills, primaries generate, spenders spend | D3 class pages [S] | 5 display categories per class; one new primary per class [P] |
| Five runes per skill that change element or behaviour | D3 [S] | 5 runes everywhere; new runes follow the existing rune magnitudes [P] |
| Per-skill specialization tree with ranks and prerequisites, capped | Last Epoch [S/SN] | 6 nodes × 3 ranks, 10-rank cap, separate points from L10 [P] |
| Support gems (5 per skill) | PoE [S] | not in M1 (plan recommends M2 via the existing gem sockets) |
| "More" multipliers sized by opportunity cost | PoE manifesto summary [S, secondary] | `skillMore` 25–40% conditional; 6-piece ×1.25 [P] |
| Mix-and-match legendary powers, max roll, one per category | D3 Cube [SN] | already in the game [M]; parity assumes it |
| No-set fallback bonus | D3 Legacy of Nightmares / Dreams [S/SN] | Patchwork Signet, small (2–3% per item) [P] |
| Sets outside armour slots; 2/2/2 combinations | D4 Talisman [S] | not adopted (a new item system); instead alternative footprints and front-loaded 2/4-pieces [P] |
| Legendary potential trade-off | Last Epoch [SN] | noted for M2 |

## 6. Sources

* Blizzard, Diablo III class pages: [Barbarian actives](https://eu.diablo3.blizzard.com/en-us/class/barbarian/active/),
  [Barbarian passives](https://eu.diablo3.blizzard.com/en-us/class/barbarian/passive/),
  [Demon Hunter actives](https://eu.diablo3.blizzard.com/en-us/class/demon-hunter/active/),
  [Wizard actives](https://eu.diablo3.blizzard.com/en-us/class/wizard/active/) — [S]
* Blizzard, [Patch 2.4.0 PTR notes](https://news.blizzard.com/en-gb/article/19941042/patch-2-4-0-ptr-patch-notes) — [S]
* Grinding Gear Games, [Path of Exile game overview](https://www.pathofexile.com/game) — [S]
* GameBanshee, [Path of Exile: Expedition — Game Balance Overview](https://www.gamebanshee.com/af448) — [S] secondary
  summary of the developer post
* Path of Exile forum, [Additive and Multiplicative modifiers](https://www.pathofexile.com/forum/view-thread/892570) — [SN]
* Maxroll, [Last Epoch passives and skills](https://maxroll.gg/last-epoch/resources/passives-and-skills) — [S]
* Ludo.guide, [Last Epoch skill trees explained](https://www.ludo.guide/guide/last-epoch/characters-builds/skills-specializations/skill-trees-explained) — [S]
* Last Epoch support, [Legendary Items](https://support.lastepoch.com/hc/en-us/articles/46361924310555-Legendary-Items);
  Maxroll [legendary crafting guide](https://maxroll.gg/last-epoch/resources/legendary-items-crafting-guide) — [SN]
* Icy Veins, [Diablo 4 devs explain how sets will avoid Diablo 3's biggest mistake](https://wp-prod.icy-veins.com/diablo-4-devs-explain-how-sets-will-avoid-diablo-3s-biggest-mistake/) — [S]
* Search summaries for Kanai's Cube (patch 2.3.0: Blizzplanet, PCGamesN, GameWatcher), Legacy of Dreams (Icy Veins,
  Blizzard forums, mein-mmo), Legacy of Nightmares PTR values (mein-mmo, Blizzplanet) and the D4 Codex of Power
  (GamesRadar, Game8, GGRecon) — [SN]
* Existing plan evidence carried over: `docs/rework/ITEMS-AND-SKILLS-PLAN.md` §1 (D3 counts, PoE gem/unique counts, D3
  patch-note quotes) — labels as given there.
