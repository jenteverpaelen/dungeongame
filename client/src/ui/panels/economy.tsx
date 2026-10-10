import { useState } from 'preact/hooks';
import { ECONOMY_ACTIONS, ECONOMY_RESOURCES, economySnapshot, validEconomy, type EconomyAction } from '@shared/economy';
import { gemName } from '@shared/cube';
import { fmtInt } from '@shared/format';
import type { CharacterSave, MaterialId } from '@shared/types';
import { MATERIAL_INFO } from './icons';
import { Paged, Tabs } from './common';

const resourceName=(key:string):string=>key==='gold'?'Gold':key==='items'?'Equipment':key.includes(':')?
  gemName(key.split(':')[0],Number(key.split(':')[1])):MATERIAL_INFO[key as MaterialId].name;
const total=(entries:number[])=>entries.reduce((sum,n)=>sum+BigInt(n),0n);
const amount=(n:number|bigint)=><span title={n.toLocaleString('en-US')}>{n>=1_000_000_000?
  new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n):fmtInt(Number(n))}</span>;

/** Read-only character history. This UI never supplies prices, balances or rewards to the server. */
export function EconomySection({save}:{save:CharacterSave}) {
  const [tab,setTab]=useState<'balances'|'activities'>('balances');
  const [selected,setSelected]=useState<EconomyAction|null>(null);
  const current=economySnapshot(save),record=validEconomy(save.economy)?save.economy:undefined;
  const actions=record?Object.entries(record.activities):[];
  const ordinary=actions.filter(([id])=>id!=='debug'&&id!=='unclassified');
  const keys=ECONOMY_RESOURCES.filter(k=>!k.includes(':')||current[k]||record?.baseline[k]
    ||actions.some(([,a])=>a!.gained[k]||a!.spent[k]));
  const active=selected&&record?.activities[selected];
  return <section aria-label="Economy history">
    <Tabs tabs={[{id:'balances',label:'Balances'},{id:'activities',label:'Sources & spending'}]} value={tab} onChange={v=>{setTab(v);setSelected(null);}}/>
    {!record?<p class="pn-note">{save.economy===undefined?'History starts with your next resource change. Existing wealth is not counted as new income.':'This history needs a supported record version. Your current balances remain available.'}</p>
      :<p class="pn-note">Recorded since {new Date(record.startedAt).toLocaleDateString()}. Opening gold: {amount(record.baseline.gold??0)}. Earlier activity is not included.</p>}
    {record?.incomplete&&<p class="pn-note">History is incomplete: a balance changed outside recorded actions or a counter reached its limit.</p>}
    {tab==='balances'&&<>
      <div class="economy-row economy-head"><span>Resource</span><span>Owned</span><span>Received</span><span>Used</span></div>
      <Paged size={7} label="Resource pages">{keys.map(key=><div class="economy-row" key={key}>
        <strong>{resourceName(key)}</strong>{amount(current[key]??0)}
        {amount(total(ordinary.map(([,a])=>a!.gained[key]??0)))}{amount(total(ordinary.map(([,a])=>a!.spent[key]??0)))}
      </div>)}</Paged>
      <p class="pn-note">Received and Used include offline gains and recipe conversions. Debug grants and unrecorded changes are separate under Sources & spending.</p>
      <p class="pn-note">Owned includes equipped, stashed and retained buyback equipment, with its socketed gems. Moving or socketing an item does not spend it.</p>
    </>}
    {tab==='activities'&&!active&&<>
      {!actions.length&&<p>No resource changes recorded yet.</p>}
      <Paged size={6} label="Activity pages">{actions.map(([id,a])=><button class="economy-action btn" key={id} onClick={()=>setSelected(id as EconomyAction)}>
        <span>{ECONOMY_ACTIONS[id as EconomyAction]}</span><span>{fmtInt(a!.events)} resource {a!.events===1?'change':'changes'} · View</span>
      </button>)}</Paged>
      <p class="pn-note">These are resource-changing operations, not kills or elapsed play time. Counts do not estimate gold per hour.</p>
    </>}
    {tab==='activities'&&active&&<>
      <button class="btn sm" onClick={()=>setSelected(null)}>Back to activities</button>
      <h3>{ECONOMY_ACTIONS[selected!]}</h3>
      <div class="economy-row economy-detail economy-head"><span>Resource</span><span>Received</span><span>Used</span></div>
      <Paged key={selected} size={7} label="Activity resource pages">{ECONOMY_RESOURCES.filter(k=>active.gained[k]||active.spent[k]).map(k=><div class="economy-row economy-detail" key={k}>
        <strong>{resourceName(k)}</strong>{amount(active.gained[k]??0)}{amount(active.spent[k]??0)}
      </div>)}</Paged>
      <p class="pn-note">Each action records its net change per resource. Gem fusion consumes one rank and produces the next; equipment replacement may leave the item count unchanged.</p>
    </>}
  </section>;
}
