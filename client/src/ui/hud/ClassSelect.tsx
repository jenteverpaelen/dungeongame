// The connecting screen. The class select itself moved to ui/front/Front.tsx with the camp scene behind it
// (docs/rework/ui/CHARACTER_SCREENS.md).

import { text } from '../../i18n/messages';
import { useMemo } from 'preact/hooks';
import { ui, useUI } from '../store';

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
