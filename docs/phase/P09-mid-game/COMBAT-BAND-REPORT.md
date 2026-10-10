# C101 — Mid-game combat and stall report

2026-10-10. L121. scripts/audit-midgame-combat.ts and COMBAT-BAND-MODEL.json retain the reproducible fixture and all297 encounter results. No combat value changed in this checkpoint.

## Method and measured result

Actual20Hz server combat, movement and shared collision; all22 authored encounters across six5-level bands, three classes and three seeded trials. Characters begin at the band's lower bound with a full normal vendor kit and same-level magic starter weapon. The optional earned-set comparison at35+ equips shoulders30/feet35. Both profiles slot their class's set-related skill. No runes, purchased tiers, passives or extracted powers. Fresh cooldowns/resources per pack. These are explicit synthetic builds, not evidence that a player owns or chooses this kit.

Infinite HP follows the owner's testing direction. No survival, death-rate, damage-pressure or dodge-skill conclusion is possible. Unrelated spawns/respawns are disabled in the fixture; geometry, monster AI, skills and damage remain real. The120-second timeout bounds the experiment, not desired fight length.

All297 encounters clear before the timeout: zero stalls. Median pack clear times, seconds:

| Band | Warrior ordinary / set | Ranger ordinary / set | Mage ordinary / set |
|---|---:|---:|---:|
|20–25|10.95 / —|1.90 / —|2.80 / —|
|25–30|11.10 / —|1.45 / —|2.80 / —|
|30–35|12.55 / —|1.90 / —|4.05 / —|
|35–40|9.70 /3.90|1.40 /0.40|3.05 /1.05|
|40–45|11.10 /4.30|1.60 /0.40|2.30 /1.05|
|45–50|12.45 /4.95|2.40 /0.40|3.75 /1.05|

Longest ordinary encounters: warrior52.55s, ranger17.85s, mage20.40s (final dungeon). The set-profile difference combines affix stats and set effects; it does not isolate the two-piece bonus alone. Sub-second ranger pack medians in that profile are a real finding, not proof of a desirable target.

## Neighbour comparisons and XP

Ordinary-profile adjacent median changes: warrior+1%,+13%,−23%,+14%,+12%; ranger−24%,+31%,−26%,+14%,+50%; mage0%,+45%,−25%,−25%,+63%. Encounter composition also changes, especially in the two boss dungeons; these ratios do not isolate level scaling. Claude's acceptance threshold X remains unspecified and is not declared passed.

The model records combat-only XP/hour using the actual XP_MULT=3. This divides earned kill XP by encounter simulation time and excludes travel, dialogue, menus, respawn waits, story awards and deaths. It ranges from13.34M to343.38M in the ordinary profiles; **these are not attainable farming-rate claims**. Large dungeon/field differences and class differences remain visible. C097 separately proves exactly40,856,515 authored XP for20→50 with zero kill contribution, so no grinding is required by the story budget.

## Decision and next work

No blind damage, XP or set nerf follows this small synthetic sample. It establishes clearability and exposes class/gear sensitivity. Human challenge/feel remains for the owner's later playtest; fuller controlled loadouts and survival comparisons belong to combat/balance acceptance. The party2–4 requirement remains open until P10 membership exists; nearby players are not a social party. C101 completes the solo per-band evidence deliverable, not G7 or all roadmap acceptance.

Checks ran on the owner's PC with a new temporary DATA_DIR, backups disabled; no real saves or browser playthrough. This checkpoint adds a script and compact evidence only. No content removed. Rollback can remove the audit artifacts without changing the game; preserve the finding in the log.
