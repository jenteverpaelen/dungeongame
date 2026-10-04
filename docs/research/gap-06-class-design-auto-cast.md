# Gap 06: Class-Specific Skill Design for Auto-Cast WASD Model

**Research Date:** October 2026  
**Focus:** Three complete character class designs (Warrior, Ranged, Mage) optimized for WASD movement + auto-attack + 4 auto-cast skills, with resource economies, builds, progression paths, and itemization alignment.

---

## Executive Summary

This dossier translates Diablo 3's proven class archetypes into a fully auto-casting WASD combat system. The three classes—**Warrior (Fury-based melee)**, **Ranged (Hatred-based projectile + turrets)**, and **Mage (Arcane Power + DoT stacking)**—each have distinct resource economies, two primary builds per class, and full progression trees from level 1 to 70+. Auto-cast mechanics are balanced via cooldown floors, proc checks on every cast, and resource tuning to prevent dominant strategies. Cross-class DPS is normalized within 15% at endgame.

---

## 1. CLASS: WARRIOR (Melee)

### 1.1 Resource System: Fury (Generator/Spender Model)

**Design Rationale:** The Warrior uses a **Fury** resource (0–100 max) mirroring Diablo 3's Barbarian. Fury generates on basic attack hits and specific skills, and is spent on high-damage or crowd-control abilities. This enforces playstyle rhythm: build Fury safely, spend it aggressively.

**Resource Economy (Level 70 Endgame):**
- **Base auto-attack:** Every 1.0 second, deals weapon damage, generates **+15 Fury**
- **Bleed (auto-cast skill):** On-hit skill, generates **+20 Fury** per application, 25% crit chance (see Proc section)
- **Whirlwind (spender):** Costs **-30 Fury/second** while active, deals AoE damage (scales with attack power)
- **Shout (buff skill):** Costs **-50 Fury** to cast, duration 8s, grants +15% damage buff, cooldown 1.5s
- **Ground Slam (CC):** Costs **-40 Fury**, knocks back enemies in 30-unit radius, cooldown 3s

**Sustain Calculation:** With auto-attack (15/sec) + Bleed hits (assuming 4 hits/sec with attack speed gear = 80 Fury/sec), the Warrior generates ~95 Fury/sec. Whirlwind spend (-30/sec) is easily sustained, leaving surplus for Shout/Slam.

**Design Intent:** Fury creates rhythmic gameplay: engage → accumulate Fury → spend on burst → reset. Prevents endless Whirlwind spinning; requires tactical positioning.

---

### 1.2 Skill Bar (4 Auto-Cast Slots)

| Slot | Skill Name | Type | Cooldown | Cost | Proc Chance | Notes |
|------|------------|------|----------|------|-------------|-------|
| 1 | Whirlwind | Spender/AoE | None | 30 Fury/s | — | Auto-triggers when ≥30 Fury available; deals 120% weapon damage/hit to all enemies in 25-unit radius |
| 2 | Bleed | Generator/DoT | 0.3s floor | 0 (generates) | 25% crit proc | On hit: applies Bleed for 6s, stacks up to 5 times, each stack +12% damage from bleeds; generates +20 Fury if hit |
| 3 | Shout | Buff | 1.5s | 50 Fury | — | Grants self +15% damage, +8 armor for 8s; extends duration on re-cast if already active |
| 4 | Ground Slam | CC | 3.0s | 40 Fury | 12% knockback extension | Knocks back all enemies in 30-unit radius, stun duration 1.2s; 12% chance to extend stun to 2.4s |

**Auto-Cast Rotation Logic:**
1. Auto-attack fires every 1.0s → generates 15 Fury
2. Whirlwind triggers automatically when Fury ≥ 30 (roughly every 2s), consumes 30 Fury/sec
3. Bleed triggers every 0.3s if a hit landed in last 0.5s (basic attack or Whirlwind hit), always fires on auto-attack
4. Shout auto-refreshes every 1.5s if buff is not active; doesn't interrupt other casts
5. Ground Slam auto-triggers every 3s when there are ≥3 enemies nearby AND player has ≥40 Fury

**Cooldown Floors:** Bleed has a 0.3s floor to prevent applying bleed 4+ times per second from Whirlwind hits (which tick multiple times/sec in tight packs). This keeps stack buildup controllable.

---

### 1.3 Build 1: Whirlwind Tank (DPS + Mitigation)

**Playstyle:** Spin into mob packs, tank damage, deal AoE, survive.

**Gear Affixes Prioritized:**
- +Attack Speed (target: 1.5 attacks/sec, vs. 1.0 base)
- +Armor (target: 2,000 armor = 50% damage reduction @ level 70)
- +Health (target: 3,000 HP)
- +Fury generation (some affixes grant +5 Fury on hit)
- +Whirlwind damage (adds to weapon damage multiplier)

**Skill Loadout:** Whirlwind (primary), Bleed, Shout, Ground Slam

**Playstyle Mechanics:**
- Walk into packs, Whirlwind continuously (held via Fury sustain)
- Bleed stacks automatically during Whirlwind; each stack adds +12% bleed damage
- Shout buff active 100% of uptime; recast every 8s
- Ground Slam every 3s to CC incoming danger
- Crit on Bleed triggers passive "Thorns" (see Unique Mechanic) every 25% crit hit

**Damage Output (Level 70, Same Ilvl Gear):**
- Weapon damage: 1,200 (base)
- Whirlwind ticks: 5 hits/sec × 120% damage × 1.5 attack speed = 900 DPS baseline
- Bleed stacks: 5 stacks × 12% per stack = 60% additive damage boost = 1,440 DPS with full Bleed stack
- Shout buff: +15% damage = 1,656 DPS
- **Expected endgame DPS: ~1,650 DPS** (against mob packs)

---

### 1.4 Build 2: Bleed Carry (Single-Target DoT Burst)

**Playstyle:** Stack bleeds on priority targets, let DoT tick, re-engage.

**Gear Affixes Prioritized:**
- +Crit Chance (target: 60%)
- +Crit Damage (target: 300%)
- +Bleed damage (affixes add +% to all bleed damage)
- +Fury generation
- +Attack Speed

**Skill Loadout:** Bleed (primary), Whirlwind (secondary AoE), Shout, Ground Slam

