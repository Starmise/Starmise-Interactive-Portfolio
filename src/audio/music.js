import { rng, mtof, pink, white, seamless, reverbIR, toBuffer } from './dsp.js';

/**
 * "Nocturno de la mansión" — música original del portafolio, compuesta en código.
 *
 * Es una pieza ambiental lenta en Re menor (56 pulsos/min, un acorde cada 8 pulsos):
 *   - colchón de cuerdas sintéticas (sierras desafinadas con paso bajo),
 *   - bajo que se desliza de un acorde al siguiente,
 *   - un tema de "caja de música" (campanas FM con un leve temblor de cinta) que suena una
 *     vuelta sí y otra no; en las demás, notas sueltas del acorde,
 *   - texturas lejanas en el modo tenso: viento, golpes metálicos, roces y algún retumbo.
 *
 * Dos estados de ánimo: 'tense' (la mansión) y 'calm' (la Sala de guardado: progresión en
 * Fa mayor, sin texturas). El cambio entra en el acorde siguiente, sin cortes.
 *
 * Se programa con antelación: `scheduleUntil(t)` agenda todo lo que empiece antes de `t`
 * (el motor lo llama cada ~200 ms). Funciona igual en un OfflineAudioContext, lo que permite
 * renderizar una muestra a archivo.
 */

const BPM = 56;
const BEAT = 60 / BPM;
const CHORD_BEATS = 8;
const CHORD = BEAT * CHORD_BEATS; // ≈ 8.57 s

// bass: nota MIDI del bajo · pad: voces del colchón · theme: [pulso, nota, duración en pulsos]
const PROGRESSIONS = {
  tense: [
    { name: 'Dm(add9)', bass: 38, pad: [53, 57, 62, 64], theme: [[0, 81, 2], [2, 77, 1], [3, 76, 1], [4, 74, 4]] },
    { name: 'Bbmaj7', bass: 34, pad: [53, 57, 62, 65], theme: [[2, 77, 1], [3, 81, 4]] },
    { name: 'Gm9', bass: 43, pad: [58, 62, 65, 69], theme: [[0, 82, 2], [2, 81, 2], [4, 77, 4]] },
    { name: 'A7sus4(b9)', bass: 45, pad: [55, 58, 62, 64], theme: [[0, 76, 2], [2, 74, 2], [4, 70, 4]] },
    { name: 'Dm', bass: 38, pad: [53, 57, 62, 69], theme: [[1, 69, 1], [2, 74, 2], [4, 77, 1], [5, 76, 3]] },
    { name: 'Ebmaj7#11', bass: 39, pad: [55, 58, 62, 69], theme: [[0, 75, 3], [3, 74, 1], [4, 81, 4]] },
    { name: 'Gm/Bb', bass: 34, pad: [55, 58, 62, 67], theme: [[2, 79, 1], [3, 77, 1], [4, 74, 4]] },
    { name: 'A7(b9)', bass: 33, pad: [55, 61, 64, 70], theme: [[0, 73, 2], [2, 76, 2], [4, 82, 3], [7, 81, 1]] },
  ],
  calm: [
    { name: 'Fmaj9', bass: 41, pad: [57, 60, 64, 67], theme: [[0, 81, 2], [2, 79, 2], [4, 76, 4]] },
    { name: 'Dm9', bass: 38, pad: [53, 57, 60, 64], theme: [[2, 77, 2], [4, 76, 1], [5, 72, 3]] },
    { name: 'Bbmaj9', bass: 34, pad: [57, 60, 62, 65], theme: [[0, 74, 2], [2, 77, 2], [4, 81, 4]] },
    { name: 'Csus2', bass: 36, pad: [55, 60, 62, 67], theme: [[2, 79, 2], [4, 74, 4]] },
    { name: 'F/A', bass: 45, pad: [53, 57, 60, 64], theme: [[0, 72, 2], [2, 76, 2], [4, 77, 4]] },
    { name: 'Gm9', bass: 43, pad: [58, 62, 65, 69], theme: [[0, 81, 3], [3, 77, 1], [4, 74, 4]] },
    { name: 'Bbmaj7', bass: 34, pad: [53, 57, 62, 65], theme: [[2, 77, 2], [4, 81, 2], [6, 79, 2]] },
    { name: 'Csus4', bass: 36, pad: [55, 60, 65, 67], theme: [[0, 77, 4], [4, 72, 4]] },
  ],
};

