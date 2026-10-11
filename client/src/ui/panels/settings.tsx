// Settings: Sound, Display, Graphics, Accessibility, Controls (keyboard) and Gamepad. Left rail of sections, cards of
// switches, segmented choices and sliders on the right; every section fits one screen (no scrolling). Storage and
// validation live in preferences.ts / bindings.ts / gamepad.ts. All visible text comes from the message catalogue
// (i18n/settingsMessages.ts); the file is in scripts/i18n-localized.json. Hooks kept for capture scripts:
// .settings-check, data-bind, data-gear, data-controls-editor.

import { useEffect, useRef, useState } from 'preact/hooks';
import {
  preferences, BACKGROUND_FPS, COLOR_VISIONS, DEFAULT_CAMERA_ZOOM, DEFAULT_UI_SCALE, DENSITIES, FPS_CAPS, GEAR_EFFECT_LEVELS, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM,
  MIN_UI_SCALE, MAX_UI_SCALE, MOTION_PREFS, NUMBER_SIZES, RENDER_SCALES, WEAPON_ART_MODES, type Preferences,
} from '../../game/preferences';
import { CVD_PALETTES } from '../../game/quality';
import { ACTIONS, bindings, keyLabel, refreshKeyboardLayout, type Action } from '../../game/bindings';
import { BUTTON_NAMES, PAD_ACTIONS, padBindings, type PadAction } from '../../game/gamepad';
import { RARITY_COLORS } from '@shared/items';
import { PanelFrame } from './common';
import { RarityMark } from './rarityMark';
import { useLocal } from './state';
import { useUI } from '../store';
import { text } from '../../i18n/messages';
import { cls } from './util';
import { UiIcon, type UiIconName } from '../hud/UiIcons';
import { appliedWeaponArt, weaponArtFromUrl } from '../../game/weaponArtPreview';

type Section = 'sound' | 'display' | 'graphics' | 'access' | 'controls' | 'gamepad';
const SECTIONS: { id: Section; icon: UiIconName }[] = [
  { id: 'sound', icon: 'sound' }, { id: 'display', icon: 'display' }, { id: 'graphics', icon: 'graphics' },
  { id: 'access', icon: 'access' }, { id: 'controls', icon: 'keys' }, { id: 'gamepad', icon: 'gamepad' },
];
type Bool = { [K in keyof Preferences]: Preferences[K] extends boolean ? K : never }[keyof Preferences];

/** A switch row. The label element holds only the input and its text so scripts can match on `textContent`. */
function Check({ k, label, note }: { k: Bool; label: string; note?: string }) {
  const v = useLocal(preferences, s => s.values[k]);
  return <div class="st-row">
    <label class="settings-check"><input type="checkbox" checked={v} onChange={e => preferences.set({ [k]: e.currentTarget.checked })} /><span>{label}</span></label>
    {note && <p class="settings-note">{note}</p>}
  </div>;
}
/** A segmented single choice (radio group) over preference values. */
function Choice<T extends string | number>({ label, value, options, name, set, data, bare }: { label: string; value: T; options: readonly T[]; name: (o: T) => string; set: (o: T) => void; data?: string; bare?: boolean }) {
  return <div class={cls('settings-choice st-choice', bare && 'bare')} role="radiogroup" aria-label={label}>
    <span>{label}</span>
    <div class="co-seg" data-gear-group={data}>
      {options.map(o => <button key={String(o)} type="button" role="radio" aria-checked={value === o} class={cls(value === o && 'on')}
        data-gear={data ? `${data}:${o}` : undefined} onClick={() => set(o)}>{name(o)}</button>)}
    </div>
  </div>;
}
function Slider({ label, value, min, max, step = 1, show, set, onCommit }: { label: string; value: number; min: number; max: number; step?: number | 'any'; show: string; set: (v: number) => void; onCommit?: () => void }) {
  return <label class="st-slider" style={{ '--v': `${((value - min) / (max - min)) * 100}%` }}>
    <span>{label}</span><output>{show}</output>
    <input type="range" min={min} max={max} step={step} aria-label={label} value={value} onInput={e => set(Number(e.currentTarget.value))}
      onChange={onCommit} onPointerUp={onCommit} onKeyUp={onCommit} />
  </label>;
}

