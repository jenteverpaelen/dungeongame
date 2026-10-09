import { useEffect, useRef } from 'preact/hooks';
import { preferences, type Preferences } from '../../game/preferences';
import { PanelFrame, SecHead } from './common';
import { useLocal } from './state';

export function SettingsPanel() {
  const { values, retained } = useLocal(preferences, s => s);
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
  const check = (key: keyof Pick<Preferences, 'muted' | 'cameraShake'>, label: string) => (
    <label class="settings-check"><input type="checkbox" checked={values[key]} onChange={e => preferences.set({ [key]: e.currentTarget.checked })} /><span>{label}</span></label>
  );
  return (
    <PanelFrame id="settings" title="Settings" width={480} sub="Sound & comfort">
      <div class="settings-content">
        <SecHead>Sound</SecHead>
        {slider('masterVolume', 'Master volume')}
        {check('muted', 'Mute all sound')}
        {slider('effectsVolume', 'Effects')}
        {slider('ambienceVolume', 'Ambience')}
        <SecHead>Camera</SecHead>
        {check('cameraShake', 'Camera shake')}
        <p class="settings-note">Shake from impacts can be turned off. Your view distance stays the same.</p>
        <p class="settings-note" role="status">{retained ? 'Settings are remembered in this browser.' : 'Settings apply for this session. Browser storage is unavailable.'}</p>
        <button class="btn" onClick={() => preferences.reset()}>Restore defaults</button>
      </div>
    </PanelFrame>
  );
}
