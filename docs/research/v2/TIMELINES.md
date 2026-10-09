# Progression timeline evidence — incomplete

C056,2026-10-09; researchL67. **No external progression time is ready to become a Hearthfall target.** This separates a published recording's timestamp from actual play time, and a newly created character from a new account. It begins the roadmap's timeline matrix without filling unknown cells with estimates.

## Observed campaign sequence [V]

Infinite Gaming's [PC Crusader recording](https://www.youtube.com/watch?v=6Eqo6ftZ3no), published November21,2024, visibly runs build2.7.7.93903. Eighteen paused frames were personally inspected in Chrome on the owner's PC at1920x1080. [TIMELINE-FRAMES.json](TIMELINE-FRAMES.json) contains exact offsets, source conditions and every observation; it is the detailed record. This is historical, sparse gameplay footage, not a currently installed reference client or continuous twelve-minute viewing.

| Video offset | Visible state | Evidence boundary |
|---|---|---|
|00:00–00:15 sampled at0/5/10/15s|Creation choices, Crusader selection, Campaign/ActI/Normal/Private lobby, level1 and blue100 badge|Name/button state observed; actual creation input and all default settings untested|
|00:30 /01:00|Paragon-related notification; locked1–4 slots beside mouse/potion controls; target identity and a contextual quest-giver hint|Existing account progress already visible; not first-account pacing|
|02:00 /05:00|Paragon points and allocation previews on a level2 character, with available/invested/effect values and Accept/Cancel/Reset|No sampled acceptance click or measured combat-stat change|
|02:30 /03:00 /04:00|Dialogue with world/tracker retained; talk-to-kill objective changes; separate minimap-symbol instruction|Sparse observations do not establish precise transition times or comprehension|
|06:00|Hard replaces the previously visible Normal; bonus objective1/3 and a compact lore control|Difficulty-change input/time unobserved; constant-difficulty comparison invalid|
|07:00|Sound options and separate confirmation controls|Player-specific values; no claim about defaults, applied changes or audio output|
|08:00|Level3 and bonus-completion notices overlap while combat HUD remains|No notification duration, ordering or information-retention measurement|
|10:00 /10:15|Level4; waypoint-use then town-talk objective; next sample in town with waypoint step checked; first numbered skill slot populated|Travel input and skill choice not sampled; level4 at video10:00 is not a clean ten-minute progression target|
|10:30 /12:00|Dialogue, then later level5 and quest-reward receipt with XP/gold/Continue|Not evidence of exact quest duration, first item, reward formula or transaction semantics|

The game UI is English; the hosting YouTube controls are Dutch. The initial5-second seek briefly showed an old frame while media was not decoded; only the laterreadyState4 frame supports the record. At10:30, a player recommendation overlay temporarily obstructed the source; the unobstructed image was re-inspected. No surrounding recommendations/profile details are retained. Source speed, edits, mods, recording date and later social participation remain unknown. No media file, game client or source asset was downloaded into the repo.

## Requested timeline matrix [Q]

The time axis below means **comparable elapsed play time from a declared start**, not arbitrary video offsets. `Q` is unknown, never zero, absent content or a recommended duration. Every measured cell would need level, power sources, zone, unlocks, loot beats, UIs, social state and session goal, plus its provenance. Later-hour cells need longitudinal evidence; one opening recording cannot supply them.

| Game / mode |10 min|1 h|5 h|20 h|50 h|100 h|200 h|
|---|---|---|---|---|---|---|---|
|D3 PC Campaign|Q; D3-CAM-01 has an ineligible video-offset sample above|Q|Q|Q|Q|Q|Q|
|D3 PC Adventure|Q|Q|Q|Q|Q|Q|Q|
|Idleon|Q|Q|Q|Q|Q|Q|Q|
|Task Bar Hero|Q|Q|Q|Q|Q|Q|Q|
|PoE1|Q|Q|Q|Q|Q|Q|Q|
|PoE2, separate game|Q|Q|Q|Q|Q|Q|Q|
|TorchlightII PC|Q|Q|Q|Q|Q|Q|Q|

These rows have equal research priority. Their evidence coverage is not equal yet. Other roadmap references still need timeline evidence too; this initial matrix covers the owner's five requested games, with modes and PoE games separated. D3's example is deliberately ineligible rather than quietly normalized by subtracting a chapter timestamp. Its description's00:22 ActI chapter marker does not prove a clean timer start.

## Transfer questions, not implementation decisions [P]

