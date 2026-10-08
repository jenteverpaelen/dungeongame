# Hearthfall — Full-Game Roadmap

**From a playable, researched prototype to a shippable online action-RPG: order of work, gates, research program, leveling direction, features, UI, combat options, and how to use Codex.**

| | |
|---|---|
| Status | **DRAFT v1 for owner review.** Nothing here is approved until the owner says so. |
| Written | 2026-10-08, by Claude (Sonnet 5.5) |
| Measured against | commit `d630a76` on `codex/new-tristram-town`. The gameplay data files (`shared/src/data/*`, `progression.ts`, `items.ts`, `cube.ts`) are unchanged since baseline `794f77e`. |
| Reproduce every `[M]` number | `npx tsx docs/design/baseline-audit.ts` from the repo root (saved output: `docs/design/baseline-audit.output.txt`) |
| Audience | the owner (they/them) · Codex (the owner calls it "astra 6") · any future agent |
| How big | Large on purpose. Sections are self-contained; §0.4 says what to read when. |

---

## Table of contents

- **0. Read this first** — 60-second version · evidence labels · inherited rules · reading order
- **1. Where the game is today (measured)** — snapshot · pacing tables · gap list · old research vs. code · velocity
- **2. The plan in one page** — ordering principles · phase map · release ladder · what we do *not* build yet
- **3. Working with Codex** — honest capability assessment · capability-fit per phase · work protocol · gates · reporting
- **4. Phase 1 — Research program** — rules · templates · 20 research charters · cross-game matrices · exit gate
- **5. Phase 2 — Design bible & decision register** — 40 owner decisions with options and evidence required
- **6. The leveling direction** — diagnosis · five-movement journey · unlock ladder · pacing-target method
- **7. Implementation phases 3–18** — each with goal, why now, scope, out of scope, acceptance, verification, gate, risks, rollback
- **8. Feature catalogue** — every feature, status, phase
- **9. UI atlas** — every screen, status, phase · HUD rules · UX principles
- **10. Combat depth and alternative ways to fight** — option menu with recommendations
- **11. Content budgets and production pipeline**
- **12. Cross-cutting checklists** — quality · performance · security · legal/IP · accessibility · localization
- **13. Risk register**
- **14. Open questions for the owner (prioritised)**
- **Appendices** — A paste-in prompts for Codex · B glossary & naming policy · C repo map · D dossier audit · E source-hunting guide · F templates

---

## 0. Read this first

### 0.1 The 60-second version

1. **Where we are.** A playable vertical slice: 3 classes, 18 auto-cast skills with runes and tiers, Diablo-3-style loot (ancients, legendaries, a set per class), a Cube with 8 crafting functions, levels 1–70 plus Paragon, 14 difficulty tiers, instanced rifts, multiplayer channels, offline gains, and a newly authored town (Hearthmere) waiting for your review. `[M]`
2. **What is not there yet** (and an MMO needs): accounts — today *anyone who types a character's name logs into that character*; a tutorial; quests; vendors; party/friends/guild/trade; settings and key bindings; a map screen; moderation tools; and most of the content — two flat fields, ten trash monsters for all 70 levels, two bosses. `[M]`
3. **The old research cannot be used as facts.** `docs/research/` holds 21 dossiers written in roughly half a day. Seven contain *no source URL at all*, and the synthesis disagrees with the shipped code in at least 15 places (tick rate, engine, number of rarities, XP, skill unlocks, class resources…). See §1.5. Phase 1 therefore redoes research with the evidence standard Codex already used for the town.
4. **The order** (§2): Evidence → Decisions → Foundations (accounts, saves, content pipeline, settings, tests) → Combat/build lock → Quest engine → Onboarding → Early game → Economy → Mid game → Social → Itemization depth → Endgame → optional modes / meta layer → live-ops → scale and security → platforms → launch operations. Reasons in §2.1.
5. **Leveling direction** (§6). Today the curve is *vertical only*: numbers grow, novelty does not (all six skills by level 12, all runes by level 21, the same monsters at level 1 and level 70). §6 proposes a five-movement journey and an unlock ladder. Level thresholds are placeholders until research and your decisions fix them.
6. **Codex** is strongest at specified, testable systems and at evidence-heavy research; weakest where taste, hearing, or real players are needed. §3 has the matrix and the working rules.
7. **Your decisions** (§5): about a dozen block everything else. The first three: how long the 1→70 journey should take, how many classes, and whether players can trade.
8. **Nothing in this file authorises** a download, a paid service, a monetization feature, or a change to the running game. Every phase starts and ends with an owner gate.

