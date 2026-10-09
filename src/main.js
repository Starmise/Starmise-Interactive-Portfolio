import * as THREE from 'three';
import projects from './data/projects.json';
import profile from './data/profile.json';
import rooms from './data/rooms.json';
import { Input } from './core/input.js';
import { settings, onSettingsChange } from './core/settings.js';
import { Ps1Renderer } from './render/ps1Renderer.js';
import { RoomManager } from './world/roomManager.js';
import { CameraDirector } from './world/cameraDirector.js';
import { DoorTransition } from './world/doorTransition.js';
import { Interaction } from './world/interaction.js';
import { loadPlayer } from './player/loadPlayer.js';
import { PlayerController } from './player/playerController.js';
import { UiStack } from './ui/uiStack.js';
import { FileView } from './ui/fileView.js';
import { PauseMenu } from './ui/pauseMenu.js';
import { TitleScreen } from './ui/titleScreen.js';
import { Hud } from './ui/hud.js';
import { resolveInteractable } from './ui/documents.js';

// Fase 4 — contenido: seis salas, objetos por proyecto con su portada y TV con el DemoReel.

const BASE = import.meta.env.BASE_URL;
const START_ROOM = 'hall';

// ---------- Infraestructura ----------

const input = new Input();
const stack = new UiStack();
const hud = new Hud();
const uiRoot = document.getElementById('ui');

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
document.getElementById('app').appendChild(renderer.domElement);
const ps1 = new Ps1Renderer(renderer, { height: 240 });
ps1.setEnabled(settings.ps1);

const scene = new THREE.Scene();
const fogColor = new THREE.Color(0x050506);
scene.background = fogColor;
scene.fog = new THREE.Fog(fogColor, 5, 15); // cada sala ajusta near/far con `fog` de rooms.json
const ambient = new THREE.HemisphereLight(0x8790a8, 0x1c140e, 0.75); // `ambient` de rooms.json
scene.add(ambient);

const transition = new DoorTransition(document.getElementById('fade'), document.getElementById('door-loading'));

const manager = new THREE.LoadingManager();
const roomManager = new RoomManager(rooms, {
  baseUrl: BASE,
  manager,
  resolve: (id) => resolveInteractable(id, { projects, profile }),
});

// ---------- UI ----------

const fileView = new FileView(uiRoot, stack, { baseUrl: BASE });
const pause = new PauseMenu(uiRoot, stack, {
  fileView,
  projects,
  profile,
  rooms,
  getCurrentRoom: () => world.room?.id,
  onTravel: (id) => {
    stack.clear();
    goToRoom(id, 'default', 'short');
  },
  onTitle: () => {
    state = 'title';
    hud.setVisible(false);
    title.show();
  },
});
const title = new TitleScreen(uiRoot, stack, {
  profile,
  onStart: () => {
    state = 'play';
    hud.setVisible(true);
    hud.flash(world.room?.def.name ?? '');
  },
});

stack.onChange = (open) => {
  input.setEnabled(!open);
  hud.setPrompt(null);
};
input.setEnabled(!stack.isOpen); // el título ya está abierto
input.onDeviceChange = (device) => {
  hud.setDevice(device);
  pause.setDevice(device);
  title.setDevice(device);
};

onSettingsChange((key, value) => {
  if (key === 'mode') world.player?.setMode(value);
  if (key === 'ps1') {
    ps1.setEnabled(value);
    onResize();
  }
});

// ---------- Mundo ----------

const timer = new THREE.Timer();
timer.connect(document); // pausa el delta cuando la pestaña está oculta

let state = 'title'; // 'title' | 'play'
const world = { room: null, director: null, interaction: null, player: null, debug: false };
window.__game = world; // para depurar desde la consola

let shownProgress = 0;
let targetProgress = 0;
manager.onProgress = (_url, loaded, total) => (targetProgress = loaded / Math.max(total, 1));

boot().catch((err) => {
  console.error(err);
  title.setError('No se pudo cargar el portafolio. Prueba la versión clásica.');
});

async function boot() {
  renderer.setAnimationLoop(loop);
  onResize();
  const [room, playerAsset] = await Promise.all([
    roomManager.load(START_ROOM),
    loadPlayer(`${BASE}models/player.glb`, manager),
  ]);
  world.player = new PlayerController(playerAsset, { input, collision: null });
  world.player.setMode(settings.mode);
  scene.add(world.player.root);
  enterRoom(room, 'default');
  title.setReady();
}

