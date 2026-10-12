# Early game: drops and danger (balance pass, 2026-10-12)

Labels: [S] sourced · [SN] sourced, with a caveat · [K] genre knowledge (not looked up) · [M] measured here · [P] proposal.

## Why

The owner played a fresh Mage to level 5 on Story (120 kills, about 8 minutes):

> "nothing is dropping … elites etc should have way more chances of dropping something and so does little mobs, however
> legendary rank plus items should be way rarer, common and yellow drops should occasionally happen, i also noticed early
> game nothing barely does damage, i can just sit and facetank everything"

The same day they asked for shrines to show what they give (done: `shared/src/shrines.ts`, always-on label).

## What was wrong [M]

**Drops.** The 2026-10-10 pass cut field drops to 1/9 (`FIELD_DROP_FACTOR` 1/6 × `EQUIPMENT_DROP_SCALE` 2/3), tuned on the
dense generated field where the levelling bot kills ~100 monsters a minute. The quest zones are not like that
(`.local/bal/zone-census.ts`): no champion packs, 2–4 rare elites, ~15–20 kills a minute for a person.

| Zone | Ordinary | Champions | Rare elites |
|---|---|---|---|
| Rillwake Crossing (L1–4) | 103 | 0 | 3 |
| Bracken Sluice (L4–7) | 64 | 0 | 2 |
| Cinderwash Kilns (L12–16) | 49 | 0 | 4 |
| Whispering Glade (field) | 217 | 25 | 5 (+26 minions) |

An ordinary kill dropped an item 0.83 % of the time, a rare elite 0.28 items on average (72 % dropped nothing), a champion
0.17. A full Rillwake clear gave about **2 items**.

**Danger.** `sim.ts threat` stands a character still beside one pack with only automatic attacks and auto-cast skills
(no moving, dash or potion), and also measures the time to die when it never attacks:

- Monster damage was ×0.4–0.5 of the base curve (`LEVEL_DAMAGE`); one hit took 1.2–3.4 % of life at levels 1–20 on Story,
  and a champion swings about every 3–4 s. Elites had more life but the same damage as trash, so a champion pack
  (3–4 monsters) hurt less than a trash pack (6–14).
- Healing affixes (Heal on Hit, Life Regeneration, Heal on Kill, heal on control) grew on the `flat` curve (t^2.4) while
  life grows much more slowly until level 35. With an ilvl-matched rare kit regeneration healed 2–4.5 % of life per
  second and Heal on Hit 3–9.5 % per enemy per 100 ms at levels 10–40 (≈1 % at level 70). From level 10 a character that
  never attacked could not be killed by a champion pack in 60 s.
- Result: a Story champion pack cost 4–25 % of life when standing in it; at level 20+ often 0–7 %.

## References

- Path of Exile: base item chance of a normal monster ~16 % [SN, poewiki "IIQ", an older page]; magic monsters +600 % and
  rare monsters +1400 % item quantity, rare monsters 50 % more damage, magic monsters 20 % less damage and 20 % more speed
  [SN, poewiki / fandom monster modifier table on the Soul Conduit page, marked there as needing citations].
- Diablo IV Season 11: every champion pack and elite guarantees equipment and gold [SN, Icy Veins commentary, no
  percentages]. Season 10 hotfix: legendaries dropped too often at low levels and were cut [SN, Icy Veins].
- Diablo III Loot 2.0: far fewer but better drops; first kill of each act boss guarantees a legendary [S, Diablo wiki
  "Loot 2.0"]. Rare packs have one leader that deals more damage than its minions [SN, Diablo wiki "Elite"].
- Diablo II: champions very often drop a magic item; normal monsters use a NoDrop chance [SN, purediablo / gamerguides].
- Diablo III gives melee classes 30 % damage reduction [K]; D3 Life per Hit is scaled by proc coefficient [K].
- **Thin:** no source gives exact per-tier drop counts for D3/D4 or how hard elites hit on the default difficulty; the
  danger numbers below are owner direction + measurement, not a copied table.

## What changed

