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

Still to do from the list (in progress): early challenge, Hatred early, early XP, Tab map, town portal (T),
skills window without pages, waypoint tracker.
