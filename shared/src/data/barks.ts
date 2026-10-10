/**
 * Short spoken lines for people and places in Hearthmere and the camps. Each line is one breath (about 90 characters
 * at most) so it fits a speech bubble. Services speak when the player comes near or opens them; ambient people speak
 * now and then as they work. Original text; no reference-game phrasing.
 *
 * Keys are NPC roles (`blacksmith`, `jeweler`, `mystic`, `stash`, `waypoint`, `cube`, `obelisk`, `paragon`) or
 * ambient looks (`porter`, `worker`, `pilgrim`, `innkeeper`, `guard`, `fisher`, `child`, `bard`, `merchant`, `scholar`).
 */
export const BARKS: Readonly<Record<string, readonly string[]>> = {
  blacksmith: [
    'Iron remembers every blow. Give it good ones.',
    'Bring me the bent and the broken. I like a problem.',
    'Hot work. Stand back, or stand useful.',
    'That edge has seen better days. So have I.',
    'A good blade is just patience with an opinion.',
  ],
  jeweler: [
    'Every stone has a flaw. The craft is choosing where it hides.',
    'Mind the loupe. It sees more than you want it to.',
    'Three small gems make one fine one. Mathematics is kind.',
    'Light is the only honest customer.',
    'Not that drawer. That drawer bites.',
  ],
  mystic: [
    'The past is a draft. Let me show you the margins.',
    'Hold still. Your luck is smudged.',
    'Everything wants to be a little different than it is.',
    'I only change one thread. Greed unravels the cloth.',
    'Do not read the charms aloud. They are shy.',
  ],
  stash: [
    'Locked, counted, and boring. Exactly as it should be.',
    'Your things will be here when you are not.',
    'Heavy chest. Honest chest.',
    'Bring less back next time. Or more. I do not judge.',
  ],
  waypoint: [
    'The roads remember where you have been.',
    'Stand in the ring and the roads will do the rest.',
    'Every journey starts under this stone.',
    'Warm tonight. The stone likes company.',
  ],
  cube: [
    'It hums when it is hungry.',
    'Do not stare at the corners.',
    'Old thing. Patient thing. Feed it carefully.',
    'It remembers what it ate. Be certain about that.',
  ],
  obelisk: [
    'The stone listens. Speak your difficulty plainly.',
    'Beyond it, a door that has not decided what it is.',
    'Cold to the touch. Warm to the idea.',
  ],
  paragon: [
    'Rest your hands. The shrine counts what you carry.',
    'A quiet place, for loud deeds.',
    'Light a candle for the road behind you.',
  ],
  porter: [
    'Coming through! Back, shoulder, and stubbornness.',
    'Forty crates and one is always the wrong one.',
    'Do not lean on that. It is somebody’s dinner.',
  ],
  worker: [
    'Lamps first, then supper, then the rest of the evening.',
    'Wick, oil, flame. Same three jobs since I was twelve.',
    'If it flickers, it is asking for something.',
  ],
  pilgrim: [
    'I walked a long way to sit in a small garden.',
    'Do not hurry the shrine. It was here first.',
    'Peace is just distance from your own opinions.',
  ],
  innkeeper: [
    'Soup is hot, beds are damp, and the stories are free.',
    'No tabs for heroes. Heroes always forget.',
    'Mind the third step. It has strong feelings.',
  ],
  guard: [
    'Gate closes at the bell. Dawn opens it. In between, I decide.',
    'Looks quiet. That is when I check twice.',
    'Wipe your boots. The captain notices mud.',
  ],
  fisher: [
    'The lake gives, the lake takes. Mostly it sulks.',
    'Nothing biting but the cold.',
    'You have the look of someone who has not eaten fish this week.',
  ],
  child: [
    'Is that a real sword? Can I hold it? No? Fine.',
    'I am not lost, I am exploring.',
    'Cat went that way. Cat always goes that way.',
  ],
  bard: [
    'Seven verses of a song and not one of them is true.',
    'Hum along. Nobody here can hear pitch anyway.',
    'This one is called “The Flood, Part Four.”',
  ],
  merchant: [
    'Fair prices for fair folk. Unfair prices for the rest.',
    'Last pair in town. That is what I said about the previous pair.',
    'Look, but do not squeeze the fruit.',
  ],
  scholar: [
    'The map is wrong again. Delightfully wrong.',
    'Do not touch the ink. It is older than this town.',
    'I am almost certain I have read about this. Probably in a different dream.',
  ],
};
