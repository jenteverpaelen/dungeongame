# Current economy: creation, consumption and transfers

2026-10-09. This is a local rules audit, not recommended balance or reference-game parity. Plan: [ECONOMY-MEASUREMENT-PLAN.md](ECONOMY-MEASUREMENT-PLAN.md). Reproducible script: `scripts/audit-economy.ts`; [raw results](checks/economy-audit.json). No live saves or game world are used. Current rules at 7f869b1; only comments are corrected afterward.

## Computed fixture results [M]

Node24.19, XP_MULT pinned to the current default 3, fixed clock and seed. Sixty offline cases cover three classes, four initial levels and five durations; each is repeated and compared with a legal higher difficulty. Unequipped fixtures deliberately isolate level/class from reward affixes. Also check three excluded zones, one weapon comparison, fifteen item-cost fixtures and all ten upgrade stages. These are synthetic setups, not progression observed in a playthrough.

| Offline fixture | Kills | XP | Gold | Result |
|---|---:|---:|---:|---|
| L1, exactly two minutes | 0 | 0 | 0 | No offline report |
| L1, two minutes + 1 ms | 30 | 1,980 | 45 | L3; strict threshold produces a discontinuity |
| L1, one hour | 900 | 59,400 | 1,364 | L8; 22 scrap, 22 dust, 6 crystal |
| L1, twelve hours | 10,800 | 712,800 | 16,371 | L16 |
| L1, twenty-four hours | 10,800 | 712,800 | 16,371 | Same capped twelve-hour result |
| L70/P0, twelve hours | 10,800 | 532,915,200 | 25,125,229 | P39 with remainder; 270 scrap, 270 dust, 72 crystal |

The formula uses a fixed 60 kills/minute assumption × 0.25 = **15 kills/minute**, independent of measured active kills. A L30 Mage's sheet DPS changes from 6.05775 without equipment to 141.3475 with a generated normal wand; both one-hour results remain 900 kills, 10,538,100 XP and 89,840 gold. Difficulty comparisons are identical for every case. XP/gold reward affixes can still affect their own outputs; this audit does not say every equipment change is irrelevant.

Rewards use the **initial** level clamped to the field band, then apply the whole XP grant. They do not recompute per kill as the character levels. No items, gems, souls or Death's Breath are created by this offline function. Town, rift and unknown last-zone fixtures produce no report. This is Hearthfall's current implementation; its “Idleon-style” comment is not verification of Idleon's current formula.

Upgrade expectation is calculated from current success chances and +6 percentage-point Fortune on each failed attempt, reset on success. Sum survival probabilities until success becomes certain. For a synthetic non-ancient L70 Legendary starting at +0, expected total +0→+10 gold is **67,622,305.12** under independent uniform draws; +9→+10 contributes 33,574,487.27 with 3.3011694 expected attempts. Materials are additional. These are model outputs, not sampled spending, a deterministic price or a tuning target. Other fixtures include exact per-attempt material costs and enchant-count costs; helper inputs do not prove every item is eligible for every recipe.

## Code-path inventory [M: read implementation]

