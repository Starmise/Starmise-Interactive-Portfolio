# CLAUDE.md — Contexto del proyecto

Portafolio **interactivo en 3D** de **Starmise** (Luis Rosaldo), desarrollador de videojuegos.
Todo el contenido y la comunicación con el usuario son **en español**.

> **Este es el repositorio activo del portafolio.** El repo anterior
> (`Starmise/About-Me-Website`, estética *Persona 5*) queda **solo como referencia de
> lectura**: no se edita ni se hace push ahí. Todo el trabajo nuevo va en este repo.

- **Repo:** https://github.com/Starmise/Starmise-Interactive-Portfolio (rama `main`)
- **Copia local del usuario (Windows):**
  `C:\Users\Lu1sR\Documents\VisualStudioProjects\Starmise-Interactive-Portfolio`
- **Portafolio original (referencia):** https://github.com/Starmise/About-Me-Website —
  en vivo en https://starmise.github.io/About-Me-Website/

## Flujo de trabajo con Git (importante)

- **El usuario hace los `git push` él mismo.** Claude nunca debe hacer push.
- Claude puede preparar los cambios en la copia local; hacer `git add`/`git commit` solo
  si el usuario lo pide. Por defecto, dejar los cambios sin commitear y sugerir un mensaje
  de commit para que el usuario lo haga.
- Al trabajar en la copia local desde una sesión en la nube, incluso `git status` puede dejar
  `.git/index.lock` si no hay permiso de borrado en la carpeta; si pasa, apartarlo
  (`mv .git/index.lock .git/stale-index-lock`) o pedir permiso de borrado.

## Plan del proyecto → `PLAN.md`

**Leer `PLAN.md` antes de trabajar.** Contiene la visión (portafolio jugable estilo
*survival horror* de PS1), las decisiones, las fases con casillas, el pipeline del personaje
y el diseño técnico. Al terminar tareas, marcar sus casillas y anotar cambios de rumbo en su
"Registro de decisiones".

**Copias en el proyecto de Claude ("Starmise Portfolio").** `PLAN.md` y este `CLAUDE.md`
tienen copia en los documentos del proyecto (`claude/interactive-portfolio-plan.md` y
`claude/interactive-portfolio-context.md`), que es lo que ven las sesiones nuevas aunque no
estén vinculadas a la computadora. **Cada vez que se modifique `PLAN.md` o `CLAUDE.md`,
subir también el contenido completo actualizado a su documento del proyecto**
(`project_write` a la misma ruta). Si difieren, manda la versión del repo.

Resumen de decisiones: tercera persona con cámaras fijas · Three.js vanilla · Vite
(`base: './'`) · salas modeladas en Blender con convención de nombres (`COL_`, `CAM_`,
`TRG_CAM_`, `INT_<id>`, `DOOR_`, `SPAWN_`) · todo el texto sale de `src/data/` ·
GitHub Pages vía Actions (`.github/workflows/deploy.yml`: `npm ci` → `npm run build` → sube `dist/`).
No usar assets, logos, fuentes ni sonidos de Capcom/Resident Evil: solo se evoca el estilo.

## Estado actual

Fases 0–5 completadas (salvo la textura final del personaje, la galería real y medir 60 fps en un
portátil real). Hay **seis salas**
(mansión): Hall (vitrina con los 4 destacados, diario con la bio, TV con el DemoReel), Ala Unreal
(cuadros), Ala Unity (escritorios con CRT), Laboratorio (estaciones CRT), Sala de juegos (máquinas
arcade) y Sala de guardado (contacto y curiosidades); cada proyecto es un objeto con su portada. Hay
título con carga, menú de pausa (inventario, mapa, opciones), fichas navegables (con galería y video),
soporte de mando y táctil, **modo lista** (HTML sin 3D; `#lista` en la URL), sugerencia de modo lista en
equipos lentos y movimiento reducido. **Pendiente (TODO del usuario):** textura final del personaje y
exportar `player.glb` desde Blender con `Idle`/`Walk`/`Run` (PLAN.md §5) — el actual es **provisional**
(solo `Walk`); imágenes finales de los proyectos e imágenes reales para `profile.gallery` (hoy
`GalleryExample*`); comprobar 60 fps con F3 en un portátil medio. Siguiente: revisar las salas con el
usuario y la Fase 6 (audio, meta tags, pruebas en navegadores, publicación).

