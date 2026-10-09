// Skills (K): active slots, class skill list, three runes per skill and the Task Bar Hero style 3-tier upgrade ladder.

import { useState } from 'preact/hooks';
import { CLASSES } from '@shared/data/classes';
import { AUTO_CAST_MODES, AUTO_CAST_LABEL, AUTO_CAST_NOTE, autoCastMode, autoCastRuleText } from '@shared/autoCast';
import { TARGET_PRIORITIES, TARGET_PRIORITY_LABEL, TARGET_PRIORITY_NOTE, normalizeTargetPriority } from '@shared/targetPriority';
import { RUNE_UNLOCK_OFFSETS, SKILLS, SKILL_SLOTS, TIER_COSTS, collectSkillMods, describeSkill, runeUnlockLevel, skillsForClass, type SkillDef } from '@shared/data/skills';
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

const skillsUI = new Local<{ selected: string | null; assign: number | null }>({ selected: null, assign: null });

const ELEMENT_COLOR: Record<Element, string> = {
  physical: '#e2d8c4', fire: '#ff8a3d', cold: '#7fd3ff', lightning: '#d6c2ff', poison: '#8fd16a', arcane: '#c39bff', holy: '#ffe9a0',
};
const KIND_LABEL: Record<SkillDef['kind'], string> = {
  primary: 'Primary Attack', spender: 'Spender', channel: 'Channeled Spender', cooldown: 'Cooldown', buff: 'Buff', summon: 'Summon',
};
const ROMAN = ['I', 'II', 'III'];

function SkillPoints({ n }: { n: number }) {
  return (
    <span class="sp-chip" {...textTipHandlers(() => ({ title: 'Skill Points', lines: ['Earned one per level. Spend them on upgrade tiers; Reset Tiers refunds everything.'] }), 'sp')}>
      <IconStar4 size={13} /> <b>{fmtInt(n)}</b>
    </span>
  );
}

function SlotStrip({ char }: { char: CharacterSave }) {
  const { assign, selected } = useLocal(skillsUI, (s) => ({ assign: s.assign, selected: s.selected }));
  const drag = useDrag();
  const primary = SKILLS[char.skills.primary];
  const place = (i: number) => {
    // A skill is selected in the list: drop it straight into this slot; otherwise arm the slot for the next pick.
    const sk = selected && SKILLS[selected];
    if (assign === i) skillsUI.set({ assign: null });
    else if (sk && sk.kind !== 'primary' && sk.unlock <= char.level) { void run('skillSlot', { slot: i, skill: sk.id }); skillsUI.set({ assign: null }); }
    else skillsUI.set({ assign: i });
  };
  return (
    <div class="slot-strip">
      <div class="sslot primary" {...textTipHandlers(() => ({ title: primary.name, icon: <SkillGlyph glyph={primary.icon.glyph} color={primary.icon.color} size={34} />, sub: 'Primary attack · always active', lines: [describeSkill(primary, collectSkillMods(primary, char.skills.runes[primary.id], char.skills.tiers[primary.id] ?? 0))] }), 'prim')}
        onClick={() => skillsUI.set({ selected: primary.id })}>
        <SkillGlyph glyph={primary.icon.glyph} color={primary.icon.color} size={40} />
        <span class="sslot-key">AUTO</span>
      </div>
      <i class="slot-sep" />
      {Array.from({ length: SKILL_SLOTS }, (_, i) => {
        const id = char.skills.slots[i];
        const sk = id ? SKILLS[id] : null;
        return (
          <div
            key={i}
            class={cls('sslot', sk ? 'filled' : 'empty', assign === i && 'armed', canDropOn(drag, `sslot:${i}`) && 'drop-ok')}
            data-drop={`sslot:${i}`}
            onClick={() => { if (!justDragged()) place(i); }}
            onContextMenu={(e) => { e.preventDefault(); if (sk) void run('skillSlot', { slot: i, skill: null }); }}
            {...textTipHandlers(() => (sk ? { title: sk.name, icon: <SkillGlyph glyph={sk.icon.glyph} color={sk.icon.color} size={34} />, sub: `Slot ${i + 1} · right-click to clear`, lines: [describeSkill(sk, collectSkillMods(sk, char.skills.runes[sk.id], char.skills.tiers[sk.id] ?? 0))] } : { title: `Slot ${i + 1}`, sub: 'Empty', note: 'Click, then choose a skill. Or drag a skill here.' }), `slot-${i}-${id}`)}
          >
            {sk ? <SkillGlyph glyph={sk.icon.glyph} color={sk.icon.color} size={40} /> : <span class="sslot-plus">+</span>}
            <span class="sslot-key">{i + 1}</span>
          </div>
        );
      })}
      <div class="slot-hint">{assign !== null ? `Choose a skill for slot ${assign + 1}` : 'Click a slot, then a skill. Drag works too.'}</div>
    </div>
  );
}

