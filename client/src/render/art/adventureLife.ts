import { Container, Graphics } from 'pixi.js';
import type { AdventureData } from '@shared/adventureTypes';
import { glowSprite } from './fx';

type Site = NonNullable<AdventureData['ambience']>['motion'][number];
type Motion = { site: Site; root: Container; parts: Container[]; phase: number };

/** Small authored population, allocated once. Ground layer keeps combat warnings above it. */
export class AdventureLife {
  readonly ground = new Container();
  private motions: Motion[] = [];
  constructor(area: AdventureData) {
    for (const site of area.ambience?.motion ?? []) {
      const root = new Container(); root.position.set(...site.position);
      const parts: Container[] = [];
      const add = (p: Container) => { parts.push(p); root.addChild(p); };
      if (site.kind === 'ripples' || site.kind === 'drips') {
        for (let i = 0; i < 3; i++) add(new Graphics()
          .ellipse(0, 0, site.width, site.width * .25)
          .stroke({ color: 0x8daba4, width: 1, alpha: .45 }));
        if (site.kind === 'drips') add(new Graphics().ellipse(0, 0, 1, 3).fill(0x8daba4));
      } else if (site.kind === 'reeds') {
        for (let i = 0; i < 5; i++) {
          const h = 20 + i % 3 * 7, x = (i - 2) * site.width / 5;
          const reed = new Graphics().moveTo(0, 0).quadraticCurveTo(4, -h / 2, 2, -h)
            .stroke({ color: 0x697750, width: 2 })
            .moveTo(0, -5).quadraticCurveTo(-10, -18, -12, -12)
            .stroke({ color: 0x8a8a60, width: 1.4 })
            .roundRect(0, -h - 6, 4, 10, 2).fill(0x706047);
          reed.x = x; add(reed);
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const mist = glowSprite(area.theme==='ashen'?0x858775:0xaebcb3, site.width, .065, true);
          mist.height = site.width * .2; mist.blendMode = 'normal'; add(mist);
        }
      }
      this.ground.addChild(root);
      this.motions.push({ site, root, parts, phase: this.motions.length * .17 });
    }
  }
  update(time: number, cx: number, cy: number, halfW: number, halfH: number): void {
    for (const m of this.motions) {
      const [x, y] = m.site.position, width = m.site.width;
      m.root.visible = Math.abs(x - cx) < halfW + width * 2 && Math.abs(y - cy) < halfH + width + 60;
      if (!m.root.visible) continue;
      for (let i = 0; i < m.parts.length; i++) {
        const p = m.parts[i], ph = (time * .13 + i / 3 + m.phase) % 1;
        switch (m.site.kind) {
          case 'ripples': case 'drips':
            if (i === 3) { p.y = -60 * (1 - ph); p.alpha = ph < .92 ? .5 : 0; }
            else { p.scale.set(.1 + ph * .9); p.alpha = Math.sin(ph * Math.PI) * .65; }
            break;
          case 'reeds': p.skew.x = Math.sin(time * .7 + i * .6 + m.phase) * .07; break;
          case 'mist':
            p.x = (ph - .5) * width; p.y = Math.sin(time * .1 + i) * 12;
            p.alpha = Math.sin(ph * Math.PI) * .065;
            break;
        }
      }
    }
  }
  destroy(): void { this.ground.destroy({ children: true }); this.motions = []; }
}
