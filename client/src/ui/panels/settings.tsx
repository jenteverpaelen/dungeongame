import { useEffect, useRef, useState } from 'preact/hooks';
import { preferences, DEFAULT_CAMERA_ZOOM, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM, type Preferences } from '../../game/preferences';
import { ACTIONS, bindings, keyLabel, refreshKeyboardLayout, type Action } from '../../game/bindings';
import { PanelFrame, SecHead, Tabs, Paged } from './common';
import { useLocal } from './state';
import { text } from '../../i18n/messages';

export function SettingsPanel() {
  const { values, retained } = useLocal(preferences, s => s);
  const [tab, setTab] = useState<'sound' | 'controls'>('sound');
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  const slider = (key: 'masterVolume' | 'effectsVolume' | 'ambienceVolume', label: string) => (
    <label class="settings-volume">
      <span>{label}</span><output>{Math.round(values[key] * 100)}%</output>
      <input ref={key === 'masterVolume' ? first : undefined} type="range" min="0" max="100" step="1"
        aria-label={label} value={Math.round(values[key] * 100)}
        onInput={e => preferences.set({ [key]: Number(e.currentTarget.value) / 100 })} />
    </label>
  );
  const check = (key: keyof Pick<Preferences, 'muted' | 'cameraShake' | 'reduceFlashes' | 'lootQualityLabels' | 'combatNumbers' | 'contextualHints'>, label: string) => (
    <label class="settings-check"><input type="checkbox" checked={values[key]} onChange={e => preferences.set({ [key]: e.currentTarget.checked })} /><span>{label}</span></label>
  );
  return (
    <PanelFrame id="settings" title={text('settings.title')} width={820} sub={text('settings.subtitle')}>
      <Tabs tabs={[{ id: 'sound', label: text('settings.tabSound') }, { id: 'controls', label: text('settings.tabControls') }]} value={tab} onChange={setTab} />
      {tab === 'controls' ? <ControlsSettings /> : <div class="settings-content">
        <div class="settings-columns"><section><SecHead>{text('settings.soundHeading')}</SecHead>
        {slider('masterVolume', text('settings.masterVolume'))}
        {check('muted', text('settings.muted'))}
        {slider('effectsVolume', text('settings.effectsVolume'))}
        {slider('ambienceVolume', text('settings.ambienceVolume'))}
        <SecHead>{text('settings.cameraHeading')}</SecHead>
        <label class="settings-volume"><span>Camera scale</span><output>{Math.round(values.cameraZoom * 100)}%</output>
          <input type="range" min={MIN_CAMERA_ZOOM * 100} max={MAX_CAMERA_ZOOM * 100} step="any" aria-label="Camera scale" value={values.cameraZoom * 100}
            onInput={e => preferences.set({ cameraZoom: Number(e.currentTarget.value) / 100 })} />
        </label>
        <p class="settings-note">Scroll over the world: up to zoom in, down to zoom out.</p>
        <button class="btn sm" onClick={() => preferences.set({ cameraZoom: DEFAULT_CAMERA_ZOOM })}>Default zoom</button>
        {check('cameraShake', text('settings.cameraShake'))}
        <p class="settings-note">{text('settings.cameraNote')}</p>
        </section><section><SecHead>{text('settings.effectsHeading')}</SecHead>
        {check('reduceFlashes', text('settings.reduceFlashes'))}
        <p class="settings-note">{text('settings.flashesNote')}</p>
        {check('lootQualityLabels', text('settings.lootQualityLabels'))}
        <p class="settings-note">{text('settings.lootQualityNote')}</p>
        {check('combatNumbers', text('settings.combatNumbers'))}
        <p class="settings-note">{text('settings.combatNumbersNote')}</p>
        {check('contextualHints',text('guide.show'))}
        <p class="settings-note">{text('guide.settingNote')}</p>
        </section></div><p class="settings-note" role="status">{text(retained ? 'settings.retained' : 'settings.sessionOnly')}</p>
        <button class="btn" onClick={() => preferences.reset()}>{text('settings.reset')}</button>
      </div>}
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
  return <div class="settings-content" data-controls-editor>
    <label class="settings-check"><input type="checkbox" checked={manual} onChange={e => preferences.set({ manualSkills: e.currentTarget.checked })} /><span>{text('controls.manualSkills')}</span></label>
    <p class="settings-note">{text('controls.manualNote')}</p>
    <p class="settings-note">{text('controls.note')}</p>
    <div class="settings-bindings"><Paged size={8} label="Key binding pages">
      {ACTIONS.map(([action, label]) => <div class="settings-binding" key={action}>
        <span>{label}</span>
        {([0, 1] as const).map(slot => {
          const code = state.values[action][slot];
          const active = capture?.action === action && capture.slot === slot;
          return <button class="btn" data-bind={`${action}:${slot}`} aria-label={text(`controls.${action}.${slot === 0 ? 'changePrimary' : 'changeAlternate'}`)}
            aria-pressed={active} title={code ?? text('controls.noAlternate')} onClick={() => {
              bindings.capture(true); setCapture({ action, slot }); setMessage(text(`controls.${action}.capture`));
            }}>{active ? text('controls.pressKey') : code ? keyLabel(code, state.labels) : text('controls.emptyKey')}</button>;
        })}
        <button class="btn" aria-label={text(`controls.${action}.clearAlternate`)} disabled={!state.values[action][1] || !!capture}
          onClick={() => { bindings.assign(action, 1, null); setMessage(text(`controls.${action}.cleared`)); }}>{text('controls.clearGlyph')}</button>
      </div>)}
    </Paged></div>
    <p class="settings-note" role="status" aria-live="polite">{message}</p>
    <p class="settings-note">{text(state.layoutAvailable ? 'controls.layoutKnown' : 'controls.layoutFallback')}</p>
    <p class="settings-note">{text(state.retained ? 'controls.retained' : 'controls.sessionOnly')}</p>
    <button class="btn" disabled={!!capture} onClick={() => { bindings.reset(); setMessage(text('controls.resetDone')); }}>{text('controls.reset')}</button>
  </div>;
}
