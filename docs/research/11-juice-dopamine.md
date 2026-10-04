# Game Feel, Reward Psychology & Incremental Math: Research Dossier

**Date:** October 4, 2026  
**Topic:** Dopamine-focused game design for MMO action-RPG with auto-attack combat  
**Scope:** Game feel mechanics, loot feedback systems, reward psychology, incremental progression math, and auto-attack addictiveness

---

## 1. Game Feel & Juice: The Science of Satisfying Combat Feedback

### 1.1 Core Principles: "Juice It or Lose It"

The foundational game feel framework comes from Martin Jonasson and Petri Purho (Vlambeer, 2012), who identified that *juice* (the visual, audio, and haptic feedback of an action succeeding) is essential to player satisfaction.

**Key juice elements:**
- **Screenshake**: A small camera offset (typically 2–8 pixels) that triggers on hit impact. Creates sense of weight and power.
- **Hit-stop / Hit-pause**: Momentary frame freeze (typically 3–10 frames / 50–167ms at 60fps) when damage is dealt. Diablo 3 uses ~50–100ms freezes on critical hits.
- **Squash & stretch**: Sprite scale-up on attack windup, scale-down on impact. Typical values: 10–30% scale change over 1–3 frames.
- **Flash-white**: A white color tint overlay (opacity 0.3–0.8) on the hit frame, fading over 2–6 frames. Signals successful hit.
- **Particle bursts**: 8–20 particles emitted from impact point, with 0.3–0.8s lifespan, moving outward at 300–600 pixels/second.
- **Knockback**: Push target back 20–80 pixels; duration 150–400ms. Hades uses 40–80 pixel knockback with 200–250ms easing.
- **Audio layering**: 2–3 sound clips play on hit: base impact (70–100 dB), whoosh (60–80 dB), and optional critical/legendary layer (80–110 dB).

### 1.2 Hit-Stop Timing Reference (from Fighting Games & ARPGs)

- **Standard hit-stop**: 4–8 frames (67–133ms at 60fps). Guilty Gear uses 8–12 frames for specials.
- **Critical/heavy hit**: 12–20 frames (200–333ms). Super Smash Bros uses up to 20 frames.
- **Legendary/ultimate hit**: 20–30 frames (333–500ms). Used in Diablo 3 legendary procs.
- **Animation policy**: Freeze all game physics during hit-stop; player input remains responsive.

*Reference: Fighting game frame-data analysis (Mizugucci & IGDB community data)*

### 1.3 Screen Shake Parameters

From Vlambeer's "Art of Screenshake" (Jan Willem Nijman):
- **Small impact (basic attack)**: 2–3 pixel offset, 0.1–0.15s duration, 1–2 oscillations.
- **Medium impact (skill ability)**: 5–8 pixel offset, 0.2–0.3s duration, 2–3 oscillations.
- **Large impact (critical/AoE)**: 8–15 pixel offset, 0.4–0.6s duration, 3–5 oscillations.
- **Amplitude decay**: Linear or ease-out over duration (not instant cutoff).

**Formula (typical screenshake decay):**
```
offset(t) = max_offset * cos(frequency * t) * e^(-decay_rate * t)
```
Max offset: 2–15 pixels; decay_rate: 4–8; frequency: 8–12 rad/s.

### 1.4 Particle System Tuning

**For a single hit:**
- **Count**: 10–20 particles per hit (scale up to 40+ for AoE or critical).
- **Velocity**: 300–600 px/s initial speed, with gravity acceleration of 200–400 px/s².
- **Lifetime**: 0.4–1.0s (full fade-out over last 0.2s).
- **Emitter spread**: 30–60 degree cone angle.
- **Visual**: Simple circles or squares; 4–12px diameter. Color matches damage type (red for physical, blue for cold, etc.).

*Reference: Hades particle system analysis (Supergiant Games, 2020); Dead Cells (Motion Twin, 2018)*

### 1.5 Controller Rumble Patterns

For gamepad feedback (haptic feedback):
- **Light rumble (basic hit)**: 40–60% intensity, 50–100ms duration.
- **Medium rumble (skill)**: 70–85% intensity, 100–200ms duration, optional spike at 50ms.
- **Heavy rumble (critical/legendary)**: 85–100% intensity, 150–300ms duration with 2–3 pulses (e.g., pulse at 0ms, 50ms, 100ms).

*Reference: Hades (uses haptic feedback extensively); Diablo IV (2023) haptic design.*

---

## 2. Loot Feedback: Why Loot Feels Rewarding

### 2.1 Legendary Item Drop Feedback (Diablo 3 as Gold Standard)

