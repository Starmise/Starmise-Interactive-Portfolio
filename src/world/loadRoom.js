import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toPs1Material } from '../render/ps1Material.js';
import { CollisionWorld } from './collision.js';

/**
 * Carga una sala exportada desde Blender e interpreta la convención de nombres
 * (PLAN.md §6.2):
 *
 *   COL_*            → colisión (se oculta)
 *   CAM_<n>          → cámara fija
 *   TRG_CAM_<n>[_x]  → volumen(es) que activan CAM_<n> (se ocultan)
 *   INT_<projectId>  → objeto examinable; sus mallas con material MAT_Cover reciben la portada
 *   SPAWN_<nombre>   → punto de aparición (Empty; su flecha +Z de Blender indica la dirección)
 *   DOOR_<roomId>    → puerta (se recoge, la lógica llega en la Fase 3)
 */
export async function loadRoom(url, { projects = [], baseUrl = './' } = {}) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.updateMatrixWorld(true);

  const room = {
    root,
    cameras: new Map(), // n → PerspectiveCamera
    triggers: [], // { cameraId, mesh, box (local), inverse }
    interactables: [], // { id, project, object, box (world) }
    spawns: new Map(), // nombre → { position, yaw }
    doors: [],
    helpers: [], // COL_/TRG_ para el modo depuración
    collision: null,
  };

  const colliders = [];
  const byProject = new Map(projects.map((p) => [p.id, p]));
  const materialCache = new Map();

  root.traverse((obj) => {
    const name = obj.name;
    let m;

    if (obj.isCamera && (m = name.match(/^CAM_([A-Za-z0-9]+)$/))) {
      room.cameras.set(m[1], obj);
      return;
    }
    if (obj.isMesh && name.startsWith('COL_')) {
      colliders.push(obj);
      hideAsHelper(obj, 0x3fa7ff, room);
      return;
    }
    // TRG_CAM_<n> o TRG_CAM_<n>_<sufijo> (varios volúmenes para la misma cámara).
    if (obj.isMesh && (m = name.match(/^TRG_CAM_([A-Za-z0-9]+)(?:_\w+)?$/))) {
      obj.geometry.computeBoundingBox();
      room.triggers.push({
        cameraId: m[1],
        mesh: obj,
        box: obj.geometry.boundingBox.clone(),
        inverse: obj.matrixWorld.clone().invert(),
      });
      hideAsHelper(obj, 0xffc83f, room);
      return;
    }
    if ((m = name.match(/^SPAWN_(\w[\w-]*)$/))) {
      const position = new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);
      // La flecha +Z local de Blender se convierte en +Y local en glTF (Y arriba).
      const dir = new THREE.Vector3(0, 1, 0).transformDirection(obj.matrixWorld);
      room.spawns.set(m[1], { position, yaw: Math.atan2(dir.x, dir.z) });
      return;
    }
    if ((m = name.match(/^DOOR_(\w[\w-]*)$/))) {
      room.doors.push({ roomId: m[1], object: obj });
    }
    if ((m = name.match(/^INT_([a-z0-9-]+)$/))) {
      const project = byProject.get(m[1]);
      if (!project) console.warn(`[room] ${name}: no existe el proyecto "${m[1]}" en projects.json`);
      room.interactables.push({ id: m[1], project, object: obj, box: new THREE.Box3().setFromObject(obj) });
    }

    if (obj.isMesh) {
      obj.material = convertMaterial(obj.material, materialCache);
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });

  // Portadas: cada INT_ con un hijo de material MAT_Cover recibe su imagen en baja resolución.
  await Promise.all(
    room.interactables.map(async (it) => {
      if (!it.project?.cover) return;
      const tex = await loadCoverTexture(baseUrl + it.project.cover);
      it.object.traverse((o) => {
        if (o.isMesh && o.material?.name === 'MAT_Cover') {
          o.material = o.material.clone();
          o.material.map = tex;
          o.material.emissiveMap = tex;
          o.material.needsUpdate = true;
        }
      });
    }),
  );

  room.collision = new CollisionWorld(colliders);
  return room;
}

function hideAsHelper(mesh, color, room) {
  mesh.visible = false;
  mesh.material = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.6, depthTest: false });
  mesh.renderOrder = 999;
  room.helpers.push(mesh);
}

function convertMaterial(material, cache) {
  if (Array.isArray(material)) return material.map((m) => convertMaterial(m, cache));
  if (!cache.has(material)) cache.set(material, toPs1Material(material));
  return cache.get(material);
}

/**
 * Reduce la portada a 128×96 (contenida, con fondo negro) y la cuantiza a 15 bits,
 * para que parezca una textura de la época sin cargar la imagen en alta.
 */
async function loadCoverTexture(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  const W = 128;
  const H = 96;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingQuality = 'high';
  const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  ctx.drawImage(img, Math.round((W - w) / 2), Math.round((H - h) / 2), w, h);
  const data = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i] &= 0xf8;
    data.data[i + 1] &= 0xf8;
    data.data[i + 2] &= 0xf8;
  }
  ctx.putImageData(data, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false; // las UV vienen de glTF
  return tex;
}
