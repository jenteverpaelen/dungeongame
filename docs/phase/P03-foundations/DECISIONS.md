# Foundation decisions — 2026-10-09

Evidence precedes implementation in `REFERENCES.md`; owner authorizes supported autonomous changes and continued work. No phase-complete claim.

| Decision | What / why | Evidence | Scope / rollback |
|---|---|---|---|
| FND-D01 | One verify runner, fresh per-stage saves, retained logs; strict default failure | FND-01/03/04 | Explicit optional known-Windows allowance remains labeled; remove runner to revert, existing commands stay |
| FND-D02 | Debug needs exact ENABLE_DEBUG=1; DISABLE_DEBUG=1 wins | FND-01/02 | Test/capture children opt in; default live commands deny. Revert guard and harness flags together. No account roles claimed |
| FND-D03 | Version 1 save marker, retain legacy normalizer, reject future format before field checks | FND-05/06 | No account/storage migration. Preserve unknown fields and overflow items. Older code tolerates the added marker; no destructive downgrade |
| FND-D04 | Keep an explicit registry of development substitutes | FND-07 | Documentation only; no art/test fixture deletion. Keep useful collision overlay |
| FND-D05 | Keep JSON behind CharacterStore; serialize reads/quarantines with writes, capture behind a barrier | BACKUP-DESIGN, local benchmark, Node24-FS | Single-process ownership only; no account/ID/data migration. Revert store/barrier integration together |
| FND-D06 | Opt-in startup/daily verified bundles; restore into a new destination only, leave partial output marked | BACKUP-DESIGN, roadmap F-SAV-03/04 | No retention deletion or automatic activation; current files stay untouched. Revert scheduling independently; retain restore tooling for existing bundles |

The original roadmap recommends phase branches; the owner's single-branch rule takes precedence. Necessary foundation work can proceed while research continues; this follows the roadmap's decision-independent subset. Larger systems still need concrete design and acceptance evidence.
