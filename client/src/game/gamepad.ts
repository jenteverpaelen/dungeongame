// Gamepad input (F-SET-02) through the browser Gamepad API's "standard" mapping (W3C Gamepad, §Remapping: buttons 0–3
// bottom/right/left/top face, 4–5 bumpers, 6–7 triggers, 8 back, 9 start, 10–11 stick presses, 12–15 d-pad, 16 home;
// axes 0/1 left stick, 2/3 right stick). Feeds the same actions as the keyboard (bindings.ts), so prompts, Help and the
// HUD show the button of whichever device was used last. Every game action is remappable; inside windows the d-pad /
// left stick move focus, A activates and B closes (platform convention, fixed).

/** Minimal observable (same shape as ui/panels/state Local) so this module stays testable without the UI. */
class Local<T extends object> {
  private listeners = new Set<() => void>();
  constructor(private state: T) {}
  get(): T { return this.state; }
  set(patch: Partial<T>) { this.state = { ...this.state, ...patch }; for (const l of [...this.listeners]) l(); }
  subscribe(l: () => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
}

export const PAD_ACTIONS = ['interact', 'dash', 'cast1', 'cast2', 'cast3', 'cast4', 'inventory', 'skills', 'journal', 'map', 'settings', 'paragon', 'cube'] as const;
export type PadAction = typeof PAD_ACTIONS[number];
export type PadBindings = Readonly<Record<PadAction, number | null>>;
/** Positional names on the standard layout (Xbox-style letters; on other pads the same positions). */
export const BUTTON_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home'] as const;
export const CONFIRM = 0, BACK = 1, DPAD_UP = 12, DPAD_DOWN = 13, DPAD_LEFT = 14, DPAD_RIGHT = 15;
/** Buttons that cannot be bound to a game action: the d-pad moves (and navigates windows), Home belongs to the system. */
const RESERVED = new Set([DPAD_UP, DPAD_DOWN, DPAD_LEFT, DPAD_RIGHT, 16]);
export const DEFAULT_PAD: PadBindings = Object.freeze({
  interact: 0, dash: 1, cast1: 2, cast2: 3, cast3: 4, cast4: 5, inventory: 6, skills: 7, map: 8, settings: 9, journal: 10, paragon: null, cube: null,
});
export const PAD_KEY = 'hearthfall.gamepad.v1';
/** Radial dead zone on the stick (fraction of full deflection); the rest is rescaled to 0..1 so slow walking stays possible. */
export const DEADZONE = 0.2;
const PRESS = 0.5; // analog triggers count as pressed past half way

interface StorageAccess { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface PadState { values: PadBindings; connected: string | null; capturing: PadAction | null; retained: boolean; message: string }

export function parsePad(input: unknown): PadBindings | null {
  if (!input || typeof input !== 'object') return null;
  const out = {} as Record<PadAction, number | null>, seen = new Set<number>();
  for (const a of PAD_ACTIONS) {
    const v = (input as Record<string, unknown>)[a];
    if (v === null || v === undefined) { out[a] = null; continue; }
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 16 || RESERVED.has(v as number) || seen.has(v as number)) return null;
    seen.add(v as number); out[a] = v as number;
  }
  return Object.freeze(out);
}

export class PadStore extends Local<PadState> {
  constructor(private storage?: StorageAccess) {
    let values: PadBindings = DEFAULT_PAD, retained = !!storage;
    try { const raw = storage?.getItem(PAD_KEY); if (raw) { const d = JSON.parse(raw); values = (d?.version === 1 && parsePad(d.values)) || DEFAULT_PAD; } }
    catch { retained = false; }
    super({ values, connected: null, capturing: null, retained, message: '' });
  }
  /** Error text, or null when bound. Binding a button already in use is refused (change that action first). */
  assign(action: PadAction, button: number | null): string | null {
    if (button !== null && (RESERVED.has(button) || button < 0 || button > 16)) return 'pad.reserved';
    const values = { ...this.get().values } as Record<PadAction, number | null>;
    if (button !== null) for (const a of PAD_ACTIONS) if (a !== action && values[a] === button) return 'pad.conflict';
    values[action] = button;
    this.save(Object.freeze(values));
    return null;
  }
  reset() { this.save(DEFAULT_PAD); }
  private save(values: PadBindings) {
    let retained = false;
    try { if (this.storage) { this.storage.setItem(PAD_KEY, JSON.stringify({ version: 1, values })); retained = true; } } catch { /* session only */ }
    this.set({ values, retained });
  }
  actionFor(button: number): PadAction | undefined { return PAD_ACTIONS.find(a => this.get().values[a] === button); }
  label(action: PadAction): string | null { const b = this.get().values[action]; return b === null ? null : BUTTON_NAMES[b]; }
}

/** Left stick with a radial dead zone, rescaled; the d-pad gives full-speed 8-way movement. */
export function stickVector(axes: readonly number[], buttons: readonly { pressed: boolean }[], dpad = true): { x: number; y: number } {
  const ax = axes[0] ?? 0, ay = axes[1] ?? 0, m = Math.hypot(ax, ay);
  if (m > DEADZONE) { const k = Math.min(1, (m - DEADZONE) / (1 - DEADZONE)) / m; return { x: ax * k, y: ay * k }; }
  if (!dpad) return { x: 0, y: 0 };
  const x = (buttons[DPAD_RIGHT]?.pressed ? 1 : 0) - (buttons[DPAD_LEFT]?.pressed ? 1 : 0);
  const y = (buttons[DPAD_DOWN]?.pressed ? 1 : 0) - (buttons[DPAD_UP]?.pressed ? 1 : 0);
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}

/** Rising edges since the previous poll (a held button fires once). */
export function pressedEdges(prev: readonly boolean[], buttons: readonly { pressed: boolean; value?: number }[]): { now: boolean[]; edges: number[] } {
  const now = buttons.map(b => b.pressed || (b.value ?? 0) > PRESS), edges: number[] = [];
  now.forEach((p, i) => { if (p && !prev[i]) edges.push(i); });
  return { now, edges };
}

export interface Rect { x: number; y: number; w: number; h: number }
/** Spatial focus: the nearest candidate in the pressed direction (centre to centre, off-axis distance weighted ×2). */
export function nextFocus(from: Rect | null, candidates: readonly Rect[], dir: 'up' | 'down' | 'left' | 'right'): number {
  if (!candidates.length) return -1;
  if (!from) return 0;
  const fx = from.x + from.w / 2, fy = from.y + from.h / 2;
  let best = -1, bestScore = Infinity;
  candidates.forEach((c, i) => {
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2, dx = cx - fx, dy = cy - fy;
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 1) return;
    const score = along + across * 2;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

function browserStorage(): StorageAccess | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}
export const padBindings = new PadStore(browserStorage());

export interface PadHandlers {
  /** A game action from a button (dash, interact, menus, casts) — same handlers as the keyboard. */
  onAction(action: PadAction): void;
  /** True while a window or dialog takes input (the d-pad then navigates focus). */
  uiOpen(): boolean;
  onBack(): void;
  /** Any gamepad activity (the HUD switches its prompts to gamepad buttons). */
  onActive(): void;
}

/** Polled once per frame by the game loop. */
export class GamepadInput {
  private prev: boolean[] = [];
  private held: { dir: 'up' | 'down' | 'left' | 'right'; next: number } | null = null;
  private vector = { x: 0, y: 0 };
  constructor(private h: PadHandlers, private store: PadStore = padBindings, private source: () => readonly (Gamepad | null)[] =
    () => (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [])) {}

  /** The current movement vector from the pad (zero while a window is open). */
  move(): { x: number; y: number } { return this.vector; }

  poll(now = performance.now()): void {
    const pad = [...this.source()].find((g): g is Gamepad => !!g && g.connected);
    const id = pad ? pad.id.slice(0, 60) : null;
    if (id !== this.store.get().connected) this.store.set({ connected: id });
    if (!pad) { this.vector = { x: 0, y: 0 }; this.prev = []; return; }
    const { now: down, edges } = pressedEdges(this.prev, pad.buttons);
    this.prev = down;
    const capture = this.store.get().capturing;
    if (capture) {
      const b = edges.find(e => !RESERVED.has(e) && e !== 16);
      if (b !== undefined) {
        const err = this.store.assign(capture, b);
        this.store.set({ capturing: null, message: err ?? `pad.assigned:${capture}:${b}` });
      }
      this.vector = { x: 0, y: 0 };
      return;
    }
    const ui = this.h.uiOpen();
    const v = stickVector(pad.axes, pad.buttons, !ui);
    if (edges.length || Math.hypot(v.x, v.y) > 0) this.h.onActive();
    if (ui) {
      this.vector = { x: 0, y: 0 };
      // Window navigation: d-pad or stick moves focus (with key-repeat), A activates, B closes.
      const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
      const dir = down[DPAD_UP] || ay < -0.6 ? 'up' : down[DPAD_DOWN] || ay > 0.6 ? 'down' : down[DPAD_LEFT] || ax < -0.6 ? 'left' : down[DPAD_RIGHT] || ax > 0.6 ? 'right' : null;
      if (!dir) this.held = null;
      else if (!this.held || this.held.dir !== dir) { this.held = { dir, next: now + 380 }; moveFocus(dir); }
      else if (now >= this.held.next) { this.held.next = now + 120; moveFocus(dir); }
      if (edges.includes(CONFIRM)) (document.activeElement as HTMLElement | null)?.click?.();
      if (edges.includes(BACK)) this.h.onBack();
      return;
    }
    this.held = null;
    this.vector = v;
    for (const b of edges) { const a = this.store.actionFor(b); if (a) this.h.onAction(a); }
  }
}

const FOCUSABLE = 'button:not(:disabled), [role="tab"], [role="radio"], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';
/** Moves DOM focus inside the open windows / dialogs (the select screen too). */
export function moveFocus(dir: 'up' | 'down' | 'left' | 'right'): void {
  if (typeof document === 'undefined') return;
  const scope = [...document.querySelectorAll<HTMLElement>('.ac-card, #ui .pn')].filter(e => e.offsetParent !== null);
  const els = (scope.length ? scope : [document.body]).flatMap(s => [...s.querySelectorAll<HTMLElement>(FOCUSABLE)])
    .filter(e => e.offsetParent !== null && e.getClientRects().length > 0);
  const rects = els.map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const active = document.activeElement as HTMLElement | null, at = active ? els.indexOf(active) : -1;
  const i = nextFocus(at >= 0 ? rects[at] : null, rects.filter((_, k) => k !== at), dir);
  const target = i < 0 ? null : els.filter((_, k) => k !== at)[i];
  if (target) { target.focus({ preventScroll: true }); target.classList.add('pad-focus'); active?.classList.remove('pad-focus'); }
}
