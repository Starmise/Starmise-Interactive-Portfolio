/**
 * Síntesis "a mano" para generar AudioBuffers una sola vez (efectos, ruido, reverberación).
 * Todo el audio del portafolio es original: se calcula aquí o con nodos de Web Audio, sin
 * archivos de sonido. Los generadores son deterministas (semilla) para que cada efecto
 * suene igual en cada visita.
 */

/** PRNG mulberry32: devuelve una función () => [0, 1). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mtof = (midi) => 440 * 2 ** ((midi - 69) / 12);

/**
 * Filtro biquad (fórmulas de R. Bristow-Johnson) aplicado en el sitio a un Float32Array.
 * `freq` puede ser un número o una función (t en segundos) → Hz, para barridos.
 */
export function biquad(data, sr, type, freq, q = 0.707, gainDb = 0) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0, b1, b2, a1, a2;
  const sweep = typeof freq === 'function';
  const coeffs = (f) => {
    const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const A = 10 ** (gainDb / 40);
    let n0, n1, n2, d0, d1, d2;
    switch (type) {
      case 'lowpass':
        n0 = (1 - cos) / 2; n1 = 1 - cos; n2 = n0; d0 = 1 + alpha; d1 = -2 * cos; d2 = 1 - alpha;
        break;
      case 'highpass':
        n0 = (1 + cos) / 2; n1 = -(1 + cos); n2 = n0; d0 = 1 + alpha; d1 = -2 * cos; d2 = 1 - alpha;
        break;
      case 'bandpass': // ganancia 1 en el pico
        n0 = alpha; n1 = 0; n2 = -alpha; d0 = 1 + alpha; d1 = -2 * cos; d2 = 1 - alpha;
        break;
      case 'peak':
        n0 = 1 + alpha * A; n1 = -2 * cos; n2 = 1 - alpha * A; d0 = 1 + alpha / A; d1 = -2 * cos; d2 = 1 - alpha / A;
        break;
      default:
        throw new Error(`biquad: tipo desconocido ${type}`);
    }
    b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = d1 / d0; a2 = d2 / d0;
  };
  coeffs(sweep ? freq(0) : freq);
  for (let i = 0; i < data.length; i++) {
    if (sweep && (i & 31) === 0) coeffs(freq(i / sr));
    const x = data[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    data[i] = y;
  }
  return data;
}

/** Ruido blanco. */
export function white(n, rand) {
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = rand() * 2 - 1;
  return d;
}

/** Ruido rosa (filtro de Paul Kellet), normalizado a ~±1. */
export function pink(n, rand) {
  const d = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return d;
}

/** Ruido marrón (integrado con fuga), normalizado a ~±1. */
export function brown(n, rand) {
  const d = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * (rand() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return d;
}

/** Hace que un bucle no tenga costura: funde la cola extra sobre el principio. */
export function seamless(data, fade) {
  const n = data.length - fade;
  const out = data.slice(0, n);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    out[i] = data[n + i] * (1 - k) + data[i] * k;
  }
  return out;
}

export function normalize(data, peak = 0.9) {
  let max = 0;
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
  if (max > 0) {
    const k = peak / max;
    for (let i = 0; i < data.length; i++) data[i] *= k;
  }
  return data;
}

/** Suma `src` (escalado) en `dst` a partir de la muestra `at`. */
export function mixInto(dst, src, at = 0, gain = 1) {
  const n = Math.min(src.length, dst.length - at);
  for (let i = 0; i < n; i++) dst[at + i] += src[i] * gain;
  return dst;
}

/** Envolvente exponencial: ataque lineal y caída con constante `tau` (s). */
export function decay(data, sr, tau, attack = 0.001, at = 0) {
  const a = Math.max(1, Math.round(attack * sr));
  for (let i = 0; i < data.length; i++) {
    const t = (i - at) / sr;
    if (i < at) data[i] = 0;
    else if (i - at < a) data[i] *= (i - at) / a;
    else data[i] *= Math.exp(-(t - attack) / tau);
  }
  return data;
}

/**
 * Seno con frecuencia variable: `freq(t)` en Hz. Devuelve un Float32Array de `n` muestras.
 */
export function sweepSine(n, sr, freq, phase = 0) {
  const d = new Float32Array(n);
  let p = phase;
  for (let i = 0; i < n; i++) {
    d[i] = Math.sin(p);
    p += (2 * Math.PI * freq(i / sr)) / sr;
  }
  return d;
}

/**
 * Respuesta al impulso de una sala (estéreo): ruido que decae y se oscurece con el tiempo,
 * con unos pocos ecos tempranos. `seconds` ≈ tiempo hasta -60 dB.
 */
export function reverbIR(sr, seconds, { seed = 7, predelay = 0.012, damping = 0.5, early = 6 } = {}) {
  const n = Math.round(sr * seconds);
  const pre = Math.round(sr * predelay);
  const channels = [];
  for (let c = 0; c < 2; c++) {
    const rand = rng(seed + c * 101);
    const d = new Float32Array(n);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const env = Math.exp((-6.9 * t) / seconds);
      // Más oscuro cuanto más tarde: un paso bajo de un polo que se cierra.
      const k = 0.85 - damping * 0.75 * Math.min(1, t / seconds);
      lp += k * ((rand() * 2 - 1) - lp);
      d[i] = lp * env;
    }
    // Ecos tempranos (paredes cercanas).
    for (let e = 0; e < early; e++) {
      const at = pre + Math.round(sr * (0.006 + rand() * 0.06));
      if (at < n) d[at] += (rand() > 0.5 ? 1 : -1) * (0.5 - e * 0.05);
    }
    // Entrada suave para que no haga "clic".
    for (let i = 0; i < Math.min(n, pre + 64); i++) d[i] *= Math.min(1, Math.max(0, i - pre) / 64);
    channels.push(normalize(d, 0.5));
  }
  return channels;
}

/** Crea un AudioBuffer a partir de canales Float32Array. */
export function toBuffer(ctx, channels) {
  const list = Array.isArray(channels) ? channels : [channels];
  const buf = ctx.createBuffer(list.length, list[0].length, ctx.sampleRate);
  list.forEach((d, c) => buf.copyToChannel ? buf.copyToChannel(d, c) : buf.getChannelData(c).set(d));
  return buf;
}
