# P10 Social — selected implementation complete, C105

2026-10-10. C102–C105 implement both 10a and 10b for the current character identity system. This completes the selected Social chapter implementation, not G8, authenticated accounts or public-release acceptance. Owner requested this chapter be finished, followed by a Claude Opus 5.5 handoff and a stop.

## Delivered scope

| Roadmap | Working result |
|---|---|
| F-SOC-01 | Four-person parties, consent, leader/kick/leave, frames, 60-second disconnect reservation and succession. |
| F-SOC-02 | Saved friends, mutual-presence consent and hidden status. |
| F-SOC-03 | Zone/world/party/guild/trade/LFG/whisper chat, server audiences, block/mute/privacy and a shared rate budget. |
| F-SOC-04 | Saved personal block/mute and report UI; received-message evidence or explicit allegation, manual owner review. |
| F-SOC-05 | Four original text emotes and four cosmetic titles (one available initially; three earned at existing story milestones), rendered nameplates. No combat effect or new animations promised. |
| F-SOC-06 | Consented online equipped-item inspection using an explicit field allowlist. No offline armory service. |
| F-SOC-07 | One guild per character, invitation consent, 80-member roster, leader/officer/member permissions, transfer/leave/remove, MOTD, guild chat and durable ledger. D-27 minimal scope; no bank/perks. |
| F-SOC-08 | Explicitly published activity directory with paginated discovery and revalidated join. No automatic travel. |
| F-SOC-09 | Actual 1–4-player reward/scaling review, party story-dungeon entry and participant wave credit; existing personal loot/full nearby XP retained. |
| F-ADM-04/05 | Configurable phrase/link rejection, report inbox, local owner mute/ban/lift/resolve/filter commands and audit. No automatic punishment. |
| F-SOC-10 | Mail belongs to conditional P15 trading, explicitly outside P10; not falsely marked implemented. |

Guilds/reports live at DATA_DIR/social/ledger.json, independent of character currency/item snapshots. Atomic flushed replacement precedes success, failures do not publish the draft, and owner actions serialize with guild/report writes. Protocol19; character save13 remains. Report context and chat are cleared when changing/disconnecting characters. Existing per-channel social/party flags remain; leave/decline/report/removal controls remain available when admission is disabled.

The server command queue now holds at most60 commands per session and serializes them through save completion. An intentional next valid mutation waits instead of being refused merely because the previous mutation is saving. Replayed intent still executes once. No gameplay grant/cost formula changed by this transport correction.

## Co-op findings and changes

Before C105, parties existed but story dungeons were keyed by solo character ID, waves scaled for one player, and only their initiator received wave credit. The private key now uses the consenting party ID, retaining individual quest/level/physical entrance checks and Normal story difficulty. Living players inside the authored chamber at activation become its participants. Remaining participants can finish after the initiator leaves; absent/dead/nonparticipants get no wave credit. Nobody remaining or a despawn resets the chamber. Late arrivals join subsequent activations; unfinished instances remain ephemeral across a server restart. Leaving the social party does not forcibly eject a player already admitted to an encounter.

Dormant field monsters also skipped existing life scaling when the discovering player's level/difficulty matched their original values. Initial wake now recalculates untouched mobs. Existing life formula remains +50% per extra nearby player capped at four; it is an inherited local rule, not a newly verified current Diablo balance value. Shared fields retain nearby-player rather than exclusive-party XP/loot eligibility. Existing rifts retain public town-portal admission up to four players; this chapter does not turn them into invitation-only party rifts or retune late-join encounters.

Measured same-level Brineclaw at level4 in Rillwake, actual simulation functions:

| Nearby active fixture players | Monster life after wake | XP per eligible character |
|---|---:|---:|
| 1 | 13 | 411 |
| 2 | 19 | 411 |
| 3 | 25 | 411 |
| 4 | 32 | 411 |

