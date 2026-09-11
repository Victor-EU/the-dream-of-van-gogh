// What stands in the land: poplars at Nuenen, a windmill over Paris, orchards
// in blossom, haystacks, the Yellow House, the café terrace and the gaslit
// Rhône, the cypress under the Starry Night, the church at Auvers -- and at
// each station an easel, where his painting of the place will paint itself.
import * as THREE from 'three';
import { StrokeBuilder, CoreBuilder } from './strokes.js';
import * as J from './journey.js';
import { SIZES } from './sizes.js';
import { rng, lin, mixc, scalec, jitter, norm3, cross3, dot3, add3, sub3, mul3, clamp, lerp } from './util.js';

const UP = [0, 1, 0];
const P = a => a.map(lin);
const proj = (v, n) => norm3(sub3(v, mul3(n, dot3(v, n))));
const avgc = cs => [0, 1, 2].map(k => cs.reduce((s, c) => s + c[k], 0) / cs.length);
const flame = t => (t < 0.22 ? lerp(0.55, 1, t / 0.22) : Math.pow(Math.max(0, 1 - (t - 0.22) / 0.78), 0.85));
const spindle = t => Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.75);

class Ctx {
  constructor(i, st) {
    this.i = i; this.st = st;
    this.z0 = J.stationZ(i); this.x0 = J.roadX(this.z0);
    this.R = rng(4200 + (st.id - 1) * 97);   // by the station's own number, so it keeps its look wherever it stands
    this.S = new StrokeBuilder(); this.C = new CoreBuilder();
    this.easels = []; this.lamps = []; this.colliders = []; this.movers = [];
    this.base = 0;
  }
  gy(x, z) { return J.terrainH(x, z); }
  rx(z) { return J.roadX(z); }
  // nearer the easel, sooner: a station paints itself outward from where he stood
  at(x, z) { this.base = clamp(Math.hypot(x - this.x0, (z - this.z0) * 0.8) / 90, 0, 1) * 0.62; return this.base; }
  ord(f) { return this.base + clamp(f, 0, 1) * 0.3 + this.R() * 0.03; }
  add(p, d, n, len, wid, col, o = {}) { this.S.add(p, d, n, len, wid, col, o); }
  line(a, b, n, wid, cols, o = {}) {
    const v = sub3(b, a), L = Math.hypot(v[0], v[1], v[2]), k = Math.max(1, Math.round(L / (o.seg ?? 0.35))), d = norm3(v);
    for (let i = 0; i < k; i++) {
      const t = (i + 0.5) / k;
      this.add(add3(a, mul3(v, t)), d, n, (L / k) * 0.62, wid, jitter(this.R.pick(cols), this.R, 0.08), { ...o, order: o.order ?? this.ord(t) });
    }
  }
}

// ----------------------------------------------------------------- trees --
function cypress(c, x, z, H = 13, R0 = 1.6, o = {}) {
  const R = c.R; c.at(x, z);
  const b = c.gy(x, z) - 0.15;
  const cols = P(o.cols || ['#0f2a1f', '#1d3b2a', '#2f5a3a', '#244636', '#3a6446', '#15283a', '#2a4a30']);
  const hi = P(o.hi || ['#6a8a4a', '#8a9a5a', '#4f7a52']);
  const seed = R() * 10;
  c.C.lathe(x, b, z, t => R0 * 0.8 * flame(t), H * 0.96, scalec(cols[0], 0.9), c.ord(0.02), 12, 12);
  const n = Math.round(H * R0 * 100);
  for (let i = 0; i < n; i++) {
    const t = Math.pow(R(), 0.9), a = R() * Math.PI * 2;
    const lobe = 1 + 0.2 * Math.sin(a * 3 + t * 11 + seed) + 0.1 * Math.sin(a * 5 - t * 7 + seed);
    const r = R0 * flame(t) * lobe * (0.9 + 0.2 * R());
    const p = [x + Math.cos(a) * r, b + t * H, z + Math.sin(a) * r];
    const nrm = norm3([Math.cos(a), 0.2 + (t > 0.8 ? 4 * (t - 0.8) : 0), Math.sin(a)]);
    const tw = 0.8 * Math.sin(t * 8 + a * 2 + seed);
    const d = proj(add3(UP, mul3([-Math.sin(a), 0, Math.cos(a)], tw)), nrm);
    const col = jitter(R.pick(cols), R, 0.12);
    c.add(p, d, nrm, R.range(0.26, 0.5) * Math.sqrt(H / 13), R.range(0.08, 0.13), col,
      { col2: R() < 0.35 ? R.pick(hi) : col, bend: R.range(-0.3, 0.3), sway: 1, phase: x * 0.3 + z * 0.2, base: b, order: c.ord(t) });
  }
  c.colliders.push({ x, z, r: R0 * 0.75 + 0.4 });
}

function poplar(c, x, z, o = {}) {
  const R = c.R; c.at(x, z);
  const b = c.gy(x, z) - 0.1, H = o.H ?? 14, R0 = o.R0 ?? 1.1, th = H * 0.16;
  const leaves = P(o.cols || ['#b8802a', '#d09a38', '#8a5a20', '#6a4a22', '#e0b050', '#5a4a2a']);
  const bark = P(['#2a2018', '#3a2c20', '#1c1a1e']);
  for (let i = 0; i < 16; i++) {
    const a = R() * 6.28, n = [Math.cos(a), 0, Math.sin(a)];
    c.add([x + n[0] * 0.13, b + R() * (th + 1), z + n[2] * 0.13], UP, n, 0.32, 0.05, R.pick(bark), { order: c.ord(0) });
  }
  c.C.lathe(x, b + th, z, t => R0 * 0.72 * spindle(t), H - th, scalec(leaves[3], 0.8), c.ord(0.1), 10, 10);
  const n = Math.round(H * R0 * 72);
  for (let i = 0; i < n; i++) {
    const t = R(), a = R() * Math.PI * 2, r = R0 * spindle(t) * (0.9 + 0.2 * R());
    const nrm = norm3([Math.cos(a), 0.12, Math.sin(a)]);
    const d = proj(add3(UP, mul3([-Math.sin(a), 0, Math.cos(a)], R.range(-0.45, 0.45))), nrm);
    const col = jitter(R.pick(leaves), R, 0.1);
    c.add([x + Math.cos(a) * r, b + th + t * (H - th), z + Math.sin(a) * r], d, nrm, R.range(0.2, 0.36), R.range(0.07, 0.1), col,
      { bend: R.range(-0.3, 0.3), sway: 1, phase: x * 0.2 + z * 0.3, base: b, order: c.ord(t) });
  }
  c.colliders.push({ x, z, r: 0.55 });
}