function SkillRow({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const { selected, assign } = useLocal(skillsUI, (s) => ({ selected: s.selected, assign: s.assign }));
  const locked = skill.unlock > char.level;
  const slot = char.skills.slots.indexOf(skill.id);
  const tiers = char.skills.tiers[skill.id] ?? 0;
  const canDrag = !locked && skill.kind !== 'primary';
  return (
    <div
      class={cls('srow', selected === skill.id && 'on', locked && 'locked')}
      onPointerDown={canDrag ? (e) => beginDrag(e as PointerEvent, { kind: 'skill', skillId: skill.id }) : undefined}
      onClick={() => {
        if (justDragged()) return;
        if (assign !== null && canDrag) { void run('skillSlot', { slot: assign, skill: skill.id }); skillsUI.set({ assign: null, selected: skill.id }); }
        else skillsUI.set({ selected: skill.id });
      }}
    >
      <div class="srow-ic"><SkillGlyph glyph={skill.icon.glyph} color={skill.icon.color} size={30} /></div>
      <div class="srow-t">
        <b>{skill.name}</b>
        <span>{locked ? <><IconLock size={10} /> Unlocks at level {skill.unlock}</> : KIND_LABEL[skill.kind]}</span>
      </div>
      <div class="srow-r">
        {!locked && (
          <span class="tier-dots">{ROMAN.map((_, i) => <i class={i < tiers ? 'on' : ''} key={i} />)}</span>
        )}
        {slot >= 0 && <span class="srow-slot">{slot + 1}</span>}
        {skill.kind === 'primary' && <span class="srow-slot p">P</span>}
      </div>
    </div>
  );
}

function RuneCards({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const cur = char.skills.runes[skill.id] ?? null;
  const skillLocked = skill.unlock > char.level;
  return (
    <div class="runes">
      {skill.runes.map((r, i) => {
        const need = runeUnlockLevel(skill, i);
        const locked = skillLocked || need > char.level;
        const on = cur === r.id;
        return (
          <button
            key={r.id}
            class={cls('rune', on && 'on', locked && 'locked')}
            disabled={locked}
            onClick={() => void run('skillRune', { skill: skill.id, rune: on ? null : r.id })}
          >
            <span class="rune-ic" style={{ '--rc': hex(skill.icon.color) }}>
              {locked ? <IconLock size={12} /> : on ? <IconCheck size={12} /> : <span>{'ABC'[i]}</span>}
            </span>
            <b>{r.name}</b>
            <p>{r.desc}</p>
            <em>{locked ? `Level ${need}` : on ? 'Active' : 'Select'}</em>
          </button>
        );
      })}
    </div>
  );
}

function TierLadder({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const cur = char.skills.tiers[skill.id] ?? 0;
  const locked = skill.unlock > char.level;
  return (
    <div class="ladder">
      {skill.tiers.map((t, i) => {
        const owned = i < cur;
        const next = i === cur && !locked;
        const cost = TIER_COSTS[i];
        const afford = char.skillPoints >= cost;
        return (
          <div class={cls('tier-node', owned && 'owned', next && 'next', (locked || (!owned && !next)) && 'future')} key={i}>
            <div class="tn-rail">
              <span class="tn-dot"><b>{ROMAN[i]}</b></span>
              {i < skill.tiers.length - 1 && <span class={cls('tn-line', i + 1 < cur && 'lit', owned && i + 1 === cur && 'half')} />}
            </div>
            <div class="tn-body">
              <div class="tn-top">
                <b>{t.name}</b>
                {owned && <em class="tn-own"><IconCheck size={10} /> Unlocked</em>}
              </div>
              <p>{t.desc}</p>
            </div>
            <div class="tn-act">
              {owned && <span class="tn-state">Active</span>}
              {next && (
                <button class={cls('btn sm primary', !afford && 'short')} disabled={!afford} onClick={() => void run('skillTier', { skill: skill.id })}>
                  Unlock
                  <span class={cls('tn-cost', !afford && 'short')}><IconStar4 size={10} />{cost}</span>
                </button>
              )}
              {!owned && !next && (
                <span class={cls('tn-cost idle', char.skillPoints < cost && 'short')}><IconStar4 size={10} />{cost}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Detail({ skill, char }: { skill: SkillDef; char: CharacterSave }) {
  const runeId = char.skills.runes[skill.id] ?? null;
  const tiers = char.skills.tiers[skill.id] ?? 0;
  const mods = collectSkillMods(skill, runeId, tiers);
  const res = CLASSES[char.classId].resource.name;
  const locked = skill.unlock > char.level;
  const elem = mods.element ?? skill.element;
  const cost = Math.round(skill.cost * (1 + (mods.cost ?? 0) / 100));
  const cd = +(skill.cooldown * (1 + (mods.cooldown ?? 0) / 100)).toFixed(1);
  const dur = +(skill.duration * (1 + (mods.duration ?? 0) / 100)).toFixed(1);
  const rad = Math.round(skill.radius * (1 + (mods.radius ?? 0) / 100));
  const stats: [string, string][] = [];
  if (skill.kind !== 'primary' && skill.kind !== 'buff') stats.push(['Damage', `${Math.round(skill.coef * (1 + (mods.dmg ?? 0) / 100) * 100)}%`]);
  else if (skill.kind === 'primary') stats.push(['Damage', `${Math.round(skill.coef * (1 + (mods.dmg ?? 0) / 100) * 100)}%`]);
  if (cost > 0) stats.push([skill.kind === 'channel' ? `${res} / sec` : `${res} cost`, String(cost)]);
  if (skill.gen + (mods.gen ?? 0) > 0) stats.push([`${res} gained`, `+${skill.gen + (mods.gen ?? 0)}`]);
  if (cd > 0) stats.push(['Cooldown', `${cd}s`]);
  if (dur > 0) stats.push(['Duration', `${dur}s`]);
  if (rad > 0 && skill.kind !== 'buff') stats.push(['Radius', `${rad}`]);
  if (skill.maxSummons + (mods.maxSummons ?? 0) > 0) stats.push(['Max summons', String(skill.maxSummons + (mods.maxSummons ?? 0))]);
  const slotIdx = char.skills.slots.indexOf(skill.id);
  return (
    <div class="sdetail">
      <div class="sd-head">
        <div class="sd-icon" style={{ '--sc': hex(skill.icon.color) }}><SkillGlyph glyph={skill.icon.glyph} color={skill.icon.color} size={58} /></div>
        <div class="sd-titles">
          <h3>{skill.name}</h3>
          <div class="sd-sub">
            <span>{KIND_LABEL[skill.kind]}</span>
            <i class="dot" />
            <span style={{ color: ELEMENT_COLOR[elem] }}>{elem[0].toUpperCase() + elem.slice(1)}</span>
            {slotIdx >= 0 && <><i class="dot" /><span class="sd-slot">Slot {slotIdx + 1}</span></>}
          </div>
        </div>
        {skill.kind !== 'primary' && !locked && (
          <div class="sd-assign">
            <span>Assign</span>
            {Array.from({ length: SKILL_SLOTS }, (_, i) => (
              <button key={i} class={cls('btn sm', slotIdx === i && 'on')} onClick={() => void run('skillSlot', { slot: i, skill: slotIdx === i ? null : skill.id })}>{i + 1}</button>
            ))}
          </div>
        )}
      </div>
      {locked && <div class="sd-lock"><IconLock size={14} /> Reach level <b>{skill.unlock}</b> to unlock this skill.</div>}
      <p class="sd-desc">{describeSkill(skill, mods)}</p>
      <div class="sd-stats">
        {stats.map(([k, v]) => <div class="sd-stat" key={k}><label>{k}</label><b>{v}</b></div>)}
      </div>
      {slotIdx >= 0 && <div class="skill-auto-controls">
        <div class="sd-sec"><span>Auto-cast · Slot {slotIdx + 1}</span></div>
        <div class="pn-actions" role="group" aria-label={`Auto-cast condition for slot ${slotIdx + 1}`}>
          {AUTO_CAST_MODES.map(mode => <button key={mode} class={cls('btn sm', autoCastMode(char.skills, slotIdx) === mode && 'on')}
            aria-pressed={autoCastMode(char.skills, slotIdx) === mode}
            onClick={() => void run('skillAutoCast', { slot: slotIdx, skill: skill.id, mode })}>{AUTO_CAST_LABEL[mode]}</button>)}
        </div>
        <p class="pn-note">{AUTO_CAST_NOTE[autoCastMode(char.skills, slotIdx)]}</p>
        <p class="pn-note">{autoCastRuleText(skill, res)}</p>
        <p class="pn-note">Conditions stay with slot positions when you move skills. Slot order still decides priority.</p>
        <AutoRuleEditor key={`${slotIdx}:${skill.id}`} skill={skill} char={char} slot={slotIdx}/>
      </div>}
      <div class="sd-sec"><span>Runes</span><em>Choose one · changes how the skill behaves</em></div>
      <RuneCards skill={skill} char={char} />
      <div class="sd-sec"><span>Upgrade Tiers</span><em>{tiers} / {skill.tiers.length} unlocked</em></div>
      <TierLadder skill={skill} char={char} />
    </div>
  );
}

export function SkillsPanel() {
  const char = useU((s) => s.char);
  const selected = useLocal(skillsUI, (s) => s.selected);
  const [confirm, setConfirm] = useState(false);
  if (!char) return null;
  const list = skillsForClass(char.classId);
  const sel = SKILLS[selected ?? ''] && SKILLS[selected ?? ''].classId === char.classId ? SKILLS[selected!] : (list.find((s) => s.kind !== 'primary' && s.unlock <= char.level) ?? list[0]);
  const spent = skillPointsSpent(char);
  const preference = normalizeTargetPriority(char.skills.targetPriority);
  return (
    <PanelFrame id="skills" title="Skills" width={940} sub={<span class="pn-lv">{CLASSES[char.classId].name}</span>}>
      <div class="sk-top">
        <SlotStrip char={char} />
        <div class="sk-points">
          <div class="sk-pt-main">
            <label>Skill Points</label>
            <SkillPoints n={char.skillPoints} />
          </div>
          <button
            class={cls('btn sm', confirm && 'primary')}
            disabled={spent === 0}
            onBlur={() => setConfirm(false)}
            onClick={() => { if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3200); } else { setConfirm(false); void run('skillReset'); } }}
          >
            {confirm ? `Refund ${spent} points?` : 'Reset Tiers'}
          </button>
        </div>
      </div>
      <div class="sk-main">
        <div class="slist scroll">
          {list.map((s) => <SkillRow key={s.id} skill={s} char={char} />)}
          <div class="sk-legend target-priority-controls">
            <h4>Target preference</h4>
            <div class="pn-actions" role="group" aria-label="Target preference">
              {TARGET_PRIORITIES.map(mode => <button key={mode} class={cls('btn sm', preference === mode && 'primary')}
                aria-pressed={preference === mode} onClick={() => void run('targetPriority', { mode })}>
                {TARGET_PRIORITY_LABEL[mode]}
              </button>)}
            </div>
            <p>{TARGET_PRIORITY_NOTE[preference]}</p>
            <p>Used by primary attacks, target-based skills and new summon targets. Crowd-aiming skills keep their aim rules; companions keep valid targets near you.</p>
          </div>
          <div class="sk-legend">
            <h4>How skills grow</h4>
            <p><b>Runes</b> unlock {RUNE_UNLOCK_OFFSETS.map((o) => `+${o}`).join(', ')} levels after the skill itself.</p>
            <p><b>Upgrade tiers</b> cost {TIER_COSTS.join(', ')} skill points and stack.</p>
            <p>Skills fire automatically; slot order decides which is tried first. Select a slotted skill to pause automatic casts or require standing still. Optional manual keys are in Settings → Controls.</p>
          </div>
        </div>
        <div class="sdet-wrap scroll">
          <Detail skill={sel} char={char} />
        </div>
      </div>
    </PanelFrame>
  );
}

