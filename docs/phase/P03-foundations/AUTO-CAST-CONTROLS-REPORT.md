# Per-slot auto-cast controls — C082

Implemented three conditions in the existing Skills panel: Automatic, While still, Paused. The server applies the selected condition in addition to existing targeting, resource, cooldown and skill-specific rules. Conditions persist per character and remain attached to slot positions. The HUD shows restricted slots and explains their condition. Automatic preserves legacy behavior.

Research-before-code is L96/D037. The official Torchlight Infinite stationary condition is a pattern reference; no distances, bonuses, monetization, art or text are imported. Paused/While still are tactical choices rather than a new damage system. Advanced numeric rules, manual cast keys, skill cadence and balance targets remain open.

## Actual behavior and compatibility

- Movement comes from authoritative processInputs; an active dash also blocks While still. It uses the existing moving-state threshold, not a new input or latency prediction rule.
- Pausing or moving under While still stops a channel via the existing endChannel recovery (400 simulation milliseconds). No extra channel resource tick or refund. Existing cooldowns and independent buffs/summons/projectiles remain. Other slots and primary attacks still run.
- Commands include expected skill ID and exact slot to reject stale UI intent. Invalid modes, slots, empty-slot intent and nonmatching skills fail before mutation. Set-state retries are idempotent.
- Save version3 / protocol4 protect persisted restrictions from older code. Legacy missing choices become Automatic. Invalid present choices pause for explicit correction. Golden v3 fixture and v0/v1/v2 migration checks preserve owned items and unknown fields. Do not downgrade by stripping version or restrictions.
- Replaced misleading enemy-count tooltip wording with the existing weighted rule (ordinary1, elite/goblin3, boss10), and clarified companion out-of-combat behavior. No enemy weights changed. No content, reward, skill or item removed; only casts explicitly restricted by the player are withheld.

## Measured checks

On the owner's PC, isolated DATA_DIR `C:\Users\LaptopJente\AppData\Local\Temp\hf-c082-checks-edfb0babb19441daa7a9b5cd0366eeb5`: 15 focused command/migration/movement/channel checks passed, typecheck and content validation passed, existing simulation 382/382 passed, production build passed. The first sandbox attempt failed before tests due to Windows user lookup (`uv_os_get_passwd`); the host run succeeded. No real saves were used. Existing large-chunk build advisory remains.

Actual built Chrome at1920×1080, isolated PumpC075 mage: changed Meteor slot1 Automatic → While still → Paused, reloaded and observed Paused retained, then changed back through While still to Automatic. HUD and pressed state agreed. Inspected `docs/adventure/tour/c082-autocast-still.jpg` and `c082-autocast-paused.jpg`; a pilot HUD label wrapped, then nowrap corrected it and both final captures were inspected. No captured browser warning/error. Infinite HP restored after reconnect. All current ordinary preview slots are Automatic again.

## Limits and rollback

No live field-combat visual recording, all-class panel tour, human tactical-value test, broad parity conclusion, or sustained browser benchmark. The existing panel scrolls to lower tiers; the added explanations are relatively dense. Save/reload and runtime cases prove bounded behavior, not whole-phase completion. No dependency/download or town/camera/style change.

Rollback may remove the editor while preserving runtime restrictions and version refusal. A deliberate downgrade must translate saved preferences explicitly rather than silently resume paused skills. Continue the full Claude roadmap.
