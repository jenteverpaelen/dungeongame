import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { Packr } from 'msgpackr';
import { MAX_MESSAGE_BYTES, MAX_MESSAGES_PER_SECOND, PROTOCOL_VERSION } from '../../shared/src/protocol';

const root = fileURLToPath(new URL('../../', import.meta.url));
async function until(predicate: () => boolean) {
  const deadline = Date.now() + 6000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Connection drill timed out');
    await new Promise(resolve => setTimeout(resolve, 15));
  }
}
async function start(origins?: string) {
  assert.ok(process.env.DATA_DIR, 'Connection drill requires isolated DATA_DIR');
  const runDir = await fs.mkdtemp(path.join(process.env.DATA_DIR, 'connection-'));
  const reservation = net.createServer();
  await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = (reservation.address() as net.AddressInfo).port;
  await new Promise<void>((resolve, reject) => reservation.close(err => err ? reject(err) : resolve()));
  const env: NodeJS.ProcessEnv = { ...process.env, DATA_DIR: path.join(runDir, 'saves'), BACKUP_DIR: '', PORT: String(port), ENABLE_DEBUG: '0' };
  delete env.WS_ALLOWED_ORIGINS;
  if (origins !== undefined) env.WS_ALLOWED_ORIGINS = origins;
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/main.ts'], {
    cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let log = '', error: Error | undefined;
  child.on('error', err => { error = err; });
  child.stdout!.on('data', data => { log += data; });
  child.stderr!.on('data', data => { log += data; });
  const closed = new Promise<number | null>(resolve => child.once('close', resolve));
  return { port, runDir, log: () => log, async ready() {
    await until(() => {
      if (error) throw error;
      if (child.exitCode !== null) throw Error(log);
      return log.includes('listening on');
    });
  }, async stop() {
    if (child.exitCode === null && child.signalCode === null && child.connected) child.send('hearthfall:shutdown');
    const fallback = setTimeout(() => child.kill('SIGKILL'), 9000);
    try { return await closed; }
    finally { clearTimeout(fallback); await fs.writeFile(path.join(runDir, 'server.log'), log); }
  } };
}

function upgrade(port: number, origin?: string | string[], extra: http.OutgoingHttpHeaders = {}, requestPath = '/ws') {
  return new Promise<number>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: requestPath, headers: {
      Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', ...(origin === undefined ? {} : { Origin: origin }), ...extra,
    } });
    req.setTimeout(3000, () => req.destroy(Error('Upgrade timed out')));
    req.on('error', reject);
    req.on('response', res => { res.resume(); resolve(res.statusCode!); });
    req.on('upgrade', (res, socket) => { socket.destroy(); resolve(res.statusCode!); });
    req.end();
  });
}

test('real upgrade denies foreign/missing/opaque/duplicate origins and preserves known local browser origins', { timeout: 20000 }, async () => {
  const server = await start();
  const observations: Record<string, number> = {};
  try {
    await server.ready();
    const local = `http://127.0.0.1:${server.port}`;
    const cases: [string, string | string[] | undefined, number][] = [
      ['foreign', 'https://untrusted.example', 403], ['missing', undefined, 403], ['opaque', 'null', 403],
      ['local', local, 101], ['localhost', `http://localhost:${server.port}`, 101], ['vite', 'http://localhost:5173', 101],
      ['suffix', `${local}.untrusted.example`, 403], ['path', `${local}/`, 403],
      ['duplicate', [local, local], 403], ['mixed-duplicate', [local, 'https://untrusted.example'], 403],
      ['list', `${local} https://untrusted.example`, 403],
    ];
    for (const [name, origin, expected] of cases) {
      observations[name] = await upgrade(server.port, origin);
      assert.equal(observations[name], expected, name);
    }
    observations.forgedHost = await upgrade(server.port, 'https://untrusted.example', {
      Host: 'untrusted.example', 'X-Forwarded-Host': 'untrusted.example', 'X-Forwarded-Proto': 'https',
    });
    assert.equal(observations.forgedHost, 403);
    observations.wrongPath = await upgrade(server.port, local, {}, '/elsewhere');
    assert.equal(observations.wrongPath, 404);
    assert.equal((await fetch(`http://127.0.0.1:${server.port}/healthz`)).status, 200);
  } finally {
    const exitCode = await server.stop();
    await fs.writeFile(path.join(server.runDir, 'observations.json'), JSON.stringify({ observations, exitCode }, null, 2));
    assert.equal(exitCode, 0);
  }
});

