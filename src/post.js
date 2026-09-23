// The last pass: bloom for the stars and the lamps, a tone curve that keeps
// his yellows yellow, a little vignette and the grain of the cloth; and a fade,
// to a colour, for the film (E2): to the dark, or to the star's own light.
import * as THREE from 'three';

const VERT = /* glsl */`varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const PRE = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh, uKnee; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
           + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    c *= 0.25;
    if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
    c = min(c, vec3(48.0));
    float br = max(c.r, max(c.g, c.b));
    float soft = clamp(br - uThresh + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 1e-4);
    gl_FragColor = vec4(c * max(soft, br - uThresh) / max(br, 1e-4), 1.0);
  }`;
const DOWN = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb * 4.0
      + texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
      + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    gl_FragColor = vec4(c / 8.0, 1.0);
  }`;
const UP = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uK; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + 2.0 * texture2D(tSrc, vUv + uTexel * vec2(0.0, -1.0)).rgb
      + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb + 2.0 * texture2D(tSrc, vUv + uTexel * vec2(-1.0, 0.0)).rgb
      + 4.0 * texture2D(tSrc, vUv).rgb + 2.0 * texture2D(tSrc, vUv + uTexel * vec2(1.0, 0.0)).rgb
      + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + 2.0 * texture2D(tSrc, vUv + uTexel * vec2(0.0, 1.0)).rgb
      + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    gl_FragColor = vec4(c / 16.0 * uK, 1.0);
  }`;
const FINAL = /* glsl */`
  uniform sampler2D tScene, tBloom;
  uniform float uExposure, uBloom, uSat, uContrast, uVignette, uGrain, uTime, uWarm, uBlack, uTone, uFade;
  uniform vec2 uRes; uniform vec3 uFadeCol;
  varying vec2 vUv;
  float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main() {
    vec3 sc = texture2D(tScene, vUv).rgb, bl = texture2D(tBloom, vUv).rgb;
    if (any(isnan(sc)) || any(isinf(sc))) sc = vec3(0.0);
    if (any(isnan(bl)) || any(isinf(bl))) bl = vec3(0.0);
    vec3 c = sc + bl * uBloom;
    c *= uExposure;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = max(mix(vec3(l), c, uSat), 0.0);
    // uTone 1 is the filmic curve; 0 keeps the paint's own values, with only a soft shoulder above 0.85
    vec3 plain = mix(c, 0.85 + 0.15 * (1.0 - exp(-(c - 0.85) / 0.15)), step(0.85, c));
    vec3 s = srgb(mix(clamp(plain, 0.0, 1.0), aces(c), uTone));
    s = clamp((s - 0.5) * uContrast + 0.5, 0.0, 1.0);
    s += vec3(0.018, 0.004, -0.02) * uWarm;
    vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
    s *= 1.0 - uVignette * smoothstep(0.4, 1.15, length(q));
    vec2 px = gl_FragCoord.xy;
    s += sin(px.x * 1.57) * sin(px.y * 1.57) * 0.006 + (h12(px + fract(uTime * 7.1) * 311.0) - 0.5) * uGrain;
    s = mix(s, uFadeCol, uFade);
    s *= 1.0 - uBlack;
    gl_FragColor = vec4(s, 1.0);
  }`;

export class Post {
  constructor(renderer) {
    this.r = renderer;
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(tri);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const opts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.main = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.lv = Array.from({ length: 6 }, () => new THREE.WebGLRenderTarget(4, 4, opts));
    const mk = (frag, extra = {}, blend) => new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, ...extra },
      ...(blend ? { blending: THREE.AdditiveBlending, transparent: true } : {}) });
    this.mPre = mk(PRE, { uThresh: { value: 1.0 }, uKnee: { value: 0.5 } });
    this.mDown = mk(DOWN);
    this.mUp = mk(UP, { uK: { value: 1 } }, true);
    this.mFinal = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FINAL, depthTest: false, depthWrite: false,
      uniforms: { tScene: { value: null }, tBloom: { value: null }, uExposure: { value: 1 }, uBloom: { value: 0.6 },
        uSat: { value: 1.1 }, uContrast: { value: 1.05 }, uVignette: { value: 0.35 }, uGrain: { value: 0.025 },
        uTime: { value: 0 }, uWarm: { value: 0 }, uBlack: { value: 0 }, uTone: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) },
        uFade: { value: 0 }, uFadeCol: { value: new THREE.Vector3() } } });
  }
  setSize(w, h) {
    this.w = w; this.h = h;
    this.main.setSize(w, h);
    let lw = Math.max(1, w >> 1), lh = Math.max(1, h >> 1);
    for (const rt of this.lv) { rt.setSize(lw, lh); lw = Math.max(1, lw >> 1); lh = Math.max(1, lh >> 1); }
    this.mFinal.uniforms.uRes.value.set(w, h);
  }
  pass(mat, src, srcW, srcH, dst, clear = true) {
    mat.uniforms.tSrc.value = src;
    mat.uniforms.uTexel.value.set(1 / srcW, 1 / srcH);
    this.quad.material = mat;
    this.r.setRenderTarget(dst);
    if (clear) this.r.clear(true, false, false);
    this.r.render(this.scene, this.cam);
  }
  render(scenes, camera, P) {
    const r = this.r;
    r.autoClear = false;
    r.setRenderTarget(this.main);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    for (const sc of scenes) r.render(sc, camera);
    this.mPre.uniforms.uThresh.value = P.thresh ?? 1.0;
    this.pass(this.mPre, this.main.texture, this.w, this.h, this.lv[0]);
    for (let i = 1; i < this.lv.length; i++)
      this.pass(this.mDown, this.lv[i - 1].texture, this.lv[i - 1].width, this.lv[i - 1].height, this.lv[i]);
    for (let i = this.lv.length - 1; i > 0; i--)
      this.pass(this.mUp, this.lv[i].texture, this.lv[i].width, this.lv[i].height, this.lv[i - 1], false);
    const F = this.mFinal.uniforms;
    F.tScene.value = this.main.texture; F.tBloom.value = this.lv[0].texture;
    F.uExposure.value = P.exposure; F.uBloom.value = P.bloom; F.uSat.value = P.sat; F.uContrast.value = P.contrast;
    F.uVignette.value = P.vignette; F.uGrain.value = P.grain; F.uTime.value = P.time; F.uWarm.value = P.warm; F.uBlack.value = P.black; F.uTone.value = P.tone ?? 1;
    F.uFade.value = P.fade || 0; if (P.fadeCol) F.uFadeCol.value.set(...P.fadeCol);
    this.quad.material = this.mFinal;
    r.setRenderTarget(null);
    r.clear(true, true, false);
    r.render(this.scene, this.cam);
  }
}
