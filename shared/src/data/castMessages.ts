/**
 * Original conversation text for the people of the frontier. Each person has a greeting, a few optional topics (some
 * unlocked by story flags the player has earned) and a farewell. Reading is free of side effects; quests and rewards
 * stay in the journal. Keys follow `cast.<person>.<node>`; labels end in `.ask`.
 */
export const CAST_MESSAGES = {
  'cast.back': 'Ask about something else',
  'cast.end': 'That is all for now.',
  // ── Iven · Surveyor, Cairnspill Terraces ──────────────────────────────────────────────
  'cast.iven.greeting': 'Mind the chalk line. I measured it twice, and it is the only straight thing left on this hill.',
  'cast.iven.quarry.ask': 'What happened to the quarry?',
  'cast.iven.quarry': 'Nothing so dramatic as a collapse. The stone simply stopped being agreeable. Benches split along cuts nobody made, the carters stopped coming, and my numbers went on being right about a hill that had changed its mind.',
  'cast.iven.seal.ask': 'Who sends the dispatches?',
  'cast.iven.seal': 'Everything came down the water road under a seal I knew. That is what bothers me. A forged seal I could forgive. This one was right down to the little scratch in the wax.',
  'cast.iven.orren.ask': 'Orren sends his regards.',
  'cast.iven.orren': 'Does he? He owes me four planks and a very good measuring rod. Tell him the planks can wait. The rod cannot.',
  'cast.iven.open.ask': 'The road is open again.',
  'cast.iven.open': 'Half a day of open road and someone has already complained about the gravel. That is how I know it is working.',
  'cast.iven.done': 'Mind your boots on the loose bench. I will not be surveying you if you fall.',

  // ── Kessa · Firekeeper, Cinderwash Kilns ──────────────────────────────────────────────
  'cast.kessa.greeting': 'Shh, not that way, you will wake Number Four. Sorry. Sorry, Number Four.',
  'cast.kessa.kilns.ask': 'Are the kilns alive?',
  'cast.kessa.kilns': 'No! Mostly no. They have moods. Five likes to be fed early and Seven sulks if you open her door before dawn. Lately every one of them is hungry and angry at once, and a fire should not be angry.',
  'cast.kessa.tally.ask': 'What was the tally for?',
  'cast.kessa.tally': 'It is how we count what goes in and what comes out. The numbers came wrong: more fuel, worse stone. Someone kept telling us to burn more. I wrote it all down. Nobody listens to the girl with the notebook.',
  'cast.kessa.pumps.ask': 'The pumps below are running again.',
  'cast.kessa.pumps': 'I heard! The water in the lower pans came back like a sigh. Please tell the mill-keeper the kilns say thank you. Number Four says it too.',
  'cast.kessa.quiet.ask': 'The draught lever is closed.',
  'cast.kessa.quiet': 'I can hear them breathing properly. Do you know how long it has been since the stack went quiet? ...Thank you. I mean it, and so do they.',
  'cast.kessa.done': 'Go on. I will keep them company.',

  // ── Venn · Watchkeeper, Kilnwatch Crown ───────────────────────────────────────────────
  'cast.venn.greeting': 'Sit if you can find a clean bit of bench. Sweet? They are boiled, not poisoned. Mostly.',
  'cast.venn.watch.ask': 'How long have you held the crown?',
  'cast.venn.watch': 'Long enough to know every creak in that stack. Thirty winters, give or take. The number stops mattering. What matters is that someone is awake at the top when the fire turns.',
  'cast.venn.furnace.ask': 'What is wrong with the furnace?',
  'cast.venn.furnace': 'It stopped answering the draw. Pull the lever and it should breathe. Instead it hums, like it is thinking about us. A furnace should not think. Fire is meant to be stupid and faithful.',
  'cast.venn.orders.ask': 'Where did the orders come from?',
  'cast.venn.orders': 'Paper from Hearthmere, sealed right. I have read enough of them to know the hand, and these were not written by a hand at all. Too even. Like stamped bread.',
  'cast.venn.home.ask': 'The road home is open.',
  'cast.venn.home': 'Is it? ...Well. Good. Take the rest of the sweets. I will not say it twice.',
  'cast.venn.done': 'Mind the east gantry. It has opinions about people who hurry.',

  // ── Sera · Causeway Ferrier, Sablefen Causeway ────────────────────────────────────────
  'cast.sera.greeting': 'Mind the gap! No, the other gap. Welcome aboard the Stubborn Mule. She floats. That is all I promise.',
  'cast.sera.ferries.ask': 'Do the ferries still run?',
  'cast.sera.ferries': 'Three of four. Patience is sulking on the eastern bar, Goose leaks if you look at her, and the Mule will outlive us all. I kept them running through the flood on singing and bad arithmetic.',
  'cast.sera.toll.ask': 'Why is there a toll?',
  'cast.sera.toll': 'There was not one until the writ came. Pretty paper, handsome seal, no signature. The tollkeepers took it as gospel and started “redirecting” my carts. I have never been so insulted by paperwork.',
  'cast.sera.venn.ask': 'Venn sends word: the road is open.',
  'cast.sera.venn': 'Venn! That old kettle. Tell him I owe him a song. No, tell him I owe him two. He will pretend he hates it.',
  'cast.sera.quiet.ask': 'The array has gone quiet.',
  'cast.sera.quiet': 'Is that what that silence is! I thought the gulls had finally lost their nerve. Come aboard. First crossing is free.',
  'cast.sera.done': 'Fair winds, and if you hear singing from a boat, that is only me counting.',

  // ── Neris · Brine Keeper, Saltwind Pans ───────────────────────────────────────────────
  'cast.neris.greeting': 'State your business in one sentence. I keep a tally and I do not like it padded.',
  'cast.neris.tally.ask': 'What do the tallies say?',
  'cast.neris.tally': 'That we boiled seventeen parts in a hundred more than the brine could possibly give. Either the sea has grown generous, or the books were written to be read, not believed.',
  'cast.neris.crews.ask': 'Where are the missing crews?',
  'cast.neris.crews': 'Not lost. Redirected. Every cart was signed for down to the last sack, by a hand that never touched salt. Find the crews and you find where the paper was cut.',
  'cast.neris.ledger.ask': 'What is the White Ledger?',
  'cast.neris.ledger': 'A dispatch watch that stopped watching and started writing. It keeps a very clean hand. I trust nothing that clean.',
  'cast.neris.sera.ask': 'Sera sends her regards.',
  'cast.neris.sera': 'Does she? She also still owes me a correct sum for the last quarter. Perhaps she sent a song instead of a number. It is the same to her.',
  'cast.neris.done': 'Do not touch the pans. They are hot and I have counted them.',

  // ── Aven · Cistern Keeper, Lockglass Cistern ──────────────────────────────────────────
  'cast.aven.greeting': 'Quiet. Listen. ...There. The water is thinking again.',
  'cast.aven.water.ask': 'What do you listen for?',
  'cast.aven.water': 'Pressure. A cistern speaks in small sounds. A drip is a question, a hum is a warning. Lately it only shouts.',
  'cast.aven.governor.ask': 'What is the governor?',
  'cast.aven.governor': 'The heart of the place. It keeps the flow honest. Someone taught it to lie. Not malice. It was told to hold open, and it obeys. I cannot fault it for loyalty.',
  'cast.aven.orders.ask': 'Who gave the orders?',
  'cast.aven.orders': 'They came down from the ridge, copied in a keeper’s hand. A good copy. Better than mine. That is how I knew.',
  'cast.aven.pumps.ask': 'The pumps upstream run again.',
  'cast.aven.pumps': '...Good. A pump is a stubborn animal. Tell the mill-keeper the water below says hello.',
  'cast.aven.done': 'Go gently. Stone remembers footsteps.',

  // ── Tallis · Ridge Lookout, Shiverline Escarpment ─────────────────────────────────────
  'cast.tallis.greeting': 'Oh! Oh, good, a person. Not a, no, you are a person. Sorry. The wind keeps imitating people up here.',
  'cast.tallis.wind.ask': 'Is the wind that bad?',
  'cast.tallis.wind': 'It is not the wind, it is the accent. It does voices. Last night it did my sister’s. She is perfectly well, she is in Hearthmere, that is what makes it worse.',
  'cast.tallis.flags.ask': 'What are the pennants for?',
  'cast.tallis.flags': 'Station flags. Red for closed, blue for open, green for send help, the yellow one for I am eating. Lately they have been saying things I did not hoist. That is a great many flags I did not hoist.',
  'cast.tallis.beacon.ask': 'Why a beacon?',
  'cast.tallis.beacon': 'A flame cannot be copied. You can lie with a flag, a slate, a seal. A fire is a fire, and everyone below can see it is a fire. I like that. It is honest.',
  'cast.tallis.quiet.ask': 'The array has gone quiet.',
  'cast.tallis.quiet': '...Has it? I think I can hear it. The wind. It is just wind now. Oh. That is actually a lovely sound.',
  'cast.tallis.done': 'Mind the ledge. And if the wind says your name, do not answer.',

  // ── Mera · Ward Quartermaster, Beaconbreak Ward ───────────────────────────────────────
  'cast.mera.greeting': 'Name, purpose, length of stay. Quickly. I have forty crates and a headcount that will not add up.',
  'cast.mera.stores.ask': 'How are the stores?',
  'cast.mera.stores': 'Full. Which is the problem. The orders wanted them emptied. A full granary is a very rude thing to own when the paper says otherwise.',
  'cast.mera.orders.ask': 'Why not follow the orders?',
  'cast.mera.orders': 'Because they were polite in all the wrong places. Real dispatches have mud on them. These had none. I kept the doors shut and the pantry stocked and told the paper it could argue with me in person.',
  'cast.mera.crews.ask': 'How many crews have come back?',
  'cast.mera.crews': 'Eleven. One of them in a cart, but breathing. I count. It is the only joy I allow myself.',
  'cast.mera.right.ask': 'The orders are honest again.',
  'cast.mera.right': 'Good. I will need a fresh headcount. And you, do you eat? Here. Eat. That is an order, and it is a real one.',
  'cast.mera.done': 'Move along, the queue has feelings.',

  // ── Eris · Western Reader, Hollowstar Array ───────────────────────────────────────────
  'cast.eris.greeting': 'Shh, it is on the third verse. Oh! You came. Sit. It does not mind listeners.',
  'cast.eris.music.ask': 'What are you hearing?',
  'cast.eris.music': 'A voice that has only ever learned to repeat. It sings the same eight orders in the same order, forever. It has a lovely cadence. That is what frightens me. I started humming along.',
  'cast.eris.daro.ask': 'Why does Daro disagree with you?',
  'cast.eris.daro': 'He hears answers where I hear echoes. He is usually right about people and I am usually right about sounds. We have been wrong together for years. It is very restful.',
  'cast.eris.verse.ask': 'The first signal was read to the end.',
  'cast.eris.verse': 'And the verse changed. I think it was only ever waiting for someone to listen to the end.',
  'cast.eris.done': 'Take the gallery stairs slowly. They ring.',

  // ── Daro · Eastern Reader, Hollowstar Array ───────────────────────────────────────────
  'cast.daro.greeting': 'You are late. Not that I was counting. I was counting.',
  'cast.daro.east.ask': 'What does the east receiver say?',
  'cast.daro.east': 'Replies. Always replies. Every question answered before it is asked. Perfect, prompt, polite answers. Nobody is that polite. Nobody.',
  'cast.daro.eris.ask': 'You and Eris do not agree?',
  'cast.daro.eris': 'She thinks it is singing. I think it is lying. We are both right, which is the worst part.',
  'cast.daro.over.ask': 'It is over.',
  'cast.daro.over': 'Over is a strong word. Quiet. I will take quiet. ...You can sit, if you want. I will not say anything. That is my thanks.',
  'cast.daro.done': 'Go. Before I say something kind and have to live with it.',
} as const;
