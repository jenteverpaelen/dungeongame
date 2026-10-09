# Hearthmere implementation checkpoint — final acceptance pending

> **2026-10-09 owner update:** keep the town as it is; defer the remaining town work. Restore the original fixed 620 u camera and remove automatic spell framing (C001 in `docs/CODEX_CHANGELOG.md`). The earlier camera approval and resume order below are historical. Research now follows Claude's full-game roadmap.

The owner approved the look slice and asked to finish the town fully. D021 records that authorization for the remaining milestones; the branch, save isolation and originality rules remain unchanged. Implementation work was performed in this chat without subagents or new downloads. The owner requested a pause on 2026-10-08 so they can close their PC. This is a checkpoint, not M7/M8 completion; resume from [PAUSED.md](PAUSED.md).

## Implemented world

The 96×64-tile town uses one authored JSON source for nine building masses, exact walkable polygons, doors, depth baselines, eleven NPC/dummy anchors, props, fences, lights, sound emitters and ambient paths. It preserves the approved Adventure-mode service arrangement, upper court, shrine branch, pier spur and outer-road hook. The reconstructed scale remains **inferred ±25%**, as documented in the approved S01 survey; these are not extracted D3 world coordinates.

All exteriors use original Canvas2D materials and geometry. Four-unit depth strips follow the authored frontage rather than sorting an entire sloping building at its centre. The inn and forge have shared server/client interior floor unions, solid furniture and local roof/wall fading. Original cloth roofs distinguish the jeweler and mystic. Ground uses a 36-chunk resting cache, expanding only to cover visible chunks during wide spell framing (up to the 96 chunks of this town), and is painted outside the render callback. A common dusk tint, contact/cast shadows and authored colored lights cover the town. The minimap reads the same layout.

The plaza contains flames, embers, smoke, leaves, fog, birds, water ripples, patrolling villagers and the smith's hammer. Cloth also moves elsewhere. Browser audits observed eight types in the latest sample and nine in an earlier sample; birds move in and out of view. Three villagers follow deterministic paths against the estimated server clock. Eight original synthesized sounds feed nine positional emitters, with distance attenuation, pan and the existing volume/mute bus.

Blacksmith, Jeweler, Mystic, Stash, Cube, Waypoint, Rift Obelisk and Paragon all open their existing-style panels at physical locations. Commands validate the current authoritative position, correct NPC, living player and line of sight on every operation. U works only near the Cube. The approved stash exception provides 60 persistent slots per character, with migration, capacity, item-identity and retry protection. Training dummies remain server entities. No new vendor, gambling, repair, transmog or quest economy was introduced.

## Measured verification

| Check | Evidence |
|---|---|
| TypeScript / production build | `checks/town-complete-typecheck.txt`, `town-complete-build.txt` |
| Shared rules | 14 passing tests: collision, 10,000-step prediction parity, field/rift golden fixtures, depth, interiors, deterministic patrols and camera framing |
| Authored validation | 9 buildings, 11 NPCs, 21 swept routes; every service and both interior targets reachable |
| Service authority | 4 passing suites covering every operation near/far/wrong/dead/spoofed/occluded, unlocks, stash migration/dupes/capacity/save reload |
| Full server regression | 731 pass / 2 pre-existing Windows SIGTERM shutdown assertions fail; totals in `checks/town-complete-server.txt` |
| Simulation | 382/382; isolated 4-player/150-monster tick mean 2.008 ms, p99 10.883 ms |
| Real panel use | Browser clicks successfully salvage a rare item, fuse gems, select an enchanted affix, and deposit/withdraw a stash item; all eight panel screenshots indexed in TOUR.md; final inspection refresh pending |
| Shared movement | Two browser clients in channel 1: warmed villager difference 0.154 u, observed remote player difference 0.733 u (network interpolation/position quantization); exact movement parity is separately tested by shared rules |
| Corner walks | 46 reachable camera positions across 47 requested building corners; maximum settled prediction/server difference 0.00077 u in that run |
| Audio graph | Context running after a real key gesture, all eight buffers non-silent; positional gains/pans differ by district; master mute reaches zero; no town loops after travel or disconnect |
| Texture lifetime | All captured owned ground/building sources destroyed on leaving; re-entry rebuilds town art. Shared rig/FX atlases have their existing bounded cache lifetime |

