# Objective credit: measured current behavior — C041

2026-10-09, Windows on the owner's PC, Node24.19.0. Production baseline d0c084f. Research-only harness; town, UI, camera, combat and saves unchanged. Protocol: OBJECTIVE-CREDIT-PLAN.md / L52.

## Measured

Two independent runs each pass39 scenarios:11 kill cases, one full-bag pickup case and one four-member rift case per class. Normalized observation SHA256 is identical: `3521e9d0fc86784b4a08d3d75b475c84054657cc2dde212db630f8b36bb36609`. Strict standalone TypeScript checking passes. This is an action-handler measurement, not a performance benchmark.

| Controlled condition | Actual result in all three classes |
|---|---|
| Living witness at0 or1400 units | One saved/runtime kill and XP credit |
| Living nonkiller at1401 units | No kill or XP credit |
| Living registered killer at1401 units | One kill and XP credit |
| Dead killer near/far; departed killer | No kill or XP credit |
| Training dummy | No world death, saved kill, XP or loot |
| noReward ordinary/elite death | XP and kill credit retained; no spawned loot |
| Matched elite control | XP and kill credit plus spawned personal loot; each class's noReward pair has the same XP |
| Repeated kill call | No additional counters, XP, loot or dirty notification |
| Ground item with full60-slot bag | Remains on ground; no acquisition |
| Deposit one existing item, then pickup | One acquired item,60 bag items,1 stash item; all65 original owned items byte-equivalent,66 final owned items |
| Repeated pickup update | No additional acquisition or save mutation |
| Guardian completion: near living player | Kill/XP credit, completion and ground rewards |
| Guardian completion: far living or near dead player | Completion and ground rewards, no kill/XP credit |
| Guardian completion: departed player | No credit/reward |
| Repeated death/completion call | One completion callback; player results unchanged |

Fixed-seed ordinary monster drops happen to be empty. The pilot wrongly required every eligible death to spawn loot and failed before completing a case. Actual rollDrops permits no drop. Corrected the harness and added matched elite control/noReward cases; no game change. The failed report is retained.

## Evidence and limits

`checks/objective-credit-pilot.json`: `hf-objective-credit-X8IDHf`, failed assumption above. `checks/objective-credit.json`: `hf-objective-credit-sArEwj`,39pass. `checks/objective-credit-repeat.json`: `hf-objective-credit-DozCwB`,39pass. All roots are under `C:\Users\LAPTOP~1\AppData\Local\Temp`; each has its own empty DATA_DIR and no BACKUP_DIR. Only synthetic observations were copied into the repo.

Fixtures use generated characters/items, level20, map seed73 and constructor random0.25. Raw positions/dead flags and guardian phase are deliberate setup. No attacks, pathfinding, party system, natural rift clear, server socket, persistence/crash, NPC service proximity, browser or human comprehension is tested here. The stash helper is called directly; this does not bypass or validate the production command guard. Random drop counts are fixture observations, not drop-rate estimates.

## Design implications [inferred, not implemented]

Future objectives must deliberately choose eligibility per action. Reusing XP witnesses for rift objectives would change existing completion behavior; using rift membership for kill objectives would include currently ineligible players. Item drops, owned acquisition, stash movement and present possession require distinct semantics. These facts support explicit event contracts and duplicate/durability tests, not an assumed party/reward policy. No new quest, count, reward, timer or balance target is selected. Reconnect, persisted completion, delivery atomicity and authored UI remain open. Rollback removes the independent probe; preserve evidence history.
