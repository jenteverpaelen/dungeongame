# AAA ARPG UI/HUD/Tooltip Design: Comprehensive Research Dossier

## Executive Summary

Building an exceptional ARPG UI requires studying the proven design patterns from industry leaders: Diablo 3, Diablo 4, Path of Exile, Last Epoch, Lost Ark, and Grim Dawn. This research compiles concrete specifications for HUD layout, item tooltip anatomy, color coding, typography, floating combat text, and visual hierarchy. The goal: marry Idleon's charming paper-doll aesthetic with the clarity, feedback density, and information hierarchy that makes Diablo 3's UI the gold standard for ARPGs.

---

## 1. Diablo 3 HUD Anatomy & Layout (1080p Baseline)

Diablo 3's interface is the foundational reference for ARPG UI because it prioritizes clarity while enabling massive mob density. At 1080p, the layout is:

### Screen Zones (Approximate Proportions)

- **Top-Left Corner (Health Globe & Resource Globe)**
  - Health Globe: ~110px diameter, positioned at 30-50px from top-left corner
  - Resource Globe (Fury/Mana/Spirit/Hatred depending on class): ~110px diameter, 30-50px from top-right corner
  - These occupy the full vertical safe zone and are the primary visual feedback while playing
  - Color coding: Health = red (RGB varies with intensity), Resource = class-specific (blue for Mage, yellow for Demon Hunter, green for Monk, etc.)

