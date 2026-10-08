# M0 baseline checks and performance

2026-10-08 · Windows 11 · branch `codex/new-tristram-town` · source `ce6eda9bd48892d7ef69578577a44957d23e2229`.
Safe baseline branch and tag both resolve to `794f77eecf38aae12c2bd8b6f08697475f7f9514`. A diff against that baseline across client/server/shared/scripts/package files was empty. No runtime source changes were made for this report.

## Baseline suite — measured

Each command received a distinct isolated temporary DATA_DIR; no real saves were read, edited or deleted. The server bot additionally creates its own temporary data directory and free port. Installed lockfile dependencies were used; the simulation command used offline npm exec to avoid an npx download fallback. Wall time includes npm startup. Saved console logs were normalized to UTF-8 with trailing whitespace removed; result text was preserved.

| Check | Result | Wall seconds | Evidence |
|---|---|---:|---|
| npm run typecheck | pass, exit 0 | 6.636 | [typecheck.txt](checks/typecheck.txt) |
| npm test | 2 passed, 0 failed | 0.926 | [shared.txt](checks/shared.txt) |
| npm run test:server | **614 passed, 2 failed**, exit 1 | 37.529 | [server.txt](checks/server.txt) |
| npm exec --offline -- tsx server/test/sim.ts | **382/382 passed**, exit 0 | 7.217 | [simulation.txt](checks/simulation.txt) |
| npm run build | pass, exit 0; large-chunk warning | 2.298 | [build.txt](checks/build.txt) |

The two failures are `server shuts down gracefully on SIGTERM (exit code 0)` (actual exit code null) and `shutdown saved characters`. These match the Windows failures named in the handoff; no test was weakened. Handoff reported 613 passes; this execution reports 614, so retain the observed number rather than rewriting it to match. The bot count includes runtime-dependent checks, so do not infer a newly added test from the count alone.

Simulation-only diagnostics printed by the existing suite: 4 players + 150 monsters, tick avg 1.250 ms, p99 5.817 ms, max 9.394 ms. These are **not** a 100-player town test and are not browser FPS.

## Machine and browser — measured

- Windows 11 Home, OS version 10.0.26200; AMD Ryzen 7 7435HS.
- Physical RAM: 16,849,272,832 bytes (approximately 15.69 GiB).
- GPU identified by Chrome: NVIDIA GeForce RTX 4070 Laptop GPU; driver 32.0.15.9636.
- Chrome 154.0.8037.99; Node v24.19.0.
- ANGLE renderer explicitly reported NVIDIA / Direct3D11. No SwiftShader flag was used.
- 1920x1080 CSS viewport and PNG output; device scale factor 1. Headless Chrome `--headless=new`, fresh temporary profile, existing installed binary.
- Laptop power state, thermal state, foreground display refresh rate, competing owner background activity and actual free VRAM were not measured. No agent build/test jobs ran during the render samples.

## Render-only crowd measurement — measured, not foreground acceptance

Raw final run: [browser-headless.json](checks/browser-headless.json). Earlier pilot retained as [browser-headless-pilot.json](checks/browser-headless-pilot.json).

Workload URL: `http://localhost:5173/gallery-art.html?view=perf&theme=town&players=97&monsters=0&zoom=1.7419354838709677`.

The existing gallery adds **three built-in heroes**; players=97 therefore creates **100 heroes plus eight NPCs**, 108 actors total, with zero extra monsters. Town seed 1234, 609 props, 261 sorted prop views. Some crowd actors lie offscreen; this is not 100 simultaneous visible heroes. It updates actors but does not reproduce Scene culling, network snapshots, nameplates, the game HUD or server load. Gallery and game also have different bake/renderer configuration. No claim of equivalent multiplayer performance is made.

Procedure: launch isolated production server on port 2577 for a real-game capture and a separate Vite gallery on 5173; attach CDP to a dedicated Chrome profile; enforce viewport; capture the actual game after connection; navigate to the gallery; wait for `window.__ready`, then 10 seconds warm-up; collect requestAnimationFrame timestamp differences for 61 seconds; collect CDP Performance metrics before and after; capture final gallery; close only the processes launched for the experiment. DATA_DIR and browser profile are separate from the owner's data. Temp measurement harness used only installed Node built-ins and Chrome, no package installation.