test('explicit origin list replaces local defaults without wildcard or suffix acceptance', { timeout: 15000 }, async () => {
  const server = await start('https://play.example,https://stage.example:8443');
  try {
    await server.ready();
    assert.equal(await upgrade(server.port, 'https://play.example'), 101);
    assert.equal(await upgrade(server.port, 'https://stage.example:8443'), 101);
    assert.equal(await upgrade(server.port, `http://127.0.0.1:${server.port}`), 403);
    assert.equal(await upgrade(server.port, 'https://play.example.untrusted.example'), 403);
    assert.equal(await upgrade(server.port, 'http://play.example'), 403);
  } finally { assert.equal(await server.stop(), 0); }
});

test('real session log uses socket peer instead of forged forwarding attribution', { timeout: 15000 }, async () => {
  const server = await start();
  let ws: WebSocket | undefined;
  try {
    await server.ready();
    ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, {
      origin: `http://127.0.0.1:${server.port}`, headers: { 'X-Forwarded-For': '203.0.113.77, 198.51.100.9' },
    });
    await new Promise<void>((resolve, reject) => { ws!.once('open', resolve); ws!.once('error', reject); });
    const codec = new Packr({ useRecords: false });
    let welcomed = false;
    ws.on('message', data => { if (codec.unpack(Buffer.from(data as Buffer)).t === 'welcome') welcomed = true; });
    ws.send(codec.pack({ t: 'hello', name: 'PeerTrace', classId: 'mage', v: PROTOCOL_VERSION }));
    await until(() => welcomed && server.log().includes('logged in'));
    assert.match(server.log(), /from (?:::ffff:)?127\.0\.0\.1(?:\r?\n|$)/);
    assert.doesNotMatch(server.log(), /203\.0\.113\.77|198\.51\.100\.9/);
  } finally { ws?.terminate(); assert.equal(await server.stop(), 0); }
});

test('invalid allowlist prevents listening and data initialization', { timeout: 15000 }, async () => {
  const server = await start('https://*.example');
  try {
    await assert.rejects(server.ready(), /WS_ALLOWED_ORIGINS/);
    await assert.rejects(fs.access(path.join(server.runDir, 'saves')), { code: 'ENOENT' });
  } finally { assert.equal(await server.stop(), 1); }
});

