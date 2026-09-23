// The world is the painting. Every thing in it is built out of his strokes' own colours, region by region of The
// Starry Night -- the sky's blues and its pale swirl bands, the stars' yellows, the moon's, the hills', the village's,
// the cypress's near-black greens -- and the Sunflowers' heads whole. What is ours is the shape: a sky that is a
// turning dome of his sky, a rolling ground, a village of houses with lit windows, a cypress that is a flame, a
// river with the stars in it, and sunflowers loose in the air.
import { rng, clamp, lerp, smoothstep, fbm2, noise3, DEG, dirAzEl, norm3, cross3, dot3, lin } from './util.js';
import { loadRecord } from './records.js';

// ---------------------------------------------------------------- rows of strokes
export class Rows {
  constructor(cap) {
    this.cap = cap; this.n = 0;
    this.P = [new Float32Array(cap * 3), new Float32Array(cap * 3), new Float32Array(cap * 3)];
    this.size = new Float32Array(cap * 4); this.col = new Float32Array(cap * 4); this.meta = new Float32Array(cap * 4);
    this.spin = new Float32Array(cap * 4);
  }
  // a stroke: at c, along t, bowed toward n, L long and w wide, with its paint, its shine and its turn in the reveal
  put(c, t, n, bow, L, w, imp, curl, rgb, shine, rev, phase, axis, rate) {
    if (this.n >= this.cap) return -1;
    const i = this.n++;
    const a = [-0.5 * L, 0, 0.5 * L], b = [0, bow * L, 0];
    for (let k2 = 0; k2 < 3; k2++) for (let k = 0; k < 3; k++) this.P[k2][i * 3 + k] = c[k] + a[k2] * t[k] + b[k2] * n[k];
    this.size[i * 4] = w; this.size[i * 4 + 1] = imp; this.size[i * 4 + 2] = (i * 7) % 8; this.size[i * 4 + 3] = curl;
    this.col[i * 4] = rgb[0]; this.col[i * 4 + 1] = rgb[1]; this.col[i * 4 + 2] = rgb[2]; this.col[i * 4 + 3] = shine;
    this.meta[i * 4] = rev; this.meta[i * 4 + 1] = 1; this.meta[i * 4 + 2] = phase; this.meta[i * 4 + 3] = 100;
    if (axis) { this.spin[i * 4] = axis[0]; this.spin[i * 4 + 1] = axis[1]; this.spin[i * 4 + 2] = axis[2]; this.spin[i * 4 + 3] = rate; }
    return i;
  }
  done() {
    const n = this.n;
    return { n, P: this.P.map(p => p.subarray(0, n * 3)), size: this.size.subarray(0, n * 4),
             col: this.col.subarray(0, n * 4), meta: this.meta.subarray(0, n * 4), spin: this.spin.subarray(0, n * 4) };
  }
}

// ---------------------------------------------------------------- his colours, by region
const REGIONS = ['skyRange', 'sky', 'swirl', 'star', 'moon', 'hills', 'village', 'cypress', 'cypressCore'];
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

export async function loadHisColours() {
  const rec = await loadRecord('strokes/starry-canvas.bin');
  const region = new Uint8Array(await (await fetch('hand/starry-region.bin')).arrayBuffer());
  const pools = {};
  for (let i = 0; i < rec.n; i++) {
    const r = REGIONS[region[i]] || 'sky';
    (pools[r] ||= []).push([rec.rgb[i * 3], rec.rgb[i * 3 + 1], rec.rgb[i * 3 + 2]]);
  }
  pools.sky = pools.sky.concat(pools.swirl);
  for (const k in pools) pools[k].sort((a, b) => lum(a) - lum(b));
  // his lit windows: the warm bright strokes of the village
  pools.lamp = pools.village.filter(c => lum(c) > 0.12 && c[0] > c[2] * 1.5);
  if (pools.lamp.length < 20) pools.lamp = pools.moon.slice(Math.floor(pools.moon.length * 0.4));
  // his stars (E1.1): the star region's record is mostly halo -- pale greens and whites -- and only one stroke in
  // thirteen is his chrome yellow; the moon's is nearly all yellow, with his oranges. So the yellows of both
  // regions are one pool for the cores and the inner halo, the oranges another for the heart of the biggest,
  // and the star region's pale strokes a third for the outer halo
  const yel = c => Math.min(c[0], c[1]) - c[2];
  const both = pools.star.concat(pools.moon);
  pools.starYellow = both.filter(c => yel(c) > 0.12 && lum(c) > 0.16).sort((a, b) => lum(a) - lum(b));
  pools.starOrange = both.filter(c => c[0] > c[1] * 1.15 && c[0] > c[2] * 2 && lum(c) > 0.1).sort((a, b) => lum(a) - lum(b));
  pools.starPale = pools.star.filter(c => yel(c) <= 0.12 && lum(c) > 0.3);
  if (pools.starOrange.length < 10) pools.starOrange = pools.starYellow;
  return { rec, pools };
}
// a colour out of a pool at a quantile of its brightness, with a little scatter along the pool
export function pick(pool, q, r, spread = 0.04) {
  const i = clamp(Math.floor((q + (r() - 0.5) * 2 * spread) * pool.length), 0, pool.length - 1);
  return pool[i];
}
const jit = (c, r, k = 0.08) => { const m = 1 + (r() - 0.5) * 2 * k; return [c[0] * m, c[1] * m, c[2] * m]; };
const perp = (t, seedv) => { let n = cross3(t, seedv); const l = Math.hypot(n[0], n[1], n[2]); return l < 1e-4 ? cross3(t, [1, 0, 0]) : [n[0] / l, n[1] / l, n[2] / l]; };

// ---------------------------------------------------------------- the ground
// the river, a path across the valley at the foot of the northern hills
export const RIVER = [[-1400, -500], [-900, -440], [-500, -390], [-250, -350], [-60, -330], [120, -350], [330, -380], [600, -340], [900, -300], [1400, -260]];
export const RIVER_W = 46, RIVER_Y = -1.6;
export function riverAt(x, z) {                        // distance to the river's middle line, and where along it
  let best = 1e9, at = 0, dir = [1, 0];
  for (let i = 0; i + 1 < RIVER.length; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; at = i + t; const l = Math.sqrt(L2); dir = [dx / l, dz / l]; }
  }
  return { d: best, at, dir };
}
// the height of the ground: a valley with the village in it, hills to the north and both sides, the knoll the eye
// stands on to the south, and a bed for the river
export function ground(x, z) {
  const dn = smoothstep(-330, -1000, z);
  let h = 150 * dn * (0.75 + 0.25 * Math.sin(x * 0.0035 + 1.2));
  h += 110 * smoothstep(420, 1100, Math.abs(x)) * (0.8 + 0.2 * Math.sin(z * 0.005));
  const dk = Math.hypot(x, z - 230);
  h += 46 * smoothstep(250, 60, dk);
  const roll = 0.35 + dn + smoothstep(60, 360, z) + smoothstep(420, 1100, Math.abs(x));
  h += 9 * (fbm2(x * 0.011 + 3.1, z * 0.011 + 7.7, 3) - 0.5) * 2 * roll;
  h += 1.2 * (fbm2(x * 0.06, z * 0.06, 2) - 0.5) * 2;
  const rv = riverAt(x, z);
  h = lerp(Math.min(h, 0.3), h, smoothstep(50, 160, rv.d));                      // the ground is flat along the river
  h -= 4.5 * (1 - smoothstep(RIVER_W * 0.45, RIVER_W * 0.75, rv.d));              // and dips into the bed under it
  return h;
}
const grad = (x, z) => [(ground(x + 1, z) - ground(x - 1, z)) / 2, (ground(x, z + 1) - ground(x, z - 1)) / 2];

