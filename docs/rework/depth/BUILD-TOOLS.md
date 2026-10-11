# Build tools — what players need to find, test and share builds themselves

**Owner direction (2026-10-11, verbatim):** "i also dont want us to already premake the sets and builds, when people join
and start playing i want them to figure out whats best and then make builds on websites etc like all mmo games have now,
but we just need to give them the ability to do that".

So the game ships **mechanics, numbers and tools**, never recommended builds (the content side of this rule is in
`ITEMS-SHARED.md` §0). This file lists the tools, each with a reference, a short spec, acceptance criteria and a priority:
**M1** = ships with the skills/items depth wave · **M2** = the following wave · **Endgame** = after launch, once there
are players. Evidence labels as in `REFERENCES.md`: [S] read, [SN] search summary, [K] general knowledge, [M] measured
in this repo, [P] proposal.

## 0. What already exists [M]

| Feature | Where | Gap for theorycrafting |
|---|---|---|
| Three town Training Dummies (one elite) that never die | `shared/src/mapgen.ts` (role `dummy`), `damage.ts` (`m.dummy` keeps HP ≥ 1) | no timed test, no per-skill split, no target profiles |
| HUD DPS meter (5 s window) | `client/src/ui/hud/PlayerPlate.tsx` | total only; too short a window for cooldown skills |
| Per-skill damage attribution | `inst.dmgBySkill` in `damage.ts` | used only by the audit scripts, never shown to players |
| Item compare deltas (damage / toughness / recovery %) and ring 1/2 choice | `client/src/ui/panels/tooltip.tsx` via `compareItem` | a sheet estimate: ignores legendary powers and set effects |
| Owned-item chat links with immutable snapshots | P11 F-ITM-08 | no build links |
| Inspection with a privacy setting all / contacts / off (default contacts) | `server/src/social.ts` | in-game only |
| Free tier reset; skills and runes changeable anywhere | BUILD-REPORT §Availability | no loadouts |
| Skill descriptions | `describeSkill` | omit equipment, set, global cooldown/cost reduction (BUILD-REPORT) |

## 1. The tools

### T1 Exact tooltips with an advanced toggle — **M1**
* **Reference.** D4 has two settings, *Advanced Tooltip Info* (shows the percentages and breakdown values) and *Advanced
  Tooltip Compare* (every gained/lost effect in green/red) [SN, Diablo 4 guides]; PoE puts a skill's tags on the first
  line of its tooltip [SN, PoE wiki]; Path of Building shows how every stat was derived [S].
* **Spec.** Skill tooltips show final values after everything (runes, tiers, nodes, legendaries, sets, passives, global
  cooldown and cost reduction): damage per hit/tick, cooldown, cost, radius, duration, counts. The advanced toggle adds a
  bucket breakdown — base coefficient; skill bucket total with each contributor; generic bucket; element; each own-bucket
  multiplier; conditional multipliers with their condition — plus the **tag line** (`ITEMS-SHARED.md` §1). Item tooltips
  show the rolled value and its range (already stored as `min/max` [M]) and which slotted skills an item's tags currently
  touch ("affects: Whirlwind, Ironplough").
* **Acceptance.** For every skill and every legendary in a golden test set, the tooltip number equals the server's
  `expectedDamage` within rounding; changing an item updates all affected tooltips; the tag line matches the data.

### T2 Damage breakdown sheet — **M1**
* **Reference.** Path of Building's per-stat breakdown tab [S]; Grim Dawn's character-sheet DPS covers only the
  left-click skill, a known limitation [SN] to avoid.
* **Spec.** A Character-panel tab listing each slotted skill (and summons) with expected damage per hit and per second
  against three target profiles (trash, elite, boss: armour/resistance as the dummies), its share of total, and the
  multiplier stack from T1. A "pin" lets players compare two gear or skill states side by side (before/after a change).
* **Acceptance.** Sheet DPS agrees with a 60 s training-dummy test (T3) within 10% for non-conditional builds; the sheet
  states which conditional effects it assumed (stunned/frozen/inside ground/standing still).

### T3 Training dummy test bench — **M1**
* **Reference.** D4's town dummies with Normal/Elite/Boss settings [SN]; Grim Dawn players asked for a running total and
  for a dummy that hits back so reactive powers can be tested [SN]; Hearthfall already has the dummies and a per-skill
  damage map [M].
