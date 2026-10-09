# Hearthfall (prototype)

A 2D massively-multiplayer action RPG built around combat, loot and number-go-up:
Legends of Idleon-style paper-doll characters, Diablo 3 Reaper of Souls density, itemization and paragon,
and a Task Bar Hero-style levelling Cube. Browser-first, designed to ship on Steam with cross-play.

## Run it

```bash
npm install
npm run dev          # game server on :2567 + client on http://localhost:5173
```

Open http://localhost:5173 in two browser tabs to see two players in the same world.

Production-style single port: `npm run build && npm start` → http://localhost:2567

WebSocket connections require an allowed browser origin. Defaults allow HTTP `localhost`, `127.0.0.1` and `[::1]` on the configured `PORT` and Vite port5173. For LAN, a different development port or hosted clients, set `WS_ALLOWED_ORIGINS` to a comma-separated list of exact origins, for example `https://play.example,https://stage.example:8443`. This replaces local defaults; include local origins explicitly if needed. No paths, trailing slashes, credentials or wildcards. Missing/invalid origins are rejected. Native test clients must send their intended HTTP(S) Origin too. This is not account authentication. See [connection operations](docs/phase/P03-foundations/CONNECTION-OPERATIONS.md).

## Tests

```bash
npm test                         # shared rules (items, stats, maps)
npx tsx server/test/sim.ts       # gameplay simulation: every skill/rune/set, elites, rifts, balance numbers
npm run test:server              # headless bot clients: every command, multiplayer, persistence, a full rift
node scripts/e2e.mjs warrior 40 /tmp/e2e fresh     # real browser play-test with screenshots (fresh | endgame)
```

Dev galleries (with `npm run dev:client`): `/gallery-art.html`, `/gallery-vfx.html`, `/gallery-hud.html`, `/gallery-panels.html`.
Dev URL shortcut: `http://localhost:5173/?autostart=Name&class=mage` skips the class screen. F2 in game opens prototype tools.

## Controls

| Key | Action |
|---|---|
| W A S D | Move (attacks and the 4 equipped skills fire automatically) |
| Space | Dash |
| E | Interact (Cube, Waypoint, Rift Obelisk, portals) |
| I / B | Inventory & paperdoll |
| K | Skills (runes + upgrade tiers) |
| P | Paragon |
| U | Cube |
| Enter | Chat |
| F1 | Help · F2 Prototype tools (level up, legendaries, full set, goblins) |

## Layout

* `shared/` — all game rules and data (items, affixes, skills, stats, progression, Cube, maps, protocol)
* `server/` — authoritative 20 Hz simulation, channels, rifts, persistence
* `client/` — PixiJS renderer, code-drawn art, effects, Preact UI
* `docs/research/` — research dossiers (Idleon, Diablo 3, Task Bar Hero, MMO netcode, engines, UI)
* `docs/ARCHITECTURE.md` — design decisions and build spec
* `docs/ART_DIRECTION.md` — art direction (palette, proportions, rarity language)
