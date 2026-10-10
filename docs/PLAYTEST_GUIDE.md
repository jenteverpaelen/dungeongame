# Hearthfall fresh character playtest guide

Updated 10 October 2026. P11 build `bef89cb`, plus C107 playtest feedback fixes.

**Yes — you can now play from a fresh character through the authored story to roughly level 50.** Start by playing normally with your favourite class. The most valuable feedback is where you get confused, bored, stuck, unexpectedly weak, or excited by an upgrade. You do not need to run a formal test suite.

**Play here: [Open Hearthfall](http://localhost:2577/).** This is a separate local test world on your PC. Your existing characters are untouched. New test characters keep their progress between visits.

## Start here

1. Choose a new name and your preferred class. Customize their appearance if you want.
2. Start the introduction. Follow it through Hearthmere, the Waypoint, and Rillwake Crossing.
3. Speak to **Orren**, take **A Foot on the Road**, complete its objective and return for the weapon.
4. Compare and equip your reward, spend an earned skill point, then follow **The Silent Wheel** and the journal's story objectives.
5. Continue the story. Return to town when you want to stash gear, improve equipment or learn an artisan lesson.

This world starts with ordinary health and progression, without boosted characters or debug rewards. That lets you judge danger and pacing. The automated combat results used infinite HP; they did **not** establish whether real players survive comfortably.

| Default control | Action |
|---|---|
| WASD / arrow keys | Move; your hero attacks automatically when in range |
| Space | Dash in your movement direction |
| E | Use the nearby NPC, object or entrance |
| Mouse wheel / trackpad pinch over the world | Zoom in/out; Settings → Default zoom restores the new wider view |
| I / B | Inventory; **Collection** is inside this panel |
| K | Skills, casting preferences and build choices |
| J | Quest journal |
| M | World map; inspecting a route does not teleport you |
| O | Settings, including your actual key bindings |
| F1 | Help |
| U | Cube shortcut, only usable near the physical Cube |

Previously saved keyboard preferences can override those defaults. Party and Social also have visible HUD buttons.

## How the game should feel

**You control positioning and the build.** Automatic attacks should free you to watch enemy warnings, dodge, choose a useful range, and decide which skills and equipment work together. Playing should involve more than waiting for a damage number to grow.

**The next step should be understandable.** Accepting a quest automatically tracks it. Follow the gold dots along the floor; the minimap and world map point at the same authored objective or connecting exit. Use **Track / Untrack** in the journal, or **Untrack quest** beside the tracker. Untracking removes its navigation marker until you track a quest again, even after reconnecting. Nearby people and objects show an **E** prompt you can also click. A new destination should have a reason to visit it. You should not need this document to decode a quest objective.

**The story should carry you forward without compulsory grinding.** Its fixed XP rewards cover the intended level 1–50 route; kills add more. The level bands below are guidance, not an exact promise about your level on arrival. Report any point where you must repeat packs just to continue.

**Equipment should arrive less constantly.** You requested fewer drops of all equipment, so the new model produces roughly 29–35% fewer items than the previous opportunity budget. Bosses retain their Legendary/Set guarantee. Fixed story rewards are unchanged, and ordinary vendors should help fill weak slots after a few packs. Tell me whether upgrades now feel more meaningful or simply too scarce. Fewer items also means fewer salvage materials.

**Returning to town should be useful and straightforward.** Services are physical: you can inspect some information remotely, but using an artisan requires standing beside the right one. The original UI style is retained.

**Attacks now reach less far.** Long-range targeting is reduced by about 20–37%, with shorter projectile travel and summon reach. Melee reach, damage, cooldowns and area sizes are unchanged. Notice whether the closer fighting distance feels better; large areas and very close zoom can still extend beyond the screen.

**The view now starts wider.** Default camera scale is 75% of the old view. Scroll or pinch for a much closer view or a little farther out; your choice is remembered locally. Settings offers the same control and a default reset. Before active spells unlock, the HUD uses smaller globes and a wider XP strip; the full skill bar appears as your skills become available.

These are the intended experiences for you to judge, not a claim that human pacing or every fight is already balanced.

## Follow this campaign route

Follow the journal and physical exits. Use discovered waypoint destinations where offered; private dungeons require their entrances. Accept each dungeon stage's quest before trying its mechanism.

| Intended band | Destination | Main thing to notice |
|---|---|---|
| 1–4 | Rillwake Crossing | First contacts, weapon reward, mill objectives and dangerous elite |
| 4–7 | Bracken Sluice | Reading the route, crossing the sluice and finding the next entrance |
| 7–9 | Reedvault Pumpworks | Ordered chambers, mechanisms and completing a private dungeon |
| 9–12 | Cairnspill Terraces | Quarry routes, warning lines and using space to dodge |
| 12–16 | Cinderwash Kilns | Fire/explosion encounters and increasingly dangerous combinations |
| 16–20 | Kilnwatch Crown | The final furnace encounter and **The Last Draw** |
| 20–25 | Sablefen Causeway | Continuing the story into the flooded cargo route |
| 25–30 | Saltwind Pans | Production lanes, brine objectives and **Sealed Brine** |
| 30–35 | Lockglass Cistern | Three ordered chambers, mechanisms and a changing boss pattern |
| 35–40 | Shiverline Escarpment | Switchbacks, ridge signals and reopening the relay |
| 40–45 | Beaconbreak Ward | Streets, gates and tracing the false command |
| 45–50 | Hollowstar Array | Three encounter stages, the Conductor and **The Last Transmission** |

**The authored campaign currently ends here.** Existing rifts and level-70 systems are available as older systems, but a finished 50–70 campaign and complete endgame loop have not been added yet. Reaching this boundary is not a broken quest chain.

During the route, notice whether areas feel different to navigate and fight in. Art remains a work in progress: report flat-looking scenery, unclear entrances, obstructed views, collision problems and repetitive encounters.

## Things to try during that first playthrough

Use this as a loose checklist, not a reason to interrupt every fight.

- [ ] **Guidance:** Can you follow the introduction, find the current contact and understand what counts toward each objective? Skip/resume guidance once if it gets in your way.
- [ ] **Combat:** Can you recognize and escape warning circles, projectile fans, charges and fracture lines? Does your class feel responsive? If you die, does the roughly five-second respawn flow recover normally?
- [ ] **Skills:** Spend and refund a tier, choose a rune when available, and try a passive when its slot unlocks. Does the effect make sense? Optional casting/target preferences should behave as their descriptions say.
- [ ] **Equipment:** Compare a reward against your current item, equip it and notice the difference. Ring comparisons should show both possible replacements. Sheet damage does not account for every set bonus or skill interaction.
- [ ] **Quest rewards:** Claim in person, keep going to the next contact, and check that completed objectives stay completed after reconnecting. If a reward meets a full bag, it should wait rather than disappear.
- [ ] **Town and travel:** Use the return route, Waypoint, map and a dungeon entrance. Buildings and solid props should block you; doorways should work. Report getting stuck, walking through something solid or disappearing behind the wrong object.
- [ ] **Shopping and storage:** Buy a useful cheap replacement, sell and buy back an item, protect something valuable, and deposit/withdraw an item from the 60-slot Stash. Check that protection survives moving it.
- [ ] **Presentation:** Every menu should be usable without scrolling. Look for clipped buttons, unreadable warnings, excessive effects, off-screen important attacks, uncomfortable sound, freezes or stutters. Use wheel/pinch to adjust the world view; the HUD should stay the same size. Report anything important you still cannot see.
- [ ] **Saving:** At a quiet point, remember your level, one item and current quest; reload and check all three. Settings should also persist. An unfinished dungeon encounter can reset if everyone leaves or the server restarts; completed quest rewards should not reset or pay twice.

Please mention the exact area and what you were doing when something feels wrong. A screenshot or short clip helps more than trying to investigate the cause yourself.

## Town upgrades and the new item systems

Artisans share **workshop/Cube progression**. These optional lessons should make the first services available through story milestones rather than forcing you to salvage everything. Each lesson follows the previous one.

| After completing | Visit in Hearthmere | What to try |
|---|---|---|
| Pressure Below, around level 9 | Jeweler | Workshop level 2: gem fusion; also the new gem exchange and Blacksmith Rare forge |
| The Last Draw, around level 20 | Mystic | Workshop level 3: enchanting |
| Sealed Brine, around level 30 | Blacksmith | Workshop level 4: empowering equipment |
| Open Beacon, around level 40 | Blacksmith | Workshop level 5: transmuting Rare equipment at the Cube |
| The Last Transmission, around level 50 | Mystic | Workshop level 6: extracting a legendary power at the Cube |

Training unlocks access; it does not pay crafting costs. Optional class-set gifts after **Sealed Brine** and **Lockglass Heart** should give two different pieces, enough to try your first two-piece effect.

Open **Inventory → Collection** for the new screens:

| Screen or service | Try this | Expected result |
|---|---|---|
| Powers and Sets | Find a power or set piece you acquired | The catalogue records acquisition; extracted powers are distinguished. Consuming an item should not erase its collected appearance. |
| Appearances | Apply an acquired compatible look at the Mystic, then restore it | Your appearance changes; your item and combat stats do not. You need an equipped compatible item. |
| Loot rules | Change one ordinary rarity's visibility or pickup rule, save, then restore defaults | Hiding and leaving on the ground are separate choices. Legendary/Set drops stay visible and collectible. |
| Auto-salvage | If you want it, opt in for a rarity of disposable items and read the count preview | Opening the nearby Blacksmith consumes eligible bag items. It is off by default; protected, equipped, stashed and specially modified items are excluded. |
| Forge Rare | Choose a useful base and pay at the Blacksmith | You get a Rare item for your current level with random properties. |
| Exchange gems | Exchange three matching gems at the Jeweler | Receive one chosen gem of the same rank. Pearlglass is the new resource/attack-speed family. |
| Convert set | Later, at workshop level 7, choose a bag set piece and a result at the Cube | The input is consumed, rolls/upgrades reset and socketed gems returned. The result is not Ancient/Primal. Read the confirmation before using valuable gear. |
| In bag | Link an owned item in chat and inspect the link | The item preview shows its properties and compares it with your equipment. |

Five materials have new display names: **Iron Shards, Wisp Powder, Dawn Quartz, Relic Ember and Cinder Essence**. Their balances and uses were retained.

The catalogue now has **three six-piece sets per class**. You are not expected to find and complete all of them in a first campaign run. Later, judge whether the alternatives produce recognizably different play styles. The nine tested builds met the chosen clear-speed tolerance in a controlled simulation; survival and enjoyment still need real play.

## Optional second pass with another player

You can leave this until after your solo run. A second character in another browser tab can check the controls, but two humans are better for judging whether cooperation is fun.

- Invite, accept, decline and leave a party. Check health/location frames, leader transfer, and briefly disconnect/rejoin.
- Enter a story dungeon together with both characters eligible for its quest. Both living participants present when a chamber starts should be able to earn that stage's credit. One person disconnecting should not reset the fight for the person who remains.
- Check that your friend cannot take your personal drops. Watch for monsters becoming tedious or trivial with more players.
- Try friends, whispers, privacy, block/mute, equipment inspection and a published group listing. Joining a listing should not teleport you.
- Create a guild, invite the other character, try its chat, message of the day and ranks, then reconnect. Try an earned title and an emote.
- Submit a clearly labelled **test report** about the other test character. It should create a receipt; it should **not** automatically punish anyone. Owner review is manual.

This server is for local testing. Authenticated accounts and public-release security are not finished.

## What is unfinished versus worth reporting

**Please report now:** broken or unclear objectives, forced repetition, unfair damage, weak upgrades, loot droughts, boring stretches, misleading tooltips, lost/duplicated rewards, unresponsive screens, collision/occlusion errors, scrolling menus, confusing sounds, or social controls behaving incorrectly.

**Already known future work:** the authored 50–70 story, full timed-rift/bounty/leaderboard endgame, wider account/meta systems, authenticated ownership, larger multiplayer performance and release operations. Guild banks/perks and repair/upkeep/gambling fees are not part of the selected current design. Offline rewards still use the earlier system; their final balance is unfinished.

If a problem stops your run, send it immediately. Otherwise, notes at the end of an area are enough. There is no required session length and no measured promise about how many hours this campaign should take.

## Copy this when sending feedback

```text
Class and level:
Area and quest:
What I tried:
What happened:
What I expected or wanted it to feel like:
Stopped my run / annoying / preference:
Screenshot or clip, if useful:

Fun so far, 1–10:
Too easy / about right / too hard:
Too much loot / about right / too little:
Most confusing moment:
Best moment or upgrade:
```

## Continue this same test later

While the server is running, use **http://localhost:2577/** and the same character name. Your saves are separate from the original game data.

After restarting your PC, launch `.local\START-OWNER-PLAYTEST.cmd` from the repo, then open that link. Keep its terminal running while you play. The launcher points to the same test saves; it does not create a fresh world on every start. If the server is already running, there is no need to launch another copy. `.local\owner-playtest-current.txt` records the test world's location.

For detailed implementation evidence rather than a player checklist, see the [Claude handoff](CLAUDE_OPUS_5_5_HANDOFF.md), [Itemization report](phase/P11-itemization/CHAPTER-REPORT.md) and [change log](CODEX_CHANGELOG.md).
