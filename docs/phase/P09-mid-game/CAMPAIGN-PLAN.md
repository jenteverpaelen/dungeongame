# C097 — Acts II–III, levels 20–50

Design recorded before implementation, 2026-10-10. L117/D055. This extends the complete Act I route; it does not replace the town, old fields, quests, camera or UI materials.

## Evidence and interpretation

Claude P9 calls for five-level bands, objective dungeons, encounter variety and Acts II–III. Existing five-game world/objective/narrative synthesis supports connected destinations, legible objectives and a purpose for revisiting hubs. It does not establish transferable map dimensions or player clear times. Owner requests story progression without mandatory repeats.

UNESCO's saltworks account links underground pumping, brine transport and fire evaporation. English Heritage records cisterns, channels, granaries, gates and an escarpment at Housesteads. NPS describes ridge signal stations, encoded messages, flags and night torches. These support relationships between production, supply and communication; none of their plans, text or assets is copied. Original story: the unsigned furnace orders lead to diverted salt shipments and falsified relay messages. Workers recover control of the network rather than simply finding another unexplained villain.

## Authored destinations

| Band | Destination | Route and objective identity |
|---|---|---|
|20–25|Sablefen Causeway|Split flooded causeway with a returning upper bank; trace cargo and defeat the toll collectors.|
|25–30|Saltwind Pans|Two production lanes around inaccessible brine basins; follow inlet, firing and dispatch functions.|
|30–35|Lockglass Cistern|Private ordered intake/filter/heart chambers; operate mechanisms and recover the water-order archive.|
|35–40|Shiverline Escarpment|Long switchbacks with a connecting ledge; read ridge signals and reopen the relay.|
|40–45|Beaconbreak Ward|Cross-streets around solid stores and a cistern; clear the gates and trace the false command.|
|45–50|Hollowstar Array|Private three-stage signal station; isolate competing transmissions and defeat the source.|

Coordinates are original authored adaptations of the existing 640-unit combat chamber, 230-unit passage and 620-unit camera height, not historical measurements. Distinct connectivity is authored explicitly. Collision, scenery, paths, interactions and route validation share those data. Original code-drawn salt/slate surfaces reuse the existing material palette; no downloads. Existing monster budgets support authored-only elemental/attack combinations; no procedural roster changes. Dungeon end targets become authored instead of hardcoded to Pumpworks. New bosses reuse the existing 30%-life transition and ring/fracture warning budgets, with distinct phase patterns, not extra arbitrary damage multipliers.

## No-repeat story budget

Fixed awards sum the unchanged `xpToNext` curve. Two quests split each of the first five bands at +3/+2 levels. The final band splits +2/+2/+1 because +3 from45 would exceed the existing maximum single quest award. Kill XP is additional; this guarantees a floor on progression, not a human duration or balanced TTK.

|Band|Total story XP|Quest level boundaries|
|---|---:|---|
|20–25|1,904,399|20→23→25|
|25–30|3,218,604|25→28→30|
|30–35|4,983,166|30→33→35|
|35–40|7,246,567|35→38→40|
|40–45|10,054,307|40→43→45|
|45–50|13,449,472|45→47→49→50|

Thirteen quests, original dialogue and recovered records. Each stage is accepted before its required encounter; dungeon contacts are physically reachable between stages. Forward unlocks require the preceding quest; completed `last_draw` grants the next route without invalidating an old save or paying its reward again. Current reserved magic-weapon rewards provide periodic equipment support; first set acquisition is a separate P9 task requiring its own evidence and power measurement.

## Completion boundaries

Implement the whole route, then focused structural/reachability, reward and actual objective-runtime checks plus a brief 1920×1080 inspection. Record findings honestly. P9 set tranche, Cube pacing, difficulty policy, band combat reports and party-dependent acceptance remain next; this content checkpoint alone is not P9 completion. No content is deleted. Rollback can remove new entry links and hide new offers while retaining all new quest IDs and saved rewards for recovery.
