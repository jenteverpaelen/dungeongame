import { useState } from 'preact/hooks';
import { CLASSES } from '@shared/data/classes';
import { SKILLS } from '@shared/data/skills';
import { LEGENDARIES, SETS } from '@shared/data/items';
import { characterText as t } from '@shared/data/characterMessages';
import { fmtInt, fmtNum, fmtPct } from '@shared/format';
import { ELEMENTS } from '@shared/types';
import { useUI } from '../store';
import { PanelFrame, SecHead, Tabs, Paged } from './common';
import { fmtPowerValue } from './util';
import { EconomySection } from './economy';
import { UiIcon } from '../hud/UiIcons';
import { text as ut } from '../../i18n/messages';
import { playerLook } from '@shared/character';
import { gearProfile } from '@shared/gearVisual';
import { SET_STYLE } from '../../render/art/gearStyle';
import { dominantColor } from '../../render/art/gearFx';
import type { CharacterSave, DerivedStats } from '@shared/types';
import { STAT_LABELS } from '@shared/stats';
import { Breakdown, Conditions, fmtHit, fmtSec, sheetOf, sheetStore, useSheet } from './sheet';
import { useLocal } from './state';
import { cls } from './util';

const hexOf = (c: number) => '#' + c.toString(16).padStart(6, '0');
/** The hero as other players see them, animated, with the Sets worn (DESIGN-V2.md §6: no rank, the look is the items). */
export function GearShowcase({ save, local = true }: { save: Pick<CharacterSave, 'classId'> & Partial<CharacterSave>; local?: boolean }) {
  const look = save.equipment ? playerLook(save as CharacterSave) : null;
  if (!look) return null;
  return <GearShowcaseLook look={look} local={local}/>;
}
export function GearShowcaseLook({ look, local }: { look: import('@shared/protocol').PlayerLook; local: boolean }) {
  const p = gearProfile(look), col = hexOf(dominantColor(look, p));
  return <div class="gear-show" style={{ '--gs': col }}>
    <canvas data-preview={look.classId} data-look={JSON.stringify(look)} data-local={local ? '1' : '0'} width={420} height={380} aria-hidden="true"/>
    <div>
      <h4>{ut('gear.showcaseTitle')}</h4>
      {p.sets.length > 0 && <div class="gear-sets">{p.sets.map(s => <b key={s.id} style={{ background: hexOf(SET_STYLE[s.id]?.main ?? 0xd2ae68) }}>{ut('gear.setPieces', { set: SETS[s.id]?.name ?? s.id, count: String(s.count) })}</b>)}</div>}
      <p class="pn-note">{ut('gear.lookNote')}</p>
    </div>
  </div>;
}

type Section='overview'|'offense'|'defense'|'utility'|'powers'|'damage'|'economy';

/**
 * Damage sheet (build tools T2): each bar skill's exact hit from the server's combat code, its multiplier stack and the
 * conditional terms, plus a pin to compare two states (before / after a gear or skill change).
 */
