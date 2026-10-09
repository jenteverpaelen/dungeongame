# World map — C072

Source before design: L86, existing five-game atlas and Claude P5/F-WLD-03/U-70. Implement a regional connection view plus current-area terrain, physical services/exits and a tracked objective. Regional placement is original diagram composition, explicitly not geographical distance. Terrain comes from the same authored map/minimap bake.

Show available/current/quest-locked routes in words as well as colour. The selected objective and its next connecting exit agree with the journal/minimap. Remote map reading never travels, accepts quests or runs services. At a real waypoint/exit, a travel button invokes the existing server command; no authority, economy, save, town or camera change.

M defaults to map; old custom M takes priority and the new action receives an unused key. Add a mouse entry and Help/Settings binding labels. No download or new dependency. Verification is scoped route/key migration checks, typecheck/build and one inspected1080p browser view. Full playtesting remains with the owner; fog/discovery state, dungeon layers and full atlas/endgame systems remain open.

Rollback removes the map panel/entry points while preserving existing waypoint/journal operations and stored custom bindings. No content is deleted.
