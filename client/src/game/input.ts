// Keyboard input: WASD movement, Space dash, panel hotkeys. Ignores keys while typing in an input.

export interface InputHandlers {
  onDash(): void;
  onHotkey(key: string, e: KeyboardEvent): void;
}

export class Input {
  private down = new Set<string>();
  mouseX = 0;
  mouseY = 0;

  constructor(private h: InputHandlers) {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', () => this.down.clear());
    window.addEventListener('focusin', () => this.down.clear());
    window.addEventListener('mousemove', (e) => { this.mouseX = e.clientX; this.mouseY = e.clientY; });
  }

  private typing(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  private onDown = (e: KeyboardEvent) => {
    if (this.typing(e)) {
      this.down.clear();
      if (e.key === 'Escape' || e.key === 'Enter') this.h.onHotkey(e.key, e);
      return;
    }
    // Native button activation must not dash. Keep movement/hotkeys available
    // after a mouse click leaves an ordinary game button focused.
    const target = e.target as Element | null;
    const button = target?.closest?.('button, [role="button"]');
    if (target?.closest?.('select, [role="slider"]') || (button && (e.key === ' ' || e.key === 'Enter'))) {
      this.down.clear();
      if (e.key === 'Escape') this.h.onHotkey(e.key, e);
      return;
    }
    const k = e.code;
    if (k === 'Space') { e.preventDefault(); if (!e.repeat) this.h.onDash(); return; }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) {
      this.down.add(k);
      if (k.startsWith('Arrow')) e.preventDefault();
      return;
    }
    if (k === 'F1' || k === 'F2' || k === 'Tab') e.preventDefault();
    if (!e.repeat) this.h.onHotkey(e.key.length === 1 ? e.key.toLowerCase() : e.key, e);
  };

  private onUp = (e: KeyboardEvent) => { this.down.delete(e.code); };

  clear() { this.down.clear(); }

  /** Movement vector, each axis in [-1, 1]. */
  move(): { x: number; y: number } {
    const d = this.down;
    const x = (d.has('KeyD') || d.has('ArrowRight') ? 1 : 0) - (d.has('KeyA') || d.has('ArrowLeft') ? 1 : 0);
    const y = (d.has('KeyS') || d.has('ArrowDown') ? 1 : 0) - (d.has('KeyW') || d.has('ArrowUp') ? 1 : 0);
    return { x, y };
  }
}
