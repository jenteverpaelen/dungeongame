// Hand-drawn item silhouettes. They are the fallback whenever itemIconUrl() returns '' (and the
// source of the faint empty-slot glyphs on the paperdoll). Colours follow the item's ItemLook.

import type { ComponentChildren } from 'preact';
import type { ItemKind, ItemLook, Slot } from '@shared/types';
import { hex, lighten, darken } from './icons';

/** Union-of-parts shape: one merged dark outline, a flat fill, then a bevel/shading overlay. */
function U({ d, c = 'p' }: { d: string[]; c?: 'p' | 's' | 'd' }) {
  return (
    <g>
      <g class="ig-o">{d.map((x) => <path d={x} />)}</g>
      <g class={`ig-f-${c}`}>{d.map((x) => <path d={x} />)}</g>
      <g class="ig-sh">{d.map((x) => <path d={x} />)}</g>
    </g>
  );
}
const K = ({ d }: { d: string }) => <path class="ig-k" d={d} />;
const L = ({ d }: { d: string }) => <path class="ig-l" d={d} />;

const mirror = (children: ComponentChildren) => (
  <>
    <g>{children}</g>
    <g transform="translate(64 0) scale(-1 1)">{children}</g>
  </>
);

// ─────────────────────────── Head ───────────────────────────

function Head({ shape }: { shape: string }) {
  switch (shape) {
    case 'hood':
      return (
        <>
          <U d={['M32 4 C44 10 54 24 52 46 L46 57 C42 51 22 51 18 57 L12 46 C10 24 20 10 32 4 Z']} />
          <path class="ig-d-fill" d="M32 21 C40.5 21 45 29 43 39 C41 48 24 48 21 39 C19 29 23.5 21 32 21 Z" />
          <K d="M32 21 C40.5 21 45 29 43 39 C41 48 24 48 21 39 C19 29 23.5 21 32 21 Z" />
          <L d="M24 10 C20 16 16 24 15 34" />
          <U c="s" d={['M32 50.5 m-4.5 0 a4.5 4.5 0 1 0 9 0 a4.5 4.5 0 1 0 -9 0']} />
        </>
      );
    case 'helm':
    case 'helm_horned':
      return (
        <>
          {shape === 'helm_horned' && mirror(
            <U c="s" d={['M15 27 C4 25 1 13 5 3 C8 12 13 15 19 17 Z']} />,
          )}
          <U d={['M14 57 V30 C14 18 22 9 32 9 C42 9 50 18 50 30 V57 H42 V49 H22 V57 Z']} />
          <U c="s" d={['M14 22.5 H50 V27 H14 Z']} />
          <path class="ig-d-fill" d="M17 31 H47 V36.5 H17 Z" />
          <U c="s" d={['M29.6 12 H34.4 V49 H29.6 Z']} />
          <path class="ig-d-fill" d="M37 41 h2 v2 h-2 z M41 41 h2 v2 h-2 z M37 45 h2 v2 h-2 z M41 45 h2 v2 h-2 z" />
          <L d="M20 14 C17 18 16 24 16 29" />
        </>
      );
    case 'wizard_hat':
      return (
        <>
          <U d={['M39 3 C36 6 35 9 34 13 C32 24 26 34 19 44 L47 44 C45 34 42 26 41 17 C40.6 12 42 8 39 3 Z']} />
          <U d={['M3 49 C3 42 17 40 32 40 C47 40 61 42 61 49 C61 56 47 59 32 59 C17 59 3 56 3 49 Z']} />
          <U c="s" d={['M17.5 40.4 C24 39 40 39 46.5 40.4 L48 46.4 C41 49 23 49 16 46.4 Z']} />
          <path class="ig-s-fill" d="M33 21 l2.2 5 5 2.2 -5 2.2 -2.2 5 -2.2 -5 -5 -2.2 5 -2.2 z" />
          <L d="M33 10 C31 20 27 30 22 38" />
        </>
      );
    case 'circlet':
      return (
        <>
          <U d={['M7 41 C7 29 18 24 32 24 C46 24 57 29 57 41 C57 46 52 47.5 49.6 44.6 C45 39.4 19 39.4 14.4 44.6 C12 47.5 7 46 7 41 Z']} />
          <U c="s" d={['M16 27 L19 17 L24 25 Z', 'M48 27 L45 17 L40 25 Z', 'M27 24.5 L32 12 L37 24.5 Z']} />
          <U c="s" d={['M32 20 m-6.2 0 a6.2 6.2 0 1 0 12.4 0 a6.2 6.2 0 1 0 -12.4 0']} />
          <path d="M32 20 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0" fill="rgba(255,255,255,.55)" />
          <L d="M12 36 C14 32 18 29 22 28" />
        </>
      );
    default: // cap
      return (
        <>
          <U c="s" d={['M44 22 C53 10 60 14 57 24 C54 22 50 23 48 27 Z']} />
          <U d={['M9 41 C9 22 19 11 32 11 C45 11 55 22 55 41 Q32 34 9 41 Z']} />
          <U c="s" d={['M6 38.5 Q32 31 58 38.5 L60 47 Q32 40 4 47 Z']} />
          <L d="M17 24 C20 18 24 15 29 14" />
          <K d="M20 36 Q32 33 44 36" />
        </>
      );
  }
}

