# Siltusk — C083

Implemented solo on the owner's PC, 2026-10-09. L97/D038 and [the plan](SILTUSK-PLAN.md) preceded code. This advances F-MON-01/02; it does not finish P4/P7 or the roadmap.

## Change and research

Original boar-like quadruped: four articulated legs, a broad body, bristled back, curled tail, snout and upturned tusks. Existing palette, warm outlines, baked puppet parts and windup eye glow preserve the game's style. No external art/text/audio was imported. [Blizzard's historical 2.2.0 notes](https://news.blizzard.com/en-us/article/18642492/patch-2-2-0-now-live), indexed D3-220-MONSTERS/D3-37, identify charge reach and warning time as concerns. They supply no numerical target. Locked-path sidestepping is the local design inference, also corroborated by a secondary search excerpt; it is not measured D3 parity.

At windup the server locks a direction and destination, capped by the existing230-unit dash distance. An amber capsule marks the creature's swept body. After windup it moves at the existing230u/170ms dash template, stops on solids, never homes or slides and applies at most one physical contact hit per player. Normal defense/thorns apply. Stun, freeze, push, pull and death interrupt it. A thorns death stops later contacts and does not reinsert the dead creature into the spatial index. Chill slows its existing windup/movement clock; the live warning follows the source flag instead of expiring too soon. Cancellation has no fake impact burst.

The authored solver performs continuous body queries between the radius-bounded movement steps, including grazing contacts. Player prediction/sliding remains unchanged. Procedural zones retain their old collision path and do not spawn Siltusk. Protocol5 aligns the new creature/warning support; save version3 stays unchanged.

HP3.6/damage2.2 multipliers,72 walking speed,32 radius,650ms authored windup,1800ms cooldown and1.5 art scale are inherited from Mossback. Existing global windup scaling/minimum still applies. These are initial inherited values, not proven equal difficulty or researched optimal timing. No added stun/knockback, damage premium, invulnerability or long-range dash.

## Replacement and future effect

Only the ordinary Mossback in Bracken Sluice's basin becomes Siltusk. Count, position, tier, escorts and ordinary loot class remain. The named Keeper and other Mossbacks remain; zero spawn weight excludes the new definition from procedural fields/rifts. No quest ID, reward, player skill, owned item or save is removed. Future encounter authors gain a physical charge behavior; balance must account for its new movement instead of assuming inherited stats guarantee parity.

## Measured checks and limits

Typecheck, content validation and production build pass. Eighteen focused checks pass across Siltusk8, Reedclaw4 and auto-cast6. New cases cover locked aim/face, sidestep, swept hit/edge miss/single hit, capped range, thin cover, grazing contacts, four interrupts before/during charge, chilled warnings, death/thorns and invalid definitions. The first run passed17/18: the remaining test attempted structuredClone on unrelated registry functions. Cloning only monster data fixed that fixture; all8 Siltusk cases then passed. This was a test setup failure, not a runtime crash. The C082 fixture also no longer double-registers createMob's result; its six checks pass.

One existing382/382 simulation run passed after the AI/effects changes. No repeated full campaign walkthrough or network-server suite. Isolated temporary roots: hf-c083-checks-470a3cb0a25c48889c514b22b167ad24, hf-c083-repair-1c85f90e559c4d54985cd025fa53d0f6, hf-c083-build-6936431dbff44189b5044e2567d8b898. No real saves accessed. Build retains the existing large-chunk and future config-loader warnings; no performance certification follows from the build or synthetic tick figures.

Two actual Chrome1920×1080 captures were inspected: [warning](tour/c083-siltusk-warning.jpg) and [interrupted](tour/c083-siltusk-interrupted.jpg). The initial capture used the browser's normal size; it was replaced after setting the viewport on the new tab. Exact saved dimensions were checked. The warning remains visible while held and disappears with the source's stun; the preview Charge control reaches its endpoint. No captured console warnings/errors. The broad quadruped/snouted silhouette differs from the upright golem; back legs overlap at this facing and the head glow is strong. These labelled development views exercise the actual rig/VFX, not the live field or server timing. No image claims an organic encounter, audible mix, human balance/readability or sustained crowd performance. The isolated built game server was refreshed with matching protocol5 code.

Town, original620-unit camera,90ms follow, UI style and real player data remain unchanged. The original Chrome frozen-tab cause is still unknown. Further families, encounters, human pacing, production art, live field readability and multiplayer load remain open.

The actual built preview reloaded in town with the matching server, no captured console warnings/errors, and the requested infinite-HP toggle was restored after reconnect. This confirms a fresh responsive load, not a diagnosis of the older frozen tab. Temporary preview tab closed and viewport override reset.

## Rollback

Restore that basin member to mossback, then disable the unused new definition, rig and charge handler together. Keep client/server protocol consistent. No player-save migration or quest/reward rollback is required. Retain research and change history.
