# Objective evidence and integration map — C040

2026-10-09, solo. Same questions for all five requested games; PoE1/2 remain separate. This is research preparation for P5/P6, not a new quest engine, copied chain or completed G1/G4 gate. Sources/claims resolve through the CSV registers. No new reward/count/timer target selected.

## Reference comparison [S unless marked]

| Reference | What counts / continuity evidence | Player feedback / authoring evidence | Still unverified |
|---|---|---|---|
| D3 PC Campaign + Adventure | D3-12 documents a journey objective spanning games and a particular bounty's qualifying area being changed | Travel location and eligible targets were adjusted together | Campaign state graph, current sharing/re-entry/reward rules; beginner timings and observed screens |
| Idleon | IDLE-06 reports a timed task's actual duration disagreeing with its promise; IDLE-03 is only secondary task-sequence evidence | A timer is part of the condition players need to understand | Current quest journal/claim flow, offline eligibility, exact build/year of rolling feed |
| TBH | TBH-04 describes reward waits incorrectly resetting across stage changes/relaunch; this is a reward-system example, not evidence of a quest engine | TBH-06 documents pending-server feedback | Objective model and tutorial sequence, current timer behavior; no invented analogue to a conventional quest journal |
| PoE1 | POE-07 separates quest-state travel eligibility from party membership | Historical proposal identifies the blocking quest in the disabled travel affordance | Current implementation and eligibility/reward sharing; no PoE2 extrapolation |
| PoE2 | POE2-04 reports completion without required interaction/boss kill, including previously affected progress | Completion presentation alone cannot establish the qualifying action [inference] | Full objective graph and current party/reward rules |
| Torchlight II PC | TL2-10 documents injecting active/completed states in GUTS playtests | Runic's linked older tutorial separates dialogue stages, journal and HUD text (NARR-02) | Tutorial generation ambiguity, final schema/runtime, save/re-entry/reward behavior and inspected player screens |

Runic's Quests tutorial still says TorchED despite the April2013 GUTS index linking it. Dungeons explicitly mixes TL1 and uncertain TL2 details; its claim about multiplayer reset is not accepted here as a final TLII rule. Quest Editor is a missing redlink. Documentation provenance matters as much as the appealing example.

## Current Hearthfall integration map [source observed, not yet runtime measured here]

Baseline for this audit:3d4567e. Named files/functions are the source of these statements, not assumptions about reference games.

| Proposed objective family in Claude P5 | Current authoritative location | Semantic boundary to establish before integration |
|---|---|---|
| Defeat a monster/type/family in a zone | sim/kills.ts killMob; Instance.playersNear | Existing XP/loot witnesses are alive nearby players plus a living same-instance killer outside range. This is not party membership. Dummy/dead duplicates return early; noReward only suppresses loot currently |
| Collect an item | sim/loot.ts updateLoot after addToInventory succeeds | A spawned ground drop, full-bag failed pickup and actual owned acquisition are distinct; later stash/salvage must not be mistaken for a new acquisition |
| Reach a place | World.enter after successful placement; authoritative simulation position | Failed transfer/recovery and merely requesting travel do not prove arrival; a zone visit differs from reaching a subregion |
| Talk to an NPC | No server talk command found; client game.ts interact opens panels/bark | Client proximity/panel opening is not verified dialogue completion. Server-owned NPC identity/position and current dialogue state would be required |
| Use a service | commands.ts successful handler after requireNear | Opening UI or rejected/replayed commands cannot count as another successful operation; recipe roll and final choice are separate actions |
| Complete a rift at a required rank | RiftRuntime.complete after matching guardian death; World.onRiftComplete closes portal | Current field is difficulty, not a separate Greater Rift rank. Completion increments all present players, unlike the nearby/living XP witness rule. Eligibility needs a deliberate policy |
| Deliver an item | No delivery command found; existing inventory/stash operations provide ownership lookup | Validate quantity/current possession and consume/reward atomically; no client-declared possession or snapshot-only credit |
| Survive a wave | No wave objective/controller found | Define start/end, alive/present eligibility, disconnect and restart semantics before any timer/reward |

Existing GameEvent is presentation/AOI output; PlayerLink exposes mutable saves and dirty notifications. Neither is a durable objective journal. Entity IDs restart with a process; raw monster/command IDs cannot alone identify an event across reconnect/crash. Existing connection receipts prevent repeated execution only on that connection. C038's candidate transaction is not production integration.

## Inferred acceptance cases, not selected gameplay policy

Keep event credit, current possession, objective readiness, reward claim and completed history distinct. Preserve a qualifying action and its reward decision across the required save boundary. Test duplicate delivery, changed request payload, crash before/after commit, full bag, leaving during dialogue, re-entry, old backup restore, party join/leave and missing authored targets. Explain a blocked requirement with its actual condition; do not guess reference timings or add a quest count to match another game's density.

Next: controlled current-game eligibility probes; a small declarative schema comparison; explicitly chosen party/repeat/reward rules; localized original fixture text and UI states in the existing style. No bulk story, new NPC, new field layout or cadence change follows from this research. Rollback is documentation-only.

C041 follow-up: [actual-handler credit report](../../phase/P01-research/OBJECTIVE-CREDIT-REPORT.md) measures39 cases across all classes twice with identical observations. It confirms the different kill/rift eligibility and distinguishes full-bag ground items from acquired ownership. No persistence/party policy or quest system is implemented by that probe.

C051 follow-up: [authoring probe](../../phase/P01-research/QUEST-AUTHORING-REPORT.md) exercises typed references, capability declarations, cyclic prerequisites and finite conditional dialogue states. It covers all eight shapes with synthetic records, not authoritative runtime implementations.14 tests pass; production schema, state ownership, durable reward and party policies remain open.
