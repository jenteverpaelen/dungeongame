// Inspect: another online player's equipped gear (their privacy setting decides). Left column: name search, who they
// are and a paperdoll-shaped slot grid. Right column: how their hero looks to others (gear rank showcase) and the full
// card of the selected piece. Read-only snapshot: no item access or control.

import { useEffect, useState } from 'preact/hooks';
import type { Inspection } from '@shared/social';
import type { Slot } from '@shared/types';
import { CLASSES } from '@shared/data/classes';
import { lookFromEquipment } from '@shared/gearVisual';
import { cmd } from '../../net/api';
import { ui, useUI, togglePanel } from '../store';
import { PanelFrame } from './common';
import { GearShowcaseLook } from './character';
import { SlotGlyph } from './glyphs';
import { ItemCard, ItemVisual, itemHover } from './tooltip';
import { cls, rarityClass, SLOT_LABEL } from './util';
import { ClassEmblem } from '../hud/Glyphs';
import { UiIcon } from '../hud/UiIcons';

export function openInspection(name: string) { ui.set({ inspectionName: name }); togglePanel('inspect', true); }

/** Paperdoll order (3 columns, 5 rows); `null` is an empty grid cell. */
const DOLL: (Slot | null)[] = [
  'shoulders', 'head', 'neck',
  'hands', 'chest', 'wrists',
  'ring1', 'waist', 'ring2',
  'mainhand', 'legs', 'offhand',
  null, 'feet', null,
];
const hex = (n: number) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');

export function InspectPanel() {
  const target = useUI(s => s.inspectionName);
  const [name, setName] = useState(target), [profile, setProfile] = useState<Inspection | null>(null), [slot, setSlot] = useState<Slot>('mainhand');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = async (value: string) => {
    setBusy(true); setError(''); setProfile(null);
    try {
      const result = await cmd<Inspection>('inspect', { name: value.trim() });
      if (result.ok && result.data) {
        setProfile(result.data);
        const first = DOLL.find((s): s is Slot => !!s && !!result.data!.equipment[s]);
        if (first && !result.data.equipment[slot]) setSlot(first);
      } else setError(result.err ?? 'Equipment is unavailable');
    } finally { setBusy(false); }
  };
  useEffect(() => { setName(target); if (target) void load(target); }, [target]);
  const item = profile?.equipment[slot];
  const worn = profile ? DOLL.filter((s): s is Slot => !!s && !!profile.equipment[s]).length : 0;
  return <PanelFrame id="inspect" title="Inspect equipment" width={940}
    sub={profile ? `${profile.name} · Level ${profile.level} ${CLASSES[profile.classId].name}` : 'Shared equipped items'}>
    <div class="ins">
      <div class="ins-left">
        <form class="so-add" onSubmit={e => { e.preventDefault(); void load(name); }}>
          <input maxLength={16} value={name} placeholder="Online character name" aria-label="Online character name" onInput={e => setName(e.currentTarget.value)} autoComplete="off" />
          <button class="btn primary" disabled={busy || !name.trim()}>{busy ? 'Checking…' : 'Inspect'}</button>
        </form>
        {error && <p class="so-warn" role="status">{error}</p>}
        {profile && <>
          <header class="ins-who" style={{ '--cls': hex(CLASSES[profile.classId].themeColor) }}>
            <span class="pt-emblem"><ClassEmblem classId={profile.classId} /></span>
            <div><b>{profile.name}</b><span>Level {profile.level} {CLASSES[profile.classId].name} · {worn} of {DOLL.filter(Boolean).length} slots worn</span></div>
          </header>
          <div class="ins-doll" role="listbox" aria-label="Equipment slots">
            {DOLL.map((s, i) => {
              if (!s) return <span key={`gap-${i}`} class="ins-gap" />;
              const it = profile.equipment[s];
              return <button key={s} role="option" aria-selected={slot === s} title={SLOT_LABEL[s]} aria-label={`${SLOT_LABEL[s]}: ${it?.name ?? 'empty'}`}
                class={cls('cell', 'ins-cell', it ? rarityClass(it) : 'empty', slot === s && 'on')} onClick={() => setSlot(s)}
                {...(it ? itemHover(() => it) : {})}>
                {it ? <ItemVisual item={it} size={40} /> : <SlotGlyph slot={s} size={30} />}
              </button>;
            })}
          </div>
        </>}
      </div>
      <div class="ins-item">
        {profile ? <>
          <GearShowcaseLook look={lookFromEquipment(profile.classId, profile.equipment)} local={false} />
          {item ? <ItemCard item={item} char={null} alt={false} tag="Shared equipment" />
            : <div class="so-empty"><UiIcon name="bag" size={36} /><b>{SLOT_LABEL[slot]} is empty</b><span>Nothing is worn in this slot.</span></div>}
        </> : !error && <div class="so-empty ins-idle"><UiIcon name="inspect" size={44} /><b>{busy ? 'Checking shared equipment…' : 'Whose gear do you want to see?'}</b>
          <span>Type the name of an online character. Inspection follows their privacy setting and grants no item access or control.</span></div>}
      </div>
    </div>
    <p class="st-hint">This is an online equipment snapshot. Refresh to see changes.</p>
  </PanelFrame>;
}
