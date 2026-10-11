# Quest rework — log (terse: what changed, why, evidence)

- **Q0 — baseline.** Quest server tests on `claude/quests` @a18f848 (isolated DATA_DIR): 62 tests, 59 pass, 3 fail — the
  three stale story-XP tests the balance pass broke on purpose (STORY_XP_SHARE 0.5). Quest-related tests outside
  `npm run verify`: worldQuests, earlyGame, frontier, midgame, workshop (now added to the verify `adventure` stage).
- **Q1 — research + design.** `REFERENCES.md` (R1–R27, labelled [S]/[SN]/[K]; Kaplan GDC 2009, WoW wiki, FFXIV wiki, GW2
  wiki, D3 bounty guide, D4 guides, PoE guide), `DESIGN.md` (categories, tracker, flow, bounties, objective kinds, world
  states, rewards).
- **Q2 — engine.** Shared: `questCategory`, gather/ordered/hold steps (`targets`, `ordered`, `hold`; state `parts`), reward
  pick (`reward.pick`, state `rewardAlt`), world states (`data/worldStates.ts`, `worldStateOn`, `contactSpot`), tracker
  model (`trackerQuests`, `nextStoryQuest`, focus = `trackedQuest`, `questHidden`), bounty boards (`bounties.ts`),
  migration (`questMigration.ts`, called by `normalizeSave`), validators (gather/hold rules, phased contacts present when
  needed, world-state keys, bounty pools, offer ≤ 511 chars, story XP budget = `storyXp(1,50)`). Zone kit: `phase`,
  `appear`, `moveTo`, `board`, `overlay`, `fire`, structure/wheel `spin`; phased contacts are not solid (collision stays
  identical for everyone). Server: `holdStart`/`inspect` with sim-time check, gather/ordered, `focus/unfocus/hide/show`,
  `abandon`, pick on `claim`, bounty credit on authored kills and event clears, `bountyClaim` (loot spilled at the board).
- **Q3 — content.** All quests rewritten (`storyMessages.ts`, `readingMessages.ts`, `bountyMessages.ts`); 26 contracts
  deleted; 9 bounty boards; new contacts (wheel brake, signal fire, Wenna, three weir cogs, haul signal, toll gate, boiler
  damper, three signal flags, west street gate bar, 9 boards); 22 world states with visuals; Hollis and Wenna in CAST.md.
- **Q4 — client.** Category badges over heads (`questBadges.ts`), minimap marks for every tracked objective and bounty
  targets, multi-quest tracker (`questTracker.tsx`), dialogue with category chips, step list, reward preview and pick,
  closing rules; E on an objective object acts without a window (`questActions.ts`) with a reading card and hold bar;
  bounty board window; journal tabs Story / Side stories / Bounties / Recovered records / Bestiary; world phases renderer
  (`worldPhases.ts`) with camera reveal pan and caption (F-QST-08).
- **Q5 — tests.** Stale tests rewritten honestly (story XP budget instead of "reaches level 20/50"; contracts → bounty
  board; Silent Wheel legacy → migration). New: `questMigration.test.ts` with golden `v14-pre-quest-rework.json`,
  ordered-gather test, bounty board test. Quest-related server tests 86/86, shared 54/54.

## Save

No SAVE_VERSION bump. New optional, normalised fields: `questHidden`, `bounties`, quest state `parts` / `rewardAlt`.
`migrateQuests` (idempotent, on load): `rillwake` → `quests.silent_wheel` r2; 14 quests r1 → r2 by step maps (finished
work stays finished; added steps before it count as done; ready stays ready); retired contracts removed, a finished
unclaimed one is paid its old gold; retired tracked quest dropped.

## Town

No bounty board in Hearthmere: boards stand at the field camps (`bounty_board` contact in each of the nine field zones).