### 0.2 Evidence labels (used on every number and every claim about a game)

| Label | Meaning | May it drive code or balance? |
|---|---|---|
| `[M]` | **Measured**: computed from this repo by a reproducible script, or recorded in a logged experiment | Yes |
| `[O]` | **Owner decision**: stated by the owner in chat, or recorded in `AGENTS.md`, `HANDOFF.md`, `docs/ARCHITECTURE.md` | Yes, until the owner revokes it |
| `[S]` | **Source-verified**: a primary source was read (URL + date recorded in a dossier) | Yes, cite the dossier ID |
| `[D]` | **Dossier claim**: appears in `docs/research/*` and has not been verified | **No.** Hypothesis only |
| `[K]` | **General knowledge**: widely known about a reference game; written from memory here, *not* verified | **No.** Verify in research first |
| `[P]` | **Proposal**: my recommendation, with reasoning | Only after the owner says yes |
| `[Q]` | **Open question / TBD**: nobody has evidence yet | No. Needs research or a decision |

**Rule:** a number without a label is a defect in this document. Please flag it. Where a table cell says `TBD[R-xx]`, the number must come out of research task `R-xx` (§4) or an owner decision (§5) — never from a model's imagination.

### 0.3 Rules inherited from `AGENTS.md` (they do not bend, and every phase restates them in its checklist)

