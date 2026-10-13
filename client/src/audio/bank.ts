// Procedural sound bank. Every sound is one or more ZzFX voices mixed into a single mono buffer
// (with optional exponential decay per layer, which ZzFX's linear release can't do — bells and booms
// need it). Pure data + maths: no AudioContext here, so the bank can be rendered and inspected anywhere.
//
// Mixing philosophy: soft attacks, low-passed noise, sine/triangle bodies, nothing piercing above ~5 kHz
// except tiny sparkle layers. Loud-but-rare moments (legendary, level-up) get the most headroom.

/** Named ZzFX parameters (see ZZFX.buildSamples for the positional order). */
export interface P {
  vol?: number; freq?: number; attack?: number; sustain?: number; release?: number;
  shape?: number; curve?: number; slide?: number; dslide?: number; jump?: number; jumpTime?: number;
  repeat?: number; noise?: number; mod?: number; crush?: number; delay?: number; sustainVol?: number;
  decay?: number; tremolo?: number; filter?: number;
}

export interface Layer {
  p: P;
  /** Start offset in seconds. */
  at?: number;
  gain?: number;
  /** Exponential decay time constant (s) applied on top of the ZzFX envelope. */
  exp?: number;
}

export interface SoundDef {
  layers: Layer[];
  /** Playback gain (after peak normalisation). */
  gain: number;
  /** Max starts per 50 ms window. */
  max?: number;
  /** Random playback-rate spread (±). */
  vary?: number;
  /** Never dropped by the voice cap, not ducked. */
  pri?: boolean;
  /** Seamless loop buffer (crossfaded ends). */
  loop?: boolean;
}

export type Build = (...p: number[]) => ArrayLike<number>;

const params = (p: P): number[] => [
  p.vol ?? 1, 0, p.freq ?? 220, p.attack ?? 0, p.sustain ?? 0, p.release ?? 0.1, p.shape ?? 0, p.curve ?? 1,
  p.slide ?? 0, p.dslide ?? 0, p.jump ?? 0, p.jumpTime ?? 0, p.repeat ?? 0, p.noise ?? 0, p.mod ?? 0,
  p.crush ?? 0, p.delay ?? 0, p.sustainVol ?? 1, p.decay ?? 0, p.tremolo ?? 0, p.filter ?? 0,
];

// Note helpers (A4 = 440).
const N = (semi: number) => 440 * 2 ** (semi / 12);
const C5 = N(3), D5 = N(5), E5 = N(7), Fs5 = N(9), G5 = N(10), A5 = N(12), B5 = N(14);
const C6 = N(15), Cs6 = N(16), D6 = N(17), E6 = N(19), G6 = N(22), A6 = N(24);
const G4 = N(-2), A4 = N(0), D4 = N(-7);

/** A struck bell: fundamental + inharmonic-ish partials with exponential decay. */
function bell(freq: number, at: number, gain: number, dur = 1.2): Layer[] {
  return [
    { p: { freq, attack: 0.003, release: dur, shape: 0 }, at, gain, exp: dur * 0.32 },
    { p: { freq: freq * 2.005, attack: 0.002, release: dur * 0.6, shape: 0 }, at, gain: gain * 0.32, exp: dur * 0.16 },
    { p: { freq: freq * 3.01, attack: 0.002, release: dur * 0.3, shape: 0 }, at, gain: gain * 0.1, exp: dur * 0.07 },
  ];
}

function twang(freq: number, at = 0, gain = 1): Layer[] {
  return [
    { p: { freq, attack: 0.002, release: 0.16, shape: 1, slide: -0.6 }, at, gain, exp: 0.05 },
    { p: { freq: 950, attack: 0.008, release: 0.1, shape: 4, filter: -1700 }, at, gain: gain * 0.45 },
  ];
}

