// Skills (K) — one screen that scales to 12–20 skills (docs/rework/DESIGN.md §2, docs/rework/depth/FOUNDATION.md §7):
// loadout bar and both point pools on top; a paged, filterable skill list and the passive slots on the left; the
// selected skill on the right with three views (runes & tiers · specialization tree · casting). Nothing scrolls.
// Server ops: skillSlot, skillRune, skillTier, skillNode, skillReset, skillAutoCast, skillAutoRule, targetPriority, passive.

import { useState } from 'preact/hooks';
import { CLASSES } from '@shared/data/classes';
import { AUTO_CAST_MODES, AUTO_CAST_LABEL, AUTO_CAST_NOTE, autoCastMode, autoCastRuleText } from '@shared/autoCast';
import { TARGET_PRIORITIES, TARGET_PRIORITY_LABEL, TARGET_PRIORITY_NOTE, normalizeTargetPriority } from '@shared/targetPriority';
import {
  NODE_GRID, SKILLS, SKILL_SLOTS, TIER_COSTS, collectSkillMods, describeNode, describeSkill, runeUnlockLevel, skillsForClass,
  skillTags, type NodeDef, type SkillDef, type SkillKind, type SkillTag,
} from '@shared/data/skills';
import { PASSIVE_SLOT_LEVELS, passiveEffect, passivesForClass, setPassive, validPassiveState } from '@shared/passives';
import {
  NODE_RANK_COST, SPEC_POINTS, nodeBuyError, nodeRefundError, nodeUnlockLevel, savedNodeRanks, specPointsAvailable, treeBuyableRanks, treeSpent, treeTotalRanks,
} from '@shared/specialization';
import { computeStats } from '@shared/stats';
import { skillPointsSpent } from '@shared/character';
import { fmtInt } from '@shared/format';
import type { CharacterSave, Element } from '@shared/types';
import { PanelFrame } from './common';
import { beginDrag, canDropOn, justDragged, useDrag } from './dnd';
import { IconCheck, IconChevron, IconDiamond, IconLock, IconStar4, hex } from './icons';
import { SkillGlyph } from './skillicons';
import { Local, useLocal, useU } from './state';
import { textTipHandlers, useAdvanced } from './tooltip';
import { Breakdown, Conditions, modsText, sheetOf, sheetStats, sheetStore, tagWord, useSheet } from './sheet';
import { describeEffect } from '@shared/powers';
import { STAT_LABELS } from '@shared/stats';
import { cls, run } from './util';
import { AutoRuleEditor } from './autoRules';

type Mode = { kind: 'skill' } | { kind: 'passive'; slot: number };
export type SkillsTab = 'runes' | 'tree' | 'cast' | 'numbers';
export type SkillsFilter = string; // 'all' or a category (SkillDef.category, else the kind's label)
export const skillsUI = new Local<{ selected: string | null; assign: number | null; mode: Mode; tab: SkillsTab; filter: SkillsFilter; page: number }>(
  { selected: null, assign: null, mode: { kind: 'skill' }, tab: 'runes', filter: 'all', page: 0 });

