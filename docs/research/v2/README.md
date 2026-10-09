# Evidence program — v2

Continuing research, 2026-10-09. **Research is in progress; the full roadmap research gate is not complete.** All 21 charter dossiers now exist, with explicit coverage and remaining questions. This is coverage of the research program, not a declaration that every question is answered. Equal attention to the owner's five requested games means the same questions and explicit gaps, not a ranking by popularity or number of accessible webpages. D3 includes Campaign and Adventure; PoE1/2 are separate; Torchlight II is an added charter, not a substitute name for Infinite.

- [D3](R01-diablo3.md), [Idleon](R02-idleon.md), [Task Bar Hero](R03-taskbar-hero.md), [PoE1/2](R04-path-of-exile.md), [Torchlight II](R21-torchlight2.md).
- [Onboarding research](R15-onboarding.md), [comparison and option brief](MATRICES.md), [contradictions/access gaps](CONTRADICTIONS.md).
- [D4](R05-diablo4.md), [MapleStory](R06-maplestory.md), [Lost Ark](R07-lost-ark.md), [survivors](R08-survivors.md), [Last Epoch / Grim Dawn / Infinite](R09-arpg-builds.md), [case studies](R10-case-studies.md), [economy](R11-economy.md).
- [Technology](R12-technology.md), [accessibility](R13-accessibility.md), [balance](R14-balance.md), [legal/privacy](R16-legal.md), [platforms](R17-platforms.md), [art pipeline](R18-art-pipeline.md), [audio](R19-audio.md), [narrative](R20-narrative.md).
- [Source register](SOURCES.csv), [claim register](CLAIMS.csv), [done / unfinished / next](../../phase/P01-research/STATE.md).
- [Observed UI atlas](UI-ATLAS.md), [structured entries](UI-ATLAS.csv) and [inspected-media provenance](UI-MEDIA.json). C055 covers23 published assets and18 entries; current-client interactions and first-session timelines remain open.
- [Timeline evidence](TIMELINES.md) and [exact sampled frames](TIMELINE-FRAMES.json). C056 adds18 sparse historical D3 Campaign frames and five atlas entries (cumulative24 assets/23 entries). Existing Paragon and a difficulty change exclude clean pacing inference. Other modes/games and current-client interactions remain open.
- C057 extends that record with 24 Torchlight II frames (three intro frames excluded), six atlas entries and explicit version/input limits. Cumulative scope: 25 assets, 29 entries, two recordings and 42 sampled frames. No external balance target or full timeline is certified.

The initial checkpoint asked what creates an early goal, changes a build and carries between sessions. It is now extended across the whole roadmap. Checkpoints preserve work; they do not end the task. Continue with deeper comparisons, actual UI observations, local measurements and supported implementation. Do not manufacture missing progression timelines to make a table look complete.

## Current reading route

Start with the [requirement audit](G1-AUDIT.md) and [game digests](digests/README.md), then [decisions and dependencies](SYNTHESIS.md) and [documented cautions](CAUTIONS.md). C063 synthesizes existing evidence; counts remain167 sources/155 claims/30 media/71 atlas entries/seven recordings/152 samples. Historical updates above and below retain their original scope. Current/error/durable behavior, ordinary timelines and broader G1 remain incomplete.

## Evidence rules

`M` = local measurement; `O` = owner direction; `S` = read primary source; `P` = proposal; `Q` = unresolved. `S2` is an explicit extension for a read secondary source: it is **not** primary verification. `V` = personally inspected published pixels, scoped to visible content; not live gameplay or tested behavior. Source-verified means the source states it, not that a current game client was played. Confidence is scoped to the claim's version. Retrieval date is not publication date.

Depth: L1 overview, L2 documented system detail, L3 independently corroborated or inspected gameplay evidence, L4 reproducible model/measurement. Two pages from the same publisher do not establish independent corroboration. Two community guides with unclear provenance do not automatically do so either. None of this pass's external game numbers are balance-ready. Local L4 measurements describe the existing game, not desirable target values.

