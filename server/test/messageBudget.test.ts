import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import WebSocket from 'ws';
import {Packr} from 'msgpackr';
import {Session} from '../src/net/session';
import type {World} from '../src/world';
import {MAX_MESSAGES_PER_SECOND} from '../../shared/src/protocol';

assert.ok(process.env.DATA_DIR,'Message tests require isolated DATA_DIR');
const codec=new Packr({useRecords:false});
class SocketFixture extends EventEmitter {
  readyState:number=WebSocket.OPEN;bufferedAmount=0;messages:any[]=[];
  send(bytes:Uint8Array,_options:unknown,callback?:()=>void){this.messages.push(codec.unpack(bytes));callback?.();}
  close(){this.readyState=WebSocket.CLOSED;this.emit('close');}
  terminate(){this.close();}
}
function fixture(){
  const socket=new SocketFixture();
  const session=new Session(socket as unknown as WebSocket,{} as World);
  return {socket,session,send:(data:unknown)=>socket.emit('message',codec.pack(data),true)};
}
test('text messages share the binary budget and the next time window recovers',t=>{
  let now=10000;t.mock.method(Date,'now',()=>now);
  const f=fixture();
  try {
    for(let i=0;i<MAX_MESSAGES_PER_SECOND;i++)f.socket.emit('message',Buffer.from('unsupported'),false);
    f.send({t:'ping',c:1});assert.equal(f.socket.messages.length,0,'text must consume the connection budget');
    f.send({t:'cmd',id:1,op:'equip'});
    assert.deepEqual(f.socket.messages,[{t:'res',id:1,ok:false,err:'Too many requests'}]);
    assert.equal(f.session.state,'new','short burst keeps the connection');
    now+=1000;f.send({t:'ping',c:2});
    assert.deepEqual(f.socket.messages.at(-1),{t:'pong',c:2,s:now});
  }finally{f.session.shutdown('Fixture complete');}
});
test('sustained text and binary floods use the same existing disconnect threshold',t=>{
  t.mock.method(Date,'now',()=>10000);
  for(const binary of [false,true]){
    const f=fixture();
    try {
      const bytes=binary?codec.pack({t:'ping',c:1}):Buffer.from('unsupported');
      for(let i=0;i<MAX_MESSAGES_PER_SECOND+600;i++)f.socket.emit('message',bytes,binary);
      assert.equal(f.session.state,'new','existing drop allowance remains');
      f.socket.emit('message',bytes,binary);
      assert.equal(f.session.state,'closed',`sustained ${binary?'binary':'text'} flood`);
      assert.deepEqual(f.socket.messages.at(-1),{t:'err',msg:'Too many messages'});
    }finally{f.session.shutdown('Fixture complete');}
  }
});
test('ordinary binary pings and occasional malformed frames remain supported',t=>{
  t.mock.method(Date,'now',()=>10000);const f=fixture();
  try {
    f.socket.emit('message',Buffer.from([0xc1]),true);
    f.socket.emit('message',Buffer.from('unsupported'),false);
    for(let i=0;i<MAX_MESSAGES_PER_SECOND-2;i++)f.send({t:'ping',c:i});
    assert.equal(f.socket.messages.length,MAX_MESSAGES_PER_SECOND-2);
    assert.ok(f.socket.messages.every(m=>m.t==='pong'));
    assert.equal(f.session.state,'new');
  }finally{f.session.shutdown('Fixture complete');}
});
