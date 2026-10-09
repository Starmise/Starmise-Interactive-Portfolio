import * as THREE from 'three';
import { applyPs1 } from '../render/ps1Material.js';

/** Ajustes de sensación. Cambiar aquí y probar. */
export const TUNING = {
  walkSpeed: 1.5, // m/s
  runSpeed: 3.4,
  backSpeed: 0.9, // modo tanque, hacia atrás
  turnSpeed: 12, // rad/s girando hacia la dirección del input (modo moderno)
  tankTurnSpeed: 2.8, // rad/s (modo tanque)
  quickTurnTime: 0.35, // s, giro de 180° en modo tanque (atrás + correr)
  radius: 0.28,
  height: 1.7,
  // Velocidad a la que la caminata no patina (m/s con timeScale 1). Ajustar al cambiar de animación.
  walkAnimSpeed: 1.5, // medido del clip Walk provisional
  runAnimSpeed: 3.4,
  fade: 0.18,
};

export const CONTROL_MODES = { modern: 'Moderno', tank: 'Clásico (tanque)' };

/**
 * Controlador del personaje: movimiento relativo a cámara (por defecto) o tipo tanque,
 * colisiones contra COL_* y máquina de estados de animación Idle/Walk/Run.
 */
export class PlayerController {
  constructor(player, { input, collision }) {
    this.model = player.model;
    this.input = input;
    this.collision = collision;
    this.mode = 'modern';
    this.position = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.frozen = false;

    // Base de cámara "enganchada": al cambiar de cámara se conserva la dirección mientras
    // no se suelte o cambie el input (evita el giro brusco típico de las cámaras fijas).
    this.basisForward = new THREE.Vector3(0, 0, -1);
    this.basisRight = new THREE.Vector3(1, 0, 0);
    this.latchedInput = null;
    this.camera = null;

    this.quickTurn = null; // { from, to, t }

    this.root = new THREE.Group();
    this.root.name = 'Player';
    this.root.add(this.model);
    this.root.add(makeBlobShadow());

    this.#setupAnimations(player);
  }

  setCamera(camera) {
    this.camera = camera;
    const { x, y } = this.input.axes();
    if (x === 0 && y === 0) this.#adoptCameraBasis();
    else this.latchedInput = `${x},${y}`;
  }

  setMode(mode) {
    this.mode = mode;
    this.quickTurn = null;
  }

  spawn({ position, yaw }) {
    this.position.copy(position);
    this.position.y = 0;
    this.yaw = yaw;
    this.speed = 0;
    this.#sync();
  }

  /** Vector unitario hacia donde mira el personaje (XZ). */
  forward(target = new THREE.Vector3()) {
    return target.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  update(dt) {
    const { x, y } = this.frozen ? { x: 0, y: 0 } : this.input.axes();
    const running = !this.frozen && this.input.held('run');
    let targetSpeed = 0;
    let turning = false;

    if (this.mode === 'modern') {
      targetSpeed = this.#updateModern(dt, x, y, running);
    } else {
      ({ targetSpeed, turning } = this.#updateTank(dt, x, y, running));
    }

    // Aceleración corta: arranca y frena rápido pero no en seco.
    const accel = targetSpeed > this.speed ? 14 : 18;
    this.speed += Math.sign(targetSpeed - this.speed) * Math.min(Math.abs(targetSpeed - this.speed), accel * dt);

    // Avanzar en sub-pasos de ≤ 8 cm para no atravesar muros finos.
    const distance = this.speed * dt;
    const steps = Math.max(1, Math.ceil(Math.abs(distance) / 0.08));
    const dir = this.forward(_dir);
    for (let i = 0; i < steps; i++) {
      this.position.addScaledVector(dir, distance / steps);
      this.collision?.resolveCapsule(this.position, TUNING.radius, TUNING.height);
    }

    this.#updateAnimation(dt, running, turning);
    this.mixer.update(dt);
    this.#sync();
  }

  #updateModern(dt, x, y, running) {
    if (x === 0 && y === 0) {
      this.latchedInput = null;
      this.#adoptCameraBasis();
      return 0;
    }
    const key = `${x},${y}`;
    if (this.latchedInput !== null && this.latchedInput !== key) {
      this.latchedInput = null;
      this.#adoptCameraBasis();
    }
    _move.set(0, 0, 0).addScaledVector(this.basisRight, x).addScaledVector(this.basisForward, y).normalize();
    const targetYaw = Math.atan2(_move.x, _move.z);
    const diff = wrapAngle(targetYaw - this.yaw);
    this.yaw = wrapAngle(this.yaw + Math.sign(diff) * Math.min(Math.abs(diff), TUNING.turnSpeed * dt));
    // Si hay que dar media vuelta, girar casi en el sitio antes de avanzar.
    const alignment = Math.max(0, Math.cos(diff));
    return (running ? TUNING.runSpeed : TUNING.walkSpeed) * (0.25 + 0.75 * alignment);
  }

  #updateTank(dt, x, y, running) {
    if (this.quickTurn) {
      const q = this.quickTurn;
      q.t = Math.min(1, q.t + dt / TUNING.quickTurnTime);
      this.yaw = q.from + Math.PI * q.t * q.sign;
      if (q.t >= 1) this.quickTurn = null;
      return { targetSpeed: 0, turning: true };
    }
    if (y < 0 && running && this.#quickTurnPressed()) {
      this.quickTurn = { from: this.yaw, t: 0, sign: x > 0 ? -1 : 1 };
      return { targetSpeed: 0, turning: true };
    }
    this.yaw = wrapAngle(this.yaw - x * TUNING.tankTurnSpeed * dt);
    let targetSpeed = 0;
    if (y > 0) targetSpeed = running ? TUNING.runSpeed : TUNING.walkSpeed;
    else if (y < 0) targetSpeed = -TUNING.backSpeed;
    return { targetSpeed, turning: x !== 0 && y === 0 };
  }

