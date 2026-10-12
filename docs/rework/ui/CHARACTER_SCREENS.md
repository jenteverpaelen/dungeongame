# Character screens — title, hero select, class pick, appearance (2026-10-12)

Owner, 2026-10-12: "enable the full account creation screen and character select and have account be able to have up
to 3 characters, also more customization on the character like hair eyes etc"; then "the class select need to be
different then today look at maplestory and diablo and poe … the one we have really sucks … its the first thing people
see".

Today (screenshot `docs/rework/ui/shots/select-before.jpg`): one page with three class cards (heroes seen from behind),
three small dropdowns that copy another class's skin, hair or hairstyle, a name field and "Enter World". No hero list;
accounts are off on the dev link (name-only login).

## 1. References

| # | Source | What it says | Strength |
|---|---|---|---|
| C1 | BlizzCon 2019 *Diablo IV unveiled* panel transcript (https://diablo.blizzplanet.com/blog/comments/blizzcon-2019-diablo-4-unveiled-panel-transcript/2) | D4's class select is a campfire lineup, an homage to Diablo II's; no text labels — each class is read from its pose and companion | developer panel (via transcript summary) |
| C2 | Icy Veins, *The Campfire Is Gone: Diablo 4 2.0 Has a New Character Creation Screen* (https://icy-veins.com/d4/news/the-campfire-is-gone-diablo-4-2-0-has-a-new-character-creation-screen) | the 2.0 screen replaced the campfire with class icons and a full-screen animated focus per class; the community was split | news report (page itself bot-blocked; search summary) |
| C3 | TechRaptor *Diablo IV character customization guide*, NME, PCGamesN (https://techraptor.net/gaming/guides/diablo-iv-character-customization-guide, https://www.nme.com/news/diablo-iv-has-its-expansive-character-creator-detailed-2982804) | D4 creator: 4 faces, dozens of skin tones, a handful of eye colours, over a dozen hairstyles, facial hair, hair colour, jewellery, make-up, markings; some options per class; a key previews the hero in armour; face, skin and hair are fixed after creation | press guides; option counts approximate |
| C4 | Diablo Wiki *Character customization* (https://diablowiki.net/Character_customization) | D3 dropped face and hair customisation in testing: faces were too small to read and helmets hid them | community wiki |
| C5 | MapleStory Classic wiki *Character creation* (https://mapleclassic.wiki/wiki/Character_creation) | creation picks gender, hairstyle (3), face (3), skin tone (4) and a starting outfit (top, bottom, shoes, weapon) from short lists | community wiki of a classic version |
| C6 | GameSkinny *Getting started in Pocket MapleStory* (https://www.gameskinny.com/tips/mlhby/getting-started-in-pocket-maplestory) | three character slots to start | secondary |
| C7 | Nexon *MapleStory beginner's guide* (https://maplestory.nexon.net/game/beginners-guide/getting-started) | login → world → channel → the character list of that world | official |
| C8 | GamesByHyper devlog, MakeHuman *Randomizing characters* (https://static.makehumancommunity.org/mpfb/docs/randomization/index.html) | a one-click randomise for players who want to start playing; randomisation within allowed sets so results stay sensible | weak (devlog, tool docs) |
| C9 | Engadget *Rise and Shiny: Path of Exile* (https://www.engadget.com/2013-11-03-rise-and-shiny-path-of-exile.html) | PoE creation: choose a league, then a class shown as a gender-locked exile in the scene | old review |
| C10 | [K] Diablo III and Path of Exile hero select (known, not sourced): the hero list sits on the right, the selected hero stands full size in a lit scene, one large Play button, "Create New Hero" opens the class choice | unverified |

## 2. The flow

1. **Title / log in** — a living scene behind the logo: the Hearthmere campfire at dusk, embers, slow camera drift (the
   game's own renderer; C1/C10). A compact panel: Log in · Create account · Recover. Required accounts (owner).
2. **Hero select** — the chosen hero stands by the campfire at full size (C10). Right column: **three slots** (owner;
   C6) showing portrait, name, level, class and where they were; empty slots read "Create a hero" (MapleStory-style
   slots, C7). Big **Play**; Delete (the existing grace period) under the list; account menu (security, devices, your
   data, log out) in the corner.
3. **Choose a class** — the three classes stand around the campfire, each in its own pose, no labels until hover (C1).
   Clicking one gives a **full-screen focus** (C2): name, epithet, a two-line pitch, role tags, difficulty, resource and
   the signature move looping. "Choose" or back to the fire.
4. **Appearance** — the hero large in the middle, turnable (drag or arrow keys), with a "starting gear / no gear" toggle
   (C3 armour preview; C4: helmets hide hair, so the toggle matters). Categories on the left: skin tone, hairstyle,
   hair colour, eyes, facial hair, face accessory (what the art can draw today). **Randomise** (always a complete hero,
   C8) and **Class look**. Then the name, the first-adventure guide toggle and **Create hero**.

## 3. Appearance options (what the hero art can draw)

| Category | Options | Basis |
|---|---|---|
| Skin tone | 10 swatches | C3 "dozens", C5 four; 10 fits a swatch row. Values [P] |
| Hairstyle | 10: spiky, short, cropped, ponytail, braid, bun, long, curly, balding, shaved | every style the head art already draws (`heroParts.ts`) |
| Hair colour | 12 swatches | C3; values [P] |
| Eyes | 8 swatches | C3 "a handful"; values [P] |
| Facial hair | none, stubble, moustache, goatee, full, braided | the townsfolk beards (`gear.ts`), now offered to heroes |
| Face accessory | none, eyepatch, spectacles, monocle, goggles | the townsfolk face kit, as D4's jewellery stand-in (C3) |

No body type or gender switch: the hero art is one unisex chibi body; D3 drew separate art per gender (C4 era), which
this game does not have. Appearance is fixed after creation (C3). Old heroes keep their look (the earlier three-field
choice still loads).

## 4. Rules

* At most **3 heroes per account** (`MAX_CHARACTERS_PER_ACCOUNT`); a hero waiting out its deletion grace still counts.
* The front-end scene is one Pixi app (not one per preview), paused while the tab is hidden; reduced motion stops the
  drift and the looping skills.
* All values marked [P] are placeholders judged by eye at 1920×1080.

## 5. Built (2026-10-12)

* `client/src/render/front/frontScene.ts` — the camp at dusk in the game's own renderer: backdrop, zone props, the
  campfire (flames, glow, embers), heroes posed around the fire, a camera per step.
* `client/src/ui/front/Front.tsx` + `client/src/ui/styles/front.css` — the four screens; the account dialog stays for
  recovery codes and account management ("Manage heroes", security, devices, data).
* `shared/src/appearance.ts` — the v2 look (palettes, hairstyles, facial hair, accessories), strict validation,
  `classAppearance`, `randomAppearance`; v1 still loads. `MAX_CHARACTERS_PER_ACCOUNT = 3`; the account's hero list
  carries each hero's look and last zone.
* Heroes from before accounts: "Bring a hero from before accounts" on hero select claims one by name while the server's
  legacy window is open (`ALLOW_LEGACY_LOGIN=1`, docs/rework/ACCOUNTS.md).
* "Continue a hero" (title) and "Bring a hero" (hero select) ask for an existing hero only (`hello.existing`): a
  misspelt name is refused with "No hero with that name was found" next to the field, instead of creating a new
  level-1 hero that takes one of the three places. Checked on a copy of the dev saves: the owner's level-70 Ranger
  came onto a fresh account and played.
* Shots: `docs/rework/ui/shots/` (fr-title, acc-title, acc-heroes-second, fr-class-hover, fr-focus-warrior,
  fr-look-custom, fr-look-nogear). Frame rate on these screens: 150–165 fps (RTX 4070 laptop, headless Chrome).
