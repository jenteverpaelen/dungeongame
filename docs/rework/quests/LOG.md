# Quest rework — log (terse: what changed, why, evidence)

- **Q0 — baseline.** Quest server tests on `claude/quests` @a18f848 (isolated DATA_DIR): 62 tests, 59 pass, 3 fail — the
  three stale story-XP tests the balance pass broke on purpose (STORY_XP_SHARE 0.5). Quest-related tests outside
  `npm run verify`: worldQuests, earlyGame, frontier, midgame, workshop (now added to the verify `adventure` stage).
- **Q1 — research + design.** `REFERENCES.md` (R1–R27, labelled [S]/[SN]/[K]; Kaplan GDC 2009, WoW wiki, FFXIV wiki, GW2
  wiki, D3 bounty guide, D4 guides, PoE guide), `DESIGN.md` (categories, tracker, flow, bounties, objective kinds, world
  states, rewards).
- **Q2 — engine.** Shared: `questCategory`, gather/ordered/hold steps (`targets`, `ordered`, `hold`; state `parts`), reward
  pick (`reward.pick`, state `rewardAlt`), world states (`data/worldStates.ts`, `worldStateOn`, `contactSpot`), tracker
  model (`trackerQuests`, `nextStoryQuest`, focus = `trackedQuest`, `questHidden`), bounty boards (`bounties.ts`),
  migration (`questMigration.ts`, called by `normalizeSave`), validators (gather/hold rules, phased contacts present when
  needed, world-state keys, bounty pools, offer ≤ 511 chars, story XP budget = `storyXp(1,50)`). Zone kit: `phase`,
  `appear`, `moveTo`, `board`, `overlay`, `fire`, structure/wheel `spin`; phased contacts are not solid (collision stays
  identical for everyone). Server: `holdStart`/`inspect` with sim-time check, gather/ordered, `focus/unfocus/hide/show`,
  `abandon`, pick on `claim`, bounty credit on authored kills and event clears, `bountyClaim` (loot spilled at the board).
- **Q3 — content.** All quests rewritten (`storyMessages.ts`, `readingMessages.ts`, `bountyMessages.ts`); 26 contracts
  deleted; 9 bounty boards; new contacts (wheel brake, signal fire, Wenna, three weir cogs, haul signal, toll gate, boiler
  damper, three signal flags, west street gate bar, 9 boards); 22 world states with visuals; Hollis and Wenna in CAST.md.
- **Q4 — client.** Category badges over heads (`questBadges.ts`), minimap marks for every tracked objective and bounty
  targets, multi-quest tracker (`questTracker.tsx`), dialogue with category chips, step list, reward preview and pick,
  closing rules; E on an objective object acts without a window (`questActions.ts`) with a reading card and hold bar;
  bounty board window; journal tabs Story / Side stories / Bounties / Recovered records / Bestiary; world phases renderer
  (`worldPhases.ts`) with camera reveal pan and caption (F-QST-08).
- **Q5 — tests.** Stale tests rewritten honestly (story XP budget instead of "reaches level 20/50"; contracts → bounty
  board; Silent Wheel legacy → migration). New: `questMigration.test.ts` with golden `v14-pre-quest-rework.json`,
  ordered-gather test, bounty board test. Quest-related server tests 86/86, shared 54/54.
- **Q6 — browser evidence (1920×1080, headless Chrome, `scripts/quest-hour.mjs`, `scripts/quest-states.mjs`).** First hour
  played with a fresh warrior through Rillwake and Bracken up to the Under the Spillway turn-in (`shots/hour-*`). Fixes from
  looking at the shots: dialogue accordion (one offer open) and compact reward cards (no tall window); board and pyre art;
  camp noticeboard removed next to a bounty board; codex skips readings already covered by a lore entry; "Not yet. First:
  …" when an object is used out of order; hold cancels only on steering input; wheel brake moved beside the wheel;
  signal flames drawn in front of the logs. World-state pairs (`shots/state-*`; "before" is a client-only rewind of the
  local save, "after" is the real state): Cinderwash and Kilnwatch showed no visible change (smoke emitters too faint, the
  furnace off-screen) → kilns take a `cold` world state (mouth glow and chimney flames off), flames at the kiln mouths
  before; Sablefen chain showed only a turning wheel → drovers and cargo wait at the bridge head until the chain drops.
  Reveal pan prefers draining water, then a cold kiln, then a turning wheel framed with its nearby changes. Phased props
  moved off open floor (new test: no walk-through props, thin stakes/flags excepted). FPS in headless runs 23–98 with
  other agents on the machine; not a benchmark.

## Save

No SAVE_VERSION bump. New optional, normalised fields: `questHidden`, `bounties`, quest state `parts` / `rewardAlt`.
`migrateQuests` (idempotent, on load): `rillwake` → `quests.silent_wheel` r2; 14 quests r1 → r2 by step maps (finished
work stays finished; added steps before it count as done; ready stays ready); retired contracts removed, a finished
unclaimed one is paid its old gold; retired tracked quest dropped.

## Town

No bounty board in Hearthmere: boards stand at the field camps (`bounty_board` contact in each of the nine field zones).

