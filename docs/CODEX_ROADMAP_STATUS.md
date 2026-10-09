# Codex whole-roadmap status

Updated2026-10-09, solo, through C076. This is my current work ledger, separate from Claude's unchanged [roadmap](design/FULL_GAME_ROADMAP.md). See [execution](EXECUTION.md) for phase dependencies and [change log](CODEX_CHANGELOG.md) for why, evidence, removals, future effects and rollback.

Coverage check:147 feature IDs,86 screen IDs and40 decision IDs, each represented once. These are catalogue counts, not a completion percentage. Original snapshot statuses below are Claude's historical audit at d630a76; they are not silently relabelled as current measurements. A missing newer completion claim means the full item stays open, even where a working baseline already exists.

Current constraints: town frozen; approved UI style and original fixed620/90ms camera retained; one permitted branch; no subagents; isolated test data; no paid services. All P1 research charters remain partial and no phase/release gate is certified complete. Account legacy-ownership information is pending; independent research/foundation work continues.

C055 adds the first [observed reference UI atlas](research/v2/UI-ATLAS.md):23 publisher assets,18 entries and explicit current-version/interaction/timing gaps. These reference observations do not mark any Hearthfall screen implemented or certify a phase.

C056 adds18 historical Campaign frames and the [timeline evidence matrix](research/v2/TIMELINES.md). Existing Paragon and changing difficulty exclude a clean pacing target. The cumulative atlas has24 media assets and23 entries; actual first-account/error/input flows remain open.

C057 adds 24 Torchlight II samples, including three excluded introductions, and six atlas entries. Quest choice, item comparison, separate inventories and contextual vendor hints are observed; hidden transactions and clean timing remain open. Cumulative atlas: 25 assets / 29 entries.

C058 adds21 Idleon guide samples (one intro excluded), ten atlas entries and five visual claims. Allocation, production, collection/equipped contribution, AFK estimate/return and storage/preset context are observed; exact build, inputs, formula, durable outcomes and clean timing remain open. A level8 Warrior contradicts unqualified level10 promotion guidance. Cumulative26 assets/39 entries/three recordings/63 samples. No game or UI change; documentation checks only. Continue TBH/PoE1/PoE2/D3 Adventure footage and independent foundation work.

C059 adds26 Task Bar Hero samples, nine atlas entries and six visual claims. Setup, equipment, stage failure, separate skill investment, Rune prerequisites and Cube selection/preview are observed. Exact build/current protection, input/refund/transaction rules and clean timing remain unverified. Cumulative27 assets/48 entries/four recordings/89 samples; no game or UI change. Continue PoE1/PoE2/D3 Adventure footage, cross-game synthesis and independent foundation work.

C060 adds21 PoE1 Act1 samples,seven atlas entries and five visual claims. Contextual help,pending passive allocation,quest/reward and sale previews are observed. Exact build/final class/account history,actual inputs,support recovery and durable outcomes remain unknown; historical colour rules predate3.29. Cumulative28 media/55 atlas entries/five recordings/110 samples. No game change; continue PoE2/D3 Adventure and cross-game synthesis.

C061 adds22 historical PoE2 frames,nine atlas entries and five visual claims. Skill selection,modifier trade-offs and later support association are separated;old uniqueness text predates0.3. Cumulative29 media/64 entries/six recordings/132 samples. Source resolution changes,presenter obstruction and unknown account/input state limit conclusions. No game changes;continue D3 Adventure,then decision-focused cross-game synthesis.

C062 adds20 seasonal D3 Adventure samples,seven atlas entries and four visual claims. Bounty/activity,slot locks and artisan/Cube states are observed;resource-assisted start,difficulty changes and unknown build limit conclusions. Cumulative30 media/71 entries/seven recordings/152 samples,five introductions/transitions excluded. Bounded priority-game footage pass complete;current/error/durable flows and comparable timelines remain open. Continue per-game digests and decision-focused synthesis.

Update the affected rows when adding or removing content or systems. Reference the new change-log entry and its actual verification. Never mark a whole feature done from a subset test. Keep declined/proposed features visible until there is an explicit decision.

## Features

