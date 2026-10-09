import * as THREE from 'three';

/**
 * Cámaras fijas por zonas. Cada TRG_CAM_<n> activa CAM_<n> cuando el jugador entra.
 * Histéresis: mientras el jugador siga dentro del volumen de la cámara activa, no se
 * cambia (los volúmenes vecinos se solapan un poco en Blender para evitar parpadeos).
 */
export class CameraDirector {
  constructor(room) {
    this.room = room;
    this.activeId = null;
    this.camera = null;
    this.onChange = null; // (id, camera) => void
  }

  setAspect(aspect) {
    for (const cam of this.room.cameras.values()) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }
  }

  /** Fuerza una cámara (p. ej. al aparecer). */
  cut(id) {
    const cam = this.room.cameras.get(id);
    if (!cam || id === this.activeId) return;
    this.activeId = id;
    this.camera = cam;
    this.onChange?.(id, cam);
  }

  update(playerPosition) {
    // El punto de prueba va a la altura de la cadera, por si los volúmenes no tocan el suelo.
    _probe.copy(playerPosition);
    _probe.y += 0.9;
    const current = this.room.triggers.filter((t) => t.cameraId === this.activeId);
    if (current.some((t) => contains(t, _probe))) return;
    const next = this.room.triggers.find((t) => contains(t, _probe));
    if (next) this.cut(next.cameraId);
  }

  /** Cámara inicial: la del volumen que contiene al punto, o la primera que exista. */
  start(position) {
    this.update(position);
    if (!this.camera) this.cut(this.room.cameras.keys().next().value);
  }
}

function contains(trigger, point) {
  _local.copy(point).applyMatrix4(trigger.inverse);
  return trigger.box.containsPoint(_local);
}

const _probe = new THREE.Vector3();
const _local = new THREE.Vector3();