function tree(c, x, z, o = {}) {
  const R = c.R; c.at(x, z);
  const b = c.gy(x, z) - 0.1;
  const H = o.H ?? 6, cr = o.crown ?? 2.4, th = o.trunkH ?? H * 0.42, tr = o.trunkR ?? 0.2;
  const bark = P(o.bark || ['#3a2a1e', '#4a3526', '#2a2230', '#5a4030']);
  const leaves = P(o.leaves || ['#2f5a2a', '#4a7a30', '#6a9a3a', '#3a6a4a']);
  const lean = [R.range(-0.22, 0.22), 0, R.range(-0.22, 0.22)];
  const top = [x + lean[0] * th, b + th, z + lean[2] * th];
  const nt = Math.round(30 + th * tr * 130);
  for (let i = 0; i < nt; i++) {
    const t = R(), a = R() * Math.PI * 2, nrm = [Math.cos(a), 0, Math.sin(a)], r = tr * (1 - 0.3 * t);
    c.add([x + lean[0] * th * t + nrm[0] * r, b + t * th, z + lean[2] * th * t + nrm[2] * r], norm3([lean[0], 1, lean[2]]), nrm,
      R.range(0.16, 0.3), R.range(0.045, 0.075), jitter(R.pick(bark), R, 0.1), { order: c.ord(t * 0.25), sway: 0.15, phase: x, base: b });
  }
  c.C.lathe(top[0] * 0 + x, b, z, t => tr * 0.85 * (1 - 0.3 * t), th, scalec(bark[0], 0.9), c.ord(0.02), 8, 3);
  const lobes = [];
  const nl = o.lobes ?? 5;
  for (let k = 0; k < nl; k++) {
    const a = (k / nl) * Math.PI * 2 + R() * 0.9, rr = cr * R.range(0.3, 0.65);
    lobes.push({ c: [top[0] + Math.cos(a) * rr, top[1] + cr * R.range(0.35, 0.95), top[2] + Math.sin(a) * rr], r: cr * R.range(0.42, 0.62) });
  }
  lobes.push({ c: [top[0], top[1] + cr * 0.95, top[2]], r: cr * 0.6 });
  for (const L of lobes) {
    const e = add3(L.c, [0, -L.r * 0.3, 0]), v = sub3(e, top), len = Math.hypot(...v), d = norm3(v), n = norm3(cross3(d, [0.3, 0, 1]));
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5;
      c.add(add3(top, mul3(v, t)), d, n, len / 5 * 0.62, tr * (0.7 - 0.4 * t), jitter(R.pick(bark), R, 0.1), { order: c.ord(0.25 + t * 0.15), sway: 0.4, phase: x, base: b });
    }
  }
  for (const L of lobes) {
    c.C.ellipsoid(L.c[0], L.c[1], L.c[2], L.r * 0.8, L.r * 0.7, L.r * 0.8, scalec(avgc(leaves), 0.72), c.ord(0.42), 9, 6);
    const m = Math.round(L.r * L.r * (o.blossom ? 270 : 180));
    for (let i = 0; i < m; i++) {
      const u = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const nrm = [Math.cos(a) * s, u, Math.sin(a) * s];
      if (nrm[1] < -0.55 && R() < 0.6) continue;
      const p = add3(L.c, [nrm[0] * L.r * 0.92, nrm[1] * L.r * 0.8, nrm[2] * L.r * 0.92]);
      const d = proj(add3([-nrm[2], 0, nrm[0]], mul3([R() - 0.5, R() - 0.5, R() - 0.5], 1.2)), nrm);
      let col = jitter(R.pick(leaves), R, 0.1);
      if (nrm[1] > 0.4 && o.top) col = mixc(col, lin(o.top), 0.35);
      c.add(p, d, nrm, o.blossom ? R.range(0.1, 0.18) : R.range(0.14, 0.26), R.range(0.06, 0.1), col,
        { bend: R.range(-0.4, 0.4), sway: 1, phase: x * 0.2 + z * 0.1, base: b, order: c.ord(0.45 + 0.5 * (p[1] - b) / (H + cr)) });
    }
  }
  c.colliders.push({ x, z, r: tr + 0.45 });
}

function olive(c, x, z, o = {}) {
  tree(c, x, z, { H: 4.2, crown: 2.2, trunkH: 1.4, trunkR: 0.22, lobes: 6, bark: ['#4a3a40', '#6a5048', '#3a3a50', '#7a6050'],
    leaves: ['#6a8a70', '#8aa090', '#4a6a5a', '#a8b89a', '#5a7a8a', '#3f5f5a'], top: '#b8c8a0', ...o });
  const R = c.R, b = c.gy(x, z);
  for (let i = 0; i < 60; i++) {
    const a = R() * 6.28, r = Math.sqrt(R()) * 2.6;
    c.add([x + Math.cos(a) * r, b + 0.04, z + Math.sin(a) * r], [Math.cos(a + 1.6), 0, Math.sin(a + 1.6)], UP, R.range(0.2, 0.35), R.range(0.06, 0.1),
      jitter(lin(R.pick(['#3a4a8a', '#4a4a90', '#2f3f7a'])), R, 0.1), { order: c.ord(0.1) });
  }
}

// ------------------------------------------------------------ buildings --
function house(c, o) {
  const R = c.R;
  const { x, z, yaw = 0, w = 6, d = 5, h = 3.2, roofH = 2.2 } = o;
  c.at(x, z);
  const b = Math.min(c.gy(x - w / 2, z - d / 2), c.gy(x + w / 2, z + d / 2), c.gy(x, z)) - 0.15;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const W = (lx, ly, lz) => [x + lx * cy + lz * sy, b + ly, z - lx * sy + lz * cy];
  const Wd = (dx, dy, dz) => [dx * cy + dz * sy, dy, -dx * sy + dz * cy];
  const wall = P(o.wall), roof = P(o.roof);
  c.C.box(x, b + h / 2, z, w / 2 * 0.985, h / 2, d / 2 * 0.985, yaw, scalec(avgc(wall), 0.82), c.ord(0.03));
  if (roofH > 0) c.C.gable(x, b + h, z, w / 2 + 0.25, d / 2 + 0.25, roofH, yaw, scalec(avgc(roof), 0.8), c.ord(0.3));
  const wins = o.windows || [];
  const faces = [
    { n: [0, 0, 1], o: [0, 0, d / 2], u: [1, 0, 0], du: w, gable: false, id: 0 },
    { n: [0, 0, -1], o: [0, 0, -d / 2], u: [-1, 0, 0], du: w, gable: false, id: 1 },
    { n: [1, 0, 0], o: [w / 2, 0, 0], u: [0, 0, -1], du: d, gable: true, id: 2 },
    { n: [-1, 0, 0], o: [-w / 2, 0, 0], u: [0, 0, 1], du: d, gable: true, id: 3 },
  ];
  for (const f of faces) {
    const nW = Wd(...f.n), uW = Wd(...f.u);
    const cnt = Math.round(f.du * (h + (f.gable ? roofH / 2 : 0)) * (o.density ?? 15));
    for (let i = 0; i < cnt; i++) {
      const su = R() - 0.5, lu = su * f.du;
      const top = f.gable ? h + roofH * (1 - Math.abs(su * 2)) : h;
      const v = R() * top;
      const pw = W(...add3(add3(add3(f.o, mul3(f.u, lu)), [0, v, 0]), mul3(f.n, 0.04)));
      let col = jitter(R.pick(wall), R, 0.08), emit = 0;
      if (v < 0.5) col = scalec(col, 0.82);
      for (const wd of wins) {
        if (wd.face !== f.id || Math.abs(lu - wd.u) > wd.w / 2 || Math.abs(v - wd.v) > wd.h / 2) continue;
        const edge = Math.abs(lu - wd.u) > wd.w / 2 - 0.08 || Math.abs(v - wd.v) > wd.h / 2 - 0.08;
        col = edge ? lin(wd.frame || o.trim || '#2a2a2a') : jitter(lin(wd.col || '#1c2230'), R, 0.08);
        emit = edge ? 0 : (wd.k ?? 0);
      }
      const dir = norm3(add3(mul3(uW, R.range(-0.35, 0.35) + (o.horiz ? R.sign() * 1.6 : 0)), UP));
      c.add(pw, dir, nW, R.range(0.13, 0.24), R.range(0.06, 0.1), col, { order: c.ord(v / (h + roofH)), emit });
    }
    // window panes are filled even where no mark landed
    for (const wd of wins) if (wd.face === f.id) {
      const cnt2 = Math.round(wd.w * wd.h * 26);
      for (let i = 0; i < cnt2; i++) {
        const lu = wd.u + (R() - 0.5) * (wd.w - 0.12), v = wd.v + (R() - 0.5) * (wd.h - 0.12);
        const pw = W(...add3(add3(add3(f.o, mul3(f.u, lu)), [0, v, 0]), mul3(f.n, 0.05)));
        c.add(pw, norm3(add3(UP, mul3(uW, R.range(-0.4, 0.4)))), nW, R.range(0.08, 0.14), R.range(0.05, 0.08), jitter(lin(wd.col || '#1c2230'), R, 0.1), { order: c.ord(0.5), emit: wd.k ?? 0 });
      }
    }
  }
  if (roofH > 0) for (const s of [1, -1]) {
    const nL = norm3([0, d / 2 + 0.25, s * roofH]), nW = Wd(...nL);
    const cnt = Math.round((w + 0.5) * Math.hypot(d / 2 + 0.25, roofH) * (o.roofDensity ?? 16));
    const down = norm3(Wd(0, -roofH, s * (d / 2 + 0.25))), along = Wd(1, 0, 0);
    for (let i = 0; i < cnt; i++) {
      const lu = (R() - 0.5) * (w + 0.5), f = R();
      const pw = W(...add3([lu, h + roofH * f, s * (d / 2 + 0.25) * (1 - f)], mul3(nL, 0.05)));
      const dir = o.thatch ? norm3(add3(down, mul3(along, R.range(-0.25, 0.25)))) : norm3(add3(along, mul3(down, R.range(-0.25, 0.25))));
      c.add(pw, dir, nW, o.thatch ? R.range(0.22, 0.4) : R.range(0.14, 0.24), R.range(0.07, 0.11), jitter(R.pick(roof), R, 0.1),
        { order: c.ord(0.72 + 0.25 * f), bend: R.range(-0.25, 0.25) });
    }
  }
  const along = w >= d, L = along ? w : d, r = Math.min(w, d) * 0.62 + 0.3, nC = Math.max(1, Math.round(L / Math.min(w, d)));
  for (let k = 0; k < nC; k++) {
    const t = -L / 2 + (k + 0.5) * (L / nC), p = along ? W(t, 0, 0) : W(0, 0, t);
    c.colliders.push({ x: p[0], z: p[2], r });
  }
}

