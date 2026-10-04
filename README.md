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
