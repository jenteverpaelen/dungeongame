# C107 — Owner playtest feedback, 10 October 2026

Scope: readable fresh-character guide, wider manual world camera, compact starter HUD, explicit quest tracking/floor directions/E prompts, then shorter attack reach. No P12 chapter work. Evidence L133–L136; decisions D071–D074. Later owner feedback replaces the first floating arrow with dots and overrides the historical fixed-camera direction.

## What changed

- Default camera scale75%, wheel/trackpad pinch over world, range66.67–200%, local persistence and Settings reset. Only the Pixi world scales; HUD DOM stays fixed. Consume Ctrl-wheel/pinch over UI without resizing it. No automatic spell framing.
- Starter globes136px instead of200 at1080p; XP strip336px. Existing fonts/art/style and full skill bar after active skills unlock.
- Accept auto-tracks; journal Track/Untrack and HUD Untrack. Empty saved selection persists and removes world/map navigation markers. Ordinary offer/reward icons remain. E prompts now include quest characters/objects and are clickable through the normal physical interaction handler.
- Gold floor dots follow authored objectives/connecting exits, with a24-unit grid and exact swept player-circle collision on authored geometry. Cached local search yields every16 expansions and gets a2ms scheduling slice; no server/network routing. No through-wall fallback if a route cannot be found. Grid is a presentation aid, not new movement authority.
- Ranged acquisition >350 reduced20%, capped380; Ranger520→380, Mage480→380, Meteor560→380, Seismic420→336. Remove40-unit ranged auto-attack buffer; melee buffer retained. Synchronize hardcoded summon/secondary targeting and limit friendly non-lob projectile lifetime to skill reach+32units. Preserve coefficients/costs/cooldowns/melee and area sizes. Large areas or close zoom can still extend off-screen.

## Measured checks

- Nine distinct focused checks: preferences4, quest tracking/progress/reload1, collision routes/no-route2, Mage/Ranger combat2. Typecheck/build pass; final bundle1325.66kB,429.17kB gzip, inherited chunk/config warnings. First tracking invocation was blocked before execution by sandbox Node userInfo; rerun locally passed.
- Real Chrome on this PC at1920×1080: starter HUD XP336px; wheel75→82.89%; slider endpoints66.67/200 and reset75; reset and explicit untrack survived reload. Click E opened Orren, acceptance replaced an explicit untrack with the newly active quest, HUD untrack removed the guide. Final floor trail visibly bends around camp obstacles. No captured console errors. Screenshots personally inspected: [floor trail](C107-floor-trail.png), [settings](C107-settings.png), [untracked](C107-untracked.png). Settings fits without scrolling. Earlier arrow drafts moved to ignored local evidence after owner rejected that presentation.
- Three authored routes (town Mystic; Rillwake cart and ledger) found and every segment passed continuous circle collision. Combined test118.83ms including construction/search; this is not a frame-time or100-player benchmark. Sealed test geometry returned no trail. Combat checks confirm distant500-unit targets don't trigger primary attacks, near targets still do, projectile lifetime is bounded and Meteor rejects far/accepts near targets.
- Isolated fresh DATA_DIR for each automated check and assistant preview; preview character only, infinite HP enabled for the field interaction visit. No actual saves touched. Assistant preview stopped/tab closed; temporary viewport restored. Physical trackpad gesture remains an owner check: tooling can wheel/keyboard, not generate a native pinch. MDN and the explicit ctrlKey early-return explain the reported failure; the handler now consumes it.

## Removed / effects / remaining

Removed oversized starter layout, forced tracking fallback after explicit Untrack, unconditional dungeon navigation pin, initial floating arrow, and excess ranged reach. No game content, item, character, saved quest or town art deleted. Saves14/protocol20 unchanged. Shorter reach increases the need to approach; the previous P11 build model is historical, not a re-certification under new reach. Owner tests feel and broad gameplay; full roadmap/endgame remains pending.

Owner playtest stays at http://localhost:2577/ using its existing isolated folder and updated server. Initial direct process restart exited without a graceful-save acknowledgement, so only previously persisted progress is confirmed; data files were not reset/deleted. Replacement uses ignored IPC supervisor for future graceful stops. Do not use that owner folder for assistant fixtures. Launcher/checkpoint contain operational details.

Rollback: revert individual presentation/reach changes while preserving tracked empty string, character/item/quest history and unrelated preferences. No new dependencies, downloads or paid tools.
