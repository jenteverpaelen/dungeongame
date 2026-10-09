import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { format } from 'node:util';
import { createCharacter } from '../../shared/src/character';
import { SAVE_VERSION } from '../../shared/src/saveVersion';
import type { CharacterSave } from '../../shared/src/types';
import type { Session } from '../src/net/session';
import type { World } from '../src/world';
import { runCommand } from '../src/commands';
import { DATA_DIR } from '../src/config';
import { CorruptCharacterError, UnsupportedSaveVersionError, ensureDataDir, loadCharacter, normalizeSave, saveCharacter, flushSaves } from '../src/persistence';
import { JsonCharacterStore } from '../src/storage/jsonCharacterStore';

assert.ok(process.env.DATA_DIR, 'Foundation tests require an explicit isolated DATA_DIR');
ensureDataDir();
const fixture = async (name: string): Promise<CharacterSave> => JSON.parse(await fs.readFile(new URL(`./fixtures/saves/${name}.json`, import.meta.url), 'utf8'));
const items = (save: CharacterSave) => structuredClone([save.equipment, save.inventory, save.stash]);

test('debug requires exact opt-in and explicit disable overrides it, including repeated/spoofed requests', () => {
  const previous = { enable: process.env.ENABLE_DEBUG, disable: process.env.DISABLE_DEBUG };
  const save = createCharacter('DebugFixture', 'warrior', 1);
  const s = { save, changed() {} } as unknown as Session;
  try {
    for (const [enable, disable] of [[undefined, undefined], ['0', '0'], ['true', '0'], ['1', '1']]) {
      if (enable === undefined) delete process.env.ENABLE_DEBUG; else process.env.ENABLE_DEBUG = enable;
      if (disable === undefined) delete process.env.DISABLE_DEBUG; else process.env.DISABLE_DEBUG = disable;
      const before = structuredClone(save);
      for (let i = 0; i < 3; i++) {
        const r = runCommand(s, {} as World, 'debug', { op: 'gold', n: 100, ENABLE_DEBUG: '1', admin: true });
        assert.equal(r.ok, false); assert.match(r.err!, /disabled/); assert.deepEqual(save, before);
      }
    }
    process.env.ENABLE_DEBUG = '1'; process.env.DISABLE_DEBUG = '0';
    assert.equal(runCommand(s, {} as World, 'debug', { op: 'gold', n: 100 }).ok, true);
    assert.equal(save.gold, 100);
  } finally {
    if (previous.enable === undefined) delete process.env.ENABLE_DEBUG; else process.env.ENABLE_DEBUG = previous.enable;
    if (previous.disable === undefined) delete process.env.DISABLE_DEBUG; else process.env.DISABLE_DEBUG = previous.disable;
  }
});

test('legacy/current fixtures retain owned items, overflow slots, progression and extension fields', async () => {
  for (const name of ['v0-unversioned', 'v1-current', 'v2-protected', 'v3-autocast', 'v4-target-priority', 'v5-auto-rules', 'v6-quest-history', 'v7-onboarding']) {
    const original = await fixture(name), beforeItems = items(original);
    const migrated = normalizeSave(structuredClone(original));
    assert.equal(migrated.version, SAVE_VERSION);
    assert.deepEqual(migrated.onboarding,original.onboarding);assert.deepEqual(migrated.appearance,original.appearance);
    assert.deepEqual(items(migrated), beforeItems);
    for (const key of ['id','name','classId','level','xp','gold','materials','gems','skillPoints','paragon','cube','stats','fixtureExtension'] as const)
      assert.deepEqual((migrated as any)[key], (original as any)[key], key);
    assert.equal(migrated.skills.runes.meteor, 'comet'); assert.equal(migrated.skills.tiers.meteor, 2);
    assert.deepEqual(migrated.skills.autoCast, original.skills.autoCast ?? ['auto','auto','auto','auto']);
    assert.equal(migrated.skills.targetPriority, original.skills.targetPriority ?? 'default');
    assert.deepEqual(migrated.skills.autoRules, original.skills.autoRules ?? [null,null,null,null]);
    assert.deepEqual(normalizeSave(structuredClone(migrated)), migrated, 'migration is idempotent');
    await saveCharacter(migrated); await flushSaves();
    const loaded = await loadCharacter(migrated.id);
    assert.deepEqual(loaded, migrated, 'save/reload preserves normalized state');
    assert.deepEqual(loaded!.quests, original.quests, 'quest history and unknown future records are retained');
    assert.deepEqual(items(loaded!), beforeItems);
  }
});

test('older sparse saves get missing stash/defaults without losing equipment or legacy fields', () => {
  const sparse = { id:'sparse', name:'Sparse', classId:'warrior', level:1, inventory:[null], lastSeen:1700000000000 } as CharacterSave;
  const migrated = normalizeSave(sparse);
  assert.equal(migrated.version, SAVE_VERSION); assert.equal(migrated.inventory.length,60); assert.equal(migrated.stash.length,60);
  assert.equal(migrated.skills.primary,'cleave'); assert.equal(migrated.cube.level,1);
});

test('future saves cannot load, normalize or save and are never quarantined or overwritten', async () => {
  const future = { ...await fixture('v1-current'), id:'futurefixture', version:SAVE_VERSION+1 };
  const original = JSON.stringify(future); const file = path.join(DATA_DIR, future.id+'.json');
  await fs.writeFile(file, original);
  await assert.rejects(loadCharacter(future.id), UnsupportedSaveVersionError);
  assert.throws(() => normalizeSave(future), UnsupportedSaveVersionError);
  assert.throws(() => saveCharacter(future), UnsupportedSaveVersionError);
  await flushSaves(); assert.equal(await fs.readFile(file,'utf8'), original);
  assert.deepEqual((await fs.readdir(DATA_DIR)).filter(f=>f.startsWith('futurefixture')), ['futurefixture.json']);
});

