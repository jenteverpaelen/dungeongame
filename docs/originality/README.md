# Originality review — naming inventory, not clearance

2026-10-09. C033, L44; [plan](PLAN.md) preceded audit. [NAMES.csv](NAMES.csv) inventories694 selected registry fields/components. [name-audit.json](name-audit.json) records counts and hash. No production name, ID, description, art, town, UI style, camera or player save changed.

## Measured inventory

| Group | Definition paths |
|---|---:|
| Classes/resource names/titles |9|
| Skills/runes/tiers |126|
| Item names/base nouns/generated tiers/set pieces/gems |339|
| Item naming components |121|
| Monster/elite names |21|
| Monster naming components |26|
| Authored town names/labels |48|
| Zones |4|

Presence in a registry does not prove visible UI use. Town authoring names are included as candidates. Descriptions, inline UI prose, fonts/images/audio, every generated combination and names already serialized in real saves are outside this inventory.

The three complete Blizzard active-guide pages yielded73 skill labels and365 rune labels; category totals agree with extraction counts. Source URLs and exact/normalized SHA256 digests are retained in [reference-name-hashes.json](reference-name-hashes.json), not a reproduced reference catalogue. Compare only the corresponding class's reviewed labels:

| Local group | Compared | Literal matches | Other |
|---|---:|---:|---:|
| Skills |18|18|0|
| Runes |54|50|4|
| Tiers |54|1|53|

No additional normalized-only matches occurred. Tier matching searches the whole corresponding class list, not an equivalent ability. Nonmatches are **not** certified original. Common words and distinctive names require contextual review; these counts do not establish infringement, permission, authorship or legal clearance. Other groups have `not_compared` status. No reference art/prose is imported into gameplay.

## Rename dependencies established from code

- Saved skill slots/runes/tiers and runtime consumers use IDs. Preserve them during display-text work; global replacement could alter saves and behavior.
- `client/src/ui/hud/ClassSelect.tsx` chooses its signature preview by checking whether free-text class signature contains a skill display name. Renaming text can therefore change an icon/preview even with stable IDs. Make this reference explicit before broad renaming.
- `shared/src/items.ts` derives some text through a skill-name cache, but item generation copies legendary/set names into `Item.name`. Existing item names are serialized in CharacterSave, separately from current definitions.
- Class blurbs/signatures, rune/tier descriptions, set bonuses, item text and test/capture selectors can also name skills. They need an occurrence audit and semantic review, not blind replacement.

No new names or migration selected. Later work should draft names from actual behavior and the original world voice, check consistency/originality, preserve IDs/numeric rules and validate labels plus old/new synthetic items. Town remains frozen. Any deliberate replacement needs a change-log entry and compatibility plan.

## Verification and limits

The audit requires an empty absolute DATA_DIR and leaves it empty. Standalone strict TypeScript check passed. Two final runs used `first` and `second` under `C:\Users\LAPTOP~1\AppData\Local\Temp\hf-names-pair-9181830f6f184a5d935212a20929d02a`, BACKUP_DIR cleared; CSV and report bytes match. Registry payload SHA256: `11f079a9a164d389a7ba7640ea243e9cf83d8d99cc0b64a42724992b99a1e27e`. Report SHA256: `C31304E4631CB858C553292E0DCAFE63D36D98AC083FB950F9E3450EEEC80744`.

An attempted repeat redirected console output into DATA_DIR before startup; the guard correctly rejected it. Final logs sit outside both save directories. A normalization recheck changed zero reference digests. These are audit checks, not game/visual tests; last production regression remains C031. Project-wide originality, other text/assets, distribution notices and legal release acceptance remain open.
