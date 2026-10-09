// Class select / enter-world screen. Each card carries a <canvas data-preview="<classId>"> that main.ts animates.

import { text } from '../../i18n/messages';
import type { HeroAppearance } from '@shared/appearance';
import { useMemo, useState } from 'preact/hooks';
import { ui, useUI } from '../store';
import { session } from '../../net/api';
import { CLASSES, CLASS_IDS, type ClassDef } from '@shared/data/classes';
import { SKILLS } from '@shared/data/skills';
import type { ClassId } from '@shared/types';
import { ClassEmblem, Divider, SkillGlyph } from './Glyphs';
import { RESOURCE_STYLES, hex, safeGet, safeSet } from './util';

const NAME_RE = /^[A-Za-z0-9]{2,16}$/;
const MAIN_STAT = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence' } as const;

function Embers() {
  const sparks = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    x: (i * 37 + (i % 3) * 11) % 100,
    d: 9 + ((i * 7) % 9),
    delay: -((i * 1.9) % 14),
    s: 2 + (i % 4),
    dx: ((i * 13) % 40) - 20,
  })), []);
  return (
    <div class="cs-embers" aria-hidden="true">
      {sparks.map((e) => (
        <i style={{ left: `${e.x}%`, width: `${e.s}px`, height: `${e.s}px`, animationDuration: `${e.d}s`, animationDelay: `${e.delay}s`, '--dx': `${e.dx}px` }} />
      ))}
    </div>
  );
}

function ClassCard(p: { def: ClassDef; selected: boolean; onPick: () => void; appearance?:HeroAppearance }) {
  const { def } = p;
  const sig = SKILLS[def.signatureSkill];
  const theme = hex(def.themeColor);
  const res = RESOURCE_STYLES[def.id];
  return (
    <button
      type="button"
      class={`cs-card interactive${p.selected ? ' selected' : ''}`}
      style={{ '--theme': theme, '--res': res.mid }}
      onClick={p.onPick}
      aria-pressed={p.selected}
    >
      <div class="cs-stage">
        <div class="cs-halo" />
        <canvas data-preview={def.id} data-appearance={p.appearance?JSON.stringify(p.appearance):''} width={220} height={220} />
        <div class="cs-plinth" />
      </div>
      <div class="cs-card-body">
        <div class="cs-class">{def.name}</div>
        <div class="cs-title" style={{ color: theme }}>{def.title}</div>
        <Divider class="cs-div" />
        <p class="cs-blurb">{text(`intro.class.${def.id}`)}</p><small>{text('intro.signature',{level:String(sig?.unlock??1)})}</small>
        <div class="cs-chips">{def.playstyle.split(' · ').map((c) => <span key={c}>{c}</span>)}</div>
        <div class="cs-meta">
          <div class="cs-sig">
            {sig ? <SkillGlyph glyph={sig.icon.glyph} color={hex(sig.icon.color)} class="cs-sig-glyph" /> : <ClassEmblem classId={def.id} />}
            <div><small>Signature</small><b>{def.signature}</b></div>
          </div>
          <div class="cs-res">
            <i style={{ background: `radial-gradient(circle at 35% 30%, ${res.hi}, ${res.mid} 60%, ${res.lo})` }} />
            <div><small>{MAIN_STAT[def.mainStat]}</small><b>{def.resource.name}</b></div>
          </div>
        </div>
      </div>
    </button>
  );
}

export function ClassSelect() {
  const error = useUI((s) => s.error);
  const [cls, setCls] = useState<ClassId>(() => {
    const c = safeGet('hearthfall.class');
    return CLASS_IDS.includes(c as ClassId) ? (c as ClassId) : 'warrior';
  });
  const [name, setName] = useState(() => safeGet('hearthfall.name') ?? '');
  const [appearance,setAppearance]=useState<HeroAppearance|undefined>();
  const [tutorial,setTutorial]=useState(true);
  const [touched, setTouched] = useState(false);
  const valid = NAME_RE.test(name);

  const enter = () => {
    setTouched(true);
    if (!valid) return;
    safeSet('hearthfall.name', name);
    safeSet('hearthfall.class', cls);
    ui.set({ error: null });
    session.start(name, cls, {tutorial,...(appearance?{appearance}:{})});
  };

  return (
    <div class="cs-root">
      <Embers />
      <div class="cs-vignette" />
      <header class="cs-header">
        <div class="cs-eyebrow">The last hearth on the frontier</div>
        <h1 class="cs-logo">Hearthfall</h1>
        <Divider class="cs-logo-div" />
        <p class="cs-tagline">{text('intro.preview')}</p>
      </header>
      <div class="cs-cards" role="radiogroup" aria-label="Choose a class">
        {CLASS_IDS.map((id) => <ClassCard key={id} def={CLASSES[id]} selected={cls === id} appearance={cls===id?appearance:undefined} onPick={() => setCls(id)} />)}
      </div>
      <fieldset class="cs-appearance interactive"><legend>{text('intro.appearance')}</legend>
        {(['skin','hair','style'] as const).map(field=><label key={field}>{text(`intro.${field}`)}<select value={appearance?.[field]??cls} onChange={e=>setAppearance({...appearance??{skin:cls,hair:cls,style:cls},[field]:e.currentTarget.value as ClassId})}>{CLASS_IDS.map(id=><option value={id} key={id}>{text(`intro.${field}.${id}`)}</option>)}</select></label>)}
        <button class="btn" onClick={()=>setAppearance(undefined)}>{text('intro.default')}</button>
        <small>{text('intro.appearanceNote')}</small>
        <label class="settings-check"><input type="checkbox" checked={tutorial} onChange={e=>setTutorial(e.currentTarget.checked)}/>{text('intro.newChoice')}</label>
      </fieldset>
      <footer class="cs-enter">
        <label class="cs-name interactive">
          <span>Name your hero</span>
          <input
            value={name}
            maxLength={16}
            spellcheck={false}
            autocomplete="off"
            placeholder="Hero name"
            onInput={(e) => { setName((e.currentTarget as HTMLInputElement).value.replace(/[^A-Za-z0-9]/g, '')); setTouched(true); }}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') enter(); }}
          />
        </label>
        <button type="button" class="btn primary cs-go interactive" disabled={!valid} onClick={enter}>Enter World</button>
        <div class={`cs-hint${touched && !valid ? ' bad' : ''}`}>
          {error ? error : touched && !valid ? 'Names use 2 to 16 letters or numbers.' : '2 to 16 letters or numbers'}
        </div>
      </footer>
    </div>
  );
}

export function Connecting() {
  const error = useUI((s) => s.error);
  return (
    <div class="cs-root cs-connecting">
      <Embers />
      <div class="cs-vignette" />
      <div class="cs-wait">
        {!error && <div class="cs-spinner" />}
        <h1 class="cs-logo small">Hearthfall</h1>
        <div class="cs-wait-text">{error ? error : 'Stepping through the gate…'}</div>
        {!error&&<p class="help-note">{text('intro.loading')}</p>}
        {error && <button type="button" class="btn interactive" onClick={() => ui.set({ screen: 'select', error: null })}>Back</button>}
      </div>
    </div>
  );
}
