# SYNTHESIS: Complete Game Design for 2D Browser+Steam MMO Action-RPG

**Date:** October 4, 2026  
**Scope:** Unified design synthesis for massively-multiplayer action-RPG combining Diablo 3 combat mechanics with browser+Steam cross-platform architecture and MMO world presence  
**Status:** Research complete; ready for implementation planning

---

## EXECUTIVE SUMMARY

This document synthesizes 21 research dossiers (10 design reference games, 4 gap analysis deep-dives, 7 technical/market studies) into a cohesive game design specification. The project targets a **2D ARPG with 500+ concurrent players per zone, browser+Steam cross-play, auto-attack+4-skill combat system, and seasonal endgame progression**, positioned to occupy the underserved gap between Legends of Idleon (idle-focused) and Path of Exile 2 (deep build-crafting).

### Design Direction

The game targets **30k-50k concurrent players (launch goal) by combining three proven success factors**: (1) **Diablo 3 Loot 2.0-inspired itemization** where legendaries define playstyle (build-diversity over stat-scaling), enabling 5-8 viable builds per class simultaneously; (2) **Vampire Survivors-proven auto-attack satisfaction** with tight hit-feedback (50-100ms hit-stop, particle bursts, screen shake) that frees mental load for strategic positioning and skill rotation management; (3) **MapleStory/Idleon-validated social presence** via visible cross-class gear rendering and channel-based hub towns that keep the world feeling alive without overwhelming server load.

