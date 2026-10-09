# R-13 — UI/UX and accessibility

Read 2026-10-09. Published guidance read; no disabled-player test claimed.

[GAG-BASIC](https://gameaccessibilityguidelines.com/basic/) recommends remappable inputs, readable text, independent audio controls, persistent settings and alternatives to color-only or sound-only information. It also supports player-paced text and clear language. These are design checks, not proof of our compliance.

**Owner constraint:** keep Hearthfall's approved visual style and original camera. Accessibility work can use the existing panel components, typography and colors; it must not silently reintroduce dynamic zoom. Color redundancy means adding shape/text meaning where necessary, not replacing the theme.

## Audit plan grounded in actual tasks

Check login, combat, inventory comparison, skill selection, service rejection and return from AFK at 1920×1080, then smaller viewports. Record actual target sizes, keyboard reachability, focus, overflow and contrast. Separate computed CSS dimensions from human readability. Measure flashing and dense combat before making photosensitivity claims.

## Unfinished charter items

No complete UI atlas, remapping design, screen-reader audit, controller navigation or text scaling verification yet. Local screenshots from the camera rollback establish the existing visual baseline, not accessibility. Settings persistence and independent effects/ambience volume are candidates only after inspecting the current audio/input implementation. No UI art overhaul is authorized.
