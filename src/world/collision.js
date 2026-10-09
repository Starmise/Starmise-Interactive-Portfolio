import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Mundo de colisión de una sala: todas las mallas COL_* fusionadas en una geometría con
 * BVH. El jugador es una cápsula vertical que se empuja fuera de los triángulos solo en
 * el plano horizontal (por ahora los suelos son planos; escaleras/rampas más adelante).
 */
export class CollisionWorld {
  constructor(meshes) {
    this.bvh = null;
    if (!meshes.length) return;
    const geometries = meshes.map((mesh) => {
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      // Solo hace falta la posición; quitar atributos para que mergeGeometries no falle.
      for (const key of Object.keys(g.attributes)) if (key !== 'position') g.deleteAttribute(key);
      return g.index ? g.toNonIndexed() : g;
    });
    const merged = mergeGeometries(geometries, false);
    this.bvh = new MeshBVH(merged);
  }

  /**
   * Corrige `position` (pies del jugador, se modifica en sitio) para que la cápsula de
   * radio `radius` entre las alturas [y+radius, y+height-radius] no atraviese la sala.
   * Devuelve true si hubo contacto.
   */
  resolveCapsule(position, radius, height, iterations = 3) {
    if (!this.bvh) return false;
    const segment = _segment;
    const box = _box;
    let hit = false;

    for (let iter = 0; iter < iterations; iter++) {
      segment.start.set(position.x, position.y + radius, position.z);
      segment.end.set(position.x, position.y + height - radius, position.z);
      box.makeEmpty();
      box.expandByPoint(segment.start);
      box.expandByPoint(segment.end);
      box.min.addScalar(-radius);
      box.max.addScalar(radius);

      let moved = false;
      this.bvh.shapecast({
        intersectsBounds: (b) => b.intersectsBox(box),
        intersectsTriangle: (tri) => {
          const distance = tri.closestPointToSegment(segment, _triPoint, _capsulePoint);
          if (distance >= radius) return false;
          // Empujar en horizontal desde el punto del triángulo hacia el eje de la cápsula.
          _push.subVectors(_capsulePoint, _triPoint);
          _push.y = 0;
          let len = _push.length();
          if (len < 1e-5) {
            // El eje está justo sobre el triángulo: usar su normal horizontal.
            tri.getNormal(_push);
            _push.y = 0;
            len = _push.length();
            if (len < 1e-5) return false; // triángulo horizontal (techo/suelo de una caja)
            _push.divideScalar(len);
            _push.multiplyScalar(radius);
          } else {
            _push.multiplyScalar((radius - distance) / len);
          }
          segment.start.add(_push);
          segment.end.add(_push);
          moved = true;
          return false;
        },
      });

      if (!moved) break;
      hit = true;
      position.x = segment.start.x;
      position.z = segment.start.z;
    }
    return hit;
  }
}

const _segment = new THREE.Line3();
const _box = new THREE.Box3();
const _triPoint = new THREE.Vector3();
const _capsulePoint = new THREE.Vector3();
const _push = new THREE.Vector3();
