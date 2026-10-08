# Resume checkpoint — 2026-10-08

The owner asked to save the current work and stop so they can close their PC; continue when they return. This is an implementation checkpoint, not a completed final gate. Read AGENTS.md and HANDOFF.md, then this file, before editing. Work only on `codex/new-tristram-town`, solo in this chat. Never touch the protected baseline, real saves, `.local` or `.env`; use a new temporary DATA_DIR for every test. No new download or paid service is authorized by this pause.

## Current scope and approvals

- They approved the look slice and asked to finish the whole town, including optional Inn/Forge interiors (D021). No need to repeat those approval questions.
- D3 PC Adventure Mode with all artisans unlocked is the public-reference target; they do not own D3. All shipped art, names and audio remain original.
- Existing operations only, with the specific approved 60-slot persistent per-character stash exception. U opens Cube only nearby.
- They requested wider zoom and chose **moderate zoom-out + automatic spell framing**. D025 explicitly supersedes the old fixed-620 camera requirement.
- They require testing on their PC. Tests use installed `C:\Program Files\Google\Chrome\Application\chrome.exe`, local server 2578, RTX 4070 Laptop, 1920x1080 DPR1. Headless is local, not a cloud browser; report that limitation accurately.

## Saved implementation

Authored full town art, shared polygon interiors, depth strips, lights, bounded terrain streaming, deterministic villagers, original positional audio, all physical services, minimap and town crowd optimizations are present. The 800 u resting camera and owned-spell framing are implemented and have mathematical tests plus local mage evidence. FINAL.md describes implementation and limits; PERF.md preserves intermediate benchmarks. TOUR.md indexes current captures and their stale-build limitations.

## Resume in this order

1. Fix the visible black strip beyond the north town boundary when long-range Meteor framing pulls back. Keep the full falling spell and hero visible; extend cosmetic terrain/background without changing collision or combat. Log the evidence/design choice in REFERENCES.md before editing. See `tour/town-camera-meteor-{fall,impact,shower}.png`, cameraFraming.ts and townSlice.ts. No generic guarantee that every spell/rune has been visually inspected yet.
2. Address the **unmet five-second load/bake target**. The early 3.967 s number omitted visible rig atlas completion. Current strict trials are 6.453 s and 5.351 s. `main.ts` unconditionally starts class-select previews before reading autostart; the diagnostic profile shows substantial WebGL context creation and readback. Consider skipping previews only for autostart while preserving normal menu previews; log evidence first. Do not change hero artwork to hide the delay.
3. Build and run controlled `node scripts/capture-town-complete.mjs --quick` alone. Preserve historical failed/profiler results. `--startup-profile` is diagnostic, not acceptance. Full readiness includes visible rig atlases and entry ground, not only the first ready flag.
4. Rerun `--mage`, inspect all four screenshots. The real tested point [2000,1080] is 522.045 u from the training dummy, with 337 u vertical offset. Mathematical tests cover eight directions and 16:9/4:3/9:16. Current dynamic heights: Meteor 1651.172 u, shower 2242.597 u, Frost Nova 1075.385 u. Skill/event behavior is unchanged.
5. Run `scripts/benchmark-town.mjs` alone with a fresh TOWN_BENCH_LABEL such as camera-final. Latest 70.25 FPS / 434.75 MiB estimate is from **before** camera/NPC-density changes. It is not final-build acceptance. Require 60 s, 100 actual visible network players, hidden=false, no competing jobs, report p1 and source-memory caveats.
6. Refresh default tour and `--verify` (service flows, audio, two clients, texture lifetime). Forge firebox was corrected after the main/corner tour captures; retake and inspect those. 46 of 47 requested corners were reachable; one lane-house corner was not. Keep that limitation. Panel captures exist but final contact-sheet review remains pending. Subjective audio listening remains unverified.
7. Run appropriate full checks before a completion milestone, update FINAL/PERF/TOUR/PR with exact current results, review diff, then commit/push only this branch. Do not tag M7/M8 complete until their open criteria are satisfied.
8. Serve a fresh isolated review instance on a free port (2579 was free) with matching current server/client geometry, then open it for the owner. The existing 2577 preview is an old M2 server with newer built client assets and must not be used for final geometry verification.

## Evidence already saved

- Full server: 731 pass / 2 known Windows SIGTERM failures; unchanged tests. Simulation: 382/382, 2.008 ms mean 4-player/150-monster tick, 10.883 ms p99 (prior isolated run).
- Pause checks rerun typecheck, shared 14/14, town validation, service authority 4/4 production build and simulation 382/382 (2.190 ms mean, 11.951 ms p99, 20.178 ms max); raw logs `checks/town-pause-*.txt`.
- `town-complete-verification.json` has successful rare salvage, fusion, enchant choice, stash transfer, eight service panels, audio graph and two-client/lifetime evidence. Older `town-complete-multiplayer.json` separately records another warmed synchronization run; do not mix their figures.
- `town-complete-perimeters.json`: 46 reachable views, max settled movement difference 0.00077 u; some rear-corner views offset up to 336 u. Inn/forge images were inspected at native size, other corner views via contact sheets; all predate the final camera/forge refresh.
- `town-crowd-final.json` is a retained failed 58.94 FPS attempt, not final acceptance. `town-crowd-optimized.json` is the later pre-camera 70.25 FPS sample. `town-complete-load.json` currently belongs to a CPU-profile run.
- `town-complete-browser-error.txt` is an old failed mage-test-point search; the corrected full collision scan and later `town-camera-mage.json` pass supersede it. Preserve or clearly label historical failures.

The local startup profile was at `%TEMP%\hf-town-complete-8y2aQu\startup.cpuprofile` (not required for reproduction): 5.631 s diagnostic; createContext self 1.442 s, getPixels self 0.798 s, applyKerning self 0.397 s. Reproduce with the script if temporary files are gone. Tests clean up only their own processes. Normal owner ports 5173/2567 must not be stopped. Review server 2577 was PID 25556 at pause; verify process ownership/command before any future action.

No new completion tags or PR were created at this checkpoint. The PC can be shut down; no test/benchmark needs to remain running. Resume from the committed repository, not temporary test saves.
