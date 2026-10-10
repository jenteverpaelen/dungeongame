// Collection: everything the hero has found and the rules for what to keep. Left rail of sections with progress,
// one screen of content per section (no scrolling: grids, pages and cards).

import { useState } from 'preact/hooks';
import { BASES, LEGENDARIES, SETS } from '@shared/data/items';
import { autoSalvageEligible, canWearLook, defaultLootRules, ORDINARY_RARITIES, type LootRules } from '@shared/itemCollection';
import { LOOK_SLOTS } from '@shared/protocol';
import { CLASSES } from '@shared/data/classes';
import type { ClassId, ItemLook, Slot } from '@shared/types';
import { sendChat } from '../../net/api';
import { ui } from '../store';
import { Paged, PanelFrame } from './common';
import { KIND_LABEL } from '@shared/items';
import { ItemVisual, itemHover } from './tooltip';
import { ItemGlyph, SlotGlyph } from './glyphs';
import { useU } from './state';
import { cls, run, SLOT_LABEL } from './util';
import { ItemRecipes } from './itemRecipes';
import { UiIcon, type UiIconName } from '../hud/UiIcons';
import { IconCheck } from './icons';

type Tab = 'powers' | 'sets' | 'looks' | 'rules' | 'recipes' | 'bag';
const TABS: { id: Tab; label: string; icon: UiIconName }[] = [
  { id: 'powers', label: 'Powers', icon: 'star' }, { id: 'sets', label: 'Sets', icon: 'shield' }, { id: 'looks', label: 'Appearances', icon: 'eye' },
  { id: 'rules', label: 'Loot rules', icon: 'scroll' }, { id: 'recipes', label: 'Recipes', icon: 'anvil' }, { id: 'bag', label: 'In bag', icon: 'bag' },
];
const hex = (n: number) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
const RARITY_NAME: Record<string, string> = { normal: 'Normal', magic: 'Magic', rare: 'Rare' };
const className = (c: ClassId) => CLASSES[c].name;

