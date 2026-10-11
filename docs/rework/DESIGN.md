# Hearthfall UI + town rework — design (branch `claude/world-ui`)

Owner verdict being fixed: UI "looks very rough", town "outright bad" (dark cobble field in a void, hero-clone NPCs,
polygon islands in dark water, tiny text, nested tabs, empty black panels). Before shots: `docs/rework/shots/before-*.png`.
Patterns are borrowed from the observed reference rows in `docs/research/v2/UI-ATLAS.csv` (ids cited below) — never pixels.
All art, names and text are original and drawn in code; no downloads, no new packages, no third-party assets.

## 1. Design system (tokens in `client/src/ui/styles/tokens.css`)

Keep the approved identity (warm ink, bronze frames, Cinzel / Alegreya Sans / Lilita One) but make it calmer and readable.

| Token | Value | Use |
|---|---|---|
| Surfaces | `--s-0 #0b0907` deep · `--s-1 #15110d` panel · `--s-2 #1e1813` card · `--s-3 #2b2219` hover/selected · `--s-well #0d0a08` | one panel body, inset cards, wells |
| Lines | `--line-1 #33281c` · `--line-2 #5a4429` frame · `--gold #d2ae68` · `--gold-hi #f3dc9d` | 1 px borders, gold hairline only on the frame and selection |
| Text | `--t-1 #f2e8d5` (≈13:1 on s-1) · `--t-2 #cdbd9f` (≈8:1) · `--t-3 #a39276` (≈5:1, ≥13 px only) · `--t-off #6d6253` | primary / secondary / tertiary / disabled |
| Accents | ember `#e0783a` primary action · points `#ffcf5a` · good `#71d18c` · bad `#ef6b5b` · info `#7fb8ff` · arcane `#b38cff` | state colour always paired with an icon or word (R13 / GAG colour rule) |
| Type | caps label 12 · small 13 · **body 15** · card title 17 · panel title 21 · hero number 28 | body ≥14 px, secondary ≥12 px at 1080p (owner rule); caps tracking 0.06–0.1 em, never on body text |
| Space / radius | 4-px scale (4 8 12 16 20 24 32) · radius 3 control / 6 card / 8 panel | one rhythm everywhere |
| Motion | 120 / 180 ms, `cubic-bezier(.2,.8,.2,1)`; panels fade + 6 px rise; `prefers-reduced-motion` → none | |

Components: **one panel chrome** (title bar = icon medallion, title, subtitle, hotkey `kbd`, close; body 16 px padding;
optional footer action row), **card** (inset section with caps header + right meta), **segmented tabs** (top level only,
counts as badges — no nested tab rows), **buttons** primary / default / quiet × sm 28 / md 34 / lg 40 with hover, pressed,
`:focus-visible` 2 px gold ring, disabled (dimmed + not-allowed), **chips/badges/pips**, tooltip anatomy (name in rarity
colour, type line, divider, body, hint footer), rarity cell borders (kept). Panels dock left/right (existing behaviour),
size to content (no fixed tall bodies), and never scroll (owner rule; overflow → pages/columns/collapsible sections).

## 2. Skills screen — one screen, spend a point in two clicks (K, then [+])

