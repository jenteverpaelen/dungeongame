// Hand-drawn vector glyphs for skills, buffs, classes and small HUD marks. All glyphs live on a 64x64 grid,
// are filled with `currentColor` (the skill colour) and carry a dark outline plus a shade / highlight pass so
// they read as chunky enamel emblems rather than flat icons.

import type { JSX } from 'preact';
import type { ClassId } from '@shared/types';

const OUT = {
  stroke: '#150c07',
  'stroke-width': 3.2,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
  'paint-order': 'stroke',
} as const;

const main = { fill: 'currentColor', ...OUT } as const;
const shade = { fill: '#000', 'fill-opacity': 0.32 } as const;
const light = { fill: '#fff', 'fill-opacity': 0.5 } as const;
const hiLine = { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.6, 'stroke-width': 2, 'stroke-linecap': 'round' } as const;
const dark = '#150c07';

type G = () => JSX.Element;

/** A small starling silhouette (wings swept up in a shallow V) centred at (x, y), half-span s. */
function birdPath(x: number, y: number, s: number): string {
  const f = (v: number) => v.toFixed(2);
  return `M${f(x - s)} ${f(y - s * 0.45)}Q${f(x - s * 0.35)} ${f(y - s * 0.75)} ${f(x)} ${f(y)}Q${f(x + s * 0.35)} ${f(y - s * 0.75)} ${f(x + s)} ${f(y - s * 0.45)}`
    + `Q${f(x + s * 0.4)} ${f(y + s * 0.05)} ${f(x)} ${f(y + s * 0.42)}Q${f(x - s * 0.4)} ${f(y + s * 0.05)} ${f(x - s)} ${f(y - s * 0.45)}Z`;
}

/** Murmuration glyph: tiny starlings along a folding S-ribbon, dense in its middle (deterministic layout). */
const FLOCK_MARKS: [number, number, number][] = (() => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out: [number, number, number][] = [];
  for (let i = 0; i < 36; i++) {
    const w = (rnd() - 0.5) * 2;
    const cx = 32 + w * 24, cy = 36 + Math.sin(w * 2.6 + 0.4) * 11;
    const th = 1.5 + 5.5 * (1 - w * w);
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * th;
    out.push([cx + Math.cos(a) * d * 0.7, cy + Math.sin(a) * d, 2.5 + rnd() * 1.9 * (1 - 0.4 * Math.abs(w))]);
  }
  return out;
})();

