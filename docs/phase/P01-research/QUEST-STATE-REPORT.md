# Durable objective-state experiment — C065 results

2026-10-09, Windows on the owner's PC. Baseline80514ce; [plan](QUEST-STATE-PLAN.md) and L76 preceded implementation. [Candidate](../../../scripts/experiments/quest-state.ts) and [tests](../../../scripts/experiments/quest-state.test.ts) are standalone research code. Production remains the existing JSON game; no live quest, reward, account migration or UI is added.

## Measured

Standalone strict TypeScript passes. All13 targeted tests pass, including six forced child-process terminations. Runtime Node24.19.0 and SQLite3.53.3. Each connection checks WAL, FULL synchronous=2, foreign keys enabled and busy_timeout=0. Tests use `hf-quest-state-ac0c20cd37944b54b8adffd708205044` under the owner's temporary directory; typecheck uses its own fresh isolated root. BACKUP_DIR is empty, BACKUP_KEEP=0. [Exact test output](checks/quest-state/tests.txt), [integrity and scope record](checks/quest-state/report.json).

| Scenario | Observed result |
|---|---|
| Eight objective kinds, reopening after each credit | Counts persist; exact fields and minimum difficulty distinguish matching credit |
| Wrong fields/kind, wrong actor, premature claim | No objective/reward mutation; changed intent cannot reuse a receipt |
| Event before acceptance, retried after acceptance | Original ignored result retained; no retrospective credit |
| Actor/request scope | Another actor cannot replay the first actor's event; independently qualified credit with the same request string stays separate |
| Collection followed by delivery | Owned item consumed; collection history retained; duplicate delivery does not consume again |
| Same acquired item under a new event ID | Refused by retained acquisition history in the fixture |
| Full inventory or missing delivery item | Entire operation refused without partial state or success receipt; identical intent can retry after another operation resolves the condition |
| Pinned definition and reward overflow | Changed accepted definition refused; unsafe reward sum leaves gold, items, progress and receipts unchanged |
| New claim request after a completed claim | Already-claimed result; no second reward |
| Online backup and reopen | Both actor state and all receipts equal the source |
| Pre-claim backup restored | Ready state and absent claim receipt return; the claim can run again in that restored history |

Crash matrix, applied separately to delivery and reward claim:

| Owned-child termination point | Reopened state | Retry |
|---|---|---|
| After actor update, before receipt | Exact previous actor and receipts | One complete operation |
| After receipt, before commit | Exact previous actor and receipts | One complete operation |
| After commit, before response | Actor, inventory/reward and receipt committed together | Same recorded result, no second mutation |

WAL remains present after all six forced stops and is recovered normally; the harness never deletes it. Integrity and foreign-key checks run when snapshots are compared. Tests finish without a failed pilot. Reported test durations are execution costs, not a game-frame, server-load or storage-throughput benchmark.

## What this establishes, and what it does not

The combined transaction boundary is feasible for these synthetic single-actor operations. It provides a concrete candidate for progress/delivery/reward consistency. It does not select a production backend or establish authenticated quest authority. The hypothetical event producer must still qualify actual kills, ownership, NPC proximity and rift participation and issue durable unique credit IDs. Current entity IDs/AOI messages cannot simply be reused. C041's differing kill/rift eligibility remains a policy dependency.

The probe accepts trusted typed definitions/events; it is not an untrusted JSON parser. Accepted definitions are snapshots, not a content migration system. Inventory uses synthetic nonstacking items; acquisition/receipt history is unbounded. No party, abandon/repeat, choice reward, random roll, multi-entity trade, writer queue, durable event outbox, history retention or production save migration is implemented. No concurrent-writer, load, disk-full, hardware/power-loss or production-host test is claimed. C038's separate writer experiment remains separate evidence.

Restoring older state invalidates any promise of exactly-once effects across histories. If a future operation can transfer value outside the restored actor/database, recovery must reconcile both sides and revoke/review affected claims. This experiment does not solve that operational policy. No reward counts or prices from the fixtures are gameplay proposals.

**Future:** decide the production identity/storage/event boundary and party/repeat rules before live integration; then test actual command adapters and browser empty/active/ready/full-bag/retry states. Continue broader game digests and current-error research where those decisions require it. P5/G1 are still incomplete.

**Removal/rollback:** no existing content, system, asset, setting or user data removed. Remove these independent scripts to discard the candidate; keep the evidence. No real saves were read, copied, migrated or modified. No new dependency, download, live server or browser run was needed.
