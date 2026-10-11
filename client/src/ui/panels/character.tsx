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
import { GEAR_TIER_COLORS, GEAR_TIER_NAMES, gearNextSteps, gearProfile, type GearHint } from '@shared/gearVisual';
import { SLOT_LABEL } from './util';
import { SET_STYLE } from '../../render/art/gearStyle';
import type { CharacterSave } from '@shared/types';

const hexOf = (c: number) => '#' + c.toString(16).padStart(6, '0');
/** One next-step hint in words (gearNextSteps decides from what is worn). */
function hintText(h: GearHint): string {
  switch (h.key) {
    case 'empty': return ut('gear.hintEmpty', { slots: h.slots.map((s) => SLOT_LABEL[s]).join(', ') });
    case 'weakest': return ut('gear.hintWeakest', { slot: SLOT_LABEL[h.slot], tier: GEAR_TIER_NAMES[h.tier] });
    case 'set': return h.count > 0 && h.set ? ut('gear.hintSet', { set: SETS[h.set]?.name ?? h.set, count: String(h.count) }) : ut('gear.hintSetNone');
    case 'rares': return ut('gear.hintRares');
    case 'legendary': return ut('gear.hintLegendary');
    case 'level70': return ut('gear.hintLevel70');
    case 'ancient': return ut('gear.hintAncient');
    case 'temper': return ut('gear.hintTemper');
    case 'primal': return ut('gear.hintPrimal');
    default: return ut('gear.hint9');
  }
}
/** The hero as other players see them, animated, with the gear rank and what raises it next (DESIGN.md §4). */
export function GearShowcase({ save, local = true }: { save: Pick<CharacterSave, 'classId'> & Partial<CharacterSave>; local?: boolean }) {
  const look = save.equipment ? playerLook(save as CharacterSave) : null;
  if (!look) return null;
  return <GearShowcaseLook look={look} local={local}/>;
}
export function GearShowcaseLook({ look, local }: { look: import('@shared/protocol').PlayerLook; local: boolean }) {
  const p = gearProfile(look), col = hexOf(GEAR_TIER_COLORS[p.rank]);
  return <div class="gear-show" style={{ '--gs': col }}>
    <canvas data-preview={look.classId} data-look={JSON.stringify(look)} data-local={local ? '1' : '0'} width={420} height={380} aria-hidden="true"/>
    <div>
      <h4>{ut('gear.showcaseTitle')}</h4>
      <div class="gear-rank"><i/>{ut('gear.rank', { rank: GEAR_TIER_NAMES[p.rank] })}</div>
      <div class="gear-pips" aria-hidden="true">{GEAR_TIER_NAMES.slice(1).map((_, i) => <span key={i} class={i < p.rank ? 'on' : ''}/>)}</div>
      {p.sets.length > 0 && <div class="gear-sets">{p.sets.map(s => <b key={s.id} style={{ background: hexOf(SET_STYLE[s.id]?.main ?? 0xd2ae68) }}>{ut('gear.setPieces', { set: SETS[s.id]?.name ?? s.id, count: String(s.count) })}</b>)}</div>}
      <p>{ut('gear.next', { hint: gearNextSteps(p).map(hintText).join(' · ') })}</p>
      <p class="pn-note">{ut('gear.rankNote')}</p>
    </div>
  </div>;
}

type Section='overview'|'offense'|'defense'|'utility'|'powers'|'economy';
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
    <Tabs tabs={(['overview','offense','defense','utility','powers','economy'] as Section[]).map(id=>({id,label:id==='economy'?'Economy':t(id)}))} value={section} onChange={setSection}/>
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
