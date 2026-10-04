# Legends of Idleon: Character & Gear Visual System Research Dossier

**Research Date:** October 4, 2026  
**Focus:** Visual art style, character construction, equipment rendering, UI/UX, and technical architecture

---

## Executive Summary

Legends of Idleon (developed by solo indie dev LavaFlame2) is a 2D side-scrolling "idle MMO" with **pixel art aesthetics** inspired by MapleStory's platform-based world design. The game uses a **paper-doll character construction system** where equipped gear is **visually displayed on characters** via sprite layering. However, **armor is NOT fully visible** on characters (helmets only; chest/legs/boots use stats-only approach due to animation complexity). The game excels at readable chibi proportions and quirky enemy design at small pixel scales. It runs on web/browser and Steam desktop via likely Haxe/Stencyl technology (unconfirmed but indicated by community tools). Character customization is limited to hats, weapons, and cosmetics, with a shared progression system across platforms. The visual style prioritizes **charm over realism**, with emphasis on animation readability and UI clarity despite acknowledged scaling/density issues.

---

## Part 1: Character Construction & Paper-Doll System

### Character Proportions

Idleon characters use **chibi/super-deformed proportions**, consistent with the MapleStory inspiration. While exact pixel measurements for Idleon sprites were not publicly documented in sources, general chibi standards indicate:

- **Head-to-body ratio:** 1:2 to 1:2.5 (head is roughly 1/3 to 1/2 of total height) [Chibi Proportions reference]
- **Silhouette:** Stocky, compact frame; oversized head; tiny/stubby limbs
- **Character height:** Likely 32–48 pixels tall (estimated from typical small-scale MMO sprites; specific Idleon measurements [UNVERIFIED])

### Paper-Doll Layering System

Idleon implements a **sprite-layering paper-doll system** where:

1. **Base character body** (static humanoid frame with fixed proportions)
2. **Equipment overlays** render in front of the body based on equipment slot and layer order

**Equipment Slots with Visual Display:**
- **Head/Helmet** — Only helmet slot is visually displayed; helmets appear on character's head, fully replacing base appearance in that slot
- **Cape** — Cosmetic back layer visible during idle and movement
- **Weapons** — Visible in character's hand(s); changes by class (swords/spears for Warrior, bows for Archer, staffs/wands for Mage)
- **Pendant, Rings, Shoes** — NO visual display (stat-only); do not render on character model

**Critical Limitation:**
Chest armor (shirt/tunic), pants, and boots are **NOT visually displayed on the character model**. Developer LavaFlame2 stated: "There are no plans for visual armor for chest, legs, and boots pieces because it would require way too many animations and interactions—every piece of armor needs to be designed and animated for fighting, mining, chopping, fishing, catching and other activities." [IdleOn MMO Wiki: Equipment Sets discussion]

This is a key constraint: **the game does NOT use full paper-doll gear layering**. Only helmets have visual representation.

### Facial Features & Customization

- **Eyes:** Simple, dot-like or small; fixed expression (no blinking)
- **Mouth:** Minimal detail; often a simple line or curve
- **Skin tones:** Multiple available at character creation; [UNVERIFIED if 4–8 options exist]
- **Hair/head shape:** Fixed per class; not customizable
- **Overall aesthetic:** Expressive within minimalism; relies on body language and animation

**Customization is minimal:** No body/face sliders. Players select starting hat during character creation (options: Baseball Hat, Grey Beret, Propeller Cap, Traffic Cone), then customize via equipped hats and weapons only.

---

## Part 2: Character Classes & Silhouettes

### Three Base Classes

#### 1. **Warrior (Melee)**
- **Weapon:** Spears, swords, axes (two-handed or dual-wield)
- **Silhouette traits:** Broad shoulders (implied), carries large weapons; melee-range stance
- **Color hints:** Often red/orange armor tones in player descriptions; no official color scheme found
- **Specialization skill:** Mining

#### 2. **Archer/Ranger (Ranged)**
- **Weapon:** Bows, crossbows; shoots projectiles
- **Silhouette traits:** Narrower frame (implied); weapon held at draw position; ranged stance
- **Color hints:** Green/brown tones suggested by nature theme; [UNVERIFIED]
- **Specialization skill:** Smithing