const GLYPHS: Record<string, G> = {
  // Cleave: two nested crescents of steel and speed marks
  arc: () => (
    <>
      <g {...main}>
        <path d="M5 47C8 19 33 3 59 11C39 13 21 26 5 47Z" />
        <path d="M17 57C20 41 34 29 55 27C42 34 31 44 17 57Z" fill-opacity=".72" />
      </g>
      <path d="M17 38C22 24 36 14 53 12C40 18 28 28 17 38Z" {...light} fill-opacity=".28" />
      <path d="M10 36C15 21 33 9 54 11" {...hiLine} />
      <path d="M44 48l9-3M40 55l8-2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".8" />
    </>
  ),
  // Whirlwind: three blades chasing each other round a hub, with the wind trailing behind
  spiral: () => (
    <>
      {[0, 120, 240].map((a) => (
        <g transform={`rotate(${a} 32 32)`}>
          <path d="M31 4.5A27.5 27.5 0 0 1 55 18" fill="none" stroke={dark} stroke-width="6" stroke-linecap="round" />
          <path d="M31 4.5A27.5 27.5 0 0 1 55 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" opacity=".75" />
        </g>
      ))}
      <g {...main}>
        {[0, 120, 240].map((a) => (
          <path d="M32 34C27 23 31 11 47 9C41 15 40 24 42 34Z" transform={`rotate(${a} 32 32)`} />
        ))}
        <circle cx="32" cy="32" r="7" />
      </g>
      {[0, 120, 240].map((a) => (
        <path d="M33 27C32 21 35 16 41 13" {...hiLine} transform={`rotate(${a} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="3.2" fill={dark} />
    </>
  ),
  // Rend: three claw gashes with blood
  claw: () => (
    <>
      <g transform="rotate(14 32 30)">
        <g {...main}>
          {[-14, 0, 14].map((dx, i) => (
            <path d={`M${32 + dx - 5} ${5 + i * 2}L${32 + dx + 5} ${5 + i * 2}C${32 + dx + 4} ${24 + i * 2} ${32 + dx + 2} ${40 + i * 2} ${32 + dx - 1} ${54 + i * 2}C${32 + dx - 5} ${40 + i * 2} ${32 + dx - 6} ${24 + i * 2} ${32 + dx - 5} ${5 + i * 2}Z`} />
          ))}
        </g>
        {[-14, 0, 14].map((dx, i) => (
          <path d={`M${32 + dx - 2} ${9 + i * 2}C${32 + dx - 3} ${22 + i * 2} ${32 + dx - 2} ${34 + i * 2} ${32 + dx - 1} ${44 + i * 2}`} {...hiLine} />
        ))}
      </g>
      <g fill="#ff6a4a" stroke={dark} stroke-width="1.6" paint-order="stroke">
        <path d="M13 54c2-4 4-6 4-6s3 2 3 6a3.5 3.5 0 0 1-7 0Z" />
        <path d="M50 58c1.5-3 3-4.5 3-4.5s2.5 1.6 2.5 4.5a2.8 2.8 0 0 1-5.5 0Z" />
      </g>
    </>
  ),
  // Ground Stomp: an iron boot driving into cracking earth
  stomp: () => (
    <>
      <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".9">
        <path d="M4 52C16 44 48 44 60 52" />
        <path d="M10 58C22 52 42 52 54 58" opacity=".6" />
      </g>
      <g {...main}>
        <path d="M21 4H38V27C48 28 55 31 55 37V43H18V30C18 20 21 14 21 4Z" />
      </g>
      <path d="M18 38H55V43H18Z" {...shade} />
      <path d="M24 8V26" {...hiLine} />
      <path d="M27 46l-9 10M36 47l1 11M45 46l10 9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
    </>
  ),
  // Seismic Slam: a slab of earth split open by a fault line
  fissure: () => (
    <>
      <g {...main}>
        <path d="M6 59L21 12H43L58 59Z" />
        <path d="M4 36l9-7 4 8-9 5Z M51 24l9-6 3 9-9 4Z" />
      </g>
      <g fill="none" stroke="#000" stroke-opacity=".28" stroke-width="2.2" stroke-linecap="round">
        <path d="M13 47H51M17 35H47M20 24H44" />
      </g>
      <path d="M31.5 12L35 22L29.5 30L36.5 40L30.5 48L35.5 59H26L25 48L31 40L24.5 30L30 22Z" fill={dark} />
      <path d="M31.4 15L33.4 22.6L28.4 30L34.6 40.2L29 48.4L31.2 57" fill="none" stroke="#ff9a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity=".9" />
      <path d="M24 16L12 56" {...hiLine} stroke-width="1.8" />
    </>
  ),
  // Battle Rage: horned war-mask
  rage: () => (
    <>
      <g {...main}>
        <path d="M14 27C4 23 2 11 8 3C11 13 18 18 26 19Z" />
        <path d="M50 27C60 23 62 11 56 3C53 13 46 18 38 19Z" />
        <path d="M15 21C26 15 38 15 49 21L51 38C50 50 42 59 32 61C22 59 14 50 13 38Z" />
      </g>
      <path d="M32 17C26 17 20 19 16 22L15.5 30C20 24 26 22 32 22Z" {...light} fill-opacity=".3" />
      <path d="M19 31L31 37L20 41Z M45 31L33 37L44 41Z" fill={dark} />
      <path d="M21 51L25 46L29 51L32 46L35 51L39 46L43 51" fill="none" stroke={dark} stroke-width="2.6" stroke-linejoin="round" />
      <path d="M32 40V45" stroke={dark} stroke-width="2.4" stroke-linecap="round" />
    </>
  ),
  // Hungering Arrow: seeking arrow with a curling trail
  arrow: () => (
    <>
      <path d="M6 54C8 42 14 36 21 34" fill="none" stroke="currentColor" stroke-width="2.4" stroke-dasharray="1 5" stroke-linecap="round" opacity=".7" />
      <g transform="rotate(-45 32 32)">
        <g {...main}>
          <rect x="8" y="29.6" width="42" height="4.8" rx="2.4" />
          <path d="M65 32L47 21.5L51 32L47 42.5Z" />
          <path d="M6 32L-1 23H12L17 32L12 41H-1Z" />
        </g>
        <path d="M52 29.8L60 32L52 34.2" {...shade} />
        <path d="M10 31.2H44" {...hiLine} stroke-width="1.4" />
        <path d="M2 24.6l7 6.2M2 39.4l7-6.2" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.4" stroke-linecap="round" />
      </g>
    </>
  ),
  // Sentry: ballista turret on a tripod
  turret: () => (
    <>
      <g fill="none" stroke={dark} stroke-width="8.6" stroke-linecap="round">
        <path d="M24 33L10 59M24 33L38 59M24 34V59" />
      </g>
      <g fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" opacity=".92">
        <path d="M24 33L10 59M24 33L38 59M24 34V59" />
      </g>
      <g fill="none" stroke={dark} stroke-width="9.4" stroke-linecap="round">
        <path d="M44 27C44 15 49 9 60 6M44 27C44 39 49 45 60 48" />
      </g>
      <g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">
        <path d="M44 27C44 15 49 9 60 6M44 27C44 39 49 45 60 48" />
      </g>
      <path d="M60 6L12 27L60 48" fill="none" stroke={dark} stroke-width="3.2" stroke-linejoin="round" />
      <path d="M60 6L12 27L60 48" fill="none" stroke="#efe2c0" stroke-width="1.3" stroke-linejoin="round" />
      <g {...main}>
        <rect x="6" y="22" width="42" height="10" rx="4" />
        <circle cx="24" cy="27" r="6.4" />
      </g>
      <path d="M10 25H44" {...hiLine} />
      <circle cx="24" cy="27" r="2.4" fill={dark} />
      <g fill="#efe2c0" stroke={dark} stroke-width="1.8" stroke-linejoin="round" paint-order="stroke">
        <path d="M64 27L52 21.5V32.5Z" />
        <rect x="14" y="26" width="38" height="2.6" rx="1.3" />
      </g>
    </>
  ),
  // Multishot: five arrows fanning out
  fan: () => (
    <>
      {[-40, -20, 0, 20, 40].map((a, i) => (
        <g transform={`rotate(${a} 32 60)`}>
          <g {...main} stroke-width={i === 2 ? 3.2 : 2.8}>
            <rect x="30.4" y="20" width="3.2" height="36" rx="1.6" />
            <path d="M32 6L38.4 22.5H25.6Z" />
          </g>
          <path d="M28.5 58L32 52L35.5 58Z" fill="currentColor" stroke={dark} stroke-width="1.6" paint-order="stroke" />
        </g>
      ))}
      <path d="M32 12L35 21H32Z" {...shade} />
    </>
  ),
  // Cluster Arrow: a bomb that scatters bomblets
  cluster: () => (
    <>
      <g fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="1.2 4.2" stroke-linecap="round" opacity=".7">
        <path d="M24 28L13 17M40 28L51 17M24 44L13 55M40 44L51 55" />
      </g>
      <g {...main}>
        <circle cx="32" cy="36" r="13" />
        <circle cx="10" cy="14" r="6" />
        <circle cx="54" cy="14" r="6" />
        <circle cx="10" cy="56" r="6" />
        <circle cx="54" cy="56" r="6" />
      </g>
      <path d="M22 30C24 25 29 23 33 24" {...hiLine} stroke-width="2.4" />
      <path d="M32 23V18C32 14 35 12 39 11" fill="none" stroke={dark} stroke-width="3.6" stroke-linecap="round" />
      <path d="M32 23V18C32 14 35 12 39 11" fill="none" stroke="#e8d3a2" stroke-width="1.6" stroke-linecap="round" />
      <path d="M41 6l1.6 3.4 3.4 1.6-3.4 1.6L41 16l-1.6-3.4-3.4-1.6 3.4-1.6Z" fill="#ffe08a" stroke={dark} stroke-width="1.2" />
      <path d="M32 36m-13 0a13 13 0 0 0 13 13a13 13 0 0 0 13-13Z" {...shade} fill-opacity=".22" />
    </>
  ),
  // Rain of Vengeance: storm cloud shedding arrows
  rain: () => (
    <>
      <g transform="rotate(10 32 40)">
        {[14, 26, 38, 50].map((x, i) => (
          <g {...main} stroke-width="2.6" transform={`translate(0 ${i % 2 ? 2 : -2})`}>
            <rect x={x - 1.4} y="30" width="2.8" height="20" rx="1.4" />
            <path d={`M${x} 60L${x + 5} 48H${x - 5}Z`} />
          </g>
        ))}
      </g>
      <g {...main}>
        <path d="M14 30C5 30 4 18 14 17C15 8 31 5 36 14C46 10 57 18 51 30Z" />
      </g>
      <path d="M12 26C10 21 12 19 16 19" {...hiLine} />
      <path d="M15 30H51" stroke="#000" stroke-opacity=".28" stroke-width="3" stroke-linecap="round" />
    </>
  ),
  // Companion: paw print
  paw: () => (
    <>
      <g {...main}>
        <path d="M32 33C22 33 14 43 18 52C21 58 28 54 32 54C36 54 43 58 46 52C50 43 42 33 32 33Z" />
        <ellipse cx="12.5" cy="29" rx="5.4" ry="7.2" transform="rotate(-24 12.5 29)" />
        <ellipse cx="25" cy="16.5" rx="5.6" ry="8" transform="rotate(-8 25 16.5)" />
        <ellipse cx="39" cy="16.5" rx="5.6" ry="8" transform="rotate(8 39 16.5)" />
        <ellipse cx="51.5" cy="29" rx="5.4" ry="7.2" transform="rotate(24 51.5 29)" />
      </g>
      <path d="M23 41C26 38 30 37 33 37" {...hiLine} />
      <path d="M22 18C23 14 26 12 28 12" {...hiLine} stroke-width="1.6" />
      <path d="M36 12C38 12 41 14 42 18" {...hiLine} stroke-width="1.6" />
    </>
  ),
  // Magic Missile: arcane bolt trailing sparks
  missile: () => (
    <>
      <g {...main}>
        <path d="M34 14L51 31C38 34 22 44 5 59C13 44 22 27 34 14Z" fill-opacity=".8" />
        <circle cx="43" cy="22" r="13" />
      </g>
      <circle cx="43" cy="22" r="7" fill="#fff" fill-opacity=".38" />
      <circle cx="40" cy="19" r="3.2" fill="#fff" fill-opacity=".9" />
      <path d="M14 50C20 42 26 35 33 28" {...hiLine} stroke-width="1.6" />
      <g fill="#fff" stroke={dark} stroke-width="1" paint-order="stroke" fill-opacity=".95">
        <path d="M13 17l1.8 4 4 1.8-4 1.8-1.8 4-1.8-4-4-1.8 4-1.8Z" />
        <path d="M52 48l1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4Z" />
      </g>
    </>
  ),
  // Meteor: burning rock with a flaming tail
  meteor: () => (
    <>
      <g {...main}>
        <path d="M31 22L5 5C9 13 8 17 3 22C10 22 14 24 17 29C13 33 9 35 5 36C14 38 21 38 29 36Z" fill-opacity=".9" />
        <circle cx="40" cy="38" r="17" />
      </g>
      <path d="M26 21L11 10C13 16 12 19 9 22C15 22 19 25 22 29Z" fill="#ffd06a" />
      <path d="M26 53A17 17 0 0 0 54 40A17 17 0 0 1 26 53Z" {...shade} fill-opacity=".38" />
      <circle cx="46" cy="44" r="4" {...shade} />
      <circle cx="34" cy="33" r="3" {...shade} />
      <circle cx="47" cy="30" r="2" {...shade} />
      <path d="M33 28C37 24 44 23 49 26" {...hiLine} />
    </>
  ),
  // Black Hole: accretion rings round a void
  vortex: () => (
    <>
      <g fill="none" stroke={dark} stroke-width="8" stroke-linecap="round">
        <ellipse cx="32" cy="32" rx="28" ry="11" transform="rotate(-24 32 32)" />
        <path d="M30 3C48 4 59 20 52 35" />
        <path d="M34 61C16 60 5 44 12 29" />
      </g>
      <g fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round">
        <ellipse cx="32" cy="32" rx="28" ry="11" transform="rotate(-24 32 32)" />
        <path d="M30 3C48 4 59 20 52 35" opacity=".85" />
        <path d="M34 61C16 60 5 44 12 29" opacity=".85" />
      </g>
      <ellipse cx="32" cy="32" rx="19" ry="7" transform="rotate(-24 32 32)" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.6" />
      <circle cx="32" cy="32" r="10" fill="#0a0612" stroke="currentColor" stroke-width="2.4" />
      <circle cx="29" cy="29" r="2.6" fill="#fff" fill-opacity=".25" />
    </>
  ),
  // Frost Nova: six-armed snowflake
  snowflake: () => (
    <>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <g transform={`rotate(${a} 32 32)`}>
          <g fill="none" stroke={dark} stroke-width="7.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M32 32V6M32 15L25 8M32 15L39 8M32 24L26.5 19M32 24L37.5 19" />
          </g>
          <g fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M32 32V6M32 15L25 8M32 15L39 8M32 24L26.5 19M32 24L37.5 19" />
          </g>
        </g>
      ))}
      <path d="M32 21L41 26.5V37.5L32 43L23 37.5V26.5Z" fill="currentColor" stroke={dark} stroke-width="2.6" stroke-linejoin="round" paint-order="stroke" />
      <path d="M32 24L38 27.6V32L32 28Z" fill="#fff" fill-opacity=".6" />
    </>
  ),
  // Hydra: three serpent heads rising from the pool
  hydra: () => {
    const neck = ['M22 56C13 46 10 36 14 24', 'M32 56C31 44 30 32 33 19', 'M42 56C51 46 54 36 50 24'];
    return (
      <>
        <ellipse cx="32" cy="57" rx="22" ry="5.5" fill="currentColor" stroke={dark} stroke-width="2.6" fill-opacity=".85" />
        <g fill="none" stroke={dark} stroke-width="11" stroke-linecap="round">
          {neck.map((d) => <path d={d} />)}
        </g>
        <g fill="none" stroke="currentColor" stroke-width="6.2" stroke-linecap="round">
          {neck.map((d) => <path d={d} />)}
        </g>
        <g fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" stroke-linecap="round">
          <path d="M20 52C14 45 12 38 14 30" /><path d="M31 50C30 42 30 34 32 26" /><path d="M44 52C50 45 52 38 50 30" />
        </g>
        {[[13, 21, -1, -18], [33, 15, 1, 8], [51, 21, 1, 18]].map(([x, y, s, r]) => (
          <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s} 1)`}>
            <path d="M-8 2C-8 -6 3 -8 8 -4L16 0L8 5C4 8 -8 8 -8 2Z" fill="currentColor" stroke={dark} stroke-width="2.8" stroke-linejoin="round" paint-order="stroke" />
            <path d="M-4 -3C0 -5 4 -4 7 -2" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="2" cy="-0.5" r="1.9" fill="#ffe27a" stroke={dark} stroke-width=".8" />
            <path d="M8 3.5L14 1.2" stroke={dark} stroke-width="1.2" stroke-linecap="round" />
          </g>
        ))}
      </>
    );
  },
  // Magic Weapon: sigil circle with an inscribed rune
  rune: () => (
    <>
      <g fill="none" stroke={dark} stroke-width="8" stroke-linecap="round">
        <circle cx="32" cy="32" r="23" />
        <path d="M32 16V50M32 31L19 17M32 31L45 17" />
      </g>
      <g fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="32" cy="32" r="23" />
        <path d="M32 16V50M32 31L19 17M32 31L45 17" stroke-width="4" />
      </g>
      <circle cx="32" cy="32" r="18" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.4" stroke-dasharray="2 4" />
      {[0, 90, 180, 270].map((a) => (
        <path d="M32 3.6L35 8L32 12.4L29 8Z" transform={`rotate(${a} 32 32)`} fill="currentColor" stroke={dark} stroke-width="1.6" paint-order="stroke" />
      ))}
      <circle cx="32" cy="31" r="2.4" fill="#fff" fill-opacity=".85" />
    </>
  ),
  // Tolling Blow: a bronze bell ringing, ripples either side, clapper swinging
  bell: () => (
    <>
      <g fill="none" stroke="currentColor" stroke-linecap="round">
        <path d="M7 21C3 28 3 37 7 44M57 21C61 28 61 37 57 44" stroke-width="3" opacity=".9" />
        <path d="M12.4 26C10.4 30 10.4 35 12.4 39M51.6 26C53.6 30 53.6 35 51.6 39" stroke-width="2.4" opacity=".7" />
      </g>
      <g {...main}>
        <rect x="27" y="3.5" width="10" height="8" rx="3" />
        <path d="M32 10C21.5 10 17.5 19 17.5 30V39C17.5 44 13 46.5 10 49.5H54C51 46.5 46.5 44 46.5 39V30C46.5 19 42.5 10 32 10Z" />
        <rect x="8.5" y="48.5" width="47" height="6.5" rx="3" />
        <circle cx="35" cy="58.5" r="4.2" />
      </g>
      <path d="M32 10C42.5 10 46.5 19 46.5 30V39C46.5 44 51 46.5 54 49.5H32Z" {...shade} fill-opacity=".24" />
      <path d="M10 51.7H54" stroke="#fff" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round" />
      <path d="M22.5 21C23.5 16 26.5 13.6 30.5 13.2" {...hiLine} />
      <path d="M22 33V42" {...hiLine} stroke-width="1.6" stroke-opacity=".4" />
    </>
  ),
  // Sawtooth Hatchet: a serrated hand hatchet mid-spin, trailing a red smear
  hatchet: () => (
    <>
      <g fill="none" stroke-linecap="round">
        <path d="M9 42C7 25 19 10 37 8" stroke={dark} stroke-width="9" opacity=".55" />
        <path d="M9 42C7 25 19 10 37 8" stroke="#c0281e" stroke-width="5.6" opacity=".85" />
        <path d="M15 53C26 61 44 60 54 47" stroke="#c0281e" stroke-width="3.6" opacity=".6" />
      </g>
      <g transform="rotate(-32 32 32)">
        <rect x="25" y="13" width="7.4" height="47" rx="3.4" fill="#7a4a26" {...OUT} />
        <path d="M27 18V54" stroke="#fff" stroke-opacity=".3" stroke-width="1.6" stroke-linecap="round" />
        <g {...main}>
          <path d="M21 12H32C38 12 42 9.5 46.5 6L49 9.4L52.5 10L52 14L55.4 16.2L53 19.8L55.4 23.4L52 25.6L52.5 29.4L49.2 30.6L48.4 34.4C42 30.6 38 29.6 32 29.6H21Z" />
        </g>
        <path d="M44.2 7.6L46.5 6L49 9.4L52.5 10L52 14L55.4 16.2L53 19.8L55.4 23.4L52 25.6L52.5 29.4L49.2 30.6L48.4 34.4L45.4 32.4C47.4 24.4 47.2 15.2 44.2 7.6Z" fill="#e8e2d6" stroke={dark} stroke-width="1.8" stroke-linejoin="round" paint-order="stroke" />
        <path d="M32 29.6C38 29.6 42 30.6 48.4 34.4L49 31C43 27.6 38.6 26.6 32 26.6Z" {...shade} />
        <path d="M33 14.8C38 14.8 41.5 13.4 45 11" {...hiLine} />
        <circle cx="28.7" cy="20.6" r="2" fill={dark} />
      </g>
    </>
  ),
  // Muster Standard: a planted pole flying a madder banner with a hearth sigil
  banner: () => (
    <>
      <path d="M4 61H30" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" opacity=".6" />
      <rect x="13" y="8" width="5.4" height="53.5" rx="2.4" fill="#6b4a2c" {...OUT} />
      <path d="M15.7 1L20.2 9.6H11.2Z" fill="#e3d4ae" {...OUT} />
      <g {...main}>
        <path d="M18.4 11C30 7.5 42 14 59 10L52.5 23.5L59 37C42 41 30 34.5 18.4 37.5Z" />
      </g>
      <path d="M18.4 31.5C30 28.5 42 34.5 56.6 32L59 37C42 41 30 34.5 18.4 37.5Z" {...shade} />
      <path d="M28.6 32V25C28.6 20.4 33 18 36.4 18C39.8 18 44.2 20.4 44.2 25V32" fill="none" stroke={dark} stroke-width="5.2" stroke-linecap="round" />
      <path d="M28.6 32V25C28.6 20.4 33 18 36.4 18C39.8 18 44.2 20.4 44.2 25V32" fill="none" stroke="#ffe3a0" stroke-width="2.4" stroke-linecap="round" />
      <path d="M36.4 31.4C33.6 29.8 33.6 26.8 35.4 24.6C35.4 26.4 36.4 26.6 37.2 25.6C37.2 23.8 36.4 22.6 37.2 20.8C40.4 23 40.8 27 39.2 29.6C38.6 30.8 37.6 31.4 36.4 31.4Z" fill="#ffc861" stroke={dark} stroke-width="1.2" stroke-linejoin="round" paint-order="stroke" />
      <path d="M22 14.5C30 12.5 37 15.5 46 14" {...hiLine} stroke-width="1.7" />
    </>
  ),
  // Ironplough: a steel share driving through the earth, soil curling over it, furrows behind
  plough: () => (
    <>
      <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".75">
        <path d="M3 52C14 47.5 25 47.5 35 51" />
        <path d="M3 60C14 55.5 25 55.5 35 59" />
      </g>
      <g {...main}>
        <path d="M28 52C32 36 44 27 61 28C58 40 52 51 41 58C36 56 32 54 28 52Z" />
        <circle cx="53" cy="17" r="4.2" />
        <circle cx="60" cy="22" r="2.8" />
        <circle cx="44" cy="14.5" r="2.8" />
      </g>
      <path d="M41 58C52 51 58 40 61 28C58 42 51 50 44 55Z" {...shade} />
      <g fill="none" stroke-linecap="round">
        <path d="M5 5L25 26" stroke={dark} stroke-width="8.4" />
        <path d="M5 5L25 26" stroke="#9a7a52" stroke-width="4.4" />
      </g>
      <path d="M19 21L45 31L54 49L34 50C28.5 43 23 33 19 21Z" fill="#d9d3c5" {...OUT} />
      <path d="M34 50L54 49L49.6 44.4L35.4 44.6Z" {...shade} />
      <path d="M23 25L42 32.4" {...hiLine} stroke-opacity=".85" />
    </>
  ),
  // Cairnfall: a stack of flat stones, a capstone dropping onto it
  cairn: () => (
    <>
      <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".8">
        <path d="M24 2V9M32 1V8M40 2V9" />
        <path d="M4 58C5.6 54.4 8.6 54.6 9.6 57M60 58C58.4 54.4 55.4 54.6 54.4 57" />
      </g>
      <g {...main}>
        <rect x="21" y="12" width="21" height="9" rx="4.5" transform="rotate(-10 31.5 16.5)" />
        <rect x="8" y="47" width="48" height="12" rx="6" />
        <rect x="14" y="37" width="36" height="11" rx="5.5" />
        <rect x="21" y="28.5" width="23" height="9.5" rx="4.75" />
      </g>
      <path d="M8.6 54H55.4C54.6 57 52.5 59 50 59H14C11.5 59 9.4 57 8.6 54Z" {...shade} />
      <path d="M14.6 43.5H49.4C48.6 46.5 47 48 44.5 48H19.5C17 48 15.4 46.5 14.6 43.5Z" {...shade} />
      <path d="M13 51H37M19 41H35M25.5 32H36" {...hiLine} stroke-width="1.8" />
    </>
  ),
  // Kilnheart: a domed brick kiln, its arched mouth roaring, smoke curling from the flue
  furnace: () => (
    <>
      <path d="M41 7C46 3 52 5 51 10C56 11 56 17 51 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" opacity=".55" />
      <rect x="38.5" y="11" width="9" height="14" rx="2" fill="#4a2a18" {...OUT} />
      <g {...main}>
        <path d="M7 52C7 30 17 16 32 16C47 16 57 30 57 52Z" />
      </g>
      <path d="M32 16C47 16 57 30 57 52H45C45 36 40 22 32 16Z" {...shade} />
      <g fill="none" stroke="#000" stroke-opacity=".3" stroke-width="2" stroke-linecap="round">
        <path d="M13 32H51M10 42H54M24 17.5V32M40 17.5V32M18 32V42M32 32V42M46 32V42" />
      </g>
      <path d="M20 52V43C20 36 25.5 32 32 32C38.5 32 44 36 44 43V52Z" fill="#2a0e06" stroke={dark} stroke-width="2.4" />
      <path d="M32 51C26 48.6 25.4 43 29 39C29 41.8 30.6 42.6 31.8 41C31.8 37.8 30.6 35.4 32.2 33C38 36.6 39.2 43.4 36.4 47.4C35.2 49.6 33.8 51 32 51Z" fill="#ffd36a" stroke="#ff8a2a" stroke-width="1.2" />
      <path d="M32 50C29.6 48.8 29.4 46 31 44.2C31.4 45.6 32.4 45.8 33 45C34.6 46.6 34.4 49.4 32 50Z" fill="#fff6d0" />
      <rect x="4" y="51" width="56" height="8" rx="3" {...main} />
      <path d="M6 54H58" stroke="#fff" stroke-opacity=".4" stroke-width="1.6" stroke-linecap="round" />
      <path d="M14 26C17 21 22 18 27 17.4" {...hiLine} />
    </>
  ),
  // ── ranger M1 (docs/rework/depth/RANGER.md §3 "VFX / icon / sound") ──
  // Skipstone Bolt: a flat slate skimming away, leaving receding water ripples where it skipped
  skip: () => (
    <>
      <g fill="none" stroke="currentColor" stroke-linecap="round">
        <ellipse cx="13" cy="54" rx="10" ry="3.6" stroke-width="2.6" opacity=".9" />
        <ellipse cx="13" cy="54" rx="4.6" ry="1.6" stroke-width="1.8" opacity=".6" />
        <ellipse cx="31" cy="47" rx="8" ry="2.9" stroke-width="2.4" opacity=".8" />
        <ellipse cx="46" cy="41" rx="6" ry="2.2" stroke-width="2" opacity=".7" />
      </g>
      <path d="M13 52C17 39 27 38 31 45C34 37 43 34 46 39C48 33 50 30 52 28" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-dasharray="2.5 4" stroke-linecap="round" />
      <g transform="rotate(-18 50 19)">
        <g {...main}><path d="M37 20C38 14 46 11 54 11.5C61 12 64 16 62.5 20.5C61 25 53 27.5 46 27C40 26.5 36.5 24 37 20Z" /></g>
        <path d="M38.6 22.4C44 25.6 54 26.2 61 22" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="2.4" stroke-linecap="round" />
        <path d="M40.5 17.6C43.5 14.4 50 13.4 56 14" {...hiLine} />
      </g>
      <path d="M26 21H34M23 27.5H31" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".7" />
    </>
  ),
  // Spring Snare: open toothed iron jaws on their plate, a coil of rope and its stake
  snare: () => (
    <>
      <g fill="none" stroke-linecap="round">
        <path d="M8 47C1 42 6 34 14 36C21 38 19 47 11 46.5C5 46 5 40 11 39" stroke={dark} stroke-width="7.4" />
        <path d="M8 47C1 42 6 34 14 36C21 38 19 47 11 46.5C5 46 5 40 11 39" stroke="currentColor" stroke-width="3.6" />
        <path d="M17 43.5C19.5 44.6 21 45.6 22.5 45.6" stroke={dark} stroke-width="6.6" />
        <path d="M17 43.5C19.5 44.6 21 45.6 22.5 45.6" stroke="currentColor" stroke-width="3" />
      </g>
      <rect x="2" y="24" width="5" height="16" rx="2" fill="#7a5a36" {...OUT} stroke-width="2.4" />
      <ellipse cx="41" cy="44" rx="8" ry="3.6" fill="#4a4e56" {...OUT} stroke-width="2.4" />
      <g fill="none">
        <ellipse cx="41" cy="44" rx="19.5" ry="10" stroke={dark} stroke-width="9.6" />
        <ellipse cx="41" cy="44" rx="19.5" ry="10" stroke="#c4c1b9" stroke-width="5.6" />
        <path d="M24 40C28 35.5 35 33.8 41 33.8C47 33.8 54 35.5 58 40" stroke="#fff" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round" />
      </g>
      <g fill="#e6e3dc" stroke={dark} stroke-width="1.4" stroke-linejoin="round" paint-order="stroke">
        {[200, 228, 256, 284, 312, 340, 20, 48, 76, 104, 132, 160].map((deg) => {
          const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
          const bx = 41 + 17 * c, by = 44 + 7.8 * s, tx = 41 + 11.4 * c, ty = 44 + 4.2 * s, ux = -s * 2.4, uy = c * 1.2;
          return <path d={`M${(bx + ux).toFixed(1)} ${(by + uy).toFixed(1)}L${tx.toFixed(1)} ${ty.toFixed(1)}L${(bx - ux).toFixed(1)} ${(by - uy).toFixed(1)}Z`} />;
        })}
      </g>
      <path d="M19.5 44l1.4-2.4 1.4 4.8 1.4-2.4M58.5 44l1.4-2.4 1.4 4.8 1.4-2.4" fill="none" stroke={dark} stroke-width="1.6" stroke-linejoin="round" />
      <path d="M52 15l1.8 4 4 1.8-4 1.8-1.8 4-1.8-4-4-1.8 4-1.8Z" fill="#fff" fill-opacity=".85" stroke={dark} stroke-width="1.2" />
    </>
  ),
  // Overcast Volley: a shot climbing into a grey cloud, thin shafts falling out of it onto little dust puffs
  overcast: () => (
    <>
      <path d="M9 60V41" stroke="currentColor" stroke-width="2.4" stroke-dasharray="1.5 4" stroke-linecap="round" opacity=".75" />
      <g {...main} stroke-width="2.8">
        <rect x="7.6" y="24" width="2.8" height="16" rx="1.4" />
        <path d="M9 14L14.2 26H3.8Z" />
      </g>
      <g {...main}><path d="M21 33C13 33 12 23 20 21C21 13 33 10 38 17C46 12 58 17 56 26C62 28 61 35 54 35H23Z" /></g>
      <path d="M23 35H54" stroke="#000" stroke-opacity=".3" stroke-width="3" stroke-linecap="round" />
      <path d="M22 26C21 22 23 20.4 27 20.6" {...hiLine} />
      {[[27, 40], [38, 44], [49, 39]].map(([x, y]) => (
        <g>
          <path d={`M${x + 2} ${y}L${x - 2} ${y + 12}`} stroke={dark} stroke-width="4.4" stroke-linecap="round" />
          <path d={`M${x + 2} ${y}L${x - 2} ${y + 12}`} stroke="#ece4d0" stroke-width="2" stroke-linecap="round" />
          <path d={`M${x - 8} ${y + 17}c1.6-2.6 4-2.6 5 0c1-2.6 3.4-2.6 5 0`} fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".85" />
        </g>
      ))}
    </>
  ),
  // Quarry Mark: an almond eye with a golden iris, two pale feathers sweeping down from its corners
  eye: () => (
    <>
      {[1, -1].map((sx) => (
        <g transform={`translate(32 0) scale(${sx} 1)`}>
          <path d="M9 31C21 33 26 44 25 61C16 55 10 46 6 37Z" fill="#f2e8cc" {...OUT} />
          <path d="M8 33C16 38 22 46 24 58" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <path d="M12 41L8 45M16 47L12 51.5" stroke="#000" stroke-opacity=".3" stroke-width="1.4" stroke-linecap="round" />
        </g>
      ))}
      <path d="M3 28C17 8 47 8 61 28C47 48 17 48 3 28Z" fill="#f6eed6" {...OUT} />
      <circle cx="32" cy="28" r="12" {...main} />
      <circle cx="32" cy="28" r="12" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="3" />
      <ellipse cx="32" cy="28" rx="3.4" ry="9" fill={dark} />
      <circle cx="27.6" cy="23.4" r="2.6" fill="#fff" fill-opacity=".9" />
      <path d="M10 22.6C20 13.4 44 13.4 54 22.6" {...hiLine} stroke-opacity=".45" />
      <path d="M32 1L36 6L32 11L28 6Z" {...main} stroke-width="2.2" />
    </>
  ),
  // Pitch Mortar: a squat iron mortar in its wooden bed on a sled, a burning pitch pot arcing out of a smoke puff
  mortar: () => (
    <>
      <path d="M37 21C42 11 51 7 57 10" fill="none" stroke="#e8d3a2" stroke-width="2" stroke-dasharray="1.5 4.2" stroke-linecap="round" opacity=".8" />
      <circle cx="55" cy="15" r="5.8" fill="#8a5a3a" {...OUT} stroke-width="2.6" />
      <path d="M50.6 13.6C53 12 57 12 59.6 13.6" fill="none" stroke={dark} stroke-width="2" />
      <path d="M55 9.2C53 7 54 3.8 56.4 2.2C56.6 4.2 58.4 4.8 58 7.2C57.8 8.6 56.6 9.6 55 9.2Z" fill="#ffc048" stroke={dark} stroke-width="1.2" />
      <path d="M30 25C26 23 27 17 32 17C33 13 39 13 40 17C44 17 45 22 41 24Z" fill="#d6d0c4" fill-opacity=".9" stroke={dark} stroke-width="2" />
      <g transform="rotate(-40 28 40)">
        <rect x="14" y="31" width="27" height="18" rx="7" fill="#6a6e76" {...OUT} />
        <rect x="20" y="30.6" width="3.6" height="18.8" rx="1.6" fill="#3a3e44" />
        <rect x="30" y="30.6" width="3.6" height="18.8" rx="1.6" fill="#3a3e44" />
        <ellipse cx="41" cy="40" rx="3.6" ry="9.4" fill="#7e828a" {...OUT} />
        <ellipse cx="41.8" cy="40" rx="1.8" ry="6.4" fill={dark} />
        <path d="M17 34.4H38" {...hiLine} stroke-width="1.6" />
      </g>
      <g {...main}>
        <path d="M14 53L18 41H36L40 53Z" />
        <rect x="4" y="52" width="50" height="6" rx="2.6" />
      </g>
      <path d="M17 44.6H37" stroke="#fff" stroke-opacity=".3" stroke-width="1.6" stroke-linecap="round" />
      <path d="M4 61H50C55 61 58 59 60 55" fill="none" stroke={dark} stroke-width="5" stroke-linecap="round" />
      <path d="M4 61H50C55 61 58 59 60 55" fill="none" stroke="#a87a4a" stroke-width="2.4" stroke-linecap="round" />
      <path d="M8 54.4H50" stroke="#fff" stroke-opacity=".35" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="27" cy="46" r="2.6" fill="#3a3e44" stroke={dark} stroke-width="1.2" />
    </>
  ),
  // Murmuration: a folding ribbon of tiny starlings silhouetted against a pale dusk sky, a few stragglers near
  flock: () => (
    <>
      <circle cx="32" cy="32" r="28" fill="#cbd6e0" fill-opacity=".16" />
      <path d="M8 40C16 22 26 46 34 34C42 22 50 30 58 24" fill="none" stroke="#cbd6e0" stroke-opacity=".22" stroke-width="12" stroke-linecap="round" />
      <g fill="currentColor" stroke="#d6dee6" stroke-width="1" stroke-linejoin="round" paint-order="stroke">{FLOCK_MARKS.map(([x, y, s]) => <path d={birdPath(x, y, s)} />)}</g>
      <g fill="currentColor" stroke="#d6dee6" stroke-width="1.2" stroke-linejoin="round" paint-order="stroke">
        {([[50, 12, 5], [57, 19, 4], [43, 7, 3.6]] as const).map(([x, y, s]) => <path d={birdPath(x, y, s)} />)}
      </g>
    </>
  ),
  // generic fallback
  unknown: () => (
    <g {...main}>
      <path d="M32 6L56 32L32 58L8 32Z" />
      <path d="M32 18L44 32L32 46L20 32Z" fill="#000" fill-opacity=".3" />
    </g>
  ),
};

