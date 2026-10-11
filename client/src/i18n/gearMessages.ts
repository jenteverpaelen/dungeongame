// Gear visuals (docs/rework/gear/DESIGN-V2.md): settings, showcase card, Set moments. No tier or rank strings: the look
// of a hero is the items they wear.
export const GEAR_MESSAGES = {
  'gear.settingsHeading': 'Gear effects',
  'gear.own': 'Your hero',
  'gear.others': "Other players' heroes",
  'gear.full': 'Full',
  'gear.reduced': 'Reduced',
  'gear.off': 'Off',
  'gear.settingsNote': 'Full shows every gear effect: glowing weapons, floating pieces, auras, wings, particles and footprints. Reduced keeps steady glows and back pieces without motion. Off hides gear effects; the shapes of your weapons and armour always show. Reduced motion in your system caps this at Reduced.',
  'gear.temper': 'Tempered +{value}',
  'gear.showcaseTitle': 'Gear showcase',
  'gear.lookNote': 'Your hero looks like what you wear: every weapon and armour piece changes shape and material with its item level, gains light with its rarity, and Legendary items carry their own signature.',
  'gear.setPieces': '{set} · {count} of 6',
  'gear.setComplete': 'Set complete: {set}',
  'gear.artHeading': 'Weapon art',
  'gear.art': 'Weapon art',
  'gear.art.current': 'Previous art',
  'gear.art.series': 'Maker series',
  'gear.artNote': 'Every weapon and off-hand is drawn as the work of the makers of its level band, with the light and effects of that band. Previous art switches back to the earlier drawings. Takes effect when the page reloads.',
  'gear.artUrl': 'Set by the page address for this visit.',
} as const;