// ─────────────────────────── Shoulders ───────────────────────────

function Shoulders({ shape }: { shape: string }) {
  switch (shape) {
    case 'mantle':
      return (
        <>
          <U d={['M5 20 C20 10 44 10 59 20 L61 47 C47 40 17 40 3 47 Z']} />
          <U c="s" d={['M3 43 C17 36 47 36 61 43 L61 51 C47 44 17 44 3 51 Z']} />
          <U c="s" d={['M32 24 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0']} />
          <K d="M14 20 C12 28 11 34 10 38 M50 20 C52 28 53 34 54 38 M23 17 C22 26 21 32 21 37 M41 17 C42 26 43 32 43 37" />
          <L d="M10 17 C20 12 30 11 38 11" />
        </>
      );
    case 'spiked':
      return mirror(
        <>
          <U c="s" d={['M9 25 L5 6 L17 20 Z', 'M17 19 L16 2 L25 18 Z', 'M3 36 L-4 24 L9 28 Z']} />
          <U d={['M3 46 C3 28 14 17 31 20 V50 C18 54 5 54 3 46 Z']} />
          <U c="s" d={['M4 39 C14 42 24 42 31 38 V45 C24 49 12 49 4.5 46 Z']} />
          <L d="M8 36 C9 29 14 25 21 23" />
        </>,
      );
    case 'plate':
      return mirror(
        <>
          <U d={['M5 29 C9 17 21 14 31 16 V27 C22 25 12 27 5 29 Z']} />
          <U d={['M4 39 C8 28 20 25 31 27 V38 C22 36 12 38 4 39 Z']} />
          <U c="s" d={['M3 49 C7 39 19 36 31 38 V51 C20 49 9 51 3 49 Z']} />
          <L d="M8 26 C12 21 19 19 25 19.4 M7 36 C11 31 18 29 25 29.6" />
          <path class="ig-s-fill" d="M12 44.6 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0 M22 43.6 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0" />
        </>,
      );
    default: // pads
      return mirror(
        <>
          <U d={['M3 47 C3 27 14 15 31 18 V51 C18 55 5 55 3 47 Z']} />
          <U c="s" d={['M4 38 C14 41 24 41 31 36.6 V44 C24 48.4 12 48.4 4.4 45 Z']} />
          <L d="M8 34 C9 27 14 22 21 20.6" />
          <path class="ig-s-fill" d="M12 43 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M23 42 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0" />
        </>,
      );
  }
}

// ─────────────────────────── Chest ───────────────────────────

