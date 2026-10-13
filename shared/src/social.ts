import type {ClassId} from './types';

export const SOCIAL_LIMIT=80;
export const SOCIAL_PAGE_SIZE=8;
export const CHAT_MAX_LEN=200;
export const CHAT_BURST=5;
export const CHAT_REFILL_MS=1000;
export type ChatChannel='zone'|'world'|'party'|'trade'|'lfg'|'whisper'|'guild';
export const CHAT_CHANNELS:readonly ChatChannel[]=['zone','world','party','trade','lfg','whisper','guild'];
export type WhisperPolicy='all'|'contacts'|'off';
export interface SocialState {revision:1;friends:string[];blocked:string[];muted:string[];presence:'contacts'|'hidden';whispers:WhisperPolicy;inspect?:WhisperPolicy;title?:string}
export interface FriendView {name:string;online:boolean;classId?:ClassId;level?:number;zone?:string;channel?:number}
/** requests: online heroes who added you in the last FRIEND_NOTICE_MS and whom you have not added (the "added you" popup). */
export interface SocialView {friends:FriendView[];blocked:string[];muted:string[];presence:SocialState['presence'];whispers:WhisperPolicy;inspect:WhisperPolicy;enabled:boolean;supported:boolean;requests?:string[]}
/** How long "X added you as a friend" stays on screen, and how soon the same pair may cause it again (add/remove spam). */
export const FRIEND_NOTICE_MS=30_000,FRIEND_NOTICE_REPEAT_MS=10*60_000;
export const emptySocial=():SocialState=>({revision:1,friends:[],blocked:[],muted:[],presence:'contacts',whispers:'contacts'});
export function validSocial(v:unknown):v is SocialState {
  const s=v as SocialState|undefined;
  const list=(a:unknown)=>Array.isArray(a)&&a.length<=SOCIAL_LIMIT&&a.every(n=>typeof n==='string'&&/^[A-Za-z0-9]{2,16}$/.test(n))&&new Set(a.map(n=>n.toLowerCase())).size===a.length;
  return !!s&&s.revision===1&&list(s.friends)&&list(s.blocked)&&list(s.muted)&&['contacts','hidden'].includes(s.presence)&&['all','contacts','off'].includes(s.whispers)&&(s.inspect===undefined||['all','contacts','off'].includes(s.inspect))&&(s.title===undefined||typeof s.title==='string'&&s.title.length<=32);
}
export interface Inspection {name:string;classId:ClassId;level:number;equipment:Partial<Record<import('./types').Slot,import('./types').Item>>}
