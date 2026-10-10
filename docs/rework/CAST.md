# Cast bible (original) — who lives on the frontier, how they look, how they talk

Written by the lead for the world/UI pass so the NPC look presets, idle animations and quest objects match the
words already in the game (`shared/src/data/castMessages.ts`, `castDialogues.ts`, `barks.ts`, `questMessages.ts`).
Everything here is original. Look briefs are *starting points*: keep the chibi proportions and outline style of the
hero rig, but make each silhouette readable at gameplay size without the nameplate.

## Named people (quest contacts)

| Person | Where | Role | Voice | Look brief | Idle / prop |
|---|---|---|---|---|---|
| **Orren** | Rillwake Crossing | Mill tender | wry, understated, counts people | mid-40s, stocky, flat cap with a red band, rolled sleeves, leather apron, ink-stained thumbs | wipes hands on apron, glances up the road |
| **Iven** | Cairnspill Terraces | Surveyor | precise, dry, hates rounded numbers | lean, tall, sun-faded grey coat, wide-brim hat, chalk dust on knees | chalk line and plumb bob; sights along a rod |
| **Kessa** | Cinderwash Kilns | Firekeeper | young, jumpy, apologises to fires | slight, early 20s, soot-streaked cheeks, oversized gloves, singed braid, goggles pushed up | hugs a soot-black notebook; flinches at embers |
| **Venn** | Kilnwatch Crown | Watchkeeper | gravelly, deadpan, boiled sweets | broad, 60s, grey stubble, heavy wool watch-coat with brass buttons, one ear bandaged | offers a tin; leans on a long iron poker |
| **Sera** | Sablefen Causeway | Ferrier | cheerful, salty, sings, bad at sums | weathered, 30s, bright yellow oilskin, bare feet, rope belt, sun-bleached curls | coils a rope in time with a hum; boat pole |
| **Neris** | Saltwind Pans | Brine keeper | meticulous, sharp, speaks in numbers | narrow, 50s, grey bun, salt-white apron, spectacles on a cord, rake over one shoulder | ticks a tally slate with a stylus |
| **Aven** | Lockglass Cistern | Cistern keeper | stoic, long silences | tall, quiet, deep teal hooded cloak, pale hands, bare head, cropped silver hair | stands with head tilted, listening to the water |
| **Tallis** | Shiverline Escarpment | Ridge lookout | nervous, chatty, honest | wiry, 20s, wind-whipped hair, patched green cloak, mismatched mittens | signal flags in both hands; startles at gusts |
| **Mera** | Beaconbreak Ward | Ward quartermaster | brisk, clipboard, secretly generous | solid, 40s, ink-black braid pinned up, crimson ward sash, key ring the size of a fist | taps a wax tablet; scans the queue |
| **Eris** | Hollowstar Array | Western reader | dreamy, hears the signal as music | thin, 30s, pale lilac shawl, copper earring, barefoot on cold stone, headphones-like horn cups | sways softly; fingers keep a rhythm |
| **Daro** | Hollowstar Array | Eastern reader | blunt, sceptical, rival to Eris | square, 40s, dark brow, grey tunic with sleeves cut off, one horn cup on a strap | arms folded; taps a foot out of time on purpose |

## Hearthmere service people and places

| Role | Name on plate | Look brief | Place brief |
|---|---|---|---|
| Blacksmith | Blacksmith | huge forearms, bald with a braided beard, scorched leather apron, goggles | open forge under a stone chimney, glowing furnace, anvil, weapon racks outside, smoke column, hammer sounds |
| Jeweler | Jeweler | small, elegant, monocle, velvet waistcoat, white gloves | narrow shop with a striped awning, lit display window, gem-bright sign, tiny scales |
| Mystic | Mystic | hooded, patched star-print robe, floating runes orbiting one hand | crooked tent-tower, hanging charms, violet lantern, chalk circle, drifting motes |
| Stash | Stash | (no person) iron-bound chest guarded by a bored clerk with a ledger | vault-like warehouse with double doors, brass lamp, crates stencilled with numbers |
| Waypoint | Waypoint | (no person) | standing-stone ring with glowing runes in the middle of the square; the town’s light source |
| Cube | The Ancients’ Cube | (no person) | pedestal under a glass dome in an arcane workshop; reacts when the player is near |
| Rift Obelisk | Rift Obelisk | (no person) | cracked obelisk on a ruined terrace at the town edge, violet glow, fallen columns |
| Paragon shrine | Paragon shrine | pilgrims kneel beside it | walled garden with candles, water bowl, small bell |
| Training dummies | Training Dummy | straw and sacking, one wearing a helmet (elite) | yard by the gate with a rack of wooden swords and a scoreboard of chalk tallies |

### Ambient people (use as many looks as the art budget allows; all must read differently from the hero)

porter (heavy crates, stooped), lamp-worker (ladder, oil can), pilgrim (long robe, staff), innkeeper (apron, tray),
guard (helm, spear, tabard), fisher (hat, rod), child (small, excited, chasing a cat), bard (lute, feathered cap),
merchant (wide hat, cart or stall), scholar (stack of books, ink-stained). Animals: cat, dog, hens, gulls over water.
Lines for each are in `shared/src/data/barks.ts`.

## Quest objects (interaction `kind` → what it should look like)

| Kind | Meaning | Look |
|---|---|---|
| `person` | someone to talk to | a standing figure with a role prop and an `!`/`?` marker above |
| `cart` | wrecked cart or wagon | axle-deep in mud, scattered crates, broken wheel, root scars |
| `ledger` | readable record | open book on a crate or lectern, ribbon marker, soft page glow when readable |
| `marker` | survey stone / pennant | carved stone with chisel marks or a torn pennant on a pole |
| `mechanism` | lever / wheel / winch / valve | chunky iron wheel or lever on a stone housing; spins or clunks when used; glows when active |

All quest objects should have: a clear silhouette against the ground, a faint pulsing highlight while they are the
tracked objective, a short interaction animation, and a distinct "used" state (open book, pulled lever, cleared cart).
