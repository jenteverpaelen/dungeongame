// Animated class previews on the character-select screen (one small Pixi app per <canvas data-preview>).

import { Application } from 'pixi.js';
import { createCharacter, playerLook } from '@shared/character';
import { F_CHANNEL, F_MOVING } from '@shared/protocol';
import type { ClassId } from '@shared/types';
import { createPlayerView } from '../render/art';
import type { PlayerView } from '../render/types';

interface Preview { app: Application; view: PlayerView; canvas: HTMLCanvasElement; classId: ClassId }

const previews = new Map<HTMLCanvasElement, Preview>();
let observer: MutationObserver | null = null;
let time = 0;

async function mount(canvas: HTMLCanvasElement) {
  const classId = canvas.dataset.preview as ClassId;
  if (!classId || previews.has(canvas)) return;
  const app = new Application();
  previews.set(canvas, { app, view: null as unknown as PlayerView, canvas, classId });
  await app.init({ canvas, width: canvas.width, height: canvas.height, backgroundAlpha: 0, antialias: true, resolution: Math.min(2, devicePixelRatio), autoDensity: false });
  const look = playerLook(createCharacter('preview', classId, 7));
  const view = createPlayerView(look);
  const scale = canvas.height / 92;
  view.root.scale.set(scale);
  view.root.position.set(canvas.width / 2, canvas.height * 0.86);
  app.stage.addChild(view.root);
  const p = previews.get(canvas);
  if (!p) { app.destroy(); return; }
  p.view = view;
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
  const scan = () => {
    document.querySelectorAll<HTMLCanvasElement>('canvas[data-preview]').forEach((c) => void mount(c));
    for (const [c, p] of previews) if (!c.isConnected) { previews.delete(c); p.app.destroy(); }
  };
  observer = new MutationObserver(scan);
  observer.observe(document.getElementById('ui')!, { childList: true, subtree: true });
  scan();
}

export function stopPreviews() {
  observer?.disconnect();
  for (const p of previews.values()) p.app.destroy();
  previews.clear();
}
