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
   (upper left). Light comes from the upper left; on heroes it stays upper-left whichever way they face (head and
   torso never mirror; only the baked leg views do), monsters flip it with their silhouette.
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

* **Head ~31 u (~47 %)**: a sphere of radius 15.6 (y squash 0.95) centred at y = -46. Eyes are 2.05 × 3.05 u ovals
  with a glint, ±17° either side of the face centre, slightly below the equator — both eyes read whenever the
  hero faces the camera. Mouths only appear to emote (roar, whistle); no permanent mouth (Idleon).
* **Torso 23 u**, a soft, bilaterally symmetric bell (18 u at the shoulders, 23 u at the hem); **legs 12 u**,
  stubby; **arms 10.5 u**, one segment, round 3.4 u hands. Hats, horns and staves may rise to 78 u.
* At the game camera (620 u of view height) a hero is ~110 px tall at 1080p: every detail must survive at
  ~1.7 px per unit — fringes stop above the eyes, trims are ≥ 2 u, outlines 2.5 u.
* Monsters: trash 34-52 u tall, big trash (golem, brute) ×1.5, elites ×1.08-1.16, bosses ×2.6-3 and
  crowned. Outlines thicken only with √scale so big things stay crisp, not heavy.

## 3b. The turntable rig (heroes)

Heroes are 2D cut-outs with a **continuous yaw**, so turning is a rotation and never a mirror flip
(`player.ts`, drawings in `heroParts.ts`, poses in `choreo.ts`).

* **Yaw convention** (degrees): 0 = facing the camera, +90 = profile facing screen-right, ±180 = back to the
  camera, -90 = profile facing left. Body-local axes: x forward, y down, z = the hero's right side. A
  body point (x, y, z) lands at screen x = x·sin(yaw) − z·cos(yaw); its depth Z = x·cos(yaw) + z·sin(yaw) orders
  the parts (re-sorted every frame) and tilts it down the screen by 0.12·Z (0.34·Z for limbs) — the camera looks
  slightly down, so near things sit lower.
* **Facing**: walking sideways → ±65° (a 3/4 view, both eyes visible — never pure profile); towards the camera
  → ±20° (the side is kept); away → ±158° (back 3/4: hair, helmet back, cape, quiver); diagonals interpolate.
  Attacking / casting faces the target point; roar, empower, whistle and Frost Nova (and the gather of
  Meteor) present to the camera (±22°) so the whole-body pose reads. Idle: breathing, blinks, an occasional
  ±15° glance.
* **Turning**: critically damped springs (body ω = 31, ~150 ms for 130°), the **head leads by ~40 ms** (it
  starts first and on a stiffer spring), the feet re-plant with a quick step and a tiny bob.
* **Parts**: the head is baked at 24 yaws (every 15°, symmetric about 0): hair caps, fringes, spikes, helmets,
  brow bands, rivets, nasal guards, horns, hoods, caps + visors, wizard hats and circlets are placed *on the
  sphere* and depth-tested against it, so details slide round the head and hide behind it. Eyes, brows and
  mouths are live sprites projected onto the same sphere (they blink, squint and emote). The torso is a
  symmetric volume; its front details (collars, V-necks, lacing, robe panels, gorgets, buckles) and back details
  (spine ridge, crossed straps, robe yoke) are separate sprites that slide across the body cylinder and
  foreshorten with |cos|. Legs are baked at 7 yaws (toe-in profile → toe cap → heel). Arms, hands, weapons,
  shields (face / inside), orbs, pauldrons, capes, quivers and hair tails are placed from the 3D pose, so the
  near / far limbs and the weapon swap depth mid-turn; far limbs are tinted cool.
* **No paper slivers**: nothing ever scales below ~0.35 of its width; flat parts that turn edge-on fade out
  and the matching opposite view (shield inside, torso back) fades in.

## 4. Construction & shading rules

* Draw order is depth, not a fixed stack: heroes sort every part by its turntable depth each frame (§3b);
  ties fall back to legs → torso → torso details → head → face. Monsters keep a fixed paper-doll stack (back
  limbs → body → head → front limbs) and turn with a squash-turn. Far limbs are always darker / cooler.
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
* Walk: legs ±29° at 8 steps/s scaled by speed, 1.6 u bob, counter-swinging arms, a slight forward lean.
* **Skill choreography** (`choreo.ts`, table + timing model in `render/actions.ts`): every pose is a pure
  function of time in body-local 3D, blended over the idle/walk base, so the same swing reads from any yaw.
  Hits RELEASE at t = 0..strikeMs (the server already resolved them); primaries anticipate the *next* attack at
  the end of their cycle (0.55-0.92 of it) and relax if none follows, so 3.5 attacks/s is a crisp barrage, not
  a frozen pose. Every action has anticipation → strike → follow-through, squash & stretch at the impact, a
  lunge towards the target, and an exaggerated silhouette (arms leave the body outline).
* **Trails** are ribbons (one batched mesh, ≤ 44 vertices) sampled from the *real* weapon path by re-evaluating
  the pose at earlier instants: blade base → tip, fading with age, split in a behind-the-body and an in-front
  half so the arc wraps round the hero. Colour = the action's trail colour, else the weapon's glow (additive),
  else warm white. Spells add hand / tip glows, swirls (Black Hole), rune rings (Magic Weapon), a roar aura.
