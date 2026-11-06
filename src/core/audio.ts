import { settings, saveSettings } from './settings';
import { SONGS, Song } from '../data/music';

type Wave = 'square' | 'saw' | 'triangle' | 'noise' | 'sine';
interface SfxDef {
  wave: Wave;
  freq: number;
  freqSlide?: number; // Hz per second
  duty?: number;
  attack: number;
  sustain: number;
  decay: number;
  vibrato?: [number, number];
  arp?: [number, number];
  lowpass?: number;
  highpass?: number;
  volume: number;
  /** extra layer mixed in */
  layer?: SfxDef;
}

const SR = 44100;

function renderDef(d: SfxDef, out: Float32Array, offset = 0): void {
  const total = d.attack + d.sustain + d.decay;
  const n = Math.min(out.length - offset, Math.floor(total * SR));
  let phase = 0;
  let lp = 0;
  let hpPrev = 0;
  let hpOut = 0;
  const lpA = d.lowpass ? 1 - Math.exp((-2 * Math.PI * d.lowpass) / SR) : 1;
  const hpA = d.highpass ? Math.exp((-2 * Math.PI * d.highpass) / SR) : 0;
  let noiseVal = 0;
  let seed = 12345;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let f = d.freq + (d.freqSlide ?? 0) * t;
    if (d.arp && t >= d.arp[1]) f *= d.arp[0];
    if (d.vibrato) f *= 1 + d.vibrato[0] * Math.sin(2 * Math.PI * d.vibrato[1] * t);
    f = Math.max(20, f);
    const prevPhase = phase;
    phase += f / SR;
    if (phase >= 1) phase -= 1;
    let v = 0;
    switch (d.wave) {
      case 'square': v = phase < (d.duty ?? 0.5) ? 0.6 : -0.6; break;
      case 'saw': v = (phase * 2 - 1) * 0.6; break;
      case 'triangle': v = (phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4) * 0.8; break;
      case 'sine': v = Math.sin(phase * Math.PI * 2) * 0.8; break;
      case 'noise':
        if (phase < prevPhase || d.freq > 8000) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          noiseVal = (seed / 0x7fffffff) * 2 - 1;
        }
        v = noiseVal * 0.7;
        break;
    }
    lp += (v - lp) * lpA;
    v = lp;
    if (d.highpass) {
      hpOut = hpA * (hpOut + v - hpPrev);
      hpPrev = v;
      v = hpOut;
    }
    let env: number;
    if (t < d.attack) env = t / d.attack;
    else if (t < d.attack + d.sustain) env = 1;
    else env = Math.max(0, 1 - (t - d.attack - d.sustain) / d.decay);
    out[offset + i] += v * env * d.volume;
  }
  if (d.layer) renderDef(d.layer, out, offset);
}

function lenOf(d: SfxDef): number {
  const own = d.attack + d.sustain + d.decay;
  return d.layer ? Math.max(own, lenOf(d.layer)) : own;
}

