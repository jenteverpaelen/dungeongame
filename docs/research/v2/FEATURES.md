# Full-catalogue feature comparison

C068 update, 2026-10-09; evidence before mapping: L75/L79. [Matrix CSV](FEATURES.csv) contains every147 feature ID from Claude's unchanged §8 catalogue, across22 game/mode columns: the seven priority columns plus15 broader reference/economy games. Every named game in the digest index is included; D3 modes and PoE1/2 remain separate. The title remains identical to the catalogue/status ledger.

Of3234 cells,131 have **partial evidence** and3103 are **unknown**. These are research-coverage counts, not a completion percentage or comparative game score. The [evidence CSV](FEATURE-EVIDENCE.csv) gives each supported cell's game, feature, claim IDs, exact supported subset and unresolved remainder. Claims resolve to versioned sources in [CLAIMS.csv](CLAIMS.csv) and [SOURCES.csv](SOURCES.csv).

## How to read a cell

- `Q`: this pass does not establish presence or absence. A missing observation is never recorded as absence.
- `FE-…`: a scoped partial match. Follow its evidence row before treating it as a design reference. Every current row is partial because the catalogue often bundles several behaviors into one feature.
- No full-presence or full-absence claim has been made. A future such claim needs explicit source scope covering the complete feature and version; pixel similarity is insufficient.

Examples: item comparison does not prove item links in chat; a sale preview does not prove buyback; character setup does not prove deletion grace or account ownership; a manual backup article does not establish automatic rotation; a patch fixing an objective is not a specification for authoritative party sharing. D3 class-guide facts apply to both mode columns but are a single evidence source, not independent corroboration. PoE1 and PoE2 remain separate even when catalogue labels are shared.

## What to do with the gaps

| Gap family | Next evidence route | Consequence now |
|---|---|---|
| Identity, command replay, storage and operations | Current primary engineering guidance plus local failure/restore experiments | Public game screenshots cannot establish internal architecture. Continue P3's bounded work; do not infer a backend from a feature being visible |
| Build and modifier decisions | Existing class tables, observed choices and local runtime-helper probes; targeted current recovery evidence | Keep current skills/refunds. Full tables and human evidence are needed before progression changes |
| Quests and rewards | Observed offer/progress/claim distinctions plus C040/C041 authority boundaries and C051 authoring checks | C065 now tests isolated durable state; actual production event authority,identity and recovery remain open |
| Loot/economy | [Loot matrix](LOOT.md), source conditions, measured local generation versus acquisition | Do not use rare-item screenshots as drop rates or finite-bag income as unconstrained yield |
| Social, endgame, live operations and platforms | Versioned subsystem rules, current flow/error observations and later phase-specific experiments | Do not adopt an entire system simply because it appears in the catalogue; scope remains undecided |

This supplies structural coverage for every named reference game; factual coverage remains partial. A public incident or marketing description supports only its named subset, never internal architecture or complete presence. The [Hearthfall implementation ledger](../../CODEX_ROADMAP_STATUS.md) is separate. No cell changes its status or approves a feature for implementation. No game code, balance value, content, asset, setting or save changes here.

Validation: every feature exactly once; 22 complete columns; one evidence record per supported cell; no unused/duplicate evidence; game/feature match; claim/source references resolve; original roadmap hash and273-ID ledger unchanged. [Recorded check](../../phase/P01-research/checks/timeline-gate-audit.json). G1 remains open.