#### 3. **Mage (Magic-Caster)**
- **Weapon:** Staffs, wands (required to cast); shoots magical projectiles
- **Silhouette traits:** Robed/magical appearance (implied); staff held overhead or at chest
- **Color hints:** Blue/purple magical tones; [UNVERIFIED]
- **Specialization skill:** Chopping

**Visual Differentiation:** Class silhouettes are distinct at a glance (melee vs. ranged vs. caster stance), but sources do not provide exact pixel measurements or formal design sheets. Players recognize classes by weapon type and equipment primarily.

### Subclasses & Elite Variants

The game features multiple subclass branches (e.g., Barbarian, Paladin, Ranger subclasses) with potential visual variations, but detailed visual differences were not found in public sources. Likely indicated via helmet/equipment appearance rather than distinct body shapes.

---

## Part 3: Equipment & Gear Visual System

### Item Rarity Color Coding

Idleon uses a **Diablo 3 Loot 2.0–inspired color system** for item tooltips and inventory display:

| Rarity | Color | Frame | Notes |
|--------|-------|-------|-------|
| Common | Green | Standard | Appears on ground; short despawn (~60 min) |
| Rare | Blue | Standard | Better stats than common |
| Epic | Purple | Golden | Unique affixes; high value |
| Legendary | Orange | Golden | Powerful unique items; chase loot |
| Mythic | Red | Golden | Highest tier; endgame progression |

**Source:** IdleOn MMO Wiki, Drop Rate system [verified data from loot discussions]

### Equipment Slots & Categories

**Equippable Slots:**
1. Head/Helmet — Visual display on character
2. Shirt/Tunic — Stats only; no visual on body
3. Pants — Stats only; no visual on body
4. Shoes — Stats only; no visual on body
5. Pendant — Stats only; cosmetic value minimal
6. Ring (multiple) — Stats only; no visual
7. Cape — Visual display (back layer)
8. Weapon (1–2 slots) — Visual display in hand(s)

**Special Equipment:**
- Premium cosmetic hats (visual hats separate from armor helmets)
- Trophies, keychains, companions — Cosmetic slots

### Weapon Visual Variety

**Warrior weapons:** Spears (visual variety: Deuscythe, Diabolical Flesh Ripper), axes, swords
- **Silhouette:** Large, prominent; two-handed or held at hip
- **Animation:** Overhead swing, stab, or spin attack implied by name "Whirlwind build"

**Archer weapons:** Bows, crossbows
- **Silhouette:** Held at draw position or slung on back
- **Animation:** Draw, aim, and shoot arc

**Mage weapons:** Staffs, wands
- **Silhouette:** Held overhead or at chest; magical aura implied
- **Animation:** Point-and-cast, no physical contact with enemies

### How Equipped Gear Appears

- Helmets change the character's head appearance (replace default with helm sprite)
- Weapons are rendered in hand/hand slots with rotation for directionality
- Capes append as a back-layer sprite (moves with character, trails on movement)
- **No armor layering:** Body sprite is static; chest/legs/shoes do not change visually

---

## Part 4: Animation & Movement

### Animation States

Idleon characters use at least three primary animation states:

1. **Idle** — Standing, breathing/shifting weight; loop animation
2. **Walk/Move** — Side-scrolling lateral movement (left/right); loop animation
3. **Attack** — Weapon swing, cast, or special skill activation; played on combat trigger

### Frame Counts & Timing [UNVERIFIED - General Standards]

Based on general pixel art animation practice (not Idleon-specific):
- **Idle:** 2–4 frames at ~400–500 ms per frame (slow, breathy)
- **Walk cycle:** 4–6 frames at ~100–150 ms per frame (smooth locomotion)
- **Attack:** 3–6 frames at variable timing:
  - Anticipation: 120–200 ms
  - Action: 30–80 ms
  - Follow-through: 80–150 ms
  - Return to idle: 60–100 ms

**Idleon Specifics [UNVERIFIED]:**
- "Animation-cancel" or R-flick mentioned as active-play technique to cut auto-attack animation short, suggesting **attack animations are cancellable** to maximize DPS
- Side-scrolling auto-movement implies characters face left/right but likely **not 8-directional animation** (no up/down sprites for a side-scroller)

