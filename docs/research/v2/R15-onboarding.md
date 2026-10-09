# Onboarding — R-15, initial evidence

Read 2026-10-09. L2 literature interpretation; no Hearthfall player study. Claim UX-01.

Andersen et al., [The Impact of Tutorials on Games of Varying Complexity, CHI 2012](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf), randomly assigned new players to eight tutorial conditions across Foldit, Refraction and Hello Worlds. The study varied tutorial presence, context, restriction of player freedom and on-demand help. Benefits differed by game; blocking interaction did not show a general engagement advantage. The paper discusses unknown demographics, self-selection and tracking limits. [S; UX-CHI12]

This supports testing instruction in context, not declaring that an ARPG tutorial will improve retention by a borrowed percentage. It does not justify removing all help either. These games differ materially from Hearthfall's automatic combat and persistent equipment.

## Proposed observation protocol [P]

Use fresh isolated characters with the current UI. Log first movement, first combat, first pickup, first successful equipment change, first skill/rune change, first service use, wrong attempts and requests for help. Keep real-player observations separate from scripted bots. Ask what action they intend next; elapsed time alone cannot show comprehension. Compare a future minimal contextual objective with the unchanged baseline only after a playable scope is established. Do not silently collect external analytics or personal data.

Completion requires versioned first-session traces for each requested game and a Hearthfall baseline observation. The study alone does not complete R-15. A second attempted paper was blocked by a verification page and is not counted as evidence.

## Local scripted baseline [M], 2026-10-09

[First-session report](../../phase/P01-research/FIRST-SESSION-REPORT.md) and twelve inspected local Chrome frames establish the current class-selection, Help, Skills, inventory and Waypoint flow. A fresh Mage reaches level two and receives Meteor automatically after normal field movement. The primary mouse/LMB cue conflicts with actual automatic combat. No human discovery, retention or first successful gear/rune decision is established. The route helper did not produce a town walk: spawn already equals the Waypoint approach. Keep these limits when choosing a correction.

The later [earned-decision trace](../../phase/P01-research/FIRST-DECISIONS-REPORT.md) closes the scripted equipment/rune/tier/refund/reconnect gap for one fresh Mage, with nine inspected frames. It uses natural rewards and assisted movement; human discovery and reference timelines remain open. It does not retroactively change the earlier baseline.

## C056 — separate source context from progression targets

[D3's first sampled recording](TIMELINES.md) is a new character on an established Paragon100 account with a Normal-to-Hard change. Eighteen historical gameplay frames expose contextual help, dialogue, current/bonus objective state and a waypoint return instruction, plus overlapping level/completion/reward notices. They establish visible presentations, not controlled pacing or comprehension. First-account comparisons for every requested game and ordinary human Hearthfall observations remain open. No tutorial sequence, numeric target or UI redesign is selected from these samples.

C057 adds Torchlight II's contextual level-up tip, visible help preference and later small plus markers, alongside quest and inventory decisions. A tip being shown does not establish it was understood; later markers do not establish points were spent. Its unknown build/start conditions and scaled source inspection remain explicit. Continue ordinary first-account and human Hearthfall observations before selecting a new tutorial or pacing target.