- Can a future objective distinguish action, target/location, optional progress and completion without obscuring current combat? The recording exposes separate tracker, instruction and dialogue surfaces, but their overlap at level/reward moments needs evaluation.
- Can investment previews be distinguished from committed state? Paragon's visible controls motivate checking preview/accept/cancel semantics; a screenshot cannot prove them. Hearthfall's existing enchant interleaving/replay evidence remains separate.
- Does a return instruction teach a useful existing service in context? The sampled waypoint objective suggests a question for onboarding; it does not reopen the frozen town or establish a new unlock gate.

No new quest, reward, level gate, UI layout or content removal follows from this recording. D3's manual-action hints are not suitable text for Hearthfall's automatic combat. The first equipment change, skill-selection input, incompatible/full/insufficient states, ordinary first-account Campaign and Adventure traces and all other games' early flows remain open. Continue those alongside decision-independent foundation work; G1 and the full roadmap are not complete.

## C057 — Torchlight II early interfaces [V]

Retro Games Hub's [Part 1 recording](https://www.youtube.com/watch?v=DW9gPNNXQhE), published November 25, 2023, supplies 24 inspected sparse frames through video 16:00. Three opening logo/promotion frames are excluded from game-interface conclusions. Gameplay is already underway at 00:15; creation, build, class label, difficulty, mods, account history, source speed and edits remain unverified. The title does not certify an unmodified fresh start. Thus the clean timeline cells above remain `Q`.

The browser viewport was 1920×1080 and decoded source video 1920×1080. Fullscreen host overlays and page scrolling obstructed some initial captures. Complete frames were then inspected in the normal page player, rendered at approximately 1337×752 or 1348×758. These are **scaled observations, not native-resolution geometry measurements**. The initially undecoded 10:00 capture and host overlays do not count as evidence; corrected frames do. Exact notes are in [TIMELINE-FRAMES.json](TIMELINE-FRAMES.json).

| Video offset | Observed decision context | What remains unknown |
|---|---|---|
|00:30 /01:00 /02:00|World speech bubble, then formal quest offer with destination/rewards, then an active tracker|Exact acceptance input and quest persistence|
|04:00 /04:15|Level 2 notice and contextual tip pointing to a level-up control; later tip absent and plus markers remain|Tip dismissal input/persistence and actual point spending|
|10:00–10:20 sampled|Equipped and candidate chest pieces shown together; equal armor but extra candidate attributes; equip and transfer instructions|A hover is not an equip; a red X elsewhere has no inspected explanatory tooltip|
|10:30 /11:00|Pet and character panes coexist; later pet equipment shows icons matching earlier character-bag gear|Exact item identity, transfer input, protection and pet sell-trip outcome|
|12:00 /12:30 /12:40 /13:00|Town arrival retains talk objective; turn-in presents three choices; comparison separates item level from alternative requirements; selected reward and confirmation appearance change|Actual confirm input, authoritative ownership, durable grant, failures and duplicate handling|
|13:15|Next quest offer appears|No exact completion timestamp or reward receipt established|
|14:00 /15:00|Shop context changes modifier hint from transfer to sell; shop potion advertises buy action, price and separate usage instruction|Sale, purchase, buyback, item safety and affordability/error flows|
|16:00|Town waypoint, fishing label, NPC/map symbols and next objective|Service activation and subsequent progression|

The useful cross-game distinction is **offer → active progress → reward choice → confirmation → owned result**. These samples reveal several presentations but do not prove the entire transaction chain. Similarly, an item disappearing from one grid could mean transfer, sale or equip; observed pane labels and later ownership evidence must resolve that ambiguity. This reinforces the existing objective/acquisition audit rather than selecting a new quest engine or pet system. Preserve Hearthfall's UI style, town and camera. No numeric values are adopted.

Current cumulative scope: two recordings, 42 sampled frames including three excluded introductions; 25 media assets and 29 atlas entries. Other games/modes have publisher stills but no timestamped early-flow record yet. This is a research checkpoint, not complete timelines or G1.

## C058 — Idleon decisions and away-return presentation [V]

GriffyBit's [guided playthrough](https://www.youtube.com/watch?v=Gkwf75q4NUk), published November1,2025, contributes21 sparse frames through video50:00, including one excluded presenter introduction. The guide is edited and includes presenter overlays and digitally zoomed crops. Its F2P/new-start description does not independently establish account conditions, spending, exact build, uncut play or elapsed time. The source decodes1280×720, scaled in a1920×1080 Chrome viewport; it is not native1080p geometry evidence. Exact notes are in [TIMELINE-FRAMES.json](TIMELINE-FRAMES.json).

