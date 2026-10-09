# Run completion summaries — C080

Implemented solo on the owner's PC, 2026-10-09, after L94/D035 and [the plan](RUN-SUMMARY-PLAN.md). Advances Claude U-73 and the objective-dungeon presentation; does not complete P7/P12 or introduce timed/ranked rifts.

## Added behavior and reason

An actual completed rift/dungeon snapshot creates one read-only Last run entry in the current character session. Its panel shows the completed goal, existing difficulty and server run clock. It stays available after area travel, is replaced by the next completion, and clears when a new character session starts. It never auto-opens over combat. The journal and, while still inside that run, area map remain reachable from the recap.

Rifts retain their existing first-arrival-to-Guardian clock. A dungeon starts its clock at the first valid mechanism activation, retains it through encounter retries/waiting in the same instance, and freezes it on final clear. This follows the existing simulation-clock convention; it is not a wall-clock performance measurement, time limit or leaderboard. Optional snapshot fields let an older server's unavailable dungeon time/count appear unknown rather than fabricated. Rift UI cache state is reset on zone entry alongside dungeon cache state, so a re-entered completed instance can present its actual snapshot.

Ground loot and remaining quest work are stated separately. The recap has no reward, claim, travel or currency mutation. No inferred XP/gold/item totals are shown. Existing observed D3/PoE2/Idleon state distinctions and the local C041/C075 completion paths support this presentation choice; no external completion-screen parity or human benefit was established. The attempted official guide fetch was unavailable and supplied no claim.

## Measured checks

Typecheck, content validation and build pass. All10 focused checks pass: actual dungeon clock activation/retry/freeze, existing three-class dungeon progression/rewards, the delivery/rift completion tests and pure snapshot-to-summary checks including legacy missing fields. DATA_DIR was isolated at temporary `hf-c080-checks-0e199844680f4ad9903f34e5b56853f3`; backups disabled. No full campaign replay, benchmark or real-save access. Existing Vite chunk warning remains.

Inspected actual Chrome1920×1080 [dungeon](tour/c080-dungeon-summary.jpg) and [rift](tour/c080-rift-summary.jpg) gallery captures. Both explicitly say preview fixture; the displayed4m5s is synthetic, not a measured clear time. The panel fits and uses the existing type, border, colors and controls. Journal link visibly closes the recap and opens the existing quest journal. No warning/error logs were captured. Live completion-to-HUD retention, after-exit text, empty state, keyboard flow and long names were not separately visually exercised; server timing and presentation mapping have the focused evidence above. Human readability remains review work.

The owned local preview server was restarted against the same isolated PumpC075 test directory after building, so the preview now serves the new server/client. Original frozen-tab cause remains unconfirmed; no unsupported root-cause fix is claimed.

## Removal and remaining work

No content, item, quest, reward or save field was removed. No town, fixed camera, existing UI style or combat rule changed. Snapshot additions are optional; save2/protocol3 remain. No dependency, download or paid service. No persistent run archive, acquisition receipt, party contribution, time trial/rank, leaderboard or full release acceptance is provided.

Rollback removes the optional recap/clock fields while preserving all instance/quest/reward behavior. The complete roadmap remains active.