function Chest({ shape }: { shape: string }) {
  switch (shape) {
    case 'robe':
      return (
        <>
          <U d={['M23 7 C27 11 37 11 41 7 L51 17 L61 31 L54 37 L48 30 L52 59 H12 L16 30 L10 37 L3 31 L13 17 Z']} />
          <path class="ig-d-fill" d="M24 7 C28 12 36 12 40 7 L32 22 Z" />
          <U c="s" d={['M16.6 41 C28 45 36 45 47.4 41 L48 47 C36 51 28 51 16 47 Z']} />
          <U c="s" d={['M12 52 H52 L52.6 59 H11.4 Z']} />
          <K d="M32 22 V41 M19 22 C18 30 17 38 16.4 42 M45 22 C46 30 47 38 47.6 42" />
          <L d="M13 20 C10 24 8 27 6 29" />
        </>
      );
    case 'plate':
      return (
        <>
          <U d={['M17 8 C23 11 41 11 47 8 L61 15 V30 L51 34 V56 H13 V34 L3 30 V15 Z']} />
          <path class="ig-d-fill" d="M25 8.4 C29 13 35 13 39 8.4 L32 17 Z" />
          <U c="s" d={['M13 44 H51 V52 H13 Z']} />
          <K d="M32 17 V44 M18 25 C24 30 28 33 32 34 C36 33 40 30 46 25" />
          <L d="M6 17 L14 12 M16 36 V43" />
          <path class="ig-s-fill" d="M19 48 m-1.4 0 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0 M32 48 m-1.4 0 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0 M45 48 m-1.4 0 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0" />
        </>
      );
    case 'mail':
      return (
        <>
          <U d={['M18 8 C24 11 40 11 46 8 L61 17 L56 33 L50 31 V56 H14 V31 L8 33 L3 17 Z']} />
          <path class="ig-d-fill" d="M25 8.4 C29 13 35 13 39 8.4 L32 16 Z" />
          {[22, 28, 34, 40, 46, 52].map((y) => <K d={`M${15 + (y % 12 === 4 ? 3 : 0)} ${y} q3 3 6 0 q3 3 6 0 q3 3 6 0 q3 3 6 0 q3 3 6 0 q3 3 6 0`} />)}
          <U c="s" d={['M13 53 H51 V58 H13 Z']} />
          <L d="M7 18 L13 14" />
        </>
      );
    case 'leather':
      return (
        <>
          <U d={['M19 8 C25 11 39 11 45 8 L57 16 L52 31 L48 29 V56 H16 V29 L12 31 L7 16 Z']} />
          <path class="ig-d-fill" d="M26 8.4 C29 12 35 12 38 8.4 L32 14 Z" />
          <U c="s" d={['M16 41 H48 V46 H16 Z']} />
          <U c="s" d={['M28 41 H36 V47 H28 Z']} />
          <K d="M32 14 V41 M29.6 19 H34.4 M29.6 24 H34.4 M29.6 29 H34.4 M29.6 34 H34.4 M20 20 L26 30 M44 20 L38 30" />
          <L d="M10 17 L16 13" />
        </>
      );
    default: // tunic
      return (
        <>
          <U d={['M22 8 C26 12 38 12 42 8 L57 17 L52 30 L47 28 V56 H17 V28 L12 30 L7 17 Z']} />
          <path class="ig-d-fill" d="M24 8.4 C28 14 36 14 40 8.4 L32 17 Z" />
          <U c="s" d={['M17 42 H47 V47 H17 Z']} />
          <K d="M32 17 V42 M20 22 C22 28 22 34 22 40" />
          <L d="M10 17 L16 13" />
          <path class="ig-s-fill" d="M32 44.5 m-2.2 0 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0" />
        </>
      );
  }
}

// ─────────────────────────── Hands ───────────────────────────

const HAND_PARTS = [
  'M19 13 C19 9 26 9 26 13 V36 H19 Z',
  'M27 8 C27 4 34 4 34 8 V36 H27 Z',
  'M35 10 C35 6 42 6 42 10 V36 H35 Z',
  'M43 15 C43 11 49 11 49 15 V38 H43 Z',
  'M18 31 H49 V45 C49 53 43 57 35 57 H29 C22 57 18 51 18 45 Z',
  'M21 40 L9 31 C6.4 29 9 24.6 12.4 26.6 L26 34 Z',
];

function Hands({ shape }: { shape: string }) {
  return (
    <>
      <U d={HAND_PARTS} />
      {shape === 'gauntlets' && (
        <>
          <U c="s" d={['M18.4 25.6 H49 V30.4 H18.4 Z']} />
          <K d="M26.5 9 V25 M34.5 9 V25 M42.5 11 V25 M22 17 H26 M30 14 H34 M38 15 H42 M45 19 H49" />
          <path class="ig-s-fill" d="M12.6 28 l4 2.6 -2 3 -4 -2.6 z" />
        </>
      )}
      {shape === 'wraps' && (
        <>
          <U c="s" d={['M19 20 L26 18 V22 L19 24 Z', 'M27 18 L34 15 V19 L27 22 Z', 'M35 18 L42 16 V20 L35 23 Z', 'M18 36 L49 33 V38 L18 41 Z', 'M18 44 L49 41 V46 L18 49 Z']} />
          <K d="M20 30 L26 28 M28 28 L34 25 M36 28 L42 26" />
        </>
      )}
      {shape === 'gloves' && <K d="M26.5 14 V30 M34.5 11 V30 M42.5 13 V32" />}
      <U c="s" d={['M16 52 H51 V60 H16 Z']} />
      <L d="M20 14 V26 M28 9 V22" />
    </>
  );
}

