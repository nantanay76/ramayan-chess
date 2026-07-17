import type { Color } from 'chess.js';

/**
 * All audio is synthesized with WebAudio — no asset files, works offline.
 */
export type SoundKind = 'select' | 'move' | 'capture' | 'check' | 'win' | 'lose' | 'draw';

let ctx: AudioContext | null = null;
let soundEnabled = true;
let musicNodes: { gain: GainNode; timer: number; oscillators: OscillatorNode[] } | null = null;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setSoundEnabled(on: boolean): void {
  soundEnabled = on;
}

function tone(freq: number, dur: number, type: OscillatorType, peak: number, when = 0, endFreq?: number): void {
  const a = ac();
  const t = a.currentTime + when;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function knock(dur: number, peak: number, filterFreq: number, when = 0): void {
  const a = ac();
  const t = a.currentTime + when;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buffer = a.createBuffer(1, len, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = a.createGain();
  gain.gain.value = peak;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t);
}

function noiseBuffer(a: AudioContext, dur: number): AudioBuffer {
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buffer = a.createBuffer(1, len, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function growlCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 256;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount);
  }
  return curve;
}

const jitter = (spread: number) => 1 + (Math.random() * 2 - 1) * spread;

/**
 * Lanka's captures: a short, dark, growly "voice" — pitched-down noise
 * through a sweeping formant filter and light distortion, plus a couple of
 * low chuckle pulses underneath. No real words, kept short so it's bearable
 * rather than an actual demonic scream.
 */
function lankaVoice(): void {
  const a = ac();
  const t0 = a.currentTime;
  const p = jitter(0.08);

  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, 0.4);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 4;
  bp.frequency.setValueAtTime(420 * p, t0);
  bp.frequency.exponentialRampToValueAtTime(140 * p, t0 + 0.38);
  const shaper = a.createWaveShaper();
  shaper.curve = growlCurve(6);
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
  src.connect(bp).connect(shaper).connect(gain).connect(a.destination);
  src.start(t0);

  [0, 0.14].forEach((delay, i) => {
    const osc = a.createOscillator();
    osc.type = 'sawtooth';
    const f0 = (110 - i * 15) * p;
    osc.frequency.setValueAtTime(f0, t0 + delay);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.6, t0 + delay + 0.12);
    const og = a.createGain();
    og.gain.setValueAtTime(0.0001, t0 + delay);
    og.gain.exponentialRampToValueAtTime(0.22, t0 + delay + 0.015);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.13);
    osc.connect(og).connect(a.destination);
    osc.start(t0 + delay);
    osc.stop(t0 + delay + 0.15);
  });
}

/**
 * Ram's captures: a warm, soft, sustained tone with a gentle bell-like
 * overtone — soothing and relaxing rather than a triumphant fanfare.
 */
function ramVoice(): void {
  const a = ac();
  const t0 = a.currentTime;
  const p = jitter(0.05);

  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300 * p, t0);
  osc.frequency.exponentialRampToValueAtTime(380 * p, t0 + 0.18);
  osc.frequency.exponentialRampToValueAtTime(340 * p, t0 + 0.55);
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.09);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + 0.65);

  const overtone = a.createOscillator();
  overtone.type = 'sine';
  overtone.frequency.setValueAtTime(680 * p, t0 + 0.02);
  const og = a.createGain();
  og.gain.setValueAtTime(0.0001, t0 + 0.02);
  og.gain.exponentialRampToValueAtTime(0.06, t0 + 0.1);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
  overtone.connect(og).connect(a.destination);
  overtone.start(t0 + 0.02);
  overtone.stop(t0 + 0.55);
}

/** Faction "voice" accent layered on top of the physical capture knock. */
export function playCaptureVoice(capturingColor: Color): void {
  if (!soundEnabled) return;
  try {
    if (capturingColor === 'b') lankaVoice();
    else ramVoice();
  } catch {
    // never let voice synthesis break the game
  }
}

export function playSound(kind: SoundKind): void {
  if (!soundEnabled) return;
  try {
    switch (kind) {
      case 'select':
        tone(920, 0.06, 'sine', 0.04);
        break;
      case 'move':
        tone(190, 0.11, 'sine', 0.22, 0, 95);
        knock(0.05, 0.28, 1400);
        break;
      case 'capture':
        tone(130, 0.16, 'sine', 0.3, 0, 60);
        knock(0.09, 0.4, 900);
        break;
      case 'check':
        tone(1244, 0.4, 'sine', 0.1);
        tone(1866, 0.3, 'sine', 0.05, 0.02);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 'sine', 0.12, i * 0.16));
        break;
      case 'lose':
        [392, 311, 262].forEach((f, i) => tone(f, 0.5, 'sine', 0.11, i * 0.2));
        break;
      case 'draw':
        [440, 440].forEach((f, i) => tone(f, 0.35, 'sine', 0.09, i * 0.25));
        break;
    }
  } catch {
    // Audio can fail before a user gesture — never let sound break the game.
  }
}

