# Item tooltip and rarity colours: originality pass (2026-10-11)

Owner (2026-10-11): "i dont wanna copy full diablos tooltip and like rank design etc, people will get mad at that".
Labels: **[M]** measured here, **[S]** read on the cited page, **[SN]** search-result snippet (not opened), **[K]** prior
knowledge (not re-verified this session), **[P]** our proposal.

## 1. What our tooltip copied [M]

Before shots: `.local/tt-shots/before-*.jpg` (not committed). The card was literally commented "The Diablo 3 style item
tooltip" (`client/src/ui/panels/tooltip.tsx`) and matched D3 in these recognisable ways:

| Element | Ours (before) | D3 | Source |
|---|---|---|---|
| Rarity colours | `#6969ff / #ffff00 / #bf642f / #00ff00` | the same hex values | [K]; `shared/src/items.ts`, `tokens.css` |
| Affix sections | "PRIMARY" / "SECONDARY" headings | Loot 2.0 "4/2" primary/secondary split | [SN] [diablowiki 4/2](https://diablowiki.net/4/2) |
| Quality label | "ANCIENT" / "PRIMAL ANCIENT" above the name, orange / red border | "Ancient" in the name, orange border (green on sets) | [SN] [diablowiki Leg](https://di.diablowiki.net/Leg) |
| Legendary power | orange italic line with a diamond | the orange affix is the item's new power | [SN] [BlizzCon 2013 transcript](https://diablo.blizzplanet.com/blog/comments/blizzcon-2013-diablo-iii-gameplay-systems-crusader-panel-transcript/9) |
| Header | rarity-coloured gradient banner, centred name | same | [K] |
| Hero number | giant centred "DAMAGE PER SECOND" / "ARMOR" | same | [K] |
| Comparison | Damage / Toughness / Recovery strip | D3 character-sheet trio | [K]; our `DerivedStats.sheetDps` comment says "D3 character-sheet Damage" |
| Set bonus text | "(2) Set: …" | same wording | [K] |

## 2. What is genre convention (kept) [SN]/[K]

* **Rarity hue families** blue (magic) → yellow (rare) → orange (legendary) → green (set). Path of Exile uses blue
  magic / yellow rare, Last Epoch adds a green set and orange unique, and WoW uses orange for legendary [K]. Players read
  the hue family instantly, so we keep the families and change the values.
* **Hold a key for detail:** PoE shows mod details while Alt is held [SN] ([Mobalytics PoE2 modifiers](https://mobalytics.gg/poe-2/guides/item-modifiers));
  Last Epoch planned Ctrl+Alt for extra tooltip information [SN] ([LE forum 0.7.1 preview](https://forum.lastepoch.com/t/heres-a-preview-of-the-new-item-tooltip-design-coming-in-patch-0-7-1-updated-06-09/15137/9)). We keep Alt → ranges and roll meters.
* **Crafting marks on affixes:** D4 marks tempered affixes with an icon [SN] ([Icy Veins tempering guide](https://www.icy-veins.com/d4/guides/tempering-guide)). Ours: the star on an enchanted line and temper stars on the tier line (our own glyphs).
* **Line-by-line comparison** with the equipped item; D4 condensed duplicate stat sources in comparisons (1.4.1) [SN]
  ([mp1st patch notes](https://mp1st.com/news/diablo-4-version-1-4-1-patch-notes-released-ahead-of-download)).

## 3. Our design [P]

The card follows our own UI language (`DESIGN.md`: rail + cards, parchment on ink, stat tiles) and our own systems
(the 0–9 gear tier ladder, tempering, the per-stat engine):

1. **Header:** a left-aligned name, with "Legendary · Two-Handed Axe" below it and the gear-tier line (tier, temper stars) under that.
   The slot is a chip in the corner. The rarity shows as a 3 px rule on the card's top edge plus the name colour, not a
   coloured banner. Top tiers (8–9) get a slow sheen on that rule, not a spinning border.
2. **Key stats:** two or three equal stat tiles (DPS · Damage · Speed, or Armor · Sockets), no giant hero number.
3. **"If equipped":** two summary pills, Damage and Survival, then up to six concrete stat changes, e.g. "−566
   Strength" or "+10,400 Life per Hit". These come straight from `computeStats` before and after the swap.
4. **Properties:** one list with no D3 headings. Core properties come first, numbers are bright and the text is parchment
   (not D3 blue). Sockets follow after a hairline.
5. **Power:** a card with a "Legendary power" label, upright text and the value in the rarity colour. The tag chips
   come once the foundation's skill tags land (`docs/rework/ITEMS-AND-SKILLS-PLAN.md` §3.6).
6. **Set:** the set name with a count, the piece chips, then bonus rows with a round 2/4/6 badge (no "(2) Set:").
7. **Footer:** one row for the requirement, item level and binding; the Cube tier pips are unchanged.

## 4. Rarity palette [M]

`node` script (WCAG 2.x contrast on the tooltip ink `#0f0c09`; colour-vision simulation Machado et al. 2009, severity
1.0; ΔE76 in CIELAB, minimum over all rarity pairs):

| Palette | Contrast (normal / magic / rare / legendary / set) | min ΔE normal vision | protan | deutan | tritan |
|---|---|---:|---:|---:|---:|
| D3 values (before) | 19.5 / **4.7** / 18.2 / **4.7** / 14.2 | 66.3 | **8.3** | 19.6 | 13.3 |
| **Hearthfall (chosen)** `#e6dfd0 / #7a9cff / #f2d43c / #ef6c2a / #34c79a` | 14.7 / 7.5 / 13.2 / 6.4 / 9.1 | 51.4 | 16.9 | 19.2 | 19.9 |

Every colour now clears 4.5:1, and the worst colour-blind pair separation doubles (protan 8.3 → 16.9). The rarity is
also always written out on the type line, so colour is never the only cue. A full colour-blind preset (alternative hues
+ shapes) belongs to the completion agent's accessibility work and overrides these tokens.

## 5. Still open

* Names: "Ancient/Primal", "Cube Tier", "Empower", "Character bound", Torment and Paragon go through the naming register
  (completion agent) and the bible's NAMES.md; the tooltip only renders them.
* The D3-named skills that items reference ("Seismic Slam", "Whirlwind", "Dust Devils") are renamed in bible v2.
