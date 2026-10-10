import { useState } from 'preact/hooks';
import { BASES, GEMS, GEM_RANKS, SETS } from '@shared/data/items';
import { canAfford, fuseCost, reforgeCost } from '@shared/cube';
import { baseTierIndex } from '@shared/items';
import { forgeCost, RECIPE_UNLOCKS } from '@shared/itemRecipes';
import type { CharacterSave } from '@shared/types';
import { CostList, Paged } from './common';
import { ItemVisual, itemHover } from './tooltip';
import { run } from './util';

export function ItemRecipes({char}:{char:CharacterSave}) {
  const [recipe,setRecipe]=useState<keyof typeof RECIPE_UNLOCKS>('forge');
  const bases=Object.values(BASES).filter(b=>!b.classes||b.classes.includes(char.classId));
  const sets=Object.values(SETS).filter(s=>s.classId===char.classId);
  const [base,setBase]=useState(bases[0].id),[set,setSet]=useState(sets[0].id),[piece,setPiece]=useState(sets[0].pieces[0].base);
  const [source,setSource]=useState(''),[from,setFrom]=useState('ruby'),[to,setTo]=useState('pearlglass'),[rank,setRank]=useState(1);
  const [confirm,setConfirm]=useState(false),[result,setResult]=useState('');
  const cost=recipe==='forge'?forgeCost(char.level):recipe==='exchange'?fuseCost(rank):reforgeCost();
  const needed=RECIPE_UNLOCKS[recipe];
  const craft=async()=>{
    if(recipe==='convertSet'&&!confirm){setConfirm(true);return;}
    const r=await run('collection',{action:'recipe',recipe,base:recipe==='forge'?base:piece,set,itemId:source,from,to,rank});
    setConfirm(false);if(r.ok)setResult('Recipe complete. Your collection and materials are updated.');
  };
  return <>
    <nav>{(['forge','exchange','convertSet'] as const).map(k=><button class={`btn sm${recipe===k?' primary':''}`} onClick={()=>{setRecipe(k);setConfirm(false);setResult('');}}>{k==='forge'?'Forge Rare':k==='exchange'?'Exchange gems':'Convert set'}</button>)}</nav>
    <p>Requires workshop level {needed}. {recipe==='forge'?'Use the Blacksmith to craft a Rare base at your level with random properties.':recipe==='exchange'?'Use the Jeweler: three matching gems become one chosen gem of the same rank.':'Use the Cube: consume a bag set piece to create a chosen class set piece at the same item level. All rolls and upgrades reset; socketed gems return. Result is never Ancient or Primal.'}</p>
    {recipe==='forge'&&<Paged size={10}>{bases.map(b=><button class={`btn sm${base===b.id?' primary':''}`} onClick={()=>setBase(b.id)}>{b.names[baseTierIndex(char.level)]}</button>)}</Paged>}
    {recipe==='exchange'&&<>
      <p>Consume 3:</p><nav>{Object.values(GEMS).map(g=><button class={`btn sm${from===g.id?' primary':''}`} onClick={()=>setFrom(g.id)}>{g.name} ({char.gems[`${g.id}:${rank}`]??0})</button>)}</nav>
      <p>Receive 1:</p><nav>{Object.values(GEMS).map(g=><button class={`btn sm${to===g.id?' primary':''}`} onClick={()=>setTo(g.id)}>{g.name}</button>)}</nav>
      <p>Rank:</p><nav>{GEM_RANKS.map((g,i)=><button class={`btn sm${rank===i+1?' primary':''}`} onClick={()=>setRank(i+1)}>{g}</button>)}</nav>
    </>}
    {recipe==='convertSet'&&<>
      <p>Consume this bag item:</p><Paged size={4}>{char.inventory.filter(i=>!!i?.set).map(i=><button class={`btn sm${source===i!.id?' primary':''}`} {...itemHover(()=>i)} onClick={()=>{setSource(i!.id);setConfirm(false);}}><ItemVisual item={i!} size={28}/>{i!.name}</button>)}</Paged>
      <p>Create this set:</p><nav>{sets.map(s=><button class={`btn sm${set===s.id?' primary':''}`} onClick={()=>{setSet(s.id);setPiece(s.pieces[0].base);setConfirm(false);}}>{s.name}</button>)}</nav>
      <p>Piece:</p><nav>{SETS[set].pieces.map(p=><button class={`btn sm${piece===p.base?' primary':''}`} onClick={()=>{setPiece(p.base);setConfirm(false);}}>{p.name}</button>)}</nav>
    </>}
    <div class="collection-row"><CostList cost={cost} char={char}/>
      <button class="btn primary" disabled={char.cube.level<needed||!canAfford(char,cost)||(recipe==='exchange'&&(from===to||(char.gems[`${from}:${rank}`]??0)<3))||(recipe==='convertSet'&&!source)} onClick={()=>void craft()}>{confirm?'Confirm consumption':recipe==='forge'?'Forge at Blacksmith':recipe==='exchange'?'Exchange at Jeweler':'Convert at Cube'}</button>
    </div><p role="status">{result}</p>
  </>;
}
