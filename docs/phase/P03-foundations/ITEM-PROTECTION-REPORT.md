# Item protection — C078

Implemented solo on the owner's PC, 2026-10-09, after L92/D033 and [the plan](ITEM-PROTECTION-PLAN.md). This advances item flags and loot safety; it does not complete economy, binding, trading or loot automation.

## Behavior and reason

Inventory and Stash now have a small Protect button using the existing panel style. In this mode, click a bag, worn or stored item to set/remove protection; item controls also accept Enter/Space. A gold lock badge and item-tooltip text explain the state. Choose Done to resume ordinary item clicks. Inventory close resets the mode.

The server accepts an explicit boolean only for a uniquely owned item. Repeating the same desired state is idempotent. Protected items reject destroy, individual salvage, transmutation, extraction and full reforging before currency/item mutation. Bulk salvage skips them and the UI's item count/yield preview uses the same exclusion. Existing rarity restrictions remain. Equipping, bag swaps, stash transfers and deliberate enchanting/empowering/socket changes are still allowed; these preserve the item object and flag. Protection is not a freeze on every modification.

D4-05 supplies historical favorites/salvage/stash evidence; TBH-03/TBH-08 identify reported lock problems around consumption, restart and equip. The additional Hearthfall operation coverage is a local decision based on the actual consumer audit, not a claim that either reference game uses this exact policy. No rates, costs, vendors, rewards or balance targets were added. No downloads or external assets.

## Compatibility and removal

Save version2 records this safety requirement. Existing v0/v1 saves retain their items/progression and migrate when loaded/saved. Missing flags remain unprotected; malformed present values normalize conservatively to protected and can be explicitly cleared. The existing future-version refusal prevents a v1 server from silently ignoring a v2 save. This was established from the version guard and current migration tests, not by running an old production server against player data. Protocol3 requires matching client/server presentation and authority.

No game content, owned item, character or save was deleted. The only removed behavior is permission to consume/regenerate a protected item. Clearing protection restores the existing operations. Future item consumers must use the shared policy and undergo the same audit. Protection does not prevent an older backup restore from losing newer state, and is not a replacement for ownership/authentication or durable transactions.

## Measured verification

Typecheck, content validation and build pass. All24 focused tests pass: item protection, legacy/current/future persistence and existing NPC service rules. Cases cover five mutation-free denials, exact bulk inputs/yields, equip/unequip, targeted upgrade, stash transfer, disk reload, explicit unprotect/consume, duplicate IDs, missing ownership, invalid booleans, repeated set-state and malformed-save safety. Synthetic golden fixtures now include v2 protection in addition to the retained v0/v1 fixtures. Existing unprotected service flows and proximity checks still pass. All use isolated DATA_DIR on the owner's PC; no full-suite or full-game replay. The existing build chunk warning remains.

Actual built Chrome preview: protected a Stout Worn Cap in the bag and the equipped Wand. Server-returned UI changed both actions to Unprotect and displayed both lock badges. The bulk preview excluded the protected magic cap and offered exactly one unprotected magic item for one dust. The menu was cancelled; no browser salvage was performed. [Protection mode](../../adventure/tour/c078-item-protection.jpg) and [bulk preview](../../adventure/tour/c078-protected-salvage.jpg) are inspected1920×1080 captures. The original frame, paperdoll and bag style remain; small badge/helper text legibility needs human review. Tooltip wording, stash button and keyboard input are implemented/typechecked but were not separately visually exercised. No browser warnings/errors were captured.

Earlier captures were1920×1022 despite a reported1080 viewport; closing the temporary QA tab and restoring control to the preview corrected the target. Those captures were replaced, not represented as1080 evidence. The synthetic PumpC075 character received the existing offline rewards on reconnect and was level11 during the inventory check; this is not first-time progression evidence. The inventory visit was in the safe town, and infinite HP was enabled again before leaving the preview ready for further walkthroughs. No real save directory was used.

## Remaining work and rollback

Full consumer coverage as new systems arrive, all UI/accessibility states, human readability, vendor policy, account binding and durable transactions remain open. To disable this UI safely, retain the save-version marker and server protection checks. A complete downgrade needs an explicit migration/preservation policy; never strip the version/flag merely to make an old server load the save. The whole roadmap remains active.
