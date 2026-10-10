import { rng, biquad, white, normalize, mixInto, decay, sweepSine, mtof } from './dsp.js';

/**
 * Recetas de efectos de sonido. Cada una devuelve un Float32Array mono a `sr` Hz; el motor
 * (audio.js) los convierte en AudioBuffers la primera vez que se piden y los guarda.
 *
 * Pasos (por tipo de suelo: stone, wood, carpet, metal), puertas (picaporte, chirrido,
 * portazo, cerrada), crujidos de madera y la interfaz (cursor, aceptar, volver, abrir menú,
 * papel, "Pulsa Start").
 */

const secs = (sr, s) => Math.round(sr * s);

// ---------- Pasos ----------

const FLOORS = {
  //        golpe (Hz), caída del golpe, roce: [tipo, Hz, Q], caída del roce, mezcla del roce
  stone: { thump: 125, thumpTau: 0.022, scuff: ['bandpass', 2300, 0.9], scuffTau: 0.012, scuffGain: 0.55 },
  wood: { thump: 95, thumpTau: 0.03, scuff: ['bandpass', 1100, 1.0], scuffTau: 0.018, scuffGain: 0.35, body: 260 },
  carpet: { thump: 75, thumpTau: 0.035, scuff: ['lowpass', 650, 0.7], scuffTau: 0.03, scuffGain: 0.35 },
  metal: { thump: 140, thumpTau: 0.02, scuff: ['bandpass', 3100, 1.4], scuffTau: 0.01, scuffGain: 0.45, ring: [830, 1270, 2210] },
};

export function footstep(sr, floor = 'stone', variant = 0) {
  const f = FLOORS[floor] ?? FLOORS.stone;
  const rand = rng(1000 + variant * 17 + Object.keys(FLOORS).indexOf(floor) * 131);
  const n = secs(sr, 0.22);
  const out = new Float32Array(n);

  // Talón: golpe grave que baja de tono.
  const f0 = f.thump * (0.9 + rand() * 0.2);
  const thump = sweepSine(n, sr, (t) => f0 * (0.7 + 0.3 * Math.exp(-t / 0.03)));
  decay(thump, sr, f.thumpTau, 0.002);
  mixInto(out, thump, 0, 0.7);
  if (f.body) {
    // Madera: un poco de cuerpo hueco.
    const body = biquad(thump.slice(), sr, 'bandpass', f.body, 4);
    mixInto(out, body, 0, 1.2);
  }

  // Roce de la suela (talón y luego la punta).
  const [type, hz, q] = f.scuff;
  for (const [at, gain] of [[0, 1], [0.028 + rand() * 0.016, 0.45 + rand() * 0.2]]) {
    const scuff = white(secs(sr, 0.12), rand);
    biquad(scuff, sr, type, hz * (0.85 + rand() * 0.3), q);
    decay(scuff, sr, f.scuffTau * (0.8 + rand() * 0.4), 0.0015);
    mixInto(out, scuff, secs(sr, at), f.scuffGain * gain);
  }

  // Rejilla metálica: resuena un poco.
  if (f.ring) {
    for (const hz of f.ring) {
      const ring = sweepSine(secs(sr, 0.2), sr, () => hz * (0.97 + rand() * 0.06));
      decay(ring, sr, 0.04 + rand() * 0.03, 0.001);
      mixInto(out, ring, 0, 0.05);
    }
  }
  return normalize(out, 0.9);
}

// ---------- Madera y puertas ----------

/**
 * Chirrido por "stick-slip": un tren de impulsos de ritmo variable pasado por resonadores.
 * rate(t) en impulsos/s; `res` = [[Hz, Q, ganancia]…].
 */
