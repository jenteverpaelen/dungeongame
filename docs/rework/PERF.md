# Client performance — budgets, method, changes, gate (2026-10-11)

Owner rule (verbatim, 2026-10-11): "when trying a rift on the dev server with full set etc big damages my fps drops to
34 which should never be the case its a 2d game it shouldnt require so much resource from my pc" — and the fix must
"not affect the game … the whole reason we are doing 2d and all that is too keep the game accessible on browser and on
low end pcs". Everything below keeps play and looks unchanged; where a change is not pixel-identical, the measured
difference is stated.

Labels: **[M]** measured here, **[I]** inferred, **[U]** unverified / external.

## 1. What "low end" means here

| Evidence | Value | Label |
|---|---|---|
| Steam Hardware & Software Survey, September 2026 (store.steampowered.com/hwsurvey, read 2026-10-11 through a summarising fetch; re-check the page before quoting) | physical cores: 2 = 2.45 %, 4 = 10.79 %, 6 = 27.23 %, 8 = 30.06 %; RAM 8 GB = 6.47 %, 16 GB = 37.82 %; 1920×1080 primary display 47.91 %; integrated GPUs among the top entries (Iris Xe 1.50 %, AMD Radeon Graphics 1.43 %, UHD 1.01 %) | [U] |
| Steam skews to gaming PCs; browser players skew lower | so "low end" for a browser game is at least the ≤ 4-core / 8 GB / integrated-GPU tail above | [I] |
| Lighthouse throttling docs (github.com/GoogleChrome/lighthouse docs/throttling.md, read 2026-10-11) | a constant **4× CPU slowdown** moves a high-end desktop into the "mid-tier mobile" bracket (BenchmarkIndex ≈ 125–800); below that is "low-end mobile" | [U] |
| This machine | Ryzen 7 7435HS (8C/16T), RTX 4070 Laptop (ANGLE D3D11), 16 GB, Windows 11, Chrome 154 headless; shared with other agents (load 37–67 %) | [M] |

So the low-end proxy is **the same fight with Chrome's CPU throttled 4×** (DevTools `Emulation.setCPUThrottlingRate`),
plus a **software-rasteriser run** (`--use-angle=swiftshader`) for blocklisted GPUs. 1080p is the reference screen.

## 2. Method (why the numbers can be trusted)

* **Recorded references, replayed.** Live rifts differed from run to run by 17–37 monsters and 64–143 draw calls, so
  live A/B numbers were noise. `scripts/perf/record-fight.mjs` records every server message the client receives during a
  Torment Faultline fight (L70 Warrior in full Set + Legendaries, two extra elite packs, ~27 monsters alive throughout,
  20 s); `scripts/perf/record-town.mjs` does the same for 24 socket-client heroes (all classes, L70, full Set +
  Legendaries) gathering round the recording hero at the Faultstone (25 heroes in view). `scripts/perf/replay-page.js`
  feeds a recording into the running client at the recorded arrival times through the client's own socket handler
  (live traffic is dropped meanwhile). Same scene every run: draw calls repeat within ±0.5, visible objects within ±2.
* **Thread CPU time, not wall time.** A Chrome trace (`toplevel`) gives each top-level task's thread time (`tdur`), per
  frame, for the renderer main thread and the GPU-process main thread (`scripts/perf/cpu-trace.mjs`).
* **Paired, concurrent A/B.** Shared-machine load moved single runs by ±40 %, so both builds replay the same recording
  at the same time in two Chrome instances (`scripts/perf/ab.mjs`, one sample = `scripts/perf/replay-sample.mjs`) and the per-round ratio is reported (round-to-round spread
  ≤ 2 %). Absolute numbers from these runs are inflated (two browsers share the machine); sequential interleaved runs
  (A, B, B, A, …; medians) give absolute fps.
* **Production builds only** (`vite build`), served by `vite preview` with `/ws` proxied to an isolated server
  (`DATA_DIR=.local/perf-data`, debug on for recording only). Visible pages (`document.hidden` false), 1920×1080.

## 3. Where the time went (before; built client, reference fight, 1×)

Renderer main thread ≈ 7.1 ms CPU per frame [M] (unminified production build, CPU profile over 12 s):

| Part | ms / frame | Note |
|---|---|---|
| Pixi render | 2.6 | rebuild of all draw instructions **every frame** 1.1 · transform updates 0.6 · draw submission 0.6 |
| Game frame (scene, rigs, VFX) | 1.6 | hero rig 0.5 · 27 monster rigs 0.4 · VFX 0.24 |
| Native (style, layout, paint, GL encoding) | 2.2 | 26 HUD elements restyled every frame by their running CSS animations; 0.9 ms style + 0.5 paint |
| Minimap | 0.3 | **1.3 ms per paint spent assigning `ctx.font`** (forces a document style resolution) |
| HUD (Preact) + snapshots | 0.3 | `Number#toLocaleString` built a new ICU formatter per call (~1 ms each at 4×) |