// the flow of the ground: along the contour where there is a slope, and along a slow field where it is flat
function groundFlow(x, z) {
  const g = grad(x, z), gl = Math.hypot(g[0], g[1]);
  const fa = fbm2(x * 0.0025 + 9, z * 0.0025 + 2, 2) * 6.2832 * 2;
  const k = smoothstep(0.015, 0.08, gl);
  let t = [(-g[1] / (gl || 1)) * k + Math.cos(fa) * (1 - k), (g[0] / (gl || 1)) * k + Math.sin(fa) * (1 - k)];
  const tl = Math.hypot(t[0], t[1]) || 1;
  return [t[0] / tl, t[1] / tl];
}
// his hills are long strokes laid along their own contours, so ours are chains: a seed, and four or five strokes
// end to end along the flow from it, one colour a chain with a little scatter, so that from the air the ground is
// rolling bands of paint and not dots. The strokes lie on the ground (uLie), bigger the farther they are
export function makeGround({ pools, n = 70000, seed = 11, centre = [0, 40], radius = 1300 }) {
  const R = rng(seed), rows = new Rows(n), P = pools.hills;
  while (rows.n < n) {
    const d = radius * Math.pow(R(), 1.55), a = R() * 6.2832;
    let x = centre[0] + d * Math.sin(a), z = centre[1] - d * Math.cos(a);
    const links = 3 + Math.floor(R() * 3), sgn = R() < 0.5 ? 1 : -1;
    // one colour a chain: brighter with height, on the slopes that face the moon, and in slow bands across the ground
    const h0 = ground(x, z), g0 = grad(x, z), gl0 = Math.hypot(g0[0], g0[1]);
    const lit = clamp(0.5 + 0.5 * (-g0[0] * 0.6 - g0[1] * 0.4) / Math.max(gl0, 0.05) * smoothstep(0.02, 0.2, gl0), 0, 1);
    const band = noise3(x * 0.012 + 5, 0, z * 0.012 + 1) - 0.5;
    const q0 = clamp(0.2 + 0.5 * smoothstep(-2, 130, h0) + 0.22 * (lit - 0.5) + 0.36 * band, 0, 0.98);
    for (let k = 0; k < links && rows.n < n; k++) {
      const rv = riverAt(x, z);
      if (rv.d < RIVER_W * 0.5) break;
      const dd = Math.hypot(x - centre[0], z - centre[1]);
      const f = groundFlow(x, z), t = [f[0] * sgn, 0, f[1] * sgn];
      const L = (1.4 + dd / 24) * (0.75 + 0.5 * R()), w = L * (0.26 + 0.14 * R());
      const h = ground(x, z);
      const c = jit(pick(P, clamp(q0 + 0.06 * (R() - 0.5), 0, 0.99), R, 0.03), R, 0.07);
      // the bow follows the turn of the flow ahead
      const f2 = groundFlow(x + t[0] * L, z + t[2] * L);
      const turn = (f[0] * f2[1] - f[1] * f2[0]) * sgn;
      rows.put([x + t[0] * L * 0.5, h + 0.12 + 0.05 * R(), z + t[2] * L * 0.5], t, [-t[2], 0, t[0]], clamp(turn * 0.5, -0.2, 0.2), L, w, 0.008, L * 0.06, c, 0, 0.22 + 0.34 * R(), R() * 6.2832, null, 0);
      x += t[0] * L * 0.92 + (R() - 0.5) * w * 0.5; z += t[2] * L * 0.92 + (R() - 0.5) * w * 0.5;
    }
  }
  return rows.done();
}

// the water, and the stars in it: his Rhone's idea -- a column of gold under every light, made of dashes
export function makeRiver({ pools, n = 16000, seed = 12, lights = [] }) {
  const R = rng(seed), rows = new Rows(n + 4000), P = pools.sky;
  // arc length along the path
  const seg = [];
  let total = 0;
  for (let i = 0; i + 1 < RIVER.length; i++) { const l = Math.hypot(RIVER[i + 1][0] - RIVER[i][0], RIVER[i + 1][1] - RIVER[i][1]); seg.push([total, l]); total += l; }
  const along = s => {
    for (let i = 0; i < seg.length; i++) if (s <= seg[i][0] + seg[i][1] || i === seg.length - 1) {
      const t = clamp((s - seg[i][0]) / seg[i][1], 0, 1), a = RIVER[i], b = RIVER[i + 1];
      const l = seg[i][1];
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dir: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] };
    }
  };
  for (let i = 0; i < n; i++) {
    const s = R() * total, p = along(s);
    const u = (R() - 0.5) * RIVER_W * 0.96, nx = -p.dir[1], nz = p.dir[0];
    const x = p.x + nx * u, z = p.z + nz * u;
    const far = Math.hypot(x, z - 40);
    const L = (1.0 + far / 70) * (0.6 + 0.8 * R()), w = L * 0.2;
    const t = norm3([p.dir[0] + (R() - 0.5) * 0.3, 0, p.dir[1] + (R() - 0.5) * 0.3]);
    const q = clamp(0.12 + 0.5 * R() * R() + 0.2 * (noise3(x * 0.05, 3, z * 0.05) - 0.5), 0, 0.99);
    rows.put([x, RIVER_Y + 0.05 * R(), z], t, [0, 1, 0], (R() - 0.5) * 0.06, L, w, 0.006, L * 0.1, jit(pick(P, q, R), R), 0, 0.4 + 0.1 * R(), R() * 6.2832, null, 0);
  }
  // the columns: under each light that stands low over the water, a run of gold dashes across the flow,
  // toward the eye, so that from the knoll the river carries the stars
  for (const lt of lights) {
    // where the river lies under the light's bearing from the standpoint, roughly: walk out along it
    const dir = [Math.sin(lt.az * DEG), -Math.cos(lt.az * DEG)];
    let hit = null;
    for (let d = 100; d < 1400; d += 4) { const x = dir[0] * d, z = 40 + dir[1] * d; if (riverAt(x, z).d < RIVER_W * 0.4) { hit = [x, z]; break; } }
    if (!hit) continue;
    const len = 40 + 60 * lt.s, cnt = Math.floor(len / 1.4);
    const cw = pools.moon, cs = pools.star;
    for (let k = 0; k < cnt; k++) {
      const s = k / cnt, x = hit[0] - dir[0] * (s - 0.35) * len + (R() - 0.5) * 3 * lt.s, z = hit[1] - dir[1] * (s - 0.35) * len + (R() - 0.5) * 3 * lt.s;
      if (riverAt(x, z).d > RIVER_W * 0.48) continue;
      const t = norm3([-dir[1], 0, dir[0]]);
      const L = (1.2 + 3 * lt.s) * (0.5 + R()) * (1 - 0.5 * Math.abs(s - 0.5)), w = L * 0.22;
      const c = jit(pick(lt.moon ? cw : cs, 0.55 + 0.4 * R(), R), R);
      rows.put([x, RIVER_Y + 0.12, z], t, [0, 1, 0], 0, L, w, 0.006, L * 0.15, c, 0.7 * (1 - Math.abs(s - 0.5)), 0.72 + 0.1 * R(), R() * 6.2832, null, 0);
    }
  }
  return rows.done();
}

// ---------------------------------------------------------------- the sky
export const SKY_R = 1500;
// the swirls: where each turns in the sky, how wide, and how fast (degrees a second; the sign is the way)
export const VORTICES = [
  { az: -6, el: 35, r: 24, w: 2.2, arms: 2 },
  { az: 26, el: 24, r: 11, w: -3.6, arms: 2 },
  { az: 4, el: 87, r: 17, w: -1.4, arms: 3 },
  { az: 172, el: 44, r: 21, w: 2.0, arms: 2 },
  { az: -112, el: 36, r: 15, w: -3.0, arms: 2 },
  { az: 104, el: 58, r: 17, w: 2.8, arms: 2 },
  { az: -60, el: 14, r: 9, w: 3.4, arms: 2 },
];
export const STARS = [
  { az: -24, el: 21, s: 2.4 }, { az: 8, el: 70, s: 1.3 }, { az: -50, el: 62, s: 1.0 }, { az: 70, el: 20, s: 1.5 },
  { az: 48, el: 62, s: 1.0 }, { az: -84, el: 30, s: 1.2 }, { az: 122, el: 40, s: 1.3 }, { az: 150, el: 66, s: 1.1 },
  { az: -150, el: 36, s: 1.5 }, { az: -120, el: 70, s: 0.9 }, { az: 90, el: 14, s: 1.0 }, { az: -36, el: 40, s: 0.9 },
  { az: 176, el: 20, s: 1.3 }, { az: 22, el: 12, s: 0.9 }, { az: -176, el: 55, s: 1.0 }, { az: 72, el: 82, s: 1.1 },
  { az: 140, el: 12, s: 1.0 }, { az: -100, el: 8, s: 0.8 }, { az: 35, el: 46, s: 0.7 },
];
export const MOON = { az: 46, el: 31, s: 3.6 };

