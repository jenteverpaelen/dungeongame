# Gear visuals V2 — references (logged before design, 2026-10-11)

Owner request (2026-10-11): the abstract gear tiers are disliked; the look should change with the item type you equip;
weapons must look far more incredible as item level and rarity rise; early → endgame difference is too small ("all to
brave" ≈ Dutch *braaf*: tame). Only **structure** is borrowed below: no assets, names, shapes, colours or distinctive
designs of any game. Labels: **[S]** read on the page (URL), **[SN]** search snippet only, **[K]** prior knowledge not
re-verified, **[M]** measured in this repo. Pass-1 references (`REFERENCES.md` R1–R13) still apply where cited.
Caveat on [S]: pages were read through a fetch tool that returns a summary of the page text, so "no statement found"
means the text sources are silent, not that the effect does not exist.

## 1. What other games do

### MapleStory (2D, small sprites)
| # | Observation | Label / source |
|---|---|---|
| M1 | Weapons come as a dense level grid: one-handed swords alone have named models at ~40 item levels (15, 20, 25 … 150 Fafnir, 160 AbsoLab, 200 Arcane Umbra). A new *named* weapon every ~5–10 levels; visual families change by level band. | [S] ayumilove.net/maplestory-sword |
| M2 | Same-level variants exist (level 80: Khan, Legendary Khan, Balrog's Khan, Renegades Khan). That they are recolours / ornament variants of one silhouette is [K]. | [S] names; [K] look |
| M3 | Endgame gear comes as level-banded class sets that include the weapon (AbsoLab Lv160, Arcane Umbra Lv200 with 7 pieces incl. weapon, Eternal Lv250 with the Genesis/Destiny weapon). Genesis weapons have stages Sealed → 1st → 2nd Awakening (wiki speaks only of stats/quests). | [S] maplestorywiki.net Arcane_Umbra_Set, AbsoLab_Set, Eternal_Set, Genesis_Weapon |
| M4 | Star Force (enhancement) shows in the **UI**: glittering stars on the tooltip at 23+ stars, a full-screen animation on success at 24+; no on-sprite aura found. Star caps are banded by equipment level (0–94: 5, 95–107: 8, …, 138+: 30). | [S] maplestorywiki.net Star_Force_Enhancement |
| M5 | Rarity (Potential grade) is shown by **UI outline colour** (Rare blue, Epic purple, Unique yellow, Legendary green) and dropped gear "pulses with a bright light"; no per-grade on-character glow documented. | [S] maplestorywiki.net Potential |
| M6 | Whether Genesis weapons add a character background effect: only an unanswered forum question. **Not used as a fact.** | [S] forums.maplestory.nexon.net discussion 31964 |

### Final Fantasy XIV (relic weapons)
| # | Observation | Label / source |
|---|---|---|
| F1 | Zodiac relic: 8 stages over item levels 80→135 (base, Zenith, Atma, Animus, Novus, Nexus, Zodiac Braves, Zeta). | [S] ffxiv.consolegameswiki.com Zodiac_Weapons |
| F2 | Glow per stage (player posts): base none → Zenith glow → Atma new model, glow removed → Animus/Novus/Nexus glow again, more vibrant → Zodiac new model → Zeta "the most intense glow". | [S] forum.square-enix.com thread 235170 |
| F3 | Anima relic alternates **model change** and **glow/effect bump**: Awoken (base model, glow) → Anima (new model) → Hyperconductive (glow + special effects) → Reconditioned (new model) → Sharpened ("glowier") → Complete (new model with built-in light show) → Lux (same model, "very showy" effects). | [S] ffxiv.consolegameswiki.com Anima_Weapons |

### World of Warcraft
| # | Observation | Label / source |
|---|---|---|
| W1 | Raid tier sets ship 4 difficulty variants with different palettes; special effects (lightning, Light, Void, flowing water on shoulders) are mostly reserved for **Mythic**; the lowest difficulty has few effects. | [S] siliconera.com all-wow-the-war-within-tier-sets |
| W2 | Thunderfury and Shadowmourne: unique models, no recolours, constant lightning / cold glow + soul-gathering visual. Shadowmourne's quest precursor Shadow's Edge is "an almost identical model" **without** the legendary effects. | [S] wow.gg thunderfury / shadowmourne transmog guides |
| W3 | Weapon enchants add glow and lightning visuals (Mongoose got them in 2.1.0); ~90 cosmetic "illusions" apply such effects to any weapon. | [S] warcraft.wiki.gg Enchant_Weapon_-_Mongoose, Illusion |
| W4 | Legion artifact weapons: several looks per artifact, each with 3 extra tints; hidden looks from rare feats. | [S] warcraft.wiki.gg Artifact_weapon |

### Guild Wars 2
| # | Observation | Label / source |
|---|---|---|
| G1 | A legendary weapon is a **bundle**: draw/stow sounds, footprints (charred, with sparks), lightning aura while drawn, weapon trails replaced by lightning trails, kill animation, ranged skills throw the sword as the projectile (Bolt). | [S] wiki.guildwars2.com Bolt |
| G2 | ArenaNet on the 3rd generation: 16 weapon types × 6 versions = 96 appearances, "dozens of individual effects" per set; "we're making legendary weapons, after all, not legendary particles!" — effects must show off the weapon, not hide it. | [S] guildwars2.com news "A closer look at … legendary weapons" |
| G3 | Exotic vs ascended: no visual difference; appearance comes from the skin. Legendary skins swap freely. | [S] wiki.guildwars2.com Ascended_equipment, Legendary_weapon |
| G4 | (pass 1, R7) Legendary trinkets share an aura that escalates with the number worn. | [V in pass 1] wiki.guildwars2.com Legendary_trinket |

### Enhancement glow (Korean MMO convention)
| # | Observation | Label / source |
|---|---|---|
| K1 | Lost Ark: weapon glow starts at honing +10 and changes colour at +15 and/or +20 (guides disagree on the exact breakpoints). | [S] prodigygamers.com 2022-02-24 lost-ark weapon glow; gameinfinitus.com lost-ark-weapon-glow |
| K2 | Lost Ark Tier 4: glows unlocked by honing can be chosen freely afterwards (glow library), locked ones previewed. | [S] maxroll.gg KR dev letter tier 4 season 3 |
| K3 | Black Desert Sovereign "Primordial Light": none at +0..TET, level 1 at PEN..SEP, level 2 at OCT..DEC, hideable. | [V in pass 1, R4] |
| K4 | Lineage 2 "+4 dim aura growing more visible": single low-reliability forum comment. **Not used.** | [SN] |

### Monster Hunter, Terraria, others
| # | Observation | Label / source |
|---|---|---|
| H1 | Upgrading a weapon changes "what the weapon looks like and which monster or general theme it is based off of". | [S] gamerguides.com monster-hunter-generations equipment |
| H2 | Weapon trees with roman-numeral steps inside named lines (Hope Blade I–V, Bone Blade I–IV; Great Sword has 13 named trees in Wilds); family motifs are reused across a monster's gear (Malzeno's three-pronged tail). | [S] monsterhunterwiki.org MHWilds/Great_Sword_Trees; [SN] gonintendo Malzeno interview |
| T1 | Terraria size modifiers on swung weapons: Tiny −18 %, Large +12 %, Massive +18 %, Legendary +10 %. | [S] terraria.wiki.gg Modifiers |
| T2 | Terra Blade (late weapon): a swing aura reaching beyond the blade and a slash projectile; fully bright in the dark. | [S] terraria.wiki.gg Terra_Blade |
| T3 | Rarity as a colour scale tied to progression stage (−1…11). | [S] terraria.wiki.gg Rarity |
| X1 | Minecraft: one uniform animated glint on any enchanted item. | [S] minecraft.wiki Enchanting |
| X2 | Path of Exile: several base types share one 2D art; uniques get their own art; rarity by text colour. | [SN] poewiki.net Lion_Sword; poe2wiki.net Unique_item |
| X3 | Genshin rarity art (5-star more elaborate, floating parts): **no source found, not used.** | [K] |

## 2. Measured here (before V2)
| # | Measurement | Label |
|---|---|---|
| B1 | Before board (`shots-v2/before-icons.jpg`, `before-hero-*.jpg`): a level-1 normal sword and a level-70 rare sword share one silhouette and one size; the difference is trim colour, a rune line and an abstract corner frame. Same for every weapon base. | [M] |
| B2 | Weapon drawing lengths (hand-local units): sword 31, greatsword 48, axe 27, great axe 50, staff 50, wand 20, bow 44 (±22), crossbow 32, hand crossbow 19. At the default game camera (1080/620 × 0.75 ≈ 1.306 px/unit) a sword is ~40 px next to a ~90–100 px hero. | [M] code + choreo.ts reach |
| B3 | Old weapon size ladder: 1 + 0.024 × tier → ×1.22 at the top; icons are bounds-normalised to 88 % of the cell, so icon size never changes. | [M] gearDecor.ts `weaponScale`, icons.ts |
| B4 | Before board, hero scale: the only large change on the hero comes from **wings**, which any single Primal item triggers (`backPieceFor`), not from the weapon. | [M] |
| B5 | Content coming: 80 bases (+11 weapons/off-hands), ~120 legendaries, 15 Sets (`docs/rework/depth/ITEMS-SHARED.md` §3, §6). Old packed form had 4 bits for Sets (max 15) and 5 bits for legendaries (max 31). | [M] |

## 3. Principles extracted (→ DESIGN-V2.md)
| P | Principle | Evidence |
|---|---|---|
| V1 | **The base item sets the look; level bands set the generation.** A new named silhouette per level band, small steps inside a family, big steps between bands. | M1, M3, H1, H2, F1 |
| V2 | **Two-beat rhythm: model change, then light bump.** Silhouette changes every other step; the step in between raises glow/effects; the top step gets both. | F2, F3 |
| V3 | **Light is the expensive axis, spent at the top.** Early gear has none; effects are reserved for the highest variant (Mythic, Zeta/Lux, legendary). | W1, F2, F3, G1 |
| V4 | **Legendaries are bundles, not tints**: unique silhouette + persistent aura + trail swap + footfalls (+ sound, projectile). The effect layer is what separates a legendary from its near-twin. | G1, G2, W2 |
| V5 | **Enhancement = sparse glow thresholds**, each readable (2–3 steps). | K1, K3, X1, M4 |
| V6 | **Rarity colour lives in the UI** (outline / text / beam), consistent everywhere; the art carries it as the colour of the light. | M5, T3, X2, R2, R11 |
| V7 | **Size is a bounded lever** (Terraria ±18 %); prestige in small sprites is carried by attack effects (swing aura, trails). | T1, T2, G1 |
| V8 | **Effects show off the weapon, never hide it.** | G2, R7, R13 |
| V9 | **Scale by composition**: few base types × versions × effects (96 GW2 looks from 16 types; WoW 4 looks × 4 tints; PoE shared base art + unique art). | G2, W4, X2 |
| V10 | **Item-tied prestige effects**: footfalls / aura come from a specific item (legendary weapon, legendary trinkets escalating with count, Mythic set), not from an account-wide rank. | G1, G4, W1 |
| V11 | **Remove the abstract ladder from the UI**: rarity colour + enhancement (+N / stars) are what the reference games show on the item card; no game found shows a separate "tier" name. | M4, M5, X2 |

## 4. Pass 2.1 (hold pose, attack presentation; logged before the rig changes)
| # | Observation | Label / source |
|---|---|---|
| A1 | MapleStory Classic's item pages list the **basic attack visuals by weapon category** (swings, thrusts, crouched variants) and note that presentations are shared across the weapons of a category: one hold / attack set per family, the item only changes the drawing. | [S] meowdb.com/msclassic/item-db/1662 (page summary) |
| A2 | MapleStory keeps its idle frames per weapon stance (`stand1` one-handed, `stand2` two-handed). Frame names not re-verified. | [K] |
| A3 | A held prop reads at small sprite sizes when part of it breaks the body silhouette; a prop drawn inside the silhouette depends on contrast alone, one behind the body is lost. Common sprite-art guidance, no single source. | [K] |
| A4 | ARPGs colour attacks by **damage element** (fire orange, cold blue, lightning violet / white, poison green); the weapon's own colour shows on physical attacks and on the effect layer around them. Diablo III / Path of Exile convention. | [K] |
| A5 | Prestige weapons change the attack itself: Terra Blade's swing aura and slash beyond the blade (T2), GW2 legendaries replace the weapon trail (G1); effects must show off the weapon, not hide the target (G2, V8). | [S] via T2, G1, G2 |
| A6 | After the first pass-2.1 hold (readable direction only), G0 at side 65° (the commonest facing): the light weapons still rested over the torso — wand box 100 % inside the torso box, hand crossbow 92 %, sword 56 %; the bow (left hand, far side) was behind the torso. Hero torso box 31–40 units wide; screen x ≈ 0.91·x − 0.42·z at yaw 65. | [M] `?view=weapon-pose`, `window.__pose` |
