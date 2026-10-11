# Quest rework — references (2026-10-11)

Labels: **[S]** read on the page (fetched); **[SN]** search-result snippet only (page not read: bot-blocked or not
fetched); **[K]** general knowledge, unverified here. Patterns are taken, never names, text or art.

## 1. Sources and what they say

| # | Source | Claim | Label |
|---|---|---|---|
| R1 | Game Developer, *GDC: Learning From World of Warcraft's Quest Design Mistakes* (Kaplan, GDC 2009) | Quest text was capped at 511 characters, "nobody wants to read it"; quest givers must be easy to find (floating "!"); progress shown in the log *and* on screen; chains of "4 kills then 4 collections" are poor flow; quest hubs "lit up like a Christmas tree" remove the designer's control; early quests sent players too far, refined into "breadcrumbing"; XP and gold are "absolutely the most important" rewards | [S] |
| R2 | Engadget, *Kaplan on being the Cruise Director of Azeroth* (GDC 2009) | Quest log: goals and objectives first, story for those who want it, immediate feedback on progress; Wrath limited how many quests are offered at once (Christmas-tree effect); mystery belongs in gameplay, never in "what do I do next"; long trips to distant zones frustrated players; collection quests need a story reason and fair drop rates (progressive drop removes bad streaks); avoid clustering kill and collect quests | [S] |
| R3 | warcraft.wiki.gg, *Quest* | Gold "!" available, gold "?" ready; **blue "!"/"?" = repeatable or daily**; a **campaign "flag"** marker separates main-story quests from optional ones; orange = legendary chain; quest log holds **up to 35** quests | [S] |
| R4 | Wowhead / Blizzard Watch (2023–2024) on quest icons | Campaign quests show a shield behind the "!" (since Shadowlands); The War Within adds a map legend: *Campaign* (main story), *Legendary*, *Important* (unlocks features or teaches mechanics), with map filters per kind | [SN] |
| R5 | Blizzard support *Cannot Track Quests* (via search; the page did not render for the fetcher) | Retail: a quest is added to the tracker as soon as it is picked up, and again whenever an objective progresses; Classic: up to 5 tracked, quests fade when not worked on | [SN] |
| R6 | warcraft.wiki.gg, *Breadcrumb* | Breadcrumb quests exist only to lead a player from one zone/sub-zone to the next, usually handed out on finishing the previous hub; alternatives leading to the same follow-up are mutually exclusive | [S] |
| R7 | warcraft.wiki.gg, *Phasing* | Outdoor areas change **per player** with "accomplishments or quest progress"; examples: a burning gate after a questline, a camp leader replaced once the old one is defeated; terrain itself can change (Cataclysm); different phases cannot see each other except in a synced party | [S] |
| R8 | Engadget 2008 / GameBanshee interview (Allen Brack), via search | The game tracks "world states" from completed quests: rescued villagers reappear at the hub only for players who rescued them; buildings intact vs damaged | [SN] |
| R9 | warcraft.wiki.gg, *Bonus objective* | Area objectives appear in the quest list on entering a zone area, no quest giver, extra XP on completion; leaving the area hides the objective but keeps its progress | [S] |
| R10 | warcraft.wiki.gg, *Escort quest* | Escort an NPC through danger; failure is common (NPC dies, ambushes), escorted NPCs engage enemies by themselves, players find the walking pace annoying | [S] |
| R11 | WoWInterface / wowprogramming (AddAutoQuestPopUp) | Since 4.0.3 some quests complete "on the go" without a turn-in NPC; the tracker shows a COMPLETE or OFFER pop-up | [SN] |
| R12 | consolegameswiki, *FFXIV Journal* | Limit of accepted quests is 30; the journal drives the HUD duty list; a filled checkbox marks a quest **priority** and moves it to the top, a red box hides it; the number of displayed quests is a HUD setting; with nothing marked the most recently accepted is on top | [S] |
| R13 | consolegameswiki, *FFXIV Quests* | Categories: Main Scenario (mandatory story), Feature (unlock features), Side (gil, items, lore), Repeatable (daily/weekly limits); a dedicated HUD element "displays the current or next Main Scenario Quest" | [S] |
| R14 | FFXIV guides (yattatachi, trialsoffantasy) | MSQ marker is a meteor-shaped icon; feature quests use a blue marker with a plus sign; side quests plain gold markers | [SN] |
| R15 | Blizzard Watch, *The short guide to bounties in Diablo 3* (2015) | Five random bounties per act; finishing all five gives a Horadric Cache plus gold and XP; six bounty types (clear a dungeon level, kill a boss, slay guardians/destroy portals, cleanse a cursed chest/shrine with waves, kill a unique elite + count, complete a zone event); the minimap tracks important monsters and objectives and an arrow points to the objective if you wander off | [S] |
| R16 | Blizzard Watch 2020 / mein-mmo, D3 caches | Cache contents scale with difficulty: random loot, crafting materials, gems, gold, act-specific crafting material; legendary chance rises with difficulty | [SN] |
| R17 | Diablo Wiki *Quest* (403 for the fetcher), via search | D3 campaign quests reward experience and gold on completion; objectives are followed in the text under the minimap; quests cannot fail | [SN] |
| R18 | Mobalytics / PureDiablo, D4 *Tree of Whispers* | 10 Grim Favors claim a cache; whispers are worth 1 / 3 / 5 favours by size (elite or event; 100 kills; dungeon or world boss); overflow carries to the next cache; favour count shown on the map | [SN] |
| R19 | PowerPyx / Samurai Gamers / Game8, D4 side quests | Side quests are blue "!" on the map; many tell short local stories from one town; rewards XP and gold scaled to level, plus region renown | [SN] |
| R20 | DiamondLobby / Blizzard forum, D4 tracking | Campaign quests are tracked automatically; side quests are tracked by hand from the map list; a tracked quest shows a path/direction marker on the minimap | [SN] |
| R21 | PureDiablo / Game8, D4 strongholds | Liberating a stronghold permanently restores the place: NPCs (smith, healer, vendors), waypoints, and unlocks side quests there | [SN] |
| R22 | wiki.guildwars2.com, *Renown heart* | Progress comes from "a wide variety of player actions" (killing, watering plants, feeding cattle, reviving allies), players pick which; **no NPC interaction is required to begin**; on completion XP, karma and coin; the heart NPC then becomes a vendor; map icon fills from the bottom as a progress bar; repeatable hearts get a ∞ mark | [S] |
| R23 | wiki.guildwars2.com, *Event* | Events start when a player enters the area or a condition is met; outcomes change the area and chain into other events; difficulty scales with nearby players; participation medals (gold 100 %, silver 85 %, bronze 75 %); "New Event Nearby" notice and a top-right event tracker | [S] |
| R24 | Maxroll, *PoE Campaign Guide* | Quests unlock **gem reward choices** at the turn-in NPC (other choices purchasable afterwards); some quests give a passive skill point; some rewards are a one-pick choice ("Choose the Quicksilver Flask") | [S] |
| R25 | Path of Exile forum thread 21261 | Postponing a gem choice keeps it: talking to the NPC again re-opens the reward choice | [SN] |
| R26 | — | WoW closes the quest window after Accept; most ARPGs (D3, D4) return control to the player right after a conversation choice | [K] |
| R27 | — | WoW lets the player choose one of several items as a quest reward and previews them before turn-in | [K] |

