// Sound effects synthesized with the Web Audio API (no audio files needed).

let ctx = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = on;
}

function audio() {
  if (!enabled) return null;
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(ac, { freq, type = 'sine', start = 0, dur = 0.15, gain = 0.15, slideTo = null }) {
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(ac, { start = 0, dur = 0.2, gain = 0.08, from = 1200, to = 4000 }) {
  const t0 = ac.currentTime + start;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0);
}

const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];

export const sfx = {
  select() {
    const ac = audio(); if (!ac) return;
    tone(ac, { freq: 880, type: 'triangle', dur: 0.06, gain: 0.08 });
  },
  deselect() {
    const ac = audio(); if (!ac) return;
    tone(ac, { freq: 600, type: 'triangle', dur: 0.06, gain: 0.06 });
  },
  deal() {
    const ac = audio(); if (!ac) return;
    for (let i = 0; i < 8; i++) noise(ac, { start: i * 0.045, dur: 0.06, gain: 0.05, from: 2500, to: 6000 });
  },
  // Rising arpeggio whose length grows with the hand's value.
  hand(value) {
    const ac = audio(); if (!ac) return;
    const steps = value >= 1000 ? 9 : value >= 500 ? 7 : value >= 200 ? 5 : value >= 125 ? 4 : 3;
    for (let i = 0; i < steps; i++) {
      tone(ac, { freq: NOTES[i], type: 'triangle', start: i * 0.06, dur: 0.22, gain: 0.11 });
    }
  },
  joker() {
    const ac = audio(); if (!ac) return;
    tone(ac, { freq: 300, type: 'sine', dur: 0.25, gain: 0.12, slideTo: 900 });
    tone(ac, { freq: 1200, type: 'triangle', start: 0.12, dur: 0.15, gain: 0.06 });
  },
  columnCleared() {
    const ac = audio(); if (!ac) return;
    noise(ac, { dur: 0.35, gain: 0.07, from: 3000, to: 400 });
    tone(ac, { freq: 500, type: 'sine', dur: 0.3, gain: 0.08, slideTo: 150 });
  },
  error() {
    const ac = audio(); if (!ac) return;
    tone(ac, { freq: 160, type: 'square', dur: 0.12, gain: 0.06 });
    tone(ac, { freq: 120, type: 'square', start: 0.13, dur: 0.18, gain: 0.06 });
  },
  cashRegister() {
    const ac = audio(); if (!ac) return;
    noise(ac, { dur: 0.08, gain: 0.1, from: 4000, to: 2000 });
    tone(ac, { freq: 2093, type: 'sine', start: 0.08, dur: 0.6, gain: 0.12 });
    tone(ac, { freq: 2637, type: 'sine', start: 0.08, dur: 0.6, gain: 0.08 });
  },
  hint() {
    const ac = audio(); if (!ac) return;
    tone(ac, { freq: 1318.5, type: 'sine', dur: 0.3, gain: 0.08 });
    tone(ac, { freq: 1760, type: 'sine', start: 0.1, dur: 0.4, gain: 0.06 });
  },
  gameOver(won) {
    const ac = audio(); if (!ac) return;
    const seq = won ? [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5] : [440, 392, 349.23, 293.66];
    seq.forEach((f, i) => tone(ac, { freq: f, type: 'triangle', start: i * 0.13, dur: 0.3, gain: 0.12 }));
  },
  tick() {
    const ac = audio(); if (!ac) return;
    tone(ac, { freq: 1500, type: 'square', dur: 0.03, gain: 0.03 });
  },
};
