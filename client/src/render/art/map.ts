import { Container } from 'pixi.js';
import type { MapData } from '@shared/mapgen';
export function buildLayers(_m: MapData) { return { ground: new Container(), sorted: [], decals: new Container() }; }
