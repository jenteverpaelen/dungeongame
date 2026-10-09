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

type Section='overview'|'offense'|'defense'|'utility'|'powers';
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
    <Tabs tabs={(['overview','offense','defense','utility','powers'] as Section[]).map(id=>({id,label:t(id)}))} value={section} onChange={setSection}/>
    {section==='overview'&&<>
      <Values rows={[[t(d.mainStatId),n(d.mainStat)],[t('vit'),n(d.vit)],[t('damage'),n(d.sheetDps)],[t('toughness'),n(d.toughness)],[t('recovery'),n(d.recovery)]]}/>
      <SecHead>{t('damage')}</SecHead><p>{t('damageNote')}</p>
      <SecHead>{t('toughness')}</SecHead><p>{t('toughnessNote')}</p>
      <SecHead>{t('recovery')}</SecHead><p>{t('recoveryNote')}</p>
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
