// Build tools T1 / T2 on the client (docs/rework/depth/BUILD-TOOLS.md): the server's damage sheet (op `buildSheet`,
// computed by the combat code itself in server/src/sim/breakdown.ts) kept in one store, and the views that show it —
// exact skill numbers, the bucket breakdown and the conditional terms. This file only formats; it computes nothing.

import { useEffect } from 'preact/hooks';
import { SKILLS, skillsForClass, matchesTags, type SkillMods, type SkillTag } from '@shared/data/skills';
import { CLASSES } from '@shared/data/classes';
import { powerSourceName } from '@shared/powerSourceNames';
import { fmtInt } from '@shared/format';
import type { BuildSheet, SheetCond, SheetPart, SkillSheet } from '@shared/buildSheet';
import type { PowerEffect } from '@shared/powers';
import type { CharacterSave, Element } from '@shared/types';
import { cmd } from '../../net/api';
import { Local, useLocal, useU } from './state';
import { cls } from './util';

export const sheetStore = new Local<{ sheet: BuildSheet | null; err: string | null; pinned: BuildSheet | null }>({ sheet: null, err: null, pinned: null });

let timer: ReturnType<typeof setTimeout> | null = null, inflight = false, again = false;

/** Ask the server for fresh numbers of every class skill (debounced; one request in flight). */
export function requestSheet(char: CharacterSave | null) {
  if (!char) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    if (inflight) { again = true; return; }
    inflight = true;
    try {
      const r = await cmd<BuildSheet>('buildSheet', { skills: skillsForClass(char.classId).map((s) => s.id) });
      if (r.ok && r.data) sheetStore.set({ sheet: r.data, err: null }); else sheetStore.set({ err: r.err ?? 'No numbers yet' });
    } catch { sheetStore.set({ err: 'No numbers yet' }); }
    finally { inflight = false; if (again) { again = false; requestSheet(char); } }
  }, 150);
}

/** The sheet, refreshed whenever the character or its stats change and every 3 s while shown (live buffs). */
export function useSheet(): BuildSheet | null {
  const char = useU((s) => s.char), derived = useU((s) => s.derived);
  useEffect(() => { requestSheet(char); }, [char, derived]);
  useEffect(() => { const id = setInterval(() => requestSheet(char), 3000); return () => clearInterval(id); }, [char?.id]);
  return useLocal(sheetStore, (s) => s.sheet);
}

export const sheetOf = (sheet: BuildSheet | null, id: string): SkillSheet | null => sheet?.skills.find((s) => s.id === id) ?? null;

// ───────────────────────── formatting ─────────────────────────

export const TAG_LABEL: Partial<Record<SkillTag, string>> = {
  primary: 'Primary', spender: 'Spender', channel: 'Channel', cooldown: 'Cooldown', buff: 'Buff', summon: 'Summon',
  strike: 'Strike', projectile: 'Projectile', piercing: 'Piercing', area: 'Area', aerial: 'Aerial', ground: 'Ground',
  device: 'Device', beast: 'Beast', trap: 'Trap', movement: 'Movement', bleed: 'Bleed', burn: 'Burn', chill: 'Chill', stun: 'Stun',
  displace: 'Displace', mark: 'Mark', aura: 'Aura', physical: 'Physical', fire: 'Fire', cold: 'Cold', lightning: 'Lightning',
  arcane: 'Arcane', poison: 'Poison', holy: 'Holy',
};
export const tagWord = (t: SkillTag) => TAG_LABEL[t] ?? t;

const x = (f: number) => `×${f >= 100 ? fmtInt(f) : (Math.round(f * 1000) / 1000).toString()}`;
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${(Math.round(Math.abs(v) * 10) / 10).toString()}%`;
export const fmtHit = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K` : fmtInt(n));
export const fmtSec = (ms: number) => `${(Math.round(ms / 100) / 10).toString()}s`;
const partName = (p: SheetPart) => p.name ?? powerSourceName(p.src);

/** "+25% damage · cost −20% · radius +10% · flags: ploughHold" — the raw mods of a rune / tier / node (advanced view). */
export function modsText(m: SkillMods): string {
  const out: string[] = [];
  const add = (k: keyof SkillMods, label: string) => { const v = m[k] as number | undefined; if (v) out.push(`${label} ${pct(v)}`); };
  add('dmg', 'damage'); add('cost', 'cost'); add('cooldown', 'cooldown'); add('radius', 'radius'); add('duration', 'duration');
  if (m.gen) out.push(`resource gained +${m.gen}`);
  if (m.projectiles) out.push(`projectiles +${m.projectiles}`);
  if (m.pierce) out.push(`pierce +${m.pierce}%`);
  if (m.maxSummons) out.push(`summons +${m.maxSummons}`);
  if (m.element) out.push(`element ${m.element}`);
  for (const [k, v] of Object.entries(m.vars ?? {})) out.push(`${k} ${v > 0 ? '+' : ''}${v}`);
  if (m.flags?.length) out.push(`behaviour: ${m.flags.join(', ')}`);
  return out.join(' · ');
}

/** Bar skills an effect touches, by name or tag (final tags from the sheet: runes, grants and aliases included). */
export function touchedSkills(effects: readonly PowerEffect[], char: CharacterSave, sheet: BuildSheet | null): string[] {
  const bar = [char.skills.primary, ...char.skills.slots].filter((s): s is string => !!s && !!SKILLS[s]);
  const out = new Set<string>();
  for (const e of effects) {
    const t = e as { skills?: string[]; tags?: Parameters<typeof matchesTags>[1] };
    if (!t.skills && !t.tags) continue;
    for (const id of bar) {
      const tags = new Set<SkillTag>(sheetOf(sheet, id)?.tags ?? []);
      if (t.skills?.includes(id) || (t.tags && tags.size && matchesTags(tags, t.tags))) out.add(SKILLS[id].name);
    }
  }
  return [...out];
}