export function CollectionPanel() {
  const char = useU(s => s.char)!;
  const [tab, setTab] = useState<Tab>('powers');
  const [notice, setNotice] = useState('');
  const [allClasses, setAllClasses] = useState(false);
  const [slot, setSlot] = useState<Slot>('head');
  const [draft, setDraft] = useState<LootRules>(() => structuredClone(char.collection?.loot ?? defaultLootRules()));
  const looks = char.collection?.looks ?? {}, selected = char.collection?.wardrobe[slot];
  const item = char.equipment[slot];
  const candidates = Object.entries(looks).filter(([, l]) => item && canWearLook(item, l, slot));

  const powerFound = (id: string) => !!looks[`legend:${id}`] || char.cube.learned.includes(id);
  const mine = Object.values(LEGENDARIES).filter(l => !l.classes || l.classes.includes(char.classId));
  const powers = Object.values(LEGENDARIES).filter(l => allClasses || !l.classes || l.classes.includes(char.classId));
  const setPieces = (s: (typeof SETS)[string]) => s.pieces.filter(p => looks[`set:${s.id}:${p.base}`]).length;
  const mySets = Object.values(SETS).filter(s => s.classId === char.classId);
  const counts: Partial<Record<Tab, string>> = {
    powers: `${mine.filter(l => powerFound(l.id)).length}/${mine.length}`,
    sets: `${mySets.reduce((n, s) => n + setPieces(s), 0)}/${mySets.reduce((n, s) => n + s.pieces.length, 0)}`,
    looks: String(Object.keys(looks).length),
    bag: String(char.inventory.filter(Boolean).length),
  };
  const toggle = (key: 'hidden' | 'leave' | 'salvage', r: (typeof ORDINARY_RARITIES)[number]) => {
    setNotice('');
    setDraft({ ...draft, [key]: draft[key].includes(r) ? draft[key].filter(x => x !== r) : [...draft[key], r] });
  };

  return <PanelFrame id="collection" title="Collection" width={1060} sub="Everything you have found, and what to keep">
    <div class="co">
      <nav class="co-nav" role="tablist" aria-label="Collection sections">
        {TABS.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} class={cls('co-tab', tab === t.id && 'on')} onClick={() => setTab(t.id)}>
          <UiIcon name={t.icon} size={20} /><span>{t.label}</span>{counts[t.id] && <em>{counts[t.id]}</em>}
        </button>)}
        <p class="co-nav-note">Legendary powers and set pieces are recorded the first time they drop for this hero.</p>
      </nav>
      <div class="co-body">
        {tab === 'powers' && <>
          <div class="co-bar">
            <h3>Legendary powers</h3>
            <div class="co-seg">
              <button class={cls(!allClasses && 'on')} onClick={() => setAllClasses(false)}>{className(char.classId)}</button>
              <button class={cls(allClasses && 'on')} onClick={() => setAllClasses(true)}>All classes</button>
            </div>
          </div>
          <Paged size={8} key={`powers-${allClasses}`} class="co-paged">{powers.map(l => {
            const base = BASES[l.base];
            const look: ItemLook = { shape: base.shape, primary: l.colors.primary, secondary: l.colors.secondary, glow: l.colors.glow, variant: 0 };
            const extracted = char.cube.learned.includes(l.id), found = powerFound(l.id);
            return <article class={cls('co-card', 'power', !found && 'locked')} key={l.id}>
              <span class="co-ico" style={{ '--g': hex(l.colors.glow) }}><ItemGlyph look={look} kind={base.kind} size={48} mono={!found} /></span>
              <div class="co-card-main">
                <header><b style={{ color: found ? '#e8ac59' : undefined }}>{l.name}</b>
                  <span class="chip">{l.classes ? l.classes.map(c => className(c as ClassId)).join(', ') : 'Any class'}</span>
                  <span class="chip dim">{KIND_LABEL[base.kind]}</span></header>
                <p>{l.power.replace('{v}', `${l.range[0]}–${l.range[1]}`)}</p>
                <footer class={cls(extracted ? 'ok' : found ? 'mid' : 'off')}>
                  {extracted ? <><IconCheck size={11} /> Power extracted</> : found ? 'Found. Extract it at the Cube to learn the power.' : 'Not found yet'}
                </footer>
              </div>
            </article>;
          })}</Paged>
        </>}

        {tab === 'sets' && <>
          <div class="co-bar"><h3>Item sets</h3><span class="co-sub">Wear more pieces of one set to unlock its bonuses.</span></div>
          <div class="co-sets">
            {Object.values(SETS).map(s => {
              const n = setPieces(s);
              return <article class={cls('co-set', s.classId === char.classId && 'mine')} key={s.id} style={{ '--g': hex(s.colors.glow) }}>
                <header><b>{s.name}</b><span class="chip">{className(s.classId)}</span><em>{n}/{s.pieces.length}</em></header>
                <div class="co-pieces">{s.pieces.map(p => {
                  const found = !!looks[`set:${s.id}:${p.base}`], b = BASES[p.base];
                  const look: ItemLook = { shape: b.shape, primary: s.colors.primary, secondary: s.colors.secondary, glow: s.colors.glow, variant: 0 };
                  return <span key={p.base} class={cls('co-piece', found && 'found')} title={`${p.name}${found ? '' : ' (not found)'}`}><ItemGlyph look={look} kind={b.kind} size={36} mono={!found} /></span>;
                })}</div>
                <ul class="co-bonuses">{s.bonuses.map(b => <li key={b.count} class={cls(n >= b.count && 'on')}><i>{b.count}</i><span>{b.text}</span></li>)}</ul>
              </article>;
            })}
          </div>
        </>}

        {tab === 'looks' && <>
          <div class="co-bar"><h3>Appearances</h3><span class="co-sub">Visit the Mystic to apply one. Stats and ownership never change; choices are free.</span></div>
          <div class="co-slots">{LOOK_SLOTS.map(s => <button key={s} class={cls('co-slot', slot === s && 'on')} title={SLOT_LABEL[s as Slot]} onClick={() => setSlot(s as Slot)}>
            <SlotGlyph slot={s as Slot} size={30} /><span>{SLOT_LABEL[s as Slot]}</span></button>)}</div>
          <div class="co-equipped">
            <span>{item ? <>Worn here: <b>{item.name}</b></> : 'Wear an item in this slot first.'}</span>
            <button class="btn sm" disabled={!selected} onClick={() => void run('collection', { action: 'look', slot, key: null })}>Restore item appearance</button>
          </div>
          <Paged key={slot} size={6} class="co-paged">{candidates.map(([key, l]) => <article class="co-card look" key={key}>
            <span class="co-ico"><ItemVisual item={l} size={38} /></span>
            <div class="co-card-main"><header><b>{l.name}</b></header></div>
            <button class="btn sm" disabled={selected === key} onClick={() => void run('collection', { action: 'look', slot, key })}>{selected === key ? 'Applied' : 'Apply at Mystic'}</button>
          </article>)}</Paged>
          {!candidates.length && <p class="co-empty">No compatible appearances found yet. New looks are recorded as items drop.</p>}
        </>}

        {tab === 'rules' && <>
          <div class="co-bar"><h3>Loot rules</h3><span class="co-sub">Visibility, walk-over pickup and salvage are independent. Legendary and Set items always stay visible.</span></div>
          <div class="co-matrix" role="group" aria-label="Loot rules by rarity">
            <span /><b>Hide ground drop</b><b>Leave on ground</b><b>Auto-salvage at Smith</b>
            {ORDINARY_RARITIES.map(r => <>
              <span class={`co-rar r-${r}`}>{RARITY_NAME[r] ?? r}</span>
              {(['hidden', 'leave', 'salvage'] as const).map(key => {
                const on = draft[key].includes(r);
                return <button key={`${r}-${key}`} class={cls('co-switch', on && 'on')} role="checkbox" aria-checked={on}
                  aria-label={`${r} ${key === 'hidden' ? 'hide drop' : key === 'leave' ? 'leave on ground' : 'auto-salvage'}`} onClick={() => toggle(key, r)}>
                  <i /><span>{on ? 'On' : 'Off'}</span></button>;
              })}
            </>)}
          </div>
          <p class="co-sub">Auto-salvage destroys eligible bag items when you open the nearby Blacksmith. It never touches worn gear or your stash. Protected, merchant, Ancient, empowered, enchanted and filled-socket items are excluded. Hidden drops still exist and expire normally.</p>
          <p class="co-sub"><b>{char.inventory.filter(i => i && autoSalvageEligible(char, i, draft)).length}</b> bag items would be salvaged on your next visit after saving.</p>
          <div class="co-actions">
            <button class="btn primary" onClick={() => void run('collection', { action: 'rules', rules: draft }).then(r => { if (r.ok) setNotice('Loot rules saved.'); })}>Save loot rules</button>
            <button class="btn" onClick={() => { const rules = defaultLootRules(); setDraft(rules); void run('collection', { action: 'rules', rules }); }}>Restore defaults</button>
            <span role="status" class="co-notice">{notice}</span>
          </div>
        </>}

        {tab === 'recipes' && <div class="co-recipes"><ItemRecipes char={char} /></div>}

        {tab === 'bag' && <>
          <div class="co-bar"><h3>In your bag</h3><span class="co-sub">Link an item in chat so others can inspect it.</span></div>
          <Paged size={8} key={tab} class="co-paged">{char.inventory.filter(i => !!i).map(i => <article class="co-card look" key={i!.id} {...itemHover(() => i, { compare: true })}>
            <span class="co-ico"><ItemVisual item={i!} size={42} /></span>
            <div class="co-card-main"><header><b>{i!.name}</b></header></div>
            <button class="btn sm" onClick={() => { const s = ui.get(); sendChat(`[[item:${i!.id}]]`, s.chatChannel, s.chatTarget); }}>Link in {ui.get().chatChannel} chat</button>
          </article>)}</Paged>
        </>}
      </div>
    </div>
  </PanelFrame>;
}
