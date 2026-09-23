// The film (E2): the dream flies you. The author's word: *design an auto fly mode -- when the user sets it, it's like
// a movie, and the user should have an immersive experience, like he or she is in Van Gogh's dream.*
//
// So `Space` is a film, and the film is one take, because a dream does not cut and this is one world. It leaves his
// eye on the knoll, goes down the slope into the sunflowers and along a row of them to the village, up the street
// between the lit windows, up the spire, falls from it to the river, runs low over the water and the stars in it to
// the moon's gold, rises out of the moon in the water in a wide turning climb -- the whole valley wheeling once under
// the eye -- glides west under the great swirl with the eye up on it, and turns into the morning star's well and
// goes down through its rings to its core. There the light takes the frame, and in the light you are on the knoll
// again, before sunrise, and the world paints itself in round you as it did at the opening. It goes round until you
// take the controls back.
//
// What makes it a film and not a ride. (1) The way is a spline through composed places, and the timing is its own:
// each place says how fast the body is going there, and the clock is the integral, so a place can be lingered at
// without its neighbours knowing. (2) The eye is not the way: each place says what the eye looks at -- a point, a
// direction in the sky, or the way ahead -- and the gaze eases from one to the next. (3) The body banks into its
// turns a little, as a bird does, and breathes; the lens widens with speed. (4) The world's clock is the film's to
// bend: held nearly still at the top of the spire, where the loose sunflowers hang, and hurried in the sky, where the
// swirls and the rings turn three times as fast. (5) His words, in the black band under the picture: three of the
// lines the piece already quotes, and none down the star's well. It is silent, as the piece is (D5).
//
// Everything here is a function of the film's time, so any frame can be had by asking for it (`dream.film.seek`) and
// the loop is exact. What is not is yours: the eye, which a drag turns while the dream carries the body and which
// goes back to the film's when you let go, and a glance it makes at a loose sunflower passing close (main.js).
import { ground, STARS, MOON, VORTICES, SKY_R } from './world.js';
import { clamp, lerp, DEG, dirAzEl, norm3 } from './util.js';

export const WAKE = 7.5;                  // the film's first seconds: the light lifts and the world paints itself in
export const BLAZE = 5;                   // its last on the way: the star's light takes the frame
const HOLD = 1.2;                         // and holds it, all light, before the knoll
const G = 9.81, BANK = 7 * DEG;           // the bank: a bird's, into the turn, and never more than seven degrees
const smoother = u => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const nlerp = (a, b, u) => norm3(mix(a, b, u));
const GRADE = ['warm', 'sat', 'bloom', 'exposure', 'vignette'];

// His words: only lines the piece already quotes -- letter 777 is the opening's caption (main.js), the other two
// are checked against the edition in letters/letters.json (DESIGN 9: vangoghletters.org, CC BY-NC-SA 4.0). Letter
// 638's, the piece's own line, came down the star's well until E2.2, and the author took it out
export const LINES = {
  777: { text: 'This morning I saw the countryside from my window a long time before sunrise, with nothing but the morning star, which looked very big.', by: 'to Theo · Saint-Rémy, June 1889' },
  678: { text: 'Now there’s a painting of night without black.', by: 'to Wil · Arles, September 1888' },
  691: { text: '…the starry sky at last, actually painted at night, under a gas-lamp.', by: 'to Theo · Arles, September 1888' },
};

