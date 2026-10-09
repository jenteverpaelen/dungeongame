# P01 research — done, unfinished, next

Updated 2026-10-09 by Codex, solo. Branch: `codex/new-tristram-town`. Read [AGENTS](../../../AGENTS.md), HANDOFF and the [current owner directions](../../CODEX_CHANGELOG.md) before continuing. The town is frozen. UI style stays as it is. Work requiring no new design choice continues autonomously; no question is currently blocking research.

## Done

- [x] Restore fixed 620 u camera and 90 ms follow; remove automatic spell framing and its two feature-only tests. Explain removal and future clipping in C001.
- [x] Local installed-Chrome 1920×1080 mage captures; inspect all four; record exact zoom and verification limits.
- [x] Typecheck, shared tests, simulation, town routes, service/persistence tests and build. Server suite has two known Windows shutdown failures; not a fully green server result.
- [x] Locate Claude's GitHub roadmap and preserve its three original files unchanged.
- [x] Reproduce baseline audit with isolated data; add precise errata rather than silently alter Claude's draft.
- [x] Equal first-pass dossiers for five owner-selected games; additional onboarding literature dossier.
- [x] Source/claim CSVs, version/access gaps, initial comparisons, research option brief, additions/removals log and this status file.
- [x] Read the entire Claude roadmap, including all phases, feature catalogue and appendices; track P0–P18 in `docs/EXECUTION.md`.
- [x] Add scoped dossiers for every remaining original charter with 28 additional primary sources and explicit unanswered questions. This does not close G1.
- [x] Begin the roadmap's independent foundation subset: verify command, default debug denial, save version/fixtures and placeholder registry.
- [x] Complete both D3 progression-table reads and deepen PC Torchlight II respec/backup, dated TBH guide and PoE1 subsystem refund evidence. Register six additional sources and five scoped claims; numerical balance eligibility remains false.
- [x] Read 23 installed production component licences/provenance individually. Measure built-in hashing and synthetic storage/restore on the owner's PC; preserve exact limits and separate this from release/security acceptance.
- [x] Record a fresh-character local Chrome first-session trace and inspect all twelve 1080p frames. Starting gear, physical Waypoint, automatic combat and first level-up observed; equipment/rune purchases and human comprehension remain unmeasured. See FIRST-SESSION-REPORT.md.
- [x] Correct measured mouse/LMB instruction mismatch using existing labels/tooltips/private new-character chat. Fresh and returning browser flows pass; five final 1080p frames inspected. This is a cue correction, not a completed onboarding system or player study.
- [x] Map actual economic sources/sinks/transfers and compute 60 offline cases, 15 item-cost fixtures and current Fortune-aware upgrade expectations. Repeat output hashes match; no balance change. Enchant transition semantics and active rates remain next evidence.
- [x] Reproduce stale enchant/reforge transition with real handlers, preserve before/pilot/after evidence, and correct the state-safety defect (C022). Active earning rates and cross-game economic comparisons remain open.
- [x] Inventory 54 tiers / 54 runes and 288 actual runtime-helper combinations; confirm affordability and refund conservation in repeatable synthetic probes. BUILD-REPORT.md distinguishes source mismatches and untested behavior; no balancing change.
- [x] Probe three Hydra impacts and 32 buff casts; correct measured description mismatches without changing actual results. Two regressions, full verify and four inspected Chrome1080p frames pass (C025). Gear-aware descriptions and remaining behavior remain open.
- [x] Deepen Idleon open-client/offline distinctions, TBH text/effect/latency failures and Torchlight II base/mod/authoring provenance from four additional primary sources and six scoped claims (C026). No reference UI observation or pacing completion claimed.

## Research depth and remaining scope

