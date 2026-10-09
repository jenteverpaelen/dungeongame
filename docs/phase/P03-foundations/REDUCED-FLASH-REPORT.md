# Reduce flashes — implemented and locally checked

2026-10-09. Design/evidence preceded code: REDUCED-FLASH-DESIGN.md, L41 and UX-04. Optional browser-local setting defaults off; existing UI style, fixed 620 camera, gameplay and saves remain unchanged.

## Measured checks

Four preference tests pass, including old version1 records with missing/invalid values. Strict full verification passed all17 stages with no known-failure allowance:747 server checks and382 simulation checks, typecheck, build and existing regressions. Exact stage results: `checks/reduced-flash-verify.json`; isolated run root `C:\Users\LAPTOP~1\AppData\Local\Temp\hearthfall-verify-svwoat`. Build retains its bundle-size advisory.

`scripts/capture-reduced-flash.mjs` passed in installed Chrome154.0.8037.99 on this PC, Node24.19.0,1920×1080,DPR1, document.hidden=false. Fresh profile and synthetic L1 Mage save, debug disabled, isolated DATA_DIR `C:\Users\LAPTOP~1\AppData\Local\Temp\hf-flash-ui-TXfoci`, inherited BACKUP_DIR cleared. Owned processes were stopped afterward. This is headless Chrome, not a foreground performance or human usability test.

All seven final screenshots in `checks/reduced-flash/` were opened and inspected. Actual Settings checkbox, reload and Restore defaults work. Panel480×678.875 fits the viewport. Controlled presentation events with paused/manual renderer stepping establish:

- Default celebration created56 particles. Enabling the option removed all56 on the next update and hid the impact-flash layer; one attack warning remained.
- New level/Paragon events created zero celebration particles with the option enabled. Audio dispatch remained; no listening test is claimed. Ordinary projectile and warning stayed visible.
- Player and puppet white hit silhouettes stayed off while both hit-motion values reached1. Turning the option off restored future silhouettes and celebration effects.
- A controlled particle with flicker amplitude0.4 retained alpha153 at50 and100ms. Warning outline stayed at opacity1 while fill progressed from0.001 to0.524176; attack timing/progression was not disabled.
- Enabled state survived reload; restoring defaults returned false. Camera stayed620 throughout.

These injected presentation events are not server-earned combat, XP or Paragon progression. The character remained L1/P0; its displayed level/Paragon fixture notices reflect that state. Initial pilot `hf-flash-ui-Rhoel2` failed because the harness redeclared a top-level CDP evaluation variable. Its trace is preserved as `pilot-evaluation-scope.json`; lexical-block evaluation corrected the harness and a fresh complete run passed. No game defect is inferred from that pilot.

## Scope and unfinished work

The option hides listed cosmetic effects for this browser; no content is deleted. Shape/countdown/projectile information, sounds and hit motion remain. This does not establish flashing thresholds, medical safety, full reduced motion, all-class dense-combat behavior, other viewports/devices, human accessibility or100-player performance. Other beams/colour transitions, ambient/loot effects and spatial patterns still require an audit. F-SET-03 and P3 remain partial. Rollback is the preference/control and corresponding rendering guards together; stored extra fields can be ignored without a character migration.
