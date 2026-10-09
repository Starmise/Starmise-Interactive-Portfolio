import * as THREE from 'three';

/** Distancia máxima (m) desde el borde del objeto y ángulo para poder examinarlo. */
const REACH = 0.75;
const MIN_FACING = 0.35; // coseno: ~70° a cada lado

/**
 * Elige el objeto INT_ o la puerta DOOR_ con la que el jugador puede interactuar: cerca (respecto a su caja, no a su
 * centro) y más o menos de frente. Devuelve la entrada de `room.interactables` o null.
 */
export class Interaction {
  constructor(interactables) {
    this.items = interactables;
  }

  find(player) {
    const pos = player.position;
    const fwd = player.forward(_fwd);
    let best = null;
    let bestScore = Infinity;
    for (const it of this.items) {
      it.box.clampPoint(_p.set(pos.x, it.box.min.y, pos.z), _closest);
      _to.subVectors(_closest, pos);
      _to.y = 0;
      const dist = _to.length();
      if (dist > REACH) continue;
      const facing = dist < 1e-3 ? 1 : _to.divideScalar(dist).dot(fwd);
      if (facing < MIN_FACING) continue;
      const score = dist - facing * 0.3;
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    return best;
  }
}

const _fwd = new THREE.Vector3();
const _p = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _to = new THREE.Vector3();
