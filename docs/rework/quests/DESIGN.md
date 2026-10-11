# Quest rework — design (2026-10-11)

Owner brief (paraphrased): Investigate must close the pop-up; see more than one accepted quest under the minimap; stop the
"finish one, walk back, walk back again" loop; contracts feel useless and sit in the way; tell main story from side
quests; better objectives in the new worlds — repair something and *see* it change; more story; quality of life.
Evidence: `REFERENCES.md` (rows R1–R27, principles P1–P10). Numbers that are not in REFERENCES or BALANCE.md are labelled
*design guess*.

## 1. What was wrong (measured on `claude/quests` @ a18f848)

| Problem | Evidence |
|---|---|
| One tracked quest | `AdventureTracker` renders `trackedQuest(save)` only; the minimap and floor trail follow only that quest |
| Story looks like everything else | one gold `!`/`?`/`◆` for 60 quests; the journal mixes 26 contracts with the chain |
| Contracts in the way | 26 repeatables on 10 story contacts (Orren alone offers 4); gold only, no XP, accept → walk → return each time |
| Back-and-forth | every story quest ends "return to the giver" at the camp; `lost_survey` and `high_water` both send you to the Old Ridge but are offered one after the other from a camp 45 s away |
| Same shape everywhere | main chain 13 of 20 quests are read → kill one named keeper → use a mechanism (FINDINGS #5) |
| Nothing changes | only quest objects switch to a "used" sprite; no wheel, water, fire or person reacts |
| Investigate leaves the window open | the dialogue panel stays over the object after `inspect` |

## 2. Categories and visual language (P1, P2, P10)

| Category | Marker on people, minimap, area map, world map | Journal | Tracker | Source |
|---|---|---|---|---|
| **Story** (campaign) | gold crest (shield) behind `!` / `?`; objective `◆` gold | *Story* tab, by act → chapter | always first; the next story step is shown even when not accepted ("Story · Speak with Orren") | R3, R4, R13, R20 |
| **Side story** (one-time local story) | silver-blue disc behind `!` / `?`; objective `◆` blue | *Side stories* tab, by zone | below story | R19 |
| **Lesson** (unlocks a service tier, gifts) | green `+` | *Side stories* tab, "Hearthmere workshop" and "Gifts" groups | like side | R13, R14 (feature quests), R4 (*Important*) |
| **Bounty** (repeatable) | bronze notice-board pin, **only on the zone's board**, never on a person | *Bounties* tab | one compact row while you are in that zone | R9, R15, R18, R22 |

A person offers at most three new quests at once (P10, R1/R2 "Christmas tree").

## 3. Tracker (HUD, under the minimap) (P3)

* Up to **five rows** at 1920×1080 (measured space between the minimap card and the guidance card ≈ 340 px; *design
  guess* of 5 × 60 px). More quests → "+N in the journal".
* Order: focused quest → quests with an objective in this zone (nearest first) → ready to turn in → others; story before
  side before lesson inside each group (R12 "priority on top", R20 campaign first).
* Row: category glyph, title, current objective with count, a progress bar for counts, and **where**: distance in metres
  in this zone (1 m = 50 u, so the hero runs 5 m/s — *design guess* presentation unit) or the zone name with an arrow.
* **Focus** (pin) chooses the quest that drives the floor trail and the big minimap diamond; every visible quest still
  gets a small coloured diamond on the minimap (R20). **Hide** removes a row; a hidden quest comes back when it
  progresses (R5). Header collapses the whole card.
* Auto-track: accepting adds the quest; accepting a story quest focuses it; finishing the focused quest focuses the next
  row (R5, R20).
* Bounties: "Bounties · Rillwake 1/3" with the nearest unfinished bounty, only while in that zone (R9).

## 4. Flow: one hub, one outing, one turn-in (P4)

* **Hubs**: each zone has a camp; its giver offers the zone's story step *and* its side story at the same time when their
  objectives lie on the same outing (Rillwake: *The Silent Wheel* + *The Lost Survey Party* from the start).
* **Hand-overs instead of returns**: the last zone quest ends with a short *talk* step at the next hub's person
  (breadcrumb, R6), so the first conversation in a new zone is already progress.
* **People move with the story** (phasing, R7/R8/R21): when the work ends far from camp, the giver walks there and waits
  (Orren at the mill once the wheel turns; the Bracken foreman at the floodgate; Iven at the dispatch shed; Kessa at the
  upper kilns; Venn at the crown). Same contact id, per-player position, server-validated.
* Result for the first hour (Rillwake → Bracken → Pumpworks): every story turn-in happens where the last objective was or
  on the road to the next one; no step requires walking back to a camp you already left.

## 5. Bounties replace contracts (P5)

* **One board per field zone** (9 boards) at the camp. It opens when the zone's story is done (the quest that opens the
  next zone) — story first, then a reason to come back.
