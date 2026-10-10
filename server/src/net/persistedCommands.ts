import { randomUUID } from 'node:crypto';
import { validCommandRequest, validCommandState, type CommandRequest } from '../../../shared/src/commandState';
import type { CharacterSave } from '../../../shared/src/types';
import { commandFingerprint } from './commandReceipts';
import type { Session } from './session';
import type { CmdResult } from '../world';
import { ownedItems } from '../../../shared/src/merchant';

/** Only absent legacy state is initialized. Unsupported records must remain intact. */
export function initializeCommandState(save:CharacterSave):void {
  if(save.commands===undefined)save.commands={revision:1,epoch:randomUUID(),sequence:0};
}
/** Mutation and receipt become one character snapshot; the caller must await its write before success. */
export function persistedCommand(s:Session,request:unknown,op:string,args:Record<string,unknown>,execute:()=>CmdResult,canExecute=()=>true):{result:CmdResult;fresh:boolean} {
  const fail=(err:string)=>({result:{ok:false,err},fresh:false});
  const state=s.save.commands;
  if(!validCommandState(state))return fail('This character needs a supported transaction record before changing saved items or resources');
  if(!validCommandRequest(request)||request.epoch!==state.epoch)return fail('Refresh your character before making this request');
  const fingerprint=commandFingerprint(op,args),previous=state.latest;
  if(previous&&previous.request.token===request.token&&previous.request.sequence===request.sequence){
    return previous.fingerprint===fingerprint?{result:structuredClone(previous.result),fresh:false}:fail('This request was already used for a different action');
  }
  if(request.sequence!==state.sequence)return fail('Your character changed; review the current state before trying again');
  if(!Number.isSafeInteger(state.sequence+1))return fail('The transaction counter needs maintenance; nothing was changed');
  if(!canExecute())return fail('Your previous action is still saving. Wait for its result before trying again.');
  let result:CmdResult;
  try{result=execute();}catch(error){
    console.error(`[command] ${op} interrupted:`,error);
    result={ok:false,err:'The action was interrupted. Review your character before making a new request.'};
  }
  // Quest handlers may replace the save's fields from a cloned reward plan.
  const current=s.save.commands!;
  if(s.pendingEnchant&&!ownedItems(s.save).some(i=>i?.id===s.pendingEnchant!.itemId))s.pendingEnchant=null;
  current.sequence++;
  current.latest={request:{...(request as CommandRequest)},fingerprint,result:structuredClone(result)};
  current.pendingEnchant=s.pendingEnchant?structuredClone(s.pendingEnchant):undefined;
  return {result,fresh:true};
}
