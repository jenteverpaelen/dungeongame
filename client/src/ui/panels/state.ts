// Panel-local state: a tiny observable store (same shape as ui/store.ts) + hooks, used for the
// tooltip, drag & drop and the Cube workspace, which are shared between several panels.

import { useEffect, useRef, useState } from 'preact/hooks';

type Listener = () => void;

export class Local<T extends object> {
  private listeners = new Set<Listener>();
  constructor(private state: T) {}
  get(): T { return this.state; }
  set(patch: Partial<T> | ((s: T) => Partial<T>)) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    for (const l of [...this.listeners]) l();
  }
  subscribe(l: Listener) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
}

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  return true;
}

/** Subscribe to a slice of a Local store. The selector may close over props (latest one is always used). */
export function useLocal<T extends object, R>(store: Local<T>, select: (s: T) => R): R {
  const sel = useRef(select);
  sel.current = select;
  const [, force] = useState(0);
  const last = useRef<R>(select(store.get()));
  const next = select(store.get());
  if (!shallowEqual(last.current, next)) last.current = next;
  useEffect(() => store.subscribe(() => {
    const n = sel.current(store.get());
    if (!shallowEqual(last.current, n)) { last.current = n; force((x) => x + 1); }
  }), [store]);
  return last.current;
}
