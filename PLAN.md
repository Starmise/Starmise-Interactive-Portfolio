# PLAN.md — Portafolio interactivo estilo survival horror de PS1

> Documento vivo. Cada sesión que avance el proyecto debe **marcar las casillas** de las
> tareas terminadas y anotar en "Registro de decisiones" cualquier cambio de rumbo.
> El contexto general (repo, flujo de Git, etc.) está en `CLAUDE.md`.

## 1. Visión

Un portafolio que se juega como un *survival horror* clásico de PlayStation 1 (cámaras
fijas, personaje en tercera persona, gráficos low-poly con *jitter* y texturas pixeladas).
El visitante explora una mansión/edificio donde **cada sala agrupa proyectos** y cada
proyecto es un objeto que se puede **examinar** para leer su "archivo" (ficha).

Debe funcionar en navegador, cargar rápido y **no castigar a quien tiene prisa**: siempre
hay un mapa / modo lista para llegar a cualquier proyecto en dos clics, y un enlace a la
versión clásica (`https://starmise.github.io/About-Me-Website/`).

**Regla de PI:** se evoca el *estilo* de la época, pero **no** se usan assets, logos,
tipografías, sonidos, música ni nombres de Capcom/Resident Evil. Todo es original o con
licencia libre.

## 2. Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Perspectiva | Tercera persona con **cámaras fijas** por zonas (no primera persona). |
| Motor | **Three.js** en JavaScript vanilla (módulos ES), sin React. |
| Bundler | **Vite** (propuesto; mejor manejo de modelos/estáticos que Parcel). Configurar `base: './'`. |
| Personaje | Basemesh PSX masculino (`PSX_Char_Male_Base.fbx`) con animaciones de Mixamo, exportado a **GLB**. |
| Diseño de niveles | Salas modeladas en **Blender** y exportadas como GLB, con objetos marcados por **convención de nombres** (ver §6). |
| Datos | Todo el texto sale de `src/data/projects.json` y `profile.json`; nada escrito a mano en la escena. |
| Controles | Por defecto **relativos a cámara** (modernos); **tank controls** como opción "Modo clásico". |
| Hosting | GitHub Pages vía GitHub Actions. El usuario hace los push. |

## 3. Experiencia y mapeo del portafolio

| Mecánica | Contenido |
|----------|-----------|
| Pantalla de título | "Starmise" + *Press Start*. Opciones: Empezar, Modo lista, Versión clásica, Controles. |
| Hall principal | Bio (`profile.about`), DemoReel en una TV, vitrina con los 4 proyectos `featured`, puertas a las alas. |
| Salas | Una por categoría (ver tabla abajo). |
| Objeto examinable | Un proyecto: pedestal, cuadro, cartucho, TV… Prompt "Examinar". |
| **Archivo / File** | Ficha del proyecto: portada, `tagline`, `description`, `process`, `role`, `tags`, botón a `externalLink`. |
| Puertas | Transición con animación de puerta abriéndose, que **también oculta la carga** de la sala siguiente. |
| Inventario (pausa) | Habilidades (`profile.skills`) y "Qué hago" (`profile.whatIDo`). |
| Mapa (pausa) | Lista de salas → proyectos; teletransporta o abre la ficha directamente. |
| Save room / máquina de escribir | Contacto (`profile.contact`) y curiosidades. |

### Distribución propuesta de salas (ajustable)

| Sala | Proyectos (`id`) |
|------|------------------|
| **Hall principal** (vitrina de destacados) | `persona-error`★, `catharsis`★, `kerberos-engine`★, `death-of-will`★ (solo acceso rápido; viven en su sala) |
| **Ala Unreal** | `death-of-will`★, `epic-lucio-prototype`, `epic-lucio-mvp`, `3d-visualizer`, `vessels` |
| **Ala Unity** | `lucio-kart`, `off-the-hook`, `deadlock-escape`, `ar-foundation-vuforia`, `kiwi-procedural-agents`, `pcg-enemies` |
| **Laboratorio** (motores y gráficos C++) | `kerberos-engine`★, `custom-2d-rendering-framework`, `solar-system-simulation` |
| **Sala de juegos** (game jams y prototipos) | `persona-error`★, `pops-and-barks`, `memeception`, `cosmic-fang`, `lucio-galaxy`, `raboom`, `lucio-clicker-simulator`, `catharsis`★ |
| **Save room** | Contacto y curiosidades |

Se implementará añadiendo un campo `room` a cada proyecto en `projects.json` y un
`src/data/rooms.json` con los metadatos de cada sala (nombre, archivo GLB, música, puertas).

## 4. Fases y tareas

### Fase 0 — Preparación ✅
- [x] Migrar `projects.json`, `profile.json` e imágenes desde `About-Me-Website`.
- [x] `CLAUDE.md`, `.gitignore`, `.gitattributes`.
- [x] Añadir el modelo del personaje (`src/ps1psx-character-basemesh-male/`).
- [x] Generar plantilla de UVs para pintar la textura del personaje.

