// Head-and-shoulders portraits of townsfolk for the dialogue window: the same rig and preset as the world view,
// rendered once with the main renderer and cached as a data URL (no extra WebGL context).
import { Container, Rectangle } from 'pixi.js';
import { getRenderer } from './art/fx';
import { PlayerArt } from './art/player';
import { npcPreset } from './art/npcLooks';
import type { ViewState } from './types';

const cache = new Map<string, string>();
const STILL: ViewState = { x: 0, y: 0, vx: 0, vy: 0, moving: false, facingLeft: false, flags: 0, attackSeq: 0, hpFrac: 1, time: 1, aps: 1 };

export function npcPortrait(zone: string | undefined, id: string | undefined, role: string, name: string): string | null {
  const key = `${zone}/${id}/${role}/${name}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const renderer = getRenderer();
  if (!renderer) return null;
  const preset = npcPreset(zone, id, role, name);
  const art = new PlayerArt(preset.look);
  art.setYaw(16);
  const holder = new Container();
  holder.addChild(art.root);
  for (let i = 0; i < 3; i++) art.update(0.016, STILL);
  let url: string | null = null;
  try {
    const canvas = renderer.extract.canvas({ target: holder, frame: new Rectangle(-31, -80, 62, 64), resolution: 3, antialias: true, clearColor: [0, 0, 0, 0] }) as HTMLCanvasElement;
    url = canvas.toDataURL('image/png');
  } catch { url = null; }
  art.destroy();
  holder.destroy({ children: true });
  if (url) cache.set(key, url);
  return url;
}