| ID | Feature | Phase | Original snapshot | Current evidence / remaining work |
|---|---|---|---|---|
| F-ACC-01 | Account registration and login | P3 | MISSING — name is identity | Design, C037 library comparison and C050 [pinned session proposal](phase/P03-foundations/SESSION-CANDIDATE-PROPOSAL.md); upstream licences/advisory query read, archive/integration approval pending. Identity/deployment and implementation open. |
| F-ACC-02 | Sessions, logout, login rate limits, lockout | P3 | MISSING | Partial origin/message boundary (C031/C039); C050 source review defines failure/revocation checks, no live credentials/session/login throttles. [session proposal](phase/P03-foundations/SESSION-CANDIDATE-PROPOSAL.md), [account design](phase/P03-foundations/ACCOUNT-DESIGN.md). |
| F-ACC-03 | Characters owned by accounts, stable IDs, character slots | P3 | MISSING | Not implemented; names remain identity. No real ownership assigned. [account design](phase/P03-foundations/ACCOUNT-DESIGN.md). |
| F-ACC-04 | Character select / create / delete (grace period) / rename | P3 | PARTIAL — class select at login only | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ACC-05 | Account recovery without a paid mail service | P3 | MISSING | Design only; recovery/notification/operational support unresolved. [account design](phase/P03-foundations/ACCOUNT-DESIGN.md). |
| F-ACC-06 | Data export and deletion (GDPR) | P3 | MISSING | C035 [data inventory](phase/P03-foundations/DATA-INVENTORY.md) identifies scope/lifecycle gaps. Ownership, rights workflow, retention and implementation remain open. |
| F-ACC-07 | Migration of existing name-keyed saves to accounts | P3 | MISSING | Not implemented; existing-player population question pending; no live migration. [account design](phase/P03-foundations/ACCOUNT-DESIGN.md). |
| F-SAV-01 | Save schema version + forward migrations | P3 | PARTIAL — load-time normalisation exists; explicit version not found | Current version1 and legacy normalization covered; future-version refusal, C006. New shapes still require migrations. [foundation state](phase/P03-foundations/STATE.md). |
| F-SAV-02 | Golden-save fixtures per version | P3 | MISSING (map fixtures exist, not saves) | Current synthetic legacy/version1/future refusal fixtures checked, C006. No real-save migration evidence. [foundation state](phase/P03-foundations/STATE.md). |
| F-SAV-03 | Backup rotation + tested restore | P3 | MISSING (atomic writes only) | Partial: verified startup/daily backup and restore (C016); two-round3/100/1000-character archive measurements (C048). C054 adds opt-in source-scoped count rotation; manifest/read-only planner/runtime tests pass. Exempt histories, a production count, off-device, logical corruption/power-loss and live-load scope remain open. [rotation report](phase/P03-foundations/BACKUP-ROTATION-REPORT.md); [scale report](phase/P03-foundations/BACKUP-SCALE-REPORT.md). |
| F-SAV-04 | Storage abstraction (JSON → DB per D-31) | P3 | MISSING (direct file calls) | Implemented JSON CharacterStore boundary (C015); database migration not selected. [foundation state](phase/P03-foundations/STATE.md). |
| F-SAV-05 | Idempotent commands (client command IDs, replay safety) | P3/P8 | PARTIAL — commands carry an `id` for replies; replay safety unaudited | Connection receipts tested (C017), enchant interleaving fixed (C022); standalone durable boundary/crash experiments (C038; C065 objective/delivery/reward). Production durable transactions open. [transaction drill](phase/P03-foundations/TRANSACTION-REPORT.md). |
| F-SAV-06 | Transactional multi-entity operations (trade, mail, crafting) | P15 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-CON-01 | Registries with stable IDs + schema validation + `content:check` | P3 | PARTIAL — typed TS data; town has `town:check` | Partial: typed registries, semantic validator and mutation checks (C014/C034/C069); stable signature IDs and finite automatic-cast thresholds enforced. Localization/originality and broader graph validity open. [foundation state](phase/P03-foundations/STATE.md). |
| F-CON-02 | Localization keys for all player-facing text | P3 | MISSING — strings inline | Partial: Settings/controls/ground-quality136 English keys through C052, validation and scoped browser checks. Remaining text and actual languages open. [catalogue origin](phase/P03-foundations/TEXT-CATALOGUE-REPORT.md). |
| F-CON-03 | Name / IP register + originality check | P3 | MISSING | Partial:694-field naming inventory and bounded reference comparison (C033); descriptions/assets/contextual review and originality clearance remain open. [Register](originality/README.md). |
| F-CON-04 | Placeholder registry (label + removal condition) | P3 | MISSING | Implemented current [placeholder register](PLACEHOLDERS.md), C007; new substitutes must be added as introduced. |
| F-CON-05 | Dev hot-reload and data-diff tooling | P5 | PARTIAL — Vite/tsx watch | Open: no newer full-scope completion evidence; original baseline retained. |
| F-CON-06 | Content editors (zone, quest, dialogue) | later | MISSING — D-35 | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SET-01 | Settings panel: audio buses, graphics quality, UI scale | P3 | MISSING — mute/volume exist in the audio bus | Partial: persistent audio controls (C009); graphics quality and UI scale open. [foundation state](phase/P03-foundations/STATE.md). |
| F-SET-02 | Key rebinding + input abstraction layer | P3 | MISSING | Partial: eleven keyboard actions, two bindings and accurate prompts (C024); other input modes open. [foundation state](phase/P03-foundations/STATE.md). |
| F-SET-03 | Accessibility options (colour-safe rarity cues, reduced motion/shake/flash, text size, damage-number options) | P3 | MISSING | Partial: shake/selected-flash, written ground quality and optional combat numbers (C052). Text scale, full motion/contrast/vision and human evaluation open. [combat-number report](phase/P03-foundations/COMBAT-NUMBERS-REPORT.md). |
| F-SET-04 | Per-account settings sync | P3 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SET-05 | Language selection | P3 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-TEL-01 | `npm run verify` (one-command gate) | P3 | MISSING — separate commands | Partial: strict isolated21-stage runner passes (C070); foreground performance budgets remain separate. [Rillwake report](adventure/RILLWAKE-REPORT.md). |
| F-TEL-02 | Bot harness metrics (kills/min, TTK, deaths, XP/h) | P3/P4 | PARTIAL — `server/test/bot.ts`, no metrics | Partial:27 retained-inventory visits and exact reward reconciliation (C027); human pacing and broader parity open. [field calibration](phase/P01-research/FIELD-CALIBRATION-REPORT.md). |
| F-TEL-03 | Drop / economy Monte-Carlo tools | P3 | PARTIAL — `docs/design/baseline-audit.ts` | Partial: reproducible sources/sinks,60 offline cases and15 cost fixtures (C021); live economy and distribution calibration open. [change log](CODEX_CHANGELOG.md). |
| F-TEL-04 | Local event-log schema (privacy-respecting) | P3 | MISSING | C035 inventories current fields; C036 closes the reproduced parser/quarantine source-disclosure path. Event schema/retention/complete diagnostic audit remain open. [Report](phase/P03-foundations/CORRUPT-LOG-REPORT.md). |
| F-TEL-05 | Funnel and session analytics views | P6 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-TEL-06 | Performance-budget checks (client fps, server tick) | P3 | PARTIAL — town PERF scripts | Open: no newer full-scope completion evidence; original baseline retained. |
| F-TEL-07 | Replay / determinism tests for combat | P4 | PARTIAL — movement parity tests only | Partial: repeated build/field gameplay payloads match (C023/C027); not a complete recorded-input combat replay system. [build audit](phase/P01-research/BUILD-REPORT.md); [field calibration](phase/P01-research/FIELD-CALIBRATION-REPORT.md). |
| F-ADM-01 | Debug commands off by default | P3 | **MISSING — on by default** | Default denial retained. C070 owner-requested infinite HP is gated by explicit debug opt-in, respects DISABLE_DEBUG and resets on player recreation; no saved flag. [Rillwake report](adventure/RILLWAKE-REPORT.md). |
| F-ADM-02 | Admin console (ban, mute, kick, announce, restore, grant) | P3 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ADM-03 | Audit log of sensitive actions | P3 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ADM-04 | Chat filter | P10b | PARTIAL — rate limit only | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ADM-05 | Player report queue | P10 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ADM-06 | Feature flags / config | P3 | PARTIAL — environment variables | Open: no newer full-scope completion evidence; original baseline retained. |
| F-CMB-01 | Locked combat spec (auto-cast rules, resources, dash, statuses) | P4 | PARTIAL — `docs/ARCHITECTURE.md` §1.3–1.5 is the working spec | Not locked; current behavior inventoried, no owner parity/feel sign-off or final targets. [build audit](phase/P01-research/BUILD-REPORT.md). |
| F-CMB-02 | Skill unlock cadence redesign | P4 | PARTIAL — cadence exists: L1, 2, 4, 6, 9, 12 | Existing schedule measured; deliberately unchanged pending reference/human evidence. [build audit](phase/P01-research/BUILD-REPORT.md). |
| F-CMB-03 | Passives / talent system | P4/P9 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-CMB-04 | Per-slot auto-cast rule customisation | P4 | MISSING — rules fixed in skill data | Open: no newer full-scope completion evidence; original baseline retained. |
| F-CMB-05 | Optional manual force-cast keys | P4 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-CMB-06 | Respec rules and costs | P4 | PARTIAL — tier reset exists; costs unaudited | Existing free tier reset measured and browser verified; no new fee/rule adopted (C023/C029). [earned decisions](phase/P01-research/FIRST-DECISIONS-REPORT.md). |
| F-CMB-07 | Combat feel pass with accessibility toggles | P4 | PARTIAL — shake, flashes, floating numbers exist | Partial: shake/selected-flash options; no broad feel or medical-safety acceptance (C009/C030). [foundation state](phase/P03-foundations/STATE.md). |
| F-CMB-08 | TTK / survivability targets + class-parity harness | P4 | MISSING | Partial measurement, no locked targets/tolerance or full parity acceptance. [field calibration](phase/P01-research/FIELD-CALIBRATION-REPORT.md). |
| F-CMB-09 | Status-effect review (stun, freeze, chill, burn, bleed, poison, vulnerability) | P4 | PARTIAL — flags and effects exist | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SKL-01 | Skill kit expansion per class | P4/P7 | PARTIAL — 6 per class | Existing18 skills measured; no expansion. [build audit](phase/P01-research/BUILD-REPORT.md). |
| F-SKL-02 | Rune / tier expansion | P11 | PARTIAL — 3 runes, 3 tiers | Existing54 tiers/54 runes audited; selected summary errors corrected (C025), no expansion. [build audit](phase/P01-research/BUILD-REPORT.md). |
| F-SKL-03 | Passives content | P9 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SKL-04 | Class identity pass (signature builds) | P4 | PARTIAL — Whirlwind, Sentries, Meteor `[O]` | Open: no newer full-scope completion evidence; original baseline retained. |
| F-MON-01 | Monster family expansion per zone | P7/P9 | THIN — 10 trash types | Partial C076: Original Reedclaw crab family with articulated rig in three authored placements. Existing families and procedural pools retained; broader per-zone expansion and human balance remain open. [Reedclaw](adventure/REEDCLAW-REPORT.md). |
| F-MON-02 | Behaviour toolkit (telegraphs, charge, summon, shield, enrage) | P4 | PARTIAL — melee, ranged, lob, explode; wind-up flag | Partial C076: Fixed-position lob now resolves on the server with interrupt/death timing and exact cover; original warning/stone VFX. Rig visually inspected; live throw readability and wider toolkit remain open. [Reedclaw](adventure/REEDCLAW-REPORT.md). |
| F-MON-03 | Boss framework (phases, adds, arenas, enrage) | P4 | PARTIAL — Rift Guardians (slam, ring, adds, enrage) | Open: no newer full-scope completion evidence; original baseline retained. |
| F-MON-04 | Elite affix expansion and combos | P7/P9 | PARTIAL — 8 affixes | Open: no newer full-scope completion evidence; original baseline retained. |
| F-MON-05 | Zone events (shrines, pylons, ambushes) | P7 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-MON-06 | Bestiary data | P7/P14 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-QST-01 | Quest data model (objectives, triggers, rewards, prerequisites) | P5 | MISSING | Partial C075: Six live kinds including authoritative dungeon-wave clears; four authored quests. Delivery/rift, broader rewards/repeat/history remain open. [Pumpworks](adventure/PUMPWORKS-REPORT.md). |
| F-QST-02 | Server quest state, party sharing, anti-exploit | P5 | MISSING | Partial C075: Private solo activation and actual-member death accounting, reset/expiry/replay and persistent quest/reward checks. Formal party/repeat policy and cross-restore receipts remain open. [Pumpworks](adventure/PUMPWORKS-REPORT.md). |
| F-QST-03 | NPC dialogue system + UI | P5 | MISSING | Partial C071: Original data-driven branching conversation plus physical offer/inspect/claim panel. Broader condition/action tooling and full localization open. [Connected adventures](adventure/QUEST-CHAIN-REPORT.md). |
| F-QST-04 | Quest tracker HUD + journal panel | P5 | MISSING | Partial C071: Catalogue, selected tracking, completed/available/locked states and reserved reward preview. Filtering, long/many states and lore open. [Connected adventures](adventure/QUEST-CHAIN-REPORT.md). |
| F-QST-05 | World markers: NPC icons, minimap pins, map pins | P5 | PARTIAL — minimap exists, no quest pins | Partial C072: Tracked objective and next physical route are shared across area/minimap; NPC/service and exit markers added. General in-world NPC quest-giver indicators remain open. [World map](adventure/WORLD-MAP-REPORT.md). |
| F-QST-06 | Campaign structure (acts/chapters) + zone gating | P5/P7 | MISSING | Partial C071: A three-quest chain opens Bracken Sluice server-side. Full chapter/act structure remains open. [Connected adventures](adventure/QUEST-CHAIN-REPORT.md). |
| F-QST-07 | Repeatable quests / bounties | P7/P12 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-QST-08 | Lore codex + story presentation (text, camera pan) | P5/P7 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ONB-01 | Character creation v2 (class explainer, appearance) | P6 | PARTIAL — `ClassSelect` | Existing select flow captured; no appearance system or v2 redesign. [earned decisions](phase/P01-research/FIRST-DECISIONS-REPORT.md). |
| F-ONB-02 | First-session script (minutes 0–15) | P6 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ONB-03 | Contextual hint system, progressive disclosure | P6 | MISSING | Partial C073: Eight optional contextual cues with individual dismissal, returning-character opt-out and live key labels. Progressive disclosure and complete hint catalogue remain open. [Guidance](adventure/GUIDANCE-REPORT.md). |
| F-ONB-04 | Tutorial quest chain with scripted first encounters | P6 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ONB-05 | Early loot beats (guaranteed first upgrade) | P6 | MISSING | Partial: C070 guarantees one class-appropriate magic weapon at ledger-recovery level, with preview/full-bag retry. It is not guaranteed better than existing gear; first-session pacing and broader loot beats remain open. [Rillwake report](adventure/RILLWAKE-REPORT.md). |
| F-ONB-06 | Funnel instrumentation + fresh-player test kit | P6 | MISSING | Scripted observations only; no consented unfamiliar-player study/funnel implementation. [earned decisions](phase/P01-research/FIRST-DECISIONS-REPORT.md). |
| F-ONB-07 | Help / FAQ panel v2 | P6 | PARTIAL — controls help panel | Partial C073: Help retains Controls and adds a rereadable Field guide with individual switches. Broader FAQ and human validation remain open. [Guidance](adventure/GUIDANCE-REPORT.md). |
| F-WLD-01 | Zone chain with real level bands and gating | P7 | MISSING — fields use 1–70 and 8–70 | Partial C071: Two connected authored fields with a quest prerequisite. Existing level bands remain; no evidence-backed band retune or full zone chain. [Connected adventures](adventure/QUEST-CHAIN-REPORT.md). |
| F-WLD-02 | Zone authoring pipeline (layout, props, spawns, landmarks) | P7 | PARTIAL — procedural map from seed; town authored as JSON | Partial C071: Two typed authored fields with swept route/prop/spawn checks and shared collision. Production art/editor pipeline remains open. [Connected adventures](adventure/QUEST-CHAIN-REPORT.md). |
| F-WLD-03 | Waypoint network + world map screen | P5 | PARTIAL — waypoint panel, no map | Partial C072: Regional/current-area map, actual waypoint/portal connections, locks and physical travel entry implemented. Fog/discovery and wider network remain open. [World map](adventure/WORLD-MAP-REPORT.md). |
| F-WLD-04 | Objective dungeons | P7/P9 | MISSING | Partial C075: Reedvault Pumpworks: physical entry, two activated chambers plus keeper, maintenance record, return route and optional quest. Human pacing, monster variety, production art/ambience and broader dungeon catalogue remain open. [Pumpworks](adventure/PUMPWORKS-REPORT.md). |
| F-WLD-05 | Ambient life and zone audio | P7 | PARTIAL — rich in town, minimal in fields | Open: no newer full-scope completion evidence; original baseline retained. |
| F-WLD-06 | Town upgrades as systems land | ongoing | PARTIAL — Hearthmere | Frozen by owner; town follow-ups deferred, no complete acceptance claim. [Town pause](town/PAUSED.md). |
| F-WLD-07 | Weather / time of day | — | MISSING (optional) | Open: no newer full-scope completion evidence; original baseline retained. |
| F-WLD-08 | Channel / instance management | P16 | PARTIAL — caps 100/30, `channel` command | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ECO-01 | General vendor (buy / sell / buyback) | P7 (minimal) / P8 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ECO-02 | Gold source/sink audit and tuning | P8 | PARTIAL — sources exist; sinks are Cube ops and gem removal | Audit/calibration only, no retuning (C021/C027). [field calibration](phase/P01-research/FIELD-CALIBRATION-REPORT.md). |
| F-ECO-03 | Repair / durability | P8 | DECISION (D-22) | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ECO-04 | Consumables | P8 | DECISION (D-22) — health globes exist | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ECO-05 | Artisan identities / leveling (Blacksmith, Jeweler, Mystic) | P8/P11 | PARTIAL — NPC-bound services, one Cube-level gate | Existing NPC services preserved; paid enchant transition fixed (C022); separate artisan progression open. [foundation state](phase/P03-foundations/STATE.md). |
| F-ECO-06 | Gamble vendor | P8 | DECISION (D-22) | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ECO-07 | Binding rules and item flags | P8 | PARTIAL — items bind on equip/upgrade | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ECO-08 | Stash expansion / tabs | P8/P14 | PARTIAL — 60 slots per character | Approved60 per-character stash remains; no extra tabs/costs/account sharing. [change log](CODEX_CHANGELOG.md). |
| F-ECO-09 | Currency set design | P8 | PARTIAL — gold + 5 materials + gems | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ECO-10 | Economy dashboards | P8 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ITM-01 | Affix pool expansion / per-slot rules | P11 | PARTIAL — 32 affixes | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ITM-02 | Legendary powers per class and build | P11 | PARTIAL — 19 (13 class-specific) | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ITM-03 | Set catalogue (2/4/6) per class | P9/P11 | PARTIAL — 3 six-piece sets | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ITM-04 | Crafting recipes + materials | P11 | PARTIAL — Cube ops, 5 materials | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ITM-05 | Transmog / appearance slots | P11 | MISSING — look slots exist (9) | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ITM-06 | Gems / socketables expansion | P11 | PARTIAL — 5 gems × 6 ranks | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ITM-07 | Loot filter + auto-pickup / auto-salvage rules | P11 | PARTIAL — `salvageAll` by rarity exists | C053 enforces existing bulk rarity protection with shared client/server rules; all-class/network/browser checks pass. Automatic filtering and pickup remain open. [report](phase/P03-foundations/BULK-SALVAGE-REPORT.md). |
| F-ITM-08 | Item compare, tooltips v2, item links in chat | P11 | PARTIAL — compare and tooltip exist | One earned comparison/equip flow verified (C029); no item links or full v2. [earned decisions](phase/P01-research/FIRST-DECISIONS-REPORT.md). |
| F-ITM-09 | Collection codex (legendaries, sets) | P11 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-ITM-10 | Item-level and base-tier curve review | P11 | PARTIAL | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SOC-01 | Party (invite, leave, kick, leader) + party frames | P10a | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SOC-02 | Friends list + presence | P10a | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SOC-03 | Whispers and chat channels (party, guild, trade/LFG) | P10a | PARTIAL — zone/world/system chat | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SOC-04 | Block / mute / report | P10a | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SOC-05 | Emotes, titles, nameplates | P10a | PARTIAL — nameplates for remote players exist in town | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SOC-06 | Inspect / armory | P10b | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SOC-07 | Guilds / clans | P10b | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SOC-08 | Group finder | P10b | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SOC-09 | Party scaling and loot-rule review | P10b | PARTIAL — +50 % life per extra player, personal loot, shared XP | Open: no newer full-scope completion evidence; original baseline retained. |
| F-SOC-10 | Mail | P15 (if trading) | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-END-01 | Timed rifts with ranks and keystones | P12 | MISSING — rifts have no timer or rank | Open: no newer full-scope completion evidence; original baseline retained. |
| F-END-02 | Bounties (adventure layer) | P12 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-END-03 | Torment gating and rewards | P12 | PARTIAL — 14 tiers, Torment at L60 | Open: no newer full-scope completion evidence; original baseline retained. |
| F-END-04 | Paragon pacing and UI review | P12 | PARTIAL | Open: no newer full-scope completion evidence; original baseline retained. |
| F-END-05 | Server-authoritative leaderboards | P12 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-END-06 | World boss / event | P12 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-END-07 | Set dungeons / challenges | P12 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-END-08 | Primal / ancient chase tuning | P12 | PARTIAL | Open: no newer full-scope completion evidence; original baseline retained. |
| F-END-09 | Final campaign boss + ending | P12 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-MET-01 | Account-wide stash and shared currencies | P14 | MISSING (stash is per character, approved exception) | Not implemented; per-character stash is retained, account ownership prerequisite open. [account design](phase/P03-foundations/ACCOUNT-DESIGN.md). |
| F-MET-02 | Offline / AFK evolution | P14 | PARTIAL — `afk.ts` | Existing AFK formula measured in60 cases (C021); no rewards/cap changes. [change log](CODEX_CHANGELOG.md). |
| F-MET-03 | Account achievements and titles | P14 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-MET-04 | Collections / bestiary | P14 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-MET-05 | Pets / companions as a system | P14 | PARTIAL — Companion skill is a summon, not a pet system | Open: no newer full-scope completion evidence; original baseline retained. |
| F-MET-06 | Character slots + alt bonuses | P14 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-MET-07 | Expeditions / jobs for alts | P14 | MISSING (optional) | Open: no newer full-scope completion evidence; original baseline retained. |
| F-LIV-01 | Season framework | P15 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-LIV-02 | Event scheduler | P15 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-LIV-03 | Season journey / objectives | P15 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-LIV-04 | Secure P2P trade window | P15 | DECISION (D-21) | Open: no newer full-scope completion evidence; original baseline retained. |
| F-LIV-05 | Market / auction | P15 | DECISION (D-21) | Open: no newer full-scope completion evidence; original baseline retained. |
| F-LIV-06 | Patch / hotfix pipeline + version gating | P15 | PARTIAL — `PROTOCOL_VERSION` check | Open: no newer full-scope completion evidence; original baseline retained. |
| F-LIV-07 | Public roadmap and patch notes | P18 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-OPS-01 | Load tests (bot swarm) | P16 | PARTIAL — crowd benchmarks exist | Open: no newer full-scope completion evidence; original baseline retained. |
| F-OPS-02 | Multi-process zone workers / gateway | P16 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-OPS-03 | Observability: metrics, logs, alerts | P16 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-OPS-04 | Backup / restore drills | P3/P16 | MISSING | Partial: actual backup/CLI restore/reconnect drill (C016), archive-size timing/byte conservation (C048); C054 adds opt-in source-scoped count rotation and an actual local plan/restore drill. Exempt histories, off-device, logical corruption/power-loss and live-load scope remain open. [rotation report](phase/P03-foundations/BACKUP-ROTATION-REPORT.md); [scale report](phase/P03-foundations/BACKUP-SCALE-REPORT.md). |
| F-OPS-05 | Security hardening + dependency audit | P16 | PARTIAL — validation and rate limits exist | Partial: debug/replay/origin controls, safe save failures; no accounts, full dependency security audit or independent review. [foundation state](phase/P03-foundations/STATE.md). |
| F-OPS-06 | DDoS / abuse basics | P16 | PARTIAL — connection cap (1000), chat bucket | Open: no newer full-scope completion evidence; original baseline retained. |
| F-OPS-07 | Incident runbooks | P16 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-PLT-01 | Browser matrix + low-spec mode | P17 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-PLT-02 | Localization (languages per D-38) | P17 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-PLT-03 | Privacy policy, terms, consent | P17 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-PLT-04 | Age rating + consumer-law review | P17 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-PLT-05 | Steam wrapper, cloud save, achievements | P17 (R5) | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-PLT-06 | Controller / Steam Deck input | P17 (post R4) | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-PLT-07 | Store assets (original) | P17 | MISSING | Open: no newer full-scope completion evidence; original baseline retained. |
| F-PLT-08 | Project-wide licence + IP/naming audit | P3 → P17 | MISSING — start in P3 | Partial:23 installed production licences individually reviewed (C013); reproducible distribution notices and drift checks added (C044). Build tooling/IP/other-platform review remains open. [Notice report](licenses/NOTICES-REPORT.md). |