1. **NO AI SLOP** — never invent designs or numbers; ground decisions in real references or measurements; label placeholders; say measured vs inferred vs unverified; if evidence is thin, stop and ask.
2. **Everything that ships is original** (art, names, text, audio). Reference games are references only. Verify every third-party licence individually (EU owner).
3. **No paid services. Every download needs the owner's explicit OK** (name, source, size).
4. **Do not break the working game.** Never commit `server/data/`, `.local/`, `.env`. Use an isolated `DATA_DIR` for every test.
5. **Collision and rules are identical on server and client; the server is authoritative** (services are verified by NPC proximity — Codex's town work already does this).
6. **Verify visually** in a real browser at 1920×1080 and *look* at the screenshots; hidden tabs pause `requestAnimationFrame`, so benchmark honestly.
7. **Stop at owner gates.** `they/them` for the owner. `git commit -F file` on PowerShell 5.1.

Added by this roadmap: **no phase begins before its research inputs exist** (Gate G1), except work labelled *decision-independent* in §2.2.

### 0.4 Reading order

| Reader | Read | Skip until needed |
|---|---|---|
| **Owner** | §0, §1, §2, §5, §6, §14 | §7–§13 (reference material) |
| **Codex, every session** | §0, §3, the section of the phase you are in, §12 | everything else (use `rg "^## |^### "` to jump) |
| **Codex, research phase** | §0, §3.3, §4, Appendix E–F | §7+ |
| **A reviewer** | §1 (check the numbers with the script), §3.1, §13 | — |

---

## 1. Where the game is today (measured)

### 1.1 Snapshot

| Area | Fact | Tag | Where |
|---|---|---|---|
| Stack | TypeScript (strict). Client: PixiJS 8.22 + Preact 10 + Vite 8. Server: Node 24 + `ws` 8 + `msgpackr`. Procedural audio via `zzfx`. Shared rules in `shared/` imported by both sides. | `[M]` | `package.json`, `docs/ARCHITECTURE.md` |
| Simulation | Server-authoritative, **20 Hz** (50 ms tick); client prediction + 110 ms interpolation; interest area 1150×760 units | `[M]` | `shared/src/constants.ts` |
| Controls | WASD + Space dash (230 u in 170 ms, 2.8 s cooldown, 220 ms invulnerability). **Auto-attack and 4 auto-cast skill slots.** | `[M]` `[O]` | `constants.ts`, ARCHITECTURE decision table |
| Classes | 3: Warrior (Fury, melee, range 86), Ranger (Hatred, range 520, sentries), Mage (Arcane Power, range 480, meteors) | `[M]` | `data/classes.ts` |
| Skills | 18 (6 per class), 4 slots; each skill has 3 runes (unlock at skill level +2/+5/+9) and 3 purchasable tiers (2/4/6 skill points). **Last skill unlocks at level 12; last rune at level 21.** | `[M]` | `data/skills.ts` |
| Levels | Cap 70. `xpToNext(L)=round(120·L^2.6+300·L)`. **143,281,639 XP cumulative to reach L70.** 1 skill point per level from L2 (69 at L70). Server XP multiplier defaults to ×3 (dev). | `[M]` | `progression.ts`, `server/src/config.ts` |
| Paragon | After 70. `paragonXpToNext(p)=7.5M·(1+0.04p)`. 16 stats in 4 categories. Points rotate across categories up to P800, then all go to Core. | `[M]` | `progression.ts` |
| Difficulty | 14 tiers: Normal, Hard, Expert, Master (all open from L1) and Torment I–X (open at L60). HP ×1…×8192, damage ×1…×29.7. | `[M]` | `progression.ts` |
| Items | 5 rarities (normal, magic, rare, legendary, set) + Ancient (item level ≥ 70) + Primal. 13 equipment slots, 42 bases, 32 affixes, 19 legendaries (13 class-specific), 3 six-piece sets (one per class), 5 gem types × 6 ranks, 5 materials. | `[M]` | `types.ts`, `data/items.ts` |
| Cube | 8 functions that unlock at Cube level 1–8 (3,995 Cube XP in total): salvage, gem fusion, enchant (Mystic-style), empower +0…+10 (+6 %/tier), transmute, extract power, reforge, add socket | `[M]` | `cube.ts` |
| Loot rules | Personal loot; pity: a legendary is forced after 45 non-legendary item rolls; elite tiers: champion, rare, minion, boss (Rift Guardian), treasure goblin | `[M]` | `items.ts` |
| World | Town **Hearthmere** (96×64 tiles, authored by Codex, in review) with NPC-bound services; 2 open fields (120×90 tiles; level bands 1–70 and 8–70); instanced rifts; channels cap 100 (town) / 30 (field); rift party cap 4 | `[M]` | `data/zones.ts`, `docs/town/FINAL.md` |
| Monsters | 13 total: 10 trash types (5 per theme), 1 treasure goblin, 2 Rift Guardians; 8 elite affixes | `[M]` | `data/monsters.ts` |
| Offline | AFK gains on login if you left in a field: ≤12 h, 25 % of an assumed 60 kills/min | `[M]` | `server/src/afk.ts` |
| Social | 3 chat channels (zone/world/system), rate-limited. **No** party UI, friends, whispers, guild, trade, mail, block/report. | `[M]` | `protocol.ts`, `ui/hud/Feed.tsx` |
| Persistence | One JSON file per character; id = lower-cased name; atomic writes. **No accounts, passwords or tokens.** | `[M]` | `server/src/persistence.ts`, `net/session.ts:271` |
| Debug backdoor | A `debug` command (grant levels, gold, legendaries, full sets) is **enabled by default**; off only if `DISABLE_DEBUG=1` | `[M]` | `server/src/commands.ts:596` |
| UI today | HUD: class select, health/resource globes, 4-slot skill bar + buffs + XP bar, minimap + zone plate + rift bar, target frame, chat, notices, pickup log, death screen, AFK report, interact prompt, help. Panels: inventory (paper-doll, bag, gems, salvage), skills, paragon, cube, stash, waypoint, rift obelisk, debug. | `[M]` | `client/src/ui/**` |
| Audio | 52 procedural sounds committed (+ 8 town sounds in Codex's working tree) | `[M]` | `client/src/audio/bank.ts` |
| Art | Code-drawn vector art (Pixi Graphics) with paper-doll gear; no external assets | `[O]` | `docs/ART_DIRECTION.md` |
| Tests | `npm test` (shared), `npm run test:server` (613 pass / 2 known Windows SIGTERM failures), `npx tsx server/test/sim.ts`, `town:check`, `test:town-services`. **No CI configuration in the repo.** | `[O]` `[M]` | `AGENTS.md`, repo root (no `.github/`) |

### 1.2 The loop a player can run today `[M]`

Pick a class → spawn in Hearthmere → walk/dash while the character auto-attacks and auto-casts → clear packs in a field (packs of 6–14, champion and rare elites, goblins) → loot drops (personal) → equip, compare, salvage → spend skill points on runes/tiers → use the Cube → level to 70 → Paragon → raise difficulty → open rifts at the obelisk → beat the Guardian for guaranteed legendaries. Offline gains fill the time between sessions.

That is a *strong core loop* and a *thin game around it*. Everything between "spawn" and "level 70" has no authored structure: no story, no goals, no teaching, no reason to prefer one zone to another.

### 1.3 Pacing as implemented (all `[M]`, from `baseline-audit.ts`)

**XP and kills per level** (same-level trash monster, difficulty Normal, no bonus XP; "×3" is the server's default dev multiplier):

| Level | XP to next | Trash XP | Kills/level ×1 | Kills/level ×3 |
|---:|---:|---:|---:|---:|
| 1 | 420 | 22 | 19.1 | 6.4 |
| 5 | 9,380 | 195 | 48.1 | 16.0 |
| 10 | 50,773 | 611 | 83.1 | 27.7 |
| 20 | 295,640 | 1,964 | 150.5 | 50.2 |
| 30 | 840,183 | 3,903 | 215.3 | 71.8 |
| 40 | 1,768,051 | 6,359 | 278.0 | 92.7 |
| 50 | 3,151,919 | 9,287 | 339.4 | 113.1 |
| 60 | 5,057,350 | 12,658 | 399.5 | 133.2 |
| 69 | 7,268,211 | 16,051 | 452.8 | 150.9 |

Level 1→70 on same-level trash alone: **16,789 kills at ×1, 5,596 at ×3.** Cumulative XP: L10 = 123,353 · L20 = 1,524,432 · L30 = 6,647,435 · L40 = 18,877,168 · L50 = 42,380,947 · L60 = 82,018,683 · L70 = 143,281,639. One champion kill is worth ×4, a rare ×6, a boss ×40, a goblin ×8 of a trash kill (`ELITE_XP_MULT`).

**Implied hours.** `afk.ts` assumes 60 kills per active minute (25 % efficiency ≙ 15 kills/min offline). *If* that were true, level 70 on trash would take about **4.7 h at ×1 or 1.6 h at ×3**. That kill rate has never been measured in play, so these hours are an `[P]`-grade illustration only; measuring the real rate with the bot harness is task F-TEL-02 in Phase 3.

**Unlock cadence today:**

| System | Unlocked by | Level / amount |
|---|---|---|
| Active skills | character level | 1, 2, 4, 6, 9, 12 (identical cadence for all three classes) |
| Runes (3 per skill) | skill level +2 / +5 / +9 | last rune at **L21** |
| Skill tiers | skill points (2/4/6 per skill) | 69 points at L70 vs. 72 to buy *every* tier of one class's six skills |
| Difficulty Hard/Expert/Master | nothing | open from L1 |
| Torment I–X | character level | L60 |
| Ancient items | item level | ≥ 70 (10 % of legendaries/sets) |
| Primal items | item level and difficulty | ≥ 70 *and* difficulty index ≥ 6 (Torment III); 1 in 400 of legendary rolls |
| Cube functions | **Cube level** (independent of character level) | 1 salvage · 2 fuse · 3 enchant · 4 empower · 5 transmute · 6 extract · 7 reforge · 8 socket |

Cube level 2 needs 60 Cube XP, level 4 needs 565, level 8 needs 3,995. Salvaging grants 2 / 4 / 9 / 30 / 30 Cube XP for normal / magic / rare / legendary / set items — so level 8 is roughly **1,000 magic or 440 rare salvages** if salvage were the only source.

**Loot (Monte-Carlo, 200,000 kills per row, warrior, no Magic Find):**

| Source | Items / kill | Kills per legendary-or-set | Notes |
|---|---:|---:|---|
| Trash, L5, Normal | 0.076 | **454** | pity-dominated (p50 531, max 829) |
| Trash, L70, Normal | 0.076 | 460 | 9.4 % of legendaries are Ancient |
| Trash, L70, Torment IV (index 7) | 0.100 | 265 | |
| Trash, L70, Torment V (index 8) | 0.123 | 177 | Primal appears: 0.18 % of legendaries |
| Trash, L70, Torment V, inside a rift | 0.123 | 136 | |
| Champion (L30, Normal) | 1.50 | 23.7 | |
| Rare elite (L30, Normal) | 2.50 | 14.4 | |
| Rift Guardian (L30) | 6.08 | **1** (2.18 legendaries/kill) | always ≥ 1 legendary |
| Treasure goblin (L30) | 7.00 | 1.2 (1.75/kill) | |

**Reading the numbers:**

1. **Content is exhausted early.** All 18 active skills exist by L12 and all runes by L21; levels 22–70 add *no* new active ability. `[M]`
2. **The world is flat.** Two fields share a 1–70 band; monster level simply follows the nearest player, and the same ten trash types appear from L1 to L70. Players grow, enemies only get bigger. `[M]`
3. **Legendaries are unlocked on day one** (L5 trash already rolls them at ~1 per 455 kills) while Ancient and Primal — the long-term chase — only exist at L70+. There is therefore no "legendary moment" authored into the early or mid game. Whether this is right depends on references (R-01-LOOT), not taste. `[M]` + `[Q]`
4. **Elites, goblins and Guardians supply most legendaries**; trash is a trickle held up by pity. `[M]`
5. **Crafting identity is slow to start**: the Cube's most interesting functions (enchant, empower, transmute) need Cube XP that only grinds in via salvage and fuse. `[M]`
6. **Torment scaling** multiplies monster HP up to ×8192 and damage up to ×29.7. Whether player power can follow is unmeasured. `[Q]` → balance harness (Phase 3/4).

### 1.4 What exists vs. what an online ARPG still needs

| Domain | Today | Status |
|---|---|---|
| Identity & accounts | Name = identity; anyone can open any character by typing its name; no multi-character management, rename, delete or recovery | **MISSING — release blocker** |
| Admin / security | `debug` command open by default; no ban/mute; no admin console; no audit log | **MISSING — release blocker** |
| Onboarding | Controls help panel only | MISSING |
| Quests, story, NPC dialogue | NPCs only open service panels | MISSING |
| Vendors, repair, consumables | None. Gold is spent only on Cube operations and gem removal | MISSING |
| Trade, auction, mail | Not built; items bind when equipped or upgraded `[O]` | MISSING (by design for now) |
| Party, friends, whispers, guild, block/report | Chat only; "party cap 4" is a rift instance capacity | MISSING |
| Settings, key rebinding, accessibility | Audio mute/volume only | MISSING |
| Maps & trackers | Minimap only; no world map, no quest tracker, no achievements/codex | MISSING |
| Content breadth | 1 town · 2 fields · rifts (2 themes) · 13 monsters · 2 bosses | THIN |
| Endgame structure | Rifts + Torment + Paragon exist; no timed rifts, leaderboards, bounties, seasons | THIN |
| Account-level progression | Everything is per character (stash is per-character by an approved exception) | MISSING |
| Localization | Strings are inline in code | MISSING |
| CI / release pipeline | No CI configuration; manual commands | MISSING |
| Telemetry | In-client fps/ping/dps; server console logs | THIN |

### 1.5 The old research versus the shipped game

`docs/research/00-SYNTHESIS.md` (October 4) claims "Research complete; ready for implementation planning" and lists a "Core Numbers (Validated Against Reference Games)" table. Against the code in this repository:

| Topic | The synthesis says | The code says | Verdict |
|---|---|---|---|
| Server tick | 60 Hz "confirmed" | **20 Hz** (`TICK_RATE`) | contradicts `[M]` |
| Client engine | Phaser 4 + Electron | **PixiJS 8** + Preact | contradicts `[M]` |
| Server stack | Colyseus + PostgreSQL + Redis | custom `ws` + msgpackr + JSON files | contradicts `[M]` |
| Rarities | 10-tier system | **5** + Ancient/Primal flags | contradicts `[M]` (the 10 tiers belong to Task Bar Hero, dossier 06) |
| XP to level 70 | "~581.6M total" | **143,281,639** | contradicts `[M]` |
| Skill unlocks | "every 5 levels" | all 6 skills by **L12**, runes by L21 | contradicts `[M]` |
| Skill system | "~200-node skill tree" | no tree; runes + tiers | contradicts `[M]` |
| Visible gear | "6 costume slots, incl. back" | **9** look slots (head, shoulders, chest, hands, legs, feet, waist, main-hand, off-hand); no back | contradicts `[M]` |
| Class resources | Rage 100 / Focus 100 / Ether 120, +10/+8/+6 per auto-attack | Fury 100 · Hatred 125 · Arcane Power 100; generation is per skill (Cleave +5, Hungering Arrow +3) | contradicts `[M]` |
| Class names | Warrior / Ranged / Mage | Warrior / Ranger / Mage | cosmetic |
| Legendary rate | "1 per 30–60 kills" (D3 Loot 2.0) | **1 per ~455 trash kills** at Normal; 14–24 per elite pack | contradicts `[M]` (and the D3 attribution is unverified) |
| Time to level cap | "~40–60 hours solo" | ~1.6–4.7 h *if* 60 kills/min holds | differs ≥ 10× `[M]` + assumption |
| Town / channel capacity | hub 150–200; zones split at 50 | **100** / **30** | contradicts `[M]` |
| Players per zone | 500 + 2,000 mobs | caps 100 / 30 / 4 | aspirational, unmeasured |
| Dungeons | 3 tiers with Common/Rare/Legendary keys | Nephalem-style rifts; no keys | not built |
| Trading | enabled across platforms (gap-03) | "trading not in the prototype; hybrid binding" `[O]` | owner decision wins |
| Revenue | "$1.2M/year at 15k CCU" | — | uncited; irrelevant to engineering |

**How to treat the 21 dossiers:** as *question lists and leads*, never as sources. Anything in them that matters gets re-derived in Phase 1 with a URL, a retrieval date, and a confidence label. Appendix D audits them one by one. Seven (00, 12, 14, gap-03, gap-04, gap-05, gap-06) contain no URL; four more (10, 11, 13, gap-02) contain fewer than ten.

### 1.6 Velocity data points `[M]` (from `git log`)

- **Prototype** (`claude/wizardly-feynman-9hd73d`): 27 commits between 2026-10-04 19:04 UTC (21 dossiers committed in a single commit) and 2026-10-05 09:56 UTC; 138 TypeScript files at the end. Built by several parallel agents (server, art, VFX, HUD, panels).
- **Town** (`codex/new-tristram-town`): handoff at 16:51 → "look slice" at 20:18 (+02:00) on 2026-10-08, i.e. about 3.5 hours for six commits; the branch diff against baseline is 137 files, +21,341 / −38 lines (code, data, docs, checks and screenshots); a completion checkpoint (`docs/town/FINAL.md`) is in the working tree.
- **Reading:** typing speed is not the constraint. Decisions, verification, owner review and real playtests are. Wall-clock time here excludes owner review and is not a forecast — it only shows that a well-specified vertical slice can land in hours, while a wrong turn (the Godot/Tripo detour) cost far more. The gates in this roadmap exist to make a wrong turn cost one phase, not the project.



> **[Part 02 is still being written - see the latest commit on branch docs/mmo-roadmap]**


> **[Part 03 is still being written - see the latest commit on branch docs/mmo-roadmap]**


> **[Part 04 is still being written - see the latest commit on branch docs/mmo-roadmap]**


> **[Part 05 is still being written - see the latest commit on branch docs/mmo-roadmap]**


> **[Part 06 is still being written - see the latest commit on branch docs/mmo-roadmap]**


> **[Part 07 is still being written - see the latest commit on branch docs/mmo-roadmap]**

