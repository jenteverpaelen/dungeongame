import type { NpcRole } from '../../shared/src/mapgen';
import type { Session } from './net/session';

export function requireNear(s: Session, role: NpcRole): string | null {
  const rec = s.rec, n = rec?.inst.map.town?.npcs.find(n => n.role === role);
  if (rec?.kind === 'town' && n && rec.inst.canInteract(s, n.x, n.y, n.interactionRadius)) return null;
  return `Stand beside the ${n?.name ?? role} in Hearthmere to use this service`;
}
