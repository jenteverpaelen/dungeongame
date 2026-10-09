# Keyboard remapping — verification and limits

2026-10-09, owner's Windows PC, solo. F-SET-02 / U-12 scope in KEYBOARD-DESIGN.md. No new dependency/download, town change, zoom change, character migration or combat rule.

## Measured

- Six targeted tests pass: retained alternatives/reset, conflicts/reserved keys, atomic invalid-record fallback, storage failure, physical identity/layout labels, held-key release/focus/capture/repeat handling, forms/modifiers and native Tab behavior.
- Strict `node scripts/verify.mjs` passes all stages. Evidence `hearthfall-verify-Dg4qqj`, report copied to `checks/bindings-ui/verify-report.json`: 747 server assertions in this run, 382 simulation checks, six binding tests and all existing save/replay/backup/service/shared/typecheck/content/build stages. The server harness has conditional/runtime checks, so its observed count differs from the prior 748 run; no test was removed here. Existing bundle-size warning remains.
- `node scripts/capture-bindings.mjs` passes with installed Chrome154.0.8037.99, fresh profile and DATA_DIR `hf-bindings-ui-ywLgff/saves`; BACKUP_DIR empty, debug off. Every frame is 1920×1080, DPR1, document.hidden false, camera620 world units high. Eight final screenshots were opened and inspected.
- Real browser key/mouse events assign Dash J, Interact Num9, Skills L, Up T and Settings Y through the existing Settings panel. A movement-key conflict is refused without a dash/move; Escape cancels capture without closing the panel. Help/HUD use the assigned keys. The physical Waypoint opens via Num9, old E/K/O/Space no longer invoke those actions, new L/Y do, J produces an actual server dash cooldown, and typing J in chat causes no dash. No chat is sent by this fixture.
- T movement changes the server snapshot from (2891.5,2418.6) to (2891.5,2410.2001); key release and the obsolete W position stop input. This is a short input test, not a route/speed benchmark.
- The native volume slider still responds to its arrow key (80→79), after remapping. An explicit disconnect and fresh page load retain the custom bindings. Reset restores Space/E/K/O and original movement/arrows/I/B. Returning characters do not receive new-character hints again.
- Chrome's optional layout API supplies Z/Q/S/D for the default movement positions on this PC. This is observed API output. Captured-key fallback, Unicode label retention and unsupported storage are separate unit fixtures.

## Iterations and scope limits

The first typecheck found tuple-index null narrowing; fixed without changing the intended policy. First browser attempt hit a quoting error in the harness's volume selector. Inspection also exposed a horizontal scrollbar caused by scrolling the ornamented Help frame; scrolling is now confined to its key list. Second attempt timed out during navigation while its old connection remained alive (exact browser lifecycle cause unverified); the reload test now explicitly closes the connection and uses a fresh URL. The third complete run passes. These failed attempts are not counted as passes; temporary logs remain in their isolated roots (`4Brb4p`, `MWdcph`).

All final labels/buttons fit at1080p, including Num9 in the interaction badge. Help's first-open translucency and the world prompt behind it remain visible in frame01; frame04 shows the later opaque panel. No theme redesign or accessibility/readability certification is claimed. FPS displayed in these snapshots is not a benchmark.

Keyboard only: no controller, mouse buttons, chords, modifiers/function-key remapping, account sync, human usability or assistive-device validation. Layout lookup refreshes on focus/Controls opening; immediate OS layout changes without either event are untested. If it is unavailable, the UI explains physical-position defaults. Navigation/chat/help keys remain reserved. Browser-origin settings do not sync across different hosts/ports. Character saves, original town and camera stay intact. Rollback in the design note.
