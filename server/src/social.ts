import {CHAT_CHANNELS,CHAT_MAX_LEN,emptySocial,SOCIAL_LIMIT,validSocial,type ChatChannel,type SocialState,type SocialView} from '../../shared/src/social';
import type {Session} from './net/session';
import type {Parties} from './party';
import type {CmdResult} from './world';
import {SLOTS,type Item} from '../../shared/src/types';
import {randomUUID} from 'node:crypto';
import type {Community} from './community';
import {unlockedTitles} from '../../shared/src/community';
import { ownedItems } from '../../shared/src/merchant';

const has=(names:string[],name:string)=>names.some(n=>n.toLowerCase()===name.toLowerCase());
const fail=(err:string):CmdResult=>({ok:false,err});
export class Social {
  community?:Community;
  private sent=new Map<string,string>();
  constructor(private sessions:()=>Iterable<Session>,private parties:Parties,private disabled=new Set((process.env.SOCIAL_DISABLED_CHANNELS??'').split(',').filter(Boolean))){}
  private state(s:Session):SocialState {return validSocial(s.save.social)?s.save.social:emptySocial();}
  private supported(s:Session){return s.save.social===undefined||validSocial(s.save.social);}
  private online(name:string){return [...this.sessions()].find(p=>p.save.name.toLowerCase()===name.toLowerCase());}
  private enabled(s:Session){return !!s.rec&&!this.disabled.has(`${s.rec.zoneId}#${s.rec.channel}`);}
  isEnabled(s:Session){return this.enabled(s);}
  blocked(a:Session,b:Session){return !this.supported(a)||!this.supported(b)||has(this.state(a).blocked,b.save.name)||has(this.state(b).blocked,a.save.name);}
  private mutual(a:Session,b:Session){return has(this.state(a).friends,b.save.name)&&has(this.state(b).friends,a.save.name);}
  canInvite(a:Session,b:Session){return !this.blocked(a,b);}
  presenceVisible(a:Session,b:Session){return this.enabled(b)&&!this.blocked(a,b)&&this.state(b).presence==='contacts'&&(a===b||this.mutual(a,b));}
  view(s:Session):SocialView{
    const state=this.state(s);
    return {friends:state.friends.map(name=>{
      const peer=this.online(name),visible=peer&&this.enabled(peer)&&!this.blocked(s,peer)&&this.mutual(s,peer)&&this.state(peer).presence==='contacts';
      return visible?{name:peer.save.name,online:true,classId:peer.save.classId,level:peer.save.level,zone:peer.rec?.zoneId,channel:peer.rec?.channel}:{name,online:false};
    }),blocked:state.blocked,muted:state.muted,presence:state.presence,whispers:state.whispers,inspect:state.inspect??'contacts',enabled:this.enabled(s),supported:this.supported(s)};
  }
  tick(){for(const s of this.sessions()){const social=this.view(s),key=JSON.stringify(social);if(key!==this.sent.get(s.save.id)){this.sent.set(s.save.id,key);s.send({t:'social',social});}}}
  disconnected(s:Session){this.sent.delete(s.save.id);this.tick();}
  command(s:Session,a:Record<string,unknown>):CmdResult{
    if(this.online(s.save.name)!==s)return fail('Join the world before changing contacts');
    if(!this.supported(s))return fail('This social record needs a supported game version');
    const action=a.action;
    if(!this.enabled(s)&&!['remove','unblock','unmute','privacy','title'].includes(String(action)))return fail('Social actions are disabled in this channel');
    const state=structuredClone(this.state(s));
    if(action==='title'){
      if(a.title!==''&&!unlockedTitles(s.save).some(t=>t.id===a.title))return fail('Earn that title through the story first');
      state.title=String(a.title);
    }else if(action==='privacy'){
      if(!['contacts','hidden'].includes(String(a.presence))||!['all','contacts','off'].includes(String(a.whispers)))return fail('Choose valid privacy settings');
      state.presence=a.presence as SocialState['presence'];state.whispers=a.whispers as SocialState['whispers'];
      if(a.inspect!==undefined){if(!['all','contacts','off'].includes(String(a.inspect)))return fail('Choose a valid inspection setting');state.inspect=a.inspect as SocialState['inspect'];}
    }else{
      if(typeof a.name!=='string'||!/^[A-Za-z0-9]{2,16}$/.test(a.name)||a.name.toLowerCase()===s.save.name.toLowerCase())return fail('Enter another character name (2–16 letters or numbers)');
      const name=this.online(a.name)?.save.name??a.name;
      const list=action==='add'||action==='remove'?'friends':action==='block'||action==='unblock'?'blocked':action==='mute'||action==='unmute'?'muted':null;
      if(!list)return fail('Unknown social action');
      if(['add','block','mute'].includes(String(action))){
        if(has(state[list],name))return fail('That name is already on this list');
        if(state[list].length>=SOCIAL_LIMIT)return fail(`This list holds ${SOCIAL_LIMIT} names; remove one first`);
        state[list].push(name);
      }else state[list]=state[list].filter(n=>n.toLowerCase()!==name.toLowerCase());
    }
    s.save.social=state;s.changed(action==='title');this.parties.pruneInvites();return {ok:true};
  }
  inspect(s:Session,a:Record<string,unknown>):CmdResult{
    const peer=typeof a.name==='string'?this.online(a.name):undefined,policy=peer&&(this.state(peer).inspect??'contacts');
    if(this.online(s.save.name)!==s||!peer||!this.enabled(s)||!this.enabled(peer)||this.blocked(s,peer)||policy==='off'||(policy==='contacts'&&peer!==s&&!this.mutual(s,peer)&&!this.parties.together(s,peer)))return fail('That character is not available for inspection');
    const equipment:Partial<Record<typeof SLOTS[number],Item>>={};
    for(const slot of SLOTS){const item=peer.save.equipment[slot];if(!item)continue;
      equipment[slot]=structuredClone({id:`inspection-${slot}`,base:item.base,kind:item.kind,name:item.name,rarity:item.rarity,ancient:item.ancient,ilvl:item.ilvl,reqLevel:item.reqLevel,affixes:item.affixes,legendary:item.legendary,set:item.set,weapon:item.weapon,armor:item.armor,sockets:item.sockets,upgrade:item.upgrade,upgradeFortune:item.upgradeFortune,enchanted:item.enchanted,enchantCount:item.enchantCount,bound:item.bound,look:item.look,flavor:item.flavor});
    }
    return {ok:true,data:{name:peer.save.name,classId:peer.save.classId,level:peer.save.level,equipment}};
  }
  chat(s:Session,text:string,ch:unknown='zone',to?:unknown):CmdResult{
    if(!s.rec||this.online(s.save.name)!==s)return fail('Join the world before chatting');
    if(!CHAT_CHANNELS.includes(ch as ChatChannel))return fail('Unknown chat channel');
    if(ch!=='zone'&&!this.enabled(s))return fail('Social channels are disabled here');
    if(!this.supported(s))return fail('This social record needs a supported game version');
    text=text.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim().slice(0,CHAT_MAX_LEN);
    if(!text)return fail('Enter a message');
    let item: Item | undefined;
    const link = /^\[\[item:([^\[\]]{1,100})\]\]$/.exec(text);
    if(link){
      const owned=ownedItems(s.save).find(i=>i?.id===link[1]);
      if(!owned)return fail('You no longer own that item');
      item=structuredClone(owned); text=`[${item.name}]`;
    }
    if(this.community&&!this.community.canSpeak(s))return fail('This character is muted. Contact the owner.');
    if(this.community&&!this.community.filter(text))return fail('That message is blocked by the chat filter');
    let recipients:Session[];
    if(ch==='whisper'){
      if(typeof to!=='string')return fail('Choose a whisper recipient');
      const peer=this.online(to),policy=peer&&this.state(peer).whispers;
      if(!peer||peer===s||!this.enabled(peer)||this.blocked(s,peer)||has(this.state(peer).muted,s.save.name)||policy==='off'||(policy==='contacts'&&!this.mutual(s,peer)&&!this.parties.together(s,peer)))return fail('That character is not available for whispers');
      recipients=[s,peer];
    }else if(ch==='guild'){
      if(!this.community?.view(s).guild)return fail('Join a guild before using guild chat');
      recipients=[...this.sessions()].filter(p=>this.community!.together(s,p));
    }else if(ch==='party'){
      if(!this.parties.view(s).id)return fail('Join a party before using party chat');
      recipients=[...this.sessions()].filter(p=>this.parties.together(s,p));
    }else recipients=ch==='zone'?[...s.rec.members]:[...this.sessions()];
    const messageId=randomUUID();
    for(const peer of recipients){
      if(peer!==s&&(this.blocked(s,peer)||has(this.state(peer).muted,s.save.name)||(ch!=='zone'&&!this.enabled(peer))))continue;
      const message={t:'chat' as const,ch:ch as ChatChannel,from:s.save.name,cls:s.save.classId,text,messageId,...(item?{item}:{}),...(ch==='whisper'?{to:recipients[1].save.name}:{})};
      this.community?.remember(peer,message);peer.send(message);
    }
    return {ok:true};
  }
}
