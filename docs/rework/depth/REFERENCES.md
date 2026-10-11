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
| Authoritative tags on skills, items keyed on tags | PoE gem tags [SN] | v2: 22 tags + elements; ~3/4 of new legendaries and every set bonus key off tags [P] |
| Set-reduction ring | D3 Ring of Royal Grandeur [SN/S] | v2: Journeyman's Ring [P] |
| Build tools (codes, dummies, loadouts, data export, opt-in API) | GW2, PoB, D3/D4 Armory, Data Dragon, PoE API [S/SN] | v2: `BUILD-TOOLS.md` [P] |

## 6. v2: how builds become emergent, and how build culture works

Owner direction for v2: do not pre-make builds; give players the means to find and share them (`BUILD-TOOLS.md`).

* **Tags are the language of discovery.**
  * PoE skill gems carry tags on the first line of their tooltip; tags group skills and are what effects such as "+1
    level of socketed X gems" target [SN, PoE wiki "Gem tag"].
  * The wiki warns that tags do not fully define which supports apply [SN]. A forum example shows a support with the
    Attack tag working only with Attack skills, and some effects adding hidden tags [SN].
  * Lesson: if tags drive items, they must be *authoritative* — what the tooltip shows is exactly what an item checks.
  * Hearthfall's tag vocabulary is in `ITEMS-SHARED.md` §1.
* **Mix-and-match powers instead of fixed packages.**
  * D3's Kanai's Cube [SN, §1] and D4's Codex of Power both detach powers from items. In D4, aspects are salvaged into a
    codex, imprinted onto rares or legendaries, never stack, and codex copies sit at the minimum roll [SN, §4].
  * Last Epoch's legendary potential merges a unique with an exalted item's affixes. High-power uniques rarely roll
    potential [SN, §3]: power is traded for flexibility on the same item.
  * Lesson: generic, combinable powers create more builds than named-skill ones. Hence about three-quarters of the new
    legendaries key off tags (`ITEMS-SHARED.md` §2, class docs §8).
* **Community build culture runs on data the game exposes.**
  * Path of Building:
    * it is an MIT-licensed offline planner that computes offence/defence and shows how each stat is derived [S, GitHub];
    * it imports characters, passive-tree links and pasted items;
    * builds are shared as a code [S].
  * poe.ninja reads characters whose profiles are public; one of its endpoints is undocumented and broke once [SN].
    Grinding Gear Games' official API is OAuth 2.1 with scopes and a non-affiliation rule [S].
  * Last Epoch's community planner shares builds by link and can import online characters by account name [SN].
  * D3 had a public community API with hero profiles (equipped items, skills) [SN]. World of Warcraft's profile API feeds
    sites like Raider.IO [SN].
  * Guild Wars 2 encodes builds as chat links that can be pasted and applied in game, and offers player-created API keys
    with scopes that can be revoked [S, GW2 wiki].
  * Lesson: build sites need (1) stable ids, (2) a shareable build code, (3) opt-in character data, (4) static game data.
    Without official data the community scrapes game files: RePoE/PyPoE are reported unmaintained [SN].
* **Testing in game.**
  * D4 has town training dummies with Normal/Elite/Boss settings. Its "Advanced Tooltip Info" shows the percentages and
    "Advanced Tooltip Compare" lists every gained/lost effect [SN].
  * Grim Dawn players ask for a running-total dummy and one that hits back; its sheet DPS covers only the left-click skill
    [SN].
* **Loadouts and respec.**
  * D3 Armory (patch 2.5.0): gear, gems, skills and Cube powers, not Paragon [SN].
  * D4 Armory (Season 7): 5 loadouts, free switching in town, no combat [SN].
  * Respec costs: PoE2 gold per passive [SN]; PoE1 Orbs of Regret, later gold [SN]; Last Epoch gold per passive point
    with a permanent mastery [SN].
* **Leaderboards.** D4 Pit leaderboards drive public "top build" analyses [SN]; poe.ninja turns ladder characters into build
  statistics [SN].
* **Static data.**
  * Riot's Data Dragon publishes versioned static data per patch with `versions.json` and the version in every URL [S].
  * GGG publishes only its passive tree exports [S].
  * poe.ninja built a passive-tree version diff tool [SN]. No reference game I checked publishes structured patch notes
    [K].

## 7. v2: set structures — keep 2/4/6, fewer pieces, or a reduction ring?

