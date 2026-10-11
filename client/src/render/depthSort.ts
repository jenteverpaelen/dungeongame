// Lazy depth sorting (docs/rework/PERF.md §Renderer). Pixi re-sorts a `sortableChildren` container by zIndex, and any
// zIndex write marks the whole render group as structurally changed, which rebuilds every draw instruction of that group
// — even when the new values leave the draw order exactly as it was. The scene's y-sorted entity layer and every hero
// rig (part depths follow the 3D pose) write fresh zIndex values each frame, so the full scene was rebuilt every frame.
// A lazily sorted container records the change instead and, just before rendering, re-sorts and flags a rebuild only
// when its children are actually out of order. The resulting order is the one Pixi's own stable sort would produce.

import { Container } from 'pixi.js';

interface LazyState { dirty: boolean }
const LAZY = Symbol('hf.lazyDepth');
type Lazy = Container & { [LAZY]?: LazyState };

let installed = false;
function install(): void {
  if (installed) return;
  installed = true;
  const proto = Container.prototype as unknown as { depthOfChildModified(this: Container): void };
  const original = proto.depthOfChildModified;
  // Called on a child whose zIndex changed (or that was added with a zIndex): the parent decides what that costs.
  proto.depthOfChildModified = function (this: Container) {
    const state = (this.parent as Lazy | null)?.[LAZY];
    if (state) { state.dirty = true; return; }
    original.call(this);
  };
}

// The zIndex getter is an accessor on every child; the backing field is read directly (crowds: thousands per frame).
type Z = Container & { _zIndex: number };
const byZ = (a: Container, b: Container) => (a as Z)._zIndex - (b as Z)._zIndex;

/** Draw `c`'s children in zIndex order (like `sortableChildren`), rebuilding instructions only when the order changes. */
export function lazyDepthSort(c: Container): void {
  install();
  c.sortableChildren = false;
  const state: LazyState = { dirty: true };
  (c as Lazy)[LAZY] = state;
  const previous = c.onRender;
  c.onRender = (renderer) => {
    previous?.(renderer);
    if (!state.dirty) return;
    state.dirty = false;
    const kids = c.children as Z[];
    for (let i = 1; i < kids.length; i++) {
      if (kids[i - 1]._zIndex <= kids[i]._zIndex) continue;
      kids.sort(byZ); // stable, from the current order: the same order Pixi's sortChildren gives
      const group = c.renderGroup ?? c.parentRenderGroup;
      if (group) group.structureDidChange = true;
      return;
    }
  };
}