| Area | Before | After | Evidence |
|---|---|---|---|
| Ordinary kill | 0.83 % item | **1.5 %** | [SN] PoE 16 % base, D3 "fewer but better"; [M] 9 seeds below |
| Champion | 0.17 items each | **35 % each, and every champion pack gives each player ≥1 item** | [SN] D4 S11 guarantee, PoE magic ×7 |
| Rare elite | 0.28 items | **1 guaranteed + 40 % second** | [SN] PoE rare ×15 |
| Minion | 1.7 % | **3 %** | [P] |
| Legendary/Set share | 1.2 % at every level | **0.2 % (L1) → 0.4 % (L20) → 0.8 % (L40) → 1.2 % (L60+)** | [SN] D4 S10 hotfix |
| Bad-luck protection | 45 items | **600 (L1) → 400 → 200 → 45 (L60+)** | [P] ≈ the mean gap; it protects, it does not pace |
| White / blue / yellow | L5: 49 / 39 / 12 % | **L5: 23 / 70 / 7 % (elites 22 / 66 / 12 %); L70 Ordeal III 5 / 50 / 45 % (was 9 / 40 / 51)** | owner "whites and yellows occasionally" |
| Monster damage `LEVEL_DAMAGE` | ×0.4 (L1–5), ×0.5 (L10–70) | **×0.6 (L1) → 0.8 (L4) → 1.0 (L10) → 1.2 (L20–35) → 1.0 (L45) → 0.5 (L60–70)** | [M] threat + 9 seeds |
| Elite damage `ELITE_DMG_MULT` | ×1 | **champion ×1.25, rare ×1.5** up to level 45, fading out by 60 (bosses unchanged; the endgame keeps its tuning until the Ordeal re-fit — at level 70 it cut the ranger's Ordeal II rift floor from ~55 % to 15.6 %) | [SN] PoE rare 50 % more |
| Elite life at level 1 | ×1.0 → ×2.5 at L15 | **×0.85 → ×2.5** | shorter, more dangerous first elites; restores the L1–4 pace target margin |
| Healing affixes | `flat` t^2.4 | **`life` curve: share of a rare-kit character's life (L70 unchanged)** | [M] `.local/bal/sustain.ts` |
| Warrior | — | **30 % less damage taken** (`innateDR`, counted in toughness) | [K] D3 melee classes |
| Pace harness | time to kill counted dead time and the walk back | **kills with a player death in the fight are left out** (`ttkBroken`) | did not matter while monsters could not kill |

Levels 60–70 and the Ordeal rows are untouched (endgame lane, next).

## Results [M]

**Levelling bot, dense field, 9 seeds × 120 min** (`scripts/bot-metrics.ts run 120`, `.local/bal/seeds.sh`):

| | Before | After |
|---|---|---|
| Items/h (white / blue / yellow / Legendary+Set), warrior | 47 / 44 / 26 / 3.0 | 60 / 219 / 52 / 1.5 |
| ranger | 53 / 52 / 33 / 4.0 | 60 / 232 / 55 / 2.3 |
| mage | 45 / 41 / 26 / 2.9 | 55 / 214 / 49 / 1.6 |
| Level after 2 h (warrior / ranger / mage) | 26 / 28 / 26 | 29 / 30 / 27 |
| Damage taken, % of life per minute | 10–77 | 29–92 |
| Deaths per hour of a bot that never dodges | 0–9 | 0–11 |

The pace gate (`bot-metrics.ts check 120`, owner targets unchanged, baseline not re-recorded) passes with no miss on any
seed; before the change two of the three seeds missed the L1–4 champion target (the gate only passed on the median).

**Quest zones (expected from the census):** a Rillwake Crossing clear ~2 → ~5.7 items; every rare elite drops at least
one item; a champion pack (in fields and rifts) always gives one.

**Standing still beside a pack, Story, found gear** (`THREAT_KIT=organic sim.ts threat 3,5,10 0,1`): warrior and ranger
lose 10–35 % of life to a champion or rare pack (before 4–25 %); on Normal 30–100 % (deaths start). **The mage still
clears early elites in 1–2 s and loses almost nothing on Story** — it kills 3–4× faster than the warrior at levels 3–5;
that is the class-balance pass (warrior speed), not monster damage.

## Open, for the owner

1. **No health potion exists.** Healing is Mending Orbs (elites 50 %, trash 3.5 %), regeneration and Heal on Hit. With
   monsters that can kill, Diablo III/IV both give a potion on a cooldown [K]. Recommended next: one potion with a
   30-second cooldown.
2. Story is still gentle for a fast class. If facetanking must stop there too, Story needs more after the class pass
   evens out kill speed; Normal is where it stops today.
3. The bot levels 1–3 levels further in two hours (more gear); within the pace targets, but you asked for slow
   levelling on 2026-10-10.

Re-measure: `npx tsx server/test/sim.ts threat [levels] [difficulties] [packs]` (`THREAT_KIT=organic`, `THREAT_DMG=…`),
`scripts/bot-metrics.ts check 120`, `.local/bal/seeds.sh <label> <repo>` + `med.cjs` / `items.cjs` (9 seeds via `SEEDS`).
