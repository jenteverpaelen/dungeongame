import { MAX_LEVEL } from './constants';
import { CLASSES } from './data/classes';
import { AFFIXES, BASES, GEMS, GEM_RANKS, LEGENDARIES, SETS } from './data/items';
import { ELITE_AFFIXES, MONSTERS, RIFT_GUARDIANS } from './data/monsters';
import { MAX_NODES, MAX_NODE_RANK, MAX_RUNES, NODE_GRID, NODE_PLACEHOLDER, SKILLS, TIER_COSTS, describeNode, describeSkill, nodeModsAt, type SkillDef, type SkillMods } from './data/skills';
import { FIELD_IDS, ZONES } from './data/zones';

/** Typed registries remain the source of truth; this checks semantic relationships. */
export const CONTENT_DATA = {
  classes: CLASSES, skills: SKILLS, bases: BASES, affixes: AFFIXES,
  legendaries: LEGENDARIES, sets: SETS, gems: GEMS, gemRanks: GEM_RANKS,
  monsters: MONSTERS, guardians: RIFT_GUARDIANS, eliteAffixes: ELITE_AFFIXES,
  zones: ZONES, fieldIds: FIELD_IDS, maxRunes: MAX_RUNES, tierCosts: TIER_COSTS,
};
export type ContentData = typeof CONTENT_DATA;

