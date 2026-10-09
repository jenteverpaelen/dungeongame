# Naming register — bounded audit before changes

2026-10-09. L44, owner originality rule, roadmap D-07/F-CON-03 and current registry/save code precede this audit. Research is not a licence to reuse reference assets or prose.

Enumerate candidate display/authoring name/title/noun fields, named arrays and generated-name components from the current typed class/skill/item/monster/zone registries and authored town data. Record each definition path, present text, source file, and comparison scope. Presence in data does not prove a field is visibly rendered. This is an inventory of selected registry fields, not every UI string, description, font, image or audio asset.

For skills, runes and tiers, compare against exact labels in the three corresponding Blizzard active-guide pages. Retain source URLs, extraction counts and SHA256 digests instead of redistributing a full reference catalogue. Report literal equality separately from lowercasing/whitespace normalization. Tier comparisons include all labels in the corresponding reference class, so an overlap does not imply an analogous ability. Never equate non-match with original/cleared or match with infringement. Other registry groups remain unreviewed against external sources.

No runtime rename in this step. Before a later display-text change, preserve IDs and gameplay fields; inventory all descriptions, item/set references and client text that use the old label. Item names are serialized in character saves; definition-only edits do not update old items. Any persisted-name migration needs separate synthetic compatibility/backup/restore tests and a clear original-versus-renamed policy. No mass string replacement, save-ID rewrite or live-save scan.

Validation: empty isolated DATA_DIR remains empty; all definition paths unique; actual registry counts recorded; source label extraction matches published category totals; repeated audit output matches. Scope omissions and unresolved originality review remain visible. No new dependency, downloaded asset, payment, game content deletion or UI/town/camera change. Rollback removes only audit tooling; preserve findings as history if labels later change.