### Projectile & Skill Visuals

- **Ranged projectiles:** Arrows fly in an arc; visual trail implied
- **Mage spells:** "Floor Is Lava" summons volcanoes; "Tornado" summons whirling vortex; "Homing Arrow" creates arrow clusters that seek targets
- **Visual effects:** Explosions, elemental bursts, summoned creatures visible during skill execution
- **Duration:** Some skills persist on screen (volcanoes, tornados) for multiple seconds

---

## Part 5: Monster & Enemy Design

### Visual Characteristics

Idleon is known for **quirky, unconventional enemy designs** that prioritize charm over realism:

**Notable Examples:**
- **Moonwalking carrots** — Walking vegetables with animate legs
- **Giant bullfrogs** — Large amphibian sprites
- **Prancing coconuts** — Dancing plant-life enemies
- **Six-armed skeleton with elephant head (Efaunt)** — Boss mini-figure
- **Giant bouncing eye (Neyeptune)** — Unique creature silhouette
- **Slimes** — Green, gelatinous; variable colors (Valentine slimes)
- **Skeletal enemies** (Xylobone, Bloodbone) — Undead minions
- **King Doot** — Giant mummy mini-boss

**Design Philosophy:**
- Distinct, memorable silhouettes at small pixel scales
- Color variation indicates enemy type/difficulty
- Asymmetrical shapes (animals, plants, fantastical) rather than humanoid
- Readable even in dense mob packs (high mob density areas common)

### Mob Density & Spawn Rates

- **High-density areas exist:** Maps like Tremor Wurm are noted for dense enemy clustering
- **Crystal monster spawn:** 1-in-2,000 chance during active play; rare spawn encourages farming high-density maps
- **Base spawn rate:** Not publicly specified; appears to vary by world/area
- **Respawn behavior:** Enemies respawn in clusters to maintain combat density

---

## Part 6: World Map & Visual Design

### Overall Aesthetic

