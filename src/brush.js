// The brush. Every mark in the world -- sky, wheat, cypress, the paintings
// themselves -- is drawn through one atlas of procedurally made brush prints:
// bristles that start loaded and run dry, a rounded body of paint, and a
// height field so the light can find the ridges. The GLSL below is shared.
import * as THREE from 'three';
import { rng, noise2, smoothstep, clamp } from './util.js';

export const BRUSH_ROWS = 8;
const L = 256, W = 64, PAD = 5;

export function makeBrushAtlas() {
  const data = new Uint8Array(L * W * BRUSH_ROWS * 4);
  const R = rng(9127);
  for (let b = 0; b < BRUSH_ROWS; b++) {
    const cov = new Float32Array(L * W), hgt = new Float32Array(L * W);
    const tone = new Float32Array(L * W), sec = new Float32Array(L * W);
    const nb = 22 + Math.floor(R() * 22);
    const dryStart = 0.42 + R() * 0.38;
    const inner = W - 2 * PAD;
    for (let j = 0; j < nb; j++) {
      const yc = ((j + 0.5) / nb) * 2 - 1 + (R() - 0.5) * 0.08;
      const thick = (1.1 + R() * 1.9) / inner * 2;
      const x0 = R() * 0.06 + Math.pow(Math.abs(yc), 2.2) * 0.10;
      const x1 = clamp(dryStart + R() * (1.02 - dryStart) * (1 - 0.35 * Math.abs(yc)), 0.3, 0.995);
      const tj = R(), sj = R() < 0.24 ? 1 : 0, load = 0.55 + R() * 0.45;
      const wob = R() * 6.28;
      for (let xi = 0; xi < L; xi++) {
        const x = (xi + 0.5) / L;
        if (x < x0 || x > x1) continue;
        const dry = smoothstep(dryStart - 0.12, x1 + 0.05, x);
        if (noise2(j * 17.3 + b * 91.7, x * 34) < dry * 0.85) continue;
        const yw = yc + Math.sin(x * 7 + wob) * 0.012;
        const ya = Math.floor(((yw - thick) + 1) / 2 * inner) + PAD;
        const yb = Math.ceil(((yw + thick) + 1) / 2 * inner) + PAD;
        for (let yi = Math.max(PAD, ya); yi <= Math.min(W - PAD - 1, yb); yi++) {
          const y = ((yi - PAD + 0.5) / inner) * 2 - 1;
          const d = Math.abs(y - yw) / thick;
          if (d > 1) continue;
          const k = 1 - d * d, i = yi * L + xi;
          if (k > cov[i]) { tone[i] = tj; sec[i] = sj; }
          cov[i] = Math.max(cov[i], k);
          hgt[i] = Math.max(hgt[i], k * load * (1 - 0.55 * dry));
        }
      }
    }
    // a light blur so edges are paint, not pixels
    const blur = src => {
      const out = new Float32Array(L * W);
      for (let y = 1; y < W - 1; y++)
        for (let x = 1; x < L - 1; x++) {
          const i = y * L + x;
          out[i] = (src[i] * 4 + src[i - 1] + src[i + 1] + src[i - L] + src[i + L]) / 8;
        }
      return out;
    };
    const cb = blur(blur(cov)), hb = blur(hgt);
    for (let yi = 0; yi < W; yi++)
      for (let xi = 0; xi < L; xi++) {
        const i = yi * L + xi;
        const x = (xi + 0.5) / L, y = ((yi - PAD + 0.5) / inner) * 2 - 1;
        const body = Math.sqrt(Math.max(0, 1 - y * y)) * (1 - 0.45 * smoothstep(0.25, 1, x));
        const h = clamp(0.5 * body * smoothstep(0.05, 0.5, cb[i]) + 0.6 * hb[i], 0, 1);
        const o = ((b * W + yi) * L + xi) * 4;
        data[o] = h * 255;
        data[o + 1] = clamp(cb[i] * 1.35, 0, 1) * 255;
        data[o + 2] = tone[i] * 255;
        data[o + 3] = sec[i] * 255;
      }
  }
  const tex = new THREE.DataTexture(data, L, W * BRUSH_ROWS, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ------------------------------------------------------------------ GLSL --
export const NOISE = /* glsl */`
  float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
  float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec4 hash42(vec2 p) { vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
`;

// the brush print: x = along the mark 0..1, y = across -1..1, row picks a brush
export const BRUSH = /* glsl */`
  uniform sampler2D uBrush;
  vec2 brushUV(vec2 st, float row) {
    return vec2(clamp(st.x, 0.002, 0.998), (row * 64.0 + 5.0 + (st.y * 0.5 + 0.5) * 54.0) / ${(BRUSH_ROWS * 64).toFixed(1)});
  }
  vec4 brush(vec2 st, float row) { return texture2D(uBrush, brushUV(st, row)); }
  // tangent-space normal of the paint surface from the print's height
  vec3 brushNormal(vec2 st, float row, float h, float relief) {
    float ex = 1.5 / 256.0, ey = 2.0 / 27.0;
    float hx = texture2D(uBrush, brushUV(st + vec2(ex, 0.0), row)).r - h;
    float hy = texture2D(uBrush, brushUV(st + vec2(0.0, ey), row)).r - h;
    return normalize(vec3(-hx * relief * 1.6, -hy * relief, 1.0));
  }
`;

// light that paint takes: a wrapped key, a sky/ground ambient, a sheen on the
// ridges, and up to four lamps for the night stations
export const LIGHT = /* glsl */`
  uniform vec3 uSunDir, uSunCol, uSkyAmb, uGndAmb, uFogCol, uCam;
  uniform float uFogDen, uFogStart, uTime;
  uniform vec4 uLampPos[4];
  uniform vec4 uLampCol[4];
  vec3 paintShade(vec3 alb, vec3 N, vec3 V, vec3 P, float gloss) {
    float ndl = dot(N, uSunDir);
    float wrap = max(0.0, (ndl + 0.45) / 1.45);
    vec3 amb = mix(uGndAmb, uSkyAmb, N.y * 0.5 + 0.5);
    vec3 H = normalize(uSunDir + V);
    float sp = pow(max(dot(N, H), 0.0), 36.0) * gloss;
    vec3 c = alb * (amb + uSunCol * wrap) + uSunCol * sp * 0.22;
    for (int i = 0; i < 4; i++) {
      if (uLampCol[i].w <= 0.0) continue;
      vec3 Lv = uLampPos[i].xyz - P; float d = length(Lv); Lv /= max(d, 1e-3);
      float att = uLampCol[i].w / (1.0 + d * d / (uLampPos[i].w * uLampPos[i].w));
      float nl = max(0.0, (dot(N, Lv) + 0.5) / 1.5);
      c += alb * uLampCol[i].rgb * nl * att;
      c += uLampCol[i].rgb * pow(max(dot(N, normalize(Lv + V)), 0.0), 24.0) * gloss * att * 0.35;
    }
    return c;
  }
  vec3 fogged(vec3 c, vec3 P) {
    float d = max(length(P - uCam) - uFogStart, 0.0);
    float f = 1.0 - exp(-d * uFogDen);
    return mix(c, uFogCol, clamp(f, 0.0, 1.0));
  }
`;