// ─────────────────────────── Wrists / Waist ───────────────────────────

function Wrists() {
  return (
    <g transform="rotate(-24 32 32)">
      <U d={['M9 14 L55 20 Q60 21 60 26 V38 Q60 43 55 44 L9 50 Q4 50.6 4 45.5 V18.5 Q4 13.4 9 14 Z']} />
      <U c="s" d={['M4 18.5 Q4 13.4 9 14 L15 14.8 V49.2 L9 50 Q4 50.6 4 45.5 Z']} />
      <U c="s" d={['M26 16.4 L32 17.2 V46.8 L26 47.6 Z']} />
      <U c="s" d={['M44 18.6 L50 19.4 V44.6 L44 45.4 Z']} />
      <path class="ig-d-fill" d="M27.6 28 h2.8 v8 h-2.8 z" />
      <path class="ig-s-fill" d="M9.6 24 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M9.6 40 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M55 27 m-1.4 0 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0 M55 37 m-1.4 0 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0" />
      <L d="M17 18.4 L24 19.2 M35 21 L42 21.8" />
    </g>
  );
}

function Waist({ shape }: { shape: string }) {
  if (shape === 'sash') {
    return (
      <>
        <U d={['M38 36 L30 59 L37 55 L42 61 L47 37 Z']} />
        <U d={['M4 21 C20 27 44 27 60 21 V35 C44 41 20 41 4 35 Z']} />
        <U c="s" d={['M44 31 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0']} />
        <K d="M40 28 L48 34 M48 28 L40 34 M8 27 C22 32 42 32 56 27" />
        <L d="M8 24 C22 29 40 29 54 24.6" />
      </>
    );
  }
  return (
    <>
      <U d={['M2 23 H62 V41 H2 Z']} />
      <K d="M5 27.4 H20 M44 27.4 H59 M5 36.6 H20 M44 36.6 H59" />
      <path class="ig-d-fill" d="M52 31 m-1.3 0 a1.3 1.3 0 1 0 2.6 0 a1.3 1.3 0 1 0 -2.6 0 M57 31 m-1.3 0 a1.3 1.3 0 1 0 2.6 0 a1.3 1.3 0 1 0 -2.6 0" />
      <U c="s" d={['M21 18 H43 V46 H21 Z']} />
      <path class="ig-d-fill" d="M26 24 H38 V40 H26 Z" />
      <U c="s" d={['M31 22 H36 V36 H31 Z']} />
      <L d="M5 25.4 H30" />
    </>
  );
}

// ─────────────────────────── Legs / Feet ───────────────────────────

function Legs({ shape }: { shape: string }) {
  return (
    <>
      <U d={['M13 6 H51 L54 58 H36 L32 27 L28 58 H10 Z']} />
      <U c="s" d={['M13 6 H51 V15 H13 Z']} />
      <K d="M32 15 V27" />
      {shape === 'cloth' && (
        <>
          <U c="s" d={['M10.4 51 H28.6 L28 58 H10 Z', 'M35.4 51 H53.6 L54 58 H36 Z']} />
          <K d="M20 20 C21 28 21 36 20 44 M44 20 C43 28 43 36 44 44" />
        </>
      )}
      {shape === 'leather' && (
        <>
          <U c="s" d={['M17 31 H27 V41 H17 Z', 'M37 31 H47 V41 H37 Z']} />
          <K d="M18.6 33 H25.4 M18.6 36 H25.4 M18.6 39 H25.4 M38.6 33 H45.4 M38.6 36 H45.4 M38.6 39 H45.4 M32 16 L31 27" />
        </>
      )}
      {shape === 'plate' && (
        <>
          <U c="s" d={['M16 31 C16 27 28 27 28 31 V42 C28 46 16 46 16 42 Z', 'M36 31 C36 27 48 27 48 31 V42 C48 46 36 46 36 42 Z']} />
          <U c="s" d={['M11 50 H28.6 L28.2 56 H10.6 Z', 'M35.4 50 H53 L53.4 56 H35.8 Z']} />
          <K d="M20 20 V27 M44 20 V27" />
        </>
      )}
      <L d="M16 17 L14.6 46" />
    </>
  );
}

