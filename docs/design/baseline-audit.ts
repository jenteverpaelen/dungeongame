// Baseline audit: prints measured facts about the shipped rules/data so docs/design/FULL_GAME_ROADMAP.md can cite
// numbers that are reproducible instead of remembered. Read-only: imports shared data, writes nothing.
//
//   npx tsx docs/design/baseline-audit.ts            (from the repository root)
//
// Everything below is computed from the code in this checkout. Section 6 (drops) is a Monte Carlo with a fixed seed.
// The "implied time" lines in section 5 rest on ONE assumption copied from server/src/afk.ts (60 kills per active
// minute, derived from AFK_EFFICIENCY 0.25 => ~15 kills/min offline). That rate was never measured in play.

import { CLASSES, CLASS_IDS } from '../../shared/src/data/classes';
import { SKILLS, skillsForClass, SKILL_SLOTS, RUNE_UNLOCK_OFFSETS, TIER_COSTS } from '../../shared/src/data/skills';
import { ZONES } from '../../shared/src/data/zones';
import { MONSTERS, ELITE_AFFIXES } from '../../shared/src/data/monsters';
import { BASES, AFFIXES, LEGENDARIES, SETS, GEMS, GEM_RANKS } from '../../shared/src/data/items';
import { DIFFICULTIES, xpToNext, paragonXpToNext, paragonPoints, PARAGON_STATS, monsterXp, monsterHp, monsterDmg, skillPointsForLevel } from '../../shared/src/progression';
import { rollDrops, PITY_THRESHOLD } from '../../shared/src/items';
import { CUBE_FUNCTIONS, cubeXpToNext, salvageXp } from '../../shared/src/cube';
import { Rng } from '../../shared/src/math';
import * as C from '../../shared/src/constants';
import { SOUNDS } from '../../client/src/audio/bank';

const J = (o: unknown) => JSON.stringify(o);
const sec = (s: string) => console.log(`\n## ${s}`);

sec('1. CONSTANTS');
console.log(J({ TICK_RATE: C.TICK_RATE, MAX_LEVEL: C.MAX_LEVEL, TILE: C.TILE, PLAYER_RADIUS: C.PLAYER_RADIUS, BASE_MOVE_SPEED: C.BASE_MOVE_SPEED, DASH: C.DASH, INVENTORY_SIZE: C.INVENTORY_SIZE, STASH_SIZE: C.STASH_SIZE, AFK_MAX_HOURS: C.AFK_MAX_HOURS, AFK_EFFICIENCY: C.AFK_EFFICIENCY, TOWN_CHANNEL_CAP: C.TOWN_CHANNEL_CAP, FIELD_CHANNEL_CAP: C.FIELD_CHANNEL_CAP, PARTY_MAX: C.PARTY_MAX, AOI_HALF_W: C.AOI_HALF_W, AOI_HALF_H: C.AOI_HALF_H }));
console.log('procedural sounds in client/src/audio/bank.ts:', Object.keys(SOUNDS).length);

sec('2. CLASSES');
for (const id of CLASS_IDS) {
  const c = CLASSES[id];
  console.log(J({ id, name: c.name, title: c.title, mainStat: c.mainStat, resource: { id: c.resource.id, max: c.resource.max, regenPerSec: c.resource.regenPerSec, decayPerSec: c.resource.decayPerSec }, attackRange: c.attackRange, primary: c.primary, signature: c.signature }));
}

