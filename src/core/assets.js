/**
 * Rutas de las imágenes optimizadas (las genera `npm run images`, ver scripts/optimize-images.mjs).
 *
 *   img/<nombre>.webp        versión web (fichas, máx. 1280 px) — la que aparece en los JSON
 *   img/thumb/<nombre>.webp  miniatura (máx. 256 px) — texturas de las salas y galerías
 */
export function thumbUrl(path) {
  if (!path || /^(https?:|data:)/.test(path)) return path;
  return path.replace(/^(.*?img\/)(?:thumb\/)?([^/]+)\.\w+$/, '$1thumb/$2.webp');
}

/** Miniatura del video de YouTube (4:3 con franjas, 480×360). */
export function youtubeThumb(youtubeId) {
  return `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`;
}

/** URL para incrustar un video de YouTube (sin cookies hasta reproducir). */
export function youtubeEmbed(video, { autoplay = true } = {}) {
  const base = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.youtubeId)}`;
  return `${base}?rel=0&playsinline=1${autoplay ? '&autoplay=1' : ''}`;
}
