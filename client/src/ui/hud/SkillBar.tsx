// Bottom bar: bronze plate with the primary slot, four auto-cast skill slots and the dash slot,
// plus the segmented XP strip and the buff row that sit on it.

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useUI } from '../store';
import { CLASSES } from '@shared/data/classes';
import { SKILLS, collectSkillMods, describeSkill, type SkillDef, type SkillMods } from '@shared/data/skills';
import { AUTO_CAST_LABEL, AUTO_CAST_NOTE, autoCastMode, autoCastRuleText, type AutoCastMode } from '@shared/autoCast';
import { DASH, MAX_LEVEL } from '@shared/constants';
import { fmtInt } from '@shared/format';
import { paragonXpToNext, xpToNext } from '@shared/progression';
import type { BuffView } from '@shared/protocol';
import type { ClassId } from '@shared/types';
import { BuffGlyph, DashGlyph, SkillGlyph } from './Glyphs';
import { HealthGlobe, ResourceGlobe } from './Globes';
import { RESOURCE_STYLES, cap, clamp01, hex, useCooldownTotal } from './util';
import { bindings, CAST_ACTIONS } from '../../game/bindings';
import { preferences } from '../../game/preferences';
import { autoRuleForSlot, autoRuleSummary } from '@shared/autoCastRules';
import { useLocal } from '../panels/state';

const ELEMENT_COLOR: Record<string, string> = {
  physical: '#e2d8c4', fire: '#ff8a3d', cold: '#7fd3ff', lightning: '#d6c2ff', poison: '#8fd16a', arcane: '#c39bff', holy: '#ffe9a0',
};

const KIND_LABEL: Record<string, string> = {
  primary: 'Primary Attack', spender: 'Spender', channel: 'Channeled Spender', cooldown: 'Cooldown Skill', buff: 'Buff', summon: 'Summon',
};

// ───────────────────────── Skill tooltip ─────────────────────────

function SkillTip(p: { skill: SkillDef; classId: ClassId; rcr: number; runeId: string | null; tiers: number; mods: SkillMods; priority?: number; mode?: AutoCastMode; castKey?: string; ruleText?: string }) {
  const skillsKey = useLocal(bindings, () => bindings.label('skills'));
  const { skill, mods } = p;
  const res = CLASSES[p.classId].resource.name;
  const rune = skill.runes.find((r) => r.id === p.runeId);
  const cost = Math.round(skill.cost * (1 + (mods.cost ?? 0) / 100) * (1 - p.rcr / 100));
  const cd = +(skill.cooldown * (1 + (mods.cooldown ?? 0) / 100)).toFixed(1);
  const el = mods.element ?? skill.element;
  const gen = skill.gen + (mods.gen ?? 0);
  return (
    <div class="skill-tip" role="tooltip">
      <div class="st-head">
        <SkillGlyph glyph={skill.icon.glyph} color={hex(skill.icon.color)} class="st-glyph" />
        <div>
          <div class="st-name">{skill.name}</div>
          <div class="st-kind">{KIND_LABEL[skill.kind]}<span class="st-el" style={{ color: ELEMENT_COLOR[el] }}> · {cap(el)}</span></div>
        </div>
      </div>
      <div class="st-desc">{describeSkill(skill, mods)}</div>
      <div class="st-stats">
        {skill.kind === 'primary' && gen > 0 && <span>Generates <b style={{ color: RESOURCE_STYLES[p.classId].hi }}>{gen}</b> {res}</span>}
        {cost > 0 && <span>Cost <b style={{ color: RESOURCE_STYLES[p.classId].hi }}>{cost}</b> {res}{skill.kind === 'channel' ? '/s' : ''}</span>}
        {skill.kind !== 'primary' && gen > 0 && <span>Generates <b style={{ color: RESOURCE_STYLES[p.classId].hi }}>{gen}</b> {res}</span>}
        {cd > 0 && <span>Cooldown <b>{cd}s</b></span>}
      </div>
      {rune && (
        <div class="st-rune">
          <div class="st-rune-name"><i />{rune.name}</div>
          <div class="st-rune-desc">{rune.desc}</div>
        </div>
      )}
      <div class="st-auto">{autoCastRuleText(skill, res)}</div>
      {p.mode && <div class="st-desc"><b>{AUTO_CAST_LABEL[p.mode]}</b> · {AUTO_CAST_NOTE[p.mode]}</div>}
      {p.ruleText && <div class="st-desc">{p.ruleText}</div>}
      {p.priority !== undefined && <div class="st-desc">Auto-cast priority {p.priority}. {p.castKey ? `Press ${p.castKey} to cast${skill.kind === 'channel' ? ' or stop the channel' : ''}.` : 'Manual keys are off; enable them in Settings → Controls.'} Change your loadout with {skillsKey}.</div>}
      {p.tiers > 0 && <div class="st-tiers">{[0, 1, 2].map((i) => <i class={i < p.tiers ? 'on' : ''} />)}<span>Upgrade tier {p.tiers}</span></div>}
    </div>
  );
}

