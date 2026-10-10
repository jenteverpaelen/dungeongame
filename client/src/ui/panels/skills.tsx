// Skills (K) — one screen (docs/rework/DESIGN.md §2): loadout bar, skill cards with tier pips and a direct [+] spend,
// a detail pane with tiers, runes and casting inline, and the passive slots on the same page. Same server ops as before:
// skillSlot, skillRune, skillTier, skillReset, skillAutoCast, skillAutoRule, targetPriority, passive.

import { useState } from 'preact/hooks';
import { CLASSES } from '@shared/data/classes';
import { AUTO_CAST_MODES, AUTO_CAST_LABEL, AUTO_CAST_NOTE, autoCastMode, autoCastRuleText } from '@shared/autoCast';
import { TARGET_PRIORITIES, TARGET_PRIORITY_LABEL, TARGET_PRIORITY_NOTE, normalizeTargetPriority } from '@shared/targetPriority';
import { RUNE_UNLOCK_OFFSETS, SKILLS, SKILL_SLOTS, TIER_COSTS, collectSkillMods, describeSkill, runeUnlockLevel, skillsForClass, type SkillDef } from '@shared/data/skills';
import { PASSIVE_SLOT_LEVELS, passiveEffect, passivesForClass, setPassive, validPassiveState } from '@shared/passives';
import { computeStats } from '@shared/stats';
import { skillPointsSpent } from '@shared/character';
import { fmtInt } from '@shared/format';
import type { CharacterSave, Element } from '@shared/types';
import { PanelFrame } from './common';
import { beginDrag, canDropOn, justDragged, useDrag } from './dnd';
import { IconCheck, IconLock, IconStar4, hex } from './icons';
import { SkillGlyph } from './skillicons';
import { Local, useLocal, useU } from './state';
import { textTipHandlers } from './tooltip';
import { cls, run } from './util';
import { AutoRuleEditor } from './autoRules';

type Mode = { kind: 'skill' } | { kind: 'passive'; slot: number };
export const skillsUI = new Local<{ selected: string | null; assign: number | null; mode: Mode }>({ selected: null, assign: null, mode: { kind: 'skill' } });