sec('3. SKILLS (name | kind | unlock level | runes)');
console.log(`total=${Object.keys(SKILLS).length} SKILL_SLOTS=${SKILL_SLOTS} RUNE_UNLOCK_OFFSETS=${J(RUNE_UNLOCK_OFFSETS)} TIER_COSTS=${J(TIER_COSTS)}`);
for (const id of CLASS_IDS) {
  console.log(`-- ${id}`);
  for (const s of skillsForClass(id).sort((a, b) => a.unlock - b.unlock)) {
    console.log(`${s.name} | ${s.kind} | L${s.unlock} | rune unlock levels ${RUNE_UNLOCK_OFFSETS.map((o) => s.unlock + o).join('/')} | ${s.runes.length} runes, ${s.tiers.length} tiers`);
  }
}
const lastSkill = Math.max(...Object.values(SKILLS).map((s) => s.unlock));
console.log(`last active skill unlocks at L${lastSkill}; last rune unlocks at L${lastSkill + Math.max(...RUNE_UNLOCK_OFFSETS)}`);
console.log(`skill points at L70: ${skillPointsForLevel(70)}; cost to buy every tier of one class's skills: ${skillsForClass('warrior').length * TIER_COSTS.reduce((a, b) => a + b, 0)}`);

sec('4. WORLD');
for (const z of Object.values(ZONES)) console.log(J({ id: z.id, kind: z.kind, theme: z.theme, levelBand: z.levelBand, sizeTiles: z.size, packTarget: z.packTarget, respawnSec: z.respawnSec }));
const trash = Object.values(MONSTERS).filter((m) => m.weight > 0);
console.log(`monsters=${Object.keys(MONSTERS).length} (trash with spawn weight=${trash.length}; goblin/boss=${Object.keys(MONSTERS).length - trash.length}) elite affixes=${Object.keys(ELITE_AFFIXES).length}`);
console.log(`difficulty tiers=${DIFFICULTIES.length}: ${DIFFICULTIES.map((d, i) => `${i}:${d.name}(hp x${d.hp},min L${d.minLevel})`).join(', ')}`);
console.log(`items: bases=${Object.keys(BASES).length} affixes=${AFFIXES.length} legendaries=${Object.keys(LEGENDARIES).length} (class-specific ${Object.values(LEGENDARIES).filter((l) => (l as { classes?: string[] }).classes).length}) sets=${Object.keys(SETS).length} gems=${Object.keys(GEMS).length}x${GEM_RANKS.length} ranks`);

sec('5. XP / PACING');
let cum = 0; const cums: Record<number, number> = {};
for (let l = 1; l < C.MAX_LEVEL; l++) { cum += xpToNext(l); cums[l + 1] = cum; }
console.log('cumulative XP to reach level:', [10, 20, 30, 40, 50, 60, 70].map((l) => `L${l}=${cums[l]}`).join(' '));
console.log('level | xpToNext | trashXP@level(diff0) | kills/level x1 | kills/level x3 | trash hp | trash dmg');
for (const l of [1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 50, 60, 69]) {
  const need = xpToNext(l); const tx = monsterXp(l, 0, 0);
  console.log(`${l} | ${need} | ${tx} | ${(need / tx).toFixed(1)} | ${(need / (tx * 3)).toFixed(1)} | ${monsterHp(l).toFixed(0)} | ${monsterDmg(l).toFixed(1)}`);
}
let k1 = 0; for (let l = 1; l < C.MAX_LEVEL; l++) k1 += xpToNext(l) / monsterXp(l, 0, 0);
console.log(`same-level trash kills 1->70: x1=${Math.round(k1)} x3=${Math.round(k1 / 3)} (server XP_MULT default is 3; x1 is the un-boosted curve)`);
console.log(`ASSUMPTION (afk.ts): 60 kills/active minute => 1->70 on trash alone = ${(k1 / 60 / 60).toFixed(1)} h at x1, ${(k1 / 3 / 60 / 60).toFixed(1)} h at x3. Not measured in play.`);
console.log(`paragon: xpToNext(p0)=${paragonXpToNext(0)} xpToNext(p100)=${paragonXpToNext(100)} xpToNext(p800)=${paragonXpToNext(800)}; stats=${PARAGON_STATS.length}; points@P800=${J(paragonPoints(800))}; @P1000=${J(paragonPoints(1000))}`);
console.log(`monsterXp @L30 diff0 by elite tier [normal,champion,rare,minion,boss,goblin] = ${[0, 1, 2, 3, 4, 5].map((t) => monsterXp(30, t, 0)).join(' / ')}`);
console.log('Cube: level -> cumulative Cube XP to reach it | functions unlocked (CUBE_FUNCTIONS.unlock)');
let cx = 0;
for (let lv = 1; lv <= 9; lv++) {
  const unlocked = CUBE_FUNCTIONS.filter((f) => f.unlock === lv).map((f) => f.op).join(',') || '-';
  console.log(`L${lv}: cumXP=${cx} | unlocks ${unlocked}`);
  cx += cubeXpToNext(lv);
}
console.log(`salvage Cube XP by rarity (normal/magic/rare/legendary/set) = 2/4/9/30/30 per salvageXp(); cube level 8 needs ${Array.from({ length: 7 }, (_, i) => cubeXpToNext(i + 1)).reduce((a, b) => a + b, 0)} Cube XP`);
void salvageXp;

