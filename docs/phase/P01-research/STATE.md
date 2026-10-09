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
- [x] Calibrate27 inventory-retaining field visits across classes/start levels/seeds, repeated identically. FIELD-CALIBRATION-REPORT.md distinguishes credited kills, spawned/acquired/expired rewards, simulated time and fixture bias. No pacing change or human timeline claim (C027).

## Research depth and remaining scope

C028 adds VERSIONS.md, five primary source records and five scoped claims. PoE1/2 index versions are established; installed clients and full patch reconciliation remain unverified.

C029 adds a naturally earned Mage item/rune/tier/refund/reconnect observation, nine inspected local Chrome1080p frames and item/stat conservation checks. FIRST-DECISIONS-REPORT.md separates assisted execution from human discovery; no new tutorial or pacing target.

C032 adds a third complete published D3 class progression read, Runic's separate character/fame point-source fields, and a comparison of availability/investment/capacity/reversal/time for every priority game. Values absent from sources remain unknown. `docs/CODEX_ROADMAP_STATUS.md` tracks all273 feature/screen/decision IDs separately from the unchanged Claude draft; no new phase-complete claim.

| Charter | State | Next evidence needed |
|---|---|---|
| R-01 D3 | L1/L2; C056/C062 separate historical Campaign/Adventure pixel L3 | Current build and clean-account traces; complete gates; input/error/durable flows; loot/endgame detail |
| R-02 Idleon | Primary L1; secondary L2; C058 scoped video-pixel L3 | Pinned class-rule contradiction; AFK formula/cap; account scope; clean timing and actual error/durable flows |
| R-03 TBH | L1/L2; C059 scoped early-flow pixel L3 | Current build/protection; full Cube/rune/refund rules; closed-client rewards; error/durable flows and clean timing |
| R-04 PoE1/2 | L1/L2; C060/C061 separate historical pixel L3; indexed versions | Current builds; support recovery; first-ten-level traces; economy and endgame |
| R-05 D4 | Partial L2; 2026 patch defects and rule changes | Current progression gates, systems, reception and atlas |
| R-06 MapleStory | Partial L2; publisher Guide behavior | Class-specific first session, jobs, channels/social systems |
| R-07 Lost Ark | Partial L2; Guardian/rest rules | Skill/honing stages, full lockouts, burden and UI |
| R-08 survivors games | L1 publisher loop; feel unmeasured | Observed combat, evolution, other games and transfer limits |
| R-09 Last Epoch / Grim Dawn / Infinite | Partial L1/L2 for each | Crafting/filters/first session/endgame; Infinite is not II |
| R-10 case studies | Partial; five named games now have scoped evidence and digests (C066) | Independent causal evidence,actual outcomes,retention and current-client scope |
| R-11 economy/trading | Partial L2; OSRS sinks,WoW/D2R ownership examples and local economic probes | Active rates,current binding/trading,anti-dupe/RMT and measured effects |
| R-12 technology/operations | Primary Node24.19/OWASP/SQLite, code audit and local candidate measurements | Real server contention/crash recovery; accounts/recovery/free-host limits |
| R-13 UI/accessibility | Basic/remapping/flash guidance; local keyboard and optional flash checks | Broader task/contrast/input/effects audit and human evaluation; approved style preserved |
| R-14 balance math | Local baseline + conference companion | Full formulas/models/player observations; no target numbers adopted |
| R-15 onboarding | One primary study; local first decisions and C056–C062 historical reference traces; partial | Current reference interactions, broader classes/error flows and unfamiliar Hearthfall player observations |
| R-16 legal/privacy/licences | CPC/EDPB and23 installed production licence reviews; C044 emits reviewed notices | Other-platform/nested/build tooling review; national rules, ages/ratings/IP |
| R-17 platforms | Steam input/display criteria read | Packaging/review/cloud/input/localization; device tests |
| R-18 art pipeline | Pixi8 performance guidance read | Rig/style/memory audit and real profiles; no town restyle |
| R-19 audio | PannerNode/category/lifecycle guidance; actual graph audit and C042 channel teardown measurements | Dense mix, concurrency/priority, device output and listening tests |
| R-20 narrative/quests | Authoring pattern, quest failure cases, cross-game continuity and39 repeated all-class runtime credit cases (C040/C041) | Persisted quest state, party policy, UI observations, original premise, schema and reward semantics |
| R-21 Torchlight II PC (owner addition) | L1/L2 plus secondary PC respec corroboration; C057 scoped early-flow pixel L3 | Pinned final PC tables/client behavior; actual input/error/reward flows; loot and clean timing |

The full P1/G1 package is **not complete**. This is not a claim that all 20 original charters plus R-21 are researched. All four matrix structures and the observed UI atlas now exist; their factual coverage,current-client/error flows and comparable timed first sessions remain incomplete. The owner's autonomy instruction removes routine approval pauses, not the need for evidence. No new gameplay progression/economy/content system has been implemented from this packet.

## Continuing work

