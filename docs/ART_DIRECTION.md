# Hearthfall — Art Direction

**One line:** cozy storybook diorama, dangerous edges. Cute, chunky Idleon-style heroes and monsters
with thick warm-ink outlines, standing on a calm, painterly ground, framed by a dark bronze Diablo 3 UI.
Everything is vector-drawn in code (`client/src/render/art/`), baked once to textures, never noisy.

Sources: `docs/research/01-idleon-visuals.md` (chibi proportions, readable silhouettes, gear on the doll —
we go further than Idleon and show *every* armour slot), `02-d3-combat-feel.md` / `11-juice-dopamine.md`
(hit flash, death styles, density), `10-ui-design.md` + `client/src/ui/styles/tokens.css` (UI frame).

---

## 1. Pillars

1. **Silhouette first.** Every character must read as a black shape at 64 px: class by head/hat +
   weapon, gear tier by how much the outline changes (horns, pauldrons, robes, quivers, staves).
2. **One ink.** A single warm near-black outline `#1B1410` on everything that stands up. Never pure black.
3. **Three tones, not gradients.** Flat base, one cool shade band (lower right), one soft warm highlight
   (upper left). Light comes from the upper left; mirrored characters simply flip it.
4. **The ground whispers, the cast shouts.** Grounds are mid-value and low-contrast with soft edges;
   characters and monsters are saturated with hard outlines, so they always pop.
5. **Glow means loot.** Additive light is reserved for magic: legendary/set gear, spells, fire, rifts,
   elites. A glowing thing is always important.

## 2. Palette

| Role | Hex | Notes |
|---|---|---|
| Ink (outline) | `#1B1410` | 2.5 u on characters, 3 u on props, theme-tinted 1.4 u on ground decals |
| Highlight mix | `#FFF4D6` | warm cream, ~30-45 % |
| Shade mix | `#2A1830` | cool plum, 22-32 % |
| Blush | `#FF8F7E` @ 45 % | every friendly face, tiny |
| Gold / bronze | `#E8B64A` / `#B4783A` | crowns, buckles, the Cube — matches UI `--gold #C9A45C` |
| Set glow | `#3CFF6E` | from item data |
| Champion rim | `#4F9DFF` | blue, pulsing |
| Rare rim | `#FFC93C` | gold, pulsing; minions get it at 40 % |
| Boss rim + aura | `#FF4A2A` | red rim, red ground aura |

**Class underclothes** (what shows in empty slots) — warrior rust `#A5503A`, ranger moss `#5D8240`,
mage cobalt `#4462AD`; hair: warrior chestnut spikes, ranger blue-black ponytail, mage silver long hair.

**Themes** (ground floor / path / wall top / liquid):

| Theme | Floor | Path / plaza | Wall mass | Liquid | Mood |
|---|---|---|---|---|---|
| Town (Hearthmere) | grass `#86AD5C` | cobbles `#B8AD97`, road `#C2A476` | forest `#3C5A34` + pines | pond `#5AA8C4` + lily pads | warm, safe, lantern-lit |
| Glade | grass `#6EA14F` | dirt `#A98D5F` | forest `#2C4628` + fruit trees | water `#4A9EAA` | lush, mossy |
| Ashen | charcoal `#5A4F49` | broken flagstones `#665A52` | basalt `#2C2628` + cliff faces | lava `#FF7A22` | soot + ember cracks `#FF7A1A` |
| Rift · glade | cave teal `#3C6B66` | — | rock `#1C3236`, crystals `#6FF2FF` | glow-water | cold, bioluminescent |
| Rift · ashen | red stone `#5E3330` | — | rock `#2A1416`, lava spires | lava | hot, hostile |

## 3. Proportions (character = 64 world units, feet at y = 0)

* **Head 30-32 u (~47 %)**, centre at y = -46, rx 16 / ry 15, face turned to +x (3/4 view).
* **Torso 21 u**, a soft bell (17 u wide at the shoulders, 21 u at the hem); **legs 12 u**, stubby;
  **arms 10.5 u**, one segment, round 3.4 u hands. Hats, horns and staves may rise to 76 u.
* Eyes: two tiny ovals (1.75 × 2.75 u) with a white glint, 7 u apart, slightly below head centre. No
  mouth on heroes (Idleon); monsters get mouths, brows and fangs — that is what makes them enemies.
* Monsters: trash 34-52 u tall, big trash (golem, brute) ×1.5, elites ×1.08-1.16, bosses ×2.6-3 and
  crowned. Outlines thicken only with √scale so big things stay crisp, not heavy.

## 4. Construction & shading rules

* Paper doll back→front: back hair / hood tail / mantle cape → quiver → back arm (+ hand) → back
  pauldron → legs (back leg 20 % darker) → torso (chest + belt/sash) → off-hand (shield/orb, drawn in front
  of the torso on the back side) → head (face, hair, headgear) → front arm → weapon → front hand → front
  pauldron → fx. The far limbs are always darker.
