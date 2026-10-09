# Claude roadmap — verification notes, 2026-10-09

The original `FULL_GAME_ROADMAP.md`, `baseline-audit.ts` and saved output are preserved unchanged. Roadmap blob: `b20bc7acef78c12582a8f5cf822665cf78ca7353`, fetched from `origin/docs/mmo-roadmap` at 34461a5. Roadmap SHA256: `f1d818eecb08b11794d046c0ce43b5e917922d0447c036a95deb6c6abe62ba92`.

## Measured corrections and limits

1. **Loot table difficulty label (§1.3).** The row with about 0.100 items/kill and a 265-kill legendary-or-set event gap is simulated at `diff=4`, which `shared/src/progression.ts` names **Torment I**. The prose calls it Torment IV / index 7. Use the measured Torment I label. No new result for index 7 is implied.
2. **Metric meaning.** `baseline-audit.ts` increments a gap once per kill and resets it if that kill drops at least one legendary **or set** item. Its `killsPerLegendary` is therefore a mean completed gap between successful kills, not the reciprocal of item yield. A guardian can yield 2.18 such items per kill and still have a one-kill event gap. Final incomplete gaps are censored. `legendariesPerKill` also includes set items. Use precise labels before making balance decisions.
3. **Audio count (§1.1).** Reproduction differs from the draft's saved audit only in the procedural sound count: 52 → 60. The eight town sounds are now committed in the existing town checkpoint. This is not new audio added by the research pass.
4. **Hours remain assumptions.** The audit's 60 kills/minute conversion comes from the AFK model. Neither it nor a synthetic geared bot establishes casual time-to-70. No playtime target is approved by that calculation.
5. **Tests are time-specific.** This session measured 730 server passes and the two known Windows SIGTERM shutdown failures, 12 shared passes after the requested camera-feature removal, 382 simulation checks and 4 town-service tests. See the [camera check report](../town/checks/camera-restored-2026-10-09.md). The draft's 613 is historical.

## Owner updates superseding draft process suggestions

Work remains only on `codex/new-tristram-town`, solo. The town is frozen; original 620 u camera restored. Preserve UI style. Equal first-batch research: D3 Campaign/Adventure, Idleon, TBH, PoE1/2 and Torchlight II. R-21 adds Torchlight II; R-09 Infinite remains a separate future topic. The owner authorizes sufficiently supported changes without routine permission requests and necessary downloads with source/licence tracking. This does not make unresolved proposed numbers factual or authorize paid services.

Reproduction: fresh temporary DATA_DIR; `node --import tsx docs/design/baseline-audit.ts`. Output: [2026-10-09 audit](../phase/P01-research/checks/baseline-audit-2026-10-09.txt). It reproduces the script, not every prose claim in the large roadmap. No gameplay constants or save data were changed.