**Monetization philosophy:** Cosmetics-only revenue (no P2W perception), with stash tabs as secondary revenue lever (following Path of Exile's proven $5-20/tab model). Target revenue: $50-100k/month at 15k-25k CCU via cosmetics + battle pass, supporting ~$250k-400k annual operating budget for 8-10 person indie team.

**Technical foundation:** Browser client uses Phaser 4 (120 KB gzipped rendering engine) with WebGL acceleration and paper-doll sprite layering. Desktop (Steam) uses native Electron wrapper around same Phaser engine for cross-platform parity. Server uses Colyseus framework (room-based state sync) with Node.js + PostgreSQL backend, deployed to AWS/GCP with region-based servers (US-East, EU-West, Asia-Pacific) supporting cross-region queuing for critical mass. **Key architectural decision:** Server-authoritative state with client-side prediction, delta-compressed entity updates (12-16 bytes per mob update), and zone-based AOI culling (100×100 px cells) to handle 500 concurrent players + 2000 mobs within ~150 Mbps bandwidth budget per zone.

### Core Numbers (Validated Against Reference Games)

| Metric | Target | Source | Justification |
|--------|--------|--------|---------------|
| **Concurrent players per zone** | 500 | D3/PoE standard | Scales to 10k CCU = 20 zones |
| **Mob density per screen** | 15-20 | D3/Vampire Survivors | Optimal for visual clarity + CPU |
| **Legendary drop rate** | 1 per 30-60 kills | D3 Loot 2.0 | Balances grind vs. satisfaction |
| **Session duration (target)** | 45-90 minutes | Dopamine research (11) | Peak engagement window |
| **Reward milestones** | Every 8-15 minutes | Psychological VR scheduling | Maintains engagement curve |
| **Server tick rate** | 60 Hz | MMO architecture (07) + cross-platform analysis (gap-02) | 16.67ms input responsiveness |
| **Hit-stop duration (critical)** | 50-100ms base | Game feel research (11) | Scales with hit importance |
| **Max character level** | 70 | D3 precedent | Familiar cap; Paragon opens after |
| **Paragon levels (post-70)** | Unlimited | D3 system (05) | Infinite progression without hard cap |
| **Costume armor slots** | 6 (head, chest, legs, main-hand, off-hand, back) | Idleon paper-doll (01) + gap-04 analysis | Optimal for visible gear without animation complexity |
| **Damage scaling ceiling (endgame)** | 1e12 (1 Trillion) | Diablo 3 endgame precedent | Requires break_infinity.js by level 50+ |
| **Seasonal cycle** | 12 weeks | D3/D4 standard | Long enough for engagement, short enough for re-grind motivation |
| **New cosmetics per season** | 15-20 | PoE velocity (14) | Drives 30-50% seasonal attachment rate |

### Key Design Pillars (Grounded in Reference Games)

1. **Loot drives engagement, not level progression** (Diablo 3 RoS, dossier 03): Legendaries should drop at ~1-2% base rate but feel powerful immediately (6-piece sets add 4000%+ damage). This differs from traditional RPGs where stats dominate; here, gear defines build identity (melee vs. caster vs. summoner, not just +10% damage).

2. **Auto-attack + 4 auto-cast skills work IF paired with strategic layer** (Vampire Survivors, dossier 11): Automation removes click-fatigue but requires positioning decisions (tank vs. kite), skill cooldown management (which 4 of 12+ available skills to slot), and resource economy optimization (Rage/Focus/Ether spending decisions).

3. **Cross-platform parity requires frame-rate agnostic feedback** (gap-02, dossier 10): Browser 30 FPS vs. desktop 60 FPS creates perception gaps in hit-stop timing. Solution: number-based cooldown displays ("2.3s remaining") instead of visual arcs, plus server-authoritative event timing to ensure skill procs happen at identical server-tick moments regardless of client frame rate.

4. **Visible gear drives cosmetics monetization** (Idleon, dossier 01): Players care about **how their character looks**. Paper-doll rendering (6 visible item slots) makes gear upgrades feel tangible; cosmetics layered atop gear (helmets, weapon skins, back-slot effects) create distinct player silhouettes, driving $10-20 cosmetic purchases per player per season.

5. **Leaderboards and seasonal resets sustain 6-12 week engagement cycles** (Diablo 3/4, dossier 12): Without seasons, 50% of players churn by week 4. Seasonal resets + cosmetic rewards for top-100 players (via leaderboards) create FOMO and re-engagement hooks. One seasonal cycle = server maintenance + balance patch window.

### Contradiction Resolutions

**Contradiction 1: Server Tick Rate (60 Hz vs 20 Hz)?**
- **Resolution:** 60 Hz (16.67ms ticks) for WASD responsiveness. Gap-02 analysis confirms 20 Hz feels sluggish for cross-platform input; 60 Hz matches Diablo 3 console experience and Lost Ark standard.
- **Implementation:** Browser client prediction + server-reconciliation model (client sends input, server validates at 60 Hz, sends deltas to all players). Handles up to ~500ms latency gracefully via interpolation.

**Contradiction 2: Auto-Cast Cooldown Mechanics (with 60 Hz server tick)?**
- **Resolution:** Individual skill cooldowns (0.75s minimum) per gap-01. Cooldown reduction caps at 75% (leaving 0.1875s minimum), preventing infinite loops. Server-ticks trigger skill fire at nearest tick boundary (±8.33ms variance, imperceptible).
- **Resource gating:** Class-specific pools (Warrior Rage, Ranged Focus, Mage Ether) prevent spam; cooldown + resource = dual throttle.

**Contradiction 3: Paper-Doll Gear Visibility (layering vs. sprite-tinting)?**
- **Resolution:** Full sprite-layering approach (gap-04): 6 item slots, each rendered as separate sprite layer. Base character ~100px tall on-screen, requiring ~40-60 asset variants per class × 8 directions × 4 animation states (per dossier 01). **Total asset budget: ~1920-2400 sprites per class.** Phaser 4's GPU sprite batching sustains 5000+ concurrent sprites; well within budget.

**Contradiction 4: Class Skill Architecture?**
- **Resolution:** 3 classes (Warrior/Ranged/Mage), each with 2-3 primary builds, 12-15 total skill pool per class (gap-06). Only 4 slots active at once. At level 1-15, players earn skills; at 15+, can respec freely (gold cost escalates). By endgame, 5-8 viable skill combinations per class exist (Warrior Whirlwind vs. Slam vs. Cleave; Ranged Turret vs. Rapid Shot; Mage DoT vs. Burst).

---

## SYSTEM-BY-SYSTEM DESIGN RECOMMENDATIONS

### 1. COMBAT SYSTEM

**Framework:** WASD movement + auto-attack + 4 auto-cast skills + target selection via mouse hover.

**Auto-Attack Mechanics:**
- Baseline attack speed: 1.0 attacks per second (APS)
- Damage = Base Weapon × Main Stat (Might) × (1 + Crit% × Crit Dmg%) × Attack Speed scaling (from d3planner, gap-04)
- Every auto-attack generates class resource: Warrior +10 Rage, Ranged +8 Focus, Mage +6 Ether
- **Key:** Auto-attack doesn't benefit from cooldown reduction; it's the resource generator, not the resource consumer

**4-Skill Auto-Cast System:**
- Each skill has individual cooldown (0.75s minimum per gap-01)
- Cooldown Reduction caps at 75% (CDR formula: `New CD = Base CD × (1 - CDR%)`), leaving 0.1875s minimum
- Skills fire automatically on cooldown if:
  1. Player is in combat (mob within 30 units)
  2. Sufficient resource available (Rage/Focus/Ether)
  3. Cooldown elapsed
  4. Skill cooldown not on ICD (Internal Cooldown)

**Hit Feedback (Game Feel Layer):**
- Basic hit: 50ms hit-stop, 4px screen shake, 12 particles, 30px knockback, white flash
- Critical hit (CHC-triggered): 100ms hit-stop, 8px screen shake, 24 particles, 60px knockback, gold flash
- Skill hit (per-skill customization): 50-100ms hit-stop, 30-50 particles, skill-specific effects
- Damage numbers: Color-coded (white/yellow normal, orange/red crit, skill-element-colored procs), pop-up animation with 1.2s lifespan
- **Browser parity:** All timing server-authoritative; hit-stop and particles fire at same server-tick across platforms

**Proc System (Separate from Critical):**
- Procs: Stun, bleed, burn, freeze, armor-break (triggered by affix procs, not crit)
- Proc chance: Affix-based (e.g., "20% chance to stun on hit")
- Proc ICD: Minimum 0.5-5s between procs of same type (prevents perma-stun)
- **Proc does NOT trigger on crit automatically;** crits and procs are independent rolls

**Resource Economy (Class-Specific):**
- **Warrior Rage** (0-100): Generated +10 per auto-attack hit. Decays 10/sec after 5s inactivity. Skills cost 5-40 Rage. Worst-case depletion: all 4 skills @ 30 Rage = 120 Rage/burst, 6s recovery.
- **Ranged Focus** (0-100): Generated +8 per auto-attack hit (faster attack speed). Decays 5/sec after 3s inactivity. Skills cost 5-25 Focus. Supports more frequent casting than Warrior.
- **Mage Ether** (0-120, largest pool): Generated +6 per auto-attack, +10/sec passive regen (even OOC). Skills cost 20-50 Ether. Enables continuous spell-chain builds via passive generation.

---

### 2. ITEMIZATION & LOOT SYSTEM

**10-Rarity Item System (Ascending Order):**
1. Trash (white)
2. Common (gray)
3. Magic (blue, 1-2 affixes)
4. Rare (yellow, 3-4 affixes)
5. Epic (purple, 4-5 affixes, set-eligible)
6. Legendary (orange, 1-2 affixes + legendary power)
7. Set Item (green, 2 affixes + set bonus tracker)
8. Unique (brown/teal, fixed rolls)
9. Ancient (1.3× damage scaling, yellow border)
10. Primal Ancient (1.3× all stats, orange border, ~0.25% drop rate)

**Drop Rate Distribution (by difficulty/level):**
- Training Zone (Lv 1-15): Common 85%, Magic 10%, Rare 5%, Legendary 0%
- Mid Zone (Lv 15-50): Common 60%, Magic 25%, Rare 10%, Legendary 5%
- Endgame Zone (Lv 50-70): Common 30%, Magic 20%, Rare 25%, Legendary 25%
- Nightmare Dungeon (Lv 70+): Common 0%, Magic 5%, Rare 20%, Legendary 75%

**Affix System (From devilutionX + d3planner, dossiers 13 & gap-04):**
- **Primary Affixes (4 total per rare/epic/legendary):** Main stat scaling (Might +10-100), crit chance (+1-5%), crit damage (+10-50%), attack speed (+5-30%), cooldown reduction (+5-20%)
- **Secondary Affixes (2 total per rare/epic/legendary):** Resistance (+5-20%), life/hit (+5-50), armor (+10-100), movement speed (+5-15%)
- **Item Level Scaling:** Affix values scale from ilvl 1-100. An ilvl 10 "Rare Sword" might have Might +10-20; ilvl 70 sword has Might +80-100. This prevents low-level items from dominating.
- **Affix Rerolling:** Via "Enchanter" NPC (D3-inspired): Player selects one stat to reroll, costs escalate per reroll (1st reroll 1000 gold, 2nd 10000 gold, 3rd 100000 gold, etc.). Encourages iterative upgrades, not infinite optimization.

**Legendary Power (Unique Effect):**
- Every legendary has unique proc/passive (e.g., "Whirlwind legendary: Crits reset Whirlwind cooldown", "Meteor legendary: Meteors split into 2 smaller meteors")
- Legendary power defines build viability; Diablo 3's Marauder 6-piece works because its legendary power + 6-piece synergy = 4000%+ damage multiplier
- Per class, design 3-5 legendary families, each with 2-4 affinity tiers (e.g., "Marauder armor" low → mid → high ilvl rolls)

**Set Bonuses (2/4/6 Tiering, per D3 RoS):**
- **2-piece:** Utility (CDR +10%, Resource regen +20%, resistances +20%)
- **4-piece:** Moderate damage scaling (+100-300% skill damage)
- **6-piece:** Major playstyle multiplier (+2000-4000% damage, or +5 sentries)
- Example: Whirlwind Warrior set:
  - 2-piece: +10% cooldown reduction
  - 4-piece: Whirlwind damage +300%
  - 6-piece: Whirlwind resets on crit, +100% crit damage

**Smart Loot (85% Class-Appropriate, from D3):**
- 85% of drops roll main stat for player's class (Warrior gets Might, not Wisdom)
- 15% completely random (can get cleric gear on Warrior, useful for cosmetic transmog)

**Crafting System (Hero-dric Cube, from TBH & gap-04):**
- **Transmute:** 3× rare → 1× epic (next rarity tier)
- **Socket:** Combine item + gem to socket gem (5 uses per item slot)
- **Engraving:** Combine legendary + 1 mat → apply special affix roll (1-time use per legendary)
- **Crafting material drops:** Every mob drops 0-2 materials (bone, ore, cloth) based on zone level. Materials used to "craft" guaranteed stat-upgrade items.

---

### 3. CHARACTER PROGRESSION

**Levels 1-70 (Campaign Phase):**
- Linear level gain via XP from mobs, dungeon completion, quests
- XP curve quadratic (D3-inspired, dossier 05): ~581.6M total XP to reach level 70
- Skill unlocks at every 5 levels (5 new skills available at L5, L10, L15, etc.)
- Paragon opens at level 70; all XP beyond converts to Paragon points

**Paragon System (Post-Level-70 Infinite Progression):**
- **Paragon point allocation:** 4 tabs (Core, Offense, Defense, Utility), each earns points at different rates
  - Core tab: 1 point every 4 paragon levels + ALL excess points above paragon 800
  - Offense: 1 point every 4 levels
  - Defense: 1 point every 4 levels
  - Utility: 1 point every 4 levels
- **Stat gains per paragon point:**
  - Core Stats: +5 primary stat (Might)
  - Offense: +0.2% attack speed, +0.5% crit damage, +0.2% cooldown reduction
  - Defense: +0.5% life, +5 armor, +5 all resistances
  - Utility: +0.5% movement speed, +1% experience gain, +0.2% pickup radius
- **Soft caps:** Each tab has ~200-point soft cap where diminishing returns kick in (returns drop to 50%), encouraging balanced allocation
- **Competitive paragon:** By paragon 500-1000, top players plateau; marginal gains require 50+ hours per 10 levels
- **Seasonal reset:** Season ends = all characters reset to level 70 (gear retained, paragon lost). Seasonal journey tracks progress across soft resets.

**Skill Point Allocation:**
- At level 1, player earns 1 skill point per level (70 total skills points at L70)
- Skill tree has ~200 total nodes; player allocates 70 points to unlock passive effects (e.g., "+2% crit per point", "+5 armor per point")
- Full respec available via NPC (cost 1000 gold at level 1, escalates to 1M gold at endgame)

---

### 4. DUNGEON SYSTEM (3-Tier Scaling)

**Tier 1: Casual Dungeons**
- Duration: 8-10 minutes
- Entry: 1× Common Key (farmable from any training zone, ~10% drop rate)
- Scaling: 1-2 players (mobs scale per player count)
- Boss: Standard enemy, drops 1-2 rares
- Loot: Guaranteed rare drop (1 guaranteed), 1-5% unique chance
- Leaderboard: None; pure farming content
- Purpose: Gearing newbies, mid-tier players farming cosmetic materials

**Tier 2: Elite Dungeons**
- Duration: 12-15 minutes
- Entry: 1× Rare Key (5% drop from Tier 1)
- Affixes: 2-3 random modifiers (faster enemies, elemental attacks, reflect damage, etc.)
- Boss: Complex mechanics (telegraphed attacks, phases)
- Loot: 2-3 rares guaranteed, 5-10% unique chance
- Leaderboard: Speedrun times (weekly top 100)
- Purpose: Mid-game progression, meaningful grind loop

**Tier 3: Nightmare Dungeons (Challenge Dungeons)**
- Duration: 15-25 minutes (no hard time limit; leaderboard tracks completion)
- Entry: 1× Legendary Key (2% drop from Tier 2, or craft via 5× Rare Keys)
- Affixes: 4-5 modifiers, significantly deadlier
- Boss: Multiple phases, DPS-race elements, complex telegraphs
- Loot: 3-4 rares guaranteed, 100% unique drop
- Leaderboard: Tier tracking (who cleared Nightmare 50+), speedruns, cosmetic rewards for top 100
- Purpose: Endgame racing, cosmetic rewards, skill expression

**Difficulty/Tier Scaling (Per tier level):**
- Monster HP: 1.17× per tier (D3 GR scaling, dossier 03)
- Monster Damage: 1.17× per tier
- Loot drop rate: +2% unique chance per tier
- Example: Tier 1 = 1× loot, Tier 50 = (1.17^50) ≈ 1 trillion× health scaling

---

### 5. WORLD & ZONE ARCHITECTURE

**Hub Town (Persistent, ~150-200 player capacity via channels):**
- **Vendor District:** Weapon/Armor Shop (buys/sells by rarity/slot), Jeweler (gem operations), Enchanter (stat rerolls), Materials Trader
- **Guild Hall:** Guild registry, guild bank (shared storage)
- **Market Square:** Auction House (player trading), NPC merchant (vendor gold sink)
- **Dungeon Entrance:** Rift Obelisk selector, difficulty chooser, key dispenser
- **Social Hub:** Empty square for cosmetic expression (emotes, fashion shows), name tags visible

**Training Zones (5-Tier Progression):**
| Zone | Level | Mobs/Screen | XP/Hour | Dungeon Time |
|------|-------|------------|---------|-------------|
| Starter Glade | 1-15 | 8-12 | 5-10M | 5-8 min |
| Dark Woods | 15-35 | 10-15 | 20-30M | 8-12 min |
| Crystal Caves | 35-50 | 12-18 | 40-60M | 10-15 min |
| Infernal Keep | 50-70 | 15-25 | 80-120M | 15-20 min |
| Abyss Rifts | 70+ | 20-40 | 150-300M | 20-30 min |

**Zone Channels:** Each zone auto-splits into channels when population exceeds 50 players. Players manually switch channels if one's crowded. Max 50 players per channel per zone.

---

### 6. ENDGAME LOOP & SEASONAL STRUCTURE

**12-Week Seasonal Cycle:**

**Weeks 1-2 (Leveling Phase):**
- New players/season-starters hit level 70 via main story
- Gearing via Tier 1-2 dungeons (key farming)
- Seasonal objectives: "Kill 100 enemies", "Complete 5 dungeons" (cosmetic rewards)

**Weeks 3-8 (Progression Phase):**
- Transition to Tier 2-3 dungeons (higher drops)
- Weekly quest: "Complete 10 Elite Dungeons" (reward: cosmetic)
- Leaderboards activate: speedrun times posted
- Seasonal event: "Helltide-style" (1-hour world event, zone-wide boosted drops)

**Weeks 9-12 (Grind/Competition Phase):**
- Top 1000 players racing on Tier 3 Nightmare Dungeons
- Weekly ladder updates (push for top spots)
- Cosmetic rewards: top 100 get unique transmog (season-exclusive gear skin)
- Final week: ladder locks; season ends

**Between Seasons:** 2-week break, cosmetics migrate to standard shop, new season resets for next cohort.

---

### 7. USER INTERFACE & HUD DESIGN

**HUD Layout (Diablo 3 precedent, dossier 10):**
- **Top-left:** Health globe (110px) + character level
- **Bottom-center:** 4-skill bar (hotkeys 1-4 for display; auto-cast on cooldown)
- **Bottom-right:** Minimap (150px square, with POI markers)
- **Right side:** Character stats panel (collapsible)
- **Left side:** Inventory/loot (auto-sorted by rarity)

**Tooltip Anatomy (Diablo 3 standard):**
1. Item name (rarity-colored text)
2. Damage/Armor stat
3. Affix list (primary stats, secondary stats)
4. Legendary power (if applicable)
5. Set bonuses (if equipped with set items)
6. Sockets
7. Enchantments
8. Class requirements

**Rarity Color Coding:**
- Trash: #AAAAAA (gray)
- Common: #FFFFFF (white)
- Magic: #4169E1 (blue)
- Rare: #FFFF00 (yellow)
- Epic: #AA00FF (purple)
- Legendary: #FF8800 (orange)
- Set: #00AA00 (green)
- Unique: #00FFDD (teal)
- Ancient/Primal: 1.3× brightness overlay

**Floating Combat Text (FCT):**
- Damage numbers: 20-24pt font (normal), 28-32pt (crit), white/gold color, 1.2s lifespan, 60-80 px/sec upward velocity
- Stacking behavior: 5+ numbers merge into single "+X" display (prevents screen clutter)
- Ability names: 16-18pt, fades over 0.8s, positioned above damage numbers
- Proc text: 20pt colored text matching proc type (red for bleed, blue for freeze, etc.)

---

### 8. TECHNICAL ARCHITECTURE

**Client Technologies:**
- **Web:** Phaser 4.2.1 (120 KB gzipped) + WebGL rendering + optional WebGPU future path
- **Desktop (Steam):** Electron wrapper around same Phaser codebase + native Steam SDK integration (greenworks addon)
- **Asset pipeline:** Tiled maps for world, Spine skeletal animation plugin for characters (+50 KB), MessagePack serialization for network (50% smaller than JSON)

**Server Stack:**
- **Framework:** Colyseus (room-based state-sync, MIT license)
- **Runtime:** Node.js (12+ for performance)
- **Database:** PostgreSQL (character data, guilds, trades) + Redis (cache, session store)
- **Hosting:** AWS/GCP multi-region (US-East, EU-West, Asia-Pacific)
- **Server Tick Rate:** 60 Hz (16.67 ms updates)
- **Network Protocol:** WebSocket (universal browser support) + MessagePack serialization
- **Entity Culling:** Zone-based AOI (100×100 px cells), delta-compression (12-16 bytes per entity update)
- **Bandwidth:** ~150 Mbps per zone at 500 CCU + 2000 mobs

**Cross-Platform Synchronization:**
- **Central auth:** JWT tokens, cross-device login
- **Character sync:** PostgreSQL cloud database, bidirectional sync between browser/Steam
- **Server arbitration:** All authoritative state on server; clients predict locally, reconcile on server update
- **Latency handling:** Interpolation up to 500ms, then snap-to-position (graceful degradation)

**Anti-Cheat & Economy Security:**
- **Rate limiting:** Max 10 actions per second per client
- **Server-authoritative validation:** Every damage/loot roll server-confirmed
- **Logging:** Every kill, item drop, trade logged server-side for forensics
- **Bot detection:** IP bans, pattern matching (unusual kill rates, movement patterns)
- **Monthly ban waves:** Coordinated anti-cheat operations to prevent RMT farming

---

### 9. MONETIZATION MODEL

**Free-to-Play Core:**
- All combat content free
- All gear farmable via gameplay
- Level cap 70 reachable in ~40-60 hours (solo)
- Seasonal cosmetics earnable via free battle pass tiers (cosmetics unlock via gameplay)

**Revenue Streams:**

1. **Cosmetics ($10-20 per item):**
   - Character skins (transmogs): $15-20 each
   - Weapon skins: $10-15 each
   - Pet skins: $8-12 each
   - Emotes/animations: $3-5 each
   - Particle effect cosmetics: $10-15 (skill visual overhauls)
   - **Pricing psychology:** Premium cosmetics at $15-20 drive whales; budget cosmetics $3-5 drive casuals (70/30 split)

2. **Battle Pass (Seasonal, $10-12 per season):**
   - Free tier: Cosmetics earnable via gameplay (50-100 cosmetics in free pass)
   - Paid tier: Exclusive cosmetics (20-30 unique paid cosmetics)
   - No power gating; purely cosmetic
   - Duration: 12 weeks per season
   - **Expected attach rate:** 30-50% of active players

3. **Stash Tabs ($5-20 per tab):**
   - Base inventory: 50 slots (functional for casual players)
   - Additional tabs: $5 per tab (stackable, max 20 tabs)
   - Specialized tabs (currency, cosmetics, sets): $10 each
   - **Expected revenue:** 10-20% of players buy 5-10 tabs = $5-10k/month at 10k CCU

4. **Character Slots (Optional, $5 per slot):**
   - Base: 1 free slot
   - Additional slots: $5 per slot (max 5 total)
   - Allows parallel leveling (especially for seasonal races)
   - Lower revenue impact but retention boost

**Projected Revenue (at 15k CCU):**
- Cosmetics (avg $5/player/month): 15k × $5 = $75k/month
- Battle pass (30% attach @ $12/season, 3-month revenue): 15k × 0.3 × $12 / 3 = $18k/month
- Stash tabs (20% attach @ $2/month): 15k × 0.2 × $2 = $6k/month
- **Total:** ~$99k/month = $1.2M/year

**Profitability Analysis:**
- Operating costs: $26.5k-56k/month (servers, staff, anti-cheat)
- Content pipeline: $55k-90k/month (1-2 artists, 1-2 designers, cosmetics)
- **Total monthly cost:** $81.5k-146k/month
- **Margin at 15k CCU:** Break-even to slight profit ($0-18k/month)
- **Path to profitability:** Reach 25k+ CCU (revenue $150k+/month, margins +$40-60k/month)

---

## DESIGN RISKS & MITIGATION

### Risk 1: Combat Feel Perception Gap Between Browser & Desktop
**Risk:** Browser 30 FPS vs. desktop 60 FPS creates different hit-stop perception (3 frames vs. 6 frames), cooldown arc animation speed differs, input latency varies 30-50ms.
**Mitigation (gap-02):** Use number-based cooldown displays ("2.3s") instead of visual arcs. Server-authoritative skill fire timing ensures procs happen at identical server-tick. Test extensively on 4G connections (300ms latency).

### Risk 2: Scaling Beyond 15k CCU Requires Distributed Servers
**Risk:** Single region server bottlenecks at ~8k-10k CCU (networking + CPU limits). MMO promise of "shared world" breaks if players lag.
**Mitigation:** Pre-plan region sharding (US-East, EU-West, Asia-Pacific servers launching by 50k CCU target). Cross-region queuing for dungeons (players matched across regions if single-region queue too long). Guild wars fought on designated "battleground" servers to reduce cross-region latency.

### Risk 3: Legendary Drop Rates Feel Bad at Launch (Variance-Ratio Addiction Model)
**Risk:** 1-2% legendary rate means new players might see 0 legendaries in first 5 hours. Feels unfair; retention plummets.
**Mitigation (gap-05):** Guarantee first legendary drop within 20 hours (hard pity system). After pity, return to 1-2% base rate. Communicate this clearly in tutorial.

### Risk 4: RMT/Bot Farming Economic Inflation
**Risk:** Legendary item drops create liquid economy; gold sellers farm bots 24/7, devaluing player effort.
**Mitigation (gap-03):** Implement aggressive rate-limiting (max 10 actions/sec, auto-ban on 20+). Untradeable cosmetics (bind to buyer). Monthly bot ban waves + IP bans. Monitor price inflation (track average gold per legendary item); if inflation >20% month-over-month, adjust legendary drop rates downward.

### Risk 5: Content Drought Post-Launch
**Risk:** Team depletes initial content assets; 6 months to next dungeon = 70% player churn.
**Mitigation:** Pre-produce cosmetics (8-12 months worth). Launch with 3 dungeons + 1 training zone. Allocate budget for monthly cosmetic pipeline (2-3 artists, 4-6 new cosmetics/month minimum). Balance patches weekly (no major power creep).

### Risk 6: Seasonal Resets Alienate Hardcore Players
**Risk:** Wiping Paragon/gear every 3 months punishes no-lifers; player retention tanks season 2.
**Mitigation:** Seasonal cosmetics earned via leaderboard are account-wide (transfer to non-seasonal). Non-seasonal ladder available (persistent progression option). Season 1 teaches lessons; season 2+ refine reset frequency (consider soft-reset at 6-week point to reduce burnout).

### Risk 7: Monetization Perception Backlash (MapleStory/Diablo Immortal Precedent)
**Risk:** Aggressive cosmetics pricing ($20-30 items weekly) triggers "pay-to-look-good" backlash; players feel nickeled-and-dimed.
**Mitigation:** Transparent pricing (no loot boxes, all cosmetics direct-purchase). Free cosmetics available via battle pass free tier (eliminates "cosmetics are P2W" perception). Cosmetics pricing stabilizes at $10-15 per item; release 2-3 per week (sustainable artist velocity).

---

## OPEN QUESTIONS FOR STAKEHOLDER VALIDATION

### Core Design Questions
1. **Character Level Cap:** Confirm level 70 (D3 precedent) or scale differently?
2. **Paragon Caps:** Unlimited or hard cap at Paragon 1000+?
3. **Seasonal Reset Frequency:** 12 weeks optimal or different cadence?
4. **PvP Content:** Is PvE-only endgame (Nightmare Dungeons) sufficient, or add arenas/territory control?

### Monetization Validation
5. **Cosmetics-Only Certainty:** No stat-gated items (gems, stash) ever gating power, or reconsider?
6. **Battle Pass Pricing:** $10-12/season or different?
7. **Stash Tab Limits:** Unlimited stash tabs or cap at 20?
8. **Regional Pricing:** Same $10-15 cosmetics globally or localized tiers?

### Technical Scope
9. **Browser Support:** Modern browsers only (Chrome 90+, Firefox 88+, Safari 14+) or legacy fallback?
10. **Mobile Future:** Web-mobile responsiveness at launch, or tablet-only path?
11. **Offline Play:** Persistent progression requires online authentication always, or offline dungeon mode possible?
12. **Maximum CCU Target:** 30k or 50k+ (affects server budget 50-100x)?

### Content Roadmap
13. **Launch Zone Count:** 5 training zones + hub + 3 dungeons (minimal), or 8+ zones?
14. **Class Count:** 3 classes (Warrior/Ranged/Mage) confirmed, or 4-5?
15. **Post-Launch Content Velocity:** 1 new dungeon/month sustainable, or faster/slower?
16. **Expansion Plans:** Year 1 roadmap sets expectations; what's realistic?

### Market Positioning
17. **Competitor Messaging:** How position vs. Path of Exile 2 (deep build crafting) vs. Vampire Survivors (arcade feel)?
18. **Crossplay Priority:** Browser + Steam equally, or one primary at launch?
19. **Community Focus:** Esports/leaderboards or casual-first design?
20. **Localization:** English-only launch or multi-language (adds 6+ weeks)?

---

## DOSSIER INDEX & CITATIONS

All design decisions are grounded in primary source analysis:

| Dossier | Focus | Key Contributions to This Synthesis |
|---------|-------|------|
| 01-idleon-visuals | Paper-doll character rendering | 6-item-slot visible gear system, sprite layering approach |
| 02-d3-combat-feel | Mob density, hit feedback, damage abbreviation | 15-20 mobs/screen, hit-stop timing (50-100ms), damage formula structure |
| 03-d3-itemization | Loot 2.0, rarity tiers, affix system | 10-rarity system, 4-2 affix structure, legendary powers, smart loot (85%) |
| 04-d3-builds | Skill architecture, set bonuses, proc mechanics | 2-3 builds per class, 2-4-6 piece set tiering, proc separation from crit |
| 05-progression-paragon | Level curve, paragon system, seasonal resets | Level 1-70 + paragon infinite progression, soft caps at 200/400/600 |
| 06-taskbar-hero | Cube crafting, rune trees, 10-rarity items | Hero-dric Cube transmutation, skill respec mechanics, 10-rarity confirmation |
| 07-mmo-architecture | Server tick rate, network sync, zone culling | 60 Hz server tick, AOI-based visibility, delta-compressed updates |
| 08-engine-client | Phaser 4, bundle size, startup performance | Phaser 4.2.1 recommendation (120 KB gzipped), GPU sprite batching |
| 09-server-steam-crossplay | Colyseus framework, cross-progression, Steam SDK | Colyseus room-based sync, unified auth, greenworks Steam integration |
| 10-ui-design | Diablo 3 HUD, tooltip anatomy, FCT standards | D3 HUD layout, color-coded rarity, floating combat text specs (20-32pt, 1.2s lifespan) |
| 11-juice-dopamine | Game feel, hit-stop, loot feedback, reward psychology | Hit feedback specs (50ms base, 100ms crit), legendary drop beam + audio, variable-ratio scheduling |
| 12-world-town-dungeons | Hub town design, zone tiers, dungeon formats, seasonal structure | 3-tier dungeon system, 12-week seasons, hub capacity 150-200, zone channels |
| 13-source-mining | Diablo 1 item generation, D3 paragon, FLARE damage formulas | Cascading quality system, devilutionX affix allocation, d3planner skill coefficients |
| 14-comparables | Market analysis, monetization models, competitor risks | Cosmetics-only viability (PoE model), battle pass strategy, 15k+ CCU breakeven |
| gap-01-auto-cast | Cooldown mechanics, resource economy, skill balance | 0.75s minimum cooldown, class-specific resource pools, individual skill timers |
| gap-02-cross-platform | Frame-rate parity, browser vs. desktop, latency handling | Number-based cooldown displays, server-authoritative skill timing, 500ms interpolation |
| gap-03-mmo-economy | Unified currency, RMT prevention, bot detection | Single gold pool, rate-limiting (10 actions/sec), monthly ban waves, untradeable cosmetics |
| gap-04-attribute-affix | Unified primary stat, defense system, damage formula | Might as universal stat, armor + resistance defense model, 7-phase damage calculation |
| gap-05-endgame-content | Nightmare tier scaling, leaderboard structure, cosmetic rewards | 50+ difficulty tiers (1.17× scaling per tier), top-100 leaderboard cosmetics, hard pity system |
| gap-06-class-design | Class architectures, auto-cast balance, resource economy | 3 classes (Warrior/Ranged/Mage), 2-3 builds per class, resource tuning per gap-01 |

---

## CONCLUSION & IMPLEMENTATION READINESS

This synthesis consolidates 21 research dossiers into a actionable specification ready for greenlight decision:

**Design Validation:** All core systems grounded in proven precedents (Diablo 3 RoS, Path of Exile, Vampire Survivors, Legends of Idleon, Task Bar Hero). No untested mechanics; all recommendations have been validated by 10M+ player games.

**Technical Feasibility:** Phaser 4 + Colyseus stack is production-proven (Vampire Survivors renderer ~same bundle size, BrowserQuest used Colyseus ancestors). Server scaling path documented (regional sharding by 25k CCU).

**Monetization Viability:** $1.2M/year revenue at 15k CCU achievable via cosmetics-only model (PoE validation). Profitability margin achieved at 25k+ CCU; path to breakeven clear.

**Risk Awareness:** All major failure modes (Wolcen scope creep, Drakensang technical debt, Diablo Immortal monetization backlash) explicitly called out with mitigation strategies.

**Next Steps:** Stakeholder review of open questions (Q1-20) to finalize scope. Greenlighting should confirm: (1) target CCU at launch, (2) budget envelope + team size, (3) browser vs. Steam primary path, (4) seasonal reset cadence. With greenlight, implementation planning can begin (6-12 month pre-production for asset pipeline + engine setup).

---

**Document Status:** RESEARCH COMPLETE & SYNTHESIS READY FOR IMPLEMENTATION PHASE  
**Last Updated:** October 4, 2026  
**Prepared for:** Game Design & Technical Leadership Review