// The places. Each says where the body passes (p), how fast it is going there (v, m/s), what the eye looks at
// (look), the lens (fov, the horizontal field of view, 70 the piece's own), the world's clock (time, 1 the piece's
// own), the grade's offsets (grade), whether the eye may be caught by a loose sunflower passing close (glance), how
// far the paint parts for the body (part, m, 3 the piece's own), and a line of his to put under the picture when
// the body passes it (title). `turn` on a place makes the eye turn to it over only that part of the way from the
// place before. E is the knoll's eye; plot is the field's.
export function script(E, plot) {
  const over = (x, z, h) => [x, ground(x, z) + h, z];
  const well = S => { const C = dirAzEl(S.az, S.el).map(c => c * SKY_R), b = norm3(sub(C, E)); return { C, b, at: s => add(E, b, s) }; };
  const moon = well(MOON), star = well(STARS[0]);
  const swirl = dirAzEl(VORTICES[0].az, VORTICES[0].el);
  const sky = (az, el) => ({ dir: dirAzEl(az, el) }), at = p => ({ at: p });
  const ahead = (m, up = 0, level = false) => ({ ahead: m, up, level });
  // the gap between two of the field's rows that runs from his eye to the village: makeField plants a row every
  // 2 m across the plot, at 2r - 69 m off its middle line, so the line 30 m to the west of it is a gap, a metre from
  // the flowers on either hand. The body goes along it a little over the heads, which stand 2.1 to 3.5 m: among them
  // the frame was stems, and over them it is the field, the village and his sky
  const cy = Math.cos(plot.yaw), sy = Math.sin(plot.yaw), u0 = -30;
  const row = (v, h) => over(plot.centre[0] + u0 * cy + v * sy, plot.centre[1] - u0 * sy + v * cy, h);
  // the climb out of the moon in the water: a wide turning rise, clockwise seen from above, from heading east over the
  // moon's gold to heading west-north-west 220 m up. The eye lifts from the water to the moon and stays on it over the
  // shoulder as the turn takes the body away, comes round by the eastern hills, and then goes along the turn a little
  // up, so that the river, the hills, the knoll, the field and the village go round under it once and his sky over it
  // -- from above, at night, the ground is dark, and a frame of it is a map
  const helix = [];
  {
    const R = 120, C = [405, -365 + R], th1 = 210, n = 7;
    for (let i = 1; i <= n; i++) {
      const u = i / n, th = th1 * u * DEG;
      helix.push({ p: [C[0] + R * Math.sin(th), 1.6 + 220 * Math.pow(u, 1.3), C[1] - R * Math.cos(th)], v: lerp(18, 44, Math.pow(u, 1.4)),
                   look: i === 1 ? at(moon.C) : i === 2 ? sky(118, 14) : ahead(60, i < n ? 4 : 6, true), time: lerp(1, 1.5, u),
                   grade: { warm: -0.2, sat: 0.04 }, ...(i === 1 ? { name: 'the climb' } : {}) });
    }
  }
  // the glide: west-north-west over the valley, level, with the great swirl turning above on the right and the eye on
  // it; then a wide turn to the right onto the morning star's well, which the glide's line meets 660 m from his eye
  const g0 = helix[helix.length - 1].p, gd = dirAzEl(-60, 0), glide = d => add(g0, [gd[0] * d, 0.035 * d, gd[2] * d]);
  const swirlEye = at(swirl.map(c => c * 2200));
  return [
    // I. The knoll. The light lifts on his eye and the world paints itself in; then the body leaves it, down the slope
    { name: 'the knoll', p: [0, E[1], E[2] + 1.5], v: 0.5, look: sky(0, 9), fov: 62, title: { id: 777, delay: 2.5, dur: 12 } },
    { p: [-0.6, E[1] - 0.4, E[2] - 7], v: 2.2, look: sky(-1, 6), fov: 64, glance: 1 },
    { name: 'down the knoll', p: row(70, 5.2), v: 4, look: ahead(30, -7, true), fov: 66, glance: 0.6, part: 2.2, grade: { warm: 0.2 } },
    // II. The sunflowers: along the gap between two rows, just over the heads, the village and the spire ahead. The
    // paint parts for the body by less here, so that the flowers either side bow and are not torn
    { name: 'the sunflowers', p: row(56, 4.1), v: 4.4, look: ahead(30, -7, true), fov: 68, time: 0.8, part: 1.8, grade: { warm: 0.35, sat: 0.1 } },
    { p: row(18, 4.2), v: 5, look: ahead(30, -6, true), fov: 70, time: 0.8, part: 1.8, grade: { warm: 0.35, sat: 0.1 } },
    { p: row(-22, 4.2), v: 5.5, look: ahead(34, -4, true), time: 0.85, part: 1.8, grade: { warm: 0.3, sat: 0.08 } },
    { name: 'out of the field', p: row(-54, 4.6), v: 6, look: ahead(40, 1, true), part: 2.4, grade: { warm: 0.3 } },
    // III. The village: up the street between the lit windows, and up the spire, where the clock nearly stops
    { name: 'the street', p: over(-1, -92, 4), v: 6.5, look: at([-1, 7, -300]), title: { id: 678, delay: 2, dur: 8 }, grade: { warm: 0.6, exposure: 0.03 } },
    { p: over(-1, -128, 4), v: 6.2, look: ahead(35, 3), grade: { warm: 0.6, exposure: 0.03 } },
    { name: 'the church', p: over(-3, -150, 5), v: 4, look: at([-16.5, 16, -160]), grade: { warm: 0.5 } },
    { name: 'up the spire', p: [-6.5, 27, -158], v: 3.6, look: at([-16.5, 36, -160]), time: 0.55, glance: 1, grade: { warm: 0.3 } },
    { p: [-7.8, 44, -161], v: 2.6, look: at([-16.5, 47.5, -160]), time: 0.4, glance: 1, grade: { warm: 0.2, bloom: 0.1 } },
    { name: 'the top of the spire', p: [-9.5, 57, -166], v: 1.6, look: sky(-6, 26), fov: 72, time: 0.3, glance: 1, turn: [0.1, 1], grade: { bloom: 0.2 } },
    // IV. The fall, and the water: down over the roofs to the river, the eye on the far bank and the sky over it,
    // and along the river low over the stars in it to the moon's
    { name: 'the fall', p: [-16, 48, -206], v: 8, look: at([-50, 70, -430]), time: 0.8, turn: [0, 0.7] },
    // at the foot of the fall the way ahead is down, to the water, and the eye on it looked eleven degrees down into
    // the far bank for two seconds -- the ground there lies turned to the knoll, and from twenty metres over the river
    // it is dark. So it stays up, the horizon on the lower third, on the hills and his sky over the far bank; it
    // comes down to the water only as the body does, and leads the body round into the river's turn (E2.1)
    { p: [-33, 14, -290], v: 16, look: ahead(90, 6, true) },
    { name: 'the river', p: [-40, 1.3, -333], v: 18, look: ahead(80, 1), title: { id: 691, delay: 1.5, dur: 8.5 }, grade: { warm: -0.3, sat: 0.05 } },
    { p: [100, 1.2, -349], v: 20, look: ahead(90, 3), grade: { warm: -0.3, sat: 0.05 } },
    { p: [255, 1.2, -369], v: 20, look: at([411, -1, -357]), grade: { warm: -0.2, sat: 0.05 } },
    { name: 'the moon in the water', p: [405, 1.6, -365], v: 18, look: at(add(moon.at(900), [0, -120, 0])), turn: [0.3, 1], grade: { warm: -0.2, sat: 0.05 } },
    // V. The climb, the glide under the great swirl, and the morning star's well, down through its rings to its core
    ...helix,
    { name: 'the glide', p: glide(240), v: 52, look: swirlEye, time: 1.8, turn: [0, 0.6], grade: { bloom: 0.15 } },
    { p: glide(470), v: 58, look: swirlEye, time: 2, grade: { bloom: 0.2 } },
    { name: 'the morning star', p: star.at(760), v: 60, look: at(star.C), time: 2.4, turn: [0.15, 1], grade: { bloom: 0.3 } },
    // down the well the lens opens, so that its rings, each wider than the one before it, pass through the frame
    // and out of it one by one and do not all go out of it at once and leave the core alone in the dark. And the
    // body does not slow for the core: the last ring is out of the frame's corners 190 m short of the blaze, and
    // coming in at 20 m/s and slowing to 7 the core hung alone in the blue for eight seconds before the light came.
    // Now it keeps the rings' pace, and the light is rising as the last ring goes out of the corners (E2.1)
    { p: star.at(1000), v: 52, look: at(star.C), fov: 74, time: 2.8, grade: { bloom: 0.35 } },
    { p: star.at(1220), v: 44, look: at(star.C), fov: 82, time: 3, grade: { bloom: 0.4 } },
    { p: star.at(1370), v: 38, look: at(star.C), fov: 90, time: 3.2, grade: { bloom: 0.5 } },
    { name: 'the blaze', p: star.at(1468), v: 26, look: at(star.C), fov: 94, time: 3.2, grade: { bloom: 0.5 } },
  ];
}

