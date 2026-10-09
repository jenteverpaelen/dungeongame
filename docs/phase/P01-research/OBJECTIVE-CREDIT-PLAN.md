# Current objective-credit probe — C041

2026-10-09, before harness. Evidence: L51/L52, C040 OBJECTIVES.md, actual authoritative handlers at d0c084f. No production change.

Use actual Instance, createMob, killMob, spawnLoot, updateLoot and transferStash with synthetic PlayerLinks for each existing class. Create a fresh temporary DATA_DIR before importing server runtime, clear BACKUP_DIR, never load or write player saves. Fixture level20, seed73 and constructor random0.25 are reproducible identifiers, not proposed gameplay targets. Set positions and dead flags directly: this measures eligibility after an action, not combat, navigation, collision or human play.

Check ordinary kill credit at zero distance, exactly XP_SHARE_RANGE, one unit outside, living killer outside, dead killer near/far, departed killer, dummy, and noReward. Repeat death calls to check no second count/XP/loot. Compare current saved and runtime counts, cumulative XP, spawned personal loot and dirty notifications.

For each class, fill all60 inventory slots with generated items; create one personal item at the player, exhaust its500ms arming delay, verify the full bag leaves it on the ground. Deposit one existing item using the actual shared transfer helper, acquire the ground item once and repeat pickup calls. Compare exact item objects/IDs across inventory, stash and equipment. This bypasses service dispatch deliberately and does not test NPC proximity.

For each class, put near-alive, far-alive, near-dead and departed players around a controlled guardian. Set the guardian fixture phase directly; call the real death handler. Compare XP/kill eligibility with rift completion count and loot for each player, then repeat death/onKill and require one completion callback. No claim about naturally clearing a rift, reconnect, disk persistence or future party policy.

Run strict standalone TypeScript checking and two complete probes in different temporary directories. Compare normalized observation hashes, excluding output paths, wall clock and ephemeral entity/item identities where appropriate. Preserve pilot failures rather than rewriting them as passes. No browser check is needed for an independent nonvisual research harness; earlier UI observations remain scoped to their own reports. Future work is explicit objective semantics and crash-safe integration, not copying an existing reward loop by assumption. Rollback removes only the standalone harness; no save migration.

Pilot correction: the first run incorrectly asserted that every eligible ordinary monster produces loot. Actual rollDrops permits no drop, and this fixed seed produces none. Preserve that failure, remove the false guarantee and add a matched elite loot/noReward pair per class (elite items/gold are guaranteed by the actual generator). The final probe has39 cases. No production behavior is changed to satisfy the harness.
