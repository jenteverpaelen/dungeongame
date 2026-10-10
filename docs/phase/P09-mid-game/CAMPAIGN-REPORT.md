# C097 — Complete authored Acts II–III route, 20–50

L117/D055 and CAMPAIGN-PLAN preceded implementation. Six original authored destinations, thirteen connected story quests and six recovered records now continue from The Last Draw. Four shared fields lead through two private objective dungeons. Each area has explicit floor polygons, solid scenery, NPC contacts, physical exits, encounter sites, ambient motion and positional sound data. Shared geometry drives server/client collision. No random layout or downloaded art is involved.

Saltwind uses salt-crust material and low evaporation trays. Shiverline/Beaconbreak/Hollowstar use slate and braced signal pedestals; their actual footprints are solid and their front edges determine depth order. The environment references justify production/communication relationships, not a copied historical layout. The current geometric art is modest in detail; this is not owner acceptance of the final art quality or mood.

Six authored-only enemy variants inherit existing attack/body budgets. Their combinations use cold lobs, cold fans, lightning fractures and different two-affix encounters. The Borrowed Heart changes from rings to fractures at the existing30%-life threshold; the Hollow Conductor reverses that pattern. Neither summons rewarding adds. These are new variants and phase combinations, not six new body families or a completed monster catalogue.

Dungeon completion targets are authored; old Pumpworks behavior remains the default. New story chambers cannot be consumed before their quest is accepted/current; the server names the required contact. Already completed quests permit replay. Contacts are reachable between chambers. Existing unfinished-instance retry/expiry behavior remains: this does not add persistent dungeon-instance recovery across a server restart.

World-map Acts tabs expose the larger route without enlarging the panel or adding scrolling. Existing paged waypoint destinations include the new shared fields. New private dungeons still require their physical entrance. The existing Act I completion unlocks Sablefen for old characters without reopening a claimed reward. Saves stay12/protocol15; no save shape changed.

## Measured checks

- Four new focused cases pass: all authored references/reachability and legal spawns; each class's one-time reward progression and persistence; all13 quests through actual server commands, deaths, mechanisms, contacts and claims; both boss phase transitions. No client-supplied objective completion.
- Twelve existing Act I/dungeon cases pass. The old level1–20 test is explicitly scoped to its two original chapters, preserving its exact level/reward assertions.
- Story awards alone supply40,856,515XP, exactly20→50 with zero kills for each class; all awards remain below the existing single-reward cap. Combat XP is additional. This is a budget proof, not a human duration or balanced TTK result.
- The command fixture completes both private dungeons, rejects premature next-quest activation and duplicate reward claims, and reloads the completed final quest. Its movement is positioned at legal physical approaches; exhaustive authored reachability separately sweeps the real player radius. It is not a human full-act walkthrough.
- Collision checks caught sharp passage turns, a hatch on its wall and a scenery/spawn overlap; all were corrected. Current six new plans contain22 encounter sites/84 authored members before respawns.
- Typecheck and production build pass. Main bundle1,271.21kB /413.37kB gzip; existing chunk-size/config warnings remain. All runtime checks used fresh isolated DATA_DIR with backups disabled. No real saves were read.
- Chrome on the owner's PC:1920×1080 viewport explicitly measured. Inspected and operated Act II/III map tabs, quest locks and the salt/slate scenery at the fixed gameplay scale. ACT-TWO-MAP.jpg shows the final map; SALTWIND-PREVIEW.jpg and HOLLOWSTAR-PREVIEW.jpg are labelled development-art scenes with posed actors, not live encounter playtests. Fixed the gallery to pass the same interaction-kind metadata as the game so mechanisms do not misleadingly render as books. Gallery FPS is not a foreground multiplayer benchmark.

## Remaining P9 work

First mid-game set tranche and actual acquisition; supported vendor bands; Cube pacing; difficulty policy; per-five-level combat/XP/stall reports; additional family breadth where the chapter requires it. Party2–4 proof depends on P10 party identity. Owner handles broad human playtesting later; G7, subjective pace/feel and independent review are not certified. C097 completes the connected content route, not all of P9 or the roadmap.

## Removal and future effect

No town, old zone, quest, item, character, skill, camera behavior or saved reward was removed. The hardcoded dungeon completion label/target was generalized while retaining the old default. Failed draft scenery placements were corrected before release. Future acts can use the same finite dungeon metadata and original prefab geometry. Rollback hides new offers/entry links while retaining quest IDs, saved rewards and forward-compatible content for recovery.
