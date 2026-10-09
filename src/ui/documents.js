import { youtubeThumb } from '../core/assets.js';

/**
 * Convierte los datos (projects.json, profile.json) en "documentos" que muestra FileView.
 * Ningún texto del portafolio se escribe aquí: solo etiquetas de la interfaz.
 *
 * Documento: { kicker, title, tagline?, image?, imageAlt?, video?: { youtubeId, embedUrl?, poster },
 *              sections: [{ heading, paragraphs?, items? }], gallery?: string[], tags?,
 *              links?: [{ label, href }] }
 */
export function projectDocument(project, index) {
  return {
    kicker: `Archivo Nº ${String(index + 1).padStart(3, '0')}`,
    title: project.title,
    tagline: project.tagline,
    image: project.cover,
    imageAlt: `Portada de ${project.title}`,
    sections: [
      { heading: 'Descripción', paragraphs: [project.description] },
      { heading: 'Proceso', paragraphs: [project.process] },
      { heading: 'Mi rol', paragraphs: [project.role] },
    ].filter((s) => s.paragraphs.every(Boolean)),
    gallery: project.gallery ?? [],
    tags: project.tags ?? [],
    links: project.externalLink ? [{ label: project.externalLabel || 'Ver proyecto', href: project.externalLink }] : [],
  };
}

/** Tarjetas "Qué hago" de profile.json. */
export function whatIDoDocument(item) {
  return {
    kicker: 'Qué hago',
    title: item.title,
    image: item.image,
    imageAlt: '',
    sections: [{ heading: 'Notas', paragraphs: [item.text] }],
  };
}

/** Documentos del perfil que pueden colocarse en una sala con INT_<id>. */
export const PROFILE_DOCUMENTS = {
  about: (p) => ({
    kicker: 'Diario',
    title: `${p.name} — ${p.alias}`,
    tagline: p.title,
    image: p.logo,
    imageAlt: `Logo de ${p.alias}`,
    sections: [
      { heading: '¿Quién soy?', paragraphs: p.about },
      p.studio && { heading: 'Estudio actual', paragraphs: [p.studio.name] },
    ].filter(Boolean),
    links: [
      p.demoReel && { label: 'Ver DemoReel', href: `https://www.youtube.com/watch?v=${p.demoReel.youtubeId}` },
    ].filter(Boolean),
    promptLabel: 'Diario',
  }),
  contact: (p) => ({
    kicker: 'Máquina de escribir',
    title: 'Contacto',
    tagline: `${p.name} · ${p.title}`,
    sections: [],
    links: p.contact.map((c) => ({ label: c.label, href: c.url })),
    linkLayout: 'list',
    promptLabel: 'Máquina de escribir',
  }),
  demoreel: (p) => ({
    kicker: 'Videocasete',
    title: p.demoReel.title,
    tagline: `${p.name} · ${p.title}`,
    video: { ...p.demoReel, poster: p.demoReel.thumbnail ?? youtubeThumb(p.demoReel.youtubeId) },
    sections: [],
    links: [{ label: 'Ver en YouTube', href: `https://www.youtube.com/watch?v=${p.demoReel.youtubeId}` }],
    promptLabel: 'DemoReel',
    verb: 'Ver',
  }),
  trivia: (p) => ({
    kicker: 'Libreta',
    title: 'Curiosidades',
    image: p.trivia?.image,
    imageAlt: '',
    sections: [{ heading: 'Notas', items: p.trivia?.items ?? [] }],
    promptLabel: 'Libreta',
  }),
};

/**
 * Resuelve el id de un INT_ a { kind, label, verb?, project?, video?, document() }, o null si no existe.
 * `video` (solo documentos con video): { thumbnail, label } para la pantalla de TV de la sala.
 */
export function resolveInteractable(id, { projects, profile }) {
  const index = projects.findIndex((p) => p.id === id);
  if (index >= 0) {
    const project = projects[index];
    return { kind: 'project', label: project.title, project, document: () => projectDocument(project, index) };
  }
  const make = PROFILE_DOCUMENTS[id];
  if (make) {
    const doc = make(profile);
    return {
      kind: 'profile',
      label: doc.promptLabel ?? doc.title,
      verb: doc.verb,
      video: doc.video && { thumbnail: doc.video.poster, label: 'DEMO REEL' },
      document: () => doc,
    };
  }
  return null;
}