// centripetal Catmull-Rom (Barry and Goldman's form): through p1 and p2, bent by p0 and p3, and never a loop or a cusp
function segment(p0, p1, p2, p3) {
  const k = (a, b) => Math.sqrt(Math.max(len(sub(b, a)), 1e-6));
  const t1 = k(p0, p1), t2 = t1 + k(p1, p2), t3 = t2 + k(p2, p3);
  return u => {
    const t = t1 + (t2 - t1) * u;
    const A1 = mix(p0, p1, t / t1), A2 = mix(p1, p2, (t - t1) / (t2 - t1)), A3 = mix(p2, p3, (t - t2) / (t3 - t2));
    return mix(mix(A1, A2, t / t2), mix(A2, A3, (t - t1) / (t3 - t1)), (t - t1) / (t2 - t1));
  };
}
// the least distance from a point to a box turned by yaw about the vertical (a house as world.js builds it)
function boxDist(p, B) {
  const c = Math.cos(B.yaw), s = Math.sin(B.yaw), dx = p[0] - B.x, dz = p[2] - B.z;
  const a = dx * c + dz * s, b = -dx * s + dz * c;
  return Math.hypot(Math.max(0, Math.abs(a) - B.hw), Math.max(0, Math.abs(b) - B.hd), Math.max(0, B.y0 - p[1], p[1] - B.y1));
}