const MOODS = {
  //     colchón: nivel y corte · bajo · campanas · texturas · probabilidad de eventos por acorde
  tense: { pad: 0.022, cutoff: 820, bass: 0.05, bell: 0.12, texture: 1, metal: 0.4, boom: 0.14 },
  calm: { pad: 0.02, cutoff: 1050, bass: 0.035, bell: 0.09, texture: 0, metal: 0, boom: 0 },
};

export class Score {
  /**
   * @param {BaseAudioContext} ctx
   * @param {AudioNode} output  destino (el bus de música del motor, o ctx.destination)
   */
  constructor(ctx, output, { seed = 1 } = {}) {
    this.ctx = ctx;
    this.rand = rng(seed);
    this.mood = 'tense';
    this.pendingMood = null;
    this.running = false;
    this.index = 0; // acorde dentro de la progresión
    this.cycle = 0; // vueltas completas a la progresión
    this.nextTime = 0;
    this.voices = new Set(); // fuentes agendadas, para poder pararlas

    const sr = ctx.sampleRate;
    this.out = ctx.createGain();
    this.out.connect(output);

    // Reverberación larga y oscura, compartida.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = toBuffer(ctx, reverbIR(sr, 4.2, { seed: 3, damping: 0.75, predelay: 0.03 }));
    this.reverbIn = ctx.createGain();
    this.reverbIn.connect(this.reverb).connect(this.out);

    this.padBus = this.#bus(1, 0.45);
    this.bellBus = this.#bus(0.55, 1.0);
    this.bassBus = this.#bus(1, 0.15);
    this.texBus = this.#bus(0.25, 1.0);

    // LFO compartido que abre y cierra el colchón muy despacio.
    this.padLfo = ctx.createOscillator();
    this.padLfo.frequency.value = 1 / 13;
    this.padLfoGain = ctx.createGain();
    this.padLfoGain.gain.value = 260;
    this.padLfo.connect(this.padLfoGain);

    // Temblor de cinta para las campanas (en cents).
    this.wow = ctx.createOscillator();
    this.wow.frequency.value = 0.37;
    this.wowGain = ctx.createGain();
    this.wowGain.gain.value = 9;
    this.wow.connect(this.wowGain);

    this.noise = toBuffer(ctx, seamless(pink(Math.round(sr * 6.5), rng(seed + 9)), Math.round(sr * 0.5)));
    this.white = toBuffer(ctx, white(Math.round(sr * 3.2), rng(seed + 10)));
  }

