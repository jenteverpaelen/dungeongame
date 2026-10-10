import type {ClassId} from './types';
export interface PartyMemberView {key:string;name:string;classId:ClassId;level:number;online:boolean;zone:string|null;channel:number|null;hp:number|null;dead:boolean}
export interface PartyInviteView {id:string;from:string;expiresAt:number}
export interface PartyView {
  listing?:PartyActivity|null;
  id:string|null;you:string|null;leader:string|null;members:PartyMemberView[];
  incoming:PartyInviteView[];outgoing:{id:string;name:string;expiresAt:number}[];
  enabled:boolean;now:number;
}
export const PARTY_ACTIVITIES=['story','rifts','exploration'] as const;
export type PartyActivity=typeof PARTY_ACTIVITIES[number];
export interface PartyListing {id:string;leader:string;level:number;activity:PartyActivity;members:number;zone:string;channel:number}
export interface PartyDirectory {entries:PartyListing[];page:number;pages:number;total:number}