export const GLYPH_IDS = Object.keys(GLYPHS);

export function SkillGlyph(p: { glyph: string; color: string; size?: number | string; class?: string }) {
  const g = GLYPHS[p.glyph] ?? GLYPHS.unknown;
  return (
    <svg class={`hud-glyph ${p.class ?? ''}`} viewBox="0 0 64 64" width={p.size} height={p.size} style={{ color: p.color }} aria-hidden="true">
      {g()}
    </svg>
  );
}

// ───────────────────────── Small marks ─────────────────────────

export function DashGlyph(p: { color?: string }) {
  return (
    <svg class="hud-glyph" viewBox="0 0 64 64" style={{ color: p.color ?? '#dbe9f5' }} aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" opacity=".75">
        <path d="M4 22H16M2 32H12M4 42H16" />
      </g>
      <g {...main}>
        <path d="M14 14H28L47 32L28 50H14L33 32Z" fill-opacity=".55" />
        <path d="M30 14H44L63 32L44 50H30L49 32Z" />
      </g>
      <path d="M36 17.5H43L57 31" {...hiLine} stroke-width="1.8" />
    </svg>
  );
}

export function MouseGlyph() {
  return (
    <svg class="hud-mouse" viewBox="0 0 24 32" aria-hidden="true">
      <path d="M12 1.5C6 1.5 2.5 5.5 2.5 11V21C2.5 26.5 6 30.5 12 30.5S21.5 26.5 21.5 21V11C21.5 5.5 18 1.5 12 1.5Z" fill="#1a130d" stroke="#c9a45c" stroke-width="1.6" />
      <path d="M12 1.5C6 1.5 2.5 5.5 2.5 11V14H11V1.5Z" fill="#f2d58c" />
      <path d="M2.5 14H21.5M12 1.5V14" stroke="#c9a45c" stroke-width="1.4" fill="none" />
    </svg>
  );
}