/** Coloca al jugador en una sala ya cargada. */
function enterRoom(room, fromId) {
  if (world.room) scene.remove(world.room.root);
  world.room = room;
  scene.add(room.root);
  const [near, far] = room.def.fog ?? [5, 15];
  scene.fog.near = near;
  scene.fog.far = far;
  ambient.intensity = room.def.ambient ?? 0.75;
  for (const h of room.helpers) h.visible = world.debug;

  const player = world.player;
  player.collision = room.collision;
  const spawn = room.spawns.get(fromId) ?? room.spawns.get('default') ?? room.spawns.values().next().value
    ?? { position: new THREE.Vector3(), yaw: 0 };
  player.spawn(spawn);

  world.director = new CameraDirector(room);
  world.director.setAspect(window.innerWidth / window.innerHeight);
  world.director.onChange = (_id, cam) => player.setCamera(cam);
  world.director.start(player.position);
  player.snapCamera(world.director.camera);

  world.interaction = new Interaction(room.interactables);
  transition.setDoorTexture(room.doorTexture);
  roomManager.prefetchNeighbours(room);
}

/** Cambio de sala con transición (puerta completa o fundido rápido). */
async function goToRoom(id, fromId, mode = settings.doorAnim) {
  if (transition.busy) return;
  if (!roomManager.isAvailable(id)) {
    hud.flash('Está cerrada. Esta sala llegará pronto.');
    return;
  }
  world.player.frozen = true;
  hud.setPrompt(null);
  hud.setVisible(false);
  const ready = roomManager.load(id);
  try {
    await transition.play({ ready, mode, input });
    enterRoom(await ready, fromId);
    hud.flash(world.room.def.name);
  } catch (err) {
    console.error(err);
    hud.flash('No se pudo abrir la puerta.');
  } finally {
    transition.reveal();
    hud.setVisible(state === 'play');
    world.player.frozen = false;
  }
}

function interact(target) {
  if (target.kind === 'door') {
    goToRoom(target.roomId, world.room.id);
    return;
  }
  fileView.open(target.document());
}

// ---------- Bucle ----------

function loop(time) {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 1 / 20);
  input.poll(time);
  for (const action of input.consumeUi()) if (stack.isOpen) stack.dispatch(action, true);

  shownProgress += (targetProgress - shownProgress) * Math.min(1, dt * 8);
  if (!title.ready) title.setProgress(shownProgress);

  transition.update(dt);
  const { player, director, interaction } = world;

  if (player && director) {
    const playing = state === 'play' && !stack.isOpen && !transition.busy;
    if (playing) handleGameActions();
    // En el título el personaje sigue respirando (idle); en pausa todo se congela.
    if (playing || state === 'title' || transition.busy) {
      player.frozen = !playing;
      player.update(dt);
      director.update(player.position);
    }
    world.room.update(dt); // pantallas animadas (siguen encendidas en pausa)

    const target = playing ? interaction.find(player) : null;
    hud.setPrompt(target);
    if (target && input.consume('interact')) interact(target);
    if (world.debug) {
      const p = player.position;
      hud.setStatus(`${world.room.id} · CAM_${director.activeId} · x ${p.x.toFixed(2)} z ${p.z.toFixed(2)}`);
    }
  }

  if (transition.active) ps1.render(transition.scene, transition.camera);
  else if (director) ps1.render(scene, director.camera);
  else renderer.clear();

  input.endFrame();
}

function handleGameActions() {
  if (input.consume('pause')) pause.open();
  else if (input.consume('map')) pause.open('map');
  else if (input.consume('inventory')) pause.open('inventory');
  if (input.consume('toggleDebug')) {
    world.debug = !world.debug;
    for (const h of world.room.helpers) h.visible = world.debug;
    hud.setStatus('');
    hud.flash(world.debug ? 'Depuración: colisiones y triggers visibles' : 'Depuración: no');
  }
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ps1.setSize(w, h);
  world.director?.setAspect(w / h);
  transition.setAspect(w / h);
}
window.addEventListener('resize', onResize);