function stickSlip(sr, seconds, rate, res, rand, envelope) {
  const n = secs(sr, seconds);
  const train = new Float32Array(n);
  let next = 0;
  for (let i = 0; i < n; i++) {
    if (i >= next) {
      const t = i / sr;
      const amp = envelope(t) * (0.55 + rand() * 0.45);
      // Impulso corto (un par de ms) en lugar de un solo pico: suena a madera, no a clic.
      const len = secs(sr, 0.0025);
      for (let k = 0; k < len && i + k < n; k++) train[i + k] += amp * Math.exp(-k / (len * 0.35)) * (rand() * 2 - 1);
      next = i + Math.max(1, Math.round(sr / Math.max(5, rate(t) * (0.85 + rand() * 0.3))));
    }
  }
  const out = new Float32Array(n);
  for (const [hz, q, gain] of res) mixInto(out, biquad(train.slice(), sr, 'bandpass', hz, q), 0, gain);
  return out;
}

export function doorCreak(sr) {
  const rand = rng(42);
  const T = 1.45;
  const out = stickSlip(
    sr,
    T,
    (t) => 38 + 70 * Math.sin(Math.PI * Math.min(1, t / T)) ** 1.5 + 12 * Math.sin(t * 9),
    [[640, 9, 1], [1340, 11, 0.7], [2380, 14, 0.4], [3900, 10, 0.12]],
    rand,
    (t) => Math.min(1, t / 0.12) * Math.min(1, (T - t) / 0.35) * (0.7 + 0.3 * Math.sin(t * 5.3)),
  );
  biquad(out, sr, 'highpass', 300, 0.7);
  return normalize(out, 0.75);
}

export function woodCreak(sr, variant = 0) {
  const rand = rng(77 + variant * 13);
  const T = 0.6 + rand() * 0.5;
  const base = 22 + rand() * 18;
  const out = stickSlip(
    sr,
    T,
    (t) => base + 25 * Math.sin((Math.PI * t) / T),
    [[310 + rand() * 80, 7, 1], [720 + rand() * 120, 9, 0.6], [1150, 8, 0.3]],
    rand,
    (t) => Math.min(1, t / 0.08) * Math.min(1, (T - t) / 0.2),
  );
  return normalize(out, 0.7);
}

export function doorLatch(sr) {
  const rand = rng(5);
  const out = new Float32Array(secs(sr, 0.3));
  for (const [at, gain] of [[0, 1], [0.075, 0.6]]) {
    const click = white(secs(sr, 0.05), rand);
    biquad(click, sr, 'highpass', 2200, 0.8);
    decay(click, sr, 0.003, 0.0005);
    mixInto(out, click, secs(sr, at), 0.6 * gain);
    for (const hz of [3150, 4720]) {
      const ring = sweepSine(secs(sr, 0.15), sr, () => hz);
      decay(ring, sr, 0.025, 0.0005);
      mixInto(out, ring, secs(sr, at), 0.12 * gain);
    }
    const clunk = sweepSine(secs(sr, 0.08), sr, () => 190);
    decay(clunk, sr, 0.014, 0.001);
    mixInto(out, clunk, secs(sr, at), 0.5 * gain);
  }
  return normalize(out, 0.8);
}

export function doorShut(sr) {
  const rand = rng(9);
  const out = new Float32Array(secs(sr, 0.9));
  for (const [hz, gain, tau] of [[56, 1, 0.16], [84, 0.6, 0.11], [131, 0.3, 0.07]]) {
    const low = sweepSine(out.length, sr, (t) => hz * (0.85 + 0.15 * Math.exp(-t / 0.05)));
    decay(low, sr, tau, 0.003);
    mixInto(out, low, 0, gain);
  }
  const body = white(secs(sr, 0.3), rand);
  biquad(body, sr, 'lowpass', 380, 0.8);
  decay(body, sr, 0.045, 0.002);
  mixInto(out, body, 0, 1.6);
  mixInto(out, doorLatch(sr), secs(sr, 0.018), 0.22);
  return normalize(out, 0.95);
}