GPU-process main thread ≈ 11.6 ms CPU per frame [M] — the busiest thread: WebGL 2.8 · DOM raster 3.2 · HUD render
passes 2.8 (9 per frame) · swaps / shared images 1.6. **Hiding the whole HUD** cut the GPU process by 64 % and the main
thread by 31 % (paired, 3 rounds) [M]: on this machine the HUD costs more than the game scene.

Why Pixi rebuilt everything each frame: any `zIndex` write marks the render group as structurally changed — and the
y-sorted entity layer plus every hero rig (part depths follow the 3D pose) write new values every frame, even when the
draw order stays the same. With a single render group (the stage) one change anywhere rebuilt the whole scene.

## 4. Changes (each kept only with a measured win; all look-identical unless stated)

| # | Change | Where | Measured | Look |
|---|---|---|---|---|
| R1 | Lazy depth sort: a y-sorted / depth-sorted container records zIndex changes and re-sorts (and rebuilds) only when its children are actually out of order — the same stable order Pixi would produce | `client/src/render/depthSort.ts`; scene entity layer, hero body and hand-glow layer | whole-scene rebuild every frame → entity-layer rebuild in 43 % of fight frames (34 % real order changes), the rest of the scene no longer rebuilt with it | identical by construction |
| R2 | Render groups: camera root (moving it is one matrix), each scene layer, each hero rig | `client/src/render/scene.ts` | R1 + R2: main thread −4 % rift, −14 % town crowd (paired, 3 rounds); +2 draw calls rift, +14 town | frozen-frame WebGL readback, on vs off in the same page: rift 976 of 8.3 M channel values differ, max 2/255; town 11 values > 4/255 (the town tint is applied once as a group uniform instead of per vertex) |
| H1 | Minimap assigns `ctx.font` once per context (it persists outside save/restore) | `client/src/ui/hud/Minimap.tsx` | the per-paint forced style resolution (1.3 ms at 1×, ~15 ms at 4× in the profile) is gone; at 1× most of that work then happens in the normal style pass, so the net gain is in H1–H4 together | identical |
| H2 | `prefersReducedMotion()` keeps the query's value current from its change event instead of evaluating `matches` (hundreds of calls per frame) | `client/src/game/preferences.ts` | 0.85 ms/frame at 4× in the profile | identical |
| H3 | Number formatting reuses `Intl.NumberFormat` instances (`toLocaleString` is specified as exactly that) | `shared/src/format.ts`, test `shared/test/format.test.ts` | 0.67 ms/frame at 4× in the profile | identical (the test compares every case) |
| H4 | Minimap monster dots set their shared styles once per paint | `Minimap.tsx` | H1–H4 together: a further −3 % main thread at 1× (paired) | identical strokes |
| H5 | Cooldown sweep is its own compositor layer (`will-change: transform`), so its 10 Hz repaint no longer re-rasterises the drop-shadowed skill icons | `client/src/ui/styles/hud.css` | GPU process −13 %, fps +5 % (paired, 3 rounds) | ≤ 12/255 in 1,381 px of the sweep wedge; promoting the seconds too moved their glyphs 1 px, so they stay unpromoted |
| D1 | First run on a software rasteriser (SwiftShader / llvmpipe / Basic Render Driver) starts on the Low preset | `client/src/game/quality.ts`, `main.ts` | SwiftShader fight 2.7 → 3.6 fps (+33 %) | Low preset (only on those machines, only without saved settings) |

**Bug found on the way (pre-existing, fixed):** in a crowded town (more than 40 active entities) remote heroes are
pose-cached and only updated in 24 Hz slots. When a class placeholder sheet finished baking, the old sheet was destroyed
4 s later while cached heroes could still be drawing from it; the next frame threw inside Pixi (`buildContextBatches`,
destroyed GraphicsContext) and the game's render loop could stop. Reproduced with the town-crowd replay and the cache
forced on (`scripts/perf/crowd-cache-check.mjs`): before the fix 7 of 11 runs, after it 0 of 9. Fix: `PlayerArt.stale` and an off-slot update for stale cached
heroes (`scene.ts`).

Tried and dropped: a render group per monster / prop (+30 draw calls, no CPU win, paired); the Medium / Low presets on
a real GPU (−1 to −4 % CPU: this fight is CPU-bound on rig and scene work, not on particles or pixels) [M].

## 5. Before / after (production builds; before = `claude/town-ui-rework` f6ccb15, after = this branch)

**Paired, concurrent** (both builds replay the same recording at the same time; median of per-round ratios; values are
the lowest round, inflated because two browsers share the machine) [M]:

| Scene | Metric | Before | After | Change |
|---|---|---|---|---|
| Rift fight, 1× (4 rounds) | renderer main thread, CPU ms / frame | 8.02 | 7.44 | **−8 %** |
| | GPU-process main thread, CPU ms / frame | 8.51 | 7.26 | **−15 %** |
| | fps | 74.5 | 83.0 | **+10 %** |
| Rift fight, 4× CPU throttle | fps | 11.4 | 12.2 | +7 % |
| | main thread CPU ms / frame | 13.4 | 11.7 | −10 % |
| Town crowd, 25 heroes, 1× (3 rounds) | renderer main thread | 16.8 | 14.2 | **−15 %** |
| | GPU process | 12.6 | 11.9 | −5 % |
| | fps | 39.3 | 44.7 | **+17 %** |
| Town crowd, 4× | fps | 4.2 | 4.2 | +6 % (median ratio; rounds 4–11 fps) |

**Sequential, interleaved** (A, B, B, A, A, B; medians of 3; absolute values on this machine) [M]:

| Scene | Before | After |
|---|---|---|
| Rift 1× | 130 fps, p95 13.2 ms, main 5.4 ms, GPU process 5.3 ms | 131 fps, p95 13.5 ms, main 5.0 ms, GPU process 4.7 ms |
| Rift 4× | **19.0 fps, p95 92 ms** | **25.5 fps, p95 66 ms** |
| Town crowd 1× / 4× | 73 fps / 12.3 fps | 72 fps / 10.2 fps — load on the machine dominated these runs (per-run spread ±25 %); the paired ratios above are the evidence |

At 1× the fight is past 120 fps on this machine either way (the owner's 34 fps was the pre-7bfa8c2 HUD on the dev
server; the unminified dev build is slower than what ships). The 4× and crowd numbers are what low-end PCs feel.

**GPU-process trace, rift 1× (CPU ms per frame, single runs)** [M]: DOM raster 1.52 → **0.72**; HUD render passes
2.29 → 2.24; WebGL 2.13 → 2.23; swaps 0.56 → 0.57; total 7.88 → 7.07.