// ───────────────────────── Slots ─────────────────────────

interface SlotProps {
  kind: 'primary' | 'skill' | 'dash';
  keyLabel: ComponentChildren;
  skill: SkillDef | null;
  cd: number;
  nominalMs: number;
  badge?: number;
  active?: boolean;
  dim?: boolean;
  tip?: ComponentChildren;
}

function Slot(p: SlotProps) {
  const total = useCooldownTotal(p.cd, p.nominalMs);
  const [hover, setHover] = useState(false);
  const [flash, setFlash] = useState(0);
  const prev = useRef(p.cd);
  useEffect(() => {
    if (prev.current > 0 && p.cd <= 0 && total > 400) setFlash((n) => n + 1);
    prev.current = p.cd;
  }, [p.cd]);

  const color = p.skill ? hex(p.skill.icon.color) : p.kind === 'dash' ? '#9cc8ee' : '#6d5a3d';
  const r = p.cd > 0 && total > 0 ? clamp01(p.cd / total) : 0;
  const a = (1 - r) * 360;
  const sweep = r > 0
    ? `conic-gradient(from 0deg, rgba(0,0,0,0) 0deg ${a.toFixed(1)}deg, rgba(255,236,190,.8) ${a.toFixed(1)}deg ${(a + 1.4).toFixed(1)}deg, rgba(6,4,3,.74) ${(a + 1.4).toFixed(1)}deg 360deg)`
    : undefined;
  const secs = p.cd >= 9950 ? String(Math.ceil(p.cd / 1000)) : (p.cd / 1000).toFixed(1);
  return (
    <div
      class={`slot slot-${p.kind} interactive${p.active ? ' is-active' : ''}${p.dim ? ' is-dim' : ''}${r > 0 ? ' on-cd' : ''}${p.skill || p.kind === 'dash' ? '' : ' is-empty'}`}
      style={{ '--sk': color }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div class="slot-well">
        <div class="slot-icon">
          {p.kind === 'dash' ? <DashGlyph /> : p.skill ? <SkillGlyph glyph={p.skill.icon.glyph} color={color} /> : null}
        </div>
        {sweep && <div class="slot-sweep" style={{ background: sweep }} />}
        {r > 0 && total >= 1500 && <div class="slot-cd">{secs}</div>}
        {flash > 0 && <i class="slot-flash" key={flash} />}
      </div>
      <div class="slot-key">{p.keyLabel}</div>
      {!!p.badge && p.badge > 0 && <div class="slot-badge">{p.badge}</div>}
      {hover && p.tip}
    </div>
  );
}

// ───────────────────────── Buffs ─────────────────────────

interface BuffMeta { name: string; shape?: string; skill?: SkillDef; color: string }

const BUFF_META: Record<string, { name: string; shape: string; color: string }> = {
  hellforge: { name: 'Hellforge', shape: 'flame', color: '#ff8a3d' },
  stridewind: { name: 'Stridewind', shape: 'up', color: '#6fe3d0' },
  spellsteal: { name: 'Spellsteal', shape: 'star', color: '#c39bff' },
  deep_freeze: { name: 'Deep Freeze', shape: 'crit', color: '#7fd3ff' },
  hunters_mark: { name: "Hunter's Mark", shape: 'crit', color: '#ff6a4a' },
  momentum: { name: 'Momentum', shape: 'up', color: '#ffd24a' },
  wolf_howl: { name: 'Pack Leader', shape: 'up', color: '#d9c7a0' },
  fallen_star: { name: 'Fallen Star', shape: 'star', color: '#ffe08a' },
  eternal_gyre: { name: 'Eternal Gyre', shape: 'shield', color: '#e0e0f0' },
  shield: { name: 'Shield', shape: 'shield', color: '#7fb4ff' },
  haste: { name: 'Haste', shape: 'bolt', color: '#ffe36a' },
  // Field shrines (server/src/sim/instance.ts SHRINE): two minutes, combat only.
  shrine_empowered: { name: 'Empowered Shrine', shape: 'flame', color: '#ff7a4a' },
  shrine_frenzied: { name: 'Frenzied Shrine', shape: 'bolt', color: '#ffe36a' },
  shrine_keen: { name: 'Keen Shrine', shape: 'crit', color: '#7fd3ff' },
};

function buffMeta(id: string): BuffMeta {
  const sk = SKILLS[id];
  if (sk) return { name: sk.name, skill: sk, color: hex(sk.icon.color) };
  if (id.startsWith('ouroboros')) {
    const el = id.split('_')[1] ?? 'physical';
    return { name: `Ouroboros (${cap(el)})`, shape: 'flame', color: ELEMENT_COLOR[el] ?? '#e2d8c4' };
  }
  const m = BUFF_META[id];
  if (m) return m;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return { name: id.split('_').map(cap).join(' '), shape: 'up', color: `hsl(${h} 70% 64%)` };
}

function buffTime(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.ceil(s / 60)}m` : `${s}`;
}

export function BuffRow() {
  const buffs = useUI((s) => s.me?.buffs ?? null);
  if (!buffs || !buffs.length) return null;
  return (
    <div class="buff-row">
      {buffs.slice(0, 12).map((b: BuffView) => {
        const m = buffMeta(b.id);
        const low = b.ms > 0 && b.ms < 5000;
        return (
          <div class={`buff interactive${low ? ' expiring' : ''}`} key={b.id} data-name={m.name} style={{ '--sk': m.color }}>
            <div class="buff-icon">
              {m.skill ? <SkillGlyph glyph={m.skill.icon.glyph} color={m.color} /> : <BuffGlyph shape={m.shape ?? 'up'} color={m.color} />}
            </div>
            {b.st && b.st > 1 ? <span class="buff-stacks">{b.st}</span> : null}
            {b.ms > 0 && <span class="buff-time">{buffTime(b.ms)}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────── XP bar ─────────────────────────

export function XpBar() {
  const v = useUI((s) => (s.me ? { lv: s.me.lv, xp: s.me.xp, pxp: s.me.pxp, pl: s.me.pl } : null));
  if (!v) return null;
  const paragon = v.lv >= MAX_LEVEL;
  const need = paragon ? paragonXpToNext(v.pl) : xpToNext(v.lv);
  const cur = paragon ? v.pxp : v.xp;
  const frac = clamp01(need > 0 ? cur / need : 0);
  return (
    <div class={`xpbar interactive${paragon ? ' paragon' : ''}`}>
      <div class="xp-track">
        <div class="xp-fill" style={{ width: `${(frac * 100).toFixed(2)}%` }}><i class="xp-shine" /></div>
        <div class="xp-ticks" />
      </div>
      <div class="xp-label">
        <b>{paragon ? `Paragon ${v.pl}` : `Level ${v.lv}`}</b>
        <span>{fmtInt(cur)} / {fmtInt(need)}</span>
        <em>{(frac * 100).toFixed(1)}%</em>
      </div>
    </div>
  );
}

// ───────────────────────── Bottom bar assembly ─────────────────────────

export function BottomBar() {
  const keys = useLocal(bindings, () => ({ skills: bindings.label('skills'), dash: bindings.label('dash'), casts: CAST_ACTIONS.map(a => bindings.label(a)) }));
  const manual = useLocal(preferences, s => s.values.manualSkills);
  const char = useUI((s) => (s.char ? { cls: s.char.classId, skills: s.char.skills, level: s.char.level } : null));
  const rcr = useUI((s) => s.derived?.rcr ?? 0);
  const m = useUI((s) => (s.me ? { cds: s.me.cds, ch: s.me.ch, res: s.me.res, dashCd: s.me.dashCd, buffs: s.me.buffs } : null));
  if (!char) return null;
  const { cls, skills } = char;
  const buffIds = new Set((m?.buffs ?? []).map((b) => b.id));

  const mk = (sid: string | null, priority?: number): { skill: SkillDef | null; tip: ComponentChildren; cost: number } => {
    const skill = sid ? SKILLS[sid] ?? null : null;
    if (!skill) return { skill: null, tip: priority === undefined ? null : (
      <div class="skill-tip tip-small" role="tooltip">
        <div class="st-name">Empty skill slot {priority}</div>
        <div class="st-desc">Auto-cast priority {priority}. Choose skills with {keys.skills}.</div>
      </div>
    ), cost: 0 };
    const mods = collectSkillMods(skill, skills.runes[skill.id], skills.tiers[skill.id] ?? 0);
    const cost = Math.round(skill.cost * (1 + (mods.cost ?? 0) / 100) * (1 - rcr / 100));
    return {
      skill,
      cost,
      tip: <SkillTip skill={skill} classId={cls} rcr={rcr} runeId={skills.runes[skill.id] ?? null} tiers={skills.tiers[skill.id] ?? 0} mods={mods} priority={priority} mode={priority === undefined ? undefined : autoCastMode(skills, priority - 1)} castKey={manual && priority !== undefined ? keys.casts[priority - 1] : undefined} ruleText={priority !== undefined && skills.autoRules?.[priority - 1] ? autoRuleSummary(autoRuleForSlot(skills,priority - 1),skill) : undefined}/>,
    };
  };

  const primary = mk(skills.primary);
  const slots = [0, 1, 2, 3].map((i) => mk(skills.slots[i] ?? null, i + 1));
  const compact = slots.every(s => !s.skill) && !Object.values(SKILLS).some(s => s.classId === cls && s.kind !== 'primary' && s.unlock <= char.level);

  return (
    <div class={`hud-bottom${compact ? ' is-starter' : ''}`}>
      <HealthGlobe />
      <div class="hud-bar">
        <BuffRow />
        <XpBar />
        <div class="bar-slots">
          <Slot kind="primary" keyLabel="AUTO" skill={primary.skill} cd={0} nominalMs={0} tip={primary.tip} active={false} />
          {!compact && <i class="bar-sep" />}
          {slots.map((s, i) => (compact?null:(
            <Slot
              key={i}
              kind="skill"
              keyLabel={<>{manual ? keys.casts[i] : i + 1}{autoCastMode(skills, i) !== 'auto' && <> · {autoCastMode(skills, i) === 'paused' ? 'PAUSED' : 'STILL'}</>}</>}
              skill={s.skill}
              cd={m?.cds[i] ?? 0}
              nominalMs={(s.skill?.cooldown ?? 0) * 1000}
              badge={m?.ch[i] ?? 0}
              dim={(!manual && autoCastMode(skills, i) === 'paused') || (!!s.skill && s.cost > 0 && (m?.res ?? 0) < s.cost)}
              active={!!s.skill && s.skill.kind === 'buff' && buffIds.has(s.skill.id)}
              tip={s.tip}
            />
          )))}
          <i class="bar-sep" />
          <Slot kind="dash" keyLabel={keys.dash.toUpperCase()} skill={null} cd={m?.dashCd ?? 0} nominalMs={DASH.cooldownMs} tip={<DashTip />} />
        </div>
        <i class="bar-crest" />
      </div>
      <ResourceGlobe />
    </div>
  );
}

function DashTip() {
  return (
    <div class="skill-tip tip-small" role="tooltip">
      <div class="st-name">Dash</div>
      <div class="st-desc">Burst forward {DASH.distance} units, briefly untouchable. Cooldown {(DASH.cooldownMs / 1000).toFixed(1)}s.</div>
    </div>
  );
}