export function doorLocked(sr) {
  const out = new Float32Array(secs(sr, 0.55));
  const latch = doorLatch(sr);
  for (const [at, gain] of [[0, 1], [0.11, 0.8], [0.2, 0.9], [0.31, 0.6]]) mixInto(out, latch, secs(sr, at), gain);
  biquad(out, sr, 'lowpass', 2600, 0.7);
  return normalize(out, 0.8);
}

// ---------- Reloj de pie (ambiente del Hall) ----------

export function clockTick(sr, tock = false) {
  const rand = rng(tock ? 31 : 30);
  const out = new Float32Array(secs(sr, 0.12));
  const click = white(secs(sr, 0.04), rand);
  biquad(click, sr, 'bandpass', tock ? 1900 : 2500, 2.5);
  decay(click, sr, 0.004, 0.0003);
  mixInto(out, click, 0, 1);
  const wood = sweepSine(secs(sr, 0.1), sr, () => (tock ? 520 : 610));
  decay(wood, sr, 0.012, 0.0005);
  mixInto(out, wood, 0, 0.25);
  return normalize(out, 0.8);
}

// ---------- Interfaz ----------

/** Onda cuadrada suavizada (paso bajo) con frecuencia variable. */
function square(sr, seconds, freq, cutoff = 2800) {
  const n = secs(sr, seconds);
  const d = new Float32Array(n);
  let p = 0;
  for (let i = 0; i < n; i++) {
    d[i] = p % 1 < 0.5 ? 0.6 : -0.6;
    p += freq(i / sr) / sr;
  }
  return biquad(biquad(d, sr, 'lowpass', cutoff, 0.6), sr, 'lowpass', cutoff * 1.4, 0.6);
}

/** Campana FM sencilla. */
function bell(sr, seconds, hz, { ratio = 3.5, index = 2.2, tau = 0.4 } = {}) {
  const n = secs(sr, seconds);
  const d = new Float32Array(n);
  let pc = 0;
  let pm = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const mod = Math.sin(pm) * index * Math.exp(-t / (tau * 0.35));
    d[i] = Math.sin(pc + mod) * Math.exp(-t / tau) * Math.min(1, t / 0.002);
    pc += (2 * Math.PI * hz) / sr;
    pm += (2 * Math.PI * hz * ratio) / sr;
  }
  return d;
}

function whoosh(sr, seconds, from, to, rand) {
  const n = secs(sr, seconds);
  const d = white(n, rand);
  biquad(d, sr, 'bandpass', (t) => from * (to / from) ** Math.min(1, t / seconds), 1.4);
  for (let i = 0; i < n; i++) d[i] *= Math.sin((Math.PI * i) / n) ** 2;
  return d;
}

export function uiMove(sr) {
  const d = square(sr, 0.05, (t) => 1320 - t * 3000, 3200);
  return normalize(decay(d, sr, 0.013, 0.001), 0.6);
}

export function uiConfirm(sr) {
  const out = new Float32Array(secs(sr, 0.16));
  mixInto(out, decay(square(sr, 0.07, () => mtof(81)), sr, 0.03, 0.001), 0);
  mixInto(out, decay(square(sr, 0.1, () => mtof(88)), sr, 0.04, 0.001), secs(sr, 0.05));
  return normalize(out, 0.6);
}

export function uiBack(sr) {
  const out = new Float32Array(secs(sr, 0.16));
  mixInto(out, decay(square(sr, 0.07, () => mtof(83), 2200), sr, 0.03, 0.001), 0);
  mixInto(out, decay(square(sr, 0.1, () => mtof(76), 2200), sr, 0.04, 0.001), secs(sr, 0.05));
  return normalize(out, 0.5);
}

export function uiOpen(sr) {
  const rand = rng(21);
  const out = new Float32Array(secs(sr, 0.6));
  mixInto(out, whoosh(sr, 0.14, 700, 2600, rand), 0, 0.5);
  mixInto(out, bell(sr, 0.5, mtof(86), { tau: 0.16, index: 1.6 }), secs(sr, 0.05), 0.5);
  mixInto(out, bell(sr, 0.5, mtof(81), { tau: 0.14, index: 1.2 }), secs(sr, 0.05), 0.3);
  return normalize(out, 0.6);
}

