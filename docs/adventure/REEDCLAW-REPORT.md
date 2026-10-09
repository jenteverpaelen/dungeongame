# Reedclaw — C076

Implemented solo on the owner's PC, 2026-10-09. L90/D031 and [the plan](REEDCLAW-PLAN.md) preceded code. This is a scoped addition to Claude's monster-family and behavior toolkit requirements; P4/P7 remain incomplete.

## What changed and why

Reedclaw is an original crab-like creature with eight articulated walking legs, two claws, an oval shell and reeds. Blizzard's historical engaging-monsters article supports mixing basic enemies with a minority that invite different movement; the Monterey Bay Aquarium sheep-crab account supplies anatomical reference. Neither supplies a balance target. No reference image, text, sound or asset ships.

The creature raises its claw, then throws at the player's position at release. An amber circle and falling stone mark the fixed landing point. Walking out avoids the hit. Stun or death before release prevents the throw; killing the attacker after release does not erase the airborne stone. Shared geometry is checked at release and between impact and each nearby player. Damage is a ranged physical hit, not a melee thorns trigger. The impact comes from the server, avoiding a second client-predicted damage effect.

Its HP/damage/speed/range/windup/cooldown retain Thornling's values; its palette comes from Mossback. The 75-unit circle and 900-ms flight reuse the existing mortar parameters. These are explicit starting choices, not researched optimums or human-tested balance. The existing global windup multiplier still applies.

One Thornling placement in each of Rillwake's yard, Bracken's bank and Pumpworks' west chamber is replaced by Reedclaw. Counts and locations remain unchanged. Thornling still exists elsewhere. Reedclaw has zero procedural spawn weight, so existing random fields/rifts are unchanged. No old monster definition, item, skill, quest, system or save is deleted. Future authored encounters can reuse the new lob behavior; further families and encounter composition remain work.

## Measured verification and limits

Typecheck, content validation and production build pass. Sixteen focused cases pass: four Reedclaw cases, four dungeon cases and eight content-validation cases. They cover fixed aim, dodge, impact timing, one damage application, thorns, interrupt/death timing, exact cover and invalid flight/radius data. All use isolated DATA_DIR on this PC. No full regression replay was run. The first test pass exposed a fixture mistake (a dynamic collider was used for static line-of-sight cover) and a test-only TypeScript narrowing omission; both were corrected. No production failure is inferred from those setup errors. The existing build chunk-size warning remains.

The [actual Chrome rig sheet](tour/c076-reedclaw-rig.jpg), 1920×1080, was inspected after the earlier 1920×1022 capture was replaced. The broad shell/claws distinguish it from the existing upright monsters; the legs are dense at small scale. The sheet's final columns extend beyond the viewport. White poses are the existing hit flash. The gallery had no captured warnings/errors.

A fresh server using the existing isolated PumpC075 save loaded Rillwake; infinite HP was enabled after travel. Ordinary automatic combat occurred and the page remained responsive, with no captured warnings/errors. The enemies died before the still was taken, so the new throw and warning were **not visually verified in live combat**. A helper route selected from the wrong starting location was stopped; this is not a collision failure. Do not interpret this assisted level-4/5 visit as a first-time balance or pacing test. The original frozen tab's cause remains unknown; a responsive fresh tab is not proof of a root-cause fix.

Human readability during combat, sound mix, normal-health balance, broader per-zone families and sustained performance remain unverified. The built preview was refreshed with matching client/server code. Town, original camera and UI style remain unchanged.

## Rollback

Restore the three Thornling placements, then remove Reedclaw and its unused rig/lob VFX and resolver together. No saved monster state or player migration is needed. Retain the research/history; no claimed quest state or rewards are affected.
