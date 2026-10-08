# HANDOFF — build a New-Tristram-class town for Hearthfall (written by Claude, 2026-10-08, for Codex)

You have never seen the conversation that led here. Everything you need is in this file. **Read all of it before touching code.** `AGENTS.md` is the 40-line version. The owner trusts the instructions below; if you disagree with one, you may deviate **only** through §2.2 (document it, show evidence).

---

## 0. The 60-second version

* **Game:** *Hearthfall* (working title): a browser-first 2D Diablo-3-style online ARPG. Stack: **TypeScript + PixiJS 8 + Preact client, TypeScript/Node authoritative 20 Hz server**, shared rules in `shared/`. It is fun and playable today (Whirlwind and the other 17 skills, loot, Cube, Paragon, rifts, multiplayer).
* **Your job:** replace the current tiny procedural town with a **full, hand-authored, almost-1:1 *layout* of Diablo III's New Tristram hub** (original art, original names), as a **real game world**: authored data, working collision, depth/occlusion, lighting, ambient life, sound, and **every Diablo III town service as a working NPC** (Blacksmith, Jeweler, Mystic/enchanting, Stash, Cube, Waypoint, Rift Obelisk, …). **Not "PNG on PNG".**
* **Branch:** work ONLY on **`codex/new-tristram-town`**. The safe baseline is branch `claude/wizardly-feynman-9hd73d` = tag **`baseline-original-ts-794f77e`**. Never push, force-push, rebase or delete anything on the baseline branch. If you wreck something, the owner resets to the tag in one command.
* **Freedom:** the plan in §7 is *my default*, not a cage. If you can get a clearly better result by another route, take it (§2.2).
* **Do not touch:** characters/heroes ("the old character" stays exactly as is), combat, skills, loot, UI look, saves, netcode behaviour. Only the town, its services, and what the town needs.

---

## 1. Mission and what "done" means

### 1.1 The goal in one paragraph
Today `genTown(seed)` in `shared/src/mapgen.ts` builds a **50×38-tile (3200×2432 u) procedural grassy square** with five circle-collision "buildings", a plaza and eight NPC spots. The owner wants the real thing: a town that reproduces **the structure, proportions, landmarks and service flow of Diablo III's New Tristram** (a dreary, torch-lit frontier settlement beside the ruins of the old Cathedral, with its inn, shacks, Cain's house, waypoint at the centre, artisans, stash, …), drawn with **original** art so it can ship. They want it to feel like a *world you live in*, not a backdrop.

### 1.2 What "a real game world, not PNG on PNG" means (binding checklist)
All of these must be true, and you must prove each with evidence (§9):
1. **Authored data is the source of truth**, not a baked picture: layout, building footprints, collision shapes, depth baselines, props, NPC spots, lights, emitters, sound zones and minimap icons live in data files that both server and client load deterministically. Art is *generated from / placed by* that data.
2. **Collision is real and exact.** Players cannot walk, dash or be pushed through buildings, walls, fences, wells, stalls, carts, statues, pillars, water or map edges; they *can* walk through doorways, gates and passages. Server (authoritative) and client (prediction) use the **same** shared collision code and agree to the unit. Visible geometry and collision agree within **8 world units** everywhere (one hero is 64 u tall).
3. **Correct occlusion and depth.** Walking behind a building/roof/wall/tree hides the hero behind it; walking in front shows him in front; tall objects sort by **baseline polylines**, not by one centre point. No popping, no wrong overlaps at corners.
4. **Light.** One cohesive lighting model: dusk/overcast ambient, warm point lights (torches, braziers, fires, lit windows) with flicker, soft shadows/contact shadows from every solid thing under one consistent light direction. The plaza at night-ish mood must read in a screenshot.
5. **Life.** Things move without the player: flames, smoke, embers, drifting fog/dust/leaves, swinging signs, flapping banners, water ripples, NPCs with idle animations (the blacksmith actually hammers, the inn has movement), a few wandering/idling villagers, ambient birds/crows, etc. At least **8 distinct ambient animation types** visible within one screen of the plaza.
6. **Sound.** Positional ambient sound bound to the world data (fire crackle at fires, hammer on anvil at the forge, murmur at the inn, wind, distant bell), using/extending the existing `zzfx` bank. Silence is a bug.
7. **Services work, in the world.** Every service is a physical NPC/structure you walk up to; the **server verifies proximity** before executing the operation (today it does not, §4.6). UI panels already exist (Cube, stash/inventory, waypoint, obelisk, paragon); reuse them.
8. **It is a place, not a map.** Districts with distinct character, landmarks you can steer by, sightlines, choke points, a clear central plaza, varied ground (roads, cobbles, mud, grass, graveyard dirt, ruins), edges that read as terrain (cliffs, walls, forest, ruins) — not a rectangle fading to black. No obvious tiling, no copy-paste repetition at hero-shot scale.
9. **Multiplayer-safe:** town channels hold up to **100 players** (`TOWN_CHANNEL_CAP`); frame rate stays playable with 100 players on the owner's laptop (§6.9).
10. **It stays the same game:** all existing tests still pass; fields, rifts, combat, saves and UI behave exactly as before.

### 1.3 Owner-visible acceptance
The owner will judge with their own eyes at **1920×1080** in the real browser, walking around. They will look for: "does it feel like New Tristram's layout", "can I walk into walls" (must not), "do the blacksmith/jeweler/mystic work", "does it look sick" (art, light, motion), and "does it still run smooth". Screenshots you post must come from the running game, not mock-ups.

---

## 2. Rules

