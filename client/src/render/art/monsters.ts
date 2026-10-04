import { Container } from 'pixi.js';
import type { EliteTier } from '@shared/items';
import type { EntityView, ViewState } from '../types';
export class MonsterArt implements EntityView {
  readonly root = new Container(); height = 40;
  constructor(_d: string, _e: EliteTier, _a: string[], _s: number) {}
  update(_dt: number, _s: ViewState) {} hit() {} die(_e: number, d: () => void) { d(); } destroy() { this.root.destroy(); }
}
