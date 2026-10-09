import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toPs1Material } from '../render/ps1Material.js';

/**
 * Carga el personaje desde un GLB y prepara sus animaciones.
 *
 * TODO(personaje): `public/models/player.glb` es PROVISIONAL (convertido automáticamente
 * del FBX con una textura placeholder). Reemplazarlo por el exportado desde Blender con la
 * textura final y las acciones `Idle`, `Walk`, `Run`, `TurnL`, `TurnR`, `Examine`
 * (ver PLAN.md §5). Este código no necesita cambios si se respetan esos nombres; mientras
 * falten, el controlador improvisa Idle y Run a partir de Walk.
 */
export async function loadPlayer(url, manager) {
  const gltf = await new GLTFLoader(manager).loadAsync(url);
  const model = gltf.scene;

  model.traverse((obj) => {
    if (!obj.isMesh) return;
    // Los personajes con piel se deforman fuera de su caja original; evitar que desaparezcan.
    obj.frustumCulled = false;
    // Lambert + texels nítidos + vertex snapping/mapeo afín, igual que la sala.
    obj.material = toPs1Material(obj.material);
  });

  const clips = gltf.animations.map(stripRootMotion);
  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(clips.map((clip) => [clip.name, mixer.clipAction(clip)]));

  return { model, mixer, actions, clips };
}

/**
 * Las animaciones se usan "in place": el movimiento real lo decide el controlador.
 * Se conserva solo la altura (Y) del nodo raíz para no perder el rebote al caminar.
 */
function stripRootMotion(clip) {
  for (const track of clip.tracks) {
    const [node, prop] = track.name.split('.');
    if (prop !== 'position' || !/^(Root|pelvis|Hips|mixamorig:Hips)$/i.test(node)) continue;
    const v = track.values;
    const x0 = v[0];
    const z0 = v[2];
    for (let i = 0; i < v.length; i += 3) {
      v[i] = x0;
      v[i + 2] = z0;
    }
  }
  return clip;
}
