import { useEffect, useRef, useState } from 'preact/hooks';
import { preferences, type Preferences } from '../../game/preferences';
import { ACTIONS, bindings, keyLabel, refreshKeyboardLayout, type Action } from '../../game/bindings';
import { PanelFrame, SecHead, Tabs } from './common';
import { useLocal } from './state';

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
  const check = (key: keyof Pick<Preferences, 'muted' | 'cameraShake' | 'reduceFlashes'>, label: string) => (
    <label class="settings-check"><input type="checkbox" checked={values[key]} onChange={e => preferences.set({ [key]: e.currentTarget.checked })} /><span>{label}</span></label>
  );
  return (
    <PanelFrame id="settings" title="Settings" width={480} sub="Sound, comfort & controls">
      <Tabs tabs={[{ id: 'sound', label: 'Sound & comfort' }, { id: 'controls', label: 'Controls' }]} value={tab} onChange={setTab} />
      {tab === 'controls' ? <ControlsSettings /> : <div class="settings-content">
        <SecHead>Sound</SecHead>
        {slider('masterVolume', 'Master volume')}
        {check('muted', 'Mute all sound')}
        {slider('effectsVolume', 'Effects')}
        {slider('ambienceVolume', 'Ambience')}
        <SecHead>Camera</SecHead>
        {check('cameraShake', 'Camera shake')}
        <p class="settings-note">Shake from impacts can be turned off. Your view distance stays the same.</p>
        <SecHead>Effects</SecHead>
        {check('reduceFlashes', 'Reduce flashes')}
        <p class="settings-note">Hide hit flashes and level-up bursts. Steady particle flicker and warning pulses. Spell effects and attack warnings remain visible.</p>
        <p class="settings-note" role="status">{retained ? 'Settings are remembered in this browser.' : 'Settings apply for this session. Browser storage is unavailable.'}</p>
        <button class="btn" onClick={() => preferences.reset()}>Restore defaults</button>
      </div>}
    </PanelFrame>
  );
}

function ControlsSettings() {
  const state = useLocal(bindings, s => s);
  const [capture, setCapture] = useState<{ action: Action; slot: 0 | 1 } | null>(null);
  const [message, setMessage] = useState('Select a key to change it.');
  useEffect(() => { void refreshKeyboardLayout(); }, []);
  useEffect(() => {
    if (!capture) return;
    bindings.capture(true);
    const cancel = () => { bindings.capture(false); setCapture(null); setMessage('Key change cancelled.'); };
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Tab') { cancel(); return; }
      if (e.ctrlKey || e.altKey || e.metaKey) { setMessage('Use one key without Ctrl, Alt or the Windows/Command key.'); return; }
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === 'Escape') { cancel(); return; }
      if (e.repeat || e.isComposing) return;
      if (e.shiftKey) { setMessage('Use one key without Shift.'); return; }
      const error = bindings.assign(capture.action, capture.slot, e.code, e.key);
      if (error) { setMessage(error); return; }
      setMessage(`${ACTIONS.find(([a]) => a === capture.action)![1]} assigned to ${keyLabel(e.code, bindings.get().labels)}.`);
      bindings.capture(false); setCapture(null);
    };
    window.addEventListener('keydown', down, true); window.addEventListener('blur', cancel);
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('blur', cancel); bindings.capture(false); };
  }, [capture]);
  return <div class="settings-content" data-controls-editor>
    <p class="settings-note">Choose a primary key and an optional alternate. Escape cancels a key change. F1 always opens Controls.</p>
    <div class="settings-bindings">
      {ACTIONS.map(([action, label]) => <div class="settings-binding" key={action}>
        <span>{label}</span>
        {([0, 1] as const).map(slot => {
          const code = state.values[action][slot];
          const active = capture?.action === action && capture.slot === slot;
          return <button class="btn" data-bind={`${action}:${slot}`} aria-label={`Change ${label} ${slot === 0 ? 'primary' : 'alternate'} key`}
            aria-pressed={active} title={code ?? 'No alternate key'} onClick={() => {
              bindings.capture(true); setCapture({ action, slot }); setMessage(`Press a key for ${label}. Escape cancels.`);
            }}>{active ? 'Press key…' : code ? keyLabel(code, state.labels) : '—'}</button>;
        })}
        <button class="btn" aria-label={`Clear ${label} alternate key`} disabled={!state.values[action][1] || !!capture}
          onClick={() => { bindings.assign(action, 1, null); setMessage(`${label} alternate cleared.`); }}>×</button>
      </div>)}
    </div>
    <p class="settings-note" role="status" aria-live="polite">{message}</p>
    <p class="settings-note">Bindings follow physical keys. {state.layoutAvailable ? 'Labels match your keyboard layout.' : 'Default labels show QWERTY positions; reassigned keys show the character you pressed.'} Enter, Escape, Tab, function keys and modifiers stay reserved.</p>
    <p class="settings-note">{state.retained ? 'Controls are remembered in this browser.' : 'Controls apply for this session. Browser storage is unavailable.'}</p>
    <button class="btn" disabled={!!capture} onClick={() => { bindings.reset(); setMessage('Default controls restored.'); }}>Restore default controls</button>
  </div>;
}