**Per-frame work** (deterministic, the gate's numbers) [M]:

| | Draw calls | Texture binds | Buffer KB | Visible objects | Renderables |
|---|---|---|---|---|---|
| Rift before → after | 120 → 123 | 130 → 129 | 198 → 188 | 904 → 904 | 486 → 486 |
| Town crowd before → after | 273 → 287 | 522 → 520 | 569 → 520 | 2,410 → 2,389 | 1,899 → 1,878 |

**Look unchanged** [M]: frozen-frame readbacks in §4 (R2, H5); side-by-side captures at the same replay moment in
`docs/rework/shots/perf/` (`before-*` / `after-*`: town, rift fight, full-set hero close-up, town crowd).

## 6. Budgets and the gate (`npm run verify`, stage `client-perf`)

`scripts/client-perf-check.mjs` builds nothing itself: after the `build` stage it serves `dist/client` from the real game
server (own port, isolated `DATA_DIR`, debug off), opens headless Chrome at 1920×1080 and checks:

| Check | Budget (`scripts/perf/budgets.json`) | Measured now |
|---|---|---|
| Idle town: DOM Paint events per frame | ≤ 0.1 | 0 |
| Idle town and both replays: running CSS keyframe animations | transform / opacity / translate / rotate / scale only | 24 running, all compositor-only |
| Rift fight (replayed): draw calls / texture binds / texture uploads / buffer KB per frame | ≤ 150 / 160 / 0.5 / 240 | 122 / 129 / 0 / 187 |
| Rift fight: visible display objects / renderables | ≤ 1,100 / 600 | 905 / 486 |
| Rift fight: DOM paints per frame | ≤ 1.0 | 0.64 |
| Town crowd (replayed, 25 heroes): draws / binds / uploads / KB | ≤ 330 / 640 / 1.0 / 540 | 272 / 524 / 0.15 / 432 |
| Town crowd: visible / renderables / DOM paints | ≤ 3,000 / 2,400 / 0.5 | 2,476 / 1,961 / 0.01 |

fps, p95 and thread CPU per frame are printed but never gated. The run also fails on page errors, a hidden page, or a
replay that no longer shows its scene (protocol change: re-record with `scripts/perf/record-fight.mjs` /
`record-town.mjs`, see their headers). Raising a budget needs the new measurement and the reason in this file.

**It catches the orb regression**: with `Globes.tsx` and `hud.css` from 40f86c6 (before 7bfa8c2) the gate fails with
idle-town paints 2.91 per frame (budget 0.1), fight 5.05 (1.0), crowd 5.76 (0.5), and names `xpShine` (`left`),
`hm-pulse` (`color`, `box-shadow`) and `keyPulse` (`box-shadow`) [M].

Targets beyond the gate (not met yet, see §8): reference fight at 4× ≥ 30 fps (now 25.5); renderer main thread ≤ 4 ms
per frame at 1× so a 4× slower CPU still fits a 16 ms frame (now ~5.0 ms) [I].

## 7. Rules for art, VFX and HUD work (pass to the art-direction, Ranger and Mage agents)

1. **No `filters` on scene objects** (blur, glow, drop shadow, colour matrix): each is an off-screen pass per frame.
   Glows are pre-baked sprites with `blendMode = 'add'` from the shared `fx()` sheet.
2. **Keep a rig's additive parts together** in draw order (one effects container, as `PlayerArt.fxAdd`): every switch
   between normal and additive blending ends a batch (one more draw call). Hide unused glows with `visible = false`,
   not `alpha = 0` (alpha-0 sprites still split batches).
3. **No per-frame `Graphics` rebuilds** (`clear()` + redraw re-tessellates on the CPU). Draw shapes once, bake them to a
   texture (`bake.ts`), then move, tint and scale sprites.
4. **No new texture per event or per item.** New canvases and textures are uploads plus extra binds; use the shared
   atlases (`fx()`, the glyph atlas, the hero sheet). The town crowd already binds ~520 textures per frame; series
   weapon drawings and gear-effect canvases are the main source: bake them into the hero sheet or one shared atlas.
5. **Pool, don't churn.** Adding or removing children, or toggling `visible`, rebuilds that render group's draw
   instructions (since R2: only the hero's own group, or the effect layer). Keep pooled sprites in the tree.
6. **zIndex** is free in the scene's entity layer and inside a hero's body and `fxAdd` (lazily sorted). Anywhere else
   a zIndex write makes the parent sorted and rebuilds its group every time: use child order, or `lazyDepthSort(c)`.
7. **Particles** scale with `effectsFactor()` (Graphics → effects density).
8. **HUD**: animate only transform and opacity (the gate fails otherwise); no `filter` on elements whose content
   changes; anything updating at 10 Hz or more over expensive content gets its own layer (`will-change: transform`),
   and compare the pixels (promoted text can shift 1 px); never assign `ctx.font` per frame; never call
   `toLocaleString` or `new Intl.*` per frame (use `shared/src/format.ts`).
9. Before handing over: `npm run build`, then `DATA_DIR=<tmp> node scripts/client-perf-check.mjs`.

## 8. What is left (needs a decision or a bigger change)

1. **The HUD is still the largest single cost.** Hidden, the fight costs 29 % less main-thread and 51 % less
   GPU-process time (paired, after these changes); the orbs alone are 21 % of the GPU process. It comes from the orb
   design: 26 continuously animated layers that Blink re-styles every frame (26 `StyleRecalc … Animation` per frame)
   and about 9 blend-mode render passes per frame (the soft-light grain with its rotating overlay swirl alone is 14 %).
   Options for the owner: (a) the Low preset / reduce motion stills the orb motion; (b) an orb drawn in the game canvas
   (needs a look sign-off); (c) drop the blend modes of the grain swirl.
2. The target frame's HP bars transition `width` (layout and paint every frame while a target takes damage). A clip +
   translate rewrite can look identical but touches HUD markup: not done.
3. Hero rigs cost about 0.2–0.5 ms per hero per frame (weapon trails sample 20 poses per swing); 25 heroes ≈ 5 ms in
   town. Remote heroes are pose-cached at 24 Hz only above 40 active entities; lowering that threshold changes how
   smoothly other players animate: an owner call.
4. The first sight of a new look bakes its sheet (`pumpBakes`, time-sliced): about 1.6 ms per frame for several seconds
   when a crowd arrives.
5. Town life (residents, ambient motion) and NPC rigs: about 2 ms + 1.8 ms per frame in the busy square (contended
   profile).
6. Texture binds in crowds (rule 4) and the per-hero render-group batch breaks (+14 draws in the crowd).
7. 4× CPU: 25.5 fps (was 19). 30–60 fps there needs item 1 plus rig work (items 3–5).
8. Integrated GPUs on HiDPI screens: High renders at 2× (four times the pixels of 1×). Starting them on render scale 1
   would help fill rate [I], but there is no integrated GPU here to measure it: not done.

## 9. Files

`client/src/render/depthSort.ts` (new) · `scene.ts` · `art/player.ts` (2 lines) · `ui/hud/Minimap.tsx` ·
`ui/styles/hud.css` (1 rule) · `game/preferences.ts` · `game/quality.ts` (+ test) · `main.ts` · `shared/src/format.ts`
(+ `shared/test/format.test.ts`) · `scripts/client-perf-check.mjs`, `scripts/perf/` (harness, replay, recorders,
recordings, budgets) · `scripts/verify.mjs` (stage) · `scripts/shoot.mjs` (`CHROME_EXTRA` flags for the SwiftShader run).
