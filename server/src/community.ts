import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DATA_DIR} from './config';
import {SOCIAL_LIMIT,CHAT_MAX_LEN,CHAT_BURST,CHAT_REFILL_MS} from '../../shared/src/social';
import {REPORT_CATEGORIES,type CommunityView,type GuildRank} from '../../shared/src/community';
import type {Session} from './net/session';
import type {CmdResult} from './world';
import type {S2C} from '../../shared/src/protocol';

export const REPORT_RETENTION_MS=30*24*60*60*1000;
type Member={id:string;name:string;rank:GuildRank};
type Guild={id:string;name:string;motd:string;members:Member[]};
type Invite={id:string;guild:string;from:string;to:string;at:number};
type Evidence={id:string;from:string;ch:string;text:string;at:number};
type Report={id:string;reporter:string;target:string;category:string;description:string;at:number;resolved:boolean;evidence?:Evidence};
type Audit={id:string;at:number;action:string;target:string;reason:string};
type Sanction={target:string;kind:'mute'|'ban';until:number;reason:string};
interface Ledger {version:1;guilds:Guild[];reports:Report[];audit:Audit[];sanctions:Sanction[];filter:{phrases:string[];links:boolean}}
const initial=():Ledger=>({version:1,guilds:[],reports:[],audit:[],sanctions:[],filter:{phrases:[],links:true}});
const clean=(v:unknown,max=CHAT_MAX_LEN)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const validName=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9]{2,16}$/.test(v);
const fail=(err:string):CmdResult=>({ok:false,err});
/** Separate durable social ledger: no character currency/item mutation and no network staff endpoint. */
export class Community {
  private state=initial();private tail:Promise<unknown>=Promise.resolve();private invites:Invite[]=[];
  private evidence=new Map<string,Evidence[]>();private budgets=new Map<string,{at:number;tokens:number}>();private maintenance:Promise<void>|null=null;private stopped=false;
  readonly directory:string;
  constructor(private sessions:()=>Iterable<Session>,private blocked:(a:Session,b:Session)=>boolean,private enabled:(s:Session)=>boolean,directory=path.join(DATA_DIR,'social'),private presenceVisible:(a:Session,b:Session)=>boolean=(a,b)=>a===b){this.directory=directory;}
  private online(id:string){return [...this.sessions()].find(s=>s.save.id===id);}
  private guild(id:string,state=this.state){return state.guilds.find(g=>g.members.some(m=>m.id===id));}
  async init(){
    await fs.mkdir(path.join(this.directory,'owner-inbox'),{recursive:true});
    try{const file=await fs.readFile(path.join(this.directory,'ledger.json'),'utf8');if(Buffer.byteLength(file)>16*1024*1024)throw Error('Social ledger is oversized');const s=JSON.parse(file) as Ledger;
      if(s.version!==1||!Array.isArray(s.guilds)||s.guilds.length>100||!Array.isArray(s.reports)||s.reports.length>100*SOCIAL_LIMIT||!Array.isArray(s.audit)||s.audit.length>100*SOCIAL_LIMIT||!Array.isArray(s.sanctions)||s.sanctions.length>100*SOCIAL_LIMIT||!s.filter||typeof s.filter.links!=='boolean'||!Array.isArray(s.filter.phrases)||s.filter.phrases.length>SOCIAL_LIMIT||!s.filter.phrases.every(p=>typeof p==='string'&&clean(p)===p&&p.length>0))throw Error('Unsupported social ledger');
      const timestamp=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
      const text=(v:unknown)=>typeof v==='string'&&clean(v)===v;
      if(s.reports.some(r=>!r||typeof r.id!=='string'||!validName(r.reporter)||!validName(r.target)||!REPORT_CATEGORIES.includes(r.category as typeof REPORT_CATEGORIES[number])||!text(r.description)||!timestamp(r.at)||typeof r.resolved!=='boolean'||r.evidence&&(!text(r.evidence.text)||!validName(r.evidence.from)||typeof r.evidence.id!=='string'||typeof r.evidence.ch!=='string'||!timestamp(r.evidence.at)))
        ||s.audit.some(r=>!r||typeof r.id!=='string'||!timestamp(r.at)||!text(r.action)||!text(r.target)||!text(r.reason))
        ||s.sanctions.some(r=>!r||!validName(r.target)||!['mute','ban'].includes(r.kind)||!timestamp(r.until)||!text(r.reason)))throw Error('Invalid moderation ledger');
      const ids=new Set<string>(),guildIds=new Set<string>(),names=new Set<string>();for(const g of s.guilds){if(!g||typeof g.id!=='string'||guildIds.has(g.id)||typeof g.name!=='string'||! /^[A-Za-z][A-Za-z0-9 ]{2,31}$/.test(g.name)||names.has(g.name.toLowerCase())||!text(g.motd)||!Array.isArray(g.members)||g.members.length>SOCIAL_LIMIT||g.members.filter(m=>m?.rank==='leader').length!==1)throw Error('Invalid guild ledger');guildIds.add(g.id);names.add(g.name.toLowerCase());for(const m of g.members){if(!m||!validName(m.name)||m.id!==m.name.toLowerCase()||ids.has(m.id)||!['leader','officer','member'].includes(m.rank))throw Error('Invalid guild member');ids.add(m.id);}}
      this.state=s;
    }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    await this.prune();
  }
  private async persist(next:Ledger){const file=path.join(this.directory,'ledger.json'),tmp=path.join(this.directory,`${randomUUID()}.tmp`);try{await fs.writeFile(tmp,JSON.stringify(next),{flush:true});await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true}).catch(()=>{});}}
  private serial<T>(work:()=>Promise<T>):Promise<T>{const next=this.tail.then(work,work);this.tail=next.catch(()=>{});return next;}
  private mutate(work:(state:Ledger)=>CmdResult){return this.serial(async()=>{const next=structuredClone(this.state),result=work(next);if(result.ok){await this.persist(next);this.state=next;}return result;});}
  async flush(){await this.tail;}
  async shutdown(){this.stopped=true;await this.maintenance;await this.flush();}
  async prune(now=Date.now()){
    if(!this.state.reports.some(r=>r.at<=now-REPORT_RETENTION_MS)&&!this.state.audit.some(r=>r.at<=now-REPORT_RETENTION_MS)&&!this.state.sanctions.some(s=>s.until!==0&&s.until<=now))return;
    await this.mutate(s=>{s.reports=s.reports.filter(r=>r.at>now-REPORT_RETENTION_MS);s.audit=s.audit.filter(r=>r.at>now-REPORT_RETENTION_MS);s.sanctions=s.sanctions.filter(r=>r.until===0||r.until>now);return {ok:true};});
  }
  banned(id:string){return this.state.sanctions.some(s=>s.target===id&&s.kind==='ban'&&(s.until===0||s.until>Date.now()));}
  canSpeak(s:Session){return !this.state.sanctions.some(x=>x.target===s.save.id&&(x.until===0||x.until>Date.now()));}
  filter(text:string){return (!this.state.filter.links||!/(?:https?:\/\/|www\.)\S+/i.test(text))&&!this.state.filter.phrases.some(p=>text.toLowerCase().includes(p.toLowerCase()));}
  together(a:Session,b:Session){const g=this.guild(a.save.id);return !!g&&g.id===this.guild(b.save.id)?.id;}
  remember(s:Session,message:Extract<S2C,{t:'chat'}>){if(!message.messageId||!message.from)return;const history=this.evidence.get(s.save.id)??[];history.push({id:message.messageId,from:message.from,ch:message.ch,text:message.text,at:Date.now()});this.evidence.set(s.save.id,history.slice(-SOCIAL_LIMIT));}
  disconnected(s:Session){this.evidence.delete(s.save.id);this.budgets.delete(s.save.id);this.invites=this.invites.filter(i=>i.from!==s.save.id&&i.to!==s.save.id);}
  view(s:Session):CommunityView{
    const g=this.guild(s.save.id);this.invites=this.invites.filter(i=>i.at>Date.now()-60000);
    return {guild:g?{id:g.id,name:g.name,motd:g.motd,rank:g.members.find(m=>m.id===s.save.id)!.rank,members:g.members.map(m=>{const peer=this.online(m.id);return {name:m.name,rank:m.rank,online:!!peer&&this.presenceVisible(s,peer)};})}:null,
      invites:this.invites.filter(i=>i.to===s.save.id).flatMap(i=>{const g=this.state.guilds.find(g=>g.id===i.guild),from=this.online(i.from);return g&&from&&!this.blocked(s,from)?[{id:i.id,guild:g.name,from:from.save.name}]:[];}),
      reports:this.state.reports.filter(r=>r.reporter===s.save.id).map(r=>({id:r.id,target:r.target,category:r.category,at:r.at,resolved:r.resolved}))};
  }
  async command(s:Session,a:Record<string,unknown>,now=Date.now()):Promise<CmdResult>{
    if(this.stopped)return fail('Server restarting');
    if(this.online(s.save.id)!==s)return fail('Join the world first');
    if(a.action==='view')return {ok:true,data:this.view(s)};
    const budget=this.budgets.get(s.save.id)??{at:now,tokens:CHAT_BURST};budget.tokens=Math.min(CHAT_BURST,budget.tokens+(now-budget.at)/CHAT_REFILL_MS);budget.at=now;this.budgets.set(s.save.id,budget);if(budget.tokens<1)return fail('Wait a moment before another social action');budget.tokens--;
    if(!this.enabled(s)&&!['leave','decline','report'].includes(String(a.action)))return fail('Guild actions are disabled here');
    if(a.action==='invite'){
      await this.tail;const g=this.guild(s.save.id),rank=g?.members.find(m=>m.id===s.save.id)?.rank;
      const target=validName(a.name)?this.online(a.name.toLowerCase()):undefined;
      this.view(s);
      if(!g||rank==='member'||!target||!this.enabled(target)||this.blocked(s,target)||this.guild(target.save.id)||g.members.length>=SOCIAL_LIMIT)return fail('That invitation is not available');
      if(this.invites.filter(i=>i.from===s.save.id).length>=4||this.invites.filter(i=>i.to===target.save.id).length>=4)return fail('Too many pending guild invitations');
      if(!this.invites.some(i=>i.guild===g.id&&i.to===target.save.id))this.invites.push({id:randomUUID(),guild:g.id,from:s.save.id,to:target.save.id,at:now});return {ok:true};
    }
    if(a.action==='decline'){this.invites=this.invites.filter(i=>!(i.id===a.invite&&i.to===s.save.id));return {ok:true};}
    const result=await this.mutate(state=>{
      if(this.online(s.save.id)!==s)return fail('Reconnect before changing guild membership');
      const id=s.save.id,g=this.guild(id,state),self=g?.members.find(m=>m.id===id),action=a.action;
      if(action==='create'){
        const name=clean(a.name,32);if(g)return fail('Leave your guild before creating another');if(!/^[A-Za-z][A-Za-z0-9 ]{2,31}$/.test(name)||!this.filter(name))return fail('Use a guild name of3–32 letters, numbers and spaces');if(state.guilds.length>=100||state.guilds.some(g=>g.name.toLowerCase()===name.toLowerCase()))return fail('That guild name is unavailable');
        state.guilds.push({id:randomUUID(),name,motd:'',members:[{id,name:s.save.name,rank:'leader'}]});
      }else if(action==='accept'){
        const invite=this.invites.find(i=>i.id===a.invite&&i.to===id&&i.at>Date.now()-60000),guild=state.guilds.find(g=>g.id===invite?.guild),from=invite&&this.online(invite.from),rank=guild?.members.find(m=>m.id===invite?.from)?.rank;
        if(g||!guild||!from||!rank||rank==='member'||!this.enabled(from)||this.blocked(s,from)||guild.members.length>=SOCIAL_LIMIT)return fail('That guild invitation is no longer available');
        guild.members.push({id,name:s.save.name,rank:'member'});
      }else if(action==='leave'){
        if(!g)return fail('You are not in a guild');if(self!.rank==='leader'&&g.members.length>1)return fail('Transfer leadership before leaving');g.members=g.members.filter(m=>m.id!==id);state.guilds=state.guilds.filter(g=>g.members.length);
      }else if(action==='motd'){
        if(!g||self!.rank==='member')return fail('Only officers and the leader can edit the message');const text=clean(a.text);if(!this.filter(text))return fail('That text is blocked by the chat filter');g.motd=text;
      }else if(['kick','promote','demote','leader'].includes(String(action))){
        const target=validName(a.name)?g?.members.find(m=>m.id===a.name!.toString().toLowerCase()):undefined;
        if(!g||!target||target.id===id||self!.rank==='member'||target.rank==='leader'||(self!.rank==='officer'&&(action!=='kick'||target.rank!=='member')))return fail('Your guild rank cannot perform that action');
        if(action==='kick')g.members=g.members.filter(m=>m.id!==target.id);
        else if(action==='leader'){self!.rank='officer';target.rank='leader';}
        else target.rank=action==='promote'?'officer':'member';
      }else if(action==='report'){
        if(!validName(a.name)||a.name.toLowerCase()===id||!REPORT_CATEGORIES.includes(a.category as typeof REPORT_CATEGORIES[number]))return fail('Choose another character and a report category');
        const description=clean(a.text),evidence=typeof a.message==='string'?this.evidence.get(id)?.find(m=>m.id===a.message):undefined;
        if(a.message&&(!evidence||evidence.from.toLowerCase()!==a.name.toLowerCase()))return fail('That message is not in your received history');if(!description&&!evidence)return fail('Describe what happened or select a received message');
        const duplicate=state.reports.find(r=>r.reporter===id&&r.target===a.name!.toString().toLowerCase()&&r.category===a.category&&r.description===description&&r.evidence?.id===evidence?.id);if(duplicate)return {ok:true,data:{id:duplicate.id}};
        if(state.reports.filter(r=>r.reporter===id).length>=SOCIAL_LIMIT||state.reports.length>=100*SOCIAL_LIMIT)return fail('The report queue is full; contact the owner');
        const report:Report={id:randomUUID(),reporter:id,target:a.name.toLowerCase(),category:String(a.category),description,at:now,resolved:false,...(evidence?{evidence}: {})};state.reports.push(report);return {ok:true,data:{id:report.id}};
      }else return fail('Unknown community action');
      return {ok:true};
    });
    if(result.ok&&a.action==='accept')this.invites=this.invites.filter(i=>i.to!==s.save.id);
    return result;
  }
  async owner(id:string,a:Record<string,unknown>):Promise<CmdResult>{
    return this.mutate(s=>{
      if(s.audit.some(x=>x.id===id))return {ok:true};const action=String(a.action),target=String(a.target??'').toLowerCase(),reason=clean(a.reason);
      if(!reason)return fail('An owner reason is required');
      if(['mute','ban','unmute','unban'].includes(action)){
        if(!validName(target))return fail('Invalid character name');const kind=action.endsWith('ban')?'ban':'mute';
        const minutes=Number(a.minutes);if(!action.startsWith('un')&&(!Number.isSafeInteger(minutes)||minutes<0||minutes>30*24*60))return fail('Use minutes0(permanent) through43200');
        s.sanctions=s.sanctions.filter(x=>!(x.target===target&&x.kind===kind));if(!action.startsWith('un')){if(s.sanctions.length>=100*SOCIAL_LIMIT)return fail('Sanction capacity reached');s.sanctions.push({target,kind,until:minutes===0?0:Date.now()+minutes*60000,reason});}
      }else if(action==='resolve'){const report=s.reports.find(r=>r.id===a.target);if(!report)return fail('Report no longer available');report.resolved=true;
      }else if(action==='filter'){
        if(!Array.isArray(a.phrases)||a.phrases.length>SOCIAL_LIMIT||!a.phrases.every(x=>typeof x==='string'&&clean(x).length>0&&x.length<=CHAT_MAX_LEN)||typeof a.links!=='boolean')return fail('Invalid filter settings');s.filter={phrases:a.phrases.map(x=>clean(x)),links:a.links};
      }else return fail('Unknown owner action');
      if(s.audit.length>=100*SOCIAL_LIMIT)return fail('Audit queue full; wait for retention expiry');s.audit.push({id,at:Date.now(),action,target,reason});return {ok:true};
    });
  }
  maintain():Promise<void>{
    if(this.stopped)return Promise.resolve();
    if(this.maintenance)return this.maintenance;
    this.maintenance=this.runMaintenance().finally(()=>{this.maintenance=null;});return this.maintenance;
  }
  private async runMaintenance(){
    try{await this.prune();const directory=path.join(this.directory,'owner-inbox'),all=await fs.readdir(directory);const files=all.filter(f=>/^[a-f0-9-]{36}\.json$/.test(f)).slice(0,CHAT_BURST);
      for(const file of all.filter(f=>/^[a-f0-9-]{36}\.json\.result$/.test(f))){const source=path.join(directory,file);if((await fs.stat(source)).mtimeMs<=Date.now()-REPORT_RETENTION_MS)await fs.rm(source);}
      for(const file of files){const source=path.join(directory,file);if((await fs.stat(source)).size>65536)continue;let result:CmdResult;
        try{result=await this.owner(file.slice(0,-5),JSON.parse(await fs.readFile(source,'utf8')));}catch(e){console.error('[community] owner operation failed',e);continue;}
        await fs.writeFile(path.join(directory,file+'.result'),JSON.stringify(result),{flush:true});await fs.rm(source);
      }
      for(const s of this.sessions())if(this.banned(s.save.id))s.kick('This character is suspended. Contact the owner.');
    }catch(e){console.error('[community] maintenance failed',e);}
  }
}