const DEFS: Record<string, SfxDef> = {
  hit_perfect: {
    wave: 'noise', freq: 9000, attack: 0.001, sustain: 0.01, decay: 0.07, lowpass: 5000, volume: 0.9,
    layer: { wave: 'square', freq: 520, freqSlide: -2600, duty: 0.3, attack: 0.001, sustain: 0.01, decay: 0.08, volume: 0.45 },
  },
  hit_good: {
    wave: 'noise', freq: 9000, attack: 0.001, sustain: 0.008, decay: 0.05, lowpass: 3500, volume: 0.75,
    layer: { wave: 'triangle', freq: 420, freqSlide: -2400, attack: 0.001, sustain: 0.005, decay: 0.06, volume: 0.55 },
  },
  hit_weak: {
    wave: 'noise', freq: 9000, attack: 0.001, sustain: 0.005, decay: 0.05, lowpass: 1600, volume: 0.6,
    layer: { wave: 'triangle', freq: 260, freqSlide: -1200, attack: 0.001, sustain: 0.005, decay: 0.05, volume: 0.45 },
  },
  hit_mishit: {
    wave: 'square', freq: 180, freqSlide: -300, duty: 0.15, attack: 0.001, sustain: 0.02, decay: 0.12, vibrato: [0.25, 45], volume: 0.35,
    layer: { wave: 'noise', freq: 3000, attack: 0.001, sustain: 0.02, decay: 0.1, lowpass: 2200, volume: 0.5 },
  },
  volley: {
    wave: 'noise', freq: 9000, attack: 0.001, sustain: 0.004, decay: 0.035, lowpass: 4500, volume: 0.7,
    layer: { wave: 'triangle', freq: 600, freqSlide: -3000, attack: 0.001, sustain: 0.004, decay: 0.04, volume: 0.4 },
  },
  bounce_grass: { wave: 'noise', freq: 9000, attack: 0.001, sustain: 0.005, decay: 0.06, lowpass: 600, volume: 0.6,
    layer: { wave: 'sine', freq: 140, freqSlide: -600, attack: 0.001, sustain: 0.01, decay: 0.05, volume: 0.5 } },
  bounce_clay: { wave: 'noise', freq: 9000, attack: 0.001, sustain: 0.02, decay: 0.09, lowpass: 1400, volume: 0.55,
    layer: { wave: 'sine', freq: 110, freqSlide: -400, attack: 0.001, sustain: 0.01, decay: 0.05, volume: 0.45 } },
  bounce_hard: { wave: 'noise', freq: 9000, attack: 0.001, sustain: 0.003, decay: 0.035, lowpass: 3500, volume: 0.55,
    layer: { wave: 'triangle', freq: 320, freqSlide: -1500, attack: 0.001, sustain: 0.004, decay: 0.04, volume: 0.5 } },
  net_cord: { wave: 'triangle', freq: 880, freqSlide: -1200, attack: 0.001, sustain: 0.01, decay: 0.08, volume: 0.45 },
  net_thud: { wave: 'noise', freq: 9000, attack: 0.002, sustain: 0.02, decay: 0.12, lowpass: 500, volume: 0.7 },
  swing: { wave: 'noise', freq: 9000, attack: 0.04, sustain: 0.02, decay: 0.08, lowpass: 2200, highpass: 600, volume: 0.25 },
  toss: { wave: 'sine', freq: 500, freqSlide: 900, attack: 0.01, sustain: 0.02, decay: 0.08, volume: 0.12 },
  step: { wave: 'noise', freq: 9000, attack: 0.002, sustain: 0.005, decay: 0.03, lowpass: 900, volume: 0.18 },
  skid: { wave: 'noise', freq: 9000, attack: 0.02, sustain: 0.12, decay: 0.15, lowpass: 1800, highpass: 400, volume: 0.3 },
  ump: {
    wave: 'sine', freq: 784, attack: 0.005, sustain: 0.09, decay: 0.12, volume: 0.35,
    layer: { wave: 'sine', freq: 1047, attack: 0.12, sustain: 0.05, decay: 0.2, volume: 0.3 },
  },
  fault: {
    wave: 'square', freq: 330, duty: 0.25, attack: 0.005, sustain: 0.1, decay: 0.1, volume: 0.22,
    layer: { wave: 'square', freq: 247, duty: 0.25, attack: 0.13, sustain: 0.06, decay: 0.15, volume: 0.22 },
  },
  out: {
    wave: 'square', freq: 440, freqSlide: -500, duty: 0.3, attack: 0.005, sustain: 0.08, decay: 0.14, volume: 0.22,
  },
  perfect: {
    wave: 'square', freq: 1046, duty: 0.25, arp: [1.5, 0.05], attack: 0.002, sustain: 0.09, decay: 0.12, volume: 0.18,
    layer: { wave: 'triangle', freq: 2093, attack: 0.05, sustain: 0.04, decay: 0.15, volume: 0.15 },
  },
  menu_move: { wave: 'square', freq: 660, duty: 0.25, attack: 0.001, sustain: 0.02, decay: 0.02, volume: 0.15 },
  menu_ok: { wave: 'square', freq: 784, duty: 0.25, arp: [1.5, 0.04], attack: 0.001, sustain: 0.06, decay: 0.05, volume: 0.18 },
  menu_back: { wave: 'square', freq: 523, freqSlide: -800, duty: 0.25, attack: 0.001, sustain: 0.04, decay: 0.05, volume: 0.15 },
  ding: { wave: 'triangle', freq: 1319, arp: [1.335, 0.07], attack: 0.002, sustain: 0.1, decay: 0.25, volume: 0.3 },
  breath: { wave: 'noise', freq: 9000, attack: 0.15, sustain: 0.1, decay: 0.35, lowpass: 900, highpass: 250, volume: 0.25 },
  whiff: { wave: 'noise', freq: 9000, attack: 0.03, sustain: 0.03, decay: 0.12, lowpass: 1500, highpass: 500, volume: 0.25 },
};