function boxStrokes(c, x, y, z, hx, hy, hz, yaw, cols, dens = 12) {
  const R = c.R, cs = P(cols);
  c.C.box(x, y + hy, z, hx * 0.98, hy * 0.98, hz * 0.98, yaw, scalec(avgc(cs), 0.8), c.ord(0.05));
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const W = (lx, ly, lz) => [x + lx * cy + lz * sy, y + hy + ly, z - lx * sy + lz * cy];
  const Wd = (dx, dy, dz) => [dx * cy + dz * sy, dy, -dx * sy + dz * cy];
  const faces = [[[0, 0, 1], hx, hy, hz, [1, 0, 0], [0, 1, 0]], [[0, 0, -1], hx, hy, hz, [1, 0, 0], [0, 1, 0]],
                 [[1, 0, 0], hz, hy, hx, [0, 0, 1], [0, 1, 0]], [[-1, 0, 0], hz, hy, hx, [0, 0, 1], [0, 1, 0]],
                 [[0, 1, 0], hx, hz, hy, [1, 0, 0], [0, 0, 1]]];
  for (const [n, a, bb, off, u, v] of faces) {
    const cnt = Math.round(4 * a * bb * dens);
    for (let i = 0; i < cnt; i++) {
      const su = (R() * 2 - 1) * a, sv = (R() * 2 - 1) * bb;
      const pl = add3(add3(mul3(n, off + 0.03), mul3(u, su)), mul3(v, sv));
      c.add(W(...pl), norm3(Wd(...add3(v, mul3(u, R.range(-0.4, 0.4))))), Wd(...n), R.range(0.12, 0.22), R.range(0.05, 0.09),
        jitter(R.pick(cs), R, 0.08), { order: c.ord((sv / bb + 1) / 2) });
    }
  }
}

function tower(c, x, z) {
  house(c, { x, z, w: 5, d: 5, h: 15, roofH: 7, wall: ['#4a4a4a', '#5a5550', '#3a3a3a', '#4a4440'], roof: ['#2a2a2a', '#3a3530', '#1e1e22'],
    density: 7, roofDensity: 7, windows: [{ face: 0, u: 0, v: 12, w: 1, h: 2, col: '#141414' }] });
}

function spire(c, x, z) {
  house(c, { x, z, w: 3, d: 3, h: 9, roofH: 8, wall: ['#1a2440', '#243050', '#1e2a48'], roof: ['#141c30', '#1c2438'], density: 9, roofDensity: 10 });
}

function village(c, cx, cz, n, spread, o = {}) {
  const R = c.R;
  for (let i = 0; i < n; i++) {
    const x = cx + R.range(-spread, spread), z = cz + R.range(-spread * 0.6, spread * 0.6);
    const w = R.range(3, 5.5), d = R.range(3, 4.5), h = R.range(2.6, 4.2);
    house(c, { x, z, yaw: R.range(-0.4, 0.4) + (R() < 0.5 ? 0 : Math.PI / 2), w, d, h, roofH: R.range(1.2, 2.2),
      wall: o.wall || ['#1f2c4a', '#2a3a5a', '#34466a', '#1a2440'], roof: o.roof || ['#28304a', '#3a3a5a', '#20263a'], density: 8, roofDensity: 8,
      windows: R() < 0.8 ? [{ face: 0, u: R.range(-w / 4, w / 4), v: h * 0.45, w: 0.7, h: 0.8, col: '#f2c04a', k: 1.8, frame: '#141a2a' }] : [] });
  }
}

function church(c, x, z, yaw) {
  const wall = ['#4a4a8a', '#5a5aa0', '#3a3a70', '#6a60a8', '#44448a'], win = '#1a2a6a';
  house(c, { x, z, yaw, w: 16, d: 7.5, h: 7.5, roofH: 4.5, wall, roof: ['#c0602a', '#a04a20', '#d0703a'], density: 12,
    windows: [-5.5, -2, 2, 5.5].map(u => ({ face: 0, u, v: 4.2, w: 1.3, h: 3.2, col: win, frame: '#c07030' })) });
  house(c, { x, z, yaw, w: 4.6, d: 4.6, h: 17, roofH: 5, wall, roof: ['#4a4a7a', '#3a3a6a'], density: 12,
    windows: [{ face: 0, u: 0, v: 14, w: 1.2, h: 1.8, col: win, frame: '#c07030' }, { face: 3, u: 0, v: 14, w: 1.2, h: 1.8, col: win, frame: '#c07030' }] });
}

// --------------------------------------------------------- little things --
function lamp(c, x, z, o = {}) {
  const R = c.R; c.at(x, z);
  const b = o.base ?? c.gy(x, z), h = o.h ?? 3.3;
  const post = P(['#15161c', '#23242c', '#1a1c26']);
  for (let i = 0; i < 24; i++) {
    const a = (i % 3) * 2.1 + R() * 0.5, n = [Math.cos(a), 0, Math.sin(a)];
    c.add([x + n[0] * 0.045, b + (Math.floor(i / 3) + 0.5) / 8 * h, z + n[2] * 0.045], UP, n, h / 8 * 0.62, 0.04, R.pick(post), { order: c.ord(0.2) });
  }
  c.C.lathe(x, b, z, () => 0.04, h, lin('#15161c'), c.ord(0.18), 6, 1);
  lampHead(c, x, z, b + h, o);
  c.lamps.push({ x, y: b + h + 0.1, z, r: o.r ?? 7, c: lin(o.light || '#ffae50'), k: o.k ?? 2.4 });
  c.colliders.push({ x, z, r: 0.35 });
}

function lampHead(c, x, z, y, o = {}) {
  const R = c.R, col = lin(o.col || '#ffc860'), core = lin('#fff2c0');
  for (let i = 0; i < 46; i++) {
    const u = R() * 2 - 1, a = R() * 6.28, s = Math.sqrt(1 - u * u), n = [Math.cos(a) * s, u, Math.sin(a) * s];
    c.add([x + n[0] * 0.2, y + 0.15 + n[1] * 0.26, z + n[2] * 0.2], proj([0, 1, 0.3], n), n, R.range(0.05, 0.1), R.range(0.03, 0.05),
      R() < 0.4 ? core : col, { emit: o.emit ?? 2.2, order: c.ord(0.5) });
  }
}

