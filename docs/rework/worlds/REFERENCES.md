# Worlds rebuild — references and measured targets (2026-10-10)

Rule: no number below is a taste call. Each target cites a **measurement of this game** (script output, reproducible) or an
**external reference** (web source, listed with what it says and how strong it is). *Inferred* = arithmetic on the two.

## 1. Measurements of this game (before the rebuild)

Reproduce: `npx tsx .local/measure-zones.ts` (a throwaway script; the numbers are pasted here). Camera: `VIEW_HEIGHT` 620 u ×
default zoom 0.75 (`client/src/game/preferences.ts`) → **1470 × 827 world units visible at 1920×1080**. Hero speed
`BASE_MOVE_SPEED` = **250 u/s** (`shared/src/constants.ts`); tile = 64 u. "Screens" = walkable area ÷ (1470×827).

| zone | kind | tiles | walkable Mu² | walkable screens | main route u | main route walk s | packs | monsters | monsters/Mu² | interactables | props/Mu² |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rillwake_crossing | field | 64×52 | 2.9 | 2.4 | 3509 | 14 | 5 | 29 | 10.0 | 4 | 21.1 |
| bracken_sluice | field | 56×48 | 2.9 | 2.4 | 3116 | 12 | 4 | 15 | 5.1 | 1 | 13.6 |
| reedvault_pumpworks | dungeon | 40×36 | 1.7 | 1.4 | 1386 | 6 | 3 | 10 | 5.7 | 4 | 4.0 |
| cairnspill_terraces | field | 56×48 | 2.5 | 2.1 | 3195 | 13 | 4 | 16 | 6.3 | 2 | 7.1 |
| cinderwash_kilns | field | 56×48 | 3.4 | 2.8 | 3325 | 13 | 4 | 16 | 4.8 | 3 | 4.2 |
| kilnwatch_crown | field | 48×48 | 2.8 | 2.3 | 2651 | 11 | 3 | 9 | 3.2 | 3 | 4.6 |
| sablefen_causeway | field | 56×48 | 3.0 | 2.5 | 5055 | 20 | 4 | 16 | 5.3 | 4 | 2.0 |
| saltwind_pans | field | 56×48 | 3.7 | 3.0 | 6600 | 26 | 4 | 16 | 4.3 | 4 | 1.6 |
| lockglass_cistern | dungeon | 40×40 | 1.9 | 1.6 | 2872 | 11 | 3 | 10 | 5.2 | 5 | 2.6 |
| shiverline_escarpment | field | 56×52 | 3.9 | 3.2 | 8070 | 32 | 4 | 16 | 4.1 | 5 | 1.5 |
| beaconbreak_ward | field | 56×48 | 3.6 | 2.9 | 7591 | 30 | 4 | 16 | 4.5 | 5 | 1.7 |
| hollowstar_array | dungeon | 48×40 | 2.8 | 2.3 | 5540 | 22 | 3 | 10 | 3.5 | 7 | 2.1 |
| *whispering_glade* (open farming field, generated) | field | 120×90 | 29.4 | 24 | – | – | 114 slots, ≥7 live near a player | – | – | 0 | ~101 |

Other measured facts used below:
* Open-field spawner (`server/src/sim/tuning.ts`): ≥ 2 live packs inside 1150 u and ≥ 7 inside 2200 u of every player;
  respawn out of view (≥ 1250 u). Authored zones only ever had their 3–5 authored packs.
* Balance (`docs/rework/BALANCE.md`, sim): median trash kill ≈ 1 s for the typical engaged bot; 45–130 kills/min; field
  drops ×1/6; a rare elite drops 2–3 × 2/3 × 1/6 ≈ 0.28 items + 3 double gold piles (`shared/src/items.ts rollDrops`).
* Server: 4 players + 150 monsters ≈ 1.2–1.3 ms/tick; monsters beyond 1500 u of every player are dormant
  (`DORMANT_RANGE`); the pathing flow field is a fixed 53×53-tile window per player (`flowfield.ts`) — **cost does not
  grow with map size**. AOI is ±1150×760 u per player (`AOI_HALF_W/H`).

**Verdict:** every quest zone fits in 1.4–3.2 screens of walkable ground; the main route is 6–32 s of walking; there are
3–5 fights per zone and 1.5–21 props per Mu² (the open Glade has ~100). That is the owner's "way too small, bad objects".

## 2. External references

