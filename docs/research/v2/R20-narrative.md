# R-20 — Narrative and quests

Read 2026-10-09. No story content implemented yet.

[INK-OVERVIEW](https://www.inklestudios.com/ink/) describes text-first branching content, a live test/editor loop and compiled JSON output. It states MIT availability for its tools. That is evidence for an authoring pattern; no package was downloaded or integrated, and final dependency adoption would need the exact licence.

D4-304's reported quest-state defects supply concrete scenarios: early completion, disconnect, leaving during dialogue and re-entry. They do not prescribe Hearthfall's lore.

POE2-04 adds an action-versus-completion mismatch and repair of previously affected saves. Test the qualifying action and persistent recovery, not only a client completion marker. This is an inferred acceptance requirement, not an implemented quest system.

## Proposed architecture, awaiting fuller design

Author objectives/dialogue as data with stable IDs. The server evaluates progression and rewards; the client presents current state. Replaying dialogue or reconnecting must not duplicate rewards. Branching prose need not imply a branching reward graph. A small declarative format may be enough; compare it with middleware before adding dependencies.

Original writing should follow the game's existing voice: concise action/condition/reward text, distinct NPC motivations, optional lore, no lifted reference-game names or sentences. Validate comprehension and contradictions; do not select word-count limits without observation.

## Charter gaps

C040's [objective comparison and integration map](OBJECTIVES.md) separates qualifying actions, continuity and feedback across all five requested games, with PoE1/2 distinct. Five more primary records/five scoped claims include historical changes and a Runic generation ambiguity. The actual server's kill, pickup, service and rift paths have different eligibility boundaries; the map is a source audit, not runtime evidence or chosen quest policy. No quest content or rewards implemented.

Comparative quest/dialogue UI atlas, observed text lengths/flow, original world premise and content cost, authoring schema, reward idempotency, replay/abandon/party semantics. No copied quest chain or invented retention benefit. Future implementation must preserve town service behavior and approved UI style.

C051 [authoring experiment](../../phase/P01-research/QUEST-AUTHORING-REPORT.md): pinned ink runtime/logic and Yarn3.2 storage reads distinguish presentation, variables, dialogue position and external effects. An isolated typed prototype passes14 checks across three synthetic quests and a branching dialogue. A graph path alone does not guarantee an exit under conditions. No dependency or live quest system is adopted; the bounded model excludes mutable/consumed choices, world availability and durable rewards.