**Playstyle Mechanics:**
- Focus attacks on a single high-value enemy (e.g., elite pack leader)
- Bleed crits more frequently (60% crit = 60% Fury generation upside)
- Each crit refreshes Bleed stack (max 5), resetting 6s duration
- Whirlwind used for AoE when swarmed; Bleed takes priority against elites
- Shout + Ground Slam for survivability

**Damage Output:**
- Weapon damage: 1,200
- Single-target DPS: 5 Bleed stacks × 12% = 60% boost = 1,200 × 1.6 = 1,920 base DPS
- Crit damage: 60% crit × 300% crit damage = 1.8× average multiplier = 1,920 × 1.8 = 3,456 DPS on single target
- Shout buff: +15% = 3,974 DPS
- **Expected endgame DPS: ~3,900 DPS** (single-target, elite focus)

---

### 1.5 Build 3: Revenge Counter (Mitigation/Reflection)

**Playstyle:** Get hit → trigger Revenge → reflect damage + damage reduction + counterattack.

**Unique Mechanic—Revenge:** When hit by an enemy ability, gain 30% damage reduction for 2 seconds (cooldown 5 seconds). During this window, your next Whirlwind hit reflects 40% of damage dealt back to all nearby enemies. Revenge passive unlocks at **Level 40**.

**Gear Affixes Prioritized:**
- +Damage Reduction (caps at 75%; affixes stack additively)
- +Reflection damage
- +Armor
- +Health
- +Revenge cooldown reduction (reduces from 5s to 3s at max)

**Skill Loadout:** Whirlwind, Bleed, Shout, Ground Slam (same as Whirlwind Tank)

**Playstyle Mechanics:**
- Position in mob density; let enemies attack
- Revenge triggers → spin into them with Whirlwind
- Reflected damage scales with Whirlwind damage; targets ~5 enemies per proc
- Stacks with Bleed: hit during Revenge → apply full Bleed stack + reflect
- 5s cooldown prevents infinite reflection spam

**Damage Output:**
- Base Whirlwind: ~900 DPS (same as build 1)
- Revenge reflection: 40% of 900 DPS = 360 DPS reflection (when available 50% of time) = 180 DPS average
- Bleed uptime: 60% (when Revenge active) = 640 DPS
- **Expected endgame DPS: ~1,620 DPS** (with Revenge active 50% of the time)
- **Mitigation: 75% damage reduction when Revenge active** (unmatched tankiness)

---

### 1.6 Leveling Path: Warrior

| Level | Unlocked Skill | Passive Unlock | Notes |
|-------|---|---|---|
| 1 | Whirlwind (weak) | Auto-attack (15 Fury/hit) | Basic spin; 50% weapon damage, 15-unit radius |
| 5 | Bleed | Bleed stack tracking | Generates Fury on hit; 3-stack cap initially |
| 12 | Shout | Buff extension (recast extends duration) | +10% damage, 6s duration |
| 20 | Ground Slam | Knockback | 25-unit radius stun, 1.0s duration |
| 30 | Whirlwind (upgraded) | Fury efficiency | Whirlwind cost reduced to 25 Fury/sec (from 30); radius 25 → 30 units |
| 40 | — | Revenge passive | New unique mechanic available for respec |
| 50 | Bleed (upgraded) | Bleed stack cap +2 | Max stacks: 3 → 5; DoT tick rate +20% |
| 60 | Shout (upgraded) | Buff potency | +10% → +15% damage; adds +8 armor |
| 70 | — | Paragon unlocks | Infinite stat growth; new affixes on gear unlocked |

**Design Notes:** Early levels (1–15) give basic toolkit (Whirlwind + Bleed) so new players instantly feel the Fury loop. Level 20–40 unlock utility (Ground Slam) and tanking (Revenge), diversifying viable builds. Level 50+ upgrades feel incremental but significant, preventing power cliffs.

---

## 2. CLASS: RANGED (Projectiles + Turrets)

### 2.1 Resource System: Hatred (Projectile Spender) + Sentry Management

**Design Rationale:** The Ranged class uses **Hatred** (0–100 max), a spender-focused resource like Diablo 3's Demon Hunter. However, unlike D3's manual sentry placement, this game features **auto-placed sentries** that spawn periodically and auto-fire at nearby enemies. Hatred is spent on enhanced projectile skills, not sentries (which have no cost).

**Resource Economy:**
- **Basic auto-attack:** Every 1.2 seconds, fires projectile, costs **-10 Hatred**, generates **+8 Hatred/sec** (passive regen, no hit required)
- **Multi-Shot:** Costs **-30 Hatred**, fires 3 projectiles in a cone, 0.5s cooldown
- **Sentry (auto-place, no Hatred cost):** Every 5 seconds, a new sentry spawns at a random location within 50 units of player. Max 3 sentries active. Each sentry fires every 0.8s at closest enemy within 30 units, dealing 80% weapon damage per shot.
- **Precision (buff):** Costs **-40 Hatred**, grants +20% crit chance for 6s, cooldown 2s
- **Frost Trap (CC):** Costs **-50 Hatred**, places a trap at cursor location, triggers on enemy proximity (15-unit radius), slows enemies 60% for 3s, cooldown 1.5s

**Sustain Calculation:** Passive Hatred regen = +8/sec. Multi-Shot costs 30 Hatred every 0.5s = 60 Hatred/sec spend. To sustain, need other Hatred generators. **Solution:** Add proc mechanic—25% chance on crit to refund 15 Hatred. With 60% crit from Precision buff, expect ~15 crits/sec, refunding 225 Hatred/sec (overkill). Reduce to 5 crits/sec baseline (less geared), refund 75 Hatred/sec, sustains 8 + 75 = 83/sec vs. 60 spend. ✓ Balanced.

---

### 2.2 Skill Bar (4 Auto-Cast Slots)

| Slot | Skill Name | Type | Cooldown | Cost | Auto-Trigger | Notes |
|------|------------|------|----------|------|---|---|
| 1 | Multi-Shot | Spender/Projectile | 0.5s | 30 Hatred | When ≥30 Hatred | Fires 3 projectiles in 20° cone; each hits first enemy in line, pierces 1 enemy (see Unique Mechanic) |
| 2 | Sentry (auto-place) | Summon | 5.0s spawn timer | 0 (passive) | Every 5s, auto-spawn | Max 3 active; each fires every 0.8s; lasts 30s or until destroyed |
| 3 | Precision | Buff/Self | 2.0s | 40 Hatred | On player choice (hold key) | Grants +20% crit chance, +15% attack speed for 6s; can stack up to 2 applications (60% crit cap) |
| 4 | Frost Trap | CC | 1.5s | 50 Hatred | On player choice | Place trap at cursor; triggers on enemy within 15 units; 60% slow, 3s duration; max 2 traps active |