## Screens

Existing screens retain the approved style. This catalogue is not the reference-game UI atlas or a claim that every empty/error state has been inspected.

| ID | Screen | Phase | Original snapshot | Current evidence / remaining work |
|---|---|---|---|---|
| U-01 | Title / landing / news | P3, P17 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-02 | Login / register / account | P3 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-03 | Character select (list, slots) | P3 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-04 | Character create (class explainer, appearance) | P6 | PARTIAL — `ClassSelect` | Existing selection captured; C034 preserves signature glyphs with explicit IDs. V2 class explanation/appearance remains open. [signature report](originality/SIGNATURE-REPORT.md). |
| U-05 | Delete / rename / restore dialogs | P3 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-06 | Server / channel status and maintenance banner | P16 | PARTIAL — channel info exists | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-07 | Loading screen with tips | P6 | PARTIAL — `Connecting` | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-08 | Disconnect / reconnect / queue | P16 | PARTIAL — error state | Reconnect/save-error/future-save refusal checked; C042 fixes channel audio and C043 restores returning portraits. Queue/recovery UI remains open. [preview report](phase/P03-foundations/PREVIEW-RETURN.md). |
| U-09 | Patch notes / news | P18 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-10 | Settings: audio | P3 | PARTIAL — buses exist, no UI | Audio controls implemented using existing style; local persistence/reload/reset checked (C009). [foundation state](phase/P03-foundations/STATE.md). |
| U-11 | Settings: graphics / performance | P3 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-12 | Settings: controls and rebinding | P3 | MISSING | Keyboard subset implemented and checked (C024); controller/mouse/chords open. [foundation state](phase/P03-foundations/STATE.md). |
| U-13 | Settings: gameplay (auto-cast prefs, loot filter, damage numbers) | P3/P4 | MISSING | C052 Show combat numbers control added in existing Sound & comfort tab; default on, reconnect/reset and seven inspected frames pass. Other gameplay settings remain open. [report](phase/P03-foundations/COMBAT-NUMBERS-REPORT.md). |
| U-14 | Settings: accessibility | P3 | MISSING | Shake/selected-flash, written ground quality and combat-number controls through C052; broader accessibility scope open. [foundation state](phase/P03-foundations/STATE.md). |
| U-15 | Settings: language, privacy, data export/delete | P3/P17 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-16 | Credits, legal, licences | P17 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-17 | Support / report a bug | P18 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-20 | Health and resource globes | — | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-21 | Skill bar (4 slots, cooldowns) | P4 may extend | EXISTS | Existing bar retained; AUTO cue and live rebinding prompts corrected (C019/C024). [change log](CODEX_CHANGELOG.md). |
| U-22 | Buff / debuff row | — | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-23 | XP bar | — | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-24 | Player plate | — | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-25 | Minimap, zone plate, rift bar | P5 pins | EXISTS | Partial C071: Existing minimap now follows selected multi-zone quest; original style preserved. [Connected adventures](adventure/QUEST-CHAIN-REPORT.md). |
| U-26 | Target frame | — | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-27 | Chat | P10a channels, whispers | EXISTS (zone / world / system) | Existing chat retained; private new-character control cues corrected (C019); social channels open. [change log](CODEX_CHANGELOG.md). |
| U-28 | Notice banners | — | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-29 | Pickup feed | — | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-30 | Floating combat text | P3 options | EXISTS (render layer) | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-31 | Interact prompt | — | EXISTS | Existing prompt uses current binding labels (C024); town behavior retained. [foundation state](phase/P03-foundations/STATE.md). |
| U-32 | Death screen | — | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-33 | Level-up / unlock popups | P6 | PARTIAL — notices | Existing notices retained; optional decorative burst suppression (C030); new unlock presentation open. [foundation state](phase/P03-foundations/STATE.md). |
| U-34 | Party frames | P10a | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-35 | Quest tracker | P5 | MISSING | Partial C071: Selected quest tracker and catalogue integrated; long/many states remain open. [Connected adventures](adventure/QUEST-CHAIN-REPORT.md). |
| U-36 | Boss health bar | P4 | PARTIAL — target frame | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-37 | Ground loot labels / beams | P11 | verify in P11 | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-38 | Objective / compass markers | P5 | MISSING | Partial C072: Current-area/minimap quest marker resolves the next connecting exit or waypoint. On-world compass overlay remains open. [World map](adventure/WORLD-MAP-REPORT.md). |
| U-39 | Emote wheel / quick chat | P10a | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-40 | Performance overlay (fps, ping, dps) | P3 | PARTIAL — values exist in the store | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-41 | Hint toasts | P6 | MISSING | Partial C073: Nonblocking state-triggered hint card implemented, suppressed by open panels/modals; inspected1080p. Broader event coverage and user testing remain open. [Guidance](adventure/GUIDANCE-REPORT.md). |
| U-42 | Help panel | P6 v2 | EXISTS (controls) | Partial C073: Controls plus rereadable Field guide, global/per-character/individual display controls. Existing visual style retained; complete FAQ remains open. [Guidance](adventure/GUIDANCE-REPORT.md). |
| U-43 | Offline-gains report | P14 | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-50 | Inventory (bag grid) | — | EXISTS | Earned gear C029; C053 existing bulk menu, actual service transaction/reconnect and two inspected1080p frames pass. Broader errors/inputs remain open. [bulk report](phase/P03-foundations/BULK-SALVAGE-REPORT.md). |
| U-51 | Paper-doll / equipment | — | EXISTS | Existing wrist-slot equip/stat change verified (C029); no restyle. [earned decisions](phase/P01-research/FIRST-DECISIONS-REPORT.md). |
| U-52 | Character sheet (full stats, breakdown) | P4 | PARTIAL — stats strip | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-53 | Item tooltip + comparison | P11 v2 | EXISTS | One earned tooltip comparison matches actual derived stats (C029); gear-aware skill summaries open. [earned decisions](phase/P01-research/FIRST-DECISIONS-REPORT.md). |
| U-54 | Gems (socket, fuse, remove) | P11 | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-55 | Salvage menu | — | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-56 | Stash | P14 | EXISTS (60 slots) | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-57 | Skills, runes, tiers | P4 | EXISTS | Existing selection/tier/reset checked; specific description mismatches fixed (C025/C029); no expansion. [build audit](phase/P01-research/BUILD-REPORT.md); [earned decisions](phase/P01-research/FIRST-DECISIONS-REPORT.md). |
| U-58 | Passives / talent panel | P4/P9 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-59 | Paragon | P12 review | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-60 | Cube (8 functions) | P11 | EXISTS | Paid enchant choice persists across panel changes; same-ID reforge guard (C022). [foundation state](phase/P03-foundations/STATE.md). |
| U-61 | Transmog / appearance | P11 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-62 | Loot filter editor | P11 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-63 | Collection codex | P11 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-64 | Item-link preview | P11 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-65 | Confirm / destroy dialog | — | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-70 | World map | P5 | MISSING | Partial C075: Regional/current-area maps include the gated Pumpworks hatch and current mechanism. Fog/discovery, multiple floors and wider map acceptance remain open. [Pumpworks](adventure/PUMPWORKS-REPORT.md). |
| U-71 | Waypoint travel | P5 | EXISTS | Partial C072: Map enters existing physical travel and links existing channel panel; lock text shown. No new travel permission. [World map](adventure/WORLD-MAP-REPORT.md). |
| U-72 | Rift obelisk (difficulty, open) | P12 | EXISTS | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-73 | Rift / dungeon end summary | P7 | PARTIAL — notices | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-74 | Dungeon objective tracker | P7/P9 | MISSING | Partial C075: Existing-style current mechanism, active enemies remaining and cleared state implemented; runtime target overrides persistent quest target during replay. Full player comprehension and broader dungeon states remain open. [Pumpworks](adventure/PUMPWORKS-REPORT.md). |
| U-75 | Bounty board | P12 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-76 | Leaderboards | P12 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-77 | Season journey | P15 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-78 | Achievements | P14 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-79 | Bestiary / codex | P14 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-80 | Journal (quests, lore) | P5 | MISSING | Partial C071: Three-quest journal with statuses, objectives and reward preview. Lore/filtering and broader states remain open. [Connected adventures](adventure/QUEST-CHAIN-REPORT.md). |
| U-85 | Dialogue box | P5 | MISSING | Partial C071: Branching NPC conversation with original keyed prose. Wider dialogue conditions/localization remain open. [Connected adventures](adventure/QUEST-CHAIN-REPORT.md). |
| U-86 | Vendor (buy / sell / buyback) | P7/P8 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-87 | Artisan panels (Blacksmith / Jeweler / Mystic as separate identities) | P8/P11 | PARTIAL — Cube panel with artisan state | Existing style/services retained; enchant transition correction (C022); separate artisan progression open. [foundation state](phase/P03-foundations/STATE.md). |
| U-88 | Gamble vendor | P8 | DECISION | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-90 | Respec dialog | P4 | PARTIAL | Existing two-click confirmation/cancel/refund observed (C029); no price redesign. [earned decisions](phase/P01-research/FIRST-DECISIONS-REPORT.md). |
| U-95 | Party window and invites | P10a | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-96 | Friends list | P10a | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-97 | Whisper windows / chat tabs | P10a | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-98 | Block / report dialog | P10a | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-99 | Inspect / armory | P10b | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-100 | Guild window | P10b | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-101 | Group finder | P10b | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-102 | Mail | P15 (if trading) | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-103 | Trade window | P15 (if trading) | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-104 | Market / auction | P15 (if trading) | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-110 | Admin console / dashboard | P3 | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-111 | Moderation queue | P10b | MISSING | No new implementation/acceptance claimed; retain the original baseline and check full states when this scope is taken up. |
| U-112 | Debug panel | P3 | EXISTS — gate behind the dev flag | Server debug defaults off, explicit test opt-in checked (C005); no new account-role admin UI. [foundation state](phase/P03-foundations/STATE.md). |

