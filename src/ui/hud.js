/**
 * HUD mínimo del prototipo: prompt de "Examinar", ayuda de controles y estado.
 * (El menú de pausa y las opciones de verdad llegan en la Fase 3.)
 */
export class Hud {
  constructor() {
    this.prompt = document.getElementById('prompt');
    this.promptLabel = this.prompt.querySelector('[data-label]');
    this.help = document.getElementById('help');
    this.status = document.getElementById('status');
    this.toast = document.getElementById('toast');
    this.toastTimer = 0;
    this.promptTarget = null;
  }

  setPrompt(target) {
    if (target === this.promptTarget) return;
    this.promptTarget = target;
    this.prompt.hidden = !target;
    if (target) this.promptLabel.textContent = target.project?.title ?? target.id;
  }

  setHelp({ mode, ps1 }) {
    this.help.innerHTML = `
      <span><kbd>WASD</kbd>/<kbd>↑↓←→</kbd> mover</span>
      <span><kbd>Shift</kbd> correr</span>
      <span><kbd>E</kbd> examinar</span>
      <span><kbd>C</kbd> controles: ${mode}</span>
      <span><kbd>P</kbd> efectos PS1: ${ps1 ? 'sí' : 'no'}</span>
    `;
  }

  setStatus(text) {
    this.status.textContent = text;
    this.status.hidden = !text;
  }

  flash(text) {
    this.toast.textContent = text;
    this.toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast.hidden = true), 1600);
  }
}