test('real hello rejects inherited and coerced class keys before creating saves or reserving names', { timeout: 30000 }, async () => {
  const server=await start(), codec=new Packr({useRecords:false});
  const observations:unknown[]=[];
  let ws:WebSocket|undefined;
  try {
    await server.ready();
    const bad:unknown[]=['constructor','toString','__proto__','hasOwnProperty',['mage'],[['warrior']],[],{},null,17,true,'paladin'];
    for(let index=0;index<bad.length;index++) {
      const classId=bad[index],name=`Boundary${index}`,startLog=server.log().length;
      ws=new WebSocket(`ws://127.0.0.1:${server.port}/ws`,{origin:`http://127.0.0.1:${server.port}`});
      const messages:any[]=[];let closed=false;
      ws.on('message',data=>messages.push(codec.unpack(data as Buffer)));
      ws.on('close',()=>{closed=true;});
      await new Promise<void>((resolve,reject)=>{ws!.once('open',resolve);ws!.once('error',reject);});
      ws.send(codec.pack({t:'hello',name,classId,v:PROTOCOL_VERSION}));
      await until(()=>closed || messages.some(m=>m.t==='welcome') || server.log().slice(startLog).includes('unhandled rejection'));
      // Probe reuse while the malformed attempt still owns its socket, if it stayed open.
      const next=new WebSocket(`ws://127.0.0.1:${server.port}/ws`,{origin:`http://127.0.0.1:${server.port}`});
      const replies:any[]=[];
      try {
        next.on('message',data=>replies.push(codec.unpack(data as Buffer)));
        await new Promise<void>((resolve,reject)=>{next.once('open',resolve);next.once('error',reject);});
        const savedBeforeReuse=(await fs.readdir(path.join(server.runDir,'saves'))).includes(`${name.toLowerCase()}.json`);
        next.send(codec.pack({t:'hello',name,classId:['warrior','ranger','mage'][index%3],v:PROTOCOL_VERSION}));
        await until(()=>replies.some(m=>m.t==='welcome'||m.t==='err'));
        observations.push({index,classId,rejected:closed&&messages.some(m=>m.t==='err'&&m.msg==='Unknown class.'),
          malformedWelcome:messages.some(m=>m.t==='welcome'),savedBeforeReuse,reused:replies.some(m=>m.t==='welcome')});
      } finally {next.terminate();}
      ws.terminate();ws=undefined;
    }
    assert.equal((await fetch(`http://127.0.0.1:${server.port}/healthz`)).status,200);
    assert.deepEqual(observations,bad.map((classId,index)=>({index,classId,rejected:true,malformedWelcome:false,savedBeforeReuse:false,reused:true})));
    assert.doesNotMatch(server.log(),/unhandled rejection|uncaughtException/);
  } finally {
    ws?.terminate();const exitCode=await server.stop();
    await fs.writeFile(path.join(server.runDir,'message-observations.json'),JSON.stringify({observations,exitCode},null,2));
    assert.equal(exitCode,0);
  }
});

test('real socket closes sustained text flood and oversized whole/fragmented messages', {timeout:20000},async()=>{
  const server=await start(),observations:unknown[]=[];
  let ws:WebSocket|undefined;
  try {
    await server.ready();
    for(const kind of ['text-flood','oversize','fragmented']){
      ws=new WebSocket(`ws://127.0.0.1:${server.port}/ws`,{origin:`http://127.0.0.1:${server.port}`});
      let closed:{code:number;reason:string}|undefined;
      ws.on('close',(code,reason)=>{closed={code,reason:reason.toString()};});
      await new Promise<void>((resolve,reject)=>{ws!.once('open',resolve);ws!.once('error',reject);});
      if(kind==='text-flood')for(let i=0;i<MAX_MESSAGES_PER_SECOND+601;i++)ws.send('unsupported');
      else if(kind==='oversize')ws.send(Buffer.alloc(MAX_MESSAGE_BYTES+1));
      else {
        ws.send(Buffer.alloc(MAX_MESSAGE_BYTES/2),{fin:false});
        ws.send(Buffer.alloc(MAX_MESSAGE_BYTES/2+1),{fin:true});
      }
      await until(()=>!!closed);
      observations.push({kind,...closed});
      assert.equal(closed!.code,kind==='text-flood'?4000:1009);
      if(kind==='text-flood')assert.equal(closed!.reason,'Too many messages');
      ws=undefined;
    }
    assert.equal((await fetch(`http://127.0.0.1:${server.port}/healthz`)).status,200);
    assert.doesNotMatch(server.log(),/unhandled rejection|uncaughtException/);
    assert.deepEqual(await fs.readdir(path.join(server.runDir,'saves')),[]);
  }finally{
    ws?.terminate();const exitCode=await server.stop();
    await fs.writeFile(path.join(server.runDir,'message-size-observations.json'),JSON.stringify({observations,exitCode},null,2));
    assert.equal(exitCode,0);
  }
});
