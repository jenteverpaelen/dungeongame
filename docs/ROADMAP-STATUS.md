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
| **Build depth: foundation** | ✅ merged: 5 runes per skill, a skill tree per skill, legendaries/sets as data that can target a skill or a kind of skill (tags), new Skills window, set-vs-legendary test in `verify`. ✅ Engine wave 2 merged (procs, defensive powers, ground effects, projectile tricks, monster statuses, Inscriptions). 🔨 Shared items: 19 shared legendaries, 80 item shapes, 55 affixes, set-reduction ring, Kindled/Fabled |
| **Build depth: content design** | ✅ done (`docs/rework/depth/`): per class 12 skills, 60 runes, trees, 14 passives, 5 sets; 122 legendaries, three quarters of them working on a *kind* of skill so players find their own combinations; build tools plan; Kindled/Fabled replace Ancient/Primal; Diablo-copied names replaced |
| **Warrior pilot** | 🔨 the full new Warrior on the foundation (12 skills, runes, trees, passives, sets, legendaries), measured against the set-vs-legendary test |
| **Gear visuals v2** | 🔨 looks come from the item itself (type → shape, level → material/size, rarity → decoration, legendaries unique); weapons escalate strongly; the 0–9 tier ladder goes |
| **Questing rework** | ✅ merged: story / side story / lesson / bounty marks everywhere; tracker under the minimap with up to five quests; contracts replaced by bounty boards (3 per field zone, a cache for all three); quest givers walk to the work site; Investigate no longer opens a window; repairs and 22 visible world changes with a camera pan; lore records in the journal. Not yet: escort/defend objectives, voiced lines |
| **Finishing Codex's partial items** | accounts part 2, save migrations, settings (gamepad, colour-blind, low-spec), stash tabs, AFK rewards, telemetry, security audit, combat spec |

## Next (in this order)

1. **Warrior pilot:** 12 skills, 5 runes each, skill trees, 5 sets, about 36 legendaries. Measured and reviewed before the rest.
2. **Ranger and Mage** to the same level, plus new item shapes and affixes.
3. **Balance and parity pass:** sets vs legendaries, the three classes against each other (warrior is weakest today), levelling pace.
4. **Second wave:** 20 skills per class, 200+ legendaries, support-style modifiers.

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
