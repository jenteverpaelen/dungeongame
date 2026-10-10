# Gear visual progression — decisions (what / why / evidence / rollback)

**D1 — Derive, never store.** The visual tier, temper and rank are pure functions of fields every save already has
(rarity, ilvl, ancient, set, legendary power, upgrade, sockets, enchanted). Looks gain an optional `fx` number only on
the wire (`playerLook`, loot views); stored `item.look` and collection looks never carry it (test: "player looks carry
progression without touching stored items"). No save version bump, no migration. Rollback: drop `fx`/`jw`, the client
falls back to the legacy glow path for looks without `fx`.

**D2 — Packed ints over strings.** One 28-bit int per slot (tier 4b, ancient 2b, upgrade 4b, set 4b, legendary 5b,
filled sockets 2b, best gem 3b + rank 3b, enchanted 1b) and `jw` (numbers only) for amulet / rings / bracers. Measured
descriptor growth: +29 B (starter), +99 B (L70), +121 B (Primal) per player; descriptors are sent on enter / look
change only (never per tick). Id orders are append-only and pinned by a test. `PROTOCOL_VERSION` 21 → 22 (old clients
are told to refresh, as before).

**D3 — Progression from the worn item, shape from the wardrobe.** A wardrobe (transmog) look keeps changing shape and
colours, but tier / Set / Ancient effects come from the item actually worn — the progression stays honest and visible
(WoW / D3 transmog keep power separate from appearance; here the owner asked that power be visible). Owner may prefer
"transmog hides tier"; flipping it is one line in `playerLook`.

**D4 — Rank formula and its 0.35 bias are tuned, not sacred.** The slot weights (weapon 2 … rings 0.5) follow on-screen
size; the bias, Set (+0.6 / +0.3) and Primal (+0.3 each, ≤0.6) bonuses and the caps (≤7 without Ancient, ≤8 without
Primal) were tuned so the showcase ladder reads 0,0,2,3,4,5,5,6,7,8,9 for every class (test). Empty slots count as 0
on purpose: an "overloaded" veteran fills every slot. Inferred loadouts (gearShowcase.ts) are labelled as inferred.

**D5 — Effects start at rank 5–6.** Below that the change is in the item silhouettes only; aura, sigil, wings, halo,
particles are reserved for Legendary-era progress so they stay rare and meaningful (REFERENCES P7).

**D6 — Wings always spread.** A 3D-correct wing would vanish in profile; top-down ARPG wings read as spread to both sides
regardless of facing, so the rig fakes it (yaw-driven asymmetry, behind the body when facing the camera, in front when
facing away). Wings are a live effect (hidden in "off"), capes/mantles are cloth (always shown).

**D7 — Bigger weapons, same reach.** Weapon art grows 2.4 % per tier; collision, hitboxes and server reach are
untouched; only the trail ribbon follows the drawn blade.

**D8 — Settings default to full for both own and others.** Owner asked to "go crazy"; the crowd budget keeps totals
bounded and players can choose reduced / off; `prefers-reduced-motion` caps at reduced.

**D9 — Icons carry the tier.** The tier frame is painted into the icon canvas (not CSS) so every surface that shows an
icon (bag, paperdoll, tooltip, merchant, inspect, ground loot) shows the same frame without layout changes.

**D10 — Character showcase uses the existing preview canvas system.** The class-select preview observer now stays on
in game (it already destroys previews whose canvas leaves the DOM); a canvas with `data-look` animates any hero look.

**D11 — Bigger is the point (spectacle pass).** Lead review measured too little presence at distance; wing spans of
2.2–3.7× body width, an 82 u sigil and a 140 u light column were set against that brief, then measured (LOG G6).
Rollback: the scale constants `wingK` / `backK` (player.ts `backOf`) and `sigilSize` (gearFx.ts).

**D12 — Ground effects beneath telegraphs, dimmed in combat.** A scene underlay below the telegraph layer holds every
ground effect; while the hero is fighting they drop 45 %. Galleries / previews keep them inside the view.

**D13 — Budgeted GPU bakes for in-game heroes.** 'scene' views bake on the GPU (no readback) within 4 ms per frame and
show their previous sheet or a class placeholder meanwhile; previews keep canvas sheets (they render elsewhere).
Trade-off: a crowd of never-seen looks now pops in over seconds instead of stalling for seconds. Rollback: construct
scene views in 'portable' mode (scene.ts `createView`).

**D14 — Rank-up celebrates the first time per session.** Highest rank and completed Sets are remembered per character
for the session, so swapping gear back and forth does not replay the moment.

**D15 — Debug `showcase` op.** ENABLE_DEBUG only: puts a gear-ladder stage's items in the bag so evidence characters can
wear Ancient / Primal / upgraded gear without farming. Not a game rule; disabled on normal servers like every debug op.

**Owner-decision candidates (safe defaults chosen):** tier names (Threadbare … Primal) and the "Next:" hints are
original placeholders the owner may rename; whether transmog should hide tier (D3); whether other players' effects
should default to reduced in crowded towns (D8); how big Primal wings may get (D11: ~230 px wide at the default
camera); whether the rank-up notice should also be announced to the party.
