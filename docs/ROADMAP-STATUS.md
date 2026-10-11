# Hearthfall — roadmap status (short version)

Updated 2026-10-11. ✅ done · 🔨 being built right now · 🟡 partly done · ⬜ not started.
Full roadmap: `docs/design/FULL_GAME_ROADMAP.md` (branch `docs/mmo-roadmap`). Codex's detailed ledger: `docs/CODEX_ROADMAP_STATUS.md`.

---

## Where we are in one sentence

A playable online ARPG with a polished town, 12 rebuilt quest zones, a full UI, gear that visibly levels up, accounts,
parties/guilds, and a working loot/crafting loop. **Not yet** a game people can play for weeks: endgame, deep builds,
quest quality, balance with real players and public-server safety are still ahead.

---

## Done

**By Codex** (Oct 4–10, chapters C001–C108):
- ✅ **Foundations:** saves with versions and migrations, verified backups, command replay safety, secure defaults, `npm run verify`
- ✅ **Quest engine:** quest types, journal records, validators that prove every quest can be finished
- ✅ **Onboarding:** first steps, contextual hints, help
- ✅ **Early and mid game content:** 31 quests over Acts I–III, contracts, dungeons, passives (6 per class)
- ✅ **Economy:** merchants, buyback, gold and material costs
- ✅ **Social:** party, friends, whispers, block/mute, guilds, inspect, reports and moderation
- ✅ **Itemization systems:** 33 affixes, 22 legendary powers, 9 sets, recipes, appearances (transmog), collection, loot rules

**By Claude** (Oct 10–11):
- ✅ **UI rework:** every window and the HUD redone in one style, no scrolling windows, world map, journal, dialogue window, Settings with interface size
- ✅ **Town:** Hearthmere rebuilt as a lakeside harbour with residents and life
- ✅ **Worlds:** all 12 quest zones rebuilt and about 2.5× larger, with landmarks, wildlife, shrines, caches, events and side quests
- ✅ **Gear visuals:** items go through 10 visual tiers, there are 9 set looks, and veterans get wings, aura and a light column, plus a rank-up moment
- ✅ **Balance:** much slower levelling, tougher monsters per level, far fewer drops; Master stays open
- ✅ **Accounts:** login, register, recovery codes (off by default)
- ✅ **Fixes:** stale tests, save retries on Windows, a stale browser tab reloads itself, faster minimap

Codex's feature count (147 features): **60 done, 32 partial, 52 open**. The work above moved several from open to done.

---

## Being built right now 🔨

| What | Status |
|---|---|
| **Build depth: engine** | ✅ foundation, engine wave 2 and shared items merged (5 runes, a tree per skill, tag-keyed legendaries/sets, procs, grounds, statuses, 19 shared legendaries, 80 item shapes, 55 affixes, set-reduction ring, Kindled/Fabled). 🔨 Engine wave 3 (slows, front/back defence, low-life and movement triggers, double damage-over-time) |
| **Warrior** | ✅ merged and on the dev link: 12 skills (6 new), 60 runes, skill trees, 5 sets, 32 legendaries. 🔨 last few items that needed engine wave 3 |
| **Ranger** | 🔨 same treatment, starting with the bible's fixes for build variety |
| **Mage** | 🔨 same treatment |
| **Weapon art** | ✅ gear visuals v2 merged (looks come from the item, tier ladder removed, hold poses and attack effects). 🔨 New art direction approved by you: one maker series per level band; now adding much stronger series-specific effects, then the other 8 weapon types; armour after |
| **Names and town** | 🔨 your recommended names (Ordeal difficulty, Lantern Ranks, Glass Reliquary, Faultline, Glasswright, Mending Orb), offline rewards parked, town shows the new systems |
| **Questing rework** | ✅ merged (marks per quest type, five-quest tracker, bounty boards, repairs that change the world, lore records). Not yet: escort/defend, voiced lines |
| **Codex's partial items** | ✅ 19 of 28 done (report: `docs/rework/partials/REPORT.md`); the rest need playtests or reviewers |

## Next (in this order)

1. **Balance and parity pass** after all three classes: shared legendaries are now a bit too strong, some 6-piece sets too weak, and the difficulty (Torment/Ordeal) ladder must be re-fitted because endgame set power dropped from up to ×255 to about ×25.
2. **Build tools** (exact tooltips, damage breakdown, training dummy, loadouts, build codes): `docs/rework/depth/BUILD-TOOLS.md`.
3. **Second wave:** 20 skills per class, 200+ legendaries, support-style modifiers.

---

## The big ones still ahead

| Big item | Why it matters | Status |
|---|---|---|
| **Endgame** (timed rifts with ranks, leaderboards, bounties, Torment tiers that are reachable, Paragon pacing, final boss and ending) | what players do after level 70 | ⬜ |
| **Real playtests with people** | all balance so far comes from bots | ⬜ |
| **Combat feel and class balance lock** | warrior is weakest, and the Torment ladder is compressed | 🟡 |
| **Security review and hosting** | independent review of accounts; a real server; load tests | ⬜ |
| **Accounts, part 2** | email-free recovery review, account deletion and data export (GDPR), sessions that survive restarts | 🟡 |
| **Endgame side modes** (boss rush, challenge rifts and the like) | variety at 70 | ⬜ |
| **Seasons and live events, trading (if you want it)** | long-term retention | ⬜ |
| **Legal and launch** (privacy policy, EU rules, languages, store pages) | needed before going public | ⬜ |
| **The two open farming fields** (Whispering Glade, Ashen Hollow) | still the old generated look | ⬜ |
| **Audio pass** | procedural placeholder sounds only | ⬜ |
| **More classes** | planned only after the open beta | ⬜ |

## Release ladder

**R1 friends alpha** (close: needs quests rework, onboarding check, security review) → **R2 closed alpha** (needs build depth + endgame v1)
→ **R3 open beta** (needs scale/security, live-ops) → **R4 launch** → **R5 Steam**.

---

## Your decisions waiting (short)

- Gear tier names and hint wording, and whether transmog may hide the gear tier
- Other players' gear effects in crowded towns: full or reduced
- Trading between players: yes or no
- How long levelling to 70 should take for a normal player
- What comes after build depth: endgame first, or a playtest with friends first

**Decided 2026-10-11 (you left it to me):** no ready-made builds; players get building blocks and tools to work out and
share builds themselves (exact tooltips, damage breakdown, training dummy, build codes, opt-in public build data for fan
sites). Skill-tree points are a separate pool; Primal sets get no extra multiplier; the Ninefold Gale, Lantern Garden and
Frost Nova changes go ahead.
