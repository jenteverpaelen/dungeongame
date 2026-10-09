# Connected adventures — C071 work plan

Status: implemented; scoped results and remaining work are in QUEST-CHAIN-REPORT.md. This is the next bounded delivery within Claude P5/P7, not completion of either phase or the roadmap.

## Evidence and decision boundary

L84 in `docs/town/REFERENCES.md` records the sources read before implementation. C051 validated authoring shapes; C065 tested transactional quest state in an experiment. C070 delivered one live, special-case quest. Its flags and reserved item already survive reconnects. The next implementation must preserve that exact state and reward, including completed characters.

The local gap is measurable in code: one hard-coded panel, one quest-specific command and no prerequisites, selected tracker, journal catalogue or field-to-field travel. Implement reusable revision-pinned definitions and sequential server events for the objective kinds this chain actually uses: interaction, local qualified kill and reaching an authored location. Other C051 kinds remain experimental until their real server event and ownership paths are integrated and tested. Do not claim eight production objective kinds.

## Content and scope

1. The Silent Wheel keeps its original state, sequence and magic weapon reward. An adapter reads/writes `save.rillwake`; no duplicate authoritative state and no reroll/migration.
2. High Water becomes available from Orren after that return. Survey the existing optional ridge and inspect a new survey marker at the existing overlook; report to Orren to unlock a connected upstream area. The reward is access, not an invented currency amount.
3. Under the Spillway follows the new route into Bracken Sluice: approach, boss encounter, floodgate inspection, return. Reuse existing combat and item generation before considering any retune. Boss policy and normal-health results must be recorded before shipping.

Original names, prose and geometry are composition, not copied or externally measured facts. Reuse the current renderer and collision. Keep Hearthmere, camera, UI materials, skills and existing procedural fields unchanged.

## State and authority

New quests use optional per-character state, pinned definition revision, ordered progress, completion and a reserved reward. NPC actions always require the actual zone, living player, proximity and line of sight. Never accept client-supplied kill/reach/completion events. Kill credit follows C070's local living witness policy, excluding dummy/noReward/debug targets. Reach credit comes from server positions. Prerequisite and travel checks run on the server. Rewards and completion mutate the same character before its existing save boundary; this is not cross-restore exactly-once persistence.

## Verification and rollback

Test old saves and reserved rewards, out-of-order/wrong-zone/remote actions, full bag, duplicate claim, nearby/dead/remote witnesses, prerequisite bypass, restart, continuous route clearance and deterministic generation. Inspect the running journal and connected route at 1920×1080 on this PC. Infinite HP is for browser inspection only; measure normal-health combat separately. Keep all test data isolated.

Record additions/removals and open work in the Codex ledgers. No content is deleted. Rollback can remove the new catalogue entries/zone while retaining optional save fields; the legacy Rillwake adapter remains readable by C070. No new dependency, asset download or storage migration is required.