export function CoinGlyph() {
  return (
    <svg class="hud-mini" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="13" rx="9" ry="8.5" fill="#6e4d12" />
      <ellipse cx="12" cy="11.5" rx="9" ry="8.5" fill="#e9bf4a" stroke="#4a3208" stroke-width="1.4" />
      <ellipse cx="12" cy="11.5" rx="5.8" ry="5.3" fill="none" stroke="#a97a1c" stroke-width="1.4" />
      <path d="M6.5 8.5C8 5.6 11 4.6 14 5.2" stroke="#fff6cf" stroke-width="1.4" fill="none" stroke-linecap="round" />
    </svg>
  );
}

export function GemMark(p: { color: string }) {
  return (
    <svg class="hud-mini" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 9L9 4H15L19 9L12 21Z" fill={p.color} stroke="#150c07" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M5 9H19M9 4L12 9L15 4M12 9L12 21" stroke="#fff" stroke-opacity=".5" stroke-width="1" fill="none" />
      <path d="M5 9L9 4L12 9Z" fill="#fff" fill-opacity=".35" />
    </svg>
  );
}

// ───────────────────────── Buffs ─────────────────────────

const BUFF_SHAPES: Record<string, G> = {
  up: () => (
    <g {...main}>
      <path d="M32 8L54 32H41V56H23V32H10Z" />
    </g>
  ),
  crit: () => (
    <>
      <g fill="none" stroke={dark} stroke-width="8" stroke-linecap="round">
        <circle cx="32" cy="32" r="18" /><path d="M32 4V20M32 44V60M4 32H20M44 32H60" />
      </g>
      <g fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round">
        <circle cx="32" cy="32" r="18" /><path d="M32 4V20M32 44V60M4 32H20M44 32H60" />
      </g>
      <circle cx="32" cy="32" r="4" fill="currentColor" stroke={dark} stroke-width="1.6" />
    </>
  ),
  shield: () => (
    <>
      <g {...main}><path d="M32 5L54 13V32C54 46 44 55 32 60C20 55 10 46 10 32V13Z" /></g>
      <path d="M32 11L48 17V32C48 43 41 50 32 54Z" {...shade} />
      <path d="M16 18L32 12" {...hiLine} />
    </>
  ),
  flame: () => (
    <>
      <g {...main}><path d="M32 4C34 16 50 22 50 40C50 52 42 60 32 60C22 60 14 52 14 40C14 32 18 28 22 24C22 31 26 33 28 33C26 22 28 12 32 4Z" /></g>
      <path d="M32 60C26 60 22 55 22 48C22 42 27 38 31 32C33 38 40 41 40 49C40 55 37 60 32 60Z" fill="#ffe08a" />
    </>
  ),
  bolt: () => (
    <g {...main}><path d="M38 3L14 36H29L24 61L50 25H34Z" /></g>
  ),
  star: () => (
    <g {...main}><path d="M32 4L39 24L60 25L43 38L49 59L32 47L15 59L21 38L4 25L25 24Z" /></g>
  ),
  // ── ranger M1 buffs (docs/rework/depth/RANGER.md §5–§8; set motifs: rain, antler, knot, feather) ──
  drop: () => (
    <>
      <g {...main}><path d="M32 4C40 18 52 28 52 41C52 52 43 60 32 60C21 60 12 52 12 41C12 28 24 18 32 4Z" /></g>
      <path d="M22 40C22 33 26 27 30 22" {...hiLine} />
      <path d="M32 60C43 60 52 52 52 41C52 38 51 35 50 33C48 47 40 55 28 56Z" {...shade} />
    </>
  ),
  eye: () => (
    <>
      <path d="M3 32C17 12 47 12 61 32C47 52 17 52 3 32Z" fill="#f6eed6" {...OUT} />
      <circle cx="32" cy="32" r="12" {...main} />
      <ellipse cx="32" cy="32" rx="3.4" ry="9" fill={dark} />
      <circle cx="27.6" cy="27.4" r="2.6" fill="#fff" fill-opacity=".9" />
    </>
  ),
  horn: () => (
    <>
      {/* a hunting horn: thin mouthpiece at the left, the curve flaring into a wide bell at the right */}
      <g {...main}><path d="M3 24C9 22 17 28 29 31C41 34 49 28 53 16L62 46C52 52 38 51 26 45C16 40 9 32 3 29Z" /></g>
      <ellipse cx="57.5" cy="31" rx="3.6" ry="14.6" transform="rotate(-18 57.5 31)" fill={dark} />
      <ellipse cx="57.5" cy="31" rx="1.8" ry="11" transform="rotate(-18 57.5 31)" fill="#000" fill-opacity=".5" />
      <rect x="1" y="23" width="5" height="8" rx="2" {...main} stroke-width="2.2" />
      <path d="M12 26C19 28 26 33 37 35" {...hiLine} />
      <path d="M22 40C30 45 40 47 50 44" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="2.4" stroke-linecap="round" />
      <path d="M33 33V47M42 33V49" stroke={dark} stroke-width="2.2" stroke-opacity=".6" />
    </>
  ),
  antler: () => (
    <>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 60C20 44 16 32 8 22M17 40C10 38 6 32 4 26M14 30C16 22 14 14 10 8M44 60C46 44 50 32 58 22M49 40C56 38 60 32 62 26M52 30C50 22 52 14 56 8" stroke={dark} stroke-width="9" />
        <path d="M22 60C20 44 16 32 8 22M17 40C10 38 6 32 4 26M14 30C16 22 14 14 10 8M44 60C46 44 50 32 58 22M49 40C56 38 60 32 62 26M52 30C50 22 52 14 56 8" stroke="currentColor" stroke-width="5" />
      </g>
      <path d="M21 54C20 46 18 38 14 32" {...hiLine} stroke-width="1.6" />
    </>
  ),
  howl: () => (
    <>
      <path d="M44 6C47 9 48 12 47.6 15M51 4C55 8 57 13 56 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" opacity=".8" />
      <g {...main}><path d="M14 60C14 46 18 36 24 30L22 18L30 25C34 22 38 18 41 12L44 20C42 26 38 30 36 34C42 38 46 46 46 60Z" /></g>
      <path d="M25 31L23 20L29 26" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="2" />
      <circle cx="35.6" cy="26.6" r="1.8" fill={dark} />
      <path d="M20 46C21 40 24 36 28 34" {...hiLine} />
    </>
  ),
  jaws: () => (
    <>
      <ellipse cx="32" cy="34" rx="25" ry="14" fill="none" stroke={dark} stroke-width="11" />
      <ellipse cx="32" cy="34" rx="25" ry="14" fill="none" stroke="currentColor" stroke-width="6.4" />
      <g fill="#ece8e0" stroke={dark} stroke-width="1.4" stroke-linejoin="round" paint-order="stroke">
        {[210, 245, 280, 315, 30, 65, 100, 135].map((deg) => {
          const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
          const bx = 32 + 21 * c, by = 34 + 10.6 * s, tx = 32 + 13 * c, ty = 34 + 5.4 * s, ux = -s * 3, uy = c * 1.5;
          return <path d={`M${(bx + ux).toFixed(1)} ${(by + uy).toFixed(1)}L${tx.toFixed(1)} ${ty.toFixed(1)}L${(bx - ux).toFixed(1)} ${(by - uy).toFixed(1)}Z`} />;
        })}
      </g>
      <path d="M12 28C18 22 26 20 32 20C38 20 46 22 52 28" {...hiLine} stroke-width="1.6" />
    </>
  ),
  wing: () => (
    <>
      <g {...main}><path d="M32 5L54 13V32C54 46 44 55 32 60C20 55 10 46 10 32V13Z" /></g>
      <path d="M32 11L48 17V32C48 43 41 50 32 54Z" {...shade} />
      <g fill={dark}>{([[24, 30, 5], [36, 26, 4.2], [30, 38, 4.4], [42, 36, 3.6], [22, 42, 3.4]] as const).map(([x, y, s]) => <path d={birdPath(x, y, s)} />)}</g>
    </>
  ),
  hide: () => (
    <>
      <g {...main}><path d="M14 8C22 12 26 10 32 6C38 10 42 12 50 8C50 18 56 22 58 30C52 34 52 44 56 54C46 52 40 56 32 60C24 56 18 52 8 54C12 44 12 34 6 30C8 22 14 18 14 8Z" /></g>
      <path d="M22 18C27 21 37 21 42 18M20 30C26 33 38 33 44 30M22 42C27 45 37 45 42 42" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="2.2" stroke-linecap="round" />
      <path d="M17 14C19 20 18 26 14 30" {...hiLine} stroke-width="1.6" />
    </>
  ),
};

