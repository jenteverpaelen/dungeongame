# Shared content — conventions, power templates, shared legendaries, bases, affixes, gear motifs (M1)

Read with `WARRIOR.md`, `RANGER.md`, `MAGE.md` and `BUDGET.md`. Labels: **[M]** measured in this repo, **[P]** proposal,
**[S]/[SN]/[K]** reference evidence as defined in `REFERENCES.md`, **[NEW-BEHAVIOUR]** needs new server code.

## 0. Shared conventions [P]

| Topic | Today [M] | Proposal [P] |
|---|---|---|
| Runes per skill | 3, unlock at skill unlock + 2 / 5 / 9 (`RUNE_UNLOCK_OFFSETS`) | 5, unlock at + 2 / 5 / 9 / **14 / 20**, clamped to 70 (new L50 skills: 52/55/59/64/70) |
| Skill unlocks | 1, 2, 4, 6, 9, 12 | + **16, 20, 26, 32, 40, 50** (plan §3.2) |
| Categories | none (`SkillKind` only) | a display `category` per skill (5 per class, listed in each class doc), as D3's class pages group skills (`REFERENCES.md` §1) |
| Second primary | one primary per class; `save.skills.primary` already selectable | each class gets a second primary at L16 (Tolling Blow, Skipstone Bolt, Rime Needles) |
| Upgrade tiers | 3 purchasable tiers per skill (2/4/6 points), 69 points by L70, all six skills cost 72 | kept unchanged |
| Specialization nodes | none | 6 nodes per skill, ranks 1–3; N1–N3 open, N4/N5/N6 need 2 ranks in N1/N2/N3; **max 10 of 18 ranks per skill**; ≤1 plain-number node per skill |
| Node points | — | **separate specialization points: 1 per level from L10 (61 at L70)** — enough for ~6 trees at the cap, so a 5-skill loadout plus one swap is fully specialized; free respec like tiers [M: tier reset is free]. Alternatives and why not: sharing the 69 tier points starves both systems (110 points wanted for a 5-skill loadout); Last Epoch's per-skill XP needs a new progression system (`REFERENCES.md` §3). Owner decision. |
| Passives | 6 per class, 4 slots at 10/20/30/70 | 14 per class (8 new rules-changing passives at 14/18/24/28/36/45/55/64), slots unchanged |

## 1. Power template kinds (for the engineers' template library)

Every legendary power, set bonus and rules-changing passive in these documents is written as one or more of the
templates below. "Bucket" is where the number lands in `server/src/sim/damage.ts baseMult()` [M]:
`coef × (1+main) × (1+skillPct) × (1+ele) × (1+generic) × own(mult) × vulnerability × crit`.

