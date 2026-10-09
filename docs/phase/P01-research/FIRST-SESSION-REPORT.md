# First-session observation — Hearthfall

2026-10-09. This is a scripted expert audit of the existing game, not a new-player study. Plan: [FIRST-SESSION-PLAN.md](FIRST-SESSION-PLAN.md). Raw state/text: [trace.json](checks/first-session/trace.json). All twelve retained 1920×1080 PNGs were opened and inspected.

## Measured setup and actions

Installed local Chrome, separate fresh browser profile, Node v24.19.0, empty temporary DATA_DIR `hf-first-session-kEuqhc/saves` on the owner's PC. Debug and backup scheduling disabled. No grants, teleports, speed changes, prewritten character or autostart. Every capture reports 1920×1080, visible document and, in-game, the original 620-world-unit view height. Chrome version was not recorded by this baseline harness. Instantaneous HUD FPS is not a benchmark.

The script chooses Mage, types FirstTrace and clicks Enter World. It deliberately knows F1, K, I and E. Its authored-route helper returns only the existing spawn point, (2891.5, 2418.6): the character starts at the Waypoint approach. **No town traversal was measured.** Clicking the visible first-field travel button enters Whispering Glade. The script waits, holds D for three seconds and waits again. It never presses an attack button.

| Capture | Script elapsed, including startup/waits | Observed state / visible action |
|---|---:|---|
| 00-class-selection | 4,470 ms | Three class cards, name entry; Enter World disabled while empty |
| 01-first-town | 8,753 ms | L1, 0 gold, 0 XP, primary plus four empty skill slots; E Use Waypoint visible |
| 02-controls | 9,547 ms | F1 lists movement, Dash, interaction, panels and automatic-combat explanation |
| 03-first-skills | 10,848 ms | Primary available; actives at 2/4/6/9/12; first primary rune at 3; no points |
| 04-first-inventory | 12,302 ms | Five equipped starting items, 0 occupied inventory slots out of 60 |
| 05-waypoint-approach | 13,724 ms | Still at spawn/approach; not a measured walk |
| 06-waypoint | 14,587 ms | Glade enabled; Ashen destination visibly gated at level 8 |
| 07-first-field | 17,407 ms | L1 at field entrance, (544, 2912) |
| 08-field-idle | 26,813 ms | Still L1 at entrance after eight scripted idle seconds |
| 09-field-after-walk | 42,254 ms | At (1394, 2912); L2, 5 gold, 1,164 XP, 15 kills, one unspent point; Meteor assigned automatically |
| 10-skills-after-field | 43,167 ms | Meteor shown in slot 1; first tier costs two points, so cannot yet buy it |
| 11-inventory-after-field | 44,552 ms | Still 0 occupied inventory slots; uncollected ground loot visible |

These times are one script execution, not time-to-understand, human time-to-level, deterministic combat benchmarks or expected population outcomes. The inventory array has 60 entries, mostly null; its array length is not the number of collected items. No successful item pickup/equip, manual skill assignment, rune selection or tier purchase was observed in this short run.

## Observed UI and code cross-check

- The initial class-selection screen explains class themes but not the shared automatic-combat rule. F1 and the Skills sidebar do explain it.
- The primary HUD slot displays a mouse glyph; the Skills primary slot says `LMB`. Actual input has no mouse attack command, and these HUD slots are hover-only. This is a directly demonstrated label/behavior mismatch, not a measured comprehension failure.
- Skills 1–4 are ordered automatic slots. Their displayed numbers can resemble key bindings; the existing sidebar already explains priority. Dash's SPACE label is a real binding and should stay.
- Current panels fit the retained 1080p frames without obvious clipping. This is not an accessibility or every-screen audit. F1 still exposes prototype/collision inspection controls; their production exposure remains tracked separately.
- Town appearance, original camera, service positions, costs, starting gear and unlocks were not altered by this audit.

## Hypotheses and unfinished evidence

An accurate primary label and an immediately available explanation may reduce wrong attack attempts. That benefit is an **untested hypothesis**. A tutorial quest, extra reward, delayed unlock or new overlay is not justified by these observations alone.

Next: correct the false primary cue within the existing UI, verify fresh and returning views, then extend the observation to real item/skill decisions and unfamiliar players. The five reference games' actual UI atlas and versioned timelines remain missing. This local trace does not complete R15 or G1 and does not substitute for reference-game footage.

## Harness isolation correction

Standalone local capture, crowd, walkthrough, bot and shutdown-fault launchers now explicitly clear inherited BACKUP_DIR. The newly added optional backup scheduler otherwise makes an inherited operator path a possible destination for synthetic snapshots. Only child test environments change; production configuration is untouched. Existing historical captures are retained. No content is deleted.

Validation: all seven affected JavaScript launchers pass `node --check`; TypeScript typecheck passes. The real-child shutdown fault test passes with its parent deliberately configured with a synthetic `must-not-use-backups` directory; that directory is never created. Isolated root: `hf-first-session-check-173c6c08a9304d13ada35d96160230c9`. The prior full runner remains the regression result for unchanged gameplay; it was not repeated solely for these harness/documentation edits.
