// Sound effects engine: ZzFX-synthesised buffers (client/src/audio/bank.ts) played through a small
// Web Audio graph: voice → gain → stereo pan → sfx bus (duckable) → compressor → master → speakers.
//
// * Lazy: the AudioContext (and zzfx itself) is created on unlock() — the first user gesture — so the
//   page never trips the autoplay policy. Sounds requested before unlock are dropped, not queued.
// * Buffers are rendered once (on first use, and pre-baked in the background after unlock).
// * Positional sounds attenuate with distance from the listener and pan left/right.
// * Concurrency: each sound allows `max` starts per 50 ms; a global voice cap drops low-priority voices.

import { SOUNDS, renderSound } from './bank';
import { preferences } from '../game/preferences';

export interface PlayOpts { x?: number; y?: number; vol?: number }

const VOICE_CAP = 28;
const NEAR = 320;
const FAR = 1350;

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  bus: GainNode;
  pri: GainNode;
  effects: GainNode;
  priorityEffects: GainNode;
  ambience: GainNode;
  build: (...p: number[]) => ArrayLike<number>;
}

class Sfx {
  private eng: Engine | null = null;
  private loading = false;
  private buffers = new Map<string, AudioBuffer>();
  private recent = new Map<string, number[]>();
  private voices = 0;
  private volume = 0.8;
  private lx = 0;
  private ly = 0;
  private hasListener = false;
  private loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  private wantLoops = new Set<string>();
  private muted = false;
  private effectsVolume = 1;
  private ambienceVolume = 1;
  private ambient = new Map<string, {src:AudioBufferSourceNode; gain:GainNode; pan:StereoPannerNode}>();

  /** Town emitter loops have independent positions and lifetime, through the same mute/volume bus. */
  positionedLoop(id:string,name:string,x:number,y:number,radius:number):void {
    const eng=this.eng;if(!eng||eng.ctx.state!=='running')return;
    const def=SOUNDS[name];if(!def?.loop)return;
    const dx=x-this.lx,dy=y-this.ly,d=Math.hypot(dx,dy),level=Math.max(0,1-d/radius)**2;
    let voice=this.ambient.get(id);
    if(level<.001){if(voice){voice.src.stop();this.ambient.delete(id);}return;}
    if(!voice){
      const buffer=this.buffer(name);if(!buffer)return;
      const src=eng.ctx.createBufferSource(),gain=eng.ctx.createGain(),pan=eng.ctx.createStereoPanner();
      src.buffer=buffer;src.loop=true;src.connect(gain).connect(pan).connect(eng.ambience);gain.gain.value=0;
      src.onended=()=>{src.disconnect();gain.disconnect();pan.disconnect();};src.start();voice={src,gain,pan};this.ambient.set(id,voice);
    }
    voice.gain.gain.setTargetAtTime(def.gain*level,eng.ctx.currentTime,.08);
    voice.pan.pan.setTargetAtTime(Math.max(-.8,Math.min(.8,dx/550)),eng.ctx.currentTime,.08);
  }
  clearAmbient():void {for(const v of this.ambient.values())v.src.stop();this.ambient.clear();}

  /** Read-only audio graph evidence for the existing game debug API; never sampled per frame. */
  inspect() {
    return {state:this.eng?.ctx.state??'locked',muted:this.muted,master:this.eng?.master.gain.value??0,
      categories:this.eng?{effects:this.eng.effects.gain.value,priorityEffects:this.eng.priorityEffects.gain.value,ambience:this.eng.ambience.gain.value}:null,
      listener:[this.lx,this.ly],loops:[...this.ambient].map(([id,v])=>({id,gain:v.gain.gain.value,pan:v.pan.pan.value})),
      buffers:[...this.buffers].filter(([name])=>name.startsWith('town_')).map(([name,b])=>{
        const a=b.getChannelData(0);let sum=0,peak=0;for(const v of a){sum+=v*v;peak=Math.max(peak,Math.abs(v));}
        return {name,seconds:b.duration,rms:Math.sqrt(sum/a.length),peak};
      })};
  }