// a gaslight's column on the water, laid toward the road
function reflection(c, x, z) {
  const R = c.R, cols = P(['#f0b040', '#f8d070', '#e89030']);
  for (let t = 1.2; t < 40; t += R.range(0.45, 0.95)) {
    const k = 1 - t / 40;
    c.add([x + t, -0.33, z + R.range(-0.3, 0.3) * (1 + t * 0.03)], [0, 0, 1], UP, R.range(0.35, 0.9) * (0.45 + k), 0.1, R.pick(cols), { emit: 1.5 * k + 0.3, order: c.ord(0.6) });
  }
}

function easel(c, x, z, yaw, cv) {
  c.at(x, z);
  const b = c.gy(x, z);
  const [rw, rh] = SIZES[cv.slug] || [0.9, 0.73];
  const ch = clamp(rh * 2.6, 1.45, 2.3), s = ch / rh, cw = rw * s, bottom = 0.78;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), nrm = [sy, 0, cy], right = [cy, 0, -sy];
  const wood = P(['#6a4a2a', '#8a5a30', '#5a3a20', '#7a5a3a', '#9a6a3a']);
  const at = (u, y, v) => [x + right[0] * u + nrm[0] * v, b + y, z + right[2] * u + nrm[2] * v];
  const top = bottom + ch + 0.3;
  for (const u of [-1, 1]) c.line(at(u * cw * 0.36, 0, 0.12), at(u * 0.07, top, -0.1), nrm, 0.045, wood, { seg: 0.3 });
  c.line(at(0, 0, -1.05), at(0, top - 0.1, -0.12), right, 0.045, wood, { seg: 0.3 });
  c.line(at(-cw * 0.5 - 0.1, bottom - 0.04, 0.06), at(cw * 0.5 + 0.1, bottom - 0.04, 0.06), nrm, 0.05, wood, { seg: 0.25 });
  c.line(at(-0.2, bottom + ch + 0.06, 0.03), at(0.2, bottom + ch + 0.06, 0.03), nrm, 0.04, wood, { seg: 0.2 });
  const p = at(0, 0, 0.09);
  c.easels.push({ ...cv, x: p[0], y: b + bottom + ch / 2, z: p[2], yaw, w: cw, h: ch, station: c.i });
  c.colliders.push({ x, z, r: Math.max(0.9, cw * 0.42) });
}

function easelsAt(c, list) {
  for (const [k, s, dz, off = 3.4] of list) {
    const cv = c.st.json.canvases?.[k];
    if (!cv) continue;
    const slug = cv.blob.split('/').pop().replace('-canvas.bin', '');
    const z = c.z0 + dz;
    easel(c, c.rx(z) + s * off, z, -s * 0.42, { slug, blob: cv.blob, under: cv.blob.replace('.bin', '-under.png'),
      title: cv.title, date: cv.date, collection: cv.collection, k, key: `${c.i}-${k}` });
  }
}

function haystack(c, x, z, R0 = 2.2, H = 3.2, o = {}) {
  const R = c.R; c.at(x, z);
  const b = c.gy(x, z) - 0.1;
  const cols = P(o.cols || ['#d8a830', '#c08a28', '#e8c050', '#a87020', '#f0d070', '#b89040']);
  const prof = t => R0 * Math.pow(Math.max(1 - t, 0), 0.55);
  c.C.lathe(x, b, z, t => prof(t) * 0.94, H * 0.97, scalec(avgc(cols), 0.8), c.ord(0.02), 12, 8);
  const n = Math.round(R0 * H * 130);
  for (let i = 0; i < n; i++) {
    const t = Math.pow(R(), 0.8), a = R() * Math.PI * 2, r = prof(t);
    const dr = -0.55 * R0 * Math.pow(Math.max(1 - t, 0.02), -0.45);
    const nrm = norm3([Math.cos(a), -dr / H, Math.sin(a)]);
    const tang = norm3([Math.cos(a) * dr, H, Math.sin(a) * dr]);
    const d = proj(add3(mul3(tang, -1), mul3([-Math.sin(a), 0, Math.cos(a)], R.range(-0.5, 0.5))), nrm);
    c.add([x + Math.cos(a) * r, b + t * H, z + Math.sin(a) * r], d, nrm, R.range(0.2, 0.36), R.range(0.06, 0.1), jitter(R.pick(cols), R, 0.1),
      { bend: R.range(-0.3, 0.3), order: c.ord(t) });
  }
  c.colliders.push({ x, z, r: R0 + 0.3 });
}

function cart(c, x, z, yaw) {
  const R = c.R; c.at(x, z);
  const b = c.gy(x, z);
  boxStrokes(c, x, b + 0.75, z, 1.3, 0.35, 0.75, yaw, ['#3a5aa0', '#4a70b8', '#2f4a88', '#5a80c0'], 14);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const wheel = P(['#c0602a', '#d0703a', '#a04a20']);
  for (const s of [-1, 1]) {
    const cx = x + 0.9 * sy * s, cz = z + 0.9 * cy * s, n = [sy * s, 0, cy * s], rt = [cy, 0, -sy];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * 6.28, p = [cx + rt[0] * Math.cos(a) * 0.7, b + 0.72 + Math.sin(a) * 0.7, cz + rt[2] * Math.cos(a) * 0.7];
      c.add(p, norm3([-rt[0] * Math.sin(a), Math.cos(a), -rt[2] * Math.sin(a)]), n, 0.1, 0.05, R.pick(wheel), { order: c.ord(0.4) });
    }
  }
  c.line([x - 1.3 * cy, b + 0.9, z + 1.3 * sy], [x - 3.4 * cy, b + 0.6, z + 3.4 * sy], UP, 0.04, P(['#6a4a2a', '#7a5a3a']));
  c.colliders.push({ x, z, r: 1.6 });
}

function windmill(c, x, z, o = {}) {
  const R = c.R; c.at(x, z);
  const b = c.gy(x, z) - 0.1, H = o.H ?? 8, r0 = 2.2, r1 = 1.4;
  const cols = P(['#8a7a6a', '#a08a70', '#6a5a4a', '#b0a088']);
  const prof = t => lerp(r0, r1, t);
  c.C.lathe(x, b, z, prof, H, scalec(avgc(cols), 0.8), c.ord(0.02), 12, 6);
  for (let i = 0; i < Math.round(H * r0 * 60); i++) {
    const t = R(), a = R() * 6.28, r = prof(t), nrm = norm3([Math.cos(a), (r0 - r1) / H, Math.sin(a)]);
    c.add([x + Math.cos(a) * r, b + t * H, z + Math.sin(a) * r], proj(add3(UP, mul3([-Math.sin(a), 0, Math.cos(a)], R.range(-0.3, 0.3))), nrm), nrm,
      R.range(0.16, 0.28), R.range(0.07, 0.1), jitter(R.pick(cols), R, 0.08), { order: c.ord(t * 0.8) });
  }
  const capC = P(['#5a4030', '#6a4a36', '#4a3428']);
  c.C.lathe(x, b + H, z, t => r1 * 1.15 * (1 - t), 2.0, capC[0], c.ord(0.3), 12, 3);
  for (let i = 0; i < 160; i++) {
    const t = R(), a = R() * 6.28, r = r1 * 1.15 * (1 - t), nrm = norm3([Math.cos(a), 0.6, Math.sin(a)]);
    c.add([x + Math.cos(a) * r, b + H + t * 2, z + Math.sin(a) * r], proj(UP, nrm), nrm, 0.2, 0.08, jitter(R.pick(capC), R, 0.08), { order: c.ord(0.85) });
  }
  const S = new StrokeBuilder(), sail = P(['#d8d0b8', '#c8c0a8', '#e8e0c8', '#b8b098']), spar = P(['#4a3a2a', '#5a4632']);
  for (let k = 0; k < 4; k++) {
    const ang = k * Math.PI / 2, dir = [Math.cos(ang), Math.sin(ang), 0], side = [-dir[1], dir[0], 0];
    for (let j = 0; j < 10; j++) S.add(mul3(dir, (j + 0.5) * 0.66), dir, [0, 0, 1], 0.36, 0.05, R.pick(spar), { order: c.ord(0.9) });
    for (let j = 0; j < 80; j++) {
      const t = R.range(1.2, 6.5), sv = R.range(0.1, 1.3);
      S.add(add3(mul3(dir, t), mul3(side, sv)), R() < 0.5 ? dir : side, [0, 0, 1], R.range(0.12, 0.22), 0.045, jitter(R.pick(sail), R, 0.06), { order: c.ord(0.95) });
    }
  }
  const face = o.face ?? 0, fn = [Math.sin(face), 0, Math.cos(face)];
  c.movers.push({ S, pos: [x + fn[0] * (r1 + 0.5), b + H + 0.7, z + fn[2] * (r1 + 0.5)], yaw: face, spin: 0.35 });
  c.colliders.push({ x, z, r: r0 + 0.3 });
}

