import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { validCommandState } from '../../shared/src/commandState';
import { initializeCommandState, persistedCommand } from '../src/net/persistedCommands';
import type { Session } from '../src/net/session';

function fixture(){const s={save:createCharacter('Receipt','mage',1),pendingEnchant:null} as unknown as Session;initializeCommandState(s.save);return s;}
test('saved identity survives serialization, old sequences never reopen, and same identity cannot change intent',()=>{
  let s=fixture(),calls=0;const request={epoch:s.save.commands!.epoch,sequence:0,token:'a'.repeat(32)};
  const grant=()=>{calls++;s.save.gold+=7;return {ok:true,data:{gold:s.save.gold}};};
  assert(persistedCommand(s,request,'debug',{op:'gold',n:7},grant).fresh);
  s={save:JSON.parse(JSON.stringify(s.save)),pendingEnchant:null} as unknown as Session;
  assert(!persistedCommand(s,request,'debug',{n:7,op:'gold'},grant).fresh);assert.equal(calls,1);
  assert(!persistedCommand(s,request,'debug',{op:'gold',n:8},grant).result.ok);
  assert(persistedCommand(s,{...request,sequence:1,token:'b'.repeat(32)},'debug',{op:'gold',n:7},grant).result.ok);
  assert(!persistedCommand(s,request,'debug',{op:'gold',n:7},grant).result.ok);assert.equal(calls,2);assert.equal(s.save.gold,14);
});
test('unsupported records, bad identities, overflow and a pending commit cannot reach mutation',()=>{
  const s=fixture();let calls=0;const execute=()=>{calls++;return {ok:true};},request={epoch:s.save.commands!.epoch,sequence:0,token:'a'.repeat(32)};
  for(const r of [undefined,{...request,epoch:'wrong'},{...request,sequence:-1},{...request,token:'wrong'}])assert(!persistedCommand(s,r,'debug',{},execute).result.ok);
  assert(!persistedCommand(s,request,'debug',{},execute,()=>false).result.ok);
  s.save.commands!.sequence=Number.MAX_SAFE_INTEGER;assert(!persistedCommand(s,{...request,sequence:Number.MAX_SAFE_INTEGER},'debug',{},execute).result.ok);
  for(const record of [null,{revision:99,preserve:true}]){s.save.commands=record as never;initializeCommandState(s.save);assert.deepEqual(s.save.commands,record);assert(!persistedCommand(s,request,'debug',{},execute).result.ok);}
  assert.equal(calls,0);
});
test('a handler rejection is recorded once and a reward-plan clone retains the next receipt',()=>{
  const s=fixture(),request={epoch:s.save.commands!.epoch,sequence:0,token:'c'.repeat(32)};let calls=0;
  const deny=()=>{calls++;return {ok:false,err:'Fixture refusal'};};
  assert(persistedCommand(s,request,'quest',{},deny).fresh);assert(!persistedCommand(s,request,'quest',{},deny).result.ok);assert.equal(calls,1);
  const next={...request,sequence:1,token:'d'.repeat(32)};
  assert(persistedCommand(s,next,'quest',{},()=>{Object.assign(s.save,structuredClone(s.save));s.save.gold=20;return {ok:true};}).result.ok);
  assert.equal(s.save.commands!.sequence,2);assert(validCommandState(s.save.commands));assert.equal(s.save.commands!.latest!.request.token,next.token);
});