/** Applause: many tiny clap bursts. */
function renderApplause(dur: number, density: number): Float32Array {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  let seed = 99;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const claps = Math.floor(dur * density);
  for (let c = 0; c < claps; c++) {
    const t0 = rnd() * dur;
    const envShape = Math.sin(Math.PI * Math.min(1, t0 / dur)) ** 0.6;
    const start = Math.floor(t0 * SR);
    const len = Math.floor(0.012 * SR + rnd() * 0.01 * SR);
    const amp = (0.08 + rnd() * 0.12) * envShape;
    let lp = 0;
    const cut = 0.25 + rnd() * 0.5;
    for (let i = 0; i < len && start + i < n; i++) {
      const v = rnd() * 2 - 1;
      lp += (v - lp) * cut;
      out[start + i] += lp * amp * Math.exp(-i / (len * 0.3));
    }
  }
  return out;
}

/** Crowd "ooh": band-passed noise with a gliding formant. */
function renderOoh(dur: number): Float32Array {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // simple resonant bandpass (biquad) with time-varying center
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const fc = 380 + 160 * Math.sin(Math.PI * t) - 80 * t;
    const q = 6;
    const w0 = (2 * Math.PI * fc) / SR;
    const alpha = Math.sin(w0) / (2 * q);
    const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;
    const x = rnd() * 2 - 1;
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    const env = Math.sin(Math.PI * Math.min(1, t * 1.6)) * (1 - t * 0.5);
    out[i] = y * env * 1.6;
  }
  return out;
}