Every test used temporary saves outside the repository. Browser scripts used the installed Chrome 154 on the owner's Windows PC at 1920×1080, DPR 1, with `document.hidden=false`. They drove normal movement through prediction and WebSocket input; they did not teleport the server player. Separate browser windows prevented the hidden-tab trap during the two-client check. Captures are running-game output, not mockups.

The early two-client sample, only 1.8 s after joining, differed by 10.4 u while the existing clock estimator converged. After a 15 s warmup it differed by 0.154 u. This is deterministic shared-clock behavior with synchronization latency, not a promise of bit-identical pixels at arbitrary wall-clock instants.

## Performance and implementation choices

See PERF.md for the controlled 100-network-player runs, heap and texture estimates. The 70.25 FPS optimized sample predates the new camera and NPC density changes; the final configuration must be remeasured. D022 caches only crowded-town remote idle/walk poses at 24 Hz while keeping their positions, depth and nameplates at full frame rate. The town minimap paints at 20 Hz. Local heroes, attacks, channels, dashes, deaths and all field/rift rendering use the original update path.

Startup profiling found synchronous atlas readback was a major delay. D024 uses direct GPU town-NPC atlases, omits their unused damage-flash variants and uses the existing density rule with a 2 texels/u minimum for non-combat NPCs. The default hero art/bake path is unchanged. The stricter visible-atlas check still exceeds five seconds: 6.453 s in the density trial and 5.351 s in the mage trial. The earlier 3.967 s figure excluded visible atlas completion and is not a valid full-load pass. Latest profiling identifies unnecessary class-select preview startup on autostart URLs as a possible next optimization; it is not implemented yet.

The owner-approved camera now rests at 800 u vertically, with automatic framing of owned casts/area effects and the hero. At 1080p this gives a nominal 64 u hero 86.4 screen pixels. Mathematical tests cover eight directions and three aspect ratios; local mage captures show a real cast at 522 u distance, Meteor fall/impact, Meteor Shower and Frost Nova. They also expose an unresolved black strip beyond the north map boundary during extreme pullback. Fix and visually recheck before final acceptance. All skill ranges and server rules remain unchanged.

## Known limits and inspection findings

- Final crowd remeasurement, startup target, extreme-camera terrain edge, refreshed forge/tour captures and final review remain open. Existing screenshots are evidence of intermediate builds; see TOUR.md.

- Performance capture uses installed **headless Chrome on this PC**, not a remote runner. A reliable unobscured headed-window benchmark remains unverified; attempts with a hidden window were rejected. Low-percentile FPS remains below 60 even when the mean meets the budget.
- Texture figures estimate renderer-managed source dimensions and mip levels. They are not measured VRAM residency and exclude MSAA/renderbuffer/driver overhead. NPC GPU atlases remove CPU copies but retain GPU render-target storage.
- The lane house's northern corner borders unwalkable terrain; no player-clear camera position exists within 400 u. Several other rear-corner requests use the nearest reachable view, up to 336 u away. Do not describe this as walking through terrain around every rear wall. The JSON records desired and actual positions.
- Art is deliberately stylized and the interior rooms are simple original adaptations. D3's hidden elevations/interiors were not surveyed. The existing tour records the correction to the conspicuous pier chunk seam and repeated water dots found in the first pass; terrain beyond the roads remains sparse.
- Audio generation, playback state, pan, gain, mute and lifetime were measured. Subjective speaker/headphone mix quality was not independently listened to by this agent.
- The baseline's Windows SIGTERM shutdown failures remain. No test was weakened to hide them.

## Reproduce and maintain

Use a fresh temporary DATA_DIR, then run typecheck, shared tests, `town:check`, `test:town-services`, full server tests, `node --import tsx server/test/sim.ts`, and build. `scripts/capture-town-complete.mjs` creates its own temporary saves/browser profile; default captures the tour, `--verify` exercises panels/audio/two clients/lifetime, `--perimeters` walks accessible corner views, and `--quick` records loading. Run `scripts/benchmark-town.mjs` alone, with `TOWN_BENCH_LABEL` set, after building. Both refuse an occupied port 2578 and stop only their own processes.

Edit the shared JSON, validate, and restart server plus client together. Do not serve newly built client geometry from an old server process. Rollback checkpoints are the existing town tags and the protected original baseline. Preserve the new stash array and a working withdrawal route before rolling back service code; never discard stored items or touch real saves during testing. `PR.md` contains review text; no pull request is required to run the local town.
