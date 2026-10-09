# R-13 — UI/UX and accessibility

Read 2026-10-09. Published guidance read; no disabled-player test claimed.

[GAG-BASIC](https://gameaccessibilityguidelines.com/basic/) recommends remappable inputs, readable text, independent audio controls, persistent settings and alternatives to color-only or sound-only information. It also supports player-paced text and clear language. These are design checks, not proof of our compliance.

**Owner constraint:** keep Hearthfall's approved visual style and original camera. Accessibility work can use the existing panel components, typography and colors; it must not silently reintroduce dynamic zoom. Color redundancy means adding shape/text meaning where necessary, not replacing the theme.

## Audit plan grounded in actual tasks

Check login, combat, inventory comparison, skill selection, service rejection and return from AFK at 1920×1080, then smaller viewports. Record actual target sizes, keyboard reachability, focus, overflow and contrast. Separate computed CSS dimensions from human readability. Measure flashing and dense combat before making photosensitivity claims.

## Unfinished charter items

No complete UI atlas, screen-reader audit, controller navigation or text scaling verification yet. Local screenshots establish specific flows, not accessibility certification. Persistent independent sound controls and camera-shake settings have since been implemented and checked locally (C009 and foundation records); keyboard remapping is checked in C024. No UI art overhaul is authorized.

## Reduced-flash slice, 2026-10-09

GAG-FLASH and XAG118 (UX-04) support effect-specific controls and representative testing. L41 records the observed celebration burst and actual rendering paths before design. C030 adds an optional control using existing Settings styles; seven inspected Chrome1080p captures and controlled rendering checks preserve warning/projectile information. REDUCED-FLASH-REPORT.md separates measured behavior from untested thresholds, dense combat, other effects and human accessibility. Default visuals and camera stay unchanged.

## Keyboard slice, 2026-10-09

GAG-REMAP supports custom assignments and updated prompts. MDN-KEYCODE/MDN-LAYOUT distinguish physical key identity from its printed character and document optional, fallible layout lookup. `P03-foundations/KEYBOARD-DESIGN.md` specifies two bindings per action, conflict rejection, recovery keys, form handling and browser-local persistence. The owner's Chrome reports AZERTY labels (Z/Q on the original up/left positions), demonstrating why default code names alone would be misleading. This is a measured API output, not a hardware/assistive-device usability test. Exact checks and known limits belong in KEYBOARD-REPORT.md.

## Ground-loot text, C049

[GAG-COLOUR](https://gameaccessibilityguidelines.com/ensure-no-essential-information-is-conveyed-by-a-fixed-colour-alone/) supports additional text/shape cues, including through settings. [XAG103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103) separately addresses multiple sensory channels and non-colour visual cues; simulation cannot substitute for actual player evaluation. Read background/implementation text through audio alternatives; linked examples/videos were not visually inspected.

The actual ground labels lacked written quality while tooltips already identify non-normal rarity and Ancient state. C049 adds an optional written ground label using existing styles, with exact default comparison and seven inspected Chrome frames; [report](../../phase/P03-foundations/LOOT-LABEL-REPORT.md). This inference does not complete bag/stash glanceability, contrast, screen narration or human testing. Default colours/text remain available; no whole-scene palette filter introduced.
