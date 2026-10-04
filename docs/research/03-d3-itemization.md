# Diablo 3 Loot 2.0 Itemization Deep Dive

**Research Date:** October 2026  
**Focus:** Diablo 3: Reaper of Souls (2013+), Loot 2.0 system mechanics, verified drop rates, formulas, and economics.

## Executive Summary

Diablo 3's Loot 2.0 (introduced May 2014) revolutionized itemization by replacing the auction house with intelligent loot generation, build-defining legendary powers, and multiplicative damage systems. This research covers rarity tiers, affixes, Kanai's Cube crafting, the Mystic enchanting system, legendary gems, damage formulas, and toughness calculations—with real numbers verified from official sources, wikis, and datamined values. Key lesson: Loot 1.0's auction house short-circuited the core reward loop; Loot 2.0 returned progression to monster kills and grinding.

---

## Part 1: Loot 2.0 Overview & History

### Why Loot 2.0 Was Necessary

**Loot 1.0 Problems (2012–2014):**
- Auction house (both gold and RMAH) made it faster/cheaper to buy items than farm them
- Relegated legendary drops to irrelevant status; killing monsters was economically irrational
- Created inflation, fraud, and third-party RMT incentives
- Former director Jay Wilson: the AH "really hurt the game"
- Announced removal August 2013; both AHs shut down March 2014

**Loot 2.0 Solution (May 2014):**
- Intelligent itemization: ~85% of drops roll affixes relevant to the character class
- Removed trading (items bind on enchant/use), eliminating RMH viability
- Introduced legendary powers—unique abilities that define builds
- Made monster killing the optimal progression path
- Result: legendary items became worthwhile, seasonal ladders competitive

---

## Part 2: Rarity Tiers & Drop Rates

### Item Rarities (Bottom-Up)

| Rarity | Color | Notes |
|--------|-------|-------|
| **Normal** | White | Junk; never crafted/gambled |
| **Magic** | Blue | 2 affixes; occasional crafts |
| **Rare** | Yellow | 4–6 affixes; craftable (Hope of Cain) |
| **Legendary** | Orange | 4 primary + 2 secondary affixes + unique power |
| **Set** | Green | Part of a set; gain bonuses at 2/4/6 pieces |
| **Ancient** | Orange (glowing) | Higher rolls; 10% of legendaries |
| **Primal Ancient** | Orange (intense) | Perfect rolls; 0.25% of legendaries (10% of ancients) |

### Drop Rate Details

**Base Legendary Rate:**
- ~10% of drops are legendaries (varies by difficulty/Torment level)
- Torment difficulty required for level 70 legendaries
- Torment I–XVI available at level 70

**Ancient Items:**
- **Flat 10% of legendaries** become ancient
- Requires no unlock
- ~13% higher stat rolls on affixes vs. non-ancient

**Primal Ancients:**
- **0.25% of all legendaries** (1 per 400 average)
- Alternative math: 10% ancient × 10% primal ≈ 1% but with variance
- Requires solo Greater Rift 70 completion to unlock
- Once unlocked: primals can drop from anywhere (monsters, barrels, etc.)
- Guaranteed 1 primal drop on first GR70 clear per season
- Account-wide unlock (seasonal or non-seasonal separately)
- Perfect rolls on all affixes; no RNG variance on stat ranges

### Smart Loot System

- **~85% of drops** (Smart Drops) roll with class-appropriate main stat
- Examples:
  - Wizard finds item → rolls Intelligence +280
  - Barbarian finds item → rolls Strength +280
  - Demon Hunter finds item → rolls Dexterity +280
- **Monk fists:** never roll Int or Str (class-locked items strictly enforced)
- **Class-restricted armor:** enforced main stat for each class
- **Doesn't fully activate until level 70**; lower levels may see off-class items more

---

## Part 3: Affix System

### Affix Structure Per Item

All Loot 2.0 gear rolls up to:
- **4 primary affixes** (high-priority stats)
- **2 secondary affixes** (low-priority stats)

Items can roll sockets as a primary affix.

### Primary Affixes (Partial List with Max Rolls)

**Offensive:**
- **Damage (+280 base)**: main stat (Str/Int/Dex/Vit depending on class)
- **Vitality**: up to +280
- **Critical Hit Chance (CHC)**: varies by slot (gloves +10%, rings +6%, amulets +10%, etc.); gear cap at 75% (temp buffs can exceed)
- **Critical Hit Damage (CHD)**: scales upward, no hard cap stated
- **Attack Speed**: rolled as +% increase
- **Damage vs. Elites**: +% against elite/champion enemies
- **Area Damage**: % of damage applied to nearby enemies
- **Elemental Skill Damage**: +% Fire/Cold/Lightning/Arcane/Holy/Poison/Physical