export function BuffGlyph(p: { shape: string; color: string }) {
  const g = BUFF_SHAPES[p.shape] ?? BUFF_SHAPES.up;
  return (
    <svg class="hud-glyph" viewBox="0 0 64 64" style={{ color: p.color }} aria-hidden="true">{g()}</svg>
  );
}

// ───────────────────────── Class emblems (portrait, class select) ─────────────────────────

export function ClassEmblem(p: { classId: ClassId; color?: string }) {
  const c = p.color ?? '#e8d6b0';
  if (p.classId === 'warrior') {
    return (
      <svg class="hud-glyph" viewBox="0 0 64 64" style={{ color: c }} aria-hidden="true">
        {[45, -45].map((a) => (
          <g transform={`rotate(${a} 32 32)`}>
            <g {...main}>
              <path d="M32 2L36.5 9V41H27.5V9Z" />
              <rect x="20" y="41" width="24" height="5.4" rx="2.2" />
              <rect x="29.5" y="46" width="5" height="10" rx="1.6" />
              <circle cx="32" cy="58" r="3.4" />
            </g>
            <path d="M32 6V38" {...hiLine} stroke-width="1.4" />
            <path d="M32 6L36.5 9V41H32Z" {...shade} fill-opacity=".22" />
          </g>
        ))}
      </svg>
    );
  }
  if (p.classId === 'ranger') {
    return (
      <svg class="hud-glyph" viewBox="0 0 64 64" style={{ color: c }} aria-hidden="true">
        <path d="M44 4C16 10 16 54 44 60" fill="none" stroke={dark} stroke-width="9" stroke-linecap="round" />
        <path d="M44 4C16 10 16 54 44 60" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
        <path d="M44 4V60" stroke={dark} stroke-width="2.6" />
        <path d="M44 4V60" stroke="#f2e6c8" stroke-width="1" />
        <g {...main}>
          <rect x="9" y="29.6" width="48" height="4.8" rx="2.4" />
          <path d="M62 32L48 23.5L51 32L48 40.5Z" />
          <path d="M8 32L2 24H13L17 32L13 40H2Z" />
        </g>
        <path d="M14 31.2H46" {...hiLine} stroke-width="1.3" />
      </svg>
    );
  }
  return (
    <svg class="hud-glyph" viewBox="0 0 64 64" style={{ color: c }} aria-hidden="true">
      <g {...main}>
        <path d="M33 3C34 14 41 28 45 45H19C24 32 29 18 33 3Z" />
        <ellipse cx="32" cy="46" rx="25" ry="7.2" />
      </g>
      <path d="M19 45H45L46 41H18Z" {...shade} fill-opacity=".4" />
      <path d="M28 10C27 20 24 30 22 38" {...hiLine} />
      <path d="M32 24l2.2 5 5.2.6-4 3.4 1.2 5.2-4.6-2.8-4.6 2.8 1.2-5.2-4-3.4 5.2-.6Z" fill="#ffe08a" stroke={dark} stroke-width="1.2" stroke-linejoin="round" />
      <path d="M50 14l1.4 3.2 3.2 1.4-3.2 1.4L50 23l-1.4-3-3.2-1.4 3.2-1.4Z" fill="#fff" stroke={dark} stroke-width="1" />
    </svg>
  );
}

