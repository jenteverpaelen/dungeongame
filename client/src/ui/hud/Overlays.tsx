// Full-screen and modal overlays: death screen, AFK report, interact prompt and the F1 help panel.

import { useRef, useState } from 'preact/hooks';
import { ui, togglePanel, useUI } from '../store';
import { ZONES } from '@shared/data/zones';
import { fmtDuration, fmtInt } from '@shared/format';
import type { Materials } from '@shared/types';
import type { NpcRole } from '@shared/mapgen';
import { Divider } from './Glyphs';
import { ACTIONS, bindings, CAST_ACTIONS, keyLabel } from '../../game/bindings';
import { preferences } from '../../game/preferences';
import { useLocal } from '../panels/state';
import { IntroductionLibrary, HelpQuestions, PlaytestTimings } from './Introduction';
import { introduced } from '@shared/onboarding';
import { GuidanceLibrary } from './Guidance';
import { Tabs } from '../panels/common';
import { text } from '../../i18n/messages';
import { session } from '../../net/api';

// ───────────────────────── Death ─────────────────────────

export function DeathScreen() {
  const dead = useUI((s) => s.me?.dead ?? 0);
  const total = useRef(0);
  if (dead <= 0) { total.current = 0; return null; }
  total.current = Math.max(total.current, dead, 3000);
  const secs = Math.ceil(dead / 1000);
  return (
    <div class="death">
      <div class="death-veil" />
      <div class="death-vignette" />
      <div class="death-content">
        <div class="death-skull" />
        <h1>You Have Died</h1>
        <Divider class="death-div" />
        <div class="death-sub">Returning to the fight in <b>{secs}</b></div>
        <div class="death-bar"><i style={{ width: `${(100 * (1 - dead / total.current)).toFixed(1)}%` }} /></div>
      </div>
    </div>
  );
}

// ───────────────────────── AFK report ─────────────────────────

import { MATERIAL_NAMES as MAT_NAMES } from '@shared/materialNames';

export function AfkModal() {
  const afk = useUI((s) => s.afk);
  if (!afk) return null;
  const mats = (Object.keys(MAT_NAMES) as (keyof Materials)[]).filter((k) => (afk.mats[k] ?? 0) > 0);
  const zone = ZONES[afk.zone]?.name ?? afk.zone;
  const claim = () => ui.set({ afk: null });
  return (
    <div class="afk-backdrop interactive">
      <div class="afk-modal frame">
        <div class="afk-head">
          <div class="afk-eyebrow">Your hero kept the hearth</div>
          <h2 class="title-plate">While You Were Away</h2>
          <div class="afk-time">{fmtDuration(afk.ms)}{zone ? <> <i>in</i> {zone}</> : null}</div>
        </div>
        <Divider class="afk-div" />
        <div class="afk-rows">
          <div class="afk-row"><span>Monsters slain</span><b>{fmtInt(afk.kills)}</b></div>
          <div class="afk-row"><span>Experience</span><b class="xp">{fmtInt(afk.xp)}</b></div>
          {afk.levels > 0 && <div class="afk-row hi"><span>Levels gained</span><b>+{afk.levels}</b></div>}
          <div class="afk-row"><span>Gold</span><b class="gold">{fmtInt(afk.gold)}</b></div>
        </div>
        {mats.length > 0 && (
          <div class="afk-mats">
            <div class="afk-mats-title">Materials</div>
            {mats.map((k) => <div class="afk-row sm" key={k}><span>{MAT_NAMES[k]}</span><b>{fmtInt(afk.mats[k] ?? 0)}</b></div>)}
          </div>
        )}
        <button class="btn primary afk-claim" onClick={claim}>Claim</button>
      </div>
    </div>
  );
}

// ───────────────────────── Interact prompt ─────────────────────────

const VERBS: Partial<Record<NpcRole, string>> = {
  quest: 'Talk to', clue: 'Interact with', blacksmith: 'Open', jeweler: 'Open', mystic: 'Open',
  cube: 'Open', stash: 'Open', obelisk: 'Use', waypoint: 'Use', paragon: 'Visit', healer: 'Speak with', vendor: 'Trade with',
};

export function InteractPrompt() {
  const it = useUI((s) => s.interact);
  const key = useLocal(bindings, () => bindings.label('interact'));
  if (!it) return null;
  const verb = VERBS[it.role];
  if (!verb) return null; // training dummies and the like have nothing to press E for
  return (
    <button type="button" class="hud-interact interactive" key={it.name} onClick={() => session.interact()}>
      <span class={`ip-key${key.length > 1 ? ' wide' : ''}`}>{key}</span>
      <span class="ip-text"><em>{verb}</em> {it.name}</span>
    </button>
  );
}

// ───────────────────────── Help (F1) ─────────────────────────

const FIXED_BINDS: [string, string][] = [
  ['Enter', 'Chat'],
  ['F1', 'This help'],
  ['F2', 'Prototype tools'],
  ['F3', 'Town collision overlay'],
  ['Esc', 'Close windows'],
];

export function HelpPanel() {
  const open = useUI((s) => !!s.panels.help);
  const tab=useUI(s=>s.helpTab),save=useUI(s=>s.char);
  const setTab=(helpTab:import('../store').UIState['helpTab'])=>ui.set({helpTab});
  const state = useLocal(bindings, s => s);
  const manual = useLocal(preferences, s => s.values.manualSkills);
  if (!open) return null;
  return (
    <div class="help-wrap">
      <div class="help-panel frame interactive">
        <button class="help-close" onClick={() => togglePanel('help', false)} aria-label="Close">&#x2715;</button>
        <h2 class="title-plate">{text(tab==='controls'?'guide.controls':tab==='guide'?'guide.title':tab==='intro'?'intro.title':tab==='faq'?'intro.faq':'intro.timings')}</h2>
        <Divider class="help-div" />
        <Tabs tabs={[{id:'controls',label:text('guide.controls')},{id:'guide',label:text('guide.title')},{id:'intro',label:text('intro.title')},{id:'faq',label:text('intro.faq')},{id:'timings',label:text('intro.timings')}]} value={tab} onChange={setTab}/>
        {tab==='guide'?<GuidanceLibrary/>:tab==='intro'?<IntroductionLibrary/>:tab==='faq'?<HelpQuestions/>:tab==='timings'?<PlaytestTimings/>:<>
        <ul class="help-binds">
          {ACTIONS.filter(([action]) => introduced(save,action)&&(manual || !CAST_ACTIONS.some(a => a === action))).map(([action, label]) => <li key={action}>
            <span class="keys">{state.values[action].filter((k): k is string => k !== null).map(k => <kbd key={k}>{keyLabel(k, state.labels)}</kbd>)}</span>
            <span class="desc">{label}</span>
          </li>)}
          {FIXED_BINDS.map(([k, d]) => (
            <li key={k}>
              <span class="keys"><kbd>{k}</kbd></span>
              <span class="desc">{d}</span>
            </li>
          ))}
        </ul>
        <p class="help-note">{text(manual ? 'controls.manualOn' : 'controls.manualOff')}</p>
        </>}
        <button class="btn" onClick={() => { togglePanel('help', false); togglePanel('settings', true); }}>Settings & key bindings</button>
      </div>
    </div>
  );
}
