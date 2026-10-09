import { useState } from 'preact/hooks';
import { validBestiary } from '@shared/bestiary';
import { ADVENTURES } from '@shared/adventure';
import { MONSTERS, ELITE_AFFIXES, type MonsterAttackKind } from '@shared/data/monsters';
import { ZONES } from '@shared/data/zones';
import type { CharacterSave } from '@shared/types';
import { Paged, SecHead, Tabs } from './common';

const behavior: Record<MonsterAttackKind, string> = {
  melee: 'Closes the distance and strikes after winding up. Heavy attackers can catch nearby allies in the same hit.',
  ranged: 'Fires a projectile after winding up. Move across its line of fire or break the line with solid cover.',
  lob: 'Lobs a shell at a marked landing point. Leave the marked circle before the shell lands.',
  charge: 'Commits to a straight charge after winding up. Step aside; solid scenery stops its path.',
  explode: 'Rushes into reach and prepares to burst. Move clear of the marked area.',
  none: 'Flees instead of attacking. A fleeing treasure carrier can escape before you defeat it.',
};

export function Bestiary({ save }: { save: CharacterSave }) {
  const [selected, setSelected] = useState(''), [view, setView] = useState<'creatures'|'affixes'>('creatures');
  const state = validBestiary(save.bestiary) ? save.bestiary : undefined;
  const creatures = Object.values(MONSTERS).filter(m => (state?.kills[m.id] ?? 0) > 0);
  const monster = creatures.find(m => m.id === selected) ?? creatures[0];
  const affixes = state?.affixes.map(id => ELITE_AFFIXES[id]).filter(Boolean) ?? [];
  const habitats = monster && Object.values(ZONES).filter(z => z.kind !== 'town' && (
    ADVENTURES[z.id]?.encounters.some(e => e.members.some(m => m.type === monster.id)) ||
    !ADVENTURES[z.id] && z.kind === 'field' && monster.weight > 0 && monster.themes.includes(z.theme)
  ));
  return <>
    <Tabs tabs={[{id:'creatures',label:'Creatures',badge:creatures.length},{id:'affixes',label:'Elite traits',badge:affixes.length}]} value={view} onChange={setView}/>
    <p class="pn-note">Records grow when you witness a defeat while alive and nearby. Earlier adventures are not reconstructed. These records grant no combat bonus.</p>
    {save.bestiary && !state && <p role="status">These records use an unsupported format and are being kept unchanged.</p>}
    {view === 'affixes' ? <Paged size={3} label="Elite trait pages">
      {!affixes.length && <p>No elite traits recorded yet.</p>}
      {affixes.map(a => <div key={a.id}><SecHead>{a.name}</SecHead><p>{a.desc}</p></div>)}
    </Paged> : <div class="journal-columns">
      <nav class="quest-list" aria-label="Recorded creatures"><Paged size={6} label="Creature pages">
        {creatures.map(m => <button class={'btn '+(m.id===monster?.id?'primary':'')} aria-pressed={m.id===monster?.id} onClick={()=>setSelected(m.id)} key={m.id}>
          <strong>{m.name}</strong><small>{state!.kills[m.id].toLocaleString()} witnessed</small>
        </button>)}
      </Paged></nav>
      <div class="journal-detail">{monster ? <>
        <SecHead>{monster.name}</SecHead><p>{behavior[monster.attack.kind]}</p>
        <p>Base attack: {monster.attack.element}{monster.flying ? ' · Flying' : ''}</p>
        <SecHead>Where to look</SecHead><p>{habitats?.map(z=>z.name).join(' · ') || 'Rifts and special encounters'}</p>
        <p class="pn-note">Named foes and elites may add their own attacks. Watch their telegraphs and elite traits.</p>
      </> : <p>No creatures recorded yet. Defeat a foe in the field to begin your journal.</p>}</div>
    </div>}
  </>;
}