| Option | Reference | For | Against |
|---|---|---|---|
| Keep 2/4/6 in armour slots | D3 class sets [S/SN §1]; Hearthfall today [M] | save data, gear visuals (sigil sockets light per piece [M, gear DESIGN §2]) and code already assume it | locks six slots; drove D3's set dominance [S/SN §4] |
| Small sets / 2-2-2 outside armour | D4 Talisman charms, 2/2/2 allowed [S §4] | mixing is the default | a new item system and slot type; the D4 numbers were not yet public [S] |
| Set-reduction ring | D3 Ring of Royal Grandeur: set bonuses need one fewer item, minimum 2 [SN]; Season 16 gave its power to all seasonal players to let classes combine set bonuses or add a legendary power and to encourage experimentation [S, Blizzard news] | turns 2/4/6 into 5+1 or 3+3 (two 4-piece bonuses), costs a jewelry slot, cheap to build | can become a must-have for set users |

Decision (with the parity model, `BUDGET.md` §4):
* keep 2/4/6;
* make every bonus tag-keyed, so a set fits several skills;
* front-load the 2- and 4-piece;
* add one shared set-reduction ring (Journeyman's Ring).

In the model the ring is used in 6–8 of 11 top kits for ranger/mage. That is a watch item, not a dominance flag.

## 8. v2: top item tiers in other games (replacing Ancient / Primal)

* **D3:** Ancient (+30% to affixes and weapon damage) and Primal Ancient (all rolls maximum) [K]. Hearthfall copies this
  as `ANCIENT_MULT = 1.3` and max rolls at grade 2 [M].
* **D4:**
  * Ancestral item power range at endgame [SN] and Greater Affixes at 1.5× an affix [SN].
  * **Mythic Uniques** sit at the top. Their definition changed across seasons; one report says max rolls and stronger
    unique powers [SN]. They were 0.25% of drops in one community tracking run [SN].
* **Last Epoch:** Primordial Uniques and Primordial Exalted items (Season 3, 2025). Transformative effects, limited to
  **one equipped**, bought with rift-beast materials or dropped [SN].
* **Grim Dawn:** Legendary is the top gear rarity; **Mythical** is a relic tier above Empowered and Transcendent [SN].
* **Lost Ark:** rarity ladder Common → Relic, then Ancient; separately a 1–100 *grade* rolled per item [SN].
* **PoE:** corrupted/mirrored item states and influence types rather than a quality tier [K].

Name check: "Mythic" is D4's top-tier name (and "Mythical" Grim Dawn's), so "Mythic items" would read as a D4 copy. Two
searches found no ARPG/MMO using **"Kindled"** or **"Fabled"** as a tier name [SN; "Fabled" appears only as an item-name
prefix in one shooter]. The concept chosen (breadth, not depth) is in `ITEMS-SHARED.md` §7.

## 9. v2: privacy

GDPR Art. 25 "Data protection by design and by default", paragraph 2: by default, measures must ensure personal data are
"not made accessible without the individual's intervention to an indefinite number of natural persons" [S,
gdpr-info.eu]. This governs public profiles, APIs and leaderboards (`BUILD-TOOLS.md` T6, T9).

## 10. Sources

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
* v2 — [S]:
  * Blizzard Diablo III active-skill pages for all seven classes (skills and runes, used for `NAMES.md`);
  * [Path of Building (GitHub)](https://github.com/PathOfBuildingCommunity/PathOfBuilding);
  * [PoE developer docs](https://www.pathofexile.com/developer/docs) and [data exports](https://www.pathofexile.com/developer/docs/data);
  * [Riot Data Dragon](https://developer.riotgames.com/docs/lol);
  * [GW2 chat link format](https://wiki.guildwars2.com/wiki/Chat_link_format) and [API key](https://wiki.guildwars2.com/wiki/API:API_key);
  * [Season 16: The Season of Grandeur](https://news.blizzard.com/en-us/article/22820656/season-16-the-season-of-grandeur-is-now-live);
  * [GDPR Art. 25](https://gdpr-info.eu/art-25-gdpr/).
* v2 — [SN] search summaries:
  * builds and tools: poe.ninja, D3/D4 Armory, D4 dummies and tooltips, Grim Dawn dummies, Ring of Royal Grandeur,
    Last Epoch respec/Primordial/planner, PoE gem tags and respec;
  * data and APIs: D3/WoW/Raider.IO APIs, RePoE;
  * top tiers: D4 Ancestral/Mythic, Grim Dawn relics, Lost Ark grades, and the "Kindled"/"Fabled" name checks.
