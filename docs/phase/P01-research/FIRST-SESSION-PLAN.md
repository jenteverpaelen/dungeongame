# Hearthfall first-session baseline audit

2026-10-09. Evidence before this measurement: current class selection, Help, input, Skills, inventory, Waypoint, automatic combat and server command code; UX-CHI12 and the scoped R15 observation protocol. Town/style/camera stay frozen.

Run installed local Chrome at 1920×1080, DPR1, with a new profile and an empty, unique DATA_DIR. Disable debug and inherited backup configuration. Start with the actual class-selection screen; create an ordinary level-one character through its controls. Capture the initial town, Help, first Skills/Inventory views and physical Waypoint interaction. Walk along a path calculated from authored collision/routes using ordinary movement input; identify that assistance explicitly. Enter the first field through the visible Waypoint button and observe automatic combat/loot and available decisions. Inspect every retained screenshot.

Record viewport/visibility, actions, elapsed script time, character state, displayed text, disabled controls, visible errors and screenshot names. Report timings as scripted execution only: the script knows the hotkeys and map graph, includes capture waits, and cannot measure discovery, comprehension, frustration or human retention. No inferred benchmark, reference-game observation, balance target or tutorial effectiveness claim.

The browser connector still fails before a UI state is returned. Use the already working local development capture method with a separate installed-Chrome profile for our own app. Do not attach to personal Chrome profiles. Public reference-game visual evidence remains missing; text search results do not fill it. No extra downloads or assets are required.

Test isolation follow-up: adding optional BACKUP_DIR exposes inherited configuration in older standalone capture/bot children. Explicitly clear it in those launchers, as the full verify runner already does. This affects synthetic test children only, not an operator's server configuration. Do not run the old fixed-path Linux e2e harness as a Windows save test.

Output is evidence plus hypotheses for later design. No tutorial, quest rewards, new unlock gates or changed town flow is implemented by this audit. Keep uncertainty and negative findings; no content is removed.
