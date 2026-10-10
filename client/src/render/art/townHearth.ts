// Hearthmere (stage 'complete', painted ground): ground chunks + houses + scenery (docs/rework/DESIGN.md §4).
import { Container } from 'pixi.js';
import type { TownData } from '@shared/townTypes';
import type { MapLayers } from './index';
import { TownGround } from './townGround';
import { townHouses } from './townHouses';
import { townScenery } from './townScenery';

export function buildHearthmere(t: TownData): MapLayers {
  const start = performance.now();
  const ground = new Container(); ground.addChild(new TownGround(t));
  const g = performance.now(), houses = townHouses(t), h = performance.now(), scenery = townScenery(t), end = performance.now();
  for (const m of ['town-ground', 'town-architecture', 'town-props']) performance.clearMeasures(m);
  performance.measure('town-ground', { start, end: g }); performance.measure('town-architecture', { start: g, end: h }); performance.measure('town-props', { start: h, end });
  return { ground, decals: new Container(), sorted: [...houses, ...scenery] };
}
