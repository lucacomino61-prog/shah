// The still table: while a piece moves in play the camera stands still (The Still Board Rule), so the room, the board
// and every piece at rest are drawn once into a picture that keeps its depth. Each frame lays that picture back on the
// screen, its depth written with it, and only what moves is drawn over it: a few thousand triangles instead of the
// whole lacquered room (Luca, 2026-10-16: "make the pieces move smoother when playing").
//
// The picture is drawn exactly as the screen is: every material tone maps and encodes its own colour, so what is
// see-through (the contact shadows, the pieces in the lacquer) blends over it as it does on the screen. three.js does
// that only for the screen and for an XR target, so the target says it is one; its colour is stored as the plain bytes
// the screen holds (RGBA8, not sRGB, which would encode it twice) and laid back untouched.

import {
  AlwaysDepth,
  DepthTexture,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type WebGLRenderer,
} from 'three';

export interface Still {
  /** draw the scene into the picture (with whatever is hidden left out) */
  draw(scene: Scene, camera: Camera): void;
  /** lay the picture on the screen, depth and all: what is drawn next is hidden behind what stands in front of it */
  lay(): void;
  /** compile the scene's programs for the picture's own target (its colour space and tone mapping differ) */
  compile(scene: Scene, camera: Camera): void;
  setSize(): void;
  dispose(): void;
}

export function createStill(renderer: WebGLRenderer): Still {
  const size = new Vector2();
  // the screen's own sample count, so an edge looks the same in the picture as drawn live
  const rt = new WebGLRenderTarget(1, 1, { samples: 4, colorSpace: SRGBColorSpace, depthTexture: new DepthTexture(1, 1, UnsignedIntType) });
  rt.texture.internalFormat = 'RGBA8';
  (rt as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true;
  const mat = new ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      varying vec2 vUv;
      void main() {
        gl_FragColor = vec4(texture2D(tColor, vUv).rgb, 1.0);
        gl_FragDepth = texture2D(tDepth, vUv).r;
      }`,
    uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture } },
    // the depth must be written, and a depth write needs the test on: one that always passes
    depthTest: true,
    depthWrite: true,
    depthFunc: AlwaysDepth,
    // already the screen's colour: laid back as it is
    toneMapped: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const stage = new Scene();
  stage.add(quad);
  const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    draw(scene, camera) {
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
    },
    lay() {
      renderer.setRenderTarget(null);
      renderer.render(stage, cam);
    },
    compile(scene, camera) {
      renderer.setRenderTarget(rt);
      renderer.compile(scene, camera);
      renderer.setRenderTarget(null);
      renderer.compile(stage, cam);
    },
    setSize() {
      renderer.getDrawingBufferSize(size);
      rt.setSize(Math.max(1, size.x), Math.max(1, size.y));
    },
    dispose() {
      rt.depthTexture?.dispose();
      rt.dispose();
      mat.dispose();
      quad.geometry.dispose();
    },
  };
}