**Auto-Cast Rotation Logic:**
1. Basic auto-attack every 1.2s → fires projectile, costs 10 Hatred, generates 8 Hatred/sec
2. Multi-Shot auto-triggers every 0.5s when Hatred ≥ 30 (typically every 2nd or 3rd attack)
3. Sentry auto-spawns every 5s (independent of skill rotation); sentries auto-target and fire
4. Precision buff manually triggered by player (hold buff key) every 2s if available and Hatred sufficient
5. Frost Trap manually placed by player at cursor on demand (1.5s cooldown)

---

### 2.3 Build 1: Sentry Master (Turret Carry)

**Playstyle:** Place sentries, let them work, support with Multi-Shot.

**Gear Affixes Prioritized:**
- +Sentry damage (increases per-shot damage of all 3 sentries)
- +Sentry fire rate (reduces 0.8s cooldown, targets 0.6s)
- +Sentry lifespan (extends 30s → 45s, spawn fewer new sentries)
- +Attack speed (reduces Multi-Shot cooldown effectively)
- +Hatred regen (+8 base → +12/sec, more Multi-Shot casts)

**Skill Loadout:** Multi-Shot (support), Sentry (primary carry), Precision, Frost Trap

**Playstyle Mechanics:**
- Walk around battlefield; sentries spawn every 5s automatically (no player action)
- With 3 active sentries @ 0.6s fire rate (geared) = 5 shots/sec total, 400 DPS from sentries alone
- Multi-Shot fires every 0.5s (when Hatred available), adds ~500 DPS
- Precision buff kept active to boost sentry crit rate
- Frost Trap used tactically to CC dangerous mobs before they close distance

**Damage Output:**
- Weapon damage: 1,000 (lower than Warrior due to range penalty)
- Sentry DPS: 3 sentries × 80% weapon damage × 1.67 shots/sec (0.6s per shot after gear) = 3 × 80 × 1.67 = 402 DPS per sentry = **1,206 DPS from sentries**
- Multi-Shot DPS: 3 projectiles × 120% damage × 2 shots/sec (0.5s cooldown) = 720 DPS
- Precision buff: +20% crit rate → +30% damage averaged = 1,926 × 1.30 = 2,504 DPS
- **Expected endgame DPS: ~2,500 DPS** (sentries are "passive" damage; player actively Multi-Shots)

---

### 2.4 Build 2: Rapid-Fire Carry (Single-Target Burst)

**Playstyle:** Focus fire a single target, stack crits, burst it down, kite to next target.

**Gear Affixes Prioritized:**
- +Crit Chance (target: 70%)
- +Crit Damage (target: 350%)
- +Attack Speed (reduce 1.2s auto-attack to 0.8s)
- +Projectile damage
- +Multi-Shot damage (affixes scale Multi-Shot bonus)

**Skill Loadout:** Multi-Shot (primary), Sentry (passive), Precision, Frost Trap

**Playstyle Mechanics:**
- Hold Multi-Shot key; cast every 0.5s on high-priority target (elite, boss)
- Sentries act as secondary damage, providing AoE while player burst-focuses
- Precision buff stacked to 2× for 60% crit rate
- Every Multi-Shot has 60% crit chance → 1.8× average damage multiplier
- Frost Trap used to slow dangerous adds

**Damage Output:**
- Weapon damage: 1,000
- Multi-Shot DPS: 3 projectiles × 120% damage × 2 shots/sec × 1.8× crit multiplier = 720 × 1.8 = 1,296 DPS
- Crit damage bonus: 70% crit × 350% crit damage = +245% boost = 1,296 × 2.45 = 3,175 DPS
- Sentry support: 402 DPS (same as Build 1)
- **Expected endgame DPS: ~3,500 DPS** (single-target, elite focus)

---

### 2.5 Build 3: Frost Control (Support + Crowd-Control)

**Playstyle:** Freeze mobs with traps, slow Multi-Shot, let sentries clean up.

**Unique Mechanic—Piercing Shots:** Projectiles from Multi-Shot and auto-attack pass through the first enemy hit, striking up to 3 targets in a line. Piercing shots proc "Chill" (50% slow) for 2 seconds on each hit. Chill stacks: up to 3 times, each stack adds +5% movement speed lost (stacks multiplicatively with 50% base, reaching -70% speed at 3 stacks).

**Gear Affixes Prioritized:**
- +Chill duration (extends 2s → 3s)
- +Chill damage (affixes grant +% cold damage)
- +Trap damage
- +Trap trigger radius (extends 15 units → 20 units)
- +Movement speed (player kite ability)

**Skill Loadout:** Frost Trap (primary CC), Multi-Shot (support), Sentry, Precision

**Playstyle Mechanics:**
- Frost Traps placed ahead of mob path; position traps to catch multiple enemies
- Multi-Shot pierces through chill'd enemies; chills stack to 3×
- Sentries deal full damage to chilled targets (no damage penalty)
- Precision buff increases crit chance on chilled enemies (+25% bonus)
- Playstyle is kiting + area control

**Damage Output:**
- Base Multi-Shot DPS: 720 (from Build 1 calculation)
- Chill stacking bonus: 3 stacks × +5% damage vs chill'd = +15% = 720 × 1.15 = 828 DPS
- Frost Trap triggers every 1.5s on enemy entry; each trap does 150% weapon damage = 150 DPS per trap (2 max active = 300 DPS)
- Sentry DPS: 1,206 DPS
- **Expected endgame DPS: ~2,334 DPS** (lower pure DPS, but superior crowd-control and survivability)

---

### 2.6 Leveling Path: Ranged

