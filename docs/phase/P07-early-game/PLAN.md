# P7 early-game chapter — implementation inventory through C091

2026-10-10. Complete the remaining chapter implementation in sequence, keeping its human/economy acceptance separate. Solo; minimal necessary checks, owner does full playtesting later. Town,620/90ms camera and approved UI materials stay. Menus use columns/tabs/pages, never vertical scrolling.

## Evidence before design

Read Claude P7/P8 scope, C070/C071/C075/C076/C077/C083 adventure reports/data, C026 economy and C027 calibration, five-game OBJECTIVES/LOOT/synthesis/recording notes, and existing P5 reward/repeat authority. Rechecked Blizzard historical2.0.1 Events/Cursed Objects (D3-201-LOOT/D3-35) at https://news.blizzard.com/en-us/article/12671560/patch-2-0-1-now-live. It describes player-activated encounters; no numerical target/current behavior is borrowed. Existing reference vendor offer/preview/accept patterns come from PoE1 and TorchlightII recorded UI; Idleon/TBH separate acquisition from storage/receipt and D3 separates world objectives/turn-in. None supplies a Hearthfall price or gold/hour target.

Measured historical local input runs: the three original Rillwake runs reached level4 with32–35 credited kills; the connected Rillwake/Bracken route reached level7 with80 kills, after equipping the earned weapon. These C070/C071 fixtures predate later behavior and introduction changes, so they are a starting calibration, not current human pace. The existing class unlocks2/4/6/9/12 and rune offsets are actual data. Current authored zones still use1–70 scaling despite distinct quest gates. Current C027 aggressive procedural-field bot outputs are unsuitable human pace targets.

## Chapter inventory and delivery order

| Scope | Existing | Remaining implementation |
|---|---|---|
| Zone authoring | Shared polygon geometry/routes, authored floors/props/NPCs/spawns, reachability/content validation | Document a reusable content-unit checklist and candidate real level bands; preserve return routes and legacy progress |
| Campaign | Water Road: Rillwake → Bracken → private Pumpworks, original four-quest arc, flags/lore | Make the early-game progression route explicit; enough authored follow-through for the stated1–20 slice requires a measured budget, not copying a reference’s zone count |
| Enemies/bosses | Reedclaw lob, Siltusk charge, Keeper ring/slam, three-room dungeon activation | Audit novelty per destination; do not mark renamed inherited stats as new behavior. Broader family/affix additions need defined original behavior and budget |
| Ambient life/audio | Authored motion and positional synthesis in all three areas | Retain these and apply the same bounded schema to added content |
| Repeatable objectives | Server cycle/reward/history capability, no live contracts | Author physical repeat contracts against existing encounter sites, counts derived from actual members; record added economy budget and no offline/backdated completion |
| Field events | Private dungeon mechanisms only | Original optional activated field event, authoritative participants/member deaths/retry; explicit effects on existing spawns/rewards |
| Bestiary | Monster definition data and total kills only | Bounded per-type earned records and readable behavior/zone/affix information, no passive reward or invented drop chance |
| Minimal vendor | Inventory protection and physical service authority, no seller | Exact owned-item sale preview and physical contact, safe recovery/ownership rules; P8 owns stock and complete source/sink tuning |
| Acceptance | Historical functional checks/route samples | Focused changed authority/save checks; brief1080p views; owner human playthrough, G6 economy bands/soak/independent review remain open |

## Design boundaries

No new numbers are treated as researched facts. Candidate ranges/prices/rewards must derive from documented current-game values or a scoped measurement before implementation. Avoid raising a destination’s entry requirement over previously discovered saved progress without a compatibility rule. Do not reset completed quest rewards, delete old zones or invalidate returning builds to create a campaign gate.

Repeated contracts use saved cycle identity and explicit physical accept/claim. An action that happened before acceptance cannot count. An event cannot grant credit for despawns or client-declared kills. Bestiary counts only eligible actual deaths and preserves unknown future records. Selling is an intentional item transfer, not a shortcut to silently deleting a bag: protect marked items, show exact gold and preserve buyback if implemented. No arbitrary gamble/durability/travel/respec sink added as a side effect of P7.

Every addition/replacement records why/evidence/future effect/rollback in the Codex log. Source counts remain188/184 because this step reuses registered evidence. Finish the chapter checklist rather than declaring the roadmap complete from one quest or one new panel.

## C091 implementation closure
The inventory above is now implemented for the early slice: six authored destinations with real bands and compatible server gates; seven story quests/two chapters; two new rigs and distinguishing mechanics; two boss-mechanic patterns; authored trait combinations; ambient motion/audio, contracts/event/bestiary/minimal seller; reusable content-unit checklist. See CHAPTER-REPORT.md. Acceptance remains explicit: all-class input/human campaign checks, economy/drop/death bands, foreground performance, style and G6. Continue P8 stock/economy rather than repeatedly replaying P7. The owner chose no required story repeats.