| # | Source | What it says | Strength |
|---|---|---|---|
| W1 | diablowiki.net, *Shrine*, *Frenzied/Empowered/Speed Shrine* pages (https://di.diablowiki.net/Shrine) | D3 has six ordinary shrines (Blessed −25 % damage taken, Empowered resource/cooldowns, Enlightened +25 % XP, Fleeting speed + pickup radius, Fortune +25 % MF/GF, Frenzied +25 % attack speed); **all last 120 s**, refresh instead of stacking, reach nearby party members | community wiki, consistent across pages |
| W2 | Icy Veins, *Guide to Farming Regular (Nephalem) Rifts* (https://icy-veins.com/d3/guide-to-farming-regular-nephalem-rifts-efficiently) | optimised farmers aim for a rift (a zone-sized random level) in ≤ 5 min, preferably ≤ 3; elites killed in 5–10 s | community guide, updated 2026 |
| W3 | Blizzard forum *Tips on how to finish the nephalem rift faster than 6 minutes* (https://us.forums.blizzard.com/en/d3/t/tips-on-how-to-finish-the-nephalim-rift-faster-than-6-minutes/471) | an ordinary solo player cannot reach 6 min | anecdote |
| W4 | expertbeacon.com (summary) and tentonhammer.com *Diablo III Adventure Mode* | all bounties of one act ≈ 15–20 min solo (≈ 3–4 min per bounty); bounties "about 5–15 minutes"; "not uncommon to run around for 20 seconds" between packs | secondary, conflicting → use as a band |
| W5 | PoE wiki *Act* (via search summary; page itself bot-blocked) | experienced players finish all ten acts in 6–10 h skipping optional content; new players "a few hours" per act | community wiki; per-area time is *inferred*: ≈ 36–60 min per act ÷ ~12–15 areas ≈ **3–5 min per area** |
| W6 | Diablo Wiki *Forlorn Farm*, *Decaying Crypt*, Blizzard forum *Cursed Cellar, Mill & Bellows* | one D3 outdoor zone (Fields of Misery) holds: an unmarked event started by touching an object that opens a cellar with a guaranteed chest; a medium two-level side dungeon with its own event; two random events (Cursed Mill, Cursed Bellows); a rare random dwelling (~5 %) | community wiki; gives the **kinds** of points of interest, not counts per km |
| W7 | GDC 2024 *The Art of Open World Sanctuary Level Art* (summary, artstation) | D4's open world is "POIs plus the wilderness between them" | talk summary only; structure, no numbers |
| W8 | Existing project research `docs/research/12-world-town-dungeons.md` | idle/MMO training maps keep ~10–20 monsters per screen; D3 rooms 5–15 monsters | marked [UNVERIFIED] in that doc; used only as an upper bound |

Not found (searched): published D3/PoE zone dimensions, monsters-per-minute, or POI spacing figures. Where a target needs
them it is derived from W2/W4/W5 time bands and this game's own speed, and labelled *inferred*.

## 3. Targets for the rebuilt zones

| Target | Value | Derivation |
|---|---|---|
| Main-route walking time, field zone | **60–90 s** (15 000–22 500 u at 250 u/s) | W2/W4/W5 put a zone at ≈ 3–5 min for a practised player. With ≈ 1 s trash kills (BALANCE) fights take roughly 60 % of that, so locomotion is ≈ 1–2 min. *Inferred.* Today: 11–32 s. |
| Main-route walking time, dungeon | **40–70 s** | same band, smaller and denser (W2 rift ≈ zone; D3 side dungeons are "medium", W6). *Inferred.* |
| Zone dimensions | fields ≈ **2.2–2.5× linear** (56×48 → 128×110…140×120 tiles); dungeons ≈ **2.2×** (40×36 → 88×80) | route length scales ≈ linearly; 2.2–2.5× moves 11–32 s to 60–90 s once the route winds through regions instead of crossing a box. Area grows 5–6×, i.e. 12–20 walkable screens (the open Glade is 24). |
| Pack spacing on the main route | one pack every **700–1000 u** (3–4 s of walking) + side packs in every optional region | the open-field spawner keeps ≥ 2 packs within 1150 u (measured); W4 "20 s of running" is the *bad* case. ≈ 25–35 packs per field zone, 5–7 monsters each. |
| Monster density | **≤ the open Glade's** live density near a player (≈ 7 packs within 2200 u) | keeps kills/min, XP/h and loot/h inside what BALANCE.md calibrated; re-measured with `sim.ts` after the rebuild. |
| Points of interest per field zone | 1 outpost with residents and barks · 2 optional events · 2–3 shrines · 2–3 caches · 2 lore objects · 1–2 named rares · 1 side quest · 6–9 landmarks · ≥ 1 secret off the route | kinds from W6/W1; counts are a **design guess** sized so something optional appears every ~20–30 s of walking (the W4 "bad" gap is 20 s with nothing). Labelled guess. |
| Shrine rules | 120 s, refresh not stack, D3-like effects limited to combat (damage, attack speed, damage taken, move-feel via attack speed) — **no XP / magic-find shrines** | W1 for duration and kinds; XP/MF shrines removed because BALANCE.md just cut XP and loot per hour. |
| Cache reward | exactly one **rare elite's** drop roll at the zone's level (`dropFor(..., tier 2)`), once per character per 10 min per cache | derived from the existing per-kill budget; ≤ 3 caches × 6 per hour ≈ +5 items/h on ≈ 100/h from kills (BALANCE §5). |
| Side-quest reward | gold by the camp-contract formula (count × mean gold pile at mid zone level × 1.0–1.5), no XP | `shared/src/data/campContracts.ts`; story XP stays exactly as calibrated (`STORY_XP_SHARE`). |
| Props | ≥ **60 per walkable Mu²** (scenery + decor), ≈ 10 % solid | open Glade ≈ 100/Mu² (measured); Hearthmere's look is the bar. |
| Frame time | ≤ 16.7 ms p95 at 1920×1080 with ~30 heroes in each zone, visible tab | owner rule; town measured 88 fps with 100 heroes (LOG R5). |
| Server tick | ≤ 2 ms avg with 4 players + 150 monsters on the largest zone | today ≈ 1.2–1.3 ms (FINDINGS). |

## 4. Measured after the rebuild (2026-10-11)

Reproduce: `npx tsx .local/check-zone.ts` (counts), `.local/traverse.ts` (shortest walkable path entry → forward exit on a
40 u grid with real player collision; dungeons: entry → final record), `.local/tick-probe.ts` (server), and
`node scripts/shoot.mjs scripts/worlds-perf.mjs --base=http://localhost:5231` (client). Throwaway `.local` scripts are
not committed; the commands are in LOG.md.

| zone | tiles (was) | walkable screens (was) | shortest entry→exit walk s (was main route) | packs (was) | monsters (was) | props/Mu² (was) | POIs | events |
|---|---|---|---|---|---|---|---|---|
| rillwake_crossing | 160×128 (64×52) | 12.3 (2.4) | 48 (14) | 22 (5) | 112 (29) | 99 (21) | 6 | 2 |
| bracken_sluice | 144×120 (56×48) | 9.2 (2.4) | 42 (12) | 15 (4) | 66 (15) | 103 (14) | 4 | 1 |
| reedvault_pumpworks | 88×80 (40×36) | 9.8 (1.4) | 24 (6) | 7 (3) | 35 (10) | 32 (4) | 2 | – |
| cairnspill_terraces | 144×120 (56×48) | 8.1 (2.1) | 38 (13) | 14 (4) | 67 (16) | 105 (7) | 4 | 1 |
| cinderwash_kilns | 144×120 (56×48) | 7.8 (2.8) | 42 (13) | 13 (4) | 63 (16) | 101 (4) | 4 | 1 |
| kilnwatch_crown | 136×120 (48×48) | 7.9 (2.3) | 33 (11) | 11 (3) | 55 (9) | 106 (5) | 3 | 1 |
| sablefen_causeway | 144×120 (56×48) | 7.9 (2.5) | 47 (20) | 10 (4) | 46 (16) | 96 (2) | 4 | 1 |
| saltwind_pans | 144×120 (56×48) | 8.5 (3.0) | 44 (26) | 12 (4) | 53 (16) | 103 (2) | 4 | 1 |
| lockglass_cistern | 88×88 (40×40) | 10.4 (1.6) | 23 (11) | 6 (3) | 25 (10) | 32 (3) | 2 | – |
| shiverline_escarpment | 144×128 (56×52) | 9.8 (3.2) | 65 (32) | 13 (4) | 61 (16) | 110 (2) | 3 | 1 |
| beaconbreak_ward | 144×120 (56×48) | 9.0 (2.9) | 27 (30) | 12 (4) | 56 (16) | 108 (2) | 3 | 1 |
| hollowstar_array | 96×88 (48×40) | 11.3 (2.3) | 20 (22) | 6 (3) | 25 (10) | 30 (2) | 2 | – |

Against the targets (§3): walkable area 3–7× larger (7.8–12.3 screens); **shortest** crossing 33–65 s for fields — the
60–90 s target is met only by Shiverline; quest chains walk further than the shortest crossing (Rillwake's authored roads
total 112 s). Props per Mu² ≈ 100 in fields (target ≥ 60) but only ≈ 30 in the dungeons. Pack spacing follows §3.

Server (4 players at different packs, 600 ticks, `.local/tick-probe.ts`): Rillwake 88 live monsters avg 0.061 ms /
p99 0.60 ms / max 1.22 ms; Bracken 0.085 / 0.38 / 0.69; Shiverline 0.177 / 0.55 / 1.13; Pumpworks 0.024 / 0.12 / 0.26.
Instance creation 4–38 ms. Full `sim.ts` (part of `npm run verify`) unchanged and green.

Client (visible headless Chrome 1920×1080, one hero walking 4 s right after arrival with three summoned elite packs,
10–20 monsters on screen): avg 67–123 fps, p95 12–28 ms, worst 24–67 ms. After a 7 s settle: Rillwake 99 fps / p95 18 /
worst 30; Kilnwatch 76 / 24 / 36; Beaconbreak 103 / 18 / 24 (18–30 monsters). **Not measured:** the owner's ~30-hero
crowd case (the town's 100-hero harness is tied to the main checkout and the town); see LOG W3.