## Decisions

Claude's proposals remain in the original document. These notes separate current preservation, actual owner instructions, implemented subsets and unresolved choices; they do not adopt every proposal.

| ID | Decision | Current disposition |
|---|---|---|
| D-01 | Audience and session shape | Session-length recommendation remains unadopted; assisted/bot times are not human targets. |
| D-02 | Target journey length: hours to level 70 and to the first legendary | Open: versioned reference timelines and ordinary-player observations still missing; no hours target invented. |
| D-03 | Class count | Current three classes retained; no expansion or permanent release class-count decision. |
| D-04 | Platform order | Browser-first current work retained; no publishing/platform purchase authorized by this ledger. |
| D-05 | Accept the release ladder R1–R5 (§2.3) | Roadmap is being pursued; no release or gate is marked complete by blanket work permission. |
| D-06 | Monetization stance | No payments/credit spend; no monetization implementation selected. |
| D-07 | Naming / IP policy | Original content required; C033 inventories names and rename dependencies. Broader prose/assets/contextual review remains open; no mass ID replacement. |
| D-08 | Control model | Current automatic combat retained; cue corrected, no manual-cast/rule-editor decision. |
| D-09 | Skill slots and unlock cadence | Open: availability/slots/points/time separated; no new gate or slot number selected. |
| D-10 | Build depth | Open: existing behavior audited; no new passive/mastery/tree chosen. |
| D-11 | Defensive / utility actives | Open: current dash retained; no utility-slot expansion. |
| D-12 | Respec | Existing free tier refund preserved and measured; cheap/scaled proposal not adopted. |
| D-13 | PvP | No PvP implemented or selected. |
| D-14 | Level cap and Paragon | Existing70/Paragon retained; no new soft cap. |
| D-15 | Campaign shape: acts, zones, length, tone | C070 chooses one optional flooded woodland/mill route from source patterns and local measurements. No act count or human journey-duration target; town and UI style stay fixed. [Rillwake report](adventure/RILLWAKE-REPORT.md). |
| D-16 | Difficulty gating | Existing difficulty gates retained; no new progression restriction. |
| D-17 | Adventure layer (bounties) | Bounties remain proposed, not shipped. |
| D-18 | Dungeon formats | Existing untimed rifts retained; objective/timed formats require scoped design. |
| D-19 | Seasons | No season/reset cadence selected; no character wipe. |
| D-20 | Binding model | Existing binding behavior retained; no new trade policy. |
| D-21 | Trading | No trade/market implementation or launch approval. |
| D-22 | Durability/repair · consumables · gamble vendor | Repair, consumables and gamble vendor unselected; health globes retained. |
| D-23 | Item pool targets (affixes, legendaries, sets) | No arbitrary pool counts; build diversity and content-cost evidence needed. |
| D-24 | Stash model | Owner approved60 slots per character; retained. Account-wide sharing not adopted. |
| D-25 | Crafting philosophy | Existing physical NPC services plus Cube retained; separate progression not designed. |
| D-26 | Party size and scaling | Party system not implemented; roadmap recommendation is not a current four-person party feature. |
| D-27 | Guild scope | Guild scope unselected. |
| D-28 | Moderation policy and staffing | Moderation policy/staffing unresolved; no automatic messages to other people. |
| D-29 | Capacity targets per release step | No new capacity promise; town100-player requirement remains unaccepted performance work. |
| D-30 | Account credential model | Argon2id candidate measured; design and C037 library fit review written. No dependency selected; integration/deployment/ownership work remains. |
| D-31 | Storage | JSON store boundary implemented; worker SQLite measured as candidate, no migration selected. |
| D-32 | Hosting and budget | No paid services. Local PC testing authorized; public hosting/deployment still not selected. |
| D-33 | Integration branch and release process | Owner override: ONLY codex/new-tristram-town; no phase branches/rebase/protected-ref changes. |
| D-34 | Telemetry and privacy | C035 inventories current data/recipients/lifetimes. Legal bases, retention and rights procedure remain unresolved; no production analytics/third-party tracking added. |
| D-35 | Content tools | C051 authoring experiment informs C070 typed field data and a bounded live quest without a new dependency. Visual editor, general quest scripting and broader schema remain open. [Rillwake report](adventure/RILLWAKE-REPORT.md). |
| D-36 | Art pipeline at scale | Approved town/UI frozen; no new art pipeline or imported assets. |
| D-37 | Audio approach | Procedural audio retained; no downloaded pack or commissioned work. |
| D-38 | Languages | C047 scoped English keys only; remaining text/formatting/languages open. No launch-language decision invented. |
| D-39 | Accessibility baseline | Partial implementation with explicit limits; no full accessibility acceptance. |
| D-40 | Controller and mobile | No controller/mobile build implemented; future priority remains open. |