* **Three bounties at a time**, drawn deterministically per character from the zone's pool (5–6 entries: field events,
  named rares, family hunts). No accepting: they progress whenever you do them (R22 "no NPC interaction required", R9).
* **Paid on completion in the field** (R15, R17): gold = the old event-contract formula (8 work units at the zone's middle
  level, `campContracts.ts`), XP = **25 ordinary kills at your level** (`monsterXp(level, 0, 0) × 25`).
* **Board cache** when all three are done, claimed at the board (R15 Horadric Cache, R18 Tree of Whispers): 12 work
  units of gold, 25 kills of XP, and loot spilled at the board — **one rare and one magic item** for your class at your
  level (clamped to the zone band). Then a new set of three is drawn.
* Budget (*design guess* with arithmetic): a board is ≈ 6–8 min with ≈ 300–400 kills at a human 50 kills/min (BALANCE §5).
  Board XP = 100 kills-equivalent → **+25–35 % XP per minute** over plain farming while doing it, constant across levels
  (it scales with `monsterXp`). Loot: farming gives ≈ 3 rares per 7 min (BALANCE §5: ~25 rares/h); the cache adds one rare
  and one magic item (+33 % rares over the same time). No legendary source, no XP outside boards, `sim.ts` pace unchanged.
* Contracts (26 quests) are deleted. A contract that was finished but not yet claimed is paid out by the migration; an
  unfinished one is dropped (it carried no lasting progress).

## 6. Objective kinds (P7)

Existing: `talk`, `kill`, `reach`, `wave` (field event or dungeon chamber), `interact`, `collect`, `deliver`, `service`,
`rift`. New, all server-authoritative with proximity and line of sight:

| Kind | Meaning | Server rule |
|---|---|---|
| **gather** (`interact` with `targets`) | find N objects in any order ("dig three cogs out of the silt") | each target counts once (bitmask `parts`) |
| **ordered** (`targets` + `ordered`) | puzzle-lite: in a written order (raise red → blue → yellow) | a wrong target resets the bitmask and says why |
| **repair** (`interact` with `hold`) | hold to use for 1.5–3 s: free a brake, open a gate, light a fire | `holdStart` then `inspect` ≥ hold − 150 ms later, still beside it and alive (sim time) |
| **hand-over** (`talk` at another person) | breadcrumb to the next hub | existing `objectiveTalk` |
| **choice** (reward pick) | choose the class weapon *or* an armour piece, both previewed | two items reserved; `claim` names the pick; the other is discarded |

Not done this pass (recorded): escort and defend need an allied NPC with health and pathing in the simulation (R10 lists
why players dislike them anyway).

## 7. The world shows it (P6)

A **world state** is a quest milestone (`{quest, step}` reached, or `done`). Zone plans tag visuals with it; the client
shows or hides them from the player's own save (per player, like WoW phasing, R7); the server uses the same rule for
contacts that move or appear. Kinds: rotors and wheels that start turning, flood water that drains, fires and beacons that
light, kilns whose mouths go cold, people who come back, banners, the giver's new spot. Collision never changes (identical
on server and client for everyone in a channel), so phased props stand against an edge, never on open floor. When a state
turns on, the camera pans to the change (draining water, then a cold kiln, then a turning wheel framed with the people
around it, then fires, people, a moved contact) for about 2.6 s with a one-line caption; reduced motion skips the pan.
Smoke particles alone proved too faint in the 1920×1080 shots, so every state has a change that reads in a still frame.

## 8. Story delivery (P8)

* Offer text ≤ 511 characters (R1, validated); objectives first in the journal (R2); every step has a one-line reading or
  bark when it completes; people's voices per `docs/rework/CAST.md`; new people are added to CAST.md.
* Investigate on an object that is the current objective **acts immediately without a window** and shows the reading as
  a short card at the bottom of the screen; the dialogue window closes after Investigate, after Accept when nothing else
  is offered, and after a turn-in unless the person has a follow-up.

## 9. Rewards (P9)

* **Story XP budget unchanged**: the sum of all one-time quest XP stays `storyXp(1, 50)` (BALANCE: `STORY_XP_SHARE` 0.5).
  In a zone with a side story, the side story takes 20 % of the zone's span and the story quests 80 % (*design guess*;
  D4 side quests pay XP, R19). A player who skips side stories earns 20 % less quest XP there and fights a little longer.
* Gold on side stories as before (camp-contract formula × 1.5); story quests keep their weapon and add the armour choice.
* Titles for two new milestones (Wheelwright, Pathfinder) next to the existing three.

## 10. Quest list

See `LOG.md` → "Quest list" for the final per-zone table (category, objective kinds, visible change, reward).
</content>
</invoke>