Integer rounding explains small ratio differences. Distant/dead fixtures received no XP. Each rolled ground item remained in its owner's set; a separate17-gold pickup probe could not be collected by another character. Random drop counts vary and are not a drop-rate measurement. This is correctness evidence, not TTK/survival/human balance acceptance. P9's full per-band co-op combat calibration is still a distinct open evidence task; do not relabel this one-family probe as that deliverable.

## Verification and honest limits

- 37 distinct focused checks pass across community6, party6, social6, dungeon7, partyRewards1, commandReplay8 and persistedCommands3. Final changed-ledger/reward subset7/7; the other30 passed in the preceding scoped run. Typecheck and production build pass. Main bundle1305.53kB /423.13kB gzip; existing chunk-size warning remains. No full-suite rerun or crowd/performance claim.
- Initial checks exposed an obsolete expected refusal in the command test (queue now correctly waits); the test retains the disk-write barrier and now asserts two intentional mutations, one execution per retry. Initial scaling fixture used level5 in a level1–4 zone and compared separately rounded life; corrected to the same-level4 case with integer-rounding bounds. These were test assumptions, recorded rather than hidden.
- Two real local Chrome clients, disposable saves: create/invite/accept/promote/MOTD/guild message/report attachment, owner CLI mute and resolve processing, report displayed Reviewed. A party invitation interrupted by reload left no pending invitation; a fresh invite worked. Reloading the joined leader transferred leadership and reconnect restored membership. Manual policy did not punish the reported character automatically.
- Full-page captures GUILD-FINAL-1080.jpg, REPORTS-FULL-1080.jpg, SOCIAL-FINAL-1080.jpg and TITLE-PRIVACY-1080.jpg are1920x1080 and were opened/inspected. Eight-row guild page bottom986px and report page956px; scrollHeight equals clientHeight. Guild Next exposed ninth member. These full-page data fixtures are synthetic roster/report capacity examples, not nine real users. An earlier clipped Social capture was replaced with the full-page image; supplementary REPORT-REVIEWED.jpg remains996x1063 and is not exact1080p evidence.
- Screenshot inspection caught a saved title not refreshing its existing nameplate until reconnect. Scene descriptor updates now recreate the nameplate only when the title changes; existing equipment-only updates retain their behavior. Live selection/removal is checked below the saved title control; no combat bonus added.
- Local CLI execution was exercised against this preview, not real users. No real saves, ordinary chat transcripts, private ledgers or test logs enter Git. Infinite HP is used only by assisted simulation combat fixtures, not enabled for normal characters.

## Policy, exclusions and next work

Owner approved manual review/no automatic punishment and30-day report/evidence retention. Audit entries and processed inbox results expire after30days; active sanctions retain enforcement state until lifted/expired. Expiry requires the running server and runs at startup. [Owner operations](MODERATION.md) documents commands, limits and recovery.

No zone, quest, item or old save was deleted. Removed behaviors are solo-only party admission, initiator-only wave credit/reset, premature publication on failed ledger writes, and expired evidence under the approved policy. Original town/camera/UI materials unchanged. L125/L126 and D063/D064 document scope/research/rollback.

Still open: independent G8 privacy/security review and owner feel/abuse acceptance; P3 account authentication and legacy ownership migration; verified social-ledger backup/restore/off-device policy (existing character backup does not include the nested ledger); large guild/crowd/reconnect load; P9 per-band co-op balance. Guild bank/perks are excluded from selected v1; mail awaits P15 trading. These are not unfinished guild/report buttons disguised as completion. Next implementation chapter is P11 after reading its requirements and current research, with those release dependencies preserved. Stop here for the requested handoff.

Final C105: L127/D065 documents the existing fractureLine schema correction (lob alone requires flightMs/aoe). Content validation8/8 and content:check pass; final type/build pass after live nameplate fix. TITLE-LIVE-1080.jpg inspected at1920x1080. Owner subsequently extended work to P11 before final handoff.
