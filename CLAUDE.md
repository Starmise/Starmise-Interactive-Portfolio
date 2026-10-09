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

Resumen de decisiones: tercera persona con cámaras fijas · Three.js vanilla · Vite
(`base: './'`) · salas modeladas en Blender con convención de nombres (`COL_`, `CAM_`,
`TRG_CAM_`, `INT_<projectId>`, `DOOR_`, `SPAWN_`) · todo el texto sale de `src/data/` ·
GitHub Pages vía Actions (el workflow se añade cuando exista `npm run build`, si no el push falla).
No usar assets, logos, fuentes ni sonidos de Capcom/Resident Evil: solo se evoca el estilo.

## Estado actual

Fase 0 completada (datos, imágenes, modelo del personaje y plantilla UV). Siguiente: Fase 1
(Vite + Three.js, reorganizar carpetas, textura y GLB del personaje). Aún no hay código ni
`package.json`.

## Estructura

```
src/
  data/
    projects.json  FUENTE ÚNICA de los proyectos (22, copiados del original)
    profile.json   Bio, estudio, DemoReel, habilidades, "qué hago", curiosidades, galería, contacto
    README.md      Esquema de ambos JSON y script de validación
  img/             Portadas e imágenes (33 archivos, ~33 MB)
  ps1psx-character-basemesh-male/
    source/PSX_Char_Male_Base.fbx      Personaje PS1 (19 huesos, caminata de Mixamo, sin textura)
    textures/PSX_Char_Male_UV_1024.png Plantilla de UVs para pintar la textura
CLAUDE.md          Este archivo
PLAN.md            Plan del proyecto (fases, decisiones, diseño técnico)
```

La estructura objetivo (con `public/`, `art/`, etc.) está en `PLAN.md` §7.

## Notas y trampas conocidas

- Las imágenes de `profile.gallery` (`GalleryExample*.png`) son marcadores de posición
  heredados del original.
- `.gitattributes` normaliza los finales de línea a LF. En el repo original, Windows mostraba
  casi todos los archivos como modificados solo por CRLF/LF; aquí no debería pasar.
- Las imágenes pesan bastante (~33 MB). Para la versión 3D conviene generar versiones
  optimizadas (WebP/AVIF, texturas más pequeñas) en lugar de cargar las originales.
