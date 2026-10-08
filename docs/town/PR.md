# Draft: replace the procedural town with authored Hearthmere

**Not ready for final acceptance:** pause checkpoint. Startup remains above five seconds, extreme spell framing exposes an edge strip, and final crowd/tour checks are pending. See [PAUSED.md](PAUSED.md). No PR has been created.

The old town used a small procedural square, approximate circle buildings and service commands that could execute away from their NPC. Hearthmere now follows the approved measured hub layout, with shared swept polygon collision, authored depth baselines, all physical town services and a persistent 60-slot character stash.

The original art pass covers the full settlement and two enterable rooms, with dusk lighting, deterministic ambient life, positional synthesized sound and a matching minimap. Town-only pose caching and GPU NPC atlases address the measured crowd and startup costs while preserving hero art, combat rules and the existing field/rift path.

Validation and raw results: [FINAL.md](FINAL.md), [PERF.md](PERF.md), [TOUR.md](TOUR.md). Shared field/rift golden fixtures, collision parity, service authority, stash persistence and real-browser service flows pass. The two known Windows SIGTERM assertions remain failing. Browser performance is measured locally in installed Chrome with the RTX 4070; headless/low-percentile/VRAM-estimate limitations are explicit. No new external assets, dependencies, paid services or real saves are included.
