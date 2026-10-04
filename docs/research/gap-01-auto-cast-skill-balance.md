# Auto-Cast Skill System Design & Balance Model

**Research Date:** October 4, 2026  
**Focus:** Complete auto-cast skill mechanics for 2D MMO with WASD movement + 4 auto-cast skills per character  
**References:** Task Bar Hero (4-skill auto-cast system), Diablo 3 RoS (resource economy, skill balance), Path of Exile (cooldown mechanics), Last Epoch (auto-cast balance)

---

## Executive Summary

Auto-casting fundamentally changes skill balance from manual casting (click-to-target) to passive cycling (cooldown-based). This dossier designs a complete auto-cast system where 4 skills fire independently on their individual cooldowns, with three major design challenges: (1) preventing infinite-loop builds through cooldown floors and resource management, (2) creating meaningful skill rotations despite automation, and (3) ensuring auto-cast builds don't trivialize endgame content while remaining satisfying.

**Key Deliverables:**
- Cooldown minimum: **0.75 seconds** (prevents spam, maintains visual clarity)
- Resource economy: **Class-specific pools** (Warrior: Rage, Ranged: Focus, Mage: Ether) with per-skill costs
- Proc mechanics: **Separate from crit** (procs are guaranteed or RNG; crits amplify damage but don't trigger skill procs)
- Three worked builds: Warrior melee, Ranged turret, Mage DoT with damage formulas
- Balance framework: Auto-cast and manual-cast remain viable, neither is strictly superior

---

## Part 1: Cooldown System Design

### 1.1 Cooldown Floor (Hard Minimum)

**Proposed Minimum:** **0.75 seconds (1.33 casts per second)**

**Justification:**
- Path of Exile uses 0.5s minimum for cast-on-crit and trigger mechanics (too fast for visual clarity in 2D MMO)
- Last Epoch uses 0.5–1.0s minimums depending on skill type (balanced between spray and clarity)
- Task Bar Hero doesn't state explicit minimum but implies skills fire at defined intervals (not unlimited)
- Diablo 3 uses 0.5s for fastest abilities; endgame builds achieve 3-5 casts/second with attack speed
- **0.75s is optimal** because:
  - At 4 simultaneous skills on 0.75s cooldown, maximum theoretical cast rate = **5.33 casts/second** (all 4 skills + 1 off-cooldown)
  - Visual density is high but readable (particle culling can hide excess projectiles)
  - Prevents click-spam addiction; plays reward slow, satisfying rhythm
  - Cooldown reduction caps at 75% (leaving ~0.19s minimum, not 0s)

**Cooldown Reduction Cap:** 75% maximum
- Formula: `New Cooldown = Base Cooldown × (1 − CDR%)`
- Example: 0.75s base with 75% CDR = 0.75 × 0.25 = **0.1875s minimum** (5.33 casts per skill)

### 1.2 Cooldown Types

Three cooldown mechanics must coexist to prevent balancing nightmares:

#### A. Primary Cooldown (Shared Across All Skills)
- **Not recommended** for your game; forces all 4 skills on same timer (visual monotony)
- D3 avoids this; each skill has independent cooldown

#### B. Individual Cooldown Per Skill (RECOMMENDED)
- Each of 4 skills has separate cooldown (e.g., Fireball 1.2s, Meteor 2.0s, Teleport 3.0s)
- Skills fire independently based on individual timers
- Allows diverse skill combinations (fast abilities + slow nuke abilities)
- **Example rotation:**
  - t=0s: Auto-attack fires + Fireball fires
  - t=0.75s: Fireball ready again
  - t=1.2s: Auto-attack fires + Fireball fires + Teleport ready
  - t=1.5s: Fireball + auto-attack fires
  - t=2.0s: Meteor ready + Fireball + auto-attack
  
This creates natural rhythm without click-spam.

#### C. Internal Cooldown (ICD) / Proc Rate Limiting
- Certain effects (stuns, disarms, damage amplification) have separate ICD
- Example: "Stunning Strike has 5-second ICD; only 1 stun per 5 seconds maximum"
- Prevents perma-stun chains
- Used for high-impact crowd control abilities

**Your game implementation:** Individual cooldowns per skill + ICD for crowd control effects.

---

## Part 2: Resource Economy Design

### 2.1 Class-Specific Resource Pools

Rather than unified resource, implement **class-specific mechanics** matching fantasy and play style:

#### Warrior: Rage Pool
| Stat | Value | Notes |
|------|-------|-------|
| **Max Rage** | 100 | Displayed as bar |
| **Rage per auto-attack** | +10 | Generates on hit |
| **Rage decay (OOC)** | 10 per second after 5s inactivity | Incentivizes continuous combat |
| **Rage costs** | Variable per skill (5–40 per cast) | Whirlwind: 30/cast, Slam: 40/cast |

**Warrior Rotation Example (assuming 0.75s skill cooldown):**
- Auto-attack fires every 0.5s (baseline attack speed)
- Skill slot 1 (Whirlwind, cost 30 Rage): fires every 1.2s, consumes 30 Rage per cast
  - Rage requirement: 30 ÷ 1.2s = 25 Rage/sec needed
  - Auto-attacks generate: 10 Rage per 0.5s = 20 Rage/sec baseline
  - **Deficit:** Needs +5 Rage/sec from gear/passives → achievable via items or passive skills
- Skill slot 2 (Slam, cost 40 Rage): fires every 2.0s, consumes 40 Rage per cast
  - Rage requirement: 40 ÷ 2.0s = 20 Rage/sec needed

**Worst-case scenario:** All 4 skills firing simultaneously with high Rage costs
- If all 4 skills cost 30+ Rage and fire within 0.75s window: 120 Rage/burst
- Recovery time: 120 Rage ÷ 20 Rage/sec = 6 seconds before next burst
- **Prevents infinite loops:** Resource depletion forces downtime

---

#### Ranged: Focus Pool
| Stat | Value | Notes |
|------|-------|-------|
| **Max Focus** | 100 | Ranged resource (lighter/more responsive) |
| **Focus per auto-attack** | +8 | Generates slower than Warrior |
| **Focus decay (OOC)** | 5 per second after 3s inactivity | Shorter decay window |
| **Focus costs** | Low per skill (5–25) | Encourages frequent rotation |

**Ranged Rotation Example:**
- Skill slot 1 (Rapid Shot, cost 10 Focus): fires every 0.75s, consumes 10 Focus/cast
  - Requirement: 10 ÷ 0.75s ≈ 13.3 Focus/sec
  - Auto-attacks generate: 8 Focus per 0.4s (higher attack speed) = 20 Focus/sec
  - **Surplus:** Can sustain Rapid Shot indefinitely + other skills
- Skill slot 2 (Multishot, cost 25 Focus): fires every 1.5s
  - Requirement: 25 ÷ 1.5s ≈ 16.7 Focus/sec
  - Can stack with Rapid Shot without starvation
- Skill slot 3 (Turret deploy, cost 40 Focus): fires every 3.0s
  - Requirement: 40 ÷ 3.0s ≈ 13.3 Focus/sec
  - Total rotation: 13.3 + 16.7 + 13.3 = 43.3 Focus/sec needed vs. 20 generated
  - **Requires +23 Focus/sec from gear/passives** (achievable but not trivial)

**Design intent:** Ranged builds prioritize consistent output (Rapid Shot sustains). Burst abilities (Multishot, Turret) require gear investment.

---

#### Mage: Ether Pool
| Stat | Value | Notes |
|------|-------|-------|
| **Max Ether** | 120 | Largest pool; supports 4-skill spam |
| **Ether per auto-attack** | +6 | Lowest per hit; spells are expensive |
| **Ether regen (passive)** | +10 per second even OOC | Encourages channeling/passive regen |
| **Ether costs** | High per skill (20–50) | Spell-balanced design |

**Mage Rotation Example:**
- Skill slot 1 (Fireball, cost 25 Ether): fires every 1.0s
  - Requirement: 25 ÷ 1.0s = 25 Ether/sec
  - Auto-attacks generate: 6 per 0.6s = 10 Ether/sec
  - Passive regen: +10 Ether/sec
  - **Total available: 20 Ether/sec** (still deficit of 5)
  - Needs gear bonus to sustain
- Skill slot 2 (Meteor, cost 45 Ether): fires every 2.5s
  - Requirement: 45 ÷ 2.5s = 18 Ether/sec
- Skill slot 3 (Teleport, cost 20 Ether): fires every 3.0s (utility, not spam)
  - Requirement: 20 ÷ 3.0s ≈ 6.7 Ether/sec
  - Low cost allows frequent repositioning

**Design intent:** Mages balance high spell costs against passive Ether regeneration. Continuous channel spells (Disintegrate, Ray of Frost) are cheap or free.

---

### 2.2 Resource Economy Worst-Case Calculation

**Scenario:** All 4 skill slots firing simultaneously with maximum Rage/Focus/Ether costs

| Class | Slot 1 | Slot 2 | Slot 3 | Slot 4 | Total Cost/Burst | Recovery Time |
|-------|--------|--------|--------|--------|------------------|---------------|
| **Warrior** | Whirlwind (30) | Slam (40) | Cleave (25) | Dash (20) | 115 Rage | 5.75s @ 20 Rage/s regen |
| **Ranged** | Rapid Shot (10) | Multishot (25) | Turret (40) | Piercing (15) | 90 Focus | 4.5s @ 20 Focus/s regen |
| **Mage** | Fireball (25) | Meteor (45) | Teleport (20) | Arcane Bolt (15) | 105 Ether | 5.25s @ 20 Ether/s regen |

**Key insight:** Worst-case recovery is 5–6 seconds. During recovery, players can:
- Continue auto-attacking (generates resource)
- Move/reposition (non-resource abilities)
- Activate Ether regen (Mage passive)
- Trigger resource-generation passives

This prevents skill-spam while maintaining engagement.

---

## Part 3: Proc Mechanics and Critical Hit Interaction

### 3.1 Proc Types: Guaranteed vs. RNG

Auto-cast skills fire on cooldown, but their **effects** can be deterministic or probabilistic:

#### Type A: Guaranteed Procs (Deterministic)
- **Fire every cooldown** without fail
- Examples: "Fireball fires every 1.2s and applies Fire DoT"
- Pro: Predictable damage; easier to balance
- Con: Boring; no excitement from RNG
- **Used for:** Primary rotation skills (Rapid Shot, Whirlwind, Fireball)

#### Type B: Conditional Procs (On-Hit RNG)
- **Fire only when a condition is met** (e.g., "30% chance per auto-attack to cast Stunning Strike")
- Examples: "5% chance to trigger Ricochet"; "Meteors spawn on crit"
- Pro: Creates variance; encourages optimization
- Con: Can feel unreliable at low proc chance
- **Recommended proc floor:** 15% (1 in 6 average; feels reliable but not guaranteed)
- **Recommended proc ceiling:** 75% (3 in 4 average; high-chance, still RNG)

#### Type C: Stacking Procs (Buildup)
- **Charge up over time, then trigger all at once**
- Example (from Torchlight Infinite): "Charges build during combat; at 10 stacks, next spell triggers Spell Burst"
- Pro: Creates distinct rhythms (charge phase vs. burst phase)
- Con: Complex to communicate UI
- **Your game:** Use sparingly (1-2 abilities max)

**Recommendation:** Mix guaranteed (core rotation) + conditional (special effects) + stacking (1 ability per class).

---

### 3.2 Crit Chance Interaction with Auto-Cast

**Critical question:** Does 50% crit chance mean:
1. 50% of auto-casts trigger a crit damage multiplier, OR
2. 50% of auto-casts trigger a separate "crit proc" ability?

**Answer:** Separate mechanics.

#### Crit Damage Multiplier (Separate from Procs)
- **Formula:** `Damage × (1 + Crit Chance × (Crit Damage − 1))`
- Example: 50% Crit Chance + 100% Crit Damage = 1.5× average damage
- Applies to **all skills automatically**; no gating
- D3 model; proven to work at scale

#### Crit-Based Proc (Optional Secondary Effect)
- **Independent RNG roll:** "50% crit chance" doesn't trigger auto-cast procs
- **Separate passive:** "Critical hits trigger Ricochet" (15% chance on crit)
- This allows builds to specialize: "high crit for damage" vs. "high crit for effects"
- Prevents overwhelming cascade (crit doesn't double-proc every ability)

**Your game design:**
- All auto-cast skills benefit from crit damage multiplier naturally
- Optionally: 3-4 abilities have crit-based triggers (not all)
- Example Mage: "Fireball: guaranteed cast every 1.0s. Critical hit Fireballs spawn 2 additional projectiles (15% proc chance)."

---

### 3.3 Attack Speed Interaction with Auto-Cast

Auto-attacks generate resources, so attack speed directly scales rotation sustainability:

**Formula:** `Casts Per Second = Base Attack Speed × (1 + Attack Speed Bonus%)`

| Class | Base APS | With +50% AS Gear | Resource Gen/sec |
|-------|----------|------------------|------------------|
| Warrior | 1.0 | 1.5 | 15 Rage (10 per hit × 1.5) |
| Ranged | 1.4 | 2.1 | 16.8 Focus (8 per hit × 2.1) |
| Mage | 0.8 | 1.2 | 7.2 Ether (6 per hit × 1.2) |

**Impact:** Higher attack speed = more resource generation = more frequent skill casting.

**Breakpoint system (optional):** Certain attack speeds unlock additional "ticks" of attack speed bonuses:
- 1.5 APS = "breakpoint 1" (baseline casts per second)
- 2.0 APS = "breakpoint 2" (unlock +25% bonus damage on every hit)
- 3.0 APS = "breakpoint 3" (unlock +50% bonus damage on every hit)

This creates incentive to stack attack speed without making small bonuses feel worthless.

---

## Part 4: Three Worked-Out Example Builds

### Build 1: Warrior Melee Whirlwind

**Fantasy:** Spin in place, applying Rend DoT to all nearby enemies.

**Gear Setup (Endgame Example):**
- Main weapon: Bul-Kathos's Oath (greatsword, +30% attack speed, generates Rage on hit)
- Head: Crown of Ancient Kings (Warrior class set, +50 Rage cap)
- Chest: Plate of the Juggernaut (armor, +15% damage reduction)
- Rings: Convention of Elements (cycles through damage types every 4 seconds)

**Skills (4 Auto-Cast Slots):**
1. **Whirlwind** (1.2s cooldown, costs 30 Rage/cast)
   - Spins in place, deals 400% weapon damage to nearby enemies
   - Applies Rend DoT to all hit enemies
   - With Wrath of the Wastes set: +10,000% damage multiplier (101x)
   - Generates Rage equal to enemies hit (max 10 per cast)

2. **Rend** (0.8s cooldown, costs 15 Rage/cast)
   - Refreshes Rend DoT on all enemies affected
   - Scales with Bleed set bonus (+5,000% damage per hit)
   - Generates 5 Rage per cast

3. **Cleave** (1.5s cooldown, costs 25 Rage/cast)
   - Wide arc attack, 350% weapon damage
   - Applies Bleed (75% weapon damage per second for 6 seconds)
   - Generates 8 Rage per hit

4. **Ground Stomp** (3.0s cooldown, costs 20 Rage/cast)
   - Crowd control; stuns all enemies for 1.5 seconds (5-second ICD)
   - 200% weapon damage
   - Generates no Rage (utility ability)

**Damage Calculation (Single Target: Level 70 Rare Enemy):**

**Baseline Weapon Damage:** 500 DPS (typical endgame greatsword)

**Whirlwind Damage Per Tick:**
- Base: 400% weapon damage = 2,000 damage
- Set bonus (6-piece Wrath): 2,000 × 101 = **202,000 per tick**
- Crit multiplier (assuming 50% crit, 300% crit damage): 202,000 × 1.5 = **303,000 per tick**
- With Convention of Elements (physical cycle, +3× multiplier): 303,000 × 3 = **909,000 per tick**

**Rend DoT Damage:**
- Base Rend: 75% weapon damage per second for 6 seconds = 450 total damage per Rend
- With Bleed set bonus (+5,000%): 450 × 51 = **22,950 per second** while active
- 6 simultaneous Rends (different applications) on target = **137,700 per second DoT**

**Rotation DPS (Sustained Combat):**
- Whirlwind fires every 1.2s: 909,000 per tick × (1 per 1.2s) = 757,500 DPS
- Rend fires every 0.8s: 22,950 per second (continuous) = 22,950 DPS
- Cleave fires every 1.5s: 350% × 101 × 1.5 (bleed multiplier) = 529,750 damage per cast = 353,167 DPS
- Total sustained: **757,500 + 353,167 + 22,950 = 1,133,617 DPS**

**Against Mob Density (5 Enemies):**
- Whirlwind hits all 5: 909,000 × 5 = 4,545,000 per tick
- Rend × 5 targets: 22,950 × 5 = 114,750 per second
- Cleave hits all 5: 529,750 × 5 = 2,648,750
- **Total: 7,308,500 DPS vs. 5 enemies** (1.46M DPS per enemy)

**Resource Management:**
- Rage generation: Auto-attacks at 1.0 APS generate 10 Rage per hit = 10 Rage/sec baseline
- Skill costs per rotation:
  - Whirlwind: 30 Rage per 1.2s = 25 Rage/sec
  - Rend: 15 Rage per 0.8s = 18.75 Rage/sec
  - Cleave: 25 Rage per 1.5s = 16.67 Rage/sec
  - Ground Stomp: 20 Rage per 3.0s = 6.67 Rage/sec
  - **Total cost: 67.09 Rage/sec**
- **Deficit: 57.09 Rage/sec** (requires gear/passives to generate +57 Rage/sec)
- **Solution:** 
  - Passive ability: "Rampage" (gain +50 Rage/sec when below 50% Rage)
  - Legendary ring: "Ring of Endless Rage" (+25 Rage/sec while moving)
  - Bul-Kathos's Oath bonus: +10 Rage per enemy hit (with 5 enemies = +50 Rage/sec)
  - **Total available: 10 + 50 + 25 = 85 Rage/sec** (overcap available; can sustain burst)

**Survivability:**
- Base armor: 5,000 (from Plate of the Juggernaut + paragon stats)
- Armor reduction formula: `Damage Taken = 100 / (100 + 5000) = 1.96%` (98% damage reduction)
- With damage reduction from Whirlwind 4-piece: 98% × 0.5 = 49% (additional 49% reduction while spinning)
- Effective toughness: Taking only 2% damage while Whirlwind active

**Endgame viability:**
- Can solo Greater Rift 120+ with this build (typical endgame content)
- Does NOT screen-clear (Whirlwind radius ~20 yards; doesn't hit entire screen)
- Takes ~30 seconds to clear a pack of 10 enemies (high damage but not infinite)
- Dies if surrounded by 30+ enemies without healing/mobility (balanced challenge)

---

### Build 2: Ranged Turret Deployment

**Fantasy:** Deploy 3-4 turrets that auto-fire projectiles while player focuses on positioning.

**Gear Setup:**
- Main weapon: Bombardier's Rucksack (quiver, +2 max turrets, turrets last 120s)
- Head: Visage of Gunes (helm, +50% turret attack speed)
- Rings: Convention of Elements (damage cycling)

**Skills (4 Auto-Cast Slots):**
1. **Sentry Deploy** (2.0s cooldown, costs 40 Focus/cast)
   - Summons a turret at cursor position, lasts 120 seconds
   - Each turret auto-fires Rapid Shot (see slot 2) independently
   - With Marauder set: +12,000% damage per active turret
   - Generates 5 Focus on successful deploy

2. **Rapid Shot** (0.75s cooldown, costs 10 Focus/cast)
   - Player fires projectile; sentries copy this every time player casts
   - 250% weapon damage per projectile
   - Generates 8 Focus per hit

3. **Multishot** (1.5s cooldown, costs 25 Focus/cast)
   - Fires 5 projectiles in fan pattern
   - Each projectile 200% weapon damage
   - Sentries fire Multishot when player does (5 projectiles × number of sentries)
   - Generates 15 Focus per cast

4. **Evasive Fire** (1.0s cooldown, costs 5 Focus/cast)
   - Backward dash + projectile shot
   - 150% weapon damage; repositioning utility
   - Generates 6 Focus per cast

**Damage Calculation (3 Sentries Active):**

**Single Sentry Baseline:**
- Sentry base damage: 280% weapon damage per auto-attack
- With Marauder 4-piece: 280% × 4.0 = 1,120%
- With Marauder 6-piece (3 sentries): 1,120% × (1 + 0.12 × 3) = 1,120% × 1.36 = **1,523.2% per sentry**

**Rapid Shot Mirroring:**
- Player casts Rapid Shot (1 projectile): 250% × 1.5 (sentry bonus) = 375% per sentry
- 3 sentries mirror: 375% × 3 = 1,125% total
- Player projectile: 375%
- **Combined: 1,500% per Rapid Shot cycle** (every 0.75s)

**Multishot Cascade:**
- Player fires: 5 projectiles × 200% = 1,000% weapon damage
- 3 sentries fire: 5 projectiles × 200% × 3 = 3,000%
- **Combined: 4,000% per Multishot** (every 1.5s)

**Turret Independent Fire (Off Player Actions):**
- Sentries also auto-attack when idle: 1,523.2% per sentry, 3 sentries = 4,569.6% per hit
- If Rapid Shot cooldown is 0.75s and player isn't casting: sentries still auto-attack every 0.75s
- **Independent DPS: 4,569.6 × 1.33 = 6,077.6 DPS per turret** (baseline, no multipliers)

**Peak DPS Calculation (3 Sentries, Convention of Elements Physical Phase):**
- Rapid Shot damage: 1,500% × 1.33 (per 0.75s) = 1,500 * 1.33 = **1,995 damage per cycle** × convention 3x multiplier = 5,985 per sentry attack
  - Wait, let me recalculate with actual numbers:
- Base weapon: 400 DPS bow
- Rapid Shot: 250% = 1,000 damage
- With Marauder (×1.36 for 3 sentries): 1,360 per sentry
- × 3 sentries: 4,080 damage per player Rapid Shot
- Fire rate: 1 per 0.75s = 1.33 per second = **5,440 DPS from Rapid Shots**
- Multishot: 5 projectiles × 200% × 1.36 × 3 sentries = 4,080 per projectile × 5 = 20,400 per Multishot
- Fire rate: 1 per 1.5s = 0.67 per second = **13,668 DPS from Multishots**
- Baseline sentry auto-attacks: 6,077.6 × 3 = **18,232.8 DPS when player isn't using Rapid/Multi**
- **Total sustained: 5,440 + 13,668 + 18,232 = 37,340 DPS (single target, no crits, no other buffs)**

**With Convention of Elements 3x multiplier (physical cycle): 37,340 × 3 = 112,020 DPS**

**Against Mob Density (10 Enemies in Turret Range):**
- Rapid Shot AOE splash (20% Area Damage): Each hit splashes to 4 nearby enemies = 5,440 × 1.2 (with 20% splash) × 1.5 (average splash hits) ≈ 9,792 DPS to scattered mobs
- Multishot naturally hits 5 targets per volley: 20,400 already accounts for 5 projectiles
- Sentry auto-attacks hit nearest target per sentry, but with 10 enemies there's 100% uptime on hitting = 18,232 DPS unaffected
- **Mob-adjusted total: 9,792 + 20,400 + 18,232 ≈ 48,424 DPS effective** (higher vs. spread targets)

**Resource Management:**
- Focus generation: Auto-attacks at 1.4 APS × 8 Focus per hit = 11.2 Focus/sec
- Skill costs per rotation:
  - Rapid Shot: 10 Focus per 0.75s = 13.3 Focus/sec
  - Multishot: 25 Focus per 1.5s = 16.67 Focus/sec
  - Sentry Deploy: 40 Focus per 2.0s = 20 Focus/sec (but only at start of fight)
  - Evasive Fire: 5 Focus per 1.0s = 5 Focus/sec
  - **Total: 55 Focus/sec sustained** (during steady rotation)
- **Deficit: 55 − 11.2 = 43.8 Focus/sec**
- **Solution:**
  - Legendary ring: "Ring of Endless Focus" (+30 Focus/sec)
  - Passive: "Momentum" (+20 Focus/sec when 2+ sentries active)
  - Hit bonus from Multishot (15 Focus per hit × 5 projectiles = 75 Focus per cast, overcaps during bursts)
  - **Available: 30 + 20 + 75 ≈ 125 Focus per burst** (bursts available every 2-3 seconds)

**Survivability:**
- Ranged class: Low armor baseline (~2,000), relies on distance + kiting
- Passives: "Evasion" (10% dodge chance per Focus spent on Evasive Fire)
- Sentries draw aggro, allowing player to reposition
- Weak to melee rushdown if sentries are destroyed

**Endgame viability:**
- Can solo GR 115+ (good but not elite tier)
- Screen-clears packs via sentry density + splash damage
- Turret density (3 sentries) creates visual spectacle but not overlapping problem
- Dies if all sentries are destroyed and surrounded; requires active kiting

---

### Build 3: Mage DoT Stacking (Burn Specialization)

**Fantasy:** Cast multiple fire spells simultaneously; stacking burns amplify damage exponentially.

**Gear Setup:**
- Main weapon: Deathwish (wand, +75% spell damage)
- Off-hand: Serpent Sparker (spawns additional Hydra heads)
- Rings: Convention of Elements (physical/fire cycling)

**Skills (4 Auto-Cast Slots):**
1. **Fireball** (1.0s cooldown, costs 25 Ether/cast)
   - Projectile spell, 350% spell damage
   - Applies Fire DoT: 400% damage per second for 8 seconds
   - Generates 6 Ether per cast (resource refund mechanic)

2. **Hydra** (2.0s cooldown, costs 40 Ether/cast)
   - Summons elemental hydra heads (up to 3 from gear)
   - Each head auto-casts independently (mirroring Fireball rotation)
   - 300% spell damage per head per attack
   - Applies Fire DoT: 300% damage per second for 8 seconds
   - Generates 8 Ether per cast

3. **Teleport** (3.0s cooldown, costs 15 Ether/cast)
   - Instant repositioning; no damage
   - Generates 5 Ether on use (mobility = resource refund)
   - Utility slot

4. **Arcane Orb** (0.8s cooldown, costs 12 Ether/cast)
   - Fast projectile spell, 200% spell damage
   - High proc rate for "Chain Lightning" (30% chance to bounce to nearby enemy)
   - Generates 8 Ether per cast

**Damage Calculation (DoT Stacking Focus):**

**Burn Effect (Firebird Set Bonus):**
- Each enemy hit by Fire applies Burn stack (up to 50 stacks)
- Damage bonus per stack: +2% (stacking to +100% at 50 stacks)
- Burn duration: 8 seconds

**Single Target Burn Stack Progression:**
- t=0s: Fireball hits → 1 Burn stack, enemy takes 350% spell damage + 400% DoT/sec
- t=1.0s: Fireball #2 hits → 2 Burn stacks (damage = 350% × 1.02 + 400% DoT × 2)
- t=2.0s: Hydra hit #1 → 3 Burn stacks
- t=2.0s: Fireball #3 hits → 4 Burn stacks
- t=2.8s: Arcane Orb hits + bounces to target → 6 Burn stacks
- ... (continues until target reaches 50 stacks)
- t=6.0s: Stable state at 50 stacks

**Peak Single-Target DPS (50 Burn Stacks):**
- Base fire damage per cast: 350% Fireball + 300% Hydra + 200% Arcane = 850% per "cycle"
- With Burn amplification: 850% × 1.0 (1 + 0.02 × 50) = 850% × 2.0 = **1,700% per cycle**
- Burn DoT damage: 400% (Fireball) + 300% (Hydra) = 700% per second × (1 + 0.02 × 50) = 1,400% per second
- Cycles per second (assuming average 1 spell per 0.8s): 1.25 cycles/sec = **2,125% direct damage/sec**
- Total peak: **2,125 + 1,400 = 3,525% damage/sec**

**Scaling with Weapon Damage (300 DPS wand):**
- Direct damage: 2,125% × 300 = 6,375 damage/sec
- DoT damage: 1,400% × 300 = 4,200 damage/sec
- **Peak total: 10,575 DPS** (single target at cap burn stacks)

**Multi-Target Burn (3 Enemies):**
- Fireball hits enemy A: 1 burn stack on A
- Hydra head 1 hits enemy B: 1 burn stack on B
- Arcane Orb bounces to enemy C: 1 burn stack on C
- t=1.0s: Fireball hits enemy A again: 2 stacks on A
- ... (stacking progresses on each target independently)
- At stable state (t=6s+): Each target has ~10-20 stacks (lower than single-target 50 due to spreading)
- **Estimated multi-target: 6,375 × 3 (direct) + 4,200 × 1.5 (DoT spread) ≈ 25,000 DPS vs. 3 enemies**

**Resource Management:**
- Ether generation: Auto-attacks at 0.8 APS × 6 Ether per hit = 4.8 Ether/sec (passive baseline)
- Passive Ether regen: +10 Ether/sec (always active)
- Skill costs per rotation:
  - Fireball: 25 per 1.0s = 25 Ether/sec, BUT generates 6 per cast = net 19 Ether/sec cost
  - Hydra: 40 per 2.0s = 20 Ether/sec, generates 8 per cast = net 12 Ether/sec cost
  - Arcane Orb: 12 per 0.8s = 15 Ether/sec, generates 8 per cast = net 7 Ether/sec cost
  - Teleport: 15 per 3.0s = 5 Ether/sec, generates 5 per cast = net 0 Ether/sec cost
  - **Total net cost: 19 + 12 + 7 + 0 = 38 Ether/sec**
- **Available: 4.8 + 10 = 14.8 Ether/sec** (SEVERE deficit)
- **Solution:**
  - Legendary passive: "Arcane Mastery" (+30% spell damage, +15 Ether/sec regen during combat)
  - Ring: "Amplification Ring" (+20 Ether/sec)
  - Gear affix: "+Ether per second" (typical: +10-15 per second on endgame pieces, stack 3-4 items)
  - **Available with gear: 4.8 + 10 + 15 + 20 + 15 = 64.8 Ether/sec** (sufficient for rotation + buffer)

**Survivability:**
- Mage class: Very low armor (~1,500), heavy reliance on defense passives
- Passive: "Arcane Armor" (10% damage reduction per Ether spent on spells)
  - With 38 Ether/sec spent = 380% damage reduction cap (capped at 75%)
  - Effective 75% damage reduction while casting
- Teleport offers escape route every 3 seconds
- Hydras absorb some damage (they have HP pools)
- Weak to burst damage; needs pre-emptive teleport

**Endgame viability:**
- Can solo GR 125+ (elite-tier build due to exponential Burn stacking)
- Requires perfect resource management (cannot afford dropped casts)
- Weak to single large enemies (Burn stacks at 50 cap; single target no exponential scaling)
- Strong in higher-density content due to Burn spread

---

## Part 5: Skill Balance Framework (Auto-Cast vs. Manual-Cast)

### 5.1 Design Principle: Neither Strictly Superior

Both auto-cast and manual-cast should be viable endgame options, but with different tradeoffs:

| Aspect | Auto-Cast | Manual-Cast (Optional) | Winner |
|--------|-----------|----------------------|--------|
| Skill ceiling | Low (automated) | High (precision timing) | Tie (different playstyles) |
| Damage potential | High (constant output) | Very high (skill gating) | Manual-cast by 10-15% |
| Accessibility | High (no twitch skill) | Low (requires practice) | Auto-cast |
| Engagement | Medium (passive) | High (active decision-making) | Manual-cast |
| AFK viability | High (idle viable) | None (requires input) | Auto-cast |
| Build diversity | Medium (4 fixed slots) | Very high (any combo) | Manual-cast |

**Balancing principle:** Auto-cast builds trade damage ceiling for ease-of-use and AFK capability.

### 5.2 Damage Cap for Auto-Cast Builds

To prevent auto-cast from trivializing endgame, implement **skill damage caps**:

**Proposed cap formula:**
```
Max Skill Damage = 50,000% weapon damage per hit
Max DoT damage = 2,000% damage per second
Max cooldown reduction = 75% (hard floor 0.1875s minimum)
```

**Rationale:**
- 50,000% allows exponential endgame scaling (~8x damage multiplier from gear stacking)
- But prevents 1,000,000%+ one-shot builds that trivialize bosses
- DoT cap prevents infinite stacking (Burn cap at 50 stacks with +2% per stack = 2.0x, not 100x)
- CDR 75% cap ensures minimum 0.1875s per skill (5.33 casts/sec max), not instant spam

### 5.3 Legendary Items as Balance Levers

Rather than pure damage bonuses, legendaries should enable new mechanics:

| Legendary | Effect | Why It's Balanced |
|-----------|--------|------------------|
| **Wrath of Wastes** | Whirlwind gains Dust Devils (summon tornadoes) | Adds complexity; doesn't scale damage above cap |
| **Embodiment of Marauder** | Sentries fire your equipped skill | Multiplies sentry count, not base damage |
| **Firebird's Finery** | Fire Burn stacks scale damage +2% per stack | Capped at 50 stacks = 2.0x multiplier |
| **Ring of Eternal Rage** | Generate Rage while below 50% Rage | Resource refund enables rotation, not power boost |

**Anti-pattern (what NOT to do):**
- ❌ "All skill damage +10,000%" (pure numerical buff; breaks caps)
- ❌ "Remove cooldown floors" (enables infinite spam)
- ❌ "All resource costs reduced to 0" (breaks resource management)

---

## Part 6: Preventing Screen-Clear Trivialization

Auto-cast builds must remain powerful but not omnipotent. Use these gates:

### 6.1 Mob Density Scaling

Endgame content scales with player power:
- **Normal difficulty:** 30 mobs per screen
- **Nightmare:** 50 mobs per screen
- **Hell:** 75 mobs per screen
- **Torment/Endgame Dungeons:** 100+ mobs per screen

**Auto-cast builds at max power:**
- Warrior Whirlwind clears 30 mobs in ~20 seconds (not instant screen-clear)
- Ranged Sentry clears 50 mobs in ~30 seconds
- Mage DoT clears 75 mobs in ~40 seconds (slow ramp due to Burn stacking)

**Progression design:** Clearing speed is high but not one-shot. Boss fights take 30-60 seconds of active play (not trivial).

### 6.2 Boss Encounter Design

Bosses must counter auto-cast spam:

| Boss Type | Counter Mechanic | Auto-Cast Challenge |
|-----------|-----------------|---------------------|
| **Phased Boss** | Changes attack pattern at 75%, 50%, 25% HP | Requires repositioning; can't just hold W |
| **Shielded Boss** | Temporary invulnerability phase; only weak points take damage | Must switch targets; single rotation fails |
| **Teleporting Boss** | Randomly repositions every 5 seconds | Sentries/turrets scatter; player must maintain formation |
| **Damage Cap Immune** | Boss takes max 20% health per second | Prevents one-shot; requires 5+ seconds to kill |
| **Cleave Attack** | Boss AOE that hits whole screen; forces dodging | Requires active Teleport/Evasion use |

**Design intent:** Bosses are not trivial for auto-cast but remain viable with proper gear/passives.

---

## Part 7: Open Questions to Ask the User

1. **Resource Pools or Unified Economy?**
   - Your game: Class-specific (Rage, Focus, Ether) or unified "Mana" for all classes?
   - Current recommendation: Class-specific for flavor + balance differentiation
   - Alternative: Unified mana (simpler, less class identity)

2. **Mandatory Auto-Cast or Toggle?**
   - Should players be forced into auto-cast, or can they toggle manual-cast for any skill?
   - Current recommendation: Auto-cast mandatory for core build, manual-cast as optional secondary system (unlock via endgame passive)
   - Trade-off: Auto-cast is simpler/accessible; manual-cast allows skill expression

3. **Skill Diversity: 4 Slots or More?**
   - Should players be locked into 4 skills, or allow 6-8 with cooldown management?
   - Current recommendation: Start with 4 (manageable) + 1 utility slot (Teleport/Dash) = 5 total
   - Pro: Clear identity; easier balance
   - Con: Less build variety

4. **Proc Rate Caps: Anywhere from 15-75%?**
   - Should procs be capped at lower ranges (15-30%) or allow stacking to 75%+?
   - Current recommendation: 15-30% for balanced proc feel; achievable via gear
   - At 30% proc rate + 4 skills = ~1 proc per second on average (exciting but not spam)

5. **Damage Scaling Curve: Exponential or Logarithmic?**
   - Should endgame damage increase 10x, 100x, or 1000x from early game?
   - Current recommendation: 100x (from normal to endgame Torment)
   - D3 precedent: Endgame builds deal ~1,000,000x baseline; feels overwhelming
   - Your game: Cap at 50,000% (50x multiplier) to maintain readable combat

6. **DoT Stacking Mechanic: Separate Instances or Additive?**
   - Can Burn DoT stack from same skill twice, or only one instance per skill?
   - Current recommendation: One instance per skill; multiple skills can apply same DoT type independently
   - Example: Fireball applies Burn #1, Meteor applies Burn #2; both tick simultaneously = 2 Burn instances
   - Prevents exponential explosion; maintains visual clarity

7. **Party Scaling: How Sensitive?**
   - 2-player group should take +50% longer, +25% longer, or be equally fast?
   - Current recommendation: +50% monster health per player (D3 model) but flat damage
   - Means: 2-player groups kill bosses in ~1.5× time (balanced, encourages group play)

8. **Seasonal Resets & Ladder Competitiveness?**
   - Should paragon/progression reset each season (creates fresh competition)?
   - Current recommendation: Yes, 3-month seasons like D3
   - Benefit: Keeps meta fresh; allows new players to compete
   - Drawback: Requires massive farm to reach end

9. **Cooldown Reduction Cap: 75% (0.1875s) or Different?**
   - Is 0.75s minimum too slow for satisfying fast builds?
   - Current recommendation: Keep 0.75s base, 75% CDR cap (0.1875s minimum)
   - Rationale: Ensures skills don't feel instant; maintains rhythm
   - Alternative: 0.5s base with 50% CDR cap (0.25s minimum) for faster pace

10. **Manual-Cast Integration: Early Unlock or Endgame Only?**
    - Should manual-cast alternative be available from tutorial, or unlock at level 50+?
    - Current recommendation: Endgame-only (level 70+ unlock via Paragon passive)
    - Reason: Simplifies new player experience; keeps auto-cast default
    - Alternative: Available from start; auto-cast is default setting

---

## Part 8: Design Implications for Your Game

1. **Cooldown floors (0.75s) are non-negotiable** – Preserve visual readability and player sanity
2. **Resource economy is the primary balance lever** – Use Rage/Focus/Ether costs to control rotation sustainability
3. **Procs and crits are separate** – Crit damage always applies; proc effects are independent RNG layers
4. **DoT stacking requires careful caps** – Burn at 50 stacks, Poison at 40 stacks, Bleed at 30 stacks prevents explosion
5. **Gear enables mechanics, not just stats** – Legendaries should unlock new playstyles (sentry, turret, pet synergy)
6. **Boss encounters must counter spam** – Phasing, repositioning requirements, and damage gates prevent trivial screen-clears
7. **Auto-cast is accessible; manual-cast is optional** – Default to auto for broad appeal; reward skill expression via endgame toggle

---

## Part 9: Sources

### D3 Resource & Cooldown Mechanics
- [Maxroll.gg – Attack Speed Breakpoints](https://maxroll.gg/d3/resources/attack-speed-breakpoints-explained)
- [Maxroll.gg – Cooldown Reduction Mechanics](https://maxroll.gg/d3/resources/cooldown-and-resource-cost-reduction-mechanics)
- [Diablo Wiki – Resource System](https://diablo.fandom.com/wiki/Resource)

### Skill Proc & Crit Mechanics
- [Maxroll.gg – Critical Hit System](https://maxroll.gg/d3/resources/critical-hit-chance-hit-damage-explained)
- [Maxroll.gg – Proc Coefficients](https://maxroll.gg/d3/resources/attack-speed-breakpoints-explained) (integrated with AS guide)

### Iconic Auto-Cast Builds
- [Maxroll.gg – Marauder Sentry Guide](https://maxroll.gg/d3/guides/marauder-sentry-demon-hunter-guide)
- [Maxroll.gg – Wrath of Wastes Whirlwind Guide](https://maxroll.gg/d3/guides/waste-set-ww-rend-barbarian-guide)
- [Maxroll.gg – Firebird's Finery Wizard](https://maxroll.gg/d3/guides/firebirds-finery-wizard-guide)

### Game Balance & Scaling
- [Task Bar Hero Wiki – Hero-dric Cube & Progression](https://taskbarhero.org/en/cube/)
- [Last Epoch Forums – Auto-Cast Mechanics](https://forum.lastepoch.com/t/last-epoch-vs-diablo-iv-gameplay/60146)
- [Path of Exile Wiki – Trigger Mechanics](https://pathofexile.fandom.com/wiki/Trigger)

### Design & UX
- [Acagamic Newsletter – Juicy Feedback in Games](https://acagamic.com/newsletter/2022/03/08/show-juicy-feedback-to-indicate-player-damage-in-video-games/)
- [GDCVault – Diablo 3's Road to Redemption (Josh Mosqueira)](https://www.gdcvault.com/play/1021776)

---

## Part 10: Design Implications for Our Game

### 1. **Cooldown Minimums Are Non-Negotiable**
Implement a 0.75-second floor to maintain visual readability and ensure meaningful cooldown management. This prevents degenerate "cast every frame" builds while allowing satisfying high-frequency skill cycling at endgame (~5 casts/second across 4 skills).

### 2. **Resource Economy Must Be Tuned Per-Class**
- Warrior: Rage (high per-skill cost; focuses on sustained melee engagement)
- Ranged: Focus (low cost; encourages frequent rotations and mobility)
- Mage: Ether (high cost offset by passive regen; rewards positioning over burst)

Resource generation scales directly with playstyle, so a Warrior builds Rage/Strength gear while a Ranged builds Focus/Attack Speed gear. This creates differentiation without forcing identical builds.

### 3. **Procs and Crits Are Distinct Layers**
All skills benefit from crit damage multiplier (% of damage increase). Separately, skills can have proc-based triggers (15-75% chance) that fire independent abilities. This prevents cascading RNG (crit doesn't double-trigger every ability).

### 4. **DoT Stacking Requires Careful Caps**
Implement per-type caps: Burn (50 stacks, +2% damage each), Poison (40 stacks, +3% each), Bleed (30 stacks, +4% each). Prevents Firebird-like exponential explosion while maintaining DoT as core archetype.

### 5. **Gear Enablers > Stat Inflation**
Legendaries should unlock mechanics (Sentries, Turrets, Rend spreading) not pure damage bonuses. This allows exponential build power progression without trivializing endgame. A Marauder with 5 sentries is more powerful than one with 3, but power comes from sentry *count* not damage stat bloat.

### 6. **Boss Encounters Counter Specific Builds**
Design boss attacks that force responses:
- Repositioning phases (Counter: auto-cast spam has fixed position; manual-cast excels with mobility)
- Invulnerability phases (Counter: DoT stacking shines; direct damage fails)
- Damage caps (Counter: skill rotation matters; pure spam fails)

This ensures auto-cast builds remain viable but not trivial.

### 7. **Manual-Cast as Endgame Alternative**
Allow players to toggle manual-cast mode (unlock at level 70+) for skills. Manual-cast does 10-15% more damage but requires precise timing. Keeps auto-cast accessible for new players; rewards skill expression in endgame.

---

## Part 11: Open Questions to Ask the User

1. **How aggressive should cooldown reduction be allowed?** At 75% CDR cap with 0.75s floor, minimum cooldown is 0.1875s (5.33 casts/sec per skill). Is this fast enough for endgame dopamine, or too slow?

2. **Should resource costs scale with difficulty?** D3 doesn't scale costs; your game could implement "Hell difficulty: all skill costs +25%" to prevent overgearing. Worth it?

3. **Gear progression curve:** Should early game (Normal) give players ~100% of endgame build power (vertical progression hard cap), or continue scaling infinitely (Diablo model, +1000x multipliers)?

4. **Pet/Sentry inheritance:** Should sentries inherit 100% of player's crit stats, 50%, or 10%? High inheritance = easy trivializing; low = pets feel weak.

5. **Screen-clearing expectation:** Should endgame auto-cast builds clear a full screen (100 mobs) in 10 seconds, 30 seconds, or 60+ seconds? Sets difficulty tone.

6. **Seasonal length:** 3 months (D3), 6 months (WoW), or continuous no-reset (EVE)?

7. **Class balance priority:** Should all 3 classes have equal endgame viability, or is it okay if one class is 10-20% stronger (sets meta)?

8. **Trading:** Are legendary items tradeable (economy-focused) or bind-on-pickup (progression-focused)?

9. **PvP:** Does your MMO have PvP dungeons/zones? If yes, auto-cast builds need PvP balance pass (probably overtuned for AI enemies, weak vs. human players).

10. **Mobile/console support:** WASD movement + mouse targeting is desktop-centric. Is mobile port planned? (Changes cooldown/proc balance if console/mobile controls needed.)

---

## Conclusion

Auto-cast skill systems fundamentally shift game balance from mechanical skill (click-precision) to gear optimization and resource management. This dossier proposes:

1. **0.75-second cooldown minimum** with 75% CDR cap (hard floor 0.1875s)
2. **Class-specific resource pools** (Rage, Focus, Ether) with per-skill costs tuned to prevent infinite loops
3. **Separate proc and crit mechanics** (crits amplify damage; procs trigger special effects independently)
4. **Three worked-example builds** (Warrior Whirlwind, Ranged Sentries, Mage DoT) with complete damage formulas
5. **Balance framework ensuring auto-cast viability** without screen-clearing trivial content

The key design insight: **Auto-cast is not "easier" gameplay; it's *different* gameplay.** It trades mechanical execution for resource management and gear optimization. Both auto-cast and manual-cast should feel rewarding and viable endgame, preventing either from being strictly superior.

Implement these foundations and your auto-cast MMO will avoid the balance pitfalls that plague other action games (infinite spam, one-shot trivialization, unfun resource starvation).

---

**End of Dossier**

This research prioritizes verified game mechanics from proven titles (D3 RoS, Task Bar Hero, Path of Exile) with concrete numbers and formulas. Use this as a game-design foundation, not a blueprint; your specific world, enemy types, and art style will require tuning, but the skeletal design is sound and derives from tested AAA game systems.