/** Cards per page: two columns × five rows fit the one-screen budget with the passives underneath. */
const PAGE_SIZE = 10;
const ELEMENT_COLOR: Record<Element, string> = {
  physical: '#e2d8c4', fire: '#ff8a3d', cold: '#7fd3ff', lightning: '#d6c2ff', poison: '#8fd16a', arcane: '#c39bff', holy: '#ffe9a0',
};
const KIND_LABEL: Record<SkillKind, string> = {
  primary: 'Primary attack', spender: 'Spender', channel: 'Channelled', cooldown: 'Cooldown', buff: 'Buff', summon: 'Summon',
};
const KIND_FILTER: Record<SkillKind, string> = { primary: 'Primary', spender: 'Spender', channel: 'Channel', cooldown: 'Cooldown', buff: 'Buff', summon: 'Summon' };
const KIND_ORDER: SkillKind[] = ['primary', 'spender', 'channel', 'cooldown', 'buff', 'summon'];
/** Display group: the authored category (D3-style, per class) or the kind. */
const categoryOf = (s: SkillDef) => s.category ?? KIND_FILTER[s.kind];
/** Mechanic tags shown on a skill (vocabulary v2, ITEMS-SHARED.md §1.1; v1 `melee` is shown as its v2 name Strike). */
const TAG_LABEL: Partial<Record<SkillTag, string>> = {
  strike: 'Strike', projectile: 'Projectile', piercing: 'Piercing', area: 'Area', aerial: 'Aerial', ground: 'Ground', summon: 'Summon',
  device: 'Device', beast: 'Beast', trap: 'Trap', movement: 'Movement', bleed: 'Bleed', burn: 'Burn', chill: 'Chill', stun: 'Stun',
  displace: 'Displace', mark: 'Mark', aura: 'Aura',
};
const ROMAN = ['I', 'II', 'III'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const nodesOf = (char: CharacterSave, id: string) => savedNodeRanks(char, id);
const modsOf = (skill: SkillDef, char: CharacterSave) => collectSkillMods(skill, char.skills.runes[skill.id], char.skills.tiers[skill.id] ?? 0, nodesOf(char, skill.id));

/** Next tier index and its cost, or null when maxed / locked. */
function nextTier(skill: SkillDef, char: CharacterSave): { index: number; cost: number; afford: boolean } | null {
  const cur = char.skills.tiers[skill.id] ?? 0;
  if (skill.unlock > char.level || cur >= skill.tiers.length) return null;
  const cost = TIER_COSTS[cur];
  return { index: cur, cost, afford: char.skillPoints >= cost };
}

function buyTier(skill: SkillDef) { void run('skillTier', { skill: skill.id }); }

/** One tooltip line with the server's exact numbers for a skill (build tools T1), when the sheet has it. */
function exactLine(id: string, char: CharacterSave): string[] {
  const s = sheetOf(sheetStore.get().sheet, id);
  return s ? [sheetStats(s, char).map(([k, v]) => `${k} ${v}`).join(' · ')] : [];
}

// ───────────────────────── loadout ─────────────────────────

function LoadoutBar({ char }: { char: CharacterSave }) {
  const { assign, selected } = useLocal(skillsUI, (s) => ({ assign: s.assign, selected: s.selected }));
  const drag = useDrag();
  const primary = SKILLS[char.skills.primary];
  const place = (i: number) => {
    const sk = selected && SKILLS[selected];
    if (assign === i) skillsUI.set({ assign: null });
    else if (sk && sk.kind !== 'primary' && sk.unlock <= char.level && char.skills.slots[i] !== sk.id) { void run('skillSlot', { slot: i, skill: sk.id }); skillsUI.set({ assign: null }); }
    else skillsUI.set({ assign: i });
  };
  return (
    <div class="sk-loadout" role="group" aria-label="Skill loadout">
      <div class="sk-slot primary" title={`${primary.name} · primary attack, always active`}
        onClick={() => skillsUI.set({ selected: primary.id, mode: { kind: 'skill' } })}
        {...textTipHandlers(() => ({ title: primary.name, icon: <SkillGlyph glyph={primary.icon.glyph} color={primary.icon.color} size={34} />, sub: 'Primary attack · always active', lines: [describeSkill(primary, modsOf(primary, char)), ...exactLine(primary.id, char)] }), 'prim')}>
        <SkillGlyph glyph={primary.icon.glyph} color={primary.icon.color} size={42} />
        <span class="sk-slot-key">AUTO</span>
      </div>
      <i class="sk-slot-sep" />
      {Array.from({ length: SKILL_SLOTS }, (_, i) => {
        const id = char.skills.slots[i];
        const sk = id ? SKILLS[id] : null;
        const mode = autoCastMode(char.skills, i);
        return (
          <div key={i} role="button" tabIndex={0} aria-label={sk ? `Slot ${i + 1}: ${sk.name}` : `Slot ${i + 1}: empty`}
            class={cls('sk-slot', sk ? 'filled' : 'empty', assign === i && 'armed', canDropOn(drag, `sslot:${i}`) && 'drop-ok', mode !== 'auto' && 'held')}
            data-drop={`sslot:${i}`}
            onClick={() => { if (!justDragged()) place(i); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); place(i); } }}
            onContextMenu={(e) => { e.preventDefault(); if (sk) void run('skillSlot', { slot: i, skill: null }); }}
            {...textTipHandlers(() => (sk ? { title: sk.name, icon: <SkillGlyph glyph={sk.icon.glyph} color={sk.icon.color} size={34} />, sub: `Slot ${i + 1} · ${AUTO_CAST_LABEL[mode]}`, lines: [describeSkill(sk, modsOf(sk, char)), ...exactLine(sk.id, char)], note: 'Right-click to clear. Slot order is auto-cast priority.' } : { title: `Slot ${i + 1}`, sub: 'Empty', note: 'Click the slot, then a skill card — or drag a card here.' }), `slot-${i}-${id}`)}>
            {sk ? <SkillGlyph glyph={sk.icon.glyph} color={sk.icon.color} size={40} /> : <span class="sk-slot-plus">+</span>}
            <span class="sk-slot-key">{i + 1}</span>
            {mode !== 'auto' && <span class="sk-slot-mode">{mode === 'paused' ? 'Paused' : 'Still'}</span>}
          </div>
        );
      })}
      <p class="sk-loadout-hint" role="status">{assign !== null ? `Now choose a skill card for slot ${assign + 1}.` : 'Click a slot, then a card — or drag a card onto a slot.'}</p>
    </div>
  );
}

function PointsAndTargets({ char, trees }: { char: CharacterSave; trees: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const spent = skillPointsSpent(char);
  const spec = specPointsAvailable(char);
  const specSpent = Object.entries(char.skills.nodes ?? {}).reduce((n, [id, r]) => n + (SKILLS[id] ? treeSpent(SKILLS[id], r) : 0), 0);
  const preference = normalizeTargetPriority(char.skills.targetPriority);
  const anything = spent > 0 || specSpent > 0;
  return (
    <div class="sk-side">
      <div class={cls('sk-points', char.skillPoints > 0 && 'has')} {...textTipHandlers(() => ({ title: 'Skill points', lines: ['One per level. Spend them on upgrade tiers with the [+] buttons.', `Spent: ${spent}. Refunding returns every point; runes stay.`] }), 'sp')}>
        <IconStar4 size={16} />
        <b>{fmtInt(char.skillPoints)}</b>
        <span>{char.skillPoints === 1 ? 'skill point' : 'skill points'}</span>
      </div>
      {trees && SPEC_POINTS.source === 'separate' && <div class={cls('sk-points spec', spec > 0 && 'has')} {...textTipHandlers(() => ({ title: 'Specialization points', lines: [`One per level from level ${SPEC_POINTS.fromLevel}. Each node rank in a skill’s specialization tree costs one${Number.isFinite(SPEC_POINTS.treeRankCap) ? `; a tree holds at most ${SPEC_POINTS.treeRankCap} ranks` : ''}.`, `Spent: ${specSpent}. Refunds are free.`] }), 'spec')}>
        <IconDiamond size={14} />
        <b>{fmtInt(spec)}</b>
        <span>specialization</span>
      </div>}
      <label class="sk-target" {...textTipHandlers(() => ({ title: 'Target preference', lines: [TARGET_PRIORITY_NOTE[preference], 'Used by primary attacks, target-based skills and new summon targets.'] }), 'tp')}>
        <span>Targets</span>
        <select value={preference} onChange={(e) => void run('targetPriority', { mode: e.currentTarget.value })}>
          {TARGET_PRIORITIES.map((m) => <option key={m} value={m}>{TARGET_PRIORITY_LABEL[m]}</option>)}
        </select>
      </label>
      <button class={cls('btn sm', confirm && 'primary')} disabled={!anything} onBlur={() => setConfirm(false)}
        {...textTipHandlers(() => ({ title: 'Refund all', lines: ['Returns every skill point spent on tiers and clears every specialization tree. Runes and slots stay. Free.'] }), 'refund')}
        onClick={() => { if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3200); } else { setConfirm(false); void run('skillReset'); } }}>
        {confirm ? `Refund ${spent} + ${specSpent}?` : 'Refund all'}
      </button>
    </div>
  );
}