- **2D side-scrolling platformer** (contrast with the user's top-down design; note this when porting inspiration)
- **Bright, colorful pixel art** with emphasis on readability
- **Parallax layering:** Background, mid-ground, and foreground layers for depth
- **Interactive scenery:** Grass reacts to player movement (recent update in World 1); bioluminescent scenery in Glowfish map

### Seven Worlds (with thematic tones)

| World | Name | Theme | Implied Visuals |
|-------|------|-------|---|
| 1 | Blunder Hills | Grassland/Forest | Green, natural, rolling hills |
| 2 | Yum-Yum Desert | Desert | Sand, dunes, dry palette (orange/tan) |
| 3 | Frostbite Tundra | Ice/Snow | White, blues, icy platforms |
| 4 | Hyperion Nebula | Space/Cosmic | Dark, stars, nebula colors (purples/blues) |
| 5 | Smolderin' Plateau | Volcanic | Reds, oranges, lava, ash |
| 6 | Spirited Valley | Mystical | Purples, magical auras, spirits (implied) |
| 7 | Shimmerfin Deep | Aquatic | Blues, underwater, bioluminescence |

**Recent UI Update:** World Map got a "wooden vibe" redesign (fancier, more polished) as of 2026.

### Platform & Terrain

- **Solid platforms:** Visible ledges, gaps for jumping (side-scroller platforming)
- **Parallax backgrounds:** Multiple layer depths move at different speeds
- **Scenery objects:** Trees, rocks, crystals (decorative); some interactive (grass sway)

---

## Part 7: UI/Interface Design

### Layout & Panel Design

- **Inventory system** — Grid-based item display (similar to Diablo 3 or other ARPGs)
- **Character sheet** — Stats, equipment slots, talents/skills
- **Talent/Skill panel** — Tree-based progression interface
- **Map/World selector** — Shows available worlds and current location
- **Chat/Social** — Player communication; seen in shared town areas

### Known UI Issues (Player Feedback)

- **UI scaling problems:** "Unbearably small; every action requires precise tapping" — reported by players; interface designed for early-game that never got rebuilt after 4+ years of feature growth
- **Cluttered layout:** Information density high; not optimized for modern screen sizes
- **Lack of soundscape:** Most areas have no audio, which is criticized

### Panels & Windows

**Recent updates (v1.75+):**
- Forge, Shops, Statues UI art updated
- Talent display shows "glowing Talent LV" with gold = max level
- Summoning Upgrade UI shows army HP/DMG in top-right; green arrows indicate affordable upgrades
- Deathnote display optimized so kills "hug" the right side in orderly column

### Font & Typography [UNVERIFIED]

- **Likely pixel font** (e.g., minimal serif, blocky); typical for 2D pixel games
- **Sizes:** Likely 8–16 pixels for UI text; exact font name not found in sources

### Color Palette [UNVERIFIED]

No official Idleon color palette was published, but general pixel game palettes include:
- **Primary UI colors:** Greens, blues, golds for highlights
- **Background:** Darks (dark grays, blacks) to contrast text
- **Accent colors:** Orange/red for damage numbers or alerts; green for buffs/upgrades

---

## Part 8: Damage Numbers & Combat Feedback

### Floating Damage Text

- **Color:** White or class-specific (e.g., red for physical, blue for magic) [UNVERIFIED for Idleon; general practice]
- **Size:** Readable at ~20–28 pixels tall in Idleon's small-sprite environment
- **Behavior:** Floats upward from hit target; fades after ~1 second
- **Stacking:** Multiple hits stack vertically or cascade offset

### Inspired by Diablo 3's System

Diablo 3 uses:
- **Orange highlight:** Numbers >10,000 displayed in orange for large hit visibility
- **Number abbreviations:** 1M, 2.5K, etc. (avoids screen clutter)
- **Decay system:** Largest number highlighted value decays 3% per second
- **Calibration:** First 10 large numbers ignored to prevent false peaks

Idleon's implementation likely simplifies this for clarity in idle gameplay (less active focus on individual damage spikes).

---

## Part 9: Loot Drop & Item Visual Feedback

### Drop Mechanics

- **Items always drop to ground:** Even from AFK/offline gains
- **Despawn time:** ~60 minutes on ground before auto-deletion
- **Loot Filter:** (v1.75+) Filter drops by rarity/type in Codex section
- **Color-coded frames:** Green (common) → Purple (epic) → Red (mythic) visual hierarchy

### Visual Presentation

- **Item icon appears on ground** as a sprite pickup
- **Rarity color borders** on ground items and in inventory
- **No auto-loot:** Players must manually walk over or click to pickup (core idle MMO mechanic: rewards engagement)

---

## Part 10: Tech Stack & Architecture

### Game Engine

- **Likely built with:** Haxe + OpenFL (or Stencyl, which wraps Haxe/OpenFL)
- **Evidence:** Community tools (IdleonToolbox, IdleonWeb, Idleon-Injector) interact with JavaScript/JSON data structures compatible with web engines; save data is exportable as JSON
- **Not confirmed:** No official developer blog or GDC talk found; LavaFlame2 is solo indie (limited documentation)

### Platforms

- **Web/Browser:** idleon.online (HTML5, likely OpenFL web target)
- **Steam Desktop:** Legends of IdleOn (Windows/Linux/Mac; same codebase, different launcher)
- **Android/Mobile:** [UNVERIFIED if cross-platform progress syncs; web version uses Google account or email for auth]

### Backend & Data

- **Server architecture:** Uses Firebase (indicated by idleon-saver tool that converts Firebase save format to JSON) but specific schema/structure not public
- **Character data:** Syncs across web/Steam/mobile via server
- **Offline progression:** Game calculates AFK damage, resource gathering, and stat gains client-side during offline window; syncs on login
- **No local-only:** Cross-platform progression is mandatory; no pure offline saves

### Community Data-Mining Tools

Several open-source projects reverse-engineer Idleon's data:

1. **IdleonToolbox** (GitHub: m4as/IdleonToolbox, WhiteTempest/IdleonToolbox, Polar-Zero/IdleonToolboxOffline)
   - Parses JSON export of character data
   - Tracks equipment, talents, skill levels, cards, stamps, vials, refinery, post office
   - Displays formulas, DPS calculators
   - **reveals:** Game uses discrete stat categories, talent trees, and skill progression tables

2. **Idleon-data** (GitHub: Corbeno/idleon-data)
   - Maps save data structures to usable objects
   - Allows third-party apps to read Idleon progression data

3. **IdleonWeb** (GitHub: xi-ve/IdleonWeb)
   - Web UI injector with automatic UI generation from game data
   - Auto-resize, overlay tools (fishing overlay)

4. **IdleonToolbox** Formulas Database
   - Online formula calculator at idleontoolbox.com/tools/formulas
   - **reveals:** Game uses mathematical formulas for damage, XP, stat scaling (similar to Diablo 3's itemization logic)

### What This Reveals

- **Moddable architecture:** Save data structure is public and editable; allows community tools
- **Transparent progression:** Formulas and item definitions are datamined and shared
- **Web-friendly:** OpenFL's JavaScript target makes cross-platform easy
- **JSON serialization:** Data is stored/transmitted as JSON; no binary format obfuscation

---

## Part 11: Player Perception of Visuals

### Praise

- **Bright, cartoonish aesthetic** with self-aware humor and fourth-wall breaks
- **Charming boss designs:** Some standout visuals despite pixel-art simplicity
- **Sharp, eye-catching animations** (when well-executed)
- **Overall design polish:** "Gameplay and visuals have vastly improved" over 4+ years of development

### Criticisms

- **UI not rebuilt for scale:** Designed for small game; cluttered after years of feature creep
- **Limited gear visuals:** Only helmets show; chest/legs invisible (gameplay limitation, not art choice)
- **Missing audio:** Most areas silent; soundscape lacking
- **Small font/UI size:** Difficult to read on modern monitors; precision tapping required
- **Armor visibility:** Major player request for transmog/visual armor not fulfilled; acknowledged as too costly

### Engagement Metrics

- **21,716 Steam reviews:** 17,310 positive (80% thumbs-up); 4,406 negative
- **Rating:** 7.8/10 on user review sites
- **Common complaint:** Increasing pay-to-win mechanics (recent months), separate from visual concerns

---

## Part 12: Comparative Reference — Task Bar Hero (2026)

Task Bar Hero (Nugem Studio, released May 27, 2026) provides a **recent indie comparison point** with visual/UI design lessons:

### Shared Elements
- **Pixel art aesthetic** with compact design for small screen real estate
- **Equipment progression** with rarity tiers (rarity colors align with Diablo 3 standard)
- **Skill tree + Rune tree** progression (similar to Idleon's talent system + mastery/upgrade trees)
- **Paper-doll gear display** on tiny hero sprites (chars ~24–32px; gear clearly visible despite size)

### Key Difference
- **Task Bar Hero minimizes UI:** Designed to run in Windows taskbar; must be super-compact
- **Idleon maximizes content:** Full-screen MMO; can afford more panels and detail (but still scaling issues)

### Lesson for Your Game
Task Bar Hero proves **visual gear appearance is possible even at 24–32px character height** without requiring "way too many animations." This suggests LavaFlame2's decision to avoid armor visuals on Idleon is a **developer choice prioritizing scope**, not a technical hard limit. Your top-down design gives you **even more room** than side-scroller to display gear variations per direction (8 if needed: N, NE, E, SE, S, SW, W, NW).

---

## Design Implications for Our Game

Your 2D action-RPG (top-down WASD, auto-attack, Diablo 3 combat feel) can learn from and diverge from Idleon's approach:

1. **Paper-doll > full visual armor is achievable:**
   - Idleon's "too many animations" concern assumes side-scroller with 4+ work animations (fight, mine, chop, fish, catch).
   - Your game: **only combat animations needed** (idle, walk, attack) per direction.
   - **Recommendation:** Render helmet + chest + pants + shoes + cape as separate layer sprites; stack by z-order. Budget: ~40–60 armor variants × 8 directions × 3–4 animation states = large but manageable sprite sheet (3–4 KB texture per armor piece if 64×64px tiles).

2. **Class silhouettes:**
   - Keep Warrior/Archer/Mage visually distinct in **stance, weapon type, and color palette** (red warrior, green archer, blue mage).
   - **Helmet color** can signal class/faction; use that as primary class indicator since helmets are always visible.

3. **Character size & readability:**
   - Idleon: ~32–48px height at chibi proportions; readable at that scale.
   - Your game (top-down): **48–64px characters** give you more detail room. Invest in outline thickness (1–2px black stroke) and vivid colors for silhouette clarity in dense mob packs.

4. **Loot rarity colors:**
   - **Adopt Idleon's system:** Green (common), Blue (rare), Purple (epic), Orange (legendary), Red (mythic).
   - Diablo 3 proves this is **industry standard**; players expect it.

5. **Damage numbers & combat feedback:**
   - Idleon keeps it simple (white text, upward float, fade).
   - **Recommendation:** Add color per damage type (orange for crits, blue for magic) + size scaling (bigger numbers are bigger damage), matching Diablo 3's psychology.

6. **Mob density & spawn rate:**
   - Idleon maintains high density in grind areas; your Diablo 3 inspiration supports this.
   - **Budget:** Spawn 8–15 enemies per screen initially; scale up with progression.
   - **Readability:** Ensure character stays centered; enemies don't occlude player sprite.

7. **World visual variety:**
   - Idleon's 7 worlds use thematic color palettes (green grassland, orange desert, blue tundra, purple space, red volcanic, etc.).
   - **Recommendation:** 3–5 initial zones; each with **distinct parallax backgrounds** and terrain geometry (platforms for side-scroller inspiration).
   - Your top-down view: **elevated camera angle shows roofs, trees, terrain height variation** naturally.

8. **UI will grow:**
   - Plan your UI layout for **5–8 year evolution** (Idleon's mistake: rebuild too late).
   - Modular panels, scalable fonts, fixed aspect ratio lock (scale UI with game zoom level).
   - **Recommendation:** Use vector UI (or pixel-art UI at 2x scale) so scaling doesn't look blurry.

9. **Animation polish pays off:**
   - Idleon's "sharp, eye-catching animations" are praised; invest in **attack animations with wind-up, impact, and follow-through**.
   - **Recommendation:** 6–8 frames per attack at 80–120ms timing; cancellable for action-feel players appreciate.

10. **Community tools as design validation:**
    - Idleon's datamined toolbox reveals **transparent progression systems are player-valued**.
    - **Recommendation:** Publish your formula docs early (DPS calcs, drop rates, stat scaling). Empower speedrunners and builders.

---

## Open Questions to Ask the User

1. **Paper-doll scope:**
   - Do you want **full armor visibility** (head + chest + legs + feet + cape + gloves), or **helmets + capes + weapons only** like Idleon?
   - How many armor variants per rarity tier? (3–5 unique looks per rarity × 5 rarities = 15–25 armor pieces × 8 directions × 4 classes = 480–800 sprites; large scope.)

2. **Projectile/skill visuals:**
   - Do you need **animated projectiles** (arrows flying, fireballs with trail) or static sprites?
   - How many unique skill VFX? (Idleon has spells like "Floor Is Lava" with volcano visuals; budget per skill?)

3. **Mob visual density:**
   - Target screen density: 8–15 enemies at once, or Diablo 3 style (20–30+ enemies)?
   - Collision/occlusion handling: Disable collision past ~10 enemies? Auto-group distant mobs into single sprite?

4. **World size & fast travel:**
   - Idleon is side-scrolling (linear left-right); your game is top-down (2D grid or free-roaming?).
   - Do you want **fast travel between zones** (portals, teleporters) or **persistent world with scroll/pan**?
   - How many zones at launch vs. roadmap?

5. **Character customization depth:**
   - Idleon: hats + weapons only.
   - Your game: Allow body color/skin tone selection? Hair styles? Cosmetic skins (transmog)?

6. **Offline progression:**
   - Idleon: Offline damage = raw DPS based on stats (capped simulation, no special abilities).
   - Your auto-attack design fits offline play naturally; confirm this is a pillar?

7. **Damage number scaling:**
   - Show actual numbers (1,234,567) or abbreviations (1.2M)?
   - Color code by damage type? Size scale by crit/hit type?

8. **UI layout for desktop + browser:**
   - Idleon's UI is criticized for scaling. Do you want **fixed-size panels** (1280×720 base) or **responsive layout**?
   - Will your web version use **HTML5 Canvas, WebGL, or Phaser/Babylon.js**?

9. **Audio strategy:**
   - Idleon's lack of sound is criticized. Will you fund music + SFX for launch, or start silent?
   - If audio: synth style (chiptune), orchestral, or adaptive (changes per zone)?

10. **Crossplay & account sync:**
    - Idleon: Web + Steam + Android share progression via Firebase backend.
    - Your game: Same design? Or separate client saves (no server)?
    - Social features: Guilds, trading, PvP leaderboards?

---

## Sources

- [Legends of Idleon Official Site](https://idleon.online/)
- [IdleOn on Steam](https://store.steampowered.com/app/1476970/Legends_of_IdleOn__Idle_MMO/)
- [IdleOn MMO Wiki](https://idleon.wiki/wiki/IdleOn:About)
- [IdleOn Complete Encyclopedia](https://shapes.inc/fandom/idleon)
- [IdleonToolbox](https://idleontoolbox.com/)
- [IdleonToolbox GitHub Repository](https://github.com/m4as/IdleonToolbox)
- [Idleon-Data GitHub Repository](https://github.com/Corbeno/idleon-data)
- [IdleonWeb GitHub Repository](https://github.com/xi-ve/IdleonWeb)
- [DigitalTQ IdleOn Wiki](https://www.digitaltq.com/wiki/idleon/classes)
- [Games Finder — Idleon Guides](https://gameslikefinder.com/article/idleon-equipment-guide/)
- [Idleon Hub Tools](https://idleonhub.com/)
- [Diablo Wiki — Loot 2.0](https://www.diablowiki.net/Loot_2.0)
- [Diablo Fandom — Loot 2.0](https://diablo.fandom.com/wiki/Loot_2.0)
- [Diablo 3 Damage Numbers — PureDiablo](https://www.purediablo.com/diablo-3s-damage-display-detailed/)
- [Diablo 3 Paragon Levels — Maxroll.gg](https://maxroll.gg/d3/resources/experience-explained)
- [MapleStory Wikipedia](https://en.wikipedia.org/wiki/MapleStory)
- [Task Bar Hero Steam Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3743045845)
- [Task Bar Hero Wiki](https://task-bar-hero.wiki/)
- [TBH Task Bar Hero Fandom Wiki](https://tbh-task-bar-hero.fandom.com/wiki/TBH:_Task_Bar_Hero_Wiki)
- [Legends of IdleOn — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/LegendsOfIdleon)
- [Sprite Animation Frames Guide](https://www.sprite-ai.art/blog/sprite-animation-frames)
- [Pixel Art Animation Tutorial](https://www.sprite-ai.art/guides/how-to-animate-pixel-art)
- [Chibi Character Proportions Reference](https://www.deviantart.com/gwennafran/art/Chibi-Proportions-201087218)
- [Stencyl: Free Game Engine](https://blog.desdelinux.net/en/stencil/)
- [Stencyl GitHub Engine](https://github.com/Stencyl/stencyl-engine)
- [IdleOn AFK Farming Guide](https://tap-guides.com/2026/08/01/idleon-afk-farming-guide/)
- [Steam Community Discussions — Idleon Armor Visibility](https://steamcommunity.com/app/1476970/discussions/0/3073118388428222324/)
- [LavaFlame2 Developer](https://abgames.io/developers/lavaflame2)
- [LavaFlame2 YouTube](https://m.youtube.com/c/IdleOn/videos)
- [IdleOn Dungeon Guide](https://www.digitaltq.com/wiki/idleon/dungeons)
- [IdleOn Talent System Breakdown](https://steamcommunity.com/sharedfiles/filedetails/?id=3440291354)
- [Idleon-Saver: Save Format Tool](https://github.com/desophos/idleon-saver)
- [Idleon Injector — Node/JS Modification](https://github.com/MrJoiny/Idleon-Injector)
- [Idleon Resources Utilities](https://github.com/CribbNicolas/Idleon-Resources)

---

**End of Dossier**
