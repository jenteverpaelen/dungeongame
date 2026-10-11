# Settings: graphics, audio, accessibility, gamepad (F-SET-01 / F-SET-02 / F-SET-03, F-PLT-01 low-spec)

Labels: **[M]** measured here, **[S]** read from the cited source, **[K]** prior knowledge, not re-checked this session,
**[P]** proposal. Code: `client/src/game/{preferences,quality,gamepad,bindings}.ts`, `client/src/ui/panels/settings.tsx`
(all text from `client/src/i18n/settingsMessages.ts`), `client/src/ui/panels/rarityMark.tsx`, `client/src/audio/sfx.ts`.

## Grounding

| Setting | Reference |
|---|---|
| Separate volumes, mute in background | GAG basic: "Provide separate volume controls or mutes for effects, speech and background / music" [S, via R13]; World of Warcraft's sound options have a "sound in background" switch [K] |
| Graphics preset, Low FX / effect density, ambient ("clutter") density, foreground + background frame caps | Diablo III video options: Low FX, Clutter Density, Max Foreground FPS, Max Background FPS [K] |
| Remappable controls incl. controller | GAG "Allow controls to be remapped / reconfigured" [S, R13]; W3C Gamepad API "standard" mapping, button 0–16 / axes 0–3 [K: https://w3c.github.io/gamepad/#remapping] |
| Rarity not by colour alone; colour-vision palettes | GAG "Ensure no essential information is conveyed by a fixed colour alone" [S, R13]; Diablo IV offers colour-blind filters for protanopia / deuteranopia / tritanopia [K]; simulation Machado, Oliveira & Fernandes 2009 (severity 1.0), the same model as the lead's TOOLTIP.md §4 |
| Reduce motion, background movement | GAG "Provide an option to turn off / hide background movement" [S, cited in C052]; XAG 117/118 motion and photosensitivity [K]; the CSS media query `prefers-reduced-motion` [K] |
| Damage-number options | Diablo IV 1.5.0 UI notes document configurable floating text [S, cited in C052 COMBAT-NUMBERS-DESIGN.md] |
| Text size | the existing interface-size slider (85–150 %) scales text with windows (lead, 2026-10-11) |

## What each setting does

* **Sound:** master, effects, *alerts* (level, Paragon, legendary/set, gear rank, primal and rift fanfares now on their
  own bus, never ducked; the boss roar stays with effects), ambience; mute all; *mute when the game is in the background*.
* **Graphics:** preset Low / Medium / High / Custom (any edited value shows "Custom"). Render resolution Auto (screen
  density, capped at 2 — today's behaviour) / 0.5× … 2×, applied live with `renderer.resize`. Spell and hit effects
  Full / Reduced / Minimal multiplies the particle budget (×1 / ×0.5 / ×0.2; the engine's own crowd budget still
  applies). Ambient life thins decorative town motion (every 2nd / 5th part), critters (stable random share) and, on
  Minimal, every other walking townsperson; monsters, loot and attack warnings are never removed. Edge smoothing
  (antialiasing) is fixed when the renderer is created → applies on reload (button shown). Frame-rate limit None / 30 /
  60 / 120 / 144 and an unfocused limit Same / 5 / 15 / 30 (`app.ticker.maxFPS`). **Low-spec suggestion:** after 20
  consecutive in-game seconds below 40 fps in a visible page (and no player cap below 40), a notice points to Low once per
  session; switchable.
* **Accessibility:** Reduce motion Follow system / Reduce / Full motion — reduce turns off camera shake, background
  movement (town fog/smoke/motes/fireflies/leaves/birds, zone mist/reeds/ripples, critters), celebration bursts and
  flicker, all CSS animation/transitions, gear effects capped at Reduced, and floating numbers appear and fade in place.
  Camera shake switch + strength 0–100 %. Reduce flashes (existing). Rarity colours Default / Protan / Deutan / Tritan
  (CSS tokens `--r-*`, the shared `RARITY_COLORS` for world labels, chat and feed, and the legendary/set loot beams and
  magic/rare ground glows). Rarity shapes on every item slot (◆ magic, ▲ rare, ★ legendary, ⬢ set; top centre, the
  corners are taken). Written loot quality (existing). Damage numbers: show, size Small/Normal/Large, other players',
  damage taken, healing, critical hits only.
* **Gamepad:** standard-mapping pads; left stick (radial dead zone 0.2, rescaled) or d-pad moves; 13 remappable actions
  (defaults A interact, B dash, X/Y/LB/RB skills 1–4, LT inventory, RT skills, Back map, Start settings, L3 journal);
  d-pad and Home reserved; conflicts refused; saved per browser. In windows (and on the select screen) the d-pad / stick
  moves focus spatially with key-repeat, A presses, B closes. HUD, Help and hint prompts show the last device's buttons
  (`bindings.label` is device-aware), switching back on any real key press or mouse movement.

## Colour-vision palettes [M]

`node scripts/rarity-palette.mjs` — seeded multi-start search inside each rarity's hue family, every colour ≥ 5:1 on the
tooltip ink `#0f0c09`, full-colour worst pair ≥ 15 (OKLab ΔE×100). Worst rarity pair (all 10 pairs incl. Normal):

| Palette | normal · magic · rare · legendary · set | protan | deutan | tritan | normal vision |
|---|---|---:|---:|---:|---:|
| Default (lead) | #e6dfd0 #7a9cff #f2d43c #ef6c2a #34c79a | 11.9 | 12.2 | 6.7 | 14.6 |
| Protan | #e2f4fe #9760fe #f4d506 #e54f11 #5fb0b5 | **22.3** | 17.8 | 13.2 | 21.4 |
| Deutan | #f8eefb #8b66f7 #f7c413 #e25007 #39c7d1 | 15.4 | **20.9** | 15.3 | 21.8 |
| Tritan | #fcece3 #6579f2 #c6a83c #f1401b #25e676 | 13.9 | 7.7 | **21.4** | 19.3 |

Cross-check with the dataviz palette validator (chromatic slots, all pairs): protan preset CVD worst 17.8, deutan 19.7,
tritan preset tritan 21.4 — all above the 8 target. The shapes are the second channel either way.

## Preset cost [M]

Dev build (Vite, unbundled), visible headless Chrome 1920×1080, DPR 1, this laptop; one fresh server per run; hero walks
Cairnspill Terraces 8 s with three summoned elite packs (`.local/perf-loop.sh`, BENCH from `scripts/worlds-perf.mjs`).

| Preset | Render res. | fps (run 1 / 2) | frame p95 ms | main-thread work p95 ms | work frames > 16.7 ms |
|---|---:|---|---|---|---|
| High | 1 | 42 / 72 | 51.3 / 30.4 | 23.7 / 15.7 | 138 / 16 |
| Medium | 1 | 70 / 62 | 30.4 / 36.4 | 15.6 / 17.5 | 16 / 47 |
| Low | 0.75 | **105 / 110** | **18.3 / 18.3** | **13.0 / 12.6** | **1 / 3** |

Low is consistently faster (≈1.5–2.5× High's frame rate, p95 18 ms). High vs Medium differ less than run-to-run noise at
DPR 1 (where both render at resolution 1), so Medium is a middle step, not a measured gain here; on a high-density
screen Medium also drops supersampling. Production builds and other GPUs will differ.

## Verified in the browser [M]

`shots/set-{sound,display,graphics,access,controls,gamepad}-{1920,1366}.jpg` (no scroll regions at either size; the
tallest section, Accessibility, is 738 px at 1080p), `shots/shapes-{default,protan,deutan,tritan,off}-1920.jpg`
(interface size 150 % for legibility), `shots/pad-{prompt,focus,settings}-1920.jpg` with a simulated standard pad
(`navigator.getGamepads` stubbed): stick moved the hero 199 units in 0.9 s, A opened the waypoint, the d-pad moved focus to
"Travel…", B closed it, prompts showed A / B / LT / RT / L3 / Back / Start, Journal remapped to R3.

## Not covered

Real controller hardware (only simulated here), screen-reader support, evaluation with disabled players, a full
colour-filter of the world art (by design the presets change semantic colours only).
