/**
 * "Archivo": un documento mecanografiado sobre la escena (ficha de proyecto, diario,
 * contacto…). Es HTML normal (seleccionable, accesible) y una capa de la UiStack:
 * arriba/abajo desplazan el texto, LB/RB o Q/E pasan al documento anterior/siguiente
 * cuando se abrió desde una lista, y "volver" lo cierra.
 */
export class FileView {
  constructor(root, stack, { baseUrl = './' } = {}) {
    this.stack = stack;
    this.baseUrl = baseUrl;
    this.sequence = null; // { docs: () => doc[], index }

    this.el = document.createElement('div');
    this.el.className = 'file-view';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="file-view__backdrop"></div>
      <article class="file-doc" role="dialog" aria-modal="true" aria-labelledby="file-title" tabindex="-1">
        <header class="file-doc__head">
          <p class="file-doc__kicker"><span data-f="kicker"></span><span class="file-doc__nav" data-f="nav"></span></p>
          <h2 id="file-title" class="file-doc__title" data-f="title"></h2>
          <p class="file-doc__tagline" data-f="tagline"></p>
        </header>
        <figure class="file-doc__cover" data-f="figure"><img data-f="image" alt="" /></figure>
        <div data-f="sections"></div>
        <ul class="file-doc__tags" data-f="tags" aria-label="Etiquetas"></ul>
        <div class="file-doc__links" data-f="links"></div>
        <footer class="file-doc__foot">
          <button type="button" class="file-doc__close" data-f="close">Cerrar</button>
        </footer>
      </article>
    `;
    root.appendChild(this.el);
    this.doc = this.el.querySelector('.file-doc');
    this.f = Object.fromEntries([...this.el.querySelectorAll('[data-f]')].map((n) => [n.dataset.f, n]));
    this.f.close.addEventListener('click', () => this.close());
    this.el.querySelector('.file-view__backdrop').addEventListener('click', () => this.close());

    this.layer = {
      el: this.doc,
      onShow: () => {
        this.el.hidden = false;
        requestAnimationFrame(() => {
          this.el.classList.add('is-open');
          this.doc.focus({ preventScroll: true });
        });
      },
      onHide: () => {
        this.el.classList.remove('is-open');
        this.el.hidden = true;
        this.sequence = null;
      },
      onAction: (action) => this.#onAction(action),
    };
  }

  get isOpen() {
    return this.stack.layers.includes(this.layer);
  }

  /**
   * Abre un documento. `sequence` opcional: { docs: doc[], index } para poder pasar al
   * anterior/siguiente sin cerrar (p. ej. desde el mapa).
   */
  open(doc, sequence = null) {
    this.sequence = sequence;
    this.#render(doc);
    if (!this.isOpen) this.stack.push(this.layer);
    else this.doc.focus({ preventScroll: true });
  }

  close() {
    this.stack.pop(this.layer);
  }

  #onAction(action) {
    switch (action) {
      case 'up':
      case 'down':
        // Si el foco está en un enlace/botón, navegar; si no, desplazar el texto.
        if (document.activeElement === this.doc) {
          this.doc.scrollBy({ top: action === 'down' ? 80 : -80 });
          return true;
        }
        return false;
      case 'tabPrev':
      case 'tabNext':
        if (this.sequence?.docs.length > 1) return this.#step(action === 'tabNext' ? 1 : -1);
        // Sin lista que recorrer, E (la misma tecla que lo abrió) cierra el documento.
        if (action === 'tabNext') this.close();
        return true;
      case 'pause':
        this.close();
        return true;
      default:
        return false;
    }
  }

  #step(delta) {
    const seq = this.sequence;
    seq.index = (seq.index + delta + seq.docs.length) % seq.docs.length;
    this.#render(seq.docs[seq.index]);
    this.doc.focus({ preventScroll: true });
    return true;
  }

  #render(doc) {
    const { f } = this;
    f.kicker.textContent = doc.kicker ?? '';
    f.title.textContent = doc.title;
    f.tagline.textContent = doc.tagline ?? '';
    f.tagline.hidden = !doc.tagline;

    f.figure.hidden = !doc.image;
    if (doc.image) {
      f.image.src = this.baseUrl + doc.image;
      f.image.alt = doc.imageAlt ?? '';
    } else {
      f.image.removeAttribute('src');
    }

    f.sections.replaceChildren(
      ...doc.sections.map((s) => {
        const section = document.createElement('section');
        const h = document.createElement('h3');
        h.textContent = s.heading;
        section.append(h);
        for (const text of s.paragraphs ?? []) section.append(el('p', text));
        if (s.items?.length) section.append(el('ul', null, s.items.map((t) => el('li', t))));
        return section;
      }),
    );

    f.tags.replaceChildren(...(doc.tags ?? []).map((t) => el('li', t)));
    f.tags.hidden = !doc.tags?.length;

    f.links.className = `file-doc__links${doc.linkLayout === 'list' ? ' is-list' : ''}`;
    f.links.replaceChildren(
      ...(doc.links ?? []).map((l) => {
        const a = el('a', l.label);
        a.className = 'file-doc__link';
        a.href = l.href;
        if (!l.href.startsWith('mailto:')) {
          a.target = '_blank';
          a.rel = 'noopener';
        }
        return a;
      }),
    );
    f.links.hidden = !doc.links?.length;

    const seq = this.sequence;
    f.nav.textContent = seq && seq.docs.length > 1 ? `◂ Q/LB  ${seq.index + 1} / ${seq.docs.length}  E/RB ▸` : '';
    this.doc.scrollTop = 0;
  }
}

function el(tag, text, children) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (children) node.append(...children);
  return node;
}