* Every solid shape: shade fill, inset base fill scaled toward an upper-left light anchor (leaves a
  2-3 u shade band), soft highlight, outline last. Hair gets two short "shine" arcs (never the single gloss
  oval used for metal). Metal gets a hard gloss oval + rivets; cloth gets fold creases; leather gets stitches.
* Ground decals never use the ink outline; they use the theme's `decalInk` so they sit *in* the ground.

## 5. Gear readability & rarity

* Every base `shape` changes the silhouette: `helm_horned` adds horns, `wizard_hat` a flopped cone
  (+10 u), `hood` a cowl and tail, `spiked` 3 spikes, `plate` pauldrons widen the shoulders, `robe` turns
  the legs into a bell, `quiver` pokes fletchings above the shoulder, staves rise above the head, 2-hand
  weapons rest on the shoulder, shields cover the back half of the torso.
* `primary` = material, `secondary` = trim. Rarity reads through trim and light, not new shapes:
  **normal** muted material palettes (shields get a heraldic face), **magic** blue trims `#5A7DFF`,
  **rare** gold trims `#D4B13A` (+ red heraldry), **legendary/set** custom colours, emissive trims, a soft
  additive aura behind the piece, one slow twinkle, a glowing weapon edge and a tinted swing trail.
  Three or more glowing pieces add a full-body shimmer. Set pieces' twinkles drift upward (green motes).
* Icons reuse the same drawings posed for a cell (weapons on the 45° diagonal, helms hollow, gloves,
  pauldrons, pants, belts and circlets as dedicated poses) with a soft rarity glow behind legend/set items.

## 6. Animation principles

* Everything breathes: idle bob/scale on a 1.6 s sine, blinking every 2-5 s, hair/cape lag.
* Walk: legs ±25° at 8 steps/s scaled by speed, 2 u bob, counter-swinging arms, 3° forward lean.
* Attacks are **anticipation → snap → recover** timed to `aps`: melee 35 % wind-up / 20 % strike /
  45 % recover with a crescent trail following the blade arc; bows draw and release with a live string and
  nocked arrow; crossbows kick; staves raise and thrust; wands flick.
* Whirlwind (`F_CHANNEL`): paper-cutout spin (body `scale.x = cos θ`, 2.4 rev/s), arms out, two orbiting
  steel arcs. Cast: arms up and a small stretch. Dash: 15° lean, legs split. Stun: orbiting stars.
  Frozen: pose freezes and tints `#8FD0FF`; chill slows anims and tints `#C4E4FF`.
* Hits: 70 ms (crit 90 ms) pure white silhouette + 8-10 % squash. Dummies wobble on a spring instead.
* Deaths: players topple and fade (600 ms). Monsters by element — physical squash-pop, fire chars black then
  crumbles, cold vanishes on an icy flash (vfx shards), lightning flickers, poison melts, arcane/holy fade up.
* Monsters each have a personality: slimes hop and squash, mushrooms waddle, bats flap fast, sprouts
  sway and spit, golems/brutes lumber and slam (`F_WINDUP` = visible wind-up + red pulse), imps bounce,
  skeletons jitter, cultists glide, wisps flicker and swell before exploding, goblins sprint with a
  bouncing sack and glinting coins.

## 7. World

* Ground = 512-unit chunks painted with Canvas2D: soft terrain field (noise-perturbed masks), crisp
  vector detail (concentric cobbles + hearth mosaic in the round town square, road cobbles, broken
  flagstones, grass flicks, lily pads, cliff strata, ember seams) and stamped decals, all baked once.
* Walls are masses, not tiles: forests (town/glade) are dark undergrowth under a row of trees; ashen and
  rift walls are plateaus with a lit rim and a 26 u cliff face, casting a soft shadow down-right.
* Props: chunky, outlined, warm (houses with glowing windows and smoke, tavern sign, forge glow,
  lanterns, campfire). Light sources get additive glows that flicker gently; nothing else moves.

## 8. Monster design language

Round, soft shapes with **one hostile cue** each: angry brows, a fang, glowing eyes, horns, or a weapon.
Families are distinct in silhouette *and* hue: slime (green dome + leaf), shroom (purple spotted cap),
bat (dark purple + red membranes), sprout (red petal head), golem (mossy boulder, glowing slit), imp (red,
curled horns, arrow tail), skeleton (big skull, red pinprick eyes, rusty sword), cultist (hood void + ember
staff), brute (basalt with pulsing lava cracks), wisp (lavender flame with a hollow face), goblin (green,
huge coin sack). Bosses are their family made huge and crowned (Gorgemaw: gold crown + toothy maw;
Vexis: flame crown, big wings). Elites never change shape — they get rims, a ground ring and an
affix-coloured aura.

## 9. UI harmony

The world shares the UI's warm darks: the ink `#1B1410` sits next to `--panel #1B1510` and
`--frame #4A3720`; gold accents (`#E8B64A`) echo `--gold`. World labels (NPCs, portals) use Alegreya Sans
700, cream `#F2E6C8` with a dark stroke; rift labels are lilac, waypoint/town labels ice blue. Rarity
colours on items match `RARITY_COLORS` so tooltips, beams and gear glows agree.
