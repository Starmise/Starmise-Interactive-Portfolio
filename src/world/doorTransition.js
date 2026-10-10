import * as THREE from 'three';
import { applyPs1, makeTextureCrisp } from '../render/ps1Material.js';

/**
 * Transición de puerta al estilo de la época: una puerta se abre despacio en la
 * oscuridad y la cámara la cruza. Sirve para ocultar la carga de la sala siguiente.
 *
 *   const done = transition.play({ ready, mode })  // promesa: se resuelve en negro
 *   … cambiar de sala …
 *   transition.reveal()                             // fundido desde negro
 *
 * Mientras `active` sea true, el bucle principal debe dibujar `scene` con `camera`.
 * mode: 'full' (animación completa, ~2.3 s) o 'short' (solo fundido).
 *
 * `onCue(nombre)` marca los momentos para el sonido: 'latch' (picaporte), 'creak' (la puerta
 * se abre), 'shut' (se cierra detrás), 'skip' (se saltó la animación) y, en el modo corto,
 * 'latch' + 'shutSoft'.
 */

const CUES = {
  full: [
    { t: 0.15, name: 'latch' },
    { t: 0.36, name: 'creak', skippable: true },
    { t: 2.0, name: 'shut' },
  ],
  short: [
    { t: 0, name: 'latch' },
    { t: 0.14, name: 'shutSoft' },
  ],
};
export class DoorTransition {
  constructor(fadeEl, loadingEl) {
    this.fadeEl = fadeEl;
    this.loadingEl = loadingEl;
    this.active = false;
    this.fade = 0;
    this.fadeTarget = 0;
    this.fadeSpeed = 4;
    this.job = null;
    this.onCue = null;
    this.cues = [];

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 1.5, 6);
    this.camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.05, 20);

    this.scene.add(new THREE.AmbientLight(0x404050, 0.6));
    this.lamp = new THREE.PointLight(0xffc890, 3, 6, 2);
    this.lamp.position.set(0.4, 2.2, 1.4);
    this.scene.add(this.lamp);

    this.doorTexture = makeDoorTexture();
    this.#build();
  }

  /** Usar la textura de puerta de la sala (MAT_Door) si existe. */
  setDoorTexture(texture) {
    if (!texture) return;
    this.leaf.material.map = texture;
    this.leaf.material.needsUpdate = true;
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  play({ ready = Promise.resolve(), mode = 'full', input = null } = {}) {
    this.active = mode === 'full';
    this.mode = mode;
    this.input = input;
    this.t = 0;
    this.skipped = false;
    this.cues = CUES[mode === 'full' ? 'full' : 'short'].map((c) => ({ ...c, done: false }));
    this.isReady = false;
    ready.then(
      () => (this.isReady = true),
      () => (this.isReady = true),
    );
    this.#reset();
    if (mode === 'full') {
      this.fade = 1;
      this.fadeTarget = 0;
      this.fadeSpeed = 3;
    } else {
      this.fadeTarget = 1;
      this.fadeSpeed = 5;
    }
    return new Promise((resolve) => (this.job = resolve));
  }

  reveal() {
    this.active = false;
    this.fadeTarget = 0;
    this.fadeSpeed = 3;
    this.loadingEl.hidden = true;
  }

  get busy() {
    return !!this.job;
  }

  update(dt) {
    // Fundido (siempre, aunque no haya animación).
    if (this.fade !== this.fadeTarget) {
      const step = this.fadeSpeed * dt;
      this.fade = this.fade < this.fadeTarget ? Math.min(this.fadeTarget, this.fade + step) : Math.max(this.fadeTarget, this.fade - step);
    }
    this.fadeEl.style.opacity = this.fade.toFixed(3);
    this.fadeEl.hidden = this.fade <= 0.001;
    if (!this.job) return;

    this.t += dt;
    for (const cue of this.cues) {
      if (cue.done || this.t < cue.t) continue;
      cue.done = true;
      if (!(cue.skippable && this.skipped)) this.onCue?.(cue.name);
    }
    const t = this.t;
    let finished;
    if (this.mode === 'full') {
      // Saltar la animación una vez cargada la sala.
      if (this.isReady && t > 0.6 && this.t < 2.0 && this.input?.consumeAny?.()) {
        this.t = 2.0;
        this.skipped = true;
        this.onCue?.('skip');
      }
      const open = smooth((t - 0.35) / 1.25);
      this.pivot.rotation.y = -THREE.MathUtils.degToRad(100) * open;
      const walk = smooth((t - 1.1) / 1.1);
      this.camera.position.set(0, 1.55 - walk * 0.1, 2.3 - walk * 2.9);
      this.camera.lookAt(0, 1.3 - walk * 0.1, -2);
      this.lamp.intensity = 3 * (0.92 + 0.08 * Math.sin(t * 23) * Math.sin(t * 7));
      if (t > 1.9) this.fadeTarget = 1;
      finished = t > 2.3 && this.fade >= 1;
    } else {
      finished = this.fade >= 1;
    }

    if (finished && !this.isReady) this.loadingEl.hidden = false;
    if (finished && this.isReady) {
      const resolve = this.job;
      this.job = null;
      this.loadingEl.hidden = true;
      resolve();
    }
  }

  #reset() {
    this.pivot.rotation.y = 0;
    this.camera.position.set(0, 1.55, 2.3);
    this.camera.lookAt(0, 1.3, -2);
  }

  #build() {
    const wood = applyPs1(new THREE.MeshLambertMaterial({ color: 0x5a3a26 }));
    const wall = applyPs1(new THREE.MeshLambertMaterial({ color: 0x1f2a1c }));
    const floor = applyPs1(new THREE.MeshLambertMaterial({ color: 0x23241f }));

    const w = 1.2;
    const h = 2.3;
    // Muro con hueco.
    const left = new THREE.Mesh(new THREE.BoxGeometry(3, 3.2, 0.2), wall);
    left.position.set(-w / 2 - 1.5 - 0.06, 1.6, -0.1);
    const right = left.clone();
    right.position.x = w / 2 + 1.5 + 0.06;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 3.2 - h, 0.2), wall);
    top.position.set(0, h + (3.2 - h) / 2, -0.1);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floor);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(left, right, top, ground);
    // Marco.
    for (const [x, y, sw, sh] of [[-w / 2 - 0.06, h / 2, 0.12, h + 0.12], [w / 2 + 0.06, h / 2, 0.12, h + 0.12], [0, h + 0.06, w + 0.24, 0.12]]) {
      const part = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.26), wood);
      part.position.set(x, y, -0.05);
      this.scene.add(part);
    }
    // Hoja, con la bisagra a la izquierda.
    this.pivot = new THREE.Group();
    this.pivot.position.set(-w / 2, 0, 0);
    const leafMat = applyPs1(new THREE.MeshLambertMaterial({ map: this.doorTexture }));
    this.leaf = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08, 3, 6, 1), leafMat);
    this.leaf.position.set(w / 2, h / 2, -0.04);
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), applyPs1(new THREE.MeshLambertMaterial({ color: 0x8a7a50 })));
    knob.position.set(w - 0.15, h / 2 - 0.1, 0.03);
    this.pivot.add(this.leaf, knob);
    this.scene.add(this.pivot);
  }
}

function smooth(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function makeDoorTexture() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#2b140c';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#20100a';
  g.strokeStyle = '#3e1f12';
  for (const [x, y, w, h] of [[8, 6, 20, 22], [36, 6, 20, 22], [8, 36, 20, 22], [36, 36, 20, 22]]) {
    g.fillRect(x, y, w, h);
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  makeTextureCrisp(tex);
  return tex;
}
