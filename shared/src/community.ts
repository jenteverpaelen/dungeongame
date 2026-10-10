import type {CharacterSave} from './types';
export type GuildRank='leader'|'officer'|'member';
export interface GuildView {id:string;name:string;motd:string;rank:GuildRank;members:{name:string;rank:GuildRank;online:boolean}[]}
export interface CommunityView {guild:GuildView|null;invites:{id:string;guild:string;from:string}[];reports:{id:string;target:string;category:string;at:number;resolved:boolean}[]}
export const REPORT_CATEGORIES=['spam','harassment','cheating','other'] as const;
export const EMOTES={wave:'waves hello.',thanks:'offers their thanks.',cheer:'cheers for their companions.',ready:'signals they are ready.'} as const;
export const TITLES=[{id:'traveller',name:'Wayfarer',quest:null},{id:'brine',name:'Brinekeeper',quest:'sealed_brine'},{id:'beacon',name:'Beaconbearer',quest:'open_beacon'},{id:'signal',name:'Last Listener',quest:'last_transmission'}] as const;
export const unlockedTitles=(s:CharacterSave)=>TITLES.filter(t=>t.quest===null||s.quests?.[t.quest]?.claimed);
export const selectedTitle=(s:CharacterSave)=>unlockedTitles(s).find(t=>t.id===s.social?.title)?.name;
