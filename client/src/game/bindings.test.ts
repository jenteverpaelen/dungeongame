import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BindingStore, DEFAULT_BINDINGS, keyLabel } from './bindings';
import { Input } from './input';

test('adding map and journal preserves old custom M/J and assigns distinct free keys',()=>{
  const old={...DEFAULT_BINDINGS} as Record<string,readonly [string,string|null]>;
  delete old.journal;delete old.map;old.dash=['KeyJ',null];old.interact=['KeyM',null];
  const keys=new BindingStore({getItem:()=>JSON.stringify({version:1,values:old}),setItem(){}});
  for(const [action,pair] of Object.entries(old))assert.deepEqual(keys.get().values[action as keyof typeof DEFAULT_BINDINGS],pair);
  assert.equal(keys.action('KeyM'),'interact');assert.equal(keys.action('KeyJ'),'dash');
  assert.equal(keys.action(keys.get().values.journal[0]),'journal');assert.equal(keys.action(keys.get().values.map[0]),'map');
});

test('adding the journal retains every old custom binding even when J was already assigned',()=>{
  const old={...DEFAULT_BINDINGS} as Record<string,readonly [string,string|null]>;
  delete old.journal;old.dash=['KeyJ',null];
  const keys=new BindingStore({getItem:()=>JSON.stringify({version:1,values:old}),setItem(){}});
  for(const [action,pair] of Object.entries(old))assert.deepEqual(keys.get().values[action as keyof typeof DEFAULT_BINDINGS],pair);
  assert.equal(keys.action('KeyJ'),'dash');assert.notEqual(keys.get().values.journal[0],'KeyJ');
  assert.equal(keys.action(keys.get().values.journal[0]),'journal');
});

function storage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
test('custom keys and alternates persist; reset restores every original action without changing other storage', () => {
  const disk = storage(); disk.data.set('hearthfall.preferences.v1', 'untouched');
  const keys = new BindingStore(disk);
  assert.equal(keys.assign('dash', 0, 'KeyY', 'y'), null);
  assert.equal(keys.assign('inventory', 1, null), null);
  assert.equal(keys.assign('interact', 1, 'KeyB', 'b'), null);
  const reloaded = new BindingStore(disk);
  assert.equal(reloaded.action('Space'), undefined); assert.equal(reloaded.action('KeyY'), 'dash');
  assert.equal(reloaded.action('KeyB'), 'interact'); assert.equal(reloaded.label('dash'), 'Y');
  reloaded.reset(); assert.deepEqual(new BindingStore(disk).get().values, DEFAULT_BINDINGS);
  assert.equal(disk.data.get('hearthfall.preferences.v1'), 'untouched');
});
test('conflicts and reserved keys cannot silently unbind actions or overwrite stored mappings', () => {
  const disk = storage(), keys = new BindingStore(disk), before = keys.get().values;
  assert.match(keys.assign('dash', 0, 'KeyW')!, /Move up/);
  assert.match(keys.assign('inventory', 0, 'KeyB')!, /Inventory/);
  assert.match(keys.assign('dash', 0, null)!, /primary key/);
  for (const key of ['Escape', 'Enter', 'Tab', 'F1', 'F5', 'F11', 'ControlLeft', 'ShiftRight', 'Unidentified', '__proto__']) {
    assert.ok(keys.assign('dash', 0, key));
  }
  assert.equal(keys.get().values, before); assert.equal(disk.data.size, 0);
});
test('malformed, future, incomplete and conflicting records fall back as a whole', () => {
  const duplicate = { ...DEFAULT_BINDINGS, dash: ['KeyW', null] };
  const invalid = { ...DEFAULT_BINDINGS, dash: ['F1', null] };
  for (const raw of ['{', 'null', '[]', JSON.stringify({ version: 2, values: DEFAULT_BINDINGS }),
    ...[{}, duplicate, invalid].map(values => JSON.stringify({ version: 1, values }))]) {
    assert.deepEqual(new BindingStore({ getItem: () => raw, setItem() {} }).get().values, DEFAULT_BINDINGS);
  }
  const keys = new BindingStore({ getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } });
  assert.equal(keys.get().retained, false); assert.equal(keys.assign('dash', 0, 'KeyY'), null);
  assert.equal(keys.action('KeyY'), 'dash'); assert.equal(keys.get().retained, false);
});
test('layout labels do not change physical actions; captured characters and numpad identity survive', () => {
  const disk = storage(), keys = new BindingStore(disk);
  keys.applyLayout(new Map([['KeyW', 'z'], ['KeyQ', 'a']]));
  assert.equal(keys.label('up'), 'Z'); assert.equal(keys.action('KeyW'), 'up');
  assert.equal(keys.action('KeyZ'), undefined);
  keys.assign('dash', 0, 'KeyQ', 'a'); assert.equal(keys.label('dash'), 'A');
  keys.assign('interact', 0, 'Minus', 'ß');
  assert.equal(new BindingStore(disk).label('interact'), 'ß');
  assert.equal(keyLabel('Numpad1', { Numpad1: '1' }), 'Num1');
  keys.applyLayout(new Map([['Space', ' ']])); assert.equal(keyLabel('Space', keys.get().labels), 'Space');
});