export function uiClose(sr) {
  const rand = rng(22);
  const out = new Float32Array(secs(sr, 0.45));
  mixInto(out, whoosh(sr, 0.12, 2400, 600, rand), 0, 0.45);
  mixInto(out, bell(sr, 0.4, mtof(74), { tau: 0.11, index: 1.4 }), secs(sr, 0.02), 0.45);
  return normalize(out, 0.5);
}

/** Hoja de papel (pasar de pestaña o de ficha). */
export function uiPage(sr) {
  const rand = rng(23);
  const n = secs(sr, 0.16);
  const d = white(n, rand);
  biquad(d, sr, 'bandpass', (t) => 2600 + 1800 * Math.sin(t * 40), 0.8);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    d[i] *= Math.sin((Math.PI * i) / n) * (0.55 + 0.45 * Math.abs(Math.sin(t * 95)));
  }
  return normalize(d, 0.5);
}

/** Abrir un documento: papel que se desliza y un golpecito sobre la mesa. */
export function uiFile(sr) {
  const rand = rng(24);
  const out = new Float32Array(secs(sr, 0.35));
  const slide = white(secs(sr, 0.22), rand);
  biquad(slide, sr, 'bandpass', (t) => 1500 + t * 4000, 0.9);
  for (let i = 0; i < slide.length; i++) slide[i] *= Math.sin((Math.PI * i) / slide.length) ** 1.5;
  mixInto(out, slide, 0, 0.6);
  const tap = sweepSine(secs(sr, 0.1), sr, () => 210);
  mixInto(out, decay(tap, sr, 0.018, 0.001), secs(sr, 0.18), 0.6);
  return normalize(out, 0.55);
}

export function uiError(sr) {
  const n = secs(sr, 0.22);
  const a = square(sr, 0.22, () => 110, 900);
  const b = square(sr, 0.22, () => 116.5, 900);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = (a[i] + b[i]) * Math.min(1, i / (sr * 0.004)) * Math.min(1, (n - i) / (sr * 0.03));
  return normalize(d, 0.5);
}

/** "Pulsa Start": un acorde de campanas grave (Re–La–Re) con un soplo. */
export function uiStart(sr) {
  const rand = rng(25);
  const out = new Float32Array(secs(sr, 2.2));
  mixInto(out, whoosh(sr, 0.5, 300, 1800, rand), 0, 0.25);
  for (const [midi, gain, at] of [[50, 0.9, 0], [57, 0.6, 0.02], [62, 0.5, 0.04], [69, 0.25, 0.06]]) {
    mixInto(out, bell(sr, 2.1, mtof(midi), { tau: 0.7, index: 1.8, ratio: 2.01 }), secs(sr, at), gain);
  }
  return normalize(out, 0.75);
}

/** Catálogo: nombre → (sr) => Float32Array. */
export const SFX = {
  latch: doorLatch,
  creak: doorCreak,
  shut: doorShut,
  locked: doorLocked,
  tick: (sr) => clockTick(sr, false),
  tock: (sr) => clockTick(sr, true),
  woodCreak0: (sr) => woodCreak(sr, 0),
  woodCreak1: (sr) => woodCreak(sr, 1),
  woodCreak2: (sr) => woodCreak(sr, 2),
  move: uiMove,
  confirm: uiConfirm,
  back: uiBack,
  open: uiOpen,
  close: uiClose,
  page: uiPage,
  file: uiFile,
  error: uiError,
  start: uiStart,
};

export const FOOTSTEP_VARIANTS = 4;
for (const floor of Object.keys(FLOORS)) {
  for (let v = 0; v < FOOTSTEP_VARIANTS; v++) SFX[`step_${floor}_${v}`] = (sr) => footstep(sr, floor, v);
}
export const FLOOR_TYPES = Object.keys(FLOORS);