// ───────────────────────── skill list ─────────────────────────

function TierPips({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const cur = char.skills.tiers[skill.id] ?? 0;
  return <span class="sk-pips" aria-label={`Tier ${cur} of ${skill.tiers.length}`}>{skill.tiers.map((_, i) => <i key={i} class={i < cur ? 'on' : ''} />)}</span>;
}

function SpendButton({ skill, char, label = false }: { skill: SkillDef; char: CharacterSave; label?: boolean }) {
  const nt = nextTier(skill, char);
  if (!nt) return null;
  const tier = skill.tiers[nt.index];
  return (
    <button class={cls('sk-plus', !nt.afford && 'short')} disabled={!nt.afford}
      aria-label={`Unlock tier ${ROMAN[nt.index]} of ${skill.name} for ${nt.cost} points`}
      onClick={(e) => { e.stopPropagation(); buyTier(skill); }}
      {...textTipHandlers(() => ({ title: `Tier ${ROMAN[nt.index]} · ${tier.name}`, lines: [tier.desc], sub: `Costs ${nt.cost} skill points${nt.afford ? '' : ` · you have ${char.skillPoints}`}` }), `plus-${skill.id}-${nt.index}`)}>
      <span class="sk-plus-sign">+</span>{label && <span>Tier {ROMAN[nt.index]}</span>}<span class="sk-plus-cost"><IconStar4 size={11} />{nt.cost}</span>
    </button>
  );
}

function TreeBadge({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const total = treeBuyableRanks(skill);
  if (!total) return null;
  const spent = treeSpent(skill, nodesOf(char, skill.id));
  return <span class={cls('sk-tree-badge', spent > 0 && 'on')} aria-label={`Specialization ${spent} of at most ${total} ranks`}><IconDiamond size={9} />{spent}/{total}</span>;
}

function SkillCard({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const { selected, assign, mode } = useLocal(skillsUI, (s) => ({ selected: s.selected, assign: s.assign, mode: s.mode.kind }));
  const locked = skill.unlock > char.level;
  const slot = char.skills.slots.indexOf(skill.id);
  const primary = skill.kind === 'primary';
  const canDrag = !locked && !primary;
  const cur = char.skills.tiers[skill.id] ?? 0;
  const maxed = cur >= skill.tiers.length;
  const runeId = char.skills.runes[skill.id];
  const rune = skill.runes.find((r) => r.id === runeId);
  const el = modsOf(skill, char).element ?? skill.element;
  const choose = () => {
    if (justDragged()) return;
    if (assign !== null && canDrag) { void run('skillSlot', { slot: assign, skill: skill.id }); skillsUI.set({ assign: null, selected: skill.id, mode: { kind: 'skill' } }); }
    else skillsUI.set({ selected: skill.id, mode: { kind: 'skill' } });
  };
  return (
    <div role="button" tabIndex={0} aria-pressed={selected === skill.id && mode === 'skill'}
      class={cls('sk-card', selected === skill.id && mode === 'skill' && 'on', locked && 'locked', assign !== null && canDrag && 'assignable')}
      style={{ '--sc': hex(skill.icon.color) }}
      onPointerDown={canDrag ? (e) => beginDrag(e as PointerEvent, { kind: 'skill', skillId: skill.id }) : undefined}
      onClick={choose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } }}>
      <div class="sk-card-ic"><SkillGlyph glyph={skill.icon.glyph} color={skill.icon.color} size={36} /></div>
      <div class="sk-card-main">
        <div class="sk-card-top"><b>{skill.name}</b>{primary ? (char.skills.primary === skill.id ? <span class="sk-tag p">AUTO</span> : null) : slot >= 0 ? <span class="sk-tag">{slot + 1}</span> : null}</div>
        <div class="sk-card-sub">
          {locked ? <span class="sk-lock"><IconLock size={11} /> Unlocks at level {skill.unlock}</span>
            : <><span>{KIND_LABEL[skill.kind]}</span><i /><span style={{ color: ELEMENT_COLOR[el] }}>{cap(el)}</span></>}
        </div>
        {!locked && <div class="sk-card-foot">
          <TierPips skill={skill} char={char} />
          <TreeBadge skill={skill} char={char} />
          {rune ? <span class="sk-rune-name">{rune.name}</span> : <span class="sk-rune-name none">{skill.runes.some((_, i) => runeUnlockLevel(skill, i) <= char.level) ? 'Rune available' : 'No rune yet'}</span>}
          {maxed ? <span class="chip good sk-max"><IconCheck size={10} /> Max</span> : <SpendButton skill={skill} char={char} />}
        </div>}
      </div>
    </div>
  );
}

function SkillBrowser({ char, list }: { char: CharacterSave; list: SkillDef[] }) {
  const { filter, page } = useLocal(skillsUI, (s) => ({ filter: s.filter, page: s.page }));
  const order = [...new Set([...KIND_ORDER.flatMap((k) => list.filter((s) => s.kind === k).map(categoryOf))])];
  const shown = filter === 'all' ? list : list.filter((s) => categoryOf(s) === filter);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const p = Math.min(page, pages - 1);
  const unlocked = list.filter((s) => s.unlock <= char.level).length;
  return (
    <section class="sk-browser" aria-label="Skills">
      <header class="sk-browser-h">
        <span class="sk-browser-t" {...textTipHandlers(() => ({ title: 'How skills grow', lines: [
          'One skill point per level: spend it with [+] on upgrade tiers (2, 4, 6 points).',
          'One specialization point per level: buy node ranks in a skill’s tree (Specialization view).',
          'Runes unlock as you level (each card shows its level) and change how the skill behaves.',
          'Slotted skills cast on their own; slot order is priority. Right-click a slot to clear it. Refunds are free.',
        ] }), 'sk-help')}>Skills <em>{unlocked} / {list.length} unlocked</em></span>
        {pages > 1 && <span class="sk-pager" role="group" aria-label="Skill pages">
          <button class="btn sm" disabled={p === 0} aria-label="Previous page" onClick={() => skillsUI.set({ page: p - 1 })}><IconChevron dir="left" /></button>
          <span role="status">{p + 1} / {pages}</span>
          <button class="btn sm" disabled={p === pages - 1} aria-label="Next page" onClick={() => skillsUI.set({ page: p + 1 })}><IconChevron dir="right" /></button>
        </span>}
      </header>
      {list.length > PAGE_SIZE && <div class="sk-filters" role="tablist" aria-label="Skill categories">
        <button role="tab" aria-selected={filter === 'all'} class={cls('st-chip', filter === 'all' && 'on')} onClick={() => skillsUI.set({ filter: 'all', page: 0 })}>All <em>{list.length}</em></button>
        {order.map((c) => <button key={c} role="tab" aria-selected={filter === c} class={cls('st-chip', filter === c && 'on')}
          onClick={() => skillsUI.set({ filter: c, page: 0 })}>{c} <em>{list.filter((s) => categoryOf(s) === c).length}</em></button>)}
      </div>}
      <div class="sk-cards">{shown.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE).map((s) => <SkillCard key={s.id} skill={s} char={char} />)}</div>
    </section>
  );
}

