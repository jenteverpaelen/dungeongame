// Settings: Sound, Display (camera, effects, gear effects, guidance) and Controls (key bindings). Left rail of
// sections, cards of switches and sliders on the right. Storage, validation and key capture are unchanged
// (preferences.ts / bindings.ts); the markup keeps the hooks the capture scripts use (.settings-check, data-bind,
// data-gear, data-controls-editor).

import { useEffect, useRef, useState } from 'preact/hooks';
import { preferences, DEFAULT_CAMERA_ZOOM, GEAR_EFFECT_LEVELS, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM, type Preferences } from '../../game/preferences';
import { ACTIONS, bindings, keyLabel, refreshKeyboardLayout, type Action } from '../../game/bindings';
import { PanelFrame } from './common';
import { useLocal } from './state';
import { text } from '../../i18n/messages';
import { cls } from './util';
import { UiIcon, type UiIconName } from '../hud/UiIcons';

type Section = 'sound' | 'display' | 'controls';
const SECTIONS: { id: Section; label: string; icon: UiIconName; blurb: string }[] = [
  { id: 'sound', label: 'Sound', icon: 'sound', blurb: 'Volume and mute' },
  { id: 'display', label: 'Display', icon: 'display', blurb: 'Camera, effects and hints' },
  { id: 'controls', label: 'Controls', icon: 'keys', blurb: 'Key bindings and manual casts' },
];

export function SettingsPanel() {
  const { values, retained } = useLocal(preferences, s => s);
  const [section, setSection] = useState<Section>('sound');
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, []);

  const slider = (key: 'masterVolume' | 'effectsVolume' | 'ambienceVolume', label: string) => {
    const pct = Math.round(values[key] * 100);
    return (
      <label class="st-slider" style={{ '--v': `${pct}%` }}>
        <span>{label}</span><output>{pct}%</output>
        <input ref={key === 'masterVolume' ? first : undefined} type="range" min="0" max="100" step="1" aria-label={label} value={pct}
          onInput={e => preferences.set({ [key]: Number(e.currentTarget.value) / 100 })} />
      </label>
    );
  };
  /** A switch row. The label element holds only the input and its text so scripts can match on `textContent`. */
  const check = (key: keyof Pick<Preferences, 'muted' | 'cameraShake' | 'reduceFlashes' | 'lootQualityLabels' | 'combatNumbers' | 'contextualHints'>, label: string, note?: string) => (
    <div class="st-row">
      <label class="settings-check"><input type="checkbox" checked={values[key]} onChange={e => preferences.set({ [key]: e.currentTarget.checked })} /><span>{label}</span></label>
      {note && <p class="settings-note">{note}</p>}
    </div>
  );
  const gearChoice = (key: 'gearEffects' | 'otherGearEffects', label: string) => (
    <div class="settings-choice st-choice" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div class="co-seg" data-gear-group={key}>
        {GEAR_EFFECT_LEVELS.map(level => <button key={level} type="button" role="radio" aria-checked={values[key] === level} class={cls(values[key] === level && 'on')}
          data-gear={`${key}:${level}`} onClick={() => preferences.set({ [key]: level })}>{text(`gear.${level}`)}</button>)}
      </div>
    </div>
  );

  return (
    <PanelFrame id="settings" title={text('settings.title')} width={960} sub={text('settings.subtitle')}>
      <div class="co st">
        <nav class="co-nav" role="tablist" aria-label="Settings sections">
          {SECTIONS.map(s => <button key={s.id} role="tab" aria-selected={section === s.id} class={cls('co-tab', section === s.id && 'on')} onClick={() => setSection(s.id)}>
            <UiIcon name={s.icon} size={20} /><span>{s.label}</span>
          </button>)}
          <p class="co-nav-note" role="status">{text(retained ? 'settings.retained' : 'settings.sessionOnly')}</p>
          <button class="btn sm so-guild" onClick={() => preferences.reset()}>{text('settings.reset')}</button>
        </nav>

        <div class="co-body">
          {section === 'sound' && <>
            <div class="co-bar"><h3>Sound</h3><span class="co-sub">{text('settings.soundHeading')}</span></div>
            <div class="so-cards">
              <section class="so-card">
                <h4>Volume</h4>
                {slider('masterVolume', text('settings.masterVolume'))}
                {slider('effectsVolume', text('settings.effectsVolume'))}
                {slider('ambienceVolume', text('settings.ambienceVolume'))}
              </section>
              <section class="so-card">
                <h4>Mute</h4>
                {check('muted', text('settings.muted'), 'Silences effects, ambience and town sounds. Your volume levels are kept.')}
              </section>
            </div>
          </>}

          {section === 'display' && <>
            <div class="co-bar"><h3>Display</h3><span class="co-sub">Nothing here changes what happens in combat.</span></div>
            <div class="so-cards">
              <section class="so-card">
                <h4>{text('settings.cameraHeading')}</h4>
                <label class="st-slider" style={{ '--v': `${((values.cameraZoom - MIN_CAMERA_ZOOM) / (MAX_CAMERA_ZOOM - MIN_CAMERA_ZOOM)) * 100}%` }}>
                  <span>Camera scale</span><output>{Math.round(values.cameraZoom * 100)}%</output>
                  <input type="range" min={MIN_CAMERA_ZOOM * 100} max={MAX_CAMERA_ZOOM * 100} step="any" aria-label="Camera scale" value={values.cameraZoom * 100}
                    onInput={e => preferences.set({ cameraZoom: Number(e.currentTarget.value) / 100 })} />
                </label>
                <p class="settings-note">Scroll over the world: up to zoom in, down to zoom out.</p>
                <div><button class="btn sm" onClick={() => preferences.set({ cameraZoom: DEFAULT_CAMERA_ZOOM })}>Default zoom</button></div>
                {check('cameraShake', text('settings.cameraShake'), text('settings.cameraNote'))}
              </section>
              <section class="so-card">
                <h4>{text('settings.effectsHeading')}</h4>
                {check('reduceFlashes', text('settings.reduceFlashes'), text('settings.flashesNote'))}
                {check('combatNumbers', text('settings.combatNumbers'), text('settings.combatNumbersNote'))}
                {check('lootQualityLabels', text('settings.lootQualityLabels'), text('settings.lootQualityNote'))}
              </section>
              <section class="so-card">
                <h4>{text('gear.settingsHeading')}</h4>
                {gearChoice('gearEffects', text('gear.own'))}
                {gearChoice('otherGearEffects', text('gear.others'))}
                <p class="settings-note">{text('gear.settingsNote')}</p>
              </section>
              <section class="so-card">
                <h4>Guidance</h4>
                {check('contextualHints', text('guide.show'), text('guide.settingNote'))}
              </section>
            </div>
          </>}

          {section === 'controls' && <ControlsSettings />}
        </div>
      </div>
    </PanelFrame>
  );
}