const NOTE_IDX: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export function noteFreq(n: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) return 0;
  const midi = NOTE_IDX[m[1]] + (parseInt(m[2]) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<string, number>();
  playing = 0;
  currentSong: string | null = null;
  private song: Song | null = null;
  private songRow = 0;
  private nextRowTime = 0;
  private timer: number | null = null;
  private loopSong = true;
  private noiseBuf: AudioBuffer | null = null;
  lastSfx = '';

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx!;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.applyVolumes();
    for (const [k, d] of Object.entries(DEFS)) {
      const data = new Float32Array(Math.ceil(lenOf(d) * SR) + 16);
      renderDef(d, data);
      this.buffers.set(k, this.toBuf(data));
    }
    this.buffers.set('applause_small', this.toBuf(renderApplause(1.4, 180)));
    this.buffers.set('applause_big', this.toBuf(renderApplause(3.2, 900)));
    this.buffers.set('ooh', this.toBuf(renderOoh(1.1)));
    const nb = new Float32Array(SR);
    for (let i = 0; i < nb.length; i++) nb[i] = Math.random() * 2 - 1;
    this.noiseBuf = this.toBuf(nb);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
    if (this.pendingSong) {
      const p = this.pendingSong;
      this.pendingSong = null;
      this.playSong(p.id, p.loop);
    }
  }
  private pendingSong: { id: string; loop: boolean } | null = null;

  private toBuf(data: Float32Array): AudioBuffer {
    const b = this.ctx!.createBuffer(1, data.length, SR);
    b.copyToChannel(data, 0);
    return b;
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.master, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(settings.sfx, t, 0.02);
    this.musicBus.gain.setTargetAtTime(settings.music * 0.45, t, 0.02);
  }

  toggleMute(): void {
    settings.muted = !settings.muted;
    saveSettings();
    this.applyVolumes();
  }

  get state(): string {
    return this.ctx ? this.ctx.state : 'locked';
  }

  sfx(id: string, vol = 1, pitch = 1, pan = 0): void {
    this.lastSfx = id;
    if (!this.ctx || this.ctx.state !== 'running') return;
    const buf = this.buffers.get(id);
    if (!buf) return;
    const v = this.voices.get(id) ?? 0;
    if (v >= 3) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    let node: AudioNode = g;
    if (pan !== 0 && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      node = p;
    }
    src.connect(g);
    node.connect(this.sfxBus);
    this.voices.set(id, v + 1);
    this.playing++;
    src.onended = () => {
      this.voices.set(id, (this.voices.get(id) ?? 1) - 1);
      this.playing--;
    };
    src.start();
  }

  // ---------------- music ----------------
  playSong(id: string, loop = true): void {
    if (this.currentSong === id && this.timer !== null) return;
    this.stopSong();
    this.currentSong = id;
    if (!this.ctx) {
      this.pendingSong = { id, loop };
      return;
    }
    const s = SONGS[id];
    if (!s) return;
    this.song = s;
    this.loopSong = loop;
    this.songRow = 0;
    this.nextRowTime = this.ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stopSong(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.song = null;
    this.currentSong = null;
    this.pendingSong = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    const s = this.song;
    if (!ctx || !s) return;
    const rowDur = 60 / s.bpm / 4;
    const totalRows = s.rows;
    while (this.nextRowTime < ctx.currentTime + 0.12) {
      if (this.songRow >= totalRows) {
        if (!this.loopSong) {
          this.stopSong();
          return;
        }
        this.songRow = s.loopRow ?? 0;
      }
      const t = this.nextRowTime;
      for (const ch of s.channels) {
        const tok = ch.notes[this.songRow];
        if (!tok || tok === '.' || tok === '-') continue;
        // duration: until next non-'.' token
        let len = 1;
        while (this.songRow + len < totalRows && ch.notes[this.songRow + len] === '.') len++;
        this.playNote(ch.inst, tok, t, len * rowDur, ch.vol ?? 1);
      }
      this.songRow++;
      this.nextRowTime += rowDur;
    }
  }

  private playNote(inst: string, tok: string, t: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    if (inst === 'drums') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      if (tok === 'K') {
        f.type = 'lowpass';
        f.frequency.value = 300;
        g.gain.setValueAtTime(0.9 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        og.gain.setValueAtTime(0.8 * vol, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        o.connect(og);
        og.connect(this.musicBus);
        o.start(t);
        o.stop(t + 0.15);
      } else if (tok === 'S') {
        f.type = 'bandpass';
        f.frequency.value = 1800;
        g.gain.setValueAtTime(0.6 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      } else {
        f.type = 'highpass';
        f.frequency.value = 7000;
        g.gain.setValueAtTime(0.25 * vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      }
      src.start(t, Math.random() * 0.5);
      src.stop(t + 0.2);
      return;
    }
    // chord arpeggio token like "C4+E4+G4"
    const notes = tok.split('+').map(noteFreq).filter((f) => f > 0);
    if (!notes.length) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(this.musicBus);
    if (inst === 'lead') {
      o.type = 'square';
      vol *= 0.16;
    } else if (inst === 'harm') {
      o.type = 'square';
      vol *= 0.08;
    } else if (inst === 'bass') {
      o.type = 'triangle';
      vol *= 0.4;
    } else {
      o.type = 'sawtooth';
      vol *= 0.06;
    }
    if (notes.length > 1) {
      const step = 1 / 32 / (1 / dur > 0 ? 1 : 1);
      const arpRate = 0.045;
      let k = 0;
      for (let tt = t; tt < t + dur; tt += arpRate) o.frequency.setValueAtTime(notes[k++ % notes.length], tt);
      void step;
    } else {
      o.frequency.setValueAtTime(notes[0], t);
      if (inst === 'lead' && dur > 0.25) {
        // gentle vibrato on long notes
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 6;
        lg.gain.value = notes[0] * 0.012;
        lfo.connect(lg);
        lg.connect(o.frequency);
        lfo.start(t + 0.15);
        lfo.stop(t + dur);
      }
    }
    const rel = Math.min(0.08, dur * 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol * (inst === 'bass' ? 1 : 0.75), t + Math.max(0.01, dur - rel));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

export const audio = new Audio();