export const SOUNDS: Record<string, SoundDef> = {
  // ── combat impacts ──
  hit: {
    gain: 0.3, max: 2, vary: 0.12,
    layers: [
      { p: { freq: 150, release: 0.1, shape: 0, slide: -6, noise: 0.4, filter: -1200 } },
      { p: { freq: 600, release: 0.035, shape: 4, filter: -1900 }, gain: 0.3 },
    ],
  },
  crit: {
    gain: 0.42, max: 2, vary: 0.08,
    layers: [
      { p: { freq: 120, release: 0.14, shape: 0, slide: -5, noise: 0.5, filter: -1000 } },
      { p: { freq: 1400, release: 0.07, shape: 4, filter: -2800 }, gain: 0.4, exp: 0.03 },
      { p: { freq: 1760, release: 0.25, shape: 0 }, gain: 0.16, exp: 0.07 },
    ],
  },
  hurt: {
    gain: 0.5, max: 1, vary: 0.06,
    layers: [
      { p: { freq: 200, release: 0.13, shape: 1, slide: -5, filter: -1200 } },
      { p: { freq: 80, release: 0.15, shape: 0, slide: -2, noise: 0.3 }, gain: 0.8, exp: 0.07 },
    ],
  },
  swing: { gain: 0.26, max: 3, vary: 0.15, layers: [{ p: { freq: 520, attack: 0.03, release: 0.13, shape: 4, slide: 3, filter: -1300 } }] },
  cleave: {
    gain: 0.34, max: 2, vary: 0.1,
    layers: [
      { p: { freq: 420, attack: 0.025, release: 0.16, shape: 4, slide: 2, filter: -1500 } },
      { p: { freq: 2350, attack: 0.012, release: 0.2, shape: 0, slide: -1 }, gain: 0.08, exp: 0.06 },
    ],
  },
  rend: {
    gain: 0.42, max: 2, vary: 0.08,
    layers: [
      { p: { freq: 900, attack: 0.005, release: 0.12, shape: 4, slide: -3, filter: -1900 } },
      { p: { freq: 760, attack: 0.005, release: 0.12, shape: 4, slide: -3, filter: -1600 }, at: 0.07, gain: 0.8 },
      { p: { freq: 140, release: 0.2, shape: 0, slide: -2 }, gain: 0.45, exp: 0.08 },
    ],
  },
  stomp: {
    gain: 0.6, max: 2, vary: 0.05,
    layers: [
      { p: { freq: 65, release: 0.45, shape: 0, slide: -0.8 }, exp: 0.18 },
      { p: { freq: 120, release: 0.4, shape: 4, filter: -800 }, gain: 0.7, exp: 0.15 },
    ],
  },
  slam: {
    gain: 0.5, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 180, release: 0.3, shape: 4, filter: -1600 }, gain: 0.7, exp: 0.1 },
      { p: { freq: 70, release: 0.4, shape: 0, slide: -0.8 }, gain: 0.9, exp: 0.16 },
      { p: { freq: 45, attack: 0.02, release: 0.7, shape: 0, tremolo: 0.5, repeat: 0.05 }, gain: 0.35, exp: 0.3 },
    ],
  },
  dash: { gain: 0.38, max: 2, vary: 0.1, layers: [{ p: { freq: 600, attack: 0.02, release: 0.2, shape: 4, slide: -3, filter: -1500 } }] },

  // ── projectiles ──
  arrow: { gain: 0.26, max: 3, vary: 0.12, layers: twang(185) },
  multishot: { gain: 0.4, max: 2, vary: 0.06, layers: [...twang(170), ...twang(205, 0.018, 0.8), ...twang(150, 0.034, 0.7)] },
  bolt: {
    gain: 0.24, max: 3, vary: 0.12,
    layers: [
      { p: { freq: 90, release: 0.03, shape: 5, curve: 0.5, filter: -1500 }, gain: 0.5 },
      { p: { freq: 1300, release: 0.09, shape: 1, slide: -12, filter: -3500 }, gain: 0.45 },
    ],
  },
  rocket: { gain: 0.28, max: 2, vary: 0.12, layers: [{ p: { freq: 220, attack: 0.02, sustain: 0.08, release: 0.3, shape: 4, slide: 4, tremolo: 0.4, repeat: 0.05, filter: -1400 } }] },
  missile: {
    gain: 0.26, max: 3, vary: 0.1,
    layers: [
      { p: { freq: 660, release: 0.16, shape: 0, slide: 9 }, exp: 0.08 },
      { p: { freq: 1980, release: 0.12, shape: 0, jump: 300, jumpTime: 0.03 }, gain: 0.18, exp: 0.05 },
    ],
  },
  fireball: {
    gain: 0.3, max: 2, vary: 0.1,
    layers: [
      { p: { freq: 140, attack: 0.02, release: 0.25, shape: 4, slide: 1, filter: -900 } },
      { p: { freq: 90, release: 0.2, shape: 0, slide: -1 }, gain: 0.5 },
    ],
  },
  firebolt: { gain: 0.22, max: 2, vary: 0.12, layers: [{ p: { freq: 200, attack: 0.015, release: 0.18, shape: 4, slide: 2, filter: -1100 } }] },
  seed: { gain: 0.18, max: 2, vary: 0.15, layers: [{ p: { freq: 380, release: 0.08, shape: 1, slide: 6 }, exp: 0.05 }] },
  zap: {
    gain: 0.26, max: 2, vary: 0.12,
    layers: [{ p: { freq: 1200, release: 0.12, shape: 4, tremolo: 0.6, repeat: 0.015, filter: -2400 }, exp: 0.05 }, { p: { freq: 1800, release: 0.06, shape: 0, slide: -20 }, gain: 0.25, exp: 0.03 }],
  },
  chain: {
    gain: 0.18, max: 1, vary: 0.1,
    layers: [{ p: { freq: 900, attack: 0.01, sustain: 0.12, release: 0.15, shape: 4, tremolo: 0.7, repeat: 0.02, filter: -2000 } }],
  },

  // ── spells ──
  cast: {
    gain: 0.28, max: 2, vary: 0.08,
    layers: [
      { p: { freq: 440, attack: 0.03, release: 0.25, shape: 0, slide: 4 }, exp: 0.12 },
      { p: { freq: 1760, attack: 0.02, release: 0.2, shape: 0, slide: 3 }, gain: 0.15, exp: 0.08 },
    ],
  },
  meteor_fall: {
    gain: 0.36, max: 2, vary: 0.05,
    layers: [
      { p: { freq: 1400, attack: 0.15, sustain: 0.5, release: 0.25, shape: 0, slide: -2.2, tremolo: 0.15, repeat: 0.04, sustainVol: 0.7 }, gain: 0.55 },
      { p: { freq: 300, attack: 0.4, sustain: 0.4, release: 0.2, shape: 4, filter: -1100 } },
    ],
  },
  meteor: {
    gain: 0.75, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 55, release: 0.8, shape: 0, slide: -0.6 }, exp: 0.25 },
      { p: { freq: 80, release: 0.7, shape: 4, filter: -600 }, gain: 0.9, exp: 0.25 },
      { p: { freq: 600, attack: 0.02, release: 0.5, shape: 4, filter: -2500 }, gain: 0.3, exp: 0.12 },
    ],
  },
  meteor_small: {
    gain: 0.4, max: 3, vary: 0.12,
    layers: [
      { p: { freq: 80, release: 0.4, shape: 0, slide: -1 }, exp: 0.12 },
      { p: { freq: 120, release: 0.35, shape: 4, filter: -900 }, gain: 0.8, exp: 0.1 },
    ],
  },
  explode: {
    gain: 0.48, max: 3, vary: 0.1,
    layers: [
      { p: { freq: 70, release: 0.45, shape: 0, slide: -1 }, exp: 0.12 },
      { p: { freq: 100, release: 0.4, shape: 4, filter: -1100 }, gain: 0.8, exp: 0.1 },
    ],
  },
  grenade: {
    gain: 0.34, max: 3, vary: 0.14,
    layers: [
      { p: { freq: 95, release: 0.3, shape: 0, slide: -1.5 }, exp: 0.08 },
      { p: { freq: 160, release: 0.28, shape: 4, filter: -1500 }, gain: 0.8, exp: 0.07 },
    ],
  },
  nova: {
    gain: 0.5, max: 2, vary: 0.05,
    layers: [
      { p: { freq: 2200, release: 0.12, shape: 4, filter: -3600 }, gain: 0.22, exp: 0.05 },
      { p: { freq: 700, attack: 0.01, release: 0.32, shape: 4, filter: -2000 }, gain: 0.35, exp: 0.12 },
      ...bell(N(27), 0, 0.2, 0.6), ...bell(N(31), 0.03, 0.16, 0.55), ...bell(N(34), 0.06, 0.13, 0.5), ...bell(N(39), 0.09, 0.1, 0.45),
    ],
  },
  shatter: {
    gain: 0.3, max: 2, vary: 0.12,
    layers: [
      { p: { freq: 2600, release: 0.1, shape: 4, filter: -3200 }, gain: 0.25, exp: 0.04 },
      ...bell(N(31), 0, 0.2, 0.35), ...bell(N(36), 0.025, 0.14, 0.3),
    ],
  },
  blackhole: {
    gain: 0.5, max: 1, vary: 0.04,
    layers: [
      { p: { freq: 65, attack: 0.2, sustain: 0.9, release: 0.6, shape: 0, tremolo: 0.35, repeat: 0.08 } },
      { p: { freq: 130, attack: 0.3, sustain: 0.7, release: 0.5, shape: 1, tremolo: 0.5, repeat: 0.11 }, gain: 0.3 },
      { p: { freq: 200, attack: 0.6, release: 0.3, shape: 4, slide: 2, filter: -900 }, gain: 0.4 },
    ],
  },
  vortex: { gain: 0.42, max: 1, vary: 0.05, layers: [{ p: { freq: 150, attack: 0.3, release: 0.2, shape: 4, slide: 3, filter: -1500 } }, { p: { freq: 90, attack: 0.25, release: 0.25, shape: 0, slide: 2 }, gain: 0.5 }] },
  poison: { gain: 0.22, max: 2, vary: 0.15, layers: [{ p: { freq: 220, release: 0.14, shape: 0, slide: 6, tremolo: 0.5, repeat: 0.03 } }] },
  summon: {
    gain: 0.32, max: 2, vary: 0.08,
    layers: [
      { p: { freq: 300, attack: 0.02, release: 0.3, shape: 4, filter: -1500 }, gain: 0.6 },
      ...bell(N(15), 0.04, 0.25, 0.4),
    ],
  },
  sentry: {
    gain: 0.38, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 110, release: 0.06, shape: 5, curve: 0.5, filter: -1000 }, gain: 0.6 },
      { p: { freq: 220, release: 0.05, shape: 5, curve: 0.5, filter: -1200 }, at: 0.07, gain: 0.45 },
      { p: { freq: 1600, release: 0.03, shape: 4, filter: -4000 }, at: 0.11, gain: 0.25 },
    ],
  },
  rain: {
    gain: 0.34, max: 1, vary: 0.06,
    layers: [
      { p: { freq: 800, attack: 0.05, release: 0.35, shape: 4, slide: -2, filter: -1600 } },
      { p: { freq: 650, attack: 0.05, release: 0.3, shape: 4, slide: -2, filter: -1300 }, at: 0.12, gain: 0.7 },
    ],
  },
  rage: {
    gain: 0.42, max: 1, vary: 0.04,
    layers: [
      { p: { freq: 150, attack: 0.05, release: 0.35, shape: 2, slide: 2, filter: -1000 }, gain: 0.6 },
      { p: { freq: 220, attack: 0.03, release: 0.4, shape: 4, slide: 3, filter: -1400 }, gain: 0.5 },
    ],
  },
  arcane_buff: {
    gain: 0.32, max: 1, vary: 0.03,
    layers: [...bell(N(12), 0, 0.25, 0.7), ...bell(N(19), 0.05, 0.2, 0.6), ...bell(N(24), 0.1, 0.16, 0.5)],
  },
  mortar: { gain: 0.24, max: 2, vary: 0.1, layers: [{ p: { freq: 1700, attack: 0.05, sustain: 0.2, release: 0.2, shape: 0, slide: -3 } }] },
  warn: { gain: 0.32, max: 1, vary: 0.03, layers: [{ p: { freq: 110, attack: 0.05, release: 0.35, shape: 0, tremolo: 0.3, repeat: 0.08 } }] },

  // ── warrior M1 (docs/rework/depth/WARRIOR.md §3 "VFX / icon / sound") ──
  // Tolling Blow: a dull wooden/metal thud per blow.
  tollblow: {
    gain: 0.42, max: 2, vary: 0.08,
    layers: [
      { p: { freq: 118, release: 0.16, shape: 0, slide: -3 }, exp: 0.06 },
      { p: { freq: 420, release: 0.05, shape: 4, filter: -1100 }, gain: 0.55 },
      { p: { freq: 760, release: 0.12, shape: 0, slide: -0.4 }, gain: 0.07, exp: 0.035 },
    ],
  },
  // The toll: a low procedural bell — fundamental + 2.76× partial, ~0.8 s decay, with a soft strike transient.
  toll: {
    gain: 0.5, max: 2, vary: 0.03,
    layers: [
      { p: { freq: 1200, release: 0.03, shape: 4, filter: -2600 }, gain: 0.22 },
      { p: { freq: 156, attack: 0.004, release: 0.9, shape: 0 }, exp: 0.32 },
      { p: { freq: 156 * 2.76, attack: 0.003, release: 0.7, shape: 0 }, gain: 0.42, exp: 0.2 },
      { p: { freq: 156 * 0.5, attack: 0.02, release: 0.8, shape: 0 }, gain: 0.16, exp: 0.36 },
      { p: { freq: 156 * 5.4, attack: 0.002, release: 0.25, shape: 0 }, gain: 0.05, exp: 0.06 },
    ],
  },
  // Sawtooth Hatchet: a "whup-whup" whirr rising on the way out, falling on the way back.
  hatchet_out: {
    gain: 0.28, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 260, attack: 0.03, sustain: 0.3, release: 0.12, shape: 4, slide: 1.4, tremolo: 0.85, repeat: 0.065, filter: -1500 } },
      { p: { freq: 150, attack: 0.03, sustain: 0.3, release: 0.12, shape: 1, slide: 0.8, tremolo: 0.8, repeat: 0.065 }, gain: 0.3 },
    ],
  },
  hatchet_back: {
    gain: 0.24, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 340, attack: 0.03, sustain: 0.32, release: 0.14, shape: 4, slide: -1.4, tremolo: 0.85, repeat: 0.075, filter: -1300 } },
      { p: { freq: 190, attack: 0.03, sustain: 0.32, release: 0.14, shape: 1, slide: -0.8, tremolo: 0.8, repeat: 0.075 }, gain: 0.3 },
    ],
  },
  // Muster Standard: cloth snap and a short low horn note.
  standard: {
    gain: 0.46, max: 1, vary: 0.03,
    layers: [
      { p: { freq: 900, attack: 0.004, release: 0.06, shape: 4, filter: -2600 }, gain: 0.7 },
      { p: { freq: 700, attack: 0.004, release: 0.05, shape: 4, filter: -2000 }, at: 0.055, gain: 0.45 },
      { p: { freq: 98, attack: 0.07, sustain: 0.3, release: 0.28, shape: 2, filter: -650, tremolo: 0.08, repeat: 0.18 }, at: 0.08, gain: 0.55 },
      { p: { freq: 98, attack: 0.07, sustain: 0.3, release: 0.28, shape: 0 }, at: 0.08, gain: 0.35 },
      { p: { freq: 147, attack: 0.09, sustain: 0.24, release: 0.24, shape: 1, filter: -900 }, at: 0.1, gain: 0.14 },
    ],
  },
  // Ironplough: one scrape per channel tick; the grind pitch rises with the ramp level (0..5).
  ...Object.fromEntries([0, 1, 2, 3, 4, 5].map((lv): [string, SoundDef] => [`plough${lv}`, {
    gain: 0.2 + lv * 0.018, max: 2, vary: 0.05,
    layers: [
      { p: { freq: 130 + lv * 34, attack: 0.02, sustain: 0.2, release: 0.1, shape: 4, filter: -(800 + lv * 170), tremolo: 0.5, repeat: 0.045 } },
      { p: { freq: 70 + lv * 6, attack: 0.03, sustain: 0.18, release: 0.1, shape: 0, slide: 0.2 }, gain: 0.35 },
      { p: { freq: 1300 + lv * 260, attack: 0.02, sustain: 0.16, release: 0.08, shape: 4, filter: 2600 + lv * 300 }, gain: 0.04 + lv * 0.022 },
    ],
  }])),
  // Cairnfall: a descending rumble on the call, a heavy stone crack per impact.
  cairn_fall: {
    gain: 0.4, max: 1, vary: 0.04,
    layers: [
      { p: { freq: 300, attack: 0.12, sustain: 0.55, release: 0.3, shape: 4, slide: -1.1, filter: -700, tremolo: 0.35, repeat: 0.06 } },
      { p: { freq: 95, attack: 0.2, sustain: 0.5, release: 0.3, shape: 0, slide: -0.45 }, gain: 0.55 },
    ],
  },
  cairn: {
    gain: 0.55, max: 2, vary: 0.08,
    layers: [
      { p: { freq: 1700, release: 0.045, shape: 4, filter: -3200 }, gain: 0.5 },
      { p: { freq: 72, release: 0.42, shape: 0, slide: -0.8 }, exp: 0.14 },
      { p: { freq: 280, release: 0.32, shape: 4, filter: -900 }, at: 0.02, gain: 0.6, exp: 0.12 },
      { p: { freq: 520, release: 0.06, shape: 4, filter: -1800 }, at: 0.07, gain: 0.25 },
    ],
  },
  // Kilnheart: a bellows whoosh (air drawn in, rising) that catches into a low fire roar.
  kiln_ignite: {
    gain: 0.5, max: 1, vary: 0.04,
    layers: [
      { p: { freq: 260, attack: 0.18, sustain: 0.05, release: 0.12, shape: 4, slide: 2.2, filter: -1300 }, gain: 0.7 },
      { p: { freq: 120, attack: 0.02, sustain: 0.35, release: 0.45, shape: 4, filter: -900, tremolo: 0.45, repeat: 0.05 }, at: 0.2, gain: 0.9, exp: 0.35 },
      { p: { freq: 62, attack: 0.03, sustain: 0.25, release: 0.4, shape: 0, slide: -0.3 }, at: 0.2, gain: 0.5, exp: 0.3 },
      { p: { freq: 1900, release: 0.05, shape: 4, filter: 2600, repeat: 0.03 }, at: 0.22, gain: 0.08 },
    ],
  },
  // Bellows Breath: a roaring exhale of fire.
  kiln_breath: {
    gain: 0.48, max: 1, vary: 0.05,
    layers: [
      { p: { freq: 180, attack: 0.04, sustain: 0.3, release: 0.25, shape: 4, slide: -0.6, filter: -1200, tremolo: 0.35, repeat: 0.04 } },
      { p: { freq: 85, attack: 0.05, sustain: 0.28, release: 0.25, shape: 0, slide: -0.4 }, gain: 0.45 },
    ],
  },

  // ── ranger M1 (docs/rework/depth/RANGER.md §3 "VFX / icon / sound") ──
  // Skipstone Bolt: "tk-tk-tk" stone-on-stone ricochet clicks rising in pitch (one variant per skip), a soft plip.
  ...Object.fromEntries([0, 1, 2, 3].map((i): [string, SoundDef] => [`skip_tk${i}`, {
    gain: 0.24, max: 3, vary: 0.05,
    layers: [
      { p: { freq: 1500 + i * 420, release: 0.022, shape: 5, curve: 0.5, filter: -(3800 + i * 500) }, gain: 0.7 },
      { p: { freq: 520 + i * 140, release: 0.045, shape: 0, slide: -6 }, gain: 0.5, exp: 0.02 },
    ],
  }])),
  skip_plip: {
    gain: 0.2, max: 3, vary: 0.12,
    layers: [
      { p: { freq: 520, attack: 0.002, release: 0.09, shape: 0, slide: 18 }, exp: 0.04 },
      { p: { freq: 1200, release: 0.03, shape: 0, slide: 20 }, gain: 0.2 },
    ],
  },
  skip_heavy: { gain: 0.26, max: 2, vary: 0.08, layers: [{ p: { freq: 300, attack: 0.02, release: 0.14, shape: 4, slide: -2, filter: -900 } }] },
  skip_thock: {
    gain: 0.38, max: 2, vary: 0.08,
    layers: [
      { p: { freq: 160, release: 0.12, shape: 0, slide: -5 }, exp: 0.05 },
      { p: { freq: 900, release: 0.03, shape: 5, curve: 0.5, filter: -2600 }, gain: 0.5 },
    ],
  },
  dart: { gain: 0.14, max: 3, vary: 0.15, layers: [{ p: { freq: 900, attack: 0.005, release: 0.06, shape: 4, slide: 6, filter: -3000 } }] },
  // Spring Snare: a metallic click when it arms; a hard snap and a spring "boing" on trigger.
  snare_arm: {
    gain: 0.3, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 2600, release: 0.018, shape: 5, curve: 0.4, filter: -5000 }, gain: 0.6 },
      ...bell(2200, 0.01, 0.15, 0.18),
    ],
  },
  snare_snap: {
    gain: 0.5, max: 2, vary: 0.05,
    layers: [
      { p: { freq: 1100, release: 0.04, shape: 4, filter: -3400 }, gain: 0.8 },
      { p: { freq: 140, release: 0.12, shape: 0, slide: -6 }, gain: 0.8, exp: 0.05 },
      { p: { freq: 1900, release: 0.03, shape: 5, curve: 0.5, filter: -4000 }, gain: 0.4 },
      { p: { freq: 190, attack: 0.004, sustain: 0.06, release: 0.32, shape: 1, slide: 1.2, repeat: 0.045 }, at: 0.02, gain: 0.4, exp: 0.16 },
    ],
  },
  snare_shrapnel: {
    gain: 0.3, max: 2, vary: 0.08,
    layers: [
      { p: { freq: 2400, release: 0.08, shape: 4, filter: -4200 }, gain: 0.5, exp: 0.03 },
      { p: { freq: 3100, release: 0.05, shape: 5, curve: 0.5, filter: -5000 }, at: 0.02, gain: 0.2 },
      { p: { freq: 300, release: 0.1, shape: 4, filter: -900 }, gain: 0.4 },
    ],
  },
  rope_whip: {
    gain: 0.3, max: 2, vary: 0.1,
    layers: [
      { p: { freq: 400, attack: 0.03, release: 0.09, shape: 4, slide: 6, filter: -1800 }, gain: 0.7 },
      { p: { freq: 1400, release: 0.03, shape: 4, filter: -3200 }, at: 0.1, gain: 0.6 },
    ],
  },
  // Overcast Volley: an upward "fwip", a beat of silence, then a patter of thunks like hail (one per arrow).
  overcast_fwip: {
    gain: 0.34, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 300, attack: 0.02, release: 0.18, shape: 4, slide: 9, filter: -2200 } },
      { p: { freq: 600, attack: 0.01, release: 0.12, shape: 0, slide: 12 }, gain: 0.12, exp: 0.06 },
    ],
  },
  overcast_thunk: {
    gain: 0.22, max: 4, vary: 0.2,
    layers: [
      { p: { freq: 210, release: 0.05, shape: 0, slide: -8 }, exp: 0.025 },
      { p: { freq: 900, release: 0.02, shape: 4, filter: -2400 }, gain: 0.5 },
    ],
  },
  overcast_heavy: {
    gain: 0.45, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 95, release: 0.3, shape: 0, slide: -1.5 }, exp: 0.1 },
      { p: { freq: 160, release: 0.25, shape: 4, filter: -1100 }, gain: 0.7, exp: 0.08 },
      { p: { freq: 1200, release: 0.03, shape: 4, filter: -3000 }, gain: 0.4 },
    ],
  },
  // Quarry Mark: a sharp descending hawk cry; a soft chime when the mark jumps. Falcon Strike: the stoop's impact.
  quarry_cry: {
    gain: 0.3, max: 1, vary: 0.04,
    layers: [
      { p: { freq: 2400, attack: 0.015, sustain: 0.09, release: 0.32, shape: 1, slide: -3, noise: 0.12, filter: -5200 }, gain: 0.8 },
      { p: { freq: 4800, attack: 0.015, sustain: 0.06, release: 0.22, shape: 0, slide: -6 }, gain: 0.1 },
    ],
  },
  quarry_chime: { gain: 0.3, max: 1, vary: 0.02, layers: [...bell(N(24), 0, 0.3, 0.6), ...bell(N(31), 0.05, 0.2, 0.5)] },
  falcon_strike: {
    gain: 0.45, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 500, attack: 0.02, release: 0.1, shape: 4, slide: -4, filter: -2000 }, gain: 0.6 },
      { p: { freq: 110, release: 0.2, shape: 0, slide: -3 }, at: 0.06, exp: 0.07 },
      { p: { freq: 900, release: 0.03, shape: 4, filter: -3000 }, at: 0.07, gain: 0.4 },
    ],
  },
  // Pitch Mortar: a deep "thoomp", a short falling whistle, then a splat and sizzle.
  mortar_thoomp: {
    gain: 0.6, max: 2, vary: 0.05,
    layers: [
      { p: { freq: 58, attack: 0.005, release: 0.35, shape: 0, slide: -1 }, exp: 0.12 },
      { p: { freq: 90, release: 0.25, shape: 4, filter: -500 }, gain: 0.8, exp: 0.08 },
      { p: { freq: 200, release: 0.06, shape: 4, filter: -1200 }, gain: 0.4 },
    ],
  },
  mortar_whistle: {
    gain: 0.2, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 1400, attack: 0.05, sustain: 0.16, release: 0.12, shape: 0, slide: -2.6 }, gain: 0.5 },
      { p: { freq: 1400, attack: 0.05, sustain: 0.16, release: 0.12, shape: 4, slide: -2.6, filter: 1800 }, gain: 0.1 },
    ],
  },
  pitch_splat: {
    gain: 0.5, max: 2, vary: 0.08,
    layers: [
      { p: { freq: 160, release: 0.1, shape: 4, slide: -2, filter: -900 }, gain: 0.9 },
      { p: { freq: 90, release: 0.12, shape: 0, slide: -3 }, gain: 0.6, exp: 0.05 },
      { p: { freq: 3200, attack: 0.03, sustain: 0.3, release: 0.4, shape: 4, filter: 2600 }, at: 0.05, gain: 0.18, exp: 0.25 },
    ],
  },
  // Murmuration: a rushing wing-flutter with chatter; it swells when the flock dives.
  flock_flutter: {
    gain: 0.34, max: 1, vary: 0.06,
    layers: [
      { p: { freq: 160, attack: 0.1, sustain: 0.5, release: 0.35, shape: 4, filter: -1100, tremolo: 0.7, repeat: 0.055 } },
      { p: { freq: 400, attack: 0.08, sustain: 0.45, release: 0.3, shape: 4, filter: -2400, tremolo: 0.6, repeat: 0.037 }, gain: 0.4 },
      { p: { freq: 3000, release: 0.03, shape: 0, slide: 25 }, at: 0.1, gain: 0.06 },
      { p: { freq: 3300, release: 0.03, shape: 0, slide: 25 }, at: 0.26, gain: 0.05 },
      { p: { freq: 2800, release: 0.03, shape: 0, slide: 25 }, at: 0.41, gain: 0.05 },
    ],
  },
  flock_dive: {
    gain: 0.42, max: 1, vary: 0.05,
    layers: [
      { p: { freq: 200, attack: 0.28, release: 0.22, shape: 4, slide: 2, filter: -1600 } },
      { p: { freq: 300, attack: 0.25, release: 0.2, shape: 4, filter: -2200, tremolo: 0.7, repeat: 0.045 }, gain: 0.5 },
    ],
  },
  badger_burst: {
    gain: 0.48, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 75, release: 0.3, shape: 0, slide: -1 }, exp: 0.1 },
      { p: { freq: 220, release: 0.22, shape: 4, filter: -1000 }, gain: 0.8, exp: 0.08 },
      { p: { freq: 600, release: 0.05, shape: 4, filter: -2000 }, at: 0.04, gain: 0.3 },
    ],
  },
  heron_spear: {
    gain: 0.3, max: 2, vary: 0.08,
    layers: [
      { p: { freq: 700, attack: 0.005, release: 0.06, shape: 4, slide: -6, filter: -2500 }, gain: 0.6 },
      { p: { freq: 240, release: 0.06, shape: 0, slide: -8 }, at: 0.05, gain: 0.7, exp: 0.03 },
      { p: { freq: 900, attack: 0.002, release: 0.05, shape: 0, slide: 14 }, at: 0.06, gain: 0.15 },
    ],
  },
  sentry_flame: {
    gain: 0.34, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 160, attack: 0.03, sustain: 0.12, release: 0.2, shape: 4, slide: -0.5, filter: -1300, tremolo: 0.3, repeat: 0.04 } },
      { p: { freq: 80, attack: 0.03, sustain: 0.1, release: 0.2, shape: 0 }, gain: 0.3 },
    ],
  },
  kestrel_kee: {
    gain: 0.14, max: 1, vary: 0.08,
    layers: [
      { p: { freq: 3000, attack: 0.01, sustain: 0.03, release: 0.06, shape: 1, slide: -1, filter: -6000 } },
      { p: { freq: 3000, attack: 0.01, sustain: 0.03, release: 0.06, shape: 1, slide: -1, filter: -6000 }, at: 0.11 },
    ],
  },
  // ── mage M1 (docs/rework/depth/MAGE.md §3 "VFX / icon / sound") ──
  // Rime Needles: three quick glassy "tsk"s, one per needle of the volley.
  needles: {
    gain: 0.24, max: 2, vary: 0.07,
    layers: [0, 0.034, 0.068].flatMap((at, i): Layer[] => [
      { p: { freq: 3000, release: 0.03, shape: 4, filter: 2600 + i * 300 }, at, gain: 0.55 },
      { p: { freq: N(34 + i * 2), attack: 0.001, release: 0.07, shape: 0 }, at, gain: 0.16, exp: 0.022 },
    ]),
  },
  // Glacier Spine: one heavier glassy launch.
  needle_spine: {
    gain: 0.3, max: 2, vary: 0.05,
    layers: [
      { p: { freq: 2400, release: 0.05, shape: 4, filter: 2000 }, gain: 0.5 },
      { p: { freq: 900, attack: 0.004, release: 0.16, shape: 0, slide: -2 }, gain: 0.3, exp: 0.06 },
      ...bell(N(31), 0.01, 0.14, 0.3),
    ],
  },
  // A crystalline ping (Glacier Spine strikes).
  needle_ping: { gain: 0.24, max: 2, vary: 0.04, layers: [...bell(N(39), 0, 0.3, 0.45), ...bell(N(46), 0.012, 0.18, 0.35)] },
  // Thrumming Ray: a low hum climbing a whole tone per quarter of resonance; at full resonance a chord (root, fifth,
  // octave, tenth). One ~0.33 s note per 250 ms channel tick, so consecutive notes overlap into a drone.
  ...Object.fromEntries([0, 1, 2, 3, 4].map((lv): [string, SoundDef] => {
    const f = 98 * 2 ** ((lv * 2) / 12);
    const env = { attack: 0.05, sustain: 0.2, release: 0.09 };
    const layers: Layer[] = [
      { p: { freq: f, ...env, shape: 0, tremolo: 0.1 + lv * 0.03, repeat: 0.06 } },
      { p: { freq: f * 2, ...env, shape: 1 }, gain: 0.16 + lv * 0.04 },
    ];
    if (lv >= 2) layers.push({ p: { freq: f * 1.5, ...env, shape: 0 }, gain: 0.1 * (lv - 1) });
    if (lv >= 4) layers.push({ p: { freq: f * 2.52, ...env, shape: 0 }, gain: 0.16 }, { p: { freq: f * 4, ...env, shape: 0, tremolo: 0.2, repeat: 0.03 }, gain: 0.05 });
    return [`ray_hum${lv}`, { gain: 0.15 + lv * 0.02, max: 2, vary: 0.005, layers }];
  })),
  // The ray catching: a rising shimmer.
  ray_start: {
    gain: 0.26, max: 1, vary: 0.04,
    layers: [
      { p: { freq: 196, attack: 0.08, release: 0.2, shape: 0, slide: 3 }, exp: 0.12 },
      { p: { freq: 1400, attack: 0.05, release: 0.15, shape: 4, filter: 2400 }, gain: 0.12 },
    ],
  },
  // Harmonic: a bright plucked overtone running down the beam.
  ray_pulse: { gain: 0.22, max: 1, vary: 0.04, layers: [...bell(N(19), 0, 0.3, 0.4), { p: { freq: 330, attack: 0.01, release: 0.25, shape: 0, slide: -2 }, gain: 0.25, exp: 0.1 }] },
  // Cinderkin: a crackling hiss and tiny "pip" voices as kin climb out of the coals.
  kin_spawn: {
    gain: 0.3, max: 1, vary: 0.06,
    layers: [
      { p: { freq: 900, attack: 0.02, sustain: 0.18, release: 0.15, shape: 4, filter: 1800, tremolo: 0.7, repeat: 0.021 } },
      { p: { freq: 1250, attack: 0.004, release: 0.05, shape: 0, slide: 14 }, at: 0.14, gain: 0.3, exp: 0.03 },
      { p: { freq: 1500, attack: 0.004, release: 0.05, shape: 0, slide: 16 }, at: 0.23, gain: 0.26, exp: 0.03 },
    ],
  },
  // Hearth Bond: two little voices calling.
  kin_pip: {
    gain: 0.22, max: 1, vary: 0.06,
    layers: [
      { p: { freq: 1300, attack: 0.004, release: 0.06, shape: 0, slide: 12 }, gain: 0.5, exp: 0.035 },
      { p: { freq: 1100, attack: 0.004, release: 0.06, shape: 0, slide: 10 }, at: 0.09, gain: 0.45, exp: 0.035 },
      { p: { freq: 700, attack: 0.02, sustain: 0.1, release: 0.12, shape: 4, filter: 1500, tremolo: 0.6, repeat: 0.025 }, gain: 0.3 },
    ],
  },
  // A kin bursts: a pop with a crackle.
  kin_pop: {
    gain: 0.4, max: 3, vary: 0.1,
    layers: [
      { p: { freq: 170, release: 0.12, shape: 0, slide: -4 }, exp: 0.05 },
      { p: { freq: 1200, release: 0.07, shape: 4, filter: -2600 }, gain: 0.6 },
      { p: { freq: 1600, attack: 0.01, sustain: 0.08, release: 0.1, shape: 4, filter: 2200, tremolo: 0.7, repeat: 0.018 }, at: 0.03, gain: 0.25 },
    ],
  },
  // Rimefield: crackling ice spreading, a faint wind chime.
  rime_spread: {
    gain: 0.32, max: 1, vary: 0.04,
    layers: [
      { p: { freq: 2600, attack: 0.03, sustain: 0.32, release: 0.3, shape: 4, filter: 2800, tremolo: 0.8, repeat: 0.023 }, gain: 0.5 },
      { p: { freq: 260, attack: 0.1, sustain: 0.3, release: 0.4, shape: 4, filter: -700 }, gain: 0.3 },
      ...bell(N(34), 0.16, 0.12, 0.6), ...bell(N(38), 0.34, 0.1, 0.55), ...bell(N(41), 0.52, 0.08, 0.5),
    ],
  },
  rime_chime: { gain: 0.24, max: 1, vary: 0.03, layers: [...bell(N(36), 0, 0.22, 0.5), ...bell(N(40), 0.08, 0.16, 0.45), { p: { freq: 2800, release: 0.08, shape: 4, filter: 2600 }, gain: 0.12 }] },
  // Stormglass Orb: a buzzing hum (re-struck while the orb flies), sharp zaps, a glass shatter.
  glass_hum: {
    gain: 0.12, max: 2, vary: 0.04,
    layers: [
      { p: { freq: 120, attack: 0.06, sustain: 0.42, release: 0.16, shape: 2, filter: -900, tremolo: 0.45, repeat: 0.0167 } },
      { p: { freq: 241, attack: 0.06, sustain: 0.42, release: 0.16, shape: 0, tremolo: 0.3, repeat: 0.04 }, gain: 0.35 },
    ],
  },
  glass_zap: {
    gain: 0.22, max: 3, vary: 0.14,
    layers: [
      { p: { freq: 1500, release: 0.05, shape: 4, filter: 1600 }, gain: 0.7 },
      { p: { freq: 2400, release: 0.06, shape: 0, slide: -30 }, gain: 0.3, exp: 0.025 },
    ],
  },
  glass_shatter: {
    gain: 0.46, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 3200, release: 0.12, shape: 4, filter: 2400 }, gain: 0.5, exp: 0.05 },
      { p: { freq: 90, release: 0.25, shape: 0, slide: -1 }, gain: 0.45, exp: 0.08 },
      ...bell(N(36), 0, 0.2, 0.35), ...bell(N(41), 0.02, 0.15, 0.3), ...bell(N(44), 0.05, 0.12, 0.28), ...bell(N(48), 0.08, 0.08, 0.25),
      { p: { freq: 1200, release: 0.1, shape: 4, tremolo: 0.6, repeat: 0.015, filter: -2400 }, at: 0.02, gain: 0.3, exp: 0.05 },
    ],
  },
  // Orrery: slow mechanical ticking under a choir pad; a soft chime per sphere missile.
  orrery_tick: {
    gain: 0.16, max: 1, vary: 0.04,
    layers: [
      { p: { freq: 2200, release: 0.012, shape: 4, filter: 1800 }, gain: 0.6 },
      { p: { freq: 820, release: 0.03, shape: 1, slide: -3 }, gain: 0.4, exp: 0.012 },
    ],
  },
  orrery_pad: {
    gain: 0.1, max: 1, vary: 0.01,
    layers: [A4, N(4), N(7), N(12)].map((freq, i): Layer => ({ p: { freq, attack: 0.5, sustain: 1.1, release: 0.9, shape: i % 2 ? 1 : 0, tremolo: 0.06, repeat: 0.2 + i * 0.03 }, gain: i === 3 ? 0.35 : 0.8 - i * 0.12 })),
  },
  orrery_chime: { gain: 0.2, max: 2, vary: 0.05, layers: bell(N(24), 0, 0.3, 0.4) },
  orrery_unfold: {
    gain: 0.34, max: 1, vary: 0.03,
    layers: [
      { p: { freq: 1800, release: 0.02, shape: 4, filter: 1600, repeat: 0.045 }, gain: 0.3 },
      { p: { freq: 330, attack: 0.08, release: 0.35, shape: 0, slide: 1.5 }, gain: 0.4, exp: 0.2 },
      ...bell(N(12), 0.12, 0.2, 0.7), ...bell(N(19), 0.22, 0.16, 0.6),
    ],
  },
  eclipse: {
    gain: 0.4, max: 1, vary: 0.04,
    layers: [
      { p: { freq: 70, attack: 0.02, release: 0.5, shape: 0, slide: -0.6 }, exp: 0.2 },
      { p: { freq: 1800, attack: 0.03, sustain: 0.15, release: 0.25, shape: 4, filter: 2000, tremolo: 0.5, repeat: 0.03 }, gain: 0.2 },
      ...bell(N(31), 0.02, 0.18, 0.5),
    ],
  },
  // Meteor · Lodestone: a low pull winding down; Fallen Star crater: a hum of drawn-in light.
  lodestone: { gain: 0.3, max: 1, vary: 0.04, layers: [{ p: { freq: 130, attack: 0.1, sustain: 0.35, release: 0.2, shape: 1, slide: -0.8, tremolo: 0.4, repeat: 0.07 } }, { p: { freq: 65, attack: 0.15, sustain: 0.3, release: 0.25, shape: 0 }, gain: 0.5 }] },
  star_crater: { gain: 0.3, max: 1, vary: 0.04, layers: [{ p: { freq: 260, attack: 0.1, sustain: 0.4, release: 0.4, shape: 0, slide: -0.5, tremolo: 0.25, repeat: 0.09 } }, ...bell(N(27), 0.05, 0.15, 0.6)] },
  // Lantern Garden: a paper rustle and a small bell.
  lantern: { gain: 0.2, max: 2, vary: 0.06, layers: [{ p: { freq: 1600, attack: 0.02, release: 0.08, shape: 4, filter: 2000 }, gain: 0.4 }, ...bell(N(29), 0.04, 0.25, 0.5)] },

  // ── deaths ──
  die: {
    gain: 0.28, max: 3, vary: 0.15,
    layers: [
      { p: { freq: 520, release: 0.07, shape: 0, slide: -14 }, exp: 0.04 },
      { p: { freq: 300, release: 0.12, shape: 4, filter: -1400 }, gain: 0.7 },
    ],
  },
  die_big: {
    gain: 0.52, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 300, release: 0.15, shape: 0, slide: -8 }, gain: 0.7 },
      { p: { freq: 60, release: 0.4, shape: 0, slide: -0.5 }, gain: 0.7, exp: 0.15 },
      { p: { freq: 220, release: 0.3, shape: 4, filter: -1100 }, gain: 0.5, exp: 0.1 },
    ],
  },
  roar: {
    gain: 0.75, max: 1, vary: 0.03, pri: true,
    layers: [
      // growl: a raspy sawtooth (noise on the pitch) that swells up, then drops back at the end
      { p: { freq: 190, attack: 0.07, sustain: 0.32, release: 0.42, shape: 2, slide: 0.3, jump: -60, jumpTime: 0.34, noise: 0.35, filter: -1600 }, gain: 0.85 },
      // throat: a second raspy voice a fifth above, for the open-mouthed part
      { p: { freq: 285, attack: 0.09, sustain: 0.28, release: 0.38, shape: 2, slide: 0.25, jump: -90, jumpTime: 0.34, noise: 0.25, filter: -2000 }, gain: 0.45 },
      // breath: noise with the low end cut so it hisses instead of rumbling
      { p: { freq: 1200, attack: 0.05, sustain: 0.3, release: 0.45, shape: 4, noise: 1, filter: 700 }, gain: 0.12 },
      // weight: a short low thump at the onset only
      { p: { freq: 75, attack: 0.01, release: 0.2, shape: 0, slide: -0.3 }, gain: 0.4, exp: 0.08 },
    ],
  },

  // ── loot & progression ──
  gold: {
    gain: 0.36, max: 3, vary: 0.08,
    layers: [
      { p: { freq: N(19), sustain: 0.02, release: 0.16, shape: 0, jump: N(26) - N(19), jumpTime: 0.045 }, exp: 0.07 },
      { p: { freq: N(31), release: 0.05, shape: 0 }, gain: 0.12, exp: 0.02 },
    ],
  },
  gem: { gain: 0.42, max: 2, vary: 0.04, layers: [...bell(N(27), 0, 0.4, 0.5), ...bell(N(34), 0.04, 0.3, 0.45), ...bell(N(39), 0.08, 0.2, 0.4)] },
  item: {
    gain: 0.42, max: 2, vary: 0.06,
    layers: [
      { p: { freq: 330, release: 0.06, shape: 1, slide: 4 }, gain: 0.5 },
      { p: { freq: 110, release: 0.08, shape: 0, slide: -3, noise: 0.3, filter: -800 }, gain: 0.6 },
    ],
  },
  drop: { gain: 0.22, max: 3, vary: 0.12, layers: [{ p: { freq: 240, release: 0.05, shape: 1, slide: -4, filter: -1500 } }] },
  globe: {
    gain: 0.42, max: 2, vary: 0.05,
    layers: [
      { p: { freq: 420, attack: 0.01, release: 0.3, shape: 0, slide: 5 }, exp: 0.15 },
      { p: { freq: 840, attack: 0.01, release: 0.25, shape: 0, slide: 5 }, at: 0.05, gain: 0.25, exp: 0.1 },
    ],
  },
  heal: { gain: 0.16, max: 1, vary: 0.05, layers: [...bell(N(19), 0, 0.3, 0.35)] },
  level: {
    gain: 0.62, max: 1, vary: 0, pri: true,
    layers: [
      { p: { freq: C5, attack: 0.005, release: 0.3, shape: 1 }, gain: 0.55, exp: 0.12 },
      { p: { freq: E5, attack: 0.005, release: 0.3, shape: 1 }, at: 0.09, gain: 0.55, exp: 0.12 },
      { p: { freq: G5, attack: 0.005, release: 0.3, shape: 1 }, at: 0.18, gain: 0.55, exp: 0.12 },
      { p: { freq: C6, attack: 0.01, sustain: 0.1, release: 1.0, shape: 1 }, at: 0.3, gain: 0.5, exp: 0.4 },
      { p: { freq: E6, attack: 0.01, sustain: 0.1, release: 0.9, shape: 0 }, at: 0.3, gain: 0.3, exp: 0.35 },
      { p: { freq: G6, attack: 0.01, sustain: 0.1, release: 0.9, shape: 0 }, at: 0.3, gain: 0.25, exp: 0.35 },
      { p: { freq: 60, release: 0.5, shape: 0, slide: -0.3 }, at: 0.3, gain: 0.4, exp: 0.18 },
    ],
  },
  paragon: {
    gain: 0.6, max: 1, vary: 0, pri: true,
    layers: [
      ...bell(D5, 0, 0.32, 0.6), ...bell(Fs5, 0.08, 0.32, 0.6), ...bell(A5, 0.16, 0.32, 0.6),
      ...bell(D6, 0.26, 0.38, 1.3), ...bell(A6, 0.26, 0.16, 1.1),
      { p: { freq: 60, release: 0.5, shape: 0, slide: -0.3 }, at: 0.26, gain: 0.4, exp: 0.18 },
    ],
  },
  // The D3 moment: a soft sub "whoom" under a fast rising bell arpeggio, resolving into a shimmering chord.
  legendary: {
    gain: 0.8, max: 1, vary: 0, pri: true,
    layers: [
      { p: { freq: 90, attack: 0.04, release: 0.6, shape: 0, slide: -0.3 }, gain: 0.5, exp: 0.3 },
      { p: { freq: 300, attack: 0.12, release: 0.3, shape: 4, slide: 3, filter: -1400 }, gain: 0.25 },
      ...bell(G4, 0, 0.42, 1.4), ...bell(D5, 0.07, 0.4, 1.4), ...bell(G5, 0.14, 0.38, 1.4),
      ...bell(B5, 0.21, 0.36, 1.5), ...bell(D6, 0.28, 0.34, 1.6), ...bell(G6, 0.35, 0.32, 1.8),
      { p: { freq: G5, attack: 0.08, sustain: 0.3, release: 1.0, shape: 0, tremolo: 0.25, repeat: 0.09 }, at: 0.45, gain: 0.14, exp: 0.6 },
      { p: { freq: B5, attack: 0.08, sustain: 0.3, release: 1.0, shape: 0, tremolo: 0.25, repeat: 0.1 }, at: 0.45, gain: 0.12, exp: 0.6 },
      { p: { freq: D6, attack: 0.08, sustain: 0.3, release: 1.0, shape: 0, tremolo: 0.25, repeat: 0.11 }, at: 0.45, gain: 0.1, exp: 0.6 },
      { p: { freq: 3800, attack: 0.25, release: 0.9, shape: 4, filter: 5200 }, at: 0.3, gain: 0.05, exp: 0.4 },
    ],
  },
  set: {
    gain: 0.75, max: 1, vary: 0, pri: true,
    layers: [
      { p: { freq: 85, attack: 0.04, release: 0.6, shape: 0, slide: -0.3 }, gain: 0.45, exp: 0.3 },
      ...bell(D5, 0, 0.38, 1.3), ...bell(A5, 0.08, 0.36, 1.3), ...bell(Cs6, 0.16, 0.34, 1.4),
      ...bell(E6, 0.24, 0.32, 1.5), ...bell(A6, 0.36, 0.3, 1.7),
      { p: { freq: A4, attack: 0.2, sustain: 0.4, release: 0.8, shape: 1 }, at: 0.2, gain: 0.1, exp: 0.6 },
      { p: { freq: E5, attack: 0.2, sustain: 0.4, release: 0.8, shape: 1 }, at: 0.2, gain: 0.08, exp: 0.6 },
    ],
  },
  // Gear rank up (docs/rework/gear): a bright rising A-major arpeggio over a soft sub swell, ending on a shimmer.
  gear_rank: {
    gain: 0.6, max: 1, vary: 0, pri: true,
    layers: [
      { p: { freq: 80, attack: 0.06, release: 0.5, shape: 0, slide: -0.2 }, gain: 0.35, exp: 0.25 },
      ...bell(E5, 0, 0.34, 1.0), ...bell(A5, 0.08, 0.34, 1.0), ...bell(Cs6, 0.16, 0.32, 1.1), ...bell(E6, 0.24, 0.3, 1.3),
      { p: { freq: A5, attack: 0.1, sustain: 0.25, release: 0.8, shape: 0, tremolo: 0.3, repeat: 0.08 }, at: 0.32, gain: 0.1, exp: 0.5 },
      { p: { freq: 3600, attack: 0.2, release: 0.7, shape: 4, filter: 5000 }, at: 0.24, gain: 0.04, exp: 0.35 },
    ],
  },
  // The big one (full Set / rank 8+): two octaves of arpeggio, a deeper swell and a held major chord.
  gear_rank_big: {
    gain: 0.72, max: 1, vary: 0, pri: true,
    layers: [
      { p: { freq: 70, attack: 0.08, release: 0.9, shape: 0, slide: -0.25 }, gain: 0.45, exp: 0.4 },
      { p: { freq: 260, attack: 0.18, release: 0.4, shape: 4, slide: 2.5, filter: -1300 }, gain: 0.18 },
      ...bell(A4, 0, 0.36, 1.2), ...bell(E5, 0.07, 0.36, 1.2), ...bell(A5, 0.14, 0.34, 1.3), ...bell(Cs6, 0.21, 0.32, 1.4),
      ...bell(E6, 0.28, 0.3, 1.6), ...bell(A6, 0.36, 0.28, 1.9),
      { p: { freq: A5, attack: 0.12, sustain: 0.4, release: 1.1, shape: 0, tremolo: 0.25, repeat: 0.09 }, at: 0.44, gain: 0.12, exp: 0.7 },
      { p: { freq: Cs6, attack: 0.12, sustain: 0.4, release: 1.1, shape: 0, tremolo: 0.25, repeat: 0.1 }, at: 0.44, gain: 0.1, exp: 0.7 },
      { p: { freq: E6, attack: 0.12, sustain: 0.4, release: 1.1, shape: 0, tremolo: 0.25, repeat: 0.11 }, at: 0.44, gain: 0.09, exp: 0.7 },
    ],
  },
  // Primal drop: a low boom and a dark D-minor bell fall that resolves upward, with a crackle of embers on top.
  primal: {
    gain: 0.85, max: 1, vary: 0, pri: true,
    layers: [
      { p: { freq: 55, attack: 0.02, release: 0.9, shape: 0, slide: -0.35 }, gain: 0.6, exp: 0.45 },
      { p: { freq: 120, attack: 0.01, release: 0.35, shape: 4, filter: -900 }, gain: 0.3, exp: 0.2 },
      ...bell(D6, 0, 0.36, 1.3), ...bell(A5, 0.09, 0.36, 1.3), ...bell(N(8), 0.18, 0.34, 1.4), ...bell(D5, 0.27, 0.34, 1.5),
      ...bell(D6, 0.45, 0.34, 1.9), ...bell(A6, 0.53, 0.3, 2.1),
      { p: { freq: 1500, attack: 0.05, sustain: 0.5, release: 0.9, shape: 4, filter: 3200, tremolo: 0.6, repeat: 0.05 }, at: 0.3, gain: 0.06, exp: 0.5 },
      { p: { freq: D5, attack: 0.15, sustain: 0.4, release: 1.2, shape: 1 }, at: 0.45, gain: 0.08, exp: 0.7 },
    ],
  },
  rift: {
    gain: 0.55, max: 1, vary: 0, pri: true,
    layers: [
      { p: { freq: 98, attack: 0.005, release: 2.0, shape: 0 }, exp: 0.8 },
      { p: { freq: 198, attack: 0.005, release: 1.6, shape: 0 }, gain: 0.35, exp: 0.5 },
      { p: { freq: 301, attack: 0.005, release: 1.2, shape: 0 }, gain: 0.16, exp: 0.3 },
      { p: { freq: D4, attack: 0.3, sustain: 0.6, release: 1.0, shape: 1 }, gain: 0.08, exp: 0.7 },
    ],
  },

  // ── loops ──
  town_wind: {gain:.085,loop:true,layers:[{p:{freq:80,sustain:3,shape:4,filter:-380,tremolo:.14,repeat:1.7}}]},
  town_fire: {gain:.13,loop:true,layers:[{p:{freq:100,sustain:2.7,shape:4,filter:-1400,tremolo:.65,repeat:.07}},{p:{freq:46,sustain:2.7,shape:0},gain:.15}]},
  town_water: {gain:.12,loop:true,layers:[{p:{freq:180,sustain:3,shape:4,filter:-720,tremolo:.25,repeat:.7}}]},
  town_murmur: {gain:.065,loop:true,layers:[{p:{freq:120,sustain:3,shape:4,filter:-420,tremolo:.6,repeat:.4}},{p:{freq:180,sustain:3,shape:1,filter:-350,tremolo:.7,repeat:.33},gain:.16}]},
  town_hum: {gain:.08,loop:true,layers:[{p:{freq:146.83,sustain:3,shape:0,tremolo:.2,repeat:1.4}},{p:{freq:220,sustain:3,shape:0},gain:.25}]},
  town_anvil: {gain:.20,max:1,layers:[...bell(790,0,.7,.45),{p:{freq:240,release:.045,shape:4,filter:-2400},gain:.3}]},
  town_gem: {gain:.11,max:1,layers:bell(1320,0,.6,.22)},
  town_bell: {gain:.13,max:1,layers:bell(196,0,.8,2.8)},
  whirlwind: {
    gain: 0.3, loop: true,
    layers: [
      { p: { freq: 260, sustain: 1.2, release: 0, shape: 4, tremolo: 0.55, repeat: 0.15, filter: -950 } },
      { p: { freq: 520, sustain: 1.2, release: 0, shape: 4, tremolo: 0.4, repeat: 0.075, filter: -1700 }, gain: 0.22 },
    ],
  },
};

