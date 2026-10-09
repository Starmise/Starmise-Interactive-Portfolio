/**
 * Mide los FPS reales mientras se juega y avisa (una sola vez) si el equipo no da la talla:
 * tras un calentamiento, dos ventanas seguidas por debajo del umbral → `onSlow(fps)`.
 *
 * Solo cuenta con el jugador en control (sin menús ni transiciones) y descarta los frames
 * de más de 1 s (pestaña oculta, carga de una sala), para no confundir un tirón con un
 * equipo lento. `fps` es la media de la última ventana (también para el modo depuración).
 */
export class PerfMonitor {
  constructor({ windowSeconds = 4, threshold = 24, warmup = 2, onSlow = null } = {}) {
    Object.assign(this, { windowSeconds, threshold, warmup, onSlow });
    this.fps = 0;
    this.fired = false;
    this.slowWindows = 0;
    this.#resetWindow();
  }

  /** dt: segundos reales desde el frame anterior (sin recortar). */
  sample(dt, active) {
    if (!active) {
      this.#resetWindow();
      return;
    }
    if (!(dt > 0) || dt > 1) return;
    this.warm += dt;
    if (this.warm < this.warmup) return;
    this.frames++;
    this.time += dt;
    if (this.time < this.windowSeconds) return;

    this.fps = this.frames / this.time;
    this.slowWindows = this.fps < this.threshold ? this.slowWindows + 1 : 0;
    this.frames = 0;
    this.time = 0;
    if (this.slowWindows >= 2 && !this.fired) {
      this.fired = true;
      this.onSlow?.(this.fps);
    }
  }

  #resetWindow() {
    this.warm = 0;
    this.frames = 0;
    this.time = 0;
  }
}