| Video offsets | Observed decision context | Evidence boundary |
|---|---|---|
|02:30 /04:00 /05:00|Creation bonuses, level1 town dialogue, then level2 talent current/next effect and budget|Successful creation, point input and comprehension unknown|
|05:45 /08:30|Production distinct from crafting; upgrade rows expose cost/effect and locked-row conditions|Rates, collection, purchase and account-wide ownership untested|
|11:30 /11:45|Cards show collection, enemy details, effect/progress and displayed drop odds|Rates not measured; repeat-tap instruction does not prove equipped state|
|16:00 /17:00 /20:30|Three class comparisons; later Warrior level8 and equipment/stat panes|Exact minimum level and promotion input unknown; contradicts a universal level10 milestone|
|21:00|Away Info activity/hourly estimates, survival and accuracy factors|A forecast, not measured elapsed rewards|
|28:15 /28:30|Storage beside bag with bulk/stack/sort controls; later items disappear from shown bag|Obscured cells and page change prevent conservation or successful transfer claims|
|37:00 /42:50|Another creation sample; later Archer level9 and other avatars|Roster/ownership/party-credit rules unverified|
|43:00 /43:05 /43:15|Return summary says8min with totals/Claim; later acquisition text matches item/card totals and level14 becomes16; later world view|No exact inputs, clock measurement, overflow, replay or durable save verification|
|49:30 /50:00|Two talent presets and explanatory hint; later basic allocations show zero and more available points|Switch/reset mechanism, restrictions and persistence unverified|

**Contradiction retained:** earlier secondary sources IDLE-W1/QUESTS describe a level10 class milestone. A visible level8 Warrior prevents treating that as universal. This is not proof that8 is the minimum or a current2026 rule. The conflicting sources remain registered with their limits; no game progression is changed.

The useful distinction is **estimate → return summary → claim/collection → owned, persisted result**. The footage exposes several presentations, but does not prove every transition. Likewise collection is distinct from equipped contribution, and allocation from assignment. These extend audit questions; they do not select an alt economy, card system, unlock schedule or paid feature. The clean timeline cells remain Q.

Cumulative evidence:163 sources,135 claims,26 media assets,39 atlas entries,three recordings and63 sampled frames, including four excluded introductions. TBH, PoE1/2 and D3 Adventure still need timestamped early-flow coverage; every game needs versioned behavior/error and comparable elapsed-time evidence. No G1 completion, game content change, numerical target or UI redesign.

## C059 — Task Bar Hero setup, investment and crafting [V]

SacrifEyeZ's [day-one recording](https://www.youtube.com/watch?v=xClJxu1QeMg), published June 30, 2026, supplies 26 sparse frames through video 60:30. Its description declares blind/free play, but clean account, spending, exact build, source speed and uncut elapsed play are unverified. The source is 1280×720 at first/final checks, scaled inside a 1920×1080 Chrome viewport; it alternates desktop and zoomed/cropped views. Unrelated background and uncertain red annotations are excluded. [Exact frames](TIMELINE-FRAMES.json) describe each visible state.

| Video offsets | Observed state | Evidence boundary |
|---|---|---|
|00:00 /00:30|Language setup, then six hero labels with three padlocks|No class unlock or actual selection input verified|
|01:00–07:00 sampled|Compact strip, chest/acquisition notices, equip help, bag growth and item restrictions|No clean elapsed first-equip time or inference of confusion|
|10:00 /11:00|Equipped gear; failed-stage/downed view followed later by upright avatar|Penalty, retry and recovery duration unknown|
|15:00 /16:00 /20:00|Skill ranks/budget/ruler and hero level are separate values|Ruler changes at constant character level; no full gate/refund rule|
|20:00 /20:30|Synthesis recipe, level filter, empty grid and stash inclusion; another failed-stage notice|Empty grid is not itself an insufficient-input error|
|21:30 /22:00 /23:00 /40:00|Partial rune graph/costs and explicit Rune prerequisite for a formation slot|No exhaustive topology, exact unlock or account scope|
|30:00|Knight level5, two occupied portraits, Warning banner|Team recruitment/switch and warning consequences unobserved|
|50:00 /50:15 /50:30|Alchemy/stash comparisons; four selected inputs, expected return and later receipt/currency changes|Item identities, safety, formula and save transaction not reconciled|
|60:00|Knight level10, nine visible invested ranks, one available point, ruler9; next row locked|Do not mistake ruler for character level or assert an exact gate|
|60:30|Rare equipped staff compared with Uncommon candidate; separate inherent/decoration information|Equip/synthesis/decoration inputs and rules untested|

