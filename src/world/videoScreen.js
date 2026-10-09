import * as THREE from 'three';
import { reducedMotion } from '../core/motion.js';

const W = 128;
const H = 96;
const FPS = 12;

/**
 * Pantalla de TV animada (128×96) para el DemoReel: la miniatura del video (o una pantalla
 * azul de VCR si no se puede cargar) con estática, líneas de barrido y el "▶ PLAY" parpadeando.
 *
 * Con movimiento reducido no hay estática ni parpadeo (solo la imagen y "▶ PLAY" fijo).
 *
 * `thumbnail`: URL de la imagen. Se pide con CORS; si el servidor no lo permite, se queda la
 * pantalla azul (sin "ensuciar" el canvas). Devuelve { texture, update(dt) }.
 */
export function createVideoScreen({ thumbnail, label = 'DEMO REEL' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false; // las UV vienen de glTF

  let image = null;
  if (thumbnail) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => (image = img);
    img.src = thumbnail;
  }

  let time = 0;
  let acc = 1;
  let frame = 0;

  function draw() {
    frame++;
    if (image) {
      // Recorte "cover" a 4:3.
      const s = Math.max(W / image.naturalWidth, H / image.naturalHeight);
      const w = image.naturalWidth * s;
      const h = image.naturalHeight * s;
      ctx.drawImage(image, (W - w) / 2, (H - h) / 2, w, h);
    } else {
      ctx.fillStyle = '#1636a8';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e8ecff';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, W / 2, H / 2 + 4);
    }
    const calm = reducedMotion();
    // Líneas de barrido.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = calm ? 0 : frame % 2; y < H; y += 2) ctx.fillRect(0, y, W, 1);
    // Banda de estática que baja lentamente, como un VHS gastado.
    const band = calm ? -100 : Math.floor((time * 18) % (H + 16)) - 8;
    for (let y = band; y < band + 6; y++) {
      if (y < 0 || y >= H) continue;
      for (let x = 0; x < W; x += 2) {
        const v = (Math.random() * 255) | 0;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 1);
      }
    }
    // OSD del VCR.
    if (calm || Math.floor(time * 1.5) % 2 === 0) {
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#000';
      ctx.fillText('▶ PLAY', 7, 15);
      ctx.fillStyle = '#7dff8a';
      ctx.fillText('▶ PLAY', 6, 14);
    }
    texture.needsUpdate = true;
  }

  return {
    texture,
    update(dt) {
      time += dt;
      acc += dt;
      if (acc < 1 / FPS) return;
      acc = 0;
      draw();
    },
  };
}