1. Pin the described PC versions for all five games; keep equally scoped questions and time-box inaccessible sources.
2. C056–C062 cover historical early-flow pixels for every priority game and both D3 modes, with PoE1/2 separate. C063 synthesizes them. C068 completes the structural feature comparison and named-game digest index; use its G1 audit to seek targeted current/error/timing evidence when a pending decision needs it. Ordinary first-account timelines remain unknown.
3. Complete available skill/rune/slot tables, PC respec rules and first-use UI states; corroborate numerical claims before proposing values.
4. Trace Hearthfall's current onboarding actions and tier behavior in an isolated local session. Keep bot measurements separate from real-player comprehension. Prepare a small reversible objective proposal only if evidence supports it.
5. Continue the remaining charters according to the next design dependency. Update both this file and `docs/CODEX_CHANGELOG.md` with additions, removals, why, impact, evidence, checks and unfinished work.

## Constraints and gaps to carry forward

- No subagents. Never alter protected baseline refs. Check branch before any push. Never commit real saves, `.local` or `.env`.
- Relevant PC/Chrome use is authorized. The latest supplied AGENTS.md repeats explicit per-download name/source/size approval; a31MB GDC2015 presentation request is pending. Record source/hash/purpose/licence after approval; no paid services or account creation implied.
- Earlier browser-connector failures remain historical. C055 successfully inspects publisher media in real Chrome on this PC; current reference-client interaction and timed gameplay are still unobserved.
- Long-range spell clipping returns with the explicitly requested original camera. Town load/performance follow-ups remain deferred, not passed.
- Keep earlier town checkpoint and old research as historical evidence, not current instructions when contradicted by the owner's later directions.

C045 adds the loot acquisition matrix, five primary source records and eight scoped claims. Local generation, guarantees, pity, class eligibility and actual acquisition are separated; external rate/timeline cells remain unresolved. A suspected boss-floor pity discrepancy is the next deterministic probe, not an assumed tuning decision.

C046 reproduces48 counter mismatches in6,528 seeded loot batches and corrects the fallback boss branch. Two repeated after runs have zero mismatches and unchanged generated payload/RNG hashes. Four regressions and all19 strict verification stages pass (747server/382sim); LOOT-COUNTER-REPORT.md records future pity effects and no retroactive save reconstruction.

C047 adds three primary localization sources/two scoped claims and applies complete-context message keys to Settings/controls. Exact four-state Chrome text/labels/geometry and eight inspected captures preserve the existing UI. R17's full inventory, language scope, formatting and platform review remain incomplete.

C048 measures actual raw JSON archive costs in six isolated cases, with reproducible all-class fixture/restore hashes and snapshot/queued-write evidence. Node interval histogram interpretation is sourced; unavailable external control bodies are not counted as read. P3 BACKUP-SCALE-REPORT.md separates local costs from live CCU, tick and recovery guarantees.

C049 adds three primary accessibility/gear-cue sources and two scoped claims. Ground-loot text is an optional measured implementation inference, not a copied D4 feature or accessibility certification. Seven inspected Chrome frames and exact default label checks support the bounded change; wider R13 scope remains open.

C050 extends R12 with pinned session middleware/store/session/cookie source, eleven individual upstream licences and a scoped advisory query. Exact download and fault-test proposal is prepared; no archive or production dependency change. Continue the wider roadmap while the owner considers that specific request.

C051 adds three primary authoring sources/three scoped claims and an isolated three-quest/eight-objective/branching-dialogue probe. Strict typecheck and14 checks pass; conditional traps distinguish finite-state checks from unconditional topology. QUEST-AUTHORING-REPORT.md preserves the unimplemented live state/reward/UI and research limits.

C052 adds two primary option/distraction sources and two scoped claims, then verifies optional combat-number display with exact default styles and local Chrome controls. Historical D4 notes are not a current-client UI observation; instrumented presentation events are not a human combat/accessibility study. All seven captures inspected; broader research remains incomplete.

C055 adds the first personally inspected reference UI atlas:23 publisher media assets,18 structured entries, six source records and six scoped visual claims. All five requested games are covered with PoE1/2 separate; D3's dated2.5.0 illustrations do not replace Campaign and Adventure first-session traces. Actual image dimensions, decorative exclusions, observed controls and untested interactions/errors are explicit. Browser access now works. No new game code, assets, balance, UI style, town or camera changes. Continue ordinary early-flow footage and missing inventory/skill/error states; see ../../research/v2/UI-ATLAS.md.

C056 adds18 sparse, versioned D3 Campaign video frames, a provenance manifest and the initial timeline matrix. Existing Paragon100 and a Normal-to-Hard change make the recording unsuitable for clean first-account pacing. Five atlas entries bring cumulative coverage to24 media assets/23 entries. Actual inputs, first equipment/skill decisions, failures, other games/modes and comparable long-term timing remain open. Source/claim/frame/atlas/roadmap integrity checked; no runtime change or game-test rerun. Continue the whole roadmap; see ../../research/v2/TIMELINES.md.

