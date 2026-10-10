# Rework log (terse: what changed, why, evidence)

- **R0 — baseline + tooling.** `scripts/shoot.mjs`: reusable headless-Chrome (visible page target, so rAF runs) 1920×1080
  driver for the running dev client (`open`, `cmd/debug`, keys, clicks, camera hold, grid walk-to, overlap/scroll probes).
  Before shots: `shots/before-*` (HUD, skills L1/L40, inventory, journal, world map, character, settings, social, cube,
  town at four services, Rillwake field + edge). Merged the lead's content pack (`claude/town-ui-rework`: dialogues,
  barks, `CAST.md`) by fast-forward. Design: `DESIGN.md`.