/** Render a sound definition to a mono sample buffer (peak-normalised to 0.9). */
export function renderSound(def: SoundDef, build: Build, sampleRate: number): Float32Array {
  const parts: { s: ArrayLike<number>; off: number; gain: number; exp: number }[] = [];
  let len = 0;
  for (const l of def.layers) {
    const s = build(...params(l.p));
    const off = Math.round((l.at ?? 0) * sampleRate);
    parts.push({ s, off, gain: l.gain ?? 1, exp: l.exp ?? 0 });
    len = Math.max(len, off + s.length);
  }
  const out = new Float32Array(len);
  for (const { s, off, gain, exp } of parts) {
    const k = exp > 0 ? Math.exp(-1 / (exp * sampleRate)) : 1;
    let e = 1;
    for (let i = 0; i < s.length; i++) {
      out[off + i] += s[i] * gain * e;
      e *= k;
    }
  }
  if (def.loop) {
    // Crossfade the tail into the head so the buffer loops without a click.
    const xf = Math.min(Math.floor(sampleRate * 0.12), Math.floor(len / 3));
    for (let i = 0; i < xf; i++) {
      const t = i / xf;
      out[i] = out[i] * t + out[len - xf + i] * (1 - t);
    }
    const trimmed = out.slice(0, len - xf);
    normalise(trimmed);
    return trimmed;
  }
  // 4 ms fade-out guard against clicks at the end.
  const fade = Math.min(len, Math.floor(sampleRate * 0.004));
  for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
  normalise(out);
  return out;
}

function normalise(b: Float32Array): void {
  let peak = 0;
  for (let i = 0; i < b.length; i++) { const a = Math.abs(b[i]); if (a > peak) peak = a; }
  if (peak > 1e-6) {
    const k = 0.9 / peak;
    for (let i = 0; i < b.length; i++) b[i] *= k;
  }
}