* Warrior: **Cleave** alternates a wide diagonal forehand sweep (~220°, torso unwinds, 9 u lunge) and an
  overhead chop; **Whirlwind** spins the whole rig at 2.2 rev/s with the weapon held out at shoulder height, a
  motion-blur disc + ring at blade height, flying hair/cape and little hops; **Rend** two crossing red slashes;
  **Ground Stomp** crouch → 16 u hop → slam with squash; **Seismic Slam** weapon raised high behind the head →
  smash in front (−20 % squash); **Battle Rage** gather → chest out, arms wide, head back, open-mouth roar, red
  aura flare.
* Ranger: **Hungering Arrow** release snap (draw hand flies back open), bow kick, string vibration, the arrow
  visibly leaves the bow with a muzzle twinkle, redraw anticipates the next shot; **Multishot** sweeps the drawn
  bow across a fan while releasing 4 arrows; **Cluster Arrow** aims 45° up with a hop-back recoil; **Rain of
  Vengeance** aims straight up and looses a burst; **Sentry** kneels and hammer-taps twice with a mallet;
  **Companion** hand to mouth, whistle with music notes. Crossbows kick up and dip to reload.
* Mage: **Magic Missile** alternates an overhand and a side-arm wand flick (staff: a thrust) with a sparkle
  burst at the tip each cast; **Meteor** both hands raise the weapon beside the head while glow gathers and the
  mage floats up, then points at the target; **Black Hole** gathers a swirl between the hands, two-handed thrust;
  **Frost Nova** raise and slam the staff butt (or stab the wand) into the ground; **Hydra** crouch and sweep
  the arm up from the ground; **Magic Weapon** weapon held up, runes circling it.
* Reactions: dash = 22° lean, stretch, legs split, hair streaming; hit = flinch back (3 u) + squash + 70-90 ms
  white flash; stun = dazed sway + orbiting stars; frozen = pose holds and tints `#8FD0FF`; chill slows anims;
  death topples and fades (600 ms); level-up = jump with arms in a V and a gold aura
  (`playAction({ skill: 'level_up' })`).
* Monsters: a 150 ms squash-turn (narrow to 35 %, flip, widen, small hop) instead of an instant flip; wind-up
  (`F_WINDUP`) = rear back, tremble, glowing eyes, red pulse; attacks lunge forward (melee) or recoil (shots,
  via `playAction`); hits knock them back 3-4 u with a strong squash. Summons aim and kick back on every shot.
* Hits: 70 ms (crit 90 ms) pure white silhouette + squash. Dummies wobble on a spring instead.
* Deaths: players topple and fade (600 ms). Monsters by element — physical squash-pop, fire chars black then
  crumbles, cold vanishes on an icy flash (vfx shards), lightning flickers, poison melts, arcane/holy fade up.
* Monsters each have a personality: slimes hop and squash, mushrooms waddle, bats flap fast, sprouts
  sway and spit, golems/brutes lumber and slam, imps bounce, skeletons jitter, cultists glide, wisps flicker
  and swell before exploding, goblins sprint with a bouncing sack and glinting coins.

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

## 10. Production notes (how the art stays cheap)

* Parts are drawn once with Pixi `Graphics`, rendered with MSAA through the main renderer, read back and
  kept as mip-mapped canvas textures (`bake.ts`) — sprites batch, look smooth at any zoom, and work in any
  renderer (the class-select previews run their own). Each part is also baked as a white silhouette (hit
  flash) and a dilated silhouette (elite rim), so flashes and rims cost no filters.
* **Bake density follows the camera**: the scene reports camera zoom × renderer resolution through
  `setViewScale`; hero sheets bake at 3-6 texels/unit, monster atlases 3-5, prop/decal atlases 2-4 and ground
  chunks 1-2 texels/unit accordingly (`scale.ts`). Hero views re-acquire a denser sheet when the window grows.
* Heroes: one sheet per look (~43 parts incl. 24 head views + 7 leg views, ref-counted, LRU of 10 idle looks).
  A new look appears instantly as live vector parts and is baked incrementally (≤ ~10 head views per frame)
  before views swap to it. Per frame a hero only moves sprites: no geometry is rebuilt (the trail ribbon
  rewrites ≤ 44 vertices). Containers are arranged so an idle hero costs ≤ 3 batches (additive glows behind |
  shadow + body parts | additive fx), ~2 draw calls on average; trails and spell fx add one while active.
* All trash monsters + summons of a map theme share **one atlas** (baked at map load); bosses get their own
  high-density sheet. Invisible additive sprites are hidden (not alpha 0) so they never split a batch.
* Ground: 512-unit chunks baked lazily around the camera (≤ 3 visible + 1 prefetch per frame, LRU cap scaled
  by density²), decals stamped into the chunks, prop shadows painted under props. Props are atlas sprites; only
  light sources animate (in `onRender`, skipped when culled).
* Dev gallery: `client/gallery-art.html?view=chars|closeup|monsters|objects|icons|map&theme=…|perf|stress`, plus
  contact sheets rendered with a fixed 240 Hz manual-advance clock: `turntable&cls=…` (4 gear tiers × 8 yaws),
  `turn&dir=rl,lr,up,ud` (a turn every 30 ms), `walk8`, `whirl`, `skills&cls=…&look=starter|rare|legendary|set`
  (every skill every 40 ms; `skills=cleave!` = first swing only), `rapid&aps=3.5` (primaries at high attack
  speed) and `mon2` (monster wind-up → strike → hit).
