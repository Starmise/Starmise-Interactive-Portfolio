import { settings, setSetting } from '../core/settings.js';
import { focusFirst } from './uiStack.js';
import { PROFILE_DOCUMENTS, projectDocument, whatIDoDocument } from './documents.js';

const TABS = [
  { id: 'inventory', label: 'Inventario' },
  { id: 'map', label: 'Mapa' },
  { id: 'options', label: 'Opciones' },
];

/**
 * Menú de pausa: Inventario (habilidades y archivos personales), Mapa (salas y proyectos;
 * abre fichas o viaja a una sala) y Opciones. Capa de la UiStack.
 */
export class PauseMenu {
  constructor(root, stack, { fileView, projects, profile, rooms, getCurrentRoom, onTravel, onTitle }) {
    Object.assign(this, { stack, fileView, projects, profile, rooms, getCurrentRoom, onTravel, onTitle });
    this.tab = 'inventory';

    this.el = document.createElement('div');
    this.el.className = 'pause';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="pause__panel" role="dialog" aria-modal="true" aria-label="Menú de pausa" tabindex="-1">
        <header class="pause__head">
          <span class="pause__hint" aria-hidden="true">Q ◂</span>
          <div class="pause__tabs" role="tablist"></div>
          <span class="pause__hint" aria-hidden="true">▸ E</span>
        </header>
        <div class="pause__body"></div>
        <footer class="pause__foot"><span data-hint></span><button type="button" class="pause__resume">Continuar</button></footer>
      </div>
    `;
    root.appendChild(this.el);
    this.panel = this.el.querySelector('.pause__panel');
    this.tabsEl = this.el.querySelector('.pause__tabs');
    this.body = this.el.querySelector('.pause__body');
    this.hint = this.el.querySelector('[data-hint]');
    this.el.querySelector('.pause__resume').addEventListener('click', () => this.close());

    for (const t of TABS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.role = 'tab';
      b.className = 'pause__tab';
      b.dataset.tab = t.id;
      b.textContent = t.label;
      b.addEventListener('click', () => this.show(t.id));
      this.tabsEl.append(b);
    }

    this.layer = {
      el: this.panel,
      onShow: () => {
        this.el.hidden = false;
        this.#render();
      },
      onHide: () => (this.el.hidden = true),
      onAction: (action) => {
        if (action === 'tabPrev' || action === 'tabNext') {
          const i = TABS.findIndex((t) => t.id === this.tab);
          const d = action === 'tabNext' ? 1 : -1;
          this.show(TABS[(i + d + TABS.length) % TABS.length].id);
          return true;
        }
        if (action === 'pause') {
          this.close();
          return true;
        }
        return false;
      },
    };
  }

  get isOpen() {
    return this.stack.layers.includes(this.layer);
  }

  open(tab = this.tab) {
    this.tab = tab;
    if (!this.isOpen) this.stack.push(this.layer);
    else this.#render();
  }

  close() {
    this.stack.pop(this.layer);
  }

  show(tab) {
    this.tab = tab;
    this.#render();
  }

  setDevice(device) {
    this.device = device;
    if (this.isOpen) this.#renderHint();
  }

  #render() {
    for (const b of this.tabsEl.children) {
      const on = b.dataset.tab === this.tab;
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;
    }
    this.body.replaceChildren(this.#build(this.tab));
    this.body.scrollTop = 0;
    this.#renderHint();
    focusFirst(this.body);
  }

  #renderHint() {
    this.hint.textContent = this.device === 'gamepad'
      ? 'LB/RB pestañas · Ⓐ aceptar · Ⓑ volver'
      : 'Q/E pestañas · ↑↓ elegir · Enter aceptar · Esc volver';
  }

  #build(tab) {
    if (tab === 'inventory') return this.#inventory();
    if (tab === 'map') return this.#map();
    return this.#options();
  }

  // ---------- Inventario ----------

  #inventory() {
    const p = this.profile;
    const frag = document.createDocumentFragment();
    frag.append(h('h2', 'Habilidades'));
    const grid = h('ul', null, 'inv-grid');
    p.skills.forEach((skill, i) => {
      const li = h('li', null, 'inv-slot');
      li.append(h('span', String(i + 1).padStart(2, '0'), 'inv-slot__n'), h('span', skill, 'inv-slot__label'));
      grid.append(li);
    });
    frag.append(grid);

    frag.append(h('h2', 'Archivos personales'));
    const list = h('div', null, 'pause__list');
    const docs = [
      PROFILE_DOCUMENTS.about(p),
      ...p.whatIDo.map(whatIDoDocument),
      PROFILE_DOCUMENTS.trivia(p),
      PROFILE_DOCUMENTS.contact(p),
    ];
    docs.forEach((doc, i) => {
      const label = doc.kicker === 'Qué hago' ? `Qué hago — ${doc.title}` : doc.title;
      list.append(button(label, () => this.fileView.open(doc, { docs, index: i })));
    });
    frag.append(list);
    return frag;
  }

  // ---------- Mapa ----------

  #map() {
    const frag = document.createDocumentFragment();
    const current = this.getCurrentRoom();
    for (const room of this.rooms) {
      const block = h('section', null, 'map-room');
      const head = h('div', null, 'map-room__head');
      const title = h('h2', room.name);
      head.append(title);
      if (room.id === current) head.append(h('span', 'Estás aquí', 'map-room__here'));
      else if (room.model) head.append(button('Ir', () => this.onTravel(room.id), 'map-room__go', `Ir a ${room.name}`));
      else head.append(h('span', 'Próximamente', 'map-room__soon'));
      block.append(head);
      if (room.description) block.append(h('p', room.description, 'map-room__desc'));

      const docs = this.#roomDocuments(room.id);
      if (docs.length) {
        const list = h('div', null, 'pause__list');
        docs.forEach((doc, i) => list.append(button(doc.title, () => this.fileView.open(doc, { docs, index: i }))));
        block.append(list);
      }
      frag.append(block);
    }
    return frag;
  }

  #roomDocuments(roomId) {
    const docs = (list) => list.map((p) => projectDocument(p, this.projects.indexOf(p)));
    if (roomId === 'hall') return docs(this.projects.filter((p) => p.featured));
    if (roomId === 'save-room') return [PROFILE_DOCUMENTS.contact(this.profile), PROFILE_DOCUMENTS.trivia(this.profile)];
    return docs(this.projects.filter((p) => p.room === roomId));
  }

  // ---------- Opciones ----------

  #options() {
    const frag = document.createDocumentFragment();
    const rows = h('div', null, 'opt-list');
    rows.append(
      toggleRow('Controles', 'mode', [['modern', 'Modernos'], ['tank', 'Clásicos (tanque)']]),
      toggleRow('Efectos PS1', 'ps1', [[true, 'Sí'], [false, 'No']]),
      toggleRow('Animación de puertas', 'doorAnim', [['full', 'Completa'], ['short', 'Rápida']]),
      sliderRow('Volumen', 'volume', 'Aún no hay audio: llegará en una próxima versión.'),
    );
    frag.append(rows);

    frag.append(h('h2', 'Controles'));
    const table = h('dl', null, 'controls-list');
    for (const [action, key, pad] of CONTROLS) {
      table.append(h('dt', action), h('dd', `${key}  ·  ${pad}`));
    }
    frag.append(table);

    const links = h('div', null, 'pause__list');
    const classic = document.createElement('a');
    classic.className = 'pause__item';
    classic.href = this.profile.classicSite;
    classic.target = '_blank';
    classic.rel = 'noopener';
    classic.textContent = 'Versión clásica del portafolio ↗';
    links.append(classic, button('Volver al título', () => this.onTitle()));
    frag.append(links);
    return frag;
  }
}

const CONTROLS = [
  ['Mover', 'WASD / flechas', 'stick izq. / cruceta'],
  ['Correr', 'Shift', 'X / □ / RB'],
  ['Examinar / abrir', 'E / Enter', 'A / ✕'],
  ['Menú', 'Esc / Tab', 'Start'],
  ['Mapa · Inventario', 'M · I', 'Select'],
  ['Pestañas / fichas', 'Q · E', 'LB · RB'],
  ['Giro rápido (clásicos)', 'atrás + Shift', 'atrás + X'],
];

function toggleRow(label, key, options) {
  const row = h('div', null, 'opt-row');
  row.append(h('span', label, 'opt-row__label'));
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'opt-row__value';
  const paint = () => {
    const i = options.findIndex(([v]) => v === settings[key]);
    b.textContent = `◂ ${options[i]?.[1] ?? options[0][1]} ▸`;
    b.setAttribute('aria-label', `${label}: ${options[i]?.[1]}. Pulsa para cambiar.`);
  };
  b.addEventListener('click', () => {
    const i = options.findIndex(([v]) => v === settings[key]);
    setSetting(key, options[(i + 1) % options.length][0]);
    paint();
  });
  paint();
  row.append(b);
  return row;
}

function sliderRow(label, key, note) {
  const row = h('label', null, 'opt-row');
  row.append(h('span', label, 'opt-row__label'));
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = '0.1';
  input.value = String(settings[key]);
  input.addEventListener('input', () => setSetting(key, Number(input.value)));
  row.append(input);
  if (note) row.title = note;
  return row;
}

function button(label, onClick, className = 'pause__item', ariaLabel) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  if (ariaLabel) b.setAttribute('aria-label', ariaLabel);
  b.addEventListener('click', onClick);
  return b;
}

function h(tag, text, className) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (className) n.className = className;
  return n;
}
