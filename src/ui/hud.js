/**
 * HUD: prompt de interacción, ayuda de controles (teclado o mando) y avisos breves.
 */
export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.prompt = document.getElementById('prompt');
    this.promptVerb = this.prompt.querySelector('[data-verb]');
    this.promptKey = this.prompt.querySelector('[data-key]');
    this.promptLabel = this.prompt.querySelector('[data-label]');
    this.help = document.getElementById('help');
    this.status = document.getElementById('status');
    this.toast = document.getElementById('toast');
    this.toastTimer = 0;
    this.promptTarget = null;
    this.device = 'keyboard';
    this.setDevice('keyboard');
  }

  setVisible(on) {
    this.root.hidden = !on;
  }

  setPrompt(target) {
    if (target === this.promptTarget) return;
    this.promptTarget = target;
    this.prompt.hidden = !target;
    if (!target) return;
    this.promptVerb.textContent = target.kind === 'door' ? 'Abrir' : 'Examinar';
    this.promptLabel.textContent = target.label ?? target.id;
  }

  setDevice(device) {
    this.device = device;
    const pad = device === 'gamepad';
    this.promptKey.textContent = pad ? 'Ⓐ' : 'E';
    this.help.innerHTML = pad
      ? `<span><kbd>stick</kbd> mover</span><span><kbd>X</kbd> correr</span><span><kbd>Ⓐ</kbd> examinar</span><span><kbd>Start</kbd> menú</span><span><kbd>Select</kbd> mapa</span>`
      : `<span><kbd>WASD</kbd>/<kbd>↑↓←→</kbd> mover</span><span><kbd>Shift</kbd> correr</span><span><kbd>E</kbd> examinar</span><span><kbd>Esc</kbd> menú</span><span><kbd>M</kbd> mapa</span>`;
  }

  setStatus(text) {
    this.status.textContent = text;
  }

  flash(text) {
    this.toast.textContent = text;
    this.toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast.hidden = true), 1800);
  }
}
