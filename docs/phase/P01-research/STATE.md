# P01 research — done, unfinished, next

Updated 2026-10-09 by Codex, solo. Branch: `codex/new-tristram-town`. Read [AGENTS](../../../AGENTS.md), HANDOFF and the [current owner directions](../../CODEX_CHANGELOG.md) before continuing. The town is frozen. UI style stays as it is. Work requiring no new design choice continues autonomously; no question is currently blocking research.

## Done

- [x] Restore fixed 620 u camera and 90 ms follow; remove automatic spell framing and its two feature-only tests. Explain removal and future clipping in C001.
- [x] Local installed-Chrome 1920×1080 mage captures; inspect all four; record exact zoom and verification limits.
- [x] Typecheck, shared tests, simulation, town routes, service/persistence tests and build. Server suite has two known Windows shutdown failures; not a fully green server result.
- [x] Locate Claude's GitHub roadmap and preserve its three original files unchanged.
- [x] Reproduce baseline audit with isolated data; add precise errata rather than silently alter Claude's draft.
- [x] Equal first-pass dossiers for five owner-selected games; additional onboarding literature dossier.
- [x] Source/claim CSVs, version/access gaps, initial comparisons, research option brief, additions/removals log and this status file.

## Research depth and remaining scope

| Charter | State | Next evidence needed |
|---|---|---|
| R-01 D3 | Partial L1/L2; Campaign and Adventure included | Current PC version; both first-session traces; full slots/runes tables for two classes; loot/system/UI detail |
| R-02 Idleon | Primary L1; secondary progression L2 | Versioned early flow; AFK formula/cap; account scope; observed UI |
| R-03 TBH | L1/L2 | Current build; Cube/rune rules; closed-client rewards; first-session UI and economy |
| R-04 PoE1/2 | L1/L2; separated | Current versions; gem acquisition/recovery flows; economy and endgame |
| R-05 D4 | Not started in v2 | Full charter |
| R-06 MapleStory | Not started in v2 | Full charter |
| R-07 Lost Ark | Not started in v2 | Full charter |
| R-08 survivors games | Not started in v2 | Full charter |
| R-09 Last Epoch / Grim Dawn / Infinite | Not started in v2 | Full charter; Infinite is not Torchlight II |
| R-10 case studies | Not started in v2 | Full charter |
| R-11 economy/trading | Not started in v2 | Public primary evidence and policy options |
| R-12 technology/operations | Not started in v2 | Version-specific primary documentation and local constraints |
| R-13 UI/accessibility | Not started in v2 | Guidelines and observed flows; preserve approved style |
| R-14 balance math | Local baseline reproduced; external research not started | Formula verification, source-specific tests and suitable targets |
| R-15 onboarding | One primary study interpreted; partial | Versioned gameplay traces and Hearthfall player observations |
| R-16 legal/privacy/licences | Not started in v2 | Current authoritative sources; not assumptions from old dossiers |
| R-17 platforms | Not started in v2 | Full charter |
| R-18 art pipeline | Not started in v2 | Full charter; no town restyle |
| R-19 audio | Not started in v2 | Full charter; no asset downloads |
| R-20 narrative/quests | Not started in v2 | Full charter |
| R-21 Torchlight II PC (owner addition) | L1/L2 historical/marketing | Final PC skills/respec; first-session footage; loot/UI |

The full P1/G1 package is **not complete**. This is not a claim that all 20 original charters plus R-21 are researched. The timeline and loot matrices and visual UI atlas remain mostly missing. The owner's autonomy instruction removes routine approval pauses, not the need for evidence. No new gameplay progression/economy/content system has been implemented from this packet.

## Next bounded pass

1. Pin the described PC versions for all five games; keep equally scoped questions and time-box inaccessible sources.
2. Obtain inspectable ordinary early-session footage, distinguish account bonuses/mode/patch, and log actual frames/timestamps. D3 needs two modes; PoE needs separate games. Do not count a video description as observation.
3. Complete available skill/rune/slot tables, PC respec rules and first-use UI states; corroborate numerical claims before proposing values.
4. Trace Hearthfall's current onboarding actions and tier behavior in an isolated local session. Keep bot measurements separate from real-player comprehension. Prepare a small reversible objective proposal only if evidence supports it.
5. Continue the remaining charters according to the next design dependency. Update both this file and `docs/CODEX_CHANGELOG.md` with additions, removals, why, impact, evidence, checks and unfinished work.

## Constraints and gaps to carry forward

- No subagents. Never alter protected baseline refs. Check branch before any push. Never commit real saves, `.local` or `.env`.
- Necessary downloads and relevant PC/Chrome access have standing owner permission. Record source/size/hash/purpose/licence; no paid services or account creation implied.
- Browser connector failed before opening public research tabs; local Chrome capture works. No reference-game visual inspection is claimed.
- Long-range spell clipping returns with the explicitly requested original camera. Town load/performance follow-ups remain deferred, not passed.
- Keep earlier town checkpoint and old research as historical evidence, not current instructions when contradicted by the owner's later directions.
