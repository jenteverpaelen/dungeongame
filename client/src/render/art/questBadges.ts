// Quest marker language (docs/rework/quests/DESIGN.md §2): story = gold crest behind the glyph, side story = silver-blue
// disc, lesson = green disc with "+", bounty = bronze board pin. One painter for the overhead badge (Pixi texture), the
// minimap (canvas) and the HUD (CSS uses the same colours from QUEST_COLORS).
import { CanvasSource, Texture } from 'pixi.js';
import type { QuestCategory } from '@shared/questTypes';

export type MarkCat = QuestCategory | 'bounty';
export const QUEST_COLORS: Record<MarkCat, { fill: string; deep: string; text: string; num: number }> = {
  story: { fill: '#ffcf5a', deep: '#8a5a10', text: '#2a1604', num: 0xffcf5a },
  side: { fill: '#9fd4ff', deep: '#2d5f8a', text: '#071a33', num: 0x9fd4ff },
  lesson: { fill: '#8fe3a8', deep: '#2a7040', text: '#06210f', num: 0x8fe3a8 },
  bounty: { fill: '#e0a464', deep: '#7a4618', text: '#2a1404', num: 0xe0a464 },
};

/** Paint a marker centred at (0, 0) with radius r. Glyph: '!' '?' '◆' '+' or '' (bounty pin without a glyph). */
export function paintQuestMark(g: CanvasRenderingContext2D, cat: MarkCat, glyph: string, r: number) {
  const c = QUEST_COLORS[cat];
  g.save();
  g.lineJoin = 'round';
  if (glyph === '◆') {
    g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.8, 0); g.lineTo(0, r); g.lineTo(-r * 0.8, 0); g.closePath();
    g.fillStyle = c.fill; g.strokeStyle = 'rgba(10,6,4,0.9)'; g.lineWidth = Math.max(1.5, r * 0.18); g.fill(); g.stroke();
    g.restore(); return;
  }
  g.beginPath();
  if (cat === 'story') {
    // Crest: a shield with a pointed foot.
    g.moveTo(-r * 0.86, -r * 0.92); g.lineTo(r * 0.86, -r * 0.92); g.lineTo(r * 0.86, r * 0.1);
    g.quadraticCurveTo(r * 0.8, r * 0.72, 0, r * 1.08); g.quadraticCurveTo(-r * 0.8, r * 0.72, -r * 0.86, r * 0.1); g.closePath();
  } else if (cat === 'bounty') {
    g.rect(-r * 0.82, -r * 0.82, r * 1.64, r * 1.64);
  } else g.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  const grad = g.createLinearGradient(0, -r, 0, r);
  grad.addColorStop(0, '#fff6dc'); grad.addColorStop(0.35, c.fill); grad.addColorStop(1, c.deep);
  g.fillStyle = grad; g.strokeStyle = 'rgba(10,6,4,0.92)'; g.lineWidth = Math.max(1.6, r * 0.16); g.fill(); g.stroke();
  if (cat === 'bounty') { g.fillStyle = '#5a2a10'; g.beginPath(); g.arc(0, -r * 0.55, r * 0.16, 0, Math.PI * 2); g.fill(); }
  if (glyph) {
    g.fillStyle = c.text; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${Math.round(r * 1.25)}px "Lilita One", Arial, sans-serif`;
    g.fillText(glyph, 0, r * 0.06 + (cat === 'story' ? r * 0.02 : 0));
  }
  g.restore();
}

const cache = new Map<string, Texture>();
/** Overhead badge texture (cached per category and glyph); drawn at 2× for crisp scaling. */
export function questBadgeTexture(cat: MarkCat, glyph: string): Texture {
  const key = `${cat}:${glyph}`, hit = cache.get(key);
  if (hit && !hit.destroyed) return hit;
  const R = 22, D = 2, size = Math.ceil((R * 2 + 10) * D), cv = document.createElement('canvas');
  cv.width = size; cv.height = size + Math.ceil(10 * D);
  const g = cv.getContext('2d')!; g.setTransform(D, 0, 0, D, size / 2, size / 2);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, R + 8, R * 0.6, 3, 0, 0, Math.PI * 2); g.fill();
  paintQuestMark(g, cat, glyph, R);
  const tex = new Texture({ source: new CanvasSource({ resource: cv, resolution: D, scaleMode: 'linear', autoGenerateMipmaps: true }) });
  cache.set(key, tex);
  return tex;
}
