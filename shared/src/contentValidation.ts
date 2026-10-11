import { MAX_LEVEL } from './constants';
import { CLASSES } from './data/classes';
import { AFFIXES, BASES, GEMS, GEM_RANKS, LEGENDARIES, SETS } from './data/items';
import { ELITE_AFFIXES, MONSTERS, RIFT_GUARDIANS } from './data/monsters';
import { MAX_NODES, MAX_NODE_RANK, MAX_RUNES, NODE_GRID, NODE_PLACEHOLDER, NUMERIC_MOD_KEYS, SKILLS, TIER_COSTS, describeNode, describeSkill, matchesTags, nodeModsAt, skillTags, MECHANIC_TAGS, SKILL_TAGS, type SkillDef, type SkillMods, type TagQuery } from './data/skills';
import { FIELD_IDS, ZONES } from './data/zones';
import { PASSIVES } from './passives';
import { OWN_BUCKET_CAP, isTargetCondition, subStrikeOwner, powerTextIssues, usesElement, type BuffGrant, type Condition, type PowerEffect, type StatusSpec, type Targets } from './powers';
import { GROUND_DEFS, type GroundDef } from './data/grounds';
import { INSCRIPTIONS } from './data/inscriptions';

/** Typed registries remain the source of truth; this checks semantic relationships. */
export const CONTENT_DATA = {
  classes: CLASSES, skills: SKILLS, bases: BASES, affixes: AFFIXES,
  legendaries: LEGENDARIES, sets: SETS, gems: GEMS, gemRanks: GEM_RANKS,
  monsters: MONSTERS, guardians: RIFT_GUARDIANS, eliteAffixes: ELITE_AFFIXES,
  zones: ZONES, fieldIds: FIELD_IDS, maxRunes: MAX_RUNES, tierCosts: TIER_COSTS, passives: PASSIVES,
  grounds: GROUND_DEFS, inscriptions: INSCRIPTIONS,
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
    for (const t of s.tags ?? []) check(MECHANIC_TAGS.includes(t), `${at}.tags`, `${t} is not an authored mechanic tag (kind and element tags are derived)`);
    for (const [i, r] of s.runes.entries()) for (const t of r.tags ?? []) check(MECHANIC_TAGS.includes(t), `${at}.runes[${i}].tags`, `${t} is not an authored mechanic tag`);
    if (s.category !== undefined) check(typeof s.category === 'string' && s.category.trim().length > 0 && s.category.length <= 16, `${at}.category`, 'category must be a short non-empty label');
    if (s.parityReady) {
      // Set-backed: a set bonus of the class names the skill or targets one of its base tags (bible v2 sets key off tags).
      const tags = skillTags(s);
      const targets = (e: PowerEffect) => ('skills' in e && !!e.skills?.includes(s.id)) || ('tags' in e && !!e.tags && matchesTags(tags, e.tags));
      check(Object.values(data.sets).some(set => set.classId === s.classId && set.bonuses.some(b => (b.effects ?? []).some(targets))), `${at}.parityReady`, 'only set-backed skills can be parity-ready');
    }
    validateNodes(s, at, check, number);
    // Rune and node power templates: targets of the owner's class, legal buckets; a rune's desc names its numbers.
    for (const [i, r] of s.runes.entries()) if (r.effects?.length) {
      validateEffects(data, r.effects, `${at}.runes[${i}].effects`, [s.classId], check);
      for (const issue of powerTextIssues(r.desc, r.effects, false)) check(false, `${at}.runes[${i}].desc`, issue);
    }
    for (const n of s.nodes ?? []) if (n.effects?.length) validateEffects(data, n.effects, `${at}.nodes.${n.id}.effects`, [s.classId], check);
    for (const [k, v] of Object.entries(s.vars ?? {})) check(Number.isFinite(v), `${at}.vars.${k}`, 'expected finite value');
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
    check(Array.isArray(l.effects),`legendaries.${l.id}.effects`,'missing power templates');
    validateEffects(data, l.effects ?? [], `legendaries.${l.id}.effects`, l.classes, check);
    for (const issue of powerTextIssues(l.power, l.effects ?? [], true)) check(false,`legendaries.${l.id}.power`,issue);
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
    for(const b of s.bonuses) {
      validateEffects(data, b.effects ?? [], `${at}.bonuses[${b.count}].effects`, [s.classId], check);
      for (const issue of powerTextIssues(b.text, b.effects ?? [], false)) check(false,`${at}.bonuses[${b.count}].text`,issue);
    }
  }
  for (const g of Object.values(data.grounds ?? {})) validateGround(data, g, check);
  for (const [key, ins] of Object.entries(data.inscriptions ?? {})) {
    const at = `inscriptions.${key}`;
    check(key === ins.id, `${at}.id`, 'must match its registry key');
    check(ins.effects.length > 0, `${at}.effects`, 'needs power templates');
    validateEffects(data, ins.effects, `${at}.effects`, undefined, check);
    ins.effects.forEach((e, i) => check(INSCRIPTION_KINDS.has(e.kind) && !(e.kind === 'skillMods' && Object.keys(e.mods ?? {}).some((k) => k !== 'flags'))
      && !(e.kind === 'projectile' && e.distBonus) && !(e.kind === 'proc' && e.buff && (e.buff.dmg ?? e.buff.chc ?? e.buff.chd ?? e.buff.ias ?? e.buff.stackDmg ?? e.buff.stackIas) !== undefined),
      `${at}.effects[${i}]`, 'Inscriptions change rules: tagGrant, rule, proc, flags, projectile behaviour, deflect or control immunity, never a multiplier or a stat'));
    for (const issue of powerTextIssues(ins.text, ins.effects, false)) check(false, `${at}.text`, issue);
  }
  ids(data.passives.map(p=>p.id),'passives');
  for (const p of data.passives) {
    const at=`passives.${p.id}`;
    classRefs([p.classId],`${at}.classId`);
    number(p.unlock,`${at}.unlock`,1,true);
    check(p.unlock <= MAX_LEVEL,`${at}.unlock`,'exceeds the current level cap');
    check(!!p.stat || !!p.effects?.length,`${at}`,'needs a stat or power templates');
    if (p.stat === 'skillDmg') check(data.skills[p.skill ?? '']?.classId === p.classId,`${at}.skill`,'unknown or wrong-class skill');
    validateEffects(data, p.effects ?? [], `${at}.effects`, [p.classId], check);
    if (p.text !== undefined) for (const issue of powerTextIssues(p.text, p.effects ?? [], false)) check(false,`${at}.text`,issue);
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
    if(z.kind === 'rift') check(!!data.guardians[z.theme],`${at}.theme`,'missing Faultline Keeper');
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

const BANNED_TEMPLATE_STATS = new Set(['skillDmg', 'flatMin', 'flatMax', 'sockets']);

const TAGS = new Set<string>(SKILL_TAGS);

/** A tag query: known tags, not empty. */
function validateQuery(q: TagQuery | undefined, where: string, check: Check) {
  if (!q) return;
  const all = [...(q.anyOf ?? []), ...(q.allOf ?? []), ...(q.noneOf ?? [])];
  check(!!(q.anyOf?.length || q.allOf?.length), where, 'tag query needs anyOf or allOf');
  for (const t of all) check(TAGS.has(t), where, `unknown tag ${t}`);
}

/** Template conditions: known shape and legal for the bucket ('own' = cast time, no target or strike element). */
function validateCondition(c: Condition, bucket: 'own' | 'hit', where: string, check: Check) {
  if (bucket === 'own') check(!isTargetCondition(c) && !usesElement(c), where, 'target / element conditions are per hit, not available in the own bucket');
  if ('all' in c || 'any' in c) {
    const kids = 'all' in c ? c.all : c.any;
    check(kids.length > 0, where, 'composite condition needs children');
    kids.forEach((k, i) => validateCondition(k, bucket, `${where}.${'all' in c ? 'all' : 'any'}[${i}]`, check));
    return;
  }
  for (const k of ['targetInFront', 'targetBehind'] as const)
    if (k in c) check(Number.isFinite((c as Record<string, number>)[k]) && (c as Record<string, number>)[k] > 0 && (c as Record<string, number>)[k] <= 180, where, `${k} must be a half angle in (0, 180]`);
  for (const k of ['targetControlledWithinMs', 'standingStillMs', 'noEnemyWithin'] as const)
    if (k in c) check(Number.isFinite((c as Record<string, number>)[k]) && (c as Record<string, number>)[k] >= 0, where, `${k} must be a finite non-negative number`);
  if ('perSummon' in c || 'buffStacks' in c) check(Number.isInteger(c.max) && c.max >= 1, where, 'scaling condition needs a max of at least 1');
  if ('channeling' in c && typeof c.channeling === 'object') validateQuery(c.channeling, where, check);
  for (const k of ['targetLifeAbovePct', 'targetFartherThan', 'targetWithin', 'lifeBelowPct', 'lifeAbovePct'] as const)
    if (k in c) check(Number.isFinite((c as Record<string, number>)[k]) && (c as Record<string, number>)[k] >= 0, where, `${k} must be a finite non-negative number`);
}

/** Power templates: targets exist (skills of the owner's classes, valid tag queries), finite numbers, legal buckets. */
export function validateEffects(data: Pick<ContentData, 'skills'> & Partial<Pick<ContentData, 'grounds'>>, effects: readonly PowerEffect[], at: string, classes: readonly string[] | undefined, check: Check) {
  const grounds = data.grounds ?? GROUND_DEFS;
  const finite = (v: unknown, where: string) => {
    if (v === undefined) return;
    const n = typeof v === 'object' && v !== null ? (v as { roll: number }).roll : v;
    check(typeof n === 'number' && Number.isFinite(n), where, 'expected a finite amount');
  };
  const skillRef = (id: string, where: string) => {
    if (Object.hasOwn(grounds, id) && !grounds[id].owner) return; // a ground without an owner skill is its own strike id
    const owner = Object.hasOwn(grounds, id) ? grounds[id].owner! : subStrikeOwner(id);
    if (procStrikes.has(owner)) return;
    const skill = Object.hasOwn(data.skills, owner) ? data.skills[owner] : undefined;
    check(!!skill, where, `unknown skill ${id}`);
    if (skill && classes) check(classes.includes(skill.classId), where, `${id} belongs to another class`);
  };
  const targets = (t: Targets, where: string, required: boolean) => {
    if (required) check(!!t.skills?.length || !!t.tags, where, 'needs skills or a tag query');
    t.skills?.forEach((id) => skillRef(id, where));
    validateQuery(t.tags, where, check);
  };
  const buff = (b: BuffGrant | undefined, where: string) => {
    if (!b) return;
    check(b.id.length > 0 && b.ms > 0, where, 'buff needs an id and a duration');
    for (const k of ['dmg', 'chc', 'chd', 'ias', 'dr', 'stackDmg', 'stackIas', 'cdRecovery', 'moveSpeed', 'stackMoveSpeed'] as const) finite(b[k], where);
    if (typeof b.dr === 'number') check(b.dr >= 0 && b.dr <= 100, where, 'buff dr must lie in 0..100');
    if (b.maxStacks !== undefined) check(Number.isInteger(b.maxStacks) && b.maxStacks >= 1, where, 'maxStacks must be an integer of at least 1');
    if (b.stackDmg !== undefined || b.stackIas !== undefined) check((b.maxStacks ?? 1) > 1, where, 'per-stack values need maxStacks above 1');
    check(!(b.ias !== undefined && b.stackIas !== undefined), where, 'use ias or stackIas, not both');
  };
  const status = (s: StatusSpec, where: string) => {
    check(s.kind !== 'carriedDot', where, 'carriedDot only works on a ground placed with carryDot');
    validateStatus(s, where, check, skillRef);
  };
  // Proc strike ids are strike ids of their own (targetable by name).
  const procStrikes = new Set(effects.flatMap((e) => (e.kind === 'proc' && e.strike ? [e.strike.id] : [])));
  effects.forEach((e, i) => {
    const w = `${at}[${i}]`;
    switch (e.kind) {
      case 'skillMods':
        targets(e, w, true);
        for (const [k, v] of Object.entries(e.mods ?? {})) if (typeof v === 'number') check(Number.isFinite(v), `${w}.mods.${k}`, 'expected finite modifier');
        for (const [k, v] of Object.entries(e.mods?.vars ?? {})) check(Number.isFinite(v), `${w}.mods.vars.${k}`, 'expected finite modifier');
        if (e.roll) check(e.roll.field.startsWith('var:') || (NUMERIC_MOD_KEYS as readonly string[]).includes(e.roll.field), w, 'unknown rolled field');
        break;
      case 'ownMult':
        targets(e, w, true);
        check(Number.isFinite(e.mult) && e.mult >= 1 && e.mult <= OWN_BUCKET_CAP, w, `own-bucket multiplier must lie in 1..${OWN_BUCKET_CAP}`);
        break;
      case 'skillMore':
        targets(e, w, true); finite(e.pct, w);
        // A negative pct is a "less" multiplier (Conjurer's Hearth: non-Summon skills deal 10% less), never to zero.
        if (typeof e.pct === 'number') check(e.pct > -100 && 1 + e.pct / 100 <= OWN_BUCKET_CAP, w, `more-multiplier must lie in (0, ${OWN_BUCKET_CAP}]`);
        if (e.when) validateCondition(e.when, isTargetCondition(e.when) ? 'hit' : 'own', w, check);
        break;
      case 'conditional':
        targets(e, w, false); finite(e.pct, w);
        validateCondition(e.when, e.bucket, w, check);
        break;
      case 'stat':
        check(!BANNED_TEMPLATE_STATS.has(e.stat), w, `stat ${e.stat} is not available to templates`); finite(e.value, w);
        if (e.perLegendary) check(Number.isInteger(e.perLegendary.max) && e.perLegendary.max >= 1, w, 'perLegendary needs a max of at least 1');
        break;
      case 'elementStacks': check(e.elements.length > 0 && e.windowMs > 0 && Number.isFinite(e.perStack), w, 'needs elements, a window and a finite bonus'); break;
      case 'elementCycle': check(e.elements.length > 0 && e.periodMs > 0, w, 'needs elements and a period'); finite(e.pct, w); break;
      case 'proc':
        check(e.chance === undefined || (e.chance > 0 && e.chance <= 1), w, 'chance must lie in (0, 1]');
        finite(e.reduceCooldownsMs, w); finite(e.resource, w);
        buff(e.buff, w);
        targets(e, w, false);
        if (e.icdMs !== undefined) check(Number.isFinite(e.icdMs) && e.icdMs >= 0, w, 'icdMs must be a finite non-negative number');
        if (e.status) { check(e.on === 'applyStatus' && e.status.length > 0, w, 'status filters need on: applyStatus and at least one kind'); e.status.forEach((k) => check(STATUS_KINDS.has(k), w, `unknown status ${k}`)); }
        if (e.minHitPct !== undefined) check(e.on === 'takeDamage' && e.minHitPct > 0 && e.minHitPct <= 100, w, 'minHitPct needs on: takeDamage and lies in (0, 100]');
        if (e.every !== undefined) check(Number.isInteger(e.every) && e.every >= 2, w, 'every must be an integer of at least 2');
        if (e.repeat) check(e.on === 'attack', w, 'repeat needs on: attack');
        // applyStatus filters by the applying skill (Player.acting); dash, dashEnd, takeDamage and lifeBelow have none.
        if (e.skills || e.tags) check(!['dash', 'dashEnd', 'takeDamage', 'lifeBelow'].includes(e.on), w, `${e.on} has no strike to filter by skill or tag`);
        if (e.lifePct !== undefined) check(e.on === 'lifeBelow' && e.lifePct > 0 && e.lifePct < 100, w, 'lifePct needs on: lifeBelow and lies in (0, 100)');
        if (e.on === 'lifeBelow') check(e.lifePct !== undefined, w, 'lifeBelow needs lifePct');
        if (e.castSkill) { e.castSkill.skills?.forEach((id) => skillRef(id, w)); validateQuery(e.castSkill.tags, w, check); }
        if (e.when) validateCondition(e.when, ['dash', 'spend', 'cast'].includes(e.on) ? 'own' : 'hit', w, check);
        e.resetCooldowns?.forEach((id) => skillRef(id, w));
        if (e.strike) {
          check(e.strike.id.length > 0 && !Object.hasOwn(data.skills, e.strike.id), w, 'proc strike needs an id of its own (not a skill id)');
          finite(e.strike.coef, w);
          if (e.strike.radius !== undefined) check(e.strike.radius >= 0, w, 'strike radius must be non-negative');
          e.strike.tags?.forEach((t) => check(TAGS.has(t), w, `unknown tag ${t}`));
          if (!e.strike.radius) check((e.strike.at ?? 'target') === 'target' && !['dash', 'cast', 'spend'].includes(e.on), w, 'a single-target proc strike needs a trigger with an enemy (or give it a radius)');
        }
        if (e.summon) { check(e.summon.type.length > 0 && e.summon.lifeMs > 0, w, 'summon needs a type and a lifetime'); skillRef(e.summon.skill, w); }
        if (e.ground) { check(Object.hasOwn(grounds, e.ground.def), w, `unknown ground ${e.ground.def}`); finite(e.ground.scale, w); }
        if (e.applyStatus) status(e.applyStatus, w);
        if (e.clearProjectiles) check(e.clearProjectiles.range > 0 && e.clearProjectiles.halfAngleDeg > 0 && e.clearProjectiles.halfAngleDeg <= 180, w, 'clearProjectiles needs a range and a half angle in (0, 180]');
        break;
      case 'damageTaken':
        finite(e.pct, w);
        if (typeof e.pct === 'number') check(e.pct >= -100, w, 'damage taken cannot drop below -100%');
        if (e.when) validateCondition(e.when, 'hit', w, check);
        if (e.perLegendary) check(Number.isInteger(e.perLegendary.max) && e.perLegendary.max >= 1, w, 'perLegendary needs a max of at least 1');
        break;
      case 'firstHit':
        finite(e.pct, w); check(e.windowMs > 0, w, 'firstHit needs a window');
        if (typeof e.pct === 'number') check(e.pct >= -100, w, 'cannot reduce by more than 100%');
        e.resetOnStatus?.forEach((k) => check(STATUS_KINDS.has(k), w, `unknown status ${k}`));
        break;
      case 'cheatDeath':
        e.rearmOnCast?.forEach((id) => skillRef(id, w));
        check(e.lifePct >= 0 && e.lifePct <= 100 && e.cooldownMs > 0 && (e.invulnMs ?? 0) >= 0, w, 'cheatDeath needs lifePct 0..100, a cooldown and invulnMs >= 0');
        if (e.when) validateCondition(e.when, 'hit', w, check);
        e.resetCooldowns?.forEach((id) => skillRef(id, w));
        buff(e.buff, w);
        break;
      case 'controlImmunity':
        if (e.when) validateCondition(e.when, 'own', w, check);
        if (e.kinds) check(e.kinds.length > 0 && e.kinds.every((k) => ['stun', 'freeze', 'pull'].includes(k)), w, 'kinds must list stun / freeze / pull');
        break;
      case 'setReduce': check((e.by ?? 1) >= 1 && Number.isInteger(e.by ?? 1) && (e.min ?? 2) >= 1, w, 'setReduce needs an integer by >= 1 and min >= 1'); break;
      case 'projectile':
        targets(e, w, false);
        if (e.distBonus) { finite(e.distBonus.pct, w); check(e.distBonus.atUnits > 0, w, 'distBonus needs atUnits > 0'); }
        if (e.bounces !== undefined) check(Number.isInteger(e.bounces) && e.bounces >= 0, w, 'bounces must be a non-negative integer');
        if (e.bounceScale !== undefined) check(e.bounceScale > 0, w, 'bounceScale must be positive');
        if (e.seekMarked) check(e.seekMarked.turn > 0 && e.seekMarked.range > 0, w, 'seekMarked needs a turn rate and a range');
        if (e.rangeRicochet) check((e.bounces ?? 0) > 0, w, 'rangeRicochet spends bounces: give bounces');
        break;
      case 'deflect':
        check(e.range > 0 && e.halfAngleDeg > 0 && e.halfAngleDeg <= 180, w, 'deflect needs a range and a half angle in (0, 180]');
        if (e.when) validateCondition(e.when, 'own', w, check);
        break;
      case 'dot':
        if (e.alsoKind) check(e.alsoKind !== e.dot, w, 'alsoKind must differ from the dot kind');
        targets(e, w, false);
        if (e.stacks !== undefined) check(Number.isInteger(e.stacks) && e.stacks >= 1 && e.stacks <= 8, w, 'stacks must be an integer in 1..8');
        if (e.strengthPct !== undefined) check(e.strengthPct >= 0, w, 'strengthPct must be non-negative');
        finite(e.carryPct, w);
        if (typeof e.carryPct === 'number') check(e.carryPct >= 0 && e.carryPct <= 100, w, 'carryPct must lie in 0..100');
        break;
      case 'stacking':
        targets(e, w, false);
        check(e.buff.length > 0 && e.per > 0 && Number.isInteger(e.max) && e.max >= 1 && e.decayMs > 0, w, 'stacking needs a buff id, per > 0, an integer max and a decay time');
        if (e.skills || e.tags || e.when) check(e.source === 'kills', w, 'only kill-fed stacking can be filtered by skill, tag or the killed enemy');
        if (e.when) { validateCondition(e.when, 'hit', w, check); check(isTargetCondition(e.when), w, 'a kill filter tests the killed enemy (target condition)'); }
        finite(e.stackDmg, w); finite(e.stackIas, w); finite(e.stackMoveSpeed, w);
        buff(e.onMax?.buff, w);
        break;
      case 'resourceDebt':
        targets(e, w, false);
        check(e.max > 0 && (e.regenPct ?? 0) >= -100, w, 'resourceDebt needs max > 0 and regenPct >= -100');
        break;
      case 'tagGrant':
        targets(e, w, false);
        check(!!e.add?.length || e.fromSlot !== undefined, w, 'tagGrant needs tags to add or a slot to copy from');
        e.add?.forEach((t) => check(TAGS.has(t), w, `unknown tag ${t}`));
        if (e.fromSlot !== undefined) check(Number.isInteger(e.fromSlot) && e.fromSlot >= 0 && e.fromSlot < 4, w, 'fromSlot must be a slot index 0..3');
        break;
      case 'rule': {
        targets(e, w, false);
        const r = e.rule;
        switch (r.id) {
          case 'charges': check(Number.isInteger(r.extra) && r.extra >= 1, w, 'charges needs an integer extra of at least 1'); break;
          case 'channelMove': check(r.pct > 0 && r.pct <= 100, w, 'channelMove pct must lie in (0, 100]'); break;
          case 'buffUpkeep': check(r.everyMs > 0, w, 'buffUpkeep needs everyMs > 0'); break;
          case 'spendRefund': check(r.pct > 0 && r.pct <= 100 && Number.isInteger(r.minHits) && r.minHits >= 1 && (r.windowMs ?? 1) > 0, w, 'spendRefund needs pct in (0, 100], an integer minHits and a positive window'); break;
          case 'groundsFollow': check(r.scale > 0 && r.scale <= 1, w, 'groundsFollow scale must lie in (0, 1]'); check(!e.skills && !e.tags, w, 'groundsFollow applies to all your grounds'); break;
          case 'countsAs': check(r.state !== r.as, w, 'countsAs needs two different states'); check(!e.skills && !e.tags, w, 'countsAs applies to all your powers'); break;
          case 'markSpread': check(r.range > 0, w, 'markSpread needs a range'); check(!e.skills && !e.tags, w, 'markSpread applies to all your marks'); break;
          case 'statusLonger': check(['chill', 'stun', 'freeze'].includes(r.status) && r.pct > 0 && Number.isFinite(r.pct), w, 'statusLonger needs chill / stun / freeze and pct > 0'); check(!e.skills && !e.tags, w, 'statusLonger applies to all your statuses of that kind'); break;
          case 'noDecay': check(!e.skills && !e.tags, w, 'noDecay applies to your resource'); break;
          default: check(false, w, 'unknown rule');
        }
        break;
      }
      case 'dashCooldown': check(e.mult > 0 && e.mult <= 1, w, 'dash multiplier must lie in (0, 1]'); break;
      default: check(false, w, 'unknown template kind');
    }
  });
}
const STATUS_KINDS = new Set<string>(['stun', 'freeze', 'chill', 'knockback', 'pull', 'weaken', 'vulnerable', 'taunt', 'bleed', 'burn', 'freezeBuild', 'mark', 'slow', 'carriedDot']);
/** Kinds an Inscription may use (rule changes, never multipliers or stats). */
const INSCRIPTION_KINDS = new Set<string>(['tagGrant', 'rule', 'proc', 'skillMods', 'projectile', 'deflect', 'controlImmunity']);

/** A status a power applies: known kind and the numbers that kind needs. */
function validateStatus(s: StatusSpec, where: string, check: Check, skillRef: (id: string, where: string) => void) {
  check(STATUS_KINDS.has(s.kind), where, `unknown status ${s.kind}`);
  const timed = ['stun', 'freeze', 'chill', 'slow', 'weaken', 'vulnerable', 'taunt', 'mark', 'freezeBuild'].includes(s.kind);
  if (s.kind === 'slow') check(typeof s.pct !== 'number' || (s.pct > 0 && s.pct <= 90), where, 'slow pct must lie in (0, 90]');
  if (timed) check((s.ms ?? 0) > 0, where, `${s.kind} needs a duration (ms)`);
  if (s.kind === 'knockback' || s.kind === 'pull') check(Number.isFinite(s.dist) && s.dist !== 0, where, `${s.kind} needs a distance`);
  if (s.kind === 'weaken' || s.kind === 'vulnerable' || s.kind === 'freezeBuild') check(s.pct !== undefined, where, `${s.kind} needs pct`);
  if (s.kind === 'weaken' && typeof s.pct === 'number') check(s.pct > 0 && s.pct <= 100, where, 'weaken pct must lie in (0, 100]');
  if (s.kind === 'bleed' || s.kind === 'burn') check(s.coef !== undefined, where, `${s.kind} needs a coefficient`);
  if (s.radius !== undefined) check(s.radius > 0, where, 'status radius must be positive');
  if (s.windowMs !== undefined) check(s.kind === 'freezeBuild' && s.windowMs > 0, where, 'windowMs belongs to freezeBuild and must be positive');
  if (s.skills || s.tags || s.exceptSource) check(s.kind === 'vulnerable', where, 'skill / tag scopes belong to vulnerable');
  if (s.origin) check(['knockback', 'pull', 'taunt'].includes(s.kind), where, 'origin belongs to knockback, pull and taunt');
  if (s.consume) check(s.kind === 'vulnerable', where, 'consume belongs to vulnerable');
  s.skills?.forEach((id) => skillRef(id, where));
  validateQuery(s.tags, where, check);
}

/** A data-driven ground definition. */
function validateGround(data: Pick<ContentData, 'skills'>, g: GroundDef, check: Check) {
  const at = `grounds.${g.id}`;
  check(g.name.length > 0 && g.radius > 0 && g.durationMs > 0, at, 'ground needs a name, a radius and a duration');
  if (g.shape === 'line') check((g.lineLength ?? 0) > 0, at, 'line grounds need a lineLength');
  if (g.owner) check(Object.hasOwn(data.skills, g.owner), `${at}.owner`, `unknown skill ${g.owner}`);
  g.tags?.forEach((t) => check(TAGS.has(t), `${at}.tags`, `unknown tag ${t}`));
  if (g.tick) check(g.tick.everyMs > 0 && (g.tick.coef !== undefined || !!g.tick.status), `${at}.tick`, 'tick needs everyMs and a coefficient or a status');
  if (g.onEnter) check(g.onEnter.coef !== undefined || !!g.onEnter.status, `${at}.onEnter`, 'onEnter needs a coefficient or a status');
  if (g.insideFor) check(g.insideFor.ms > 0, `${at}.insideFor`, 'insideFor needs ms > 0');
  for (const c of [g.tick?.coef, g.onEnter?.coef]) if (c !== undefined) check(Number.isFinite(c) && c >= 0, at, 'coefficients must be finite and non-negative');
  if (g.pull) check(g.pull.speed > 0, `${at}.pull`, 'pull needs a speed');
  if (g.maxPerOwner !== undefined) check(Number.isInteger(g.maxPerOwner) && g.maxPerOwner >= 1, at, 'maxPerOwner must be an integer of at least 1');
  const ref = (id: string, where: string) => check(Object.hasOwn(data.skills, id), where, `unknown skill ${id}`);
  for (const [k, s] of [['tick', g.tick?.status], ['onEnter', g.onEnter?.status], ['insideFor', g.insideFor?.status]] as const) if (s) validateStatus(s, `${at}.${k}`, check, ref);
}

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
