# C093 — resource history and economy policy

Evidence before implementation: REFERENCES L113, DECISIONS D051, and [currency map](CURRENCY-MAP.md). C092 delivered the stock loop. This checkpoint delivers the bounded character resource history and closes optional v1 policy choices; P8 acceptance remains open.

## Implemented

- Actual acquisition and payment deltas for gold, five materials, thirty gem/rank combinations and equipment count. Twenty-one fixed activity categories; no expanding event timeline, account identifier or external telemetry endpoint.
- Server hooks on successful economic commands, actual ground pickup and offline grants. Generated, expired, rejected and full-bag loot do not count as acquired. Full-bag rejection skips the new custody scan.
- Gems include loose and socketed gems across equipment, inventory, stash and retained buyback. Transfers conserve these totals; fusion records rank conversion. Each operation records a net delta per resource, not every internal creation/destruction during a replacement recipe.
- Debug grants and changes outside observed operations have separate categories. An unexplained change or safe-integer counter saturation marks history incomplete. The summaries never authorize a purchase, rebuild wealth, or repair a balance.
- Optional save10 record, protocol13 and synthetic v10 fixture. Old wealth becomes the opening balance at the first observed change, without invented historical income. Unsupported/malformed histories remain preserved and do not block gameplay. New records use fixed keys and nonnegative safe-integer counters.
- Character Details → Economy shows balances and paged activity breakdowns in the existing style. Received/Used exclude debug and unattributed changes, include offline gains/conversions, and are not an earning-rate estimate. Owned includes all retained custody.

## Scope decisions and effects

D20 retains binding/protection and bound-item NPC sale/buyback; it does not certify future player trading. D22 excludes repair/durability, consumable upkeep and chance shops from economy v1; globes and regeneration remain. No new travel/respec tax. D24 retains the approved60-slot character stash. D25 retains distinct physical artisans and existing Cube progression without inventing separate leveling currencies. These are explicit optional scope decisions, not newly implemented features.

No existing game content, currency or reward was removed. Reopening excluded systems later requires a new source/sink design; no migration/deletion is needed today. Town, camera, pricing, drop/XP rules and UI materials remain unchanged.

## Measured verification

-19 distinct focused checks passed:6 economy,4 affected merchant-stock checks,9 save foundations including v0–v10 fixtures. The6 economy checks were repeated once after skipping unnecessary full-bag snapshots.
- Typecheck passed; production build passed. Main JS1,232.62kB, gzip400.87kB. Existing large-chunk warning remains.
- Owner-PC Chrome1920×1080: inspected [balances](HISTORY-PREVIEW.jpg) and [source list](HISTORY-SOURCES.jpg), both without scrollbars. The activity detail was also verified through accessible UI text. These are labelled synthetic presentation fixtures, not live economy evidence. The source-list image precedes a singular/plural copy correction.
- Every runtime check used a fresh isolated temporary DATA_DIR with backups disabled. Browser preview uses in-page synthetic data and no server/save.

## Still unverified / next

No sustained100-player performance, full playthrough, live economic distribution or global inflation claim. Existing debug grants being separate does not make subsequent play on a debug-assisted character valid balance evidence. No historical earnings backfill or gold/hour inference. Existing queued atomic JSON writes still do not provide commit-before-ack, crash-durable command receipts or a multi-process ownership guarantee. Continue production transaction safeguards, measured active/offline distributions, and human economy/independent review before P8 completion.

Rollback: stop recording and hide the optional UI while retaining saved history and actual balances. Do not downgrade or delete newer saved records. Older protocol clients should reconnect with the matched build.
