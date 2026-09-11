// Strokes on things: every house, tree and easel is a cloud of brush marks
// laid on its surface, facing out, lit by the station's light, and painted in
// when you arrive -- nearest first, from the ground up. A plain core behind the
// marks keeps the sky from showing through the gaps.
import * as THREE from 'three';
import { NOISE, BRUSH, LIGHT } from './brush.js';
import { ribbon } from './sky.js';

const VERT = /* glsl */`
  ${NOISE}
  ${LIGHT}
  attribute vec2 aUV;
  attribute vec3 iPos, iDir, iNrm;
  attribute vec4 iShape, iCol, iCol2, iAnim;
  uniform float uProgress, uWind, uArrive;
  varying vec2 vST; varying vec3 vCol, vCol2, vP, vN, vT, vB; varying float vRow, vEmit;
  void main() {
    float arrive = clamp((uProgress - iCol2.w) / uArrive, 0.0, 1.0);
    if (arrive <= 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    vec3 T = normalize(iDir), N = normalize(iNrm);
    vec3 Bv = normalize(cross(N, T));
    float x = -1.0 + aUV.x * 2.0 * arrive;
    float len = iShape.x, wid = iShape.y;
    float taper = sqrt(max(0.0, 1.0 - pow(abs(aUV.x * 2.0 - 1.0), 6.0)));
    vec3 p = iPos + T * (x * len) + Bv * (aUV.y * wid * (0.35 + 0.65 * taper) + iShape.z * len * (x * x - 0.33));
    float h = max(p.y - iAnim.z, 0.0);
    p += vec3(sin(uTime * 1.25 + iAnim.y), 0.0, 0.6 * cos(uTime * 1.05 + iAnim.y * 1.7)) * iAnim.x * h * h * 0.0035 * uWind;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    mat3 m3 = mat3(modelMatrix);
    vST = aUV; vRow = iShape.w;
    vCol = iCol.rgb; vEmit = iCol.w; vCol2 = iCol2.rgb;
    vP = wp.xyz; vN = normalize(m3 * N); vT = normalize(m3 * T); vB = normalize(m3 * Bv);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const FRAG = /* glsl */`
  ${NOISE}
  ${BRUSH}
  ${LIGHT}
  varying vec2 vST; varying vec3 vCol, vCol2, vP, vN, vT, vB; varying float vRow, vEmit;
  void main() {
    vec4 br = brush(vST, vRow);
    float a = smoothstep(0.22, 0.55, br.g);
    if (a < 0.02) discard;
    vec3 V = normalize(uCam - vP);
    vec3 Ng = dot(vN, V) < 0.0 ? -vN : vN;
    vec3 nt = brushNormal(vST, vRow, br.r, 2.0);
    vec3 N = normalize(vT * nt.x + vB * nt.y + Ng * nt.z);
    vec3 alb = mix(vCol, vCol2, br.a * 0.75) * (0.82 + 0.36 * br.b);
    vec3 c = paintShade(alb, N, V, vP, 0.45 * br.r);
    c += vCol * vEmit * (0.6 + 0.8 * br.r);
    gl_FragColor = vec4(fogged(c, vP), a);
  }