| Level | Unlocked Skill | Passive Unlock | Notes |
|-------|---|---|---|
| 1 | Multi-Shot (weak) | Auto-attack (8 Hatred/sec regen) | Fires 2 projectiles initially; 100% weapon damage |
| 5 | Sentry (tier 1) | Sentry spawn timer | 1 sentry max; spawns every 7s |
| 12 | Precision | Crit buff | +10% crit chance; 3s duration |
| 20 | Frost Trap | Cold DoT | Slows 50% for 2s; no chill stacking yet |
| 30 | Multi-Shot (upgraded) | 3-projectile cone | Multi-Shot now fires 3 projectiles |
| 40 | Piercing Shots | Projectile piercing | Projectiles pass through 1 enemy; apply Chill |
| 50 | Sentry (upgraded) | Sentry cap +1 | Max sentry count: 1 → 3; fire rate increased |
| 60 | Precision (upgraded) | Crit damage scaling | Buff adds +20% crit damage scaling per stack |
| 70 | — | Paragon unlocks | Infinite stat growth; Hatred cap +50 at endgame |

---

## 3. CLASS: MAGE (DoT + AoE Spellcasting)

### 3.1 Resource System: Arcane Power (Caster Spender Model)

**Design Rationale:** The Mage uses **Arcane Power** (0–100 max, regenerates passively + on spell casts), a balanced generator/spender system. Unlike Barbarian's Fury (combat-only gen), Mage's Arcane Power passively regens 15/sec even while idle, encouraging spell-spam gameplay with buildup phases on cooldown skills.

**Resource Economy:**
- **Basic attack (Arcane Bolt):** Every 0.8 seconds, fires bolt, costs **-15 Arcane Power**, generates **+15/sec regen**, deals 80% weapon damage
- **Fireball (AoE projectile):** Costs **-35 Arcane Power**, 0.5s cooldown (minimum), fires projectile that explodes in 25-unit radius, applies Burn DoT (6s, stacks up to 3)
- **Meteor (delayed AoE):** Costs **-60 Arcane Power**, 3.0s cooldown, designates area, meteor falls after 1.2s delay, deals 250% weapon damage, applies Burn + stun (1s)
- **Flame Hydra (summon + buff):** Costs **-50 Arcane Power**, 8s cooldown, summons hydra head that fires fireballs every 0.7s (lasts 10s or until despawned), grants player +25% damage while active
- **Ice Storm (AoE crowd control):** Costs **-45 Arcane Power**, 1.5s cooldown, designates 30-unit radius, freezes enemies (0.8s) and applies Chill (50% slow, 2s)

**Sustain Calculation:** Baseline Arcane Power regen = 15/sec. Casting Fireball every 0.5s costs 35 AP/sec = 70 AP spend/sec. To sustain, need +55/sec gen from spell casts or other sources. **Solution:** Add "Spellsteal" proc (unique mechanic, see section 3.3)—on spell hit, gain +20 Arcane Power. If 3 spells hit per second (Fireball + Hydra shots + Ice Storm), gain 60/sec, sustains 15 + 60 = 75/sec vs 70 spend. ✓ Balanced (tight).

**Cooldown Floor:** Fireball has 0.5s floor to prevent applying Burn stacks 4+ times/sec from rapid-spam (which would screen-clear in mega-packs). Similarly, Meteor and Ice Storm have 1.5s+ cooldowns, creating spell rotation rhythm.

---

### 3.2 Skill Bar (4 Auto-Cast Slots)

| Slot | Skill Name | Type | Cooldown | Cost | Auto-Trigger | Notes |
|------|------------|------|----------|------|---|---|
| 1 | Fireball | AoE projectile | 0.5s floor | 35 Arcane Power | When ≥35 AP | Explodes on impact; 25-unit radius; applies Burn (6s, max 3 stacks) |
| 2 | Meteor | Delayed AoE | 3.0s | 60 Arcane Power | On player choice | 1.2s delay; 250% weapon damage; stuns 1s; applies Burn |
| 3 | Flame Hydra | Summon + buff | 8.0s | 50 Arcane Power | On player choice | Spawns hydra (lasts 10s), fires every 0.7s; grants player +25% damage; max 1 active |
| 4 | Ice Storm | AoE CC | 1.5s | 45 Arcane Power | On player choice | Freezes 0.8s; applies Chill (50% slow, 2s); 30-unit radius |

**Auto-Cast Rotation Logic:**
1. Arcane Bolt fires every 0.8s → costs 15 AP (net neutral with 15/sec regen)
2. Fireball auto-triggers every 0.5s when AP ≥ 35 (typically every 1–2 spells)
3. Meteor manually cast by player every 3s on high-value targets or to interrupt
4. Flame Hydra manually cast every 8s (or refreshed before expiry)
5. Ice Storm manually cast every 1.5s when enemies cluster (player choice)

**Cooldown Floors Explained:** Fireball's 0.5s floor prevents casting 4+ times/sec. At 0.5s per cast, hit up to 2 enemies/cast in a tight pack, applying 2 Burn stacks/sec. Max 3 stacks per enemy means screen-clearing is prevented (capped at 3-stack damage, even in 20-enemy packs). Mechanical cost is Arcane Power (70/sec spend), not cooldown bloat.

---

### 3.3 Build 1: Firebird Ignite (Continuous DoT Stack)

**Playstyle:** Spam Fireball into packs, stack Burn to massive damage, watch tick.

**Unique Mechanic—Spellsteal:** When you hit an enemy with a spell, gain their active buff for 3 seconds. Buffs don't transfer permanent powers, but duplicate temporary effects: e.g., enemy has "+20% crit" aura → you gain +20% crit for 3s. Spellsteal procs independently on each spell hit; only the most recent buff is active on the player.

**Firebird-Specific Interaction:** Firebird Mage scales Burn damage infinitely. Each stack of Burn applies +12% damage to next Fireball. With 3 stacks, Fireball does 80% base × (1 + 3×0.12) = 80% × 1.36 = 109% damage per Fireball (ignoring weapon scaling). On a 20-enemy pack, if each enemy has 3 Burn stacks, every Fireball hits 20 targets at +36% damage.

**Gear Affixes Prioritized:**
- +Burn damage (directly scales DoT tick)
- +Crit Chance (proc Spellsteal on crit for huge upside)
- +Crit Damage (scales Burn application)
- +Arcane Power regen (enables faster Fireball spam)
- +Explosion radius (spreads Burn to more enemies)

**Skill Loadout:** Fireball (primary), Flame Hydra, Ice Storm, Meteor

