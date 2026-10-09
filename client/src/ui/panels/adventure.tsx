import { useState } from 'preact/hooks';
import { rillwakeObjective, RILLWAKE_ID } from '@shared/adventure';
import { itemIconUrl } from '../../render/art';
import { togglePanel, ui, useUI } from '../store';
import { PanelFrame, SecHead } from './common';
import { ItemTooltip } from './tooltip';
import { run } from './util';

export function AdventurePanel() {
  const save=useUI(s=>s.char), target=useUI(s=>s.adventureTarget);
  const [busy,setBusy]=useState(false);
  if(!save)return null;
  const q=save.rillwake, objective=rillwakeObjective(save);
  const act=async(action:string)=>{setBusy(true);try{await run('adventure',{action,target});}finally{setBusy(false);}};
  const cart=target==='cart', ledger=target==='ledger';
  const speech=cart ? 'The cart sank axle-deep. Its timber is scored by roots, and a muddy trail runs northeast toward the mill.' : ledger ? 'Under the broken rafters lies a dry ledger. Its last entry records timber promised to Hearthmere. Someone was trying to keep the road open.' : q?.claimed ? 'The names are still legible. Now I can find the families this timber belongs to. You brought back more than a book.' : q?.ledger ? 'You found it. I kept this weapon dry while the water rose. Take it—with my thanks.' : 'The wheel stopped, and nobody came back down the timber road. I need the mill ledger: it lists the workers who were still up there. Start with the cart beyond the crossing. If something has taken the yard, clear it before you search the mill.';
  return <PanelFrame id="adventure" title="The Silent Wheel" sub="Rillwake Crossing · Optional adventure" width={466}>
    <SecHead>{cart?'Abandoned timber cart':ledger?'Mill ledger':'Orren · Mill Tender'}</SecHead>
    <p>{speech}</p>
    <SecHead>Journal</SecHead>
    <p>{objective.text}</p>
    {q && <ul>
      <li>{q.cart?'✓':'○'} Investigate the abandoned cart</li>
      <li>{q.warden?'✓':'○'} Defeat Siltroot, the Wheelkeeper</li>
      <li>{q.ledger?'✓':'○'} Recover the mill ledger</li>
      <li>{q.claimed?'✓':'○'} Return to Orren</li>
    </ul>}
    {!q && target==='tender' && <button class="btn primary" disabled={busy} onClick={()=>void act('accept')}>Accept adventure</button>}
    {q && !q.claimed && (cart || ledger) && <button class="btn primary" disabled={busy || (cart?q.cart:!q.warden||q.ledger)} onClick={()=>void act('inspect')}>{cart?'Inspect cart':'Recover ledger'}</button>}
    {q && !q.claimed && target==='tender' && <button class="btn primary" disabled={busy || !q.ledger} onClick={()=>void act('claim')}>Return ledger &amp; claim reward</button>}
    <button class="btn" onClick={()=>togglePanel('adventure',false)}>Continue exploring</button>
    {q?.reward && !q.claimed && <><SecHead>Reward · Reserved for you</SecHead><ItemTooltip item={q.reward}/></>}
    {!q?.reward && <p class="pn-note">Reward: one magic weapon for your class, at your level when you recover the ledger. You can inspect the exact item here before claiming it.</p>}
  </PanelFrame>;
}

export function AdventureTracker() {
  const save=useUI(s=>s.char),zone=useUI(s=>s.zone);
  if(!save || (zone?.zone!==RILLWAKE_ID && (!save.rillwake || save.rillwake.claimed)))return null;
  const q=save.rillwake,objective=rillwakeObjective(save);
  return <button class="frame interactive adventure-tracker" onClick={()=>{ui.set({adventureTarget:'tender'});togglePanel('adventure',true);}} title="Open adventure journal">
    <strong>The Silent Wheel</strong><span>{objective.text}</span>
    {zone?.zone!==RILLWAKE_ID && <small>Travel to Rillwake Crossing at the Waypoint</small>}
    {q?.reward && !q.claimed && <img src={itemIconUrl(q.reward.look,q.reward.kind,32)} width={24} height={24} alt="Reserved weapon reward"/>}
  </button>;
}