// ───────────────────────── views ─────────────────────────

/** Final skill numbers (the stat strip of the skills panel and the sheet table). */
export function sheetStats(s: SkillSheet, char: CharacterSave): [string, string][] {
  const res = CLASSES[char.classId].resource.name, def = SKILLS[s.id];
  const out: [string, string][] = [];
  if (def.kind !== 'buff' && s.coef > 0) out.push(['Per hit', fmtHit(s.perHit)]);
  if (s.cost > 0) out.push([s.costPerSecond ? `${res} / sec` : `${res} cost`, (Math.round(s.cost * 10) / 10).toString()]);
  if (s.gen > 0) out.push([`${res} gained`, `+${Math.round(s.gen * 10) / 10}`]);
  if (s.cooldownMs > 0) out.push(['Cooldown', fmtSec(s.cooldownMs)]);
  if (s.durationMs > 0) out.push(['Duration', fmtSec(s.durationMs)]);
  if (s.radius > 0 && def.kind !== 'buff') out.push(['Radius', String(s.radius)]);
  if (s.maxSummons > 0) out.push(['Max summons', String(s.maxSummons)]);
  if (s.charges > 0) out.push(['Extra charges', `+${s.charges}`]);
  return out;
}

const ELEMENT_NAME: Record<Element, string> = { physical: 'Physical', fire: 'Fire', cold: 'Cold', lightning: 'Lightning', poison: 'Poison', arcane: 'Arcane', holy: 'Holy' };

function PartList({ parts, kind, max = 3 }: { parts: SheetPart[]; kind: 'add' | 'mul'; max?: number }) {
  if (!parts.length) return null;
  const shown = parts.slice(0, max), more = parts.length - shown.length;
  return <span class="bd-parts">{shown.map((p, i) => <span key={i} class="bd-part" title={p.text ?? ''}>{partName(p)} <b>{kind === 'add' ? pct(p.value) : x(p.value)}</b></span>)}
    {more > 0 && <span class="bd-part more" title={parts.slice(max).map((p) => `${partName(p)} ${kind === 'add' ? pct(p.value) : x(p.value)}`).join('\n')}>+{more} more</span>}</span>;
}

/** The multiplier stack of one hit, in the order the combat code applies it. */
export function Breakdown({ s, mainStatLabel, compact = false }: { s: SkillSheet; mainStatLabel: string; compact?: boolean }) {
  const f = s.factors;
  const rows: { k: string; v: string; parts?: preact.ComponentChildren; dim?: boolean }[] = [
    { k: 'Weapon damage (average)', v: fmtHit(s.weaponAvg) },
    { k: 'Skill coefficient', v: `${Math.round(f.coef * 1000) / 10}%` },
    { k: mainStatLabel, v: x(f.mainStat) },
    { k: 'Skill bucket', v: x(f.skill), parts: <PartList parts={s.parts.skill} kind="add" max={compact ? 2 : 4} />, dim: f.skill === 1 },
    { k: `${ELEMENT_NAME[s.element]} damage`, v: x(f.element), dim: f.element === 1 },
    { k: 'Generic damage', v: x(f.generic), parts: <PartList parts={s.parts.generic} kind="add" max={compact ? 2 : 3} />, dim: f.generic === 1 },
    { k: 'Own bucket', v: x(f.own), parts: <PartList parts={s.parts.own} kind="mul" max={compact ? 2 : 3} />, dim: f.own === 1 },
    { k: 'Per-hit terms', v: x(f.hit), parts: <PartList parts={s.parts.hit} kind="mul" max={2} />, dim: f.hit === 1 },
    { k: `Critical (${s.crit.chance}% × ${s.crit.damage}%)`, v: x(f.crit) },
  ];
  return <div class={cls('bd', compact && 'compact')}>
    <dl class="bd-rows">{rows.map((r) => <div key={r.k} class={cls('bd-row', r.dim && 'dim')}><dt>{r.k}</dt><dd><b>{r.v}</b>{r.parts}</dd></div>)}</dl>
    <div class="bd-total"><span>Per hit, now</span><b>{fmtHit(s.perHit)}</b>
      <span>vs elites {x(s.eliteFactor)}</span><b>{fmtHit(s.perHit * s.eliteFactor)}</b>
      {s.vs.stunned !== 1 && <><span>vs stunned {x(s.vs.stunned)}</span><b>{fmtHit(s.perHit * s.vs.stunned)}</b></>}
      {s.vs.frozen !== 1 && <><span>vs frozen {x(s.vs.frozen)}</span><b>{fmtHit(s.perHit * s.vs.frozen)}</b></>}
    </div>
  </div>;
}

/** Conditional terms that can change this skill, with whether they hold now. */
export function Conditions({ s, max = 4 }: { s: SkillSheet; max?: number }) {
  if (!s.conds.length) return <p class="pn-note bd-none">No conditional damage terms reach this skill.</p>;
  const shown = s.conds.slice(0, max), more = s.conds.length - shown.length;
  const label = (c: SheetCond) => c.bucket === 'target' ? 'vs target' : c.holds ? 'active now' : 'not now';
  return <ul class="bd-conds">
    {shown.map((c, i) => <li key={i} class={cls(c.holds && 'on')} title={c.text}><em>{label(c)}</em><b>{powerSourceName(c.src)}</b><span>{pct(c.pct)}</span></li>)}
    {more > 0 && <li class="more" title={s.conds.slice(max).map((c) => `${powerSourceName(c.src)} ${pct(c.pct)} (${label(c)})`).join('\n')}>+{more} more conditional terms</li>}
  </ul>;
}