| Path | Creation / consumption / movement | Important boundary |
|---|---|---|
| Character creation | Five starter equipment items, zero currencies | Creation is separate from later loot |
| Combat drop roll | Personal ground items, gold, gems, material and health-globe payloads | Spawning is not yet currency credited to the save |
| Goblin hit | Extra personal ground gold | Credited through normal pickup |
| Pickup | Gold/materials/gems credited; item moved into inventory | Item distance 46 + player radius; other magnet radius 110 + pickup stat |
| Ground expiry / departure | Uncollected payload removed | 90-second lifetime; full inventory leaves item on ground until collection/expiry; not a subtraction from saved wealth |
| Offline login | XP, gold, basic materials and kill stats | Fixed rate above; rewards already applied before the modal's Claim button closes it |
| Equip / unequip / inventory swap / stash | Existing item moved, retaining identity | Equip also binds; stash is not a destruction sink |
| Destroy | Inventory item removed; socketed gems returned | No material/currency reward |
| Salvage / salvageAll | Item removed; materials and rarity-dependent Cube XP created; gems returned | Actual handler uses salvageXp (2/4/9/30/30), not the generic CUBE_XP.salvage value 3 |
| Enchant roll | Gold/materials spent; Cube XP granted; pending options held in memory | Charge occurs before selection; repeat rolls and disconnect semantics need an explicit audit |
| Enchant pick | Affix retained/replaced, binding and enchantCount advanced | Keeping original still increments count; no second charge here |
| Empower | Gold/materials consumed on both success and failure | Success raises tier; failure adds Fortune; item survives and binds |
| Transmute | Rare replaced by generated Legendary or eligible class-set fallback; gold/materials consumed | Original socketed gems returned; replacement has a new identity |
| Extract | Legendary removed; permanent learned power, Cube XP granted; gems returned | Gold/materials consumed; already-known power rejected |
| Reforge | Properties replaced on the existing item ID, binding preserved; gold/materials consumed | Gems retained in available new sockets; overflow returned to loose gems |
| Add socket | Gold/materials consumed; empty socket added | Item socket capacity enforced |
| Insert gem | Loose gem moved into socket | No gold charge, no net gem creation |
| Remove gem | Gold consumed; socket gem moved back to loose storage | Rank-dependent gold sink, no destroyed gem |
| Gem fusion | Three equal type/rank gems + gold → one next-rank gem and Cube XP | Highest rank rejected; item count shrinks while rank rises |
| Skill tier purchase/reset | Unspent skill points ↔ purchased tier allocation | Reset refunds spent points; no gold sink |
| Paragon allocation/reset | Available category points ↔ allocation | Allocation is not currency destruction |
| Debug grant | Explicit test/admin opt-in creates resources | Exclude from ordinary economic-rate estimates |

Read paths: `shared/src/cube.ts`, `items.ts`, `character.ts`, `progression.ts`, `constants.ts`; `server/src/commands.ts`, `afk.ts`, `sim/loot.ts`, `net/session.ts`; `client/src/ui/hud/Overlays.tsx`. This table does not assert full-world per-hour yield or complete live-ops telemetry.

## Findings requiring further evidence [Q/P]

1. Offline rate does not respond to actual build strength. Compare measured active routes and intended idle progression before choosing whether to change it. The threshold discontinuity and initial-level batch calculation are now explicit, not automatically defects.
2. Enchant cost uses enchantCount, which advances at selection rather than payment. Read a real repeated-roll/pick/cancel/disconnect trace before deciding whether abandoned rolls should advance cost or persist options. Paid options are currently connection-local. No new price rule is adopted here.
3. The generic salvage XP entry is not the executed reward. Future content tooling should distinguish display metadata from active handlers; do not replace the handler with the generic value accidentally.
4. Source/sink totals need real action frequency, pickup loss, equipment eligibility and player choices. Comparing a twelve-hour AFK grant with one upgrade expectation alone cannot establish inflation, fairness or an appropriate sink.
5. Reference screenshots found through image search remain uninspected: direct image fetches failed. Generated search captions are not a visual atlas. No external art was copied or used as gameplay evidence.

## Changes and validation

Follow-up C027: FIELD-CALIBRATION-REPORT.md now records27 real-Instance active bot visits and exact pickup/expiry reconciliation. Their enemy mix, levels and policy differ from the fixed offline model. This partially fills the active measurement gap but does not establish casual earning rates, inflation or fairness.

Only correct the two misleading active-rate comments and the inverted minimum-away comment. Runtime constants/formulas/rewards stay identical. The audit completes with all fixture assertions, repeat comparisons and no files written to its isolated DATA_DIR. It does not need a new browser capture because gameplay/UI did not change. Project typecheck and a separate strict TypeScript check of the audit script pass (scripts are outside the project tsconfig). Two separate runs produce identical report SHA256 `29859523D63802CBE816FE5DBD3C7AFBD2A26D88AF654DFD674A97DD79739DC4`. Rollback is the comment/harness/report diff; keep raw findings as historical evidence if mechanics later change.