function Feet({ shape }: { shape: string }) {
  const high = shape !== 'shoes';
  const top = high ? 6 : 26;
  return (
    <>
      <U d={[`M19 ${top} H39 V${top + (high ? 30 : 12)} C42 ${top + (high ? 34 : 18)} 52 ${top + (high ? 34 : 18)} 58 ${top + (high ? 40 : 24)} C62 ${top + (high ? 44 : 28)} 60 56 56 56 H17 Z`]} />
      <U c="s" d={[`M17 ${top} H41 V${top + 8} H17 Z`]} />
      <U c="d" d={['M15 53 H59 V59 H15 Z']} />
      {high ? <K d="M20 20 H38 M20 26 H38 M20 32 H38" /> : <K d="M24 36 H36 M24 40 H36" />}
      {shape === 'greaves' && (
        <>
          <U c="s" d={['M18 24 H40 V31 H18 Z', 'M48 42 L60 44 L57 53 L45 52 Z']} />
          <K d="M22 24 V31 M30 24 V31 M36 24 V31" />
        </>
      )}
      <L d={`M23 ${top + 10} V${top + (high ? 24 : 8)}`} />
    </>
  );
}

// ─────────────────────────── Jewelry ───────────────────────────

function Amulet() {
  return (
    <>
      <path d="M11 4 C11 30 20 37 32 42 C44 37 53 30 53 4" fill="none" stroke="#120b06" stroke-width="5" stroke-linecap="round" />
      <path d="M11 4 C11 30 20 37 32 42 C44 37 53 30 53 4" fill="none" stroke="var(--ig-s)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 0" />
      <path d="M11 4 C11 30 20 37 32 42 C44 37 53 30 53 4" fill="none" stroke="rgba(255,255,255,.38)" stroke-width="1" stroke-linecap="round" transform="translate(-.8 0)" />
      <U c="s" d={['M32 36 m-3.4 0 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0']} />
      <U c="s" d={['M32 39 L44 50 L32 62 L20 50 Z']} />
      <U d={['M32 44 L39 50 L32 58 L25 50 Z']} />
      <path d="M32 44 L39 50 L32 50 Z" fill="rgba(255,255,255,.5)" />
      <L d="M23 50 L32 41" />
    </>
  );
}

function Ring() {
  return (
    <>
      <circle cx="32" cy="40" r="15" fill="none" stroke="#120b06" stroke-width="10.4" />
      <circle cx="32" cy="40" r="15" fill="none" stroke="var(--ig-s)" stroke-width="7" />
      <circle cx="32" cy="40" r="15" fill="none" stroke="url(#ig-ring)" stroke-width="7" />
      <circle cx="32" cy="40" r="11.2" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1" />
      <U c="s" d={['M25 24 L39 24 L36 29 L28 29 Z']} />
      <U d={['M32 5 L42 14 L32 27 L22 14 Z']} />
      <path d="M32 5 L22 14 L32 15 Z" fill="rgba(255,255,255,.55)" />
      <path d="M32 15 L42 14 L32 27 Z" fill="rgba(0,0,0,.28)" />
      <L d="M25 13 L30 8" />
    </>
  );
}

// ─────────────────────────── Weapons ───────────────────────────

