/**
 * Iconos del sitio a partir de public/favicon.svg (estrella pixel art de 16×16):
 *
 *   public/favicon-32.png        pestaña del navegador (navegadores sin SVG)
 *   public/apple-touch-icon.png  180×180, pantalla de inicio de iOS (fondo opaco)
 *   public/icon-192.png          manifest (Android)
 *   public/icon-512.png          manifest; con margen suficiente para usarse como "maskable"
 *
 * Uso: npm run icons   (después de editar favicon.svg)
 * Se escala sin suavizado (vecino más cercano) para conservar los píxeles.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const BG = '#0b0b0d';
const svg = await readFile(path.join(PUBLIC, 'favicon.svg'));

/** El SVG a 16×16 px exactos, para escalarlo después sin suavizado. */
const base = await sharp(svg, { density: 72 }).resize(16, 16, { kernel: 'nearest' }).png().toBuffer();

async function icon(file, size, scale) {
  const art = await sharp(base).resize(16 * scale, 16 * scale, { kernel: 'nearest' }).png().toBuffer();
  const out = path.join(PUBLIC, file);
  if (size === 16 * scale) {
    await sharp(art).png({ compressionLevel: 9 }).toFile(out);
  } else {
    // Centrado sobre fondo opaco (iOS y Android recortan las esquinas a su manera).
    const pad = Math.round((size - 16 * scale) / 2);
    await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
      .composite([{ input: art, left: pad, top: pad }])
      .png({ compressionLevel: 9 })
      .toFile(out);
  }
  console.log(`  ${file} (${size}×${size})`);
}

console.log('Iconos:');
await icon('favicon-32.png', 32, 2);
await icon('apple-touch-icon.png', 180, 9);
await icon('icon-192.png', 192, 10);
await icon('icon-512.png', 512, 24);
