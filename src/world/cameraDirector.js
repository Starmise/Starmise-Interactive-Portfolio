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

  /**
   * Las cámaras se encuadran en Blender para pantallas apaisadas. En una ventana más estrecha
   * (un móvil en vertical) se abre el FOV vertical para conservar el ancho de imagen que
   * tendría una proporción MIN_ASPECT, y así el personaje no se sale por los lados.
   */
  setAspect(aspect) {
    for (const cam of this.room.cameras.values()) {
      cam.userData.baseFov ??= cam.fov;
      const base = cam.userData.baseFov;
      if (aspect < MIN_ASPECT) {
        const half = Math.atan((Math.tan(THREE.MathUtils.degToRad(base / 2)) * MIN_ASPECT) / aspect);
        cam.fov = Math.min(MAX_FOV, THREE.MathUtils.radToDeg(half * 2));
      } else {
        cam.fov = base;
      }
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

const MIN_ASPECT = 1.2;
const MAX_FOV = 100;

const _probe = new THREE.Vector3();
const _local = new THREE.Vector3();
