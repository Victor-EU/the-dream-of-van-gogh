// The sky: a painted dome, and over it tens of thousands of strokes laid
// along the wind, curled into his eddies, ringed round his stars. Each world
// has its own sky; going through a door into the next repaints it stroke by
// stroke, from the way you were walking outward.
import * as THREE from 'three';
import { NOISE, BRUSH } from './brush.js';
import { NST } from './journey.js';
import { rng, lin, mixc, jitter, dirAzEl, norm3, cross3, dot3, add3, sub3, mul3, clamp, smoothstep, lerp, noise2, DEG } from './util.js';

const R_SKY = 800;

export function ribbon(seg) {
  const uv = [], idx = [];
  for (let i = 0; i <= seg; i++) uv.push(i / seg, -1, i / seg, 1);
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const SKY_VERT = /* glsl */`
  attribute vec2 aUV;
  attribute vec3 iDir, iTan;
  attribute vec4 iSize, iCol, iCol2, iAxis;
  uniform float uTime, uFade, uSide, uFlow, uIntro;
  uniform vec3 uWipeDir;
  varying vec2 vST; varying float vRow, vEmit; varying vec3 vCol, vCol2;
  vec3 rotA(vec3 v, vec3 k, float th) { float c = cos(th), s = sin(th); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }
  void main() {
    // a stroke's turn to go over: mostly by how far it is round from the way you were walking, a little by chance
    float r = 0.7 * acos(clamp(dot(iDir, uWipeDir), -1.0, 1.0)) / 3.14159 + 0.3 * iCol2.w;
    if ((uSide < 0.5 && r < uFade) || (uSide > 0.5 && r >= uFade)) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    if (fract(iAxis.w * 1.6180339) > uIntro * 1.12 - 0.02) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    vec3 d = iDir, t = iTan;
    float w = length(iAxis.xyz);
    if (w > 1e-6) { vec3 k = iAxis.xyz / w; float th = w * uTime; d = rotA(d, k, th); t = rotA(t, k, th); }
    vec3 b = normalize(cross(d, t));
    float x = aUV.x * 2.0 - 1.0;
    float slide = sin(uTime * 0.37 + iAxis.w) * 0.28 * uFlow;
    float s = (x + slide) * iSize.x;
    float taper = sqrt(max(0.0, 1.0 - pow(abs(x), 6.0)));
    vec3 p = normalize(d + t * s + b * (iSize.z * s * s / max(iSize.x, 1e-5) + aUV.y * iSize.y * (0.4 + 0.6 * taper)));
    gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * p * ${R_SKY.toFixed(1)}, 1.0);
    vST = aUV; vRow = iSize.w; vCol = iCol.rgb; vEmit = iCol.w; vCol2 = iCol2.rgb;
  }
`;
const SKY_FRAG = /* glsl */`
  ${BRUSH}
  varying vec2 vST; varying float vRow, vEmit; varying vec3 vCol, vCol2;
  uniform float uOpacity;
  void main() {
    vec4 br = brush(vST, vRow);
    float a = smoothstep(0.22, 0.6, br.g) * uOpacity;
    if (a < 0.01) discard;
    vec3 n = brushNormal(vST, vRow, br.r, 1.3);
    float relief = 0.9 + 0.22 * dot(n, normalize(vec3(-0.35, 0.55, 0.76)));
    vec3 c = mix(vCol, vCol2, br.a * 0.8) * (0.88 + 0.24 * br.b) * relief;
    c += vCol * vEmit * (0.55 + 0.9 * br.r);
    gl_FragColor = vec4(c, a);
  }
`;

const GLOW_VERT = /* glsl */`
  attribute vec2 aUV;
  attribute vec4 gDir, gCol;
  uniform float uFade, uSide, uTime, uIntro;
  varying vec2 vQ; varying vec3 vC;
  void main() {
    vec3 d = normalize(gDir.xyz);
    vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), d) + vec3(1e-5, 0.0, 0.0)), b = cross(d, t);
    vec2 q = vec2(aUV.x * 2.0 - 1.0, aUV.y);
    float pulse = 1.0 + 0.06 * sin(uTime * 1.3 + gDir.x * 40.0);
    vec3 p = normalize(d + (t * q.x + b * q.y) * gDir.w * pulse);
    gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * p * ${(R_SKY * 0.99).toFixed(1)}, 1.0);
    vQ = q; vC = gCol.rgb * gCol.w * (uSide < 0.5 ? 1.0 - uFade : uFade) * uIntro;
  }
`;
const GLOW_FRAG = /* glsl */`
  varying vec2 vQ; varying vec3 vC;
  void main() { float r = length(vQ); float g = exp(-r * r * 5.5) * (1.0 - smoothstep(0.75, 1.0, r)); gl_FragColor = vec4(vC * g, 1.0); }
`;

const DOME_VERT = /* glsl */`
  varying vec3 vDir;
  void main() { vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position * 900.0, 1.0); gl_Position = p.xyww; }
`;
const DOME_FRAG = /* glsl */`
  ${NOISE}
  uniform vec3 uZen0, uMid0, uHor0, uZen1, uMid1, uHor1, uLand;
  uniform vec4 uHill0, uHill1;
  uniform vec3 uHillC0, uHillC1, uHillD0, uHillD1;
  uniform float uMix, uBare, uTime, uIntro;
  varying vec3 vDir;
  const vec3 LINEN = vec3(0.807, 0.761, 0.644);
  vec3 skyCol(vec3 zen, vec3 mid, vec3 hor, float el) {
    float e = el / 1.5708;
    return mix(mix(hor, mid, smoothstep(0.0, 0.2, e)), zen, smoothstep(0.2, 0.95, e));
  }
  float hillProf(vec4 H, float az) {
    if (H.w < 0.5) return -1.0;
    float p = sin(az * H.y + H.z) * 0.5 + 0.5;
    float q = sin(az * H.y * 2.37 + H.z * 1.7) * 0.5 + 0.5;
    float r = sin(az * H.y * 6.1 + H.z * 3.1) * 0.5 + 0.5;
    return H.x * (0.3 + 0.45 * p + 0.3 * q * p + 0.08 * r);
  }
  vec3 hills(vec3 c, vec4 H, vec3 C, vec3 D, float az, float el, vec3 hor) {
    float h = hillProf(H, az);
    if (el >= h) return c;
    float streak = fbm(vec2(az * 30.0, el * 260.0));
    vec3 hc = mix(D, C, smoothstep(-0.01, h, el) * 0.8 + (streak - 0.5) * 0.5);
    return mix(hc, hor, 0.25 * (1.0 - smoothstep(0.0, h, el)));
  }
  void main() {
    vec3 d = normalize(vDir);
    float el = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.x, -d.z);
    vec3 c0 = skyCol(uZen0, uMid0, uHor0, max(el, 0.0)), c1 = skyCol(uZen1, uMid1, uHor1, max(el, 0.0));
    c0 = hills(c0, uHill0, uHillC0, uHillD0, az, el, uHor0);
    c1 = hills(c1, uHill1, uHillC1, uHillD1, az, el, uHor1);
    vec3 c = mix(c0, c1, uMix);
    float st = fbm(vec2(az * 7.0 + uTime * 0.004, el * 48.0));
    c *= 0.88 + 0.24 * st;
    c = mix(c, uLand, smoothstep(0.0, -0.035, el));
    c = mix(LINEN * (0.95 + 0.07 * vnoise(vec2(az * 260.0, el * 260.0))), c, smoothstep(st - 0.12, st + 0.12, uIntro * 1.35 - 0.2));
    c = mix(c, LINEN * (0.95 + 0.08 * vnoise(vec2(az * 300.0, el * 300.0))), uBare);
    gl_FragColor = vec4(c, 1.0);
  }
`;

// --------------------------------------------------------- building a sky --
class Pack {
  constructor() { this.d = []; this.t = []; this.size = []; this.col = []; this.col2 = []; this.axis = []; this.n = 0; }
  push(d, t, hl, hw, bend, row, c, emit, c2, r, axis, phase) {
    this.d.push(...d); this.t.push(...t); this.size.push(hl, hw, bend, row);
    this.col.push(c[0], c[1], c[2], emit); this.col2.push(c2[0], c2[1], c2[2], r);
    this.axis.push(axis[0], axis[1], axis[2], phase); this.n++;
  }
}

const tangents = d => {
  const up = Math.abs(d[1]) > 0.999 ? [1, 0, 0] : [0, 1, 0];
  const east = norm3(cross3(up, d));        // increasing azimuth, seen from inside
  const north = norm3(cross3(d, east));
  return [mul3(east, -1), north];
};

function buildSky(cfg, seed) {
  const sky = cfg.sky, R = rng(seed);
  const P = new Pack();
  const low = (sky.low || ['#888888']).map(lin), high = (sky.high || ['#888888']).map(lin);
  const light = (sky.light || ['#ffffff']).map(lin);
  const bare = sky.bare || 0, dots = sky.dots || 0, swirl = sky.swirl || 0, wave = sky.wave || 0;
  const V = (sky.vortices || []).map(v => ({ ...v }));
  for (let i = 0; i < (sky.eddies || 0); i++)
    V.push({ az: R.range(-180, 180), el: R.range(10, 58), r: R.range(4.5, 9), dir: R.sign(), s: R.range(0.45, 0.85) });
  V.forEach(v => { v.c = dirAzEl(v.az, v.el); v.rr = v.r * DEG; });
  // hills that are painted: the field's strokes under the dome's ridge take the ridge's colours, so that a range
  // that is meant to be seen (the Alpilles) is his marks and not the dome showing through between them. The
  // profile is the dome's own, line for line.
  const hills = sky.hills && sky.hills.paint ? sky.hills : null;
  const HH = hills ? [hills.h * DEG, hills.f, hills.seed ?? hills.f * 1.7] : null;
  const hillC = hills ? lin(hills.col) : null, hillD = hills ? lin(hills.col2 || hills.col) : null;
  const hillProf = a => {
    const p = Math.sin(a * HH[1] + HH[2]) * 0.5 + 0.5, q = Math.sin(a * HH[1] * 2.37 + HH[2] * 1.7) * 0.5 + 0.5;
    const r = Math.sin(a * HH[1] * 6.1 + HH[2] * 3.1) * 0.5 + 0.5;
    return HH[0] * (0.3 + 0.45 * p + 0.3 * q * p + 0.08 * r);
  };

  const flowAt = (d, az, el) => {
    const [east, north] = tangents(d);
    const th = wave * 0.55 * Math.sin(az * DEG * 3 + el * DEG * 7 + 1.3) + wave * 0.3 * Math.sin(az * DEG * 7.3 - el * DEG * 3.1);
    let t = add3(mul3(east, Math.cos(th)), mul3(north, Math.sin(th)));
    let best = null, bw = 0;
    for (const v of V) {
      const ang = Math.acos(clamp(dot3(d, v.c), -1, 1));
      const w = smoothstep(v.rr * 1.8, v.rr * 0.55, ang) * swirl * v.s;
      if (w > bw) { bw = w; best = { v, ang }; }
    }
    let axis = [0, 0, 0];
    if (best) {
      const tv = mul3(norm3(cross3(best.v.c, d)), best.v.dir);
      t = norm3(add3(mul3(t, 1 - bw), mul3(tv, bw)));
      if (bw > 0.3) axis = mul3(best.v.c, best.v.dir * 0.045 * best.v.s * (1.25 - 0.5 * best.ang / best.v.rr));
    }
    t = norm3(sub3(t, mul3(d, dot3(t, d))));
    return { t, best, bw, axis };
  };

  // the field of the sky: long marks laid side by side along the flow, their
  // colour from broad bands that follow the wind rather than a coin toss each
  const band = (d, f, o) => (noise2(d[0] * f + o, d[2] * f) + noise2(d[1] * f * 1.3 + o * 2, d[0] * f + 7.1) + noise2(d[2] * f + 3.3, d[1] * f + o)) / 3;
  const N = Math.round(11000 * (1 - 0.75 * bare) * (sky.density || 1) * (1 + dots * 1.3));
  for (let i = 0; i < N; i++) {
    const y = -0.06 + 1.06 * Math.pow(R(), 1.25);
    const el = Math.asin(clamp(y, -1, 1)) / DEG, az = R.range(-180, 180);
    const d = dirAzEl(az, el);
    const { t, best, bw, axis } = flowAt(d, az, el);
    let hl = R.range(1.5, 2.5) * DEG, hw = R.range(0.42, 0.6) * DEG;
    if (dots) { hl = lerp(hl, hw * 1.3, dots); hw *= lerp(1, 1.05, dots); }
    if (best && bw > 0.4) hl *= 0.82;
    const b1 = band(d, 2.2, 0.0), b2 = band(d, 3.1, 11.0);
    const pick = (arr, v) => arr[Math.floor(clamp(v * 1.8 - 0.4 + (R() - 0.5) * 0.45, 0, 0.999) * arr.length)];
    const e01 = clamp(el / 46, 0, 1);
    let c = mixc(pick(low, b1), pick(high, b2), smoothstep(0.1, 0.8, e01 + (b1 - 0.5) * 0.45));
    if (best && bw > 0.2) {
      const ring = Math.sin(best.ang / best.v.rr * 8.5 + best.v.az);
      if (ring > 0.1) c = mixc(c, pick(light, b2), 0.66 * bw);
    } else if (band(d, 5.0, 23.0) > 0.66) c = mixc(c, pick(light, b1), 0.4);
    c = jitter(c, R, 0.05);
    if (bare) c = mixc(c, [0.807, 0.761, 0.644], bare * 0.7);
    let c2 = mixc(c, pick(light, b1), 0.3);
    if (hills) {
      const hh = hillProf(az * DEG);
      if (el * DEG < hh) { c = jitter(mixc(hillD, hillC, clamp(el * DEG / hh, 0, 1) * 0.8 + (R() - 0.5) * 0.3), R, 0.06); c2 = mixc(c, hillD, 0.5); }
    }
    P.push(d, t, hl, hw, R.range(-0.12, 0.12) + (best ? best.v.dir * 0.4 * bw : 0), Math.floor(R() * 8), c, 0, c2, R(), axis, R() * 6.28);
  }

  // clouds: knots of lighter strokes curling on themselves
  const ccols = (sky.cloudCols || []).map(lin);
  for (let k = 0; k < (sky.clouds || 0); k++) {
    const caz = R.range(-180, 180), cel = R.range(9, 34), cr = R.range(5, 11);
    const cc = dirAzEl(caz, cel), [ce, cn] = tangents(cc);
    const n = Math.round(cr * cr * 7);
    const flat = R.range(0.45, 0.7);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * cr * DEG;
      const off = add3(mul3(ce, Math.cos(a) * rr), mul3(cn, Math.sin(a) * rr * flat));
      const d = norm3(add3(cc, off));
      const lump = Math.sin(a * 3 + k) * 0.5 + 0.5;
      if (rr > cr * DEG * (0.6 + 0.4 * lump)) continue;
      let t = norm3(add3(mul3(ce, -Math.sin(a)), mul3(cn, Math.cos(a) * flat)));
      t = norm3(add3(t, mul3(ce, 0.6)));
      t = norm3(sub3(t, mul3(d, dot3(t, d))));
      const up = Math.sin(a);
      const c = jitter(ccols[Math.min(ccols.length - 1, Math.floor((1 - (up * 0.5 + 0.5)) * ccols.length))] || [1, 1, 1], R, 0.06);
      P.push(d, t, R.range(0.8, 1.5) * DEG, R.range(0.32, 0.46) * DEG, R.range(-0.4, 0.4), Math.floor(R() * 8), c, 0.05,
             mixc(c, [1, 1, 1], 0.3), R(), [0, 0.004, 0], R() * 6.28);
    }
  }

  const glows = [];
  const halo = (sky.halo || ['#ffffff']).map(lin);
  // a star: a hot core and rings of short strokes round it
  const star = (az, el, size, bright) => {
    const c0 = dirAzEl(az, el), [e, nn] = tangents(c0);
    const core = lin(sky.starCol || '#fff4c0');
    for (let i = 0; i < 10 + size * 10; i++) {
      const a = R() * 6.28, rr = Math.sqrt(R()) * size * 0.55 * DEG;
      const d = norm3(add3(c0, add3(mul3(e, Math.cos(a) * rr), mul3(nn, Math.sin(a) * rr))));
      const t = norm3(add3(mul3(e, -Math.sin(a)), mul3(nn, Math.cos(a))));
      P.push(d, t, size * 0.4 * DEG, size * 0.2 * DEG, 0.3, Math.floor(R() * 8), core, 0.9 * bright, core, R(), [0, 0, 0], 0);
    }
    const rings = size > 0.8 ? 3 : 1;
    for (let k = 1; k <= rings; k++) {
      const rad = size * (0.7 + 0.55 * k) * DEG;
      const m = Math.round(7 + rad / DEG * 6);
      for (let i = 0; i < m; i++) {
        const a = (i / m) * 6.28 + R() * 0.3;
        const d = norm3(add3(c0, add3(mul3(e, Math.cos(a) * rad), mul3(nn, Math.sin(a) * rad))));
        const t = norm3(add3(mul3(e, -Math.sin(a)), mul3(nn, Math.cos(a))));
        const hc = jitter(halo[Math.min(halo.length - 1, k - 1)], R, 0.05);
        P.push(d, t, rad * R.range(0.42, 0.62), size * 0.22 * DEG, 0.95, Math.floor(R() * 8), hc, (0.22 / k) * bright, mixc(hc, core, 0.3), R(), [0, 0, 0], 0);
      }
    }
    glows.push([...c0, size * 2.4 * DEG, ...core, 0.16 * bright]);
  };
  (sky.named || []).forEach(s => star(s.az, s.el, R.range(0.85, 1.15), 0.8));
  if (sky.dipper) [[-14, 30], [-8, 33], [-2, 34], [4, 32], [9, 30], [12, 24], [18, 25]].forEach(([a, e]) => star(a, e, 0.9, 1));
  for (let i = 0; i < (sky.stars || 0); i++) {
    const el = R.range(6, 80), az = R.range(-180, 180);
    star(az, el, R.range(0.2, 0.55), R.range(0.35, 0.8));
  }
  if (sky.moon) {
    const m = sky.moon, c0 = dirAzEl(m.az, m.el), [e, nn] = tangents(c0);
    const mc = [lin('#f6c142'), lin('#f0a830'), lin('#fbe07a')];
    for (let i = 0; i < 260; i++) {
      const a = R() * 6.28, rr = Math.sqrt(R()) * m.r * DEG;
      const off = add3(mul3(e, Math.cos(a) * rr), mul3(nn, Math.sin(a) * rr));
      const bite = add3(off, mul3(e, -m.r * 0.55 * DEG));
      if (Math.hypot(...bite) < m.r * 0.78 * DEG) continue;
      const d = norm3(add3(c0, off));
      const t = norm3(add3(mul3(e, -Math.sin(a)), mul3(nn, Math.cos(a))));
      P.push(d, t, m.r * 0.22 * DEG, m.r * 0.08 * DEG, 0.6, Math.floor(R() * 8), R.pick(mc), 0.5, R.pick(mc), R(), [0, 0, 0], 0);
    }
    for (let k = 1; k <= 4; k++) {
      const rad = m.r * (1.0 + 0.42 * k) * DEG, cnt = Math.round(22 + k * 10);
      const hc = [lin('#f4d860'), lin('#e8e090'), lin('#c8d8a8'), lin('#9ab8c0')][k - 1];
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * 6.28 + R() * 0.1;
        const d = norm3(add3(c0, add3(mul3(e, Math.cos(a) * rad), mul3(nn, Math.sin(a) * rad))));
        const t = norm3(add3(mul3(e, -Math.sin(a)), mul3(nn, Math.cos(a))));
        P.push(d, t, rad * 0.27, m.r * 0.11 * DEG, 0.95, Math.floor(R() * 8), jitter(hc, R, 0.05), 0.24 / k, hc, R(), [0, 0, 0], 0);
      }
    }
    glows.push([...c0, m.r * 3.0 * DEG, ...lin('#ffd76a'), 0.12]);
  }
  if (sky.sun) {
    const su = sky.sun, c0 = dirAzEl(su.az, su.el), [e, nn] = tangents(c0);
    const col = lin(su.col), hal = (su.halo || [su.col]).map(lin);
    for (let i = 0; i < Math.round(su.r * su.r * 22); i++) {
      const a = R() * 6.28, rr = Math.sqrt(R()) * su.r * DEG;
      const d = norm3(add3(c0, add3(mul3(e, Math.cos(a) * rr), mul3(nn, Math.sin(a) * rr))));
      const t = norm3(add3(mul3(e, -Math.sin(a)), mul3(nn, Math.cos(a))));
      P.push(d, t, su.r * 0.18 * DEG, su.r * 0.07 * DEG, 0.5, Math.floor(R() * 8), jitter(col, R, 0.06), 0.55, mixc(col, [1, 1, 1], 0.25), R(), [0, 0, 0], 0);
    }
    for (let k = 0; k < hal.length + 1; k++) {
      const rad = su.r * (1.25 + 0.5 * k) * DEG, cnt = Math.round(36 + k * 20);
      const hc = hal[Math.min(k, hal.length - 1)];
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * 6.28 + R() * 0.12;
        const d = norm3(add3(c0, add3(mul3(e, Math.cos(a) * rad), mul3(nn, Math.sin(a) * rad))));
        const radial = R() < 0.14;
        const t = radial ? norm3(add3(mul3(e, Math.cos(a)), mul3(nn, Math.sin(a))))
                         : norm3(add3(mul3(e, -Math.sin(a)), mul3(nn, Math.cos(a))));
        P.push(d, t, rad * (radial ? 0.1 : 0.2), su.r * 0.1 * DEG, radial ? 0 : 0.9, Math.floor(R() * 8), jitter(hc, R, 0.05), 0.17 / (k + 1), mixc(hc, col, 0.3), R(), [0, 0, 0], 0);
      }
    }
    glows.push([...c0, su.r * 3.6 * DEG, ...col, 0.2]);
  }
  return { P, glows };
}

