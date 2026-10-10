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