### 2.1 HARD RULES (never break; the owner's standing orders)
1. **Branching.** Work only on `codex/new-tristram-town`. Before every `git push`, run `git branch --show-current` and confirm it prints that name. Commit small and often; push at every milestone; tag milestones `town-m0 … town-m8`. **No force-push, no rebase of pushed commits, no branch/tag deletion, no `git reset --hard` of anything you did not create, no `git clean -fdx`.** Never commit to or push `claude/wizardly-feynman-9hd73d`.
2. **Do not break the working game.** Gameplay, skills, loot, progression, UI look, multiplayer and saves must behave exactly as at the baseline. Run the full check suite (§9.1) before each milestone commit.
3. **Private data stays private.** Never commit `.env`, credentials, `server/data/`, `.local/`, databases or saves. The owner's real saves live in `server/data/characters`; **for every test or experiment set an isolated `DATA_DIR`** (e.g. `$env:DATA_DIR="$env:TEMP\hf-test-saves"`). Do not read, edit or delete the real saves.
4. **NO AI SLOP (the owner's non-negotiable rule).** Never invent designs, numbers or systems from imagination or in a generic "typical AI" style. Every design decision (layout, scale, structures, NPC placement, palette, lighting, services) must be grounded in real references (Diablo III, Path of Exile, Last Epoch, Grim Dawn, Hades, Idleon …) or measurements from the game, **logged in `docs/town/REFERENCES.md` before you design it**. Label placeholders as placeholders. Say what is measured, what is inferred, what is unverified. If evidence is thin, **stop and ask the owner** (or ask them for screenshots/video).
5. **Originality and licences.** The *layout logic, proportions and service flow* of New Tristram are the **reference**. Everything that ships must be **original**: no Blizzard (or any other studio's) textures, sprites, models, audio, text, lore, or names. No tracing screenshots into assets. Town name stays **Hearthmere**; NPC personal names must be original (generic job titles like Blacksmith/Jeweler/Mystic are fine). The project's standing rule is "no Blizzard names ship". No Nexon or other proprietary/leaked code or assets. Any third-party asset (even CC0) must have its licence individually verified and recorded in `docs/town/LICENSES.md` (source URL, licence text, attribution). "Publicly downloadable" is not permission. The owner lives in the EU: check territory exclusions, revenue caps and non-commercial clauses.
6. **No paid services, no credit spend, no sign-ups.** Free/open-source/CC0 only. **Every download (tools, models, asset packs, npm packages beyond the lockfile) needs the owner's explicit OK** with name, source and size. Do not call any generative-AI image/3D service.
7. **Verify with your own eyes.** Typecheck/tests/headless assertions do not prove visual acceptance. Run the game in a real browser at 1920×1080, look at the screenshots you take, and say honestly what looks wrong. Benchmark in the real browser at a recorded resolution/workload with no build or test jobs competing (§9.4).
8. **Gates.** Stop and show the owner at the gates in §8 (layout, playable blockout, look, services, final). Do not sprint past a gate on your own taste.
9. **Windows + PowerShell.** `git commit -F file` for multi-line messages (PowerShell 5.1 mangles quotes in `-m`), no BOM; commit and push completed work. Use **they/them** for the owner. Concise updates.
10. **Ports/processes.** `npm run dev` uses 5173 (client) and 2567 (server). Stale dev servers may already be running from earlier sessions (they belong to the owner): check the ports first (`Get-NetTCPConnection -State Listen -LocalPort 5173,2567`), reuse them if they serve this tree, ask before killing anything. **Do not inject an unrelated `PORT` env var into `npm run dev`.**

### 2.2 The DEFAULT PLAN is not a cage ("go beyond the restrictions")
Everything in §6–§7 (formats, tools, art method, module layout, even some milestone order) is **my recommendation**. You may choose a different approach **if you can show it gives a better result** for the owner's goals (look, feel, correctness, performance, effort). To deviate: (1) write the decision in `docs/town/DECISIONS.md` (what, why, alternatives, evidence/prototype, risk, rollback), (2) keep the §2.1 hard rules, (3) mention it in your next report, (4) for anything that changes game rules/economy/UX beyond the town (e.g. new vendor shop, durability, transmog) **ask the owner first**. You may add systems the world needs (lighting, particles, interiors, new collision shapes, build scripts, a small in-repo map editor/debug overlay, new prop kinds, new NPC roles, protocol additions). You may restructure town-related code freely. You may not weaken determinism, authority, tests, or the hard rules.

### 2.3 Honesty about quality
If a milestone is not good enough, say so and iterate; do not present it as done. A confident wrong statement is worse than "I don't know yet".

---

## 3. Where we are

### 3.1 Repo, branches, tags
* GitHub: `https://github.com/jenteverpaelen/dungeongame` · local: `C:\Users\LaptopJente\dungeongame` (Windows 11, PowerShell, Node v24, npm).
* **Baseline** = branch `claude/wizardly-feynman-9hd73d` at commit **`794f77e`** ("Art gallery perf view…", 2026-10-05) = tag **`baseline-original-ts-794f77e`**. **Your branch** = `codex/new-tristram-town` (starts at the same commit plus this handoff).
* Revert recipe the owner can use at any time: `git checkout claude/wizardly-feynman-9hd73d` (or `git checkout baseline-original-ts-794f77e`), or to drop your work `git branch -D codex/new-tristram-town` locally and `git push origin --delete codex/new-tristram-town`.

### 3.2 How we got here (so you understand why the repo is small and clean)
1. **2026-10-04/05 — the TypeScript prototype** was built by cloud agents: monorepo (`client/`, `server/`, `shared/`), HUD, panels, 18 skills with runes, loot, Cube, Paragon, rifts, multiplayer, code-drawn heroes with turntable rig and full-body skill choreography (the **Whirlwind** animation works), procedural town/fields/rifts. The owner finds it **fun and playable**; that is the baseline.
2. **2026-10-05→07 — a Godot detour** (new engine, Blender character pipeline, AI-painted sprites, Tripo 3D, an equipment-contract study, LPC characters). It consumed days and never reached the quality or playability of the TS game. **Abandoned.**
3. **2026-10-07 — a Codex session restored the TS game** and then built a Tiled-based "Hearthmere" town, sanctuary kit, roofless interiors and an adventure milestone. The owner **discarded all of it** on 2026-10-08 ("a fresh start of all this nonsense"). Do **not** restore it wholesale; you may *inspect* it for ideas (§3.3) but you may not assume any of it was accepted.

### 3.3 What Claude did on 2026-10-08 to reset everything (exactly)
1. Identified the target: the last TypeScript commit before any Godot mention, **`794f77e`**, which includes the fix `f4413ca` that makes the Whirlwind spin visible for the local player and the F2 "Unlimited Resource" prototype toggle.
2. **Backed up first** (outside the repo): `C:\Users\LaptopJente\dungeongame-backup-20261008\` containing `all-refs.bundle` (a verified `git bundle --all` of every branch incl. the Godot and Codex-town work), `server-data\` (20 save files) and `local-private\` (the old `.local`).
3. `git reset --hard 794f77e` on the working branch; `git clean -fdx` with excludes (kept `node_modules`, `server/data`, `.local`); deleted the untracked `.tools` (≈27 GB: ComfyUI + models) and Codex's `maps/`, `tools/`, `client/public/`, `dist/`.
4. **Verified:** `npm run typecheck` passes; `npm test` (shared) 2/2; `npm run test:server` **613 passed, 2 failed** (the two failures are Windows-only SIGTERM shutdown checks that already failed before; ignore them, do not "fix" by weakening tests); the class-select screen loads on http://localhost:5173.
5. **Force-pushed** the reset to GitHub (`303bf3e → 794f77e`, with `--force-with-lease`), **deleted** the three remote `recovery/*` branches and the six local old branches, expired the reflog and ran `git gc --prune=now` (the `.git` folder went from ≈150 MB to ≈1 MB). GitHub may still serve old commit hashes for a while.
6. Added the baseline tag and this branch.
* To inspect the discarded attempts (read-only!): `git clone "C:\Users\LaptopJente\dungeongame-backup-20261008\all-refs.bundle" "$env:TEMP\hf-old"` then look at branches `recovery/town-before-authored-map-20261007`, `recovery/town-before-sanctuary-20261007`, `recovery/original-street-before-full-town-20261007`. Never merge from there.

### 3.4 Baseline you must keep green
`npm run typecheck` · `npm test` (2 tests) · `npm run test:server` (613 pass / 2 known Windows failures) · `npx tsx server/test/sim.ts` · `npm run build`. Record the exact numbers at M0 and keep them.

---

## 4. How the game works today (read before designing)

### 4.1 Stack and commands
`pixi.js ^8.22`, `preact ^10.29`, `vite ^8.3`, `typescript ^5.9` (strict), `tsx`, `ws`, `msgpackr`, `zzfx`, Fontsource (Cinzel, Alegreya Sans, Lilita One). Path alias `@shared/*` → `shared/src/*`.
```powershell
npm run dev            # server :2567 (tsx watch) + client :5173 (vite)   -> http://localhost:5173
npm run typecheck      # tsc --noEmit
npm test               # tsx --test shared/test/*.test.ts
npm run test:server    # server/test/bot.ts  (temp saves, free port)
npx tsx server/test/sim.ts
npm run build ; npm start   # built client + server on :2567
```
Handy URLs: `http://localhost:5173/?autostart=Name&class=warrior` (skip class select), **F2** in game = prototype tools (Unlimited Resource), dev galleries `http://localhost:5173/gallery-art.html?view=chars|monsters|objects|props|map|icons`, `gallery-vfx.html`, `gallery-hud.html`, `gallery-panels.html`. Real saves: `server/data/characters` (override with `DATA_DIR`).

### 4.2 Units and constants (`shared/src/constants.ts`)
`TILE = 64` world units · hero ≈ 64 u tall, `PLAYER_RADIUS = 16` · `BASE_MOVE_SPEED = 250 u/s` · dash 230 u in 170 ms (≈1350 u/s: collision must not tunnel) · tick 20 Hz · AOI half-extent 1150×760 u · `TOWN_CHANNEL_CAP = 100`, `FIELD_CHANNEL_CAP = 30` · camera shows **620 world units vertically** (`VIEW_HEIGHT` in `client/src/render/scene.ts`), so a hero is ≈110 px tall at 1080p (this is the intended scale; D3-like).

### 4.3 Map pipeline (the single most important fact)
`ZONES` (`shared/src/data/zones.ts`) defines `hearthmere` (`kind: 'town'`, size `[50, 38]` tiles). **Server and client both call `generateMap(zoneId, seed, theme)`** (`shared/src/mapgen.ts`); maps are **never sent over the network, only `ZoneInfo.seed` is** (`shared/src/protocol.ts`). `genTown(seed)` returns `MapData { zone, theme, seed, w, h, tiles: Uint8Array, props: Prop[], spawns, entry, portals, npcs: NpcSpot[] }`. Tile types: `T_VOID, T_FLOOR, T_PATH, T_WALL, T_WATER, T_PLAZA`; blocked = void/wall/water. `Prop { k, x, y, r, s, v }` (`r` = **circle** collision radius, 0 = decoration). `NpcSpot { id, name, role, x, y, r }` with `NpcRole = 'cube'|'stash'|'obelisk'|'waypoint'|'dummy'|'paragon'|'healer'|'vendor'`. Your authored town must still arrive as `MapData` (extended) from `generateMap`, deterministic, importable by both Node (`tsx`) and Vite.

### 4.4 Collision (`shared/src/movement.ts`)
`CollisionWorld(map)` = blocked tiles + a spatial hash (cell 128) of **circle colliders** (`props` with `r > 0`, and NPCs). `moveCircle` sub-steps by `r/2` and slides; `resolve`, `isFree`, `segmentBlocked` (coarse, tile sampling only for projectiles). The same code runs in client prediction (`client/src/game/prediction.ts`) and on the server, so any new collider type goes **here**, deterministic and allocation-light. **Circles cannot represent buildings, walls or fences: this is the main structural gap.**

### 4.5 Rendering (`client/src/render/`)
`Scene` (`scene.ts`) layers bottom→top: `ground → decals → groundFx → entities (sortableChildren, zIndex = y) → aboveFx → text`. `Scene.setMap(map)` calls `buildMapLayers(map)` (`art/map.ts`): a `GroundLayer` (`art/ground.ts`, 512-unit chunks painted with Canvas2D from tiles + decal stamps + prop shadows), **sorted props** (`SORTED_KINDS` in `art/props.ts`: sprites from a baked atlas, y-sorted with entities by `p.y`), decals, glow decals, and prop FX (`propFx`: flame/glow/smoke/window, animated in `onRender`). **All art is code-drawn with Canvas2D** (`drawProp(c, kind, v, theme)`) and baked into atlases at load (`art/bake.ts`, `bakeRes`). NPC art: `art/npcs.ts` (`NpcArt`, `createNpcView(role, name)`), one drawing per role. Heroes: `art/player.ts`, `heroParts.ts`, `puppet.ts`, `choreo.ts` (a rig with gear). Look rules: `docs/ART_DIRECTION.md` (chibi proportions, thick warm ink outlines, "three tones, not gradients", the ground whispers / the cast shouts, additive glow reserved for magic; the Hearthmere theme row is bright and "safe": grass `#86AD5C`, cobbles `#B8AD97`, road `#C2A476`, forest `#3C5A34`, pond `#5AA8C4`). **New Tristram is darker and drearier; reconcile the town palette/mood with references and get the owner's OK at the look gate (§8).**

### 4.6 Services and NPCs today
* `shared/src/cube.ts`: **`CUBE_FUNCTIONS` unlock by Cube level, every op grants Cube XP**: `salvage` (L1, source "D3 Blacksmith"), `fuse` gem fusion (L2, "D3 Jeweler"), `enchant` (L3, "D3 Mystic"; one affix per item ever), `upgrade`/Empower (L4, "TBH Cube tiers"), `transmute` rare→legendary (L5), `extract` legendary power (L6), `reforge` (L7), `socket` add socket (L8, "Ramaladni's Gift"). Handlers: `server/src/commands.ts` (`salvage`, `salvageAll`, `enchantRoll`, `enchantPick`, `upgrade`, `transmute`, `extract`, `cubeEquip`, `reforge`, `socket`, `insertGem`, `removeGem`, `fuseGem`; protocol `CmdOp` in `shared/src/protocol.ts`).
* **Gap:** these handlers only check `requireCube(save, op)` (Cube level). **There is no server-side proximity check**, and hotkey **`U`** opens the Cube panel anywhere. For a real town the *server* must require that the player is within the interaction radius of the right NPC (and the right zone) for each op.
* Client interaction: `E` → `Game.interact()` (`client/src/game/game.ts`) maps `role → PanelId` (`cube, waypoint, obelisk, paragon, stash→inventory`); the prompt comes from `Scene.nearestInteractable`. `PanelId` is in `client/src/ui/store.ts`. Panels: `client/src/ui/panels/{cube,inventory,skills,paragon,dialogs,…}.tsx`.
* Server: `server/src/world.ts` (zones/channels/instances; town channels, rift instances), `server/src/sim/instance.ts` (tick, entities), `sim/spawner.ts` (`spawnDummies()` reads the `dummy` NPC spots and creates **server-side monsters** so they can be hit), `sim/damage.ts` (no damage in town), `sim/instance.ts` (no summoning in town).
* **Does not exist (needs owner approval before you build it):** vendor buy/sell shop, item durability/repair, transmogrification, Kadala-style gambling, quest/dialogue system, inn rest bonuses. Roles `healer`/`vendor` exist only as placeholder art.
* Audio: `client/src/audio/{bank,sfx}.ts` (`SOUNDS` = zzfx parameter sets, `sfx.play/loop/setListener`); today only a global listener position.

### 4.6a Known limitations that block a "real world" (fix these)
Circle-only collision · no depth baselines (single y per prop) · no lighting layer · props are static sprites with limited FX · ground is a procedural paint (no authored layout) · NPCs are fixed icons, not animated characters · minimap is tile-based · services lack authority checks · one 50×38 map with no districts.

---

## 5. The target town

### 5.1 Reference method and legal framing
"Almost 1:1" means **same layout logic, scale relationships, landmark arrangement, service flow and mood** as Diablo III's New Tristram, redrawn from scratch. Build a reference dossier **first**: `docs/town/REFERENCES.md` with ≥ 12 entries (URL, what it shows, what you extracted, confidence), covering: top-down/in-game map, 360° screenshots from the plaza, each service's surroundings, scale (character heights between landmarks), lighting/time of day, ground materials, wall/fence/building construction, NPC list and positions, ambient sounds, adjacent areas/exits. **Do not commit Blizzard images** (keep them in a git-ignored folder, e.g. `docs/town/reference-local/`); commit only your notes, measurements and **your own traced layout diagram**. If online evidence is insufficient to get the layout right, **ask the owner for screenshots/video** (they own the game): the in-game map screen, plus walking video of the whole town.

### 5.2 What is already sourced (web search on 2026-10-08; verify from primary pages/screenshots)
* New Tristram is the starting town of Diablo III, built near the ruins of Old Tristram and the **Cathedral** that drew adventurers; the settlement is a decaying frontier town: "mostly depressing shacks", **"the inn is the only building that looks even the least bit habitable"**, a bleak/dreary mood (PlanetDiablo archive: `https://gamespy-archives.quaddicted.com/sites/www.planetdiablo.com/diablo3/locations/newtristram/index.html`, fetched OK).
* NPCs named on the Diablo wiki (seen only through search summaries; the page itself returned HTTP 403 to my fetcher, `https://diablowiki.net/New_Tristram`): Blacksmith, Jeweler, Mystic (the third artisan added in Reaper of Souls), Deckard Cain, the Mayor, Leah, a collector, a healer, a barkeep, a guard captain, a fence, a miner. In **Adventure Mode the Jeweler and Mystic stand north of Cain's House**; the **waypoint is in the centre of town**; the in-game map marks **Stash, Inn, Waypoint**.
* **Everything else about the layout is unverified** (street plan, building positions and counts, cathedral approach, gates, walls, bridges, scale). Do not invent it: research it (5.1). The cloud-written `docs/research/12-world-town-dungeons.md` summarises hub towns of several games but its claims are **uncited**; treat as leads, not facts.

### 5.3 Layout and scale acceptance (measure, do not eyeball)
Produce `docs/town/DESIGN.md` with: a district diagram (SVG or PNG you generate), a table of every structure (id, kind, footprint polygon in world units, height class, enterable?, collision, depth baseline, lights, emitters, purpose), a table of services with coordinates, and measured routes: **walking time at 250 u/s from the waypoint to every service** and between neighbouring services (reference: the earlier research claims "all essential vendors reachable in < 30 s from the centre"; verify against New Tristram footage rather than trusting that line). Size the town in **hero-heights** derived from references (record the numbers), then convert to world units; the current map is only ~50×38 tiles, expect to enlarge `ZONES.hearthmere.size` considerably (AOI is 2300×1520 u, the camera 620 u tall) and justify the final size.

### 5.4 Structures (finalise from evidence; expect roughly this vocabulary)
Central plaza with the **waypoint** · an **inn/tavern** (the only solid building, warm lit windows, sign, maybe enterable) · rows of **shacks** (ramshackle timber/stone, patched roofs, chimneys, laundry, crates, carts) · the **ruined Cathedral** and its approach (broken façade, rubble field, stairs/arch leading to a dungeon entrance or a boarded gate) · **graveyard / old-Tristram ruins** · **Cain's house** (and the Loremaster-analogue NPC, original name) · **Blacksmith forge** (anvil, bellows, forge fire, weapon racks) · **Jeweler and Mystic stalls/tents/wagons** (north of the sage's house per the Adventure-Mode note, once verified) · **stash** (a chest/ledger post), **well**, **market stalls**, **palisade/walls/gates/fences**, **bridge/ford/road to the field zones** (`travel` portals/waypoint), **training yard** with dummies, **rift obelisk** site, **Paragon shrine**, **campfires/braziers/lantern posts**, trees, boulders, ditches, mud, puddles, wagon wheels, scarecrows. Vary silhouettes, roof pitches, materials, wear. No two shacks identical.

### 5.5 NPC and service roster (D3 feature parity; map onto the *existing* server ops first)
| D3 town feature | Existing op(s) / data | NPC / world object | Notes |
|---|---|---|---|
| **Blacksmith** (salvage; D3 also crafts/repairs) | `salvage`, `salvageAll`, `upgrade` (Empower) | Blacksmith NPC at the forge, hammering | repair/crafting = **new**, ask |
| **Jeweler** (gems) | `fuseGem`/`fuse`, `insertGem`, `removeGem`, `socket` | Jeweler NPC at a stall | |
| **Mystic** (enchanting; transmog in D3) | `enchantRoll`, `enchantPick` | Mystic NPC (**enchanting must work**) | transmog = **new**, ask |
| **Kanai's Cube analogue** | `transmute`, `extract`, `reforge`, `cubeEquip` | "The Ancients' Cube" object (already named) | |
| **Stash** | stash/inventory panel | stash chest | |
| **Waypoint** | `travel` | waypoint (plaza centre) | |
| **Rift Obelisk** | `riftOpen`/`riftEnter` | obelisk | |
| **Paragon shrine** | `paragon` | shrine | |
| **Healer** | none today | healer NPC (D3 has one) | purely cosmetic unless owner approves a mechanic |
| **Vendors** (buy/sell), **Kadala-style gambling**, **sage lore** | none today | vendor/ sage NPCs | **new systems: ask the owner** first; you may place the NPCs with idle art and a "coming soon" bark only if the owner agrees |
| **Training dummies** | server-side monsters | yard | keep working (`spawnDummies`) |
Keep **Cube-level unlock gating** (progression) but present locked functions inside the right NPC's panel ("unlocks at Cube level N"). Reuse `cube.tsx`: give it a per-NPC mode/filter rather than rebuilding the UI. **Remove or restrict the `U` hotkey** so services need proximity. **Server:** add `requireNear(session, role|id)` (zone must be a town; player within the NPC's `r` + a margin; reject spoofed ops) and call it in every service handler; add tests that a far-away player is rejected.

---

## 6. World systems requirements (what must exist)

1. **Authored town data** (`shared/`): extended `MapData` with building footprints (polygon, height class, door openings), collision shapes (convex polygons/segments/capsules + circles), depth baselines (polyline per tall object), zones/districts (id, polygon, name, mood, ambience), lights (pos, colour, radius, flicker), emitters (kind, pos, rate), sound emitters, minimap icons, NPC spots with animation/idle behaviour ids, spawn/entry, portals. Deterministic, serialisable, versioned, validated by a checker that fails on overlaps, unreachable services, services inside walls, tiny gaps (< 2× player diameter) and out-of-bounds.
2. **Collision** (shared/server/client): convex polygons and segments in the spatial hash, continuous (swept) movement so a 1350 u/s dash cannot tunnel through a 16 u wall, sliding along edges without sticking on convex corners, no jitter between client prediction and server (compare predicted vs authoritative positions in a test: ≤ 0.5 u divergence over 10 000 random steps), `segmentBlocked` for projectiles/line-of-sight using the same shapes (so rifts/fields are unchanged). Keep the old circle colliders for other zones. Tests: wall-walk fuzz (random headings against every building edge: never inside), doorway passability, dash through gaps, determinism (same seed → same shapes).
3. **Depth/occlusion:** buildings and tall props draw as one or several sprites with an explicit **baseline** (y-sort key from the data), multi-part buildings split into back wall / front wall / roof so heroes can pass behind or in front correctly; roofs/awnings fade when the hero stands behind or under them if you make interiors enterable.
4. **Lighting:** a lightweight pass (e.g. a screen-sized light render-texture multiplied over the world with additive point lights, or per-sprite tint) that works in Pixi 8 on integrated GPUs; flicker and colour per light; player torch optional; budget it (§6.9).
5. **Ground:** authored, not scattered: roads and plaza with believable cobble layout, mud/dirt/grass blends, puddles, tracks, graveyard soil, rubble, blood/ash stains near the Cathedral; transitions between materials; AO under buildings; avoid visible tiling. Keep chunked baking (`CHUNK = 512`) or replace it if you can do better.
6. **Buildings/props art:** see §7.5 for the production options. Whatever method: original, consistent perspective (the game's oblique 3/4 view), consistent light direction, outlines/shading consistent with `docs/ART_DIRECTION.md` unless the owner approves a shift, readable at 110 px hero scale.
7. **NPC life:** human NPCs as **animated characters** (reuse the hero puppet/rig in `art/player.ts`/`heroParts.ts`/`puppet.ts`/`choreo.ts` so they match "the old character"), with role props (apron + hammer, hooded mystic with orb, jeweler with loupe, healer with satchel, guard with spear) and idle loops (hammering, sweeping, pacing, praying, chatting); a few ambient villagers with simple deterministic wander (must not desync between clients: seed from time/ids, or run server-side). Barks/ambient chatter lines (original text) near NPCs.
8. **Ambient FX:** flames, smoke, embers, fog banks, drifting leaves/dust, birds/crows, fireflies at night, rain optional, banners/cloth/signs sway (cheap vertex/skew or frame swaps), water ripples; all pooled and culled.
9. **Performance budget (measure first, then hold):** at M0 record the baseline for the *current* town at 1920×1080 in the owner's Chrome with **100 players** (use `gallery-art.html` perf view with `players=` / `monsters=` params, or the bot harness) — fps avg/p1, frame time, JS heap, texture memory, load/bake time. Then the new town must stay within **15 % of baseline fps and never below 60 fps average** on the owner's RTX 4070 laptop (8 GB; ~4–5 GB free in practice), load/bake time < 5 s, texture memory budget you propose and justify. Cull everything off-screen; no per-frame allocations in hot paths; batch sprites (atlases); keep Canvas2D baking out of the frame loop.
10. **Audio:** positional emitters from data (distance attenuation + pan), ambience beds per district, one-shots at NPC actions (anvil, bellows, gem tink, mystic hum), UI sounds on panels; respect the existing `sfx` volume/mute; extend the bank with new procedural zzfx sounds (original).
11. **Minimap:** shows the new town (buildings, roads, water, service icons) — `client/src/ui/hud/Minimap.tsx` today draws from tiles/props.
12. **Camera:** keep `VIEW_HEIGHT = 620`; you may add soft camera bounds so the hero never sees void at the map edge.
13. **Multiplayer:** town channels of 100; NPC animations/ambient villagers identical for all clients; server authority for services; nameplates and chat unchanged.

---

## 7. How I would do it (default plan; deviate per §2.2 if better)

### 7.1 Order of work
Evidence → layout → **data + collision + blockout (no art)** → playable greybox with services → art pass → light/life/sound → interiors (stretch) → performance → hardening. Never start art before the blockout is walkable and its collision tests pass: art on a wrong layout is waste.

### 7.2 Data format and authoring
* **Recommended:** author the town in a visual editor that exports JSON, then compile to a `TownData` module in `shared/src/data/town/hearthmere.json` (+ a typed loader `shared/src/town.ts`). **Tiled** (free, GPL, maps as JSON, object layers with polygons and custom properties) fits (tile/terrain layers for ground, object layers `buildings`, `colliders`, `props`, `lights`, `emitters`, `npcs`, `zones`, `soundscape`). Using Tiled means a download: **ask the owner for approval** (name: Tiled Map Editor, source: mapeditor.org, size ≈ 50 MB), or skip it.
* **Alternative (no download):** write the layout as TypeScript data builders with a small in-repo debug overlay/editor (`/gallery-art.html?view=map` is a start) that draws footprints, colliders, baselines, lights and walk-times; iterate by editing data and reloading. This is perfectly acceptable if it gives you faster, more exact iteration.
* Add `npm run town:check` (validators above) and `npm run town:build` if you compile; wire into the `test` chain without breaking existing scripts.
* Keep `generateMap('hearthmere', seed)` as the single entry; `seed` may now only select cosmetic variations (flower scatter etc.), never layout.

### 7.3 Shared / server / client changes by file (suggested)
* `shared/src/data/zones.ts`: enlarge `hearthmere.size`.
* `shared/src/mapgen.ts`: `genTown` → `loadAuthoredTown()`; extend `MapData` (footprints, colliders, baselines, lights, emitters, zones, icons) with defaults for other zones so fields/rifts stay byte-identical (add a test that `generateMap` for fields/rifts is unchanged for fixed seeds).
* `shared/src/movement.ts`: polygon/segment colliders + swept resolution (+ tests in `shared/test/`).
* `server/src/commands.ts` (+ `session.ts`): `requireNear` for all service ops; `server/src/sim/spawner.ts`: dummies from data; keep town non-combat.
* `shared/src/mapgen.ts` `NpcRole`: add roles (`blacksmith`, `jeweler`, `mystic`, `sage`, `innkeeper`, `guard`, `villager`, …) and a role→panel/ops table in shared code so client and server agree.
* `client/src/render/art/map.ts`, `ground.ts`, `props.ts`, `npcs.ts`, `fx.ts`: authored ground, building sprites with baselines, lights pass, animated NPCs, emitters; `client/src/render/scene.ts`: layers for lights/roofs; `client/src/game/game.ts`: interaction map, remove `U` global; `client/src/ui/store.ts` `PanelId` + `ui/panels/cube.tsx` per-NPC modes; `client/src/ui/hud/Minimap.tsx`.
* `client/src/audio/bank.ts`, `sfx.ts`: positional emitters.
* Docs: `docs/town/{REFERENCES,DESIGN,DECISIONS,LICENSES,PERF}.md`.

### 7.4 Collision implementation sketch
Spatial hash of convex polygons (decompose concave footprints into convex pieces at build time) and segments; circle-vs-convex-polygon resolution (closest point on polygon, push out along normal), iterate 2 passes like the current `resolve`; sub-step by `r/2` in `moveCircle` already prevents tunnelling at dash speed for polygons ≥ 16 u thick; thin fences must be ≥ 8 u thick in data (or use swept test). Add a debug draw of colliders (client dev overlay, toggle with a key) and overlay it in the screenshot tour to prove visuals = collision.

### 7.5 Art production options (choose with evidence; this is the biggest quality lever)
* **A. Engine-native Canvas2D painting (current approach), taken much further** — layered building sprites (back wall, front wall, roof, details), baked AO/lighting hints, material textures from noise + hand-tuned vector detail, many variants from parametric generators (timber frames, shingles, stone courses). Pros: zero licensing risk, deterministic, consistent with the existing code, fast iteration. Cons: needs real craft to avoid a "vector clip-art" look.
* **B. Offline 3D→2D prop rendering** (Blender is installed at `C:\Program Files\Blender Foundation\Blender 5.2\`; the owner has *not* approved new downloads): model buildings procedurally by script, render orthographic 3/4 sprites with toon/painterly shading and outlines, bake to PNG atlases committed under `client/public/town/` (small, deliberate, licence-clean). Pros: consistent perspective, rich detail, AO and lighting baked, many variants cheaply. Cons: adds an offline toolchain and asset binaries; do not repeat the earlier "character pipeline" rabbit hole: only for **environment props**, and only if a one-building proof beats option A side-by-side at the look gate.
* **C. Hybrid:** A for ground/roads/FX/lighting, B for hero buildings.
* **Not allowed:** generative-AI imagery (no paid services; no local AI stack exists any more), ripped game assets, unverified third-party packs. CC0 packs only after the §2.1(5) licence check and owner OK for the download.
Whichever you pick: build **one hero vertical slice first** (the inn + a shack + a lamp + the plaza ground + one light + one NPC) and show it at the look gate before scaling.

### 7.6 NPCs
Create `NpcLook`s using the existing hero rig (`PlayerLook`/gear slots) so they share style with players; add choreography entries (hammer, sweep, gesture) in `choreo.ts`-style data; place per role with idle loops; keep the interaction prompt (`E`, name plate, role colour) and glow as today.

### 7.7 Tools for you
Typecheck/tests as in §3.4; the galleries; `scripts/e2e.mjs` is a Playwright script but Playwright is **not** installed (installing needs owner approval); for stills use headless Chrome (`chrome.exe --headless=new --window-size=1920,1080 --screenshot=<file> <url>`; it ships with the owner's PC) or the browser tooling you have. Always look at what you captured.

---

## 8. Milestones and owner gates

| M | Deliverable | Acceptance (all required) | Gate |
|---|---|---|---|
| **M0 Recon** | `docs/town/REFERENCES.md`, `DESIGN.md` (layout diagram, structure + service tables, routes), `DECISIONS.md`, `PERF.md` baseline, baseline check results | ≥ 12 logged references; layout measured in hero-heights; baseline numbers recorded; open questions listed; nothing coded yet | **Gate 1 — owner approves the layout diagram** (post the image) |
| **M1 Data + collision + blockout** | `TownData` schema, loader, extended `MapData`, polygon collision, validators, debug overlay, flat-colour blockout render, minimap support | all old tests green; new collision tests (fuzz, doorways, dash, determinism, prediction parity); town fully walkable and *solid* where it should be; fields/rifts unchanged (golden test) | — |
| **M2 Services greybox** | NPC spots for all services wired; `requireNear` on every op; per-NPC panels (Cube modes); dummies; waypoint; obelisk; walking-time table verified in game | each op works only near the right NPC, rejected otherwise (tests); `U` no longer global; routes match `DESIGN.md` | **Gate 2 — playable blockout** (owner walks it) |
| **M3 Look slice → art pass** | hero vertical slice, then ground + all exteriors + shadows + baselines/occlusion | 6 hero screenshots at 1080p from the running game; occlusion verified at every building corner; collision overlay matches visuals ≤ 8 u | **Gate 3 — look approval** (slice first, then full pass) |
| **M4 Light, life, sound** | lighting pass, emitters, animated props/NPCs/villagers, positional audio | ≥ 8 ambient animation types in the plaza; sound emitters audible and positional; flicker/colour per light; frame budget held | **Gate 4** |
| **M5 Interiors (stretch)** | enterable Inn and Forge with roof fade and interior props | no collision leaks; occlusion right; services reachable | optional |
| **M6 Services polish** | NPC dialogue barks, panel polish, locked-function states, tutorials hints | enchanting/blacksmith/jeweler flows verified end-to-end with an isolated save; screenshots of each panel in the world | **Gate 5 — services** |
| **M7 Performance** | 100-player measurement, optimisation | within §6.9 budget, numbers in `PERF.md` with machine, resolution, method | — |
| **M8 Hardening** | docs, cleanup, final tour, PR text | all checks green; final 20-shot tour; list of known issues | **Gate 6 — final** |

Between gates keep committing/pushing to your branch. If a gate fails, iterate; do not move on.

---

## 9. Verification protocol (what "proved" means)

1. **Always run:** `npm run typecheck`, `npm test`, `npm run test:server` (expect 613/2 known), `npx tsx server/test/sim.ts`, `npm run build`, plus your new tests (`town:check`, collision, services-authority, determinism). Use `DATA_DIR` isolation.
2. **Screenshot tour** (committed under `docs/town/tour/`, ≤ 3 MB each, JPEG/PNG from the running game at 1920×1080): plaza centre, each service, each district, every building corner where occlusion matters (both sides), the Cathedral approach, edge-of-map, a night-lit shot, a 20-player crowd shot. Name them by waypoint id. Inspect each; list defects you see.
3. **Collision proof:** automated fuzz + a recorded walk along every building perimeter; debug-overlay screenshots (colliders on top of art).
4. **Performance proof:** baseline vs new, same machine/resolution/workload/duration (≥ 60 s), no other jobs running; record fps avg/p1/min, frame ms, heap, texture MB, load time; note the Windows hidden-tab trap: `requestAnimationFrame` pauses in a hidden/occluded tab, so confirm `document.hidden === false` before trusting any number.
5. **Services proof:** scripted client (bot) per NPC: far → rejected; near → success; Cube-level locked → correct message; no duplication/dupe exploits (item ids), saves intact after logout/login.
6. **Multiplayer proof:** two clients in one town channel see the same NPC animation state and each other's movement; no desync of collision.

## 10. Reporting format (every update)
(1) What I did (files/commits). (2) **Measured** facts. (3) **Inferred** claims. (4) **Unverified** or failing items. (5) Screenshots (and what is wrong in them). (6) Decisions taken (with `DECISIONS.md` ids). (7) What I need from the owner. Keep it concise; no hype.

## 11. Questions the owner must answer (ask early, M0)
1. Screenshots/video of New Tristram (map screen M, a walk around the plaza, each artisan's spot): can you provide them?
2. OK to download Tiled (free, mapeditor.org)? Or prefer a code-only editor?
3. Mood: keep the current warm "safe" palette or go to New Tristram's darker, drearier mood (recommended: darker; confirm at the look gate)?
4. New systems (vendor shop, repair/durability, transmog, gambling, quests/lore): approve any, or keep the town limited to the existing ops?
5. Interiors: should the Inn and the Forge be enterable (stretch M5)?
6. Town size: OK to enlarge `hearthmere` substantially (cost: bake time/memory)?
7. Is `U` (Cube hotkey) to be removed entirely, or kept only near the Cube?

## 12. Appendix
* **Key files:** `shared/src/{constants,mapgen,movement,cube,protocol,types}.ts`, `shared/src/data/zones.ts` · `server/src/{world,commands,config,main}.ts`, `server/src/sim/{instance,spawner,damage}.ts`, `server/src/net/session.ts` · `client/src/render/{scene.ts,art/{map,ground,props,npcs,fx,bake,player,heroParts,puppet,choreo,palette}.ts}`, `client/src/game/{game,world,input,prediction}.ts`, `client/src/ui/{store.ts,hud/Minimap.tsx,panels/*}` · `docs/{ARCHITECTURE,ART_DIRECTION}.md`, `docs/research/*`.
* **Known baseline facts:** 18 skills ×3 runes ×3 tiers; Cube unlocks L1–L8; level cap 70 + Paragon; channels 100 (town) / 30 (fields; the owner said 20); rifts 4-player parties; XP multiplier dev default 3; Windows needs `scripts/dev.mjs` (already handled).
* **Gotchas:** PowerShell 5.1 quoting; BOM-free commit message files; `tsx watch` restarts the server on file changes (good) — stale dev servers may already be running; Pixi v8 API differences from v7 (use `Container`, `Sprite`, `Graphics` v8 patterns already in the code); `@shared` alias in Vite and tsconfig; Vite JSON import is fine, keep the town data tree-shakable.
* **Contacts:** the owner is in Belgium (EU), Windows 11 Home, RTX 4070 Laptop 8 GB / 15.7 GB RAM, Chrome.
