// Experimental storage drill only. Never imported by the game or given live data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync, backup } from 'node:sqlite';
import { createCharacter } from '../shared/src/character';
import { generateItem } from '../shared/src/items';
import { CLASS_IDS } from '../shared/src/data/classes';
import { INVENTORY_SIZE, STASH_SIZE, MAX_LEVEL } from '../shared/src/constants';
import { Rng } from '../shared/src/math';
import type { ClassId, Rarity } from '../shared/src/types';

const filename = fileURLToPath(import.meta.url);
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const tables = ['accounts', 'characters', 'claims', 'receipts'] as const;
const owned = new Set<ChildProcess>();
type Claim = { account:string; character:string; token:string; request:string; pause?:string };
function open(directory: string) {
  const db = new DatabaseSync(path.join(directory, 'candidate.db'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=0');
  assert.equal(db.prepare('PRAGMA journal_mode').get()!.journal_mode,'wal');
  assert.equal(db.prepare('PRAGMA synchronous').get()!.synchronous,2);
  assert.equal(db.prepare('PRAGMA foreign_keys').get()!.foreign_keys,1);
  assert.equal(db.prepare('PRAGMA busy_timeout').get()!.timeout,0);
  return db;
}
function snapshot(db: DatabaseSync) {
  assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  return Object.fromEntries(tables.map(table => [table,db.prepare(`SELECT * FROM ${table} ORDER BY ${table==='receipts'?'1,2':'1'}`).all()
    .map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value instanceof Uint8Array ? Buffer.from(value).toString('utf8') : value])))]));
}
function fixture(classId: ClassId) {
  const save = createCharacter(`Txn${classId}`,classId,47);
  save.level=MAX_LEVEL; save.lastSeen=1700000000000;
  const rng=new Rng(73), rarities: Rarity[]=['normal','magic','rare','legendary','set'];
  save.inventory=Array.from({length:INVENTORY_SIZE},(_,i)=>generateItem(rng,{ilvl:MAX_LEVEL,classId,rarity:rarities[i%rarities.length]}));
  save.stash=Array.from({length:STASH_SIZE},(_,i)=>generateItem(rng,{ilvl:MAX_LEVEL,classId,rarity:rarities[i%rarities.length]}));
  const body=JSON.stringify({...save,syntheticExtension:{purpose:'transaction drill only',keep:['unknown',17]}});
  const ids=[...Object.values(save.equipment),...save.inventory,...save.stash].map(item=>item!.id);
  assert.equal(new Set(ids).size,ids.length);
  return {body,id:save.id,bytes:Buffer.byteLength(body),itemCount:ids.length,sha256:digest(body)};
}
function seed(db: DatabaseSync, f: ReturnType<typeof fixture>) {
  db.exec(`CREATE TABLE accounts(id TEXT PRIMARY KEY) STRICT;
    CREATE TABLE characters(id TEXT PRIMARY KEY, owner TEXT REFERENCES accounts(id), body BLOB NOT NULL) STRICT;
    CREATE TABLE claims(token_hash TEXT PRIMARY KEY, character_id TEXT NOT NULL UNIQUE REFERENCES characters(id),
      consumed_by TEXT REFERENCES accounts(id), request_id TEXT) STRICT;
    CREATE TABLE receipts(account TEXT REFERENCES accounts(id), request_id TEXT, fingerprint TEXT NOT NULL,
      result TEXT NOT NULL, PRIMARY KEY(account,request_id)) STRICT;`);
  db.exec("INSERT INTO accounts VALUES('account-a'),('account-b')");
  db.prepare('INSERT INTO characters VALUES(?,NULL,?)').run(f.id,Buffer.from(f.body));
  db.prepare('INSERT INTO claims VALUES(?,?,NULL,NULL)').run(digest('synthetic-claim'),f.id);
}