### Fase 1 — Base del proyecto
- [ ] `package.json` con Vite + Three.js; `npm run dev` / `npm run build` funcionando.
- [ ] Reorganizar carpetas según §7 (mover `src/img` → `public/img`, el FBX y fuentes → `art/`).
- [ ] Workflow `.github/workflows/deploy.yml` (adaptado del original, con Vite y `dist/`).
- [ ] **Personaje:** textura pintada + exportado a `public/models/player.glb` (ver §5).
- [ ] Escena mínima: cargar `player.glb`, reproducir la caminata y verla en el navegador.

### Fase 2 — Prototipo vertical (una sala) ← hito para validar la sensación
- [ ] Pipeline de render PS1 (§6.1): render a baja resolución, *vertex snapping*, texturas sin filtrado, mapeo afín, dithering, niebla.
- [ ] Controlador del personaje: idle/caminar/correr, controles relativos a cámara + modo tanque.
- [ ] Colisiones contra la geometría `COL_*` de la sala.
- [ ] 2–3 cámaras fijas que cambian con volúmenes `TRG_CAM_*`.
- [ ] Un objeto `INT_<id>` que abre la ficha del proyecto real desde `projects.json`.
- [ ] Sala de prueba hecha en Blender (puede ser cajas texturizadas).
- [ ] **Revisión con el usuario:** ¿se siente bien? Ajustar antes de seguir.

### Fase 3 — Sistemas
- [ ] Puertas `DOOR_<sala>` + transición con animación de puerta y precarga.
- [ ] Gestor de salas (carga/descarga de GLB, spawn points `SPAWN_*`).
- [ ] Menú de pausa: inventario (habilidades), mapa, opciones (controles, volumen, efectos PS1 on/off).
- [ ] UI de "Archivo" final (HTML sobre el canvas), con navegación por teclado y mando.
- [ ] Pantalla de título y pantalla de carga.
- [ ] Soporte de mando (Gamepad API).

### Fase 4 — Contenido
- [ ] Añadir `room` a `projects.json` y crear `rooms.json`.
- [ ] Modelar y texturizar: Hall, Ala Unreal, Ala Unity, Laboratorio, Sala de juegos, Save room.
- [ ] Representación de cada proyecto en su sala (objeto + textura con su portada en baja resolución).
- [ ] TV con DemoReel en el Hall (miniatura PS1 → abre el video de YouTube en la UI).
- [ ] Generar versiones optimizadas de imágenes (miniaturas 128–256 px para texturas; WebP para fichas).
- [ ] Reemplazar las imágenes de galería de muestra (`GalleryExample*.png`).

### Fase 5 — Accesibilidad, móvil y rendimiento
- [ ] **Modo lista**: vista HTML accesible con todos los proyectos (misma app, mismos datos).
- [ ] Controles táctiles: joystick virtual + botón de interacción; o modo clic para caminar.
- [ ] Detección de equipo lento → sugerir modo lista.
- [ ] `prefers-reduced-motion`: desactivar *jitter*/temblores de cámara.
- [ ] Presupuestos: carga inicial < 5 MB, < 5k triángulos por sala, 60 fps en un portátil medio.

### Fase 6 — Pulido y lanzamiento
- [ ] Audio: ambiente por sala, sonidos de puerta/pasos/menú (originales o CC0), silenciado hasta la primera interacción.
- [ ] Meta tags / Open Graph / favicon.
- [ ] Probar en Chrome, Firefox, Safari y móvil.
- [ ] Publicar. Opcional: renombrar el repo a `Starmise.github.io` para servirlo en la raíz.
- [ ] Enlazar la nueva versión desde el portafolio clásico.

## 5. Pipeline del personaje

### Estado actual del modelo (`PSX_Char_Male_Base.fbx`, analizado el 2026-10-08)

- 283 vértices, 302 polígonos (mezcla de quads y tris), 1 malla, **UVs limpias** (1 isla por pieza, ocupan todo el espacio 0–1).
- Material `M_Char` **sin textura asignada**.
- Esqueleto de **19 huesos con nombres estilo Unreal** (`pelvis`, `spine_01`, `upper_arm_l`…), **no** `mixamorig:*`.
- Una animación (`mixamo.com`) de ~1.03 s (ciclo de caminata). Solo el nodo `Root` tiene traslación, con poco recorrido → parece *in place*; verificar en Blender. En código se ignorará la traslación horizontal del root.

### Pasos

1. **Textura.** Pintar sobre `src/ps1psx-character-basemesh-male/textures/PSX_Char_Male_UV_1024.png`
   (capa nueva encima de la plantilla). Exportar la final y reducir a **128×128 o 256×256** con
   *nearest neighbor*. Opcional, para mayor autenticidad: reducir a ≤ 256 colores. Guardar
   como `PSX_Char_Male_Diffuse.png`.
2. **Blender.** Importar el FBX → en `M_Char`, nodo *Image Texture* con la textura e
   **Interpolation = Closest** → conectar a *Base Color* (Roughness 1, Metallic 0).