C057 extends observed early-flow research to Torchlight II: 24 sparse frames, three intro exclusions, six atlas entries and four visual claims. Offer/progress/choice, inventory ownership and context-sensitive vendor wording are distinct observations; exact inputs, durable results, build and clean timing remain unknown. Cumulative 25 assets/29 atlas entries/two recordings/42 samples. No game change or runtime-test rerun; documentation integrity checked. Continue equal-scope footage and independent foundations; see ../../research/v2/TIMELINES.md.

C058 adds21 Idleon guide samples (one intro excluded), ten atlas entries and five visual claims. Allocation, production, collection/equipped contribution, AFK estimate/return and storage/preset context are observed; exact build, inputs, formula, durable outcomes and clean timing remain open. A level8 Warrior contradicts unqualified level10 promotion guidance. Cumulative26 assets/39 entries/three recordings/63 samples. No game or UI change; documentation checks only. Continue TBH/PoE1/PoE2/D3 Adventure footage and independent foundation work. See ../../research/v2/TIMELINES.md.

C059 adds26 Task Bar Hero samples, nine atlas entries and six visual claims. Setup, equipment, stage failure, separate skill investment, Rune prerequisites and Cube selection/preview are observed. Exact build/current protection, input/refund/transaction rules and clean timing remain unverified. Cumulative27 assets/48 entries/four recordings/89 samples; no game or UI change. Continue PoE1/PoE2/D3 Adventure footage, cross-game synthesis and independent foundation work. See ../../research/v2/TIMELINES.md.

C060 adds21 PoE1 Act1 samples,seven atlas entries and five visual claims. Contextual help,pending passive allocation,quest/reward and sale previews are observed. Exact build/final class/account history,actual inputs,support recovery and durable outcomes remain unknown; historical colour rules predate3.29. Cumulative28 media/55 atlas entries/five recordings/110 samples. No game change; continue PoE2/D3 Adventure and cross-game synthesis.

C061 adds22 historical PoE2 frames,nine atlas entries and five visual claims. Skill selection,modifier trade-offs and later support association are separated;old uniqueness text predates0.3. Cumulative29 media/64 entries/six recordings/132 samples. Source resolution changes,presenter obstruction and unknown account/input state limit conclusions. No game changes;continue D3 Adventure,then decision-focused cross-game synthesis.

C062 adds20 seasonal D3 Adventure samples,seven atlas entries and four visual claims. Bounty/activity,slot locks and artisan/Cube states are observed;resource-assisted start,difficulty changes and unknown build limit conclusions. Cumulative30 media/71 entries/seven recordings/152 samples,five introductions/transitions excluded. Bounded priority-game footage pass complete;current/error/durable flows and comparable timelines remain open. Continue per-game digests and decision-focused synthesis.

C063 adds six equally scoped priority-game digests (PoE1/2 separate; both D3 modes explicit), a decision/dependency synthesis and13 versioned caution cases. Existing source/claim/media counts are unchanged; synthesis is not new evidence or G1 approval. Current-coverage notes now reflect the completed bounded footage pass. No game content, system, asset, save, camera, town or UI change. Continue full-catalogue feature comparison, broader digests and a separately designed synthetic objective-state experiment; do not infer new numerical targets. See research/v2/digests/README.md and research/v2/SYNTHESIS.md from the docs root.

C064 adds the full147-feature comparison across seven priority game/mode columns:95 scoped partial-evidence cells and934 unknowns. Every supported cell names its exact subset,claims and unresolved remainder; unknown is not absence. This is catalogue coverage,not feature parity or G1 completion. No game change. Continue broader digests and the separately scoped objective-state experiment; see research/v2/FEATURES.md from the docs root.

C065 completes an isolated objective-state transaction experiment:13 tests cover eight kinds,acquisition versus possession,full-bag retry,pinned definitions and six owned-child crashes during delivery/claim. Online backup reproduces combined state; older restore reinstates old claim eligibility. No live quest,UI,storage migration or reward policy is added. Production identity,event authority,history bounds,party/repeat and recovery remain open. See phase/P01-research/QUEST-STATE-REPORT.md from the docs root; continue broader digests and integration evidence.

C066 adds13 broader-game/economy digests (19 total),six sources and eight scoped claims,including first Immortal/Drakensang incident evidence and a Wolcen date contradiction. Cautions distinguish developer reports,consumer criticism and unverified outcomes. Cumulative173 sources/163 claims;media/atlas unchanged. No game change. WoW/D2R economy digests and broader factual/current-client evidence remain open;continue the whole roadmap.

C067 adds WoW/D2R ownership and migration examples:four sources,eight claims and two digests (21 named games total). All external balance flags remain false;177 sources/171 claims,media unchanged. Existing character stash and runtime remain unchanged. Current trade rules,economic effects,broader matrices,legacy-dossier status and download inventory remain research work; no G1 completion.

C068 reconciles G1 requirements,individually supersedes21 legacy dossiers without changing their bytes,and indexes known historical downloads separately from pending proposals. The147-feature matrix now covers22 game/mode columns with131 partial cells/3103 unknowns. Source/media counts unchanged. Structure is checked; research truth,owner review,current behavior and gate completion are not implied. Continue dependency-specific research and independent supported fixes;see research/v2/G1-AUDIT.md from the docs root.
