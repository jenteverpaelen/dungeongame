// Bottom-right MMO menu bar (docs/rework/DESIGN.md §3): icon buttons with hotkey badges and notification pips.
// Replaces the stacked text buttons that sat under the minimap. Labelled-navigation precedent: UI-ATLAS UI-IDLE-01.
import { useUI, togglePanel, type PanelId } from '../store';
import { bindings, type Action } from '../../game/bindings';
import { useLocal } from '../panels/state';
import { textTipHandlers } from '../panels/tooltip';
import { openJournal } from '../panels/adventure';
import { QUESTS } from '@shared/data/quests';
import { questState, questStatus } from '@shared/quests';
import { PARAGON_CATEGORIES, paragonPoints, paragonSpent } from '@shared/progression';
import { MAX_LEVEL } from '@shared/constants';
import type { CharacterSave } from '@shared/types';
import { UiIcon, type UiIconName } from './UiIcons';

interface Entry { id: string; icon: UiIconName; label: string; panel: PanelId; action?: Action; note: string }
const ENTRIES: Entry[] = [
  { id: 'character', icon: 'character', label: 'Character', panel: 'character', note: 'Statistics, powers and economy' },
  { id: 'inventory', icon: 'bag', label: 'Inventory', panel: 'inventory', action: 'inventory', note: 'Equipment, bag and gems' },
  { id: 'skills', icon: 'skills', label: 'Skills', panel: 'skills', action: 'skills', note: 'Loadout, tiers, runes and passives' },
  { id: 'paragon', icon: 'paragon', label: 'Paragon', panel: 'paragon', action: 'paragon', note: 'Points earned after level 70' },
  { id: 'journal', icon: 'journal', label: 'Journal', panel: 'adventure', action: 'journal', note: 'Quests, records and bestiary' },
  { id: 'map', icon: 'map', label: 'World map', panel: 'worldmap', action: 'map', note: 'Regions, routes and this area' },
  { id: 'social', icon: 'social', label: 'Social', panel: 'social', note: 'Friends, chat channels and privacy' },
  { id: 'party', icon: 'party', label: 'Party', panel: 'party', note: 'Group up and find others' },
  { id: 'settings', icon: 'settings', label: 'Settings', panel: 'settings', action: 'settings', note: 'Sound, comfort and key bindings' },
];

function paragonUnspent(c: CharacterSave): number {
  if (c.level < MAX_LEVEL) return 0;
  const pts = paragonPoints(c.paragon.level);
  return PARAGON_CATEGORIES.reduce((n, cat) => n + Math.max(0, pts[cat.id] - paragonSpent(c, cat.id)), 0);
}

/** Quests with a reward waiting to be claimed (‘?’) or newly available offers (‘!’). */
function journalPip(c: CharacterSave): { text: string; kind: 'gold' | 'info' } | null {
  let ready = 0, offers = 0;
  for (const q of QUESTS) {
    const s = questState(c, q.id);
    if (s && s.step === q.steps.length && !s.claimed) ready++;
    else if (!s && questStatus(c, q) === 'available') offers++;
  }
  if (ready) return { text: '?', kind: 'gold' };
  if (offers) return { text: '!', kind: 'info' };
  return null;
}

export function MenuBar() {
  const char = useUI((s) => s.char);
  const panels = useUI((s) => s.panels);
  const invites = useUI((s) => s.party?.incoming.length ?? 0);
  const keys = useLocal(bindings, () => Object.fromEntries(ENTRIES.filter((e) => e.action).map((e) => [e.id, bindings.label(e.action!)])) as Record<string, string>);
  if (!char) return null;
  const bagUsed = char.inventory.filter(Boolean).length, bagFull = bagUsed >= char.inventory.length - 2;
  const jp = journalPip(char);
  const pips: Record<string, { text: string; kind: 'gold' | 'info' | 'bad' } | null> = {
    skills: char.skillPoints > 0 ? { text: String(Math.min(99, char.skillPoints)), kind: 'gold' } : null,
    paragon: paragonUnspent(char) > 0 ? { text: String(Math.min(99, paragonUnspent(char))), kind: 'gold' } : null,
    inventory: bagFull ? { text: '!', kind: 'bad' } : null,
    journal: jp,
    party: invites > 0 ? { text: String(invites), kind: 'info' } : null,
  };
  const visible = ENTRIES.filter((e) => e.id !== 'paragon' || char.level >= MAX_LEVEL);
  return (
    <nav class="hud-menu interactive" aria-label="Game menu">
      {visible.map((e) => {
        const open = !!panels[e.panel];
        const pip = pips[e.id];
        const key = keys[e.id];
        return (
          <button key={e.id} type="button" class={`hm-btn${open ? ' open' : ''}${pip ? ` has-pip pip-${pip.kind}` : ''}`} aria-pressed={open}
            aria-label={`${e.label}${key ? ` (${key})` : ''}${pip ? `, ${pip.text === '!' || pip.text === '?' ? 'needs attention' : `${pip.text} unspent`}` : ''}`}
            onClick={() => { if (e.id === 'journal' && !open) openJournal(); else togglePanel(e.panel); }}
            {...textTipHandlers(() => ({ title: e.label, sub: key ? `Shortcut ${key}` : undefined, lines: [e.note, ...(e.id === 'skills' && char.skillPoints > 0 ? [`${char.skillPoints} skill ${char.skillPoints === 1 ? 'point' : 'points'} to spend`] : []), ...(e.id === 'inventory' ? [`Bag ${bagUsed} / ${char.inventory.length}`] : [])] }), `menu-${e.id}`)}>
            <UiIcon name={e.icon} size={26} />
            {key && <span class="hm-key">{key}</span>}
            {pip && <span class="hm-pip">{pip.text}</span>}
          </button>
        );
      })}
    </nav>
  );
}
