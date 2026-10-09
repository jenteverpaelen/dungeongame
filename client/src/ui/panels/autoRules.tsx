import { useEffect, useState } from 'preact/hooks';
import { SKILLS, type SkillDef } from '@shared/data/skills';
import { autoRuleForSlot, autoRuleSummary, DEFAULT_AUTO_RULE, isAutoCastRule, MAX_RULE_WEIGHT, type AutoCastRule } from '@shared/autoCastRules';
import type { CharacterSave } from '@shared/types';
import { text } from '../../i18n/messages';
import { pushNotice } from '../store';
import { run } from './util';

export function AutoRuleEditor({skill,char,slot}:{skill:SkillDef;char:CharacterSave;slot:number}) {
  const density = skill.auto.when === 'enemiesNear' ? skill.auto : null;
  const current = () => {
    const rule = {...autoRuleForSlot(char.skills,slot)};
    if (density && rule.within !== null) rule.within = Math.min(rule.within,density.within);
    return rule;
  };
  const [draft,setDraft] = useState<AutoCastRule>(current);
  const [pending,setPending] = useState(false);
  const savedKey = JSON.stringify(char.skills.autoRules?.[slot]);
  useEffect(() => { setDraft(current()); },[savedKey]);
  const buffs = Object.values(SKILLS).filter(s => s.classId === char.classId && s.kind === 'buff' && s.id !== skill.id);
  const numbersValid = isAutoCastRule(draft,char.classId) && (!density || draft.within === null || draft.within <= density.within);
  const valid = numbersValid && draft.requireBuff !== skill.id;
  const patch = (value: Partial<AutoCastRule>) => setDraft({...draft,...value});
  const save = async (rule: AutoCastRule | null) => {
    setPending(true);
    const result = await run('skillAutoRule',{slot,skill:skill.id,rule});
    setPending(false);
    if (result.ok) { if (!rule) setDraft({...DEFAULT_AUTO_RULE}); pushNotice(text('rules.saved'),'info'); }
  };
  return <details class="auto-rule-editor">
    <summary>{text('rules.title')}</summary>
    <p class="pn-note">{autoRuleSummary(autoRuleForSlot(char.skills,slot),skill)}</p>
    <div class="auto-rule-fields">
      {density ? <>
        <label>{text('rules.enemyWeight')}<input type="number" min={1} max={MAX_RULE_WEIGHT} step={1} placeholder={text('rules.normal')}
          value={draft.enemyWeight ?? ''} disabled={pending}
          onInput={e => patch({enemyWeight:e.currentTarget.value === '' ? null : Number(e.currentTarget.value)})} /></label>
        <label>{text('rules.within')}<input type="number" min={1} max={density.within} step={1} placeholder={text('rules.normal')}
          value={draft.within ?? ''} disabled={pending}
          onInput={e => patch({within:e.currentTarget.value === '' ? null : Number(e.currentTarget.value)})} /></label>
      </> : null}
      <label>{text('rules.reserve')}<input type="number" min={0} max={100} step={1} value={Number.isFinite(draft.reservePct) ? draft.reservePct : ''} disabled={pending}
        onInput={e => patch({reservePct:e.currentTarget.value === '' ? NaN : Number(e.currentTarget.value)})} /></label>
      <label>{text('rules.buff')}<select value={draft.requireBuff ?? ''} disabled={pending} onChange={e => patch({requireBuff:e.currentTarget.value || null})}>
        <option value="">{text('rules.none')}</option>
        {draft.requireBuff === skill.id && <option value={skill.id}>{skill.name}</option>}
        {buffs.map(b => <option value={b.id} key={b.id}>{b.name}</option>)}
      </select></label>
    </div>
    <label class="settings-check"><input type="checkbox" checked={draft.elitesOnly} disabled={pending} onChange={e => patch({elitesOnly:e.currentTarget.checked})}/><span>{text('rules.elites')}</span></label>
    <p class="pn-note">{text(density ? 'rules.densityNote' : 'rules.inapplicable')}</p>
    <p class="pn-note">{text('rules.note')}</p>
    {draft.requireBuff === skill.id ? <p class="cw-warn">{text('rules.selfBuff')}</p> : draft.requireBuff && !char.skills.slots.includes(draft.requireBuff) && <p class="cw-warn">{text('rules.buffMissing')}</p>}
    {!numbersValid && <p class="cw-warn">{text('rules.invalid')}</p>}
    <div class="pn-actions">
      <button class="btn sm" disabled={!valid || pending} onClick={() => void save(draft)}>{text('rules.apply')}</button>
      <button class="btn sm" disabled={pending} onClick={() => void save(null)}>{text('rules.clear')}</button>
    </div>
  </details>;
}