const ELEMENT_COLOR: Record<Element, string> = {
  physical: '#e2d8c4', fire: '#ff8a3d', cold: '#7fd3ff', lightning: '#d6c2ff', poison: '#8fd16a', arcane: '#c39bff', holy: '#ffe9a0',
};
const KIND_LABEL: Record<SkillDef['kind'], string> = {
  primary: 'Primary attack', spender: 'Spender', channel: 'Channelled', cooldown: 'Cooldown', buff: 'Buff', summon: 'Summon',
};
const ROMAN = ['I', 'II', 'III'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Next tier index and its cost, or null when maxed / locked. */
function nextTier(skill: SkillDef, char: CharacterSave): { index: number; cost: number; afford: boolean } | null {
  const cur = char.skills.tiers[skill.id] ?? 0;
  if (skill.unlock > char.level || cur >= skill.tiers.length) return null;
  const cost = TIER_COSTS[cur];
  return { index: cur, cost, afford: char.skillPoints >= cost };
}

function buyTier(skill: SkillDef) { void run('skillTier', { skill: skill.id }); }

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
        {...textTipHandlers(() => ({ title: primary.name, icon: <SkillGlyph glyph={primary.icon.glyph} color={primary.icon.color} size={34} />, sub: 'Primary attack · always active', lines: [describeSkill(primary, collectSkillMods(primary, char.skills.runes[primary.id], char.skills.tiers[primary.id] ?? 0))] }), 'prim')}>
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
            {...textTipHandlers(() => (sk ? { title: sk.name, icon: <SkillGlyph glyph={sk.icon.glyph} color={sk.icon.color} size={34} />, sub: `Slot ${i + 1} · ${AUTO_CAST_LABEL[mode]}`, lines: [describeSkill(sk, collectSkillMods(sk, char.skills.runes[sk.id], char.skills.tiers[sk.id] ?? 0))], note: 'Right-click to clear. Slot order is auto-cast priority.' } : { title: `Slot ${i + 1}`, sub: 'Empty', note: 'Click the slot, then a skill card — or drag a card here.' }), `slot-${i}-${id}`)}>
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

function PointsAndTargets({ char }: { char: CharacterSave }) {
  const [confirm, setConfirm] = useState(false);
  const spent = skillPointsSpent(char);
  const preference = normalizeTargetPriority(char.skills.targetPriority);
  return (
    <div class="sk-side">
      <div class={cls('sk-points', char.skillPoints > 0 && 'has')} {...textTipHandlers(() => ({ title: 'Skill points', lines: ['You earn one per level. Spend them on upgrade tiers with the [+] buttons.', `Spent: ${spent}. Refunding returns every point; runes stay.`] }), 'sp')}>
        <IconStar4 size={16} />
        <b>{fmtInt(char.skillPoints)}</b>
        <span>{char.skillPoints === 1 ? 'point to spend' : 'points to spend'}</span>
      </div>
      <label class="sk-target" {...textTipHandlers(() => ({ title: 'Target preference', lines: [TARGET_PRIORITY_NOTE[preference], 'Used by primary attacks, target-based skills and new summon targets.'] }), 'tp')}>
        <span>Targets</span>
        <select value={preference} onChange={(e) => void run('targetPriority', { mode: e.currentTarget.value })}>
          {TARGET_PRIORITIES.map((m) => <option key={m} value={m}>{TARGET_PRIORITY_LABEL[m]}</option>)}
        </select>
      </label>
      <button class={cls('btn sm', confirm && 'primary')} disabled={spent === 0} onBlur={() => setConfirm(false)}
        onClick={() => { if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3200); } else { setConfirm(false); void run('skillReset'); } }}>
        {confirm ? `Refund ${spent} points?` : 'Refund tiers'}
      </button>
    </div>
  );
}

// ───────────────────────── cards ─────────────────────────

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
  const el = (collectSkillMods(skill, runeId, cur).element ?? skill.element);
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
      <div class="sk-card-ic"><SkillGlyph glyph={skill.icon.glyph} color={skill.icon.color} size={40} /></div>
      <div class="sk-card-main">
        <div class="sk-card-top"><b>{skill.name}</b>{primary ? <span class="sk-tag p">AUTO</span> : slot >= 0 ? <span class="sk-tag">{slot + 1}</span> : null}</div>
        <div class="sk-card-sub">
          {locked ? <span class="sk-lock"><IconLock size={11} /> Unlocks at level {skill.unlock}</span>
            : <><span>{KIND_LABEL[skill.kind]}</span><i /><span style={{ color: ELEMENT_COLOR[el] }}>{cap(el)}</span></>}
        </div>
        {!locked && <div class="sk-card-foot">
          <TierPips skill={skill} char={char} />
          {rune ? <span class="sk-rune-name">{rune.name}</span> : <span class="sk-rune-name none">{skill.runes.some((_, i) => runeUnlockLevel(skill, i) <= char.level) ? 'Rune available' : 'No rune yet'}</span>}
          {maxed ? <span class="chip good sk-max"><IconCheck size={10} /> Max</span> : <SpendButton skill={skill} char={char} />}
        </div>}
      </div>
    </div>
  );
}