* **Spec.** Interacting with a dummy offers: target profile (trash/elite/boss, with or without a pack of 6), test length
  (30/60/120 s), start/stop/reset; a result card with total, per-skill split (from `dmgBySkill`), crit rate, uptime of
  each buff and condition, and resource starvation time; an optional "sparring" mode where the dummy deals light damage
  so on-hit, low-life and defensive powers fire. Results can be copied as text with the build code (T5).
* **Acceptance.** Two runs of the same build on the same profile differ by < 3% (seeded crits averaged); the per-skill
  split sums to the total; works for summons, damage-over-time and ground effects.

### T4 Respec rules and loadouts — respec **M1**, skill loadouts **M1**, full gear loadouts **M2**
* **Reference.** D3 Armory (patch 2.5.0): a saved build snapshots gear, gems, active/passive skills and Cube powers, but
  not Paragon; items must still be in the bag or stash [SN]. D4 Armory (Season 7): five named loadouts per character,
  saving gear, Paragon board, glyphs and skills; switching is free, only in towns, not in combat [SN]. Respec costs:
  PoE2 charges gold per refunded passive [SN]; Last Epoch charges gold per passive point, scaled by points and level, while
  a mastery choice is permanent [SN]; D4 charged gold before the Armory [SN].
* **Spec [P].** Respec of skills, runes, tiers, nodes and passives stays **free** (as tiers are today [M]) because the
  owner wants experimentation; only the class itself is permanent. Five named loadouts per character, each storing
  primary, slots, runes, tiers, specialization ranks, passives, auto-cast rules, Cube powers and equipment item ids;
  switching only in town, never in combat; missing items are reported and the rest applies. M1 stores everything except
  equipment; M2 adds equipment (needs stash moves).
* **Acceptance.** Switching restores an identical server-side character state (same derived stats hash); invalid or
  locked choices are refused with a message, as the current command validation does [M]; loadouts survive save
  migrations.

### T5 Build codes and links — **M1** in game, **M2** web viewer
* **Reference.** Guild Wars 2 build templates: a chat link `[&…]` holding base64 binary with a header byte for the link
  type, the profession, three specialization+trait bytes and palette ids for skills; pasting it in chat creates a link,
  clicking offers to apply it to a character of the same profession; invalid codes stay plain text [S, GW2 wiki].
  Path of Building shares builds by a share code [S]; Last Epoch Tools by an uploaded link [SN].
* **Spec [P].** `HF1.` + base64url of a small versioned binary: format version, class, level band, primary, 4 slots,
  runes, tiers, 72 rank values (2 bits each), passives, Cube powers, and optionally the ids of equipped legendaries/sets
  (no affix values, no player name). A checksum rejects typos. In chat it renders as a build card; **Apply** offers the
  skill part only (never gear); the Character panel has Copy code / Paste code. The web form is
  `https://<site>/build#HF1.…` (same payload). Ids are stable forever (`NAMES.md`: display names may change, ids never).
* **Acceptance.** Round trip (export → import) is lossless for every valid build; a code from an older format version
  still imports (unknown fields ignored, removed ids reported); a 5-skill full build fits in ≤ 160 characters.

### T6 Opt-in public character API — **Endgame** (design the privacy fields in **M2**)
* **Reference.** PoE's official API uses OAuth 2.1 with scopes for account profile, characters and stashes, requires an
  identifying User-Agent and a non-affiliation notice, and can revoke access [S, pathofexile.com/developer/docs];
  third-party build sites such as poe.ninja read characters whose profiles are public [SN]. Guild Wars 2 lets players
  create API keys with chosen scopes (builds, characters, inventories, …) and delete them at once [S, GW2 wiki]. Diablo
  III's community API exposed hero profiles (equipped items, skills) by battletag and hero id [SN]; World of Warcraft's
  profile API serves equipment and talents, and sites like Raider.IO build on it [SN].
* **Privacy (owner is in the EU).** GDPR Art. 25(2): by default personal data must "not [be] made accessible without
  the individual's intervention to an indefinite number of natural persons" [S, gdpr-info.eu]. So: **off by default**,
  per-character opt-in, revocable at once, scoped to build data (class, level, skills, nodes, passives, equipment with
  affixes) — never email, account id, chat, friends, presence or location; turning it off removes the public record
  within 24 h; the existing inspection default (contacts) stays [M]. A data-retention note and the right-of-access export
  belong to the account system (`docs/rework/ACCOUNTS.md`).