// the flow of the sky at a direction: along the circles of the nearest swirl, and round the horizon between them
function flowAt(d) {
  let t = [0, 0, 0], best = null, bw = 0, wsum = 0;
  for (const V of VORTICES) {
    const a = V.dir, cs = clamp(dot3(d, a), -1, 1), th = Math.acos(cs) / DEG;
    const w = Math.exp(-Math.pow(th / V.r, 2) * 0.8);
    if (w < 1e-3) continue;
    const c = cross3(a, d), cl = Math.hypot(c[0], c[1], c[2]) || 1;
    const sg = V.w > 0 ? 1 : -1;
    for (let k = 0; k < 3; k++) t[k] += c[k] / cl * w * sg;
    wsum += w;
    if (w > bw) { bw = w; best = V; }
  }
  // the band round the horizon: eastward, with a slow wave in it
  const az = Math.atan2(d[0], -d[2]), el = Math.asin(clamp(d[1], -1, 1));
  const band = 0.28 * (1 - 0.5 * smoothstep(40 * DEG, 80 * DEG, el));
  const h = cross3([0, 1, 0], d), hl = Math.hypot(h[0], h[1], h[2]) || 1;
  const wave = 0.45 * Math.sin(3 * az + el * 4) * Math.cos(el);
  for (let k = 0; k < 3; k++) t[k] += (h[k] / hl + [0, wave, 0][k]) * band;
  const tl = Math.hypot(t[0], t[1], t[2]) || 1;
  return { t: [t[0] / tl, t[1] / tl, t[2] / tl], best, bw, wsum, band };
}

// The sky's depth (E1). A stroke is laid in a direction, as before, so that from the knoll the sky is his picture;
// and at a distance f·R along it, so that when you fly it has depth: the night between the swirls lies in slow
// drifts from 0.55 R to 1.45 R; a swirl is a well, its rim at 0.62 R and its eye at 1.47 R, so that flying into it
// the arms wind round you and close ahead; and in a star's direction the sky keeps behind the star (which is a
// well of rings down to its core at R, star()). The far hills are a ring at 1.35 R, beyond the ground's edge.
// A ring's step is 0.05 R: nine rings put the mouth at 0.55 R, the moon's ten at 0.5 R.
const HILLS_F = 1.35, STAR_F = 1.0, RING_STEP = 0.05;
// A star's well runs along the line from the knoll's eye to the core, not from the middle of the world: the
// picture is seen from the knoll, and a well seen 4 degrees off its axis is a crescent (E1.1).
// The wells as the knoll sees them: the line from its eye to each core, and how wide round it the sky keeps back
export function starWells(eye, R = SKY_R, stars = STARS, moon = MOON) {
  return stars.concat(moon ? [moon] : []).map(S => { const a = dirAzEl(S.az, S.el); return { b: norm3([a[0] * R - eye[0], a[1] * R - eye[1], a[2] * R - eye[2]]), th: 5.4 * S.s * DEG }; });
}
export function makeSky({ pools, n = 115000, seed = 21, R = SKY_R, ridge, stars = STARS, moon = MOON, eye = [0, 32, 100] }) {
  for (const V of VORTICES) V.dir = dirAzEl(V.az, V.el);
  const rr = rng(seed), rows = new Rows(n), P = pools.sky, PH = pools.hills;
  const wells = starWells(eye, R, stars, moon);
  const lo = Math.sin(-7 * DEG);
  for (let i = 0; i < n; i++) {
    const y = lo + (1 - lo) * rr(), az = rr() * 6.2832, cs = Math.sqrt(Math.max(0, 1 - y * y));
    const d = [cs * Math.sin(az), y, -cs * Math.cos(az)];
    const el = Math.asin(y) / DEG;
    const F = flowAt(d);
    // the swirls take more of the paint than the night between them
    if (F.bw < 0.3 && rr() < 0.3) continue;
    // the far hills: under the ridge, his hills' colour, laid level
    const rdg = ridge ? ridge(az) : 2;
    if (el < rdg) {
      const Rh = R * HILLS_F, c = [d[0] * Rh, d[1] * Rh, d[2] * Rh];
      const t = norm3(cross3([0, 1, 0], d));
      const L = Rh * (0.014 + 0.014 * rr()), w = L * (0.22 + 0.12 * rr());
      const q = clamp(0.1 + 0.22 * smoothstep(rdg - 14, rdg, el) + 0.16 * (noise3(d[0] * 9, d[1] * 9, d[2] * 9) - 0.5) + 0.1 * (rr() - 0.5), 0, 0.99);
      rows.put(c, t, d, (rr() - 0.5) * 0.1, L, w, 0.02, L * 0.05, jit(pick(PH, q, rr), rr), 0, 0.08 + 0.2 * rr(), rr() * 6.2832, null, 0);
      continue;
    }
    // the brightness of the sky here: his swirls have pale arms winding into a pale eye, and between them the
    // night is dark blue with pale bands that follow the flow
    // between the swirls the flow is level, and the bands lie across it: pale ribbons a few degrees apart, drifting
    // with a slow wave, with a little noise in and along them
    const azr = Math.atan2(d[0], -d[2]);
    const rib = Math.sin(el * DEG * (6.2832 / (4.5 * DEG)) + 1.8 * Math.sin(2 * azr + 0.7) + 1.2 * Math.sin(3 * azr - el * 0.05) + 2.0 * noise3(d[0] * 3, d[1] * 3, d[2] * 3));
    let b = 0.30 + 0.20 * rib + 0.08 * (noise3(d[0] * 20, d[1] * 20, d[2] * 20) - 0.5) * 2;
    b += 0.12 * smoothstep(20, 3, el);                                        // paler toward the hills
    if (F.best) {
      const V = F.best, a = V.dir, cs2 = clamp(dot3(d, a), -1, 1), th = Math.acos(cs2) / DEG;
      const u = perp(a, [0, 1, 0]), v = cross3(a, u);
      const ph = Math.atan2(dot3(d, v), dot3(d, u));
      const arm = 0.5 + 0.5 * Math.sin(V.arms * ph + th / V.r * 7.0 * (V.w > 0 ? 1 : -1));
      const eye = smoothstep(0.35, 0.0, th / V.r);
      const sw = clamp(0.1 + 0.88 * arm * arm * arm + 0.5 * eye, 0, 1);
      b = lerp(b, sw, F.bw);
    }
    const q = clamp(b + 0.06 * (rr() - 0.5), 0.0, 0.995);
    const col = jit(pick(P, q, rr, 0.03), rr, 0.05);
    // how far out: a drift for the night, a well for a swirl, and behind the stars
    const drift = clamp((noise3(d[0] * 2.5 + 7, d[1] * 2.5 + 3, d[2] * 2.5 + 5) - 0.5) * 1.8 + 0.5, 0, 1);
    let f = 0.55 + 0.9 * drift + 0.1 * (rr() - 0.5);
    if (F.best) {
      const V = F.best, th = Math.acos(clamp(dot3(d, V.dir), -1, 1)) / DEG;
      const well = 0.62 + 0.85 * Math.pow(1 - clamp(th / V.r, 0, 1), 1.3) + 0.06 * (rr() - 0.5);
      f = lerp(f, well, smoothstep(0.1, 0.5, F.bw));
    }
    // (behind the stars: the paint's shader puts a stroke back when it is in a well, wherever the sky has turned it,
    // since E2 -- here only the draw that was made for it is kept, so that the rest of the sky is the stroke it was)
    {
      const p = [d[0] * R * f - eye[0], d[1] * R * f - eye[1], d[2] * R * f - eye[2]], pe = norm3(p);
      for (const Wl of wells) {
        const th = Math.acos(clamp(dot3(pe, Wl.b), -1, 1));
        if (smoothstep(Wl.th * 1.15, Wl.th * 0.9, th) > 0) rr();
      }
    }
    const Rf = R * f, c = [d[0] * Rf, d[1] * Rf, d[2] * Rf];
    const L = Rf * (0.026 + 0.022 * rr()) * (1 + 1.1 * F.bw), w = L * (0.26 + 0.14 * rr()) / (1 + 0.5 * F.bw);
    // the bow: round the swirl it lies on, as an arc of that circle
    let bow = (rr() - 0.5) * 0.08, nrm = perp(F.t, d);
    let axis = null, rate = 0;
    if (F.best && F.bw > 0.12) {
      const V = F.best, a = V.dir;
      const toC = norm3([a[0] - d[0] * dot3(a, d), a[1] - d[1] * dot3(a, d), a[2] - d[2] * dot3(a, d)]);
      const rc = Rf * Math.sin(Math.max(Math.acos(clamp(dot3(d, a), -1, 1)), 0.02));
      nrm = toC; bow = clamp(L / (4 * rc), 0, 0.3);
      axis = a; rate = V.w * DEG * clamp(F.bw / (F.bw + F.band * 0.5), 0, 1);
    } else { axis = [0, 1, 0]; rate = 0.22 * DEG * (1 - 0.6 * smoothstep(40, 80, el)); }
    rows.put(c, F.t, nrm, bow, L, w, 0.02, L * 0.06, col, 0, 0.0 + 0.3 * rr(), rr() * 6.2832, axis, rate);
  }
  return rows.done();
}

