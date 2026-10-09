# Delivery and rift objective adapters — C079

Implemented solo on the owner's PC, 2026-10-09, after L93/D034 and [the plan](DELIVERY-RIFT-PLAN.md). Claude P5 now has eight schema kinds: interact, reach, kill, collect, service, wave, deliver and rift. This is not full P5 acceptance: conversation is represented by interaction, dungeon waves require clearing an encounter, and rifts use existing difficulty rather than an unimplemented rank system.

## Behavior and evidence

Delivery requires an authored exact item base/rarity and a complete batch no larger than the existing bag capacity. A player selects matching bag items, reviews their full existing tooltips, then explicitly confirms. Protected gear is disabled. Equipped/stashed items are not candidates. The server independently validates exact current quest revision/objective, physical recipient proximity, unique IDs and ownership, complete quantity, base/rarity, protection and pending enchantment. No partial handover occurs. Socketed gems return to the existing gem balances, with overflow checked first. The next quest state and possible reserved reward are prepared before any inventory mutation. A changed reviewed selection blocks the UI until reviewed again.

The actual Guardian completion path credits accepted rift objectives only when the current run meets the authored minimum existing difficulty. It uses existing completion membership: near, far and downed members still present count; departed characters do not. It does not reuse XP/kill proximity rules, credit past completion statistics, or expose a client completion command. Outside a rift, objective guidance resolves toward the physical Obelisk through the existing travel routes. Existing hunt/Guardian presentation remains responsible inside a rift.

C041 measured those differing kill/completion rules. C065 separately demonstrated acquisition/possession and transaction boundaries; it did not certify the live JSON store. C078 supplies the gear-protection contract. These measurements and Claude's explicit objective requirements support this scope without new external rates, reward quantities or timing targets. No download or dependency was added.

## Measured checks

Typecheck, content validation and build pass. All19 focused tests pass across new delivery/rift integration, existing quests, protection and shared quest validation. Tests exercise remote/stale/partial/duplicate/wrong-item/protected/equipped/stashed/pending-enchant/overflow rejection without mutation, exact batch removal, gem conservation, reward claim/retry, partial progress persistence, minimum difficulty, actual Guardian death and repeated death, four-member eligibility and unaccepted/late state. The rift fixture deliberately prepares progress and positions; this is not a natural clear or balance measurement. No broad campaign/full-suite replay was repeated. Existing Vite chunk warning remains.

The checks used isolated `hf-c079-checks-2c591a7dbaef4bfdbbc25bd5c1b70c5d` under the owner's temporary directory with backups disabled. No real saves were read or changed.

Chrome at `127.0.0.1:5173/gallery-panels.html?s=delivery&still=1`: selected an unprotected item, observed the protected copy disabled, reviewed its full tooltip, and confirmed the disposable fixture. The visible completion state appeared; no warning/error logs were captured. [Selection](tour/c079-delivery-selection.jpg) and [review](tour/c079-delivery-review.jpg) are inspected1920×1080 captures. They are labelled development fixtures without a server/save connection, not live quest screenshots. The review scrolls within the existing panel and preserves its typography/materials; long multi-item lists, keyboard flow, human readability and actual NPC delivery presentation remain open. Server behavior is evidenced separately by integration tests.

## Removal, compatibility and remaining work

No current authored quest, revision, reward, zone or item pool changed. Only items explicitly selected for a successful future delivery are consumed. Existing delivery-free quests continue unchanged. No new filler content, price, grind requirement or combat value was introduced. Protection descriptions now include delivery. Town, fixed camera and approved UI style remain unchanged.

Fields are optional and current definitions do not use the two new kinds. Save2/protocol3 remain unchanged. Future content that begins using these kinds must ship compatible server/client definitions. The live game still saves inventory and quest state in the same character snapshot; this is not durable event receipts, crash-proof transactions, party policy, cross-character trading or protection against an older backup restore. Those remain separate roadmap work, along with repeat rules, broader reward choices/history bounds and ranked rifts.

Rollback removes new-kind content before removing adapters/UI; preserve already-recorded quest history and rewards. Keep the item-protection guarantees. The full roadmap remains active.