function Weapon({ shape }: { shape: string }) {
  switch (shape) {
    case 'sword2h':
      return (
        <g transform="rotate(42 32 32)">
          <U d={['M32 0.5 L38.4 8 V41 H25.6 V8 Z']} />
          <path class="ig-fuller" d="M32 7 V38" />
          <U c="s" d={['M12 41 Q12 37.4 16 37.4 H48 Q52 37.4 52 41 Q52 45.6 48 45.6 H16 Q12 45.6 12 41 Z']} />
          <U c="d" d={['M28.6 45.6 H35.4 V57 H28.6 Z']} />
          <K d="M28.6 49 H35.4 M28.6 52.4 H35.4" />
          <U c="s" d={['M32 59.4 m-4.4 0 a4.4 4.4 0 1 0 8.8 0 a4.4 4.4 0 1 0 -8.8 0']} />
        </g>
      );
    case 'axe':
      return (
        <g transform="rotate(34 32 32)">
          <U c="d" d={['M29.6 10 H34.4 V60 H29.6 Z']} />
          <U c="s" d={['M29.6 46 H34.4 V57 H29.6 Z']} />
          <U d={['M34 6 C51 3 61 15 58 29 C50 25 43 27 34 33 Z']} />
          <U c="s" d={['M30 12 L22 17 L30 22 Z']} />
          <L d="M37 10 C46 9 53 13 55 20" />
        </g>
      );
    case 'axe2h':
      return (
        <g transform="rotate(34 32 32)">
          <U c="d" d={['M29.6 8 H34.4 V62 H29.6 Z']} />
          <U c="s" d={['M29.6 48 H34.4 V59 H29.6 Z']} />
          {mirror(<U d={['M34 6 C52 2 62 15 59 31 C50 26 43 28 34 35 Z']} />)}
          <U c="s" d={['M32 2 L36 9 H28 Z']} />
          <L d="M38 10 C47 9 54 13 56 21 M26 10 C17 9 10 13 8 21" />
        </g>
      );
    case 'mace':
      return (
        <g transform="rotate(36 32 32)">
          <U c="d" d={['M29.4 20 H34.6 V60 H29.4 Z']} />
          <U c="s" d={['M29.4 46 H34.6 V57 H29.4 Z']} />
          <U c="s" d={['M32 2 L36 9 H28 Z', 'M14 17 L21 13.4 L22 21 Z', 'M50 17 L43 13.4 L42 21 Z', 'M17 31 L22 24 L26 31 Z', 'M47 31 L42 24 L38 31 Z']} />
          <U d={['M32 19 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0']} />
          <U c="s" d={['M21 25 H43 V28.6 H21 Z']} />
          <L d="M24 14 C25 11 28 9 31 9" />
        </g>
      );
    case 'bow':
      return (
        <g transform="rotate(14 32 32)">
          <path d="M42 3 C16 12 16 52 42 61" fill="none" stroke="#120b06" stroke-width="8" stroke-linecap="round" />
          <path d="M42 3 C16 12 16 52 42 61" fill="none" stroke="var(--ig-p)" stroke-width="5" stroke-linecap="round" />
          <path d="M42 3 C16 12 16 52 42 61" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.4" stroke-linecap="round" transform="translate(-1 0)" />
          <path d="M42 3 L33 32 L42 61" fill="none" stroke="#e8e0cc" stroke-width="1.2" />
          <U c="s" d={['M18 26.6 H27.6 V37.4 H18 Z']} />
          <K d="M20 29.4 H25.6 M20 34.6 H25.6" />
          <path d="M33 32 H60" stroke="#120b06" stroke-width="3.4" stroke-linecap="round" />
          <path d="M33 32 H58" stroke="#c9b48a" stroke-width="1.6" stroke-linecap="round" />
          <path d="M62 32 L55 28.4 V35.6 Z" fill="#cfd5db" stroke="#120b06" stroke-width="1" stroke-linejoin="round" />
        </g>
      );
    case 'crossbow':
    case 'handxbow': {
      const small = shape === 'handxbow';
      return (
        <g transform={small ? 'rotate(38 32 32) translate(5 6) scale(.84)' : 'rotate(20 32 32)'}>
          <path d="M5 22 C17 9 47 9 59 22" fill="none" stroke="#120b06" stroke-width="8" stroke-linecap="round" />
          <path d="M5 22 C17 9 47 9 59 22" fill="none" stroke="var(--ig-s)" stroke-width="5" stroke-linecap="round" />
          <path d="M5 22 L32 33 L59 22" fill="none" stroke="#e8e0cc" stroke-width="1.2" />
          <U d={['M28.4 13 H35.6 L36.6 52 L38 59 H26 L27.4 52 Z']} />
          <U c="d" d={['M29.6 36 H34.4 V44 H29.6 Z']} />
          <U c="s" d={['M32 2 L35.6 11 H28.4 Z']} />
          <path d="M32 9 V34" stroke="#cfd5db" stroke-width="1.6" />
          <L d="M30 16 L29.6 48" />
        </g>
      );
    }
    case 'staff':
      return (
        <g transform="rotate(32 32 32)">
          <U c="d" d={['M29.8 20 H34.2 V62 H29.8 Z']} />
          <U c="s" d={['M29.8 44 H34.2 V54 H29.8 Z']} />
          <U c="s" d={['M32 14 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0']} />
          <path d="M32 14 m-6.4 0 a6.4 6.4 0 1 0 12.8 0 a6.4 6.4 0 1 0 -12.8 0" fill="var(--ig-g)" stroke="#120b06" stroke-width="1.2" />
          <path d="M32 14 m-6.4 0 a6.4 6.4 0 1 0 12.8 0 a6.4 6.4 0 1 0 -12.8 0" fill="url(#ig-orb)" />
          <U c="s" d={['M32 0 L35.6 5 H28.4 Z', 'M20 24 L25 20 L26 26 Z', 'M44 24 L39 20 L38 26 Z']} />
          <path d="M28 11 a4 4 0 0 1 4 -2.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85" />
        </g>
      );
    case 'wand':
      return (
        <g transform="rotate(38 32 32)">
          <U d={['M30.2 20 H33.8 V60 H30.2 Z']} />
          <U c="d" d={['M29.8 44 H34.2 V58 H29.8 Z']} />
          <K d="M29.8 47 H34.2 M29.8 50 H34.2 M29.8 53 H34.2" />
          <U c="s" d={['M32 2 L36 12 L46 14 L38 20.4 L40.6 30 L32 24.6 L23.4 30 L26 20.4 L18 14 L28 12 Z']} />
          <path d="M32 18 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0" fill="var(--ig-g)" stroke="#120b06" stroke-width="1" />
          <path d="M32 18 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0" fill="url(#ig-orb)" />
        </g>
      );
    default: // sword
      return (
        <g transform="rotate(42 32 32)">
          <U d={['M32 2.5 L37 9 V38 H27 V9 Z']} />
          <path class="ig-fuller" d="M32 8 V35" />
          <U c="s" d={['M16 38 Q16 34.6 19.6 34.6 H44.4 Q48 34.6 48 38 Q48 42.6 44.4 42.6 H19.6 Q16 42.6 16 38 Z']} />
          <U c="d" d={['M29 42.6 H35 V54 H29 Z']} />
          <K d="M29 46 H35 M29 49.4 H35" />
          <U c="s" d={['M32 57 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0']} />
        </g>
      );
  }
}