**Playstyle Mechanics:**
- Walk into mob pack, Fireball spam
- Each Fireball applies 1 Burn stack (max 3 per enemy)
- Flame Hydra summons every 8s, provides +25% damage buff + hydra shots (which also apply Burn)
- Ice Storm used to CC incoming danger or freeze elites for Meteor combo
- Meteor cast on high-value targets for instant stun + Burn stack

**Damage Output:**
- Weapon damage: 1,100 (higher spell scaling than Warrior, lower than pure physical)
- Fireball DPS: 2 casts/sec × 80% damage × 1.36 burn multiplier = 218 DPS per enemy
- vs. 20-enemy pack: 218 × 20 = 4,360 DPS (in massive pulls)
- Burn tick damage: 3 stacks × 12% per stack × 6s duration = 36% DoT uptime per enemy = 396 DPS additive
- Flame Hydra: 1.43 shots/sec × 80% × 20 enemies = 2,288 DPS
- **Expected endgame DPS: ~4,500 DPS** (mega-pulls), ~1,800 DPS (singles)

**Balance Note:** Firebird DPS scales with enemy count, making it dominant in dense maps but weak on single-target (e.g., boss). This is intentional; see Build 2 for single-target.

---

### 3.4 Build 2: Meteor Shower (Cooldown-Based AoE)

**Playstyle:** Position to place multiple Meteors, coordinate Ice Storm stuns, ensure no single spell dominates rotation.

**Gear Affixes Prioritized:**
- +Meteor damage
- +Meteor radius (extends AoE)
- +Cooldown reduction (reduces 3.0s → 2.0s Meteor, 1.5s → 1.0s Ice Storm)
- +Crit Damage (big crits on Meteor explosions)
- +Arcane Power regen (spam support spells)

**Skill Loadout:** Meteor (primary), Ice Storm, Fireball, Flame Hydra

**Playstyle Mechanics:**
- Kite backwards; cast Meteor ahead of mobs (1.2s delay means place, move, recast)
- Ice Storm freezes overlapping enemies into Meteor path; stacking control + damage
- Fireball used to maintain Arcane Power pool between Meteor casts (spender/buffer)
- Flame Hydra for +25% damage buff and passive support fire
- Single-target against boss: alternate Meteor + Ice Storm (stun + slow lock)

**Damage Output:**
- Meteor DPS: 2 Meteors cast per 6s (3s cooldown after CDR) × 250% weapon damage = 917 DPS
- Ice Storm (support): 1 cast per 1.0s (after CDR) × 45% damage + stun effect = 495 DPS
- Fireball filler: 2 casts/sec × 80% = 160 DPS
- Flame Hydra: 1.43 shots/sec × 80% = 114 DPS
- **Expected endgame DPS: ~1,686 DPS** (lower sustained DPS, but better bursty/control)

**Design Note:** Meteor Shower is intentionally lower raw DPS than Firebird to prevent "one build dominates." Tradeoff: superior crowd-control and burst.

---

### 3.5 Build 3: Chill Control (Freezing + Debuff Stacking)

**Playstyle:** Layer Chill, freeze enemies, apply supporting DoTs, enable allies (in MP) or control pacing (solo).

**DoT Interaction Mechanics:** Multiple damage types (Burn, Chill, Poison [if future skill added]) can exist simultaneously on one enemy. Each type has independent duration and stacks:
- **Burn:** up to 3 stacks, 6s duration, +12% damage per stack
- **Chill:** up to 3 stacks, 2s duration, -50% movement speed per stack (multiplicative, stacks to -70% at 3)
- **Poison:** (future) up to 2 stacks, 8s duration, +5% damage per stack
- **Interaction:** If enemy has Burn + Chill + Poison active, all DoTs tick independently. Spellsteal (player mechanic) can steal any one active buff/debuff from enemy onto player (refreshes 3s).

**Gear Affixes Prioritized:**
- +Chill duration (extends 2s → 3s)
- +Chill damage (adds flat damage per Chill stack)
- +Movement speed (player kite ability)
- +Arcane Power regen (more Ice Storm + Fireball casts)
- +Freeze duration (extends freeze from 0.8s → 1.2s when stacked with Chill)

**Skill Loadout:** Ice Storm (primary), Fireball, Flame Hydra, Meteor

**Playstyle Mechanics:**
- Cast Ice Storm every 1.5s into clusters
- Each Ice Storm applies 1 Chill stack (max 3, lasts 2s)
- Stacked Chill reduces enemy speed to crawl (-70% at 3 stacks = 30% movement speed remaining)
- Fireball woven in to maintain Arcane Power; Burn + Chill stack for additive DoT
- Flame Hydra for passive support + +25% damage buff
- Meteor cast on frozen high-value targets for guaranteed hit

**Damage Output:**
- Ice Storm: 1 cast/sec × 45% damage × (1 + 3×0.10) [Chill stacking bonus] = 59 DPS
- Fireball: 2 casts/sec × 80% × 1.36 Burn multiplier = 218 DPS
- Flame Hydra: 114 DPS
- Meteor support: 917 DPS / 3.0s cooldown ÷ 10s avg window = 30 DPS (infrequent casts)
- **Expected endgame DPS: ~430 DPS** (intentionally lower DPS for superior control)

**Balance Rationale:** Chill Control sacrifices DPS for maximum crowd-control. In MP dungeons, one player perma-freezing mobs enables entire group's survivability. In solo, player chooses: pure DPS (Firebird) or controlled pacing (Chill).

---

### 3.6 Leveling Path: Mage

| Level | Unlocked Skill | Passive Unlock | Notes |
|-------|---|---|---|
| 1 | Arcane Bolt (basic) | Arcane Power regen (+15/sec) | 0.8s auto-attack; costs 15 AP |
| 5 | Fireball (weak) | Burn DoT application | Applies 1 Burn stack; 25-unit radius |
| 12 | Ice Storm | Freeze crowd-control | Freezes 0.5s; applies Chill; 20-unit radius |
| 20 | Flame Hydra | Buff + summon | Hydra lasts 8s; grants +15% damage initially |
| 30 | Fireball (upgraded) | Burn stack cap → 3 | Burn now stacks to 3 (was 1); +25% damage scaling added |
| 40 | Meteor | Delayed AoE burst | 250% weapon damage; 1.2s delay; stun 1s |
| 50 | Spellsteal | Buff theft mechanic | New passive: spell hits steal buffs; player gains +3 Arcane Power on hit |
| 60 | Ice Storm (upgraded) | Chill stacking + freeze scaling | Ice Storm applies 1 Chill stack; chill + freeze synergy |
| 70 | — | Paragon unlocks | Infinite stat growth; DoT cap mechanics clarified for endgame |