function sunflower(c, x, z, o = {}) {
  const R = c.R; c.at(x, z);
  const b = c.gy(x, z), H = o.H ?? R.range(1.3, 2.1);
  const stem = P(['#4a6a2a', '#5a7a30', '#3a5a26']);
  const bend = [R.range(-0.2, 0.2), 0, R.range(-0.2, 0.2)];
  c.line([x, b, z], [x + bend[0], b + H, z + bend[2]], norm3([R() - 0.5, 0, R() - 0.5]), 0.035, stem, { seg: 0.3, sway: 0.6, base: b });
  for (let i = 0; i < 4; i++) {
    const t = R.range(0.25, 0.8), a = R() * 6.28, dir = norm3([Math.cos(a), 0.4, Math.sin(a)]);
    c.add([x + bend[0] * t + dir[0] * 0.18, b + H * t, z + bend[2] * t + dir[2] * 0.18], dir, norm3([0, 1, 0.2]), 0.18, 0.09, jitter(R.pick(stem), R, 0.1),
      { sway: 0.6, base: b, order: c.ord(t) });
  }
  const face = norm3([R.range(-0.5, 0.5), 0.3, 1]), hc = [x + bend[0], b + H, z + bend[2]], rh = R.range(0.16, 0.26);
  const fr = norm3(cross3(face, UP)), fu = norm3(cross3(fr, face));
  const petals = P(['#f2c020', '#e8a818', '#f8d840', '#f0b020']);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * 6.28 + R() * 0.2, dir = add3(mul3(fr, Math.cos(a)), mul3(fu, Math.sin(a)));
    c.add(add3(hc, mul3(dir, rh * 0.95)), dir, face, rh * 0.45, rh * 0.18, jitter(R.pick(petals), R, 0.08), { emit: 0.12, sway: 0.6, base: b, order: c.ord(0.95) });
  }
  const ctr = P(['#6a3a10', '#8a4a1a', '#4a2a10', '#a0601a']);
  for (let i = 0; i < 16; i++) {
    const a = R() * 6.28, r = Math.sqrt(R()) * rh * 0.55;
    c.add(add3(add3(hc, mul3(fr, Math.cos(a) * r)), add3(mul3(fu, Math.sin(a) * r), mul3(face, 0.02))), add3(mul3(fr, -Math.sin(a)), mul3(fu, Math.cos(a))), face,
      rh * 0.18, rh * 0.12, R.pick(ctr), { sway: 0.6, base: b, order: c.ord(0.97) });
  }
}

function iris(c, x, z) {
  const R = c.R; c.at(x, z);
  const b = c.gy(x, z);
  const leaf = P(['#3a6a3a', '#4a8a4a', '#2a5a4a', '#5a9a50']);
  for (let i = 0; i < 9; i++) {
    const a = R() * 6.28, lean = R.range(0.1, 0.5), dir = norm3([Math.cos(a) * lean, 1, Math.sin(a) * lean]), L = R.range(0.25, 0.4);
    c.add(add3([x, b, z], mul3(dir, L)), dir, norm3([Math.cos(a + 1.57), 0, Math.sin(a + 1.57)]), L, 0.035, jitter(R.pick(leaf), R, 0.1),
      { bend: R.range(-0.2, 0.2), sway: 0.8, base: b, order: c.ord(0.3) });
  }
  const fl = P(['#3a4fb0', '#5a5ad0', '#2a3a90', '#6a70d8']);
  for (let k = 0; k < 3; k++) {
    const fc = [x + R.range(-0.2, 0.2), b + R.range(0.55, 0.8), z + R.range(-0.2, 0.2)];
    for (let i = 0; i < 7; i++) {
      const a = R() * 6.28, dir = norm3([Math.cos(a), R.range(-0.4, 0.6), Math.sin(a)]);
      const pn = norm3([-Math.sin(a), 0.35, Math.cos(a)]);
      c.add(add3(fc, mul3(dir, 0.07)), proj(dir, pn), pn, 0.07, 0.04, R() < 0.12 ? lin('#e8e8f0') : jitter(R.pick(fl), R, 0.1),
        { sway: 0.8, base: b, order: c.ord(0.8) });
    }
  }
}

function bush(c, x, z, cols, r = 0.5) {
  const R = c.R; c.at(x, z);
  const b = c.gy(x, z), cs = P(cols), leaf = P(['#3a6a3a', '#4a7a3a']);
  for (let i = 0; i < 34; i++) {
    const u = R(), a = R() * 6.28, s = Math.sqrt(1 - u * u), n = [Math.cos(a) * s, u, Math.sin(a) * s];
    c.add([x + n[0] * r, b + n[1] * r * 0.8, z + n[2] * r], proj([-n[2], 0.3, n[0]], n), n, R.range(0.06, 0.12), R.range(0.04, 0.07),
      R() < 0.35 ? R.pick(leaf) : jitter(R.pick(cs), R, 0.08), { sway: 0.4, base: b, order: c.ord(0.5 + u * 0.4) });
  }
}