// a star: a core, and a halo of rings out of it, each ring turning at its own rate. The moon is a star with a
// crescent. It has depth (E1): the core is at R and each ring is nearer than the one inside it, a step of
// 0.05 R, so that the star is a well with its widest ring at the mouth, and you fly down it through ring after
// turning ring to the core. Its colour is his (E1.1): the core his chrome yellow, orange at the heart of the
// biggest and of the moon; the halo dense, yellow next to the core, then his pale yellow-whites and greens,
// then paler into the sky's own light blues at the rim -- and lit, most at the core, so that a star is a
// yellow blaze in a yellow-white ring and not a white disc
function star(rows, pools, S, R, rr, rev, moon = false, eye = [0, 32, 100]) {
  const a = dirAzEl(S.az, S.el), u = perp(a, [0, 1, 0]), v = cross3(a, u);
  const rad = S.s * DEG;
  // the well's axis: from the knoll's eye to the core. The strokes spin about it (the mesh's uSpinC is the eye)
  const C = [a[0] * R, a[1] * R, a[2] * R], CE = [C[0] - eye[0], C[1] - eye[1], C[2] - eye[2]];
  const Dc = Math.hypot(CE[0], CE[1], CE[2]), b = [CE[0] / Dc, CE[1] / Dc, CE[2] / Dc], ub = perp(b, [0, 1, 0]), vb = cross3(b, ub);
  const Y = pools.starYellow, O = pools.starOrange, Wp = pools.starPale, sign = rr() < 0.5 ? 1 : -1;
  const at = (th, ph) => { const s = Math.sin(th), c = Math.cos(th); return norm3([a[0] * c + (u[0] * Math.cos(ph) + v[0] * Math.sin(ph)) * s, a[1] * c + (u[1] * Math.cos(ph) + v[1] * Math.sin(ph)) * s, a[2] * c + (u[2] * Math.cos(ph) + v[2] * Math.sin(ph)) * s]); };
  // the core: a disc, or a crescent: the disc less a disc set off from it
  const nc = Math.floor(110 * S.s * S.s + 40), big = moon || S.s >= 2;
  for (let i = 0; i < nc; i++) {
    const th = rad * Math.sqrt(rr()), ph = rr() * 6.2832, inner = 1 - th / rad;
    if (moon) { const px = th * Math.cos(ph), py = th * Math.sin(ph); if (Math.hypot(px - rad * 0.55, py - rad * 0.1) < rad * 0.78) continue; }
    const Rk = R * (STAR_F + 0.016 * (rr() - 0.5));
    const d = at(th, ph), c = [d[0] * Rk, d[1] * Rk, d[2] * Rk];
    const circ = norm3(cross3(a, d)), t = norm3([circ[0] + (rr() - 0.5) * 0.6, circ[1] + (rr() - 0.5) * 0.6, circ[2] + (rr() - 0.5) * 0.6]);
    const L = Rk * (0.005 + 0.007 * rr()) * (0.6 + 0.4 * S.s), w = L * 0.4;
    const col = big && rr() < 0.08 + 0.3 * inner ? pick(O, 0.5 + 0.45 * rr(), rr) : pick(Y, 0.55 + 0.43 * rr(), rr);
    // lit, but not past the grade's shoulder at 0.85 a channel: a yellow lit twice over is white
    rows.put(c, t, d, (rr() - 0.5) * 0.1, L, w, 0.02, L * 0.05, jit(col, rr, 0.05), 0.32 * (0.8 + 0.4 * inner), rev + 0.04 * rr(), rr() * 6.2832, b, sign * (5 + 4 * rr()) * DEG * 0.5);
  }
  // the halo: rings close enough to overlap, yellow inside and pale out
  const rings = moon ? [1.2, 1.38, 1.6, 1.85, 2.15, 2.5, 2.9, 3.4, 4.0, 4.6] : [1.2, 1.38, 1.6, 1.85, 2.15, 2.5, 2.9, 3.4, 4.0];
  for (let k = 0; k < rings.length; k++) {
    const fk = STAR_F - (rings.length - k) * RING_STEP, fr = k / (rings.length - 1);
    const th = rad * rings[k], L = R * fk * (0.010 + 0.010 * rr()) * (0.6 + 0.4 * Math.min(S.s, 2)), w = L * 0.42;
    const cnt = Math.floor(6.2832 * Math.sin(th) * R * fk / (L * 0.24));
    const rate = sign * (k % 2 ? -1 : 1) * (2 + 3 * rr()) * DEG * 0.5;
    const emit = lerp(0.26, 0.03, Math.pow(fr, 0.8));
    for (let i = 0; i < cnt; i++) {
      const ph = (i + rr() * 0.8) / cnt * 6.2832, th2 = th * (1 + (rr() - 0.5) * 0.16);
      // along the axis from the eye: the ring's centre, then out to its radius, so that from the knoll it is
      // the circle of th2 round the core
      const Dk = Dc - (STAR_F - fk) * R + 0.03 * R * (rr() - 0.5), rc = Dk * Math.tan(th2);
      const rd = [ub[0] * Math.cos(ph) + vb[0] * Math.sin(ph), ub[1] * Math.cos(ph) + vb[1] * Math.sin(ph), ub[2] * Math.cos(ph) + vb[2] * Math.sin(ph)];
      const c = [eye[0] + b[0] * Dk + rd[0] * rc, eye[1] + b[1] * Dk + rd[1] * rc, eye[2] + b[2] * Dk + rd[2] * rc];
      const circ = norm3(cross3(b, rd)), toC = [-rd[0], -rd[1], -rd[2]];
      // yellow through the inner third of the halo, then his yellow-whites with yellow among them, and the
      // sky's light blue only among the last rings
      let col;
      const u = rr();
      if (fr < 0.3) col = pick(Y, 0.5 + 0.45 * rr(), rr);
      else if (fr < 0.75) col = u < 0.62 ? pick(Y, 0.6 + 0.38 * rr(), rr) : pick(Wp, 0.65 + 0.34 * rr(), rr);
      else col = u < 0.3 ? pick(pools.sky, 0.88 + 0.11 * rr(), rr) : u < 0.65 ? pick(Y, 0.6 + 0.38 * rr(), rr) : pick(Wp, 0.55 + 0.4 * rr(), rr);
      rows.put(c, circ, toC, clamp(L / (4 * rc), 0, 0.3), L, w, 0.02, L * 0.06, jit(col, rr, 0.06), emit * (0.7 + 0.6 * rr()), rev + 0.02 * k + 0.04 * rr(), rr() * 6.2832, b, rate);
    }
  }
}
export function makeStars({ pools, seed = 31, R = SKY_R, stars = STARS, moon = MOON, rev = 0.72, eye = [0, 32, 100] }) {
  const rr = rng(seed), rows = new Rows(120000);
  for (const S of stars) star(rows, pools, S, R, rr, rev + 0.12 * rr(), false, eye);
  if (moon) star(rows, pools, moon, R, rr, rev + 0.1, true, eye);
  return rows.done();
}