## Next dependencies

Continue equivalent research questions across D3 Campaign/Adventure, Idleon, Task Bar Hero, PoE1/2 separately and Torchlight II PC. Pin versions and distinguish unlock availability, point sources, equipped capacity, reversal and elapsed time. C056–C062 provide scoped historical reference footage; current input/error/durable flows, clean timing and unfamiliar-player comprehension remain open. C063 supplies six priority-game digests and decision-focused synthesis.

Continue accounts/library/storage/legacy-ownership research and independent foundation gaps, including the naming register and privacy inventory. Do not migrate live characters or attach ownership implicitly. P4 targets require human evidence; P5/P6 reward/tutorial implementation needs a scoped design and state-safety proof. No bulk campaign or economy content is justified by source counts alone.

C063 adds six equally scoped priority-game digests (PoE1/2 separate; both D3 modes explicit), a decision/dependency synthesis and13 versioned caution cases. Existing source/claim/media counts are unchanged; synthesis is not new evidence or G1 approval. Current-coverage notes now reflect the completed bounded footage pass. No game content, system, asset, save, camera, town or UI change. Continue full-catalogue feature comparison, broader digests and a separately designed synthetic objective-state experiment; do not infer new numerical targets. See research/v2/digests/README.md and research/v2/SYNTHESIS.md from the docs root.