**Defensive:**
- **Armor**: blocks a % of incoming damage
- **All Resistance**: single stat vs. all elements
- **Life per Second (LS)**
- **Life per Hit (LPH)**: only on weapons/offhand (not mutually exclusive with LS)
- **Life per Kill (LPK)**
- **Reduced Skill Cooldown (CDR)**
- **Reduced Resource Cost (RCR)**

**Mobility:**
- **Movement Speed**: up to +25%
- **Resource per Second (RPS)**

### Secondary Affixes (Partial List)

- **Crowd Control Reduction**
- **Thorns damage**
- **Single-element resistances** (Cold, Fire, Lightning, etc.)
- **Extra health from health globes**
- **Gold/Magic Find**
- **Experience bonus**
- **Reduced damage from melee/ranged**
- **Reduced level requirement** (allows low-level gear to be used earlier)
- **Indestructible** (gear never breaks)

### Affix Exclusivity Rules

Certain affixes cannot roll together on the same item:

- **+CHC and +CHD:** Some rings/slots cannot have both simultaneously (Ring of Royal Grandeur, for example, typically rolls only one)
- **Life per Hit vs. Life on Kill:** Mutually exclusive (can't have both)
- **All Resistance vs. Single-element resist (primary):** Generally exclusive (with rare exceptions like Thundergod's Vigor)
- **Weapon LPH (primary) + LPK (secondary):** Cannot coexist

These rules prevent "perfect" items and force build compromises.

### Item Levels

- **ilvl (item level):** determines affix roll ranges
- **Max ilvl:** 70 (for level 70 characters)
- **Torment 1+:** drops ilvl 70 gear
- **Below Torment:** drops lower ilvl, weaker rolls
- **Affix ranges scale by ilvl:** e.g., Vitality rolls lower on ilvl 60 than ilvl 70

---

## Part 4: Legendary Powers & Set Bonuses

### Legendary Powers: Build Definitions

Legendaries have a unique affix that fundamentally changes how a skill or class mechanic works. These are **stacking with gear:**

#### Warrior/Barbarian Examples
- **Whirlwind Builds:**
  - Skull Grasp (ring): Whirlwind damage +300–400%
  - Mantle of Channeling (shoulders): Whirlwind damage +20–25%, damage reduction 25%
  - Bul-Kathos's Oath (set, 2pc): Attack speed +45% and movement speed +45% during Whirlwind
  - Wrath of the Wastes (set, 6pc): Whirlwind gains Dust Devils rune + damage +10,000%

- **Avalanche/Earthquake:**
  - Blade of the Tribes: Avalanche/Earthquake damage +800% (×9.0 multiplier)

#### Ranged/Demon Hunter Examples
- **Sentry Build (Embodiment of the Marauder):**
  - 6-piece set: Primary skills gain +1200% damage per active sentry
  - Bombardier's Rucksack (offhand): +2 maximum sentries; lasts 2× longer
  - Custom Engineering (passive): +1 sentry, 2× duration
  - Synergy: Summon Sentries, stack damage with Multishot

#### Caster/Wizard Examples
- **Meteor:**
  - Nilfur's Boast: Meteor damage +600–900% (scales to 3+ targets)
  - Grand Vizier: Meteor damage +400%, cost –50%
  - Mempo of Twilight: Meteor Shower rune applied to all meteors, +300–400%

- **Archon:**
  - Improved Archon (pants): Archon ability damage +50% (stacks multiplicatively with skill damage)
  - Vyr's Amazing Arcana (set, 6pc): Archon stacks from kills, +100% damage per stack, –0.15% damage taken per stack

### Set Bonuses: Scaling by Pieces

When wearing set pieces, you gain bonuses at 2, 4, and 6 pieces (and all bonuses below). Ring of Royal Grandeur reduces requirement by 1 (minimum 2 pieces).

**Generic Structure (varies per set):**
- **2-piece:** Usually +stat or skill damage boost (e.g., +attack speed or +25% skill damage)
- **4-piece:** Major multiplier (e.g., +3000–5000% skill damage, or –50% damage taken)
- **6-piece:** Define-the-build bonus (e.g., "+10,000% Whirlwind damage" or "Primary skills cast twice per click")

**Example: Wrath of the Wastes Barbarian**
- 2pc: +45% attack/move speed while Whirlwind active
- 4pc: Take 50% reduced damage, Rend deals 3× damage (3-second window)
- 6pc: Whirlwind gains Dust Devils rune + +10,000% damage

### Ring of Royal Grandeur

- **Unique mechanic:** Reduces set piece requirements by 1 (minimum 2 pieces needed)
- **Examples:**
  - 6-piece set now requires 5 pieces (1 open slot)
  - 4-piece set requires 3 pieces
  - 2-piece set requires 2 pieces (no reduction)
- **Impact:** Allows mixing partial bonuses from multiple sets or filling slots with legendaries

---

## Part 5: Kanai's Cube

### Overview

Introduced Patch 2.3 (August 2015). A cube in your inventory that:
- Extracts legendary powers to 3 power slots (weapon, armor, jewelry)
- Crafts/upgrades items via recipes
- No equipping required to benefit from extracted powers

### The Three Power Slots

1. **Weapon Slot:** Extract a legendary weapon power
2. **Armor Slot:** Extract a legendary armor/bracers/shoulders power
3. **Jewelry Slot:** Extract a ring/amulet power

Powers stack with any equipped legendaries—a massive damage multiplier system.

### Major Recipes & Material Costs

#### Archive of Tal Rasha (Extract Legendary Power)
- **Effect:** Extracts 1 legendary power to a cube slot (can replace existing)
- **Costs:** 
  - 1 Khanduran Rune
  - 1 Caldeum Nightshade
  - 1 Arreat War Tapestry
  - 1 Corrupted Angel Flesh
  - 1 Westmarch Holy Water
  - 5 Death's Breath

#### Law of Kulle (Reforge Legendary)
- **Effect:** Re-rolls all affixes on a legendary item (new rolls, potentially ancient/primal)
- **Costs:**
  - 5 Khanduran Rune
  - 5 Caldeum Nightshade
  - 5 Arreat War Tapestry
  - 5 Corrupted Angel Flesh
  - 5 Westmarch Holy Water
  - 50 Forgotten Soul
- **Used for:** "Fishing" for perfect rolls on key legendaries

#### Hope of Cain (Upgrade Rare to Legendary)
- **Effect:** Converts a rare quality item to legendary (same item type)
- **Result:** Can be ancient or primal (if GR70 unlocked)
- **Costs per attempt:**
  - 1 equippable rare (ilvl 70)
  - 25 Death's Breath
  - 50 Reusable Parts
  - 50 Arcane Dust
  - 50 Veiled Crystal
- **Used for:** Targeted legendary farming for specific slots

#### Skill of Nilfur (Convert Set Item to Different Set)
- **Effect:** Convert one set item to a different set item of the same slot
- **Costs:**
  - 10 Death's Breath
  - 10 Forgotten Soul
- **Used for:** Redirecting set pieces between sets

#### Darkness of Radament (Gem Conversion)
- **Effect:** Convert 9 gems of one type to 1 of another (e.g., 9 Amethyst → 1 Emerald)
- **Costs:** 1 essence of target gem type (Essence of Emerald, etc.)

#### Work of Cathan (Remove Level Requirement)
- **Effect:** Reduces item's level requirement to 1 (for cosmetics or low-level gear)
- **Costs:** Practically requires socketing a Gem of Ease (no direct material cost)

#### Caldesann's Despair (Augment Ancients)
- **Effect:** Permanently adds main stat (Str/Int/Dex/Vit) to an ancient/primal item
- **Scaling:** +5 stat per legendary gem rank
  - Example: Rank 110 gem + 3 Royal Emeralds → +550 Dexterity permanently
- **Costs:**
  - 1 Ancient or Primal Ancient piece
  - 1 leveled legendary gem (minimum rank 40 for jewelry, rank 50 for armor)
  - 3 of the desired gem type (Flawless Royal Emerald for Dex, etc.)
- **Recommended gem level:** Start at rank 80+; best practice at rank 100+
- **Strategic importance:** Closes the gap between ancient and primal rolls

### Material Economy

**Key crafting materials:**

| Material | Source | Used In |
|----------|--------|---------|
| **Death's Breath** | Elite kills (rifts, bounties, high difficulty) | Every cube recipe |
| **Forgotten Soul** | Salvage legendary items | Reforge, Set conversion |
| **Reusable Parts** | Break down rare/magic items | Upgrade rares |
| **Arcane Dust** | Break down rare/magic items | Upgrade rares, enchanting |
| **Veiled Crystal** | Break down rare/magic items | Upgrade rares, enchanting |
| **Blood Shards** | Kill elites (capped at 500–1000 depending on GR clears); Kadala drops | Gambling, altar purchases |

---

## Part 6: Mystic Enchanting

### Overview

A crafting NPC that **rerolls a single affix** on an item, with escalating costs.

### Core Mechanics

- **One affix per item:** Only 1 of the 4 primary affixes can be chosen for reroll
- **Repeatable:** Can reroll the same affix slot multiple times (fishing for perfect rolls)
- **Bind on use:** Enchanting an item binds it to your account (cannot trade)
- **Display options:** Shows potential results before committing

### Cost Escalation

**For each successive reroll on the same item:**
- Gold cost increases by ~15,000–30,000 gold per attempt (cumulative)
- Material cost (for legendary items):
  - **Arcane Dust** (varying quantities)
  - **Veiled Crystal** (varying quantities)
  - **1 Forgotten Soul** (per reroll on legendary)
  - **Death's Breath** (sometimes)

**For rare items:** Arcane Dust + Veiled Crystal only (no Forgotten Soul).

### Typical Workflow

1. Drop a legendary piece (e.g., gloves with wrong affix)
2. View available reroll options for that affix slot
3. Pay cost → reroll once
4. If not desired roll, pay higher cost → reroll again (repeat "fishing")
5. Once perfect, stop rerolling (lock that affix forever)

---

## Part 7: Legendary Gems

### Overview

Legendary gems are socketed **only into rings and amulets**. They upgrade via Greater Rifts and provide powerful passive bonuses.

### Key Legendary Gems

#### Bane of the Trapped
- **Effect:** +15% damage to enemies under crowd control effects
- **Upgrade:** +0.3% per rank (max +60% at Rank 150)
- **Rank 25 bonus:** 30% movement speed slow aura (15-yard radius)
- **Used in:** Nearly every build (cheap damage boost)

#### Zei's Stone of Vengeance
- **Effect:** +4% damage per 10 yards distance to enemy (up to +20% at 50 yards)
- **Upgrade:** +0.05% per 10 yards per rank
- **Rank 25 bonus:** 20% chance to stun on hit (1 second)
- **Synergy:** Pairs with kiting builds; stuns trigger Bane of the Trapped

#### Taeguk
- **Effect:** +2% damage per tick while channeling (stacks to 10 = +20% damage; +2% armor per tick)
- **Used in:** Barbarian Whirlwind, DH Sentry (maintained channeling)

#### Other Notable Gems
- **Gogok of Swiftness:** +1% attack/movement speed per stack (stacks on hit, 15 stacks max)
- **Toxin:** Poison damage DoT that stacks
- **Molten Wildebeest's Gizzard:** Life regeneration + revive (once per minute)

### Gem Upgrade System

**Upgrade Mechanics:**

After completing a Greater Rift (any difficulty, any time limit):
- Speak to **Urshi** (rift guardian NPC)
- Receive **3 base upgrade attempts** + 1 bonus if flawless completion (no deaths) + 1 if empowered rift
- Maximum 5 attempts per GR clear

**Success Rate Table (Gem Level vs. GR Level):**

| GR – Gem Level | Probability |
|---|---|
| +10 or higher | 100% |
| +9 | 90% |
| +8 | 80% |
| +7 | 70% |
| +6 to +0 (equal) | 60% |
| –1 | 30% |
| –2 | 15% |
| –3 | 8% |
| –4 | 4% |
| –5 | 2% |
| –6+ | 1% or 0% |

**Strategy:** Run GRs where you can win consistently; gem level will organically rise. At equal gem/GR level, only 60% success, so faster progression at higher GRs.

---

## Part 8: Damage Formula & Multiplicative Buckets

### The Multiplicative Model

Diablo 3's damage is **NOT additive**; it uses independent multiplier buckets that are *multiplied together*.

**Base Formula:**
```
Damage = Weapon_Damage × Main_Stat_Multiplier × CHC_CHD_Multiplier × Attack_Speed 
         × Elemental_Damage_Multiplier × Skill_Damage_Multiplier 
         × Set_Bonus_Multiplier × Elite_Damage_Multiplier × (1 − Enemy_Reduction)
```

### Key Multiplier Categories

#### 1. Main Stat (Str/Int/Dex/Vit)
- Every 1 point of main stat = +1% damage
- Rolls up to +280 on gear
- 50+ Paragon points = +50% more main stat
- **Total possible:** ~+380% from main stat alone

#### 2. Critical Hit (CHC × CHD)
- Formula: **Damage × (1 + CHC × CHD)**
- **CHC cap:** 75% (from gear; temp buffs exceed)
- **CHD:** No hard cap; scales linearly
- Example: 50% CHC × 500% CHD = (1 + 0.5 × 5) = **3.5× damage multiplier**
- **Rule of thumb:** Maintain 1:10 ratio (1% CHC ≈ 10% CHD value); below that, CHC is worth more

#### 3. Attack Speed
- Rolls as +% increase
- Multiplicative to damage per second
- Weapon base attack speed + % bonus = final APS

#### 4. Elemental/Physical Damage
- Rolls as +% elemental damage (Fire/Cold/Lightning/Arcane/Holy/Poison)
- Example: +50% Fire damage = 1.5× multiplier for fire skills
- Separate bucket per element; summed within element

#### 5. Skill-Specific Damage
- "Barbarian skills deal +X% damage"
- "Meteor deals +X% damage"
- Additive within skill category, but multiplicative with other buckets

#### 6. Set Bonuses & Legendary Powers
- "+10,000% Whirlwind damage" = 100× multiplier
- These stack multiplicatively with all other buckets
- Build-defining multipliers; enable viability

#### 7. Elite Damage
- "+X% damage vs. elites"
- Multiplicative against champion/elite enemies
- Critical for Greater Rift scaling

#### 8. Area Damage
- "X% of damage dealt to nearby enemies"
- Chains across packs
- Non-essential but nice-to-have

### Example Damage Calculation

**Barbarian with 100% CHD, 50% CHC:**
```
Base Weapon Damage: 2000
× Main Stat Multiplier: 3.8 (380% from Str)
× Critical Multiplier: 1 + (0.5 × 1.0) = 1.5
× Attack Speed: 1.25 (25% bonus)
× Skill Damage (Whirlwind): 100 (10,000% from set)
× Elemental (Physical): 1.2 (20% physical bonus)
──────────────────────────
= 2000 × 3.8 × 1.5 × 1.25 × 100 × 1.2
= ~1,710,000 base damage per hit
```

Then enemy reduction (armor/resist) subtracts a %, and area damage chains across packs.

---

## Part 9: Toughness & Effective Health (EHP)

### Defense Formula

**Damage Reduction from Armor:**
```
Armor_Reduction = Armor / (50 × Enemy_Level + Armor)
```
- Against level 70 enemies: Armor / (3500 + Armor)
- Example: 10,000 Armor = 10,000 / 13,500 = **74% reduction**

**Damage Reduction from Resistance:**
```
Resist_Reduction = All_Resist / (5 × Enemy_Level + All_Resist)
```
- Against level 70 enemies: All_Resist / (350 + All_Resist)
- Example: 1,000 All_Resist = 1,000 / 1,350 = **74% reduction**

### Toughness Factor

**Toughness Factor** = 1 / (1 − Total_Reduction)
- Example: 74% reduction = 1 / (1 − 0.74) = 1 / 0.26 = **3.85× multiplier** (take 3.85 times more hits)

### Effective Health Pool (EHP)

```
EHP = Health × Toughness_Factor
```
- 100,000 health + 74% reduction = 100,000 × 3.85 = **385,000 EHP**

### Balancing Armor vs. Resistance

Since toughness is a **product of armor and all-resist factors:**
- Optimal balance: equal % reduction from both
- Example: 10,000 Armor (74%) + 1,000 All_Resist (74%) → 94.5% total reduction
- Mismatch example: 20,000 Armor (87%) + 500 All_Resist (59%) → lower total than balanced

**Golden Ratio:** Keep armor and all-resist contributions equal for maximum toughness.

---

## Part 10: Greater Rifts & Scaling

### GR Level Range

- **Minimum:** GR 1
- **Maximum:** GR 150 (hard cap; Blizzard confirmed permanent)
- **Torment Equivalence:** T1 ≈ GR10, T16 ≈ GR75, GR76+ exceeds all Torment difficulties

### Monster Health Scaling

- **Health multiplier per GR level:** ×1.17 (17% increase per level)
- **Doubles every 4.5 GR levels**
- **10× increase every 15 GR levels**
- Example: GR100 monster health ≈ 10× GR85 health

### Monster Damage Scaling

- **GR 1–25:** ~13% increase per level
- **GR 25–70:** ~7% increase per level
- **GR 71–150:** ~2.3% increase per level
- Damage scaling much slower than health (rewards damage scaling gear)

### Time Limit

- Standard: 15 minutes
- Empowered rift: Same time limit (don't rush)
- Failing to kill guardian within time = no gem upgrade attempts

---

## Part 11: Paragon System

### Overview

Infinite leveling past character level 70. Points allocated to four categories (Offense, Defense, Utility, Special).

### Paragon Leveling

- **XP scaling:** Linear per Paragon level (higher levels require more XP)
- **Seasonal reset:** Paragon wiped at season start
- **Cross-season transfer:** Seasonal Paragon XP → non-seasonal Paragon XP on season end

### Paragon Allocation (Pre-Season 29 Overhaul)

- **Problem:** No cap; players could infinitely allocate +Vitality or +main stat, trivializing gear/build diversity
- **Season 29 fix (late 2023):** 
  - **Hard cap:** 800 total Paragon points across all categories
  - **Per-stat cap:** 200 points maximum in any one attribute per category
  - **Goal:** Make Paragon less deterministic than player skill and gear choices

### Practical Progression

- **Paragon 400:** Recommended minimum for solo GR70 attempt
- **Paragon 800:** Maxed, seasonal reward
- **Non-seasonal:** Can accumulate 800+ from many seasons' transfers

---

## Part 12: Legendary Gem Farming & Blood Shards

### Blood Shard Economy

#### Drop Sources
- **Greater Rifts:** Primary source; scales with GR tier (+3 shards per tier)
- **Challenge Rift cache:** 475 shards/week (guaranteed)
- **Bounty caches:** 10–80 shards depending on difficulty
- **Treasure goblins (Blood Thieves):** Variable, high drops

#### Maximum Capacity
- **Base:** 500 shards
- **Expansion:** +10 shards per GR tier cleared solo (up to 1000+)

#### Optimal Farming
- **Method:** Run GRs where you complete sub-3 minutes consistently
- **Why:** Shard drop only +3 per tier, so fast runs (low-tier, quick clear) beat slow runs (high-tier)
- Example: 5 GR80 runs (3 min each) vs. 3 GR100 runs (15 min each) = more shards in same time

### Gambling (Kadala)

#### Legendary Probability
- **Drop rate:** 10% of gambled items are legendary/set
- **Targeting:** Select item category (helms, gloves, etc.) before gambling

#### Cost Structure
| Item Type | Shards |
|-----------|--------|
| Helm/Gloves/Chest/Pants/Boots | ~25 |
| Shoulders/Bracers/Belt | ~20 |
| Rings/Amulets | 50–75 |
| Weapons (1H/2H) | ~50–75 |

#### Expected Shards for Specific Item
- ~10 items in category × 100 shards average ÷ 0.10 drop rate = **~2,500 shards per legendary targeted**
- Formula: (Category_Size ÷ 0.10) × Average_Cost

---

## Part 13: Comparison to Other Games

### Diablo 4: Loot Reborn (Season 4, 2024)

**Similarities to D3 Loot 2.0:**
- Affixes on items; build-defining powers
- Rarity scaling (Rare → Legendary → Ancestral → Unique)
- Gem upgrades (though simplified)

**Major Differences:**
- **Tempering:** Add affixes to items via Tempering Manuals (additive system, not extraction like cube)
- **Masterworking:** Each +1 quality rank grants +1% to all stats/damage (stackable to +25%)
- **Greater Affixes:** 1.5× power versions appearing only on Ancestral items (rarer tier than D3 Ancient)
- **3 affixes max** on legendaries (D3 has 4 primary + 2 secondary = 6 total)
- **No trading:** Bind-on-pickup, like D3 post-Loot-2.0

**Loot Reborn philosophy:** Reduce affix bloat, make each affix more impactful, introduce masterworking progression (time-gating + deterministic upgrades).

### Path of Exile 2: Crafting System

**Similarities:**
- Rarity tiers (Normal → Magic → Rare → Unique)
- Affixes with ranges and exclusivity rules
- Gem socketing and skill gems

**Major Differences:**
- **Influence mods:** Mods from specific enemy types (Shaper, Elder, etc.) create special affixes
- **Meta-crafting:** Use orbs to target affix types (e.g., "add fire mod to suffix")
- **Sockets:** Runes placed in sockets grant +2 suffix mods under certain conditions (advanced crafting)
- **No Legendary sets:** Unique items are rare/powerful but no set-piece bonuses
- **Auction house still exists:** Players trade freely; currency-based economy

**PoE philosophy:** Deep, complex crafting for hardcore players; economy-driven progression.

### Last Epoch: Forging & Affixes

**Similar to D3/D4:**
- Legendary Forging Potential: upgrade rare → legendary
- Affix tiers and ranges
- Class-specific legendaries

**Unique mechanics:**
- **Forging Potential:** Increases via crafting; unlock recipes with higher potential
- **Enchantments:** Temporary buffs applying to gear (distinct from affixes)
- **Monolith endgame:** Scales infinitely like GRs but with different reward curves

---

## Part 14: What Went Wrong with Loot 1.0

### Core Problems

1. **Auction House Short-Circuited Farming:**
   - Easier to save gold/pay RMAH than farm legendaries
   - Killed the dopamine loop of monster kills
   - Created economic incentive to avoid actual gameplay

2. **Inflation & RMT:**
   - Unlimited supply of items at any price
   - Third-party RMT and account hacking profitable
   - Legitimate players priced out of endgame gear

3. **Legendary Irrelevance:**
   - Rares and non-set gear more cost-effective
   - Legendary drops meaningless since AH undersold them
   - No aspirational goal from farming

4. **Developer Quote:**
   - Jay Wilson (former game director): "The Auction House really hurt the game."

### Loot 2.0 Solutions

- **Removal of trading:** Bind on enchant/use prevents resale
- **Smart loot:** Increases chances of useful drops (psychology)
- **Legendary powers:** Make legendaries actually powerful and game-changing
- **Kanai's Cube:** Alternative farming: upgrade rares → legendaries (cheaper than pure farming)
- **Result:** Monster killing is now optimal progression

---

## Part 15: Design Implications for Our Game

1. **Bind-on-Pickup for Traded Items:**
   - Once enchanted or upgraded, items become untradeable
   - Protects economy; preserves farming as primary progression
   - Exception: Raw drops can be traded briefly (like PoE's first trade window)

2. **Multiplicative Damage Buckets:**
   - Damage = Weapon × Stat × CHC×CHD × Speed × Skill% × Set × Elite × (1−Resist)
   - Prevents flat "damage" stat bloat; scaling feels exponential
   - Allows build diversity: min-max one bucket or balance all?

3. **Smart Drops Matter:**
   - 85% smart drop rate feels better than full randomness
   - Reduces frustration; increases progression pacing
   - Tooltip: show "Rolled for [Warrior]" if class-appropriate

4. **Set Bonuses Drive Viability:**
   - 6-piece defining bonus (10,000%+ damage) makes or breaks a build
   - 4-piece enables hybrid/flex builds
   - 2-piece is baseline (almost guaranteed)
   - Use Ring of Royal Grandeur equivalent to allow 5-piece setups for build mixing

5. **Legendary Extraction (Kanai's Cube):**
   - Allows power reuse without equipping (frees armor/jewelry slots)
   - 3 slots per character: weapon, armor, jewelry
   - Creates alternative farming path (extract → cube vs. equip)
   - Cost: material sink (Death's Breath, etc.)

6. **Escalating Enchanting Costs:**
   - First reroll cheap; 10th reroll expensive
   - Discourages perfect-item fishing early
   - Naturally gates endgame min-maxing

7. **Greater Rifts as Endgame:**
   - Infinite scaling (GR1 to 150)
   - Time-based challenge (15 min = pass/fail)
   - Gem upgrades require succeeding (60% base success, scales with level gap)
   - Creates "push tier" ceiling (where you stop winning 60% of attempts)

8. **Paragon as Soft Progression:**
   - Infinite XP, but capped allocation (800 points)
   - Fades importance as gear scales (good design)
   - Seasonal resets encourage ladder competition
   - Consider hard cap on points per stat to prevent stat-stacking dominance

9. **Primal Ancients as Chase Item:**
   - 0.25% drop rate = 400 legendaries for 1 primal on average
   - Unlocked via endgame challenge (GR70 solo)
   - Perfect rolls = prestige, not necessity (ancient + augmentation nearly as good)
   - Preserves long-term goals for hardcore players

10. **Damage Scaling vs. Health:**
    - GR health scales 17% per level
    - GR damage scales only 2–13% per level
    - Means gear scaling (damage multipliers) matters more than "hit harder"
    - Rewards builds with high damage buckets, not HP stacking

11. **Avoid Auction House (Loot 1.0 Failure):**
    - If allowing any trading, use bind-on-pickup or similar
    - Alternative: seasonal softcore has trading; hardcore/elite has none
    - Never let players farm currency to buy gear; always farm gear directly

12. **Affinity System (Smart Loot):**
    - Feels good to get useful drops
    - But don't make it 100% (keeps some surprise/RNG)
    - 85% sweet spot

---

## Part 16: Open Questions to Ask the User

### Design/Mechanical Questions

1. **Damage Formula:**
   - Do you want multiplicative buckets (D3 style) or additive affixes?
   - Multiplicative = exponential scaling (longer grind, harder balancing)
   - Additive = linear (simpler, flatter progression curve)

2. **Auto-Attack Range & Scaling:**
   - D3 has range + auto-attack, but skill casting is manual
   - For your auto-casting 4 skills: are ranges fixed per skill? Do they scale with stats?
   - Do movement and attack happen simultaneously (isometric) or queue-based?

3. **Set Pieces vs. Legendaries:**
   - Should all builds use 6-piece sets, or are non-set legendary-only builds viable?
   - D3: set pieces are almost mandatory (6-piece bonus too good)
   - Can you allow both play patterns equally?

4. **Infinite Endgame:**
   - Do you want a soft cap (GR150 equivalent) or truly infinite scaling?
   - Soft cap = harder to balance but clearer "end"; infinite = always a next tier

5. **Trading/Economy:**
   - Fully tradeable (Path of Exile style): requires careful loot tuning to prevent inflation
   - Bind-on-pickup (D3 Loot 2.0 style): simpler balance, no economy drama
   - Hybrid (PoE league model): trade first, bind later?

6. **Paragon/Stat Inflation:**
   - Do you want capped paragon (D3 800-point cap) or linear forever?
   - Capped = gear matters more; linear = long-term character development
   - This affects whether +stat items feel rewarding at 1000+ hours

7. **Enchanting Cascades:**
   - How many rerolls before cost explodes?
   - D3: escalates sharply; 5–10 rerolls become expensive
   - You could cap it (max 5 rerolls) or make costs softer

### Monetization/Progression Questions

8. **Season Length & Resets:**
   - How long per season? (D3: ~3 months typical)
   - Wipe gear/paragon for hardcore competitiveness?
   - Battle pass-style cosmetic rewards tied to seasonal challenges?

9. **F2P vs. Premium Grind:**
   - Is your game F2P with cosmetics, or premium?
   - D3: premium ($60, no battle pass originally)
   - If F2P: battle pass for cosmetics, never P2W on power

10. **Cross-Platform Progress:**
    - Browser + Steam: same character or separate?
    - Shared account or separate servers?
    - Mobile-parity (you said no mobile): affects client-side calculations

---

## Sources

**Official Diablo 3 Resources:**
- [Blizzard Diablo 3 Game Guide](https://us.diablo3.blizzard.com/en-us/item/)
- [Diablo 3 Patch Notes (2.5.0+)](https://us.battle.net/forums/en/d3/topic/)

**Community Wikis & Guides:**
- [Diablo Wiki (diablowiki.net)](https://www.diablowiki.net/)
- [Diablo Fandom Wiki](https://diablo.fandom.com/wiki/Damage)
- [Icy Veins D3 Guides](https://www.icy-veins.com/d3/)
- [Maxroll.gg D3 Resources](https://maxroll.gg/d3/resources/)
- [PureDiablo Guides](https://www.purediablo.com/)
- [DiabloBytes D3 Guides](https://diablobytes.com/diablo-iii/guides/)

**Drop Rate & Formula Research:**
- [Primal Ancient Drop Rate Discussion](https://www.vintageisthenewold.com/faq/what-is-the-drop-rate-for-primal-legendary-items-in-diablo-3/)
- [Greater Rift Gem Upgrade Success Rates](https://www.purediablo.com/a-total-guide-to-greater-rifts/)
- [Diablo 3 Damage Formula Theorycrafting (BlizzPro)](https://blizzpro.com/2014/05/17/basic-theorycrafting-damage-formula/)
- [Toughness & EHP Calculator](https://blizzpro.com/2014/07/26/basic-theorycrafting-toughness-part-1/)

**Loot 1.0 History:**
- [Auction House Removal Announcement](https://blizzplanet.substack.com/p/diablo-iii-pc-auction-house-removal-announced/)
- [NBC News: "Diablo 3 Auction House Failure"](https://www.nbcnews.com/technolog/no-money-no-problems-blizzard-axes-diablo-3-auction-house-4B11192195)

**Comparison Games:**
- [Diablo 4 Loot Reborn Guide (Maxroll.gg)](https://maxroll.gg/d4/resources/season-of-loot-reborn-guide/)
- [Task Bar Hero Wiki (tbhwiki.com)](https://taskbarhero.org/en/cube/)
- [Path of Exile 2 Crafting Overview](https://maxroll.gg/poe2/resources/path-of-exile-2-crafting-overview/)

**Build Examples:**
- [Marauder Sentry DH Build (Maxroll)](https://maxroll.gg/d3/guides/marauder-sentry-demon-hunter-guide/)
- [Whirlwind Barbarian Build (Maxroll)](https://www.icy-veins.com/d3/whirlwind-gr-wastes-barbarian-bis-gear-gems-paragon-points/)
- [Wizard Meteor Build (Maxroll)](https://maxroll.gg/d3/guides/tal-rasha-meteor-wizard-guide/)

