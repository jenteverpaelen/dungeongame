# Connected adventures — C071

Implemented 2026-10-09 on the owner's Windows PC, solo. This advances Claude P5/P7; neither phase nor the full roadmap is finished.

## Added and preserved

Three data-authored quests now share a journal, selected tracker, physical conversations and server event handling. The Silent Wheel retains its existing save flags and exact reserved reward through an adapter. High Water surveys the ridge and opens Bracken Sluice. Under the Spillway follows its causeway to the Rootbound Keeper and floodgate, then returns to Orren. A branching conversation is data, not embedded script. J opens the journal; old custom bindings retain priority.

Bracken Sluice is a second original authored area, 56×48 tiles. Four fixed encounter sites contain15 initial enemies. Its named boss combines the existing rare Mossback stats/rewards and slam with guardian ring/enrage behavior, without summoned adds or a guaranteed legendary. Existing forest/body art is reused and remains first pass. Route/prop positions were corrected when actual swept-clearance checks exposed three obstructions. No global combat numbers were changed.

Interaction, qualified local kill and server-position reach are the three live objective kinds. Prerequisites, revision validity, physical proximity/LOS, ordered progress, full inventory and repeated claims are checked server-side. The last objective reserves a weapon once; completion and the item are stored together in the existing character save. Unknown revisions are retained, not silently reset. The C065 experimental transaction store has not replaced production persistence.

Replaced the single-quest panel/handler with the catalogue/engine; the old command remains a compatibility adapter. No previous quest, zone, item, character, skill or reward was deleted. Town, camera and existing UI materials remain unchanged. No download or dependency was added. Evidence recorded before design: L84/L85 and D028; see QUEST-CHAIN-PLAN.md.

## Measured checks

- Strict verification:21/21 stages passed;29 shared checks,756 server assertions,382 simulation assertions and11 adventure/quest tests. Typecheck, content and build passed. Existing large Vite chunk warning remains.
- Preserve the first run:20 stages passed, server stage failed on an autosave EPERM rename and its aggregate error assertion (754 passed/2 failed). An unchanged repeat passed. A transient Windows lock is a hypothesis, not a proved cause; persistence retry/locking deserves a later P3 investigation. Tests were not weakened and no real save was read.
- Three normal-health level1 synthetic input runs completed the chain after equipping the first earned weapon and avoiding replicated slam warnings: warrior265.10s, mage145.55s, ranger143.20s, zero deaths, all level7. These are simulation seconds, not human pacing or browser performance. The earlier warrior pilot died without that preparation. The melee/ranged difference remains a balance question.
- Five new server tests exercise all classes, prerequisites, real travel authority, ordered events, save/reload, full-bag retry, replay, unknown revisions and four-player living/local credit. Integration fixtures can position players directly; the separate combat walkthrough uses ordinary inputs. Do not conflate them.
- Real Chrome1920×1080: inspected journal catalogue, existing completed quest, newly accepted High Water, updated tracker and branching Orren reply. Reconnect retained accepted progress. Capture: tour/quest-journal-1080.jpg. The dev control overlay covers part of the header. Browser character has debug infinite HP; survival is not balance evidence. The longer route helper was unreliable at low frame cadence; a full manual chain/boss visual tour remains open. No crowd/FPS acceptance claimed.

Reports are in checks/quest-chain-verify*.json and checks/quest-chain-normal-health.json. Test saves were isolated in temporary directories; BACKUP_DIR was empty. Browser data used only the earlier synthetic Rillmage fixture.

## Open and next

Continue P5's world map/waypoint network, remaining objective adapters, repeat/party policy and bounded history; then supported P6 onboarding. Full localization, long/many-quest UI states, authored ambience, unique boss art, human pacing, field crowd load and cross-restore reward guarantees remain open. The owner's latest direction reserves full-game playtesting for them and reduces agent checks to meaningful safety/feature checks; no repeated broad suite for documentation-only work.

Rollback: remove the two new quest entries, destination and presentation together, retain optional saved quest state and claimed items, and keep the Silent Wheel adapter. This changes route availability but does not erase progress or inventory. Restore the old handler/panel only if compatibility is deliberately tested.
