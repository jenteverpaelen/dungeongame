# Focused skill behavior probes

2026-10-09, before harness and any correction. L38 / BUILD-REPORT.md.

Use a real server Instance and Player with a synthetic unequipped L70 character, isolated empty DATA_DIR, deterministic seeds and no persistence. Remove generated monsters for a controlled fixture. Locate an actual free patch through current collision checks; do not replace the collision engine. Two durable stationary ordinary monsters, neither a boss nor a training dummy (which deliberately ignore chill), provide a direct target and a nearby target outside the projectile body.

Run one actual summon firing update, then actual projectile updates until that shot resolves. Compare ordinary, Arcane and Frost Hydra: projectile kind/visual/element/splash/flags, direct and neighboring damage and chill. This observes a single shot, not sustained DPS or live targeting quality. Test movement/AI are held still intentionally. Record fixture positions and timing.

Cast Battle Rage and Magic Weapon through the actual cast dispatcher across no rune/all three runes and tiers0–3. Record actual buff damage/crit/duration and current shared description; compare to intended existing flags. If the mismatch is confirmed, prefer correcting the displayed summary/rune wording while retaining all current numbers and geometry. A shared buff-value helper may remove duplicate rules if both server and descriptions use it and before/after behavior is identical.

Acceptance: actual impact and non-impact checks, repeatable output, typecheck; targeted semantic regression for a selected correction. Browser1080p inspection for changed text, with original style/camera. No full gear-aware calculator, skill rework, new tier, respec price or measured human comprehension claim. Preserve before evidence and explain removals/rollback in the change log.
