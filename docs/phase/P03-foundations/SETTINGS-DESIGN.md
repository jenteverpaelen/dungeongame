# Settings slice — evidence before implementation

2026-10-09. Scope is a bounded part of P3 settings/accessibility, not full completion.

**Local problem [M]:** `audio/sfx.ts` has master volume 0.8 and mute=false, but no player controls or persistence. Town positioned loops share the effects bus. `render/scene.ts` always allows camera shake and animation hit-stop. The current panel/Help infrastructure can host controls without a visual restyle. O is unused in the existing hotkey map. Keyboard input currently treats Space on a button as Dash; adding keyboard-operable settings must avoid that conflict.

**Evidence [S/O]:** GAG-BASIC recommends remembered settings, audio category controls and accessible input. Owner preserves UI style and restored camera. Local defaults and panel components are the visual/behavioral source, not new invented balance values. R13/R19 record scope and limitations. This does not claim complete reduced-motion or photosensitivity support.

**Design [P→implementation]:** use existing PanelFrame, gold/text tokens and buttons. Open with O or a button in F1 Controls; Escape keeps closing windows. Add master volume/mute, effects volume, ambience volume and camera-shake toggle. Omit music/speech controls because no such categories exist. Audio category gains default to 1 and master stays 0.8. Shake stays enabled by default. Camera view height/follow/lead stay untouched. Do not disable combat animation hit-stop in this slice; keep the scope to the clearly labeled camera shake setting.

**Persistence:** versioned browser-local preferences, no character/save/account mutation. Validate numbers/booleans, clamp volume, recover from malformed storage, keep session changes usable when storage is denied. Tell the player if settings cannot be retained. No telemetry or new dependency.

**Acceptance:** defaults preserve current mix/zoom; each category is independent including priority sounds; mute stays zero when a slider changes; preferences survive reload; reset restores existing defaults; keyboard activation changes controls without dashing/moving; Escape closes; malformed/blocked storage does not prevent boot; inspect 1920×1080 screenshots. Test audio graph gains in the real local browser, not only stored values. No claims from visual evidence about how the mix sounds.

**Effect/rollback:** players can reduce sound or shake without affecting shared combat. New settings only; nothing removed. Revert panel/store/bus/input integration as one slice; its browser storage key can remain inert. Town art/layout and service rules remain frozen.
