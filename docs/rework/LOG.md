# Rework log (terse: what changed, why, evidence)

- **R0 — baseline + tooling.** `scripts/shoot.mjs`: reusable headless-Chrome (visible page target, so rAF runs) 1920×1080
  driver for the running dev client (`open`, `cmd/debug`, keys, clicks, camera hold, grid walk-to, overlap/scroll probes).
  Before shots: `shots/before-*` (HUD, skills L1/L40, inventory, journal, world map, character, settings, social, cube,
  town at four services, Rillwake field + edge). Merged the lead's content pack (`claude/town-ui-rework`: dialogues,
  barks, `CAST.md`) by fast-forward. Design: `DESIGN.md`.
- **R1 — design system + skills + HUD menu.** `tokens.css`: surfaces/lines/text/accent/type/spacing tokens (old names kept
  as aliases with readable values: `--text-faint` 2.6:1 → ~4.6:1). One panel chrome (`PanelFrame`: medallion icon,
  title, subtitle, hotkey `kbd`, close, optional footer), segmented tabs, cards, chips, badges, form controls, focus ring,
  reduced-motion. Mechanical pass raised 144 sub-12 px labels in `panels.css` (caps tracking 0.2–0.3em → 0.08em).
  Original 24-unit icon set `hud/UiIcons.tsx`. **Skills**: one screen (loadout, 6 cards with tier pips + `[+]` spend,
  detail with tiers/runes inline, collapsible casting rules, passive slots + picker, how-it-grows card); measured
  two-click spend (29 → 27 points) and 817 px height (clears the globes) at 1080p; no scroll regions.
  **HUD**: bottom-right menu bar (8 icon buttons + Paragon at 70, hotkey badges, pips for skill/paragon points, journal
  offers/turn-ins, party invites, near-full bag); quest tracker card with step/progress; old stacked buttons removed.
  Overlap probe: none at 1920×1080 or 1366×768, L1 and L70.
- **R2 — townsfolk, dialogue, barks.** Hero rig extended for townsfolk only (`gear.ts` Body: beard/beardColor/face;
  `heroParts.ts`: short/cropped/balding/bun/curly/braid hair, full/braided/goatee/moustache/stubble beards, monocle/
  spectacles/goggles/eye patch; `gear.ts`: hammer, tongs, chalk rod, spear, broom, rod, pole, poker, rake and held
  book/mug/lantern/lute/flag/slate/basket/gem/tin/scroll). `npcLooks.ts`: 14 named presets from `CAST.md` + 13 resident
  looks + deterministic fallback; contact sheet `gallery-art.html?view=npcs` shows 27 distinct silhouettes. Work loops on
  the shared town clock (smith hammers every 2.4 s with the anvil sound, bard whistles with notes, mystic/keeper bless).
  Name plates: name + role line + role glyph. **Dialogue window** (lead request): E on a quest contact opens portrait,
  conversation topics, quest offers/turn-ins/objective actions, merchant and journal links (verified with Orren).
  **Barks**: `render/barks.ts` speech bubbles (cooldowns, max two ambient); the service `bark` banner is gone.
- **R3 — new Hearthmere.** Authored source `shared/src/data/town/build.ts` → `hearthmere.json` (validator green: every
  service reachable, 8 swept routes, doorway clear; stable ids kept). Layout per `DESIGN.md` §4: escarpment north, lake
  south, canal + stone bridge west, gate east; every facade faces the camera; services stand in front of their houses.
  Renderer: painted ground chunks (`townGround.ts`), kit-painted houses with tile courses, round towers, glass dome,
  lighthouse and inn cutaway (`townHouses.ts`), scenery/fences/trees/boats/waterwheel (`townScenery.ts`), residents and
  ambient life (`townLife.ts`). Walk-behind ghosting for houses and tall scenery. Solid-looking furniture is collision.
  Measured: chunk bake 80 → ~10 ms after bounds-limited regions; baking time-sliced (worst slice 6–11 ms); FPS 130–160
  standing, 124 during a fast full-town pan (visible tab). Bug found and fixed: flagstone rows never reached y > 0.
  Old-layout tests updated deliberately (gap check, inn depth, furniture ids, edge sampling density).
- **R4 — world map + journal.** Painted frontier chart with live roads/fog/nodes/pin/route/"you are here"; inspect-only
  selection, travel rule unchanged; area tab framed to walkable ground with labels. Journal: act/chapter accordion with
  progress, status chips, inline objectives/rewards/track toggle (1240×~880, no scroll regions). Found and fixed: R2's
  dialogue window had made field-event triggers unreachable (now in the dialogue); first-open FAQ text was an uppercase
  screen banner that overflowed behind panels (now an in-panel card; long notices wrap).