export function SettingsPanel() {
  const retained = useLocal(preferences, s => s.retained);
  const [section, setSection] = useState<Section>('sound');
  return (
    <PanelFrame id="settings" title={text('settings.title')} width={980} sub={text('settings.subtitle')}>
      <div class="co st">
        <nav class="co-nav" role="tablist" aria-label={text('set.sections')}>
          {SECTIONS.map(s => <button key={s.id} role="tab" aria-selected={section === s.id} class={cls('co-tab', section === s.id && 'on')} onClick={() => setSection(s.id)}>
            <UiIcon name={s.icon} size={20} /><span>{text(`set.section.${s.id}`)}</span>
          </button>)}
          <p class="co-nav-note" role="status">{text(retained ? 'settings.retained' : 'settings.sessionOnly')}</p>
          <button class="btn sm so-guild" onClick={() => preferences.reset()}>{text('settings.reset')}</button>
        </nav>
        <div class="co-body">
          {section === 'sound' && <SoundSettings />}
          {section === 'display' && <DisplaySettings />}
          {section === 'graphics' && <GraphicsSettings />}
          {section === 'access' && <AccessSettings />}
          {section === 'controls' && <ControlsSettings />}
          {section === 'gamepad' && <GamepadSettings />}
        </div>
      </div>
    </PanelFrame>
  );
}

function SoundSettings() {
  const v = useLocal(preferences, s => s.values);
  const first = useRef<HTMLDivElement>(null);
  useEffect(() => { first.current?.querySelector('input')?.focus(); }, []);
  const vol = (k: 'masterVolume' | 'effectsVolume' | 'alertsVolume' | 'ambienceVolume', label: string) =>
    <Slider label={label} value={Math.round(v[k] * 100)} min={0} max={100} show={`${Math.round(v[k] * 100)}%`} set={n => preferences.set({ [k]: n / 100 })} />;
  return <>
    <div class="co-bar"><h3>{text('set.section.sound')}</h3><span class="co-sub">{text('settings.soundHeading')}</span></div>
    <div class="so-cards">
      <section class="so-card" ref={first}>
        <h4>{text('set.sound.volumeHeading')}</h4>
        {vol('masterVolume', text('settings.masterVolume'))}
        {vol('effectsVolume', text('settings.effectsVolume'))}
        {vol('alertsVolume', text('set.sound.alerts'))}
        {vol('ambienceVolume', text('settings.ambienceVolume'))}
        <p class="settings-note">{text('set.sound.alertsNote')}</p>
      </section>
      <section class="so-card">
        <h4>{text('set.sound.muteHeading')}</h4>
        <Check k="muted" label={text('settings.muted')} note={text('set.sound.mutedNote')} />
        <Check k="muteInBackground" label={text('set.sound.background')} note={text('set.sound.backgroundNote')} />
      </section>
    </div>
  </>;
}

function DisplaySettings() {
  const v = useLocal(preferences, s => s.values);
  return <>
    <div class="co-bar"><h3>{text('set.section.display')}</h3><span class="co-sub">{text('set.display.sub')}</span></div>
    <div class="so-cards">
      <InterfaceSize />
      <section class="so-card">
        <h4>{text('settings.cameraHeading')}</h4>
        <Slider label={text('set.display.camera')} value={v.cameraZoom * 100} min={MIN_CAMERA_ZOOM * 100} max={MAX_CAMERA_ZOOM * 100} step="any"
          show={`${Math.round(v.cameraZoom * 100)}%`} set={n => preferences.set({ cameraZoom: n / 100 })} />
        <p class="settings-note">{text('set.display.cameraNote')}</p>
        <div><button class="btn sm" onClick={() => preferences.set({ cameraZoom: DEFAULT_CAMERA_ZOOM })}>{text('set.display.cameraDefault')}</button></div>
      </section>
      <section class="so-card">
        <h4>{text('gear.settingsHeading')}</h4>
        <Choice label={text('gear.own')} value={v.gearEffects} options={GEAR_EFFECT_LEVELS} name={o => text(`gear.${o}`)} set={o => preferences.set({ gearEffects: o })} data="gearEffects" />
        <Choice label={text('gear.others')} value={v.otherGearEffects} options={GEAR_EFFECT_LEVELS} name={o => text(`gear.${o}`)} set={o => preferences.set({ otherGearEffects: o })} data="otherGearEffects" />
        <p class="settings-note">{text('gear.settingsNote')}</p>
      </section>
      <WeaponArtCard />
      <section class="so-card">
        <h4>{text('set.display.guidance')}</h4>
        <Check k="contextualHints" label={text('guide.show')} note={text('guide.settingNote')} />
        <Check k="advancedTooltips" label={text('set.display.advanced')} note={text('set.display.advancedNote')} />
      </section>
    </div>
  </>;
}

