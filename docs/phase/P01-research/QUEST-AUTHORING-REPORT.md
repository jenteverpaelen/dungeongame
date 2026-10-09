# Quest authoring probe — C051 results

2026-10-09, Windows on the owner's PC, Node24.19.0. Protocol: [plan](QUEST-AUTHORING-PLAN.md), L62. Live baseline8db5e26. No game module imports the prototype or its fixtures.

## Measured

Standalone strict TypeScript checking and all14 tests pass. Fresh isolated root: `C:\Users\LaptopJente\AppData\Local\Temp\hf-quest-authoring-e70f5cce183a4aafbc3e1c7984d6ce73`; DATA_DIR is its empty `data` directory, BACKUP_DIR unset. [Exact test output](checks/quest-authoring/tests.txt). No failed pilot, package download, server, browser or real character access.

The three original synthetic records cover all eight requested objective shapes. References, message ownership/nonempty values, NPC/service pairs, missing capabilities, safe integer quantities, reward keys, all-required prerequisites and definition identity are checked without mutating input. The branching fixture passes all four combinations of its two fixed boolean facts.

| Adversarial fixture | Observed result |
|---|---|
| Cyclic prerequisites, including a self-reference | Refused; downstream blocked quests also identified |
| Missing talk/delivery/wave capabilities | Refused even though the objective names and target IDs exist |
| Unknown/inherited messages and dangling targets | Refused with definition paths |
| Fractional, nonfinite, unsafe or negative counts | Refused; zero count also refused, while the separate difficulty field allows zero |
| Conditional sole exit | Unconditional graph reaches both nodes; two of four supplied states have no exit and are refused |
| One branch loops forever; another exits | Both affected states identify the trapped branch, despite entry retaining an exit |
| Optional loop with an exit | Accepted in all supplied states |
| Orphan nodes, terminal outgoing choices, contradictory/unknown facts or absent state samples | Refused |

These results concern existence of an exit path, not forced termination: a player can choose an available loop repeatedly. Enumerating four fixture combinations is exhaustive only for these two fixed booleans. It is not a proof of the full game's possible states.

## Source provenance

The read ink sections are pinned to35c63e52f1d36060930dc7ed3cfba38ea224b528. Direct HTTPS text comparisons confirm the read master documents match that commit: RunningYourInk21,673UTF-8 bytes, SHA256 `94031c0de03ffa6f9109728f4fe11e05ddc3fdd7e9f05dd52251ee93c9f859ba`; WritingWithInk123,666bytes, SHA256 `0555b6ac648055967fd2c1b636d32e47180d6c4e69f2cb09144ecf5278fb5ecb`. Only the sections named in the source register were studied; fetching whole text is not a claim to have reviewed every language feature. Yarn's read page identifies Godot3.2. Neither package, code examples nor reference prose was copied into the game.

## Scope and next integration work

This prototype validates typed trusted authoring input; it is not a structural parser for arbitrary uploaded JSON. Its synthetic capability catalogue does not certify live targets, spawn availability, reachability or authoritative handlers. Kill family filters, mutable/consumed choices, repeat/party policy, objective history, inventory consumption, durable reward claims, save migrations, UI and content cost remain open. Its fixture rewards/IDs/text are not adopted gameplay content. `content:check` remains unchanged until a production schema is selected.

The result sharpens Claude P5's finishability requirement: static references and prerequisite cycles can be checked early, while conditions, world placement and stateful effects require explicit state/runtime coverage. Preserve server ownership; rendering or repeating a line must never itself award an item. Next work should establish the durable event/reward contract against C038/C041 before live quests. No existing game content was deleted. Rollback removes the independent scripts while retaining this evidence. No full P5 or research gate is complete.
