// Quest moments on the HUD (docs/rework/quests/DESIGN.md §6, §8): the reading card after using an object (never a window
// over the world) and the hold bar of a repair objective. Both sit low in the centre, above the skill bar.
import { useEffect, useState } from 'preact/hooks';
import { questText as t } from '@shared/data/questMessages';
import { ui, useUI } from '../store';

const READING_MS = 7000;

export function ReadingCard() {
  const reading = useUI((s) => s.reading);
  useEffect(() => {
    if (!reading) return;
    const id = setTimeout(() => { if (ui.get().reading === reading) ui.set({ reading: null }); }, READING_MS);
    return () => clearTimeout(id);
  }, [reading]);
  if (!reading) return null;
  return <button class="reading-card interactive" onClick={() => ui.set({ reading: null })} aria-live="polite">
    <strong>{reading.title}</strong>
    <span>{reading.text}</span>
  </button>;
}

/** Town portal cast bar (the hold bar's look). */
export function RecallBar() {
  const recall = useUI((s) => s.recall);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!recall) return;
    let raf = 0; const loop = () => { tick((n) => n + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [recall]);
  if (!recall) return null;
  const k = Math.min(1, (performance.now() - recall.start) / recall.ms);
  return <div class="hold-bar recall-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(k * 100)}>
    <span class="hold-name">Town portal</span>
    <span class="hold-track"><i style={{ width: `${k * 100}%` }} /></span>
    <span class="hold-hint">Stand still · moving or a hit stops it</span>
  </div>;
}

export function HoldBar() {
  const hold = useUI((s) => s.hold);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!hold) return;
    let raf = 0; const loop = () => { tick((n) => n + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [hold]);
  if (!hold) return null;
  const k = Math.min(1, (performance.now() - hold.start) / hold.ms);
  return <div class="hold-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(k * 100)}>
    <span class="hold-name">{hold.name}</span>
    <span class="hold-track"><i style={{ width: `${k * 100}%` }} /></span>
    <span class="hold-hint">{t('ui.quest.holding')}</span>
  </div>;
}
