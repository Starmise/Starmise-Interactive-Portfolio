import * as THREE from 'three';
import projects from './data/projects.json';
import { Input } from './core/input.js';
import { Ps1Renderer } from './render/ps1Renderer.js';
import { loadRoom } from './world/loadRoom.js';
import { CameraDirector } from './world/cameraDirector.js';
import { loadPlayer } from './player/loadPlayer.js';
import { PlayerController, CONTROL_MODES } from './player/playerController.js';
import { Interaction } from './world/interaction.js';
import { FileView } from './ui/fileView.js';
import { Hud } from './ui/hud.js';

// Fase 2 — prototipo vertical: una sala de prueba con render PS1, cámaras fijas,
// colisiones y un objeto examinable que abre la ficha del proyecto.

const BASE = import.meta.env.BASE_URL;
const ROOM_URL = `${BASE}models/rooms/test_room.glb`;
const PLAYER_URL = `${BASE}models/player.glb`;

const settings = loadSettings();
const hud = new Hud();
const input = new Input();
const fileView = new FileView(document.getElementById('ui'), { baseUrl: BASE });

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
document.getElementById('app').appendChild(renderer.domElement);
const ps1 = new Ps1Renderer(renderer, { height: 240 });
ps1.setEnabled(settings.ps1);

const scene = new THREE.Scene();
const fogColor = new THREE.Color(0x050506);
scene.background = fogColor;
scene.fog = new THREE.Fog(fogColor, 5, 15);
scene.add(new THREE.HemisphereLight(0x8790a8, 0x1c140e, 0.75));

const timer = new THREE.Timer();
timer.connect(document); // pausa el delta cuando la pestaña está oculta

let game = null;

start().catch((err) => {
  console.error(err);
  hud.setStatus('No se pudo cargar la sala. Revisa la consola.');
});

async function start() {
  const [room, playerAsset] = await Promise.all([
    loadRoom(ROOM_URL, { projects, baseUrl: BASE }),
    loadPlayer(PLAYER_URL),
  ]);
  scene.add(room.root);

  const director = new CameraDirector(room);
  const player = new PlayerController(playerAsset, { input, collision: room.collision });
  player.setMode(settings.mode);
  scene.add(player.root);

  const spawn = room.spawns.get('default') ?? room.spawns.values().next().value ?? { position: new THREE.Vector3(), yaw: 0 };
  player.spawn(spawn);

  director.onChange = (_id, cam) => player.setCamera(cam);
  director.start(player.position);

  const interaction = new Interaction(room.interactables);

  fileView.onClose = () => {
    input.setEnabled(true);
    player.frozen = false;
  };

  game = { room, director, player, interaction, debug: false };
  // Acceso para depurar desde la consola del navegador.
  window.__game = game;

  onResize();
  hud.setHelp({ mode: CONTROL_MODES[settings.mode], ps1: settings.ps1 });
  hud.setStatus('');
  renderer.setAnimationLoop(loop);
}

function loop(time) {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 1 / 20);
  const { director, player, interaction } = game;

  handleToggles();

  player.update(dt);
  director.update(player.position);

  const target = fileView.isOpen ? null : interaction.find(player);
  hud.setPrompt(target);
  if (target && input.consume('interact')) {
    player.frozen = true;
    input.setEnabled(false);
    hud.setPrompt(null);
    fileView.open(target.project, projects.indexOf(target.project));
  }

  ps1.render(scene, director.camera);
  input.endFrame();
}

function handleToggles() {
  if (input.consume('toggleControls')) {
    settings.mode = settings.mode === 'modern' ? 'tank' : 'modern';
    game.player.setMode(settings.mode);
    hud.flash(`Controles: ${CONTROL_MODES[settings.mode]}`);
    hud.setHelp({ mode: CONTROL_MODES[settings.mode], ps1: settings.ps1 });
    saveSettings();
  }
  if (input.consume('togglePs1')) {
    settings.ps1 = !settings.ps1;
    ps1.setEnabled(settings.ps1);
    onResize();
    hud.flash(`Efectos PS1: ${settings.ps1 ? 'sí' : 'no'}`);
    hud.setHelp({ mode: CONTROL_MODES[settings.mode], ps1: settings.ps1 });
    saveSettings();
  }
  if (input.consume('toggleDebug')) {
    game.debug = !game.debug;
    for (const h of game.room.helpers) h.visible = game.debug;
    hud.flash(game.debug ? 'Depuración: colisiones y triggers visibles' : 'Depuración: no');
  }
  if (game.debug) {
    const p = game.player.position;
    hud.setStatus(`CAM_${game.director.activeId} · x ${p.x.toFixed(2)} z ${p.z.toFixed(2)}`);
  } else if (hud.status.textContent) {
    hud.setStatus('');
  }
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ps1.setSize(w, h);
  game?.director.setAspect(w / h);
}
window.addEventListener('resize', onResize);

function loadSettings() {
  const defaults = { mode: 'modern', ps1: true };
  try {
    const saved = JSON.parse(localStorage.getItem('starmise.settings') ?? '{}');
    const s = { ...defaults, ...saved };
    if (!CONTROL_MODES[s.mode]) s.mode = defaults.mode;
    return s;
  } catch {
    return defaults;
  }
}

function saveSettings() {
  try {
    localStorage.setItem('starmise.settings', JSON.stringify(settings));
  } catch {
    /* almacenamiento no disponible: los ajustes duran solo esta sesión */
  }
}