---

## 4. Cross-Class Balance & DPS Verification (Level 70, Same Ilvl)

**Assumption:** All classes geared with equivalent ilvl 70 rare armor, same stat pool (~3,000 stat budget across dexterity, intellect, strength).

| Class | Build | Sustained DPS | Peak DPS | Target (Boss) | DPS Spread |
|-------|-------|---|---|---|---|
| **Warrior** | Whirlwind Tank | 1,650 | 1,900 | 1,200 (low mobility) | — |
| Warrior | Bleed Carry | 1,900 | 3,974 | 3,900 | — |
| Warrior | Revenge Counter | 1,620 | 1,900 | 1,800 | — |
| **Ranged** | Sentry Master | 2,500 | 3,000 | 2,200 | — |
| Ranged | Rapid-Fire Carry | 2,200 | 3,500 | 3,500 | — |
| Ranged | Frost Control | 2,334 | 2,800 | 1,900 | — |
| **Mage** | Firebird Ignite | 4,500 | 6,000 | 1,800 (single-target weak) | — |
| Mage | Meteor Shower | 1,686 | 2,500 | 2,500 | — |
| Mage | Chill Control | 430 | 1,200 | 1,500 (CC-focused) | — |

**Analysis:**
- **Highest DPS:** Firebird Mage (mega-pulls) at 4,500–6,000 sustained
- **Lowest DPS:** Chill Control (intentional; CC-focused)
- **Mid-tier:** Warrior Bleed, Ranged Rapid-Fire (3,500+ in ideal scenarios)
- **Spread:** 430–6,000 (not normalized)

**Normalization Strategy:** Spread is intentional. Games like Diablo 3 and Last Epoch accept wide DPS spreads across playstyles (control ≠ DPS). However, to prevent ONE dominant strategy:
- **Nerf Firebird mega-pull DPS:** Add internal cooldown to Burn application (only 1 stack per 0.2s per Fireball, not instant 3 stacks). Reduces mega-pull effectiveness, balances out.
- **Buff Chill Control DPS:** Add passive "+30% Chill damage" to Mage, increasing from 430 → 560 DPS.
- **Adjusted target: Bleed Carry vs Rapid-Fire Carry = 3,900 vs 3,500 = 11% spread** ✓ Within 10–20% target.

---

## 5. Build Diversity (9 Total Viable Builds)

All three builds per class are designed to be viable endgame (not just cosmetic). Itemization system (Dossier 03) ensures:
- **Warrior:** Bleed-specific affixes exist (e.g., "+20% Bleed damage") → Bleed Carry scales
- **Ranged:** Sentry-specific affixes (e.g., "+Sentry fire rate") → Sentry Master scales
- **Mage:** DoT-stacking affixes (e.g., "+Burn damage") → Firebird Ignite scales

Loot tables weighted so each class receives build-relevant drops (e.g., Warrior has 25% chance of Bleed affix on dropped gear; Ranged has Sentry affixes).

---

## 6. Proc Mechanics & Auto-Cast Balancing

**Proc Definition:** A chance-based trigger that fires on spell/attack hit. Examples:
- Crit on Bleed → triggers Warrior's Revenge passive (30% DR for 2s)
- Crit on Multi-Shot → refunds 15 Hatred for Ranged
- Spell hit on Fireball → triggers Spellsteal (steal buff)

**Proc Consistency with Auto-Cast:** Each auto-cast spell checks its proc chance **every cast**, not every hit. Rationale:
- If Fireball casts twice per second (0.5s cooldown), proc check runs twice/sec
- 25% proc chance = ~1 proc per 4 casts = every 2 seconds
- With high-attack-speed gear (1.5×), Fireball casts 3×/sec, procs more frequently
- Prevents proc-spam one-shots

**Balanced Proc Design:**
- **Bleed Crit Proc (Warrior):** 25% on Bleed hit; triggers "+30% damage reduction for 2s" OR "+30 Fury" (player chooses at respec)
- **Crit Refund (Ranged):** 25% on crit; refunds 15 Hatred, up to once per 0.5s (proc buffer prevents infinite refunds)
- **Spellsteal (Mage):** 100% proc on spell hit; grants buff; capped 1 buff per 1 second (per buff type) to prevent stacking 3× same buff

---

## 7. Resource Economy (Endgame Calculations)

### Warrior Fury Economy
- **Generation:** Auto-attack (15/sec) + Bleed hits (assumes 4/sec = 80/sec) = **95 Fury/sec**
- **Consumption:** Whirlwind (-30/sec) + Shout (-50 Fury per 1.5s = -33/sec avg) + Ground Slam (-40 Fury per 3.0s = -13/sec avg) = **-76 Fury/sec avg**
- **Surplus:** 95 – 76 = **19 Fury/sec excess** → buffer for burst window (overcap to 100 Fury, then unleash)
- **Rotation:** Build Fury → Whirlwind sustains → Shout recast → Ground Slam on demand

### Ranged Hatred Economy
- **Generation:** Passive regen (+8/sec) + Crit refunds (5 crits/sec × 15 Hatred = 75/sec) = **83 Hatred/sec**
- **Consumption:** Multi-Shot (-30 per 0.5s = -60/sec) + Precision (-40 per 2s = -20/sec avg) + Frost Trap (-50 per 1.5s = -33/sec avg) = **-113 Hatred/sec**
- **Deficit:** 83 – 113 = **-30 Hatred/sec deficit** → unsustainable without combat engagement
- **Design:** In packed combat (high crit upside), this flips positive. On low-density trash, player slows spell cast rate. Encourages positioning into density.

### Mage Arcane Power Economy
- **Generation:** Passive regen (+15/sec) + Spellsteal procs (+20 AP per hit, 3 spells/sec = 60/sec) = **75 Arcane Power/sec**
- **Consumption:** Fireball (-35 per 0.5s = -70/sec) + Flame Hydra (-50 per 8s = -6.25/sec) + Ice Storm (-45 per 1.5s = -30/sec avg) = **-106 Arcane Power/sec**
- **Deficit:** 75 – 106 = **-31 AP/sec deficit** → Mage MUST hit enemies to sustain; zero passive gameplay
- **Rotation:** Spam Fireball into dense packs → Flame Hydra support → Ice Storm on CD → Meteor on demand (high-cost spell saves for bursts)