/** Ornamental divider: hairline with a gold diamond in the middle. */
export function Divider(p: { class?: string }) {
  return (
    <svg class={`hud-divider ${p.class ?? ''}`} viewBox="0 0 400 16" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="hud-div-l" x1="0" x2="1">
          <stop offset="0" stop-color="#c9a45c" stop-opacity="0" />
          <stop offset="1" stop-color="#c9a45c" stop-opacity=".9" />
        </linearGradient>
        <linearGradient id="hud-div-r" x1="1" x2="0">
          <stop offset="0" stop-color="#c9a45c" stop-opacity="0" />
          <stop offset="1" stop-color="#c9a45c" stop-opacity=".9" />
        </linearGradient>
      </defs>
      <rect x="6" y="7.4" width="176" height="1.2" fill="url(#hud-div-l)" />
      <rect x="218" y="7.4" width="176" height="1.2" fill="url(#hud-div-r)" />
      <path d="M200 1L208 8L200 15L192 8Z" fill="#c9a45c" stroke="#150c07" stroke-width="1" />
      <path d="M200 4.5L204.5 8L200 11.5L195.5 8Z" fill="#f2d58c" />
      <path d="M186 8L190 5.5V10.5ZM214 8L210 5.5V10.5Z" fill="#c9a45c" />
    </svg>
  );
}
