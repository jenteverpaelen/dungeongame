import { useMemo, useState } from 'preact/hooks';
import { TILE } from '@shared/constants';
import { ZONES } from '@shared/data/zones';
import { QUESTS } from '@shared/data/quests';
import { questText } from '@shared/data/questMessages';
import { CollisionWorld } from '@shared/movement';
import { questCompleted, questMarker, questObjective, questPoint, questUnlocks, trackedQuest, zoneLevelAllowed, zoneUnlocked } from '@shared/quests';
import { worldConnections, zoneRoute } from '@shared/worldNavigation';
import type { MapData } from '@shared/mapgen';
import type { CharacterSave } from '@shared/types';
import { text as t } from '../../i18n/messages';
import { togglePanel, useUI, worldReader } from '../store';
import { bakeMapTerrain } from '../mapTerrain';
import { PanelFrame, SecHead, Tabs } from './common';
import { openJournal } from './adventure';
import { run } from './util';

// Original diagram composition only; no geographical distance claim.
const POS:Record<string,[number,number]>={hearthmere:[17,18],whispering_glade:[17,50],ashen_hollow:[17,82],rillwake_crossing:[50,18],bracken_sluice:[83,18],reedvault_pumpworks:[83,50],cairnspill_terraces:[50,50],cinderwash_kilns:[50,82],kilnwatch_crown:[83,82]};
const edges=worldConnections();
const regions=Object.values(ZONES).filter(z=>z.kind!=='rift');

function routeLock(save:CharacterSave,id:string) {
  return QUESTS.find(q=>questUnlocks(q).includes(id)&&!questCompleted(save,q.id));
}

export function WorldMapPanel() {
  const save=useUI(s=>s.char),zone=useUI(s=>s.zone),me=useUI(s=>s.me),dungeon=useUI(s=>s.dungeon);
  const [view,setView]=useState<'routes'|'area'>('routes');
  const [selected,setSelected]=useState(zone?.zone??'hearthmere');
  const [busy,setBusy]=useState(false);
  const map=worldReader.current?.map()??null;
  const terrain=useMemo(()=>map?bakeMapTerrain(map).canvas.toDataURL():null,[map]);
  const cw=useMemo(()=>map?new CollisionWorld(map):null,[map]);
  if(!save||!zone)return null;
  const def=ZONES[selected]??ZONES.hearthmere;
  const quest=trackedQuest(save),objective=quest&&questObjective(save,quest);
  const point=map&&(dungeon?questPoint(map,{zone:map.zone,target:dungeon.target},save):objective&&questPoint(map,objective,save));
  const route=objective?zoneRoute(zone.zone,objective.zone,id=>zoneUnlocked(save,id)):[];
  const locked=routeLock(save,def.id),tooLow=!zoneLevelAllowed(save,def.id),here=zone.zone===def.id;
  const near=(p:{x:number;y:number},r:number)=>!!me&&!me.dead&&me.hp>0&&Math.hypot(me.x-p.x,me.y-p.y)<=r&&!cw?.segmentBlocked(me.x,me.y,p.x,p.y);
  const waypoint=map?.town?.npcs.find(n=>n.role==='waypoint');
  const besideWaypoint=!!waypoint&&near(waypoint,waypoint.interactionRadius);
  const besideExit=map?.portals.some(p=>p.to===def.id&&near(p,110));
  const canTravel=!here&&!locked&&!tooLow&&!me?.dead&&((besideWaypoint&&def.kind!=='dungeon')||besideExit);
  const travel=async()=>{setBusy(true);try{const r=await run('travel',{zone:def.id});if(r.ok)togglePanel('worldmap',false);}finally{setBusy(false);}};
  return <PanelFrame id="worldmap" title={t('map.title')} width={1040} sub={zone.name}>
    <Tabs tabs={[{id:'routes',label:t('map.routes')},{id:'area',label:t('map.area')}]} value={view} onChange={setView}/>
    {view==='routes'?<>
      <p class="pn-note">{t('map.scale')}</p>
      <div class="wm-network">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {edges.filter(e=>e.kind==='waypoint'||!edges.some(other=>other.from===e.to&&other.to===e.from&&other.from<e.from&&other.kind===e.kind)).map(e=>{
            const a=POS[e.from],b=POS[e.to];if(!a||!b)return null;
            const offset=e.kind==='waypoint'?(Math.abs(a[0]-b[0])>50?-32:6):0;
            return <path key={`${e.from}-${e.to}-${e.kind}`} d={`M${a[0]},${a[1]} Q${(a[0]+b[0])/2},${(a[1]+b[1])/2+offset} ${b[0]},${b[1]}`} class={e.kind}/>;
          })}
        </svg>
        {regions.map(z=>{const p=POS[z.id];if(!p)return null;const lock=routeLock(save,z.id),current=zone.zone===z.id;
          const label=current?t('map.here'):lock?t('map.locked'):!zoneLevelAllowed(save,z.id)?t('map.level',{level:String(z.levelBand[0])}):t('map.available');
          return <button key={z.id} class={`wm-node btn ${selected===z.id?'primary':''} ${current?'current':''}`} style={{left:`${p[0]}%`,top:`${p[1]}%`}} onClick={()=>setSelected(z.id)} aria-pressed={selected===z.id}>
            <strong>{z.name}</strong><small>{objective?.zone===z.id?'◆ ':''}{label}</small>
          </button>;
        })}
      </div>
      <p class="pn-note">{t('map.legend')}</p>
      <SecHead>{def.name}</SecHead><p>{def.kind!=='town'&&`Level ${def.levelBand[0]}–${def.levelBand[1]} · `}{def.blurb}</p>
      {locked&&<p class="wm-status">{t('map.requires',{quest:questText(locked.title)})}</p>}
      {tooLow&&<p class="wm-status">{t('map.level',{level:String(def.levelBand[0])})}</p>}
      <div class="wm-actions">
        {!here&&<button class="btn primary" disabled={!canTravel||busy} onClick={()=>void travel()}>{t(busy?'map.travelling':'map.travel')}</button>}
        {here?<span>{t('map.here')}</span>:!canTravel&&!locked&&!tooLow&&<span>{t(me?.dead?'map.dead':'map.physical')}</span>}
      </div>
    </>:map&&terrain?<>
      <LocalMap map={map} save={save} terrain={terrain} me={me} point={point||undefined} objectiveLabel={objective?.text}/>
      <p class="pn-note">{t('map.groundNote')}</p>
      <div class="wm-key"><span>▲ {t('map.here')}</span><span>◆ {t('map.objective')}</span><span>○ {t('map.services')}</span><span>↗ {t('map.exits')}</span></div>
      <div class="wm-locations">{map.portals.map((p,i)=><button class="btn" key={i} onClick={()=>{setSelected(p.to);setView('routes');}}>↗ {p.label}</button>)}</div>
    </>:<p>{t('map.noArea')}</p>}
    <SecHead>{t('map.objective')}</SecHead>
    {quest&&objective?<div class="wm-objective"><strong>{questText(quest.title)}</strong><p>{objective.text} · {ZONES[objective.zone]?.name}</p>
      {objective.zone!==zone.zone&&<p>{route.length?t('map.route',{route:route.map(id=>ZONES[id]?.name??id).join(' → ')}):t('map.noRoute')}</p>}
      <button class="btn" onClick={openJournal}>{t('map.journal')}</button>
    </div>:<p>{t('map.noObjective')}</p>}
    {besideWaypoint&&<button class="btn wm-waypoint" onClick={()=>togglePanel('waypoint',true)}>{t('map.waypoint')}</button>}
  </PanelFrame>;
}

