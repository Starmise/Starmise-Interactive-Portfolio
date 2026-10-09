/**
 * Teclado: estado de teclas mantenidas + eventos de "acción" (pulsación única).
 * El mando (Gamepad API) llega en la Fase 3 y se mezclará aquí mismo.
 */
const BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE', 'Enter', 'Space'],
  back: ['Escape', 'Backspace'],
  toggleControls: ['KeyC'],
  togglePs1: ['KeyP'],
  toggleDebug: ['Backquote', 'F3'],
};

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set(); // acciones pulsadas este frame
    this.enabled = true;

    target.addEventListener('keydown', (e) => {
      // Desactivado (p. ej. con una ficha abierta): la UI maneja sus propias teclas.
      if (!this.enabled || isTyping(e)) return;
      const actions = actionsFor(e.code);
      if (!actions.length) return;
      // Evitar que flechas/espacio desplacen la página; dejar Tab y Enter para la UI.
      if (!['Enter', 'Escape'].includes(e.code)) e.preventDefault();
      if (!e.repeat) actions.forEach((a) => this.pressed.add(a));
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  setEnabled(on) {
    this.enabled = on;
    this.down.clear();
    this.pressed.clear();
  }

  held(action) {
    return this.enabled && BINDINGS[action].some((code) => this.down.has(code));
  }

  /** true una sola vez por pulsación (se consume). */
  consume(action) {
    const had = this.pressed.has(action);
    this.pressed.delete(action);
    return had;
  }

  /** Ejes de movimiento: x = derecha, y = adelante, en [-1, 1]. */
  axes() {
    const x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const y = (this.held('up') ? 1 : 0) - (this.held('down') ? 1 : 0);
    return { x, y };
  }

  /** Llamar al final de cada frame. */
  endFrame() {
    this.pressed.clear();
  }
}

function actionsFor(code) {
  return Object.keys(BINDINGS).filter((a) => BINDINGS[a].includes(code));
}

function isTyping(e) {
  const el = e.target;
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}
