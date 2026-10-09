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