// ---------------------------------------------------------------- the motes
export function makeMotes({ pools, n = 2400, cell = 60, seed = 41 }) {
  const rr = rng(seed), rows = new Rows(n);
  for (let i = 0; i < n; i++) {
    const c = [(rr() - 0.5) * cell, (rr() - 0.5) * cell, (rr() - 0.5) * cell];
    const t = norm3([rr() - 0.5, (rr() - 0.5) * 0.3, rr() - 0.5]);
    const L = 0.18 + 0.3 * rr(), w = L * 0.22;
    rows.put(c, t, perp(t, [0, 1, 0]), 0, L, w, 0.002, L * 0.3, jit(pick(pools.sky, 0.6 + 0.38 * rr(), rr), rr), 0.5, 1.0, rr() * 6.2832, null, 0);
  }
  const ex = rows.done(); ex.cell = cell;
  return ex;
}

// ---------------------------------------------------------------- the village
// a wall of strokes: horizontal marks over its face, and the windows in it
function wall(rows, rr, c, A, N, Lw, h0, h1, col, lamp, wins, rev, opts = {}) {
  const step = opts.step || 0.5;
  for (let y = h0 + step * 0.5; y < h1; y += step) {
    for (let s = -Lw / 2 + 0.3; s < Lw / 2; s += 0.85 * (opts.L || 1.6)) {
      const L = Math.min((opts.L || 1.6) * (0.7 + 0.6 * rr()), Lw), off = (rr() - 0.5) * 0.3;
      const p = [c[0] + A[0] * (s + off) + N[0] * 0.06, y + (rr() - 0.5) * 0.15, c[2] + A[2] * (s + off) + N[2] * 0.06];
      const t = norm3([A[0] + (rr() - 0.5) * 0.08, (rr() - 0.5) * 0.1, A[2] + (rr() - 0.5) * 0.08]);
      rows.put(p, t, N, (rr() - 0.5) * 0.06, L, step * (0.9 + 0.5 * rr()), 0.006, L * 0.05, jit(col, rr, 0.12), 0, rev + 0.03 * rr(), rr() * 6.2832, null, 0);
    }
  }
  for (const W of wins) {
    const p = [c[0] + A[0] * W[0] + N[0] * 0.14, W[1], c[2] + A[2] * W[0] + N[2] * 0.14];
    for (let k = 0; k < 2; k++) rows.put([p[0], p[1] + (k - 0.5) * 0.3, p[2]], A, N, 0, 0.7 + 0.2 * rr(), 0.36, 0.006, 0.02, jit(pick(lamp, 0.4 + 0.6 * rr(), rr), rr, 0.08), 1.3, rev + 0.05, rr() * 6.2832, null, 0);
  }
}
function house(rows, rr, pools, H, rev) {
  const { x, z, w, d, h, yaw, storeys } = H;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const A = [cy, 0, sy], B = [-sy, 0, cy];                       // along the front, and along the side
  const y0 = ground(x, z) - 0.4;
  const warm = rr() < 0.35;
  const wc = warm ? jit(pick(pools.village, 0.55 + 0.35 * rr(), rr), rr) : jit(pick(pools.village, 0.25 + 0.4 * rr(), rr), rr);
  const rc = jit(pick(pools.village, 0.05 + 0.25 * rr(), rr), rr);
  const lamp = pools.lamp;
  const faces = [[[x + B[0] * d / 2, 0, z + B[2] * d / 2], A, B, w], [[x - B[0] * d / 2, 0, z - B[2] * d / 2], A, [-B[0], 0, -B[2]], w],
                 [[x + A[0] * w / 2, 0, z + A[2] * w / 2], B, A, d], [[x - A[0] * w / 2, 0, z - A[2] * w / 2], B, [-A[0], 0, -A[2]], d]];
  for (const [c, Al, N, Lw] of faces) {
    const wins = [];
    for (let s = 0; s < storeys; s++) {
      const nw = rr() < 0.75 ? 1 + Math.floor(rr() * Math.max(1, Lw / 3.5)) : 0;
      for (let k = 0; k < nw; k++) if (rr() < 0.8) wins.push([(k + 0.5 - nw / 2) * (Lw / Math.max(nw, 1)) * 0.8 + (rr() - 0.5) * 0.5, y0 + 1.5 + s * 2.8 + rr() * 0.3]);
    }
    wall(rows, rr, c, Al, N, Lw, y0, y0 + h, wc, lamp, wins, rev);
  }
  // the roof: two slopes to a ridge along the front, in a darker paint
  const rise = d * 0.36, eave = y0 + h;
  for (const sgn of [1, -1]) {
    const slope = norm3([B[0] * sgn * (d / 2), -rise, B[2] * sgn * (d / 2)]);
    const N = norm3(cross3(A, slope));
    const len = Math.hypot(d / 2, rise);
    for (let s = 0.15; s < len; s += 0.5) {
      const yy = eave + rise * (1 - s / len), oz = sgn * (d / 2) * (1 - s / len);
      for (let a = -w / 2 - 0.3; a < w / 2 + 0.3; a += 1.2) {
        const L = 1.3 + 0.8 * rr();
        const p = [x + A[0] * (a + 0.3 * rr()) + B[0] * oz, yy + 0.05, z + A[2] * (a + 0.3 * rr()) + B[2] * oz];
        rows.put(p, norm3([A[0] + (rr() - 0.5) * 0.1, (rr() - 0.5) * 0.06, A[2] + (rr() - 0.5) * 0.1]), N[1] > 0 ? N : [-N[0], -N[1], -N[2]], 0, L, 0.55, 0.006, L * 0.05, jit(rc, rr, 0.1), 0, rev + 0.04 + 0.03 * rr(), rr() * 6.2832, null, 0);
      }
    }
  }
}
// the church: a nave, a tower, and the spire the whole valley is drawn to. The nave and the tower go into parts, so
// that the film's audit can keep its distance from them (film.js)
function church(rows, rr, pools, x, z, yaw, rev, parts = []) {
  const nave = { x, z, w: 22, d: 10, h: 9, yaw, storeys: 2 };
  house(rows, rr, pools, nave, rev);
  const cy = Math.cos(yaw), sy = Math.sin(yaw), A = [cy, 0, sy];
  const tx = x + A[0] * 13.5, tz = z + A[2] * 13.5;
  const tower = { x: tx, z: tz, w: 6, d: 6, h: 20, yaw, storeys: 3 };
  house(rows, rr, pools, tower, rev);
  parts.push(nave, tower);
  const y0 = ground(tx, tz) + 20 + 6 * 0.36;
  const dark = pick(pools.village, 0.06, rr);
  for (let y = 0; y < 26; y += 0.5) {
    const r = 3.4 * (1 - y / 26) + 0.12, cnt = Math.max(4, Math.floor(6.2832 * r / 1.0));
    for (let i = 0; i < cnt; i++) {
      const ph = (i + rr() * 0.5) / cnt * 6.2832 + y * 0.2;
      const p = [tx + r * Math.cos(ph), y0 + y, tz + r * Math.sin(ph)];
      const t = norm3([-Math.sin(ph) * 0.35, 1, Math.cos(ph) * 0.35]);
      rows.put(p, t, [Math.cos(ph), 0, Math.sin(ph)], 0, 1.4 + 0.6 * rr(), 0.42, 0.006, 0.05, jit(dark, rr, 0.12), 0, rev + 0.06 + 0.03 * rr(), rr() * 6.2832, null, 0);
    }
  }
  return [tx, y0 + 26, tz];
}
export function makeVillage({ pools, seed = 51, rev = 0.45 }) {
  const rr = rng(seed), rows = new Rows(120000);
  const houses = [];
  const ok = (x, z, w, d) => riverAt(x, z).d > RIVER_W * 0.6 + Math.max(w, d) && houses.every(h => Math.hypot(h.x - x, h.z - z) > (h.w + w) * 0.75 + 2.5);
  const add = (x, z, yaw) => {
    const w = 6 + rr() * 5, d = 5 + rr() * 4, storeys = rr() < 0.4 ? 2 : 1, h = storeys * 2.9 + 0.6;
    if (!ok(x, z, w, d)) return;
    houses.push({ x, z, w, d, h, yaw: yaw + (rr() - 0.5) * 0.3, storeys });
  };
  // the main street, north out of the square; the cross street; and the lanes off them
  for (let z = -95; z > -300; z -= 12 + rr() * 5) { add(-9 - rr() * 5, z, 0); add(9 + rr() * 5, z, 0); }
  for (let x = -150; x < 150; x += 12 + rr() * 6) { if (Math.abs(x) < 14) continue; add(x, -178 - rr() * 5, Math.PI / 2); add(x, -204 + rr() * 5, Math.PI / 2); }
  for (let i = 0; i < 40; i++) add((rr() - 0.5) * 330, -100 - rr() * 190, rr() * 6.2832);
  for (let i = 0; i < 12; i++) add((rr() - 0.5) * 520, -60 - rr() * 260, rr() * 6.2832);
  for (const H of houses) house(rows, rr, pools, H, rev + 0.2 * rr());
  const churchParts = [];
  const spire = church(rows, rr, pools, -30, -160, 0, rev + 0.1, churchParts);
  // the trees between the houses: round dark crowns in the cypress's greens
  const trees = [];
  for (let i = 0; i < 26; i++) {
    const x = (rr() - 0.5) * 380, z = -70 - rr() * 250, r = 2.5 + 3 * rr();
    if (riverAt(x, z).d < RIVER_W * 0.6 + r) continue;
    if (houses.some(h => Math.hypot(h.x - x, h.z - z) < h.w * 0.7 + r)) continue;
    trees.push([x, z, r]);
    const y0 = ground(x, z) + r * 0.9;
    const cnt = Math.floor(r * r * 40);
    for (let k = 0; k < cnt; k++) {
      const th = Math.acos(1 - 2 * rr()), ph = rr() * 6.2832;
      const d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      const p = [x + d[0] * r * (0.75 + 0.3 * rr()), y0 + d[1] * r * (0.75 + 0.3 * rr()), z + d[2] * r * (0.75 + 0.3 * rr())];
      const t = norm3(cross3(d, [rr() - 0.5, rr() - 0.5, rr() - 0.5]));
      const L = 0.45 + 0.7 * rr();
      rows.put(p, t, d, (rr() - 0.5) * 0.2, L, L * 0.36, 0.006, L * 0.1, jit(pick(pools.cypress, 0.45 + 0.5 * rr(), rr), rr, 0.1), 0, rev + 0.15 + 0.1 * rr(), rr() * 6.2832, null, 0);
    }
    // and a trunk
    for (let k = 0; k < 4; k++) rows.put([x + (rr() - 0.5) * 0.3, ground(x, z) + 0.5 + k * 0.5, z + (rr() - 0.5) * 0.3], [0.05, 1, 0.02], [1, 0, 0], 0, 0.9, 0.35, 0.006, 0.02, pick(pools.cypress, 0.1, rr), 0, rev + 0.15, rr() * 6.2832, null, 0);
  }
  const ex = rows.done(); ex.houses = houses; ex.spire = spire; ex.trees = trees; ex.church = churchParts;
  return ex;
}

