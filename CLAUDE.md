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
`TRG_CAM_`, `INT_<projectId>`, `DOOR_`, `SPAWN_`) · todo el texto sale de `src/data/` ·
GitHub Pages vía Actions (`.github/workflows/deploy.yml`: `npm ci` → `npm run build` → sube `dist/`).
No usar assets, logos, fuentes ni sonidos de Capcom/Resident Evil: solo se evoca el estilo.

## Estado actual

Fases 0 y 1 completadas (salvo la textura final del personaje). **Fase 2 implementada, pendiente de
revisión con el usuario:** sala de prueba en L con render PS1, controlador (moderno + tanque),
colisiones, 3 cámaras fijas y 4 pedestales `INT_` que abren la ficha del proyecto. **Pendiente (TODO
del usuario):** textura final del personaje y exportar `player.glb` desde Blender con `Idle`/`Walk`/`Run`
(PLAN.md §5). El `player.glb` actual es **provisional** (solo `Walk`). Siguiente: ajustes de la
revisión y Fase 3.

Controles del prototipo: WASD/flechas mover · Shift correr · E examinar · C cambiar controles ·
P efectos PS1 · F3 (o `º`) depuración. En la consola del navegador, `__game` expone el estado.

## Comandos

```bash
npm install      # o npm ci
npm run dev      # servidor local con recarga
npm run build    # genera dist/
npm run preview  # sirve dist/ para probar el build
```

## Estructura

```
index.html         Punto de entrada de Vite (HUD + contenedor de UI)
vite.config.js     base './', salida en dist/
package.json       three + three-mesh-bvh + vite
.github/workflows/deploy.yml  Deploy a GitHub Pages
public/            Se copia tal cual a dist/
  img/             Portadas e imágenes (33 archivos, ~33 MB); los JSON las referencian como img/...
  models/player.glb  Personaje (PROVISIONAL: textura placeholder, solo la caminata "Walk")
  models/rooms/test_room.glb  Sala de prueba de la Fase 2 (generada por art/rooms/build_test_room.py)
src/
  main.js          Arranque y bucle: carga sala + jugador, cámaras, interacción, toggles
  style.css        HUD y ficha "Archivo"
  core/input.js    Teclado (acciones mantenidas y pulsaciones)
  render/ps1Material.js  Vertex snapping + mapeo afín (onBeforeCompile), conversión a Lambert
  render/ps1Renderer.js  Render a 240 px + post-proceso 15 bits con dithering
  world/loadRoom.js      Carga un GLB de sala e interpreta COL_/CAM_/TRG_CAM_/INT_/SPAWN_/DOOR_
  world/collision.js     Cápsula contra COL_* con three-mesh-bvh
  world/cameraDirector.js  Cámara activa según TRG_CAM_* (con histéresis)
  world/interaction.js   Qué INT_ está al alcance y de frente
  player/loadPlayer.js   Carga el GLB del personaje, materiales PS1, quita root motion horizontal
  player/playerController.js  Movimiento (moderno/tanque), colisión, animación Idle/Walk/Run, TUNING
  ui/fileView.js   Ficha del proyecto (diálogo HTML accesible)
  ui/hud.js        Prompt "Examinar", ayuda de controles, avisos
  data/
    projects.json  FUENTE ÚNICA de los proyectos (22, copiados del original)
    profile.json   Bio, estudio, DemoReel, habilidades, "qué hago", curiosidades, galería, contacto
    README.md      Esquema de ambos JSON y script de validación
art/character/     Fuentes del personaje (no se publican)
  PSX_Char_Male_Base.fbx            Personaje PS1 (19 huesos, caminata de Mixamo, sin textura)
  PSX_Char_Male_UV_1024.png         Plantilla de UVs para pintar la textura
  PSX_Char_Male_Placeholder_1024.png / _256.png  Textura placeholder (base para pintar encima)
art/rooms/
  build_test_room.py  Script de Blender que genera la sala de prueba (.blend + .glb)
  test_room.blend     Fuente editable de la sala (guardado con Blender 5.2)
CLAUDE.md          Este archivo
PLAN.md            Plan del proyecto (fases, decisiones, diseño técnico)
```

La estructura objetivo (con `public/`, `art/`, etc.) está en `PLAN.md` §7.

## Notas y trampas conocidas

- Las imágenes de `profile.gallery` (`GalleryExample*.png`) son marcadores de posición
  heredados del original.
- `.gitattributes` normaliza los finales de línea a LF. En el repo original, Windows mostraba
  casi todos los archivos como modificados solo por CRLF/LF; aquí no debería pasar.
- Las sesiones en la nube trabajan en la copia local desde una VM Linux: **no dejar
  `node_modules/` instalado desde ahí** (los binarios nativos de Vite/rolldown serían de Linux
  y `npm run dev` fallaría en Windows). Si se instala para probar, borrarlo al terminar.
- La herramienta para escribir archivos en la copia local trata `.github/` como protegido:
  el workflow lo coloca el usuario a mano.
- `test_room.blend` se guardó con Blender 5.2; si tu Blender es más viejo y no lo abre, corre
  `art/rooms/build_test_room.py` desde tu Blender (pestaña Scripting) para regenerarlo.
- Para probar en la nube: Blender está disponible como módulo (`pip install bpy`) y el Chromium
  preinstalado sirve con Playwright (`executablePath: '/opt/pw-browsers/chromium'`, flags de swiftshader).
  Google Fonts no carga desde ahí; no es un error del proyecto.
- Las imágenes pesan bastante (~33 MB). Para la versión 3D conviene generar versiones
  optimizadas (WebP/AVIF, texturas más pequeñas) en lugar de cargar las originales.
