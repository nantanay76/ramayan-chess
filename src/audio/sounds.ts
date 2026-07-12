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

/** Gentle generative tanpura-style drone: Sa–Pa plucks over a soft pad. */
export function startMusic(): void {
  if (musicNodes) return;
  try {
    const a = ac();
    const master = a.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(0.05, a.currentTime + 3);
    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.connect(master).connect(a.destination);

    // Sa (D3) and Pa (A3) pad
    const oscillators: OscillatorNode[] = [];
    for (const f of [146.83, 220.0]) {
      const osc = a.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const g = a.createGain();
      g.gain.value = 0.12;
      osc.connect(g).connect(filter);
      osc.start();
      oscillators.push(osc);
    }

    // slow pluck cycle: Pa sa sa SA
    const cycle = [220.0, 293.66, 293.66, 146.83];
    let step = 0;
    const pluck = () => {
      const t = a.currentTime;
      const osc = a.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = cycle[step % cycle.length];
      step++;
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(g).connect(filter);
      osc.start(t);
      osc.stop(t + 1.8);
    };
    const timer = window.setInterval(pluck, 900);
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