3. **Más animaciones** (idle, correr, girar, examinar). ⚠️ Como el esqueleto actual **no** es de
   Mixamo, las animaciones nuevas de Mixamo no encajarán directamente. Opciones:
   - **(Recomendado)** Subir el personaje (FBX o la malla sola) a Mixamo para que lo re-riguee
     con su propio esqueleto y descargar *todas* las animaciones desde ahí (la primera "With
     Skin", el resto "Without Skin", todas *In Place*). Se pierde el rig actual, pero todo queda consistente.
   - Retargetear las animaciones de Mixamo al esqueleto actual en Blender (más trabajo).
4. Juntar todas las animaciones como *Actions* (NLA) con nombres claros: `Idle`, `Walk`, `Run`, `TurnL`, `TurnR`, `Examine`.
5. **Exportar** glTF Binary (`.glb`) con animaciones, `+Y Up`, transformaciones aplicadas,
   escala tal que el personaje mida ~1.75 unidades (1 unidad = 1 m) → `public/models/player.glb`.
6. Guardar el `.blend` en `art/character/` (fuente, no se publica).

## 6. Diseño técnico

### 6.1 Render PS1
- Renderizar la escena a un `WebGLRenderTarget` de **320×240** (o ancho variable a 240 px de alto) y escalarlo a pantalla con `NearestFilter`.
- **Vertex snapping:** en el vertex shader (vía `onBeforeCompile`), redondear la posición en *clip space* a la rejilla de la resolución interna.
- **Mapeo afín:** GLSL ES 3.0 no tiene `noperspective`; multiplicar las UV por `w` en el vertex shader y dividir en el fragment.
- Texturas con `NearestFilter`, sin mipmaps, 64–256 px.
- Post-proceso: reducción a color de 15 bits + **dithering** 4×4 (Bayer).
- Niebla lineal oscura para ocultar distancia; iluminación sencilla (Lambert/vertex colors horneados en Blender).
- Toggle en opciones para apagar los efectos.

### 6.2 Salas y convención de nombres en Blender
| Prefijo | Uso |
|---------|-----|
| `COL_*` | Colisión (invisible en el juego). |
| `CAM_<n>` | Cámara fija (posición, rotación, FOV). |
| `TRG_CAM_<n>` | Volumen que activa la cámara `<n>` cuando el jugador entra. |
| `INT_<projectId>` | Objeto examinable ligado a un proyecto. |
| `DOOR_<roomId>` | Puerta hacia otra sala. |
| `SPAWN_<fromRoomId>` | Punto de aparición al entrar desde esa sala. |

### 6.3 Jugador
- Animación con `AnimationMixer` y *crossfade* entre `Idle`/`Walk`/`Run`.
- Colisión: cápsula contra `COL_*` usando `three-mesh-bvh` (o AABBs si basta).
- Al cambiar de cámara, mantener la dirección de input hasta soltar la tecla (evita el "giro brusco" típico de cámaras fijas).

### 6.4 UI
- Capa HTML/CSS sobre el canvas (accesible, seleccionable, fácil de estilizar).
- Tipografía pixel/monoespaciada con licencia libre (p. ej. de Google Fonts), estilo "documento mecanografiado" para las fichas.

## 7. Estructura objetivo del repo

```
index.html
vite.config.js
public/
  img/            Imágenes (las rutas `img/...` de los JSON siguen funcionando)
  models/         player.glb, salas *.glb
  textures/       Texturas PS1 optimizadas
  audio/
src/
  main.js
  core/           Renderer, game loop, input, carga de assets
  render/         Materiales y post-proceso PS1
  world/          Salas, cámaras, triggers, puertas, colisiones
  player/         Controlador y animación
  ui/             Título, archivo, pausa, mapa, modo lista
  data/           projects.json, profile.json, rooms.json
art/              Fuentes (FBX, .blend, PSD, plantillas UV) — no se publican
```

## 8. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Controles frustrantes con cámaras fijas | Controles modernos por defecto, modo tanque opcional, mapa siempre disponible. |
| Reclutadores sin tiempo | Modo lista y vitrina de destacados en el Hall; botón de Modo lista en el título. |
| Peso de carga | Texturas pequeñas, salas por separado, portadas en alta solo al abrir ficha. |
| Móvil lento | Detección + modo lista; controles táctiles. |
| Animaciones incompatibles con el rig actual | Re-riguear en Mixamo (§5.3). |
| Alcance demasiado grande | El prototipo de la Fase 2 es el punto de decisión; las salas se pueden lanzar de una en una. |

## 9. Preguntas abiertas
- Nombre del "juego" / título de la pantalla inicial.
- Ambientación: ¿mansión clásica, oficina/estudio, instalación de investigación?
- ¿El personaje representa a Starmise (colores/ropa propia)?
- ¿Música propia o CC0?

## 10. Registro de decisiones
- **2026-10-08** — Se elige tercera persona con cámaras fijas, Three.js vanilla, Vite (propuesto), salas en Blender con convención de nombres. Personaje: basemesh PSX con caminata de Mixamo.