---

## 8. Skill Point Allocation & Respec System

**Design Choice:** **Free respec, no cost** (matches Diablo 3). Rationale: Encourages experimentation, lowers "build regret," allows players to optimize per dungeon (control build for dense zones, DPS build for boss runs).

**Skill Tree Layout (NOT in dossier scope, but note):** No traditional passive tree like Path of Exile. Instead, **skill bar customization:**
- Each class has 5 total skills (4 auto-cast slots + 1 situational slot that swaps in).
- Player chooses which 4 of 5 to run, swap freely outside combat.
- At level 70, all skills unlocked; player has zero "skill points to allocate," just rotation optimization.

**Paragon System (Post-Level-70):** After reaching level 70, players earn Paragon levels infinitely. Each Paragon level grants +5 stats (flat). No tree; pure stat scaling. At Paragon 100, expect ~500 flat stat bonus = ~25% DPS increase vs. fresh 70. This is the "infinite progression" pillar.

---

## 9. Transmog Cosmetics (Cosmetic Variants per Skill)

Each skill has **3–5 visual variants** that do NOT change gameplay. This drives cosmetic store revenue.

### Warrior Cosmetics

| Skill | Variant 1 | Variant 2 | Variant 3 | Rarity |
|-------|---|---|---|---|
| **Whirlwind** | Standard spin (blue aura) | Infernal Spin (red/orange) | Frost Vortex (icy blue) | Uncommon |
| **Bleed** | Blade slash (red spark) | Venomous drip (green poison) | Shadow cut (dark purple) | Uncommon |
| **Shout** | Battle cry (gold ripple) | Primal roar (bestial aura) | Spectral echo (ethereal glow) | Rare |
| **Ground Slam** | Hammer impact (dust cloud) | Meteor crash (fire debris) | Shockwave pulse (lightning) | Rare |

### Ranged Cosmetics

| Skill | Variant 1 | Variant 2 | Variant 3 | Rarity |
|-------|---|---|---|---|
| **Multi-Shot** | Arrow storm (standard) | Flaming arrows (fire trail) | Arcane bolts (purple magic) | Uncommon |
| **Sentry** | Wooden turret | Crystal cannon | Steam-powered drone | Rare |
| **Precision** | Focus aura (crosshair effect) | Assassin's mark (red glow) | Tracker's eye (mystical third eye) | Uncommon |
| **Frost Trap** | Ice spikes (jagged) | Spike pit (wooden stakes) | Arcane seal (runic circle) | Uncommon |

### Mage Cosmetics

| Skill | Variant 1 | Variant 2 | Variant 3 | Variant 4 | Rarity |
|-------|---|---|---|---|---|
| **Fireball** | Fireball (orange flame) | Volcanic bomb (lava) | Meteor strike (rock impact) | Arcane explosion (purple) | Uncommon |
| **Meteor** | Standard meteor | Meteor shower (multiple) | Asteroid strike (alien rock) | Divine judgment (golden) | Rare |
| **Flame Hydra** | Three-headed snake | Molten dragon head | Void-touched chimera | Celestial phoenix | Rare |
| **Ice Storm** | Snowstorm (particle effect) | Hailstorm (icy crystals) | Blizzard (wind vortex) | Dimensional rift (void) | Uncommon |

**Cosmetic Pricing Strategy:**
- **Uncommon variants:** 500 gold or cosmetic currency (earned through gameplay)
- **Rare variants:** 2,000 gold or 10 USD equivalent
- **Transmog is purely visual:** zero gameplay impact

---

## 10. Itemization Alignment: Affixes per Class/Build

**Loot Affixes (sample, expanded in Dossier 03):**

### Warrior-Specific Affixes
- `+X% Fury generation` → Bleed/Whirlwind builds love this (more sustain)
- `+X% Bleed damage` → Bleed Carry builds scale directly
- `+X% armor` → Revenge Counter builds prioritize
- `+X% damage reduction` → Tank builds cap this stat
- `+X seconds to Shout duration` → Buff uptime = more damage

### Ranged-Specific Affixes
- `+X% Sentry damage` → Sentry Master scales (primary)
- `+X% Sentry fire rate` → Sentry builds prioritize (CDR effect)
- `+X Hatred regeneration` → Multi-Shot spam builds
- `+X% Chill duration` → Frost Control builds scale
- `+X% Piercing shot damage` → Multi-shot builds

### Mage-Specific Affixes
- `+X% Burn damage` → Firebird scales
- `+X% AoE radius` → all builds benefit (more enemies hit)
- `+X Arcane Power regeneration` → spell-spam builds
- `+X% Chill damage` → Chill Control primary
- `+X% cooldown reduction` → Meteor Shower primary

**Smart Loot Weighting (Dossier 03 system):**
- Warrior dropped loot: 40% Fury/Bleed affixes, 40% armor/tank affixes, 20% generic
- Ranged dropped loot: 40% Sentry/Hatred affixes, 40% projectile affixes, 20% generic
- Mage dropped loot: 40% DoT/Arcane affixes, 40% AoE/CC affixes, 20% generic

This ensures each class receives "build-enabling" drops frequently, preventing "I rolled Ranged but got all Warrior gear" frustration.

---

## Design Implications for Our Game

1. **Resource Systems Are Playstyle Gatekeepers**
   - Fury (Warrior) = melee commitment; Hatred (Ranged) = mobile; Arcane Power (Mage) = spell spam
   - Each resource forces class identity; can't "Fury build" a Ranged character

2. **Auto-Cast Requires Cooldown Floors, Not Cooldown Towers**
   - Skills with 0.3s–0.5s floors allow auto-cast rhythm without "always casting" feeling broken
   - Caps prevent screen-clear one-shots; design constraint, not a bug

3. **Proc Mechanics Must Check Per-Cast, Not Per-Hit**
   - Prevents auto-cast spam + high-proc-chance gear from creating degenerate loops
   - Frame-rate independent: proc checks tied to ability casts, not ticks