function PassiveSlots({ char }: { char: CharacterSave }) {
  const mode = useLocal(skillsUI, (s) => s.mode);
  const list = passivesForClass(char.classId);
  const supported = char.passives === undefined || validPassiveState(char.passives, char.classId);
  const slots = supported ? (char.passives?.slots ?? PASSIVE_SLOT_LEVELS.map(() => null)) : PASSIVE_SLOT_LEVELS.map(() => null);
  return (
    <section class="sk-passives" aria-label="Passive slots">
      <header class="card-h"><span>Passives</span><em>Free to change · one passive per slot</em></header>
      <div class="sk-pslots">
        {PASSIVE_SLOT_LEVELS.map((level, i) => {
          const locked = char.level < level, p = list.find((x) => x.id === slots[i]);
          const on = mode.kind === 'passive' && mode.slot === i;
          return (
            <button key={i} class={cls('sk-pslot', on && 'on', locked && 'locked', p && 'filled')} disabled={locked || !supported}
              onClick={() => skillsUI.set({ mode: { kind: 'passive', slot: i } })}>
              <span class="sk-pslot-ic">{locked ? <IconLock size={13} /> : <IconStar4 size={14} />}</span>
              <span class="sk-pslot-t"><b>{locked ? `Level ${level}` : p?.name ?? 'Empty slot'}</b><small>{locked ? 'Locked' : p ? `Slot ${i + 1} · equipped` : `Slot ${i + 1} · choose a passive`}</small></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ───────────────────────── detail pane ─────────────────────────

function Stats({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const runeId = char.skills.runes[skill.id] ?? null;
  const tiers = char.skills.tiers[skill.id] ?? 0;
  const mods = collectSkillMods(skill, runeId, tiers);
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
  const cur = char.skills.runes[skill.id] ?? null;
  const skillLocked = skill.unlock > char.level;
  return (
    <div class="sk-runes">
      {skill.runes.map((r, i) => {
        const need = runeUnlockLevel(skill, i), locked = skillLocked || need > char.level, on = cur === r.id;
        return (
          <button key={r.id} class={cls('sk-rune', on && 'on', locked && 'locked')} disabled={locked} style={{ '--rc': hex(skill.icon.color) }}
            aria-pressed={on} onClick={() => void run('skillRune', { skill: skill.id, rune: on ? null : r.id })}>
            <span class="sk-rune-top"><span class="sk-rune-ic">{locked ? <IconLock size={12} /> : on ? <IconCheck size={12} /> : 'ABC'[i]}</span><b>{r.name}</b></span>
            <p>{r.desc}</p>
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
    <details class="sk-casting">
      <summary><span>Casting &amp; rules</span><em>Slot {slot + 1} · {AUTO_CAST_LABEL[mode]}</em></summary>
      <div class="sk-cast-body">
        <div class="sk-cast-modes" role="group" aria-label={`Auto-cast for slot ${slot + 1}`}>
          {AUTO_CAST_MODES.map((m) => <button key={m} class={cls('btn sm', mode === m && 'on')} aria-pressed={mode === m}
            onClick={() => void run('skillAutoCast', { slot, skill: skill.id, mode: m })}>{AUTO_CAST_LABEL[m]}</button>)}
        </div>
        <p class="pn-note">{AUTO_CAST_NOTE[mode]} {autoCastRuleText(skill, res)}</p>
        <AutoRuleEditor key={`${slot}:${skill.id}`} skill={skill} char={char} slot={slot} />
      </div>
    </details>
  );
}

function SkillDetail({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const runeId = char.skills.runes[skill.id] ?? null;
  const tiers = char.skills.tiers[skill.id] ?? 0;
  const mods = collectSkillMods(skill, runeId, tiers);
  const locked = skill.unlock > char.level;
  const elem = mods.element ?? skill.element;
  const slotIdx = char.skills.slots.indexOf(skill.id);
  return (
    <div class="sk-detail">
      <div class="sk-d-head">
        <div class="sk-d-icon" style={{ '--sc': hex(skill.icon.color) }}><SkillGlyph glyph={skill.icon.glyph} color={skill.icon.color} size={56} /></div>
        <div class="sk-d-titles">
          <h3>{skill.name}</h3>
          <div class="sk-d-sub"><span>{KIND_LABEL[skill.kind]}</span><i /><span style={{ color: ELEMENT_COLOR[elem] }}>{cap(elem)}</span>
            {slotIdx >= 0 && <><i /><span class="sk-d-slot">Slot {slotIdx + 1}</span></>}{skill.kind === 'primary' && <><i /><span class="sk-d-slot">Always active</span></>}</div>
        </div>
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
      {locked && <div class="sk-d-lock"><IconLock size={14} /> Reach level <b>{skill.unlock}</b> to unlock this skill. You can already read its tiers and runes.</div>}
      <p class="sk-d-desc">{describeSkill(skill, mods)}</p>
      <Stats skill={skill} char={char} />
      <div class="sk-d-sec"><span>Upgrade tiers</span><em>{tiers} of {skill.tiers.length} · costs {TIER_COSTS.join(' / ')} points</em></div>
      <Tiers skill={skill} char={char} />
      <div class="sk-d-sec"><span>Runes</span><em>Pick one · unlock {RUNE_UNLOCK_OFFSETS.map((o) => `+${o}`).join(', ')} levels after the skill</em></div>
      <Runes skill={skill} char={char} />
      {slotIdx >= 0 ? <Casting skill={skill} char={char} slot={slotIdx} />
        : skill.kind !== 'primary' && !locked && <p class="pn-note sk-cast-hint">Put this skill in a slot to set when it casts automatically.</p>}
    </div>
  );
}

function PassiveDetail({ char, slot }: { char: CharacterSave; slot: number }) {
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
      <div class="sk-plist">
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

export function SkillsPanel() {
  const char = useU((s) => s.char);
  const { selected, mode } = useLocal(skillsUI, (s) => ({ selected: s.selected, mode: s.mode }));
  if (!char) return null;
  const list = skillsForClass(char.classId);
  const sel = SKILLS[selected ?? ''] && SKILLS[selected ?? ''].classId === char.classId ? SKILLS[selected!]
    : (list.find((s) => s.kind !== 'primary' && s.unlock <= char.level && nextTier(s, char)?.afford) ?? list.find((s) => s.kind !== 'primary' && s.unlock <= char.level) ?? list[0]);
  const unlocked = list.filter((s) => s.unlock <= char.level).length;
  return (
    <PanelFrame id="skills" title="Skills" width={1320}
      sub={<>{CLASSES[char.classId].name} · Level {char.level}{char.skillPoints > 0 && <> · <span class="sk-sub-points">{char.skillPoints} unspent {char.skillPoints === 1 ? 'point' : 'points'}</span></>}</>}>
      <div class="sk-top">
        <LoadoutBar char={char} />
        <PointsAndTargets char={char} />
      </div>
      <div class="sk-body">
        <div class="sk-left">
          <header class="card-h"><span>Active skills</span><em>{unlocked} of {list.length} unlocked</em></header>
          <div class="sk-cards">{list.map((s) => <SkillCard key={s.id} skill={s} char={char} />)}</div>
          <PassiveSlots char={char} />
          <section class="sk-guide" aria-label="How skills grow">
            <header class="card-h"><span>How skills grow</span></header>
            <ul>
              <li><IconStar4 size={11} /> One skill point per level. Spend it with <b>[+]</b> on any unlocked skill.</li>
              <li><IconStar4 size={11} /> Tiers cost {TIER_COSTS.join(', ')} points and stack. <b>Refund tiers</b> returns every point.</li>
              <li><IconStar4 size={11} /> Runes unlock {RUNE_UNLOCK_OFFSETS.map((o) => `+${o}`).join(', ')} levels after the skill and change how it behaves.</li>
              <li><IconStar4 size={11} /> Slotted skills cast on their own; slot order is priority. Right-click a slot to clear it.</li>
            </ul>
          </section>
        </div>
        {mode.kind === 'passive' ? <PassiveDetail key={`p${mode.slot}`} char={char} slot={mode.slot} /> : <SkillDetail key={sel.id} skill={sel} char={char} />}
      </div>
    </PanelFrame>
  );
}
