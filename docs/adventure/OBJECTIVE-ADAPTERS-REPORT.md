# Counted objective adapters — C074

Implemented2026-10-09 on the owner's PC, solo. L88 and OBJECTIVE-ADAPTERS-PLAN.md preceded code. Claude P5, C041 actual credit/pickup boundaries and C065 acquisition-versus-possession evidence support these hooks. This is engine implementation; no additional authored quest or reward amount is claimed.

## Added semantics

Quest steps can require a positive safe-integer event count. Optional saved progress defaults to zero, must remain below the requirement and resets on advancing. Legacy Silent Wheel flags remain authoritative; its validator forbids multi-event steps the old flags could not represent. Current three definitions and their revisions remain byte-unchanged.

Kill objectives may filter a monster type at an authored encounter site. All spawned members receive site identity; the old specifically tagged boss identity remains separate. Living, local, registered witnesses only; dummy/noReward/debug sources stay excluded. Normal kill processing already prevents a second death call from emitting another event.

Collect objectives credit owned ground items only after inventory insertion succeeds, optionally filtered by base. A full bag does not credit or remove the drop; retry after making space succeeds once. Existing carried items, stash moves and direct debug grants do not emit pickup credit. This records acquisition history, not current possession. The authored target is a guidance location; qualifying pickups may occur anywhere in that zone. Delivery/consumption is still separate future work.

Service objectives specify the actual authored NPC and an allowed operation. Credit follows successful command validation/mutation and proximity. Bulk salvage counts one operation, not its item count. A paid Empower attempt counts even if its chance roll does not upgrade the item: the operation/cost occurred. Keeping the original enchant option finalizes that operation. Panel opens, failed commands and no-op power re-selection do not count. No client objective-credit endpoint exists.

No current quest, item, zone or save is removed. New state is optional; old adapters ignore it safely. No reward formula, economy amount, authority policy, world art, town, camera or dependency changes. No downloads. The three existing quests still exercise their original one-event paths.

## Focused evidence

Typecheck, content checker, production build and16 focused tests pass: all legacy/connected quest cases plus the new real World/kill/pickup/command integration fixture. It tests wrong monster type, noReward, repeated death, partial count save/load, full-bag refusal, retried/repeated pickup, remote/missing/repeated service and two successful service actions. Definition/state checks reject unsafe counts and invalid filters. Existing four-client living/local credit coverage remains. Tests deliberately position and prepare synthetic players; this is not a normal gameplay walkthrough or full phase acceptance.

DATA_DIR was isolated at temporary hf-adapters-0f2dae07a3bb411a9a69cd2c64a74f8e; backups disabled. First typecheck exposed that the session's InstanceApi does not expose simulation players. Service credit was corrected to use that API's authoritative canInteract and session change path, with no unsafe cast or API widening. Existing Vite warnings remain. No repeated full suite, browser combat tour or new pixel claim: current authored content/UI states are unchanged until definitions opt into these adapters.

## Remaining and rollback

Live kinds now cover interaction, reach, kill, item acquisition and service; eight-kind P5 acceptance is still open. Talk-specific semantics, delivery, rift/wave completion, broader rewards, repeat/party policy, character-state bounds and cross-restore durability remain work. Future new quests must justify their counts/rewards independently of this fixture.

Rollback removes new hook calls and optional definition fields, retaining character progress fields and current three quest definitions. If content begins using a new kind later, remove or migrate that content deliberately before rolling the engine back. No production storage migration was introduced.
