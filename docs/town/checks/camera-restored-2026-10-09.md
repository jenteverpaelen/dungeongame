# Original camera restored — local verification

Measured on the owner's Windows PC on 2026-10-09, against 11491cf plus the C001 rollback. Tests used isolated temporary DATA_DIR paths; no real saves were loaded. This verifies the requested camera rollback, not the deferred town performance gate.

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | 12/12 pass; two tests specific to the removed framing feature were removed with it |
| `npm run build` | Pass; existing large-chunk warning remains |
| `npm run test:server` | 730 pass, 2 fail: Windows SIGTERM exit-code and shutdown-save checks; same known failure categories. Raw log in `../../phase/P01-research/checks/camera-revert-server.txt` |
| `node --import tsx server/test/sim.ts` | 382/382 checks pass |
| `npm run town:check` | 9 buildings, 11 NPCs, 21 swept walking routes; services reachable |
| `npm run test:town-services` | 4/4 pass, including persistent stash and server proximity/line-of-sight rejection |
| `node --import tsx scripts/capture-town-complete.mjs --mage` | Pass; rest/Meteor/Shower/Nova view height exactly 620 world units |

Browser: installed local Chrome 154.0.8037.99, headless, 1920×1080, DPR 1, `document.hidden=false`, local test server on 2578. JSON: [town-camera-restored.json](town-camera-restored.json). This is a real local browser render, not a remote PC or a manual play session. All four new PNGs in `../tour/town-camera-restored-*.png` were opened and inspected. Hero/world scale is restored; HUD style is unchanged; distant impacts clip at the screen edge again as expected. Captured views contain no black map-edge strip. This does not claim all map boundaries were walked.

The simulation's synthetic four-player load measured 0.989 ms average / 5.886 ms p99 simulation work; this is not a 100-player town benchmark. Startup/browser FPS in the JSON are incidental measurements, not acceptance evidence for the deferred performance work. Tests' own temporary processes were stopped after capture.

Removed: automatic spell framing module, event hook, feature-only tests. Retained: historical wider-camera evidence. Consequence and rollback: C001 in `../../CODEX_CHANGELOG.md` and town decision D026.
