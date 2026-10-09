/**
 * "Archivo": la ficha de un proyecto, como un documento mecanografiado sobre la escena.
 * Es HTML normal (seleccionable, accesible, lectores de pantalla) encima del canvas.
 * Todo el texto sale del objeto del proyecto (projects.json).
 */
export class FileView {
  constructor(root, { baseUrl = './' } = {}) {
    this.baseUrl = baseUrl;
    this.onClose = null;
    this.isOpen = false;
    this.returnFocus = null;

    this.el = document.createElement('div');
    this.el.className = 'file-view';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="file-view__backdrop"></div>
      <article class="file-doc" role="dialog" aria-modal="true" aria-labelledby="file-title" tabindex="-1">
        <header class="file-doc__head">
          <p class="file-doc__kicker">Archivo <span data-f="number"></span></p>
          <h2 id="file-title" class="file-doc__title" data-f="title"></h2>
          <p class="file-doc__tagline" data-f="tagline"></p>
        </header>
        <figure class="file-doc__cover"><img data-f="cover" alt="" /></figure>
        <section data-s="description"><h3>Descripción</h3><p data-f="description"></p></section>
        <section data-s="process"><h3>Proceso</h3><p data-f="process"></p></section>
        <section data-s="role"><h3>Mi rol</h3><p data-f="role"></p></section>
        <ul class="file-doc__tags" data-f="tags" aria-label="Etiquetas"></ul>
        <footer class="file-doc__foot">
          <a class="file-doc__link" data-f="link" target="_blank" rel="noopener"></a>
          <button type="button" class="file-doc__close" data-f="close">Cerrar <kbd>Esc</kbd></button>
        </footer>
      </article>
    `;
    root.appendChild(this.el);
    this.doc = this.el.querySelector('.file-doc');
    this.f = Object.fromEntries([...this.el.querySelectorAll('[data-f]')].map((n) => [n.dataset.f, n]));

    this.f.close.addEventListener('click', () => this.close());
    this.el.querySelector('.file-view__backdrop').addEventListener('click', () => this.close());
    this.el.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      } else if (e.code === 'Tab') {
        this.#trapFocus(e);
      }
    });
  }

  open(project, index) {
    if (!project) return;
    const { f } = this;
    f.number.textContent = `Nº ${String(index + 1).padStart(3, '0')}`;
    f.title.textContent = project.title;
    f.tagline.textContent = project.tagline ?? '';
    f.tagline.hidden = !project.tagline;
    f.cover.src = this.baseUrl + project.cover;
    f.cover.alt = `Portada de ${project.title}`;
    for (const key of ['description', 'process', 'role']) {
      f[key].textContent = project[key] ?? '';
      this.el.querySelector(`[data-s="${key}"]`).hidden = !project[key];
    }
    f.tags.replaceChildren(
      ...(project.tags ?? []).map((t) => Object.assign(document.createElement('li'), { textContent: t })),
    );
    f.tags.hidden = !project.tags?.length;
    f.link.hidden = !project.externalLink;
    if (project.externalLink) {
      f.link.href = project.externalLink;
      f.link.textContent = project.externalLabel || 'Ver proyecto';
    }

    this.returnFocus = document.activeElement;
    this.el.hidden = false;
    this.doc.scrollTop = 0;
    this.isOpen = true;
    requestAnimationFrame(() => {
      this.el.classList.add('is-open');
      this.doc.focus({ preventScroll: true });
    });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove('is-open');
    this.el.hidden = true;
    this.returnFocus?.focus?.();
    this.onClose?.();
  }

  #trapFocus(e) {
    const focusables = [...this.doc.querySelectorAll('a[href]:not([hidden]), button')];
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === this.doc)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
