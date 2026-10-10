import {randomUUID} from 'node:crypto';
import {PARTY_MAX} from '../../shared/src/constants';
import type {PartyView,PartyMemberView} from '../../shared/src/party';
import {EMPTY_RIFT_DESTROY_MS} from './config';
import type {Session} from './net/session';
import type {CmdResult} from './world';

const DURATION=EMPTY_RIFT_DESTROY_MS; // Existing sixty-second transient-instance budget.
type Member={id:string;key:string;name:string;classId:Session['save']['classId'];level:number;offlineUntil?:number};
type Group={id:string;leader:string;members:Member[]};
type Invite={id:string;group:string;from:string;to:string;fromName:string;toName:string;expiresAt:number};
const fail=(err:string):CmdResult=>({ok:false,err});
/** Ephemeral membership only. It never writes character data, grants rewards or performs travel. */
export class Parties {
  private groups=new Map<string,Group>();
  private membership=new Map<string,string>();
  private invites=new Map<string,Invite>();
  private inviteAt=new Map<string,number>();
  private sent=new Map<string,string>();
  constructor(private sessions:()=>Iterable<Session>,private disabled=new Set((process.env.PARTY_DISABLED_CHANNELS??'').split(',').filter(Boolean)),private canInvite:(a:Session,b:Session)=>boolean=()=>true){}
  together(a:Session,b:Session){const group=this.group(a.save.id);return !!group&&group.id===this.group(b.save.id)?.id;}
  pruneInvites(){for(const [id,i] of this.invites){const a=this.online(i.from),b=this.online(i.to);if(a&&b&&!this.canInvite(a,b))this.invites.delete(id);}}
  private online(id:string){return [...this.sessions()].find(s=>s.save.id===id);}
  private group(id:string){const key=this.membership.get(id);return key?this.groups.get(key):undefined;}
  private enabled(s:Session){return !!s.rec&&!this.disabled.has(`${s.rec.zoneId}#${s.rec.channel}`);}
  private cancelInvites(group:string){for(const [key,i] of this.invites)if(i.group===group)this.invites.delete(key);}
  private remove(g:Group,id:string){
    g.members=g.members.filter(m=>m.id!==id);this.membership.delete(id);
    if(!g.members.length){this.groups.delete(g.id);this.cancelInvites(g.id);return;}
    if(g.leader===id){g.leader=(g.members.find(m=>this.online(m.id))??g.members[0]).id;this.cancelInvites(g.id);}
  }
  connected(s:Session,now=Date.now()){
    this.expire(now);const member=this.group(s.save.id)?.members.find(m=>m.id===s.save.id);if(member)delete member.offlineUntil;
    this.sent.delete(s.save.id);this.broadcast(now);
  }
  disconnected(s:Session,now=Date.now()){
    const id=s.save.id,g=this.group(id),member=g?.members.find(m=>m.id===id);
    if(member){member.level=s.save.level;member.offlineUntil=now+DURATION;if(g!.leader===id){const next=g!.members.find(m=>m.id!==id&&this.online(m.id));if(next){g!.leader=next.id;this.cancelInvites(g!.id);}}}
    for(const [key,i] of this.invites)if(i.from===id||i.to===id)this.invites.delete(key);
    this.sent.delete(id);this.inviteAt.delete(id);this.broadcast(now);
  }
  private expire(now:number){
    for(const [key,i] of this.invites)if(i.expiresAt<=now||!this.groups.has(i.group))this.invites.delete(key);
    for(const g of this.groups.values())for(const m of [...g.members])if(m.offlineUntil!==undefined&&m.offlineUntil<=now)this.remove(g,m.id);
  }
  tick(now=Date.now()){this.expire(now);this.broadcast(now);}
  view(s:Session,now=Date.now()):PartyView{
    const id=s.save.id,g=this.group(id);
    const members:PartyMemberView[]=g?.members.map(m=>{
      const peer=this.online(m.id),rec=peer?.rec,p=peer&&rec?.inst.partyStatus?.(peer);
      return {key:m.key,name:peer?.save.name??m.name,classId:m.classId,level:peer?.save.level??m.level,online:!!peer,
        zone:rec?.zoneId??null,channel:rec?.channel??null,hp:p?Math.round(Math.max(0,Math.min(1,p.hp/Math.max(1,p.mhp)))*100)/100:null,dead:p?.dead??false};
    })??[];
    const invites=[...this.invites.values()];
    return {id:g?.id??null,you:g?.members.find(m=>m.id===id)?.key??null,leader:g?.members.find(m=>m.id===g.leader)?.key??null,members,
      incoming:invites.filter(i=>i.to===id).map(i=>({id:i.id,from:i.fromName,expiresAt:i.expiresAt})),
      outgoing:invites.filter(i=>i.from===id).map(i=>({id:i.id,name:i.toName,expiresAt:i.expiresAt})),enabled:this.enabled(s),now};
  }
  private broadcast(now:number){
    for(const s of this.sessions()){
      const party=this.view(s,now),fingerprint=JSON.stringify({...party,now:0});
      if(this.sent.get(s.save.id)===fingerprint)continue;
      this.sent.set(s.save.id,fingerprint);s.send({t:'party',party});
    }
  }
  command(s:Session,a:Record<string,unknown>,now=Date.now()):CmdResult{
    this.expire(now);this.pruneInvites();const id=s.save.id,action=a.action,g=this.group(id);
    if(this.online(id)!==s)return fail('Join the world before managing a party');
    if(!['leave','decline','cancel'].includes(String(action))&&!this.enabled(s))return fail('Party invitations are disabled in this channel');
    if(action==='invite'){
      if(g&&g.leader!==id)return fail('Only the party leader can invite');
      if(g&&g.members.length>=PARTY_MAX)return fail('The party is full');
      if(typeof a.name!=='string'||!a.name.trim()||a.name.length>16)return fail('Enter an online character name');
      const matches=[...this.sessions()].filter(peer=>peer.save.name.toLocaleLowerCase()===a.name!.toString().trim().toLocaleLowerCase());
      if(matches.length!==1)return fail('That character is not available');const target=matches[0];
      if(target.save.id===id)return fail('You cannot invite yourself');
      if(!this.enabled(target)||!this.canInvite(s,target)||this.group(target.save.id))return fail('That character is not available for a party');
      if(now-(this.inviteAt.get(id)??-Infinity)<1000)return fail('Wait a moment before inviting again');
      const all=[...this.invites.values()];
      if(all.some(i=>i.from===id&&i.to===target.save.id))return fail('An invitation is already pending');
      if(all.filter(i=>i.to===target.save.id).length>=PARTY_MAX||all.filter(i=>i.from===id).length>=PARTY_MAX)return fail('Too many pending invitations');
      const group=g??{id:randomUUID(),leader:id,members:[{id,key:randomUUID(),name:s.save.name,classId:s.save.classId,level:s.save.level}]};
      if(!g){this.groups.set(group.id,group);this.membership.set(id,group.id);}
      const invite:Invite={id:randomUUID(),group:group.id,from:id,to:target.save.id,fromName:s.save.name,toName:target.save.name,expiresAt:now+DURATION};
      this.invites.set(invite.id,invite);this.inviteAt.set(id,now);
    }else if(action==='accept'||action==='decline'||action==='cancel'){
      const i=typeof a.invite==='string'?this.invites.get(a.invite):undefined;
      if(!i||(action==='cancel'?i.from!==id:i.to!==id))return fail('That invitation is no longer available');
      if(action==='accept'){
        if(g)return fail('Leave your current party before accepting another');
        const group=this.groups.get(i.group),leader=this.online(i.from);
        if(!group||group.leader!==i.from||!leader||!this.enabled(leader))return fail('That party is no longer available');
        if(group.members.length>=PARTY_MAX)return fail('The party is full');
        group.members.push({id,key:randomUUID(),name:s.save.name,classId:s.save.classId,level:s.save.level});this.membership.set(id,group.id);
        for(const [key,other] of this.invites)if(other.to===id)this.invites.delete(key);
      }else this.invites.delete(i.id);
    }else if(action==='leave'){
      if(!g)return fail('You are not in a party');this.remove(g,id);
    }else if(action==='kick'||action==='leader'){
      if(!g||g.leader!==id)return fail('Only the party leader can do that');
      const member=g.members.find(m=>m.key===a.member);if(!member||member.id===id)return fail('Choose another party member');
      if(action==='kick')this.remove(g,member.id);
      else {if(!this.online(member.id))return fail('The new leader must be online');g.leader=member.id;this.cancelInvites(g.id);}
    }else return fail('Unknown party action');
    this.broadcast(now);return {ok:true};
  }
}
