// The lens of a photograph: what lies at the focus is sharp, what lies nearer or further melts away (Chess Ultra and
// Pure Chess shoot their boards this way; Luca chose it for the home screen and the opening, 2026-10-14). The scene
// renders once into a target that keeps its depth; a half-size pass gathers each pixel's neighbours over a disc as
// wide as its distance from the focus calls for; the last pass lays the blur over the sharp picture by that same
// distance, and does the tone mapping and colour conversion the screen would have done.

import {
  DepthTexture,
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type WebGLRenderer,
} from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// the circle of confusion, in pixels at full size: 0 at the focus, growing with the relative distance from it
const COC = /* glsl */ `
uniform sampler2D tDepth;
uniform float near;
uniform float far;
uniform float focus;
uniform float aperture;
uniform float maxBlur;
float depthAt(vec2 uv) {
  float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
  return (2.0 * near * far) / (far + near - z * (far - near));
}
float coc(float d) {
  return clamp(abs(d - focus) / d * aperture, 0.0, 1.0) * maxBlur;
}`;

const GATHER = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 texel;
varying vec2 vUv;
${COC}
void main() {
  float c = coc(depthAt(vUv));
  vec3 sum = texture2D(tColor, vUv).rgb;
  float weight = 1.0;
  // a golden-angle disc of samples; a sample counts if its own blur reaches this pixel, so a sharp piece in front
  // keeps its edge while the room behind it melts
  for (int i = 0; i < 20; i++) {
    float r = sqrt(float(i) + 0.5) / sqrt(20.0);
    float a = float(i) * 2.39996;
    vec2 off = vec2(cos(a), sin(a)) * r * max(c, 0.5) * texel;
    vec2 uv = vUv + off;
    float cs = coc(depthAt(uv));
    float w = clamp(cs - r * c + 1.0, 0.0, 1.0);
    sum += texture2D(tColor, uv).rgb * w;
    weight += w;
  }
  gl_FragColor = vec4(sum / weight, c / maxBlur);
}`;

const COMPOSE = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBlur;
varying vec2 vUv;
${COC}
void main() {
  vec3 sharp = texture2D(tColor, vUv).rgb;
  vec4 soft = texture2D(tBlur, vUv);
  float c = coc(depthAt(vUv)) / maxBlur;
  float k = smoothstep(0.04, 0.3, max(c, soft.a * 0.7));
  gl_FragColor = vec4(mix(sharp, soft.rgb, k), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export interface Focus {
  /** draw the scene through the lens, focused `distance` from the camera */
  render(scene: Scene, camera: PerspectiveCamera, distance: number): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

/** `aperture`: how fast things leave focus; `maxBlur`: the widest disc, in pixels on the screen (CSS pixels). */
export function createFocus(renderer: WebGLRenderer, opts: { aperture: number; maxBlur: number }): Focus {
  const size = new Vector2();
  const sharp = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4, depthTexture: new DepthTexture(1, 1, UnsignedIntType) });
  const soft = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
  const shared = {
    tDepth: { value: sharp.depthTexture },
    near: { value: 1 },
    far: { value: 100 },
    focus: { value: 10 },
    aperture: { value: opts.aperture },
    maxBlur: { value: opts.maxBlur },
  };
  const gather = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: GATHER,
    uniforms: { ...shared, tColor: { value: sharp.texture }, texel: { value: new Vector2() } },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const compose = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: COMPOSE,
    uniforms: { ...shared, tColor: { value: sharp.texture }, tBlur: { value: soft.texture } },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), gather);
  quad.frustumCulled = false;
  const stage = new Scene();
  stage.add(quad);
  const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let dpr = 1;

  return {
    render(scene, camera, distance) {
      shared.near.value = camera.near;
      shared.far.value = camera.far;
      shared.focus.value = distance;
      // the blur is measured in screen pixels: scale it to the drawing buffer
      shared.maxBlur.value = opts.maxBlur * dpr;
      renderer.setRenderTarget(sharp);
      renderer.render(scene, camera);
      quad.material = gather;
      (gather.uniforms.texel.value as Vector2).set(1 / size.x, 1 / size.y);
      renderer.setRenderTarget(soft);
      renderer.render(stage, cam);
      quad.material = compose;
      renderer.setRenderTarget(null);
      renderer.render(stage, cam);
    },
    setSize(width, height) {
      renderer.getDrawingBufferSize(size);
      dpr = renderer.getPixelRatio();
      void width;
      void height;
      sharp.setSize(size.x, size.y);
      soft.setSize(Math.max(1, Math.round(size.x / 2)), Math.max(1, Math.round(size.y / 2)));
    },
    dispose() {
      sharp.depthTexture?.dispose();
      sharp.dispose();
      soft.dispose();
      gather.dispose();
      compose.dispose();
      quad.geometry.dispose();
    },
  };
}