* **Spec [P].** Read-only REST endpoints `/api/v1/characters/{publicId}` (opaque id, not the name), rate-limited, cached,
  JSON matching the data export ids (T7); no write endpoints; the response carries a schema version.
* **Acceptance.** A character with the toggle off returns 404; toggling off purges the cache; a privacy review is
  signed off before launch.

### T7 Static game-data export with stable ids — **M2**
* **Reference.** Riot's Data Dragon: versioned static data (champions, items, runes, images) per patch, a
  `versions.json`, and the version in every URL; ids are the file keys [S]. Grinding Gear Games publishes only its passive
  tree exports officially and points to its APIs for the rest [S]; community tools extract the rest from game files
  (RePoE, PyPoE), which the community itself reports as unmaintained and fragile [SN] — the failure an official export
  avoids.
* **Spec [P].** Generated at build time from `shared/src/data`: `/data/{version}/skills.json` (ids, tags, coefficients,
  runes, tiers, nodes), `passives.json`, `items.json` (bases, affixes, legendaries with template kinds and ranges, sets),
  `tags.json`, `formulas.md` (the bucket order of T1), and locale text files separate from numbers; `versions.json`
  lists every release. A short licence lets fan tools use it (with the non-affiliation notice); art is not included.
* **Acceptance.** Every id in the export exists in the game build of that version; a JSON schema validates each file in
  `npm run verify`; removing an id requires a deprecation entry.

### T8 Machine-readable patch notes — **M2**
* **Reference.** None of the reference games I checked publishes structured patch notes [K]; poe.ninja built its own
  passive-tree version diff (added/removed/changed nodes highlighted) [SN] — players need diffs and currently make them.
* **Spec [P].** Each release writes `changes.json` = the diff of two data exports (added, removed, changed ids with old
  and new values) next to the human notes, which link each line to its ids.
* **Acceptance.** The diff is generated, never hand-written; a release without `changes.json` fails verification.

### T9 Leaderboards with build snapshots — **Endgame**
* **Reference.** D4 Pit-tier races are followed through leaderboards and community analyses of the top builds [SN];
  poe.ninja aggregates ladder characters into build statistics [SN]; D3 leaderboards linked each entry to the hero's gear
  [K].
* **Spec [P].** Per season and class, timed rift (Obelisk) clears; each entry stores the T5 build code at the time of the
  clear; gear and affixes are shown only when that character's public profile (T6) is on, otherwise class, time and
  skills only. Aggregated usage statistics (share of each skill, set, legendary among public entries) are published, never
  per-person data of private profiles.
* **Acceptance.** Entries replay-validate server-side; private profiles never leak gear; statistics count only opted-in
  characters.

## 2. Priorities at a glance

| Tool | Priority | Cost driver | Why now |
|---|---|---|---|
| T1 exact tooltips + advanced toggle | M1 | one shared calculation used by server and client | without it, tags and tag-keyed legendaries cannot be judged |
| T2 damage breakdown sheet | M1 | reuses T1 | lets players compare kits without leaving town |
| T3 dummy test bench | M1 | dummies and `dmgBySkill` already exist | the ground truth players will trust |
| T4 free respec + skill loadouts | M1 (gear loadouts M2) | save fields | experimentation must be cheap |
| T5 build codes | M1 (web viewer M2) | small binary format | sharing builds is the owner's stated goal |
| T7 data export | M2 | build step | lets fan planners exist without scraping |
| T8 machine patch notes | M2 | diff of T7 | free once T7 exists |
| T6 public API (opt-in) | Endgame (fields M2) | privacy review, hosting | needs players and a GDPR review |
| T9 leaderboards | Endgame | rift validation | needs a season |

## 3. Owner-visible risks

* **GDPR:** any public profile or API must be opt-in and revocable (T6); getting this wrong is a legal risk, not a design
  one.
* **"Solved" builds:** tools that compute the best kit (T2/T3 plus fan planners) make the meta converge faster. Parity v2
  (`BUDGET.md` §4) is the counterweight: several main skills per class within 1.25× of the best, no item in every top kit.
* **Data export licence:** decide whether fan tools may be commercial (sites with ads). PoE restricts commercial use of its
  IP [S]; that is the conservative default.