function cafe(c, x, z, yaw) {
  const R = c.R;
  house(c, { x, z, yaw, w: 11, d: 7, h: 8.5, roofH: 1.2, wall: ['#2a3a5a', '#34466a', '#22304a', '#3a4a70'], roof: ['#1a2030', '#222a3a'], density: 11,
    windows: [...[-3.6, -1.2, 1.2, 3.6].map(u => ({ face: 0, u, v: 5.2, w: 0.9, h: 1.3, col: R() < 0.5 ? '#e8a040' : '#1a2438', k: 1.2, frame: '#141c2c' })),
              ...[-3.6, -1.2, 1.2, 3.6].map(u => ({ face: 0, u, v: 7.3, w: 0.9, h: 1.0, col: R() < 0.3 ? '#e8a040' : '#1a2438', k: 1.2, frame: '#141c2c' })),
              { face: 0, u: 0, v: 1.5, w: 9.6, h: 2.6, col: '#f0b040', k: 1.0, frame: '#6a4a20' }] });
  const cy = Math.cos(yaw), sy = Math.sin(yaw), b = c.gy(x, z);
  const W = (lx, ly, lz) => [x + lx * cy + lz * sy, b + ly, z - lx * sy + lz * cy];
  const Wd = (dx, dy, dz) => [dx * cy + dz * sy, dy, -dx * sy + dz * cy];
  c.at(x, z);
  // the awning: pitched steeply enough to be seen from the road as an awning,
  // not edge-on as a line, with a valance hanging from its outer edge
  const aw = P(['#f0b030', '#e89a20', '#f8c848', '#e0a028']);
  const n = norm3(Wd(0, 3.4, 1.5));
  for (let i = 0; i < 900; i++) {
    const lu = (R() - 0.5) * 8.6, f = R();
    const p = W(lu, 3.9 - f * 1.5, 3.5 + f * 3.4);
    c.add(p, norm3(Wd(R.range(-0.3, 0.3), -0.44, 1)), n, R.range(0.14, 0.24), R.range(0.06, 0.1), jitter(R.pick(aw), R, 0.08), { emit: 0.5, order: c.ord(0.6 + f * 0.2) });
  }
  for (let i = 0; i < 260; i++) {
    const lu = (R() - 0.5) * 8.6, v = R() * 0.55;
    c.add(W(lu, 2.4 - v, 6.92), norm3(Wd(R.range(-0.2, 0.2), 1, 0)), Wd(0, 0, 1), R.range(0.08, 0.14), R.range(0.05, 0.08), jitter(R.pick(aw), R, 0.08), { emit: 0.45, order: c.ord(0.8) });
  }
  c.C.quad(W(-4.3, 3.9, 3.5), W(4.3, 3.9, 3.5), W(4.3, 2.4, 6.9), W(-4.3, 2.4, 6.9), scalec(aw[0], 0.7), c.ord(0.55));
  c.C.quad(W(-4.3, 2.4, 6.88), W(4.3, 2.4, 6.88), W(4.3, 1.85, 6.88), W(-4.3, 1.85, 6.88), scalec(aw[1], 0.7), c.ord(0.55));
  const tables = P(['#d8c890', '#e8d8a0', '#c8b880']);
  for (let k = 0; k < 7; k++) {
    const lu = -4 + (k % 4) * 2.6 + R.range(-0.3, 0.3), lz = 4.6 + Math.floor(k / 4) * 1.7;
    const cp = W(lu, 0.78, lz);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.28; c.add([cp[0] + Math.cos(a) * 0.32, cp[1], cp[2] + Math.sin(a) * 0.32], [-Math.sin(a), 0, Math.cos(a)], UP, 0.08, 0.05, R.pick(tables), { emit: 0.3, order: c.ord(0.8) }); }
    c.line(W(lu, 0, lz), W(lu, 0.76, lz), Wd(1, 0, 0), 0.03, P(['#2a2220']));
  }
  const lp = W(-5.2, 0, 4.2);
  lamp(c, lp[0], lp[2], { h: 3.1, k: 3.2, r: 10, light: '#ffb040' });
}

// ------------------------------------------------------------------ crows --
class Crows {
  constructor(U) {
    const R = rng(777);
    this.birds = [];
    const plan = { 2: 2, 3: 2, 4: 1, 5: 2, 6: 2, 7: 2, 8: 16, 9: 9 };   // birds by place on the road, from 0
    for (const [si, n] of Object.entries(plan)) {
      const z0 = J.stationZ(+si), x0 = J.roadX(z0);
      for (let k = 0; k < n; k++)
        this.birds.push({ cx: x0 + R.range(-26, 26), cy: R.range(9, 22), cz: z0 - R.range(-6, 42), R: R.range(6, 18),
                          w: R.range(0.12, 0.3) * R.sign(), ph: R() * 6.28, fl: R.range(6, 9), s: R.range(1.0, 1.5) });
    }
    const S = new StrokeBuilder(), ink = lin('#0b0c12');
    for (let i = 0; i < this.birds.length * 3; i++) S.add([0, -99, 0], [1, 0, 0], [0, 1, 0], 0.3, 0.07, ink, { order: 0 });
    this.mesh = S.build(U, { uProgress: { value: 1 } });
    const at = this.mesh.geometry.attributes;
    this.A = at;
  }
  update(t) {
    const P2 = this.A.iPos.array, D = this.A.iDir.array, N = this.A.iNrm.array, S = this.A.iShape.array;
    this.birds.forEach((b, i) => {
      const a = b.ph + b.w * t;
      const p = [b.cx + b.R * Math.cos(a), b.cy + 1.4 * Math.sin(a * 0.7 + b.ph), b.cz + b.R * 0.6 * Math.sin(a)];
      const hd = norm3([-b.R * Math.sin(a) * b.w, 0.98 * Math.cos(a * 0.7 + b.ph) * b.w, b.R * 0.6 * Math.cos(a) * b.w]);
      const right = norm3(cross3(hd, UP)), flap = Math.sin(t * b.fl + b.ph * 3) * 0.55;
      const wl = norm3(add3(mul3(right, -Math.cos(flap)), mul3(UP, Math.sin(flap))));
      const wr = norm3(add3(mul3(right, Math.cos(flap)), mul3(UP, Math.sin(flap))));
      const set = (j, cp, d, n, len, wid) => { const o = i * 3 + j; P2.set(cp, o * 3); D.set(d, o * 3); N.set(n, o * 3); S[o * 4] = len; S[o * 4 + 1] = wid; };
      set(0, add3(p, mul3(wl, 0.36 * b.s)), wl, norm3(cross3(wl, hd)), 0.36 * b.s, 0.08 * b.s);
      set(1, add3(p, mul3(wr, 0.36 * b.s)), wr, norm3(cross3(hd, wr)), 0.36 * b.s, 0.08 * b.s);
      set(2, p, hd, UP, 0.2 * b.s, 0.075 * b.s);
    });
    this.A.iPos.needsUpdate = this.A.iDir.needsUpdate = this.A.iNrm.needsUpdate = this.A.iShape.needsUpdate = true;
  }
}

