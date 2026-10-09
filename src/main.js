import { caps, listView, closeList, wantsList } from './shell.js';

/**
 * Arranque. Decide qué cargar antes de traer Three.js:
 *
 *   - `#lista` en la URL      → modo lista (el juego se carga solo si se pulsa "Jugar en 3D")
 *   - sin WebGL 2             → modo lista con un aviso
 *   - en cualquier otro caso  → el juego (game.js, en su propio bloque de JS)
 *
 * Las capacidades del equipo (y la sugerencia de modo lista en equipos lentos) están en
 * core/capabilities.js; el juego las usa en la pantalla de título.
 */

let game = null;

function startGame() {
  game ??= import('./game.js')
    .then(() => listView.setGameLoaded(true))
    .catch((err) => {
      console.error(err);
      game = null;
      listView.open({ notice: 'No se pudo cargar la versión 3D. Aquí tienes todo el portafolio.' });
    });
  return game;
}

listView.onPlay = () => {
  closeList();
  startGame();
};

// Si se cierra el modo lista (p. ej. con "atrás") sin haber cargado el juego, cargarlo.
listView.subscribe((open) => {
  if (!open && caps.webgl) startGame();
});

if (!caps.webgl) {
  history.replaceState(null, '', '#lista');
  listView.open({
    notice: 'Tu navegador no puede mostrar la versión 3D (necesita WebGL 2), así que aquí tienes todo el portafolio.',
  });
} else if (wantsList()) {
  listView.open();
} else {
  startGame();
}
