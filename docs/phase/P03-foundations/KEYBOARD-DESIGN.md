# Keyboard remapping — foundation scope

2026-10-09, before implementation. Roadmap F-SET-02 / U-12; GAG-REMAP, MDN-KEYCODE and MDN-LAYOUT below. Current input, preferences, Settings, Help, HUD and new-character messages audited. Town, camera and UI visual vocabulary remain unchanged.

## Evidence and choice

- [S] Accessibility guidance calls for custom controls and accurate prompts; this is guidance, not a user-study result for Hearthfall.
- [S] KeyboardEvent.code identifies a physical position; its name does not establish the printed character. Optional getLayoutMap can supply labels, but is experimental, secure-context-dependent and can fail.
- [M] Existing movement uses physical WASD/arrows; action shortcuts use character strings. Space, I/B, K, P, U, O are fixed. Typing and native form controls already suppress gameplay. Tab currently gets cancelled outside forms, preventing ordinary focus navigation.
- [D] Store two physical keys per action, keeping all current QWERTY positions and alternate defaults. This makes movement/action rebinding consistent; on other layouts action shortcuts follow physical positions instead of the previous character matching. Use layout-map labels when available, captured characters otherwise; clearly identify fallback position labels. No OS keyboard configuration changes.
- [D] Remap movement, dash, interact, inventory, skills, Paragon, nearby Cube and Settings. Require a primary key; secondary may be cleared. Reject duplicate assignments with the existing action named, without silent swaps or unbinding. Keep Escape, Enter, Tab and function/modifier keys reserved for navigation/chat/help/browser/prototype tools. No chords, mouse/controller rebinding or manual spell casting added in this slice.
- [D] Persist a versioned keyboard record separately from audio preferences: invalid or conflicting records fall back atomically to defaults; unavailable storage keeps session changes working. No save/server migration. Restore controls affects controls alone.
- [D] Reuse existing Settings tabs/buttons/panel, Help rows and HUD labels. Change the new-character instruction to point to F1, so persisted bindings cannot make it false. Keep automatic-combat text.
- [D] Capture consumes its candidate without movement/dash, cancels on Escape/Tab/blur/unmount, clears held movement and ignores repeats until a fresh press. Preserve native buttons, sliders, chat and browser modifier shortcuts. Allow ordinary Tab focus navigation.

## Acceptance and limits

Unit cases: conflicts, reserved keys, persistence, malformed/future records, reset, unavailable storage, labels; input cases for two-key release, remapped dash, typing/capture/focus/repeat suppression. Installed local Chrome, fresh DATA_DIR/BACKUP_DIR empty, 1920x1080: remap through Settings, reject a conflict, exercise real keys, updated hints, reload retention, reset and sound controls. Inspect saved screenshots. Strict project verification follows input changes. No accessibility certification, controller support or human usability/performance claim.

Removal/effect: hard-coded action lookup and stale hints are replaced, not gameplay actions. Tab suppression is removed to enable keyboard focus. Other-layout panel defaults change as described above; users can assign their preferred keys. Rollback input/store/UI/hints together; the separate keyboard storage key can be ignored without touching audio or characters.
