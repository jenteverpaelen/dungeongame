# Continuation brief for Codex (paste as the first message of the next Codex session)

You are continuing Hearthfall on branch `codex/new-tristram-town`. Since your last commit (`2361a65`) another lead
(Claude) reworked the UI, the town, the quest zones, gear visuals, balance and the login screens on branch
`claude/town-ui-rework`. **Your first action is to merge that branch into yours** (a normal merge commit, no rebase of
pushed history) and re-run `npm run verify`. The owner approved the look of this work; do not revert it.

## What is in the branch (read `docs/rework/LOG.md` first, then the area docs)

| Area | Where | One line |
|---|---|---|
| UI system and every window | `docs/rework/DESIGN.md` (§1 tokens, §7 panel patterns), `client/src/ui/**` | rail + cards, no scrolling windows, icon-first HUD menu bar, interface size setting |
| Town (Hearthmere) | `shared/src/data/town/build.ts`, `client/src/render/art/town*.ts` | authored lakeside harbour; services keep ids and server proximity checks |
| Quest zones | `docs/rework/worlds/*`, `shared/src/zoneKit.ts`, zone plans in `shared/src/data/{rillwake,bracken,pumpworks,frontier,midgame}.ts`, side quests in `shared/src/data/worldQuests.ts`, renderer `client/src/render/art/zone*.ts` | each zone is a short plan turned into `AdventureData` + a visual paint block; ids unchanged |
| Gear visuals | `docs/rework/gear/*`, `shared/src/gearVisual.ts`, `client/src/render/art/gear*.ts` | tier 0-9 derived from item data (no save change), set identities, live effects, rank-up moment; protocol 22 |
| Balance | `docs/rework/BALANCE.md` | kill XP x0.2, story XP x0.5, per-level monster life/damage curves, field drops /6; Master stays open from level 1 |
| Accounts | `docs/rework/ACCOUNTS.md` | server (modes off/optional/required) and the client login/register/recovery screens; off by default |
| Backups | `server/src/backupAux.ts` | accounts + community ledger copied beside character backups |
| Characters | `docs/rework/CAST.md` | cast bible, dialogues, barks |

## Rules that still apply (from `AGENTS.md`, unchanged)

No AI slop (ground numbers in measurements, label guesses); everything shipped is original; nothing paid and every
download needs the owner's OK; never commit `server/data/`, `.local/`, `.env`; isolated `DATA_DIR` for every test;
collision and rules identical on server and client; verify visually at 1920x1080 and look at the screenshots; `git commit -F file`.

## Things to know before you touch anything

1. **`dist/client` is shared.** `npm run build` and `npm run verify` overwrite it; a server that serves it with an older
   protocol will refuse a reload with "out of date" (the client now reloads itself once). Copy it aside or use a
   separate checkout for long-running dev servers.
2. **Gear visuals are derived, never stored.** `gearProfile()`/`itemVisualTier()` read rarity, item level, ancient tier,
   set, legendary power, upgrade and sockets. Do not add a stored visual field; wire changes through `gearVisual.ts`
   and its tests (`shared/test/gearVisual.test.ts`).
3. **Zones are plans.** Add content to the zone's plan file (listed above) as kit regions, roads, vignettes and points of interest; do not hand-place
   scenery in raw `AdventureData` (the kit keeps solids off routes, contacts, portals and packs and the validators prove
   reachability). `scripts/density.ts` measures how full a screen is.
4. **Windows never scroll.** Use `Paged`, columns or sections; the tallest window sets `TALLEST_PANEL` in
   `client/src/ui/panels/index.tsx`.
5. **Balance constants live in two files:** `server/src/sim/tuning.ts` (`LEVEL_TOUGHNESS`, `LEVEL_DAMAGE`,
   `GOBLIN_FIELD_CHANCE`) and `shared/src/{progression,storyBudget,items}.ts` (XP scales, drop factors). Re-tune with
   the commands in `BALANCE.md` §8; do not hand-edit numbers without a measurement.
6. **Known gaps are listed in `docs/rework/REPORT-2026-10-11.md`** (class spread, Torment ladder compressed, human
   survival unverified, gold/vendor prices untouched, zone frame time, dungeon dressing, crowd benchmarks per zone).

## Suggested next work (needs the owner's decision first)

Skill unlock cadence (D-09), rift ladder / timed rifts, an Adventure-mode bounty system on top of the new side quests and
shrines, character delete/rename with a grace period, email-free account recovery review by an independent person
(roadmap F-ACC), and the first real multi-player playtest of the new zones.