test('malformed version is quarantined as corrupt; new characters use the current version', async () => {
  const bad = { ...await fixture('v1-current'), id:'badversion', version:'1' };
  await fs.writeFile(path.join(DATA_DIR,'badversion.json'),JSON.stringify(bad));
  await assert.rejects(loadCharacter('badversion'), CorruptCharacterError);
  assert.equal((await fs.readdir(DATA_DIR)).filter(f=>f.startsWith('badversion.json.corrupt-')).length,1);
  assert.equal(createCharacter('NewVersion','ranger',3).version,SAVE_VERSION);
});

test('future schema with an unfamiliar class or renamed fields is preserved before legacy validation', async () => {
  const file = path.join(DATA_DIR, 'futureformat.json');
  const original = JSON.stringify({ version: SAVE_VERSION + 1, displayName: 'FutureFormat', classId: 'future-class' });
  await fs.writeFile(file, original);
  await assert.rejects(loadCharacter('futureformat'), UnsupportedSaveVersionError);
  assert.equal(await fs.readFile(file, 'utf8'), original);
  assert.deepEqual((await fs.readdir(DATA_DIR)).filter(f => f.startsWith('futureformat')), ['futureformat.json']);
});

test('save loading rejects inherited/coerced class values and preserves their original bytes', async t => {
  t.mock.method(console,'error',()=>{});
  const invalid:unknown[]=['constructor','toString','__proto__','hasOwnProperty',['mage'],[['warrior']],[],{},null,17,true,'paladin'];
  for(let i=0;i<invalid.length;i++){
    const id=`classboundary${i}`,file=path.join(DATA_DIR,id+'.json');
    const original=JSON.stringify({...await fixture('v1-current'),id,classId:invalid[i]});
    await fs.writeFile(file,original);
    await assert.rejects(loadCharacter(id),CorruptCharacterError);
    const names=(await fs.readdir(DATA_DIR)).filter(name=>name.startsWith(id+'.json'));
    assert.equal(names.length,1);assert.ok(names[0].startsWith(id+'.json.corrupt-'));
    assert.equal(await fs.readFile(path.join(DATA_DIR,names[0]),'utf8'),original);
  }
  const id='futureclsbound',file=path.join(DATA_DIR,id+'.json');
  const original=JSON.stringify({version:SAVE_VERSION+1,classId:['mage']});
  await fs.writeFile(file,original);
  await assert.rejects(loadCharacter(id),UnsupportedSaveVersionError);
  assert.equal(await fs.readFile(file,'utf8'),original);
  assert.deepEqual((await fs.readdir(DATA_DIR)).filter(name=>name.startsWith(id)),[id+'.json']);
});

test('corrupt-save diagnostics exclude input excerpts while quarantine preserves exact bytes', async t => {
  const lines: string[] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => lines.push(format(...args)));
  for (const [id, text, category] of [
    ['privateparse', 'SYNTH_X', 'invalid JSON'],
    ['privatemulti', 'SYNTH_Y\nSYNTH_Z', 'invalid JSON'],
    ['privateobject', JSON.stringify({ name:'SYNTH_NAME', classId:'SYNTH_CLASS' }), 'invalid character data'],
  ]) {
    await fs.writeFile(path.join(DATA_DIR,id+'.json'),text);
    const before=lines.length;
    await assert.rejects(loadCharacter(id),CorruptCharacterError);
    assert.equal(lines.length,before+1);
    assert.ok(lines.at(-1)!.includes(`is corrupt (${category}); moved to ${id}.json.corrupt-`));
    assert.ok(!lines.at(-1)!.includes('SYNTH_'));
    const matches=(await fs.readdir(DATA_DIR)).filter(f=>f.startsWith(id));
    assert.equal(matches.length,1);
    assert.ok(matches[0].startsWith(id+'.json.corrupt-'));
    assert.equal(await fs.readFile(path.join(DATA_DIR,matches[0]),'utf8'),text);
  }
});

test('quarantine failure diagnostics retain safe codes but exclude arbitrary error details', async t => {
  const lines: string[] = [];
  t.mock.method(console,'error',(...args: unknown[])=>lines.push(format(...args)));
  for (const [id,code,expected] of [['qprivateknown','EPERM','EPERM'],['qprivateunknown','SYNTH_CODE','unclassified I/O failure']]) {
    const text='SYNTH_SOURCE';
    const mocked=t.mock.method(JsonCharacterStore.prototype,'quarantine',async()=> {
      throw Object.assign(new Error('SYNTH_MESSAGE'),{code,path:'SYNTH_PATH',syscall:'SYNTH_CALL'});
    });
    try {
      await fs.writeFile(path.join(DATA_DIR,id+'.json'),text);
      await assert.rejects(loadCharacter(id),CorruptCharacterError);
      assert.equal(await fs.readFile(path.join(DATA_DIR,id+'.json'),'utf8'),text);
      assert.equal(lines.at(-1),`[persist] ${id}.json is corrupt (invalid JSON); could not quarantine (${expected})`);
      assert.ok(!lines.at(-1)!.includes('SYNTH_'));
    } finally {mocked.mock.restore();}
  }
});
