import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEADZONE, DEFAULT_PAD, GamepadInput, PAD_KEY, PadStore, nextFocus, parsePad, pressedEdges, stickVector, type PadAction } from './gamepad';

assert.ok(process.env.DATA_DIR, 'Client checks require an isolated DATA_DIR');
const btn = (pressed = false, value = pressed ? 1 : 0) => ({ pressed, value, touched: pressed });
const buttons = (down: number[] = []) => Array.from({ length: 17 }, (_, i) => btn(down.includes(i)));
const mem = () => { const data = new Map<string, string>(); return { data, storage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } } }; };

test('stick: radial dead zone, rescaled magnitude, d-pad fallback that can be switched off', () => {
  assert.deepEqual(stickVector([0.1, 0.1], buttons()), { x: 0, y: 0 }, 'inside the dead zone nothing moves');
  const half = stickVector([0.6, 0], buttons());
  assert.ok(Math.abs(half.x - (0.6 - DEADZONE) / (1 - DEADZONE)) < 1e-9 && half.y === 0, 'slow walking is possible');
  const full = stickVector([1, 1], buttons());
  assert.ok(Math.abs(Math.hypot(full.x, full.y) - 1) < 1e-9, 'never faster than the keyboard');
  const dpad = stickVector([0, 0], buttons([12, 15]));
  assert.ok(Math.abs(dpad.x - Math.SQRT1_2) < 1e-9 && Math.abs(dpad.y + Math.SQRT1_2) < 1e-9, 'd-pad gives 8-way movement');
  assert.deepEqual(stickVector([0, 0], buttons([12]), false), { x: 0, y: 0 }, 'in windows the d-pad navigates instead');
});

test('a held button fires once; analog triggers count past half way', () => {
  let r = pressedEdges([], buttons([0]));
  assert.deepEqual(r.edges, [0]);
  r = pressedEdges(r.now, buttons([0]));
  assert.deepEqual(r.edges, [], 'held');
  const trig = buttons(); trig[7] = { pressed: false, value: 0.7, touched: true };
  assert.deepEqual(pressedEdges(r.now, trig).edges, [7]);
});

test('bindings are remappable, persist, refuse conflicts and the reserved d-pad/Home', () => {
  const { data, storage } = mem();
  const store = new PadStore(storage);
  assert.deepEqual(store.get().values, DEFAULT_PAD);
  assert.equal(store.assign('dash', 0), 'pad.conflict', 'A already interacts');
  assert.equal(store.assign('dash', 12), 'pad.reserved');
  assert.equal(store.assign('dash', 16), 'pad.reserved');
  assert.equal(store.assign('dash', 11), null);
  assert.equal(new PadStore(storage).get().values.dash, 11, 'persisted');
  assert.equal(JSON.parse(data.get(PAD_KEY)!).version, 1);
  assert.equal(store.label('dash'), 'R3');
  assert.equal(store.actionFor(11), 'dash');
  store.assign('paragon', null);
  store.reset();
  assert.deepEqual(new PadStore(storage).get().values, DEFAULT_PAD);
  assert.equal(parsePad({ ...DEFAULT_PAD, dash: 0 }), null, 'a stored duplicate is rejected as a whole');
  assert.equal(new PadStore({ getItem: () => '{broken', setItem() {} }).get().values, DEFAULT_PAD, 'bad storage cannot stop boot');
});

test('spatial focus picks the nearest element in the pressed direction', () => {
  const from = { x: 100, y: 100, w: 40, h: 20 };
  const cands = [{ x: 200, y: 100, w: 40, h: 20 }, { x: 100, y: 160, w: 40, h: 20 }, { x: 0, y: 100, w: 40, h: 20 }, { x: 180, y: 300, w: 40, h: 20 }];
  assert.equal(nextFocus(from, cands, 'right'), 0);
  assert.equal(nextFocus(from, cands, 'down'), 1);
  assert.equal(nextFocus(from, cands, 'left'), 2);
  assert.equal(nextFocus(from, cands, 'up'), -1, 'nothing above');
  assert.equal(nextFocus(null, cands, 'up'), 0, 'no focus yet: the first element');
});

test('poll: game actions from buttons, movement from the stick, window navigation and capture mode', () => {
  const { storage } = mem();
  const store = new PadStore(storage);
  let pad: { id: string; connected: boolean; axes: number[]; buttons: ReturnType<typeof buttons> } = { id: 'Test pad (STANDARD GAMEPAD)', connected: true, axes: [0, 0, 0, 0], buttons: buttons() };
  const actions: PadAction[] = []; let ui = false, backs = 0, active = 0;
  const input = new GamepadInput({ onAction: a => actions.push(a), uiOpen: () => ui, onBack: () => backs++, onActive: () => active++ }, store, () => [pad as unknown as Gamepad]);
  input.poll(0);
  assert.equal(store.get().connected, 'Test pad (STANDARD GAMEPAD)');
  pad = { ...pad, buttons: buttons([1, 2]), axes: [1, 0, 0, 0] };
  input.poll(16);
  assert.deepEqual(actions, ['dash', 'cast1']);
  assert.ok(input.move().x > 0.99 && active > 0);
  pad = { ...pad, buttons: buttons([1, 2]) };
  input.poll(32);
  assert.deepEqual(actions, ['dash', 'cast1'], 'held buttons do not repeat');
  ui = true;
  pad = { ...pad, buttons: buttons([1]), axes: [1, 0, 0, 0] };
  input.poll(48);
  assert.deepEqual(input.move(), { x: 0, y: 0 }, 'no walking while a window is open');
  pad = { ...pad, buttons: buttons(), axes: [0, 0, 0, 0] }; input.poll(60);
  pad = { ...pad, buttons: buttons([1]) }; input.poll(70);
  assert.equal(backs, 1, 'B closes the window');
  ui = false;
  store.set({ capturing: 'journal' });
  pad = { ...pad, buttons: buttons() }; input.poll(80);
  pad = { ...pad, buttons: buttons([12]) }; input.poll(90);
  assert.equal(store.get().capturing, 'journal', 'the d-pad is not offered for capture');
  pad = { ...pad, buttons: buttons([11]) }; input.poll(100);
  assert.equal(store.get().values.journal, 11);
  assert.equal(store.get().capturing, null);
  pad = { ...pad, connected: false }; input.poll(110);
  assert.equal(store.get().connected, null, 'disconnect is noticed');
});