  constructor() {
    const apply = () => {
      const p = preferences.get().values;
      this.setVolume(p.masterVolume); this.setMuted(p.muted);
      this.effectsVolume = p.effectsVolume; this.ambienceVolume = p.ambienceVolume;
      if (this.eng) {
        const t = this.eng.ctx.currentTime;
        this.eng.effects.gain.setTargetAtTime(p.effectsVolume, t, 0.02);
        this.eng.priorityEffects.gain.setTargetAtTime(p.effectsVolume, t, 0.02);
        this.eng.ambience.gain.setTargetAtTime(p.ambienceVolume, t, 0.02);
      }
    };
    apply(); preferences.subscribe(apply);
    if (typeof window !== 'undefined') {
      const go = () => {
        this.unlock();
        // Escape is not a browser activation gesture. Keep retrying until audio really runs.
        if(this.eng?.ctx.state==='running') {
          window.removeEventListener('pointerdown',go,true);
          window.removeEventListener('keydown',go,true);
        }
      };
      window.addEventListener('pointerdown', go, { capture: true });
      window.addEventListener('keydown', go, { capture: true });
    }
  }

  /** Call from a user gesture. Creates the audio graph on first call, resumes it afterwards. */
  unlock(): void {
    if (this.eng) {
      if (this.eng.ctx.state === 'suspended') void this.eng.ctx.resume().catch(() => undefined);
      return;
    }
    if (this.loading || typeof window === 'undefined') return;
    this.loading = true;
    import('zzfx').then(({ ZZFX }) => {
      const ctx = ZZFX.audioContext;
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : this.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      const bus = ctx.createGain();
      const pri = ctx.createGain();
      const effects = ctx.createGain(), priorityEffects = ctx.createGain(), ambience = ctx.createGain();
      effects.gain.value = priorityEffects.gain.value = this.effectsVolume;
      ambience.gain.value = this.ambienceVolume;
      effects.connect(bus); priorityEffects.connect(pri); ambience.connect(bus);
      bus.connect(comp);
      pri.connect(comp);
      comp.connect(master);
      master.connect(ctx.destination);
      this.eng = { ctx, master, bus, pri, effects, priorityEffects, ambience, build: (...p) => ZZFX.buildSamples(...p) };
      void ctx.resume().catch(() => undefined);
      for (const name of this.wantLoops) this.startLoop(name);
      this.prebake();
    }).catch(() => { this.loading = false; });
  }

  setListener(x: number, y: number): void {
    this.lx = x;
    this.ly = y;
    this.hasListener = true;
  }