Controles: WASD/flechas o stick mover · Shift/X correr · E/Enter/A examinar y abrir puertas ·
Esc/Tab/Start menú · M/Select mapa · I inventario · Q/E o LB/RB pestañas y fichas · F3 (o `º`)
depuración (colisiones, triggers, fps, draw calls, triángulos). Táctil: joystick en la mitad izquierda
(al borde corre), botón de acción, Mapa y ☰. En la consola del navegador, `__game` expone el estado
(`__game.stats`: fps, draw calls, triángulos).

## Comandos

```bash
npm install      # o npm ci
npm run dev      # servidor local con recarga
npm run build    # genera dist/
npm run preview  # sirve dist/ para probar el build
npm run images   # regenera public/img/*.webp y public/img/thumb/ desde art/img/ (usa sharp)
npm run budget   # tras el build: carga inicial y triángulos/draw calls por sala vs. presupuestos
blender -b -P art/rooms/build_rooms.py [-- hall lab …]   # regenera las salas (.blend + .glb)
```

## Estructura

```
index.html         Punto de entrada de Vite (HUD + contenedor de UI)
vite.config.js     base './', salida en dist/
package.json       three + three-mesh-bvh + vite (+ sharp, solo para npm run images)
scripts/optimize-images.mjs  art/img/* → public/img/<nombre>.webp (≤1280 px) + public/img/thumb/ (≤256 px)
scripts/check-budgets.mjs    npm run budget: presupuestos de la Fase 5
.github/workflows/deploy.yml  Deploy a GitHub Pages
public/            Se copia tal cual a dist/
  img/             Imágenes WebP generadas (~1.2 MB); los JSON las referencian como img/<nombre>.webp
  img/thumb/       Miniaturas ≤256 px (texturas de portada en las salas, galerías)
  models/player.glb  Personaje (PROVISIONAL: textura placeholder, solo la caminata "Walk")
  models/rooms/    hall, unreal_wing, unity_wing, lab, game_room, save_room (.glb, de build_rooms.py)
src/
  main.js          Arranque ligero: #lista o sin WebGL → modo lista; si no, importa game.js
  shell.js         Compartido arranque/juego sin Three.js: capacidades del equipo y modo lista (#lista)
  game.js          El juego y su bucle: título, salas, transiciones, interacción, pausa
  style.css        HUD, título, menú de pausa, fichas "Archivo", táctil y modo lista
  core/input.js    Teclado + mando (Gamepad API) + táctil: acciones de juego y de menú
  core/settings.js Opciones del jugador (localStorage) con suscripción a cambios
  core/motion.js   Movimiento reducido (sistema u opción) → clase reduce-motion
  core/capabilities.js  WebGL 2, render por software, poca memoria, ahorro de datos
  core/perfMonitor.js   FPS jugando; avisa si el equipo va lento
  core/assets.js   Rutas de miniaturas (thumbUrl) y de YouTube (miniatura, embed)
  render/ps1Material.js  Vertex snapping + mapeo afín (onBeforeCompile), conversión a Lambert
  render/ps1Renderer.js  Render a 240 px + post-proceso 15 bits con dithering
  world/roomManager.js   rooms.json → carga/caché de salas, precarga de vecinas
  world/loadRoom.js      Carga un GLB de sala e interpreta COL_/CAM_/TRG_CAM_/INT_/DOOR_/SPAWN_ y las portadas
  world/videoScreen.js   Pantalla de TV animada (DemoReel) como CanvasTexture
  world/collision.js     Cápsula contra COL_* con three-mesh-bvh
  world/cameraDirector.js  Cámara activa según TRG_CAM_* (con histéresis)
  world/interaction.js   Qué INT_/DOOR_ está al alcance y de frente
  world/doorTransition.js  Animación de puerta / fundido que oculta la carga
  player/loadPlayer.js   Carga el GLB del personaje, materiales PS1, quita root motion horizontal
  player/playerController.js  Movimiento (moderno/tanque, analógico), colisión, animación, TUNING
  ui/uiStack.js    Pila de capas de UI y navegación (teclado/mando)
  ui/titleScreen.js  Carga + título + menú principal
  ui/pauseMenu.js  Inventario, mapa y opciones
  ui/fileView.js   Documento "Archivo" (fichas de proyecto y del perfil)
  ui/documents.js  Convierte projects.json/profile.json en documentos; resuelve INT_<id>
  ui/hud.js        Prompt "Examinar/Abrir", ayuda de controles, avisos
  ui/listView.js   Modo lista: todo el portafolio en HTML accesible (sin Three.js)
  ui/touchControls.js  Joystick virtual y botones en pantalla
  ui/suggestDialog.js  Diálogo de dos opciones (sugerir el modo lista)
  data/
    projects.json  FUENTE ÚNICA de los proyectos (22, con su sala en `room`)
    profile.json   Bio, estudio, DemoReel, habilidades, "qué hago", curiosidades, galería, contacto
    rooms.json     Salas: nombre, descripción, GLB (null = aún no construida), niebla y luz ambiente
    README.md      Esquema de los JSON y script de validación
art/character/     Fuentes del personaje (no se publican)
  PSX_Char_Male_Base.fbx            Personaje PS1 (19 huesos, caminata de Mixamo, sin textura)
  PSX_Char_Male_UV_1024.png         Plantilla de UVs para pintar la textura
  PSX_Char_Male_Placeholder_1024.png / _256.png  Textura placeholder (base para pintar encima)
art/img/           Imágenes originales en alta (~33 MB; fuente de npm run images, no se publican)
art/rooms/
  build_rooms.py     Script de Blender que genera las seis salas (.blend + .glb)
  <sala>.blend       Fuentes editables (guardadas con Blender 5.2)
CLAUDE.md          Este archivo
PLAN.md            Plan del proyecto (fases, decisiones, diseño técnico)
```