C064 adds the full147-feature comparison across seven priority game/mode columns:95 scoped partial-evidence cells and934 unknowns. Every supported cell names its exact subset,claims and unresolved remainder; unknown is not absence. This is catalogue coverage,not feature parity or G1 completion. No game change. Continue broader digests and the separately scoped objective-state experiment; see research/v2/FEATURES.md from the docs root.

C065 completes an isolated objective-state transaction experiment:13 tests cover eight kinds,acquisition versus possession,full-bag retry,pinned definitions and six owned-child crashes during delivery/claim. Online backup reproduces combined state; older restore reinstates old claim eligibility. No live quest,UI,storage migration or reward policy is added. Production identity,event authority,history bounds,party/repeat and recovery remain open. See phase/P01-research/QUEST-STATE-REPORT.md from the docs root; continue broader digests and integration evidence.

C066 adds13 broader-game/economy digests (19 total),six sources and eight scoped claims,including first Immortal/Drakensang incident evidence and a Wolcen date contradiction. Cautions distinguish developer reports,consumer criticism and unverified outcomes. Cumulative173 sources/163 claims;media/atlas unchanged. No game change. WoW/D2R economy digests and broader factual/current-client evidence remain open;continue the whole roadmap.

C067 adds WoW/D2R ownership and migration examples:four sources,eight claims and two digests (21 named games total). All external balance flags remain false;177 sources/171 claims,media unchanged. Existing character stash and runtime remain unchanged. Current trade rules,economic effects,broader matrices,legacy-dossier status and download inventory remain research work; no G1 completion.