export function validateContent(data: ContentData = CONTENT_DATA): string[] {
  const errors: string[] = [];
  const check = (ok: boolean, at: string, message: string) => { if (!ok) errors.push(`${at}: ${message}`); };
  const number = (value: number, at: string, min = 0, integer = false) =>
    check(Number.isFinite(value) && value >= min && (!integer || Number.isInteger(value)), at,
      `expected finite ${integer ? 'integer ' : ''}>= ${min}`);
  const range = (values: number[], at: string) => {
    check(values.length === 2, at, 'expected [min, max]');
    values.forEach((v,i) => number(v, `${at}[${i}]`));
    check(values[0] <= values[1], at, 'minimum exceeds maximum');
  };
  const ids = (items: string[], at: string) => {
    check(new Set(items).size === items.length, at, 'duplicate ID');
    items.forEach((id,i) => check(typeof id === 'string' && id.trim().length > 0, `${at}[${i}]`, 'empty ID'));
  };
  for (const [name, registry] of Object.entries({
    classes:data.classes, skills:data.skills, bases:data.bases, legendaries:data.legendaries,
    sets:data.sets, gems:data.gems, monsters:data.monsters, eliteAffixes:data.eliteAffixes, zones:data.zones,
  })) {
    for (const [key, value] of Object.entries(registry)) {
      check(key.length > 0 && key === value.id, `${name}.${key}.id`, 'must match its nonempty registry key');
    }
  }
  const classRefs = (classIds: string[] | undefined, at: string) => {
    if (!classIds) return;
    ids(classIds, at);
    for (const id of classIds) check(Object.hasOwn(data.classes,id), at, `unknown class ${id}`);
  };
  const baseRef = (id: string, at: string, classId?: string) => {
    const base = Object.hasOwn(data.bases,id) ? data.bases[id] : undefined;
    check(!!base, at, `unknown item base ${id}`);
    if (base && classId && base.classes) check(base.classes.some(c => c === classId), at, `base ${id} cannot be used by ${classId}`);
    return base;
  };
  for (const c of Object.values(data.classes)) {
    const at = `classes.${c.id}`, primary = Object.hasOwn(data.skills,c.primary) ? data.skills[c.primary] : undefined;
    check(!!primary, `${at}.primary`, `unknown skill ${c.primary}`);
    if (primary) check(primary.classId === c.id && primary.kind === 'primary' && primary.unlock === 1,
      `${at}.primary`, 'must be this class\'s level-one primary skill');
    const signature = Object.hasOwn(data.skills,c.signatureSkill) ? data.skills[c.signatureSkill] : undefined;
    check(!!signature, `${at}.signatureSkill`, `unknown skill ${c.signatureSkill}`);
    if (signature) check(signature.classId === c.id, `${at}.signatureSkill`, 'must belong to this class');
    number(c.resource.max, `${at}.resource.max`, Number.MIN_VALUE);
    number(c.attackRange, `${at}.attackRange`);
    for (const id of c.weapons) check(!!baseRef(id,`${at}.weapons`,c.id)?.weapon,`${at}.weapons`,`${id} is not a weapon`);
    for (const id of c.offhands) check(baseRef(id,`${at}.offhands`,c.id)?.kind === 'offhand',`${at}.offhands`,`${id} is not an offhand`);
    for (const [slot,id] of Object.entries(c.starter)) {
      const base = baseRef(id,`${at}.starter.${slot}`,c.id);
      if (base) check(slot === 'mainhand' ? c.weapons.includes(id) : slot === 'offhand' ? c.offhands.includes(id) : base.kind === slot,
        `${at}.starter.${slot}`, `incompatible base ${id}`);
    }
  }
  data.tierCosts.forEach((n,i)=>number(n,`tierCosts[${i}]`,0,true));
  for (const s of Object.values(data.skills)) {
    const at = `skills.${s.id}`;
    classRefs([s.classId],`${at}.classId`);
    number(s.unlock,`${at}.unlock`,1,true);
    check(s.unlock <= MAX_LEVEL,`${at}.unlock`,'exceeds the current level cap');
    for (const key of ['coef','cost','gen','cooldown','range','radius','duration','maxSummons'] as const) number(s[key],`${at}.${key}`);
    // These feed numeric comparisons and spatial queries in the combat brain.
    // Weighted thresholds can be fractional; base resource stats are not an upper bound.
    if (s.auto.when === 'enemiesNear') {
      number(s.auto.count,`${at}.auto.count`);
      number(s.auto.within,`${at}.auto.within`);
    } else if (s.auto.when === 'channel') {
      number(s.auto.startAt,`${at}.auto.startAt`);
      number(s.auto.within,`${at}.auto.within`);
    }
    check(s.runes.length <= data.maxRunes,`${at}.runes`,`at most ${data.maxRunes} runes per skill`);
    check(s.tiers.length <= data.tierCosts.length,`${at}.tiers`,'missing tier costs');
    ids(s.runes.map(r=>r.id),`${at}.runes`);
    for (const [i,rune] of s.runes.entries()) {
      number(rune.unlock,`${at}.runes[${i}].unlock`,1,true);
      check(rune.unlock >= s.unlock,`${at}.runes[${i}].unlock`,'a rune cannot unlock before its skill');
      check(rune.unlock <= MAX_LEVEL,`${at}.runes[${i}].unlock`,'unlock exceeds the current level cap');
      for (const [key,value] of Object.entries(rune.mods)) if (typeof value === 'number') check(Number.isFinite(value),`${at}.runes[${i}].mods.${key}`,'expected finite modifier');
    }
    for (const [i,tier] of s.tiers.entries()) for (const [key,value] of Object.entries(tier.mods))
      if (typeof value === 'number') check(Number.isFinite(value),`${at}.tiers[${i}].mods.${key}`,'expected finite modifier');
    check(!/\{[^}]+\}/.test(describeSkill(s)),`${at}.desc`,'unresolved description placeholder');
    validateNodes(s, at, check, number);
  }
  for (const base of Object.values(data.bases)) {
    const at = `bases.${base.id}`;
    classRefs(base.classes,`${at}.classes`); classRefs(base.affinity,`${at}.affinity`);
    number(base.maxSockets,`${at}.maxSockets`,0,true);
    check(base.names.length > 0 && base.names.every(n=>n.trim().length>0),`${at}.names`,'missing display-name tiers');
    if (base.armorMult !== undefined) number(base.armorMult,`${at}.armorMult`);
    if (base.weapon) {
      number(base.weapon.aps,`${at}.weapon.aps`,Number.MIN_VALUE);
      number(base.weapon.dmgMult,`${at}.weapon.dmgMult`,Number.MIN_VALUE);
      check(base.weapon.twoHanded ? base.kind === 'weapon2h' : base.kind === 'weapon1h',`${at}.weapon.twoHanded`,'does not match item kind');
    }
  }
  ids(data.affixes.map(a=>a.stat),'affixes.stat');
  const itemKinds = new Set(Object.values(data.bases).map(b=>b.kind));
  for (const a of data.affixes) {
    number(a.weight,`affixes.${a.stat}.weight`);
    for (const [kind,values] of Object.entries(a.ranges)) {
      check(itemKinds.has(kind as typeof data.bases[string]['kind']),`affixes.${a.stat}.ranges.${kind}`,'unknown item kind');
      range(values,`affixes.${a.stat}.ranges.${kind}`);
    }
  }
  for (const l of Object.values(data.legendaries)) {
    baseRef(l.base,`legendaries.${l.id}.base`);
    classRefs(l.classes,`legendaries.${l.id}.classes`);
    for (const c of l.classes ?? []) baseRef(l.base,`legendaries.${l.id}.base`,c);
    range(l.range,`legendaries.${l.id}.range`);
    if(l.skillEffect) {
      check(!!data.skills[l.skillEffect.skill],`legendaries.${l.id}.skillEffect`,'unknown skill');
      check(l.classes?.includes(data.skills[l.skillEffect.skill]?.classId)??true,`legendaries.${l.id}.skillEffect`,'wrong skill class');
      for(const [k,v] of Object.entries(l.skillEffect.mods??{}))if(typeof v==='number')check(Number.isFinite(v),`legendaries.${l.id}.mods.${k}`,'non-finite modifier');
    }
  }
  for (const s of Object.values(data.sets)) {
    const at=`sets.${s.id}`;
    classRefs([s.classId],`${at}.classId`);
    ids(s.pieces.map(p=>p.base),`${at}.pieces`);
    for(const p of s.pieces) baseRef(p.base,`${at}.pieces.${p.base}`,s.classId);
    check(new Set(s.bonuses.map(b=>b.count)).size === s.bonuses.length,`${at}.bonuses`,'duplicate piece threshold');
    for(const b of s.bonuses) {
      number(b.count,`${at}.bonuses.count`,1,true);
      check(b.count <= s.pieces.length,`${at}.bonuses.count`,'requires more pieces than the set provides');
    }
    for(const e of s.effects??[]) {
      check(s.bonuses.some(b=>b.count===e.count),`${at}.effects`,'missing displayed threshold');
      for(const skill of e.skills)check(data.skills[skill]?.classId===s.classId,`${at}.effects.${skill}`,'unknown or wrong-class skill');
      if(e.multiplier!==undefined)number(e.multiplier,`${at}.effects.multiplier`,1);
      for(const [k,v] of Object.entries(e.mods??{}))if(typeof v==='number')check(Number.isFinite(v),`${at}.mods.${k}`,'non-finite modifier');
    }
  }
  for (const gem of Object.values(data.gems)) for (const slot of ['weapon','head','armor'] as const) {
    check(gem[slot].values.length === data.gemRanks.length,`gems.${gem.id}.${slot}`,'value count must match gem ranks');
    gem[slot].values.forEach((v,i)=>number(v,`gems.${gem.id}.${slot}[${i}]`));
  }
  ids(data.fieldIds,'fieldIds');
  for(const id of data.fieldIds) check(data.zones[id]?.kind === 'field','fieldIds',`unknown or non-field zone ${id}`);
  const themes=new Set(Object.values(data.zones).map(z=>z.theme));
  for(const z of Object.values(data.zones)) {
    const at=`zones.${z.id}`;
    range(z.levelBand,`${at}.levelBand`);
    for(const level of z.levelBand) check(Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL,`${at}.levelBand`,'invalid level');
    for(const [i,size] of z.size.entries()) number(size,`${at}.size[${i}]`,1,true);
    number(z.packTarget,`${at}.packTarget`,0,true); number(z.respawnSec,`${at}.respawnSec`);
    if(z.kind === 'rift') check(!!data.guardians[z.theme],`${at}.theme`,'missing rift guardian');
  }
  for(const [theme,id] of Object.entries(data.guardians)) {
    check(themes.has(theme as typeof data.zones[string]['theme']),`guardians.${theme}`,'unknown zone theme');
    check(Object.hasOwn(data.monsters,id),`guardians.${theme}`,`unknown monster ${id}`);
  }
  for(const m of Object.values(data.monsters)) {
    const at=`monsters.${m.id}`;
    for(const key of ['hp','radius','scale'] as const) number(m[key],`${at}.${key}`,Number.MIN_VALUE);
    for(const key of ['dmg','speed','weight'] as const) number(m[key],`${at}.${key}`);
    for(const theme of m.themes) check(themes.has(theme as typeof data.zones[string]['theme']),`${at}.themes`,`unknown theme ${theme}`);
    for(const key of ['range','windupMs','cooldownMs'] as const) number(m.attack[key],`${at}.attack.${key}`);
    check(['melee','ranged','fan','fracture','lob','charge','explode','none'].includes(m.attack.kind),`${at}.attack.kind`,'unknown attack kind');
    if(m.attack.kind==='charge') {
      number(m.attack.range,`${at}.attack.range`,Number.MIN_VALUE);
      number(m.attack.chargeMs??NaN,`${at}.attack.chargeMs`,Number.MIN_VALUE);
    } else check(m.attack.chargeMs===undefined,`${at}.attack.chargeMs`,'only charge attacks have a charge duration');
    if(m.attack.projSpeed !== undefined) number(m.attack.projSpeed,`${at}.attack.projSpeed`,Number.MIN_VALUE);
    if(m.attack.aoe !== undefined) number(m.attack.aoe,`${at}.attack.aoe`);
    if(m.attack.kind==='lob') {
      number(m.attack.aoe??NaN,`${at}.attack.aoe`,Number.MIN_VALUE);
      number(m.attack.flightMs??NaN,`${at}.attack.flightMs`,Number.MIN_VALUE);
    } else if(m.attack.kind==='fracture') {
      // Fracture uses fractureLine's own timing; inherited lob metadata is optional.
      if(m.attack.flightMs!==undefined)number(m.attack.flightMs,`${at}.attack.flightMs`,Number.MIN_VALUE);
    } else check(m.attack.flightMs===undefined,`${at}.attack.flightMs`,'only lob attacks have a flight delay');
  }
  return errors;
}