La estructura objetivo (con `public/`, `art/`, etc.) está en `PLAN.md` §7.

## Notas y trampas conocidas

- Las imágenes de `profile.gallery` (`GalleryExample*`) son marcadores de posición
  heredados del original (aún no se muestran en el juego).
- Imágenes: el original va en `art/img/`, se corre `npm run images` y el JSON usa `img/<nombre>.webp`.
  La miniatura (`img/thumb/<nombre>.webp`) se deriva sola con `thumbUrl()`.
- Con el *vertex snapping*, dos superficies a pocos cm "pelean" en profundidad. Por eso el cascarón de
  cada sala (`Room_Shell*`) se dibuja con *polygon offset*; para objetos pegados entre sí (que no sean
  el cascarón), separarlos ≥3 cm.
- `.gitattributes` normaliza los finales de línea a LF. En el repo original, Windows mostraba
  casi todos los archivos como modificados solo por CRLF/LF; aquí no debería pasar.
- Las sesiones en la nube trabajan en la copia local desde una VM Linux: **no dejar
  `node_modules/` instalado desde ahí** (los binarios nativos de Vite/rolldown serían de Linux
  y `npm run dev` fallaría en Windows). Si se instala para probar, borrarlo al terminar.
- La herramienta para escribir archivos en la copia local trata `.github/` como protegido:
  el workflow lo coloca el usuario a mano.
- Los `.blend` de `art/rooms/` se guardaron con Blender 5.2; si tu Blender es más viejo y no lo abre, corre
  `art/rooms/build_rooms.py` desde tu Blender (pestaña Scripting) para regenerarlos. Ojo: el script
  reconstruye las salas desde cero; si editas un `.blend` a mano, exporta su GLB tú y no regeneres esa sala.
- Para probar en la nube: Blender está disponible como módulo (`pip install bpy`) y el Chromium
  preinstalado sirve con Playwright (`executablePath: '/opt/pw-browsers/chromium'`, flags de swiftshader).
  Google Fonts no carga desde ahí; no es un error del proyecto.
- Tras cambiar `package.json` (p. ej. al añadir `sharp`), correr `npm install` en Windows antes de
  `npm run dev`.
- El modo lista se enlaza directo con `…/#lista` (útil para reclutadores). Cualquier texto nuevo del
  portafolio va en `src/data/` y aparece solo en el juego y en el modo lista.
- En la nube, Chromium dibuja por software: el título muestra el aviso de "equipo lento" y a los ~10 s
  de juego aparece la sugerencia de modo lista. Para pruebas, guardar
  `localStorage['starmise.settings'] = '{"perfHint":false}'` antes de cargar.
