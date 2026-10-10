import { useState } from 'preact/hooks';
import { BASES, LEGENDARIES, SETS } from '@shared/data/items';
import { autoSalvageEligible, canWearLook, defaultLootRules, ORDINARY_RARITIES, type LootRules } from '@shared/itemCollection';
import { LOOK_SLOTS } from '@shared/protocol';
import type { Slot } from '@shared/types';
import { sendChat } from '../../net/api';
import { ui } from '../store';
import { Paged, PanelFrame } from './common';
import { KIND_LABEL } from '@shared/items';
import { ItemVisual, itemHover } from './tooltip';
import { useU } from './state';
import { run, SLOT_LABEL } from './util';
import { ItemRecipes } from './itemRecipes';

export function CollectionPanel() {
  const char = useU(s => s.char)!;
  const [tab, setTab] = useState('Powers');
  const [notice,setNotice]=useState('');
  const [slot, setSlot] = useState<Slot>('head');
  const [draft, setDraft] = useState<LootRules>(() => structuredClone(char.collection?.loot ?? defaultLootRules()));
  const looks = char.collection?.looks ?? {}, selected = char.collection?.wardrobe[slot];
  const item = char.equipment[slot];
  const candidates = Object.entries(looks).filter(([, l]) => item && canWearLook(item, l, slot));
  return <PanelFrame id="collection" title="Collection" width={890} sub="Acquired gear, appearances and loot preferences">
    <nav class="pn-tabs">{['Powers', 'Sets', 'Appearances', 'Loot rules', 'Recipes', 'In bag'].map(t =>
      <button class={`btn sm${tab === t ? ' primary' : ''}`} onClick={() => setTab(t)}>{t}</button>)}</nav>
    {tab === 'Recipes' && <ItemRecipes char={char}/>}
    {tab === 'Powers' && <Paged size={5} key={tab}>{Object.values(LEGENDARIES).map(l => <section class="collection-row">
      <b style={{color:'#e8ac59'}}>{l.name}</b> · {looks[`legend:${l.id}`] || char.cube.learned.includes(l.id) ? 'Acquired' : 'Not acquired'} · {l.classes?.join(', ') ?? 'All classes'}
      <p>{l.power.replace('{v}', `${l.range[0]}–${l.range[1]}`)}</p>
      <small>{char.cube.learned.includes(l.id) ? 'Power extracted' : 'Extract at the Cube after acquisition'} · {KIND_LABEL[BASES[l.base].kind]}</small>
    </section>)}</Paged>}
    {tab === 'Sets' && <Paged size={1} key={tab}>{Object.values(SETS).map(s => <section class="collection-row">
      <h3>{s.name}</h3><p>{s.classId} · Found {s.pieces.filter(p => looks[`set:${s.id}:${p.base}`]).length}/{s.pieces.length}</p>
      {s.pieces.map(p => <p>{looks[`set:${s.id}:${p.base}`] ? '◆' : '◇'} {p.name}</p>)}
      {s.bonuses.map(b => <p style={{color:'#91c69b'}}>{b.count} pieces: {b.text}</p>)}
    </section>)}</Paged>}
    {tab === 'Appearances' && <>
      <p>Visit the Mystic to apply a collected appearance. Stats and item ownership stay the same. Appearance choices are free.</p>
      <nav>{LOOK_SLOTS.map(s => <button class={`btn sm${slot === s ? ' primary' : ''}`} onClick={() => setSlot(s as Slot)}>{SLOT_LABEL[s as Slot]}</button>)}</nav>
      <p>{item ? `Equipped: ${item.name}` : 'Equip an item in this slot first.'} <button class="btn sm" disabled={!selected} onClick={() => void run('collection', {action:'look', slot, key:null})}>Restore item appearance</button></p>
      <Paged key={slot} size={6}>{candidates.map(([key, l]) => <section class="collection-row" style={{display:'flex', gap:14, alignItems:'center'}}>
        <ItemVisual item={l} size={38}/><span style={{flex:1}}>{l.name}</span><button class="btn sm" disabled={selected === key} onClick={() => void run('collection', {action:'look', slot, key})}>{selected === key ? 'Applied' : 'Apply at Mystic'}</button>
      </section>)}</Paged>
      {!candidates.length && <p>No compatible appearances acquired yet.</p>}
    </>}
    {tab === 'Loot rules' && <>
      <p>Visibility, walk-over pickup and salvage are independent. Legendary and Set items always stay visible and collectible.</p>
      <div class="collection-row" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:18}}>
        <b>Rarity</b><b>Hide ground drop</b><b>Leave on ground</b><b>Auto-salvage at Smith</b>
        {ORDINARY_RARITIES.map(r => <><b>{r}</b>{(['hidden','leave','salvage'] as const).map(key =>
          <button class="btn sm" role="checkbox" aria-checked={draft[key].includes(r)} aria-label={`${r} ${key==='hidden'?'hide drop':key==='leave'?'leave on ground':'auto-salvage'}`} onClick={() => {setNotice('');setDraft({...draft, [key]: draft[key].includes(r) ? draft[key].filter(x => x !== r) : [...draft[key], r]});}}>{draft[key].includes(r) ? 'Yes' : 'No'}</button>)}</>)}
      </div>
      <p>Auto-salvage destroys eligible bag items when you open the nearby Blacksmith. It never uses equipped items or your stash. Protected, merchant, Ancient, empowered, enchanted and filled-socket items are excluded.</p>
      <p>These selected rules would salvage {char.inventory.filter(i => i && autoSalvageEligible(char,i,draft)).length} bag items on your next visit after saving. Gold, gems and materials keep their existing pickup behavior.</p>
      <button class="btn primary" onClick={() => void run('collection', {action:'rules',rules:draft}).then(r=>{if(r.ok)setNotice('Loot rules saved.');})}>Save loot rules</button>{' '}
      <button class="btn" onClick={() => { const rules=defaultLootRules(); setDraft(rules); void run('collection',{action:'rules',rules}); }}>Restore defaults</button>
      <p>Hidden drops still exist and expire normally. Restore defaults to reveal and pick them up.</p>
      <p role="status">{notice}</p>
    </>}
    {tab === 'In bag' && <Paged size={6} key={tab}>{char.inventory.filter(i => !!i).map(i => <section class="collection-row" style={{display:'flex',gap:14,alignItems:'center'}}>
      <span {...itemHover(()=>i,{compare:true})}><ItemVisual item={i!} size={42}/></span><span style={{flex:1}} {...itemHover(()=>i,{compare:true})}>{i!.name}</span>
      <button class="btn sm" onClick={() => {const s=ui.get(); sendChat(`[[item:${i!.id}]]`,s.chatChannel,s.chatTarget);}}>Link in {ui.get().chatChannel} chat</button>
    </section>)}</Paged>}
  </PanelFrame>;
}
