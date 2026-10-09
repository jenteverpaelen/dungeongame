// Physical keyboard bindings. Labels are separate from key identity/layout.
import { text } from '../i18n/messages';
export const ACTIONS = [
  ['up', text('controls.up.label')], ['left', text('controls.left.label')],
  ['down', text('controls.down.label')], ['right', text('controls.right.label')],
  ['dash', text('controls.dash.label')], ['interact', text('controls.interact.label')],
  ['inventory', text('controls.inventory.label')], ['skills', text('controls.skills.label')],
  ['paragon', text('controls.paragon.label')], ['cube', text('controls.cube.label')], ['settings', text('controls.settings.label')],
  ['journal', text('controls.journal.label')],
] as const;
export type Action = typeof ACTIONS[number][0];
export type Bindings = Readonly<Record<Action, readonly [string, string | null]>>;
export const BINDINGS_KEY = 'hearthfall.bindings.v1';
const defaults: Record<Action, [string, string | null]> = {
  up: ['KeyW', 'ArrowUp'], left: ['KeyA', 'ArrowLeft'], down: ['KeyS', 'ArrowDown'], right: ['KeyD', 'ArrowRight'],
  dash: ['Space', null], interact: ['KeyE', null], inventory: ['KeyI', 'KeyB'], skills: ['KeyK', null],
  paragon: ['KeyP', null], cube: ['KeyU', null], settings: ['KeyO', null],
  journal: ['KeyJ', null],
};
function freeze(values: Record<Action, [string, string | null]>): Bindings {
  for (const pair of Object.values(values)) Object.freeze(pair);
  return Object.freeze(values);
}
export const DEFAULT_BINDINGS = freeze(defaults);
const NAMES: Record<string, string> = {
  Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', Insert: 'Ins', Delete: 'Del',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Backquote: '`', Comma: ',', Period: '.', Slash: '/',
  IntlBackslash: '\\', NumpadAdd: 'Num+', NumpadSubtract: 'Num−', NumpadMultiply: 'Num×',
  NumpadDivide: 'Num/', NumpadDecimal: 'Num.',
};
export function allowedCode(code: string): boolean {
  return /^(Key[A-Z]|Digit[0-9]|Numpad[0-9])$/.test(code) || Object.hasOwn(NAMES, code);
}
function characterLabel(key: unknown): string | undefined {
  return typeof key === 'string' && [...key].length === 1 && !/[\p{C}\p{Z}]/u.test(key) ? key.replace(/[a-z]/g, c => c.toUpperCase()) : undefined;
}
export function keyLabel(code: string, labels: Readonly<Record<string, string>> = {}): string {
  if (code.startsWith('Numpad')) return NAMES[code] ?? `Num${code.slice(6)}`;
  return labels[code] ?? NAMES[code] ?? code.replace(/^(Key|Digit)/, '');
}
function parseBindings(input: unknown): Bindings | undefined {
  if (!input || typeof input !== 'object') return;
  const result = {} as Record<Action, [string, string | null]>, seen = new Set<string>();
  for (const [action] of ACTIONS) {
    const pair = (input as Record<string, unknown>)[action];
    if(action==='journal' && pair===undefined)continue; // C070 records predate this action.
    if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string') return;
    for (const [i, code] of pair.entries()) {
      if (code === null && i === 1) continue;
      if (typeof code !== 'string' || !allowedCode(code) || seen.has(code)) return;
      seen.add(code);
    }
    result[action] = [pair[0], pair[1]];
  }
  if(!result.journal) {
    // Retain every old binding. A custom J takes precedence over the new default.
    const free=['KeyJ',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>'Key'+c)].find(k=>!seen.has(k))!;
    result.journal=[free,null];
  }
  return freeze(result);
}
interface StorageAccess { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface BindingState {
  values: Bindings; labels: Readonly<Record<string, string>>; retained: boolean; capturing: boolean; layoutAvailable: boolean;
}
export class BindingStore {
  private state: BindingState;
  private listeners = new Set<() => void>();
  constructor(private storage?: StorageAccess) {
    let values = DEFAULT_BINDINGS, retained = !!storage;
    const labels: Record<string, string> = {};
    try {
      const raw = storage?.getItem(BINDINGS_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const parsed = data?.version === 1 ? parseBindings(data.values) : undefined;
        if (parsed) {
          values = parsed;
          if (data.labels && typeof data.labels === 'object') for (const [code, key] of Object.entries(data.labels)) {
            const label = characterLabel(key); if (allowedCode(code) && label) labels[code] = label;
          }
        }
      }
    } catch { retained = false; /* Invalid storage cannot prevent boot; session changes still work. */ }
    this.state = { values, labels: Object.freeze(labels), retained, capturing: false, layoutAvailable: false };
  }
  get() { return this.state; }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private publish(patch: Partial<BindingState>) {
    this.state = { ...this.state, ...patch }; for (const fn of [...this.listeners]) fn();
  }
  capture(capturing: boolean) { if (capturing !== this.state.capturing) this.publish({ capturing }); }
  action(code: string): Action | undefined { return ACTIONS.find(([a]) => this.state.values[a].includes(code))?.[0]; }
  label(action: Action) { return keyLabel(this.state.values[action][0], this.state.labels); }
  assign(action: Action, slot: 0 | 1, code: string | null, printed?: string): string | null {
    if (code === null && slot === 0) return text('controls.keepPrimary');
    if (code !== null && !allowedCode(code)) return text('controls.allowedKey');
    if (code !== null) for (const [a] of ACTIONS) for (const i of [0, 1] as const) {
      if ((a !== action || i !== slot) && this.state.values[a][i] === code) return text(`controls.${a}.conflict`);
    }
    const values = { ...this.state.values, [action]: [...this.state.values[action]] } as Record<Action, [string, string | null]>;
    if (slot === 0) values[action][0] = code!;
    else values[action][1] = code;
    const label = characterLabel(printed);
    const labels = code && label ? Object.freeze({ ...this.state.labels, [code]: label }) : this.state.labels;
    this.save(freeze(values), labels); return null;
  }
  private save(values: Bindings, labels = this.state.labels) {
    let retained = false;
    try { if (this.storage) { this.storage.setItem(BINDINGS_KEY, JSON.stringify({ version: 1, values, labels })); retained = true; } } catch { /* Session only. */ }
    this.publish({ values, labels, retained });
  }
  reset() { this.save(DEFAULT_BINDINGS); }
  applyLayout(map: { get(code: string): string | undefined }) {
    const labels = { ...this.state.labels };
    for (const code of [...Object.keys(NAMES), ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => 'Key' + c), ...'0123456789'.split('').map(c => 'Digit' + c)]) {
      const label = characterLabel(map.get(code)); if (label) labels[code] = label;
    }
    this.publish({ labels: Object.freeze(labels), layoutAvailable: true });
  }
}
function browserStorage(): StorageAccess | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}
export const bindings = new BindingStore(browserStorage());
export async function refreshKeyboardLayout() {
  try {
    const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard;
    if (keyboard?.getLayoutMap) bindings.applyLayout(await keyboard.getLayoutMap());
  } catch { /* Optional API. Captured labels and documented physical-position fallback remain usable. */ }
}