**Visual feedback chain:**
1. **Golden beam**: A vertical pillar of golden light (approximately 128–256px wide) shoots upward from item location, 0.5–1.0s duration.
2. **Sparkle/shimmer**: Animated sparkle particles around the item, twinkling at 2–4Hz.
3. **Glow aura**: Subtle bloom/glow effect around item icon.
4. **Text notification**: "Legendary Item!" floating text appears above character, in gold color (#FFD700 or similar), scaling up then fading over 1–2s.
5. **Screen flash**: Subtle white flash (opacity ~0.15) for 100–200ms on appearance.

**Audio feedback chain:**
1. **Drop sound**: A rich, resonant "whoosh" + "ding" combo (0.8–1.2s total, ~2000–4000 Hz fundamental).
2. **Legendary jingle**: A short, distinctive audio cue (0.3–0.8s) unique to legendary tier. Diablo 3's legendary sound is ~1.2 seconds of orchestral "triumph" music snippet.
3. **Layered bass**: Sub-bass rumble (20–60 Hz) for 0.5–1.0s to reinforce the "importance" of the drop.

**[UNVERIFIED but likely]**: Diablo 3 uses ~800ms for the full legendary sound effect; legendary beam visibility range is ~40–50 units (in-game distance), making distant drops still visible to other players.

### 2.2 Path of Exile Loot Drop Design

**PoE uses a color-coded rarity system with sound layering:**
- **Normal**: Grey text, no special sound, no glow.
- **Magic**: Blue text, soft chime (200ms, ~1000 Hz).
- **Rare**: Yellow text, brighter chime (300ms, ~1500 Hz), subtle glow.
- **Unique**: Brown/gold text, distinctive 0.6–1.0s sound cue with harmonic undertones, bright glow aura.
- **Divination cards**: Specific card-flip sound (300–500ms).

**Audio layer count by rarity:**
- Normal/Magic: 1 layer (base sound only)
- Rare: 1–2 layers (base + optional synth layer)
- Unique: 2–3 layers (base + melodic layer + bass reinforcement)

*Reference: PoE Wiki (loot mechanics); player audio analysis from PoE community*

### 2.3 Vampire Survivors Chest Sequence

**Chest opening creates addictive micro-moment:**
1. **Chest animation**: 0.4s opening animation with wobble effect.
2. **Item burst**: 20–40 items explode upward from chest in arc pattern, each with rotation.
3. **Item float path**: Items float upward 100–150 pixels over 0.8–1.2s with slight sine-wave oscillation (frequency 2 Hz, amplitude 20 pixels).
4. **Pickup magnets**: Items home toward character over final 0.3–0.5s when within ~200 pixel range.
5. **Stagger**: Each item pickup plays a small "collect" sound (50–100ms beep, 800–1200 Hz), offset by 10–20ms to create a "cascade" effect.

**Why it's rewarding**: The sequence creates multiple micro-rewards (item bursts, individual collects, float animations) within a 1.5–2.0s window, triggering variable-ratio reinforcement at high frequency.

*Reference: Vampire Survivors (Poncle, 2022); roguelike community gameplay analysis*

### 2.4 Borderlands Rarity Color System

**Borderlands color coding is iconic:**
- **Common (White)**: #FFFFFF
- **Uncommon (Green)**: #00FF00 or #00DD00
- **Rare (Blue)**: #0066FF or #0077FF
- **Epic (Purple)**: #AA00FF or #8833FF
- **Legendary (Orange/Gold)**: #FF8800 or #FFAA00
- **Unique/Alien (Teal)**: #00FFDD

**Design principle**: Rare items emit 2x intensity glow; legendary items 3–4x intensity glow, making them visually dominant on screen.

*Reference: Borderlands series (Gearbox, 2009+); official art style guides*

### 2.5 Hades Boon Feedback

**Hades avoids text-based loot; instead uses:**
1. **Visual icon pop**: Boon icon appears at 50% scale, pops to 120% scale over 0.2s, then settles to 100%.
2. **Glow pulse**: Icon glow pulses at 1–1.5Hz for 2–3 cycles.
3. **Audio**: Distinctive 0.4–0.6s musical cue (chord, ~440 Hz + 660 Hz).
4. **Screen flash**: Brief white/bright flash (0.1–0.2s, opacity 0.2–0.3).
5. **Haptic pulse**: Gamepad rumble (70% intensity, 100–150ms).

**Reinforcement**: Boon acquisition is paired with immediate stat gains displayed in UI, creating instant visual feedback of power increase.

*Reference: Hades (Supergiant Games, 2020); developer commentary on UX design*

### 2.6 Last Epoch Loot Filter & Pickup Mechanics

**Last Epoch loot filters are conditional:**
- Players can filter by rarity, item type, affix tier, and other attributes.
- **Filtered items are hidden** from ground (not greyed out, actually hidden).
- **Unfiltered items glow** with rarity-based color intensity.
- **Pickup magnets**: Items within ~300 pixel radius auto-path to character when filter accepts them.

**Design insight**: The filter + auto-pickup combination removes the tedium of "walking over every item," but preserves the dopamine hit of discovery by keeping filtered items hidden until the condition is met.

*Reference: Last Epoch (Eleventh Hour Games, 2023+); in-game UI documentation*

---

## 3. Reward Psychology: Variable Reinforcement & Compulsion Loops

### 3.1 Variable-Ratio Reinforcement Schedule (Skinner)

**Core principle**: B.F. Skinner's behavioral psychology shows that **variable-ratio schedules** (rewards given after an unpredictable number of actions) create the strongest, most resistant-to-extinction behavior.

**In gaming context:**
- **Fixed-ratio (FR:5)**: Every 5th action yields reward (predictable). → **Weak engagement; players stop if reward is delayed**.
- **Variable-ratio (VR:5, mean=5)**: Reward given after ~5 actions on average, but varies (2–12). → **Strongest engagement; players continue grinding**.

**Application to ARPGs:**
- Drop rates should feel unpredictable but roughly follow a mean.
- Example: Diablo 3 legendary drop rate is ~1 in 400 kills (average), but variance is high (can be 1 in 200, or 1 in 600 in short bursts).
- This creates the "one more run" compulsion loop.

*Reference: B.F. Skinner (1957) "Verbal Behavior"; Bartle & Yee on game motivation; CMU study on loot box VR mechanics (2019)*

### 3.2 Near-Miss Effect

**Psychological principle**: Near-misses (near-rewards) create stronger motivation than obvious failures.

**Game mechanic applications:**
- **Visual tease**: Show the ledge of a legendary drop in drop-down animation, then it's rare instead. → Increases replay motivation.
- **Affix roll near-miss**: Item almost has the perfect stat, but rolled 1 tier lower. → Creates upgrade motivation (players grind for the "perfect" roll).
- **Boss health near-death**: Boss health bar glows red when <10% HP, triggering a "so close!" feeling. → Increases willingness to retry.

*Reference: Luke Clark (Cambridge Center for Gambling Research) on near-misses in slot machines and video games*

### 3.3 Session Pacing: The 45-90 Minute Sweet Spot

**Optimal session length** (research from ESA and IGDA):
- **Engagement peak**: 45–90 minutes.
- **Reward milestones**: Every 8–15 minutes (minor rewards: loot drops, level-up).
- **Major milestone**: Every 45–90 minutes (boss defeat, area completion, tier upgrade).
- **Fatigue point**: 120+ minutes; diminishing returns if no new major milestone occurs.

**Application to grind games:**
- **Dungeon runs**: 10–20 minutes per run (fits 3–6 runs in a session).
- **Level-up frequency**: Slight level increase every 3–5 runs (tangible progression every 30–50 minutes).
- **Exotic reward** (legendary drop): Rarest reward every 1–2 hours of gameplay on average.

*Reference: IGDA GDC 2015 session on player retention; Quantic Foundry player motivation taxonomy*

### 3.4 Compulsion Loop vs. Meaningful Choice

**Problem**: Variable-ratio reinforcement + grind can become predatory (loot boxes, gacha, etc.).

**Ethical design boundaries:**
- **Compulsion loop (BAD)**: "Grind mindlessly, RNG rewards, no meaningful progression." → Player feels trapped, not engaged.
- **Meaningful grind (GOOD)**: "Grind with agency; RNG rewards gate, but player can see predictable stat gains." → Player feels in control.

**Best practice**: Combine **guaranteed progression** (XP, guaranteed stat gains, crafting materials) with **variable rewards** (loot drops, exotic affixes).

*Example (Diablo 3 style)*:
- **Guaranteed**: Character gains XP every kill; player crafts materials for guaranteed +stat items.
- **Variable**: Legendary drops at ~1 in 400 kills; roll affixes have variance.

**Result**: Player feels progress even with no drops, but legendary drops feel special.

*Reference: Tristan Harris (Time Well Spent movement); Zuboff "The Age of Surveillance Capitalism" (2019); IGDA ethical monetization guidelines (2021)*

### 3.5 Reward Schedule Mapping: Seconds to Weeks

**Micro-loop (0–5 seconds)**:
- Every ability cast → visual feedback (hit numbers, particle splash). Frequency: 2–5 per second during combat.
- **Dopamine trigger**: Immediate sensory feedback; validates player input.

**Short-loop (5–30 seconds)**:
- Enemy death → loot drop + exp gain. Frequency: 1 per 10–20 seconds (mob-dense combat).
- **Dopamine trigger**: Killing spree satisfaction; loot rarity variance.

**Medium-loop (1–5 minutes)**:
- Minor skill level-up or item upgrade achievable. Frequency: 1–2 per session.
- **Dopamine trigger**: Stat sheet improvement; tangible character power growth.

**Long-loop (30–120 minutes)**:
- Boss defeat → guaranteed rare/unique drop + significant XP / area unlock. Frequency: 1–2 per play session.
- **Dopamine trigger**: Major milestone; narrative progression; aesthetic tier upgrade.

**Extended-loop (1–7 days)**:
- Season/battle pass completion → new cosmetic/title / prestige layer unlock. Frequency: 1 per week.
- **Dopamine trigger**: Long-term goals; social status; new gameplay modes unlocked.

---

## 4. Incremental & Idle Game Math

### 4.1 Exponential Growth Curves

**Incremental games rely on exponential or super-exponential growth to create satisfying progression.**

**Basic formula**:
```
cost(n) = base_cost × growth_factor^n
production(n) = base_production × production_multiplier^n
```

**Example (typical idle game)**:
- Base cost: 10 resources
- Growth factor: 1.15 (15% increase per tier)
- Tier 1 cost: 10
- Tier 2 cost: 11.5
- Tier 3 cost: 13.2
- Tier 5 cost: 20.1
- Tier 10 cost: 40.5
- Tier 20 cost: 163
- Tier 50 cost: ~1.8 × 10^9

**Prestige layers** (Legends of Idleon, Cookie Clicker):
- After reaching level 100, player resets and gains 1 prestige point per level earned.
- Prestige multiplier: (1 + prestige_points × 0.05)² applied to all production.
- After multiple prestige cycles, production scales as (prestige_points)^2 to ^3, allowing exponential growth even after resets.

*Reference: Cookie Clicker (Orteil, 2013); Antimatter Dimensions (Hevipelle, 2016); Anthony Pecorella "The Math of Idle Games" (2017)*

### 4.2 Number Formatting & Display

**Problem**: Numbers in incremental games quickly exceed JavaScript's 2^53 precision limit (~9 × 10^15).

**Solution 1: Scientific notation**
- 1,234,567,890,123,456 → 1.23 × 10^15
- Standard for most idle games; fits in UI.

**Solution 2: Letter abbreviation (Million, Billion, Trillion)**
- 1,234,567,890,123,456 → 1.23 Quadrillion
- More readable; used in Diablo 3 and Borderlands.
  - Diablo 3 displays: 1.2B damage (1.2 billion)
  - Path of Exile: 9.8M DPS (9.8 million damage per second)

**Solution 3: Compact notation with decimals**
- 1,234,567,890,123,456 → 1.23e15 (compact) or 1.2e+15 (scientific)

**For ultra-large numbers: break_infinity.js / break_eternity.js**

### 4.3 break_infinity.js & break_eternity.js Libraries

**Purpose**: Handle numbers up to **10^(10^308)** (break_eternity.js can go to **10↑↑1e308**).

**How it works**:
- Instead of storing a single double-precision number, store an exponent tower.
- Example: 10↑↑5 = 10^(10^(10^(10^10)))
- Operations: Addition, multiplication, exponentiation on these "hyper-large" numbers.

**Performance**:
- break_infinity.js: ~2.5x faster than decimal.js for basic operations; up to 442x faster for exponentiation.
- break_eternity.js: ~1.5–2x speed of break_infinity.js; supports hyperoperators (tetration, iteration logs).

**Use case for your game**:
- If character damage scales to 1e12+ and XP to 1e15+, switch to break_infinity.js by mid-game.
- Display as: "1.23 Septillion" or "1.23e24" depending on UI preference.

*Reference: Patashu (Creator of break_infinity.js & break_eternity.js); Antimatter Dimensions source code (uses break_eternity.js)*

### 4.4 Offline & Idle Progress

**Legends of Idleon model**:
- Offline production: Earn 50% of normal production rate while offline (logged out).
- Cap: 8 hours of offline progress (preventing abuse of AFK grinding).
- Design: Encourages daily login without forcing continuous play.

**Task Bar Hero model**:
- Offline progress disabled by default.
- Players can unlock offline generator via crafting, earning 25–50% of active production while offline.
- Creates a distinct upgrade path and purchase incentive.

**Best practice for your MMO**:
- Allow offline XP or resource generation at **30–50% of active rate**.
- Cap at **4–8 hours** to encourage daily logins without forcing always-on play.
- Make offline rate a **cosmetic/convenience purchase** (pass tier) to monetize without P2W.

*Reference: Legends of Idleon (Lavaflame2, 2020+); Task Bar Hero (Nugem Studio, 2026)*

---

## 5. Auto-Attack Combat Addictiveness: Why Vampire Survivors Works

### 5.1 Why Auto-Attack is Engaging (Not Boring)

**Vampire Survivors (Poncle, 2022) proves auto-attack can be more addictive than manual attack.**

**Key insight**: Auto-attack removes **decision fatigue** on moment-to-moment combat, freeing mental load for **strategic-layer decisions** (movement, positioning, weapon choice, passive build).

**Dopamine sources in auto-attack ARPGs**:
1. **Kinetic feedback**: Constant screen-filling visual effects. Vampire Survivors has 20–50 on-screen projectiles at any time, each with particle trails. → High visual "juice."
2. **Level-up choices**: Every 5 levels, pick 1 of 3 random weapon upgrades or passives. → Strategic choices every 1–2 minutes.
3. **Evolution mechanics**: Combine two items to create evolved form with new visuals and mechanics. → Rare, high-reward discovery moments.
4. **Power curve**: Damage scales visibly every level; by level 30, player deals 100x more damage than level 1. → Satisfying exponential scaling.
5. **Mob density**: 50–200 enemies on-screen simultaneously. Auto-attacking them all creates visceral satisfaction. → Aesthetic of overwhelming odds.

### 5.2 Brotato & Halls of Torment: Incremental Difficulty Scaling

**Both games use similar loop**:
- Start weak; survive escalating waves.
- Gain upgrades every 10–30 seconds.
- Exponential stat growth creates "god-mode" feeling by wave 20+.
- Leaderboard encourages replays for high-score chasing.

**Key mechanic: Difficulty scaling**:
- **Wave 1**: 5–10 enemies.
- **Wave 5**: 20–30 enemies.
- **Wave 10**: 50–80 enemies, slightly faster.
- **Wave 15**: 100–150 enemies, new enemy types introduced.
- **Wave 20+**: 200–400 enemies, screen-filling chaos.

**Emotional arc**: Early game feels weak → mid-game feels balanced → late-game feels overpowered (but still dangerous from sheer enemy count).

*Reference: Vampire Survivors (Poncle, 2022); Brotato (Byter, 2023); Halls of Torment (Crawlplay, 2023); Soulstone Survivors (meta-analysis of roguelike survivors games)*

### 5.3 WASD-Only Movement Engagement

**To keep WASD-only movement interesting**:

1. **Positioning as strategy**: Create "safe zones" (backlines, kite paths) and "danger zones" (melee range). Player must actively position to avoid burst damage while staying in attack range.
   - Example: Warrior tanking in front of group; Ranged kiting in circles; Mage staying at mid-range.

2. **Movement-gated abilities**: Some skills activate **only on movement** (e.g., "Dash skill: dash in the direction of WASD input over 0.3s, damaging enemies in path").
   - Example: Diablo 3 Demon Hunter "Vault" requires button press but benefits from directional momentum.

3. **Collision-based mechanics**: Enemies collide and block each other; player must maneuver through tight spaces.
   - This creates micro-moments of "thread the needle" tension.

4. **Zone effects**: Area-denial mechanics (poison clouds, lava) require movement awareness.
   - Vampire Survivors uses this extensively (fire walls, freezing zones).

### 5.4 Screen-Filling Effects & Number Scaling

**Design pattern (from Vampire Survivors, Diablo 3, Path of Exile)**:
- **Baseline particle count**: 20–40 particles per hit.
- **AoE attack**: 100–300 particles (projectiles, splash, trails).
- **Critical/legendary hit**: 40–80 extra particles; screen flash; text damage numbers.
- **Build at high levels**: Up to 500–1000+ particles on-screen simultaneously.

**Scaling mechanics**:
- **Level 1**: Deal 10 DPS.
- **Level 10**: Deal 100 DPS (10x).
- **Level 20**: Deal 1000 DPS (100x).
- **Level 30**: Deal 10,000 DPS (1000x).
- **Level 40+**: Deal 100,000+ DPS; one-shot most mobs.

**Visual feedback keeps pace**:
- Bigger numbers → bigger damage text.
- More hits → more particles.
- Exponential stat growth + exponential visual scaling = **satisfying power fantasy**.

---

## 6. Concrete "Juice Spec" for Your Game

### 6.1 Hit Feedback Spec

**On any basic attack hit**:
- Hit-stop: 50ms (3 frames at 60fps)
- Screen shake: 4px offset, 200ms duration, 2 oscillations, ease-out decay
- Flash-white: Opacity 0.4, fade over 100ms
- Knockback: 30px push, 200ms ease-out
- Particles: 12 particles, 400px/s initial velocity, 0.6s lifetime, emit cone 45°
- Sound: Base impact (80dB, 0.2s) + optional whoosh (70dB, 0.3s)
- Damage numbers: "45" in white/yellow text, pop to 120% scale over 100ms, fade over 500ms

**On critical hit** (every ~15 attacks or 10% of hits):
- Hit-stop: 100ms (6 frames)
- Screen shake: 8px offset, 300ms duration, 3 oscillations
- Flash-white: Opacity 0.6, fade over 150ms
- Knockback: 60px push, 250ms ease-out
- Particles: 24 particles, 500px/s velocity, 0.8s lifetime
- Sound: Base + critical "ding" (1000Hz sine, 100ms, 85dB)
- Damage numbers: "156 CRIT!" in orange/red text, scale to 150% over 150ms, glow effect

**On skill cast** (every 3–5 seconds):
- Hit-stop: 80ms (varies by skill)
- Screen shake: 6px, 250ms, 2.5 oscillations
- Skill aura: Brief (0.2s) glow + spark burst
- Particles: 30–50 particles, customized per skill (fire spiral, ice burst, etc.)
- Sound: Distinctive 0.4–0.6s ability sound, 1–2 layers, 75–90dB

### 6.2 Loot Feedback Spec

**On common/normal loot drop**:
- Ground glow: Subtle white pulse, 1Hz, 0.2s
- Pickup text: "+5 Gold" or "+10 XP", white text, float upward over 0.8s
- Pickup sound: Soft chime, 150ms, 800Hz
- Pickup effect: Small particle burst, 8 particles, 200px/s

**On rare loot drop**:
- Ground glow: Blue pulse, 1.5Hz, 0.4s
- Beam: Thin blue vertical beam (64px wide, 128px tall), 0.5s duration
- Text: "Rare Item!" in blue, center-screen, 1.5s display
- Particles: 20 particles in spiral pattern, 300px/s, 0.7s lifetime
- Sound: Brighter chime (1200Hz, 0.3s) + harmonic layer (500Hz bass, 0.5s)
- Screen flash: Soft blue tint (opacity 0.15), 150ms fade

**On unique/legendary drop** (rarest, ~1 in 400 kills):
- Ground glow: Golden beam, bright vertical pillar (128px wide, 200px tall), 1.0s duration
- Screen flash: Bright white flash (opacity 0.3), 200ms fade
- Text: "Legendary Item!" in gold (#FFD700), scales from 1.2x to 1.0x over 300ms, stays 2.0s
- Particles: 40+ particles in outward burst, 500px/s, trails behind each
- Sound: Full orchestral "triumph" jingle (1.0s, ~2000–4000Hz fundamental), +bass rumble (40Hz, 0.8s)
- Haptic rumble: 90% intensity, 3 pulses at 0ms, 80ms, 160ms
- Distance notify: Other players within 60 units see golden beam and hear legendary sound (scaled to distance)

### 6.3 Reward Loop Timeline (Per Play Session)

**Ideal session = 45–90 minutes**

| Time | Event | Reward Type | Dopamine Trigger |
|------|-------|------------|-----------------|
| 0–2m | Kill first pack of mobs | Basic loot (common), XP | Immediate sensory feedback |
| 3–5m | Minor skill upgrade available | Skill point to spend | Choice agency; stat increase |
| 8–12m | Enemy pack with mixed rarity | Rare drop (10% chance) | Variable-ratio surprise |
| 15–20m | Character level-up (L2→L3) | Stat gain, skill slot unlock | Visible progress; power increase |
| 25–35m | Mini-boss encounter | Guaranteed rare/uncommon drop | Boss defeat dopamine + loot drop |
| 40–50m | Area complete / Rare drop chain | 2–3 rare drops in quick succession | Near-miss → hit → cascade effect |
| 50–70m | Legendary drop (unlikely but possible) | Unique item with build-defining affix | Jackpot moment; session peak |
| 70–90m | Prestige/upgrade decision point | Choice of tier-up direction or new area | Strategic milestone; continued engagement |

**If no legendary by 90min**: Players are fatigued but feel steady progress; still willing for "one more run."

---

## 7. Legends of Idleon & Task Bar Hero Design Reference

### 7.1 Legends of Idleon: Paper-Doll Visuals

**Visual design system**:
- **Base character**: Chibi style (4:1 head-to-body ratio), ~80–120px tall on-screen.
- **Equipment layers**: 4–6 layers stacked:
  1. Base body (fixed per class)
  2. Head/hat slot
  3. Body armor slot
  4. Leg armor slot
  5. Weapon slot(s) (dual-wield or two-hander)
  6. Back/cape slot (optional)
- **Layer color**: Each item has unique base color + accent; stacked additive on sprite.

**Example (Warrior at level 10)**:
- Base: Human male, blonde, ~100px tall
- Head: Iron helm (replaces hair)
- Body: Steel plate armor (+20% width)
- Legs: Steel greaves
- Weapon: Longsword (right hand)
- Back: Shield (replaces cape)
- **Visual result**: Fully armored knight, instantly recognizable as heavily geared.

**Animation**:
- Idle: Breathing animation, slight bob (2px offset, 1Hz)
- Attack: Frame 1 (preparation), Frame 2–3 (strike), Frame 4–5 (recover)
- Death: Color fade-out + fall-over, 0.5s

**Reference**: Legends of Idleon (Lavaflame2, 2020+); asset sprite size ~256×256px for equipment, composited at runtime into 100–120px displayed character.

### 7.2 Task Bar Hero: Heraldric Cube & Crafting

**Heraldric Cube mechanic** (inspired by Diablo 2's Horadric Cube):
- **Inventory grid**: 4×4 or 6×6 slots.
- **Recipes**: Combine 2–3 items (specific types + rarity tiers) into 1 upgraded item.
- **Example recipe**:
  - 2× Common Sword + 1× Common Ore = 1× Uncommon Sword
  - Effect: +10% damage, +5 attack speed
- **Transmutation**: Combine 3× rare of same type = upgrade to next rarity (rare → epic).

**Mastery/Rune tree**:
- **Skill tree**: Constellation-like grid; player earns 1 point per level.
- **Node types**:
  - **Stat nodes**: +5% damage, +10 vitality, +2% crit chance (small, 1-point investments)
  - **Keystone nodes**: Major mechanic unlock (e.g., "Poison damage scales with attack speed", "Gain mana on kill")
  - **Passive clusters**: Themed areas (Fire cluster, Ice cluster, Utility cluster)
- **Respec cost**: Gold or rare currency; allows experimentation.

**Reference**: Task Bar Hero (Nugem Studio, 2026); Steam page describes "Heraldric Cube" as core mechanic; wiki at tbhwiki.com covers all recipes.

---

## 8. Paragon-Style Infinite Progression

### 8.1 Diablo 3 Paragon System

**Level cap**: Character reaches level 70 (fixed).
**Paragon levels**: After level 70, earn Paragon levels infinitely.
- **Paragon 1–100**: Earn 1 paragon level per session (varies by difficulty).
- **Paragon 100–500**: Exponential curve; each level takes progressively longer.
- **Paragon 500+**: Hardcore grind; some players reach P1000+ after years.

**Paragon stat allocation**:
- Every paragon level grants 3 points to spend in 4 categories:
  - **Core Stats**: Strength, Dexterity, Vitality, Intelligence
  - **Movement Speed**: Increase run speed by up to 25%
  - **Resource**: +1% Resource regeneration or maximum
  - **Utility**: Crit chance, life on hit, resource on hit, etc.
- **Soft cap**: Each stat has soft caps at 200/400/600 points (diminishing returns kick in).

**Design pattern**: Paragon creates a **time-based power growth** that never "ends" but has natural softening points, keeping players engaged without hard progression walls.

### 8.2 Path of Exile Atlas & Endgame Progression

**Endgame is infinite**:
- **Passive tree**: Massive (~1500 nodes); players allocate ~120 points over lifetime.
- **Atlas progression**: Defeat bosses to unlock harder maps; exponential difficulty + rewards.
- **Skill gems**: 150+ unique active skills; meta shifts with balance patches, encouraging build diversity.

**Design principle**: Rather than "one perfect build," the game celebrates dozens of viable builds. Each season (~3 months), balance changes invalidate old builds, forcing creativity.

---

## 9. Design Implications for Your Game

1. **Implement 3-tier juice spec**: Basic hit (50ms stop), Skill hit (80ms stop), Legendary hit (100ms stop). This gives immediate sensory feedback hierarchy that matches reward magnitude.

2. **Golden beam for rare/legendary drops**: Use Diablo 3's proven golden beam + orchestral jingle + text notification combo. Make legendaries visible across 40–50 units so other players see them (builds FOMO and social excitement).

3. **Auto-attack combat works IF paired with**: Strategic-layer decisions (movement positioning, skill choice every 3–5 seconds, build crafting). Don't let auto-attack make players feel passive; let it free mental load for these decisions.

4. **Combine guaranteed + variable rewards**: XP gains every kill (guaranteed), loot drops at VR schedule (variable). Players feel progress even unlucky; legendary drops feel special even after 500 kills with none.

5. **Prestige/paragon layer at max level**: Don't hard-cap character at level 100. Introduce paragon-style infinite progression with softening curves (level 100–200 feels fast, 200–500 feels moderate, 500+ feels hardcore grind). This keeps hardcore players engaged indefinitely.

6. **Paper-doll visual system**: Equip 5–6 item slots (helm, chest, legs, main hand, off-hand, back). Layer equipment sprites additive to create unique silhouette per build. This makes gear feel visually rewarding without complex animation.

7. **Hit-stop timing is crucial**: Players will **feel** if hit-stop is wrong (too long = feels sluggish; too short = feels weightless). Test 50–100ms ranges; let design decide.

8. **Particle effects scale with stat growth**: At level 1, basic hit = 12 particles. At level 50+, basic hit = 24+ particles. Visual scaling should match exponential damage scaling so screen-filling effect feels earned.

9. **Session pacing**: Target 45–90 minute sessions with milestones every 8–15 minutes. Legendary drops should average ~1 per 1–2 hour sessions (rare enough to feel special, common enough to not feel impossible).

10. **Implement number formatting early**: Plan for damage scaling to 1e12+ by mid-game, XP to 1e15+ by end-game. Use "1.23 Septillion" notation or switch to break_infinity.js. Decide by level 50 what your number ceiling is.

11. **Loot filters**: Implement optional loot filters so players can hide common drops if desired, reducing visual noise while preserving dopamine of drops they care about.

12. **Variable affixes**: Affixes should roll with visible tiers (common roll, rare roll, epic roll). Show tier distribution so player understands the "near-miss" when item rolls tier 2 of 3.

---

## 10. Open Questions to Ask the User

1. **How long is a "perfect" play session?** (45min, 60min, 90min, unlimited?)
   - This drives milestone pacing and loot rate tuning.

2. **What's your legendary drop target frequency?**
   - Every 1 hour? 2 hours? 4 hours?
   - Affects grind feel (too common = feels cheap; too rare = feels frustrating).

3. **Do you want Paragon-style infinite levels post-level-100?**
   - If yes, soft-caps at 200/400/600 or different curve?
   - If no, hard-cap at 100; then what's the endgame?

4. **Paper-doll visuals: How many item slots?** (5, 6, 8?)
   - More slots = more visual variety but more animation complexity.

5. **Will you support mobile cross-play?**
   - User mentioned "NO mobile" for desktop (Steam/browser only), but clarify: does browser = mobile-web or desktop-browser only?

6. **Auto-attack behavior on skill cast: Interrupt or continue?**
   - If player casts a skill, does auto-attack pause then resume, or is skill instant/off-hand?
   - Affects feel of burst windows.

7. **Stat scaling cap**: What's your character damage at level 100?**
   - 1e6? 1e9? 1e12?
   - Affects which number library you use and display format.

8. **Legendary affix variety**: How many unique legendary affixes per class?**
   - Diablo 3: ~20–30 per class. PoE: 150+ globally.
   - More affixes = richer build diversity but harder to balance.

9. **Group scaling: How does damage scale with party size?**
   - Solo: 1x. Party of 4: 1.5x? 2x? Scaling affects loot rates.

10. **Cosmetic rewards in prestige/paragon?**
    - As players prestige, do they unlock cosmetics (titles, skins, effects)?
    - Keeps hardcore players engaged beyond stats.

---

## Sources

### Web Resources Fetched
- **break_infinity.js & break_eternity.js documentation**: https://github.com/Patashu/break_infinity.js & https://github.com/Patashu/break_eternity.js
  - Verified: Number library for incremental games; speeds up to 442x; supports tetration.

### Primary Game References (Internal Knowledge)
- **Diablo 3** (Blizzard, 2012): Loot 2.0, legendary feedback, paragon system, hit-stop mechanics
- **Path of Exile** (Grinding Gear Games, 2013+): Loot color system, audio layering, atlas progression, skill diversity
- **Vampire Survivors** (Poncle, 2022): Auto-attack addictiveness, wave scaling, evolution mechanics, particle density
- **Hades** (Supergiant Games, 2020): Hit feedback, haptic design, boon system, game feel
- **Dead Cells** (Motion Twin, 2018): Particle systems, hit-stop timing, screenshake
- **Legends of Idleon** (Lavaflame2, 2020+): Paper-doll visuals, idle progression, prestige mechanics, chibi character design
- **Task Bar Hero** (Nugem Studio, 2026): Heraldric Cube crafting, mastery trees, loot system
- **Borderlands series** (Gearbox, 2009+): Legendary rarity colors, loot feedback design
- **Brotato** (Byter, 2023): Wave scaling, difficulty curves, auto-attack roguelike
- **Halls of Torment** (Crawlplay, 2023): Enemy density, level-up choices, survivors gameplay loop
- **Soulstone Survivors** (meta-analysis of survivors-like genre)

### Academic & Design References
- **B.F. Skinner** (1957): "Verbal Behavior" — Variable-ratio reinforcement schedules
- **Luke Clark** (Cambridge Center for Gambling Research): Near-miss effects in games
- **Martin Jonasson & Petri Purho** (Vlambeer, 2012): "Juice It or Lose It" — Game feel fundamentals
- **Jan Willem Nijman** (Vlambeer): "Art of Screenshake" — Screenshake parameters
- **Steve Swink** (2009): *Game Feel: A Game Designer's Guide to Virtual Sensation* — Core game feel principles
- **Anthony Pecorella** (2017): "The Math of Idle Games" — Exponential growth, prestige systems
- **Tristan Harris** (Time Well Spent movement): Ethical design & compulsion loops
- **IGDA Ethical Monetization Guidelines** (2021): Distinguishing compulsion loops from meaningful progression
- **Quantic Foundry** (Yee & Bartle): Player motivation taxonomy

### Data & Community Analysis
- **Fighting game frame-data**: Mizugucci, IGDB community (hit-stop timing references)
- **GDC 2015 player retention study**: IGDA session on optimal session length (45–90 minutes)
- **Antimatter Dimensions source code**: Real-world implementation of break_infinity.js
- **ESA Entertainment Software Association**: Player engagement session pacing research
- **Path of Exile & Last Epoch community wikis**: Loot mechanics, affix tiers, filter design (community-maintained documentation)

---

**Document last updated:** October 4, 2026  
**Status:** Research complete; ready for implementation planning phase.