Before an implementation: identify the local problem, record evidence and alternatives, define its scope and measurable acceptance, and update the change log with consequences and rollback. The owner authorizes supported decisions without routine approval questions. Preserve UI style and the frozen town. Ask only when a consequential choice lacks evidence or owner direction; keep independent work moving while waiting.

## Reading and licensing

Sources were read as public pages or through the web tool's PDF viewer; C055 adds real Chrome inspection of publisher media. No external art, audio, fonts, game clients, packages or reference media were downloaded into this repo in this pass. No paid service or account creation. Source facts are paraphrased; no reference-game assets or source text ship in the game. A link does not grant an asset licence. The latest owner-supplied AGENTS.md requires explicit name/source/size approval for each download; later asset/tool downloads also need individual licence review and a source/size/hash/purpose/destination register entry.

Not all referenced games' latest 2026 patches are established. Historical patch notes are deliberately labeled historical. No visual UI atlas entry is claimed from a text-only page.

C058 extends observed flow research to Idleon:21 frames (one introduction excluded), ten atlas entries and five visual claims. Cumulative163 sources/135 claims/26 media/39 entries/three recordings/63 video samples. Displayed rates, return totals and later acquisition are kept separate; level8 Warrior contradicts universal level10 promotion guidance. All clean timeline and behavior/error gaps remain open.

C059 adds26 Task Bar Hero frames, nine atlas entries and six visual claims. Cumulative164 sources/141 claims/27 media/48 entries/four recordings/89 samples. Skill investment is distinguished from character level, and Cube input/preview from result. June footage cannot certify September fixes. Remaining current rules, negative/durable flows and comparable time cells stay open.

C060:21 PoE1 frames,seven atlas entries,five visual claims; cumulative165 sources/146 claims/28 media/55 entries/five recordings/110 samples. Pending passive investment is explicit; gem reward and vendor preview are distinct from committed outcomes. Historical colour rule predates3.29. No gameplay change; comparable time and current input/error/durable flows remain open.

C061:22 separate PoE2 samples,nine atlas entries,five visual claims;166 sources/151 claims/29 media/64 entries/six recordings/132 samples. Support choice exposes applicability/trade-offs before visible association;2024 uniqueness text predates0.3 removal. Current error/durable flows and all comparable time cells remain open.

C062:20 seasonal D3 Adventure samples(one transition excluded),seven atlas entries,four visual claims. Cumulative167 sources/155 claims/30 media/71 entries/seven recordings/152 samples. All priority games and requested D3 modes now have scoped historical footage. Current behavior and comparable timing remain open;continue owner-readable synthesis instead of treating source counts as completion.

The [full-catalogue feature comparison](FEATURES.md) now maps all147 features across seven game/mode columns, with exact evidence subsets and explicit unknowns. C064 does not increase source counts or declare complete presence/absence.

C066 adds13 broader-game/economy digests (19 total),six sources and eight scoped claims,including first Immortal/Drakensang incident evidence and a Wolcen date contradiction. Cautions distinguish developer reports,consumer criticism and unverified outcomes. Cumulative173 sources/163 claims;media/atlas unchanged. No game change. WoW/D2R economy digests and broader factual/current-client evidence remain open;continue the whole roadmap.

C067 adds WoW/D2R ownership and migration examples:four sources,eight claims and two digests (21 named games total). All external balance flags remain false;177 sources/171 claims,media unchanged. Existing character stash and runtime remain unchanged. Current trade rules,economic effects,broader matrices,legacy-dossier status and download inventory remain research work; no G1 completion.

C068 widens the feature matrix to22 game/mode columns and reconciles legacy/download/gate status. See [G1-AUDIT](G1-AUDIT.md); structure is complete in more places,factual coverage remains partial. No source count or runtime change.

C070 adds two primary Grim Dawn guide sources and two scoped route/quest claims (179 sources/173 claims total). L81–L83 and adventure/RILLWAKE-REPORT.md in the docs root record the resulting bounded implementation, local measurements, assisted versus normal-health checks and remaining limitations. Media/atlas/timeline manifests remain at C062; G1 remains incomplete.
