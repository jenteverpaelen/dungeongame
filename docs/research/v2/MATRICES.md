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
| D3, three classes | Active/rune/passive interleaving in Wizard, Barbarian and Demon Hunter guides | Full published availability bodies read; equipped-slot gates Q | External levels are L2, not balance-ready |
| Idleon | Guides report L10, but C058 shows a Warrior at L8 | Exact current minimum Q; contradiction retained | Neither observed L8 nor guide L10 is adopted as a gate |
| TBH | Dated June guide distinguishes character investment, formation and second active slot | Full current unlock order Q | Historical guide, no numerical proposal |
| PoE1 / PoE2 | Modifier model and historical rule changes | Q for new-character acquisition order | No numerical proposal |
| Torchlight II | Pre-release rank milestones corroborated by secondary PC skill reference; last-three-point refunds in two secondary sources | Pinned final PC tables/client behavior remain Q | Rank is not character level; console full-respec update is separate |
| Hearthfall [M] | Six actives at 1/2/4/6/9/12; last rune at 21 | Audit output | Baseline, not a recommendation |

### Separate the choices before comparing cadence

| Game / scope | New ability access | Investment / point source | Equipped capacity | Reversal evidence | Time axis |
|---|---|---|---|---|---|
| D3 PC Campaign + Adventure | Three published class tables, character level (D3-01–04/07/11) | Rune/passive availability is distinct from acquiring a new active; numerical spending model not measured here | Slot gates still Q | Historical Armory scope known, current switching flow Q | Both new-account mode traces Q |
| Idleon | Secondary World1 class milestone (IDLE-03) | Multi-character roles advertised; exact talent award/preset rules Q | Current slot/order Q | Current refund flow Q | Open-client event and general offline rewards must stay separate (IDLE-04) |
| Task Bar Hero | June guide separates character skills and account rune purchases (TBH-05) | Different progression scopes; current cost graph Q | Formation/second-active purchases described historically; current full order Q | June guide reports free refunds; current UI confirmation Q | Closed-client behavior and ordinary first session Q |
| PoE1 | Equipment/gem rules, now versioned to3.29 source scope (POE-05) | Gem access is not a character-level active table | Exact current early socket/loadout sequence Q | Subsystem refunds separately versioned; not a universal respec rule | Ordinary new-account acquisition trace Q |
| PoE2 | Separate gem/support model and versioned compatibility rules | Do not merge its investment model with PoE1 | Current early loadout sequence Q | Attribute failure/recovery and preview information sourced; actual UI Q | Ordinary new-account acquisition trace Q |
| Torchlight II unmodded PC | Level-gated availability and rank milestones (TL2-01/04) | Separate character/fame award graphs documented; values Q (TL2-09) | Current PC action-bar flow Q | Last-three-point limit has secondary corroboration; full-refund mod and console update are distinct | First-session trace Q |
| Hearthfall current [M] | Existing six-skill level schedule |69 ordinary points by70; all tiers cost72; actual helper/refund probes | One automatic primary plus four slots from creation | Free tier refund preserves runes/slots; earned Mage browser flow verified | Assisted local first decisions and bot simulations are separate from human times |

This is a structural comparison, not a pacing target or proof of reference-game usability. Each game receives the same questions; missing evidence is retained rather than substituted with a familiar game's rules. No new unlock, point source, slot, respec fee or account system follows from this table.

## Timeline and loot gaps

For **every requested game**, T=10 min / 1 h / 5 h / 20 h / 50 h / 100 h / 200 h remains unmeasured. We cannot yet populate level, zone, loot beat, UI exposure or social-state cells honestly. A level-unlock table is not a time series. The next pass starts with ordinary first-session footage and records account bonuses, seasonal state, platform, skips and patch. Later-hour cells need different evidence.

C056 starts the explicit [timeline matrix and observation record](TIMELINES.md). Eighteen historical D3 Campaign video-offset samples now exist, but account Paragon and a difficulty change make them ineligible for clean first-account time cells. They strengthen UI evidence while comparable elapsed-play-time cells remain unknown.

No external first-legendary distribution, drop-rate formula, pity threshold or crafting-cost table is ready for balance implementation. TBH's chest rule revision is a caution about reward pacing, not a number to reuse. Hearthfall's seeded loot simulation is reproducible but assumes a class, difficulty, elite source and Magic Find; it is not a population playtest. Read the [metric corrections](../../design/ROADMAP_ERRATA.md).

## Initial text-source coverage — later pixel observations remain separate

