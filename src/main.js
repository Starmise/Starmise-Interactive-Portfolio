import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadPlayer } from './player/loadPlayer.js';

// Fase 1 — escena mínima: cargar el personaje y ver la caminata en el navegador.
// El render PS1, el controlador y las salas llegan en la Fase 2 (ver PLAN.md).

const app = document.getElementById('app');
const status = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const fogColor = new THREE.Color(0x0b0b0d);
scene.background = fogColor;
scene.fog = new THREE.Fog(fogColor, 4, 12);

// Cámara fija en ángulo alto, al estilo de las cámaras de la época.
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50);
camera.position.set(2.6, 2.2, 3.4);

// OrbitControls solo como ayuda de desarrollo para inspeccionar el modelo.
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
controls.update();

scene.add(new THREE.HemisphereLight(0x9aa0b0, 0x1a1410, 1.2));
const key = new THREE.DirectionalLight(0xffe2c0, 2.2);
key.position.set(2, 4, 3);
key.castShadow = true;
key.shadow.mapSize.set(512, 512);
scene.add(key);

// Suelo provisional: baldosas a cuadros con textura diminuta y filtrado nearest.
const floorTex = makeCheckerTexture();
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(10, 10);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshLambertMaterial({ map: floorTex }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const timer = new THREE.Timer();
timer.connect(document); // pausa el delta cuando la pestaña está oculta
let mixer = null;

loadPlayer(`${import.meta.env.BASE_URL}models/player.glb`)
  .then((player) => {
    scene.add(player.model);
    mixer = player.mixer;
    const walk = player.actions.Walk ?? Object.values(player.actions)[0];
    walk?.play();
    status.textContent = `Animaciones: ${player.clips.map((c) => c.name).join(', ') || 'ninguna'}`;
  })
  .catch((err) => {
    console.error(err);
    status.textContent = 'No se pudo cargar models/player.glb';
  });

renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  mixer?.update(dt);
  controls.update();
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function makeCheckerTexture() {
  const size = 8;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dark = (x < 4) !== (y < 4);
      const v = dark ? 34 : 52;
      const i = (y * size + x) * 4;
      data.set([v, v - 2, v - 6, 255], i);
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