## Quest list (category · objectives · visible change · reward)

| Zone | Quest | Cat | Objectives (kinds) | World change | Reward |
|---|---|---|---|---|---|
| Rillwake | A Foot on the Road | story (tutorial) | kill | — | starter weapon upgrade |
| Rillwake | The Silent Wheel | story | interact · kill (Siltroot) · interact · hold (wheel brake) | wheel turns, millhands + lamps, Orren moves to the mill | XP + weapon/armour pick |
| Rillwake | The Lost Survey Party | side | gather 2 records · kill (Brackjaw) · talk (Wenna, appears) | Wenna's camp upstream; the four surveyors home at the mill | side XP, gold, pick |
| Rillwake | High Water | story | interact · wave (overlook alarm) · hold (signal fire) | signal fire on the overlook | XP, opens Bracken |
| Bracken | Under the Spillway | story | talk (hand-over to Hollis) · reach · kill (Rootbound Keeper) · hold (floodgate) | basin and weir drain, gate wheel turns, Hollis moves to the forecourt | XP + pick, opens Pumpworks |
| Bracken | Silt in the Gears | side | interact · gather 3 cogs · wave (Bursting Weir) · kill (Old Grindle) | the old weir wheel turns | side XP, gold, pick |
| Pumpworks | Pressure Below | story | 3 chamber waves · interact | Bracken pumphouse smokes, pump hands; heart glows | XP + pick, opens Cairnspill |
| Cairnspill | The Stone Road | story | talk (Iven) · reach · kill (Splintercrown) · interact · hold (haul signal) | crews, a haul cart walker, lamps; Iven moves to the dispatch shed | XP + pick, opens Cinderwash |
| Cairnspill | True Measure | side | gather 2 stakes · kill (Grindstone) | new stakes on the Old Track | side XP, gold, pick |
| Cinderwash | Fires Without Keepers | story | talk (Kessa) · interact · kill (Unattended Flame) · hold (draught lever) | kiln mouths and chimney flames go dark, smoke thins; Kessa at the upper kilns | XP + pick, opens Kilnwatch |
| Cinderwash | Apologies to the Fire | side | wave (Flare-up) · hold (offering) · kill (Cinderhusk) | candles at the niche | side XP, gold, pick |
| Kilnwatch | The Last Draw | story | talk (Venn) · interact · kill (Last Ember) · hold (cold draw seal) | furnace mouth goes dark, flames and smoke stop; Venn at the crown | XP + pick, opens Sablefen |
| Kilnwatch | The Missing Shift | side | interact · kill (Slagmaw) · interact | the night shift home at the refuge | side XP, gold, pick |
| Sablefen | Cargo Without a Crew | story | interact · kill (Tollkeeper) · hold (toll gate) | toll barrier and banner gone, a carter | XP |
| Sablefen | The Unsigned Writ | story | interact · kill (Chainwatch) · hold (chain winch) | winch turns, waiting drovers cross, lamp lit; drivers at the refuge | XP + pick, opens Saltwind |
| Sablefen | Sera's Count | side | interact · wave (Tide of Skimmers) · kill (Mudgullet) | — | side XP, gold, pick |
| Saltwind | A Bitter Measure | story | interact · kill (Dry Boil) · hold (boiler damper) | firing lane smoke settles | XP |
| Saltwind | Under the White Ledger | story | hold (overflow spindle) · kill (White Ledger) · interact | the overflow drains | XP + pick, opens Lockglass |
| Saltwind | Neris's Tally | side | gather 2 gauges · kill (White Clerk) | — | side XP, gold, pick |
| Lockglass | Borrowed Pressure / The Borrowed Heart | story | chamber waves · interact | — | XP; heart: + pick, opens Shiverline |
| Shiverline | A Flag in the Wrong Wind | story | interact · kill (Interceptor) · interact | — | XP |
| Shiverline | An Honest Flame | story | interact · kill (Mute Flame) · hold (beacon) | the upper beacon burns | XP + pick, opens Beaconbreak |
| Shiverline | Tallis's Flags | side | interact · ordered gather 3 flags (puzzle) · wave (Gale Harriers) · kill (Rimecrown) | flags on the post | side XP, gold, pick |
| Beaconbreak | The Closed Hand | story | interact · kill (Closed Hand) · hold (gate bar) | barricade gone, crews in the west street | XP |
| Beaconbreak | The Countermand | story | interact · hold (cistern stopcock) · kill (Countermand) · interact | the ward cistern flows | XP + pick, opens Hollowstar |
| Beaconbreak | Mera's Ledger | side | gather 2 pages · wave (granary riot) · kill (Second Seal) | — | side XP, gold, pick |
| Hollowstar | The First Answer / A Reply to Nobody / The Last Transmission | story | chamber waves · interact | — | XP; last: + pick, flag relay_network_restored |
| Hearthmere | 5 workshop lessons, 2 gifts | lesson | talk | — | Cube level / set piece |
| 9 field zones | Bounty board | bounty | 3 of 6–7 (event, named foe, hunt) | — | gold + 25 kills of XP each; cache: gold, XP, rare + magic item |
