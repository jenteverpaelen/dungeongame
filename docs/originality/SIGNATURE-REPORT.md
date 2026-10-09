# Class signature identity — C034

2026-10-09. [Design](SIGNATURE-DESIGN.md) and L45 preceded implementation. `ClassDef.signatureSkill` now selects the same three skills previously found through text matching: warrior→whirlwind, ranger→sentry, mage→meteor. The content validator rejects missing, inherited and wrong-class references. Class values, display wording, stable save IDs, glyph art and UI styling are unchanged.

## Verified locally

- Project typecheck, all17 shared tests and `content:check` pass. Five of those tests cover semantic content validation, including renamed synthetic display text and invalid signature identities. DATA_DIR: `C:\Users\LAPTOP~1\AppData\Local\Temp\hf-signature-checks-9d0a4938f471452a88963586dc218120`, BACKUP_DIR cleared.
- `node scripts/capture-connections.mjs --selection` built the current client and exercised both built and Vite-proxied entry in installed Chrome154.0.8037.99. Fresh profile and saves under `C:\Users\LAPTOP~1\AppData\Local\Temp\hf-connection-ui-8k6udR`; no existing character data accessed. All owned children closed.
- Both class-selection screens contain all three actual skill glyphs, identical SVG markup and original signature labels. All cards fit. The two game entries succeed with the original620world-height camera; the foreign-origin403 check also passes. [Trace](checks/signatures/trace.json).
- Opened and inspected all four1920×1080 captures in [checks/signatures](checks/signatures): class cards, fonts, colors and signatures remain intact; game HUD/town retain their prior appearance. Animated hero poses differ between captures. Existing unselected-card dimming remains. The direct-entry screenshot catches a transient startup latency/FPS display; this is not a performance measurement. No newly observed clipping or missing glyph.

This uses installed headless Chrome with `document.hidden=false`, not a foreground performance or human-usability test. No full server-suite rerun was needed for this bounded display-reference change; last strict full run is C031 (747server/382simulation). No names have been replaced, and originality/localization remain unfinished. The only removed behavior is implicit display-name matching; no game content is removed. Rollback reverts the fields, lookup and validation together without touching saves.
