import type { AdventureData } from './adventureTypes';
import { closest, groundBoundary, onFloor } from './townGeometry';
import { TILE } from './constants';

/** A conservative water footprint check: the enclosing circle stays off every floor edge. */
export function validateAdventureAmbience(a: AdventureData): string[] {
  const errors: string[] = [], ambient = a.ambience;
  if (!ambient) return errors;
  const edges = groundBoundary(a.geometry), ids = new Set<string>();
  for (const site of [...ambient.motion, ...ambient.sounds]) {
    const key = `${'width' in site ? 'motion' : 'sound'}/${site.id}`;
    const at = `${a.id}/ambience/${key}`, [x, y] = site.position;
    if (!site.id.trim() || ids.has(key)) errors.push(`${at}: empty/duplicate id`);
    ids.add(key);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > a.size[0] * TILE || y > a.size[1] * TILE)
      errors.push(`${at}: invalid position`);
    const extent = 'width' in site ? site.width : site.radius;
    if (!Number.isFinite(extent) || extent <= 0) errors.push(`${at}: invalid extent`);
    if ('width' in site) {
      if (!['ripples', 'reeds', 'mist', 'drips'].includes(site.kind)) errors.push(`${at}: unknown motion`);
      if (site.kind === 'ripples' || site.kind === 'drips') {
        if (onFloor(a.geometry, x, y) || edges.some(e => {
          const p = closest(x, y, e); return Math.hypot(x - p[0], y - p[1]) <= site.width;
        })) errors.push(`${at}: water footprint overlaps ground`);
        if (x - extent < 0 || y - extent < 0 || x + extent > a.size[0] * TILE || y + extent > a.size[1] * TILE)
          errors.push(`${at}: water footprint outside map`);
      }
    } else if (!['water', 'wind', 'fire'].includes(site.kind)) errors.push(`${at}: unknown sound`);
  }
  return errors;
}