  #bus(dry, send) {
    const g = this.ctx.createGain();
    const d = this.ctx.createGain();
    d.gain.value = dry;
    const s = this.ctx.createGain();
    s.gain.value = send;
    g.connect(d).connect(this.out);
    g.connect(s).connect(this.reverbIn);
    return g;
  }

  get params() {
    return MOODS[this.mood];
  }

  start(when = this.ctx.currentTime + 0.05) {
    if (this.running) return;
    this.running = true;
    this.nextTime = when;
    this.index = 0;
    this.cycle = 0;
    this.#startContinuous(when);
  }

  /** Para la música (con un fundido corto) y cancela lo agendado. */
  stop(when = this.ctx.currentTime, fade = 0.6) {
    if (!this.running) return;
    this.running = false;
    for (const v of this.voices) {
      try {
        v.stop(when + fade);
      } catch {
        /* ya parada */
      }
    }
    this.voices.clear();
    this.cont?.forEach((n) => {
      try {
        n.stop(when + fade);
      } catch {
        /* ya parada */
      }
    });
    this.cont = null;
  }

  setMood(mood) {
    if (!MOODS[mood] || mood === (this.pendingMood ?? this.mood)) return;
    this.pendingMood = mood;
    // Las texturas continuas se ajustan ya; la armonía, en el acorde siguiente.
    const t = this.ctx.currentTime;
    this.windGain?.gain.setTargetAtTime(MOODS[mood].texture * 0.05, t, 2.5);
  }

  /** Agenda todos los acordes que empiecen antes de `until` (segundos del contexto). */
  scheduleUntil(until) {
    while (this.running && this.nextTime < until) {
      if (this.pendingMood) {
        this.mood = this.pendingMood;
        this.pendingMood = null;
      }
      this.#chord(this.nextTime);
      this.nextTime += CHORD;
      this.index++;
      if (this.index >= PROGRESSIONS[this.mood].length) {
        this.index = 0;
        this.cycle++;
      }
    }
  }

  // ---------- Capas continuas (bajo, viento, LFOs) ----------

  #startContinuous(when) {
    const ctx = this.ctx;
    const nodes = [];
    try {
      this.padLfo.start(when);
      this.wow.start(when);
    } catch {
      /* los LFO ya estaban en marcha (reinicio) */
    }

    // Bajo: triángulo + seno una octava arriba (para que se oiga en altavoces pequeños),
    // con paso bajo. Se desliza entre acordes.
    this.bassFilter = ctx.createBiquadFilter();
    this.bassFilter.type = 'lowpass';
    this.bassFilter.frequency.value = 420;
    this.bassGain = ctx.createGain();
    this.bassGain.gain.setValueAtTime(0, when);
    this.bassFilter.connect(this.bassGain).connect(this.bassBus);
    this.bassOsc = [];
    for (const [type, mult, gain] of [['triangle', 1, 1], ['sine', 2, 0.3]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = mtof(PROGRESSIONS[this.mood][0].bass) * mult;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(this.bassFilter);
      o.start(when);
      o.mult = mult;
      this.bassOsc.push(o);
      nodes.push(o);
    }

    // Viento: ruido rosa por un pasabanda que se mueve.
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 1.1;
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 1 / 17;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 280;
    windLfo.connect(windLfoGain).connect(bp.frequency);
    this.windGain = ctx.createGain();
    this.windGain.gain.setValueAtTime(0, when);
    this.windGain.gain.setTargetAtTime(this.params.texture * 0.05, when, 4);
    wind.connect(bp).connect(this.windGain).connect(this.texBus);
    wind.start(when);
    windLfo.start(when);
    nodes.push(wind, windLfo);
    this.cont = nodes;
  }

  // ---------- Un acorde y todo lo que pasa sobre él ----------

  #chord(time) {
    const p = this.params;
    const prog = PROGRESSIONS[this.mood];
    const chord = prog[this.index % prog.length];
    const r = this.rand;

    this.#pad(time, chord.pad, p);

    // Bajo: desliza al nuevo tono y respira con el acorde.
    for (const o of this.bassOsc ?? []) o.frequency.setTargetAtTime(mtof(chord.bass) * o.mult, time, 0.45);
    this.bassGain?.gain.setTargetAtTime(p.bass, time, 1.2);
    this.bassGain?.gain.setTargetAtTime(p.bass * 0.7, time + CHORD * 0.7, 1.5);

    // Melodía: el tema en las vueltas impares; si no, notas sueltas del acorde.
    const intro = this.cycle === 0 && this.mood === 'tense' && this.index < 2;
    if (!intro) {
      if (this.cycle % 2 === 1) {
        for (const [beat, midi, dur] of chord.theme) {
          const swing = (r() - 0.5) * 0.06; // nada mecánico
          this.#bell(time + beat * BEAT + swing, midi, p.bell * (0.85 + r() * 0.3), dur * BEAT);
        }
        // A veces, un eco una octava abajo en la última nota.
        if (r() < 0.35) {
          const [beat, midi] = chord.theme[chord.theme.length - 1];
          this.#bell(time + (beat + 1.5) * BEAT, midi - 12, p.bell * 0.5, 3 * BEAT);
        }
      } else {
        const tones = [...chord.pad.map((n) => n + 24), chord.pad[chord.pad.length - 1] + 12].filter((n) => n >= 67 && n <= 88);
        const count = r() < 0.25 ? 0 : r() < 0.7 ? 1 : 2;
        for (let i = 0; i < count; i++) {
          const beat = Math.floor(r() * 6) + (i ? 1 : 0);
          this.#bell(time + beat * BEAT, tones[Math.floor(r() * tones.length)], p.bell * 0.7, 3 * BEAT);
        }
      }
    }

    // Texturas lejanas.
    if (r() < p.metal) {
      const at = time + r() * (CHORD - 2);
      if (r() < 0.55) this.#clang(at, r);
      else this.#scrape(at, r);
    }
    if (r() < p.boom) this.#boom(time + r() * (CHORD - 3), r);
  }

  /** Registra una fuente agendada; `cleanup` se llama cuando termina (soltar conexiones). */
  #track(node, end, cleanup) {
    this.voices.add(node);
    node.onended = () => {
      this.voices.delete(node);
      cleanup?.();
    };
    node.stop(end);
  }

  #pad(time, notes, p) {
    const ctx = this.ctx;
    const attack = 2.6;
    const release = 3.6;
    const end = time + CHORD + release;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = p.cutoff;
    filter.Q.value = 0.6;
    this.padLfoGain.connect(filter.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(p.pad, time + attack);
    env.gain.setValueAtTime(p.pad, time + CHORD - 0.3);
    env.gain.linearRampToValueAtTime(0, end);
    filter.connect(env).connect(this.padBus);
    let first = true;
    for (const midi of notes) {
      for (const cents of [-7, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(midi);
        o.detune.value = cents + (this.rand() - 0.5) * 4;
        o.connect(filter);
        o.start(time);
        // Al terminar el acorde, soltar el LFO (si no, el filtro seguiría vivo y procesando).
        this.#track(o, end + 0.05, first ? () => disconnect(this.padLfoGain, filter.frequency) : null);
        first = false;
      }
    }
  }

  #bell(time, midi, level, hold) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const tau = Math.max(1.2, Math.min(2.6, hold * 0.8));
    const end = time + tau * 4.5;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(level, time + 0.004);
    env.gain.setTargetAtTime(0, time + 0.004, tau);
    env.connect(this.bellBus);

    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 3.5;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(f * 4, time); // índice ≈ 1.1 al golpe, casi seno al final
    modGain.gain.setTargetAtTime(f * 0.15, time, 0.3);
    mod.connect(modGain).connect(car.frequency);
    this.wowGain.connect(car.detune);
    car.connect(env);

    // Segundo parcial (octava, algo desafinado) para el brillo de caja de música.
    const oct = ctx.createOscillator();
    oct.frequency.value = f * 2;
    oct.detune.value = 4;
    const octGain = ctx.createGain();
    octGain.gain.setValueAtTime(0.18, time);
    octGain.gain.setTargetAtTime(0, time, tau * 0.35);
    oct.connect(octGain).connect(env);

    for (const o of [car, mod, oct]) {
      o.start(time);
      this.#track(o, end, o === car ? () => disconnect(this.wowGain, car.detune) : null);
    }
  }

  /** Golpe metálico lejano: parciales inarmónicos de una barra. */
  #clang(time, r) {
    const ctx = this.ctx;
    const base = 88 + r() * 60;
    const out = ctx.createGain();
    out.gain.value = 0.035 * this.params.texture;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    lp.connect(out).connect(this.texBus);
    for (const [ratio, amp, tau] of [[1, 1, 1.6], [2.76, 0.55, 1.0], [5.4, 0.3, 0.6], [8.93, 0.18, 0.35]]) {
      const o = ctx.createOscillator();
      o.frequency.value = base * ratio * (0.995 + r() * 0.01);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(amp, time + 0.003);
      g.gain.setTargetAtTime(0, time + 0.003, tau);
      o.connect(g).connect(lp);
      o.start(time);
      this.#track(o, time + tau * 6);
    }
  }

  /** Roce metálico: ruido por un pasabanda estrecho que baja. */
  #scrape(time, r) {
    const ctx = this.ctx;
    const dur = 2.4 + r() * 1.6;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 9;
    const from = 1800 + r() * 900;
    bp.frequency.setValueAtTime(from, time);
    bp.frequency.exponentialRampToValueAtTime(from * 0.3, time + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.05 * this.params.texture, time + dur * 0.4);
    g.gain.linearRampToValueAtTime(0, time + dur);
    src.connect(bp).connect(g).connect(this.texBus);
    src.start(time, r() * 2);
    this.#track(src, time + dur + 0.05);
  }

  /** Retumbo grave y lejano. */
  #boom(time, r) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const f = 66 + r() * 10;
    o.frequency.setValueAtTime(f, time);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, time + 2.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.12 * this.params.texture, time + 0.02);
    g.gain.setTargetAtTime(0, time + 0.02, 0.9);
    o.connect(g).connect(this.texBus);
    o.start(time);
    this.#track(o, time + 5);
  }
}

function disconnect(from, to) {
  try {
    from.disconnect(to);
  } catch {
    /* ya desconectado */
  }
}

export const MUSIC_INFO = { title: 'Nocturno de la mansión', bpm: BPM, chordSeconds: CHORD, moods: Object.keys(MOODS) };