| Game / screen | Read evidence | Still required before atlas completion |
|---|---|---|
| D3 skills | Class guides establish abilities and availability | Actual entry/hotkeys, slot states, density, empty/error behavior and 1080p frames |
| Idleon quests | Guide establishes task sequence | Journal interaction, reward claiming, map guidance and failure states |
| TBH crafting | Patch reports identify loading and lock-state problems | Actual selection/confirmation/latency/cancel/restart flow |
| PoE1 help | Historical progressively revealed help pages | Current presentation, discoverability, revisit/close flow |
| PoE2 supports | Attribute failure can disable only the support | Actual explanation and recovery UI |
| Torchlight II skills | Historical rank behavior | Final PC skill panel and respec behavior |

No pixel layout or UI restyle follows from these text sources. The owner likes the current Hearthfall UI.

Further distinctions now logged: open-client event rewards versus general offline gains (IDLE-04), displayed versus applied effects (TBH-06), and unmodded PC versus modded skill refunds (TL2-08). None fills missing reference-game pixels or elapsed-time cells.

Hearthfall now has a separate [local first-session atlas and trace](../../phase/P01-research/FIRST-SESSION-REPORT.md): twelve inspected 1080p frames with initial/disabled states, physical travel and first level-up. This is a scripted local baseline, not reference-game or unfamiliar-player evidence. It does not fill the external timeline cells above.

## OB-01 — How to choose the first progression improvement [P]

C040 adds an [objective continuity comparison](OBJECTIVES.md) for the same five games, retaining missing current/visual/party evidence. Its integration map identifies current authoritative action boundaries; no new tutorial count or reward is inferred.

**Problem established:** our remaining unlock availability after level 21 is limited in the audited skill system (HF-01). **Not established:** how new players experience that interval or which change will help most.

| Option | Evidence fit | Cost/risk here | Decision now |
|---|---|---|---|
| Move existing skills/runes to later levels | Superficially resembles a longer unlock ladder | Can remove access from existing characters and delay enjoyable builds; no measured target | Do not implement from this evidence |
| Add new classes / a large passive tree immediately | Reference games show breadth | Large content, auto-cast balance and save/UI scope; counts do not demonstrate value | Defer until detailed build research |
| Observe the current loop, then connect a small goal to an existing action | IDLE-03 and POE-03 are patterns; UX-01 cautions that outcomes need testing | Observation is cheap and reversible; objective persistence would need a separate scoped design | Continue this line of research first |

This is a research sequencing decision, not a new tutorial implementation. Evidence needed next: first-session action trace, failed attempts, current tier behavior, versioned reference flows, and the smallest acceptance test for a proposed change. Rollback: abandon the proposed objective if observations show a different problem; existing gameplay remains intact. No owner answer is needed to continue these measurements.

C045 supplies a separate [loot acquisition matrix](LOOT.md) for all five priority games, with PoE1/2 and D3 modes separated. It establishes dimensions and local source rules; it does not complete the missing external cadence measurements.

C057–C059 extend the observed atlas to48 entries and four recordings (89 sparse frames). Torchlight II separates reward selection and confirmation; Idleon separates estimates/return/acquisition and exposes the L10/L8 class contradiction; TBH separates character level/investment and selected-input/expected-output states. These update the evidence coverage above, not comparable elapsed timelines or hidden transaction rules. Exact offsets, versions and limitations: TIMELINES.md and TIMELINE-FRAMES.json. No reference value is balance-ready.

C060 adds PoE1 historical early-flow observations: pending passive allocation,gem-item versus action tooltip,quest/reward continuity and sale preview. It updates UI coverage to55 entries/five recordings/110 samples; ordinary clean-account pace and current support recovery remain Q. Matching socket colour is superseded by3.29; no numerical target is adopted.

C061 adds separate historical PoE2 skill/support observations:categorised selection,attribute support capacity,explicit benefit/penalty and later occupied slot. Catalogue availability,assigned modifier and applied effect remain different dimensions. One-copy restriction was removed later;no current rule or pacing target follows. Atlas coverage64 entries/six recordings/132 samples;D3 Adventure remains the next missing video mode.

C062 completes the bounded seven-recording pass across all five priority games,D3 modes and PoE games separately. Seasonal Adventure adds target/count activity selection,displayed action/passive locks,artisan rank and salvage/Cube context. Its resource-assisted start cannot populate comparable timelines. All reference values remain balance-ineligible;current input/error/durable state remains open. Next deliverable is a concise per-game digest and explicit decision dependencies.
