# Hearthfall — Prototype Architecture & Build Spec

A 2D massively-multiplayer action RPG: Legends of Idleon-style paper-doll characters, Diablo 3 RoS combat
density and Loot 2.0 itemization, Task Bar Hero-style Cube and skill tiers. Browser-first, wrapped for Steam.

Decisions from the design Q&A (see `docs/research/` for sources):

| Topic | Decision |
|---|---|
| Camera | Top-down 3/4 map; characters drawn **side-on** (Idleon style) and mirrored left/right |
| Controls | WASD + **Space = dash**. Auto-attack and 4 auto-cast skills fire on their own |
| Density | Diablo 3 rift explosion: packs of 6-14 trash, champion/rare elites, goblins, guardians |
| Rarity | Pure Diablo 3: Normal / Magic / Rare / Legendary / Set (+ Ancient, Primal) |
| Trading | Hybrid binding: items bind when equipped or upgraded (trading not in the prototype) |
| Skills | D3 unlock-by-level + 3 runes per skill, plus TBH-style 3 upgrade tiers bought with skill points |
| Idle | Idleon-style offline progress (25% efficiency, 12 h cap) reported on login |
| Cube | TBH levelling Cube (functions unlock by Cube level, ops grant Cube XP) with D3 Kanai/Mystic recipes and +0..+10 upgrade tiers |
| World | Shared hub town (channels of 100), shared training fields (channels of 30), instanced rifts |
| Tone | Cute characters/monsters, dark-fantasy D3-like UI |
| Art | Code-drawn vector art (Pixi Graphics), no external assets |
| Signature builds | Warrior Whirlwind, Ranger Sentries (Marauder), Mage Meteor (Tal Rasha) |

## Stack

* **Client**: TypeScript, PixiJS 8 (WebGL2/WebGPU) for the world, Preact for the DOM UI, Vite.
* **Server**: Node 22 + `ws`, MessagePack (`msgpackr`), authoritative 20 Hz simulation.
* **Shared** (`shared/src`): all rules and data — both sides import the same code.
* **Steam**: later, Electron + steamworks.js wrapping the same build (not in the prototype).

```
shared/src/         rules & data (DONE — read before building anything)
  constants.ts      tick rate, dash, radii, AOI
  types.ts          Item, CharacterSave, DerivedStats …
  data/classes.ts   3 classes
  data/skills.ts    18 skills, runes, tiers, auto-cast rules, describeSkill()
  data/items.ts     bases, affixes, legendaries, sets, gems
  data/monsters.ts  monster roster, elite affixes
  data/zones.ts     town / fields / rift
  items.ts          generateItem(), rollDrops(), equip slot rules, colours
  stats.ts          computeStats(), compareItem()
  progression.ts    XP, paragon, difficulty, monster scaling
  cube.ts           Cube functions, costs, chances
  character.ts      createCharacter(), equipItem(), skills helpers, playerLook()
  mapgen.ts         deterministic map generation (seed → identical map on both sides)
  movement.ts       CollisionWorld + stepMove() (shared for client prediction)
  protocol.ts       messages, entity flags, events
server/src/         authoritative server (agent: SERVER)
client/src/
  main.ts, game/*, net/connection.ts, render/scene.ts      glue (lead)
  render/art/*      entity / map / icon art (agent: ART)
  render/vfx/*, audio/*                                     effects, text, loot, sound (agent: VFX)
  ui/hud/*  + ui/styles/hud.css                             HUD, chat, minimap, class select (agent: HUD)
  ui/panels/* + ui/styles/panels.css                        tooltips, inventory, skills, paragon, cube (agent: PANELS)
  ui/store.ts, net/api.ts, render/types.ts, ui/styles/tokens.css   contracts (lead; do not change signatures)
```

---

## 1. Server (`server/src`) — owner: SERVER agent

Run with `npx tsx server/src/main.ts` (port 2567, WebSocket path `/ws`; in production also serves `dist/client`).

### 1.1 Modules (suggested)
* `main.ts` — http server + `ws` server on `/ws`, msgpack (`Packr({ useRecords: false })`) encode/decode, static file serving of `dist/client` when it exists.
* `persistence.ts` — JSON file per character in `server/data/characters/<id>.json`; save on logout, zone change, and every 30 s while dirty.
* `session.ts` — one per connection. `hello` → load or `createCharacter()`; compute AFK gains; place in last zone (default town). Handles `in`, `cmd`, `chat`, `ping`. Sends `char` (full save + derived stats) whenever the save changes (throttle 200 ms).
* `world.ts` — zone/channel/instance manager. Town: channels capped at 100. Fields: channels capped at 30 (create new channel when full). Rifts: one instance per opener; others in the same town channel may enter while it is open via the obelisk portal or the `riftEnter` cmd. Empty instances are destroyed after 60 s (rifts) / kept warm (town, fields).
* `instance.ts` — one simulated map. Owns entities, spatial hash, 20 Hz tick, AOI replication, events.
* `sim/*` — players, monsters/AI, elites, spawner, skills, projectiles, ground effects, buffs, summons, damage, loot.

