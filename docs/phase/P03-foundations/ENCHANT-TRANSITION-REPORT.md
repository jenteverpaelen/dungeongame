# Enchant/reforge transition correction

2026-10-09, Windows 11 / Node 24.19.0 on the owner's PC, solo. Design and L35 precede the correction. Town, style, fixed 620 world-height camera, costs and save schema unchanged.

## Measured before / after

`scripts/audit-enchant.ts` exercises the actual command handlers and service checks with a synthetic Session positioned at each required NPC. Before correction, reforge replaced the item/affixes while preserving its ID; the old pending enchant option could then be installed. See P01 `checks/enchant-before.json`; the preserved pilot additionally produced duplicate Area Damage, which the ordinary offer pool excludes. Random offers are not seeded by this harness, so exact rolled values are not reproducibility promises.

The new semantic town-service test failed before implementation (`true !== false`: same-item reforge unexpectedly succeeded). After correction, the same-item attempt fails before charging, generating a replacement, granting Cube XP or changing the paid offer. Another item's reforge succeeds. Choosing the original property resolves the offer and permits reforge; a later stale pick fails. Updated probe: P01 `checks/enchant-after.json` also chooses a paid new option on the original item, then reforges successfully and rejects stale reuse.

Closing panels and visiting another artisan previously discarded only the client's offer. The client now keeps it for the current connection, matching the server; start/disconnect clears it. Reforge explains the requirement through its existing warning/button presentation.

## Verification and visual inspection

- Five town-service tests pass, including the new regression. The initial targeted command mistakenly named a nonexistent receipt-test file; only the five reported service tests count for that command. The correct command-replay stage subsequently passed in full verify.
- Strict full verify passes at `hearthfall-verify-fadrB2`: 748 server / 382 simulation checks plus all stages, including six command-replay tests and five town-service tests. Exact report: `checks/enchant-verify-report.json`. The client lifecycle follow-up landed after that run's typecheck; a separate final project typecheck and current browser build pass. Script strict typecheck and capture syntax check pass. Existing large-bundle warning remains.
- Installed Chrome 154.0.8037.99, fresh profile/empty isolated DATA_DIR, debug disabled, BACKUP_DIR cleared; `capture-enchant.mjs` builds current source first. Run: `hf-enchant-ui-GZrU8B`. All four final 1920×1080 captures personally inspected. The warning is readable and contained; the disabled/re-enabled action states are clear in the existing style. The original paid choices remain visible after closing panels and visiting Cube/Mystic. A disconnect assertion verifies the offer clears.
- This browser run injects synthetic character/offer data into the existing UI and invokes panel methods. The successful pick is modeled by clearing client state; **no browser crafting command or physical walk is claimed**. Actual handler mutations and NPC authority are covered separately. The visible level-one world character and level-70 inventory are expected fixture differences, not a normal progression trace.
- The probe's first after-fix invocation used `--out`, although the harness accepts `--output`; the generated `enchant-current.json` was renamed to `enchant-after.json` without rerunning or altering its contents. Pilot mutable-result/log-location mistakes are retained in the design note.

## Effect, remaining work, rollback

Only unsafe replacement under an unresolved paid offer and premature client display loss are removed. No item, skill, affix, reward, price, text style or town content is deleted. Repeated-roll pricing remains as observed in the economy audit. Offers remain memory-only and do not survive reconnect; this does not complete durable crafting transactions or P8. Destroying/transmuting an item and offer recovery need separate policy review before any broader change.

Rollback server guard and matching client reason together if superseded by revision-aware offers. Preserve lifecycle behavior unless its replacement keeps the paid choice accessible. No save migration is necessary; removing the server guard restores the stale-affix risk.