/** Weapon art preview (docs/rework/gear/ART-DIRECTION.md §7): chosen once per page load, so a change asks for a reload. */
function WeaponArtCard() {
  const v = useLocal(preferences, s => s.values.weaponArt);
  const fromUrl = weaponArtFromUrl();
  return <section class="so-card">
    <h4>{text('gear.artHeading')}</h4>
    <Choice label={text('gear.art')} value={v} options={WEAPON_ART_MODES} name={o => text(`gear.art.${o}`)} set={o => preferences.set({ weaponArt: o })} data="weaponArt" />
    <p class="settings-note">{text('gear.artNote')}{fromUrl ? ` ${text('gear.artUrl')}` : ''}</p>
    {!fromUrl && appliedWeaponArt() !== v && <div><button class="btn sm" onClick={() => location.reload()}>{text('set.gfx.reload')}</button></div>}
  </section>;
}

/** Interface size, applied when the slider is released: the window itself grows, and a thumb that moves away under the
 *  pointer while dragging would be unusable. */
function InterfaceSize() {
  const stored = useLocal(preferences, s => s.values.uiScale);
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? stored;
  const commit = () => { if (draft !== null) { preferences.set({ uiScale: draft }); setDraft(null); } };
  return (
    <section class="so-card">
      <h4>{text('set.display.sizeHeading')}</h4>
      <Slider label={text('set.display.size')} value={Math.round(shown * 100)} min={Math.round(MIN_UI_SCALE * 100)} max={Math.round(MAX_UI_SCALE * 100)} step={5}
        show={`${Math.round(shown * 100)}%`} set={n => setDraft(n / 100)} onCommit={commit} />
      <p class="settings-note">{text('set.display.sizeNote')}</p>
      <div><button class="btn sm" onClick={() => { setDraft(null); preferences.set({ uiScale: DEFAULT_UI_SCALE }); }}>{text('set.display.sizeDefault')}</button></div>
    </section>
  );
}

function GraphicsSettings() {
  const v = useLocal(preferences, s => s.values);
  const fps = useUI(s => s.fps);
  const [loadedAa] = useState(v.antialias);
  const density = (o: 'full' | 'reduced' | 'minimal') => text(`set.gfx.density.${o}`);
  return <>
    <div class="co-bar"><h3>{text('set.section.graphics')}</h3><span class="co-sub">{text('set.gfx.sub')}</span></div>
    <div class="so-cards">
      <section class="so-card">
        <h4>{text('set.gfx.presetHeading')}</h4>
        <Choice label={text('set.gfx.presetHeading')} value={v.graphicsPreset} options={['low', 'medium', 'high', 'custom'] as const}
          name={o => text(`set.gfx.preset.${o}`)} set={o => { if (o !== 'custom') preferences.set({ graphicsPreset: o }); }} data="graphicsPreset" bare />
        <p class="settings-note">{text('set.gfx.presetNote')}</p>
        <Choice label={text('set.gfx.resolution')} value={v.renderScale} options={RENDER_SCALES}
          name={o => (o === 0 ? text('set.gfx.res.auto') : `${o}×`)} set={o => preferences.set({ renderScale: o })} data="renderScale" />
        <p class="settings-note">{text('set.gfx.resolutionNote')}</p>
        <Choice label={text('set.gfx.effects')} value={v.effectsDensity} options={DENSITIES} name={density} set={o => preferences.set({ effectsDensity: o })} data="effectsDensity" />
        <Choice label={text('set.gfx.ambient')} value={v.ambientDensity} options={DENSITIES} name={density} set={o => preferences.set({ ambientDensity: o })} data="ambientDensity" />
        <p class="settings-note">{text('set.gfx.densityNote')}</p>
      </section>
      <section class="so-card">
        <h4>{text('set.gfx.fpsHeading')}</h4>
        <Choice label={text('set.gfx.maxFps')} value={v.maxFps} options={FPS_CAPS} name={o => (o === 0 ? text('set.gfx.fps.none') : String(o))} set={o => preferences.set({ maxFps: o })} data="maxFps" />
        <Choice label={text('set.gfx.bgFps')} value={v.backgroundFps} options={BACKGROUND_FPS} name={o => (o === 0 ? text('set.gfx.fps.same') : String(o))} set={o => preferences.set({ backgroundFps: o })} data="backgroundFps" />
        <p class="settings-note">{text('set.gfx.fpsNote')}</p>
        <p class="st-now" role="status">{text('set.gfx.now', { fps: String(fps || 0) })}</p>
        <Check k="lowSpecHint" label={text('set.gfx.hint')} />
        <Check k="antialias" label={text('set.gfx.antialias')} note={text('set.gfx.antialiasNote')} />
        {loadedAa !== v.antialias && <div><button class="btn sm" onClick={() => location.reload()}>{text('set.gfx.reload')}</button></div>}
      </section>
    </div>
  </>;
}

