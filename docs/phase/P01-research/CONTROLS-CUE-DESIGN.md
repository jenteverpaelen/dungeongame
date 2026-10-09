# Correct automatic-combat cues within the existing UI

2026-10-09, before implementation. Evidence: L31/L32, [local first-session report](FIRST-SESSION-REPORT.md), current input/Session/SkillBar/Skills code and R15's scoped interpretation of UX-CHI12. This is a demonstrated instruction mismatch; improved comprehension remains a hypothesis.

## Decision and scope

Replace the primary HUD mouse glyph and Skills `LMB` label with `AUTO`, using their existing label elements and CSS. Keep Dash's SPACE binding and skill-slot numbers. Add a tooltip explanation that numbers indicate automatic skill priority, not cast keys; all existing skill descriptions and costs remain. Do not delete the reusable mouse glyph component merely because this call site no longer needs it.

Send two short private system-chat lines only when the server's existing `isNew` flag creates a new character: “Attacks and slotted skills fire automatically when enemies are in range.” and “WASD move · Space dash · E interact · K skills · F1 controls.” Use the existing chat presentation; no overlay, forced interaction, timer, analytics, save flag or extra reward. Returning characters keep their current welcome flow. Help remains available on demand. These instructions describe broad control behavior; individual cooldown/resource/condition requirements remain in skill tooltips.

Why this scope: the baseline shows no automatic-combat instruction before Help/Skills is opened and an actively incorrect mouse cue. The existing creation branch and system-chat channel provide accurate, recoverable instruction without creating a tutorial state machine. New objectives, quest rewards and unlock changes still require their own evidence and design.

## Acceptance and rollback

Typecheck/build. Fresh synthetic character in installed local Chrome at 1920×1080: AUTO appears in both places; new lines use the existing chat; primary tooltip explains automatic use; numbered tooltip identifies priority; SPACE remains. Reconnect the same saved character and verify that new-character hints do not repeat. Inspect retained screenshots and assert original 620 view height. Use ordinary server login/travel/combat and isolated DATA_DIR/BACKUP_DIR; no real saves. No repetitive text-only unit test needed for this reversible copy correction.

Removal/effect: remove false click-to-attack implication, not an actual input feature. No content, progression, town geometry, art, camera or CSS changes. Revert these labels/tooltip/private messages as one narrow diff if they prove confusing; this needs no save migration. An unfamiliar-player study remains necessary before claiming a usability improvement.