// -------------------------------------------------------------- stations --
const BUILDERS = [
  c => {                                             // 1 Nuenen, 1885: the poplar avenue at sunset
    const R = c.R, z0 = c.z0;
    for (let z = 26; z > z0 - 62; z -= 7.5)
      for (const s of [-1, 1]) {
        if (s < 0 && z < z0 + 9 && z > z0 - 17) continue;
        poplar(c, c.rx(z) + s * R.range(5.4, 6.4), z + R.range(-1.2, 1.2), { H: R.range(12, 16.5), R0: R.range(0.95, 1.3) });
      }
    const hz = z0 - 5, hx = c.rx(hz) - 12;
    house(c, { x: hx, z: hz, yaw: Math.PI / 2, w: 9, d: 5.5, h: 2.5, roofH: 3.4, thatch: true,
      wall: ['#5a4a3a', '#6a5a44', '#4a3e30', '#7a6a50'], roof: ['#4a3a22', '#5a4a2a', '#6a5a30', '#3a2e1c', '#7a6636'],
      windows: [{ face: 0, u: -2.2, v: 1.25, w: 0.9, h: 0.8, col: '#f2b040', k: 1.7, frame: '#2a2018' },
                { face: 0, u: 1.3, v: 0.95, w: 1.0, h: 1.9, col: '#e89a30', k: 1.4, frame: '#2a2018' }] });
    c.lamps.push({ x: hx + 3.6, y: 1.3, z: hz - 1.3, r: 6.5, c: lin('#ffa040'), k: 1.8 });
    easelsAt(c, [[0, -1, 6, 3.6]]);
    tower(c, c.rx(z0 - 80) + 58, z0 - 80);
    const peat = { cols: ['#6a5020', '#8a6a2a', '#5a4418', '#a0803a'] };
    haystack(c, c.rx(z0 - 22) + 16, z0 - 22, 1.5, 2.0, peat);
    haystack(c, c.rx(z0 - 31) + 22, z0 - 31, 1.3, 1.8, peat);
  },
  c => {                                             // 2 Paris, 1886-87: the corridor, the windmills of Montmartre
    const R = c.R, z0 = c.z0;
    easelsAt(c, [[0, -1, 16, 3.2], [1, 1, 9, 3.2], [2, -1, 2, 3.2], [3, 1, -5, 3.2], [4, -1, -12, 3.2], [5, 1, -19, 3.2]]);
    windmill(c, c.rx(z0 - 34) + 24, z0 - 34, { H: 8, face: -Math.PI / 2 + 0.5 });
    windmill(c, c.rx(z0 - 70) - 30, z0 - 70, { H: 7, face: Math.PI / 2 - 0.5 });
    for (let i = 0; i < 12; i++) {
      const z = z0 + R.range(-45, 35), s = R.sign();
      tree(c, c.rx(z) + s * R.range(9, 26), z, { H: R.range(4.5, 7), crown: R.range(1.7, 2.6), leaves: ['#4a7a3a', '#6a9a44', '#8ab050', '#3a6a3a'], top: '#c8d890' });
    }
    for (let i = 0; i < 16; i++) sunflower(c, c.rx(z0 - 26) + 6 + R.range(-2, 2), z0 - 26 + R.range(-3, 3));
    for (let z = z0 + 30; z > z0 - 40; z -= 13) lamp(c, c.rx(z) + 2.6, z, { h: 3.4, col: '#e8d8a0', emit: 0.35, k: 0.6 });
  },
  c => {                                             // 3 Arles, spring 1888: orchards in blossom
    const R = c.R, z0 = c.z0;
    const bark = ['#4a3a30', '#3a2e2a', '#5a4638'];
    const white = { leaves: ['#f4f0e0', '#e8ecd8', '#fff8f0', '#dfe8c8', '#c8d8b0'], top: '#ffffff', blossom: true, bark };
    const pink = { leaves: ['#f4c8d0', '#f0b0c0', '#fad8e0', '#e8a0b0', '#dfe8c8'], top: '#ffe8f0', blossom: true, bark };
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 9; i++)
        for (const s of [-1, 1]) {
          const z = z0 + 34 - i * 7.5 + R.range(-1, 1) + (row % 2) * 3.7;
          if (row === 0 && Math.abs(z - z0) < 16) continue;
          tree(c, c.rx(z) + s * (7 + row * 6.5 + R.range(-0.8, 0.8)), z,
            { H: R.range(3.4, 4.6), crown: R.range(1.4, 1.9), trunkH: R.range(1.1, 1.5), trunkR: 0.14, lobes: 4, ...(s < 0 ? white : pink) });
        }
    for (let z = z0 + 40; z > z0 - 50; z -= 3.6) cypress(c, c.rx(z) + 36 + R.range(-0.5, 0.5), z, R.range(7, 9.5), R.range(0.9, 1.2));
    house(c, { x: c.rx(z0 - 28) - 34, z: z0 - 28, yaw: Math.PI / 2, w: 8, d: 6, h: 4, roofH: 1.6, wall: ['#e8dcc0', '#f0e8d0', '#d8ccb0'],
      roof: ['#c8703a', '#d8804a', '#b86030'], windows: [{ face: 0, u: -2, v: 2, w: 0.8, h: 1.1, col: '#3a5a6a' }, { face: 0, u: 2, v: 2, w: 0.8, h: 1.1, col: '#3a5a6a' },
      { face: 0, u: 0, v: 1.1, w: 1.0, h: 2.0, col: '#4a6a4a' }] });
    easelsAt(c, [[0, -1, 10, 3.4], [1, 1, 3, 3.4], [2, -1, -4, 3.4], [3, 1, -11, 3.4]]);
  },
  c => {                                             // 4 La Crau, June 1888: the harvest
    const R = c.R, z0 = c.z0;
    for (const [dx, dz] of [[14, 10], [-18, -6], [26, -22], [-30, -30], [40, 8], [-12, -48], [18, -60]])
      haystack(c, c.rx(z0 + dz) + dx, z0 + dz, R.range(1.8, 2.6), R.range(2.6, 3.6));
    cart(c, c.rx(z0 - 14) + 6.5, z0 - 14, 0.3);
    const farm = { wall: ['#e8d8b0', '#f0e0c0', '#d8c8a0'], roof: ['#c8603a', '#b8502a', '#d8704a'] };
    house(c, { x: c.rx(z0 - 60) + 55, z: z0 - 60, yaw: -Math.PI / 2, w: 10, d: 6, h: 4.5, roofH: 2, ...farm });
    house(c, { x: c.rx(z0 - 85) - 48, z: z0 - 85, yaw: Math.PI / 2, w: 8, d: 6, h: 4, roofH: 1.8, ...farm });
    easelsAt(c, [[0, 1, 8, 3.4], [1, -1, 0, 3.4], [2, 1, -8, 3.4]]);
  },
  c => {                                             // 5 Arles, autumn 1888: the Yellow House
    const R = c.R, z0 = c.z0, yx = c.rx(z0 - 4) + 12;
    const green = '#3f7a4a', frame = '#2f5a3a';
    house(c, { x: yx, z: z0 - 4, yaw: -Math.PI / 2, w: 10, d: 7, h: 7.2, roofH: 1.5, trim: green, density: 16,
      wall: ['#e8b830', '#f0c848', '#d8a828', '#f4d060', '#e0b038'], roof: ['#c86a3a', '#d8804a', '#b05a30'],
      windows: [...[-3, -1, 1, 3].map(u => ({ face: 0, u, v: 5.3, w: 0.9, h: 1.3, col: green, frame })),
                ...[-3, 1, 3].map(u => ({ face: 0, u, v: 2.0, w: 0.9, h: 1.4, col: green, frame })),
                { face: 0, u: -1, v: 1.2, w: 1.1, h: 2.3, col: '#4a8a50', frame }] });
    house(c, { x: yx, z: z0 + 7.5, yaw: -Math.PI / 2, w: 7, d: 7, h: 5.2, roofH: 1.4, wall: ['#d88a7a', '#e0a090', '#c87a6a'], roof: ['#b05a3a', '#c06a40'],
      windows: [{ face: 0, u: 0, v: 1.4, w: 3.8, h: 2.2, col: '#f0d8a0', k: 0.2, frame: '#6a3a2a' }] });
    for (let z = z0 + 34; z > z0 - 44; z -= 9)
      tree(c, c.rx(z) - 6.5, z, { H: R.range(8, 10), crown: R.range(2.8, 3.4), trunkR: 0.28, leaves: ['#2f6a2a', '#3f7a30', '#5a8a3a', '#2a5a3a'], top: '#8ab040' });
    for (let i = 0; i < 22; i++) sunflower(c, c.rx(z0 + 1) - R.range(4.8, 9), z0 + R.range(-6, 8));
    const bz = z0 - 44, bx = c.rx(bz);
    for (let k = -5; k <= 5; k++) if (k) boxStrokes(c, bx + k * 9, c.gy(bx + k * 9, bz) - 0.2, bz, 0.7, 3.8, 1.2, 0, ['#7a7090', '#8a80a0', '#6a6080', '#9a90a8'], 8);
    boxStrokes(c, bx, 7.6, bz, 50, 0.3, 1.1, 0, ['#7a7090', '#8a80a0', '#6a6080'], 6);
    easelsAt(c, [[0, -1, 12, 3.4], [1, 1, 3, 3.4], [2, 1, -3, 3.4], [3, 1, -9, 3.4]]);
  },
  c => {                                             // 6 Arles, September 1888: the café terrace, the Rhône
    const R = c.R, z0 = c.z0;
    cafe(c, c.rx(z0 - 6) + 12, z0 - 6, -Math.PI / 2);
    house(c, { x: c.rx(z0 + 12) + 11, z: z0 + 12, yaw: -Math.PI / 2, w: 8, d: 7, h: 5.5, roofH: 1.4, wall: ['#2a2a3a', '#343448', '#22222e'], roof: ['#1a1a24', '#24242e'], density: 10,
      windows: [{ face: 0, u: 0, v: 1.4, w: 2.4, h: 2.6, col: '#d04a20', k: 1.4, frame: '#1a1210' }, { face: 0, u: -2.8, v: 1.8, w: 1.2, h: 1.4, col: '#e8a030', k: 1.3, frame: '#1a1210' },
                { face: 0, u: 2.8, v: 1.8, w: 1.2, h: 1.4, col: '#3a8a4a', k: 0.7, frame: '#1a1210' }] });
    c.lamps.push({ x: c.rx(z0 + 12) + 6.8, y: 1.6, z: z0 + 12, r: 7, c: lin('#ff7040'), k: 1.6 });
    for (let z = z0 + 36; z > z0 - 50; z -= 11) lamp(c, c.rx(z) - 12.2, z, { h: 3.6, k: 2.4, r: 8 });
    for (let z = z0 + 60; z > z0 - 90; z -= R.range(5, 9)) {
      const x = c.rx(z) - R.range(62, 72);
      c.at(x, z);
      lampHead(c, x, z, -0.35 + R.range(2.5, 4.5));
      reflection(c, x, z);
    }
    village(c, c.rx(z0) - 82, z0 - 12, 20, 26);
    easelsAt(c, [[0, 1, 10, 3.6], [1, 1, -2, 3.6], [2, -1, -9, 3.4]]);
  },
  c => {                                             // 8 Saint-Rémy, 1889: the cypress under the Starry Night
    const R = c.R, z0 = c.z0;
    const night = { cols: ['#1f3a3a', '#2a4a3a', '#35604a', '#2a4050', '#4a6a4a', '#1a3040', '#3a5a3a', '#26485a'], hi: ['#6a8a6a', '#8a9a7a', '#5a7a8a', '#a0a070'] };
    cypress(c, c.rx(z0 - 7) - 8.5, z0 - 7, 17, 2.3, night);
    cypress(c, c.rx(z0 - 16) - 13, z0 - 16, 12, 1.6, night);
    cypress(c, c.rx(z0 + 14) + 12, z0 + 14, 10, 1.4, night);
    cypress(c, c.rx(z0 - 38) + 15, z0 - 38, 13, 1.7, night);
    for (let i = 0; i < 16; i++) { const z = z0 + R.range(-32, 24); olive(c, c.rx(z) + R.range(8, 34), z, { H: R.range(3.6, 4.8), crown: R.range(1.9, 2.5), leaves: ['#7a9a90', '#9ab0a8', '#5a7a78', '#b8c8b0', '#6a8aa0', '#4f6f70'], top: '#d0dcc0', bark: ['#6a5a60', '#8a7068', '#5a5a70'] }); }
    village(c, c.rx(z0 - 70) + 78, z0 - 70, 22, 34);
    spire(c, c.rx(z0 - 76) + 72, z0 - 76);
    for (let i = 0; i < 36; i++) { const z = z0 + R.range(-4, 12); iris(c, c.rx(z) - R.range(2.5, 8), z); }
    easelsAt(c, [[0, -1, 8, 3.4], [1, 1, 2, 3.6], [2, 1, -6, 3.6]]);
  },
  c => {                                             // 9 Auvers, 1890: thatch, the garden, the church
    const R = c.R, z0 = c.z0;
    church(c, c.rx(z0 - 26) + 15, z0 - 26, -Math.PI / 2 + 0.35);
    const cot = { thatch: true, wall: ['#e8e0c8', '#f0ead8', '#d8d0b8', '#c8c0a8'], roof: ['#6a7a4a', '#8a8a5a', '#5a6a3a', '#7a8a50', '#9a9a60'], roofH: 3.2 };
    house(c, { x: c.rx(z0 + 10) - 13, z: z0 + 10, yaw: Math.PI / 2 - 0.2, w: 9, d: 5, h: 2.6, ...cot,
      windows: [{ face: 0, u: -2, v: 1.3, w: 0.8, h: 0.9, col: '#2a3a4a' }, { face: 0, u: 1.5, v: 1.0, w: 0.9, h: 1.9, col: '#3a5a6a' }] });
    house(c, { x: c.rx(z0 - 4) - 19, z: z0 - 4, yaw: Math.PI / 2 + 0.3, w: 8, d: 5, h: 2.5, ...cot });
    house(c, { x: c.rx(z0 - 20) - 14, z: z0 - 20, yaw: Math.PI / 2, w: 10, d: 5.5, h: 2.7, ...cot });
    house(c, { x: c.rx(z0 + 4) + 19, z: z0 + 4, yaw: -Math.PI / 2, w: 11, d: 7, h: 6, roofH: 2.2, wall: ['#e8c8c0', '#f0d8d0', '#d8b8b0'], roof: ['#5a6a8a', '#4a5a7a'],
      windows: [-3, 0, 3].map(u => ({ face: 0, u, v: 3.8, w: 0.9, h: 1.3, col: '#3a4a6a', frame: '#f0f0e8' })) });
    const beds = [['#d8402a', '#e86040'], ['#f0e0d0', '#ffffff'], ['#d860a0', '#e890c0'], ['#e8c040', '#f0d060']];
    for (let i = 0; i < 40; i++) bush(c, c.rx(z0 + 6) + R.range(6, 13), z0 + R.range(-2, 14), R.pick(beds));
    for (let i = 0; i < 10; i++) {
      const z = z0 + R.range(-45, 35), s = R.sign();
      tree(c, c.rx(z) + s * R.range(22, 40), z, { H: R.range(6, 9), crown: R.range(2.4, 3.2), leaves: ['#2f5a3a', '#3f6a3a', '#5a8a4a', '#2a4a3a'], top: '#8ab060' });
    }
    easelsAt(c, [[0, 1, 4, 3.4], [1, -1, -1, 3.4], [2, 1, -6, 3.4], [3, -1, -11, 3.4], [4, 1, -16, 3.4]]);
  },
  c => {                                             // 10 Auvers, July 1890: the wheatfield
    easelsAt(c, [[0, 1, 4, 3.6]]);
  },
  () => {},                                          // 11 after
];

