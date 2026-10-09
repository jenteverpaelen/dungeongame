// Synthetic local candidate measurements, never imports the production DATA_DIR.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { argon2, scrypt, randomBytes } from 'node:crypto';

const filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(filename), '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const round = n => Math.round(n * 1000) / 1000;
function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { n: sorted.length, meanMs: round(sorted.reduce((a,b)=>a+b,0)/sorted.length),
    p50Ms: round(sorted[Math.ceil(sorted.length*.5)-1]),
    p95Ms: round(sorted[Math.ceil(sorted.length*.95)-1]), maxMs: round(sorted.at(-1)) };
}
async function observe(action) {
  const histogram = monitorEventLoopDelay({ resolution: 1 });
  histogram.enable();
  await pause(25);
  histogram.reset();
  const baselineRss = process.memoryUsage().rss;
  let sampledPeakRss = baselineRss;
  const sampler = setInterval(() => { sampledPeakRss = Math.max(sampledPeakRss, process.memoryUsage().rss); }, 5);
  const started = performance.now();
  try {
    const result = await action();
    const elapsedMs = round(performance.now() - started);
    sampledPeakRss = Math.max(sampledPeakRss, process.memoryUsage().rss);
    await pause(10); // Give the monitor a turn after synchronous work.
    return { ...result, elapsedMs, loopDelayMs: { samples:histogram.count,
      p95:round(histogram.percentile(95)/1e6), max:round(histogram.max/1e6) },
      baselineRssBytes:baselineRss, sampledPeakRssBytes:sampledPeakRss };
  } finally { clearInterval(sampler); histogram.disable(); }
}
const hashOptions = {
  'argon19': { algorithm:'argon2id', memory:19456, passes:2, parallelism:1, tagLength:32 },
  'argon46': { algorithm:'argon2id', memory:47104, passes:1, parallelism:1, tagLength:32 },
  'scrypt128': { algorithm:'scrypt', N:131072, r:8, p:1, maxmem:256*1024*1024, tagLength:32 },
};
function hashOnce(options) {
  const nonce = randomBytes(16);
  const message = 'synthetic benchmark input only';
  return new Promise((resolve, reject) => {
    const done = (error, value) => error ? reject(error) : resolve(value);
    if(options.algorithm === 'argon2id') {
      const { algorithm, ...params } = options;
      argon2(algorithm, { ...params, message, nonce }, done);
    } else {
      const { N,r,p,maxmem,tagLength } = options;
      scrypt(message, nonce, tagLength, { N,r,p,maxmem }, done);
    }
  });
}
async function hashCase(name, concurrency) {
  const params = hashOptions[name];
  await hashOnce(params); // Explicit warmup; excluded from timing, affects baseline RSS.
  return observe(async () => {
    const durations=[];
    for(let batch=0; batch<24/concurrency; batch++) {
      await Promise.all(Array.from({length:concurrency}, async () => {
        const started=performance.now();
        const output=await hashOnce(params);
        assert.equal(output.length,32);
        durations.push(performance.now()-started);
        output.fill(0);
      }));
    }
    return { params, concurrency, warmupOperations:1, latency:stats(durations) };
  });
}
async function openDatabase(dataDir) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path.join(dataDir,'candidate.db'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE saves(id TEXT PRIMARY KEY, body TEXT NOT NULL)');
  return db;
}
function sqlApi(db) {
  const put=db.prepare('INSERT INTO saves(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body');
  return {
    write(rows) {
      const times=[];
      for(const row of rows) {
        const start=performance.now();
        // SQLite auto-commits this individual statement/transaction.
        put.run(row.id,row.body);
        times.push(performance.now()-start);
      }
      return times;
    },
    async check(rows,dataDir) {
      const { DatabaseSync, backup }=await import('node:sqlite');
      const get=db.prepare('SELECT body FROM saves WHERE id=?');
      for(const row of rows) assert.equal(get.get(row.id).body,row.body);
      db.exec('BEGIN IMMEDIATE');
      put.run(rows[0].id,'synthetic uncommitted value');
      db.exec('ROLLBACK');
      assert.equal(get.get(rows[0].id).body,rows[0].body);
      const backupPath=path.join(dataDir,'backup.db'); // Fresh case directory; no overwrite.
      const before=performance.now();
      const backupPages=await backup(db,backupPath);
      const backupMs=round(performance.now()-before);
      const restored=new DatabaseSync(backupPath,{readOnly:true});
      try {
        assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
        assert.equal(restored.prepare('SELECT count(*) AS n FROM saves').get().n,rows.length);
        const restoredGet=restored.prepare('SELECT body FROM saves WHERE id=?');
        for(const row of rows) assert.equal(restoredGet.get(row.id).body,row.body);
      } finally { restored.close(); }
      return {sqliteVersion:db.prepare('SELECT sqlite_version() AS v').get().v,
        journalMode:db.prepare('PRAGMA journal_mode').get().journal_mode,
        synchronous:db.prepare('PRAGMA synchronous').get().synchronous,
        readBackRows:rows.length,rollbackVerified:true,restoredRows:rows.length,backupPages,backupMs};
    },
  };
}
async function sqliteWorker() {
  const db=await openDatabase(workerData.dataDir), api=sqlApi(db);
  // Sequential requests from the parent; exactly one connection owns this file.
  parentPort.on('message',async ({id,op,rows}) => {
    try {
      if(op==='write') parentPort.postMessage({id,result:api.write(rows)});
      else if(op==='check') parentPort.postMessage({id,result:await api.check(rows,workerData.dataDir)});
      else if(op==='close') {db.close(); parentPort.postMessage({id,result:true}); parentPort.close();}
      else throw new Error('Unknown worker request');
    } catch(error) {parentPort.postMessage({id,error:error.stack});}
  });
  parentPort.postMessage({id:0,result:true});
}
async function connectWorker(dataDir) {
  const worker=new Worker(new URL(import.meta.url),{workerData:{dataDir}});
  let next=1;
  const pending=new Map();
  const ready=new Promise((resolve,reject)=>pending.set(0,{resolve,reject}));
  worker.on('message',({id,result,error}) => {
    const p=pending.get(id); pending.delete(id);
    if(p) error ? p.reject(new Error(error)) : p.resolve(result);
  });
  worker.on('error',error=>{for(const p of pending.values())p.reject(error);pending.clear();});
  worker.on('exit',code=>{for(const p of pending.values())p.reject(new Error(`Worker exited ${code}`));pending.clear();});
  await ready;
  const request=(op,rows)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});worker.postMessage({id,op,rows});});
  return {request,worker};
}
async function storageCase(kind,dataDir) {
  const fixture=JSON.parse(await fs.readFile(path.join(root,'server/test/fixtures/saves/v1-current.json'),'utf8'));
  const rows=Array.from({length:100},(_,i)=>({id:`bench${i}`,body:JSON.stringify({...fixture,id:`bench${i}`,name:`Bench${i}`})}));
  const db=kind==='sqlite-main' ? await openDatabase(dataDir) : undefined;
  const api=db ? sqlApi(db) : undefined;
  const remote=kind==='sqlite-worker' ? await connectWorker(dataDir) : undefined;
  try {
    const result=await observe(async()=>{
      const durations=[],burstDurations=[];
      for(let cycle=0;cycle<5;cycle++) {
        // Change a persisted field every round, otherwise SQLite could elide work.
        for(const row of rows) {const save=JSON.parse(row.body);save.gold=cycle;row.body=JSON.stringify(save);}
        const start=performance.now();
        if(api) durations.push(...api.write(rows));
        else if(remote) durations.push(...await remote.request('write',rows));
        else await Promise.all(rows.map(async row=>{
          const start=performance.now(),file=path.join(dataDir,row.id+'.json'),temp=file+'.tmp';
          await fs.writeFile(temp,row.body,{flush:kind==='json-flush'});
          await fs.rename(temp,file);
          durations.push(performance.now()-start);
        }));
        burstDurations.push(performance.now()-start);
        await pause(0);
      }
      const sizes=rows.map(r=>Buffer.byteLength(r.body));
      return {kind,characters:100,rounds:5,payloadBytes:{min:Math.min(...sizes),max:Math.max(...sizes),mean:round(sizes.reduce((a,b)=>a+b,0)/sizes.length)},
        latency:stats(durations),burstLatency:stats(burstDurations),
        latencyScope:api||remote?'SQLite statement execution/commit; queue/IPC excluded':'Async write+rename completion from submission; includes I/O queue'};
    });
    if(api) result.validation=await api.check(rows,dataDir);
    else if(remote) result.validation=await remote.request('check',rows);
    else {
      for(const row of rows) assert.equal(await fs.readFile(path.join(dataDir,row.id+'.json'),'utf8'),row.body);
      result.validation={readBackRows:rows.length};
    }
    return result;
  } finally {
    db?.close();
    if(remote) {await remote.request('close');await remote.worker.terminate();}
  }
}
async function childCase() {
  const dataDir=process.env.DATA_DIR;
  assert.ok(dataDir,'A fresh isolated DATA_DIR is required');
  const [category,name,concurrency]=process.argv.slice(3);
  const result=category==='hash' ? await hashCase(name,Number(concurrency)) : await storageCase(name,dataDir);
  console.log(JSON.stringify({category,name,...result}));
}
async function main() {
  assert.equal(process.argv.length,2,'No options; the harness always creates fresh temporary cases');
  const runDir=await fs.mkdtemp(path.join(os.tmpdir(),'hf-foundation-bench-'));
  const cases=[...Object.keys(hashOptions).flatMap(name=>[1,4].map(n=>['hash',name,String(n)])),
    ...['json-atomic','json-flush','sqlite-main','sqlite-worker'].map(name=>['storage',name])];
  const results=[];
  for(const spec of cases) {
    const name=spec.join('-'),dataDir=path.join(runDir,name);
    await fs.mkdir(dataDir);
    let out='',err='';
    const code=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[filename,'--case',...spec],{cwd:root,windowsHide:true,
        env:{...process.env,DATA_DIR:dataDir,UV_THREADPOOL_SIZE:'4'},stdio:['ignore','pipe','pipe']});
      child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>err+=chunk);
      child.once('error',reject);child.once('close',resolve);
    });
    await fs.writeFile(path.join(runDir,name+'.log'),out+err);
    assert.equal(code,0,`${name}: ${err}`);
    const result=JSON.parse(out.trim());
    results.push({...result,dataDir});
    console.log(`${name}: ${result.elapsedMs} ms; loop max ${result.loopDelayMs.max} ms`);
  }
  const report={date:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,
    cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem(),runDir,
    uvThreadpoolSize:4,syntheticOnly:true,results,
    limits:['Not actual 100-player server load','Warm filesystem/cache and desktop contention not controlled',
      'RSS sampling may miss peaks; warmup affects baseline','No power loss, forced process death or multi-process contention test',
      'No production storage or credential change; no real saves read']};
  await fs.writeFile(path.join(runDir,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Evidence: ${runDir}`);
}
if(!isMainThread) await sqliteWorker();
else if(process.argv[2]==='--case') await childCase();
else await main();