  /** Giro rápido: se dispara al pulsar correr o atrás mientras se mantiene el otro. */
  #quickTurnPressed() {
    return this.input.pressed.has('run') || this.input.pressed.has('down');
  }

  #adoptCameraBasis() {
    if (!this.camera) return;
    this.camera.getWorldDirection(this.basisForward);
    this.basisForward.y = 0;
    if (this.basisForward.lengthSq() < 1e-6) this.basisForward.set(0, 0, -1);
    this.basisForward.normalize();
    this.basisRight.set(-this.basisForward.z, 0, this.basisForward.x);
  }

  #setupAnimations(player) {
    this.mixer = player.mixer;
    const a = player.actions;
    const walkClip = player.clips.find((c) => c.name === 'Walk') ?? player.clips[0];

    this.actions = {
      walk: a.Walk ?? (walkClip && this.mixer.clipAction(walkClip)),
      run: a.Run,
      idle: a.Idle,
    };
    this.fallback = { run: !a.Run, idle: !a.Idle };

    if (!this.actions.run && walkClip) {
      const clip = walkClip.clone();
      clip.name = 'RunFallback';
      this.actions.run = this.mixer.clipAction(clip);
    }
    if (!this.actions.idle && walkClip) {
      // Sin Idle: la caminata congelada en el instante con los pies más juntos.
      const clip = walkClip.clone();
      clip.name = 'IdleFallback';
      this.actions.idle = this.mixer.clipAction(clip);
      this.actions.idle.time = findPassingPose(this.model, this.mixer, walkClip);
      this.actions.idle.timeScale = 0;
    }

    for (const action of Object.values(this.actions)) {
      if (!action) continue;
      action.enabled = true;
      action.setEffectiveWeight(0);
      action.play();
    }
    this.state = 'idle';
    this.actions.idle?.setEffectiveWeight(1);
  }

  #updateAnimation(dt, running, turning) {
    const speed = Math.abs(this.speed);
    let state = 'idle';
    if (speed > 0.05 || turning) state = running && speed > TUNING.walkSpeed + 0.2 ? 'run' : 'walk';

    const { walk, run } = this.actions;
    if (walk) {
      // Ajustar la cadencia a la velocidad real para que los pies no patinen.
      const s = turning && speed < 0.05 ? 0.6 : speed / TUNING.walkAnimSpeed;
      walk.timeScale = (this.speed < 0 ? -1 : 1) * THREE.MathUtils.clamp(s, 0.4, 1.6);
    }
    if (run) {
      const base = this.fallback.run ? TUNING.walkAnimSpeed * 1.25 : TUNING.runAnimSpeed;
      run.timeScale = THREE.MathUtils.clamp(speed / base, 0.6, 2.4);
    }

    if (state !== this.state) {
      const from = this.actions[this.state];
      const to = this.actions[state];
      if (to && from !== to) {
        to.enabled = true;
        to.setEffectiveWeight(1);
        if (state !== 'idle' && from && from !== this.actions.idle) to.syncWith(from);
        from?.crossFadeTo(to, TUNING.fade, false);
      }
      this.state = state;
    }
  }

  #sync() {
    this.root.position.copy(this.position);
    this.model.rotation.y = this.yaw;
  }
}

/** Busca el tiempo del clip en el que los pies están más cerca (pose "de paso"). */
function findPassingPose(model, mixer, clip) {
  const footL = findBone(model, /foot_l$|LeftFoot$/i);
  const footR = findBone(model, /foot_r$|RightFoot$/i);
  if (!footL || !footR) return 0;
  const probe = mixer.clipAction(clip.clone());
  probe.play();
  let best = 0;
  let bestDist = Infinity;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 0; i < 32; i++) {
    const t = (clip.duration * i) / 32;
    probe.time = t;
    mixer.update(0);
    model.updateMatrixWorld(true);
    footL.getWorldPosition(a);
    footR.getWorldPosition(b);
    a.y = b.y = 0;
    const d = a.distanceTo(b);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  probe.stop();
  mixer.uncacheAction(probe.getClip());
  return best;
}

function findBone(root, regex) {
  let found = null;
  root.traverse((o) => {
    if (!found && o.isBone && regex.test(o.name)) found = o;
  });
  return found;
}

function makeBlobShadow() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.65)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.8),
    applyPs1(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })),
  );
  mesh.name = 'BlobShadow';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01;
  mesh.renderOrder = 1;
  return mesh;
}

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

const _dir = new THREE.Vector3();
const _move = new THREE.Vector3();
