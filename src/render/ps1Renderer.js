import * as THREE from 'three';
import { ps1Uniforms } from './ps1Material.js';

/**
 * Render en dos pasos al estilo PS1:
 *  1. La escena se dibuja en un render target de baja resolución (240 px de alto, ancho
 *     según la proporción de la ventana).
 *  2. Un quad a pantalla completa lo escala con filtrado nearest, reduce el color a
 *     15 bits (5 por canal) con el dithering ordenado 4×4 de la consola.
 *
 * Con los efectos apagados se dibuja directamente a resolución nativa. El temblor de vértices
 * se puede quitar aparte (`setSnap(false)`, con movimiento reducido) sin perder el resto.
 */
export class Ps1Renderer {
  constructor(renderer, { height = 240 } = {}) {
    this.renderer = renderer;
    this.height = height;
    this.enabled = true;
    this.snap = true;
    this.size = new THREE.Vector2();

    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType, // lineal con precisión de sobra; se cuantiza al final
      magFilter: THREE.NearestFilter,
      minFilter: THREE.NearestFilter,
      depthBuffer: true,
      generateMipmaps: false,
    });

    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.target.texture },
        uSize: { value: new THREE.Vector2(1, 1) },
        uDither: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene;
        uniform vec2 uSize;
        uniform float uDither;
        varying vec2 vUv;

        // Matriz de dithering de la GPU de PS1 (en unidades de 8 bits).
        const mat4 BAYER = mat4(
          -4.0,  2.0, -3.0,  3.0,
           0.0, -2.0,  1.0, -1.0,
          -3.0,  3.0, -4.0,  2.0,
           1.0, -1.0,  0.0, -2.0
        );

        vec3 linearToSrgb(vec3 c) {
          c = max(c, 0.0);
          return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
        }

        void main() {
          vec3 color = linearToSrgb(texture2D(tScene, vUv).rgb);
          ivec2 p = ivec2(floor(vUv * uSize)) & 3;
          float offset = BAYER[p.x][p.y] * uDither;
          vec3 c8 = clamp(floor(color * 255.0 + 0.5) + offset, 0.0, 255.0);
          vec3 c5 = floor(c8 / 8.0);
          gl_FragColor = vec4(c5 / 31.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    quad.frustumCulled = false;
    this.postScene.add(quad);
  }

  /** Llamar al iniciar y en cada `resize`. */
  setSize(width, height) {
    this.renderer.setSize(width, height);
    const h = this.height;
    const w = Math.max(2, Math.round((h * width) / height / 2) * 2);
    this.size.set(w, h);
    this.target.setSize(w, h);
    this.postMaterial.uniforms.uSize.value.set(w, h);
    // Snapping un poco más grueso que el píxel: el temblor se nota sin ser molesto.
    ps1Uniforms.uPs1Snap.value.set(w / 1.5, h / 1.5);
  }

  setEnabled(on) {
    this.enabled = on;
    ps1Uniforms.uPs1SnapOn.value = on && this.snap ? 1 : 0;
    ps1Uniforms.uPs1Affine.value = on ? 1 : 0;
    this.renderer.setPixelRatio(on ? 1 : Math.min(window.devicePixelRatio, 2));
    const canvas = this.renderer.domElement;
    canvas.style.imageRendering = on ? 'pixelated' : 'auto';
  }

  /** Vertex snapping (el "temblor" de los polígonos). */
  setSnap(on) {
    this.snap = on;
    ps1Uniforms.uPs1SnapOn.value = this.enabled && on ? 1 : 0;
  }

  render(scene, camera) {
    const r = this.renderer;
    if (!this.enabled) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCamera);
  }
}