// ---------------------------------------------------------------- the cypress
// a flame of his near-black greens, in its own frame with its foot at the origin, so that it can sway whole
export function makeCypress({ pools, height = 55, base = 5.5, n = 7000, seed = 61, rev = 0.55 }) {
  const rr = rng(seed), rows = new Rows(n), P = pools.cypress;
  const rad = u => base * Math.pow(1 - u, 0.55) * (1 + 0.28 * Math.sin(u * 11 + 0.7) + 0.14 * Math.sin(u * 23 + 2.1)) + 0.25 * (1 - u);
  for (let i = 0; i < n; i++) {
    const u = Math.pow(rr(), 0.8), ph = rr() * 6.2832, r0 = rad(u);
    const inner = rr() < 0.3, r = r0 * (inner ? 0.35 + 0.4 * rr() : 0.85 + 0.25 * rr());
    const p = [r * Math.cos(ph), u * height, r * Math.sin(ph)];
    // the licks of the flame: up, leaning round the trunk and out, more at the top
    const tang = [-Math.sin(ph), 0, Math.cos(ph)], out = [Math.cos(ph), 0, Math.sin(ph)];
    const lean = 0.25 + 0.5 * u, s = Math.sin(u * 9 + ph * 2 + 1);
    const t = norm3([tang[0] * lean * s + out[0] * 0.12 * (1 - u), 1, tang[2] * lean * s + out[2] * 0.12 * (1 - u)]);
    const L = (2.2 + 4.0 * Math.pow(1 - u, 0.6)) * (0.7 + 0.6 * rr()), w = L * (0.2 + 0.12 * rr());
    const q = inner ? 0.04 + 0.2 * rr() : rr() < 0.06 ? 0.6 + 0.3 * rr() : 0.08 + 0.38 * rr();
    rows.put(p, t, out, 0.08 + 0.12 * rr(), L, w, 0.01, L * 0.12, jit(pick(P, q, rr), rr, 0.1), 0, rev + 0.15 * u + 0.05 * rr(), rr() * 6.2832, null, 0);
  }
  // the tip
  for (let k = 0; k < 30; k++) rows.put([(rr() - 0.5) * 0.4, height + k * 0.25, (rr() - 0.5) * 0.4], norm3([(rr() - 0.5) * 0.4, 1, (rr() - 0.5) * 0.4]), [1, 0, 0], 0.1, 1.2, 0.35, 0.01, 0.1, pick(P, 0.2 + 0.3 * rr(), rr), 0, rev + 0.2, rr() * 6.2832, null, 0);
  return rows.done();
}

