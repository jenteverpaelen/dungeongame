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

## Settings slice verification

`node scripts/capture-foundations.mjs --settings` builds current source, starts its own real server and uses a fresh Chrome profile and DATA_DIR. Final run: `hf-foundation-browser-eSBBzK`, Chrome 154.0.8037.99, 1920×1080, DPR 1, document visible. [Raw results](checks/settings/browser.json). Preference tests pass 3/3; typecheck/build pass. No additional server-wide regression run is claimed for this client-only slice.

Measured live gains: effects and priority effects 0.25, ambience approximately 0.70; mute holds master at zero after moving its slider. Reload retains values and shake-off; reset returns master approximately 0.80 and both categories to 1, with shake enabled. Fixed view height is 620 throughout. Range arrow keys change volume without movement; focus clears held movement; Space operates checkbox/button without Dash; ordinary buttons still permit WASD. Escape closes and F1 Help opens settings.

All seven final captures in `checks/settings/` were opened and inspected. The settings panel uses the existing border, heading, gold, text and button styles, fits left of the character and above the HUD. Values, checked states and focus indicators are visible; original inventory/town appearance is retained. The login error remains in its existing layout.

Intermediate harness findings: one run caught a stale build when testing the button-focus correction; capture now builds automatically. An idle effects bus exposed a stale AudioParam `.value` reading; quiet synthetic test signals now keep effect buses processing before testing live gains. A mid-animation Help/login capture was recaptured after the entrance animation. These are documented verification changes, not evidence of random successful retries. No subjective listening, disabled-player evaluation, complete reduced-motion support, frame-rate or cross-browser claim.

## Save failure slice verification

The before-test reproduced a fulfilled write/flush followed by stale gold after a synthetic rename failure. After the fix, all five fault-injection tests pass: old bytes/items preserved, failed snapshots retried, partial temporary output removed, stale reload refused, queue recovery and session retry/notification verified. Tests use a new temporary DATA_DIR on this PC; no real files are faulted.

Full `npm run verify -- --allow-known-windows-shutdown`: **732 server checks pass, two known Windows SIGTERM checks fail**; simulation **382/382**, save failures **5/5**, foundations **6/6**, preferences **3/3**, shared **12/12**, town services **4/4**, verification policy **2/2**, typecheck, content validation and build pass. Outcome remains **passed-with-known-failures**. Evidence: `hearthfall-verify-pl0T4c`; [report](checks/save-failure-verify-report.json). The build retains its large-chunk warning.

This run's synthetic four-player/monster simulation measured average 0.989 ms, p99 5.865 ms, maximum 9.410 ms excluding fake-client snapshot processing. Including that processing: average 1.154 ms, p99 6.303 ms, maximum 10.000 ms. These are one-run simulation timings, not browser FPS, a 100-player result, or a reference-game balance measurement. The two Windows shutdown failures mean graceful process shutdown is not established by that suite. No independent security review or power-loss durability claim.

## Remaining limits

These are functional checks, not a dense-crowd benchmark, disabled-player evaluation or independent security audit. No accounts/recovery/transactional database/backups added. Recoverable write errors now propagate, but failed progress is retained only in this running process; crash durability and restore remain open. No claim of full P3 or G1 completion.
