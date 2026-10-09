# Preserve paid enchant choices across item replacement

2026-10-09, before correction. Evidence: L34/L35 and `checks/enchant-before.json` under P01. Actual handlers, real town service guards and a synthetic Session reproduce: roll → reforge same ID → pick pre-reforge option succeeds. Reforge replaces the item object/affixes but preserves its ID; enchantPick only checks that ID and the current affix's general eligibility. Its option pool belongs to the previous item state. The initial probe additionally produced duplicate Area Damage after installing an old offer, violating the normal enchant pool's exclusion.

The probe's pilot retained mutable command results by reference, so its embedded reforge reply later reflected the pick. Preserve that pilot, then clone each reply at observation and repeat before changing code. The independent `afterReforge` snapshot and stale acceptance remain valid. One rerun wrote its log inside the required-empty fixture directory and correctly failed the isolation assertion; move logs beside `saves` and rerun. No actual save was involved.

## Narrow correction

Refuse **reforge of the same item** while that session has a pending enchant choice. Explain that the player must choose at the Mystic first. Reject before charging, rolling or mutating anything. The client uses its existing reason/disabled-action presentation for this case. Keep the paid offer available, including the choice to keep the original property. Reforge becomes available after that selection. Reforging another item remains allowed.

Why this choice: silently deleting the offer after a successful reforge would lose a paid decision. Charging again or refunding introduces economic rules unsupported by this audit. Preventing replacement until the existing transaction is resolved preserves both current costs and the original offer. No affix/rune/item content is deleted. This guard removes only the unsafe interleaving, not ordinary enchanting/reforging.

Existing repeated-roll pricing remains unchanged: observed L70 Legendary rolls cost 19,700 twice before selection, then 26,595 after one completed pick. That cost policy and persistent recovery of offers are separate design questions; do not fold them into this state-safety fix. Pending choices still do not survive disconnect.

## Acceptance / rollback

Add a failing semantic service test before the fix: pending offer blocks same-item reforge with identical save and pending offer; another item's reforge works; failed/blocked attempts preserve the offer; choosing original resolves it and permits reforge. Run current town-service, command-replay and full verify stages with isolated data. Inspect a real 1920×1080 local browser component fixture showing the existing disabled-action reason, then resolved state; distinguish that render fixture from an actual physical walk and the real-handler service tests.

Rollback the server guard and matching client reason together if replaced by a fully tested revision-aware offer system. Removing the guard alone restores the stale-affix defect. No schema migration, balance change, CSS change, dependency or town/camera change.

## Client lifecycle follow-up, before correction

Source audit after adding the guard found `closeAllPanels()` clears `ui.enchant` and `Game.openArtisan()` clears it whenever visiting a non-Mystic artisan. Neither cancels the server's pending offer. That would leave the paid choice hidden and the new reforge guard impossible to resolve through the normal UI. Preserve the connection-local offer across panel closure and artisan changes; clear it when starting/ending a connection, matching the server's Session lifetime. Add browser assertions for closing/reopening and visiting the Cube, alongside the disabled/reforge-ready captures. This does not add persistent recovery or retain offers across reconnects. No newly invented cancellation/refund behavior.
