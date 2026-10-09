/**
 * Genera las versiones web de las imágenes del portafolio.
 *
 *   art/img/<nombre>.<png|jpg|jpeg|webp>   originales en alta (no se publican)
 *     → public/img/<nombre>.webp          fichas y UI (máx. 1280 px, WebP calidad 80)
 *     → public/img/thumb/<nombre>.webp    texturas de las salas (máx. 256 px)
 *
 * Uso:  npm run images            (solo regenera lo que cambió)
 *       npm run images -- --force (lo regenera todo)
 *
 * Los JSON de src/data/ apuntan a img/<nombre>.webp; el juego deriva la miniatura con
 * thumbUrl() (src/core/assets.js). Para añadir una imagen: copiarla a art/img/, correr
 * este script y usar "img/<nombre>.webp" en el JSON.
 */
import { readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'art', 'img');
const OUT = path.join(ROOT, 'public', 'img');
const THUMB = path.join(OUT, 'thumb');
const FORCE = process.argv.includes('--force');

const VARIANTS = [
  { dir: OUT, max: 1280, quality: 80 },
  { dir: THUMB, max: 256, quality: 82 },
];

const mtime = (file) => stat(file).then((s) => s.mtimeMs, () => 0);
const kb = (n) => `${(n / 1024).toFixed(0)} kB`;

await mkdir(THUMB, { recursive: true });
const files = (await readdir(SRC)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
let before = 0;
let after = 0;
let done = 0;

for (const file of files) {
  const src = path.join(SRC, file);
  const name = file.replace(/\.[^.]+$/, '');
  const srcTime = await mtime(src);
  before += (await stat(src)).size;
  for (const v of VARIANTS) {
    const out = path.join(v.dir, `${name}.webp`);
    if (FORCE || (await mtime(out)) < srcTime) {
      await sharp(src)
        .rotate() // respeta la orientación EXIF
        .resize({ width: v.max, height: v.max, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: v.quality, effort: 5 })
        .toFile(out);
      done++;
    }
    if (v.dir === OUT) after += (await stat(out)).size;
  }
}

console.log(`${files.length} imágenes · ${done} archivos generados · ${kb(before)} → ${kb(after)} (sin contar miniaturas)`);