The recipe preview is stronger evidence than a blank Cube, but not a completed transaction test. Selected stash inputs coexist with an unchecked inclusion box: that box cannot be interpreted as forbidding every manual stash operation from its label alone. The action hint also changes with Cube context. June footage predates the September lock/chest fixes; neither current protection nor current chest timing is certified.

No new prices, level gates, classes, desktop-strip UI or penalty rules are adopted. Cumulative scope: 164 sources, 141 claims, 27 media assets, 48 atlas entries, four recordings and 89 sampled frames (four earlier introductions excluded). The comparable time matrix remains Q. PoE1/2 and D3 Adventure still lack timestamped early-flow observations; current-build/input/error/durable-state evidence remains incomplete across games.

## C060 — PoE1 pending choices and contextual instructions [V]

DutchSideQuest's [Act1 recording](https://www.youtube.com/watch?v=RlQ_Gi6xg9s), published March3,2026, supplies21 sparse frames through video20:00. Its title/description claims first-ever,blind,unedited play; account history,source speed,recording date and full configuration are unverified. Standard appears during creation; sampled class previews change and do not establish the final class. Stash tabs1–18 do not establish default capacity or entitlement. Source1280×720 is scaled in a1920×1080 Chrome viewport; presenter inset and lower-edge clipping limit observations. [Exact frames](TIMELINE-FRAMES.json).

| Video offsets | Observed state | Boundary |
|---|---|---|
|00:00 /01:00 /03:00|Creation figures,selected class/lore,Standard,name and confirmation control|Final class and actual creation input unknown|
|05:00 /20:00|Equipment/gem requirements and later action-summary tooltip|Historical socket rule; no formula correctness/support recovery proof|
|10:00 /10:15 /10:25 /10:35|Passive graph and effects; explicit unconfirmed allocation with Apply Points/Cancel|Tentative point is not applied stats or saved progress|
|10:45 /11:00 /12:00|Quest/map detail,tracker/banner and town reward contact|No exact objective transition or input timing|
|13:00|Stash,bag,transfer/detail and tab-order help|No entitlement,successful transfer or protection claim|
|14:00 /16:00 /17:00|Service topics and dialogue retain world/tracker|No party-credit or dialogue-comprehension measurement|
|17:30|Five gem choices beside inventory with illustrated socket help|No observed selection/grant; no extra confirmation visible in this frame|
|18:00|Sale input,expected fragment payment,Accept/Cancel|No completed transaction,conservation or persistence proof|

The matching-colour gem instruction predates3.29 (POE-05). Preserve both versions instead of importing a stale constraint. A passive point explicitly labelled unconfirmed is strong evidence of a preview state; a later closed panel cannot prove acceptance. Reward selection is likewise distinct from a later bag gem and equipped action. No support-gem acquisition or invalid-support recovery was observed in these samples; this remains open, not absent from the game.

Cumulative165 sources/146 claims/28 media/55 atlas entries/five recordings/110 samples,including four earlier intro exclusions. Comparable elapsed-time matrix remains unknown. PoE2 and D3 Adventure timestamped early-flow observations remain next; no new gameplay,UI style,town,camera or numerical target follows.

## C061 — PoE2 skill and support decisions [V]

WolfheartFPS's [Act1 Mercenary recording](https://www.youtube.com/watch?v=qN7wlatdCYg) was live-stream published December7,2024. Twenty-two sparse frames between09:00 and80:00 are personally inspected;exact build,account history,source speed/edits and configuration remain unknown. The09:00 chapter labelled gameplay begins still shows creation. Optional store browsing and other interruptions further prevent treating offsets as comparable progression time. [Exact samples](TIMELINE-FRAMES.json).

Chrome viewport1920×1080;initial player metadata1920×1080 but final decoded frame1280×720. The page player is scaled and per-frame source resolution is not established. Presenter covers much of the action bar;chat sometimes overlaps dialogue. A stale2400-second presenter image was excluded before inspecting the decoded gameplay frame. No source files/assets retained.

