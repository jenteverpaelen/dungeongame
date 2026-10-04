# TBH: Task Bar Hero — Complete System Analysis

**Research Date:** October 4, 2026  
**Source Game:** TBH: Task Bar Hero (Nugem Studio, released May 27, 2026)  
**Platform:** Steam (Free-to-Play, Windows; Steam Deck compatible with limitations)

---

## Executive Summary

Task Bar Hero (TBH) is a free-to-play idle hack-and-slash ARPG designed to run permanently minimized on the Windows taskbar. Despite its minimalist UI footprint, the game packs complex progression systems inspired by Diablo 3 (Reaper of Souls): Loot 2.0-style item tiers, a Horadric Cube analogue (Hero-dric Cube), a 197-node mastery tree (Rune Tree), Steam Marketplace integration for real-money trading, and an auto-combat system. Launched May 27, 2026, the game peaked at 526,000 concurrent players within the first month and maintains "mixed" Steam reviews (49–62% positive) despite extraordinary player engagement. Success stems from dopamine-loop design: instant visual feedback (large damage numbers, trash mob density), incremental progression markers (rune unlocks, Cube XP level-ups), and permissionless item trading. The game's design proves that even "idle" games can sustain deep mechanical depth and that Steam Marketplace integration—when combined with abundant loot—creates emergent player engagement beyond traditional F2P monetization.

---

## Core Game Fundamentals

### Platform & Technical

- **Window Position:** Always-on-top, transparent window (default at Windows taskbar)
- **Gameplay Loop:** Party of heroes auto-fights while player manages gear, rune tree, and cube
- **Session Pattern:** "Live idle" (client minimized) earns 4× more rewards than offline mode
- **Storage:** Parties, runes, cube state, and loot persist in Steam Cloud save
- **Client:** ~500 MB; optimized for low CPU/GPU usage during idle
- **Cross-Play:** None stated; Steam only (desktop)

### Game Duration & Lifespan

- **Level Cap:** 101 (unlocked at hero level ~5)
- **Max Level XP:** 42,291,336,533 cumulative (100 levels)
- **Endgame:** Paragon-equivalent progression after level cap (not explicitly stated as "infinite" but Rune tree and Cube upgrades continue)
- **Content:** 120 stages (3 Acts × 10 stages × 4 difficulties: Normal, Nightmare, Hell, Torment)

### Release Performance

- **Peak Concurrent:** 526,000 (late June 2026)
- **Peak Daily Average:** 260,000 (reported July 2026)
- **Steam Rank:** Top 3 at launch
- **Review Trend:** 57% positive (last 30 days) → 62% overall (8,493 reviews; June data); peaked higher earlier

---

## Hero Classes & Party System

### Six Total Heroes (3 Free + 1 Free DLC + 2 Paid DLC)

| Hero | Role | Base Stats (Lv 1, No Gear) | Cost | Notes |
|------|------|---------------------------|------|-------|
| **Knight** | Tank/Melee | ATK 2, HP 130, Crit 25%, Armor 45 | Free | Sword + Shield; strong defense scaling |
| **Ranger** | Ranged DPS | ATK 1, HP 60, Crit 40%, Armor 8 | Free | Bow + Arrow; consistent single-target carry |
| **Sorcerer** | Mage AoE | ATK 2, HP 50, Crit 50%, Armor 5 | Free | Staff + Orb; area-denial spells like Flame Hydra, Meteor Strike |
| **Priest** | Healer/Support | [Not specified in sources] | Free (DLC) | Protects formation, supplies healing; free post-launch DLC |
| **Hunter** | Burst/Turret | ATK 2, HP 70, Crit 45%, Armor 15 | $4.99 (30% off = $3.49) | Crossbow + Bolt; places Crossbow Turrets that auto-fire |
| **Slayer** | Frontline DPS | [Not specified in sources] | $4.99 | Holds frontline; [specific mechanics unverified] |

### Party & Formation System

- **Starting Heroes:** 1 hero deployable; Formation screen shows 2 empty slots
- **Hero Slots Unlock:**
  - **Slot 2:** Rune of Command node (south branch); costs 300 gold cumulative
  - **Slot 3:** Two Rune of Expansion nodes (south-west branch); costs 150,000 gold total