C068 reconciles G1 requirements,individually supersedes21 legacy dossiers without changing their bytes,and indexes known historical downloads separately from pending proposals. The147-feature matrix now covers22 game/mode columns with131 partial cells/3103 unknowns. Source/media counts unchanged. Structure is checked; research truth,owner review,current behavior and gate completion are not implied. Continue dependency-specific research and independent supported fixes;see research/v2/G1-AUDIT.md from the docs root.

C069 closes a reproduced authoring-check gap:16 invalid auto-cast numeric fixtures were accepted,now all rejected. Actual Meteor/Whirlwind brain probes demonstrate the risk while unchanged authored data passes. Seven targeted tests,strict probe typecheck and all20 verification stages pass (756server/382simulation). No combat value,runtime behavior,UI,town,camera,save or dependency change. See phase/P03-foundations/AUTO-RULE-VALIDATION-REPORT.md from the docs root;continue researched item protection and other roadmap dependencies.

C070 adds Rillwake Crossing, a playable authored field with an optional investigation/encounter/recovery/reward quest. Exact shared collision, local server-authoritative objectives, fixed encounter sites, journal/tracker/minimap and optional saved progress are integrated. All21 strict stages pass (25 shared/757 server/382 simulation), plus six adventure tests, normal-health all-class bots and inspected local Chrome1080p quest/reconnect checks. Owner-requested infinite HP is debug-only, runtime-only and used only for assisted walkthroughs. First-pass art, human pacing, broader campaign/party/repeat rules and field crowd performance remain open. Town/camera/UI style retained; no existing content deleted. See adventure/RILLWAKE-REPORT.md from the docs root; the whole roadmap remains active.
