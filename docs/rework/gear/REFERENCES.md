# Gear visual progression — references (what real games do, what Hearthfall borrows as a principle)

Researched 2026-10-10 with web sources (V = page fetched and read; S = second-hand search snippet; UNVERIFIED = no
source found, not used as a fact). Only principles are borrowed: no assets, names, shapes or distinctive designs.

## Verified observations

| # | Game | Observation | Source |
|---|---|---|---|
| R1 | Diablo III | Classes designed "to have a distinctive silhouette"; armour sets "can cause dramatic alterations to the character's silhouette"; progressions "start barebones but recognizable and end up incredibly ornate" (Lichtner, GDC 2012). V | gameranx.com/features/id/5666 · gamedeveloper.com (GDC 2012 Diablo III art) |
| R2 | Diablo III | Ancient items share the Legendary orange glow plus an orange tooltip border (green for sets); Primal Ancients "have a red beam and glow". V | news.blizzard.com/en-us/article/22989464 |
| R3 | Diablo III | Paragon portrait frames: originally a new frame every 10 levels; patch 2.0.4 added frames at Paragon 200…800; Season 20 frames "smolder with demonic fires". V | gameinformer.com (Paragon 1.0.4) · news.blizzard.com/en-us/article/13532431 · …/23319442 |
| R4 | Black Desert | Sovereign weapons' "Primordial Light": none at +0..TET, level 1 at PEN..SEP, level 2 at OCT..DEC; "the higher the enhancement level, the stronger"; hideable with an eye toggle. Edana defense gear: "exclusive visual effects are added upon reaching PEN (V) and OCT (VIII)". V | naeu.playblackdesert.com Wiki 415 · blackdesert.pearlabyss.com Wiki 749 |
| R5 | Albion Online | Icon background colour shows the tier (T1–T8), outline colour + 1–4 diamonds show the enchantment (.1 green … .4 yellow). V (player guide). Staff: "eventually all enchanted gear will get some glow effects", "glow = rare". S | steamcommunity guide 3459682256 · forum.albiononline.com thread 38988 |
| R6 | Lost Ark | Weapon glows are unlocked by honing levels; a "Weapon Glow Library" lets players pick any glow they unlocked. V. (+10/+15/+20 thresholds only from unofficial guides.) | playlostark.com 2024 summer roadmap · maxroll.gg Tier 4 dev letter |
| R7 | Guild Wars 2 | A legendary weapon is a bundle: lightning aura while drawn, footfalls ("charred ground footprints with electrical sparks"), death animation, trails. Legendary trinkets share an aura that escalates with the number worn. ArenaNet: effects must "showcase the weapon, not obscure" it; legendary armour wanted "a distinct silhouette" that turns heads. Cosmetic infusion auras are rare-drop status symbols. V | wiki.guildwars2.com/wiki/Bolt · …/Legendary_trinket · guildwars2.com news 2021 + 2016 · …/Infusion |
| R8 | World of Warcraft | Raid tiers ship per-difficulty looks (T16: Raid Finder / Normal+Heroic / Mythic); Mythic gets "a unique skin". Dragonflight: special effects on Mythic and Elite PvP sets, unlocked by Mythic / Elite / Keystone Hero achievements. V | warcraft.wiki.gg Tier_16 · engadget 2014-11-25 · wowhead news 329016 · warcraft.wiki.gg Gleaming_Incarnate_Thunderstone |
| R9 | MapleStory | Potential tiers outline the icon: Rare blue, Epic purple, Unique yellow, Legendary green. Star Force: gear at 23+ stars is "adorned with glittering stars". Medals are milestone titles shown with the name. V | maplestorywiki.net Potential · Star_Force · Medal |
| R10 | Old School RuneScape / RS3 | Infernal and fire capes are the only capes with an animated texture; trimmed skill capes "show that someone has more than one skillcape"; RS3 completionist cape leaves a particle trail. V | oldschool.runescape.wiki Infernal_cape · Skill_cape · runescape.wiki Completionist_cape |
| R11 | Path of Exile | Rarity shown by text colour; loot filters drive colours, beams of light, sounds and minimap icons for valuable drops. V | poedb.tw/us/Item · pathofexile.com/item-filter/about |
| R12 | League of Legends | "Silhouettes are the single most important thing for champion recognition"; skins never change a champion's primary characteristic. Skin tiers add, step by step, new model → animations + VFX + recall → voice-over → evolving forms. V | leagueoflegends.com dev "Clarity in League" (2021) · wiki.leagueoflegends.com Champion_skin |
| R13 | Guild Wars 2 / Diablo IV art leads | Silhouette is "the first and most important step" (Perry); "readability and how it looks are always our top priorities" (Mueller). V | wiki.guildwars2.com Kristen Perry interview · pcgamesn.com Diablo 4 artwork interview |

Not found (so not claimed): a developer quote about "reading a player's power from across the screen"; BDO glow at
+7/+15; Albion per-tier model changes; Lost Ark official honing thresholds; MapleStory Genesis-weapon aura.

## Principles borrowed (→ where they land in DESIGN.md)

| P | Principle | Evidence | Hearthfall |
|---|---|---|---|
| P1 | **Tier changes the silhouette, not only the colour.** Start barebones, end ornate. | R1, R7, R8, R12 | Every tier adds shape: spikes, raised plates, crests, crowns, charms, capes → mantles → wings (§2). |
| P2 | **Fixed identity core, escalating overlay.** The class read never changes. | R12, R1, R7 | Base body/class/weapon kind untouched; ornaments and effects layer on top (§2.1). |
| P3 | **Few, discrete, count-driven steps** that players can name. | R4, R7 (trinkets), R10, R9 (23 stars), R3 | 10 named tiers; temper steps at +4/+7/+10; Set layers at 2/4/6 pieces (§1, §3). |
| P4 | **A UI colour ladder separate from body effects.** | R5, R9, R11, R2 | Icon frames, tooltip tier strip, loot beams by tier (§5). |
| P5 | **Prestige on peripheral slots: back, feet, aura, trail.** | R7, R10, R3 | Back pieces, ground sigil, footprints, halo (§2.3–§2.5). |
| P6 | **Signature bundle per legendary item** (aura + footfall + trail…). | R7, R12 | Each Set / Legendary motif drives crest, particles, orbit token, footprints, idle flourish (§3, §4). |
| P7 | **Effect rarity tracks feat rarity.** | R8, R10, R5 | Wings / halo / sigil only from rank 6–8+, Primal heartbeat only with a Primal worn (§1.3). |
| P8 | **Player-controlled, readability first.** Effects showcase, never obscure; can be hidden. | R4 (eye toggle), R7, R13 | Settings full / reduced / off, own vs others, reduced motion, footprint-sized ground layers (§6). |
| P9 | **Progress badge beside the name.** | R3, R9 | Nameplate rank medal from rank 2 (§5). |
| P10 | **Ancient = orange marks, Primal = red marks** (players already read this from D3). | R2 | Ancient amber filigree/embers, Primal crimson + white core (§1.2). |