Not found: published numbers for how many quests a hub should offer, or for walking time between quest steps. Where the
design needs them they are labelled *design guess* and derived from this game's own measurements (zone sizes, hero speed
250 u/s, `docs/rework/worlds/REFERENCES.md` §4) or from BALANCE.md.

## 2. Principles applied (each cites the rows above)

1. **Three marker families that never share a shape**: story (crest behind "!"), side story (plain "!"), lessons/features
   ("+"); repeatables leave people and live on a board (R3, R4, R13, R14, R19).
2. **The next story step is always on screen**, accepted or not (R13 MSQ element, R20 campaign auto-track).
3. **Many quests tracked at once**: added on accept, re-added when they progress, one *focus* that drives the trail and
   arrow, hide per quest, story first (R5, R12, R20).
4. **Hubs, breadcrumbs and people who move with the story**: a hub offers what fits one outing; the last step hands over
   to the next hub; the giver phases to where the work ends, so the turn-in is on the way (R1, R2 travel time, R6, R7).
5. **Repeatables on a board, out of the way**: a small rotating set per zone that progresses without accepting, pays on
   completion and adds a cache for finishing the set; visible in the tracker only inside that zone (R9, R15, R18, R22).
6. **The world shows what you did**, per player: wheels turn, water drains, fires light, people come back, the giver
   stands somewhere new (R7, R8, R21, R23).
7. **Objective variety in every quest**, no two adjacent steps of the same kind where avoidable: gather, repair (hold to
   use), hand-over conversations, events, named rares, ordered puzzles, choices (R1, R2 flow, R15 types, R22).
8. **Short text, objectives first, immediate feedback**; an "Investigate" never leaves a window over the world (R1, R2,
   R26).
9. **Rewards that matter**: XP and gold first, a previewed item choice, caches on boards (R1, R2, R16, R24, R27).
10. **No Christmas tree**: at most three new offers per person at once (R1, R2).
</content>
</invoke>
