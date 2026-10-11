// Draws the per-player town progress props (client/src/game/townProgress.ts) with the town's own kit art (zoneBuild's
// `place`), y-sorted with everything else. Cosmetic only: no collision, no service change.
import { Container } from 'pixi.js';
import type { CharacterSave } from '@shared/types';
import type { TownData } from '@shared/townTypes';
import { TOWN_PROGRESS } from '../game/townProgress';
import { flameSprite, glowSprite } from './art/fx';
import { place } from './art/zoneBuild';

export class TownProgressView {
  private shown = new Map<string, Container>();
  constructor(private town: TownData, private entities: Container) {}

  refresh(save: CharacterSave | null) {
    for (const p of TOWN_PROGRESS) {
      const on = !!save && p.on(save), have = this.shown.get(p.id);
      if (on && !have) {
        const npc = this.town.npcs.find((n) => n.role === p.role);
        if (!npc) continue;
        const x = npc.x + p.dx, y = npc.y + p.dy;
        const made = place(p.kind, p.s ?? 1, p.v ?? 0, x, y, p.flip ?? false);
        if (!made) continue;
        if (p.kind === 'brazier') {
          const f = flameSprite(0xef9b4c, 20), g = glowSprite(0xffb060, 110, 0.42, true);
          f.position.set(0, -46); g.position.set(0, -50); made.root.addChild(g, f);
          made.root.onRender = () => { const t = performance.now() / 1000; f.scale.y = 0.22 + Math.sin(t * 9 + x) * 0.04; g.alpha = 0.38 + Math.sin(t * 6.1 + y) * 0.05; };
        }
        made.root.zIndex = y;
        made.root.label = `progress:${p.id}`;
        this.entities.addChild(made.root);
        this.shown.set(p.id, made.root);
      } else if (!on && have) {
        have.destroy({ children: true });
        this.shown.delete(p.id);
      }
    }
  }

  /** Ids currently drawn (QA). */
  ids(): string[] { return [...this.shown.keys()]; }

  destroy() { for (const c of this.shown.values()) if (!c.destroyed) c.destroy({ children: true }); this.shown.clear(); }
}
