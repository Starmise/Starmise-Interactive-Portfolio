/**
 * Opciones del jugador, guardadas en localStorage (si está disponible).
 * El menú de pausa las edita; quien las usa se suscribe con `onChange`.
 */
const KEY = 'starmise.settings';

const DEFAULTS = {
  mode: 'modern', // 'modern' | 'tank'
  ps1: true, // efectos PS1 (resolución, temblor, dithering)
  doorAnim: 'full', // 'full' | 'short'
  volume: 0.8, // 0..1 (el audio llega en la Fase 6)
};

const listeners = new Set();

export const settings = load();

export function setSetting(key, value) {
  if (settings[key] === value) return;
  settings[key] = value;
  save();
  listeners.forEach((fn) => fn(key, value));
}

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function load() {
  const s = { ...DEFAULTS };
  try {
    Object.assign(s, JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    /* almacenamiento no disponible */
  }
  if (!['modern', 'tank'].includes(s.mode)) s.mode = DEFAULTS.mode;
  if (!['full', 'short'].includes(s.doorAnim)) s.doorAnim = DEFAULTS.doorAnim;
  // Con "reducir movimiento" en el sistema, la puerta va en versión corta por defecto.
  let fresh = true;
  try {
    fresh = !localStorage.getItem(KEY);
  } catch {
    /* sin almacenamiento */
  }
  if (fresh && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) s.doorAnim = 'short';
  return s;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* los ajustes duran solo esta sesión */
  }
}