sec('6. DROPS (Monte Carlo, warrior, no Magic Find, fixed seeds)');
console.log(`PITY_THRESHOLD=${PITY_THRESHOLD} non-legendary item rolls`);
function sim(level: number, diff: number, elite: 0 | 1 | 2 | 4 | 5, N: number, inRift = false) {
  const rng = new Rng(12345 + level * 7 + diff * 101 + elite);
  let pity = 0, items = 0, leg = 0, anc = 0, primal = 0, gold = 0, gem = 0, db = 0, rare = 0, magic = 0, normal = 0, since = 0;
  const gaps: number[] = [];
  for (let k = 0; k < N; k++) {
    const r = rollDrops(rng, { level, difficulty: diff, elite, classId: 'warrior', magicFind: 0, pity, inRift }, 0);
    pity = r.pity; since++;
    let got = false;
    for (const d of r.drops) {
      if (d.type === 'item') {
        items++;
        const i = d.item;
        if (i.rarity === 'legendary' || i.rarity === 'set') { leg++; got = true; } else if (i.rarity === 'rare') rare++; else if (i.rarity === 'magic') magic++; else normal++;
        if (i.ancient === 1) anc++; if (i.ancient === 2) primal++;
      } else if (d.type === 'gold') gold++; else if (d.type === 'gem') gem++; else if (d.type === 'mat') db += d.amount;
    }
    if (got) { gaps.push(since); since = 0; }
  }
  const mean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : NaN;
  const s = [...gaps].sort((a, b) => a - b);
  const q = (p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN);
  return { level, diff, tier: elite, inRift, N, itemsPerKill: +(items / N).toFixed(4), legendariesPerKill: +(leg / N).toFixed(5), killsPerLegendary: +mean.toFixed(1), gapP50: q(0.5), gapP90: q(0.9), gapMax: s[s.length - 1], rarityShare: { normal: +(normal / Math.max(1, items)).toFixed(3), magic: +(magic / Math.max(1, items)).toFixed(3), rare: +(rare / Math.max(1, items)).toFixed(3) }, ancientPerLegendary: +(anc / Math.max(1, leg)).toFixed(3), primalPerLegendary: +(primal / Math.max(1, leg)).toFixed(4), goldPilesPerKill: +(gold / N).toFixed(3), gemsPerKill: +(gem / N).toFixed(4), deathsBreathPerKill: +(db / N).toFixed(4) };
}
for (const [lv, df, el, rift] of [[5, 0, 0, false], [20, 0, 0, false], [40, 0, 0, false], [70, 0, 0, false], [70, 4, 0, false], [70, 8, 0, false], [70, 8, 0, true], [30, 0, 1, false], [30, 0, 2, false], [30, 0, 4, false], [30, 0, 5, false]] as const) {
  console.log(J(sim(lv, df, el as 0 | 1 | 2 | 4 | 5, 200000, rift)));
}
console.log('tier key: 0 trash, 1 champion, 2 rare, 4 boss(guardian), 5 treasure goblin');