| Template | What it does | Bucket / mechanism [M] | Existing examples [M] | Magnitude band [P] |
|---|---|---|---|---|
| `skillDamage` | +v% increased damage to named skill(s) | additive skill bucket (`skillPct`, with runes, tiers, gear "+x% skill damage") | Faultcleaver, Bloodwake, Lanternroot, Cindervane, Thunderhead (150–200) | weapon signature 150–200; primary / off-hand signature 100–150 (Thousand Missiles anchor); Bulwark of the Last Light 200–250 stays |
| `skillMods` | any `SkillMods` field (radius, cost, cooldown, duration, projectiles, pierce, maxSummons) with one rolled field | merged into the skill's mods (`mergeMods`) | Rainspindle (cooldown 30–40 + radius 40), Starfall Mantle (cost 30–40), Sapper's Pack (+2 Sentries) | cost/cooldown 15–40%; counts +1–2 |
| `skillFlag` | grants a behaviour flag (a rune effect or a new behaviour) | `flags` | Ninefold Gale (`dustDevils`), Bulwark (`pull`) | — |
| `skillMore` **(new)** | ×(1+v%) on named skill(s), optionally while a condition holds or per stack | own bucket (`Strike.mult`, the same product set bonuses use) | none today — the reason a legendary kit could not stack like a set | 25–40% conditional, 6–8% per stack (max 5), 15–30% per compounding pierce/skip |
| `vulnerability` | enemies in a condition take +v% from you | `vulnerability()` product (`stunMult`, `markPct`, `holePct`) | Anvil Vambraces 25–30, Heart of the Void 20–25, Hunter's Mark 15–20 | 15–30% |
| `buff` / `buffOnEvent` | gain a buff (generic damage, attack speed, crit) on an event or while a state holds | generic bucket (`p.live.dmg`) / `live.ias` / `live.chc` | Hellforge Talisman (elite kill, 30–40), Stridewind (dash, 40–50) | generic 10–30% with an uptime condition |
| `stat` | flat character stat | `computeStats` | Witching Cord (chd 45–50 + 7% ias), Fists of the Mountain (area 40–50 + 15% ias) | as affix maxima |
| `element` / `conversion` | element swap or +v% to one element | `ele` bucket / `mods.element` | Thunderhead (Lightning), Ouroboros Loop (rotating element, own multiplier 150–200) | element +30–40% while a state holds |
| `proc` | on event, cast a strike, summon or ground | new: generic proc hook | Rupture-style death hooks exist for runes (`skillDeathHooks`) | proc damage 40–80% weapon damage, internal cooldown |
| `resource` / `cooldown` | resource refunds, cost cuts, cooldown refunds | `gainResource`, `readyAt` | Seal of the Patient Thief (0.75–1 s per spend) | per-event 0.05–0.5 s; refunds 3–5 resource |
| `noSet` **(new)** | bonus that applies only while no set bonus is active | generic bucket | none (D3's no-set ring set and gem are the pattern, `REFERENCES.md` §4) | 2–3% per equipped legendary, max 10 |
| `defensive` | damage reduction / control immunity | damage-taken multiplier (`stormDR`, `gyre` pattern) | Girdle of the Eternal Gyre (20% while whirling) | 15–30% DR while a state holds |

One generic **conditional multiplier** (a predicate on the target — stunned, frozen, chilled, bleeding, immobilised, in a
Black Hole, farther than N, above X% Life — or on the player — in own ground, standing still, buff active) serves the
`skillMore`, `vulnerability` and set 6-piece templates; building it once removes most per-item [NEW-BEHAVIOUR] work.

**Cube** [M]: up to three extracted powers, one per `CubeSlot` (weapon = main-hand weapons; armor = every armour slot,
belt, bracers and off-hands; jewelry = amulet and rings); an extracted power rolls at the range maximum and does not stack
with the same power equipped. Ancient status multiplies affixes and weapon damage by 1.3 but **not** legendary power values
(`shared/src/items.ts`), so parity does not depend on Ancients.

## 2. Shared legendaries (6 existing + 12 new)

Existing [M]: Ouroboros Loop (ring), Seal of the Patient Thief (ring), Hellforge Talisman (amulet), Witching Cord (sash),
Stridewind Greaves (boots), Fists of the Mountain (gauntlets). The new twelve fill every armour slot so a legendary-only
kit always has something worth wearing where a set would go (the slot rule in `BUDGET.md` §3), and their magnitudes were
cut in the parity model because generic-bucket powers stack undiluted (`BUDGET.md` §6).

| Legendary | Base (slot) | Power (`{v}` = rolled) | Range | Template | Cube | Who wants it |
|---|---|---|---|---|---|---|
| **Patchwork Signet** | Ring | While no set bonus is active, each equipped legendary item increases your damage by {v}% (max 10 items) and reduces damage taken by 1%. | 2–3 | noSet | jewelry | every legendary-only kit (Hatchetwind, Skipshot, Orrery) |
| **Watchkeeper's Hood** | Hood (head) | Elite enemies within 500 units are outlined and take {v}% increased damage from you. | 15–20 | vulnerability (elites) | armor | bossing, all classes |
| **Kilnwatch Spaulders** | Plate Spaulders (shoulders) | Casting a skill with a cooldown grants {v}% increased damage for 5 s. | 15–20 | buffOnEvent | armor | cooldown builds (Faultline, Stormwatch, Hoarfrost) |
| **Hearthguard Coat** | Hauberk (chest) | While above 80% Life you deal {v}% increased damage and take 10% less damage. | 15–20 | buff (state) | armor | all; note the harness runs immortal bots (`BUDGET.md` §7) |
| **Ink-Stained Gloves** | Gloves (hands) | Your primary attack deals {v}% increased damage; every 4th primary attack repeats once. | 75–100 | skillDamage + proc | armor | primary-heavy builds (Warcaller, Farwatch, Glass Concord) |
| **Causeway Waders** | Waders (legs, new base) | After standing still for 1 s you deal {v}% increased damage until you have moved for 1 s. | 20–25 | buff (state) | armor | turret / ranged play |
| **Ridgewalker Boots** | Boots (feet) | Every 100 units moved gives a stack (max 5) of {v}% increased damage; stacks fall off after 2 s standing still. | 4–5 per stack | buff (stacking) | armor | melee and kiting play |
| **Surveyor's Plumb** | Amulet | Enemies above 75% Life take {v}% increased damage from you. | 25–35 | vulnerability (opener) | jewelry | all |
| **Brine Tally** | Ring | Killing 20 enemies within 10 s grants {v}% attack speed and cooldown recovery for 10 s. | 15–20 | buffOnEvent | jewelry | pack clearing |
| **Signal Horn Charm** | Amulet | Your summons (Sentries, Mortars, Snares, Hydras, Cinderkin, Companions, Dust Devils) deal {v}% more damage. | 25–35 | skillMore (summons) | jewelry | Siege, Packmaster, Trapper, Lantern Garden |
| **Lockglass Cincture** | Belt (waist) | Channelled skills (Whirlwind, Ironplough, Thrumming Ray) cost {v}% less and you cannot be knocked back while channeling. | 20–30 | resource + defensive | armor | Gyre, Ploughline, Hollowstar |
| **Wardkeeper's Cuffs** | Bracers (wrists) | Enemies you stun, freeze, immobilise or knock back take {v}% increased damage from you for 3 s. | 15–20 | vulnerability (controlled) | armor | control builds (Faultline, Trapper, Hoarfrost) |

Flavour: Patchwork Signet "Mended so often there is nothing original left." · Watchkeeper's Hood "Venn never takes it
off. Never." · Kilnwatch Spaulders "Warm on the coldest watch." · Hearthguard Coat "It smells of bread and smoke." ·
Ink-Stained Gloves "Orren counts people. These count blows." · Causeway Waders "Sera lent them out once." · Ridgewalker
Boots "Tallis wore through three pairs." · Surveyor's Plumb "Iven trusts it more than the ground." · Brine Tally "Neris
notches it every evening." · Signal Horn Charm "Small enough to forget, loud enough to remember." · Lockglass Cincture
"Aven says it holds still on purpose." · Wardkeeper's Cuffs "Mera's keys, melted down."

## 3. New item bases (42 → 80)

Today [M]: head 6, shoulders 4, chest 5, hands 3, wrists 1, waist 2, legs 3, feet 3, amulet 1, ring 1, 1H 5, 2H 5,
off-hand 3 = 42. Target: every slot ≥3 shapes overall and every class ≥2 weapon shapes per hand; +38 bases = 80. Armour
names use the existing `armorNames(noun)` ladder (Worn → Sturdy → Reinforced → Masterwork → Runic → Starforged) so the art
and names agree with the gear ladder (`docs/rework/gear/DESIGN.md` §1.1) [M]. `armorMult` and weapon stats sit between the
existing neighbours of the same material [P].

### 3.1 Armour (+21)
| id | kind | noun (→ ladder) | armorMult | material | affinity | sockets | shape idea for the parametric art |
|---|---|---|---|---|---|---|---|
| `head_coif` | head | Coif | 0.7 | mail | warrior, ranger | 1 | mail hood that falls to the shoulders, open face |
| `head_mask` | head | Mask | 0.55 | leather | ranger | 1 | half-face leather mask with eye slits, strap behind |
| `head_widebrim` | head | Wide-Brim Hat | 0.5 | cloth | ranger, mage | 1 | broad flat brim, low crown, band (Iven's hat) |
| `shoulders_furmantle` | shoulders | Fur Mantle | 0.6 | leather | ranger, warrior | 0 | thick fur ruff over both shoulders, clasp at the throat |
| `shoulders_capelet` | shoulders | Capelet | 0.5 | cloth | mage | 0 | short layered cloth cape ending at the elbows |
| `chest_brigandine` | chest | Brigandine | 0.95 | leather | ranger, warrior | 3 | cloth-covered coat with visible rivet rows |
| `chest_vestment` | chest | Vestment | 0.72 | cloth | mage | 3 | layered long tabard over a robe, embroidered hem |
| `chest_apron` | chest | Smith's Apron | 0.85 | leather | warrior | 3 | heavy apron over a bare-armed tunic, tool loops (frontier smith) |
| `hands_mitts` | hands | Mitts | 0.45 | cloth | mage | 0 | padded mittens with a separate thumb |
| `hands_fingerless` | hands | Fingerless Gloves | 0.5 | leather | ranger | 0 | gloves cut at the knuckles, wrist strap |
| `wrists_cuffs` | wrists | Cuffs | 0.4 | cloth | mage | 0 | wide cloth cuffs with stitched runes |
| `wrists_vambraces` | wrists | Vambraces | 0.55 | plate | warrior | 0 | hinged forearm plates with a raised ridge |
| `wrists_wraps` | wrists | Arm Wraps | 0.42 | leather | ranger | 0 | cord-bound leather strips with a bracer pad |
| `waist_girdle` | waist | Girdle | 0.55 | plate | warrior | 0 | wide plated belt with a central boss |
| `waist_cord` | waist | Charm Cord | 0.38 | cloth | mage, ranger | 0 | knotted rope with hanging charms |
| `legs_chaps` | legs | Chaps | 0.8 | leather | ranger | 2 | open-sided leather chaps over trousers |
| `legs_tassets` | legs | Tassets | 0.95 | mail | warrior | 2 | mail skirt with plate lames at the hip |
| `legs_waders` | legs | Waders | 0.78 | leather | ranger, mage | 2 | high boots-and-trousers in one, tar-dark (causeway waders) |
| `feet_wraps` | feet | Foot Wraps | 0.4 | cloth | mage | 0 | bound cloth wrappings, bare toes |
| `feet_sandals` | feet | Sandals | 0.42 | leather | ranger, mage | 0 | thick-soled sandals with ankle cords |
| `feet_clogs` | feet | Iron-Shod Clogs | 0.6 | metal | warrior | 0 | wooden clogs with iron bands (kiln and mill workers) |

### 3.2 Jewelry (+6)
| id | kind | noun | names by tier (0–5) | shape idea |
|---|---|---|---|---|
| `neck_torc` | neck | Torc | Torc, Twisted Torc, Banded Torc, Gilded Torc, Runic Torc, Starforged Torc | open rigid neck ring with knobbed ends |
| `neck_charm` | neck | Charm | Charm, Carved Charm, Bone Charm, Warding Charm, Runic Charm, Starforged Charm | cord with one carved token |
| `neck_locket` | neck | Locket | Locket, Brass Locket, Silver Locket, Engraved Locket, Runic Locket, Starforged Locket | hinged oval case on a chain |
| `ring_band` | ring | Band | Plain Band, Wide Band, Banded Ring, Etched Band, Runic Band, Starforged Band | wide flat band, no stone |
| `ring_signet` | ring | Signet | Seal, Signet, Crest Ring, House Signet, Runic Signet, Starforged Signet | flat-faced seal ring |
| `ring_coil` | ring | Coil | Wire Coil, Copper Coil, Spiral, Double Coil, Runic Coil, Starforged Coil | spiral wire wrapped twice |

The existing `ring` ladder already uses "Band" and "Signet" as tier names [M]; the new bases take those as their *nouns*,
so rename the old ladder's tiers 1 and 2 to "Loop" and "Circle" [P] to avoid two bases sharing a name.

### 3.3 Weapons and off-hands (+11)
| id | kind | class | names by tier (0–5) | aps / dmgMult | anchor | shape idea |
|---|---|---|---|---|---|---|
| `cleaver` | 1H | warrior | Chopper, Cleaver, Butcher's Blade, Broad Cleaver, Runic Cleaver, Starforged Cleaver | 1.25 / 1.1 | between axe (1.3/1.06) and mace (1.2/1.14) | wide rectangular blade, short haft |
| `maul2h` | 2H | warrior | Mallet, Maul, Great Maul, Kiln Hammer, Runic Maul, Starforged Maul | 1.0 / 1.8 | slower and heavier than the great axe (1.1/1.7) | long haft, brick-shaped head (Kilnmaw) |
| `polearm` | 2H | warrior | Pike, Bill, Glaive, Halberd, Runic Glaive, Starforged Halberd | 1.1 / 1.65 | between greatsword (1.15/1.6) and great axe | long haft, hooked blade |
| `sling` | 1H | ranger | Sling, Leather Sling, Shot Sling, Staff-Sling, Runic Sling, Starforged Sling | 1.5 / 0.85 | between hand crossbow (1.6/0.9) and nothing slower: the skip-stone weapon | cord and pouch, stone in the cup |
| `longbow` | 2H | ranger | Self Bow, Long Bow, War Bow, Yew Longbow, Runic Longbow, Starforged Longbow | 1.2 / 1.45 | between bow (1.4/1.25) and crossbow (1.1/1.6) | tall straight stave, taller than the hero |
| `rod` | 1H | mage | Rod, Iron Rod, Etched Rod, Lodestone Rod, Runic Rod, Starforged Rod | 1.2 / 1.15 | heavier than the wand (1.4/1.0) | short straight metal rod with a knob |
| `sceptre` | 1H | mage | Baton, Sceptre, Crowned Sceptre, Orb Sceptre, Runic Sceptre, Starforged Sceptre | 1.3 / 1.08 | between rod and wand | rod with a small cage head |
| `censer` | 2H | mage | Censer, Chain Censer, Ember Censer, Lantern Censer, Runic Censer, Starforged Censer | 1.1 / 1.65 | slightly faster, lighter than the staff (1.0/1.75) | lantern on a chain from a short pole (Lantern Garden fits it) |
| `warhorn` | off-hand | warrior | Horn, Cow Horn, War Horn, Brass Horn, Runic Horn, Starforged Horn | armorMult 0.4 | between quiver (0.3) and shield (1.0): no block, a buff off-hand | curved horn on a strap |
| `trap_kit` | off-hand | ranger | Snare Bag, Trap Kit, Hook Pouch, Trapper's Kit, Runic Kit, Starforged Kit | armorMult 0.3 | = quiver; allowed with ranged two-handers like the quiver [M rule] | satchel with hooks and coiled wire |
| `tome` | off-hand | mage | Notebook, Tome, Ledger of Stars, Grimoire, Runic Tome, Starforged Tome | armorMult 0.3 | = orb | thick book on a chain, glowing page edge |

## 4. Slot footprints — the set-versus-legendary slot puzzle

Every set today covers the same six armour slots [M] (head, shoulders, chest, hands, legs, feet), so a set kit always
loses the same legendary slots. Three new sets (Furrowmark, Snarewright, Hollowstar Choir) cover **head, shoulders, chest,
hands, belt, bracers** instead, so their legs and feet stay open for legendaries and their belt/bracer legendaries are
the ones a set wearer gives up. This is the cheapest lever for "a full set shouldn't always mean it can be better" [P]:
which legendaries a set blocks becomes part of the build decision. Rule for authors [P]: each skill's three legendaries
go one to a weapon or off-hand, one to the standard footprint, one to jewelry/belt/bracers (rule R5 in `BUDGET.md` §3).

## 5. New affixes (33 → 55)

Ranges are level-70 values like the existing table and use the same `affixScale` kinds [M]; each is anchored to an existing
affix of the same bucket so a new stat does not out-scale its legendary counterpart [P].

| stat | P/S | Label | Slots: range | scale | group | Anchor |
|---|---|---|---|---|---|---|
| `dotDmg` | P | Damage-over-time effects you apply deal {v}% more damage | neck, wrists, off-hand: 15–20 | pct | `dot` | = element affixes 15–20 |
| `summonDmg` | P | Your summons deal {v}% increased damage | head, shoulders, neck, off-hand: 10–15 | pct | — | = `skillDmg` 10–15 (same additive bucket) |
| `primaryDmg` | P | Your primary attack deals {v}% increased damage | 1H, 2H, hands, ring: 15–20 | pct | — | = `area`-sized slot spread, skill bucket |
| `spenderDmg` | P | Resource-spending skills deal {v}% increased damage | chest, legs, ring: 8–12 | pct | — | below `skillDmg` because it covers several skills |
| `cooldownDmg` | P | Skills with a cooldown deal {v}% increased damage | head, shoulders, neck: 8–12 | pct | — | as above |
| `vsControlled` | P | Damage against stunned, frozen or immobilised enemies increased by {v}% | 1H, 2H, neck: 5–8 | pct | — | = `elite` 5–8 (multiplicative) |
| `areaRadius` | P | Area skills have {v}% larger radius | head, shoulders, off-hand: 6–10 | pct | — | below the lowest radius tier (+25) |
| `channelCost` | P | Channelled skills cost {v}% less | hands, waist, off-hand: 10–15 | pct | — | between `rcr` 4–8 and Lockglass Cincture 20–30 |
| `ccDuration` | P | Your stuns, freezes and immobilises last {v}% longer | hands, wrists, off-hand: 8–12 | pct | — | below Trapper's Instinct 20% |
| `summonDuration` | P | Your summons last {v}% longer | waist, feet: 10–15 | pct | — | below Sentry's 50% tier |
| `buffDuration` | P | Your buffs last {v}% longer | head, neck: 10–15 | pct | — | below Battle Rage's 50% tier |
| `resourceOnKill` | P | +{v} resource per kill | 1H, 2H, head, ring: 2–4 | flat (unscaled) | — | = Red Ledger's per-kill refund 3–5 |
| `pierceChance` | P | Projectiles have {v}% more chance to pierce | ranged 1H/2H, quiver, hands: 8–12 | pct | — | 1/4 of Puncturing Arrow's +50 |
| `meleeDR` | P | Reduces damage from melee attacks by {v}% | shoulders, chest, off-hand: 4–6 | pct | `dr` | below `eliteDR` 5–7 |
| `rangedDR` | P | Reduces damage from ranged attacks by {v}% | shoulders, chest, off-hand: 4–6 | pct | `dr` | as above |
| `dashCdr` | P | Dash cooldown reduced by {v}% | feet: 8–12 | pct | — | 1/5 of Stridewind's 50%; feet have only one primary affix (`ms`) today |
| `ccReduction` | S | Reduces the duration of control effects on you by {v}% | head, shoulders, neck: 10–20 | pct | — | secondary like `pickup` |
| `globeHeal` | S | Health globes heal {v}% more | waist, legs, ring: 15–25 | pct | — | = `goldFind` 15–25 |
| `globeChance` | S | Elites have {v}% more chance to drop a health globe | chest, legs, feet: 10–20 | pct | — | secondary |
| `moveWhileChannel` | S | +{v}% movement speed while channeling | legs, feet: 10–15 | pct | — | = `ms` 10–12 band |
| `lifeOnControl` | S | Stunning, freezing or immobilising an enemy heals {v} Life | hands, wrists: 2,000–3,000 | flat | — | below `lifePerHit` 3,000–4,500 on the same slots |
| `chillOnHit` | S | {v}% chance on hit to chill enemies for 1 s | 1H, 2H, hands: 5–10 | pct | — | small proc chance (D3 had chance-on-hit control affixes before Loot 2.0 [K]) |

`MAGIC_PREFIX`/`MAGIC_SUFFIX` entries [P]: Festering (dotDmg), Shepherd's (summonDmg), Striking (primaryDmg), Spendthrift
(spenderDmg), Patient (cooldownDmg), Pinning (vsControlled), Broad (areaRadius), Humming (channelCost), Binding
(ccDuration), Lingering (summonDuration/buffDuration), Reaping (resourceOnKill), Piercing (pierceChance), Braced (meleeDR),
Sheltered (rangedDR), Quick-footed (dashCdr); suffixes of Composure (ccReduction), of Plenty (globeHeal), of the Larder
(globeChance), of Drifting (moveWhileChannel), of Mercy (lifeOnControl), of Rime (chillOnHit).

## 6. Gear-visual motifs for the new sets and legendaries

The gear system draws motifs from data (`client/src/render/art/gearStyle.ts`: 19 motifs, `SET_STYLE` with main/deep colour
and a signature, `LEGENDARY_MOTIF`) [M]; per `docs/rework/gear/DESIGN.md` §3 a set shows sigil + particles at 2 pieces,
sockets + mantle + orbiters at 4, wings + footprints + idle flourish at 6. New motifs need a generator each [P]:

| Set | Motif | main / deep | Crest + pauldron spikes | Wings / back (6) | Orbiters (4) | Footprints | Particles | Signature line |
|---|---|---|---|---|---|---|---|---|
| Hearthbanner (W) | **banner** (new) | 0xd8b45a / 0x5a1e18 | pennant tails, flag-pole finials | two long banners with a hearth sigil | small pennants | drum-beat dust rings | cloth scraps, sparks | "Muster: twin war-banners, pennant orbit, drumbeat steps" |
| Furrowmark (W) | **furrow** (new) | 0x9aa1a6 / 0x3d2f20 | plough-share blade, iron share points | two curved mouldboard blades with soil spray | clods of earth | furrow lines | soil specks | "Ploughline: mouldboard wings, clod orbit, furrowed steps" |
| Thicket Kin (R) | **antler** (new) | 0xb59a6a / 0x2a3320 | antler tines, leaf-and-antler | antler-branch frame with leaves | leaves | paw prints | leaves and seeds | "Thicket: antler wings, leaf orbit, paw steps" |
| Snarewright (R) | **knot** (new) | 0x8f9a9e / 0x3b3020 | knotted cord loops, hook teeth | net-and-rope fan with hooks | tiny iron jaws | rope-coil prints | hemp fibres | "Snare: rope-net wings, jaw orbit, coil steps" |
| Hoarfrost Vigil (M) | **frost** (exists as a legendary motif) | 0xdff6ff / 0x2c4458 | icicle crown, hanging icicles | frost-feather lattice | snow crystals | frost prints | snowflakes | "Vigil: icicle wings, crystal orbit, frost steps" |
| Hollowstar Choir (M) | **chime** (new) | 0xc8b6ff / 0x231d3d | twin-tine tuning fork, horn cups | concentric sound-ripple rings | chime bars | ripple rings | note-shaped motes | "Choir: ripple wings, chime orbit, ringing steps" |

Redesigned sets keep their motifs (wind, stone, ember, cog, feather, rain, star, shard, lantern) [M]; Rainkeeper's
existing "personal rain cloud" orbiter now matches its 6-piece.

**Legendary → motif** (`LEGENDARY_MOTIF`, parameterised generators, no per-item sprite) [P]:

| Motif | New legendaries |
|---|---|
| wind | Gale-Stitched Legguards, Ridgewalker Boots, Wingbeat Boots |
| stone | Quakestep Sabatons, Fissure-Lined Breastplate, Tremor Signet, Cairnwright's Hammer, Stonecount Gauntlets |
| ember / flame | Ashgrip Gauntlets, Kilnmaw, Slagforged Helm, Coalheart Locket, Powderkeg Crossbow, Fuse-Burnt Boots, Powder Horn, Tar-Stained Jerkin, Mortarman's Pack, Fuse Cord Belt, Kindling Rod, Firekeeper's Gloves, Kilnwatch Spaulders |
| blood | Tanner's Pauldrons, Red Ledger, Grinning Saw, Woodcutter's Grips, Sawyer's Ring |
| gold | Bellwright's Maul, Belfry Pauldrons, Brass Warhorn Helm, Furycord Belt, Seething Sigil, Thresher's Knot, Patchwork Signet, Brine Tally |
| holy | Ward Pennant Shield, Quartermaster's Cuirass, Rally Knot, Hearthguard Coat |
| banner | (set only) |
| furrow | Coulter Blade, Yoke Greaves, Ox-Harness Belt, Millwheel Edge |
| feather | Featherguard Cuffs, Hawkfeather Cap, Huntsman's Pauldrons, Starling Longbow, Roost Charm |
| cog | Bolt-Thrower's Arbalest, Bowyer's Gloves, Bandolier Belt, Tripline Crossbow |
| rain / storm | Squallcatcher Pauldrons, Raincount Ring, Highcloud Longbow, Overcast Hood, Weathervane Ring, Stormglass Prism, Conductor's Legwraps, Static Loop |
| leaf / antler | Kennel-Wood Bow, Trailhide Breeches, Whistle Charm, Spotter's Repeater |
| knot | Snarehand Gloves, Coiled Wire Bracers, Skipping-Stone Quiver, Lockglass Cincture |
| frost | Riverstone Repeater, Skimmer's Leggings, Frostlocked Wand, Winterbound Robe, Rimecourt Band, Hoarneedle Wand, Frostthread Gloves, Snowglobe Pendant, Cistern Staff, Rimewalker Slippers |
| star | Craterheart Amulet, Armillary Staff, Star-Chart Robe, Clockmaker's Ring |
| void | Undertow Staff, Horizon Cowl |
| shard | Glasswright's Wraps, Echoing Bead |
| lantern | Coiled Pauldrons, Lanternkeeper's Sash |
| arcane | Glyphstone Orb, Spellwright's Circlet, Runeweaver Cuffs |
| chime | Resonant Staff, Hornlistener Circlet, Signal Coil, Signal Horn Charm |
| shadow | Watchkeeper's Hood, Surveyor's Plumb, Wardkeeper's Cuffs, Causeway Waders, Ink-Stained Gloves |

Each legendary also needs a `colors` triple (primary, secondary, glow) like the existing 22 [M]; the class agent picks them
from the motif's palette. Names of all new items still need the release naming audit (P11 report: the scoped item naming
pass is not trademark clearance) [M].
