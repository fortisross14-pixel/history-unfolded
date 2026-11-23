/**
 * Small synthesized sounds (no files to load): a click, marching steps, a clash of arms, a turn
 * chime and a low thud for refusals. One master gain; muting is remembered per browser.
 */

const KEY = 'hu-muted';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

/** effects volume from the settings, 0..1 */
let volume = 1;
export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = 0.2 * volume;
}

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(KEY, m ? '1' : '0');
  } catch {
    /* private mode: muting lasts for this visit */
  }
}

function audio(): AudioContext | null {
  if (muted || volume <= 0 || typeof AudioContext === 'undefined') return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    // about -14 dB: these sit under whatever the player is listening to
    master.gain.value = 0.2 * volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** A pitched blip with a quick attack and exponential release. */
function tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slide = 0) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Filtered noise: footsteps, clashes. */
function noise(dur: number, vol: number, at = 0, freq = 1200, q = 1) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + at;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

// a little pitch variation so repeats do not sound mechanical
const vary = (x: number, pct = 0.06) => x * (1 + (Math.random() * 2 - 1) * pct);

export const sound = {
  click() {
    tone(vary(880), 0.05, 'triangle', 0.25);
  },
  march() {
    for (let i = 0; i < 3; i++) noise(0.07, 0.5, i * 0.11, vary(500, 0.15), 2);
  },
  sail() {
    noise(0.5, 0.35, 0, 600, 0.6);
  },
  clash() {
    noise(0.22, 0.9, 0, vary(2600), 3);
    tone(vary(180), 0.25, 'sawtooth', 0.18, 0, -90);
    noise(0.18, 0.6, 0.14, vary(3400), 4);
  },
  capture() {
    [392, 523, 659].forEach((f, i) => tone(f, 0.35, 'triangle', 0.22, i * 0.12));
  },
  turn() {
    tone(587, 0.5, 'sine', 0.18);
    tone(880, 0.6, 'sine', 0.12, 0.09);
  },
  deny() {
    tone(150, 0.14, 'square', 0.12, 0, -40);
  },
};