function LocalMap({map,save,terrain,me,point,objectiveLabel}:{map:MapData;save:CharacterSave;terrain:string;me:{x:number;y:number}|null;point?:{x:number;y:number};objectiveLabel?:string}) {
  const w=map.w*TILE,h=map.h*TILE;
  const [selected,setSelected]=useState<string|null>(null);
  const npcs=map.npcs.filter(n=>n.role!=='dummy');
  // Glyph dimensions are in map units so they stay legible at the panel's fixed height.
  const r=Math.max(w,h)/100;
  return <><svg class="wm-area" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={t('map.currentArea',{zone:ZONES[map.zone]?.name??map.zone})}>
    <image href={terrain} x="0" y="0" width={w} height={h}/>
    {npcs.map(n=><g key={n.id} transform={`translate(${n.x},${n.y})`}>
      <title>{n.name} · {n.role}</title><circle r={r*(n.id===selected?1.4:.65)} class="service"/>
      <text y={-r} text-anchor="middle" fill="#ffdb83" stroke="#140e0a" stroke-width={r/8} paint-order="stroke" font-size={r*2.5} font-weight="bold">{questMarker(save,map.zone,n.id)}</text>
    </g>)}
    {map.portals.map((p,i)=><g key={i} transform={`translate(${p.x},${p.y})`}>
      <title>{p.label}</title><circle r={r} class="exit"/>
    </g>)}
    {point&&<g transform={`translate(${point.x},${point.y})`}><title>{objectiveLabel}</title><path d={`M0 ${-r*1.4} L${r} 0 0 ${r*1.4} ${-r} 0 Z`} class="objective"/></g>}
    {me&&<g transform={`translate(${me.x},${me.y})`}><title>{t('map.here')}</title><path d={`M0 ${-r*1.6} L${r} ${r} 0 ${r*.4} ${-r} ${r} Z`} class="player"/></g>}
  </svg>
  {npcs.length>0&&<details class="wm-people"><summary>{t('map.services')}</summary><div class="wm-locations">{npcs.map(n=><button key={n.id} class={`btn ${n.id===selected?'primary':''}`} aria-pressed={n.id===selected} onClick={()=>setSelected(n.id)}>{n.name}</button>)}</div></details>}
  </>;
}
