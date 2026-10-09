# Optional combat numbers — C052 results

2026-10-09. Protocol: [design](COMBAT-NUMBERS-DESIGN.md), L63. Added a Show combat numbers checkbox in the existing Sound & comfort panel. It defaults on, persists in browser preferences and controls floating damage/healing amounts. Existing styles, camera and default appearance remain; no combat rule or content was removed.

## Local checks

On this PC: Node24.19.0, installed Chrome154.0.8037.99, fresh synthetic profiles/DATA_DIRs, BACKUP_DIR unset. Actual viewport1920×1080/DPR1, document.hidden=false. Ticker deliberately stopped for reproducible glyph inspection; screenshot FPS is not a performance result.

- Typecheck, seven targeted preference/catalogue tests, content check and production build pass. Check root: `hf-combat-numbers-check-a3afafdcee8244508d5edd9b50f512bc` under the user's Temp directory.
- Baseline capture root `hf-combat-numbers-iyhZbB`; after root `hf-combat-numbers-m21Sfo`. Both use owned headless Chrome processes, no owner profile or remote machine. All processes shut down after capture; no failed pilot or browser runtime exception.
- Exact five-style fixture comparison passes for normal, critical, damage-over-time, taken and healing numbers: quantities, font sizes, colours, outlines, alpha, prefixes, glyph counts and merge/lane records. Whole frames differ in ordinary town animation; no pixel-identity claim.
- Actual checkbox input clears all active glyphs and merge/lane records on update. Five repeated hidden fixture batches produce zero numbers/records; re-enabling exposes no accumulated hits. Newly spawned numbers recover the default style. Actual disconnect/reconnect retains off, and Restore defaults returns on.
- Actual presentation handlers receive synthetic normal/critical/DoT/taken/heal events. With numbers on/off, both produce29 particles, identical hit/crit/hurt dispatch arguments, two target hit reactions, two shake requests, one hit-stop request and hit-size history100. Number count changes5→0. Those values describe the fixture, not gameplay tuning. Instrumented feedback calls are not a listening, real server-damage or animation-lifetime test.
- Personally inspected the one baseline and six after screenshots: control labels and reset remain visible inside the unchanged panel style; hidden numbers disappear while HUD, nameplates, minimap and town remain present. The fixed620-world-height camera assertion passes throughout.

Evidence: [before trace](checks/combat-numbers/before/trace.json), [after trace](checks/combat-numbers/after/trace.json), screenshots beside each. The independent client-only change does not justify repeating the full server simulation; the last strict full19-stage run remains C046 (747server/382sim). Existing Vite native-loader/bundle warnings remain tracked.

## Scope and remaining work

CombatText rejects new glyph spawning while disabled and clears its active/merge/lane state during update. Combat event handlers still execute. No save schema, data, loot, health calculation, skill, audio asset, town or camera changed; old/malformed preference values default to visible numbers. Two complete message keys bring the scoped English catalogue to136 keys; other player text is still outside it.

This is one optional clutter control, not full reduced motion, text scaling, accessible combat or human comprehension acceptance. Per-category filters, screen narration and broader gameplay settings remain open. No downloaded middleware/assets, no paid service and no removed game content. Future changes must keep numeric display independent from damage/heal execution. Rollback removes preference/control/renderer checks together; no character migration.