| Video offsets | Observed state | Boundary |
|---|---|---|
|09:00 /10:00 /11:00|Mercenary/Standard creation,loading tip,zero-budget passive tree with movement cue|No exact creation input,load duration or point spending|
|12:00|Store product/category/cart interface|No purchase,price conversion or monetization proposal|
|14:00–24:00 sampled|Field objectives,target feedback and eventual enter-town instruction|No clean active-play timer or first-skill onset|
|26:00|NPC quest offer with reward icons/Accept Quest|Acceptance and durable credit not observed|
|30:00 /65:00|Vendor skill-granting weapon/price/inspect cues;later bag/gear tooltip|Red price exceeds balance,but no rejected transaction tested|
|35:00 /35:10 /35:20|Gemcutting catalogue then separate skill row/detail with empty support circles|Transition sampled;exact cut/equip action unknown|
|60:00 /70:00|Boss bar/kill objective,then later return-to-NPC objective and ground loot|No rate,kill-credit,ownership or recovery guarantee|
|79:00 /79:15|Support suggestions change by selected skill;tooltips state applicability,attribute cost and benefit/penalty|Recommendations are not enforced compatibility or measured power|
|79:30 /80:00|Named support in grenade row and changed attribute support usage|Visible association,not formula,invalid-state or persistence proof|

The support's written one-copy restriction is historical and removed in0.3 (POE2-01). These pixels also predate0.4 compatibility-hover and0.5.5 before/after gem additions. Preserve those differences;neither game shares the other's socket architecture by inference. The transferable question is whether the current modifier screen makes applicability,benefit,penalty and equipped contribution understandable,within Hearthfall's existing style.

Cumulative166 sources/151 claims/29 media/64 atlas entries/six recordings/132 samples,four earlier introductions excluded. No numerical target,gem/tree system,store or UI restyle adopted. D3 Adventure remains the missing requested mode for this scoped video pass;all comparable time and current-client/error/durable-state gaps remain explicit.

## C062 — seasonal Adventure activities and town services [V]

Filthy Casual's [Season37 recording](https://www.youtube.com/watch?v=rdpXAwMKmRY), published December5,2025, adds20 sparse frames through27:00,including one excluded source transition. The description declares Necromancer/SSF;exact build,account configuration and source speed/edits remain unknown. The opening established70/Paragon1645 character differs from the later level1 character. At01:00 currency is zero;by03:00 it is5.1million gold/475shards. The unsampled grant is not assigned a mechanism from memory. Master later changes to Normal. This cannot supply ordinary new-account pacing. [Exact frames](TIMELINE-FRAMES.json).

Initial decoded1920×1080 later changes to1280×720;Chrome viewport1920×1080 with a scaled player. No native geometry,current-client behavior or continuous viewing is claimed.

| Video offsets | Observed state | Boundary |
|---|---|---|
|00:00 /00:05|Established character,then excluded transition|Not a fresh-account origin|
|00:15 /00:30 /02:00|Cross-act map with bounties;town Altar objective,then waypoint hint|No exact mode-selection/travel/Altar input|
|01:00 /03:00|Empty starting bag/currency,then funded mystery-item vendor|Grant/entitlement and random acquisition untested|
|04:00|Bounty target plus separate enemy count|Not completed reward or party-credit evidence|
|10:00 /11:00 /12:00|Occupied/locked slots;distinct active/rune notices during combat|No clean time-to-level or notice/comprehension metric|
|15:00 /15:15|Level18 skill overview with explicit action/passive locks;later changed action icon|Historical displayed gates,not tested input or current complete table|
|25:00|Jeweler rank/training reward/cost beside inventory|Artisan rank is not character level;transaction untested|
|25:20 /25:25 /25:30|Normal difficulty,physical Altar approach,then unlock banner|Sacrifice,selection and effect not sampled|
|26:00 /26:30 /27:00|Salvage receipt,Cube collection/input,shard weapon categories|No complete consumption/protection/conservation proof|

Campaign's directed return/quest sequence and Adventure's activity map/service loop are now separately observed. Seasonal resources and shortcuts cannot define an ordinary journey. Skill availability,equipped slots,artisan rank,power collection and consumption remain different comparison columns. No new prices,gates,seasonal system,town/camera or UI-style change follows.

Cumulative167 sources/155 claims/30 media/71 atlas entries/seven recordings/152 samples,five source introductions/transitions excluded. All five priority games have scoped historical footage,with D3 modes and PoE games separate. This completes the bounded video pass,not current input/error/durable-state coverage or comparable time cells. Next: owner-readable digests and decision-focused synthesis;G1 remains incomplete.
