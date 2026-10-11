# Name / IP register — game-wide terms (F-CON-03, 2026-10-11)

Owner (2026-10-11, via lead): no copying of Diablo's tooltip or rank design — "people will get mad at that". This
register covers every **game-wide term** that is a Diablo II/III/IV or Path of Exile signature: difficulty ladder,
Paragon, the Cube, the rift family, binding text, system/UI wording, affix wording, monster, NPC and place names.
Not here (other lanes, no duplication): skill and rune names and the Ancient/Primal quality ladder → bible agent
(`docs/rework/depth/NAMES.md`); tooltip layout → lead (`docs/rework/TOOLTIP.md`).

Rules: display text only — **ids and saves never change** (stable ids are enforced by `scripts/content-ids.lock.json`).
Labels: **[M]** measured (hash match / code scan), **[K]** prior knowledge of the reference game, not re-verified this
session, **[P]** our proposal. "Check" = the proposal has no match in `docs/originality/signature-terms.json` or the
D3 skill/rune label hashes, and I know of no D2/D3/D4/PoE1/PoE2/Torchlight/Grim Dawn/Last Epoch system using it [K];
this is a screening, not legal clearance.

**Gate:** `npm run content:check` now runs `scripts/originality-check.ts`: 61 hashed signature terms (clear list kept out
of the repo, like Codex's D3 label hashes) are compared with 1–3-word n-grams (and simple plurals) of every string
literal and JSX text in shipped source. The 141 current uses wait in `docs/originality/allowlist.json` with a reason;
**any new use fails the check**. When a rename lands the entry becomes "stale" and is pruned with
`npx tsx scripts/originality-check.ts --write-allow`.

## A. Applied now (my lane)

| Old (display) | New | Files | Check |
|---|---|---|---|
| Treasure Goblin (monster) + its three notices | **Hoardling** ("A Hoardling appears!", "Hoardling slain!", "The Hoardling escaped!") | `shared/src/data/monsters.ts`, `server/src/sim/{spawner,kills,monsters}.ts`, `shared/src/targetPriority.ts` (two descriptions), debug label in `client/src/ui/panels/dialogs.tsx` | coinage; no match [M/K] |
| Elite traits Fast / Extra Health / Molten / Frozen / Plagued / Electrified / Vortex / Mortar — D3's exact affix list [K] | **Swift / Hulking / Kilnborn / Rimebound / Festering / Crackling / Undertow / Bombarding** (Faulted unchanged) | `shared/src/data/monsters.ts` (`ELITE_AFFIXES`) | plain adjectives or world compounds (kilns, rime, undertow = lake/harbour) |
| Server messages "Not enough Arcane Dust / Veiled Crystals / Forgotten Souls / Death's Breath / Scrap" — D3's material names [K], although the UI already showed original names | the original material names from `shared/src/materialNames.ts` (Iron Shards, Wisp Powder, Dawn Quartz, Relic Ember, Cinder Essence) | `server/src/commands.ts` | bug fix: one name per material |
| Gallery samples "Death's Breath", "Arcane Dust" | Cinder Essence, Wisp Powder | `client/src/dev/gallery{Vfx,Hud}.ts(x)` | dev only |

## B. Owner picks (taste matters — 2–3 options each, my recommendation first)

| # | Term now | Why it must change | Option 1 (recommended) | Option 2 | Option 3 |
|---|---|---|---|---|---|
| B1 | Difficulty ladder **Normal · Hard · Expert · Master · Torment I–X** (`shared/src/progression.ts`) | D3's exact ladder and names [K]; "Torment" is also D4 [K] | **Story · Normal · Hard · Severe · Ordeal I–X** (plain, reads instantly) | Kindled · Burning · Blazing · Searing · Ashfall I–X (the hearth/fire voice) | Calm · Squall · Gale · Tempest · Deepstorm I–X (lake/harbour weather) |
| B2 | **Paragon** (system, window, hotkey label, "Paragon shrine", "Paragon Level", "Reset Paragon") | D3/D4 system name [K] | **Lantern Ranks** (the last lit hearth: every rank lights a lantern) · shrine → "Lantern shrine" | Wayfarer Ranks · "Wayfarer shrine" | Legacy Ranks · "Legacy shrine" |
| B3 | **The Ancients' Cube** / "Cube" / "Cube Tier" | D3 Kanai's Cube role; "Ancients" is a D3 term [K] | **The Glass Reliquary** / "Reliquary" / "Reliquary tier" (matches the glass-dome rotunda) | The Old Crucible / "Crucible" | The Tinker's Engine / "Engine" |
| B4 | Rift family: **Nephalem Rift**, Rift Guardian, Rift Obelisk, "Rift Progress", "Rift Cleared" | "Nephalem Rift" and "Rift Guardian" are D3 terms [M: hash match] | **Faultline** · Faultline Keeper · Faultstone · "Faultline progress" (ties to Fault Warden, Faultcleaver, the Faulted trait) | Rent · Rentkeeper · Rentstone | Deepway · Deepway Tyrant · Deepway Gate |
| B5 | **Mystic** (enchant/appearance artisan) | the Blacksmith + Jeweler + Mystic trio is D3's artisan line-up [K]; Blacksmith/Jeweler alone are generic | **Glasswright** | Enchanter | Loomkeeper |
| B6 | **Health Globe** (pickup, feed text) | D3 term [M] | **Mending Orb** | Heartbloom | Life Spark |

## C. Old → new table for the lead (other lanes; apply after the foundation and quest merges)

| Area | Old (display) | New [P] | Files (display text only) |
|---|---|---|---|
| Difficulty | B1 pick | — | `shared/src/progression.ts` (`DIFFICULTIES[].name`), `client/src/ui/panels/dialogs.tsx` (two `startsWith('Torment')` checks → test the index ≥ 4 instead of the name) |
| Paragon | B2 pick | — | `shared/src/data/town/build.ts` ("Paragon shrine"), `shared/src/mapgen.ts` ("Paragon Shrine"), `client/src/ui/hud/MenuBar.tsx`, `client/src/ui/hud/SkillBar.tsx`, `client/src/ui/panels/paragon.tsx`, `client/src/ui/panels/dialogs.tsx` (debug "Paragon +50"), `client/src/game/game.ts:336`, `client/src/i18n/en.ts` (`controls.paragon.*` texts), `shared/src/data/characterMessages.ts`, `server/src/commands.ts` (two errors) |
| Paragon structure | Core / Offense / Defense / Utility with Primary Stat, Vitality, Movement Speed, Maximum Resource / Attack Speed, CDR, CHC, CHD / Life, Armor, Resist, Regen / Area, RCR, Life per Hit, Gold Find, points rotating in that order | **design copy of D3 Paragon 2.0** [K], not just a name — owner + foundation should decide a different post-70 system or at least different categories; renaming the four labels alone does not fix it | `shared/src/progression.ts` (`PARAGON_STATS`, `PARAGON_CATEGORIES`, rotation) |
| Cube | B3 pick; "Extract Power" → **Bind Power** (powers are bound into the reliquary) | Transmute Rare, Reforge, Empower, Add Socket, Salvage, Gem Fusion, Enchant are generic crafting words — keep | `shared/src/data/town/build.ts`, `shared/src/townServices.ts` (`ARTISAN_NAMES.cube`), `shared/src/cube.ts` (names; the `source` notes "Kanai's Cube: …" are developer notes but are bundled — reword to "reference: D3 cube recipe" or drop), `client/src/game/game.ts:423`, `client/src/ui/panels/cube.tsx` |
| Rift | B4 pick | — | `shared/src/data/zones.ts` (`rift.name`), `client/src/game/game.ts:278`, `client/src/ui/hud/Minimap.tsx:280`, `server/src/sim/rift.ts` (two notices), `shared/src/data/questMessages.ts:65` (quests lane), `client/src/ui/panels/dialogs.tsx` (obelisk text), `shared/src/data/town/build.ts` ("Rift Obelisk") |
| Artisan | B5 pick | — | `shared/src/townServices.ts`, `shared/src/data/town/build.ts`, cube/artisan panels |
| Pickup | B6 pick | — | `client/src/ui/hud/Feed.tsx:62`, `server/src/sim/loot.ts` (two names) |
| Binding | "Character bound" | **Bound to this hero** | `client/src/ui/panels/tooltip.tsx:322` (lead) |
| Tooltip headings | "PRIMARY" / "SECONDARY" (removed by the lead's rebuild) | "Properties" (single list) | done in 8d1e29b |
| Shrines | Empowered Shrine / Frenzied Shrine — D3's exact shrine names [M]; Keen Shrine (not D3) | **Kindled Altar** (damage) / **Quickening Altar** (attack speed) / **Keen Altar** | `shared/src/zoneKit.ts:171`, `server/src/sim/instance.ts:35-36`, `client/src/ui/hud/SkillBar.tsx:143-144` |
| Legendary | Hellforge Talisman + buff "Hellforge" — D2/D3 place and material [M] | **Kilnheart Talisman** / buff "Kilnheart" | `shared/src/data/items.ts:205`, `client/src/ui/hud/SkillBar.tsx:131` |
| Legendary | Hunter's Mark + buff — WoW hunter ability [M] | **Tracker's Brand** | `shared/src/data/items.ts:196`, `client/src/ui/hud/SkillBar.tsx:135` |
| Legendary | Witching Cord — echoes D3's "Witching Hour" belt [K] | **Hexwound Cord** | `shared/src/data/items.ts` |
| Set | Raiment of the Endless Storm — echoes D3's monk set "Raiment of a Thousand Storms" [K] | **Eyewall Garb** (from its own Eyewall Sabatons) | `shared/src/data/items.ts` |
| Set | Siegebreaker's Arsenal — "Siegebreaker" is a D3 Act V boss [K] | **Wallbreaker's Kit** | `shared/src/data/items.ts` |
| Gem ranks | Chipped · Flawed · Regular · Flawless · Perfect · Royal — the D2/D3 ladder [K] | **Rough · Cut · Faceted · Polished · Brilliant · Sovereign** | `shared/src/data/items.ts` (`GEM_RANKS`) |
| Character sheet | Damage / Toughness / Recovery trio — D3 sheet [K] (also noted in TOOLTIP.md §1) | **Damage · Durability · Sustain** | `client/src/ui/panels/character.tsx`, tooltip compare pills (lead already uses Damage / Survival) |
| Material text | "Distilled from the last exhale of a slain elite." (echo of Death's Breath) | "A hot cinder left where an elite falls." | `client/src/ui/panels/icons.tsx` (`MATERIAL_INFO.deathsBreath.desc`) |
| Affix wording (D3's exact tooltip phrasing [K]) | "Critical Hit Chance Increased by X%" | "+X% Critical Chance" | `shared/src/data/items.ts` (`AFFIXES[].label`) |
| | "Critical Hit Damage Increased by X%" | "+X% Critical Damage" | 〃 |
| | "Attack Speed Increased by X%" | "+X% Attack Speed" | 〃 |
| | "Reduces cooldown of all skills by X%" | "−X% Skill Cooldowns" | 〃 |
| | "Reduces all resource costs by X%" | "−X% Resource Costs" | 〃 |
| | "Chance to deal X% area damage on hit" | "Hits splash X% damage around the target" | 〃 |
| | "Increases Gold and Health pickup by X units" | "+X Pickup Reach" | 〃 |
| | "+X% Extra Gold from Monsters" | "+X% Gold from Enemies" | 〃 |
| | "Monster kills grant X% more experience" | "+X% Experience from Kills" | 〃 |
| | "Melee attackers take X damage per hit" | "Strike back for X when hit in melee" | 〃 |
| | "+X Life after each Kill" | "Heal X on Kill" | 〃 |
| | "Regenerates X Life per Second" | "+X Life Regeneration" | 〃 |
| | "+X Life per Hit" | "Heal X on Hit" | 〃 |
| | "Increases damage against elites by X%" / "Reduces damage from elites by X%" | "+X% Damage to Elites" / "−X% Damage from Elites" | 〃 |
| | "+X Resistance to All Elements" | "+X All Resistance" | 〃 |
| | "Fire skills deal X% more damage" (and the other elements) | "+X% Fire Damage" | 〃 |
| Skills, runes, Ancient/Primal | 18/18 skill names and 50/54 rune names match D3 labels [M: Codex C033 hashes] | bible agent's NAMES.md | `shared/src/data/skills.ts`, buffs in `client/src/ui/hud/SkillBar.tsx`, class texts in `shared/src/data/classes.ts` ("Whirlwind", "Meteor", "Storm of Steel") |

## D. Kept on purpose (genre-generic)

| Term | Decision |
|---|---|
| Rarities Normal / Magic / Rare / Legendary / Set | keep (lead decision): used across the genre (PoE, Last Epoch, WoW) [K]; D3's exact hex colours were replaced by the lead (TOOLTIP.md §4) |
| Waypoint, Stash, Blacksmith, Jeweler, Salvage, Enchant, Reforge, Socket, Empower | keep: ordinary words; only the artisan *trio* with "Mystic" is flagged (B5) |
| Strength / Dexterity / Intelligence / Vitality, Armor, Resistance, Life | keep: tabletop-RPG vocabulary used by D2, D3, Torchlight and others [K] |
| Acts I–III | keep: book/theatre structure; PoE and Diablo both use it [K] |
| Champion / rare / minion (internal tiers) | keep internally; no player-facing label uses "Champion" [M] |
| Gem names Ruby / Emerald / Topaz / Amethyst / Diamond | keep: real gemstones (the D3 set is the same five, so the rank ladder is renamed instead, row "Gem ranks") |
| Item nouns (Hand Crossbow, Wizard Hat, Spaulders, Sabatons, Orb, Quiver …) | keep: real-world or generic nouns; "Wizard Hat" also exists in D3 [K], low risk |
| Monster names (Bog Slime, Gloomshroom, Bonewalker, Mossback Golem, Ember Imp, Cinder Cultist …), bosses Gorgemaw and Vexis | keep: generic fantasy compounds, no match [M] |
| NPC names (Ansel, Brannoc, Hob, Liesel, Mother Ilse, Orsolya, Saffi, Tamsin, Wendel) and all zone names except the rift | keep: no match [M]; no reference-game proper names found by a scan for 40 Diablo/PoE/D4 names [M] |
| Generic words that happen to equal a D3 rune ("Gloom" prefix, "Focus", "Prism") | keep, recorded in the allowlist with that reason |

## E. Design copies that are not names (owner / foundation)

* **Paragon 2.0** structure (see C).
* **Difficulty steps** ×2/×4/×8 life with Torment-style numbered tiers (numbers are ours; the shape is D3's) — rename
  first, revisit the shape with endgame work.
* Elite structure (packs, leader + minions, fleeing treasure carrier, rift boss) is a genre pattern [K]; names fixed in A.
