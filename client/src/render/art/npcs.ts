import { Container } from 'pixi.js';
import type { EntityView, ViewState } from '../types';
export class NpcArt implements EntityView {
  readonly root = new Container(); height = 40;
  constructor(_r: string, _n: string) {}
  update(_dt: number, _s: ViewState) {} hit() {} die(_e: number, d: () => void) { d(); } destroy() { this.root.destroy(); }
}
export class PortalArt extends NpcArt {}
