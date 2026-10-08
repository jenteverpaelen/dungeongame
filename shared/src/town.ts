import source from './data/town/hearthmere.json';
import type { TownData } from './townTypes';
import type { MapData } from './mapgen';
import { inGround } from './townGeometry';
import { TILE } from './constants';

export function loadAuthoredTown(seed: number): MapData {
  // Each map owns its data; a debug editor cannot mutate another channel's geometry.
  const town = structuredClone(source) as unknown as TownData;
  const [w, h] = town.size, tiles = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (inGround(town, (x + .5) * TILE, (y + .5) * TILE)) tiles[y * w + x] = 1;
  }
  return { zone: town.id, theme: 'town', seed, w, h, tiles, props: [], spawns: [], entry: town.entry, portals: town.portals, npcs: town.npcs, town };
}