function ControlsSettings() {
  const state = useLocal(bindings, s => s);
  const manual = useLocal(preferences, s => s.values.manualSkills);
  const [capture, setCapture] = useState<{ action: Action; slot: 0 | 1 } | null>(null);
  const [message, setMessage] = useState(text('controls.initial'));
  useEffect(() => { void refreshKeyboardLayout(); }, []);
  useEffect(() => {
    if (!capture) return;
    bindings.capture(true);
    const cancel = () => { bindings.capture(false); setCapture(null); setMessage(text('controls.cancelled')); };
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Tab') { cancel(); return; }
      if (e.ctrlKey || e.altKey || e.metaKey) { setMessage(text('controls.noModifiers')); return; }
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === 'Escape') { cancel(); return; }
      if (e.repeat || e.isComposing) return;
      if (e.shiftKey) { setMessage(text('controls.noShift')); return; }
      const error = bindings.assign(capture.action, capture.slot, e.code, e.key);
      if (error) { setMessage(error); return; }
      setMessage(text(`controls.${capture.action}.assigned`, { key: keyLabel(e.code, bindings.get().labels) }));
      bindings.capture(false); setCapture(null);
    };
    window.addEventListener('keydown', down, true); window.addEventListener('blur', cancel);
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('blur', cancel); bindings.capture(false); };
  }, [capture]);

  const row = ([action, label]: readonly [Action, string]) => (
    <div class="settings-binding" key={action}>
      <span>{label}</span>
      {([0, 1] as const).map(slot => {
        const code = state.values[action][slot];
        const active = capture?.action === action && capture.slot === slot;
        return <button class={cls('btn', 'st-key', active && 'on')} data-bind={`${action}:${slot}`} aria-label={text(`controls.${action}.${slot === 0 ? 'changePrimary' : 'changeAlternate'}`)}
          aria-pressed={active} title={code ?? text('controls.noAlternate')} onClick={() => {
            bindings.capture(true); setCapture({ action, slot }); setMessage(text(`controls.${action}.capture`));
          }}>{active ? text('controls.pressKey') : code ? keyLabel(code, state.labels) : text('controls.emptyKey')}</button>;
      })}
      <button class="btn st-clear" aria-label={text(`controls.${action}.clearAlternate`)} disabled={!state.values[action][1] || !!capture}
        onClick={() => { bindings.assign(action, 1, null); setMessage(text(`controls.${action}.cleared`)); }}>{text('controls.clearGlyph')}</button>
    </div>
  );
  return <div data-controls-editor class="st-controls">
    <div class="co-bar"><h3>Controls</h3><span class="co-sub">Click a key, then press the new one. Esc cancels.</span></div>
    <section class="so-card">
      <div class="st-row">
        <label class="settings-check"><input type="checkbox" checked={manual} onChange={e => preferences.set({ manualSkills: e.currentTarget.checked })} /><span>{text('controls.manualSkills')}</span></label>
        <p class="settings-note">{text('controls.manualNote')}</p>
      </div>
    </section>
    <section class="so-card st-bind-card">
      <p class="settings-note">{text('controls.note')}</p>
      <div class="settings-bindings st-two">{ACTIONS.map(row)}</div>
    </section>
    <p class="settings-note st-status" role="status" aria-live="polite">{message}</p>
    <div class="st-foot">
      <p class="settings-note">{text(state.layoutAvailable ? 'controls.layoutKnown' : 'controls.layoutFallback')} {text(state.retained ? 'controls.retained' : 'controls.sessionOnly')}</p>
      <button class="btn" disabled={!!capture} onClick={() => { bindings.reset(); setMessage(text('controls.resetDone')); }}>{text('controls.reset')}</button>
    </div>
  </div>;
}
