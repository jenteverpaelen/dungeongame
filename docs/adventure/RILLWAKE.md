# Rillwake Crossing — first authored adventure

2026-10-09. Status: first playable slice implemented and verified in C070; production art and broader campaign work remain open. See [measured report](RILLWAKE-REPORT.md). Evidence before design: REFERENCES.md L81; C041 objective-credit audit; C063 synthesis; C065 transaction limits. Owner chooses the setting through research and authorizes supported implementation. Town, camera and existing UI style remain fixed.

The Silent Wheel: a mill tender waits at a roadside camp. Follow a timber road through a flooded woodland, inspect an abandoned cart, confront the creature occupying the mill yard, recover the mill ledger, and bring it back. An upper ridge provides an optional combat detour that rejoins the main route. All names, writing, geometry and drawn assets are original. No reference image or downloaded asset ships.

## Scope and reasons

- Add a destination through the existing town Waypoint. Do not change town geometry or remove either legacy field. The camp has a return portal.
- Hand-author one 64×52-tile envelope (4096×3328 u). This is a bounded first slice, about 5.4 camera heights tall versus the old fields' 9.3; it is not a measured ideal. Derive travel distance and collision reachability from the actual route before acceptance. Widen combat yards beyond the existing 560-u maximum mage cast range; keep passage openings larger than two player diameters. Combat duration requires playtesting.
- Author ground polygons, paths, bridge, mill walls, readable interactions, scenery and encounter anchors together. Reuse the proven swept geometry solver through a narrower structural interface. Keep legacy field/rift generation and town data/rendering unchanged. Render shorelines/walls from those same shapes and use them on the minimap.
- Reuse original forest enemies and their stats/skills/loot. A named rare mossback uses the existing rare tier; this is an encounter, not a new boss moveset. Fixed authored pack sites replace density replenishment only here. Respawns use the existing glade delay and require every player to be outside the existing safe respawn distance. Never respawn a cleared site under the player.
- One optional per-character quest, revision 1: accept, inspect cart, kill the named encounter, retrieve ledger, return. No global tutorial lock, new currency, arbitrary kill quota, shared account state or new database. Quest credit requires active matching revision, correct site, living nearby witness and a real non-debug kill. Sequential booleans are idempotent; no network entity ID is persisted.
- At the first successful ledger recovery, generate and persist one class-appropriate magic weapon at the current level using existing item rules. Show its actual preview before claim. L83 supersedes the initial acceptance-time roll after the first bots finished at level4 with a level1 reserved weapon. Claim requires the camp NPC, completed objectives and a free inventory slot. Repeated inspection cannot reroll the reward. Reward and completion mutate the same character snapshot; repeated claims cannot add more items. Existing asynchronous whole-save guarantees apply: a crash can lose unflushed progress together, and restoring an old backup restores old claim eligibility. No stronger durable receipt guarantee is claimed.
- Add dialogue/journal and a compact objective display using existing panel/button/type styling. Always verify interaction distance and line of sight on the server. Journal reading can remain available away from an NPC.

## Acceptance work

- [x] Shared data, exact collision, routes, return travel and original landmark rendering.
- [x] Fixed encounters; normal enemy behavior and loot preserved.
- [x] Server-authoritative quest, reward preview, full-bag/repeat/wrong-target/dead/remote rejection.
- [x] Optional-save round trip and no changes to existing characters without acceptance.
- [x] All-class local combat and route probe; real-browser 1920×1080 walkthrough/screenshots inspected.
- [x] Full isolated verification and measured report, with visual/playability limitations explicit.

## Removal / future impact / rollback

No existing zone, item, skill, artwork, town content or save is deleted. Item-protection work is deferred, not cancelled. Remove the new destination/renderer/quest handlers together to roll back; preserve any saved quest envelope and reward item so reinstating the feature does not reset claims. The generic geometry interface remains behavior-compatible with town. This slice does not complete P5–P7 or the full Claude roadmap. Further zone variety, true boss mechanics, repeat/party quest policies, dialogue branching and account work remain open.
