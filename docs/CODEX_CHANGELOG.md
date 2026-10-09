# Codex research and change log

Maintained by Codex for the owner. Every addition, removal or behavior change records evidence before implementation, scope, expected effect, future consequences, validation and rollback. Distinguish measured [M], source-verified [S], owner decision [O], proposal [P] and unresolved [Q]. Historical entries stay intact; later entries supersede them. No subagents.

## C001 — Restore the original camera (2026-10-09)

**Request/evidence [O/M]:** the owner rejects the 800 u / automatic spell framing update. The previous `d630a76` camera uses a fixed 620 u vertical view, 90 ms follow smoothing, unchanged capped velocity lead and map bounds. See town reference L21.

**Scope:** restore those camera rules and remove the spell-event framing hook, standalone framing module and the two tests that exclusively assert the removed feature. Update the mage browser harness to verify fixed zoom during casts rather than promise full effect visibility. Retain historical test results and screenshots. Town art, layout, collision, services and data stay unchanged.

**Why remove / effect now:** stops automatic pullback and re-centering that the owner found unpleasant; restores the previous character scale and follow feel. The removed tests describe intentionally rejected behavior, not unrelated safety coverage.

**Future effect:** long-range effects can again be clipped by the viewport. Any future camera/accessibility experiment needs a separate explicit owner-approved design; do not silently re-enable this feature. The town's unfinished performance/visual follow-ups are deferred at their request, not declared passed.

**Validation [M]:** typecheck and build pass; all 12 remaining shared tests pass. Installed local Chrome at 1920x1080 reports exactly 620 u during Meteor, Meteor Shower and Frost Nova. All four captures were opened and inspected: original character/UI scale restored, with expected offscreen clipping at long range. Server regression: 730 pass / 2 known Windows shutdown failures; simulation: 382/382; town services: 4/4; authored routes valid. See `docs/town/checks/camera-restored-2026-10-09.md` for commands, evidence and limits. **Rollback:** reapply the camera-specific diff from 11491cf only if the owner requests it. No save migration.

## C002 — Begin Claude's evidence-first roadmap (2026-10-09)

**Request/evidence [O/M]:** owner asks to work from Claude's Markdown plan and prioritizes deep research. `docs/design/FULL_GAME_ROADMAP.md` matches blob b20bc7acef78c12582a8f5cf822665cf78ca7353 from GitHub commit 34461a5 on origin/docs/mmo-roadmap. They confirm researching both PC Campaign and Adventure Mode.

**Scope:** preserve Claude's draft unchanged, reproduce its local baseline measurements, create `docs/research/v2` source/claim registers and bounded dossiers with equal first-batch coverage for D3, Idleon, Task Bar Hero, Path of Exile (1 and 2 distinguished) and Torchlight II. This owner correction supersedes the draft's priority order; Torchlight II is distinct from its Torchlight Infinite charter. Record per-topic depth and missing evidence. Keep the explicit existing town-branch restriction; the draft's suggested new branch does not override it.

**Why / future effect:** replaces unsupported inherited assumptions with traceable inputs for later design choices. This work adds documentation/research only; it does not approve every proposed feature or change progression, economy, saves, authentication or game content. Earlier dossiers remain as historical leads rather than being deleted. Design gates remain pending.

**Validation:** baseline audit reproduced; source bodies and read ranges are registered. Five requested-game dossiers plus the onboarding dossier are present, with 20 sources and 22 claims. Source IDs are unique, every claim resolves to sources, local Markdown links resolve, and all three original Claude files match GitHub. External numbers remain below the evidence threshold for balance; no timed reference playthrough or visual atlas is claimed. [Current done/unfinished/next status](phase/P01-research/STATE.md) is authoritative for continuation. **Rollback:** documentation-only; archive superseded findings with reasons. No external assets/dependencies/downloads added.

## C003 — Correct baseline interpretation without changing gameplay (2026-10-09)

**Evidence [M]:** read the audit implementation and reproduce its output against current shared rules. The draft's 265-kill row uses difficulty index 4 (Torment I), not the prose's Torment IV/index 7. Its `killsPerLegendary` counts gaps between kills with one or more legendary/set items; it does not measure the reciprocal per-item yield. The saved audio count changes only because the existing town checkpoint already added eight sounds.

**Addition / scope:** add `docs/design/ROADMAP_ERRATA.md` beside the unchanged draft, document metric assumptions, and retain original/current audit output. No code/data/balance correction is made because the defects are labels and interpretation, not demonstrated defects in the game's drop rules.

**Effect and future use:** prevents choosing targets from a wrong difficulty or confusing a reward event with the number of items in it. Real-player time-to-70 remains unmeasured. **Validation:** original roadmap blob verified against fetched GitHub; seeded output compared; exact source loop and difficulty table read. **Rollback:** supersede an erratum with new evidence; preserve the original measurement history.


## Standing owner instructions — 2026-10-09

- Make additions/removals autonomously when sufficient research supports them; ask only for unresolved consequential choices. The draft roadmap's routine approval pauses are superseded within this authorized scope. Do not treat uncertainty or silence as an answer.
- Preserve the existing UI style. Keep town content as it stands, apart from the explicitly requested camera rollback.
- Cover D3 (Campaign and Adventure), Idleon, Task Bar Hero, Path of Exile and Torchlight II equally. Distinguish PoE 1/2 and Torchlight II/Infinite.
- Owner gives standing permission for necessary downloads, PC use and relevant Chrome tabs. This supersedes per-download confirmation for this work. Keep a source/size/purpose/licence register; no paid services or account creation are implied.
- Maintain this additions/removals log and a done/unfinished/next status file. Work solo.
