// Minimal typings for the `zzfx` package (ships plain JS).
declare module 'zzfx' {
  export const ZZFX: {
    volume: number;
    sampleRate: number;
    audioContext: AudioContext;
    buildSamples(...params: number[]): number[] | Float32Array;
    getNote(semitoneOffset?: number, rootNoteFrequency?: number): number;
  };
  export function zzfx(...params: number[]): AudioBufferSourceNode;
}
