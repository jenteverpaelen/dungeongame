# Loot acquisition and cadence — scoped comparison

2026-10-09, C045, solo. This supplies part of Claude §4.4's loot matrix for all five requested games; PoE1/2 are separate. It is not a completed cadence study. **S** = reported primary-source behavior; **M** = local implementation/experiment; **Q** = unresolved. Every external numerical claim remains ineligible for Hearthfall balancing. L56 records reads before synthesis.

## Equal-question matrix

| Reference and version | Sources and quality distinctions [S] | History / guarantees / gates [S or Q] | Crafting / loss / capacity [S or Q] | Rates and first upgrade [Q] |
|---|---|---|---|---|
| D3 PC Campaign | 2.0.1 separates class-biased generation from item rarity and affix categories | Exact early guarantee/pity rules and current Campaign trace Q | Crafted stats use class-aware generation with exceptions; vendor items excluded from salvage in that patch | Base drop probabilities, smart percentage and elapsed first upgrade Q |
| D3 PC Adventure | 2.5.0 preview distinguishes activity rewards and Primal affix perfection from choosing useful affix types | Preview describes a mode-scoped Greater Rift70 Primal gate; current seasonal exceptions Q | Material storage and Cube filling are separate from equipment capacity | Source-conditioned yield, elapsed time and useful-build distribution Q |
| Idleon | Aug25–Sep18 notes distinguish reward-display defects, bonus-scope exclusions and drop-multiplier bugs | Event/pet guarantees are not a general monster pity rule; ordinary rare-drop protection Q | Filter slots and material-capacity changes reported; current whole crafting table Q | Open-client, AFK, multikill and rare-table formula/median Q |
| Task Bar Hero | 1.2.4 revises chest timing; 1.2.5–1.2.8 distinguish result previews, synthesis eligibility and protection state | Chest limit over time differs from an unconditional delay; exact quota/rarity odds Q | Stacking, synthesis lock and recipe-preview fixes reported | Current source yields, costs, first useful item and closed-client rate Q |
| PoE1,3.29 | New bench recipes reroll selected numbers of modifiers; current Item Changes separate legacy items from new acquisition | Per-source rarity/eligibility and early guarantees Q | Crafting recipes and allowed targets are patch-specific; historical no-gold overview is superseded | Full current probability tables, crafting-cost corpus and timed new-character yield Q |
| PoE2,0.2.0g historical design post | Monster quantity and rarity are separate; tiered-affix selection is another quality dimension | Boss reward protection differs between first Campaign kills and maps; early exceptions | Better bases for crafting were an explicit goal; current recipe table Q | Post reports aggregate improvements, not a complete formula/current0.5.5e verification |
| Torchlight II unmodded PC | Runic's2012 single-character study is explicitly provisional;2013 Items docs separate selection weight, stat level and equip requirements | Weight called RARITY increases commonness; it is not a direct percent; actual pool/gate/pity Q | Class restrictions, stack limits and generated affixes have separate fields | Final shipped pools, actual first-session trace and study graphic Q |

