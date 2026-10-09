# R-19 — Audio

Read 2026-10-09. Existing procedural sound remains; no external music/SFX downloaded.

[MDN-PANNER](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode) documents source/listener spatialization, stereo output and configurable distance attenuation. It establishes API behavior, not which mix sounds good or how many voices this PC can sustain.

[GAG-BASIC](https://gameaccessibilityguidelines.com/basic/) supports separate category volume controls and visual alternatives to essential sound cues. Audio must respect mute/settings throughout combat, loading, re-entry and disconnect.

## Hearthfall inference

Audit the current effects/ambience graph and voice caps before replacing it. Measure dense simultaneous casts, clipping, unlock-after-user-input behavior and source cleanup. Use original synthesized cues; event priority and voice stealing should preserve important player feedback.

## Unfinished

C042 source audit finds the channel loop depended on an active game frame for cleanup after disconnect. Installed Chrome reproduces a live source and pending intent on the selection screen; see P03 AUDIO-LIFETIME-DESIGN.md and its before/after evidence. AUDIO-01 separates a stop request from ended/context state. This correction preserves the existing sound bank and mix; it does not complete a listening or dense-combat audio evaluation.

Procedural synthesis techniques beyond current implementation, subjective mix/listening checks, autoplay guidance, categories and persistence, actual concurrency cost. No imported package licence has been inferred from an author's marketing page. Any future CC0/MIT asset needs its exact individual licence/provenance and download entry, even with standing download authorization. Current town sound/ambience changes are outside this frozen-town pass.
