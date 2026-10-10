/**
 * Sonidos de la interfaz, conectados en un solo sitio:
 *
 * - UiStack: abrir/cerrar capas, mover el cursor con flechas o mando, cambiar de pestaña.
 * - Clics en botones y enlaces de la capa de arriba → 'confirm' (o el nombre que diga su
 *   atributo `data-sfx`, p. ej. `data-sfx="start"` en "Pulsa Enter").
 * - Deslizadores (volúmenes) → 'move', que de paso sirve para oír el volumen nuevo.
 *
 * El motor (audio.ui) junta las peticiones del mismo instante y deja la más importante.
 */
export function wireUiSounds(stack, audio) {
  stack.onSound = (name) => audio.ui(name);

  document.addEventListener(
    'click',
    (e) => {
      const el = e.target.closest?.('button, a[href], [role="tab"]');
      if (!el || el.disabled) return;
      const top = stack.top;
      if (!top || !top.el.contains(el)) return;
      const name = el.dataset.sfx ?? 'confirm';
      if (name !== 'none') audio.ui(name);
    },
    true,
  );

  document.addEventListener(
    'input',
    (e) => {
      if (e.target instanceof HTMLInputElement && e.target.type === 'range' && stack.top?.el.contains(e.target)) audio.ui('move');
    },
    true,
  );
}
