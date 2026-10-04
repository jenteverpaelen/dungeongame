import { Container } from 'pixi.js';
import type { EntityView, ViewState } from '../types';
export class SummonArt implements EntityView {
  readonly root = new Container(); height = 40;
  constructor(_t: string) {}
  update(_dt: number, _s: ViewState) {} hit() {} die(_e: number, d: () => void) { d(); } destroy() { this.root.destroy(); }
}