| Charter | State | Next evidence needed |
|---|---|---|
| R-01 D3 | Partial L1/L2; Campaign and Adventure included | Current PC version; both first-session traces; full slots/runes tables for two classes; loot/system/UI detail |
| R-02 Idleon | Primary L1; secondary progression L2 | Versioned early flow; AFK formula/cap; account scope; observed UI |
| R-03 TBH | L1/L2 | Current build; Cube/rune rules; closed-client rewards; first-session UI and economy |
| R-04 PoE1/2 | L1/L2; separated | Current versions; gem acquisition/recovery flows; economy and endgame |
| R-05 D4 | Partial L2; 2026 patch defects and rule changes | Current progression gates, systems, reception and atlas |
| R-06 MapleStory | Partial L2; publisher Guide behavior | Class-specific first session, jobs, channels/social systems |
| R-07 Lost Ark | Partial L2; Guardian/rest rules | Skill/honing stages, full lockouts, burden and UI |
| R-08 survivors games | L1 publisher loop; feel unmeasured | Observed combat, evolution, other games and transfer limits |
| R-09 Last Epoch / Grim Dawn / Infinite | Partial L1/L2 for each | Crafting/filters/first session/endgame; Infinite is not II |
| R-10 case studies | Partial; three games sourced | Immortal/Drakensang; independent causal evidence, retention |
| R-11 economy/trading | Partial L2; OSRS versioned sinks plus local source/sink map and deterministic cost/offline probes | Enchant transitions; active rates; WoW/D2R/binding/anti-dupe |
| R-12 technology/operations | Primary Node24.19/OWASP/SQLite, code audit and local candidate measurements | Real server contention/crash recovery; accounts/recovery/free-host limits |
| R-13 UI/accessibility | Basic guidelines read | Actual task/contrast/input/settings audit; approved style preserved |
| R-14 balance math | Local baseline + conference companion | Full formulas/models/player observations; no target numbers adopted |
| R-15 onboarding | One primary study plus local scripted first-session trace; partial | Reference-game traces, first gear/skill decisions and unfamiliar Hearthfall player observations |
| R-16 legal/privacy/licences | CPC/EDPB and 23 installed production licence reviews | Distribution notices; build tooling; national rules, ages/ratings/IP |
| R-17 platforms | Steam input/display criteria read | Packaging/review/cloud/input/localization; device tests |
| R-18 art pipeline | Pixi8 performance guidance read | Rig/style/memory audit and real profiles; no town restyle |
| R-19 audio | PannerNode + category guidance | Existing graph/mix/settings audit, concurrency/listening tests |
| R-20 narrative/quests | Authoring pattern + quest failure cases | UI observations, original premise, schema and reward semantics |
| R-21 Torchlight II PC (owner addition) | L1/L2 plus secondary PC respec corroboration | Pinned final PC tables/client behavior; first-session footage; loot/UI |

The full P1/G1 package is **not complete**. This is not a claim that all 20 original charters plus R-21 are researched. The timeline and loot matrices and visual UI atlas remain mostly missing. The owner's autonomy instruction removes routine approval pauses, not the need for evidence. No new gameplay progression/economy/content system has been implemented from this packet.

## Continuing work

1. Pin the described PC versions for all five games; keep equally scoped questions and time-box inaccessible sources.
2. Obtain inspectable ordinary early-session footage, distinguish account bonuses/mode/patch, and log actual frames/timestamps. D3 needs two modes; PoE needs separate games. Do not count a video description as observation.
3. Complete available skill/rune/slot tables, PC respec rules and first-use UI states; corroborate numerical claims before proposing values.
4. Trace Hearthfall's current onboarding actions and tier behavior in an isolated local session. Keep bot measurements separate from real-player comprehension. Prepare a small reversible objective proposal only if evidence supports it.
5. Continue the remaining charters according to the next design dependency. Update both this file and `docs/CODEX_CHANGELOG.md` with additions, removals, why, impact, evidence, checks and unfinished work.

## Constraints and gaps to carry forward

- No subagents. Never alter protected baseline refs. Check branch before any push. Never commit real saves, `.local` or `.env`.
- Necessary downloads and relevant PC/Chrome access have standing owner permission. Record source/size/hash/purpose/licence; no paid services or account creation implied.
- Browser connector failed before opening public research tabs; local Chrome capture works. No reference-game visual inspection is claimed.
- Long-range spell clipping returns with the explicitly requested original camera. Town load/performance follow-ups remain deferred, not passed.
- Keep earlier town checkpoint and old research as historical evidence, not current instructions when contradicted by the owner's later directions.