type Check = (ok: boolean, at: string, message: string) => void;
type NumberCheck = (value: number, at: string, min?: number, integer?: boolean) => void;

function finiteMods(m: SkillMods, at: string, check: Check) {
  for (const [key, value] of Object.entries(m)) if (typeof value === 'number') check(Number.isFinite(value), `${at}.${key}`, 'expected finite modifier');
  for (const [key, value] of Object.entries(m.vars ?? {})) check(Number.isFinite(value), `${at}.vars.${key}`, 'expected finite modifier');
}

/** Specialization trees: limits, ranks, prerequisites (no cycles), layout and text placeholders. */
function validateNodes(s: SkillDef, at: string, check: Check, number: NumberCheck) {
  const nodes = s.nodes ?? [];
  check(nodes.length <= MAX_NODES, `${at}.nodes`, `at most ${MAX_NODES} nodes per skill`);
  const ids = nodes.map((n) => n.id);
  check(new Set(ids).size === ids.length && ids.every((id) => typeof id === 'string' && id.trim().length > 0), `${at}.nodes`, 'duplicate or empty node ID');
  const cells = new Set<string>();
  for (const node of nodes) {
    const nat = `${at}.nodes.${node.id}`;
    number(node.maxRank, `${nat}.maxRank`, 1, true);
    check(node.maxRank <= MAX_NODE_RANK, `${nat}.maxRank`, `at most ${MAX_NODE_RANK} ranks`);
    check(Array.isArray(node.ranks) && node.ranks.length === node.maxRank, `${nat}.ranks`, 'one modifier entry per rank');
    node.ranks?.forEach((m, i) => finiteMods(m, `${nat}.ranks[${i}]`, check));
    if (node.unlock !== undefined) {
      number(node.unlock, `${nat}.unlock`, 1, true);
      check(node.unlock >= s.unlock && node.unlock <= MAX_LEVEL, `${nat}.unlock`, 'must lie between the skill unlock and the level cap');
    }
    const p = node.pos;
    check(!!p && Number.isInteger(p.col) && Number.isInteger(p.row) && p.col >= 0 && p.row >= 0 && p.col < NODE_GRID.cols && p.row < NODE_GRID.rows,
      `${nat}.pos`, `must be a cell of the ${NODE_GRID.cols} × ${NODE_GRID.rows} tree grid`);
    if (p) { check(!cells.has(`${p.col},${p.row}`), `${nat}.pos`, 'two nodes share a cell'); cells.add(`${p.col},${p.row}`); }
    for (const req of node.requires ?? []) {
      const other = nodes.find((n) => n.id === req.node);
      check(!!other && other !== node, `${nat}.requires`, `unknown or self prerequisite ${req.node}`);
      if (other) check(Number.isInteger(req.rank) && req.rank >= 1 && req.rank <= other.maxRank, `${nat}.requires`, `rank must be 1..${other.maxRank}`);
    }
    const text = describeNode(node, node.maxRank), top = nodeModsAt(node, node.maxRank);
    check(!/\{[^}]+\}/.test(text), `${nat}.text`, 'unresolved placeholder');
    for (const m of node.text.matchAll(new RegExp(NODE_PLACEHOLDER.source, 'g'))) {
      const key = m[1];
      const present = key.startsWith('var:') ? top.vars?.[key.slice(4)] !== undefined : (top as Record<string, unknown>)[key] !== undefined;
      check(present, `${nat}.text`, `placeholder {${key}} has no value in the node's ranks`);
    }
  }
  // Prerequisite cycles would make a node unbuyable.
  const visiting = new Set<string>(), done = new Set<string>();
  const visit = (id: string): boolean => {
    if (done.has(id)) return true;
    if (visiting.has(id)) return false;
    visiting.add(id);
    const ok = (nodes.find((n) => n.id === id)?.requires ?? []).every((r) => visit(r.node));
    visiting.delete(id); done.add(id);
    return ok;
  };
  for (const node of nodes) check(visit(node.id), `${at}.nodes.${node.id}.requires`, 'prerequisite cycle');
}