function PassiveSlots({ char }: { char: CharacterSave }) {
  const mode = useLocal(skillsUI, (s) => s.mode);
  const list = passivesForClass(char.classId);
  const supported = char.passives === undefined || validPassiveState(char.passives, char.classId);
  const slots = supported ? (char.passives?.slots ?? PASSIVE_SLOT_LEVELS.map(() => null)) : PASSIVE_SLOT_LEVELS.map(() => null);
  return (
    <section class="sk-passives" aria-label="Passive slots">
      <header class="card-h"><span>Passives</span><em>Free to change · {list.length} to choose from</em></header>
      <div class="sk-pslots">
        {PASSIVE_SLOT_LEVELS.map((level, i) => {
          const locked = char.level < level, p = list.find((x) => x.id === slots[i]);
          const on = mode.kind === 'passive' && mode.slot === i;
          return (
            <button key={i} class={cls('sk-pslot', on && 'on', locked && 'locked', p && 'filled')} disabled={locked || !supported}
              onClick={() => skillsUI.set({ mode: { kind: 'passive', slot: i } })}
              {...textTipHandlers(() => (p ? { title: p.name, sub: `Passive slot ${i + 1}`, lines: [passiveEffect(p, char.level)] } : { title: `Passive slot ${i + 1}`, sub: locked ? `Unlocks at level ${level}` : 'Empty' }), `ps-${i}-${p?.id}`)}>
              <span class="sk-pslot-ic">{locked ? <IconLock size={13} /> : <IconStar4 size={14} />}</span>
              <span class="sk-pslot-t"><b>{locked ? `Level ${level}` : p?.name ?? 'Empty slot'}</b><small>{locked ? 'Locked' : p ? `Slot ${i + 1} · equipped` : `Slot ${i + 1} · choose`}</small></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ───────────────────────── detail pane ─────────────────────────

function Stats({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const exact = sheetOf(useLocal(sheetStore, (s) => s.sheet), skill.id);
  if (exact && skill.unlock <= char.level) return <div class="sk-stats exact" {...textTipHandlers(() => ({ title: 'Exact numbers', lines: ['From the server’s combat code: runes, tiers, nodes, items, sets, passives, cooldown and cost reduction included. Per hit = expected (crit-weighted) damage of one hit, without target conditions.'] }), 'sk-exact')}>
    {sheetStats(exact, char).map(([k, v]) => <div class="sk-stat" key={k}><label>{k}</label><b>{v}</b></div>)}</div>;
  const mods = modsOf(skill, char);
  const res = CLASSES[char.classId].resource.name;
  const cost = Math.round(skill.cost * (1 + (mods.cost ?? 0) / 100));
  const cd = +(skill.cooldown * (1 + (mods.cooldown ?? 0) / 100)).toFixed(1);
  const dur = +(skill.duration * (1 + (mods.duration ?? 0) / 100)).toFixed(1);
  const rad = Math.round(skill.radius * (1 + (mods.radius ?? 0) / 100));
  const stats: [string, string][] = [];
  if (skill.kind !== 'buff') stats.push(['Damage', `${Math.round(skill.coef * (1 + (mods.dmg ?? 0) / 100) * 100)}%`]);
  if (cost > 0) stats.push([skill.kind === 'channel' ? `${res} / sec` : `${res} cost`, String(cost)]);
  if (skill.gen + (mods.gen ?? 0) > 0) stats.push([`${res} gained`, `+${skill.gen + (mods.gen ?? 0)}`]);
  if (cd > 0) stats.push(['Cooldown', `${cd}s`]);
  if (dur > 0) stats.push(['Duration', `${dur}s`]);
  if (rad > 0 && skill.kind !== 'buff') stats.push(['Radius', `${rad}`]);
  if (skill.maxSummons + (mods.maxSummons ?? 0) > 0) stats.push(['Max summons', String(skill.maxSummons + (mods.maxSummons ?? 0))]);
  return <div class="sk-stats">{stats.map(([k, v]) => <div class="sk-stat" key={k}><label>{k}</label><b>{v}</b></div>)}</div>;
}

function Tiers({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const advanced = useAdvanced();
  const cur = char.skills.tiers[skill.id] ?? 0;
  const locked = skill.unlock > char.level;
  return (
    <div class="sk-tiers">
      {skill.tiers.map((t, i) => {
        const owned = i < cur, next = i === cur && !locked, cost = TIER_COSTS[i];
        return (
          <div key={i} class={cls('sk-tier', owned && 'owned', next && 'next', !owned && !next && 'future')}>
            <div class="sk-tier-top"><span class="sk-tier-n">{ROMAN[i]}</span><b>{t.name}</b></div>
            <p>{t.desc}</p>
            {advanced && <p class="sk-adv">{modsText(t.mods)}</p>}
            <div class="sk-tier-act">
              {owned ? <span class="chip good"><IconCheck size={10} /> Active</span>
                : next ? <SpendButton skill={skill} char={char} label />
                : <span class={cls('sk-tier-cost', char.skillPoints < cost && 'short')}>{locked ? 'Skill locked' : `After tier ${ROMAN[i - 1]}`} · <IconStar4 size={11} />{cost}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Runes({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const advanced = useAdvanced();
  const cur = char.skills.runes[skill.id] ?? null;
  const skillLocked = skill.unlock > char.level;
  return (
    <div class={cls('sk-runes', skill.runes.length > 3 && 'many')}>
      {skill.runes.map((r, i) => {
        const need = runeUnlockLevel(skill, i), locked = skillLocked || need > char.level, on = cur === r.id;
        return (
          <button key={r.id} class={cls('sk-rune', on && 'on', locked && 'locked')} disabled={locked} style={{ '--rc': hex(skill.icon.color) }}
            aria-pressed={on} onClick={() => void run('skillRune', { skill: skill.id, rune: on ? null : r.id })}>
            <span class="sk-rune-top"><span class="sk-rune-ic">{locked ? <IconLock size={12} /> : on ? <IconCheck size={12} /> : 'ABCDE'[i]}</span><b>{r.name}</b></span>
            <p>{r.desc}</p>
            {advanced && <p class="sk-adv">{[modsText(r.mods), ...(r.effects ?? []).map((e) => describeEffect(e)), r.addTags?.length || r.tags?.length ? `adds tags: ${[...(r.addTags ?? r.tags ?? [])].map(tagWord).join(', ')}` : '', r.removeTags?.length ? `removes: ${r.removeTags.map(tagWord).join(', ')}` : ''].filter(Boolean).join(' · ')}</p>}
            <em>{locked ? `Unlocks at level ${need}` : on ? 'Equipped · click to remove' : 'Click to equip'}</em>
          </button>
        );
      })}
    </div>
  );
}

function Casting({ skill, char, slot }: { skill: SkillDef; char: CharacterSave; slot: number }) {
  const res = CLASSES[char.classId].resource.name;
  const mode = autoCastMode(char.skills, slot);
  return (
    <div class="sk-casting open">
      <div class="sk-cast-body">
        <div class="sk-cast-modes" role="group" aria-label={`Auto-cast for slot ${slot + 1}`}>
          {AUTO_CAST_MODES.map((m) => <button key={m} class={cls('btn sm', mode === m && 'on')} aria-pressed={mode === m}
            onClick={() => void run('skillAutoCast', { slot, skill: skill.id, mode: m })}>{AUTO_CAST_LABEL[m]}</button>)}
        </div>
        <p class="pn-note">{AUTO_CAST_NOTE[mode]} {autoCastRuleText(skill, res)}</p>
        <AutoRuleEditor key={`${slot}:${skill.id}`} skill={skill} char={char} slot={slot} />
      </div>
    </div>
  );
}

// ───────────────────────── specialization tree ─────────────────────────

function nodeState(skill: SkillDef, node: NodeDef, char: CharacterSave): 'max' | 'owned' | 'open' | 'locked' {
  const rank = Math.min(node.maxRank, nodesOf(char, skill.id)[node.id] ?? 0);
  if (rank >= node.maxRank) return 'max';
  if (rank > 0) return 'owned';
  const err = nodeBuyError(char, skill.id, node.id);
  return !err || err === 'No specialization points left' ? 'open' : 'locked';
}

function NodeTree({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const advanced = useAdvanced();
  const nodes = skill.nodes ?? [];
  const [focusId, setFocus] = useState(nodes[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  if (!nodes.length) return (
    <div class="sk-tree-empty">
      <IconDiamond size={22} />
      <b>No specialization tree yet</b>
      <p>This skill has no specialization nodes in this version. Trees arrive with the next skill content; your specialization points wait for them.</p>
    </div>
  );
  const ranks = nodesOf(char, skill.id);
  const focus = nodes.find((n) => n.id === focusId) ?? nodes[0];
  const rank = Math.min(focus.maxRank, ranks[focus.id] ?? 0);
  const buyErr = nodeBuyError(char, skill.id, focus.id), refundErr = nodeRefundError(char, skill.id, focus.id);
  const act = async (delta: 1 | -1) => { setBusy(true); try { await run('skillNode', { skill: skill.id, node: focus.id, delta }); } finally { setBusy(false); } };
  const spent = treeSpent(skill, ranks), total = treeBuyableRanks(skill), all = treeTotalRanks(skill), left = specPointsAvailable(char);
  const at = (n: NodeDef) => ({ x: ((n.pos.col + 0.5) / NODE_GRID.cols) * 100, y: ((n.pos.row + 0.5) / NODE_GRID.rows) * 100 });
  const unlockAt = nodeUnlockLevel(skill, focus);
  return (
    <div class="sk-tree">
      <div class="sk-tree-sum">
        <span><IconDiamond size={11} /> <b>{spent}</b> of {total} ranks{all > total ? ` (the tree holds ${all})` : ' in this tree'}</span>
        <span>{fmtInt(left)} specialization {left === 1 ? 'point' : 'points'} left</span>
        <button class="btn sm" disabled={!spent || busy} onClick={() => void run('skillReset', { skill: skill.id })}
          {...textTipHandlers(() => ({ title: `Reset ${skill.name}`, lines: ['Refunds this skill’s tiers and clears its tree. Free.'] }), 'tree-reset')}>Reset skill</button>
      </div>
      <div class="sk-tree-grid" style={{ '--cols': NODE_GRID.cols, '--rows': NODE_GRID.rows }}>
        <svg class="sk-tree-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {nodes.flatMap((n) => (n.requires ?? []).map((r) => {
            const from = nodes.find((x) => x.id === r.node);
            if (!from) return null;
            const a = at(from), b = at(n), met = Math.min(from.maxRank, ranks[from.id] ?? 0) >= r.rank;
            return <line key={`${from.id}-${n.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} class={met ? 'met' : ''} vector-effect="non-scaling-stroke" />;
          }))}
        </svg>
        {nodes.map((n) => {
          const r = Math.min(n.maxRank, ranks[n.id] ?? 0), st = nodeState(skill, n, char);
          return (
            <button key={n.id} class={cls('sk-node', st, focus.id === n.id && 'focus')} style={{ gridColumn: n.pos.col + 1, gridRow: n.pos.row + 1 }}
              aria-pressed={focus.id === n.id} aria-label={`${n.name}, rank ${r} of ${n.maxRank}`} onClick={() => setFocus(n.id)}>
              <b>{n.name}</b>
              <span class="sk-node-pips">{Array.from({ length: n.maxRank }, (_, i) => <i key={i} class={i < r ? 'on' : ''} />)}<small>{st === 'locked' ? <IconLock size={10} /> : `${r}/${n.maxRank}`}</small></span>
            </button>
          );
        })}
      </div>
      <div class="sk-node-detail">
        <div class="sk-node-dh"><b>{focus.name}</b><em>Rank {rank} / {focus.maxRank}</em></div>
        <dl class="sk-node-dl">
          <dt>Now</dt><dd>{rank > 0 ? describeNode(focus, rank) : <span class="dim">Not learned</span>}</dd>
          {advanced && <><dt>Data</dt><dd class="sk-adv">{[modsText(focus.ranks.slice(0, Math.max(1, rank)).reduce((m, r) => ({ ...m, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? ((m as Record<string, number>)[k] ?? 0) + v : v])) }), {})), ...(focus.effects ?? []).map((e) => describeEffect(e))].filter(Boolean).join(' · ') || 'no numeric mods'}</dd></>}
          {rank < focus.maxRank && <><dt>Next</dt><dd class="next">{describeNode(focus, rank + 1)}</dd></>}
          {(focus.requires?.length || unlockAt > skill.unlock) ? <><dt>Needs</dt><dd>
            {focus.requires?.map((r) => {
              const other = nodes.find((x) => x.id === r.node), ok = Math.min(other?.maxRank ?? 0, ranks[r.node] ?? 0) >= r.rank;
              return <span key={r.node} class={cls('sk-need', ok && 'ok')}>{ok ? <IconCheck size={10} /> : <IconLock size={10} />} {other?.name ?? r.node} rank {r.rank}</span>;
            })}
            {unlockAt > skill.unlock && <span class={cls('sk-need', char.level >= unlockAt && 'ok')}>{char.level >= unlockAt ? <IconCheck size={10} /> : <IconLock size={10} />} Level {unlockAt}</span>}
          </dd></> : null}
        </dl>
        <div class="sk-node-act">
          <button class="btn primary sm" disabled={busy || !!buyErr} onClick={() => void act(1)}>
            {rank >= focus.maxRank ? 'Highest rank' : <>Learn rank {rank + 1} · <IconDiamond size={9} /> {NODE_RANK_COST}</>}
          </button>
          <button class="btn sm" disabled={busy || !!refundErr} onClick={() => void act(-1)}>Refund rank</button>
          {buyErr && rank < focus.maxRank && <span class="pn-note" role="status">{buyErr}</span>}
          {!buyErr && refundErr && rank > 0 && <span class="pn-note" role="status">{refundErr}</span>}
        </div>
      </div>
    </div>
  );
}

function SkillDetail({ skill, char, trees }: { skill: SkillDef; char: CharacterSave; trees: boolean }) {
  const tab = useLocal(skillsUI, (s) => s.tab);
  const advanced = useAdvanced();
  const exact = sheetOf(useLocal(sheetStore, (s) => s.sheet), skill.id);
  const sheetTags = exact?.tags ?? null;
  const tiers = char.skills.tiers[skill.id] ?? 0;
  const mods = modsOf(skill, char);
  const locked = skill.unlock > char.level;
  const elem = mods.element ?? skill.element;
  const slotIdx = char.skills.slots.indexOf(skill.id);
  const total = treeBuyableRanks(skill);
  // The Specialization view appears once the class has any tree (no dead feature before content ships).
  const tabs: [SkillsTab, string][] = [['runes', 'Runes & tiers'], ...(trees ? [['tree', total ? `Specialization ${treeSpent(skill, nodesOf(char, skill.id))}/${total}` : 'Specialization'] as [SkillsTab, string]] : []), ['cast', 'Casting'], ['numbers', 'Numbers']];
  const view = !trees && tab === 'tree' ? 'runes' : tab;
  return (
    <div class="sk-detail">
      <div class="sk-d-head">
        <div class="sk-d-icon" style={{ '--sc': hex(skill.icon.color) }}><SkillGlyph glyph={skill.icon.glyph} color={skill.icon.color} size={52} /></div>
        <div class="sk-d-titles">
          <h3>{skill.name}</h3>
          <div class="sk-d-sub"><span>{KIND_LABEL[skill.kind]}</span><i /><span style={{ color: ELEMENT_COLOR[elem] }}>{cap(elem)}</span>
            {slotIdx >= 0 && <><i /><span class="sk-d-slot">Slot {slotIdx + 1}</span></>}{skill.kind === 'primary' && char.skills.primary === skill.id && <><i /><span class="sk-d-slot">Always active</span></>}
            {(sheetTags ?? [...skillTags(skill, char.skills.runes[skill.id])]).filter((t) => (advanced ? tagWord(t) !== t : TAG_LABEL[t]) && !(t === 'summon' && skill.kind === 'summon')).map((t) => <span key={t} class="sk-tag-word">{advanced ? tagWord(t) : TAG_LABEL[t]}</span>)}
            {locked && <><i /><span class="sk-lock"><IconLock size={11} /> Level {skill.unlock}</span></>}</div>
        </div>
        {skill.kind === 'primary' && !locked && char.skills.primary !== skill.id && (
          <button class="btn sm" onClick={() => void run('skillPrimary', { skill: skill.id })}>Use as primary attack</button>
        )}
        {skill.kind !== 'primary' && !locked && (
          <div class="sk-d-assign" role="group" aria-label="Assign to slot">
            <span>Slot</span>
            {Array.from({ length: SKILL_SLOTS }, (_, i) => (
              <button key={i} class={cls('btn sm', slotIdx === i && 'on')} aria-pressed={slotIdx === i}
                onClick={() => void run('skillSlot', { slot: i, skill: slotIdx === i ? null : skill.id })}>{i + 1}</button>
            ))}
          </div>
        )}
      </div>
      <p class="sk-d-desc">{describeSkill(skill, mods)}</p>
      <div class="sk-d-bar">
        <Stats skill={skill} char={char} />
        <div class="co-seg sk-d-tabs" role="tablist" aria-label="Skill views">
          {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={view === id} class={cls(view === id && 'on')} onClick={() => skillsUI.set({ tab: id })}>{label}</button>)}
        </div>
      </div>
      {view === 'runes' && <>
        <div class="sk-d-sec"><span>Upgrade tiers</span><em>{tiers} of {skill.tiers.length} · costs {TIER_COSTS.join(' / ')} skill points</em></div>
        <Tiers skill={skill} char={char} />
        <div class="sk-d-sec"><span>Runes</span><em>Pick one · unlock at levels {skill.runes.map((_, i) => runeUnlockLevel(skill, i)).join(', ')}</em></div>
        <Runes skill={skill} char={char} />
      </>}
      {view === 'tree' && <NodeTree key={skill.id} skill={skill} char={char} />}
      {view === 'numbers' && <Numbers skill={skill} char={char} />}
      {view === 'cast' && (slotIdx >= 0 ? <Casting skill={skill} char={char} slot={slotIdx} />
        : <p class="pn-note sk-cast-hint">{skill.kind === 'primary' ? 'The primary attack is always active; it needs no casting rules.' : locked ? `Reach level ${skill.unlock} to use this skill.` : 'Put this skill in a slot to set when it casts automatically.'}</p>)}
    </div>
  );
}

function PassiveDetail({ char, slot }: { char: CharacterSave; slot: number }) {
  const advanced = useAdvanced();
  const list = passivesForClass(char.classId);
  const supported = char.passives === undefined || validPassiveState(char.passives, char.classId);
  const slots = supported ? (char.passives?.slots ?? PASSIVE_SLOT_LEVELS.map(() => null)) : PASSIVE_SLOT_LEVELS.map(() => null);
  const current = list.find((p) => p.id === slots[slot]);
  const [choice, setChoice] = useState(current?.id ?? list.find((p) => p.unlock <= char.level && !slots.includes(p.id))?.id ?? list[0].id);
  const [busy, setBusy] = useState(false);
  const selected = list.find((p) => p.id === choice) ?? list[0];
  const preview = { ...char }, error = setPassive(preview, slot, selected.id);
  const before = computeStats(char), after = error ? before : computeStats(preview);
  const change = async (id: string | null) => { setBusy(true); try { await run('passive', { slot, passive: id }); } finally { setBusy(false); } };
  const pct = (n: number) => `${n.toFixed(1)}%`;
  const row = (k: string, a: string, b: string) => <><dt>{k}</dt><dd class={a !== b ? 'chg' : ''}>{a}{a !== b && <> → <b>{b}</b></>}</dd></>;
  return (
    <div class="sk-detail sk-pdetail">
      <div class="sk-d-head">
        <div class="sk-d-icon passive"><IconStar4 size={30} /></div>
        <div class="sk-d-titles"><h3>Passive slot {slot + 1}</h3><div class="sk-d-sub"><span>{current ? `Equipped: ${current.name}` : 'Empty'}</span><i /><span>Unlocked at level {PASSIVE_SLOT_LEVELS[slot]}</span></div></div>
        <button class="btn sm" onClick={() => skillsUI.set({ mode: { kind: 'skill' } })}>Back to skill</button>
      </div>
      <div class={cls('sk-plist', list.length > 9 && 'many', list.length > 15 && 'four')}>
        {list.map((p) => {
          const locked = char.level < p.unlock, elsewhere = slots.includes(p.id) && slots[slot] !== p.id;
          return (
            <button key={p.id} class={cls('sk-pcard', p.id === selected.id && 'on', locked && 'locked')} onClick={() => setChoice(p.id)} aria-pressed={p.id === selected.id}>
              <b>{p.name}</b>
              <small>{locked ? `Unlocks at level ${p.unlock}` : slots[slot] === p.id ? 'In this slot' : elsewhere ? 'In another slot' : 'Available'}</small>
            </button>
          );
        })}
      </div>
      <div class="sk-pinfo">
        <p class="sk-d-desc">{selected.note}</p>
        <p class="sk-peffect">{passiveEffect(selected, char.level)}</p>
        {advanced && selected.effects?.length ? <p class="sk-adv">{selected.effects.map((e) => describeEffect(e)).join(' · ')}</p> : null}
        <dl class="sk-pprev">
          {row('Life', before.life.toLocaleString(), after.life.toLocaleString())}
          {row('Armor / resistance', `${before.armor} / ${before.allRes}`, `${after.armor} / ${after.allRes}`)}
          {row('Resource / second', before.resourceRegen.toFixed(1), after.resourceRegen.toFixed(1))}
          {row('Cooldown reduction', pct(before.cdr), pct(after.cdr))}
          {selected.skill && row(`${SKILLS[selected.skill]?.name ?? 'Skill'} bonus`, pct(before.skillDmg[selected.skill] ?? 0), pct(after.skillDmg[selected.skill] ?? 0))}
        </dl>
        {error && <p class="pn-note" role="status">{error}</p>}
        <div class="sk-pact">
          <button class="btn primary" disabled={busy || !!error || slots[slot] === selected.id} onClick={() => void change(selected.id)}>{busy ? 'Saving…' : slots[slot] === selected.id ? 'Equipped' : `Equip in slot ${slot + 1}`}</button>
          <button class="btn" disabled={busy || !current || !supported} onClick={() => void change(null)}>Clear slot</button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── panel ─────────────────────────

/** Numbers view (build tools T1 / T2): the server's multiplier stack and the conditional terms of one skill. */
function Numbers({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const sheet = useLocal(sheetStore, (s) => s.sheet), err = useLocal(sheetStore, (s) => s.err);
  const s = sheetOf(sheet, skill.id);
  const derived = useU((u) => u.derived);
  if (skill.unlock > char.level) return <p class="pn-note sk-cast-hint">Reach level {skill.unlock} to use this skill.</p>;
  if (!s) return <p class="pn-note sk-cast-hint">{err ?? 'Reading the numbers…'}</p>;
  return (
    <div class="sk-numbers">
      <div class="sk-num-col">
        <div class="sk-d-sec"><span>One hit</span><em>in the order the combat code multiplies</em></div>
        <Breakdown s={s} mainStatLabel={`Main stat (${STAT_LABELS[derived?.mainStatId ?? 'str'] ?? 'main'})`} />
      </div>
      <div class="sk-num-col">
        <div class="sk-d-sec"><span>Conditions</span><em>terms that switch on or off</em></div>
        <Conditions s={s} max={6} />
        <div class="sk-d-sec"><span>Tags</span><em>what tag-keyed items see</em></div>
        <p class="sk-num-tags">{s.tags.map(tagWord).join(' · ')}</p>
        <p class="pn-note">Numbers from the server, refreshed after every change and every few seconds (live buffs count). For damage per second, test on the town’s training dummies.</p>
      </div>
    </div>
  );
}

export function SkillsPanel() {
  useSheet();
  const char = useU((s) => s.char);
  const { selected, mode } = useLocal(skillsUI, (s) => ({ selected: s.selected, mode: s.mode }));
  if (!char) return null;
  const list = skillsForClass(char.classId);
  const sel = SKILLS[selected ?? ''] && SKILLS[selected ?? ''].classId === char.classId ? SKILLS[selected!]
    : (list.find((s) => s.kind !== 'primary' && s.unlock <= char.level && nextTier(s, char)?.afford) ?? list.find((s) => s.kind !== 'primary' && s.unlock <= char.level) ?? list[0]);
  const spec = specPointsAvailable(char);
  const trees = list.some((s) => s.nodes?.length);
  return (
    <PanelFrame id="skills" title="Skills" width={1320}
      sub={<>{CLASSES[char.classId].name} · Level {char.level}{char.skillPoints > 0 && <> · <span class="sk-sub-points">{char.skillPoints} skill {char.skillPoints === 1 ? 'point' : 'points'}</span></>}{trees && SPEC_POINTS.source === 'separate' && spec > 0 && <> · <span class="sk-sub-spec">{spec} specialization</span></>}</>}>
      <div class="sk-top">
        <LoadoutBar char={char} />
        <PointsAndTargets char={char} trees={trees} />
      </div>
      <div class="sk-body">
        <div class="sk-left">
          <SkillBrowser char={char} list={list} />
          <PassiveSlots char={char} />
          {list.length <= 6 && <section class="sk-guide" aria-label="How skills grow">
            <ul>
              <li><IconStar4 size={11} /> One skill point per level. Spend it with <b>[+]</b> on any unlocked skill; tiers cost {TIER_COSTS.join(', ')}.</li>
              <li><IconStar4 size={11} /> Runes unlock as you level (each card shows its level) and change how the skill behaves.</li>
              <li><IconStar4 size={11} /> Slotted skills cast on their own; slot order is priority. <b>Refund all</b> is free.</li>
            </ul>
          </section>}
        </div>
        {mode.kind === 'passive' ? <PassiveDetail key={`p${mode.slot}`} char={char} slot={mode.slot} /> : <SkillDetail key={sel.id} skill={sel} char={char} trees={trees} />}
      </div>
    </PanelFrame>
  );
}