function DamageSection({ save, d }: { save: CharacterSave; d: DerivedStats }) {
  const sheet = useSheet();
  const pinned = useLocal(sheetStore, (s) => s.pinned), err = useLocal(sheetStore, (s) => s.err);
  const bar = [save.skills.primary, ...save.skills.slots].filter((id): id is string => !!id && !!SKILLS[id]);
  const [sel, setSel] = useState<string>(bar[1] ?? bar[0]);
  const cur = sheetOf(sheet, bar.includes(sel) ? sel : bar[0]);
  const delta = (id: string) => {
    const a = sheetOf(pinned, id), b = sheetOf(sheet, id);
    if (!a || !b || !a.perHit) return null;
    const r = b.perHit / a.perHit - 1;
    return Math.abs(r) < 0.0005 ? '±0%' : `${r > 0 ? '+' : '−'}${(Math.abs(r) * 100).toFixed(1)}%`;
  };
  if (!sheet) return <p class="pn-note">{err ?? 'Reading the numbers…'}</p>;
  return <div class="dmg-sheet">
    <div class="dmg-left">
      <table class="dmg-table">
        <thead><tr><th>Skill</th><th>Per hit</th><th>vs elite</th><th>Cost</th><th>Cooldown</th>{pinned && <th>vs pin</th>}</tr></thead>
        <tbody>{bar.map((id) => { const s = sheetOf(sheet, id); return <tr key={id} class={cls(cur?.id === id && 'on')} onClick={() => setSel(id)}>
          <td>{SKILLS[id].name}</td><td>{s && s.coef > 0 ? fmtHit(s.perHit) : '—'}</td><td>{s && s.coef > 0 ? fmtHit(s.perHit * s.eliteFactor) : '—'}</td>
          <td>{s && s.cost > 0 ? `${Math.round(s.cost * 10) / 10}${s.costPerSecond ? '/s' : ''}` : '—'}</td><td>{s && s.cooldownMs > 0 ? fmtSec(s.cooldownMs) : '—'}</td>
          {pinned && <td class="dmg-delta">{delta(id) ?? '—'}</td>}</tr>; })}</tbody>
      </table>
      <div class="dmg-pin">
        <button class="btn sm" onClick={() => sheetStore.set({ pinned: sheet })}>{pinned ? 'Pin again' : 'Pin these numbers'}</button>
        {pinned && <button class="btn sm" onClick={() => sheetStore.set({ pinned: null })}>Clear pin</button>}
        <span class="pn-note">{pinned ? 'Change gear or skills: “vs pin” compares each hit.' : 'Pin, then change gear or skills to compare.'}</span>
      </div>
      <p class="pn-note">Per hit = expected (crit-weighted) damage of the skill’s coefficient right now, from the server’s combat code. Target conditions (stunned, frozen, bleeding …) are listed as terms, not assumed. Live state: {sheet.state.inTown ? 'in town' : 'in the field'}{sheet.state.buffs.length ? `, buffs ${sheet.state.buffs.length}` : ''}{sheet.state.channeling ? `, channelling ${SKILLS[sheet.state.channeling]?.name ?? ''}` : ''}. Damage per second: the training dummies.</p>
    </div>
    {cur && <div class="dmg-right">
      <h4 class="dmg-h">{SKILLS[cur.id].name}</h4>
      <Breakdown s={cur} mainStatLabel={`Main stat (${STAT_LABELS[d.mainStatId] ?? 'main'})`} compact />
      <Conditions s={cur} max={3} />
    </div>}
  </div>;
}
function Values({rows}:{rows:[string,string][]}) {
  return <dl class="character-values">{rows.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
}
export function CharacterPanel() {
  const save=useUI(s=>s.char),d=useUI(s=>s.derived);
  const [powerTab,setPowerTab]=useState<'legendary'|'sets'>('legendary');
  const [section,setSection]=useState<Section>('overview');
  if(!save||!d)return null;
  const n=fmtInt,p=fmtPct;
  return <PanelFrame id="character" title={t('title')} sub={`${save.name} · ${CLASSES[save.classId].name} · ${save.level}`} width={820}>
    <p class="pn-note">{t('scope')}</p>
    <Tabs tabs={(['overview','offense','defense','utility','powers','damage','economy'] as Section[]).map(id=>({id,label:id==='economy'?'Economy':id==='damage'?'Damage':t(id)}))} value={section} onChange={setSection}/>
    {section==='damage'&&<DamageSection save={save} d={d}/>}
    {section==='economy'&&<EconomySection save={save}/>}
    {section==='overview'&&<>
      <GearShowcase save={save}/>
      <div class="ch-hero">
        {([['damage',d.sheetDps,'skills'],['toughness',d.toughness,'shield'],['recovery',d.recovery,'star']] as const).map(([k,v,icon])=><div key={k} class={`ch-big ${k}`} title={t(`${k}Note`)}>
          <UiIcon name={icon} size={26}/><span>{t(k)}</span><b>{n(v)}</b></div>)}
      </div>
      <div class="ch-tiles">
        {([[t(d.mainStatId),n(d.mainStat)],[t('vit'),n(d.vit)],[t('life'),n(d.life)],[t('armor'),n(d.armor)],[t('allRes'),n(d.allRes)],[t('chc'),p(d.chc)],[t('chd'),p(d.chd)],[t('aps'),fmtNum(d.aps,2)]] as [string,string][]).map(([k,v])=><div key={k} class="ch-tile"><span>{k}</span><b>{v}</b></div>)}
      </div>
      <details class="ch-how"><summary>{ut('character.howEstimated')}</summary>
        <p><b>{t('damage')}.</b> {t('damageNote')}</p><p><b>{t('toughness')}.</b> {t('toughnessNote')}</p><p><b>{t('recovery')}.</b> {t('recoveryNote')}</p>
      </details>
    </>}
    {section==='offense'&&<>
      <Values rows={[[t('weapon'),`${n(d.weaponMin)}–${n(d.weaponMax)}`],[t('weaponElement'),t(d.weaponElement)],[t('aps'),fmtNum(d.aps,2)],
        [t('ias'),p(d.ias)],[t('chc'),p(d.chc)],[t('chd'),p(d.chd)],[t('dmgPct'),p(d.dmgPct)],[t('elite'),p(d.elite)],[t('area'),p(d.area)],[t('thorns'),n(d.thorns)]]}/>
      <SecHead>{t('elements')}</SecHead><Values rows={ELEMENTS.map(e=>[t(e),p(d.ele[e])])}/>
      <SecHead>{t('skills')}</SecHead>
      {Object.keys(d.skillDmg).length?<Values rows={Object.entries(d.skillDmg).map(([id,value])=>[SKILLS[id]?.name??id,p(value)])}/>:<p>{t('none')}</p>}
    </>}
    {section==='defense'&&<>
      <p class="pn-note">{t('defenseNote')} {save.level}.</p>
      <Values rows={[[t('life'),n(d.life)],[t('armor'),n(d.armor)],[t('allRes'),n(d.allRes)],[t('armorDR'),p(d.armorDR*100)],[t('resDR'),p(d.resDR*100)],
        [t('eliteDR'),p(Math.min(75,d.eliteDR))],[t('lifeRegen'),fmtNum(d.lifeRegen,1)],[t('lifePerHit'),fmtNum(d.lifePerHit,1)],[t('lifePerKill'),n(d.lifePerKill)]]}/>
      <p class="pn-note">{t('toughnessNote')}</p><p class="pn-note">{t('recoveryNote')}</p>
    </>}
    {section==='utility'&&<>
      <Values rows={[[t('cdr'),p(d.cdr)],[t('rcr'),p(d.rcr)],[t('ms'),p(d.ms)],[t('pickup'),n(d.pickup)],
        [t('goldFind'),p(d.goldFind)],[t('xpPct'),p(d.xpPct)],[`${t('resourceMax')} · ${CLASSES[save.classId].resource.name}`,n(d.maxResource)],
        [t('resourceRegen'),fmtNum(d.resourceRegen,1)]]}/>
      <p class="pn-note">{t('reductionNote')}</p><p class="pn-note">{t('resourceNote')}</p>
    </>}
    {section==='powers'&&<>
      <Tabs tabs={[{id:'legendary',label:t('legendary')},{id:'sets',label:t('sets')}]} value={powerTab} onChange={setPowerTab}/>
      {powerTab==='legendary'&&<>
      {!Object.keys(d.powers).length&&<p>{t('none')}</p>}
      <Paged size={3} label="Legendary power pages">{Object.entries(d.powers).map(([id,value])=><div class="quest-dialogue" key={id}>
        <strong>{LEGENDARIES[id]?.name??id}</strong>
        <small> · {t(Object.values(save.equipment).some(item=>item?.legendary?.power===id)?'gear':'cube')}</small>
        {LEGENDARIES[id]?.classes&&!LEGENDARIES[id].classes!.includes(save.classId)&&<small class="bad"> · inactive: a {CLASSES[LEGENDARIES[id].classes![0]].name} power</small>}
        <p>{LEGENDARIES[id]?.power.replaceAll('{v}',fmtPowerValue(value))??String(value)}</p>
      </div>)}
      </Paged><p class="pn-note">{t('powerNote')}</p></>}
      {powerTab==='sets'&&<>
      {!Object.keys(d.sets).length&&<p>{t('none')}</p>}
      <Paged size={1} label="Set pages">{Object.entries(d.sets).map(([id,count])=><div class="quest-dialogue" key={id}>
        <strong>{SETS[id]?.name??id} · {count}/{SETS[id]?.pieces.length??'—'}</strong>
        {SETS[id]?.bonuses.map(b=><p key={b.count}><b>{t(count>=b.count?'active':'inactive')} ({b.count})</b> · {b.text}</p>)}
      </div>)}</Paged></>}
    </>}
  </PanelFrame>;
}