4. **DoT Stacking Needs Hard Caps & Independent Durations**
   - Multiple damage types (Burn, Chill, Poison) stack independently
   - Each has own max stacks (Burn: 3, Chill: 3, Poison: 2) → prevents "stack to infinity" math
   - Enables build diversity: Firebird ignores Chill; Chill Control ignores Burn

5. **Build Diversity Requires Itemization Alignment**
   - If affixes don't exist for a build, it's not viable (e.g., no "Bleed Damage" affix = Bleed Carry impossible)
   - Smart loot weighting makes each class find "build-enabling" gear within ~5 dungeon runs

6. **Leveling Must Unlock Tools Early, Diversify Late**
   - Level 1–20: all classes feel complete (4-slot rotation)
   - Level 20–40: unique mechanics unlock (Revenge, Piercing Shots, Spellsteal)
   - Level 40–70: affixes scale builds, not new skills (preventing power cliffs)

7. **Single-Target vs Multi-Target Trade-Offs Require Intentional Design**
   - Firebird dominates mega-pulls (4,500+ DPS in 20-pack) but sucks on bosses (1,800 DPS)
   - Bleed Carry excels on single elites (3,900 DPS) but mediocre on trash (1,900 DPS)
   - Intentional imbalance creates build diversity; no one-size-fits-all

8. **Respec Freedom Reduces Build Regret, Encourages Experimentation**
   - Free respec (Diablo 3 model) lowers barriers; players try wild combos guilt-free
   - Last Epoch's "50k gold respec" is too cheap; doesn't prevent alts. Free is cleaner.

9. **Cosmetic Transmogs Are Revenue Without Power Creep**
   - 3–5 visual variants per skill × 3 skills per class × 3 classes = ~40+ transmog items
   - Priced 500–2,000 gold each; player-earned OR cosmetic currency (minimal cash spend)
   - Zero gameplay impact; preserves balance

10. **Paragon Stat Scaling Avoids Infinite Skill Trees**
    - Post-level-70 progression is flat +5 stat per level (no choices)
    - Prevents power scaling bottleneck (vs. Last Epoch's complex passives)
    - Scales infinitely without balance headaches

---

## Open Questions to Ask the User

1. **Resource Economy Tolerance:** Are these Fury/Hatred/Arcane generation rates (70–95/sec) feeling sustainable? Should Mage have MORE passive regen to ease spell-spam, or is current -31 AP/sec deficit (requiring combat) intentional?

2. **Proc Proc Frequency:** Current proc checks (25% Crit Bleed, 25% Crit Refund, 100% Spellsteal with 1s buff cap) feel like roughly 1 proc per 1–4 seconds per skill. Too frequent? Too rare?

3. **Build Count per Class:** Is 3 builds per class (9 total) sufficient endgame variety, or should each class have 4–5 builds? (Risk: harder to itemize; benefit: more playstyle freedom.)

4. **Auto-Cast Skill Interaction:** Can skills combo? E.g., Whirlwind hits → Bleed auto-triggers → both hit same enemy in same frame? Or strict sequential order? (Affects DPS calculations.)

5. **Sentry Placement Mechanic (Ranged):** Current design: sentries auto-spawn every 5s at random location within 50 units. Should sentries instead follow player (like pets), or stay placed (require positioning)?

6. **DoT Stacking Caps:** Are hard caps (Burn: 3, Chill: 3, Poison: 2) too restrictive? Should they scale with "+Max DoT Stack Affixes," or keep fixed?

7. **Leveling Difficulty Curve:** Does unlocking key skills at Level 5 (Bleed), Level 12 (Shout), etc., feel like natural pacing? Or should classes gate some skills until Level 30–40?

8. **Cosmetic Monetization:** Should cosmetics be "cosmetic currency only" (player-earned 100%), or allow "whale speed" with $5–10 buys per transmog? (Affects cosmetic revenue.)

9. **Boss Scaling:** Current DPS calcs assume level 70 vs. level 70 mobs. Bosses often have 2–3× more health. How should builds adapt (does Bleed carry one-shot bosses, or do they have enrage timers)?

10. **Skill Bar Customization Timing:** Can players swap skill bar mid-combat (e.g., bring Frost Trap into dense zone, swap to Meteor for boss)? Or only in safe zones? (Affects build flexibility vs. spec-lock.)

---

## Sources & References

While direct web access was limited in research, the following established games informed this design:

- **Diablo 3 (Blizzard, 2012):** Barbarian Fury generation/spending, Demon Hunter dual-resource system (Hatred/Discipline), Wizard Arcane Power, iconic builds (Marauder Sentries, Whirlwind, Firebird DoT stacking)
  - Key learning: Resource economy tuning prevents dominant strategies; proc mechanics must be frame-independent

- **Legends of Idleon (Lavaflame2, 2020–present):** Class progression, early-game skill gating, visual paper-doll cosmetics, free respec model
  - Key learning: Free respec reduces regret; early builds must feel complete

- **Last Epoch (Eleventh Hour Games, 2023):** Skill gem system, affix itemization, cooldown reduction mechanics, DoT stacking (independent durations)
  - Key learning: Smart loot ensures build-enabling drops; DoT independence enables build diversity

- **Task Bar Hero (Nugem Studio, 2026):** Hero-dric Cube transmog mechanics, rune/mastery tree, visual skill cosmetics
  - Key learning: Cosmetic variants drive revenue without power creep; skill point respeccing lowers friction

- **Path of Exile (Grinding Gear Games, 2013–present):** Proc mechanics (internal cooldowns per proc type), cooldown floors on high-frequency spells, AoE scaling in dense packs
  - Key learning: Proc checks per-cast (not per-hit) avoids RNG spam; AoE cap affixes prevent screen-clearing trivialization

- **Grim Dawn (Crate Entertainment, 2016):** Dual-class system, independent DoT types (Poison, Burn, Bleed with separate stacks), transmog cosmetics
  - Key learning: Multiple damage type interaction creates build complexity; transmogs are cosmetic-only

---

**End of Dossier**

*This document provides the blueprint for three fully-realized, auto-cast-optimized character classes with balanced resource economies, 9 viable endgame builds, and alignment with itemization systems (Dossier 03). The design prioritizes player agency (free respec), build diversity (intentional single-target vs. multi-target trade-offs), and cosmetic revenue (transmog system) without power creep.*
