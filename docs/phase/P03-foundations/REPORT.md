# Independent foundation verification — 2026-10-09

All execution took place on the owner's Windows PC, Node v24.19.0, with synthetic saves in fresh temporary DATA_DIRs. No real save files accessed. Branch `codex/new-tristram-town`.

## Measured

`npm run verify -- --allow-known-windows-shutdown` completed with outcome **passed-with-known-failures**. Typecheck, shared tests (12), foundation tests (initial 5), town services (4), simulation (382), town-content validation and build passed. Server: **731 passed, 2 failed**. The failures are the existing Windows SIGTERM exit/save checks, retained in the result rather than hidden. Build still warns about a large bundle.

After review found the future-field validation edge case, targeted foundation tests passed **6/6**, verification failure-policy tests **2/2**, and typecheck passed. The policy tests cover default strict failure, explicit allowance, extra/changed errors, abnormal exits and incomplete/interrupted runs. No claim that a second full suite ran after these narrow changes.

Evidence root for full run: `C:\Users\LAPTOP~1\AppData\Local\Temp\hearthfall-verify-cndePg`. Server bot used its own `hearthfall-bot-1VZGF1` temporary saves. The sanitized summary is retained in `checks/verify-report.json`; full logs remain in the temporary evidence root.

## Browser and visual checks

`node scripts/capture-foundations.mjs` used installed Chrome **154.0.8037.99**, real server, 1920×1080, device scale 1, `document.hidden=false`. Its own save/profile directory is recorded in [browser.json](checks/browser.json).

- Unversioned synthetic character loaded as version 1. Equipment, inventory, stash, gold, XP, paragon and Cube state were unchanged after disconnect/reconnect.
- A forged debug request was rejected with the disabled-server response; gold stayed unchanged. Server had neither debug environment flag set.
- A version-999 file with unfamiliar fields was refused; its bytes remained unchanged.
- Fixed camera world height remained exactly 620.

Opened and inspected all three screenshots: [town](checks/legacy-town.png), [inventory](checks/legacy-inventory.png), [future-save message](checks/future-save-refused.png). Existing town/HUD/panel appearance is retained; the error appears under the existing login controls. That error is small and low contrast in the current style, a later accessibility audit item rather than a silently redesigned screen.

## Limits

These are functional checks, not a dense-crowd benchmark, disabled-player evaluation or independent security audit. No accounts/recovery/transactional database/backups added. Existing save write errors still log without propagating to all callers; durability and restore remain open. No claim of full P3 or G1 completion.