export class Film {
  constructor(keys, { calm = false } = {}) {
    this.keys = keys; this.calm = calm;
    const n = keys.length, P = keys.map(K => K.p);
    for (const K of keys) if (K.look.dir) K.look.dir = norm3(K.look.dir);
    this.names = []; for (let k = 0, nm = keys[0].name; k < n; k++) this.names.push(nm = keys[k].name || nm);
    const ext = [add(P[0], sub(P[0], P[1])), ...P, add(P[n - 1], sub(P[n - 1], P[n - 2]))];
    this.seg = [];
    for (let i = 0; i + 1 < n; i++) this.seg.push(segment(ext[i], ext[i + 1], ext[i + 2], ext[i + 3]));
    // the way, sampled: the arc length at each sample, and each place's; then the clock, the integral of the way
    // over the speed, which each place sets and which eases from one place's to the next's
    const M = 200, N = (n - 1) * M + 1;
    this.su = new Float64Array(N); this.ss = new Float64Array(N); this.st = new Float64Array(N); this.S = new Float64Array(n);
    let s = 0, prev = P[0];
    for (let j = 0; j < N; j++) {
      const U = j / M, q = this.point(U);
      s += len(sub(q, prev)); prev = q;
      this.su[j] = U; this.ss[j] = s;
      if (j % M === 0) this.S[j / M] = s;
    }
    this.L = s;
    let t = 0;
    for (let j = 1; j < N; j++) {
      t += (this.ss[j] - this.ss[j - 1]) / Math.max(0.05, 0.5 * (this.vAt(this.ss[j - 1]) + this.vAt(this.ss[j])));
      this.st[j] = t;
    }
    this.Tp = t; this.T = t + HOLD; this.Tb = t - BLAZE;
    this.TK = keys.map((_, k) => this.interp(this.ss, this.st, this.S[k]));
    this.titles = keys.flatMap((K, k) => K.title ? [{ id: K.title.id, t0: this.TK[k] + (K.title.delay || 0), t1: this.TK[k] + (K.title.delay || 0) + (K.title.dur || 8) }] : []);
  }
  // the spline at U, a place's index and the fraction of the way to the next
  point(U) { const i = Math.min(this.seg.length - 1, Math.floor(U)); return this.seg[i](U - i); }
  // the last sample at or before x in a rising table, and a value of another table there
  find(tab, x) {
    let lo = 0, hi = tab.length - 1;
    if (x <= tab[0]) return 0;
    if (x >= tab[hi]) return hi - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tab[m] <= x) lo = m; else hi = m; }
    return lo;
  }
  interp(tx, ty, x) { const j = this.find(tx, x), a = tx[j], b = tx[j + 1], f = b > a ? clamp((x - a) / (b - a), 0, 1) : 0; return ty[j] + (ty[j + 1] - ty[j]) * f; }
  pos(t) { return this.point(this.interp(this.st, this.su, clamp(t, 0, this.Tp))); }
  posAtS(s) { return this.point(this.interp(this.ss, this.su, clamp(s, 0, this.L))); }
  keyAt(s) { const k = this.find(this.S, s); return Math.min(k, this.keys.length - 2); }
  vAt(s) { const k = this.keyAt(s), w = (s - this.S[k]) / (this.S[k + 1] - this.S[k]); return lerp(this.keys[k].v, this.keys[k + 1].v, smoother(w)); }
  // where a place has the eye look, from p, s along the way
  look(K, p, s) {
    const L = K.look;
    if (L.dir) return L.dir;
    if (L.at) return norm3(sub(L.at, p));
    let d = sub(this.posAtS(s + L.ahead), p);
    if (len(d) < 0.5) d = sub(p, this.posAtS(s - 1));
    if (L.level) d[1] = 0;
    d = norm3(d);
    if (L.up) {
      const h = Math.hypot(d[0], d[2]) || 1, el = Math.asin(clamp(d[1], -1, 1)) + L.up * DEG, c = Math.cos(el);
      d = [d[0] / h * c, Math.sin(el), d[2] / h * c];
    }
    return d;
  }
  // where the places have the eye look at time t, eased from one place's to the next's
  lookAt(t) {
    const tp = clamp(t, 0, this.Tp), s = this.interp(this.st, this.ss, tp), p = this.pos(tp);
    const k = this.keyAt(s), A = this.keys[k], B = this.keys[k + 1];
    const w = clamp((s - this.S[k]) / (this.S[k + 1] - this.S[k]), 0, 1);
    const tw = B.turn ? clamp((w - B.turn[0]) / (B.turn[1] - B.turn[0]), 0, 1) : w;
    return nlerp(this.look(A, p, s), this.look(B, p, s), smoother(tw));
  }
  // the film at time t: the body, the eye, the lens, the clock, the grade, the light, the paint, and the line
  at(t) {
    const T = clamp(t, 0, this.T), tp = Math.min(T, this.Tp);
    const s = this.interp(this.st, this.ss, tp), raw = this.pos(tp);
    const k = this.keyAt(s), A = this.keys[k], B = this.keys[k + 1];
    const e = smoother((s - this.S[k]) / (this.S[k + 1] - this.S[k]));
    // the eye: the places' look, as a hand on a camera would follow it -- over a second and a half either side, so
    // that it does not stop at each place and hurry to the next
    let dir = [0, 0, 0];
    for (let j = -4; j <= 4; j++) { const q = this.lookAt(tp + 0.35 * j), g = Math.exp(-0.125 * j * j); dir = add(dir, q, g); }
    dir = norm3(dir);
    // the body: its velocity, and the pull of its turn over a second, for the bank
    const vel = sub(this.pos(tp + 0.05), this.pos(tp - 0.05)).map(c => c * 10), speed = len(vel);
    const acc = add(add(this.pos(tp + 0.6), raw, -2), this.pos(tp - 0.6)).map(c => c / 0.36);
    let roll = 0;
    const hs = Math.hypot(vel[0], vel[2]);
    if (hs > 0.5 && !this.calm) {
      const r = [-vel[2] / hs, vel[0] / hs], lat = acc[0] * r[0] + acc[2] * r[1];
      const along = Math.max(0, (dir[0] * vel[0] + dir[2] * vel[2]) / (hs * (Math.hypot(dir[0], dir[2]) || 1)));
      roll = -clamp(Math.atan2(lat, G) * 0.8, -BANK, BANK) * along;
    }
    // it breathes: a few centimetres and a tenth of a degree, slow, never the same twice in a minute
    const b = this.calm ? 0 : 1;
    const p = add(raw, [0.07 * Math.sin(0.37 * T + 1.3) + 0.03 * Math.sin(1.13 * T), 0.06 * Math.sin(0.29 * T + 0.2) + 0.025 * Math.sin(0.83 * T + 2.1),
                        0.07 * Math.sin(0.31 * T + 4.0) + 0.03 * Math.sin(1.07 * T + 0.7)], b);
    const gy = ground(p[0], p[2]) + 1.5;                       // never under the ground, whatever the spline does between two places
    if (p[1] < gy) p[1] = gy;                                  // (the audit says it does not)
    const yaw = Math.atan2(dir[0], -dir[2]) + b * 0.0022 * Math.sin(0.23 * T + 0.5);
    const pitch = Math.asin(clamp(dir[1], -1, 1)) + b * 0.0018 * Math.sin(0.19 * T + 1.9);
    const hfov = lerp(A.fov ?? 70, B.fov ?? 70, e) + (this.calm ? 0 : 12 * smoother((speed - 14) / 76));
    // the light: at the start it lifts off the knoll while the world paints itself in; at the end the star's comes
    let fade = 0, reveal = 1.1;
    if (T < WAKE) { fade = 1 - smoother(T / 3.2); reveal = clamp((T - 0.4) / 6, 0, 1.1); }
    if (T > this.Tb) fade = smoother((T - this.Tb) / BLAZE);
    const blaze = smoother((T - this.Tb + 3.5) / (BLAZE + 2));   // from a second before the last ring goes
    const grade = {};
    for (const g of GRADE) grade[g] = lerp(A.grade?.[g] || 0, B.grade?.[g] || 0, e);
    grade.exposure += 1.1 * blaze; grade.bloom += 1.8 * blaze;
    const title = this.titles.find(L => T >= L.t0 && T < L.t1);
    return { t: T, s, p, dir, yaw, pitch, roll, hfov, vel, speed, time: lerp(A.time ?? 1, B.time ?? 1, e), grade, part: lerp(A.part ?? 3, B.part ?? 3, e),
             glance: lerp(A.glance || 0, B.glance || 0, e), fade, reveal, shot: this.names[k], key: k, title: title ? title.id : null };
  }
  shots() { return this.keys.flatMap((K, k) => K.name ? [{ name: K.name, t: +this.TK[k].toFixed(1), s: Math.round(this.S[k]) }] : []); }
  // The audit, for the log: the whole film sampled, and the least room it leaves -- over the ground, from each house
  // and the church, from the cypresses -- with the fastest, the hardest turn of the eye, the most bank and the most
  // pull, each with when and in which shot
  audit({ boxes = [], trunks = [] } = {}, step = 0.05) {
    const worst = { ground: [1e9], house: [1e9], cypress: [1e9], speed: [0], turn: [0], bank: [0], pull: [0], far: [0] };
    const note = (key, v, t, F, more = true) => { if (more ? v > worst[key][0] : v < worst[key][0]) worst[key] = [+v.toFixed(2), +t.toFixed(2), F.shot]; };
    let last = null;
    for (let t = 0; t <= this.T; t += step) {
      const F = this.at(t), p = F.p;
      note('ground', p[1] - ground(p[0], p[2]), t, F, false);
      for (const B of boxes) note('house', boxDist(p, B), t, F, false);
      for (const C of trunks) {
        const u = clamp((p[1] - C.y0) / C.h, 0, 1), r = C.base * 1.42 * Math.pow(1 - u, 0.55) + 0.25;
        note('cypress', Math.hypot(Math.max(0, Math.hypot(p[0] - C.x, p[2] - C.z) - r), Math.max(0, p[1] - C.y0 - C.h)), t, F, false);
      }
      note('speed', F.speed, t, F);
      note('bank', Math.abs(F.roll) / DEG, t, F);
      note('far', len(p), t, F);
      if (last) note('turn', Math.acos(clamp(F.dir[0] * last[0] + F.dir[1] * last[1] + F.dir[2] * last[2], -1, 1)) / DEG / step, t, F);
      const a = add(add(this.pos(t + step), this.pos(t - step)), this.pos(t), -2);
      if (t > step && t < this.Tp - step) note('pull', len(a) / (step * step), t, F);
      last = F.dir;
    }
    return { T: +this.T.toFixed(1), L: Math.round(this.L), shots: this.shots(), worst };
  }
}