// ---------------------------------------------------------------- the sunflowers
// his own heads, out of the Sunflowers record: eight circles on his canvas, each a head
const HEADS = [[0.16, 0.33, 0.10], [0.55, 0.38, 0.11], [0.41, 0.31, 0.09], [0.62, 0.15, 0.11], [0.80, 0.49, 0.10], [0.91, 0.32, 0.09], [0.50, 0.58, 0.10], [0.21, 0.70, 0.09]];
export async function loadHeads() {
  const rec = await loadRecord('strokes/sunflowers-canvas.bin');
  const Hm = rec.cm[1] / 100, Wm = Hm * rec.px[0] / rec.px[1], short = Math.min(Wm, Hm);
  const heads = HEADS.map(([cu, cv, r]) => {
    const list = [];
    for (let i = 0; i < rec.n; i++) {
      const u = 0.5 * (rec.p[i * 6] + rec.p[i * 6 + 4]), v = 0.5 * (rec.p[i * 6 + 1] + rec.p[i * 6 + 5]);
      if (Math.hypot((u - cu) * Wm, (v - cv) * Hm) > r * Wm) continue;
      list.push(i);
    }
    // and the head's two colours, for the far ones: its petals (the brighter half) and its heart (the darkest third)
    const cols = list.map(i => [rec.rgb[i * 3], rec.rgb[i * 3 + 1], rec.rgb[i * 3 + 2]]).sort((a, b) => lum(a) - lum(b));
    const mean = arr => arr.reduce((m, c) => [m[0] + c[0] / arr.length, m[1] + c[1] / arr.length, m[2] + c[2] / arr.length], [0, 0, 0]);
    return { cu, cv, r: r * Wm, list, petal: mean(cols.slice(Math.floor(cols.length * 0.5))), heart: mean(cols.slice(0, Math.floor(cols.length * 0.3))) };
  });
  // the green of his stems and leaves
  const greens = [];
  for (let i = 0; i < rec.n; i++) { const c = [rec.rgb[i * 3], rec.rgb[i * 3 + 1], rec.rgb[i * 3 + 2]]; if (c[1] > c[0] * 1.15 && c[1] > c[2] * 1.3 && lum(c) < 0.25) greens.push(c); }
  greens.sort((a, b) => lum(a) - lum(b));
  return { rec, heads, Wm, Hm, short, greens: greens.length > 30 ? greens : [lin('#3a5a1e')] };
}
// one flower in its own frame: the head a disc in the xy plane facing +z, centred at the origin, D across; a
// stem down from it and leaves off the stem. The whole is one mesh, moved whole
// opts.lod (E1.2): 1 is every stroke of his head; less is one in so many, each wider, for a flower seen far
export function flower(SF, which, D, rr, opts = {}) {
  const H = SF.heads[which % SF.heads.length], k = D / (2 * H.r), rec = SF.rec;
  const rows = new Rows(H.list.length + 80);
  const glow = opts.glow ?? 0.25;
  const every = Math.max(1, Math.round(1 / (opts.lod ?? 1))), wk = every > 1 ? Math.sqrt(every) * 0.9 : 1;
  let jj = 0;
  for (const i of H.list) {
    if (every > 1 && (jj++ % every)) continue;
    const q = [0, 1, 2].map(c => [((rec.p[i * 6 + c * 2] - H.cu) * SF.Wm) * k, (-(rec.p[i * 6 + c * 2 + 1] - H.cv) * SF.Hm) * k, 0.02 * (rr() - 0.5)]);
    const j = rows.n++;
    for (let c = 0; c < 3; c++) for (let m = 0; m < 3; m++) rows.P[c][j * 3 + m] = q[c][m];
    const w = rec.w[i] * SF.short * k * wk;
    rows.size[j * 4] = w; rows.size[j * 4 + 1] = rec.h[i] * rec.heightMm / 1000 * k; rows.size[j * 4 + 2] = (j * 7) % 8; rows.size[j * 4 + 3] = rec.curl[i] * SF.short * k;
    const c = [rec.rgb[i * 3], rec.rgb[i * 3 + 1], rec.rgb[i * 3 + 2]];
    rows.col[j * 4] = c[0]; rows.col[j * 4 + 1] = c[1]; rows.col[j * 4 + 2] = c[2]; rows.col[j * 4 + 3] = glow * (0.5 + lum(c) * 2);
    rows.meta[j * 4] = (opts.rev ?? 0.86) + 0.1 * rr(); rows.meta[j * 4 + 1] = 1; rows.meta[j * 4 + 2] = rr() * 6.2832; rows.meta[j * 4 + 3] = 100;
  }
  // the stem, and two leaves
  const G = SF.greens, stemL = opts.stem ?? D * 1.6;
  const gc = () => jit(G[Math.floor(rr() * G.length)], rr, 0.1);
  const step = D * 0.22 * (every > 1 ? 2.2 : 1);
  for (let s = 0; s < stemL; s += step) {
    rows.put([0.02 * D * Math.sin(s * 3 / D), -D * 0.35 - s, -0.02 * D], [0.05, -1, 0], [1, 0, 0], 0.05, D * 0.3 * (every > 1 ? 2.2 : 1), D * 0.07, 0.01, 0.02, gc(), 0, (opts.rev ?? 0.86) + 0.05, rr() * 6.2832, null, 0);
  }
  for (const sgn of [1, -1]) {
    const y = -D * (0.7 + 0.4 * rr());
    for (const k2 of every > 1 ? [1, 3] : [0, 1, 2, 3, 4]) {
      const s = (k2 + 0.5) / 5, L = D * 0.28 * (1 - Math.abs(s - 0.5)) + D * 0.1;
      rows.put([sgn * D * 0.32 * s, y - D * 0.15 * s, 0.01], norm3([sgn, -0.35, 0]), [0, 0, 1], 0, L, D * 0.12, 0.01, 0.02, gc(), 0, (opts.rev ?? 0.86) + 0.05, rr() * 6.2832, null, 0);
    }
  }
  const ex = rows.done(); ex.D = D;
  return ex;
}
// a flower seen far: two dabs, the head's petal colour and its heart, in its frame like flower()
function dab(SF, which, D, rr, opts = {}) {
  const H = SF.heads[which % SF.heads.length], rows = new Rows(3), rev = (opts.rev ?? 0.86) + 0.1 * rr();
  const G = SF.greens, stemL = opts.stem ?? D * 1.6;
  rows.put([0, -D * 0.35 - stemL * 0.5, -0.02 * D], [0.03, -1, 0], [1, 0, 0], 0.03, stemL, D * 0.08, 0.01, 0.02, jit(G[Math.floor(rr() * G.length)], rr, 0.1), 0, rev, rr() * 6.2832, null, 0);
  rows.put([0, 0, 0], [1, 0, 0], [0, 1, 0], 0, D, D * 0.9, 0.01, 0.02, jit(H.petal, rr, 0.08), (opts.glow ?? 0.12) * 1.2, rev, rr() * 6.2832, null, 0);
  rows.put([0, 0, 0.01 * D], [1, 0, 0], [0, 1, 0], 0, D * 0.42, D * 0.4, 0.01, 0.02, jit(H.heart, rr, 0.08), 0, rev, rr() * 6.2832, null, 0);
  return rows.done();
}
// the ones that stand: a field of them (E1.2, E1.3): a plot, `size` metres across and along, turned by `yaw`, its
// edge a little wavy, planted in rows `row` metres apart with a flower every `along` metres down the row, all of
// them facing where they are told to. Not on the river and not in a house. What is built here is the far form of
// every flower: two dabs, the head's petal colour and its heart, on one stroke of stem; the near forms live in
// the pools of FieldDetail, which follow the eye. Each flower keeps its own seed, so that its head is the same
// head every time it is built
export function makeField({ SF, seed = 71, centre = [30, 8], size = [140, 125], yaw = -8 * DEG, row = 2.0, along = 1.35, height = 2.8, D = 0.9,
                            face = [0, 1], rev = 0.8, avoid = [] }) {
  const rr = rng(seed);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const flowers = [];
  const nr = Math.floor(size[0] / row), na = Math.floor(size[1] / along);
  for (let r = 0; r < nr; r++) for (let a = 0; a < na; a++) {
    const u = (r + 0.5) * row - size[0] / 2 + (rr() - 0.5) * row * 0.35, v = (a + 0.5) * along - size[1] / 2 + (rr() - 0.5) * along * 0.5;
    if (Math.abs(u) > size[0] / 2 - 3 + 3 * fbm2(v * 0.03 + 1.7, u > 0 ? 4.1 : 9.3, 2)) continue;
    if (Math.abs(v) > size[1] / 2 - 3 + 3 * fbm2(u * 0.03 + 6.2, v > 0 ? 2.8 : 7.5, 2)) continue;
    const x = centre[0] + u * cy + v * sy, z = centre[1] - u * sy + v * cy;
    if (riverAt(x, z).d < RIVER_W) continue;
    if (avoid.some(H => Math.abs(x - H.x) < H.w * 0.75 + 1.5 && Math.abs(z - H.z) < H.d * 0.75 + 1.5)) continue;
    const y0 = ground(x, z), h = height * (0.75 + 0.5 * rr()), dd = D * (0.8 + 0.5 * rr());
    flowers.push({ x, y: y0 + h, z, yaw: Math.atan2(face[0], face[1]) + (rr() - 0.5) * 1.2, tilt: 0.15 + 0.3 * rr(), h, dd,
                   which: Math.floor(rr() * 8), seed: Math.floor(rr() * 1e9), rev });
  }
  // the far form of each, into the world
  const rows = new Rows(flowers.length * 3), dabRev = new Float32Array(flowers.length * 3);
  for (const F of flowers) {
    const f = dab(SF, F.which, F.dd, rng(F.seed ^ 0x5bd1e995), { rev: F.rev, glow: 0.12, stem: F.h - F.dd * 0.35 });
    const i0 = rows.n;
    placeFlower(rows, f, F);
    for (let j = 0; j < 3; j++) dabRev[i0 + j] = rows.meta[(i0 + j) * 4];
  }
  const ex = rows.done(); ex.flowers = flowers; ex.dabRev = dabRev; ex.plot = { centre, size, yaw };
  return ex;
}
// a flower in its own frame, into the world at F: the head at the top of the stem, turned to its yaw and nodded forward
function placeFlower(rows, f, F) {
  const cy = Math.cos(F.yaw), sy = Math.sin(F.yaw), ct = Math.cos(F.tilt), st = Math.sin(F.tilt);
  const M = p => { const x1 = p[0], y1 = p[1] * ct - p[2] * st, z1 = p[1] * st + p[2] * ct; return [F.x + x1 * cy + z1 * sy, F.y + y1, F.z + -x1 * sy + z1 * cy]; };
  for (let j = 0; j < f.n; j++) {
    const i2 = rows.n++;
    for (let c = 0; c < 3; c++) { const p = M([f.P[c][j * 3], f.P[c][j * 3 + 1], f.P[c][j * 3 + 2]]); for (let m = 0; m < 3; m++) rows.P[c][i2 * 3 + m] = p[m]; }
    for (let m = 0; m < 4; m++) { rows.size[i2 * 4 + m] = f.size[j * 4 + m]; rows.col[i2 * 4 + m] = f.col[j * 4 + m]; rows.meta[i2 * 4 + m] = f.meta[j * 4 + m]; }
  }
}
// The near forms of the field (E1.3): pools of slots that follow the eye. A tier is a level of detail -- every
// stroke of his head, one in three, one in eight -- with so many slots, each slot room for one flower at that
// level; the flowers nearest the eye take the slots of the first tier, the next nearest the second, and so on,
// and a flower in a slot has its far form hidden. A stroke is hidden by a turn in the reveal it never gets (9).
// The work is paced: so many strokes built a frame, nearest first, so that the flowers come up around a walker
// in a step or two and a flier's field is never rebuilt in one hitch
const HIDDEN = 9;
export class FieldDetail {
  constructor(field, SF, { tiers = [{ lod: 1, to: 12, slots: 60 }, { lod: 1 / 3, to: 28, slots: 260 }, { lod: 1 / 8, to: 60, slots: 1300 }], budget = 2500, glow = 0.12 } = {}) {
    this.field = field; this.SF = SF; this.budget = budget; this.glow = glow;
    const maxHead = Math.max(...SF.heads.map(H => H.list.length));
    this.tiers = tiers.map(T => {
      const every = Math.max(1, Math.round(1 / T.lod)), per = Math.ceil(maxHead / every) + (every > 1 ? 24 : 48);
      const rows = new Rows(T.slots * per); rows.n = rows.cap;
      for (let i = 0; i < rows.cap; i++) rows.meta[i * 4] = HIDDEN;
      const ex = rows.done();
      return { lod: T.lod, to: T.to, slots: T.slots, per, rows, ex, hold: new Int32Array(T.slots).fill(-1), free: Array.from({ length: T.slots }, (_, k) => T.slots - 1 - k), geo: null, attrs: null };
    });
    const n = field.flowers.length;
    this.tier = new Int8Array(n).fill(-1); this.slot = new Int32Array(n).fill(-1); this.want = new Int8Array(n).fill(-1);
    this.dist = new Float32Array(n); this.queue = []; this.last = [1e9, 1e9, 1e9]; this.since = 1e9;
    this.built = 0; this.builtStrokes = 0; this.ms = 0;
  }
  bind(dabGeo, geos) {
    const attrs = g => { const A = g.attributes; const a = [A.iP0, A.iP1, A.iP2, A.iSize, A.iCol, A.iMeta]; for (const x of a) x.setUsage(35048); return a; };
    this.dabAttrs = attrs(dabGeo);
    this.tiers.forEach((T, t) => { T.geo = geos[t]; T.attrs = geos[t] ? attrs(geos[t]) : null; });
  }
  // the far form of flower i shown or hidden
  dab(i, show) {
    const meta = this.dabAttrs[5], R = this.field.dabRev;
    for (let j = 0; j < 3; j++) meta.array[(i * 3 + j) * 4] = show ? R[i * 3 + j] : HIDDEN;
    meta.addUpdateRange(i * 3 * 4, 12); meta.needsUpdate = true;
  }
  release(i) {
    const t = this.tier[i]; if (t < 0) return;
    const T = this.tiers[t], k = this.slot[i], meta = T.rows.meta;
    for (let j = 0; j < T.per; j++) meta[(k * T.per + j) * 4] = HIDDEN;
    if (T.attrs) { T.attrs[5].addUpdateRange(k * T.per * 4, T.per * 4); T.attrs[5].needsUpdate = true; }
    T.hold[k] = -1; T.free.push(k); this.tier[i] = -1; this.slot[i] = -1;
    this.dab(i, true);
  }
  // flower i built into a slot of tier t
  build(i, t) {
    const T = this.tiers[t], F = this.field.flowers[i];
    if (!T.free.length) {
      let far = -1, fd = -1;
      for (let k = 0; k < T.slots; k++) { const j = T.hold[k]; if (j >= 0 && this.want[j] !== t && this.dist[j] > fd) { far = j; fd = this.dist[j]; } }
      if (far < 0) return 0;
      this.release(far);
    }
    if (this.tier[i] >= 0) this.release(i);
    const k = T.free.pop();
    const f = flower(this.SF, F.which, F.dd, rng(F.seed), { rev: F.rev, stem: F.h - F.dd * 0.35, glow: this.glow, lod: T.lod });
    const rows = T.rows, i0 = k * T.per;
    rows.n = i0; placeFlower(rows, f, F);
    for (let j = f.n; j < T.per; j++) rows.meta[(i0 + j) * 4] = HIDDEN;
    if (T.attrs) for (let a = 0; a < 6; a++) { const c = a < 3 ? 3 : 4; T.attrs[a].addUpdateRange(i0 * c, T.per * c); T.attrs[a].needsUpdate = true; }
    T.hold[k] = i; this.tier[i] = t; this.slot[i] = k;
    this.dab(i, false);
    this.built++; this.builtStrokes += f.n;
    return f.n;
  }
  // each frame: plan when the eye has moved a step, then build what is planned, nearest first, within the budget
  update(cam, dt = 0) {
    const t0 = performance.now();
    const moved = Math.hypot(cam.x - this.last[0], cam.y - this.last[1], cam.z - this.last[2]);
    this.since += dt;
    if (moved > 0.5 && this.since > 0.15) this.plan(cam);
    let n = 0;
    while (this.queue.length && n < this.budget) {
      const i = this.queue.shift(), t = this.want[i];
      if (t < 0) { this.release(i); continue; }
      if (this.tier[i] !== t) n += this.build(i, t) || 1;
    }
    this.ms += performance.now() - t0;
    return n;
  }
  plan(cam) {
    const FL = this.field.flowers, tiers = this.tiers, far = tiers[tiers.length - 1].to * 1.15;
    this.last = [cam.x, cam.y, cam.z]; this.since = 0;
    const cand = [];
    for (let i = 0; i < FL.length; i++) {
      const F = FL[i], d = Math.hypot(F.x - cam.x, F.y - cam.y, F.z - cam.z);
      this.dist[i] = d;
      if (d < far) cand.push(i); else if (this.tier[i] >= 0) this.release(i);
      this.want[i] = -1;
    }
    cand.sort((a, b) => this.dist[a] - this.dist[b]);
    const used = tiers.map(() => 0);
    for (const i of cand) {
      const d = this.dist[i], held = this.tier[i];
      let w = -1;
      for (let t = 0; t < tiers.length; t++) if (d < tiers[t].to * (held === t ? 1.15 : 1) && used[t] < tiers[t].slots) { w = t; break; }
      this.want[i] = w;
      if (w >= 0) used[w]++;
    }
    this.queue = cand.filter(i => this.want[i] !== this.tier[i]);
    for (const i of cand) if (this.want[i] < 0 && this.tier[i] >= 0) this.release(i);
  }
  count() { return this.tiers.map(T => T.slots - T.free.length); }
}