- **Formation Management:**
  - Drag heroes into slots; no reorder cooldown (only 60-second deploy cooldown after switching)
  - Can carry under-leveled heroes for power-leveling
  - Pets assigned per-slot (1 pet deployed, but all unlocked pets' passives apply globally)
- **Recommended Composition:** Knight (tank) + Ranger (DPS) + Priest (heal/support)

---

## Combat System & Skills

### Auto-Combat Mechanics

- **Control Model:** No direct WASD movement (game is passive/idle—heroes auto-fight)
- **Auto-Attack:** When in range, heroes continuously attack (no player click required)
- **Auto-Skills:** Up to 4 active skills auto-cast when cooldown expires (post-rune unlock)
- **Skill Slots:** 1 skill slot (default) → 2 skill slots (unlock via Rune; costs 50,000 gold)
- **Difficulty Setting:** Players do not control difficulty mid-fight; select stage difficulty before entering

### Skill System

Each hero has **6 active skills** + **3 passive enhancement tiers per skill** (18 passive bonuses per hero).

**Skill Types:**
1. **Aura Skills:** Activate immediately once equipped; persist passively
2. **Base-Attack Skills:** Scale with Attack Speed; fire faster as speed increases
3. **Cooldown Skills:** Scale with Cast Speed; recharge faster as speed increases
4. **Monster Abilities:** Unique to specific monster types in-game

**Example Skills:**
- Knight: Aegis Field (shield aura), Base Attack, Dash Attack, Revenge Attack, Sacred Blade, Strong Attack, Unyielding Will
- Ranger: Arrow Rain, Barrage Attack, Base Attack, Base Projectile, Piercing Arrow, Skewer Shot, Spread Shot, Swift Surge
- Sorcerer: Flame Hydra, Meteor Strike (AoE nuke)
- Hunter: Charge Trap, Crossbow Turret, Explosive Bolt, Frost Bolt, Quick Loader, Shock Bolt

### Combat Feedback & Particle Effects

- **Damage Numbers:** Large, on-screen floating numerals (Diablo 3 style)
- **Mob Density:** High trash mob counts (13–18 waves per stage by mid-game)
- **Stat Scaling:** DPS formula: `DPS = AttackSpeed × AttackDamage × (1 + CritChance × (CritDamage − 1))`

### Stat Mechanics

**Base Stats:**
- **Attack (ATK):** Base damage per hit; shown on character screen (includes class base + weapon + flat gear bonuses)
- **Max HP:** Health pool
- **Critical Chance (Crit):** % chance to trigger critical hit (base 5%, no hard cap, up to 100%+)
- **Critical Damage (Crit Dmg):** Multiplier on crit hits (base 150%; 1.5× normal damage)
- **Armor:** Physical damage reduction; formula: `damage_taken = 100 / (100 + Armor)` (caps at 75% reduction; diminishing returns)
- **Attack Speed:** Increases basic attack and skill fire rate
- **Cast Speed:** Increases cooldown skill recharge rate

**Stat Formula (Final):** `(base + ΣFlat) × (1 + ΣAdditive) × Π(1 + each Multiplicative)`

**Buff/Debuff System:** 29 documented status effects (sources did not detail each); examples: Bleeding, Burning, Frozen, Stunned, Poisoned

---

## Progression Systems

### Leveling

- **Level Range:** 1–101 (soft cap at 80; presently no Paragon-equivalent explicit system; rune tree and Cube provide infinite scaling)
- **XP Penalties:** Severe XP loss when farming enemies ±5 levels from your hero (diminishing returns; optimal is ±2 levels)
- **Level-Up Rewards:** [Not specified in sources; presumably stat increases and skill point allocation]
- **Max Level XP Table:** 42,291,336,533 cumulative XP (100 level-ups)
- **Endgame Loop:** After level 101, all progression is rune tree (gold sinks), cube synthesis, and gear optimization

### Hero-dric Cube: Crafting, Synthesis & Enchanting

The Hero-dric Cube is the central crafting/upgrade hub. It unlocks at hero level 4 (~15 minutes in) and gains new functions as the Cube itself levels up.

#### Eight Cube Functions

| Function | Unlock Level | Unlock Cost | Purpose |
|----------|--------------|-------------|---------|
| **Synthesis** | 0 (default) | N/A | Combine 9 items of same rarity → 1 of next tier |
| **Alchemy** | Cube Lv 1 | 10 gold | Convert items into gold |
| **Crafting** | Cube Lv 5 | 100 gold | Create new gear from raw materials |
| **Decoration** | Cube Lv 8 | 300 gold | Add/modify single-stat gems (sockets) |
| **Extraction** | Cube Lv 10 | 1,000 gold | Strip materials/effects from gear |
| **Engraving** | Cube Lv 15 | 1,000 gold | Add dual-stat engravings to gear (Immortal+) |
| **Offering** | Cube Lv 20 | 3,000 gold | Convert items → Offering Coins (material-like currency) |
| **Inscription** | Cube Lv 25 | 10,000 gold | Add 1 random stat from large pool (Arcana+) |

#### Synthesis (Core Mechanic)

- **Formula:** 9 items of rarity X → 1 item of rarity X+1
- **Key Unlock:** Enables progression to Cosmic rarity without rare drops
- **Gold Costs by Tier:**
  - Tier 1–2: 100 gold
  - Tier 3: 500 gold
  - Tier 4: 1,000 gold
  - Tier 5: 3,000 gold
  - Tier 6: 5,000 gold
  - Tier 7: 7,000 gold
  - Tier 8: 10,000 gold

#### Cube XP & Leveling

- **Source:** All Cube operations grant XP (Synthesis, Crafting, Alchemy, Offering, Extraction)
- **Scaling:** Higher-rarity items grant more Cube XP
- **Optimal Feeding:** Items ±6 levels from Cube level yield 100% XP; outside that range, XP scales down
- **Cube Level Cap:** [Not explicitly stated; likely 100+ based on tier-8 synthesis unlocking at Cube Lv 65–80]
- **Cost Scaling:** Each Cube level-up cost increases (exponential or polynomial; exact formula unverified)

#### Decoration Slots & Gems

Rare rarity (blue) and above unlock socket slots:
- **Rare:** 1 socket
- **Immortal:** 2 sockets
- **Arcana+:** 3 sockets

**Socket Colors & Bonuses:**
- **Red (Offense):** Damage, Critical Chance, Attack Speed
- **Blue (Defense):** HP, Armor, Resistances
- **Yellow (Utility/Economy):** Gold/Chest/XP gains

**Socket Synergy Bonuses (examples):**
- 3 Red sockets: +10% chance to deal 150% True Damage
- 2 Red + 1 Yellow: +15% damage vs. bosses
- [Full matrix unverified in sources]

#### Gems (Decorations)

The gem pool spans all 10 rarities: Common (Minor Ruby, etc.) → Cosmic (Ethereal Gem, Chaos Diamond)

---

### Rune Tree: Mastery & Account Progression

The Rune Tree is an account-wide, fully resettable passive system of **197 nodes** (195 connections) that unlocks at hero level 3. Every node has a gold cost (escalating with depth).

#### Structure

- **Total Nodes:** 197
- **Layout:** Compass directions (N/S/E/W) encode thematic branches
  - **South:** Hero Slots (Rune of Command), Formation upgrades
  - **East/West/North:** [Specific themes unverified; likely Combat, Resources, Chests, Offline, Inventory]

#### Documented Branches & Examples

| Branch | Node Count | Key Unlock Examples |
|--------|-----------|-------------------|
| **Combat** | 20 | Rune of War (root; +All Hero ATK) |
| **Resources** | 43 | Gold Per Kill, EXP Per Kill bonuses |
| **Chests** | 82 | Rune of the Mainspring (auto-open chests); Chest drop rates |
| **Offline** | 11 | Offline gold/XP accumulation |
| **Inventory** | 33 | Rune of Expansion (inventory slots, hero slots) |
| **Cube** | 8 | Cube efficiency, synthesis cost reduction |

#### High-ROI Nodes

1. **Rune of Command (South):** Unlocks Hero Slot 2 (costs 300 gold cumulative); Hero Slot 3 costs 150,000 gold deeper
2. **Rune of the Mainspring:** Auto-opens chests during idle
3. **Rune of Expansion:** +Inventory slots, +Stash pages
4. **Rune of Growth:** +EXP per kill
5. **Rune of War (Root):** +All Hero ATK (foundational)

#### Economic Impact

Rune tree is **gold-sink centric:** every node costs gold; early nodes (first 10–20) cost hundreds; mid-tier (50–100) cost thousands; late-tier (150–197) cost tens of thousands. Optimal rune progression is **level-locked**: many builds unlock hero slots and auto-chest at level 20–30 for efficiency.

---

## Item System & Loot

### Ten Rarity Tiers (Loot 2.0)

| Tier | Color | Examples | Affixes | Sockets | Market Value (Relative) |
|------|-------|----------|---------|---------|------------------------|
| **1. Common** | Gray | Basic gear | 0 | 0 | 1× |
| **2. Uncommon** | Green | Slightly better | 1 | 0 | 2× |
| **3. Rare** | Blue | Targeted stats | 2 | 1 | 5× |
| **4. Legendary** | Yellow/Gold | Build-enabling (4 affixes) | 4 | 1 | [High; tradeable] |
| **5. Immortal** | Purple | [Rare drops] | 5 | 2 | [Very High] |
| **6. Arcana** | Teal/Cyan | Unique modifiers | [6+] | 3 | [Rare; high] |
| **7. Beyond** | [Color TBD] | [Rarer] | [7+] | 3 | [Premium] |
| **8. Celestial** | [Color TBD] | [Premium rarity] | [8+] | 3 | [Premium] |
| **9. Divine** | [Color TBD] | [Ultra-rare] | [9+] | 3 | [Ultra] |
| **10. Cosmic** | [Color TBD] | Highest tier | [10] | 3 | 45,150× (1 Common) |

### Gear Categories

- **Main Weapons (6 types):** Sword (Knight), Bow (Ranger), Staff (Sorcerer), Crossbow (Hunter), Scepter (Mage), Axe (Warrior)
- **Off-Hand (6 types):** Shield, Arrow, Orb, Bolt, Tome, Hatchet
- **Armor (4 slots):** Helmet, Chest Armor, Gloves, Boots
- **Accessories (4 types):** Amulet, Earring (×2), Ring (×2), Bracer

**Total Equippable Slots:** 20

### Item Affixes & Properties

- **Unique Modifiers:** 81 documented (post-Plaguelands v1.2.0 update)
  - 17 signature effects (rework specific skills; e.g., "Skewer Shot deals 2× damage to bleeding enemies")
  - 64 skill enhancements (extra projectiles, cooldown reduction, element swaps)
- **Base Stats:** Flat bonuses (e.g., +38 Max HP) or percentage bonuses (e.g., +15% Fire Resistance, +30% All Elemental Resistance)
- **Gem Types:** 143 total crafting materials (Common through Cosmic rarities)

### Loot Generation

- **Wave Drops:** Enemies drop chests at specific kill milestones (varies by stage)
- **Chest Contents:** Scale with stage difficulty; higher tiers drop Immortal+ rarity more frequently in Hell/Torment
- **Offline Loot:** **Critical distinction:** Zero chests drop while client is closed; only rune-tree offline bonuses apply. Live idle (minimized but running) yields 4× more chests than offline calculation.
- **Material Farm:** Early stages yield Goblin Hide, Skeleton Bone, Slime Jelly; mid-game: Bat Wing, Ogre Blood, Mushroom Spore; late: Skull, Harpy Feather, Mandrake Root; endgame: Immortal/Arcana materials (Plaguelands mats, etc.)

---

## Pets & Passive Bonuses

### Pet System Overview

8 pets total: 5 farmable (base game), 3 premium (DLC). Each pet grants **permanent account-wide passive bonuses** (even if not deployed in combat).

### Farmable Pets

| Pet | Unlock Condition | Bonuses | Notes |
|-----|------------------|---------|-------|
| **Bat** | Defeat 5,000 Bats | +10% Common Chest, +15% EXP | Early-game staple |
| **Watcher** | Defeat 5,000 Giant Flies | +15% Gold per kill | Primary gold source |
| **Blue Golem** | Defeat 5,000 Hell Golems | +15% Common Chest | Redundant w/ Bat |
| **Dark Spirit** | Defeat 5,000 Ghosts | +15% Stage Boss Chest | Boss-tier loot |
| **[5th Farmable]** | [Unspecified] | [Unspecified] | [Unknown] |

### DLC Pets (Premium)

| Pet | Example Bonuses |
|-----|-----------------|
| **Dragon** | +Common Chest, +Gold, +EXP (triple stack) |
| **[Pet 2]** | [Unspecified] |
| **[Pet 3]** | [Unspecified] |

### Stacking Mechanic

Every pet unlock adds a permanent passive bonus layer. Unlocking all pets = unlimited passive bonus stacking, making pet acquisition a core long-term ROI activity.

---

## Combat Progression: Stages & Bosses

### Campaign Structure

- **Total Stages:** 120 (3 Acts × 10 stages × 4 difficulties)
- **Difficulty Order:** Normal → Nightmare → Hell → Torment
- **Boss Cadence:** Every Act ends at stage X-10 (boss encounter); stages 1–9 are waves

### Act Bosses

| Boss | Stage | HP (Torment) | Special Mechanic |
|------|-------|-------------|-----------------|
| **Skeleton King** | 1-10 (Throne of Darkness) | [Unknown] | [Unspecified] |
| **Desert Overlord** | 2-10 (Pharaoh's Underchannel) | [Unknown] | [Unspecified] |
| **Archon Morkar** | 3-10 (Hell Command Chamber) | 3,550 | Highest HP pool in campaign; final boss at all tiers |

### Wave Progression

- **Stage 1-1 (Pasture):** 10 waves
- **Mid-Game (Lvl 23–32):** 18 waves; kill requirements >198 per stage
- **Stage 1-9 (Cursed Land):** 13 waves
- Waves scale by difficulty (Hell/Torment versions have more waves)

---

## Monetization & Economy

### Free-to-Play Model (No Pay-to-Win Gate)

- **Base Game:** Free on Steam (no ads, no battle pass, no hero paywall)
- **DLC Classes:** Hunter ($4.99), Slayer ($4.99); Priest free (post-launch DLC)
- **Cosmetics:** [Unspecified in research]
- **Battle Pass:** [Not mentioned; likely none]

### In-Game Currency

- **Gold:** Primary currency (earned from mob kills, Rune tree scaled)
  - Uses: Rune tree upgrades, Cube function unlocks, Synthesis costs, Skill slot unlock (50,000 gold)
  - Scaling: Gold Per Kill rune scales farmer income; King Mobs, elite packs, and bosses drop more

### Steam Marketplace Integration (Unique Feature)

**Tradeable Item Restrictions (as of post-launch update):**
- **Equipment:** Legendary rarity and above only (Common/Uncommon/Rare removed from market)
- **Materials:** Decoration gems, Engravings, Inscriptions, Crafting materials (any rarity)
- **Access:** Trade Ship (unlocks Cube Lv 10; drag items to Steam inventory → list on Steam Community Market)

**Market Economy:**
- **Legendary+ Gear:** Primary driver of Steam Wallet revenue
- **Crafting Materials:** >50% of farmer revenue (Soulstones, Emeralds, etc.)
- **Price Stability:** Abundant loot supply keeps prices low (deflationary incentive)

### Soulstones (Boss Entry Keys)

- **Mechanic:** Consume on successful boss clear; no cost on failure
- **Tiers:** Normal, Nightmare, Hell, Torment (scale with difficulty)
- **Farm Source:** Acts 2–3 (stage 2+ bosses drop steady supply)
- **Market Value:** Torment Soulstones are ultra-premium, high-margin Steam Market items

### Offering Coins

- **Source:** Cube Offering function (converts items → coins)
- **Use:** [Unspecified; likely crafting ingredient or currency]

---

## UI/UX & Visual Design

### Aesthetic

- **Art Style:** Pixel art chibi (super-deformed; large heads, small bodies, exaggerated proportions)
- **Resolution:** [Unspecified; typical for tiny taskbar window: 480×360 or 640×480 estimated]
- **Character Sprites:** Equipped gear visually rendered on-character (Legends of Idleon-inspired paper-doll system)

### Item Tooltip Design (Inferred from Diablo 3 & TBH-specific notes)

**Tooltip Layout:**
1. **Header:** Item name (rarity color-coded) + item type (e.g., "Sword of Inferno")
2. **Rarity Badge:** Color indicator (Gray/Green/Blue/Yellow/Purple/Teal/etc.)
3. **Base Stats:** Attack, Armor, HP bonuses
4. **Sockets:** Visual gem slots + installed gems (if any)
5. **Affixes:** List of unique modifiers (signature effects or skill enhancements)
6. **Comparisons:** Highlight stat differences vs. currently equipped item
7. **Tier Marker:** Rarity name (e.g., "Legendary", "Cosmic")
8. **Flavor Text:** [Likely minimal or absent due to taskbar window constraints]

**Color Coding:**
- Common: Gray
- Uncommon: Green
- Rare: Blue
- Legendary: Yellow/Gold
- Immortal: Purple
- Arcana: Teal/Cyan
- Beyond/Celestial/Divine/Cosmic: [Inferred but unconfirmed in research]

### Taskbar Integration

- **Default Position:** Bottom-right of taskbar (configurable)
- **Always-On-Top:** Yes (floats above other windows)
- **Minimization:** Can minimize to tray; game continues running
- **Transparency:** Allows gaming/work in background

---

## Social & Engagement Features

### Trading & Player Interaction

- **Steam Market:** Core engagement loop; farmers check prices constantly
- **No Guild System:** [Not mentioned in research; likely none]
- **No PvP:** Fully PvE
- **No Cooperative Play:** Solo or parallel progression (no co-op dungeons)

### Achievements (50+ documented)

[Specific achievement names/conditions unspecified in research; likely tied to:]
- Milestone levels (reach level 50, 80, 101)
- Rune tree completion
- Item rarity milestones (craft first Legendary, etc.)
- Pet unlocks
- Boss defeats

---

## Known Issues & Community Feedback

### Negative Reviews (49–62% positive)

**Primary Complaints:**
1. **Data Collection:** Forced crash reports and in-game analytics (not user-optional)
2. **Bots & Macro Abuse:** Post-launch Steam Market integration triggered bot farming; server instability ensued
3. **Random Bans:** Anti-cheat crackdown swept up some legitimate players (false positives)
4. **Server Lag & Loot Loss:** Market overload caused missing items, dropped chests during peak times

### Positive Feedback

- Dopamine loop design (incremental unlocks, "one more node" rune progression)
- Idle gameplay (no active clicking required; genuinely playable AFK)
- Loot feedback (Diablo 3–tier satisfying numbers and mob density)
- Free-to-play with real trading (not P2W)

### Developer Response

Devs have acknowledged bans, provided clarity on cheating detection, and pushed balance patches (v1.01.x → v1.2.0 Plaguelands update added new stage, rebalanced market, etc.).

---

## Design Implications for Our Game

Based on Task Bar Hero's proven mechanics, our 2D MMO game should adopt or adapt:

### 1. **Rune Tree as Account Progression**
   - **Adopt:** 197-node fully-resettable tree with directional branches (N/S/E/W themes)
   - **Why:** Creates "one more node" dopamine loop; meaningful decisions without RNG; account-wide scope for multi-hero teams
   - **Adapt:** Embed quest milestones (e.g., "unlock Rune of Command after defeating Skeleton King 10 times") to tie progression to content
   - **Pricing:** Escalate gold costs (100 gold → 150,000 gold range) to maintain mid-game pacing; late-game runes should cost 1M+ for extreme dedication players

### 2. **Hero-dric Cube (Synthesis) as Core Crafting**
   - **Adopt:** 9-to-1 synthesis ladder; 8 cube functions (Synthesis, Alchemy, Crafting, Decoration, Extraction, Engraving, Offering, Inscription)
   - **Why:** Diablo 3's Horadric Cube is the model game for gear progression; no RNG on tier-up (guaranteed path to Cosmic)
   - **Adapt:** 
     - Unlock functions at hero levels, not Cube levels (e.g., Synthesis at hero Lv 4, Engraving at hero Lv 25)
     - Introduce Cube recipes tied to story chapters (act bosses drop recipe scrolls)
   - **Scaling:** Tier-1→2 (10 gold) → Tier-8 (10,000 gold); Cube XP from all operations; cap Cube at Lv 100 with exponential costs

### 3. **10-Tier Rarity Ladder (Loot 2.0)**
   - **Adopt:** Common through Cosmic; socket slots unlock by rarity (Rare: 1, Immortal: 2, Arcana: 3)
   - **Why:** Players immediately understand progression path; no "pay to win" tier (synthesis guarantees path upward)
   - **Adapt:**
     - Tie rarity colors to visual gear appearance (blue armor looks like mithril; purple looks arcane, etc.)
     - Cosmic tier items should be **cosmetic trophies** in addition to functional stat items (title unlocks, NPC dialogue changes)

### 4. **Steam Marketplace as Meta-Economy**
   - **Adopt:** Tradeable Legendary+ items; materials tradeable at all rarities
   - **Why:** Creates second-loop engagement (price speculation, farming optimization); no pay-to-win (free players can farm and sell)
   - **Adapt for Browser + Steam Cross-Play:**
     - Browser version uses in-game mail system (items sent to Steam version via verification key)
     - Steam version uses Steam Marketplace; browser version uses game-client trading post
     - Equalize prices across platforms daily (API-driven market sync)

### 5. **Pets as Permanent Passive Stacking**
   - **Adopt:** 8+ pets; each unlock adds permanent bonus (Gold Per Kill, EXP, Chest Drop %)
   - **Why:** Long-term engagement (players chase pet unlocks for months); non-linear ROI (early pets pay off immediately; late pets compound value)
   - **Adapt:**
     - Tie pets to world zones (Slime Grove pet = Slime area; Fire Cavern pet = Fire boss)
     - Pet rarity tiers (Common pet +10% gold; Legendary pet +50% gold + unique buff)

### 6. **Combat Feedback & Dopamine Design**
   - **Adopt:**
     - Damage numbers (large, floating; color-coded by damage type: red=fire, blue=cold, etc.)
     - High mob density (13–18 enemies per wave is psychologically satisfying)
     - Visual cascades on kill (gold drops, particle bursts, screen shake on boss death)
   - **Why:** Matches Diablo 3's "gore-fest" appeal; idle gameplay needs strong feedback since player isn't actively clicking
   - **Adapt:**
     - Add screen-filling boss ultimate casts (area denial; encourage party positioning)
     - Milestone notifications ("Rune Slot Unlocked!", "First Legendary!") tied to progression

### 7. **Skill System (4 Active Slots, 3 Passive Tiers)**
   - **Adopt:** 6 active skills per hero + 3 passive enhancement tiers (18 passive bonuses per hero)
   - **Why:** Builds retain depth without decision paralysis; respec is free (Rune tree is fully resettable)
   - **Adapt:**
     - Skill points are earned per level (1 skill point per hero level); max 6 points (one per active skill slot)
     - Passive tier unlocks are Rune-tree-gated (second passive tier at Rune "Skill Mastery Lv 2", etc.)

### 8. **Socket Synergy (Red/Blue/Yellow Color Matching)**
   - **Adopt:** 3 socket colors; bonus on 2–3 color matches (e.g., 3 Red = +150% True Damage chance)
   - **Why:** Adds tactical build-crafting layer without overwhelming UI; color-coded gems are intuitive
   - **Adapt:**
     - Add "Synergy Bonus" UI tooltip (hover gem socket; show bonus if completed)
     - Limit synergy bonuses to 1–2 per item (cap power creep; prioritize strategic choice)

### 9. **Paragon-Style Infinite Scaling (Post-Level-Cap)**
   - **Adopt:** Level 101 cap, but Rune tree + Cube continue providing stat growth (Diablo 3's Paragon equivalent)
   - **Why:** Prevents "soft reset" frustration; engaged players feel progression indefinitely
   - **Adapt:**
     - Post-Level-101, XP goes into "Prestige" tier (account-wide +1% stat gain per Prestige level)
     - Prestige resets for cosmetic reward (title "Eternal Wanderer +1", etc.)

### 10. **Market Transparency & Price Indices**
   - **Adopt:** Live market price feeds (in-game price ticker showing Legendary Sword avg price)
   - **Why:** Farmers optimize; casual players understand value; reduces fraud
   - **Adapt:**
     - Add historical price graphs (7-day moving average) to encourage long-term investment
     - Weekly "Market Report" email (player-opt-in) showing top movers, best-selling items, flip opportunities

### 11. **DLC Class Model (Free + Paid)**
   - **Adopt:** 3 free base classes + 1 free DLC class + 2 paid ($4.99 each) classes
   - **Why:** Proven retention model; $4.99 is accessible; players justify as "coffee price" for 100+ hours played
   - **Note:** Do not gate hero slots/Rune tree by DLC; only lock class choice

### 12. **Avoid These TBH Pain Points**
   - **Do NOT:** Force optional analytics/crash reports
   - **Do NOT:** Have a bot farming problem (implement rate-limits on loot drops; server-side loot calculation)
   - **Do NOT:** Have false-positive ban waves (audit anti-cheat; whitelist edge cases)
   - **Prevent:** Market manipulation by capping flip margins (e.g., "items cannot be listed below last 7-day avg price - 50%")

---

## Open Questions to Ask the User

1. **Diablo 3 Inspiration Level:**
   - How close do we want to follow Diablo 3's 2.0 loot system (1-rarity tier per item) vs. TBH's multi-tier rarity within slots?
   - Should we copy Diablo's "Legendary power" unique effects, or use TBH's "Unique Modifiers" system (81 effect pools)?

2. **Paragon & Infinite Scaling:**
   - After level cap (presumably 100–120 in our MMO), should post-level progression be linear (Diablo Paragon style), exponential, or capped at a "true endgame"?
   - Should Paragon be account-wide or per-hero?

3. **Steam Marketplace Integration:**
   - Do we require Steam? Or do we build in-game marketplace (browser + Steam in sync)?
   - Should browser and Steam versions trade together, or keep them separate economies?

4. **Pet/Companion System Depth:**
   - Should pets be 1D (flat +gold bonus) or 2D (pets have builds, pets level up, pets have synergies)?
   - Do we want 8 pets or 50+ pets (collectathon)?

5. **Rune Tree Scope & Size:**
   - 197 nodes is medium-sized; should our tree be smaller (100 nodes, shallower) or larger (300+ nodes, deeper)?
   - Should rune tree be account-wide (all heroes share it), or per-hero (each hero has own tree)?

6. **Hero Slots & Party Composition:**
   - Should we match TBH's 3-hero party limit, or allow 5–6 heroes (common in MMOs)?
   - Should formation (hero positioning) matter mechanically (front-row knights tank, back-row mages AoE)?

7. **Crafting & Cube Accessibility:**
   - How much should casual players craft vs. farm? TBH assumes farmers AFK 20+ hours/day.
   - Should crafting recipes be **discoverable** (players test combinations) or **documented** (wiki tells exact recipes)?

8. **Skill System Depth:**
   - Should skills have branching (e.g., "Fireball splits into 3 projectiles" as passive tier 3)?
   - Should "Aura Skills" (permanent passive effects) scale with item stats, or be flat bonuses?

9. **Boss Raid Mechanics:**
   - Should boss fights have phases (change attack patterns at 50%, 25% HP), or simple DPS races?
   - Should bosses be farmable infinitely (like TBH) or once-per-week lockout (like WoW raids)?

10. **Cross-Play & Progression Sync:**
    - If browser + Steam versions share marketplace, should they share save files (same account)?
    - Or separate but connected (browser = "demo", Steam = "main" with sync-back option)?

---

## Sources

### Official & Community Wikis
- https://taskbarhero.org/en/cube/ — Hero-dric Cube crafting guide (blocked by proxy; cached info used)
- https://taskbarhero.org/en/runes/ — Rune Tree 197 nodes guide (blocked by proxy; cached info used)
- https://taskbarhero.org/en/grades/ — Item rarity tiers
- https://taskbarhero.org/en/items/ — Item socket system
- https://taskbarhero.org/en/heroes/ — Hero stats and skills
- https://taskbarhero.org/en/stages/ — Boss encounters and stage guide
- https://taskbarhero.org/en/market/ — Steam Market trading
- https://task-bar-hero.wiki/ — Comprehensive fan wiki
- https://taskbarhero.wiki/ — Community wiki & mechanics
- https://tbh-wiki.com/ — Practical guide (farming, builds, items)
- https://taskbarheroguide.com/ — Database & guide hub

### Game Details & Reviews
- https://store.steampowered.com/app/3678970/TBH_Task_Bar_Hero/ — Official Steam store page
- https://steamcommunity.com/app/3678970 — Steam community hub (reviews, discussions)
- https://steamcommunity.com/sharedfiles/filedetails/?id=3744134720 — "Complete Stat Guide" community guide
- https://steamcommunity.com/sharedfiles/filedetails/?id=3734611647 — "Task Bar Hero 101" beginner guide
- https://allthings.how/task-bar-hero-tops-526000-concurrent-steam-players-amid-mixed-reviews/ — Concurrent player stats
- https://www.pcgamer.com/games/rpg/task-bar-hero-tier-list/ — PC Gamer tier list & team composition guide

### Monetization & DLC
- https://gg.deals/dlc/tbh-task-bar-hero-priest-class/ — DLC pricing (Priest, Hunter, Slayer)
- https://games.gg/tbh-task-bar-hero/guides/tbh-task-bar-hero-how-to-earn-money-steam-market-tbh-task-bar-hero/ — Steam Market earning guide

### Systems & Mechanics
- https://mobalytics.gg/gamebase/guides/tbh-taskbar-hero-meta-team-guide — Meta team & progression guide
- https://mobalytics.gg/gamebase/guides/task-bar-hero-cube-crafting — Cube crafting & cost breakdown
- https://games.gg/tbh-task-bar-hero/guides/tbh-task-bar-hero-complete-guide-cube-runes-and-pets-explained/ — Comprehensive systems guide
- https://probonk.com/tbh-task-bar-hero/rune-tree — Rune Tree & progression paths
- https://probonk.com/tbh-task-bar-hero/grades — Item rarity details
- https://gamerant.com/tbh-task-bar-hero-how-to-get-more-hero-slots/ — Hero slot unlocking guide

### Community & Economy
- https://taskbarheroguide.org/guides/idle-vs-offline/ — Idle vs offline progression distinction
- https://note.com/ai_insights/n/nc413472642d3?hl=en — Japanese guide on Cube & equipment
- https://note.com/ai_insights/n/n714c39d578e9?hl=en — DLC evaluation & cost-performance analysis
- https://www.gamemeca.com/en/view.php?gid=1776119 — Player count & market criticism (Korean gaming news)

### Development & Industry
- https://www.gamespress.com/TBH-Task-Bar-Hero-Now-Available-Via-STEAM — Official press release (Nugem Studio, May 27, 2026)
- https://www.thegamer.com/players-are-facing-random-bans-on-one-of-2026s-most-played-games/ — Dev clarification on ban controversy

---

## Conclusion

Task Bar Hero proves that depth and engagement survive in "idle" formats when design prioritizes incremental progression, transparent feedback, and player agency. Its 197-node Rune Tree, 10-tier Loot 2.0 system, Horadric Cube mechanics, and Steam Marketplace integration create a multi-loop game where farmers, collectors, and story-players all find resonance. For a 2D MMO inspired by Diablo 3 and Legends of Idleon, the most valuable adoption is **Rune Tree + Cube synthesis + transparent marketplace**, as these address the core pain point of 2020s multiplayer ARPGs: perceived pay-to-win treadmills. By guaranteeing a synthesis path to Cosmic tier for any free player, we eliminate the frustration of impossible gear gaps. Combined with Legends of Idleon's paper-doll visuals and our massively-multiplayer world, these systems create a game that rewards both active play (boss runs for rare drops) and AFK engagement (materials farming), satisfying the dopamine loop that launched TBH to 526,000 concurrent players despite mixed reviews.

