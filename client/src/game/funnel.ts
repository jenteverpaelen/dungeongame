import type { CharacterSave, ClassId } from '@shared/types';
import { INTRO_EVENTS, validIntro, type IntroEvent } from '@shared/onboarding';
import { PROTOCOL_VERSION } from '@shared/protocol';

export const FUNNEL_KEY='hearthfall.playtest.v1';
export interface Observation { kind:'human'|'scripted'; classId:ClassId; protocol:number; elapsedMs:number; first:Partial<Record<IntroEvent,number>>; ended:boolean }
interface Storage { getItem(k:string):string|null;setItem(k:string,v:string):void }
interface State { records:Observation[]; active:boolean; retained:boolean }
/** Fixed event keys; at most 20 local observations. No identity, chat or upload code. */
export class FunnelStore {
  private state:State={records:[],active:false,retained:true};
  private listeners=new Set<()=>void>();
  private last=0;private visible=false;private before?:{kills:number;elites:number;deaths:number;level:number;done:IntroEvent[]};
  constructor(private storage?:Storage) {
    this.state.retained=!!storage;
    try {
      const parsed=JSON.parse(storage?.getItem(FUNNEL_KEY)??'null');
      if(parsed?.version===1&&Array.isArray(parsed.records))this.state.records=parsed.records.filter((r:Observation)=>
        r&&['human','scripted'].includes(r.kind)&&['warrior','ranger','mage'].includes(r.classId)&&Number.isSafeInteger(r.protocol)
        &&Number.isFinite(r.elapsedMs)&&r.elapsedMs>=0&&r.first&&typeof r.first==='object'&&!Array.isArray(r.first)
        &&Object.entries(r.first).every(([k,v])=>INTRO_EVENTS.includes(k as IntroEvent)&&Number.isFinite(v)&&v>=0&&v<=r.elapsedMs)
      ).slice(-20).map((r:Observation)=>({kind:r.kind,classId:r.classId,protocol:r.protocol,elapsedMs:r.elapsedMs,first:{...r.first},ended:true}));
    } catch {this.state.retained=false;}
  }
  get=()=>this.state;
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
  start(kind:Observation['kind'],save:CharacterSave,now:number) {
    if(this.state.active)return;
    this.last=now;this.visible=true;this.capture(save);
    this.state={...this.state,active:true,records:[...this.state.records.slice(-19),{kind,classId:save.classId,protocol:PROTOCOL_VERSION,elapsedMs:0,first:{},ended:false}]};this.publish();
  }
  clock(now:number,visible:boolean) {
    const r=this.state.records.at(-1);
    if(this.state.active&&r&&this.visible&&Number.isFinite(now)&&now>=this.last)r.elapsedMs+=now-this.last;
    this.last=now;this.visible=visible;
  }
  event(event:IntroEvent) {
    const r=this.state.records.at(-1);
    if(!this.state.active||!r||r.first[event]!==undefined)return;
    r.first[event]=r.elapsedMs;this.publish();
  }
  observe(save:CharacterSave) {
    if(!this.state.active)return;
    const b=this.before;
    if(b){
      if(save.stats.kills>b.kills)this.event('kill');if(save.stats.elites>b.elites)this.event('elite');
      if(save.stats.deaths>b.deaths)this.event('death');if(save.level>b.level)this.event('level');
      for(const event of validIntro(save.onboarding)?save.onboarding.done:[])if(!b.done.includes(event))this.event(event);
    }
    this.capture(save);
  }
  stop(){const r=this.state.records.at(-1);if(r)r.ended=true;this.state={...this.state,active:false};this.publish();}
  clear(){this.state={records:[],active:false,retained:this.state.retained};this.before=undefined;this.publish();}
  export(){return JSON.stringify({version:1,clock:'visible in-game milliseconds since explicit consent; client receipt timing',records:this.state.records},null,2);}
  private capture(s:CharacterSave){this.before={kills:s.stats.kills,elites:s.stats.elites,deaths:s.stats.deaths,level:s.level,done:validIntro(s.onboarding)?[...s.onboarding.done]:[]};}
  private publish(){
    let retained=false;try{if(this.storage){this.storage.setItem(FUNNEL_KEY,JSON.stringify({version:1,records:this.state.records}));retained=true;}}catch{}
    this.state={...this.state,records:[...this.state.records],retained};for(const fn of this.listeners)fn();
  }
}
function storage(){try{return typeof window==='undefined'?undefined:window.localStorage;}catch{return undefined;}}
export const funnel=new FunnelStore(storage());