Sources: [D3 Loot2.0](https://news.blizzard.com/en-us/article/12671560/patch-2-0-1-now-live), [D3 2.5 preview](https://news.blizzard.com/en-us/article/20597130/first-look-patch-2-5-0), [Idleon developer feed](https://steamcommunity.com/app/1476970/announcements/?l=english), [TBH developer feed](https://steamcommunity.com/app/3678970/allnews/?l=english), [PoE1 3.29](https://www.pathofexile.com/forum/view-thread/3985332), [PoE2 item changes](https://www.pathofexile.com/forum/view-thread/3774647/filter-account-type/staff), [Runic study](https://www.runicgames.com/blog/2012/03/16/potential-loot-drops-in-torchlight-ii/), [Runic Items](https://docs.runicgames.com/wiki/Items.html). IDs/sections/limits: SOURCES.csv; claims D3-13/14,IDLE-07,TBH-07,POE-08,POE2-08,TL2-11/12. Existing D3-250-ARMORY retains its historical scope.

The2.4.2 developer rationale specifically cites alternative acquisition systems when replacing one Magic Find gem property. That supports studying the whole acquisition loop; it does not establish that all Magic Find was removed or that Hearthfall should remove it. [D3 2.4.2](https://news.blizzard.com/en-us/article/20210379/patch-2-4-2-now-live)

## Hearthfall source matrix [M: code read at162f2e9]

These are current constants/branches, not recommended targets or measurements of player experience. `shared/src/items.ts` supplies the generator; `server/src/sim/loot.ts` supplies the live call and acquisition. `Rng.int` includes both endpoints. Difficulty uses the actual numeric index, not its Roman numeral.

| Eligible monster source | Equipment count per call | Legendary-or-set decision per ordinary item roll | Additional floor |
|---|---|---|---|
| Normal (tier0) | One with probability0.075×(1+0.08×difficulty), otherwise zero | Base formula below, then current pity override | None |
| Champion (tier1) | Integer1–2 | Base formula | None |
| Rare (tier2) | Integer2–3 | Base formula | None |
| Minion (tier3) | One with probability0.15, otherwise zero | Base formula | None |
| Boss (tier4) | Integer5–7 |0.35, then pity override | Append a Legendary if the batch has neither Legendary nor Set |
| Goblin (tier5) | Integer5–9 |0.25, then pity override | None; on-hit gold uses a separate path |

Base formula:0.012×(1+0.3×difficulty)×(inRift?1.4:1)×(1+magicFind/100). The current server **passes magicFind=0**; a helper's configurable input is not proof of a player-facing stat. A successful roll selects Set with probability0.25, otherwise Legendary. Failed rolls choose Normal/Magic/Rare by relative weights that depend on level, difficulty and elite truthiness. No item-level gate prevents Legendary or Set at level1.

`lootPity` counts ordinary non-Legendary/non-Set item rolls, not kills, elapsed seconds or pickups. At45 or above, the next ordinary roll succeeds. Those successes reset it. The boss's appended-floor branch currently does not reset it: a discrepancy against the documented meaning of the counter, requiring a controlled reproduction. A zero-item kill cannot advance it. Ground expiry/full inventory do not undo a generated success.

For Legendary/Set generation, Ancient eligibility begins at item level70. With primalAllowed, Primal is checked first at1/400; only on failure is the0.1 Ancient chance checked. These are nested conditional probabilities, not additive exclusive percentages. Ordinary world drops allow Primals at difficulty index6+, while crafting callers have their own options. Default smartChance0.85 constrains selection; it is not the probability an item is an actual build upgrade. Class use, current gear, sockets, affixes, skills and opportunity cost still matter.

Acquisition comes later: a personal ground item must fit in the60-slot inventory and pass the existing pickup checks. C027 separately counts spawned, acquired and expired items; C041 checks full-bag transfer and conservation. A notice on generation and a saved legendary acquisition count are different facts. Offline grants contain basic materials/currency/XP, not generated equipment (C021). Salvage, transmute, reforge and extraction have different identity/consumption behavior; see [economy report](../../phase/P01-research/ECONOMY-REPORT.md).

## What the next measurements must answer

1. Reproduce pity behavior using the real generator with deterministic inputs, including no-item calls, multi-item batches, boss-floor success and ordinary success. Do not equate all boss batches with zero pity: non-legendary rolls *after* a natural success legitimately count.
2. Report source-conditioned generated yield and class-use eligibility separately from acquired yield. Preserve zero-event samples and incomplete waiting intervals; record the exact denominator. C027's finite bag policy cannot measure all generated items as player income.
3. To measure an upgrade, first define the decision being tested. Sheet DPS alone ignores defense, skill changes and build goals. Use retained gear plus actual equip/stat checks, then human choices; do not invent one scalar usefulness score.
4. External rates still need pinned patches/modes, ordinary footage or reproducible source tables. Equal questions do not imply equal source completeness. No undocumented number is filled from memory.

No game content or rate is changed by this document. No research image, game binary or tool was downloaded. No reference UI pixels or timeline cells were observed. Future updates must retain the distinction between historical design intent, reported fixes and measured runtime results.

C046 follow-up: [6,528-batch probe](../../phase/P01-research/LOOT-COUNTER-REPORT.md) confirms and corrects the boss-floor counter mismatch. The preceding source table remains the pre-fix snapshot. All current drop payloads and RNG continuations match; only returned history changes on the fallback branch. No new rate or pity threshold.