```
┌[✦] SKILLS  Warrior · Level 40 · ★ 12 unspent ───────────────────────────── K  ✕┐
│ LOADOUT [AUTO][1][2][3][4]  (click slot → click card, or drag)   Targets ▾   Refund tiers │
├ ACTIVE SKILLS ──────────────────────────────┬ SELECTED: Whirlwind ─────────────────────┤
│ [ic] Cleave      Primary · Physical  ●●○ [+4★]│ big icon · kind · element · slot · desc   │
│ [ic] Whirlwind   Channel · Physical  ●○○ [+2★]│ key numbers (damage, cost, cooldown, …)   │
│ [ic] Rend        …                   ○○○ [+2★]│ TIERS  I ✓ · II [+4★] · III 6★ (inline)    │
│ [ic] Ground Stomp 🔒 Level 6 (dimmed)          │ RUNES  [A card][B card][C card] equip/off │
│ … 6 cards, 2 columns                         │ ▸ Casting & rules (collapsible)           │
├ PASSIVES  [L10 slot][L20][L30][L70] — clicking a slot swaps the right pane to the picker ┤
└────────────────────────────────────────────────────────────────────────────────────────┘
```
Same server ops (`skillSlot`, `skillRune`, `skillTier`, `skillReset`, `passive`, `skillAutoCast`, `skillAutoRule`,
`targetPriority`). Points shown as counter + pulse on the HUD Skills button. Grounding: UI-TBH-03/10 (available vs
invested vs unlock condition kept distinct), UI-D3-11 (next choice vs equipped capacity), UI-POE1-04 / UI-POE2-11
(availability, assignment and modifier association on one surface).

## 3. HUD (1920×1080; verified again at 1366×768)

Top-left player plate (+ party frames under it when grouped) · top-centre target/boss frame, notices beneath ·
top-right zone plate, minimap, **quest tracker card** (title, objective, progress bar, track/untrack icon; UI-D3-05,
UI-TL2-03, UI-POE2-08) · bottom-centre globes + skill bar + XP (kept, polished) · **bottom-right MMO menu bar**: icon
buttons Character, Inventory, Skills, Journal, Map, Social, Party, Settings with hotkey badges and notification pips
(labelled-navigation precedent UI-IDLE-01; replaces the stacked text buttons) · bottom-left chat with channel tabs and
idle fade, pickup feed above it · interact prompt above the skill bar · contextual guidance card right-middle.

## 4. Town — "Hearthmere, the last lit hearth": a lakeside harbour at blue hour (replaces the old layout)

```
 N  ░░░░░░░░░░░░░░ wooded escarpment: rock face + forest, painted behind every house ░░░░░░░░░░░░░░░░░░░░░░░
 woods [Inn: Banked Ember][cottage][Cube rotunda][Stash vault][stall][Mystic tower][Forge][Jeweler][cottage] [ruined overlook]
  ≈≈  terrace, bard, keeper   glass dome    key plaque   oil     leaning, runes  open hearth  awning     columns, steps
 [Grove:  ≈ bridge ═══ LANTERN ROW (cobbles, lamps, string lights) ══ ( SQUARE: Waypoint, oak, well ) ════ [GATE]→ Ashen Hollow
 Paragon  ≈ (canal)   [Mill + waterwheel]  [Boathouse] [fish stall] [Rift Obelisk circle] [cottage] [Training yard ×3]
 shrine]  ≈            QUAY: stone wall, curb, crates, crane, nets ══╦══ pier, boats ═══════ breakwater → [HEARTHLIGHT]
 ← Glade  ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈ lake: swells, glints, foam, mist, gulls, the beacon's sweeping beam ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈
```
(As built in `shared/src/data/town/build.ts`; the square, the services and every exit keep their ids.)
Rules that drive the art: everything north of the walkable edge is painted into the ground layer (always behind the hero),
water is flat ground art with animated overlays, so **no void anywhere**: the camera only ever sees escarpment, forest,
canal or lake. Buildings are rotated where needed so door/sign facades face the camera. Compact core: every service within
~1,200 u (≈5 s at 250 u/s) of the Waypoint. Services keep their ids and server checks (data-driven NPC position + radius
+ line of sight); new townsfolk are visual-only residents. ≥10 distinct NPC looks from the existing hero rig extended with
hair styles, beards, skin tones, builds and role tools; nameplates get role titles/icons. Kit: oak/pine/birch/willow trees,
bushes, hedges, reeds, flowers, stones, crates, barrels, carts, fences, lamps, signposts, wells, boats, nets, banners.
Light: cool ambient tint + warm baked light pools + additive flicker; emissive windows; beacon glow; fireflies, mist, smoke.

