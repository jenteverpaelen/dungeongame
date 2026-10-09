// Animated class previews on the character-select screen (one small Pixi app per <canvas data-preview>).

import { Application } from 'pixi.js';
import { createCharacter, playerLook } from '@shared/character';
import { F_CHANNEL, F_MOVING } from '@shared/protocol';
import type { ClassId } from '@shared/types';
import { createPlayerView } from '../render/art';
import type { PlayerView } from '../render/types';

interface Preview { app: Application; view: PlayerView; canvas: HTMLCanvasElement; classId: ClassId; ready: Promise<void>; dead: boolean }

const previews = new Map<HTMLCanvasElement, Preview>();
let observer: MutationObserver | null = null;
let time = 0;

async function mount(canvas: HTMLCanvasElement) {
  const classId = canvas.dataset.preview as ClassId;
  if (!classId || previews.has(canvas)) return;
  const app = new Application();
  const ready = app.init({ canvas, width: canvas.width, height: canvas.height, backgroundAlpha: 0, antialias: true, resolution: Math.min(2, devicePixelRatio), autoDensity: false });
  const entry: Preview = { app, view: null as unknown as PlayerView, canvas, classId, ready, dead: false };
  previews.set(canvas, entry);
  await ready;
  if (entry.dead) { app.destroy(); return; }
  const look = playerLook(createCharacter('preview', classId, 7));
  const view = createPlayerView(look);
  const scale = canvas.height / 92;
  view.root.scale.set(scale);
  view.root.position.set(canvas.width / 2, canvas.height * 0.86);
  app.stage.addChild(view.root);
  entry.view = view;
  let seq = 0, lastSwing = 0;
  app.ticker.add((t) => {
    time += t.deltaMS / 1000;
    const phase = time % 7;
    // Idle → attack flourish → signature move (whirlwind for the warrior) → walk in place.
    if (time - lastSwing > 2.2 && phase < 3) { seq++; lastSwing = time; }
    const flags = (classId === 'warrior' && phase > 3 && phase < 4.4 ? F_CHANNEL : 0) | (phase > 5 && phase < 6.4 ? F_MOVING : 0);
    view.update(t.deltaMS / 1000, { x: 0, y: 0, vx: flags & F_MOVING ? 120 : 0, vy: 0, moving: !!(flags & F_MOVING), facingLeft: false, flags, attackSeq: seq, hpFrac: 1, time, aps: 1.2 });
  });
}

/** Watch the DOM for preview canvases (the class-select screen) and animate them. */
export function startPreviews() {
  if (observer) return;
  const scan = () => {
    document.querySelectorAll<HTMLCanvasElement>('canvas[data-preview]').forEach((c) => void mount(c));
    for (const [c, p] of previews) if (!c.isConnected) { previews.delete(c); destroyPreview(p); }
  };
  observer = new MutationObserver(scan);
  observer.observe(document.getElementById('ui')!, { childList: true, subtree: true });
  scan();
}

/** Destroy once the Pixi app finished initialising (destroying mid-init throws inside Pixi). */
function destroyPreview(p: Preview) {
  if (p.dead) return;
  p.dead = true;
  void p.ready.then(() => { try { p.app.destroy(); } catch { /* already gone */ } });
}

export function stopPreviews() {
  observer?.disconnect();
  observer = null;
  for (const p of previews.values()) destroyPreview(p);
  previews.clear();
}