const RARITIES = ['normal', 'magic', 'rare', 'legendary', 'set'] as const;
function AccessSettings() {
  const v = useLocal(preferences, s => s.values);
  const palette = v.colorVision === 'default' ? RARITY_COLORS : CVD_PALETTES[v.colorVision];
  return <>
    <div class="co-bar"><h3>{text('set.section.access')}</h3><span class="co-sub">{text('set.access.sub')}</span></div>
    <div class="so-cards st-access">
      <section class="so-card">
        <h4>{text('set.access.motionHeading')}</h4>
        <Choice label={text('set.access.motion')} value={v.motion} options={MOTION_PREFS} name={o => text(`set.access.motion.${o}`)} set={o => preferences.set({ motion: o })} data="motion" />
        <p class="settings-note">{text('set.access.motionNote')}</p>
        <Check k="cameraShake" label={text('settings.cameraShake')} />
        {v.cameraShake && <Slider label={text('set.access.shakeStrength')} value={Math.round(v.shakeStrength * 100)} min={0} max={100} show={`${Math.round(v.shakeStrength * 100)}%`}
          set={n => preferences.set({ shakeStrength: n / 100 })} />}
        <Check k="reduceFlashes" label={text('settings.reduceFlashes')} note={text('settings.flashesNote')} />
      </section>
      <section class="so-card">
        <h4>{text('set.access.colourHeading')}</h4>
        <Choice label={text('set.access.vision')} value={v.colorVision} options={COLOR_VISIONS} name={o => text(`set.access.vision.${o}`)} set={o => preferences.set({ colorVision: o })} data="colorVision" />
        <div class="st-swatches" aria-label={text('set.access.preview')}>
          {RARITIES.map(r => <span key={r} class={cls('st-swatch', `cell r-${r}`)} style={{ '--sw': palette[r] }}>
            <RarityMark item={{ rarity: r }} /><i style={{ background: palette[r] }} /><b>{text(`set.access.rarity.${r}`)}</b>
          </span>)}
        </div>
        <p class="settings-note">{text('set.access.visionNote')}</p>
        <Check k="rarityShapes" label={text('set.access.shapes')} note={text('set.access.shapesNote')} />
        <Check k="lootQualityLabels" label={text('settings.lootQualityLabels')} note={text('settings.lootQualityNote')} />
      </section>
      <section class="so-card st-numbers">
        <h4>{text('set.access.numbersHeading')}</h4>
        <Check k="combatNumbers" label={text('settings.combatNumbers')} />
        <Choice label={text('set.access.numberSize')} value={v.numberSize} options={NUMBER_SIZES} name={o => text(`set.access.size.${o}`)} set={o => preferences.set({ numberSize: o })} data="numberSize" />
        <div class="st-two">
          <Check k="numbersOthers" label={text('set.access.others')} />
          <Check k="numbersTaken" label={text('set.access.taken')} />
          <Check k="numbersHealing" label={text('set.access.healing')} />
          <Check k="numbersCritsOnly" label={text('set.access.crits')} />
        </div>
      </section>
    </div>
  </>;
}

