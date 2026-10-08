# Datos del portafolio

Toda la información del portafolio vive en estos dos JSON. La escena 3D y cualquier vista
alternativa deben **leer de aquí** en lugar de tener textos escritos a mano en el código.

- `projects.json` — los proyectos (copiado del portafolio original `About-Me-Website`).
- `profile.json` — datos personales: bio, estudio, DemoReel, habilidades, "qué hago",
  curiosidades, galería y contacto (extraídos de `IndexP3.html` e `indexMin.html` del original).

Las rutas de imágenes son relativas a `src/` (p. ej. `img/LucioGalaxyMain.png`).

## `projects.json`

Es un **array** de objetos:

| Campo           | Tipo       | Obligatorio | Descripción |
|-----------------|------------|-------------|-------------|
| `id`            | `string`   | Sí          | Identificador único en `kebab-case`. Sin espacios ni repeticiones. |
| `title`         | `string`   | Sí          | Nombre visible del proyecto. |
| `cover`         | `string`   | Sí          | Ruta de la portada (p. ej. `img/LucioGalaxyMain.png`). |
| `tagline`       | `string`   | No          | Frase corta de gancho. |
| `tags`          | `string[]` | No          | Tecnologías/roles (chips, filtros). Puede ir vacío `[]`. |
| `description`   | `string`   | Sí          | Descripción del proyecto. |
| `process`       | `string`   | Sí          | Contexto de desarrollo y aportación personal. |
| `role`          | `string`   | No          | Resumen breve del rol, derivado de `process`. |
| `gallery`       | `string[]` | No          | Imágenes adicionales. Puede ir vacío `[]`. |
| `externalLink`  | `string`   | No          | URL externa para jugar/ver el proyecto (itch.io, Drive, etc.). |
| `externalLabel` | `string`   | No          | Texto del botón hacia `externalLink`. |
| `featured`      | `boolean`  | No          | Si es `true`, el proyecto se destaca. Por defecto `false`. |

Los textos `description` y `process` se migraron verbatim de las páginas originales
(incluidas sus erratas); se pueden corregir libremente aquí.

## `profile.json`

| Campo         | Contenido |
|---------------|-----------|
| `name`, `alias`, `title`, `subtitle`, `logo` | Identidad y logo (`img/BMI.png`). |
| `about`       | Párrafos de "¿Quién soy?". |
| `studio`      | Estudio actual (`Little Blossom Studio`) y su icono. |
| `demoReel`    | Video de YouTube (`youtubeId`, `embedUrl`). |
| `skills`      | Lista de habilidades. |
| `whatIDo`     | Tarjetas `{ title, image, text }` de la versión corta. |
| `trivia`      | Curiosidades `{ image, items[] }`. |
| `gallery`     | Imágenes de la galería. **Ojo:** son marcadores de posición (`GalleryExample*.png`) heredados del original. |
| `contact`     | Enlaces `{ label, type, url }`. |
| `classicSite` | URL del portafolio original, para enlazarlo como "versión clásica". |

## Añadir o editar contenido

1. Copiar imágenes nuevas a `src/img/`.
2. Editar el JSON correspondiente (sin comas finales; `id` único en `projects.json`).
3. Validar ambos archivos y que no falten imágenes:

```bash
node -e "const p=require('./src/data/projects.json'),f=require('./src/data/profile.json'),fs=require('fs');const r=[...p.flatMap(x=>[x.cover,...(x.gallery||[])]),f.logo,f.studio.icon,...f.whatIDo.map(w=>w.image),f.trivia.image,...f.gallery];console.log('faltantes:',r.filter(x=>!fs.existsSync('src/'+x)))"
```
