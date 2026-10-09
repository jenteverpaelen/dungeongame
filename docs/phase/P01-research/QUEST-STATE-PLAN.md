# Durable objective-state experiment — C065

2026-10-09. L76 precedes code. This standalone experiment is not imported by the game and does not select SQLite for production. Existing account, JSON save, town, camera, UI, combat and reward rules remain unchanged.

## Question and contract

Can a single synthetic actor's objective progress, inventory consumption, reward and replay receipt remain consistent through retry and process interruption? C051 only checks authored definitions. C041 shows why a visible drop or rift participant is not interchangeable with acquired ownership or kill credit. C038 supplies a previously tested atomic storage candidate, not a production integration.

Use the existing eight objective types as trusted, prevalidated fixture definitions. Accept stores a definition snapshot and fingerprint so a later authoring change cannot silently alter an active reward. An event is addressed to one active objective and already qualified by a hypothetical authoritative producer: this probe does not implement combat eligibility, NPC proximity, party sharing or world reachability. Its stable receipt ID must identify that particular qualified credit, not a restart-reused entity ID. It is not a client command API.

For the fixture, kill/wave counts increment on distinct events; reach/talk/service/rift match their exact fields and threshold. Collect means a successful new inventory acquisition in the same transaction. Deliver removes the required owned items in that transaction. Collection history survives subsequent delivery. These semantics are experimental alternatives, not selected live quest policy. All event quantities, bag capacity and rewards are synthetic inputs, not balance targets.

State moves from absent to active to ready to claimed. No event before acceptance earns retrospective credit. A duplicate actor/request with identical intent returns the recorded result; changed intent is refused. Wrong target/kind earns no progress. Full inventory or missing delivery items refuses the operation without saving a success receipt, allowing the same intent to be retried after the condition changes. A new claim ID cannot award an already claimed run again.

Claim atomically checks readiness/capacity, grants the pinned reward, marks claimed and writes its receipt. Reward IDs derive from the unique fixture run; overflow/duplicate IDs must refuse the entire mutation. No live RNG, currency exchange, accounts, abandoned/repeated quests or multicharacter transaction is modeled.

## Verification

Use installed Node24.19.0 SQLite with WAL/FULL, foreign keys and explicit transaction checks; no downloads. Each test/check gets fresh isolated DATA_DIR, empty BACKUP_DIR and BACKUP_KEEP=0. Databases stay in a marked temporary root. No real saves are read. Verify all eight kinds and mismatches, acquisition versus possession, full bag, missing delivery, request conflicts, different actors, definition changes, restart and safe-integer reward limits.

Terminate only harness-owned child processes after the actor update, after receipt write/before commit, and after commit/before response. Run these boundaries for both item delivery and reward claim. Reopen normally without deleting WAL, check integrity and exact actor/receipt state, then retry. Compare an online backup with all state and demonstrate that restoring a pre-claim backup also restores claim eligibility. This is process-crash evidence, not power-loss, disk-full, throughput, multiple-writer fairness or cross-restore deduplication proof.

Standalone strict TypeScript and targeted tests are appropriate: no production import or UI change means no game screenshot or full-runtime regression claim. Inspect imports and diff scope. Keep failed pilot output if checks fail. A full P5 implementation still needs authenticated identity, durable event production, schema migration, bounded history, repeat/party policy, live adapters, recovery operations and real-browser quest UI.

## Alternatives and rollback

A pure reducer test cannot demonstrate durable commit; writing progress and rewards separately risks partial state. Reusing live JSON saves would prematurely choose migration and ownership policy. The isolated combined-row SQLite experiment asks the narrow question without doing so. It may later be discarded. Rollback removes the independent experiment; no player content or data is removed. Gate G1/P5 remains open.