export class World {
  constructor(U, stations) {
    this.U = U;
    this.group = new THREE.Group();
    this.easels = []; this.lamps = []; this.colliders = []; this.st = [];
    stations.forEach((st, i) => {
      const c = new Ctx(i, st);
      (BUILDERS[i] || (() => {}))(c);
      const g = new THREE.Group();
      const u = { uProgress: { value: 0 } };
      if (c.S.n) g.add(c.S.build(U, u));
      if (c.C.p.length) g.add(c.C.build(U, u));
      for (const m of c.movers) {
        const pivot = new THREE.Group(), spinner = new THREE.Group();
        pivot.position.set(...m.pos); pivot.rotation.y = m.yaw;
        spinner.add(m.S.build(U, u)); pivot.add(spinner); g.add(pivot);
        m.spinner = spinner;
      }
      g.visible = false;
      this.group.add(g);
      this.easels.push(...c.easels); this.lamps.push(...c.lamps); this.colliders.push(...c.colliders);
      this.st.push({ g, u, z0: c.z0, progress: 0, started: false, movers: c.movers, strokes: c.S.n });
    });
    this.crows = new Crows(U);
    this.group.add(this.crows.mesh);
    this._near = [];
  }
  update(cam, time, dt, intro = 1) {
    for (const s of this.st) {
      const dz = Math.abs(cam.z - s.z0);
      s.g.visible = dz < 235;
      if (dz < 125) s.started = true;
      // during the opening, nothing stands up before the ground under it is painted
      if (s.started && s.progress < 1.05) s.progress = Math.min(1.05, s.progress + dt / 5.5, intro < 1 ? Math.max(0, intro * 1.25 - 0.18) : 9);
      s.u.uProgress.value = s.progress;
      if (s.g.visible) for (const m of s.movers) m.spinner.rotation.z = time * m.spin;
    }
    this.crows.update(time);
  }
  lampsNear(cam) {
    for (const L of this.lamps) L.d = (L.x - cam.x) ** 2 + (L.z - cam.z) ** 2;
    return this.lamps.filter(L => L.d < 3600).sort((a, b) => a.d - b.d).slice(0, 4);
  }
}
