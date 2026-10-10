import type {ClassId} from './types';
export interface PartyMemberView {key:string;name:string;classId:ClassId;level:number;online:boolean;zone:string|null;channel:number|null;hp:number|null;dead:boolean}
export interface PartyInviteView {id:string;from:string;expiresAt:number}
export interface PartyView {
  id:string|null;you:string|null;leader:string|null;members:PartyMemberView[];
  incoming:PartyInviteView[];outgoing:{id:string;name:string;expiresAt:number}[];
  enabled:boolean;now:number;
}
