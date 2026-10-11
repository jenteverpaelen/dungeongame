// Display names for power-source labels (`<kind>:<id>` as server/src/sim/powerRuntime.ts records them in TermSource):
// the build tools (BUILD-TOOLS.md T1/T2) show which item, set bonus, passive, node or rune a number comes from.

import { LEGENDARIES, SETS } from './data/items';
import { INSCRIPTIONS } from './data/inscriptions';
import { SKILLS } from './data/skills';
import { PASSIVES } from './passives';

/** "Faultcleaver", "Cinder Oath (6)", "Ironplough: Brace", "Last Rampart" … ; the raw label when the id is unknown. */
export function powerSourceName(label: string): string {
  const i = label.indexOf(':');
  const kind = label.slice(0, i), id = label.slice(i + 1);
  switch (kind) {
    case 'legendary': return LEGENDARIES[id]?.name ?? id;
    case 'set': { const [, set, count] = id.split(':'); return SETS[set] ? `${SETS[set].name} (${count})` : id; }
    case 'passive': return PASSIVES.find((p) => p.id === id)?.name ?? id;
    case 'node': { const [skill, node] = id.split(':'); const s = SKILLS[skill]; const n = s?.nodes?.find((x) => x.id === node); return s && n ? `${s.name}: ${n.name}` : id; }
    case 'rune': { const [skill, , rune] = id.split(':'); return SKILLS[skill]?.runes.find((r) => r.id === rune)?.name ?? id; }
    case 'inscription': return INSCRIPTIONS[id.replace(/^inscription:/, '')]?.name ?? id;
    case 'affix': return 'Item affixes';
    default: return label;
  }
}
