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

## Estado actual

Solo están migrados los **datos y las imágenes**; aún no hay código de la escena 3D ni
`package.json`. Concepto previsto: una escena/sala 3D donde cada objeto (consola, TV,
cartuchos…) abre un proyecto leído desde `projects.json`, más un enlace a la versión clásica
para accesibilidad y móviles lentos.

- **Stack 3D:** pendiente de decidir — **Three.js** (JS vanilla + bundler, como el original
  usaba Parcel 2) o **React Three Fiber**. Al decidirlo, actualizar esta sección y "Comandos".
- **Despliegue:** pendiente. Plan: GitHub Pages vía GitHub Actions, adaptando el
  `deploy.yml` del repo original (build → `dist/` → `actions/upload-pages-artifact` +
  `actions/deploy-pages`; *Settings → Pages → Source = GitHub Actions*). Como el sitio
  vivirá en el subpath `/Starmise-Interactive-Portfolio/`, **las rutas deben ser relativas**
  (con Parcel `--public-url ./`; con Vite `base: './'`). No añadir el workflow hasta que
  exista un `npm run build` que funcione, o el primer push fallará.
- Idea: renombrar este repo a `Starmise.github.io` para servirlo en
  `https://starmise.github.io/` (el original seguiría en `/About-Me-Website/`).

## Estructura

```
src/
  data/
    projects.json  FUENTE ÚNICA de los proyectos (22, copiados del original)
    profile.json   Bio, estudio, DemoReel, habilidades, "qué hago", curiosidades, galería, contacto
    README.md      Esquema de ambos JSON y script de validación
  img/             Portadas e imágenes (33 archivos, ~33 MB)
CLAUDE.md          Este archivo
```

Si al elegir el bundler los assets deben moverse (p. ej. a `public/` con Vite), actualizar
las rutas de los JSON o el mapeo correspondiente, y esta sección.

## Notas y trampas conocidas

- Las imágenes de `profile.gallery` (`GalleryExample*.png`) son marcadores de posición
  heredados del original.
- `.gitattributes` normaliza los finales de línea a LF. En el repo original, Windows mostraba
  casi todos los archivos como modificados solo por CRLF/LF; aquí no debería pasar.
- Las imágenes pesan bastante (~33 MB). Para la versión 3D conviene generar versiones
  optimizadas (WebP/AVIF, texturas más pequeñas) en lugar de cargar las originales.