### 1.2 Tick loop (per instance, 50 ms)
1. Apply queued inputs: process up to 2 queued `in` messages per player per tick (if none, reuse last input); run `stepMove()` from `shared/movement.ts` with the player's derived `ms` and dash cooldown (2800 ms, halved by Stridewind). Track `ack` = last processed input seq. Dead/frozen players don't move.
2. Player combat brain (auto-attack + auto-cast, §1.4).
3. Monsters AI (§1.6), summons, projectiles, ground effects, DoTs, buffs.
4. Deaths → XP/loot/rift progress; respawn players (5 s, in town if field/rift? No: respawn at map entry with full life).
5. Loot: pickups (gold/mats/gems/globes magnet within `MAGNET_RADIUS + pickup`, items within `ITEM_PICKUP_RADIUS` if inventory has space; personal loot — only the owner sees and can pick it up; loot despawns after 90 s).
6. Spawner (fields: keep `packTarget` packs alive, respawn packs out of every player's view after `respawnSec`; rifts: pre-populate all spawn points; treasure goblin chance 2% per pack spawn in fields, 1 guaranteed attempt per rift at 25%).
7. Replication: for each player build a snapshot: entities within `AOI_HALF_W/H` of the player (loot only for its owner). New-in-AOI → `add` (EntDesc); left/died → `rem`; all visible → `upd` compact state `[id, x|0, y|0, hp*1000|0, flags, attackSeq]`; events whose position is in AOI (or that target/come from the player). `me` block every tick. Include `rift` state in rifts.

Performance budget: 4 instances × 150 mobs must tick in < 10 ms total on one core. Use a uniform-grid spatial hash (cell 128) for mobs/players; never O(n²) over all entities.

### 1.3 Damage model (Diablo 3 multiplicative buckets)
```
hit = rand(weaponMin, weaponMax) × skillCoef
      × (1 + mainStat/100)
      × (1 + (rune/tier dmg% + skillDmg[skill] + legendary skill%)/100)    // additive skill bucket
      × (1 + ele[element]/100)                                              // elemental bucket
      × (1 + dmgPct/100 + buffs%)                                           // generic bucket (Battle Rage, Magic Weapon, Hellforge, dash bonus …)
      × (target elite/boss ? 1 + elite/100 : 1)
      × Π(set/legendary multipliers)                                        // each its own bucket: 6pc ×16, ×(1+6×sentries), ×21; Tal-style stacks
      × (crit ? 1 + chd/100 : 1)        crit chance = chc
      × vulnerability (stunned + Jarring Slam / Anvil vambraces, frozen + Bone Chill, Hunter's Mark, Black Hole + Heart of the Void)
```
* Area damage (D3): each direct hit has a 20% chance to splash `area%` of the hit to all other enemies within 100 units (no further procs, no area-of-area).
* Monster HP = `monsterHp(level) × def.hp × ELITE_HP_MULT[tier] × DIFFICULTIES[d].hp` (+50% per extra player in the instance after the first, D3 scaling). Monster damage = `monsterDmg(level) × def.dmg × DIFFICULTIES[d].dmg`.
* Damage taken by players = raw × (1 − armorDR(vs monster level)) × (1 − resDR) × (1 − eliteDR if elite) × other DR (WotW 4pc 50%, Eternal Gyre 20%). Thorns reflect on melee hits. Life per hit (on player hits, capped at 1 trigger per target per 100 ms), life per kill, regen.
* Every hit emits `{e:'dmg', t, a, c?, el, s, k?, p?, dot?}`. Big hits on players emit `p:1`.
* XP: `monsterXp(level, eliteTier, difficulty) × (1 + xpPct/100)` to every player in the instance within 1400 units (shared XP, D3 style). Dev multiplier env `XP_MULT` (default 3 for the prototype).

### 1.4 Player combat brain (auto-attack + auto-cast)
* **Primary attack** fires whenever an enemy is within `CLASS.attackRange + ACQUIRE_BUFFER` (melee 86, ranger 520, mage 480), every `1 / aps` seconds, targeting the nearest enemy (prefer elites/boss within range if within 1.2× nearest distance). Works while moving (WASD kiting). Sets `F_ATTACK` and increments `attackSeq`.
* **Auto-cast** each of the 4 slotted skills when its `auto` rule holds, it is off cooldown and resource is sufficient; at most one skill cast per tick per player, evaluated in slot order (left → right). Rules:
  * `enemiesNear {count, within}` — count enemies within `within`; elites count 3×, bosses 10×.
  * `maintainBuff` — recast when the buff has < 2 s left (only in combat, i.e. enemy within 700).
  * `maintainSummon` — cast while active summons < max and an enemy is within skill range (Sentry: place at player's feet; Hydra: at player's feet offset towards enemies; Companion: always maintained, even out of combat).
  * `channel {startAt, within}` — Whirlwind: start when resource ≥ startAt and an enemy is within `within`; keep channelling while resource > 0 and an enemy within `within + 40` (grace 0.6 s); ticks 4×/s at `coef/4` to everything within radius; `F_CHANNEL` set; cost per second.
* Targeting for ground-targeted skills (Meteor, Black Hole, Cluster Arrow, Rain of Vengeance): pick the point that maximises enemies within the skill radius among enemy positions within range (sample up to 24 candidates; elites weigh 3×).
* Cooldowns use `skill.cooldown × (1 + mods.cooldown/100) × (1 − cdr/100)`. Costs use `cost × (1 + mods.cost/100) × (1 − rcr/100)`.
* Resource: Fury +gen per primary hit-swing (not per enemy), decays 3/s after 4 s without hitting; Hatred/Arcane regenerate per second.

### 1.5 Skills (implement every skill, rune, tier flag, legendary and set listed in shared data)
Use `loadoutMods(save, skill)` + legendary/set mods. Notes per skill (radii/coefs come from data):
* **Cleave**: arc 120° (wideArc 180°) in facing direction toward target, hits all within radius. `explodeOnKill`: killed enemies explode 120% in 80 r. `momentum`: +3% IAS stacking 5 for 3 s.
* **Whirlwind**: see channel above. `dustDevils` (rune, Ninefold Gale, 2pc): spawn a `dust_devil` summon every 1 s of channelling that wanders randomly through nearby enemies for 3 s dealing 120%/s in 45 r (Ninefold +v%, 6pc ×16). `critHeal` heals 1.5% life on crit (max 4/s). 4pc: applies Rend bleed to enemies hit (refresh). Eternal Gyre: cost −v%, 20% DR while channelling. Movement while whirlwinding: normal WASD speed.
* **Rend**: bleed DoT `coef` over 5 s to all within radius (ticks 2/s, emits `dot:1`). Auto rule counts only non-bleeding enemies. `bleedHeal`, `bleedSpread` on death to 3 within 150.
* **Ground Stomp**: AoE + stun 2 s (`F_STUN`). `pull` (rune, Last Light): pull enemies within 320 to within 60 of player first. `vulnerable`: stunned take +30%.
* **Seismic Slam**: 60° cone (radius mod widens) length 420; emits `aoe v:'fissure'` with angle `a`. `knockback`, `chill`, `aftershock` (+100% over 1 s).
* **Battle Rage**: buff +10% dmg +3% chc 60 s (`rageDmg` 25%, `rageChd` +25% chd, `rageExtra` +5%, `critFury` 4 Fury per crit).
* **Hungering Arrow**: projectile 900 u/s, seeks nearest (turn rate 6 rad/s), 35% pierce (+mods.pierce; Hunter's Mark always), extra projectiles fan ±10°. `splitOnPierce` 3 shards 50%; `devouring` +70% per pierce. Hunter's Mark: pierced enemies take +v% for 3 s.
* **Sentry**: summon at feet, lasts duration, fires bolt (projectile 1000 u/s, 280%) at nearest enemy within 560 every 1 s (×1.5 rate with Gearwright). Max = 2 + tier + 2pc + Sapper's Pack (+2). Charges/cooldown: cooldown 8 s per placement (Gearwright −v%, 2pc −30%, tier −25%). `rockets`: also fires a homing rocket 120% fire every 1.5 s. `chains`: lightning beams between sentries (emit `beam v:'chain'` every 0.5 s) damaging enemies within 30 of the segment 300%/s. `chill`. Set 4pc: whenever the player casts Multishot or Cluster Arrow, every active sentry also casts it from its position at the same target. 6pc: Sentry/Multishot/Cluster damage × (1 + 6 × activeSentries).
* **Multishot**: volley of 9 arrows (+projectiles) over a 70° fan toward target, each pierces all, each enemy damaged once per cast. `rockets` (Arsenal): +3 homing rockets 300% fire. Thunderhead: lightning + v%.
* **Cluster Arrow**: lobbed projectile (flight 0.45 s, `proj v:'cluster'`), explodes at target point radius r, then 4 grenades scattered 60-110 u that explode 0.35 s later for 210% in 50 r (`rockets` → 3 homing rockets instead; `noGrenades`).
* **Rain of Vengeance**: area at best point, 10 waves over duration each dealing coef/10 to all inside (`follow`: recentre each wave on densest pack within 300).
* **Companion**: wolf summon follows the player, bites nearest enemy within 400 every 1 s for coef. `wolfAura` +15% dmg buff while alive; `batCompanion` (bat summon, +1 Hatred/s); `ravenCompanion` (raven, lightning). maxSummons tier 3 → 2 companions.
* **Magic Missile**: projectile 800 u/s, `homing`, `projectiles` fan, `freezeChance` 15% freeze 1 s. Thousand Missiles: +2 projectiles, +v%.
* **Meteor**: telegraph (`tele v:'meteor'` d=1000 ms, Starfall: 500 ms), then impact radius r for coef (fire), then molten ground (`aoe v:'molten'` d=3000 ms; Cindervane ×2 duration) ticking 235% total over duration. `freeze` (Comet: cold, freeze 1.5 s). `shower`: 7 small meteors (37% each) randomly within 1.6× radius over 1.2 s. 2pc: second meteor on a different enemy within 400. 6pc: ×21. Cindervane +v%.
* **Black Hole**: at best point, pulls enemies within r towards centre (speed 260 u/s) for duration while dealing coef over duration. `spellsteal`: +3%/enemy for 10 s. `freeze` on collapse. Heart of the Void: radius +30%, enemies inside take +v%.
* **Frost Nova**: radius around player, freeze `duration` (`F_FROZEN`). `shatterNova`: frozen enemies dying cast a small nova (no chain > 1 depth). `vulnerable`: frozen take +33%. `deepFreeze`: if ≥5 frozen → +10% chc 11 s buff.
* **Hydra**: summon lasting duration; spits fireball projectile (600 u/s, splash 40) every 0.9 s at nearest within 500, coef per second split by 3 heads (each head fires in turn). `splash` (arcane orbs radius 60), `chill` (frost cones), `mammoth` (single big hydra, fire river line damage).
* **Magic Weapon**: buff +10% dmg (`forceWeapon` 20%, `weaponExtra` +5%), `igniteHits` (burn 100% over 3 s on primary hits), `electrify` (25% chance on hit to `beam v:'arc'` to 3 enemies for 100%).
* **Tal-style 4pc (Fallen Star)**: track last-hit time per element (arcane/cold/fire/lightning); each element hit in last 8 s = +100% (max 4 → ×5 bucket).
* **Ouroboros Loop**: element rotates every 4 s (fire → cold → lightning → arcane → physical); +v% to that element's damage (own bucket). Expose as buff `ouroboros_<element>`.
* **Patient Thief**: each spender cast (cost > 0) reduces all slot cooldowns by v s.
* **Hellforge Talisman**: elite kill → +v% dmg buff 30 s. **Stridewind**: dash cd −50%, after dash +v% dmg 3 s. **Anvil Vambraces**: stunned take +v%.

### 1.6 Monsters, packs, elites
* Pack composition: 6-14 trash of 1-3 types from the zone theme (weights), level = clamp(nearest player level, band); 18% of packs are **champion** packs (3-4 champions, blue, shared 2 affixes, ×4 HP) and 10% **rare** packs (1 rare, yellow, 2-3 affixes, ×6 HP, + 4-6 minions ×1.3 HP). Elite names: `ELITE_PREFIX + ELITE_SUFFIX` ("Gorethorn").
* AI: idle until a player is within 520 (or hit) → chase nearest player; separation steering vs other mobs (spatial hash) so packs spread into a crowd; attack when in range: set `F_WINDUP` for `windupMs` (emit `tele v:'slam'` for aoe attacks), then hit if still in range (melee) / fire projectile (ranged, `proj v:'seed'|'firebolt'`) / explode (wisp: aoe, dies). Leash back if > 1600 from home. Frozen/stunned mobs do nothing; chilled move/attack 40% slower.
* Elite affixes (ELITE_AFFIXES): fast (+40% speed, −25% windup), extra_health (×1.5), molten (leaves `aoe v:'molten_trail'` every 0.5 s that hurts players 1.5 s; death explosion after 1.2 s telegraph), frozen (every 5 s drop 2-3 `tele v:'frozen_orb'` near player, explode after 1.5 s, freeze 1 s), plagued (every 4 s poison pool under player, 4 s), electrified (on taking damage 15% chance to spawn 3 spark projectiles), vortex (every 8 s pulls player next to the elite, emit `beam v:'vortex'`), mortar (every 3 s lob 3 shells at player, telegraph 0.9 s).
* Treasure goblin: runs away from players, drops gold piles while hit, despawns via portal after 25 s since first noticed; on death: rich loot.
* Rift Guardian (boss): ×70 HP; abilities: melee slam (aoe tele), ring of 16 projectiles every 6 s, summon 6 adds every 12 s, enrage at 30% (+30% speed). `notice` "The Rift Guardian has appeared!" (kind boss).

### 1.7 Rifts
* `riftOpen {difficulty}` at the town obelisk: creates rift instance (theme random glade/ashen, seed random), spawns a `portal` entity next to the obelisk for 60 s / until rift closes. Level = opener's level. Difficulty = chosen (cannot exceed what's allowed: Torment needs level 60).
* Progress per kill: `RIFT_PROGRESS[eliteTier]` × (mob count balanced so ~100% after ~85% of spawned monsters). At 100% → spawn guardian near the player who completed it; at guardian death: phase `done`, loot shower (boss drops, + bonus for each player), portal back to town at the boss location, `stats.rifts++`, `notice`.

### 1.8 Loot
* Use `rollDrops()` per eligible player (personal loot) with that player's class/pity/goldFind; pity persists in the save (`stats` extension field `lootPity` allowed — add `lootPity?: number` to the save object at runtime).
* Spawn loot entities scattered in a burst around the corpse (D3 loot fountain): positions randomised 30-90 u, emit nothing special — the client animates the arc on `add`.
* Legendary/set drop → `notice` kind `legendary` to the owner only.
* Health globe: heals 20% life to players within its radius on pickup.

### 1.9 Commands (`cmd` → `res {id, ok, err?, data?}`)
| op | args | effect |
|---|---|---|
| equip | itemId, slot? | `equipItem()`; refresh derived + `playerLook` (re-send EntDesc to viewers) |
| unequip | slot | |
| swapInv | from, to | move/swap inventory indices |
| destroy | itemId | |
| salvage | itemId | Cube level ≥1; mats + Cube XP (`salvageYield`, `salvageXp`) |
| salvageAll | rarities: Rarity[] | salvage all inventory items of those rarities |
| enchantRoll | itemId, affix | Cube ≥3; pay `enchantCost`; returns `data.options` (2 new rolls of different stats from `enchantPool`, same item level/ancient scaling). Store pending per session |
| enchantPick | itemId, choice (0 keep, 1, 2) | applies; sets `item.enchanted = affix`, `enchantCount++`, bound |
| upgrade | itemId | Cube ≥4; `upgradeCost`, roll `upgradeChance`; success → `upgrade++`, fortune 0; fail → `fortune += FORTUNE_PER_FAIL`; returns `data {success}`; bound |
| transmute | itemId | Cube ≥5; Rare → random legendary of the same kind (`generateItem` with base of same kind) |
| extract | itemId | Cube ≥6; legendary destroyed, power added to `cube.learned` |
| cubeEquip | slot (0 weapon,1 armor,2 jewelry), power or null | must be learned & matching `cubeSlot` |
| reforge | itemId | Cube ≥7; regenerate same legendary/set (keep id) |
| socket | itemId | Cube ≥8; add one empty socket up to base max |
| insertGem | itemId, gem, rank | from `save.gems["gem:rank"]` into first empty socket |
| removeGem | itemId, idx | costs `gemRemoveCost` gold, gem returned |
| fuseGem | gem, rank | Cube ≥2; 3 → 1 of rank+1 (max 6), `fuseCost` |
| skillSlot | slot, skill | `setSkillSlot()` |
| skillRune | skill, rune | `setSkillRune()` |
| skillTier | skill | `buySkillTier()` |
| skillReset | — | `resetSkillTiers()` |
| paragon | stat, n | spend points within category budget & caps (`paragonPoints`, `PARAGON_STATS`) |
| paragonReset | — | |
| travel | zone | from town waypoint (or anywhere → town). Fields pick least-full channel |
| channel | n | switch channel of current zone |
| riftOpen | difficulty | see §1.7 |
| riftEnter | — | enter the open rift of your town channel |
| leave | — | back to town |
| debug | op: 'level' (n) / 'paragon' (n) / 'gold' / 'mats' / 'legendaries' / 'set' / 'goblin' / 'elite' / 'heal' | prototype helpers; `set` grants the full class set + class legendaries at ilvl 70 into inventory (expanding inventory if needed is not allowed — fill free slots only) |

Equipment changes must set `bound = true`. Every cmd that changes the save marks it dirty and triggers a `char` message.

### 1.10 AFK gains (Idleon)
On `hello` for an existing save: `away = now − lastSeen` capped at 12 h; if away > 2 min and last zone was a field: kills = away_min × 60 × `AFK_EFFICIENCY` (≈ 15 kills/min), XP = kills × monsterXp(level,0,0) × (1 + xpPct/100) × XP_MULT, gold = kills × 0.22 × goldAmount avg, materials (scrap/dust ~ kills/40, crystal ~ kills/150). Apply with `addXp`, send `afk` message. Characters always reappear in town.

---

## 2. Art (`client/src/render/art/*`) — owner: ART agent

Public API is fixed in `client/src/render/art/index.ts` (keep every export and signature; replace the placeholder internals; split into files).

**Style**: Legends of Idleon-inspired chibi: big round head (~45% of total height), small rounded torso, short stubby legs, thin arms with round hands; flat colours with one soft top highlight and a subtle bottom shade; **dark outline 2.5-3 px (0x1b1410)** on every shape; small black oval eyes with a white glint. Characters ~64 world units tall at scale 1. Charming, readable at small size, never noisy. Side view, mirrored with `scale.x = -1` when facing left.

**Paper doll** — body parts as separate Graphics in a hierarchy (back arm, back leg, cape/back items, torso, front leg, head, hair/helmet, front arm + hand → weapon). Every `ItemLook.shape` from `shared/src/data/items.ts` bases must draw distinctly (head: cap, hood, helm, helm_horned, wizard_hat, circlet; shoulders: pads, plate, spiked, mantle; chest: tunic, leather, mail, plate, robe; hands: gloves, gauntlets, wraps; legs: cloth, leather, plate; feet: shoes, boots, greaves; waist: belt, sash; weapons: sword, axe, mace, sword2h, axe2h, bow, crossbow, handxbow, staff, wand; offhand: shield, quiver, orb) using `primary`/`secondary` colours; `variant` adds small details (studs, stripes, gem colour). `glow` ≠ 0 → soft additive aura/sparkles on that piece (legendary orange / set green). Unequipped slots show the class base outfit (simple clothes, class hair from `CLASSES[c].appearance`).

**Animation** (procedural, from ViewState): idle breathing bob (1.6 s), walk cycle (legs swing ±25°, body bob 2 px, 8 steps/s scaled by speed), attack swing on `attackSeq` change matched to `aps` (melee: wind-up 35% / strike 20% / recover; bow: draw & release; staff: raise & thrust), `F_CHANNEL` → whirlwind spin (rotate weapon arm 360° continuously + motion blur arc), `F_CAST` → arms up, `F_DASH` → lean forward 15°, `F_STUN`/`F_FROZEN` → frozen pose, tinted blue for frozen, stars for stun. `hit()` → 70 ms white flash (white overlay copy of silhouette or tint lerp) + 8% squash. `die(el)` → topple + fade 600 ms (players) — monsters die via vfx particles too: physical pop/squash, fire char-black then crumble, cold shatter (hide body, vfx shards), lightning flash, poison melt, arcane fade.

**Monsters** (`MONSTERS` families): slime (jiggly blob, eyes), mushroom (cap with spots, little feet), bat (flapping wings, flying bob + shadow), sprout (plant with petal head, spits), golem (mossy rock giant), imp (horned red imp with tail), skeleton (bone biped with rusty sword), cultist (hooded robe, glowing eyes, staff), brute (big ember-cracked lava rock creature), wisp (glowing ghost flame), goblin (green goblin with huge sack of gold that jingles), boss_slime (giant crowned slime), boss_imp (big horned imp lord with flaming crown). Elites: champions tinted with a blue rim glow, rares with a gold rim glow, minions slight gold rim; bosses scale ×2.6.

**Summons**: sentry (wooden/brass ballista turret on tripod, rotates toward its last shot), hydra (three serpent heads from a lava pool, `F_ATTACK` bob), wolf, bat, raven, dust_devil (swirling tornado of dust, animated).

**NPC / objects**: cube (an ornate floating bronze cube with runes, slowly rotating glow), obelisk (dark stone obelisk with glowing rift runes), waypoint (stone circle with blue swirl), stash (big iron-bound chest), paragon (shrine with a star), dummy (straw training dummy on a post; `hit()` wobble), portal (blue swirling oval for town, purple-red for rift).

**Map** `buildMapLayers(map)`: bake tiles into chunk textures (1024² chunks via `renderer.generateTexture` / RenderTexture): floor with soft noise variation, paths (cobbles in town, dirt in fields), plaza stone tiles, walls rendered as cliff/forest mass with an edge shadow, water/lava with soft shoreline. Themes: town (warm green grass, cobblestone), glade (lush greens, moss, flowers), ashen (charcoal ground, glowing orange cracks), rift glade = blue-green cave, rift ashen = red cave. Props by `kind` (see `mapgen.ts`): tree, pine, deadtree, rockspire, boulder, stump, pillar, brazier (animated flame), stalagmite, cavecrystal (glow), house, tavern, forge (glow), well, lantern (warm glow), banner, campfire (animated), crate, fence; decals: grass, flowers, mushrooms, pebbles, bush, fern, ash, bones, cracks, ember, skull, glowmoss. Large props are y-sorted (`sorted`), decals go into `decals`. Draw each prop kind once into a texture and reuse via Sprites — thousands of props must stay cheap.

**Icons**: `itemIconUrl(look, kind, size)` → draw the item part centred on a transparent canvas (Pixi `renderer.extract.canvas`), cache by `shape+colors+variant+size`. `itemIconTexture` for ground loot.

---

## 3. Effects (`client/src/render/vfx/*`, `client/src/audio/*`) — owner: VFX agent

Public API fixed in `client/src/render/vfx/index.ts`. Juice spec (from `docs/research/02`, `11`):

* **Floating combat text** (`dmg` events): font `Lilita One` (bitmap/canvas text, pooled — hundreds per second must be cheap; use `BitmapFont.install` with a white fill + dark stroke and tint per type). Numbers via `fmtCompact()`. White normal hits, **yellow-orange crits** (#ffd23f, 1.45× size, slight scale-pop 1.6→1.0 over 120 ms), elemental tint for DoTs (fire #ff8a3d, cold #7fd3ff, lightning #d6c2ff, poison #8fd16a, arcane #c39bff), **red for damage taken by me** (#ff4a3a). Motion: spawn at target top, rise 40-70 u with ease-out and slight random x drift, hold, fade over 0.9 s total (crit 1.1 s). Stack/merge rule: ≥ 6 numbers on the same target within 150 ms → merge into one summed number. Constant on-screen size regardless of zoom. Only show other players' damage at 50% opacity and smaller.
* **Projectiles** by `v`: arrow (wooden shaft + fletching, slight trail), bolt (sentry), rocket (smoke trail), missile (arcane purple orb with sparkle trail), fireball, seed (green), firebolt (monster), cluster (lobbed arc with shadow), shard, spark. Simulate locally from `proj` (x, y, vx, vy, life, homing target h) until `pend`.
* **AoEs** by `v`: meteor (falling rock from top-left with fire trail during telegraph, then impact: flash, shockwave ring, debris, scorch decal), meteorSmall, molten (bubbling lava pool decal for d ms), blackhole (dark swirling disc with purple rim, inward particle spiral), nova (expanding ice ring + shards), stomp (dust ring + cracks), rend (red slash arcs around the player), fissure (cone of cracking earth, angle `a`), rain (arrows raining in radius), cluster/grenade explosions, explode (wisp/molten death), rend bleed drips, molten_trail, poison_pool, whirl (spinning arc around caster — or rely on art), chain/arc/vortex beams (`beam`).
* **Telegraphs** (`tele`): red-orange ground circles/cones that fill up over `d` ms (D3/Lost Ark style) — `slam`, `meteor` (orange, for my meteor: subtle), `frozen_orb`, `mortar`, `boss_ring`.
* **Hit feedback**: on `dmg` call `ctx.entityView(t)?.hit()`; crit on elites → `hitStop(45)`; my big crits → `shake(3, 90)`; boss slams on me → `shake(8, 220)`. Small spark particles at impact point, coloured by element.
* **Deaths** (`die`): element styles: physical = squash pop + 6-10 chunky bits + dust; fire = embers + ash puff; cold = ice shards burst; lightning = white flash + sparks; poison = green goo splat; arcane = purple dissolve sparkles. Elites (`big`): bigger burst + `shake(4, 140)`.
* **Loot views** (`createLootView`): items spawn with a D3 "loot fountain" arc (pop up 40-60 u and land in 450 ms with a bounce), then lie on the ground showing the item icon (`itemIconTexture` from art) small, with a **label above in rarity colour** (font Alegreya Sans bold 13 px, dark backdrop, D3 style); **legendary**: tall orange light beam (#bf642f → gold core, additive, gently pulsing) + orange label + loud chime; **set**: green beam; ancient: brighter beam. Gold: small coin pile (count scales with amount) glinting; gems: coloured gem; globes: red health orb pulsing. Magnet pickup animation is handled by the server removing the entity — on removal (`destroy`) play a quick fly-to-player tween when the player is near (use ctx.myId / entityPos).
* **Nameplates** (`createNameplate`): players — name (class colour) + level small above head; champions — blue name, rares — yellow name, minions none, bosses none (HUD shows boss bar); elites show affix line below name in small grey caps and a slim HP bar (D3-like). Other monsters: none (D3 shows none). Fade in when entity is on screen.
* **Audio** (`client/src/audio/sfx.ts`, zzfx): procedural sounds: swing, hit (soft thud), crit (sharper crack), arrow/bolt fire, magic missile, meteor incoming whistle + impact boom, frost nova, black hole hum, whirlwind loop (start/stop on F_CHANNEL of me — the scene will call `sfx.loop('whirlwind', on)`), level up fanfare, legendary drop chime (distinct, memorable rising arpeggio), set drop chime, gold pickup clink, gem pickup, item pickup, rift guardian roar, death. Volume scales by distance from player; cap concurrent same-sound plays (≤ 4 per 50 ms). Expose `sfx.play(name, {x, y, vol})`, `sfx.loop(name, on)`, `sfx.setListener(x, y)`, `sfx.setVolume(v)`, `sfx.unlock()` (on first user gesture).

---

## 4. UI (`client/src/ui/*`) — owners: HUD agent and PANELS agent

Preact + CSS. Read state via `useUI()` from `ui/store.ts`; send commands via `cmd()` from `net/api.ts`. Pointer events: the `#ui` root has `pointer-events: none`; interactive elements need class `interactive`. All styling uses tokens in `ui/styles/tokens.css` (`.frame`, `.btn`, `.title-plate`). Fonts are loaded by main.ts (Cinzel, Alegreya Sans, Lilita One).

### 4.1 HUD agent — `ui/hud/*`, `ui/styles/hud.css`, exports `HudRoot` from `ui/hud/index.tsx`
* **Class select screen** (`screen === 'select'`): dark vignette over the game canvas; title "HEARTHFALL" (Cinzel, gold, letter-spaced) with tagline; three class cards (Warrior / Ranger / Mage) with a live character preview area (a `<canvas>` element per card that main.ts animates — render `<canvas data-preview={classId} width=220 height=220>`), class name, title (e.g. "Storm of Steel"), `blurb`, `playstyle`, signature skill; selected card glows in class theme colour; name input (2-16 chars, letters/numbers) pre-filled from localStorage; "Enter World" button calls `session.start(name, classId)`. D3 character-select feel: centred, cinematic, quiet.
* **Bottom bar** (D3 layout): left **health globe** (glass sphere: liquid fill level = hp/mhp with wavy surface animation, red, glossy highlight, number on hover/always small), right **resource globe** (colour by class resource: Fury red-orange, Hatred crimson, Arcane blue). Between them, a bronze bar: **primary attack slot** (LMB-style), **4 skill slots** (keys 1-4 shown, icon = SVG glyph per `skill.icon.glyph` in skill colour on dark bevel; cooldown sweep via conic-gradient + seconds number; dim when insufficient resource; summon count badge from `me.ch`), **dash slot** (Space, cooldown sweep). Above the bar: thin **XP bar** (gold, segmented into 10 ticks like D3; shows Paragon progress after 70 in purple-blue). Tooltip on hover over a skill slot: skill name, rune, description via `describeSkill()`.
* **Buff row** above the bar: active buffs (`me.buffs`) as small square icons with remaining seconds.
* **Top-right minimap**: canvas, round with a bronze ring; draw map tiles from `worldReader.current.map()` (bake once per zone, walkable vs blocked colours by theme), entities: me (gold arrow), players (blue), elites (orange/yellow), boss (red skull), loot legendaries (orange), portals/NPCs (icons). Zone name + channel above it ("Hearthmere · Ch. 1"), clock-style difficulty label. Under it, **rift progress bar** (purple fill, % and phase text "Rift Guardian!" when phase guardian).
* **Top-centre target frame**: when `target` set: name (rarity colour by elite tier), level, affixes, wide HP bar (boss: large ornate bar).
* **Notices**: centre-screen banners (rift, boss, legendary "Legendary Item!" in orange Cinzel, level-up "LEVEL 12" big gold with paragon variant), fade 2.5 s; stack ≤ 3.
* **Pickup log** (bottom-left above chat): lines "+1,234 Gold", "Royal Ruby", item names in rarity colour, fade after 6 s.
* **Chat** (bottom-left): last 8 lines, faded when idle; Enter opens input (sets `chatOpen`), Enter sends via `sendChat`, Esc closes; class-coloured names; system lines gold.
* **AFK report modal** (`afk`): "While you were away (3h 12m)": kills, XP, levels gained, gold, materials, "Claim" button closes.
* **Interact prompt**: when `interact` set: "E — Open the Ancients' Cube" floating near bottom centre.
* **Top-left**: portrait frame (class icon), name, level / paragon, DPS meter (`dps`), FPS/ping small.
* **Death screen**: when `me.dead > 0`: dark red vignette + "YOU HAVE DIED" + respawn countdown.
* **Help panel** (F1): keybinds list.

### 4.2 PANELS agent — `ui/panels/*`, `ui/styles/panels.css`, exports `PanelsRoot` and `ItemTooltip` from `ui/panels/index.tsx`
* **Item tooltip** — Diablo 3 anatomy with TBH flair: header plate tinted by rarity (legendary: orange-brown gradient header with ornament; set: green; rare: yellow-brown; magic: blue; normal: grey), item **name** (Cinzel, rarity colour, centred) with **+N upgrade badge** when upgraded and "ANCIENT"/"PRIMAL ANCIENT" label + border colour; item icon top-left in a rarity-framed square; type line ("Legendary Two-Handed Axe" in rarity colour, slot right-aligned); **big number** (weapon: DPS in large white Lilita One, "Damage Per Second", then "min–max Damage" and "x.xx Attacks per Second"; armor: armor value "Armor"); "Primary" section with bullet affixes in affix blue (`affixLabel`), enchanted affix in lilac with a ✦ marker; "Secondary" section; **legendary power** in orange italic with an orange diamond bullet; sockets (empty socket graphic or gem name + effect); **set block**: set name in green, piece list (owned green / missing grey), bonuses (active green / inactive grey); flavor text in muted orange italic; footer: required level, item level, "Account Bound" if bound, Cube upgrade tier + chance info when relevant. **Comparison**: when hovering an inventory item, show the equipped item(s) for that slot side-by-side (label "Equipped") and a D3 delta header on the hovered item: Damage / Toughness / Recovery % with green ▲ / red ▼ (`compareItem()`). Alt held → show affix ranges `[min – max]`.
* **Inventory + Paperdoll** (I or B): D3 layout — paperdoll on top (slots arranged around a silhouette: head top-centre, shoulders left, amulet right, chest centre, hands left, wrists right, waist centre, legs centre, feet centre-bottom, rings left/right, mainhand bottom-left, offhand bottom-right; empty slots show faint slot glyph), character stats summary (Damage, Toughness, Recovery, main stat, life, CHC, CHD, IAS, CDR, area), gold and materials row (scrap/dust/crystal/soul/death's breath icons with counts), then a **10×6 grid** of square cells (items show icon from `itemIconUrl`, rarity-coloured inner border, ancient = orange border, primal = red border, upgrade badge). Right-click equips (`equip`); drag to paperdoll equips; drag between cells `swapInv`; right-click on paperdoll unequips; Shift+right-click salvages if Cube level allows; "Salvage All" menu (normal/magic/rare checkboxes). Gems tab listing `save.gems`.
* **Skills panel** (K): left list of class skills (locked ones show unlock level); selecting shows its 3 runes (unlock levels, descriptions; click to choose, current highlighted) and 3 upgrade tiers (TBH style: three stacked nodes connected by a line, cost in skill points, buy button, purchased tiers glow); top shows the 4 active slots (+ primary) — click a slot then a skill to assign; skill points counter; "Reset tiers" button.
* **Paragon panel** (P): D3 Paragon 2.0 — four tabs (Core, Offense, Defense, Utility) with available points per tab; each stat row: name, current bonus, +/− buttons, (+10 with shift), cap indicator; paragon level & XP bar; reset button.
* **Cube panel** (U, or E at the cube): TBH Hero-dric style — cube level + XP bar on top; function tabs (locked ones show the unlock level and greyed tab); an item drop slot (click an inventory item or drag one in) and a recipe area per function showing costs (gold + material icons, red if unaffordable), success chance for Empower with Fortune, previews (e.g. Empower +6% → shows next values), result animation (cube glow + success/fail text). Enchant: choose affix → `enchantRoll` → three options cards (keep original / option 1 / option 2) → `enchantPick`. Extract: learned powers list + three Kanai slots (weapon/armor/jewelry) with selects. Gem fusion: gem list with "Fuse 3 → 1".
* **Waypoint dialog** (E at waypoint): list zones (Hearthmere, Whispering Glade, Ashen Hollow) with channel populations from `world`, travel button.
* **Rift obelisk dialog** (E at obelisk): difficulty selector (Normal … Torment X, locked by level), reward bonuses (+XP%, +gold%), "Open Rift" and "Enter Open Rift" buttons.
* **Debug panel** (F2): buttons for each `debug` op (level +10, paragon +50, gold, mats, legendaries, full set, spawn goblin, spawn elite, heal) — labelled "Prototype tools".
* Panels: ornate `.frame` with title plate, close ✕, draggable header optional; open/close via store `panels`. Esc closes all. Keyboard shortcuts are registered by main.ts (do not add global key handlers in panels except within inputs).

---

## 5. Client glue (lead)
`main.ts` boots fonts, Pixi (`Application.init({ preference: 'webgl', antialias: true, resolution: devicePixelRatio })`), the UI, the class select, then connects. `game/world.ts` stores entities and interpolates (render time = server time − 110 ms). `game/prediction.ts` runs `stepMove` for the local player per 50 ms input command, reconciles on `ack`. `render/scene.ts` owns layers: ground → decals → groundFx → entities (y-sorted, with sorted props) → aboveFx → text; camera follows the player with slight lead and smoothing; zoom fits ~1150 world units of height on screen.
