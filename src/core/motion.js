import { settings, onSettingsChange } from './settings.js';

/**
 * Movimiento reducido: la opción "Movimiento" del menú (Según el sistema / Reducido / Completo)
 * manda; "según el sistema" sigue a `prefers-reduced-motion`.
 *
 * Con movimiento reducido: sin temblor de vértices (vertex snapping), puertas con fundido corto,
 * TV sin estática ni parpadeo y sin parpadeos/transiciones en la interfaz. Para el CSS se pone la
 * clase `reduce-motion` en <html>.
 */
const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const listeners = new Set();
let current = compute();
apply();

export function reducedMotion() {
  return current;
}

/** fn(reduced) cada vez que cambie (por el sistema o por la opción). */
export function onReducedMotionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function compute() {
  if (settings.motion === 'reduce') return true;
  if (settings.motion === 'full') return false;
  return !!query?.matches;
}

function apply() {
  document.documentElement.classList.toggle('reduce-motion', current);
}

function refresh() {
  const next = compute();
  if (next === current) return;
  current = next;
  apply();
  listeners.forEach((fn) => fn(current));
}

query?.addEventListener?.('change', refresh);
onSettingsChange((key) => key === 'motion' && refresh());
