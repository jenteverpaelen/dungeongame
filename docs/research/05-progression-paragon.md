# Leveling Curves, Paragon Systems & Endgame Progression

**Research Date:** October 2026  
**Focus:** AAA ARPG endgame progression design for browser/Steam 2D MMO ARPG

---

## Executive Summary

This dossier consolidates concrete progression mechanics and formulas from Diablo 3 (industry gold standard), Diablo 4, Path of Exile, Last Epoch, Grim Dawn, and incremental games (Legends of Idleon, Task Bar Hero, Melvor Idle). The goal: arm your 2D browser/Steam MMO ARPG with proven, verifiable progression architecture that sustains 200+ hours of compelling endgame grind without artificial gatekeeping.

**Key Finding:** The Diablo 3 model (level 1-70 campaign; account-wide infinite Paragon system) remains the benchmark for post-launch retention. However, modern alternatives (D4's boardless scaling, PoE's prestige-free tree, idle games' prestige loops) offer valuable lessons on pacing and meaningful power separation.

---

## 1. Diablo 3: Level 1-70 & Paragon System 2.0

### 1.1 Campaign Leveling (Level 1-70)

Diablo 3 uses **piecewise quadratic scaling** for campaign XP, not pure exponential. Critical thresholds:

| Level Range | XP Per Level Pattern | Notes |
|---|---|---|
| 1-10 | ~280 to 19,200 | Rapid early progression |
| 11-30 | ~22,100 to 115,200 | Linear acceleration |
| 31-50 | ~122,100 to 2,080,000 | Steeper quadratic rise |
| 51-60 | 3,180,000 to 20,150,000 | Exponential kickoff |
| 61-70 | 27,000,000 to 82,600,000 | Maximum campaign difficulty |

**Total campaign XP to level 70:** ~581.6 million XP [source: diablowiki.net]

**Typical campaign time:** 6-8 hours for new players; 3-4 hours optimized; veterans sub-3 hours with powerleveling.

**Design insight:** Levels 1-50 teach systems; 51-70 separate commitment from casuals. By level 70, players have full kit and begin itemization focus.

### 1.2 Paragon System 2.0 (Account-Wide, Post-Level 70)

After hitting level 70, all XP feeds into **Paragon levels** (no hard cap). This is the 200+ hour endgame sink.

#### Paragon Structure

Four independent categories, each allowing 50 points (up to 200 per category in patch 2.7.6):
- **Core:** +5 Mainstat, +5 Vitality, +0.5% Movement Speed (capped 25%)
- **Offense:** +0.2% Attack Speed (max 10%), +2% Cooldown Reduction (max 10%), +0.1% Crit Chance (max 5%), +1% Crit Damage (max 50%)
- **Defense:** +0.5% Life (max 25%), +0.5% Armor (max 25%)
- **Utility:** +1% Area Damage (max 50%), +0.2% Resource Cost Reduction (max 10%), +82.5 Life on Hit (max 4,125), +1% Gold Find (max 50%)

[source: diablowiki.net/Paragon_points]

#### Paragon XP Scaling Formula

Diablo 3 uses **piecewise quadratic progression** with three distinct phases:

| Paragon Level Range | XP Formula / Behavior |
|---|---|
| 1-750 | Linear scaling; very fast to grind through |
| 750-2,250 | Linear but accumulative; total XP doubles roughly every 50 levels |
| 2,250+ | Exponential scaling; trillions of XP required per level |
| 800+ (Flat Phase) | **122,400,000 XP per level** (constant, infinite) |

**Key Formula (800+):** Once past Paragon 800, Blizzard implemented a **flat 122.4M XP per level** to prevent exponential explosion. This keeps late-game grinding linear and predictable.

**Account-Wide:** All characters share Paragon progression, incentivizing alts while maintaining single-character focus for seasons.

[source: everycalculators.com/paragon-calculator-diablo.html]

---

## 2. Diablo 3: Greater Rifts & Scaling

### 2.1 Monster Scaling per Greater Rift Tier

Greater Rifts (GRs) are infinite difficulty tiers. Monster scaling is exponential per tier:

#### Monster HP Multiplier per Tier
- **Per tier:** +17% (×1.17 HP)
- **Every 4.5 tiers:** 2× total HP
- **Every 10 tiers:** 4.81× total HP
- **Formula:** `Monster_HP(GR_n) = Base_HP × (1.17 ^ n)`

#### Monster Damage per Tier (Piecewise)
- **GR 1-25:** ×1.13185 per tier (~13% increase)
- **GR 26-70:** ×1.07177 per tier (~7% increase)
- **GR 71-150:** ×1.02337 per tier (~2.3% increase)

This flattening at high GRs prevents one-shots while keeping scaling meaningful.

[source: maxroll.gg/d3/resources/greater-rift-explained]

### 2.2 Legendary Gem Upgrade Probability

Players upgrade gems by running GRs and attempting rank-ups. Success rates are tied to GR tier vs. gem rank:

| Tier Difference | Upgrade Chance |
|---|---|
| +10 or higher | 100% |
| +9 | 90% |
| +8 | 80% |
| +7 | 70% |
| +6 to 0 | 60% |
| -1 | 30% |
| -2 | 15% |
| -3 | 8% |
| -4 | 4% |
| -5 | 2% |
| -6 to -15 | 1% |
| -16 or lower | 0% |

**Per GR:** 3 base attempts + 1 for no-death + 1 for empowerment = 5 attempts maximum.

**Design insight:** This creates a "push level" where gems slow to 60% success and players must optimize builds or push higher GRs.

[source: maxroll.gg/d3/resources/legendary-gem-mechanics]

### 2.3 Season Journey & Haedrig's Gift

Diablo 3 seasons last ~3 months. Progression:

- **Chapter 1-3:** Story/exploration tasks; unlock Haedrig's Gift pieces progressively
- **Chapter 4:** Solo GR 20 completion; final 2 set pieces (huge power spike)
- **Chapter 5-7:** Bonus chapters (cosmetics; 80+ paragon, 500+ paragon, 1000+ paragon milestones)

**Set Piece Timing:** By chapter 4, players have 6-piece set gear, enabling viable endgame builds within ~10-15 hours. This "soft cap" at 6-piece ensures seasonal ladders aren't dominated by pure grind.

[source: maxroll.gg/d3/resources/haedrigs-gift-gr20-guide]

---

## 3. Diablo 4: Paragon Boards & Glyphs (Post-Level 100)

Diablo 4 departs from D3's simpler Paragon system, introducing **Paragon Boards** (limited-board system) and **Glyphs** (upgrade gems).

### 3.1 Paragon Boards Structure

- **Start at level 50**, unlock boards at level 70 (post-campaign)
- **5 boards available** per character (vs. D3's unlimited)
- **Board nodes:** Stat boosts (+Str, +Dex, +Vit, +Willpower) and **sockets for Glyphs**
- **Glyph radius:** Each glyph influences a 1-5 node radius; passive skills within radius are boosted

**Design advantage:** Fewer boards = clearer power ceiling at endgame, preventing D3-style infinite stat sprawl.

### 3.2 Glyph Leveling & Upgrade Mechanics

Glyphs level via **Pit Tiers** (D4's endgame corruption mechanic):

| Pit Tier vs Glyph Rank | Upgrade Chance |
|---|---|
| +10 or higher | 100% |
| +9 to +6 | 90%-60% (scaling) |
| Equal to Glyph Rank | 60% |
| -1 to -5 | 30%-2% (scaling) |

**Per Pit:** 3 attempts + 1 for no-death = 4 max.

**Power scaling milestones:**
- **Rank 15:** Glyph radius expands to 4 nodes
- **Rank 46:** Tertiary "Legendary" bonus unlocks; radius maxes at 5 nodes
- **Infinite rankup:** No soft cap; Legendary bonus scales with glyph level

**Time to max Paragon 300:** ~120-240 hours (grouping vs. solo).

[source: maxroll.gg/d4/resources/paragon-boards]

---

## 4. Path of Exile: Passive Tree & Ascendancy

### 4.1 Passive Skill Tree

PoE's tree is **massive and open,** with all classes using one shared network:

- **Total passive nodes:** 1,500+
- **Typical allocation:** 120-150 points (soft budget)
- **Per level:** +1 passive point from leveling + quest rewards (3 total from storyline)
- **Max realistic tree:** 190-200 points with all quests

**Design principle:** Unlike D3 (fixed categories), PoE lets players path freely toward any attribute cluster. This creates build diversity but requires careful mastery node placement.

### 4.2 Ascendancy Classes

After defeating the final boss (Act 10), players unlock **Ascendancy specialization:**

- **7 ascendancies per class**; pick 1 that grants 2-3 mega-passives
- **Ascendancy passives:** 5-8 nodes worth hundreds of points of passive value
- **Account-wide quest:** "Eternal Labyrinth" repeatable endgame dungeon; completing it grants ascendancy respec

**Power scaling:** Ascendancy bonuses often 10-20× more impactful per point than normal passives. Alignment with tree allocation is key.

[source: pathofexile.fandom.com/wiki/Ascendancy_class]

### 4.3 Level 100 XP Penalty Curve

Reaching level 100 is the "prestige" level cap. XP requirements explode exponentially:

**Safe Zone Formula:**
```
Safe_Zone = floor(3 + Player_Level / 16)
```

For level 99-100, safe zone = floor(3 + 99/16) = 9 levels below = can farm level 90 content at zero penalty.

**XP Penalty Multiplier (above safe zone):**
```
Penalty = ((lvl + 5) / (lvl + 5 + (effective_diff ^ 2.5))) ^ 1.5
```
Where `effective_diff = max(0, monster_level - safe_zone - player_level)`

**Practical numbers:**
- Level 99→100: ~5-10 billion XP (depending on content difficulty)
- Typical path: Farm level 83-86 content (maps) for 100-200M XP/hour
- **Time to 100:** 50-200+ hours (casual vs. hardcore farming)

[source: pathofexile.fandom.com/wiki/Experience]

---

## 5. Last Epoch: Passives, Mastery & Monolith Scaling

### 5.1 Passive Tree & Leveling

Last Epoch is a "middle ground" between PoE (open tree) and D3 (fixed categories):

- **Max level:** 100 (current; may increase post-1.0)
- **Passive points:** 1 per level starting at level 3 = 98 total + 15 from quests = **113 total points**
- **Base tree + 3 Masteries:** Each class has 4 skill trees total

### 5.2 Mastery System

After spending **20 points in base tree**, players unlock **3 mastery specializations:**

- **Mastery quest** (Act 4 / Chapter 4): Unlocks ability to ascend
- **Ascend at level 25:** Lock into 1 of 3 masteries permanently
- **Post-ascension:** Continue investing in chosen mastery tree until level 100

Each mastery offers different gameplay styles, scaling passives, and power levels. Unlike D4 (optional boards), mastery choice is irreversible and fundamental to identity.

### 5.3 Endgame Scaling: Monolith of Fate

Last Epoch's endgame replaces traditional "higher difficulties" with **Monolith tiers:**

- **Corruption system:** Add corruption "levels" to Monoliths to scale monster power
- **No explicit paragon equivalent:** Power comes from gear + passive tree optimization + corruption pushes
- **Scaling:** Exponential corruption multiplier (details in patch 0.7.9+)

[source: lastepoch.fandom.com/wiki/Passives]

---

## 6. Grim Dawn: Devotion System

### 6.1 Devotion Points & Constellation Map

Grim Dawn's endgame is **horizontal (not vertical) progression:**

- **Max devotion points:** 55 per character (base) / 65 (with expansions)
- **Shrines scattered worldwide:** 50+ discoverable shrines grant 1 point each
- **Shrine types:** Ruined (defeated waves) and Desecrated (item offerings)

### 6.2 Constellation Network

105 unique constellations organized by affinity:

| Affinity | Color | Theme |
|---|---|---|
| Ascendant | Purple | Support/buffs |
| Chaos | Red | Damage/DoT |
| Eldritch | Green | Sustainability/regen |
| Order | White | Defense/buffs |
| Primordial | Blue | Utility/procs |

**Progression rules:**
- Lower-tier constellations must be unlocked first
- Affinity "req" gates access (need 2+ blue affinity to unlock tier-2 blue)
- Bridge nodes may be removed later via Spirit Guide NPC

**No exponential scaling:** Devotion is a **one-time system** (no respec cost); power comes from gear and skill choice, not prestige loops.

[source: shapes.inc/fandom/grim-dawn/devotion-and-constellations]

---

## 7. Idle & Incremental Game Progression

### 7.1 Legends of Idleon: Talent Points & Star Talents

Idleon is a **hybrid idle + active ARPG** (browser/mobile) heavily influencing Task Bar Hero's design:

- **Talent points:** 1 per level (no cap mentioned; presumably 100+)
- **Talent tree:** Multiple branches per class; gated progression (spend points in lower tiers to unlock higher)
- **Star talents:** Special high-impact passives (Tick Tock adds AFK gains, Crystals 4 Dayys spawns resources)

**Key mechanic:** Players invest heavily in AFK generation talents early, then shift to damage/efficiency talents.

[source: idleon.guide/star-talents/]

### 7.2 Task Bar Hero: Leveling Points & Skill Tree

TBH directly mirrors D3 aesthetics but with **Idleon-style automation:**

- **Skill points:** 1 per level (cap at hero level 80+, likely)
- **Skill tree tiers:** 1st tier open from start; tier 2 requires 10 points spent in tier 1; tier 3 requires 20 spent, etc.
- **Free respec:** Reset at no cost to experiment with builds
- **Heroes:** Knight, Ranger, Sorcerer, Priest, Hunter, Slayer (6 distinct classes with unique skill trees)

**Hero-dric Cube** (inspired by D3's Cube):
- **Synthesis:** Combine 9 items same rarity → 1 higher rarity
- **Offering:** Random item for currency
- **Engraving/Inscription:** Add affixes at levels 15/25+
- **Level range selection:** Craft items for specific level brackets (1-10, 10-20, etc.)

**Progression timeline:** 1-80 in ~20-30 hours for committed players; infinite seasonal grind thereafter.

[source: taskbarherowiki.com/heroes]

### 7.3 Melvor Idle: Experience Table & Mastery

Melvor Idle is a **RuneScape-inspired idle game** (browser/Steam):

- **Max level:** 99 (base game) / 120 (expansion) / 60 Abyssal levels (Into the Abyss)
- **XP scaling:** Non-linear; experience doubles ~every 7 levels
- **Formula:** XP between levels 92-99 equals XP between 1-92 (logarithmic compounding)
- **Mastery parallel:** Each skill has separate Mastery levels (same XP curve as skill levels)

**Progression design:** Player alternates between skill levels (unlock new content) and mastery levels (optimize production speed). This "horizontal + vertical" layering prevents single-skill monotony.

[source: wiki.melvoridle.com/w/Experience_Table]

### 7.4 NGU Idle: Linear (Not Exponential) Leveling

**NGU (Numbers Go Up)** uses counter-intuitive linear scaling:

- **NGU level cost:** Level N→N+1 costs N+1× the time of 0→1
- **If 0→1 = 1 day:** Then 1→2 = 2 days, 2→3 = 3 days, 3→4 = 4 days (quadratic total cost)
- **At level 100M:** 24 hours of maximum leveling speed = <5% progress to next level

**No exponential penalty curve** like PoE/D3; instead, strategic player choice on when to prestige (soft reset).

[source: ngu-idle.fandom.com/wiki/New_Player_Guide_(Truth)]

### 7.5 Vampire Survivors: Wave-Based Power-Up Progression

Vampire Survivors is a roguelike, but its **leveling + passive power-up system** mirrors ARPG design:

- **On levelup:** Choose 1 of 3-4 weapons/passives
- **XP requirements:** Increase per level; exponential curve common to roguelikes
- **Cap:** 6 weapons + 6 passives fully upgraded = soft ceiling
- **Post-cap:** Levelups grant gold or "floor chicken" (prestige mechanic)
- **Priority passives:** Growth (↑XP), Magnet (pull XP), Might (↑damage), Revival (survivability)

Key insight: **Even roguelikes** use passive grind mechanics; ARPG design is invasive.

[source: vampire.survivors.wiki/w/Level_up]

---

## 8. Mathematical Design Principles

### 8.1 Exponential vs. Polynomial Curves

| Curve Type | Formula | Growth Speed | Use Case |
|---|---|---|---|
| **Linear** | `y = x` | Constant (+1 per level) | Rare; boring |
| **Polynomial (Quadratic)** | `y = x^2` | Moderate acceleration | Early-mid game (Diablo 1-50) |
| **Polynomial (Cubic+)** | `y = x^3` or higher | Steep mid-game | High-engagement grind (D3 51-70) |
| **Exponential** | `y = a × b^x` | Extreme late-game | Paragon/Seasonal (D3 800+) |

**Key formula for game progression:**
```
Required_XP = Base × (Multiplier ^ Level)
```

Example: Diablo 3 Paragon early (1-750) uses ~1.10 multiplier per level; late (800+) uses flat 122.4M (multiplier ≈ 1.0).

### 8.2 Anthony Pecorella's "Math of Idle Games" (GDC 2015-2016)

Pecorella's framework (Kongregate Blog, GDC Europe 2016) established idle game balancing:

**Core Thesis:** Incremental games succeed when progression formulas allow **compounding without exponential explosion.**

**Key principles:**
1. **Growth rate (r):** Typical range 1.1-1.5 per level (10%-50% increase)
2. **Soft caps:** Introduce flat costs at high levels to prevent runaway
3. **Prestige multiplier:** Reset grants ~1.2-3.0× faster regrowth (incentivizes reset)
4. **Milestone rewards:** Unlock new mechanics every 10-20 levels to refresh engagement

**Application to ARPG:** D3's flat Paragon 800+ cost (122.4M) is a **soft cap,** preventing exponential explosion while keeping endgame infinite.

[source: media.gdcvault.com/gdceurope2016/presentations/Pecorella_Anthony_Quest%20for%20Progress.pdf]

### 8.3 Power Creep & Mitigation

Power creep = new content/items gradually inflate power ceiling, breaking balance.

**Mitigation strategies (per Bruno Dias, GDD design blog):**

1. **Horizontal progression:** Add abilities/playstyles instead of pure stat bumps
2. **Rotation systems:** Old content phases out as new arrives (Magic: The Gathering)
3. **Stat squish:** Blizzard's approach; reset all stats every 2-3 years
4. **Prestige loops:** Incremental games; permanent bonuses vs. temporary power
5. **Challenge caps:** Introduce "hard" content that requires skill, not just stats (GRs, Pits)

**For your MMO:** Combining horizontal (build variety) + vertical (Paragon) progression, with seasonal resets, mitigates creep.

---

## 9. Design Implications for Our Game

### 9.1 Recommended Level Cap & Paragon Design

**Proposal for your 2D browser/Steam ARPG:**

1. **Campaign (1-70):** Piecewise quadratic curve (matching D3)
   - Levels 1-40: ~1-3 hours (teach mechanics, gear up)
   - Levels 41-60: ~2-4 hours (introduce endgame dungeons)
   - Levels 61-70: ~3-6 hours (final set pieces, first paragon prep)
   - **Total:** 6-13 hours for campaign

2. **Paragon System (Post-70, Account-Wide):**
   - **Soft cap:** Paragon 500 (meaningful ceiling for seasons)
   - **Hard cap:** None (infinite grind for hardcore)
   - **Early Paragon (1-200):** 1.12× multiplier per level (~10-15 hours)
   - **Mid Paragon (201-500):** 1.05× multiplier (~50-80 hours)
   - **Late Paragon (501+):** Flat cost per level (e.g., 15B XP/level, ~200-300 hours from 500→750)

3. **Legendary Gem Equivalent (Power Vertical Loop):**
   - Use D3's probability model: success rates tied to content tier vs. gem rank
   - 3 base attempts + 1 no-death + 1 empowerment = 5 max per run
   - Creates a "push level" where casual players plateau at 60% success

4. **Seasonal Structure:**
   - 3-month seasons; Haedrig's Gift equivalent (6-piece starter set by Week 1)
   - Chapter milestones: Chapters 1-4 (core story), 5-7 (bonus cosmetics/paragon thresholds)
   - Seasonal ladder resets every 3 months; characters roll into non-seasonal

### 9.2 Recommended XP Curves (Concrete Formulas)

**Campaign (Levels 1-70):**
```
Base_XP(L) = 300 × L^2.1    (for L ≤ 50)
Base_XP(L) = 300 × (L^2.1 + L^2.4)    (for L > 50)
```
Adjust multiplier (300) to target 6-13 hour campaign.

**Paragon (1-200):**
```
Paragon_XP(P) = 3M × (1.12 ^ P)    (P = paragon level)
```
Early Paragon doubles every ~6 levels.

**Paragon (201-500):**
```
Paragon_XP(P) = 150M × (1.05 ^ (P - 200))
```
Mid Paragon doubles every ~14 levels; slower grind.

**Paragon (501+):**
```
Paragon_XP(P) = 15B    (flat cost)
```
Late Paragon becomes linear grind, predictable and infinite.

### 9.3 Class-Specific Scaling (Inspired by Idleon & TBH)

- **Warrior:** +5% Mainstat/level, +1% Armor/level (tank scaling)
- **Ranged:** +5% Mainstat/level, +1.5% Attack Speed/level (DPS scaling)
- **Mage:** +5% Mainstat/level, +2% Cooldown Reduction/level (spell scaling)

These slight per-class biases encourage specialization while remaining viable.

### 9.4 Endgame Engagement Loop

1. **Weeks 1-2 (Campaign):** Speedrun to level 70; unlock first set pieces
2. **Weeks 2-4 (Early Paragon 1-50):** Soft-grind content tier 1-3; gem rank-ups to +50
3. **Weeks 4-12 (Mid Paragon 50-200):** Push GR/Pit equivalents; gem ranks 50-150+; seasonal cosmetics
4. **Weeks 12+ (Late Paragon 200+):** Infinite grind for cosmetics, leaderboard placement; consider seasonal reset

**Prestige hook:** At Paragon 500 (3-month season end), season ladder freezes; top 100 get exclusive cosmetics (mount, portrait frame, wing cosmetic). Restart on new season with 1.2-1.5× XP multiplier (prestige bonus).

---

## 10. Open Questions to Ask the User

Before finalizing mechanics, clarify:

1. **Seasonal Scope:** How many seasons annually? (D3: 4/year; D4: 1/year) Affects balance refresh pace.

2. **Solo vs. Group Endgame:** Is endgame purely solo-scalable (D3 GRs) or group-optimized (e.g., 4-player dungeons)? Affects multiplayer XP scaling.

3. **Prestige Reset Acceptance:** Do you want explicit "prestige loops" (Idleon-style, reset for permanent bonus) or seasonal soft-resets only?

4. **Cosmetic Tiers:** How many Paragon milestone cosmetics? (e.g., portrait frame every 100 Paragon; class-specific mount at Paragon 500)

5. **Endgame Challenge Type:** Pure DPS grind (D3/D4 GRs) or puzzle-like escalation (PoE unique maps)? Affects engagement variance.

6. **Class Balance Target:** Should all 3 classes (Warrior/Ranged/Mage) reach Paragon 500 in equal time, or allow class-specific meta (Warrior = tank = slower grind)?

7. **Cross-Game Trading Endgame:** Once players hit Paragon 200+, should trading allow "boosting" new alts (carry to level 70 in 2 hours)? Affects retention of alts.

8. **Legendary Gem Cap:** What's the soft cap on gem ranks? (D3: rank 200+ feasible; rank 400+ requires hardcore dedication) Affects high-end carrot.

---

## 11. Sources

### Official Game Documentation & Wikis

- [Diablo 3 Wiki - Experience Level Chart](https://www.diablowiki.net/Experience_level_chart)
- [Diablo 3 Wiki - Paragon Experience Charts](https://www.diablowiki.net/Paragon_experience_charts)
- [Diablo 3 Wiki - Paragon Points](https://www.diablowiki.net/Paragon_points)
- [Diablo 3 Wiki - Defense Tab](https://www.diablowiki.net/Defense_Tab)
- [Diablo 3 Wiki - Greater Rifts](https://www.diablowiki.net/Greater_Rifts)
- [Diablo 4 Fextralife Wiki - Paragon](https://diablo4.wiki.fextralife.com/Paragon)
- [Diablo 4 Fextralife Wiki - Glyphs](https://diablo4.wiki.fextralife.com/Glyphs)
- [Path of Exile Fandom - Experience](https://pathofexile.fandom.com/wiki/Experience)
- [Path of Exile Fandom - Ascendancy Class](https://pathofexile.fandom.com/wiki/Ascendancy_class)
- [Path of Exile Fandom - Passive Skill](https://pathofexile.fandom.com/wiki/Passive_skill)
- [Last Epoch Fandom - Passives](https://lastepoch.fandom.com/wiki/Passives)
- [Melvor Idle Wiki - Experience Table](https://wiki.melvoridle.com/w/Experience_Table)
- [Melvor Idle Wiki - Mastery](https://wiki.melvoridle.com/w/Mastery)
- [NGU Idle Fandom - New Player Guide](https://ngu-idle.fandom.com/wiki/New_Player_Guide_(Truth))
- [Vampire Survivors Wiki - Level Up](https://vampire.survivors.wiki/w/Level_up)

### Community & Creator Resources

- [Pure Diablo - Diablo 3's Paragon System 2.0 Clarifications](https://www.purediablo.com/blizzard-offers-diablo-3-paragon-2-0-clarifications)
- [Pure Diablo - Diablo 3's Paragon System 2.0 Answers & Questions](https://www.purediablo.com/diablo-3s-paragon-system-2-0-answers-and-questions)
- [Pure Diablo - Greater Rift Difficulty Scaling Chart](https://www.purediablo.com/greater-rift-difficulty-scaling-chart)
- [Icy Veins - Diablo 3 Season 40 Compendium](https://www.icy-veins.com/d3/season-40-compendium-for-diablo-3)
- [Icy Veins - Diablo 3 Farming/Upgrading Legendary Gems](https://www.icy-veins.com/d3/farming-upgrading-legendary-gems-and-crafting-normal-gems)
- [Icy Veins - Diablo 4 Season 9 Max 300 Paragon Level & Gear Guide](https://www.aoeah.com/news/4038--diablo-4-season-9-max-300-paragon-level--gear-guide)
- [Idleon Guide - Star Talents](https://idleon.guide/star-talents/)
- [Task Bar Hero Wiki - Heroes & Stats/Skills](https://taskbarherowiki.com/heroes)

### GDC & Academic Resources

- [GDC Vault - Quest for Progress: The Math and Design of Idle Games (Pecorella, GDC Europe 2016)](https://www.gdcvault.com/play/1023876/Quest-for-Progress-The-Math)
- [GDC Vault PDF - Quest for Progress Presentation](https://media.gdcvault.com/gdceurope2016/presentations/Pecorella_Anthony_Quest%20for%20Progress.pdf)
- [Archive.org - GDC 2015: Idle Games Presentation (Pecorella)](https://archive.org/details/GDC2015Pecorella)
- [Game Developer Magazine - The Math of Idle Games, Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- [Game Developer Magazine - Power Progression in Games](https://www.gamedeveloper.com/design/power-progression-in-games-crafting-rewarding-player-experiences)
- [Game Developer Magazine - Quantitative Design: How to Define XP Thresholds](https://www.gamedeveloper.com/design/quantitative-design---how-to-define-xp-thresholds-)

### Community Guides & Discussions

- [DEV Community - Progression Curves in Game Design](https://dev.to/sam_novak_574b07811e18495/progression-curves-in-game-design-why-good-systems-feel-invisible-and-bad-ones-feel-like-grind-26bo)
- [DEV Community - Curves Are the Real Game Design Language](https://dev.to/sam_novak_574b07811e18495/curves-are-the-real-game-design-language-and-most-broken-games-got-the-curve-wrong-4dg1)
- [Game Design Skills - Game Progression and Progression Systems](https://gamedesignskills.com/game-design/game-progression/)
- [Bruno Dias - On Power Creep](https://brunodias.dev/2021/11/27/power-creep.html)
- [MMORPG.com - How Does Power Creep Affect MMO Games?](https://www.mmorpg.com/editorials/how-does-power-creep-affect-mmo-games-2000130636)
- [Medium - Graphs for Player Progression Part I](https://medium.com/js-game-design-journals/graphs-for-player-progression-part-i-c56d83740450)
- [Incremental Atlas - Incremental Games with Deep Prestige Systems](https://incrementalatlas.com/mechanics/incremental-games-with-prestige/)

### Tools & Calculators

- [Every Calculators - Paragon Calculator Diablo](https://everycalculators.com/paragon-calculator-diablo.html)
- [Every Calculators - Diablo 3 Experience Calculator](https://everycalculators.com/diablo-3-experience-calculation.html)
- [West Games - PoE Experience Penalty Calculator](https://west-games.com/poe-experience-penalty-calculator/)
- [Omnicalculator - Exponential Growth Calculator](https://www.omnicalculator.com/math/exponential-growth)
- [Free XP Curve Generator — RPG Level Progression Calculator](https://tools.puida.com/creative/gamedesign/xp-curve-generator/)

---

## Appendix: Comparison Matrix

| System | Level Cap | Paragon/Endless | XP Formula | Time to Max | Soft Cap |
|---|---|---|---|---|---|
| **D3 (Legacy)** | 70 | Paragon 800 | Piecewise quadratic + flat | 200-400h | P800: 122.4M/lvl |
| **D4** | 100 | Paragon 300 | Exponential ~3%/lvl | 120-240h | P300: 1B XP |
| **PoE** | 100 | None (prestige item) | Exponential penalty | 50-200h | L100: -95% XP |
| **Last Epoch** | 100 | None | Linear-polynomial | 40-80h | L100 is hard cap |
| **Grim Dawn** | 85 | None (devotion is OTP) | Linear | 30-60h | Devotion: 55 points max |
| **Idleon** | 300+ | Infinite | Exponential ~1.3-1.5×/lvl | 500h+ | Prestige multiplier |
| **TBH** | 80+ | Seasonal | Exponential ~1.2×/lvl | 20-30h | None (seasonal reset) |

---

**End of Dossier**

*For questions on specific mechanics, formulas, or design trade-offs, refer to the relevant section and cited sources.*