/**
 * Adaptive generative score. A lookahead scheduler (notes are timed against
 * the AudioContext clock, the 200ms JS tick only keeps the queue topped up)
 * plays three layers over a tanpura pad:
 *   - pad: Sa–Pa sawtooth drone, lowpass opens with intensity
 *   - tabla: keherwa-style 8-step cycle, enters above a calm threshold,
 *     ghost strokes and tempo build with intensity
 *   - melody: triangle plucks random-walking a Bhairavi-flavoured scale,
 *     denser and octave-biased as the battle heats
 * `setMusicIntensity` (0..1) is read at schedule time — no node rebuilds.
 */
let intensity = 0.15;
export function setMusicIntensity(v: number): void {
  intensity = Math.min(1, Math.max(0, v));
}

const SA = 146.83; // D3
/** Bhairavi-ish: S r g m P d n S' as semitones from Sa. */
const SCALE = [0, 1, 3, 5, 7, 8, 10, 12];
/** Melody walks this subset (S g m P n S') — skips the raw 2nds. */
const MELODY = [0, 2, 3, 4, 6, 7];
const semi = (n: number) => SA * 2 ** (n / 12);

export function startMusic(): void {
  if (musicNodes) return;
  try {
    const a = ac();
    const master = a.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(0.06, a.currentTime + 3);
    master.connect(a.destination);
    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.connect(master);

    // Sa (D3) and Pa (A3) pad
    const oscillators: OscillatorNode[] = [];
    for (const f of [SA, 220.0]) {
      const osc = a.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const g = a.createGain();
      g.gain.value = 0.12;
      osc.connect(g).connect(filter);
      osc.start();
      oscillators.push(osc);
    }

    // one melodic pluck routed through the pad's lowpass so it sits "inside"
    // the drone; tabla strokes go straight to master to keep their snap
    const pluck = (freq: number, t: number, peak: number, dur: number) => {
      const osc = a.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(filter);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    };

    const bol = (t: number, bass: boolean, peak: number) => {
      // tabla stroke = membrane pitch-drop + a filtered noise slap
      const osc = a.createOscillator();
      osc.type = 'sine';
      const f0 = bass ? 105 : 240;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.1);
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (bass ? 0.14 : 0.07));
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.2);

      const slap = a.createBufferSource();
      slap.buffer = noiseBuffer(a, 0.03);
      const hp = a.createBiquadFilter();
      hp.type = bass ? 'lowpass' : 'highpass';
      hp.frequency.value = bass ? 900 : 2200;
      const sg = a.createGain();
      sg.gain.setValueAtTime(peak * 0.7, t);
      sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      slap.connect(hp).connect(sg).connect(master);
      slap.start(t);
    };

    let nextTime = a.currentTime + 0.1;
    let step = 0;
    let melodyIdx = 0;

    const scheduleStep = (t: number) => {
      const heat = intensity;
      const pos = step % 8;

      // keherwa skeleton: dha . na . dhin . na . — ghosts fill in with heat
      if (heat >= 0.15) {
        const vel = 0.35 + 0.45 * heat;
        if (pos === 0 || pos === 4) bol(t, true, 0.3 * vel);
        else if (pos === 2 || pos === 6) bol(t, false, 0.22 * vel);
        else if (Math.random() < 0.1 + 0.45 * heat) bol(t, false, 0.1 * vel);
      }

      // melody: sparse meditation when calm, urgent runs when the war burns
      if (Math.random() < 0.22 + 0.55 * heat) {
        const drift = Math.random();
        if (drift < 0.12) melodyIdx = 0; // return to Sa keeps it grounded
        else if (drift < 0.56) melodyIdx = Math.min(MELODY.length - 1, melodyIdx + 1);
        else melodyIdx = Math.max(0, melodyIdx - 1);
        const octave = heat > 0.55 && Math.random() < 0.4 ? 24 : 12;
        pluck(semi(SCALE[MELODY[melodyIdx]] + octave), t, 0.22 + 0.12 * heat, 1.4 - 0.5 * heat);
      }

      // tanpura answer on the cycle's shoulders, like the old Pa–Sa figure
      if (pos === 0 && Math.random() < 0.6) pluck(220, t + 0.02, 0.16, 1.6);

      step++;
      return 0.45 - 0.17 * heat; // step length — tempo follows tension
    };

    const timer = window.setInterval(() => {
      // the pad's lowpass opens as the battle heats up
      filter.frequency.setTargetAtTime(700 + intensity * 900, a.currentTime, 0.4);
      while (nextTime < a.currentTime + 0.6) {
        nextTime += scheduleStep(nextTime);
      }
    }, 200);

    musicNodes = { gain: master, timer, oscillators };
  } catch {
    musicNodes = null;
  }
}

export function stopMusic(): void {
  if (!musicNodes) return;
  const a = ac();
  window.clearInterval(musicNodes.timer);
  musicNodes.gain.gain.linearRampToValueAtTime(0, a.currentTime + 0.8);
  const dying = musicNodes;
  window.setTimeout(() => {
    for (const osc of dying.oscillators) osc.stop();
    dying.gain.disconnect();
  }, 1000);
  musicNodes = null;
}