function ControlsSettings() {
  const state = useLocal(bindings, s => s);
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
    <div class="co-bar"><h3>{text('set.section.controls')}</h3><span class="co-sub">{text('controls.note')}</span></div>
    <section class="so-card">
      <Check k="manualSkills" label={text('controls.manualSkills')} note={text('controls.manualNote')} />
    </section>
    <section class="so-card st-bind-card">
      <div class="settings-bindings st-two">{ACTIONS.map(row)}</div>
    </section>
    <p class="settings-note st-status" role="status" aria-live="polite">{message}</p>
    <div class="st-foot">
      <p class="settings-note">{text(state.layoutAvailable ? 'controls.layoutKnown' : 'controls.layoutFallback')} {text(state.retained ? 'controls.retained' : 'controls.sessionOnly')}</p>
      <button class="btn" disabled={!!capture} onClick={() => { bindings.reset(); setMessage(text('controls.resetDone')); }}>{text('controls.reset')}</button>
    </div>
  </div>;
}

function GamepadSettings() {
  const pad = useLocal(padBindings, s => s);
  useEffect(() => {
    if (!pad.capturing) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); padBindings.set({ capturing: null, message: 'pad.cancelled' }); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [pad.capturing]);
  const actionName = (a: PadAction) => text(`set.pad.action.${a}`);
  const status = (() => {
    const m = pad.message;
    if (pad.capturing) return text('set.pad.capture', { action: actionName(pad.capturing) });
    if (m.startsWith('pad.assigned:')) { const [, a, b] = m.split(':'); return text('set.pad.assigned', { action: actionName(a as PadAction), button: BUTTON_NAMES[Number(b)] }); }
    if (m === 'pad.conflict') return text('set.pad.conflict');
    if (m === 'pad.reserved') return text('set.pad.reserved');
    if (m === 'pad.cancelled') return text('set.pad.cancelled');
    if (m === 'pad.reset') return text('set.pad.resetDone');
    return text('set.pad.movement');
  })();
  return <div class="st-controls">
    <div class="co-bar"><h3>{text('set.section.gamepad')}</h3><span class="co-sub">{text('set.pad.sub')}</span></div>
    <section class="so-card st-pad-status">
      <p class={cls('st-pad-dev', pad.connected && 'on')}><UiIcon name="gamepad" size={22} /><span>{pad.connected ? text('set.pad.connected', { name: pad.connected }) : text('set.pad.none')}</span></p>
    </section>
    <section class="so-card st-bind-card">
      <div class="settings-bindings st-two">{PAD_ACTIONS.map(a => {
        const b = pad.values[a], active = pad.capturing === a;
        return <div class="settings-binding st-pad-row" key={a}>
          <span>{actionName(a)}</span>
          <button class={cls('btn', 'st-key', active && 'on')} data-pad={a} aria-pressed={active}
            onClick={() => padBindings.set({ capturing: active ? null : a, message: '' })}>{active ? text('set.pad.press') : b === null ? text('set.pad.unbound') : BUTTON_NAMES[b]}</button>
          <button class="btn st-clear" disabled={b === null || !!pad.capturing} aria-label={`${text('set.pad.clear')} ${actionName(a)}`}
            onClick={() => { padBindings.assign(a, null); padBindings.set({ message: '' }); }}>{text('controls.clearGlyph')}</button>
        </div>;
      })}</div>
    </section>
    <p class="settings-note st-status" role="status" aria-live="polite">{status}</p>
    <div class="st-foot">
      <p class="settings-note">{text(pad.retained ? 'set.pad.retained' : 'controls.sessionOnly')}</p>
      <button class="btn" disabled={!!pad.capturing} onClick={() => { padBindings.reset(); padBindings.set({ message: 'pad.reset' }); }}>{text('set.pad.reset')}</button>
    </div>
  </div>;
}