function Offhand({ shape }: { shape: string }) {
  switch (shape) {
    case 'quiver':
      return (
        <g transform="rotate(16 32 32)">
          <path d="M26 20 L23 3 M32 20 V1 M38 20 L41 3" stroke="#120b06" stroke-width="4" stroke-linecap="round" />
          <path d="M26 20 L23 3 M32 20 V1 M38 20 L41 3" stroke="#c9b48a" stroke-width="2" stroke-linecap="round" />
          <U c="s" d={['M20.4 8 L23 3 L25.4 8 Z', 'M29.4 6 L32 1 L34.6 6 Z', 'M38.6 8 L41 3 L43.4 8 Z']} />
          <U d={['M21 19 H43 L46 55 Q32 62 18 55 Z']} />
          <U c="s" d={['M20 17 H44 V24 H20 Z']} />
          <U c="d" d={['M18.4 36 L45.6 42 V47 L18 41 Z']} />
          <L d="M25 28 L24 50" />
        </g>
      );
    case 'orb':
      return (
        <>
          <circle cx="32" cy="29" r="26" fill="var(--ig-g)" opacity=".25" />
          <U c="s" d={['M18 57 H46 L42 49.6 H22 Z']} />
          <U d={['M32 29 m-19 0 a19 19 0 1 0 38 0 a19 19 0 1 0 -38 0']} />
          <circle cx="32" cy="29" r="19" fill="url(#ig-orb)" />
          <path d="M20 31 C24 24 30 24 34 28 C38 32 44 31 46 26 M19 38 C25 34 30 35 35 38 C39 40 43 38 45 35" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.6" stroke-linecap="round" />
          <ellipse cx="25" cy="19" rx="6" ry="3.6" fill="#fff" opacity=".7" transform="rotate(-35 25 19)" />
        </>
      );
    default: // shield
      return (
        <>
          <U d={['M9 8 H55 V30 C55 46 44 55 32 62 C20 55 9 46 9 30 Z']} />
          <path d="M14 13 H50 V30 C50 43 42 50 32 56.4 C22 50 14 43 14 30 Z" fill="none" stroke="var(--ig-s)" stroke-width="3.4" stroke-linejoin="round" />
          <path d="M14 13 H50 V30 C50 43 42 50 32 56.4 C22 50 14 43 14 30 Z" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1" stroke-linejoin="round" transform="translate(0 1.6)" />
          <U c="s" d={['M32 30 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0']} />
          <path d="M32 30 m-4.6 0 a4.6 4.6 0 1 0 9.2 0 a4.6 4.6 0 1 0 -9.2 0" fill="#1c130c" />
          <path d="M32 30 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0" fill="var(--ig-s)" />
          <L d="M13 12 L30 12 M13 12 L13 28" />
        </>
      );
  }
}