## 5. Assets, licences, risks

Assets: original Canvas2D/Pixi drawings and inline SVG icons only; fonts unchanged (already in `docs/licenses`). No new
licence entries expected; any later third-party asset gets an individual licence check and a notices entry first.
Risks: (1) town art volume — build a parametric kit, look at screenshots after each slice; (2) performance — atlas the
repeated sprites, bake ground in chunks, keep culling, measure before/after in a visible page; (3) tests that encode the
old layout (`townDepth`, `townLife`, `townServices` inn wall) are updated deliberately and listed in the report;
(4) merge risk with the lead — only files in my lane change; any shared/server edit is minimal, additive and reported.

## 6. World map, journal, quest objects

**World map (M)**: one painted frontier chart (original Canvas2D art, cached) with live overlays — roads from the real
exit graph, fog over places not yet unlocked, medallion nodes (name + level range, padlock, waypoint badge), quest pin,
marching route to the tracked objective, "You are here" ring, legend; inspecting a node never travels, the detail card
keeps the waypoint/exit rule. Placement is a diagram, labelled as such (atlas UI-POE2-01, UI-TBH-04, UI-D3-09, UI-POE1-06).
**Journal (J)**: chapters by act with progress on the left; the quest sheet (story, objectives with progress, rewards
and unlocks, track toggle, actions) on the right; no inner tabs, no scrolling. **Quest objects**: CAST.md kinds with a
tracked pulse, an interaction bounce and a used look; first-open hints live inside the panel, never as a screen banner.

## 7. Panel patterns added in rounds 2–3 (lead)

Every window that is not a one-screen sheet uses the same shell so a new panel looks like the rest without new CSS:

| Piece | Markup / class | Source |
|---|---|---|
| Shell | `<PanelFrame id title width sub>` → `.pn` (zoomed by `--pz`, never scrolls) | `panels/common.tsx` |
| Rail + body | `.co` grid: `nav.co-nav` of `button.co-tab` (icon, label, `em` count) + `.co-body` | `panels-collection.css` |
| Section bar | `.co-bar` (caps title left, one-line `.co-sub` right) | same |
| Card / card grid | `.so-card` (caps `h4`, `p` note), `.so-cards` two columns | `panels-social.css` |
| List row | `.so-row` (dot, `.so-who`, `.so-act` icon buttons), `.so-empty` empty state with icon + one sentence, `.so-warn` notice | same |
| Segmented control / chips | `.co-seg`, `.st-chip` (counts as `em`) | collection / more |
| Switch / slider | `.pn-settings .settings-check` (switch), `.st-slider` (gold fill) | `panels-services.css` |
| Paging | `<Paged size>`; used only where a list can exceed one screen (key bindings are 2 columns, so no paging) | `panels/common.tsx` |
| Item grid | `.cell` + `ItemVisual`; hover compares (`itemHover(..., {compare:true})`), green arrow = upgrade | `panels/inventory.tsx` |

Rules: icon + word for state (never colour alone); ≥ 12 px secondary text; destructive actions need a second click with the
exact consequence in the text; the server stays the authority (panels call the same `run(op, args)` commands as before).
Windows are capped to the screen height by `useScale` (tallest window = journal, 909 px) so the no-scroll rule holds at
any interface size; if you add a taller window, update `TALLEST_PANEL` in `panels/index.tsx`.

Stylesheets: `panels.css` (frame, items, inventory, skills, journal, map), `panels-more.css` (paragon, stash, cube stage),
`panels-collection.css` (rail/body/cards, collection), `panels-social.css` (rows, party, HUD party frames),
`panels-services.css` (merchant, waypoint, obelisk, guild, inspect, run summary, settings), `account.css` (select-screen
accounts), `gear.css` (gear tiers in icons, tooltip, showcase).