async function childMain() {
  const directory=process.env.DATA_DIR!, root=process.env.TRANSACTION_DRILL_ROOT!;
  assert.ok(root && path.basename(root).startsWith('hf-transaction-drill-'));
  assert.ok(directory && path.resolve(directory).startsWith(path.resolve(root)+path.sep));
  assert.equal(await fs.readFile(path.join(root,'synthetic-only.txt'),'utf8'),'Synthetic transaction drill only.\n');
  const db=open(directory);
  let resume: (()=>void)|undefined;
  const pause=async (point:string,args:Claim) => {
    if(args.pause!==point)return;
    await new Promise<void>(resolve=>{resume=resolve;process.send!({checkpoint:point});});
  };
  async function claim(args:Claim) {
    const fingerprint=digest(JSON.stringify([args.account,args.character,digest(args.token)]));
    try {db.exec('BEGIN IMMEDIATE');} catch(error) {
      // SQLite reports an extended error code; only the low byte is the primary code.
      if(((error as {errcode?:number}).errcode! & 255)===5)return {ok:false,reason:'busy'};
      throw error;
    }
    try {
      const previous=db.prepare('SELECT fingerprint,result FROM receipts WHERE account=? AND request_id=?').get(args.account,args.request);
      if(previous) {db.exec('ROLLBACK');return previous.fingerprint===fingerprint ? JSON.parse(previous.result as string) : {ok:false,reason:'changed intent'};}
      const valid=db.prepare(`SELECT c.id FROM claims k JOIN characters c ON c.id=k.character_id
        WHERE k.token_hash=? AND c.id=? AND k.consumed_by IS NULL AND c.owner IS NULL`).get(digest(args.token),args.character);
      if(!valid) {db.exec('ROLLBACK');return {ok:false,reason:'unavailable claim'};}
      assert.equal(db.prepare('UPDATE characters SET owner=? WHERE id=? AND owner IS NULL').run(args.account,args.character).changes,1);
      await pause('after-character',args);
      assert.equal(db.prepare('UPDATE claims SET consumed_by=?,request_id=? WHERE token_hash=? AND consumed_by IS NULL')
        .run(args.account,args.request,digest(args.token)).changes,1);
      const result={ok:true,character:args.character};
      db.prepare('INSERT INTO receipts VALUES(?,?,?,?)').run(args.account,args.request,fingerprint,JSON.stringify(result));
      await pause('before-commit',args);
      db.exec('COMMIT');
      await pause('after-commit',args);
      return result;
    } catch(error) {if(db.isTransaction)db.exec('ROLLBACK');throw error;}
  }
  let queue=Promise.resolve();
  process.on('message',(raw:any)=>{
    if(raw.op==='resume'){const fn=resume;resume=undefined;fn?.();return;}
    queue=queue.then(async()=>{
      try {
        let result:unknown;
        if(raw.op==='claim')result=await claim(raw.args);
        else if(raw.op==='close'){db.close();process.send!({id:raw.id,result:true},()=>process.disconnect!());return;}
        else throw Error('Unknown test request');
        process.send!({id:raw.id,result});
      } catch(error){process.send!({id:raw.id,error:String(error)});}
    });
  });
  process.send!({ready:true});
}