// ─────────────────────────── Public components ───────────────────────────

function Shape({ kind, shape }: { kind: ItemKind; shape: string }) {
  switch (kind) {
    case 'head': return <Head shape={shape} />;
    case 'shoulders': return <Shoulders shape={shape} />;
    case 'chest': return <Chest shape={shape} />;
    case 'hands': return <Hands shape={shape} />;
    case 'wrists': return <Wrists />;
    case 'waist': return <Waist shape={shape} />;
    case 'legs': return <Legs shape={shape} />;
    case 'feet': return <Feet shape={shape} />;
    case 'neck': return <Amulet />;
    case 'ring': return <Ring />;
    case 'offhand': return <Offhand shape={shape} />;
    default: return <Weapon shape={shape} />;
  }
}

function GlyphDefs() {
  return (
    <defs>
      <linearGradient id="ig-shade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".4" />
        <stop offset=".42" stop-color="#fff" stop-opacity=".04" />
        <stop offset=".62" stop-color="#000" stop-opacity=".08" />
        <stop offset="1" stop-color="#000" stop-opacity=".48" />
      </linearGradient>
      <linearGradient id="ig-ring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".45" />
        <stop offset=".5" stop-color="#fff" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity=".5" />
      </linearGradient>
      <radialGradient id="ig-orb" cx=".36" cy=".3" r=".85">
        <stop offset="0" stop-color="#fff" stop-opacity=".78" />
        <stop offset=".3" stop-color="#fff" stop-opacity=".12" />
        <stop offset=".75" stop-color="#000" stop-opacity=".1" />
        <stop offset="1" stop-color="#000" stop-opacity=".55" />
      </radialGradient>
    </defs>
  );
}

const DEFAULT_LOOK: ItemLook = { shape: '', primary: 0x8a8f96, secondary: 0x5a5f66, glow: 0, variant: 0 };

/** Item silhouette coloured from its look. `mono` renders the faint engraved empty-slot version. */
export function ItemGlyph({ look, kind, size = 40, mono = false }: { look?: ItemLook; kind: ItemKind; size?: number; mono?: boolean }) {
  const lk = look ?? DEFAULT_LOOK;
  const style: Record<string, string> = {
    '--ig-p': hex(lk.primary),
    '--ig-s': hex(lk.secondary),
    '--ig-g': lk.glow ? hex(lk.glow) : lighten(lk.primary, 0.35),
  };
  return (
    <svg class={`ig${mono ? ' ig-mono' : ''}`} width={size} height={size} viewBox="0 0 64 64" style={style} role="presentation" focusable="false">
      <GlyphDefs />
      <Shape kind={kind} shape={lk.shape} />
    </svg>
  );
}

const SLOT_DEFAULTS: Record<Slot, { kind: ItemKind; shape: string }> = {
  head: { kind: 'head', shape: 'helm' },
  shoulders: { kind: 'shoulders', shape: 'plate' },
  neck: { kind: 'neck', shape: 'amulet' },
  chest: { kind: 'chest', shape: 'plate' },
  hands: { kind: 'hands', shape: 'gauntlets' },
  wrists: { kind: 'wrists', shape: 'bracers' },
  waist: { kind: 'waist', shape: 'belt' },
  legs: { kind: 'legs', shape: 'plate' },
  feet: { kind: 'feet', shape: 'boots' },
  ring1: { kind: 'ring', shape: 'ring' },
  ring2: { kind: 'ring', shape: 'ring' },
  mainhand: { kind: 'weapon1h', shape: 'sword' },
  offhand: { kind: 'offhand', shape: 'shield' },
};

export function SlotGlyph({ slot, size = 34 }: { slot: Slot; size?: number }) {
  const d = SLOT_DEFAULTS[slot];
  return <ItemGlyph kind={d.kind} look={{ ...DEFAULT_LOOK, shape: d.shape }} size={size} mono />;
}

export { darken };
