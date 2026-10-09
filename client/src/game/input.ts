// Keyboard input shares its bindings with Settings, Help and HUD prompts.
import { bindings, refreshKeyboardLayout, type Action, type BindingStore } from './bindings';

const HOTKEYS: Partial<Record<Action, string>> = { interact: 'e', inventory: 'i', skills: 'k', paragon: 'p', cube: 'u', settings: 'o', journal:'j', map:'m' };

export interface InputHandlers {
  onDash(): void;
  onHotkey(key: string, e: KeyboardEvent): void;
}

export class Input {
  private down = new Set<string>();
  mouseX = 0;
  mouseY = 0;

  constructor(private h: InputHandlers, private keys: BindingStore = bindings) {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', () => this.down.clear());
    window.addEventListener('focusin', () => this.down.clear());
    window.addEventListener('mousemove', (e) => { this.mouseX = e.clientX; this.mouseY = e.clientY; });
    let previous = keys.get();
    keys.subscribe(() => {
      const next = keys.get();
      if (previous.values !== next.values || previous.capturing !== next.capturing) this.down.clear();
      previous = next;
    });
    if (keys === bindings) {
      void refreshKeyboardLayout();
      window.addEventListener('focus', () => { void refreshKeyboardLayout(); });
    }
  }

  private typing(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  private onDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || this.keys.get().capturing || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) {
      this.down.clear(); return;
    }
    if (this.typing(e)) {
      this.down.clear();
      if (e.key === 'Escape' || e.key === 'Enter') this.h.onHotkey(e.key, e);
      return;
    }
    // Native button activation must not dash. Keep movement/hotkeys available
    // after a mouse click leaves an ordinary game button focused.
    const target = e.target as Element | null;
    const button = target?.closest?.('button, [role="button"], [role="tab"]');
    if (target?.closest?.('select, [role="slider"], [data-controls-editor]') || (button && (e.key === ' ' || e.key === 'Enter'))) {
      this.down.clear();
      if (e.key === 'Escape' || e.key === 'F1') { if (e.key === 'F1') e.preventDefault(); this.h.onHotkey(e.key, e); }
      return;
    }
    const k = e.code;
    const action = this.keys.action(k);
    if (action === 'dash') { e.preventDefault(); if (!e.repeat) this.h.onDash(); return; }
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      // A repeat after blur, focus or a binding change must not restart movement.
      if (!e.repeat) this.down.add(k);
      e.preventDefault();
      return;
    }
    if (action && HOTKEYS[action]) {
      e.preventDefault(); if (!e.repeat) this.h.onHotkey(HOTKEYS[action]!, e); return;
    }
    if (['F1', 'F2', 'F3'].includes(k)) e.preventDefault();
    if (!e.repeat && ['Escape', 'Enter', 'F1', 'F2', 'F3'].includes(k)) this.h.onHotkey(k, e);
  };

  private onUp = (e: KeyboardEvent) => { this.down.delete(e.code); };

  clear() { this.down.clear(); }

  /** Movement vector, each axis in [-1, 1]. */
  move(): { x: number; y: number } {
    const held = (a: Action) => this.keys.get().values[a].some(k => k !== null && this.down.has(k)) ? 1 : 0;
    const x = held('right') - held('left');
    const y = held('down') - held('up');
    return { x, y };
  }
}