function packGeometry(P) {
  const g = ribbon(4);
  const add = (name, arr, n) => g.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(arr), n));
  add('iDir', P.d, 3); add('iTan', P.t, 3); add('iSize', P.size, 4);
  add('iCol', P.col, 4); add('iCol2', P.col2, 4); add('iAxis', P.axis, 4);
  g.instanceCount = P.n;
  return g;
}

const avg = arr => { const m = arr.map(lin); return [0, 1, 2].map(k => m.reduce((s, c) => s + c[k], 0) / m.length); };
const domeCache = new Map();
function domeCols(sky) {
  if (domeCache.has(sky)) return domeCache.get(sky);
  const lo = avg(sky.low || [sky.horizon]), hi = avg(sky.high || [sky.zenith]);
  const r = [mixc(lin(sky.zenith), hi, 0.6), mixc(lin(sky.mid), mixc(lo, hi, 0.5), 0.6), mixc(lin(sky.horizon), lo, 0.55)];
  domeCache.set(sky, r);
  return r;
}

export class Sky {
  constructor(U, stations) {
    this.U = U;
    this.stations = stations;
    this.scene = new THREE.Scene();
    this.layers = new Array(NST).fill(null);
    this.dir = new THREE.Vector3(0, 0, -1);   // the way you were walking when you went through the last door
    this.domeU = {
      uZen0: { value: new THREE.Color() }, uMid0: { value: new THREE.Color() }, uHor0: { value: new THREE.Color() },
      uZen1: { value: new THREE.Color() }, uMid1: { value: new THREE.Color() }, uHor1: { value: new THREE.Color() },
      uLand: { value: new THREE.Color() },
      uHill0: { value: new THREE.Vector4() }, uHill1: { value: new THREE.Vector4() },
      uHillC0: { value: new THREE.Color() }, uHillC1: { value: new THREE.Color() },
      uHillD0: { value: new THREE.Color() }, uHillD1: { value: new THREE.Color() },
      uMix: { value: 0 }, uBare: { value: 0 }, uTime: U.uTime, uIntro: U.uIntro,
    };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40),
      new THREE.ShaderMaterial({ vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, uniforms: this.domeU,
        side: THREE.BackSide, depthTest: false, depthWrite: false }));
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    this.scene.add(dome);
  }

  layer(i) {
    if (this.layers[i]) return this.layers[i];
    const { P, glows } = buildSky(this.stations[i], 7001 + (this.stations[i].id - 1) * 131);
    const u = { uTime: this.U.uTime, uFade: { value: 0 }, uSide: { value: 0 }, uBrush: this.U.uBrush,
                uFlow: { value: 1 }, uOpacity: { value: 1 }, uIntro: this.U.uIntro, uWipeDir: { value: this.dir } };
    const mesh = new THREE.Mesh(packGeometry(P), new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: u,
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    mesh.frustumCulled = false;
    mesh.renderOrder = -5;
    const group = new THREE.Group();
    group.add(mesh);
    if (glows.length) {
      const g = ribbon(1);
      const gd = [], gc = [];
      glows.forEach(v => { gd.push(v[0], v[1], v[2], v[3]); gc.push(v[4], v[5], v[6], v[7]); });
      g.setAttribute('gDir', new THREE.InstancedBufferAttribute(new Float32Array(gd), 4));
      g.setAttribute('gCol', new THREE.InstancedBufferAttribute(new Float32Array(gc), 4));
      g.instanceCount = glows.length;
      const gm = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
        uniforms: u, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      gm.frustumCulled = false;
      gm.renderOrder = -4;
      group.add(gm);
    }
    group.visible = false;
    this.scene.add(group);
    this.layers[i] = { group, u, count: P.n };
    return this.layers[i];
  }

  // the sky of world a, going over to world b's by f; dir is the way you were walking through the door
  update(a, b, f, dir) {
    if (dir) this.dir.copy(dir);
    if (f >= 1) { a = b; f = 0; }
    const A = this.layer(a), Bl = this.layer(b);
    this.layers.forEach((l, i) => { if (l) l.group.visible = i === a || (i === b && f > 0.001); });
    A.u.uSide.value = 0; A.u.uFade.value = f;
    if (b !== a) { Bl.u.uSide.value = 1; Bl.u.uFade.value = f; }
    const sa = this.stations[a].sky, sb = this.stations[b].sky, D = this.domeU;
    const ga = domeCols(sa), gb = domeCols(sb);
    D.uZen0.value.setRGB(...ga[0]); D.uMid0.value.setRGB(...ga[1]); D.uHor0.value.setRGB(...ga[2]);
    D.uZen1.value.setRGB(...gb[0]); D.uMid1.value.setRGB(...gb[1]); D.uHor1.value.setRGB(...gb[2]);
    const hill = (h, V, C, Dd) => {
      if (!h) { V.set(0, 1, 0, 0); return; }
      V.set(h.h * DEG, h.f, (h.seed ?? h.f * 1.7), 1);
      C.setRGB(...lin(h.col)); Dd.setRGB(...lin(h.col2 || h.col));
    };
    hill(sa.hills, D.uHill0.value, D.uHillC0.value, D.uHillD0.value);
    hill(sb.hills, D.uHill1.value, D.uHillC1.value, D.uHillD1.value);
    D.uMix.value = f;
    D.uBare.value = lerp(sa.bare || 0, sb.bare || 0, f) * 0.85;
    D.uLand.value.copy(this.U.uFogCol.value);
    // prefetch the next sky while this one is up
    const n = Math.max(a, b) + 1;
    if (n < NST && !this.layers[n] && !this._pending) {
      this._pending = true;
      setTimeout(() => { this.layer(n); this._pending = false; }, 400);
    }
  }
}