function inputFixture(run: (f: { keys: BindingStore; input: Input; hits: string[]; fire(type: string, code?: string, extra?: object): any }) => void) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const listeners = new Map<string, ((event: any) => void)[]>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    addEventListener(type: string, fn: (event: any) => void) { listeners.set(type, [...listeners.get(type) ?? [], fn]); },
  } });
  try {
    const keys = new BindingStore(), hits: string[] = [];
    const input = new Input({ onDash() { hits.push('dash'); }, onHotkey(k) { hits.push(k); }, onSkill(slot) { hits.push(`cast${slot + 1}`); } }, keys);
    const fire = (type: string, code = '', extra = {}) => {
      const event = { code, key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code, target: null,
        repeat: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
      for (const fn of listeners.get(type) ?? []) fn(event); return event;
    };
    run({ keys, input, hits, fire });
  } finally { if (original) Object.defineProperty(globalThis, 'window', original); else Reflect.deleteProperty(globalThis, 'window'); }
}
test('input releases independent alternates and rejects movement repeats after capture, focus or rebind', () => inputFixture(({ keys, input, fire }) => {
  fire('keydown', 'KeyW'); fire('keydown', 'ArrowUp'); fire('keyup', 'KeyW');
  assert.deepEqual(input.move(), { x: 0, y: -1 }); fire('keyup', 'ArrowUp'); assert.deepEqual(input.move(), { x: 0, y: 0 });
  fire('keydown', 'KeyW'); keys.capture(true); assert.deepEqual(input.move(), { x: 0, y: 0 });
  fire('keydown', 'KeyD'); keys.capture(false); fire('keydown', 'KeyD', { repeat: true });
  assert.deepEqual(input.move(), { x: 0, y: 0 });
  fire('keydown', 'KeyD'); fire('blur'); fire('keydown', 'KeyD', { repeat: true }); assert.equal(input.move().x, 0);
  fire('keydown', 'KeyW'); keys.assign('up', 0, 'KeyT'); assert.equal(input.move().y, 0);
  fire('keydown', 'KeyW'); assert.equal(input.move().y, 0);
  fire('keydown', 'KeyT'); assert.equal(input.move().y, -1); fire('focusin'); assert.equal(input.move().y, 0);
}));

test('manual keys preserve older custom number assignments and reject repeats, modifiers and text entry', () => {
  const old = { ...DEFAULT_BINDINGS } as Record<string, readonly [string, string | null]>;
  for(const action of ['cast1','cast2','cast3','cast4'])delete old[action];
  old.dash=['Digit1',null];old.skills=['Digit2',null];
  const keys=new BindingStore({getItem:()=>JSON.stringify({version:1,values:old}),setItem(){}});
  for(const [action,pair] of Object.entries(old))assert.deepEqual(keys.get().values[action as keyof typeof DEFAULT_BINDINGS],pair);
  assert.equal(new Set(Object.values(keys.get().values).flat().filter(Boolean)).size,Object.values(keys.get().values).flat().filter(Boolean).length);
  inputFixture(({keys,hits,fire})=>{
    fire('keydown','Digit1');fire('keydown','Digit1',{repeat:true});
    for(const extra of [{shiftKey:true},{ctrlKey:true},{altKey:true},{metaKey:true},{isComposing:true},
      {target:{tagName:'INPUT'}},{target:{tagName:'TEXTAREA'}},{target:{isContentEditable:true}},
      {target:{closest:(q:string)=>q.includes('data-controls-editor')}}])fire('keydown','Digit1',extra);
    keys.capture(true);fire('keydown','Digit1');keys.capture(false);
    assert.deepEqual(hits,['cast1']);keys.assign('cast1',0,'KeyY');fire('keydown','Digit1');fire('keydown','KeyY');assert.deepEqual(hits,['cast1','cast1']);
  });
});
test('remapped actions respect native forms, capture, modifiers, repeat and Tab navigation', () => inputFixture(({ keys, hits, fire }) => {
  keys.assign('dash', 0, 'KeyY'); fire('keydown', 'Space'); fire('keydown', 'KeyY'); fire('keydown', 'KeyY', { repeat: true });
  assert.deepEqual(hits, ['dash']);
  for (const extra of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { defaultPrevented: true },
    { target: { tagName: 'INPUT' } }, { target: { tagName: 'TEXTAREA' } }, { target: { isContentEditable: true } },
    { target: { closest: (q: string) => q.includes('data-controls-editor') } }]) fire('keydown', 'KeyY', extra);
  keys.capture(true); fire('keydown', 'KeyY'); keys.capture(false); assert.deepEqual(hits, ['dash']);
  assert.equal(fire('keydown', 'Tab').defaultPrevented, false);
  keys.reset(); fire('keydown', 'Space', { key: ' ', target: { closest: (q: string) => q.includes('button') } });
  assert.deepEqual(hits, ['dash']); fire('keydown', 'KeyB'); fire('keydown', 'F1'); fire('keydown', 'KeyE');
  assert.deepEqual(hits, ['dash', 'i', 'F1', 'e']);
}));
