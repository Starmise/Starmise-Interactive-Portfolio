import { focusFirst } from './uiStack.js';
import { settings, setSetting, onSettingsChange } from '../core/settings.js';

/**
 * Pantalla de carga + título. Mientras cargan los modelos muestra una barra de progreso;
 * cuando termina, "Pulsa Start" y luego el menú: Empezar, Modo lista, Controles, Versión
 * clásica. La sala de inicio se ve detrás, oscurecida. El modo lista se puede abrir ya
 * durante la carga. `setHint()` muestra un aviso bajo el menú (p. ej. equipo lento).
 *
 * El audio arranca con el primer gesto (normalmente "Pulsa Enter", que suena a campana).
 * El menú tiene un interruptor de sonido para quien prefiera navegar en silencio.
 */
export class TitleScreen {
  constructor(root, stack, { profile, onStart, onList }) {
    this.stack = stack;
    this.onStart = onStart;
    this.onList = onList;
    this.ready = false;
    this.stage = 'loading'; // 'loading' | 'press' | 'menu' | 'controls'

    this.el = document.createElement('div');
    this.el.className = 'title';
    this.el.innerHTML = `
      <div class="title__inner" tabindex="-1">
        <h1 class="title__logo">${escapeHtml(profile.alias)}</h1>
        <p class="title__sub">${escapeHtml(profile.name)} · ${escapeHtml(profile.title)}</p>

        <div class="title__loading" data-stage="loading">
          <div class="title__bar" role="progressbar" aria-label="Cargando" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
          <p class="title__loading-text">Cargando…</p>
          <button type="button" class="title__skip" data-act="list">¿Con prisa? Ver en modo lista</button>
        </div>

        <button type="button" class="title__press" data-stage="press" data-start data-sfx="start">Pulsa <kbd>Enter</kbd></button>

        <nav class="title__menu" data-stage="menu" aria-label="Menú principal">
          <button type="button" data-act="start">Empezar</button>
          <button type="button" data-act="list">Modo lista <small>(sin 3D)</small></button>
          <button type="button" data-act="controls">Controles</button>
          <button type="button" data-act="sound" data-sound></button>
          <a href="${escapeHtml(profile.classicSite)}" target="_blank" rel="noopener">Versión clásica ↗</a>
        </nav>

        <div class="title__controls" data-stage="controls">
          <dl>
            <dt>Mover</dt><dd>WASD / flechas · stick izquierdo</dd>
            <dt>Correr</dt><dd>Shift · X / □</dd>
            <dt>Examinar, abrir puertas</dt><dd>E / Enter · A / ✕</dd>
            <dt>Menú (inventario, mapa, opciones)</dt><dd>Esc · Start</dd>
            <dt>Pantalla táctil</dt><dd>Joystick a la izquierda (al borde, corre) · botón de acción · ☰ menú</dd>
          </dl>
          <p>Los controles clásicos tipo tanque se activan en <em>Opciones</em>.</p>
          <button type="button" data-act="back">Volver</button>
        </div>

        <p class="title__hint" role="status" hidden></p>
      </div>
      <p class="title__legal">Proyecto original inspirado en los survival horror de los 90.</p>
    `;
    root.appendChild(this.el);
    this.inner = this.el.querySelector('.title__inner');
    this.bar = this.el.querySelector('.title__bar');
    this.startLabel = this.el.querySelector('[data-start]');
    this.hint = this.el.querySelector('.title__hint');
    this.soundBtn = this.el.querySelector('[data-sound]');
    this.#paintSound();
    onSettingsChange((key) => key === 'sound' && this.#paintSound());

    this.el.querySelector('.title__press').addEventListener('click', () => this.#setStage('menu'));
    this.el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'start') this.#start();
      else if (act === 'list') this.onList?.();
      else if (act === 'controls') this.#setStage('controls');
      else if (act === 'sound') setSetting('sound', !settings.sound);
      else if (act === 'back') this.#setStage('menu');
    });

    this.layer = {
      el: this.inner,
      closable: false,
      onAction: (action) => {
        if (this.stage === 'press' && ['confirm', 'pause'].includes(action)) {
          this.el.querySelector('.title__press').click(); // mismo camino (y sonido) que con teclado
          return true;
        }
        if (this.stage === 'controls' && action === 'back') {
          this.#setStage('menu');
          return true;
        }
        return false;
      },
      onHide: () => this.el.classList.add('is-hidden'),
      onShow: () => this.el.classList.remove('is-hidden'),
      sounds: { open: null, close: null },
    };
    stack.push(this.layer);
    this.#setStage('loading');
  }

  setProgress(fraction) {
    const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    this.bar.style.setProperty('--p', `${pct}%`);
    this.bar.setAttribute('aria-valuenow', pct);
  }

  setReady() {
    this.ready = true;
    this.setProgress(1);
    this.#setStage('press');
  }

  setError(message) {
    this.el.querySelector('.title__loading-text').textContent = message;
  }

  setDevice(device) {
    if (device === 'touch') this.startLabel.textContent = 'Toca para empezar';
    else this.startLabel.innerHTML = `Pulsa <kbd>${device === 'gamepad' ? 'Start' : 'Enter'}</kbd>`;
  }

  /** Aviso bajo el menú (vacío = ocultarlo). */
  setHint(text) {
    this.hint.textContent = text;
    this.hint.hidden = !text;
  }

  /** Volver al título desde el juego. */
  show() {
    this.stack.clear();
    this.stack.push(this.layer);
    this.#setStage('menu');
  }

  #start() {
    this.stack.pop(this.layer);
    this.onStart?.();
  }

  #paintSound() {
    this.soundBtn.textContent = `Sonido: ${settings.sound ? 'Sí' : 'No'}`;
  }

  #setStage(stage) {
    this.stage = stage;
    for (const node of this.el.querySelectorAll('[data-stage]')) node.hidden = node.dataset.stage !== stage;
    if (stage === 'press') this.el.querySelector('.title__press').focus({ preventScroll: true });
    else if (stage === 'menu') focusFirst(this.el.querySelector('.title__menu'));
    else if (stage === 'controls') focusFirst(this.el.querySelector('.title__controls'));
    else this.inner.focus({ preventScroll: true });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