`;

export class StrokeBuilder {
  constructor() { this.pos = []; this.dir = []; this.nrm = []; this.shape = []; this.col = []; this.col2 = []; this.anim = []; this.n = 0; }
  // len and wid are half-extents in metres
  add(p, d, n, len, wid, col, o = {}) {
    this.pos.push(p[0], p[1], p[2]); this.dir.push(d[0], d[1], d[2]); this.nrm.push(n[0], n[1], n[2]);
    this.shape.push(len, wid, o.bend ?? 0, o.row ?? ((this.n * 5) % 8));
    this.col.push(col[0], col[1], col[2], o.emit ?? 0);
    const c2 = o.col2 || col;
    this.col2.push(c2[0], c2[1], c2[2], o.order ?? 0);
    this.anim.push(o.sway ?? 0, o.phase ?? 0, o.base ?? 0, 0);
    this.n++;
  }
  build(U, extra = {}) {
    const g = ribbon(4);
    const A = (name, arr, k) => g.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(arr), k));
    A('iPos', this.pos, 3); A('iDir', this.dir, 3); A('iNrm', this.nrm, 3);
    A('iShape', this.shape, 4); A('iCol', this.col, 4); A('iCol2', this.col2, 4); A('iAnim', this.anim, 4);
    g.instanceCount = this.n;
    const u = { ...U, uProgress: { value: 0 }, uWind: { value: 1 }, uArrive: { value: 0.035 }, ...extra };
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u,
      side: THREE.DoubleSide, alphaToCoverage: true }));
    m.frustumCulled = false;
    return m;
  }
}

const CORE_VERT = /* glsl */`
  ${NOISE}
  ${LIGHT}
  attribute vec3 aCol; attribute float aOrder;
  varying vec3 vP, vN, vC; varying float vO;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vC = aCol; vO = aOrder;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const CORE_FRAG = /* glsl */`
  ${NOISE}
  ${LIGHT}
  uniform float uProgress;
  varying vec3 vP, vN, vC; varying float vO;
  void main() {
    if (uProgress < vO) discard;
    vec3 V = normalize(uCam - vP);
    vec3 N = normalize(vN); if (dot(N, V) < 0.0) N = -N;
    float n = vnoise(vP.xz * 4.0 + vP.y * 3.0);
    vec3 c = paintShade(vC * (0.85 + 0.25 * n), N, V, vP, 0.0);
    gl_FragColor = vec4(fogged(c, vP), 1.0);
  }
`;

// solid shapes behind the marks
export class CoreBuilder {
  constructor() { this.p = []; this.n = []; this.c = []; this.o = []; }
  tri(a, b, c, col, ord) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
    for (const p of [a, b, c]) { this.p.push(...p); this.n.push(...n); this.c.push(...col); this.o.push(ord); }
  }
  quad(a, b, c, d, col, ord) { this.tri(a, b, c, col, ord); this.tri(a, c, d, col, ord); }
  // local frame helper: yaw about y
  frame(x, y, z, yaw) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    return (lx, ly, lz) => [x + lx * cy + lz * sy, y + ly, z - lx * sy + lz * cy];
  }
  box(x, y, z, hx, hy, hz, yaw, col, ord) {
    const W = this.frame(x, y, z, yaw);
    const P = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]].map(v => W(...v));
    [[4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6], [0, 4, 7, 3], [7, 6, 2, 3], [0, 1, 5, 4]].forEach(([a, b, c, d]) => this.quad(P[a], P[b], P[c], P[d], col, ord));
  }
  // a roof: ridge along local x at height rh above y, eaves at +-hz
  gable(x, y, z, hx, hz, rh, yaw, col, ord) {
    const W = this.frame(x, y, z, yaw);
    const A = W(-hx, 0, hz), B = W(hx, 0, hz), C = W(hx, rh, 0), D = W(-hx, rh, 0), E = W(-hx, 0, -hz), F = W(hx, 0, -hz);
    this.quad(A, B, C, D, col, ord); this.quad(F, E, D, C, col, ord);
    this.tri(B, F, C, col, ord); this.tri(E, A, D, col, ord);
  }
  // a surface of revolution about a vertical axis: r(t) for t in 0..1 over height h
  lathe(x, y, z, rf, h, col, ord, seg = 12, rows = 10) {
    for (let j = 0; j < rows; j++) {
      const t0 = j / rows, t1 = (j + 1) / rows, r0 = rf(t0), r1 = rf(t1);
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        const P = (r, a, t) => [x + Math.cos(a) * r, y + t * h, z + Math.sin(a) * r];
        this.quad(P(r0, a0, t0), P(r0, a1, t0), P(r1, a1, t1), P(r1, a0, t1), col, ord);
      }
    }
  }
  ellipsoid(x, y, z, rx, ry, rz, col, ord, seg = 10, rows = 7) {
    for (let j = 0; j < rows; j++) {
      const v0 = (j / rows) * Math.PI - Math.PI / 2, v1 = ((j + 1) / rows) * Math.PI - Math.PI / 2;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        const P = (a, v) => [x + Math.cos(a) * Math.cos(v) * rx, y + Math.sin(v) * ry, z + Math.sin(a) * Math.cos(v) * rz];
        this.quad(P(a0, v0), P(a1, v0), P(a1, v1), P(a0, v1), col, ord);
      }
    }
  }
  build(U, extra = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aOrder', new THREE.Float32BufferAttribute(this.o, 1));
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: CORE_VERT, fragmentShader: CORE_FRAG,
      uniforms: { ...U, uProgress: { value: 0 }, ...extra }, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    return m;
  }
}
