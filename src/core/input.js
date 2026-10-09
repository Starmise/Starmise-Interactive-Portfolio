/**
 * Entrada unificada: teclado + mando (Gamepad API, mapeo "standard").
 *
 * - Juego: `axes()` (analógico, x = derecha, y = adelante), `held(acción)` y
 *   `consume(acción)` para pulsaciones únicas.
 * - Menús: mientras la UI está abierta, `enabled = false` y el teclado lo gestiona el DOM;
 *   el mando sigue generando acciones de UI que se leen con `consumeUi()`.
 *
 * Mando (Xbox / PlayStation):
 *   stick izq. / cruceta  mover            A / ✕    examinar, aceptar
 *   X / □, RB, RT         correr           B / ○    volver
 *   Start / Options       menú de pausa    Select / Share  mapa
 *   LB / RB               cambiar pestaña en el menú
 */
const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE', 'Enter', 'Space'],
  pause: ['Escape', 'Tab'],
  map: ['KeyM'],
  inventory: ['KeyI'],
  toggleDebug: ['Backquote', 'F3'],
};

// Índices del mapeo "standard" de la Gamepad API.
const PAD = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
const DEADZONE = 0.22;

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set(); // acciones de juego pulsadas este frame
    this.uiPressed = new Set(); // acciones de menú generadas por el mando
    this.enabled = true;
    this.lastDevice = 'keyboard'; // 'keyboard' | 'gamepad'
    this.onDeviceChange = null;

    this.pad = { axes: { x: 0, y: 0 }, buttons: [], prevButtons: [], stickDir: null, repeatAt: 0 };

    target.addEventListener('keydown', (e) => {
      this.#setDevice('keyboard');
      // Desactivado (menús abiertos): el DOM maneja sus propias teclas.
      if (!this.enabled || isTyping(e)) return;
      const actions = actionsFor(e.code);
      if (!actions.length) return;
      e.preventDefault();
      if (!e.repeat) actions.forEach((a) => this.pressed.add(a));
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    window.addEventListener('gamepadconnected', () => this.#setDevice('gamepad'));
  }

  setEnabled(on) {
    this.enabled = on;
    this.down.clear();
    this.pressed.clear();
  }

  /** Leer el mando. Llamar una vez al inicio de cada frame. */
  poll(now = performance.now()) {
    const gp = [...(navigator.getGamepads?.() ?? [])].find((g) => g && g.connected && g.mapping === 'standard')
      ?? [...(navigator.getGamepads?.() ?? [])].find((g) => g && g.connected);
    const p = this.pad;
    p.prevButtons = p.buttons;
    if (!gp) {
      p.buttons = [];
      p.axes.x = p.axes.y = 0;
      return;
    }
    p.buttons = gp.buttons.map((b) => b.pressed || b.value > 0.5);
    let x = gp.axes[0] ?? 0;
    let y = -(gp.axes[1] ?? 0);
    const mag = Math.hypot(x, y);
    if (mag < DEADZONE) x = y = 0;
    else {
      const k = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE)) / mag;
      x *= k;
      y *= k;
    }
    // La cruceta también mueve.
    if (p.buttons[PAD.left] || p.buttons[PAD.right] || p.buttons[PAD.up] || p.buttons[PAD.down]) {
      x = (p.buttons[PAD.right] ? 1 : 0) - (p.buttons[PAD.left] ? 1 : 0);
      y = (p.buttons[PAD.up] ? 1 : 0) - (p.buttons[PAD.down] ? 1 : 0);
    }
    p.axes.x = x;
    p.axes.y = y;

    const edge = (i) => p.buttons[i] && !p.prevButtons[i];
    if (p.buttons.some((b, i) => b && !p.prevButtons[i]) || x || y) this.#setDevice('gamepad');

    // Acciones de juego.
    if (this.enabled) {
      if (edge(PAD.a)) this.pressed.add('interact');
      if (edge(PAD.start)) this.pressed.add('pause');
      if (edge(PAD.select)) this.pressed.add('map');
      if (edge(PAD.x) || edge(PAD.rb) || edge(PAD.rt)) this.pressed.add('run');
      if (edge(PAD.down)) this.pressed.add('down');
    }

    // Acciones de menú (dirección con repetición al mantener).
    if (edge(PAD.a)) this.uiPressed.add('confirm');
    if (edge(PAD.b)) this.uiPressed.add('back');
    if (edge(PAD.start)) this.uiPressed.add('pause');
    if (edge(PAD.lb)) this.uiPressed.add('tabPrev');
    if (edge(PAD.rb)) this.uiPressed.add('tabNext');
    const dir = Math.abs(x) > 0.6 || Math.abs(y) > 0.6
      ? (Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'up' : 'down'))
      : null;
    if (dir && (dir !== p.stickDir || now >= p.repeatAt)) {
      this.uiPressed.add(dir);
      p.repeatAt = now + (dir === p.stickDir ? 110 : 380);
    }
    p.stickDir = dir;
  }

  held(action) {
    if (!this.enabled) return false;
    if (KEYS[action]?.some((code) => this.down.has(code))) return true;
    const b = this.pad.buttons;
    if (action === 'run') return !!(b[PAD.x] || b[PAD.rb] || b[PAD.rt]);
    return false;
  }

  /** true una sola vez por pulsación (se consume). */
  consume(action) {
    const had = this.pressed.has(action);
    this.pressed.delete(action);
    return had;
  }

  /** Para saltar animaciones: cualquier pulsación de aceptar o menú. */
  consumeAny() {
    const a = this.consume('interact');
    const b = this.consume('pause');
    return a || b;
  }

  /** Acciones de menú pendientes (del mando). Se vacían al leerlas. */
  consumeUi() {
    const list = [...this.uiPressed];
    this.uiPressed.clear();
    return list;
  }

  /** Ejes de movimiento: x = derecha, y = adelante, en [-1, 1] (analógicos con mando). */
  axes() {
    if (!this.enabled) return { x: 0, y: 0 };
    const kx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const ky = (this.held('up') ? 1 : 0) - (this.held('down') ? 1 : 0);
    if (kx || ky) return { x: kx, y: ky };
    return { x: this.pad.axes.x, y: this.pad.axes.y };
  }

  /** Llamar al final de cada frame. */
  endFrame() {
    this.pressed.clear();
  }

  #setDevice(device) {
    if (device === this.lastDevice) return;
    this.lastDevice = device;
    this.onDeviceChange?.(device);
  }
}

function actionsFor(code) {
  return Object.keys(KEYS).filter((a) => KEYS[a].includes(code));
}

function isTyping(e) {
  const el = e.target;
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}
