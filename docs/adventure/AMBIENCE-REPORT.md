# Adventure ambience — C077

Implemented solo on the owner's PC, 2026-10-09. L91/D032 and [the plan](AMBIENCE-PLAN.md) preceded code. Partial progress on Claude P7/F-WLD-05; this does not finish the zones or their art.

## Scope and research

Rillwake has river ripples, bank reeds, light mist and positional camp fire/water/wind. Bracken has exposed water, reeds, basin mist and local water/wind sources. Pumpworks has channel ripples, two drip sites and localized water without outdoor wind. The existing campfire already had flames/smoke and lanterns had glow; those were retained without duplicate emitters. The silent mill wheel remains still to preserve the quest's premise.

D4-06 supports location-specific motion with controlled visual detail. POE-15 supports considering context and overlapping audio; it supplies no Hearthfall mixer or budget. Both are historical developer descriptions. Shapes are original code art; sound buffers, volume controls, attenuation and panning are the existing procedural implementation. No asset, package or download was added.

Optional shared authored data defines 16 visual sites and 16 sound sites across three areas. The renderer preallocates 58 visual parts (22/19/17 by zone), culls off-screen sites and changes transforms/alpha without rebuilding graphics. Motion sits beneath combat warnings. The existing town water/wind/fire gains, sound radii, ripple count and motion cadence provide explicit starting values, not validated human mix targets. The conservative water validator checks enclosing-circle clearance against shared floor boundaries, so effects cannot drift over paths just because their center is on water.

No geometry, collision, encounter, reward, save, town appearance, camera or UI style changed. A Vite-only button exposes audio diagnostics for inspection. Sounds belong to the active zone, clear on travel/disconnect and cannot restart from a late update after disposal.

## Measured checks

Typecheck, content validation and build pass. Five focused tests pass: existing field layout/routes/collision plus authored-water placement/invalid-number checks and ambient disposal. All use a fresh isolated DATA_DIR on this PC. No full campaign or broad suite rerun. Existing build chunk-size warning remains.

Actual Chrome, isolated AmbienceC077 mage, infinite HP enabled after travel: [camp A](tour/c077-camp-a.jpg) and [camp B](tour/c077-camp-b.jpg), both1920×1080, were inspected. Ripple extent and reed lean differ between frames. The diagnostic panel covers part of the upper-left water; the rest of the camp retains its previous sparse, simple art. No final look acceptance is claimed. Bracken and indoor drip visuals were checked as authored geometry, not personally toured in this pass.

Visible audio diagnostics showed a running AudioContext, ambience bus1 and three active field loops at camp: fire gain0.05565/pan+0.18182, water gain0.03701/pan−0.36364, wind gain0.05177/pan+0.27271. Returning through the physical portal removed every rillwake_crossing loop; only town wind and brazier remained. Browser warnings/errors captured in this visit were empty. This proves scoped graph routing/lifecycle, **not audible quality, hardware output, subjective volume or performance**. No timing benchmark is claimed from spot FPS. Mute/volume routing reuses the already-tested ambience bus; this visit did not repeat every Settings case.

## Future work and rollback

Audible mix review, fuller environment art, all-zone visual walkthroughs, additional ambient wildlife, long-running performance and human combat readability remain open. No content or system was removed. Remove the optional ambience data and render/audio adapters together to undo this addition; no player migration or quest changes are needed. The new validators can remain for later authored zones. The whole roadmap continues.