async function start(directory:string,root:string) {
  const child=spawn(process.execPath,['--import','tsx',filename,'--child'],{windowsHide:true,
    env:{...process.env,DATA_DIR:directory,BACKUP_DIR:'',TRANSACTION_DRILL_ROOT:root},stdio:['ignore','pipe','pipe','ipc']});
  owned.add(child);
  let output='',next=1;
  let checkpointPending:{resolve:(point:string)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}|undefined;
  const pending=new Map<number,{resolve:(result:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  const closed=new Promise<void>(resolve=>child.once('close',()=>{owned.delete(child);resolve();}));
  child.stdout!.on('data',d=>output+=String(d));child.stderr!.on('data',d=>output+=String(d));
  let readyResolve:()=>void,readyReject:(error:Error)=>void;
  const ready=new Promise<void>((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  const readyTimer=setTimeout(()=>readyReject(Error('Test child ready timeout')),10000);
  child.on('message',(message:any)=>{
    if(message.ready){clearTimeout(readyTimer);readyResolve();}
    else if(message.checkpoint && checkpointPending){clearTimeout(checkpointPending.timer);checkpointPending.resolve(message.checkpoint);checkpointPending=undefined;}
    else if(message.id){const p=pending.get(message.id);if(p){clearTimeout(p.timer);pending.delete(message.id);message.error?p.reject(Error(message.error)):p.resolve(message.result);}}
  });
  child.on('error',error=>{clearTimeout(readyTimer);readyReject(error);});
  child.on('close',()=>{
    clearTimeout(readyTimer);readyReject(Error('Child closed before ready: '+output));
    if(checkpointPending){clearTimeout(checkpointPending.timer);checkpointPending.reject(Error('Child closed before checkpoint: '+output));checkpointPending=undefined;}
    for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Owned child terminated before reply'));}pending.clear();
  });
  await ready;
  return {
    call:(op:string,args?:unknown)=>new Promise<any>((resolve,reject)=>{
      const id=next++;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Test child request timeout'));},10000);
      pending.set(id,{resolve,reject,timer});child.send({id,op,args});
    }),
    checkpoint:()=>new Promise<string>((resolve,reject)=>{
      assert.equal(checkpointPending,undefined,'Only one checkpoint may be awaited');
      const timer=setTimeout(()=>{checkpointPending=undefined;reject(Error('Test child checkpoint timeout: '+output));},10000);
      checkpointPending={resolve,reject,timer};
    }),
    resume:()=>child.send({op:'resume'}),
    kill:async()=>{assert.ok(owned.has(child));child.kill('SIGKILL');await closed;},
    close:async function(){await this.call('close');await closed;},
  };
}
function assertState(db:DatabaseSync,f:ReturnType<typeof fixture>,owner:string|null) {
  const state=snapshot(db);
  assert.equal(state.characters.length,1);assert.equal(state.claims.length,1);
  assert.equal(state.characters[0].body,f.body);assert.equal(state.characters[0].owner,owner);
  assert.equal(state.claims[0].consumed_by,owner);
  assert.equal(state.claims[0].request_id,owner?'claim-1':null);
  assert.equal(state.claims[0].token_hash,digest('synthetic-claim'));
  assert.equal(state.receipts.length,owner ? 1 : 0);
  if(owner){
    assert.equal(state.receipts[0].account,owner);
    assert.equal(state.receipts[0].request_id,'claim-1');
    assert.equal(state.receipts[0].fingerprint,digest(JSON.stringify([owner,f.id,digest('synthetic-claim')])));
    assert.deepEqual(JSON.parse(state.receipts[0].result as string),{ok:true,character:f.id});
  }
  return state;
}
async function main() {
  assert.equal(process.argv.length,2,'This drill always creates its own temporary data');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'hf-transaction-drill-'));
  await fs.writeFile(path.join(root,'synthetic-only.txt'),'Synthetic transaction drill only.\n',{flag:'wx'});
  const results:unknown[]=[],payloads=CLASS_IDS.map(fixture);
  const metadata=new DatabaseSync(':memory:');
  const sqliteVersion=metadata.prepare('SELECT sqlite_version() AS v').get()!.v;metadata.close();
  let passed=false,failure:string|undefined;
  try {
    for(const f of payloads)for(const point of ['after-character','before-commit','after-commit']) {
      const directory=path.join(root,f.id+'-'+point);await fs.mkdir(directory);
      let db=open(directory);seed(db,f);const original=assertState(db,f,null);
      const preBackup=path.join(directory,'before.db');await backup(db,preBackup);db.close();
      const args={account:'account-a',character:f.id,token:'synthetic-claim',request:'claim-1'};
      const first=await start(directory,root),checkpoint=first.checkpoint();
      const pending=first.call('claim',{...args,pause:point}).then(()=>false,()=>true);
      assert.equal(await checkpoint,point);await first.kill();assert.equal(await pending,true);
      const filesAfterCrash=await fs.readdir(directory);assert.ok(filesAfterCrash.includes('candidate.db-wal'));
      db=open(directory);assertState(db,f,point==='after-commit'?'account-a':null);db.close();
      const retry=await start(directory,root);
      assert.deepEqual(await retry.call('claim',args),{ok:true,character:f.id});
      assert.deepEqual(await retry.call('claim',args),{ok:true,character:f.id});
      assert.deepEqual(await retry.call('claim',{...args,token:'different synthetic intent'}),{ok:false,reason:'changed intent'});
      assert.deepEqual(await retry.call('claim',{...args,account:'account-b'}),{ok:false,reason:'unavailable claim'});
      await retry.close();db=open(directory);const final=assertState(db,f,'account-a');
      const finalBackup=path.join(directory,'after.db'),pages=await backup(db,finalBackup);db.close();
      const restored=new DatabaseSync(finalBackup,{readOnly:true});assert.deepEqual(snapshot(restored),final);restored.close();
      const old=new DatabaseSync(preBackup,{readOnly:true});assert.deepEqual(snapshot(old),original);old.close();
      results.push({character:f.id,point,payloadBytes:f.bytes,itemCount:f.itemCount,recoveredOwner:point==='after-commit'?'account-a':null,
        retryExactlyOnce:true,changedIntentRejected:true,crossAccountRejected:true,walPresentAfterCrash:true,bodySha256:f.sha256,
        restoredAllTables:true,oldBackupRestoresUnconsumedClaim:true,backupPages:pages});
      console.log(`${f.id}/${point}: reopen, retry and combined backup passed`);
    }
    const f=payloads[0],directory=path.join(root,'competing-writers');await fs.mkdir(directory);
    let db=open(directory);seed(db,f);db.close();
    const a=await start(directory,root),b=await start(directory,root),checkpoint=a.checkpoint();
    const args={account:'account-a',character:f.id,token:'synthetic-claim',request:'claim-1'};
    const committed=a.call('claim',{...args,pause:'before-commit'}).then(result=>({result}),error=>({error}));assert.equal(await checkpoint,'before-commit');
    assert.deepEqual(await b.call('claim',{...args,account:'account-b'}),{ok:false,reason:'busy'});
    a.resume();assert.deepEqual(await committed,{result:{ok:true,character:f.id}});
    assert.deepEqual(await b.call('claim',{...args,account:'account-b'}),{ok:false,reason:'unavailable claim'});
    await a.close();await b.close();db=open(directory);assertState(db,f,'account-a');db.close();
    results.push({case:'competing-writers',busyWhileOpen:true,consumedAfterCommit:true,owners:1,receipts:1,bodySha256:f.sha256});
    passed=true;
  } catch(error){failure=String((error as Error).stack??error);process.exitCode=1;}
  finally {
    for(const child of [...owned]) {const done=new Promise<void>(resolve=>child.once('close',()=>resolve()));child.kill('SIGKILL');await done;}
    const report={date:new Date().toISOString(),node:process.version,platform:process.platform,sqliteVersion,root,passed,failure,
      settings:{journal:'wal',synchronous:2,foreignKeys:true,busyTimeout:0},
      fixtures:payloads.map(({body,...rest})=>rest),results,
      scope:'Synthetic candidate transaction code in owned child processes; no production imports/login/storage migration. Forced process termination, not disk/power/OS failure or throughput/load test.'};
    await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(`Transaction evidence: ${root}; ${passed?'passed':failure}`);
  }
}
if(process.argv[2]==='--child')await childMain();else await main();