  /** Master volume 0..1. */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.eng && !this.muted) this.eng.master.gain.setTargetAtTime(this.volume, this.eng.ctx.currentTime, 0.02);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.eng) this.eng.master.gain.setTargetAtTime(m ? 0 : this.volume, this.eng.ctx.currentTime, 0.02);
  }

  /** Play a one-shot. With x/y the sound is positional (attenuated and panned around the listener). */
  play(name: string, opts?: PlayOpts): void {
    const eng = this.eng;
    if (!eng || eng.ctx.state !== 'running') return;
    const def = SOUNDS[name];
    if (!def || def.loop) return;
    let vol = (opts?.vol ?? 1) * def.gain;
    let pan = 0;
    if (opts && opts.x !== undefined && opts.y !== undefined && this.hasListener) {
      const dx = opts.x - this.lx, dy = opts.y - this.ly;
      const d = Math.hypot(dx, dy);
      if (d > NEAR) {
        const f = 1 - (d - NEAR) / (FAR - NEAR);
        if (f <= 0.02) return;
        vol *= f * f;
      }
      pan = Math.max(-0.6, Math.min(0.6, dx / 900));
    }
    if (vol < 0.01) return;
    // Per-sound rate limit.
    const now = eng.ctx.currentTime;
    let r = this.recent.get(name);
    if (!r) { r = []; this.recent.set(name, r); }
    while (r.length && now - r[0] > 0.05) r.shift();
    if (r.length >= (def.max ?? 4)) return;
    if (!def.pri && this.voices >= VOICE_CAP) return;
    const buf = this.buffer(name);
    if (!buf) return;
    r.push(now);

    const src = eng.ctx.createBufferSource();
    src.buffer = buf;
    if (def.vary) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * def.vary;
    const g = eng.ctx.createGain();
    g.gain.value = vol;
    let node: AudioNode = g;
    if (pan !== 0) {
      const p = eng.ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      node = p;
    }
    node.connect(def.pri ? eng.priorityEffects : eng.effects);
    src.connect(g);
    this.voices++;
    src.onended = () => { this.voices--; src.disconnect(); g.disconnect(); if (node !== g) node.disconnect(); };
    src.start();
    if (def.pri && (name === 'legendary' || name === 'set' || name === 'level' || name === 'paragon')) this.duck(0.55, 1.1);
  }

  /** Start/stop a looping sound (e.g. 'whirlwind' while channelling). */
  loop(name: string, on: boolean): void {
    if (on) {
      this.wantLoops.add(name);
      this.startLoop(name);
    } else {
      this.wantLoops.delete(name);
      const l = this.loops.get(name);
      if (!l || !this.eng) return;
      this.loops.delete(name);
      const t = this.eng.ctx.currentTime;
      l.gain.gain.cancelScheduledValues(t);
      l.gain.gain.setValueAtTime(l.gain.gain.value, t);
      l.gain.gain.linearRampToValueAtTime(0, t + 0.25);
      l.src.stop(t + 0.3);
    }
  }

  private startLoop(name: string): void {
    const eng = this.eng;
    if (!eng || this.loops.has(name)) return;
    const def = SOUNDS[name];
    if (!def?.loop) return;
    const buf = this.buffer(name);
    if (!buf) return;
    const src = eng.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = eng.ctx.createGain();
    const t = eng.ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(def.gain, t + 0.12);
    src.connect(g).connect(eng.effects);
    src.onended = () => { src.disconnect(); g.disconnect(); };
    src.start();
    this.loops.set(name, { src, gain: g });
  }

  /** Briefly lower everything but priority sounds (legendary chime, level-up...). */
  private duck(to: number, seconds: number): void {
    const eng = this.eng;
    if (!eng) return;
    const t = eng.ctx.currentTime;
    const g = eng.bus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(to, t + 0.06);
    g.setValueAtTime(to, t + seconds * 0.6);
    g.linearRampToValueAtTime(1, t + seconds);
  }

  private buffer(name: string): AudioBuffer | null {
    const have = this.buffers.get(name);
    if (have) return have;
    const eng = this.eng;
    const def = SOUNDS[name];
    if (!eng || !def) return null;
    // zzfx renders at its own sample rate (44.1 kHz); the AudioBuffer is created at that rate and the
    // context resamples on playback.
    const zr = 44100;
    const data = renderSound(def, eng.build, zr);
    const buf = eng.ctx.createBuffer(1, Math.max(1, data.length), zr);
    buf.getChannelData(0).set(data);
    this.buffers.set(name, buf);
    return buf;
  }

  /** Render the rest of the bank in small idle slices so the first real play never hitches. */
  private prebake(): void {
    const names = Object.keys(SOUNDS).filter((n) => !this.buffers.has(n));
    const step = () => {
      const t0 = performance.now();
      while (names.length && performance.now() - t0 < 6) this.buffer(names.shift()!);
      if (names.length) setTimeout(step, 30);
    };
    setTimeout(step, 50);
  }

  /** Debug/introspection: names of every available sound. */
  names(): string[] {
    return Object.keys(SOUNDS);
  }
}

export const sfx = new Sfx();
