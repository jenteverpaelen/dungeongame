# P5 chapter closure — C087

2026-10-09, solo. Complete the implementation scope in Claude P5, not bulk P7 story or the human P6/G5 acceptance. Town geometry, camera and established UI styling remain fixed. L101/D042 precede code.

## Evidence and scope

The five-game comparison in `docs/research/v2/OBJECTIVES.md`, R20, the C051 typed-authoring prototype and C065 transaction probe distinguish action, readiness, claim and saved ownership. Recorded D3/TLII/PoE interfaces distinguish offers, current objectives, return contacts and claims. They do not establish hidden sharing/reward algorithms. Production code is the authority for current Hearthfall values.

Close the following as one integrated chapter:

- All eight Claude objective families, including explicit server-verified NPC conversation and monster family filters. Existing inspect-object steps remain supported. Collect objectives name a guidance site but count owned acquisitions anywhere in their declared zone; make this explicit rather than silently implying provenance.
- Declarative XP/gold/item/unlock reward bundles, monotone story flags, chapter metadata and repeat policy. Preserve all four existing quests, rewards, revisions and legacy Silent Wheel storage. No new live XP/gold reward or repeatable farm is introduced. Generic capabilities use synthetic fixtures.
- Repeatable quests explicitly restart at their giver. A saved cycle token rejects stale commands across cycles; one bounded state and completion count per quest retains permanent unlocks. No timestamps, daily reset, arbitrary cadence or unbounded receipt log.
- Formal sharing: accepted personal state; kills credit living nearby witnesses (or an authored killer-only objective), rift clears credit current run members as today, pickups/services/talk/delivery/reach are personal, dungeon waves retain living initiator rules. No retroactive accept/join credit. Exclusive social parties belong to P10; current cooperative field/run membership is exercised with four clients.
- Conditional read-only dialogue with an unconditional exit from every node. Only explicit validated objective/claim commands change progress. Positive story flags derive from completed quests; dialogue cannot mint rewards.
- Journal filters/search, chapter progress, completion history, saved-reading lore view, empty/long/many states, NPC availability/turn-in markers and shared map/minimap pins. Reuse existing original prose for discovered records.
- Conservative content validation: flag producers, prerequisite/world-unlock closure, dialogue routes, targets, supported rewards and objective feasibility. Reject unsupported/impossible authoring rather than claim arbitrary scripts or randomized outcomes can be proven finishable.

## Verification / completion boundary

Focused tests cover new rules and all objective families, stale/repeated/remote/malformed actions, full bag and numeric overflow without partial awards, legacy/current save reload, four-client eligibility and authored content validation. Inspect actual local Chrome at 1920×1080 with infinite HP for UI traversal. Existing C070–C079 tests remain the baseline for physical progression. No full campaign replay for unchanged combat.

Report implementation completion separately from owner feel/playtest, G5 with P6, later real story/bounties, timed-rift ranks (current game has difficulty indices), and cross-history restore guarantees. The latter cannot be fabricated from an atomic local save. Rollback disables new authoring/UI while retaining versioned save readability; never discard player rewards/history.
