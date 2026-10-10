import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn,type ChildProcess} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';
import {Packr} from 'msgpackr';
import {PROTOCOL_VERSION,type S2C} from '../../shared/src/protocol';
assert(process.env.DATA_DIR,'isolated DATA_DIR required');
const codec=new Packr({useRecords:false}),root=fileURLToPath(new URL('../../',import.meta.url));
async function port(){const s=net.createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const p=(s.address() as net.AddressInfo).port;await new Promise<void>(r=>s.close(()=>r()));return p;}
async function start(directory:string){
  const p=await port();let log='';
  const child=spawn(process.execPath,['--import','tsx','server/src/main.ts'],{cwd:root,env:{...process.env,DATA_DIR:directory,BACKUP_DIR:'',BACKUP_KEEP:'0',WS_ALLOWED_ORIGINS:undefined,PORT:String(p),ENABLE_DEBUG:'1',DISABLE_DEBUG:'0'},stdio:['ignore','pipe','pipe']});
  try{await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server start timeout: '+log.slice(-300))),8000);
    const data=(b:Buffer)=>{log+=b.toString();if(log.includes('Hearthfall listening')){clearTimeout(timer);resolve();}};
    child.stdout!.on('data',data);child.stderr!.on('data',data);child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited: '+log.slice(-300)));});});}catch(error){await stop(child);throw error;}
  return {child,url:`ws://127.0.0.1:${p}/ws`};
}
async function stop(child:ChildProcess){if(child.exitCode!==null||child.signalCode!==null)return;const exited=new Promise<void>(r=>child.once('exit',()=>r()));child.kill('SIGKILL');await exited;}
async function connect(url:string){
  const ws=new WebSocket(url,{origin:url.replace('ws:','http:').replace(/\/ws$/,'')});await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  const messages:S2C[]=[];ws.on('message',b=>messages.push(codec.unpack(Buffer.from(b as Buffer))));
  const wait=async<T extends S2C['t']>(kind:T,id?:number)=>{
    const end=Date.now()+8000;while(Date.now()<end){const m=messages.find(m=>m.t===kind&&(id===undefined||(m as {id?:number}).id===id));if(m)return m as Extract<S2C,{t:T}>;await new Promise(r=>setTimeout(r,5));}
    throw new Error('Response timeout '+kind);
  };
  ws.send(codec.pack({t:'hello',name:'CrashReceipt',classId:'warrior',v:PROTOCOL_VERSION}));try{const welcome=await wait('welcome');return {ws,wait,welcome};}catch(error){ws.terminate();throw error;}
}
test('an acknowledged grant survives an abrupt real process stop, and replay after restart cannot award it twice',{timeout:20000},async()=>{
  await fs.mkdir(process.env.DATA_DIR!,{recursive:true});const directory=await fs.mkdtemp(path.join(process.env.DATA_DIR!,'command-crash-'));
  let server:Awaited<ReturnType<typeof start>>|undefined,client:Awaited<ReturnType<typeof connect>>|undefined;
  try{
    server=await start(directory);client=await connect(server.url);
    const state=client.welcome.char.commands!,before=client.welcome.char.gold;
    const request={epoch:state.epoch,sequence:state.sequence,token:'e'.repeat(32)},message={t:'cmd',id:1,op:'debug',a:{op:'gold',n:31},r:request};
    client.ws.send(codec.pack(message));const result=await client.wait('res',1);assert(result.ok,result.err??'First grant failed');
    await stop(server.child);client.ws.terminate();
    server=await start(directory);client=await connect(server.url);assert.equal(client.welcome.char.gold,before+31);
    client.ws.send(codec.pack(message));assert((await client.wait('res',1)).ok);
    const disk=JSON.parse(await fs.readFile(path.join(directory,client.welcome.char.id+'.json'),'utf8'));
    assert.equal(disk.gold,before+31);assert.equal(disk.commands.sequence,state.sequence+1);
  }catch(error){console.error(error);throw error;}finally{client?.ws.terminate();if(server)await stop(server.child);}
});
