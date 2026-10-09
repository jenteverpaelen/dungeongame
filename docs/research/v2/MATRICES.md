# Comparative evidence and first option brief

2026-10-09. This is an initial comparison, **not the completed roadmap matrices or UI atlas**. IDs resolve through [CLAIMS.csv](CLAIMS.csv) and [SOURCES.csv](SOURCES.csv). A question mark is missing evidence, not absence of a feature.

## Goals, build decisions and transfer limits

| Reference | Evidence-backed pattern | Scope limit | Candidate lesson for Hearthfall [P] |
|---|---|---|---|
| D3 Campaign / Adventure | Interleaved ability/modifier unlocks; mode access differs from old Campaign-gated accounts (D3-01–05) | Full quest and seasonal timeline unobserved | Keep a next build choice visible; distinguish teaching goals from endgame goals |
| Idleon | Characters serve complementary roles; quest tasks teach existing actions (IDLE-01–03) | AFK formula and account ownership unresolved | Connect objectives to useful actions before adding new subsystems |
| Task Bar Hero | Auto-play plus item customization; protected items need consistent treatment (TBH-02–04) | Closed-client gains and current rune topology unresolved | Make unattended progress understandable; test item safety across transitions |
| PoE1 / PoE2 | Modifiers, build constraints and recoverable failure states (POE-01/03, POE2-01) | Different games and historical patches | Explain the result and requirements of a modifier in the current skill panel |
| Torchlight II | Skill-rank milestones can change behavior; pets can reduce town interruptions (TL2-01/02) | Final PC rank values unverified; town frozen here | Audit existing tier behavior before adding more skill breadth |

## Unlock cadence — incomplete

| Game | Source-established milestone | Skill slots / full tables | Transfer status |
|---|---|---|---|
| D3, two classes | Active/rune/passive interleaving in class guides | Q; do not infer slot counts from available abilities | External levels are L2, not balance-ready |
| Idleon | Community-reported class choice at character L10 | Q | Secondary corroboration only; no copied level gate |
| TBH | Full initial unlock order Q | Q | No numerical proposal |
| PoE1 / PoE2 | Modifier model and historical rule changes | Q for new-character acquisition order | No numerical proposal |
| Torchlight II | Pre-release behavior milestones at skill ranks 5/10/15 | Q for final PC | Rank is not character level |
| Hearthfall [M] | Six actives at 1/2/4/6/9/12; last rune at 21 | Audit output | Baseline, not a recommendation |

## Timeline and loot gaps

For **every requested game**, T=10 min / 1 h / 5 h / 20 h / 50 h / 100 h / 200 h remains unmeasured. We cannot yet populate level, zone, loot beat, UI exposure or social-state cells honestly. A level-unlock table is not a time series. The next pass starts with ordinary first-session footage and records account bonuses, seasonal state, platform, skips and patch. Later-hour cells need different evidence.

No external first-legendary distribution, drop-rate formula, pity threshold or crafting-cost table is ready for balance implementation. TBH's chest rule revision is a caution about reward pacing, not a number to reuse. Hearthfall's seeded loot simulation is reproducible but assumes a class, difficulty, elite source and Magic Find; it is not a population playtest. Read the [metric corrections](../../design/ROADMAP_ERRATA.md).

## UI atlas — text evidence only

| Game / screen | Read evidence | Still required before atlas completion |
|---|---|---|
| D3 skills | Class guides establish abilities and availability | Actual entry/hotkeys, slot states, density, empty/error behavior and 1080p frames |
| Idleon quests | Guide establishes task sequence | Journal interaction, reward claiming, map guidance and failure states |
| TBH crafting | Patch reports identify loading and lock-state problems | Actual selection/confirmation/latency/cancel/restart flow |
| PoE1 help | Historical progressively revealed help pages | Current presentation, discoverability, revisit/close flow |
| PoE2 supports | Attribute failure can disable only the support | Actual explanation and recovery UI |
| Torchlight II skills | Historical rank behavior | Final PC skill panel and respec behavior |

No pixel layout or UI restyle follows from these text sources. The owner likes the current Hearthfall UI.

## OB-01 — How to choose the first progression improvement [P]

**Problem established:** our remaining unlock availability after level 21 is limited in the audited skill system (HF-01). **Not established:** how new players experience that interval or which change will help most.

| Option | Evidence fit | Cost/risk here | Decision now |
|---|---|---|---|
| Move existing skills/runes to later levels | Superficially resembles a longer unlock ladder | Can remove access from existing characters and delay enjoyable builds; no measured target | Do not implement from this evidence |
| Add new classes / a large passive tree immediately | Reference games show breadth | Large content, auto-cast balance and save/UI scope; counts do not demonstrate value | Defer until detailed build research |
| Observe the current loop, then connect a small goal to an existing action | IDLE-03 and POE-03 are patterns; UX-01 cautions that outcomes need testing | Observation is cheap and reversible; objective persistence would need a separate scoped design | Continue this line of research first |

This is a research sequencing decision, not a new tutorial implementation. Evidence needed next: first-session action trace, failed attempts, current tier behavior, versioned reference flows, and the smallest acceptance test for a proposed change. Rollback: abandon the proposed objective if observations show a different problem; existing gameplay remains intact. No owner answer is needed to continue these measurements.
