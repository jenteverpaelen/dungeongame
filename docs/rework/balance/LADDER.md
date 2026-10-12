# Ordeal ladder re-fit (balance pass, 2026-10-12)

Labels: [S] sourced · [SN] sourced, with a caveat · [K] genre knowledge (not looked up) · [M] measured here · [P] proposal.

## Why

The owner: "i also couldnt beat ordeal 3 while on full gearset and 700 paragon etc but maybe i did something wrong".
Their hero (dev save, Ranger L70): full Siegebreaker's Arsenal 6pc with Sapper's Pack (5 Sentries, so the 4-Device 6pc
condition holds), Lantern Rank 700. The ladder was `hp 16·2^i, dmg 2.8·1.3^i` (Ordeal III ×64 life), tuned when full set
kits were worth up to ×387; the depth program capped them to ×13–29 and the ladder was not re-fitted (known gap).

## What the owner's hero shows [M]

`npx tsx server/test/sim.ts herorift <save.json>` replays a saved hero on the three rift-floor maps (the bot never dodges):

| | Ordeal I | II | III | IV | V | VI |
|---|---|---|---|---|---|---|
| Old ladder, as saved | 100 % (1 death) | 60 % | 33 % (2–20 deaths) | 19 % | 16 % | 4 % |
| Old ladder, Defense points spent | — | 61 % (0) | 39 % (0) | 28 % (0) | 17 % | — |
| **New ladder, as saved** | **100 % in 9:00** | **100 %** | **70 %** | 55 % | 26 % | 15 % |
| **New ladder, Defense points spent** | 100 % in 9:00 | **100 % in 11:56, 0 deaths** | **80 %, 0 deaths** | 55 % | 43 % | 21 % |

Two things the owner can change themselves:

- **All 175 Defense Lantern points were unspent** (plus 25 Utility). Spending them (Life, Armor, All Resistance, Regeneration)
  doubles toughness: resistance damage reduction 35 % → 56 %, and the deaths disappear up to Ordeal IV.
- **The Glass Reliquary had no powers equipped** (rank 3, nothing learned).

Deaths were never one-shots: the largest hit was 10–16 % of life; they came from 10–50 hits within 3 seconds (fire from
champion packs and imps, poison ground) while resistance was low.

## References

- Diablo III monster life / damage by difficulty [S, Blizzard difficulty guide; the same values on BlizzardWatch]:
  Normal 100 / 100 %, Hard 200 / 130 %, Expert 320 / 189 %, Master 512 / 273 %, Torment I 819 / 396 %, II 1311 / 575 %,
  III 2097 / 833 %, IV 3355 / 1208 %, V 5369 / 1752 %, VI 8590 / 2540 %, VII 18985 / 3604 %, X 200082 / 10194 %,
  XVI 13888770 / 64725 %. Life ×1.6 per step up to Torment VI, damage ×1.45; steeper from Torment VII [S].
- What clears what in D3 (fresh rares ~Torment I–II, a full set mid-Torment, optimised builds with high paragon the top)
  is genre knowledge [K], not a sourced table.

## The re-fit

`shared/src/progression.ts`: **Ordeal life `10 × 1.6^i`** (I 10, II 16, III 25.6, IV 41, V 66, VI 105, VII 168, VIII 268,
IX 430, X 687; was 16 … 8192). Damage per step unchanged (`2.8 × 1.3^i`): the deaths were toughness (unspent Defense),
not damage scaling. Ordeal I starts above Severe (×8) so the order holds; Story–Severe are untouched (levelling lane).

Measured on the ladder grid (`sim.ts ladder <class> <kit> <lanterns> <difficulties> 12`, `.local/bal/grid.sh`; kits:
L70 rares, class set 4pc + weapon/amulet/ring legendaries + one Cube power, full 6pc endgame kit, legendary-only kit;
Lantern points spent in the D3-guide order), median of 3 maps, 12 minutes:

| Kit | Old ladder: clears / ≥ 50 % | **New: clears / ≥ 50 %** |
|---|---|---|
| L70 rares | — / — (Ordeal I 6–14 %) | — / — (Severe 16–51 %) |
| 4pc set, Lantern 700 | — / Ordeal I | Ordeal I / Ordeal I–III |
| 6pc set, Lantern 0 | Ordeal I / Ordeal II | Ordeal I–II / Ordeal III–IV |
| 6pc set, Lantern 700 | Ordeal I / Ordeal II–III | **Ordeal II–III / Ordeal IV–V** |
| 6pc set, Lantern 1500 | — | Ordeal III–IV / Ordeal V–VI |
| Legendary-only, Lantern 700 | Ordeal I / Ordeal II–III | Severe–Ordeal III / Ordeal II–V (warrior weakest) |

Ordeal VII–X: no simulated kit reaches half a rift in 12 minutes (no Kindled/Fabled items, gems or perfect rolls in the
kits). They stay the long-term goal for the endgame update (timed rifts with ranks).

## Gates

`server/test/sim.ts` `riftFloor` (verify `simulation`): the 6pc set kit without Lantern Ranks must clear Ordeal I (100 %
in 12 minutes) and reach 70 % of Ordeal II, median of 3 maps, per class (measured 100 / 100 / 100 % and 95 / 81 / 100 %).
`SIM_WEAK_KIT=ranger` (L70 rares) fails both (15.5 % and 7.4 %).

## Open

- The Ranger still dies most on map 1 at Lantern 0 (6 deaths in Ordeal II); with Lantern 700 spent as above it is 0.
- Elite damage (`ELITE_DMG_MULT`) stays at ×1 from level 60 for now; if the endgame should feel more dangerous, that is
  the lever, measured with the same grid.
- The ladder must be re-checked after the build-balance pass (item power moves the kits).
