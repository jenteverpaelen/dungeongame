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

## Done since the last update (2026-10-11 → 12) ✅

| What | Status |
|---|---|
| **Build depth: engine** | ✅ 5 runes, a tree per skill, tag-keyed legendaries/sets, procs, grounds, statuses, slows, triggers, Inscriptions, class lock, recast guard |
| **Warrior, Ranger, Mage** | ✅ each 12 skills, 60 runes, 72 tree upgrades, 14 passives, 5 sets, 34–35 legendaries (122 legendaries and 15 sets in total, 80 item types, 55 affixes) |
| **Build tools** | ✅ exact tooltips (Alt / Advanced tooltips), damage breakdown, training-dummy bench, 5 loadouts with free respec, `HF1.` build codes in chat |
| **Weapon art** | ✅ 7 maker series for every weapon type with series-specific effects (default); armour in the same style is ready **for your review** (off by default) |
| **Performance** | ✅ HUD no longer repaints every frame, draw calls 120 → 35, orbs on one canvas, crowd crash fixed, Low preset for PCs without a GPU, a verify gate against regressions |
| **Names and town** | ✅ your recommended names, offline rewards parked, town shows your progress |
| **Questing rework** | ✅ (marks per quest type, five-quest tracker, bounty boards, repairs that change the world, lore records). Not yet: escort/defend, voiced lines |
| **Codex's partial items** | ✅ 19 of 28 done (report: `docs/rework/partials/REPORT.md`); the rest need playtests or reviewers |

Overnight report: `docs/rework/REPORT-2026-10-12.md`.

## Balance pass (2026-10-12, daytime) ✅

| What | Result |
|---|---|
| **Shrines** | show their name, what they give and a recharge countdown above them |
| **Early drops** | elites always drop something (every champion pack ≥1 item, rare elites 1 + 40 %), normal monsters 1.5 %, mostly blue with whites/yellows now and then, Legendaries rarer while levelling (`docs/rework/balance/EARLY.md`) |
| **Early danger** | monsters hit harder early, elites ×1.25 / ×1.5, healing stats follow your life, Warrior −30 % damage taken; standing in an elite pack now costs 10–35 % of life on Story, 30–100 % on Normal |
| **Ordeal ladder** | monster life 10 × 1.6 per step (was 16 × 2, Ordeal III ×64 → ×25.6), like Diablo III's Torment curve; a full set with Lantern 700 clears Ordeal II–III (`LADDER.md`) |
| **Build balance** | every class's skills pulled toward each other (dominant skill 1.69–2.16× → 1.27–1.54× except Mage Meteor), Ninefold Gale / Fallen Star / Siegebreaker fitted, Warrior no longer the slowest levelling class (`PARITY.md`) |

## Next (in this order)

1. **Your look at the armour art** (switch it on in Settings → Display).
2. **Your call: a health potion** (none exists; recommended now that monsters can kill, Diablo-style 30 s cooldown).
3. **Endgame** (timed rifts with ranks, leaderboards, bounties) or a **playtest with friends** — your call.
4. **Balance, part 2:** Meteor's set synergy, per-skill set vs legendary gaps (e.g. Skipstone Bolt has no set), Warrior's legendary-only route, levelling speed (10–20 % faster than this morning).
5. **Second wave:** 20 skills per class, 200+ legendaries, support-style modifiers.

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
