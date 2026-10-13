# Owner list, 2026-10-13

The owner's fix list after playing on the dev link (quoted items below), plus the developer account and the Kindled
colour report. Labels: [S] sourced, [K] known convention (not sourced here), [M] measured in this repo, [P] placeholder
judged by eye at 1920×1080.

## References

| # | Source | What it says | Used for |
|---|---|---|---|
| A1 | Path of Exile 2 UI guide, mobalytics (https://mobalytics.gg/poe-2/guides/user-interface); PoE1 Options (https://www.poewiki.net/wiki/Options) | PoE2 has "Show Mini Life Bar Above NPCs", usually set to Enemies Only; PoE1's UI options include health bars [S] | life bars over ordinary monsters |
| A2 | Violet Recording, *How to design a creature sound* (https://violetrecording.com/how-to-design-a-creature-sound/); CRI Ware blog, *Creature vocalizations* (https://blog.criware.com/index.php/2023/03/11/creature-vocalizations/); soundgen docs (https://rdrr.io/github/tatters/soundgen/man/soundgen.html) | roars are layered: a growl, a low rumble for weight, a breathy layer; pitch contour moves; amplitude modulation / rasp makes a sound rough [S] | the enrage roar |
| A3 | Diablo III and Path of Exile game menus [K] | Escape with nothing open opens the game menu | Escape → Settings |
| A4 | MapleStory EXP gain messages; WoW floating combat text "Experience" option [K] | XP gains shown as they happen | "+N XP" on kills |
| A5 | WoW default chat colours [K] | party blue, guild green, whisper pink, channels their own colour | chat channel colours |
| A6 | WoW Game Master `<GM>` tag, RuneScape Jagex moderator gold crown [K] | staff are marked in chat and over the head | developer badge |
| A7 | Diablo III *Town Portal* (recall to town, a portal back to where you left) [K] | owner asked "like diablo" | town portal |

## Items

| Owner's words | What changed | Basis |
|---|---|---|
| "when hovering an item and closing inventory the item ui stays open same with hovering over anything and then closing the interface" | a tooltip remembers the element it belongs to and hides when that element leaves the page (`ui/panels/tooltip.tsx`) | bug |
| "after clicking party and then closing whenever i press space bar the party thing opens again" | a button pressed with the mouse gives Space/Enter back to the game; keyboard-focused buttons still activate (`game/input.ts`) | bug |
| "when turning in quest and getting exp the leveling up pop up doesn't show" | quest rewards take the same level-up step as kills: the level event, new skills slotting, resource refill (`sim/players.ts announceProgress`) | bug |
| "escape should open the settings thing" | Escape closes chat or windows first; with nothing open it opens Settings | A3 |
| "the crossbow ... shows idk some type of arrow at the feet" | the nocked-arrow sprite was made for crossbows too but only bows place it, so it sat at the feet; only bows get it (`render/art/player.ts`) | bug |
| "monsters enraging sounds like a fart" | the enrage roar rebuilt: under 200 Hz 87 % → 17 %, centroid 135 → 927 Hz, pitch swells and falls instead of sliding to 22 Hz [M] (`.local/bal/sound-probe.ts`) | A2 |
| "hp bars on even low tier mobs should be visible" | normal monsters, rare minions and the Hoardling get a small life bar with a damage chip; champions/rares keep their plate, bosses their screen bar | A1 |
| "also during leveling is maybe cool if u also see +xp when u kill something" | the server sends each kill's XP to that player; "+N XP" rises over the hero, kills within 0.7 s add up [P colour] | A4 |
| "the salvage item button shouldn't be there in the inventory, instead it should be at the blacksmith" | bulk salvage moved into the Blacksmith's Salvage work; shift + right-click still salvages at the Blacksmith | owner |
| "Chat should be made a bit more obvious also pressing enter should start in global" | Enter opens chat in Global; one channel picker; channel colours; "Enter to chat" hint when closed; /global and /zone | A5 |
| "i had a set item before and it was kindled so it showed orange while set items should show green" | rarity colour first everywhere: Kindled/Fabled are an inner ring + glow in the slot and the beam's core, never the frame, beam or label border | owner |
| "make slapbox account the developer account with a cool symbol and tags and colours in chat and give moderation tools" | `STAFF_ACCOUNTS` (server setting) makes accounts staff: gold DEV tag with a star over the head, ✦ DEV badge and gold name in chat, staff commands /announce /who /kick /mute /unmute /ban /unban /reports /resolve (server/src/staff.ts), sanctions audited in the community ledger with their reason | A6 |

## Batch 2: danger, XP, resources, Tab map, town portal

More references: B-R1 Diablo III Hatred regeneration on quivers (Ninth Cirri Satchel "+1.35–1.50 Hatred per second",
https://di.diablowiki.net/The_Ninth_Cirri_Satchel) and Hatred sustain advice (https://us.forums.blizzard.com/en/d3/t/how-to-restore-hatred-question/23791) [S];
B-R2 Arcane Power on Critical Hit on sources/wands, The Swami "3–4 Arcane Power" (https://www.diablowiki.net/Arcane_Power_on_Critical_Hit) [S];
B-R3 Fury: built by fighting, drains out of combat, Unforgiving removes the drain (https://www.diablowiki.net/Fury) [S];
B-R4 Path of Exile mana: regeneration auras, leech, reduced cost, flasks (https://steamcommunity.com/app/238960/discussions/0/522730701646877804) [S, old].

| Owner's words | What changed | Basis |
|---|---|---|
| "early level the mobs still hit 1 it feels like no challenge killing anything" | LEVEL_DAMAGE levels 1–15 ×1.2–2.2 (was ×0.6–1): with the levelling bot's own gear a hero who never attacks now falls in 4–24 s beside a Story pack at levels 3–10 (was 13–60 s), a fighting one loses 8–58 % of life to a pack at levels 1–5 [M, `sim.ts threat`, THREAT_KIT=organic]; level 20+ unchanged | B1 |
| "monsters should give a lil more experience atleast early game" | kill XP ×1.5 through level 10, fading to ×1 at level 20 [P]; quest and bounty XP unchanged | owner |
| "hatred is a little bit too much of an issue early game" + "even late game ... very annoying on resources" + "mainly cause some stuff doesnt have a cooldown and it just spams it" | measured (`sim.ts resource`, 3 min in a field, rare kit): Ranger bar 9–15 %, a ready cooldown skill waited for resource 49–80 % of the time; Mage 21–35 % / 31–40 % [M]. Automatic no-cooldown spenders now pool: they start at 60 % of the bar and spend until the next cast is unaffordable, and never take what a cooldown skill ready within 1 s needs (server/src/sim/brain.ts). Fury (built by fighting, drains) and buff/summon skills are not pooled. After: Ranger bar 26–39 %, blocked 0–20 %; Mage 35–41 %, 0–8 %; kills per minute unchanged within noise [M] | B-R1, B-R3 |
| "builds and items should help with that ... investigate how poe and diablo do it" | resource stays a build concern: existing cost reduction, maximum resource, regeneration and resource per kill, plus a new affix **+N resource per critical hit** (weapons 2–4 / two-handers 3–5, off-hands and helms 2–4, at most once per 250 ms) [P values] | B-R2, B-R4 |
| "when pressing tab it should open like path of exile kind of a transparant map of the layout that ur in" | Tab toggles a see-through overlay of the zone (walkable outline, roads, water/cliffs) centred on the hero with quest marks, people, waypoints, portals, players, elites and bosses (client/src/ui/hud/OverlayMap.tsx); with a window open Tab keeps moving keyboard focus | PoE overlay, D2 automap [K] |
| "there should be a button to just teleport to town ... like diablo it should leave behind a portal ... T could be a good keybind" | T (rebindable) or the house button in the menu bar: a 3 s cast [P] that moving, a hit or dying interrupts (server-timed), then town with "Name's portal" by the Faultstone that returns to the exact spot (same instance while it exists; a field channel reopens) | A7 |

## Batch 3: skills window

References: C-R1 Diablo IV skill tree: left-click allocates a point, right-click refunds it, hovering shows the current and next rank [K]; C-R2 Path of Exile passive tree: allocate by clicking the node itself [K].

| Owner's words | What changed | Basis |
|---|---|---|
| "skills shouldn't have 2 pages to scroll through to see all skills, it should all be easily visible and also for upgrading the speciliazation etc nothing should be behind another click it should all be clear and easy" | all 12 skills of a class on one screen (the category chips only filter); the selected skill's tiers, runes and specialization tree sit together in one Build view, Casting and Numbers stay as advanced tabs; a tree node learns a rank on click and refunds on right-click, its tooltip shows now / next / needs; runes are one row with the equipped rune's text below. The window is 845 px tall at 1920×1080 (ends above the orbs and skill bar) and fits at 1280×720 [M, `.local/scn/skills-fit.mjs`] | C-R1, C-R2 |

## Batch 4: waypoint tracker

References: D-R1 Fable II "breadcrumb trail": a sparkling gold line on the ground to the objective that reroutes when the
player leaves it; one preview found it too bright and pulling the eye from the fight (GamesRadar https://www.gamesradar.com/fable-2-fresh-look/2,
Joystiq/Engadget hands-on https://www.engadget.com/2008-07-16-joystiq-e3-hands-on-fable-2.html, Shacknews https://www.shacknews.com/article/54748/new-fable-2-screenshots-and) [S];
D-R2 World of Warcraft map pins with an in-world beacon; the popular addons add a distance label, screen-edge arrows and hide it when close
(Waypoint Enhancer https://www.curseforge.com/wow/addons/waypoint-enhancer-better-blizzard-waypoints-style) [S, addon pages];
D-R3 Diablo IV: a path or direction marker on the minimap toward the tracked objective (https://diamondlobby.com/diablo/diablo-4/how-to-track-objectives-diablo-4/) [S, weak].

| Owner's words | What changed | Basis |
|---|---|---|
| "The waypoint tracker can be made a bit more modern and better working" | measured problems first: the trail's dots were 2 radii apart and faint on cobbles, nothing showed the way once the goal was off screen, a two-target step led to the first target while the tracker measured to the nearest, the minimap marked only that first target, and long titles were cut ("The …", "Pressure B…") because the destination shared their line. Now: denser crumbs with three sparks running toward the goal and a pulsing ring at its end (D-R1, kept quieter than the crumbs); a marker pinned to the screen edge with an arrow and the distance ("72 m", or "Rillwake Crossing · 41 m" for another zone's exit), hidden on screen and under 4 m (D-R2); the trail picks the nearest remaining target every 0.5 s, the same point the tracker measures; the minimap and Tab map mark every remaining target, pinned to the minimap rim (D-R3); tracker titles keep their whole line, the distance ends the objective text (`render/questGuide.ts`, `ui/hud/Minimap.tsx`, `ui/panels/questTracker.tsx`). Spacing, spark speed and HUD insets are [P] | D-R1–D-R3 |

Every item on the list is done.

## Batch 5: private fields (owner decision)

The owner asked "isnt it better to have mobs for each player? ... i can imagine on release 20 ppl on 1 mob pack is kinda
weird no? unless in party then shared". Options shown: private fields per party (Path of Exile, Last Epoch, Diablo III
games of four), a shared world with credit for everyone (Diablo IV, Guild Wars 2), or small shared channels (Lost Ark, WoW
sharding) [K]. Owner: "do private fields per party then i guess".

Reference E-R1: Path of Exile keeps an empty area instance 15 minutes, or 8 minutes for areas with two or fewer exits; a
new instance is made after that (an older official explanation quoted on https://www.pathofexile.com/forum/view-thread/518788) [S, old].

| What | Basis |
|---|---|
| Every field zone is a private instance: a hero on their own gets their own, a party shares one; entering a field joins the instance a party member is already in (otherwise the party's), never one a stranger is in. Leaving a party keeps you where you are until you travel (`server/src/world.ts fieldRec`) | owner, E-R1 |
| An empty private field closes after 8 minutes, so a town portal or a quick trip to town comes back to the same monsters; after that the portal back opens a fresh one | E-R1 |
| Town keeps its shared channels (100 per channel); fields have no channels, the Waypoint says "A private field: only you and your party are here. Everyone meets in town.", the zone plate says "Private field" | owner |
| Cost measured with the real simulation: about 2.2 MB of heap and 0.03 ms of world tick per field instance, the first instance builds in 138 ms; at most 64 field instances (`MAX_FIELD_INSTANCES`) ≈ 140 MB, inside the Hetzner service's 700 MB [M, `.local/bal/field-memory.ts`] | measured |

## Batch 6: invite and friend popups

The owner asked: "are there pop ups on screen for friend request and party invites etc? that u see a pop up if someone adds or invites u for like idk 30 secs to a min". Before: a number on the Party button and a "Party invitation" button under the portrait; adding a friend told the other hero nothing.

| What | Basis |
|---|---|
| A party invite opens a prompt at the top centre, "Name invites you to their party" with Accept and Decline and a bar for the 60 s the invite lasts (the existing server expiry) | World of Warcraft's invite prompt [K]; owner's 30 s–1 min |
| Adding someone shows them "Name added you as a friend" with Add back and Dismiss for 30 s; adding them back answers it; the same pair can cause it once per 10 minutes (no add/remove spam); never across a block (`server/src/social.ts`, `client/src/ui/hud/SocialPrompts.tsx`) | Battle.net and Steam friend requests [K]; owner |

The four-client quest tests now form a party before entering the field, since only a party shares a private field.

## Batch 7: the level-up banner on the live server

The owner: "i dont see that level 2 notice on the live server its weird". Measured: the server sends the level event on kills and quest turn-ins, in town and in private fields, and the client draws the banner in the dev and the production build. With reduce motion on (the game setting, or Windows' animation setting, which the live address follows until the player chooses), every animation is cut to 1 ms; a notice's animation is its whole life and ends invisible, so it was never seen (opacity 0 measured). Notices, the pickup log and panel banners now keep their length under reduce motion as a fade without movement (opacity 1 measured; `client/src/ui/styles/tokens.css`).

## Batch 8: companions

A player in chat: the Companion skill "doesnt really do anything" although maxed. Measured on slapbox (level 70, Raven, tier 3, two ravens): 6 % of the damage over 25 s of fighting, the ravens hanging at the hero's side. Causes found:

| Cause | Fix | Basis |
|---|---|---|
| a flying companion whose next step was blocked by a wall or cover stopped for good; a walking one pressed against fences, buildings and cliffs (no pathfinding): at the town's training dummies two ravens and two wolves dealt 0 | fliers slide along walls and cover; a companion that has not closed in for 1.2 s appears at a free spot beside where it was heading (`server/src/sim/summons.ts`). After: wolf, raven and bat each strike 18 times in the same window, about 40 % of a level 30 hero's damage with only the primary attack [M] | bug; ARPG pets warping back into play [K] |
| a companion more than 60 units short of striking range walked at its normal speed, so packs died before it arrived | it closes in at 2.2× speed [P] | owner |
| only the Heron showed its strike | the raven strikes with a lightning arc from the bird, wolf and badger bites close as two crossing swipes, the bat's as a flurry of three; a short flash in the strike's element (`client/src/render/vfx/aoe.ts beastBite`) | hit feedback for every damage source [K] |

Damage numbers are unchanged. slapbox's two ravens now deal 7–10 % at level 70, where packs still die almost at once. Ranger parity D3 stays inside 0.80–1.25 (Companion 0.99, Rain of Vengeance 0.85, Pitch Mortar 0.92) [M]. More Companion damage would be a balance change, not made here.

## Verify notes for batches 1–5

- `client-bindings`: the test rebound "move up" to T, which is now the town portal key, so it uses G; Tab is tested both ways (moves focus while a window is open and with Shift, toggles the map otherwise).
- `depth` (Ranger parity D3): adding the resource-on-crit affix reshuffles the seeded rares of every parity kit. Seed 101 alone put Pitch Mortar at 0.76 (hard limit 0.80); the same seed already swung 0.84–1.14 between seeds before the change, and over the audit's three seeds D3 moved 1.00 → 0.95. The Ranger gate now uses the three seeds (all mains 0.88–0.99, 18 s) [M].
- `perf-budget`: snapshot bandwidth +16.5 % over the 2026-10-11 baseline (limit +15 %). With the new affix weighted 0 the scenario is byte-identical to 7ff65dd (+11.7 %), so the extra comes from the scenario hero's reshuffled gear, not from protocol or code; the baseline was re-recorded with `--record` (the tool's path for an intended change). Tick time back to back on the same laptop: 7ff65dd 1.94–2.07 ms, now 2.11–2.14 ms per round of 4 (budget 10 ms) [M]. The pace baseline was not touched.