| Metric | Final measured value | Meaning / limits |
|---|---:|---|
| Recorded frame-interval span | **60.9944 s** | 3,997 intervals; no visibility changes |
| Mean FPS | **65.5306** | intervals * 1000 / summed milliseconds |
| FPS first percentile | **41.1523** | 1000 / nearest-rank p99 interval; not mean of the slowest 1% |
| Minimum instantaneous FPS | **10.3093** | reciprocal of worst 97 ms frame; not a one-second minimum |
| Mean frame interval | **15.2600 ms** | includes rendering/scheduling, not isolated CPU work |
| p99 frame interval | **24.3 ms** | nearest rank |
| Maximum frame interval | **97 ms** | a visible hitch would be possible; headless sample does not establish perceived smoothness |
| document.hidden | **false throughout** | 0 visibility events; does not turn headless into foreground testing |
| JS heap used, start | **1,051,914,456 bytes** | CDP snapshot after warm-up; not peak |
| JS heap used, end | **814,438,180 bytes** | GC-dependent snapshot; not a leak conclusion |
| Gallery map-layer build | **267.3 ms** | synchronous buildMapLayers only; excludes full lazy ground/hero baking |
| Page time when ready observed | **1,934.8 ms** | polling observation, not a cold-launch/full-town-bake measurement |
| Final gallery HUD | 64 fps; 247 draws/frame; 5.50 ms actor / 5.30 ms hero update | Single HUD sample; update values are rolling medians, not whole-run means. Screenshot was a later frame and shows 223 draws. |
| Texture memory | **unmeasured** | GPU model/heap are not texture residency; need unique texture-source accounting and/or GPU profiling |

The pilot span was 59.9944 s (3,729 intervals): 62.1558 fps average, 40.6504 p1. It was repeated because it narrowly missed the >=60 s recorded-span requirement. Pilot and final crowd positions differ because the existing gallery uses unseeded Math.random. These are not a controlled A/B comparison. Use a fixed crowd fixture or the same logged positions for the later baseline/new-town comparison. Neither sample alone is a formal final performance budget.

## Visual inspection — completed for saved captures

Both running-renderer PNGs were opened and visually inspected after the final capture; each is below 3 MB.

- [Actual game plaza, 1920x1080](tour/m0-baseline-plaza.png): existing warrior and HUD load; a broad pale cobble disc dominates the screen; most building/service landmarks are outside the view; visible well and lamps have little spatial framing. This is the existing town, not a new-art mock-up. The screenshot cannot prove movement, doors, audio or multiplayer behavior.
- [Gallery with 100 total hero actors, 1920x1080](tour/m0-gallery-100-heroes.png): existing hero art renders in a crowd; offscreen actors and clipped edge characters confirm the spread extends outside the view. Different gear colors are legible; the empty plaza's repetitive ground remains conspicuous. No networking/game HUD in this image.
- [Current data diagram](baseline-layout.png): inspected separately; labels readable, source scale marked, collision circles distinguished from footprint geometry. This is a documentation diagram and explicitly not a running-game screenshot or target proposal.

## Remaining baseline work / acceptance

1. Foreground Chrome measurement with a visible, non-occluded tab and controlled >=60 s workload. The browser automation runtime still fails after restart; installed headless Chrome worked through CDP. Do not claim the runtime issue was repaired.
2. Actual 100-client town-channel behavior/performance, including movement/replication, measured separately from the accepted gallery proxy option in HANDOFF §6.9.
3. Texture memory, peak memory, full load/lazy bake completion and repeated cold/warm measurements. The large variable JS heap snapshots justify inspection, not an invented GPU-memory budget.
4. Fix crowd determinism in the measurement harness before using a 15% A/B threshold. Do not change gameplay just to make a benchmark greener.
5. Once a comparable foreground baseline F is accepted, enforce new-town average >= max(60, 0.85*F); record p1/min too. Full load/bake <5 s is still a requirement, not proven by the current partial timings. Texture budget remains unapproved until measured.

M0 performance evidence is useful but incomplete. No final performance acceptance or new-town budget is claimed.