- **R5 — quest objects, chat, character.** CAST.md quest objects with tracked pulse / bounce / used state (gallery
  `?view=quest-objects`); chat channel tabs; character headline cards; bubbles above two-line plates.
  **Perf, 100 simulated heroes walking the square, visible tab, 1920×1080:** old town 86 fps still / 79 fps panning
  (p95 17.5 / 18.1 ms, worst 26.7 / 35.1 ms) → new town 88 / 83 fps (p95 16.5 / 18.5 ms, worst 25.7 / 50.3 ms; the worst
  pan frame is a visible chunk finished synchronously during a pan far faster than walking). Same machine, same path.
- **R6 — final checks.** `npm run test:server` found two regressions against the old town (old data: 755 pass / 1 known
  Windows shutdown-probe failure): (1) "rift portal spawned near the obelisk" — the NE Obelisk put new portals outside the
  interest box (AOI ±1150×760) of a player at the square; **moved the Obelisk beside the square** (≈420 u from the
  Waypoint, flagstone circle with broken columns; the NE terrace stays as a ruined overlook), which also shortens the rift
  loop; (2) an EPERM "[persist] failed to save" log line — Windows refuses to rename a temp save over a file another
  process is reading (here the test; in the wild antivirus/backup tools); `JsonCharacterStore.write` now retries that
  rename up to 7 times (15 ms → 1.9 s total, Windows only, same atomic temp+rename). Result: 755 pass / 1 known failure,
  identical to baseline. Gate towers rebuilt in stone; harbour crane lowered so it no longer crosses the Obelisk.

## Lead log, 2026-10-10 evening (UI rounds 2–3, balance, accounts)

- **Balance pass** (`BALANCE.md`): kill XP ×0.2, story XP ×0.5, per-level toughness/damage curves fitted to an "engaged
  bot", field drops ×1/6 on top of ×2/3 (boss and goblin batches untouched). Master/Hard stay open from level 1.
- **Panels, round 2** (commit `c1a0ece`): Paragon, Stash (drag between bag and stash, filter chips), Cube stage with
  eligible-item strip, Collection, Social, Party and the HUD party frames, on one rail/card language
  (`panels-more.css`, `panels-collection.css`, `panels-social.css`).
- **Panels, round 3** (commit `56b8d46`, `panels-services.css`): Merchant (offer grid, hover compare, upgrade arrow,
  exact-offer pane), Waypoint (destination list + detail + channel switcher), Rift Obelisk (14-step ladder, no paging;
  the legendary chance shown is `+30 % per difficulty index`, which is what `rollRarity` does), Guild & reports, Inspect
  (paperdoll-shaped grid), Run summary. The lock icon's shackle was a dark stroke that vanished on dark rows; it is now
  part of the silhouette. Removed superseded rules from `panels.css` and the unused `passives.tsx`.
- **Accounts, client** (commit `6d88ce5`): see `ACCOUNTS.md` → "Client screens". `GET /api/config` exposes the mode;
  `off` is byte-for-byte the old flow. Walkthrough on spare ports with an isolated `DATA_DIR`: register → one-time codes
  → play → reload resumes → log out → guest refused for a linked name → wrong password → recover with a code → code is
  single-use → new password → play. Accounts suite 11/11 (including a parity test for the client input rules).
- **Known gaps:** Settings panel redesign waits for the gear agent's toggles; the owner's :2577 playtest server was not
  listening when checked at 23:30 (saves present; not touched); `hud.css` in the main working tree is an untracked stray.

## Lead log, 2026-10-11 (merge of gear and worlds, Settings, interface size)

- **Merged** `claude/gear` (tier ladder, set identities, live effects, UI tiers; protocol 22) and `claude/worlds` (zone
  kit, painted zone renderer, zone life, shrines and caches, rebuilt quest zones, side quest). Full `npm run verify`
  passed on the merged tree (24 stages, server 757/0, simulation green). The 36 "before" PNGs of the worlds branch were
  recompressed to JPEG (33 MB → 6 MB) at merge time; `scripts/shoot.mjs --jpeg[=q]` exists for new evidence.
- **Settings** redone (Sound / Display / Controls rail, cards, switches, sliders); gear-effect choices live in Display.
- **Interface size** (85–150 %): scales the HUD unit, window dock and tooltips. Windows are capped so the tallest one
  (journal, 909 px) always fits the screen height; at 1080p a large size can make an open window cover part of the
  bottom bar. Applied on slider release.
- **Area map**: framed and centred on the ground, backdrop colour outside the baked image, greedy label placement that
  avoids overlaps and clipping (zones are now 7.8–12.3 screens large).
- **Shrine buffs** have names and icons in the buff row.
- **Dev link** :2587 now serves the merged build (protocol 22); the owner's playtest server :2577 was not running and
  was not touched.
- **Gotcha:** `npm run verify` / `npm run build` overwrite `dist/client`, which :2587 serves; `.local/safe-verify.sh`
  copies it aside and restores it.