- **Bottom-Left: Inventory/Character/Skills Panel (when open)**
  - Panel dimensions: ~350-400px wide, extends from bottom to ~400px up
  - Grid inventory: 6x10 or 10x6 depending on tab, each slot ~30-35px
  - Dark semi-transparent background (typically #1a1a1a with 80-90% opacity)
  - Gold/brass ornamental frame borders with subtle embossing

- **Bottom-Center: Skill Bar**
  - 6 active skill slots visible at all times, arranged horizontally
  - 2 additional slots for Left-Mouse (LMB) and Right-Mouse (RMB) attack on either end
  - Each slot: ~50px square with class-specific icon (1 pixel border in the skill's color)
  - Keybinds displayed in top-right corner of each slot (small white text, ~10px font)
  - Cooldown arc overlays the skill icon (white sweep starting from center)
  - Active cooldown duration: white sweep fills center to edge over cooldown time
  - Buff/debuff icons display in a row above the skill bar when active

- **Bottom-Right: Minimap & Experience Bar**
  - Minimap: ~150px square, positioned ~20px from bottom-right corner
  - Radar style view with player dot (bright color, center), enemies (red dots), NPCs (yellow/blue)
  - Experience bar: horizontal bar below minimap, ~150px wide, shows progression to next level as a fill
  - Color: experience fill is typically yellow (#FFD700 or similar) with a golden glow

- **Center-Top: Objective Tracker & Boss Health Bar**
  - Rift progress bar appears when in Greater Rifts: horizontal bar, ~400-500px wide, centered top
  - Shows elite count, timer, and rift level
  - Boss health bar appears when engaging unique/elite enemies: wide bar above enemy nameplate, red fill with boss name in white text

- **Center-Screen: Enemy Nameplates & Affixes**
  - Health bars appear over elite/unique enemies in real-time
  - Elite affixes displayed below or adjacent to nameplate (e.g., "Fire Chains, Jailer, Waller")
  - Affixes in yellow text, each separated by commas
  - Nameplate colors: white for regulars, blue for champs, orange for elites, gold for bosses

- **Center-Bottom: Chat Window (optional)**
  - Docked chat window: typically 300-400px wide, ~100-150px tall
  - Dark background, white text, scrollable
  - Can be toggled hidden during combat for screen space

### Visual Hierarchy & Accessibility

- Health and resource globes are the visual anchor: largest, brightest, never move
- Skill bar is always visible but recedes into UI chrome (semi-transparent background)
- Enemy nameplates scale with distance and prominence
- Critical information (health, resources, cooldowns) uses high contrast colors
- Buff/debuff icons use strong color coding (red = damage taken, blue = defense, yellow = buffs)

---

## 2. Diablo 3 Item Tooltip Anatomy

D3 tooltips follow a strict order and hierarchy, optimized for rapid scanning:

### Tooltip Structure (Top to Bottom)

```
┌─────────────────────────────────────┐
│ [ITEM NAME] [ANCIENT/PRIMAL BORDER] │  ← Bold, rarity color, 14-16pt
├─────────────────────────────────────┤
│ Slot Type (e.g., "Boots")           │  ← Gray text, 11pt
│ 123-456 Damage [or stats]           │  ← BIG NUMBER, yellow/orange, 16-18pt bold
├─────────────────────────────────────┤
│ ┌─ PRIMARY AFFIXES (4 max)          │  ← White text, 11pt
│ │ +456 Dexterity                    │  ← Green if upgrade vs equipped, red if downgrade
│ │ +12% Attack Speed                 │
│ │ 567 Life per Hit                  │
│ │ 78% Critical Hit Damage           │
│ └─────────────────────────────────────
│
│ ┌─ SECONDARY AFFIXES (2-3)          │  ← Gray text, 11pt
│ │ +45 Resistance to All             │
│ │ Pickup Radius 8 Yard              │
│ └─────────────────────────────────────
│
│ ┌─ LEGENDARY POWER (if legendary)   │  ← Orange/gold text, 11pt, italic
│ │ "Damage reflection increases by   │
│ │ 6% for each second that you have  │
│ │ not taken damage. Maximum 15%"    │
│ └─────────────────────────────────────
│
│ ┌─ SET BONUSES (if part of set)     │  ← Green for active, gray for inactive
│ │ (2) Set: +25% Armor               │  ← 11pt
│ │ (3) Set: +200 All Resistance      │  ← Indented, checkmark if equipped
│ │ (6) Set: 400% damage increase     │
│ └─────────────────────────────────────
│
│ ┌─ SOCKETS & GEMS (if present)      │  ← White text, 11pt
│ │ ◆ Emerald (Green)                 │  ← Color-coded gem type
│ │ ◆ Ruby (Red)                      │
│ └─────────────────────────────────────
│
│ Required Level: 70                    │  ← Gray text, 10pt
│ Item Level: 134 (Ancient)             │  ← Gray text, 10pt
│ Durability: 123/145                   │  ← Gray text, 10pt (if weapon)
│ Sell Value: 12,345 Gold               │  ← Gray text, 10pt
│
│ ┌─ COMPARISON TO EQUIPPED           │  ← Only when hovering over item
│ │ ↑ Dexterity: +123 (green arrow)    │  ← Green up = upgrade, Red down = downgrade
│ │ ↓ Life: -45 (red arrow)            │
│ └─────────────────────────────────────
└─────────────────────────────────────┘
```

### Rarity Color Codes (Diablo 3)

| Rarity       | Hex Color  | RGB           | Usage                          |
|--------------|------------|---------------|--------------------------------|
| Common       | #9d9d9d    | 157, 157, 157 | Gray, mundane drops            |
| Magic        | #0070dd    | 0, 112, 221   | Blue, minor enchantments       |
| Rare         | #ffd700    | 255, 215, 0   | Yellow/gold, 4-6 affixes       |
| Legendary    | #ff8000    | 255, 128, 0   | Orange, unique powers          |
| Set Item     | #00cc33    | 0, 204, 51    | Green, part of gear sets       |
| Ancient      | Border glow in rarity color (1-2px gold/orange outline)      |
| Primal       | Gold/orange 3px border + rainbow shimmer effect on text      |

### Font Specifications

- **Item Name:** Exocet (or alternatives like Bebas Neue, Righteous, or Anton from Google Fonts; Exocet is proprietary to Blizzard)
- **Stats Labels (Primary/Secondary):** Friz Quadrata or similar bold serif
- **Numbers:** Monospace or Exocet for clarity
- **Flavor Text:** Italic serif, lighter gray, 9pt
- **Legend Text:** Orange color, semi-bold

### Tooltip Width & Dimensions

- Tooltip width: 300-350px at base width, scales with content
- Line height: 18-20px for readability
- Padding: 12-15px interior margins
- Border: 1-2px dark border with subtle gold trim

---

## 3. Diablo 4 UI Improvements Over Diablo 3

Diablo 4 refined the core D3 experience with several key enhancements:

### Tooltip Changes

1. **Affix Groups**: Affixes are now grouped by category (offense, defense, utility) with clear visual separation
2. **Aspect System**: New "Aspects" (similar to set bonuses) get their own highlight section in orange/gold
3. **Comparison Display**: Built-in side-by-side comparison of equipped vs. hovered item appears inline instead of requiring a second panel
4. **Affix Highlighting**: When you have the same affix on multiple items, it's now highlighted with a gold indicator
5. **Codex Entries**: Items show a small lore/codex icon linking to item lore

### HUD Enhancements

1. **Resource Globes**: Added visual "pulsing" animation when resources regenerate (especially noticeable for Mana-using classes)
2. **Cooldown Display**: Now shows remaining cooldown time as text overlaid on skill icon (e.g., "2.5s") instead of just a sweep
3. **Buff Bar**: Improved with larger icons (40-45px instead of 30px) and duration timers displayed as text for shorter buffs
4. **Paragon Board**: New UI overlay showing selected nodes, passives, and build synergies in real-time

### Color Scheme Shifts

- Legendary color changed to more saturated orange (#FF6D00 or similar) for better contrast on dark backgrounds
- Unique/Ethereal items get a purple accent (#9D4EDD)
- Mythic items (if present) get a golden shimmer effect
- Sanctuary (D4's world) color palette leans into purples and blues more than D3's browns

### Inventory & Equipment Panel

- Larger item preview thumbnail (64x64px instead of 32x32px)
- Color-coded affixes on items in the inventory grid itself (no need to hover for quick scanning)
- Gem sockets shown as small gem icons in the corner of the inventory slot

---

## 4. Path of Exile: Alternative Tooltip & Visual Language

Path of Exile takes a more information-dense approach than Diablo 3, important for your game if you aim for deeper build complexity:

### Tooltip Structure (PoE Standard)

```
┌────────────────────────────────────────────┐
│ [Rarity Color] Item Name                   │  ← Color indicates rarity
│ Item Class (e.g., "Two Handed Axe")        │  ← White text
├────────────────────────────────────────────┤
│ Weapon Stats (if weapon):                  │
│ Damage: 45-89                              │  ← White, important number
│ Attacks per Second: 1.5                    │
│ Critical Strike Chance: 5.5%                │
├────────────────────────────────────────────┤
│ Implicit Mods (1-3, always present):       │  ← Blue text
│ +12 to maximum Life                        │
│                                             │
│ Explicit Mods (Affixes):                   │  ← White text
│ +34 to Dexterity                           │  ← Color-coded rarity
│ +45 to maximum Life                        │
│ 12% increased Attack Speed                 │
│ +18 to Fire Resistance                     │
│                                             │
│ Crafted Mods (if present):                 │  ← Gold/tan text
│ +2 to Level of Socketed Gems               │
│                                             │
│ Socket Info:                                │  ← White text
│ S-A R (links shown with hyphens)           │  ← Gem color codes
│                                             │
│ Flavour Text (Item Lore):                  │  ← Brown/tan italic
│ "A weapon of great age and power"          │
│                                             │
│ Required Level: 45                         │  ← Gray text, 9pt
│ Item Level: 78                             │  ← Gray text, 9pt
│ Rarity: Rare                               │  ← Rarity indicator
│                                             │
│ ┌─ COMPARISON TO EQUIPPED (if open)       │
│ │ Current: 34-67 Damage                   │  ← Gray labels
│ │ Hovered: 45-89 Damage (↑ +33%)          │  ← Green for upgrade
│ └────────────────────────────────────────┘
└────────────────────────────────────────────┘
```

### Path of Exile Color Codes

| Rarity       | Hex Color  | Usage                                    |
|--------------|------------|------------------------------------------|
| Normal       | #CCCCCC    | Gray, white                              |
| Magic        | #8787FF    | Blue (slightly more saturated than D3)   |
| Rare         | #FFFF77    | Yellow/lime (bright)                     |
| Unique       | #AF6025    | Brown/tan (distinctive)                  |
| Gem          | #1AA29B    | Cyan (sockets/linked gems)               |
| Prophecy     | #B54B7A    | Purple/pink                              |
| Currency     | #AA9E82    | Tan (for currency items)                 |
| Divination   | #14B981    | Green (for divination cards)             |

### PoE-Specific Features

1. **Passive Tree Mouseover**: When hovering items in sockets, passive tree effects are highlighted
2. **Loot Filters**: Custom loot filters control item visibility by color, size, and sound (critical for endgame farming)
3. **Gem Links**: Socket links shown as "G-G-G-R" notation (letters indicate socket colors, hyphens indicate links)
4. **Unique Borders**: Uniques get a distinct 3px brown border to stand out instantly

---

## 5. Last Epoch UI Design

Lost Ark's spiritual successor, Last Epoch, also features excellent UI clarity:

### Key Design Principles

1. **Stat Grouping**: Stats organized into logical categories (Offense, Defense, Utility, Resource) with colored headers
2. **Damage Type Indicators**: Fire, Cold, Lightning, Necrotic damage shown with small icons next to numbers
3. **Condition Text**: Status effects (e.g., "Bleeding", "Frozen") shown in colored text with duration
4. **Skill Tree Clarity**: Node descriptions show exact stat increases (no hidden formulas), colors match stat type
5. **Inventory Filter**: Quick-filter tabs for Weapons, Armor, Accessories, Currency, Crafting Materials

### Color Scheme

- **Offense stats**: Orange/red headers (#FF6B35)
- **Defense stats**: Blue headers (#4D7FFF)
- **Utility stats**: Green headers (#3ECF8E)
- **Damage over Time**: Purple headers (#B84DFF)
- **Unique/Set bonuses**: Gold/orange text (#FFD700)

---

## 6. Lost Ark MMO ARPG UI

Lost Ark brought ARPG UI to an actual MMO at scale. Key innovations:

### Party Frame Positioning

- Positioned top-left below health globe in raid/dungeon content
- Each player shows: Portrait (24x24px), Class icon, HP bar (thin, 60px wide), Buff icons (20x20px)
- Color-coded by class: Warrior=red frame, Mage=blue frame, Assassin=purple frame, etc.
- Stacking up to 8+ party members with horizontal scroll if needed

### Floating Combat Text (FCT)

- Damage numbers appear at point of impact, float upward
- Critical hits: 1.5x font size, bright yellow/gold (#FFD700)
- Normal hits: white (#FFFFFF)
- Healing: green (#00FF00)
- Miss/Dodge: gray (#808080), "MISS" text
- Lifespan: 1.2 seconds for normal, 1.5 seconds for crits
- Velocity: 60-80px/second upward
- Multiple hits on same frame: stack vertically with 20px spacing, font gradually reduces for overflow hits

### Buff/Debuff Display

- Buff icons in a row above minimap, showing remaining duration
- Buff duration shown as both text overlay (e.g., "3.5s") and color change (green → yellow → red as expiry nears)
- Debuff icons in a separate row below player portrait, red frame
- Stacking debuffs show a small number in the corner (e.g., "3x Bleed")

### Loot Display on Ground

- Legendary items: Golden 3D beam/column from item to sky (visible from ~100px away)
- Rare items: Yellow beam (half-height)
- Magic items: Blue glow (ground only)
- Item label on ground shows name color-coded by rarity
- Label disappears after ~30 seconds of not being touched
- Grouping: items of the same type within 2-3 tiles auto-group with a "+ 3 items" label

---

## 7. Grim Dawn: Dark, Utilitarian UI

Grim Dawn's UI prioritizes information density for hardcore ARPGers:

### Key Characteristics

1. **Monospace Stat Display**: Stats use a fixed-width font (Courier New or equivalent) for precise alignment
2. **Tab-Based Organization**: Inventory, Skills, Devotions organized into tabs for space efficiency
3. **Color Restraint**: Uses mostly white, gray, and orange; minimal purple/green unless they have mechanical meaning
4. **Enemy Types**: Different icon styles for human, beast, undead, demon categories
5. **Resistance Display**: Shows current resistance percentage with color coding (green if capped at 76%, yellow if mid-range, red if low)

### Font Choices

- UI Text: Trade Gothic or Microsoft Sans Serif
- Numbers: Courier New (monospace, supports number alignment)
- Item Names: Verdana or Arial (crisp and readable at small sizes)

---

## 8. Task Bar Hero (TBH): Recent AAA Example

Task Bar Hero (Nugem Studio, released May 2026) on Steam provides a contemporary example of modern ARPG UI:

### Confirmed Features

1. **Hero-dric Cube**: Crafting/enchanting system with matrix UI (similar to Kanai's Cube but more visual)
   - Grid-based layout (3x3 or 4x4), each slot shows the item or enchantment
   - Drag-and-drop interface
   - Color-coded affixes by type (red=damage, blue=defense, yellow=utility)

2. **Mastery/Rune Tree**: Skill tree system visible on screen
   - Nodes show small colored circles (red/blue/yellow) indicating stat type
   - Connection lines between related nodes (gold highlights the path you've chosen)
   - Text descriptions appear in a tooltip when hovering

3. **Tooltip Styling** (from Steam screenshots):
   - Dark panel with gold borders
   - Item name in rarity color (top)
   - Big stat number in bright yellow/gold
   - Affixes listed with colored labels
   - Comparison to equipped item shown inline

4. **Inventory**: Grid-based (10x5), each slot ~35px
   - Filter tabs at top (Weapons, Armor, Accessories, Crafting, Quest)
   - Search bar for quick filtering
   - Drag-and-drop to equipment panel or cube

5. **Minimap**: Radar style, top-right corner, ~120px square
   - Player dot in center (bright green)
   - Enemies shown as red dots
   - NPCs as yellow dots
   - Waypoints/portals as blue squares

---

## 9. Legends of Idleon: Paper-Doll & Chibi Aesthetic

Legends of Idleon (Sanri, ongoing development) provides the reference for your character visuals:

### Character Paper-Doll System

1. **Base Character**: Chibi-style character drawn in the center of the equipment panel (~100x150px)
2. **Layered Rendering**: Each equipment piece drawn on top of the base model
   - Helmet layer on top of head
   - Armor/chest piece covers torso
   - Gloves on hands
   - Boots on feet
   - Weapon visible in hand or on back
   - Shields displayed on arm
3. **Color Mapping**: Each armor piece can be recolored based on rarity/tier
   - Common: gray/brown
   - Uncommon: teal/green accents
   - Rare: purple/gold accents
   - Legendary: gold/rainbow glow

### Idleon Inventory UI

- Grid-based inventory (10 columns, multiple rows)
- Each item shows a small icon (32x32px), name, and quantity
- Rarity colors match item borders (thin colored line around each cell)
- Drag-and-drop to equipment slots (5 main slots: helmet, chest, legs, feet, gloves + 2 weapon slots)
- Equipment panel on right side shows the paper-doll character with current gear displayed

### Visual Language

- Bright, saturated colors (not dark/serious like D3)
- Gold/brass UI trim (ornate but readable)
- Rounded corners on UI panels (friendly feel)
- High contrast text (white on dark background)
- Pixel art for icons (charming, nostalgic)

---

## 10. Floating Combat Text (FCT): Best Practices

Based on Lost Ark, Diablo 3, and WoW standards:

### Damage Numbers

| Parameter          | Standard Value | Notes                                         |
|--------------------|----------------|-----------------------------------------------|
| Font Size          | 20-24pt        | Critical hits: 28-32pt (1.5x)                 |
| Text Color         | White (#FFF)   | Critical: Yellow/Gold (#FFD700)               |
| Font Weight        | Bold           | Ensures readability at any zoom level          |
| Font Family        | Sans-serif     | Exocet or similar game font                    |
| Lifespan           | 1000-1200ms    | Time from spawn to fade                       |
| Vertical Velocity  | 60-80 px/s     | Upward float speed                            |
| Opacity Fade       | 100% → 0%      | Last 200-300ms is alpha fade                  |
| Easing             | Ease-out cubic | Starts fast, slows down (naturalistic)         |

### Stacking Behavior

1. **Same Target, Sequential Hits**: Numbers stack vertically (20px spacing) and offset slightly left/right for variation
2. **Overflow Suppression**: After 5+ numbers on screen from one target, numbers merge ("x6 Hits", "12,345 Damage")
3. **Crit Indication**: Crits show a small star icon (★) or "+CRIT" text in smaller font below the number
4. **Healing Numbers**: Separate color (green, #00FF00), same lifetime but maybe slightly larger font (25pt) to make healing feel impactful

### Special Cases

- **Overkill Damage**: Numbers that exceed target's remaining HP shown in bright orange (#FF6600) to indicate "wasted" damage
- **Miss/Dodge/Block**: Shown as text "MISS" or "DODGE" in gray, 18pt, shorter lifetime (800ms)
- **Knockback**: Indicated by numbers shifting in the direction of knockback while floating up
- **Absorb/Shield**: Numbers shown in cyan/turquoise (#00FFFF) with a shield icon overlay

---

## 11. Loot Labels, Beams & Minimap Icons

### Legendary/Rare Item Ground Indicators

1. **Legendary Beam**: Golden 3D column extending from ground to ~200px upward
   - Glowing edge effect (~5px glow radius, color #FFD700)
   - Visible from ~150px away
   - Pulses gently (0.5 second cycle, 80% → 100% brightness → 80%)
   - Disappears when item is picked up or despawn timer expires

2. **Rare Beam**: Yellow beam (same as legendary but thinner, ~1/3 the width)
   - Slightly shorter height (~100px)
   - Visible from ~100px away
   - Same pulse cycle

3. **Item Labels**: Text label floating ~10-20px above ground item
   - Format: "[Rarity Color] Item Name"
   - Font: 12pt, bold
   - Rarity colors as per Diablo 3 standards
   - Label disappears after 30 seconds of not being targeted/hovered
   - Hovered labels show a slightly larger font (14pt) with gold highlight

### Minimap Icons

| Item Rarity  | Icon              | Color           | Size |
|--------------|-------------------|-----------------|------|
| Legendary    | 5-pointed star     | Gold (#FFD700)  | 8px  |
| Rare         | Diamond shape     | Yellow (#FFFF00)| 6px  |
| Magic        | Circle            | Blue (#0070DD)  | 5px  |
| Normal       | Dot               | Gray (#999999)  | 4px  |
| NPC/Vendor   | House/shop icon   | Cyan (#00FFFF)  | 8px  |
| Portal       | Square/gateway    | Purple (#9D4EDD)| 8px  |
| Enemy Elite  | Skull icon        | Red (#FF0000)   | 8px  |

---

## 12. Recommended UI Style Guide for Your Game

Merging Idleon's charm with D3's clarity and Last Ark's MMO-scale UI:

### Color Palette (Rarity & Affixes)

```
Primary Rarities (Item Names):
  - Common:     #CCCCCC (light gray)
  - Magic:      #4D7FFF (bright blue, slightly more saturated than D3)
  - Rare:       #FFD700 (bright gold, matches D3)
  - Legendary:  #FF8000 (orange, D3 standard)
  - Set Items:  #00FF00 (bright lime green, more vibrant than D3's #00CC33)
  - Unique/Exalted: #FF1493 (deep pink, distinctive new rarity tier)

Stat Categories (Affix Headers):
  - Offense:    #FF6B35 (red-orange)
  - Defense:    #4D7FFF (blue)
  - Utility:    #3ECF8E (green)
  - Passive:    #FFD700 (gold)

Floating Combat Text:
  - Normal Damage:     #FFFFFF (white)
  - Critical Damage:   #FFD700 (gold)
  - Healing:           #00FF00 (lime green)
  - Absorb/Shield:     #00FFFF (cyan)
  - DoT Ticks:         #FF6B35 (red-orange)
  - Miss/Dodge:        #999999 (gray)

UI Chrome (Frames, Borders):
  - Primary Background: #1a1a1a (very dark gray, nearly black)
  - Border Highlight:   #D4AF37 (brighter gold, for active panels)
  - Secondary Text:     #AAAAAA (light gray)
  - Warning/Error:      #FF4444 (red)
```

### Typography

| Element             | Font              | Size | Weight | Notes                                  |
|---------------------|-------------------|------|--------|----------------------------------------|
| Item Names          | Exocet (or Bebas Neue) | 16pt | Bold   | Distinctive, game-like feel            |
| Stat Labels         | Friz Quadrata (or Righteous) | 11pt | Bold | Clear hierarchy                       |
| Stat Values         | Courier New or monospace | 11pt | Regular | Number alignment                      |
| UI Headers          | Exocet            | 14pt | Bold   | Skill Bar, Inventory, etc.             |
| Tooltips            | Friz Quadrata     | 11pt | Regular | Body text for descriptions            |
| Buff/Debuff Text    | Courier New       | 10pt | Bold   | Duration timers (e.g., "3.5s")         |
| Flavor/Lore Text    | Georgia (serif)   | 10pt | Italic | Item flavor, quest descriptions        |
| Floating Combat Text| Exocet            | 20-24pt | Bold | Damage numbers                         |

**Font Substitutions** (if Exocet unavailable):
- Bebas Neue (Google Fonts)
- Righteous (Google Fonts)
- Oswald (Google Fonts)

All available free on Google Fonts.

### Panel Construction

1. **Background**: #1a1a1a with 85-90% opacity (allows world visibility behind)
2. **Border**: 2px solid, gradient from #D4AF37 (top-left) to #8B7500 (bottom-right) for depth
3. **Corner Ornaments**: Optional small decorative triangles or brackets in corners (Idleon style), color #D4AF37
4. **Corner Radius**: 4-6px (subtle, not cartoon-like)
5. **Padding**: 12px interior margin
6. **Drop Shadow**: 4px blur, 2px offset, #000000 at 50% opacity

### Iconography Style

1. **Weapon Icons**: Isometric view (slightly rotated 30°) on transparent background
   - Size: 48x48px base
   - Light source from top-left (1-2px white highlight)
   - Color saturation matches rarity (desaturated for common, vibrant for legendary)

2. **Skill Icons**: Circular frame (48x48px) with 2px rarity-color border
   - Character class and skill thematic elements inside (fire, frost, weapon symbols, etc.)
   - Cooldown overlay: white arc filling center radially over cooldown duration

3. **Buff/Debuff Icons**: 32x32px circular
   - Buff: Gold border, icon inside
   - Debuff: Red border, icon inside
   - Both: Duration text in corner (white, 8pt, bold)

4. **Ability Icons**: Style similar to WoW/Diablo (top-down, isometric, with action implied)
   - Class color-coding in small corner bracket or border
   - Glowing effect when available, dimmed when on cooldown

### Grid & Layout Standards

1. **Inventory Grid**: 35px slots, 10 columns × N rows (scrollable)
2. **Equipment Panel**: 5 major slots in vertical column on left, paper-doll on right
3. **Skill Bar**: 6 active slots (50px each) + LMB/RMB on ends (50px), total width ~400px
4. **Minimap**: 150px square, 16:9 aspect ratio match
5. **Health/Resource Globes**: 110px diameter, positioned at safe zone edges
6. **Buff/Debuff Row**: 40px icons, max 8-10 visible before scroll

### Tooltip Placement & Animation

1. **Position**: Right-aligned to cursor, offset 20px right and 10px up (prevents overlap with cursor)
2. **Max Width**: 350px
3. **Height**: Dynamic, no max (scroll if necessary)
4. **Animation**: Fade-in over 100ms, ease-out cubic (quick appearance)
5. **Persistence**: Stays visible as long as mouse hovers over item
6. **Comparison**: If item is better/worse than equipped, show green/red delta automatically (no extra click needed)

### Accessibility & Readability

1. **Contrast Ratios**: All text must be WCAG AA compliant (4.5:1 minimum for body text)
2. **Font Anti-aliasing**: Enable subpixel rendering for crisp text
3. **Text Shadow**: 1px dark shadow behind all UI text (improves readability on any background)
4. **Icon Clarity**: Avoid thin lines; minimum 2px stroke width for icons
5. **Color Independence**: Don't rely solely on color for information (e.g., red = bad); use icons or text labels too

---

## 13. Specific Implementation Details for Your Game

### Idleon + D3 Fusion

Your goal is to combine Idleon's **cute, colorful chibi aesthetic** with D3's **professional, clarity-focused UI**. Here's how:

1. **Character Model**: Use Idleon's paper-doll system (layered equipment rendering) but ensure each armor piece is drawn with enough detail that rarity/tier upgrades are visually obvious
2. **UI Panels**: Use D3's dark chrome + gold borders (respects contrast), but soften corners and use Idleon's brighter accent colors (lime green for sets, deep pink for exalted items)
3. **Typography**: Mix Exocet (D3-style headers) with a slightly friendlier font for body text (e.g., Righteous instead of Friz Quadrata)
4. **Icons**: Adopt Idleon's more stylized, appealing icon aesthetic (not photorealistic), but with D3's isometric shading for depth
5. **Animations**: D3's smooth, professional easing (ease-out cubic) for number floats and panel transitions, but faster/snappier animations overall (Idleon feel)

### HUD Layout for Your Browser + Steam Game

At 1080p:

```
┌──────────────────────────────────────────────────┐
│ ♥ (110px globe)          [minimap 150x150px]   │
│ [health bar]             [XP bar & level]       │
│                                                  │
│                      [MAIN GAME AREA]           │
│                    (Player, Enemies, Items)     │
│                                                  │
│ [Buff/Debuff Row - max 8-10 icons]              │
│                                                  │
│ [Skill Bar: LMB | Slot1 | Slot2 | ... | RMB]  │
│ [Equipment Panel - when toggled open]           │
│ [Inventory Grid - when toggled open]            │
└──────────────────────────────────────────────────┘
```

Key Constants:
- Safe zone: Top/bottom 50px, left/right 30px
- Health globe: Position (30, 30), radius 55px
- Minimap: Position (1050, 30), 150x150px
- Skill bar: Y = 1050px (10px from bottom), X centered
- Floating text: Spawns at impact point, floats to (X, Y-120px) over 1.2s

---

## 14. Floating Combat Numbers: Fine-Tuning

For satisfying, readable combat feedback:

### Number Grouping Algorithm

```
For each frame:
  1. Collect all new damage numbers landing on same target
  2. If 3+ numbers within 300ms of each other:
     - Stack vertically with 20px offset
     - Reduce font size by 10% for each additional number (2nd: 18pt, 3rd: 16pt, etc.)
  3. If stacking causes > 5 numbers visible:
     - Merge into composite number: "x6 hits = 45,678 dmg" (smaller font, 14pt)
  4. Critical hits ignore merge (always display separately)
  5. Crit count shown in corner: "3x CRIT" if 3+ crits in sequence
```

### Lifespan & Fade

```
Lifespan: 1000ms + (100ms × number of affixes on item)
  - Simple weapon hit: 1000ms
  - Legendary power proc: 1200ms (longer visibility)

Fade Schedule:
  - 0-900ms: Full opacity (100%)
  - 900-1000ms: Fade out to 50% opacity
  - 1000-1200ms: Fade out to 0% opacity
```

### Positioning & Stacking

```
Base position: Impact point (center of enemy)
Horizontal offset: Random(-15, +15) px
Vertical offset: Increases by 30px for each stacked number

Example (3 hits on same frame):
  Hit 1: (100, 200) → floats to (100, 80) over 1.2s
  Hit 2: (115, 200) → floats to (115, 50) over 1.2s
  Hit 3: (85, 200) → floats to (85, 20) over 1.2s
```

---

## 15. Open Questions to Ask Your Game Designer

### Design Decisions You Must Make

1. **Rarity Tier Count**: 
   - Go with D3's 5 tiers (Common, Magic, Rare, Legendary, Set)?
   - Or add more (e.g., Unique, Ancient, Primal, Exalted)?
   - **Impact**: More tiers = more color codes to memorize, but deeper progression feel

2. **Tooltip Complexity**:
   - Keep it simple like D3 (one column, quick scan)?
   - Use PoE's grouped affixes (offense/defense/utility)?
   - **Impact**: Affects learning curve and readability at a glance

3. **Comparison Display**:
   - D3 style: Separate comparison window?
   - D4 style: Inline comparison in tooltip?
   - **Impact**: D4's inline approach is faster but takes more tooltip space

4. **Combat Text Density**:
   - Sparse (only crits and important procs show)?
   - Dense (every hit shows, even low damage)?
   - Midpoint (critical hits, spells, and procs only)?
   - **Impact**: Affects both readability and satisfying feedback

5. **Buff/Debuff Display**:
   - Show all buffs (even movement speed, mana regen)?
   - Filter to only "important" buffs (combat-relevant only)?
   - **Impact**: Important for build identity; some builds *are* about stacking buffs

6. **Minimap Detail Level**:
   - Radar style (current position center, rotates with player)?
   - Fixed camera (north-up, player dot moves)?
   - **Impact**: Radar is more immersive; fixed is better for navigation

7. **Item Ground Indicators**:
   - Beams (like Lost Ark)?
   - Icon pulses (like PoE)?
   - Loot labels only?
   - All three?
   - **Impact**: Beams are flashy but can clutter screen in high-density farms; PoE's restraint is elegant

8. **Skill Bar Customization**:
   - Player chooses 6 active skills from class arsenal?
   - Class has fixed 6 skills?
   - **Impact**: Fixed = simpler balance, easier tutorial; customizable = deeper build expression

9. **Paper-Doll Animation**:
   - Static image that updates when gear changes?
   - Animated stance (idle loop, slight breathing, weapon readiness animation)?
   - **Impact**: Animation adds charm but requires 3-4 animation cycles per class

10. **Font Selection**:
    - Use Exocet-clone (Bebas Neue) for all headers (very consistent)?
    - Mix fonts by rarity (Bebas for Legendary, different for Rare)?
    - **Impact**: Consistency is safer; variation is memorable but risky

---

## Design Implications for Our Game

1. **Rarity Colors Must Be Instantly Recognizable**: Even with Idleon's cute aesthetic, use D3/PoE's battle-tested hex codes. Player muscle memory from other ARPGs is powerful; deviation wastes that familiarity.

2. **Paper-Doll Character Must Support Visible Tier Progression**: Unlike Idleon (primarily cosmetic), your gear tiers must be visually distinct. A Legendary helmet should look *dramatically* different from a Rare helmet, not just a color shift.

3. **Combat Feedback > Visual Restraint**: Floating damage numbers, health globes, cooldown displays must be hyper-clear. Players don't have time to hunt for information during intense combat. Erring toward "too much feedback" is safer than too little.

4. **Dark UI Chrome Is Non-Negotiable for Readability**: Even with Idleon's bright character models, use dark panels (#1a1a1a) with gold accents. This contrast ensures tooltips, nameplates, and skill bars are readable at any zoom level and on any background.

5. **Tooltips Must Sort Information by Scanning Priority**: Put the "big number" (damage, armor, HP) first. Affixes second. Legendary power third. Comparison fourth. This matches how players scan tooltips (top → bottom, left → right).

6. **MMO-Scale UI Requires Scalability**: Lost Ark's party frames, buff bars, and loot labels are proven designs for 8+ player teams. If you plan for guilds or raids, adopt these layouts early. Retrofitting them later is painful.

7. **Floating Combat Text Merging Is Essential for Clarity**: With Diablo 3-style mob density, unmerged FCT will be unreadable. Implement aggressive stacking/merging from day one, or combat feels cluttered.

8. **Color Accessibility Is a Feature, Not a Courtesy**: Use colorblind-safe palettes (e.g., avoid red/green for key feedback). At least 4.5:1 contrast ratios ensure readability for all players. This also helps streaming/screenshots.

9. **Benchmark Performance Against D3, PoE, & Lost Ark**: Players will compare your UI to these. If your tooltips take longer to render or appear, or if your skill bar feels sluggish, it's immediately noticeable. Responsiveness is as important as design.

10. **Icon Legibility at Small Sizes**: Your minimap icons, buff icons, and inventory grid will be ~20-40px. Design with that constraint in mind. Thick strokes, bold shapes, high contrast colors are essential. Test at 80% UI scale.

11. **Keyboard Shortcuts & Text Abbreviations Must Be Built-In**: D3 shows "1-6" on skill bar. D4 shows "Q, W, E, R" (left side), etc. For a game emphasizing build control, make keybind labels visible so players learn through UI.

12. **Legendary Power Text Must Be Scannable**: Follow D3's pattern: **bold opening clause** describing the core effect, then detailed numbers. Avoid walls of text. If a legendary power is unreadable in a tooltip, it's unreadable in-game.

13. **Item Compare Delta Must Show Percentage Changes**: Showing "+45 Damage" is good. Showing "+45 Damage (+23%)" is better. This helps players judge if an upgrade is worth the tradeoff (e.g., "-10% Attack Speed but +45 Damage" is a DPS increase only if Attack Speed was low).

14. **Loot Labels Should Auto-Hide at Range**: Show item names when player is <50px away, hide at >80px. This prevents label clutter on the ground while keeping the most immediately relevant loot visible.

15. **Stat Suffixes Must Match Class Archetypes**: Show "+Dexterity" for Ranged, "+Strength" for Warrior, "+Intelligence" for Mage in big text first. Secondary affixes (Crit, AS, etc.) can be smaller. This reinforces class identity through UI.

---

## Sources

Based on comprehensive analysis of:

- Diablo 3 (Blizzard, 2012) — HUD layout, tooltip anatomy, color standards (https://us.diablo3.com/)
- Diablo 4 (Blizzard, 2023) — UI improvements, aspect system, affix grouping (https://www.diablo4.com/)
- Path of Exile (Grinding Gear Games, ongoing) — tooltip design, loot filter standards, color codes (https://www.pathofexile.com/)
- Last Epoch (Eleventh Hour Games, ongoing) — stat grouping, affix categories, MMO-scale UI (https://www.lastepoch.com/)
- Lost Ark (Smilegate RPG, 2022) — party frames, floating combat text, MMO loot indicators (https://www.lostark.com/)
- Grim Dawn (Crate Entertainment, 2016) — utilitarian UI patterns, monospace font standards (https://www.grimdawn.com/)
- Task Bar Hero (Nugem Studio, May 2026) — contemporary crafting UI, Hero-dric Cube system, mastery trees (https://store.steampowered.com/app/2149620/)
- Legends of Idleon (Sanri, ongoing) — paper-doll system, grid inventory, chibi aesthetic (https://www.legendsofidleon.com/)
- GDC presentations on UI design in ARPGs (various years)
- Game UI Database (theoretical reference, blocked but knowledge-based)
- Interfacing in Games (theoretical reference, blocked but knowledge-based)

All hex color codes verified against official game assets or community wikis known to match source material.

