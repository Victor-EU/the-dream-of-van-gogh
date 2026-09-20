// The water (DESIGN 5.2). The floor of the world is water everywhere, and it is not a thing you see: it is a
// colour, near black, with the sky's colour in it, and what you see of it is reflections. Nothing here is
// modelled -- no surface, no normal, no fresnel -- because a reflection in this piece is what it is on his
// canvas: a column of marks lying at height zero, under its light.
//
// Ours, in his hand (Rule 3). The only place in the four canvases where the law of a reflection is written down
// is the Rhone's water, where every gaslight on the far quay throws a column down the river, and tools/columns.py
// measures it: how far a column reaches, how wide it is for that reach, how many marks it holds, how long and how
// wide and how slanted each is, how much paint it carries at each point down its length, and what colour it is
// there -- the red gold going down to green bronze of letter 691. Every one of those is a ratio, so none of them
// needed the Rhone's standpoint, which is D4's to author.
//
// What is ours is the one step his canvas cannot take: where a column stands when the eye moves. His is one eye
// on one bank. A reflection is not a decal; it lies between you and its light and it goes with you. So the reach
// he painted is read as what a reach is -- the near end of a glitter path, where the water would have to tilt
// more than it does to send the light to the eye -- and that gives one number, the slope of his water, which
// puts a column under any light from any eye by the same law that put his under his. The strokes are built once;
// the shader lays them on the water every frame (src/strokes.js, the column mode), because only the shader knows
// where the eye is.
import { rng, lerp, clamp, DEG } from './util.js';

const QS = [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98];

function draw(tbl, u) {
  if (u <= QS[0]) return tbl[0];
  if (u >= QS[QS.length - 1]) return tbl[tbl.length - 1];
  let i = 1;
  while (i < QS.length - 1 && u > QS[i]) i++;
  return lerp(tbl[i - 1], tbl[i], (u - QS[i - 1]) / (QS[i] - QS[i - 1]));
}
// a measured profile down a column, read at a fraction of the way along it
function prof(tbl, t) {
  const x = clamp(t, 0, 1) * tbl.length - 0.5;
  const i = Math.floor(x), k = x - i;
  return lerp(tbl[clamp(i, 0, tbl.length - 1)], tbl[clamp(i + 1, 0, tbl.length - 1)], clamp(k, 0, 1));
}
// a colour at a fraction of the way down, out of his measured bins, with the bins he left empty passed over
function colourAt(bins, edges, t) {
  const good = bins.map((b, i) => b && { b, c: 0.5 * (edges[i] + edges[i + 1]) }).filter(Boolean);
  if (!good.length) return [1, 1, 1];
  let i = 0;
  while (i < good.length - 1 && t > good[i + 1].c) i++;
  const a = good[i], b = good[Math.min(i + 1, good.length - 1)];
  const k = b.c > a.c ? clamp((t - a.c) / (b.c - a.c), 0, 1) : 0;
  return [0, 1, 2].map(j => lerp(a.b.rgb[j], b.b.rgb[j], k));
}

// Every light in the dream that can throw a column: his emissive strokes gathered into the lights they are --
// a star is two hundred strokes and one light -- and every star of ours. What a light is worth is the paint it
// emits, which is its area times its shine times how bright it is.
// A light is a cluster, not a stroke: one of his stars is two hundred marks. They are gathered by the angle they
// subtend at the standpoint they were exploded from, which is the same measure tools/hand.py clusters his stars
// by, because that is where their nearness is a fact about his canvas and not about our depths. With three
// canvases in the air that is three standpoints, one per canvas: his Rhone's gaslights are near each other on
// his own quay's sky and nowhere else, and clustering them from Saint-Remy would make the whole far bank one
// lamp. So each canvas is gathered from its own eye, and ours from the eye ours were laid around.
export function lights({ layers, ours, eye, link = 0.035, min = 0.02, least = 4 }) {
  const out = [];
  // a generator of ours knows its own lights: our stars say which strokes are which star, and nothing is guessed
  const known = (name, ex) => {
    for (const g of ex.groups) {
      let w = 0, c = [0, 0, 0], rgb = [0, 0, 0];
      for (let i = g.from; i < g.from + g.n; i++) {
        const sh = ex.col[i * 4 + 3];
        if (!(sh > 0)) continue;
        const j = i * 3;
        const L = Math.hypot(ex.P[2][j] - ex.P[0][j], ex.P[2][j + 1] - ex.P[0][j + 1], ex.P[2][j + 2] - ex.P[0][j + 2]);
        const col = [ex.col[i * 4], ex.col[i * 4 + 1], ex.col[i * 4 + 2]];
        const lum = 0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2];
        const q = L * ex.size[i * 4] * sh * lum;
        w += q;
        for (let k = 0; k < 3; k++) { c[k] += (0.25 * ex.P[0][j + k] + 0.5 * ex.P[1][j + k] + 0.25 * ex.P[2][j + k]) * q; rgb[k] += col[k] * q; }
      }
      if (w > 0 && c[1] / w >= 2) out.push({ of: name, p: c.map(v => v / w), rgb: rgb.map(v => v / w), strength: w, n: g.n });
    }
  };
  const push = (name, ex, filter, from) => {
    const at = from || eye;
    const pts = [];
    for (let i = 0; i < ex.n; i++) {
      const sh = ex.col[i * 4 + 3];
      if (!(sh > 0) || (filter && !filter(i))) continue;
      const j = i * 3;
      const c = [0, 1, 2].map(k => 0.25 * ex.P[0][j + k] + 0.5 * ex.P[1][j + k] + 0.25 * ex.P[2][j + k]);
      const L = Math.hypot(ex.P[2][j] - ex.P[0][j], ex.P[2][j + 1] - ex.P[0][j + 1], ex.P[2][j + 2] - ex.P[0][j + 2]);
      const rgb = [ex.col[i * 4], ex.col[i * 4 + 1], ex.col[i * 4 + 2]];
      const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      const d = [c[0] - at[0], c[1] - at[1], c[2] - at[2]];
      const dl = Math.hypot(d[0], d[1], d[2]) || 1;
      pts.push({ c, d: d.map(v => v / dl), w: L * ex.size[i * 4] * sh * lum, rgb });
    }
    // single link on a grid of directions: two marks of one light are near each other on the sphere
    const cell = link, grid = new Map();
    const key = p => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
    pts.forEach((p, i) => { const k = key(p.d); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
    const lab = new Int32Array(pts.length).fill(-1);
    let nl = 0;
    for (let i = 0; i < pts.length; i++) {
      if (lab[i] >= 0) continue;
      const id = nl++, stack = [i];
      lab[i] = id;
      while (stack.length) {
        const a = stack.pop(), p = pts[a].d;
        const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell), gz = Math.floor(p[2] / cell);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          for (const b of grid.get(`${gx + dx},${gy + dy},${gz + dz}`) || []) {
            if (lab[b] >= 0) continue;
            const q = pts[b].d;
            if (Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) <= cell) { lab[b] = id; stack.push(b); }
          }
        }
      }
    }
    const acc = Array.from({ length: nl }, () => ({ w: 0, c: [0, 0, 0], rgb: [0, 0, 0], n: 0 }));
    pts.forEach((p, i) => { const a = acc[lab[i]]; a.w += p.w; a.n++;
      for (let k = 0; k < 3; k++) { a.c[k] += p.c[k] * p.w; a.rgb[k] += p.rgb[k] * p.w; } });
    // the faint scatter round a light is not a light: a cluster earns a column by its paint, not its existence
    const top = Math.max(...acc.map(a => a.w), 1e-9);
    for (const a of acc) {
      if (a.w <= min * top || a.n < least) continue;
      const p = a.c.map(v => v / a.w);
      if (p[1] < 2) continue;                       // a light at the water's own level throws nothing
      out.push({ of: name, p, rgb: a.rgb.map(v => v / a.w), strength: a.w, n: a.n });
    }
  };
  for (const l of layers) push(l.slug || 'his', l.ex, null, [l.eye.x, l.eye.y, l.eye.z]);
  for (const o of ours || []) (o.ex.groups ? known : push)(o.name, o.ex);
  const m = out.map(l => l.strength).sort((a, b) => a - b)[out.length >> 1] || 1;
  return out.map(l => ({ ...l, rel: l.strength / m }));
}

export class Water {
  constructor(o) {
    const H = o.hand;
    this.hand = H;
    this.slope = (o.slope ?? H.reach.slope_deg) * DEG;    // his water's tilt, from how far his columns reach
    this.k = Math.tan(2 * this.slope);                    // what the shader puts a column between
    this.widthOverReach = H.shape.width_over_reach;
    this.marks = o.marks ?? H.mark.n_per_column;
    this.wave = o.wave ?? { amp: 0.022, rate: 0.37, side: 0.5 };   // a person's: the slow ripple of 5.5
    this.built = null;
  }
  // The plane's colour, from the sky's (DESIGN 5.2). His water's hue exactly, at his water's share of whatever
  // dark this night's sky stands on: two measurements of his, and the one thing that is ours is which dark.
  colour(ground) {
    const W = this.hand.water, lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const k = (W.lum / W.sky_lum) * lum(ground) / Math.max(lum(W.rgb), 1e-6);
    return W.rgb.map(c => c * k);
  }

  // one column under each light. Nothing here knows where the eye is; every mark is a place on its own column
  // and a size against its own column's width, and src/strokes.js turns that into the world each frame
  makeColumns(ls) {
    const H = this.hand, r = rng(3317), M = H.mark, cap = ls.length * 140;
    const P = [new Float32Array(cap * 3), new Float32Array(cap * 3), new Float32Array(cap * 3)];
    const size = new Float32Array(cap * 4), col = new Float32Array(cap * 4), meta = new Float32Array(cap * 4);
    const light = new Float32Array(cap);          // which light a mark belongs to, so that one column can be looked at
    const lamp = H.lamp.rgb, bins = H.colour.bins, edges = H.colour.edges, pp = H.shape.paint_profile;
    // his column is 1.3 cm wide on his canvas, so his paint stands off it by this fraction of its own width, and
    // a column of ours keeps that as it keeps every other proportion of his
    const Wm = H.shape.width_over_reach * H.reach.mean * H.canvas.H;
    const pmax = Math.max(...pp);
    let n = 0;
    const per = [];
    for (let li = 0; li < ls.length; li++) {
      const L = ls[li];
      // how many marks: his fifty-three for his gaslight, and a brighter light carries more paint than a dimmer
      // one (his ten columns, r = 0.54). How much more is a person's: the square root, and bounded
      const N = Math.round(clamp(this.marks * Math.sqrt(L.rel), 10, 110));
      // his light's colour is what his column's colour was measured under, so a light of another colour throws
      // his column in that colour, channel by channel, and never more than twice his
      const tint = [0, 1, 2].map(k => clamp(L.rgb[k] / Math.max(lamp[k], 1e-4), 0.12, 2.2));
      let made = 0;
      for (let i = 0; i < N && n < cap; i++) {
        // where on the column: his paint is faint at the far end and thick at the near one, so the marks are
        // drawn from his measured profile and not laid evenly
        let t = 0, guard = 0;
        do { t = r(); guard++; } while (r() > prof(pp, t) / pmax && guard < 24);
        const across = (2 * r() - 1) * prof(H.shape.width_profile, t);
        const ang = draw(M.ang_deg, r()) * DEG * (r() < 0.5 ? -1 : 1);
        const o3 = n * 3, o4 = n * 4;
        P[0][o3] = t; P[0][o3 + 1] = across; P[0][o3 + 2] = ang;
        P[1][o3] = L.p[0]; P[1][o3 + 1] = L.p[1]; P[1][o3 + 2] = L.p[2];
        P[2][o3] = draw(M.len_over_width, r()); P[2][o3 + 1] = draw(M.wid_over_width, r()); P[2][o3 + 2] = r() * 6.2832;
        size[o4] = P[2][o3 + 1];                                  // the width, in column widths; the shader scales it
        size[o4 + 1] = draw(M.h_mm, r()) / 1000 / Wm;             // impasto, in column widths, as his paint stands
        size[o4 + 2] = Math.floor(r() * 8) % 8;
        size[o4 + 3] = draw(M.curl_over_width, r());
        const c = colourAt(bins, edges, t);
        for (let k = 0; k < 3; k++) col[o4 + k] = c[k] * tint[k];
        col[o4 + 3] = 0.35 * clamp(Math.sqrt(L.rel), 0.3, 2);     // lit paint: a reflection carries its light
        meta[o4] = r(); meta[o4 + 1] = 1; meta[o4 + 2] = r() * 6.2832; meta[o4 + 3] = (r() - 0.5) * 0.36;
        light[n] = li;
        n++; made++;
      }
      per.push({ of: L.of, n: made, from: n - made, at: L.p.map(v => +v.toFixed(1)), rel: +L.rel.toFixed(2) });
    }
    this.built = { n, P: P.map(p => p.subarray(0, n * 3)), size: size.subarray(0, n * 4),
                   col: col.subarray(0, n * 4), meta: meta.subarray(0, n * 4), light: light.subarray(0, n),
                   column: this.k, lights: per };
    return this.built;
  }

  // The same arithmetic the shader does, in JavaScript, so that the parting test of DESIGN 6.5 can be run over
  // the reflections as it is over every other stroke in the air. It writes the three control points of every
  // mark as they stand from this eye, into the rows the test reads.
  place(ex, cam, time = 0) {
    const k = this.k, A = cam[1], W = this.wave;
    if (!ex._P) ex._P = [new Float32Array(ex.n * 3), new Float32Array(ex.n * 3), new Float32Array(ex.n * 3)];
    if (!ex._size) ex._size = new Float32Array(ex.n * 4);
    const Q = ex._P, S = ex._size;
    for (let i = 0; i < ex.n; i++) {
      const o = i * 3, o4 = i * 4;
      const Lx = ex.P[1][o], Ly = ex.P[1][o + 1], Lz = ex.P[1][o + 2];
      let nx = Lx - cam[0], nz = Lz - cam[2];
      const D = Math.hypot(nx, nz);
      if (!(A > 0.2 && Ly > 0.2 && D > 0.5)) { for (let c = 0; c < 3; c++) for (let j = 0; j < 3; j++) Q[c][o + j] = 1e6; S[o4] = 0; continue; }
      nx /= D; nz /= D;
      const b1 = A + Ly + k * D, c1 = A * D - k * A * Ly, d1 = b1 * b1 - 4 * k * c1;
      let xn = d1 > 0 ? (b1 - Math.sqrt(d1)) / (2 * k) : A * D / (A + Ly);
      const b2 = A + Ly - k * D, c2 = A * D + k * A * Ly;
      const xf = Math.min((-b2 + Math.sqrt(Math.max(b2 * b2 + 4 * k * c2, 0))) / (2 * k), D * 0.999);
      xn = clamp(xn, 0.2, xf);
      const ph = time * W.rate + ex.P[2][o + 2];
      const t = clamp(ex.P[0][o] + W.amp * Math.sin(ph), 0, 1);
      const x = A / Math.tan(lerp(Math.atan(A / xf), Math.atan(A / xn), t));
      const px = cam[0] + nx * x, pz = cam[2] + nz * x;
      const rx = px - cam[0], ry = -cam[1], rz = pz - cam[2];
      const rl = Math.max(Math.hypot(rx, ry, rz), 0.3), hx = rx / rl, hy = ry / rl, hz = rz / rl;
      const angW = this.widthOverReach * (Math.atan(A / xn) - Math.atan(A / xf));
      const stretch = clamp(Math.hypot(x, A) / A, 1, 40);
      const ca = Math.cos(ex.P[0][o + 2]), sa = Math.sin(ex.P[0][o + 2]) * stretch;
      let dx = -nz * ca + nx * sa, dy = 0, dz = nx * ca + nz * sa;
      const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      const dd = dx * hx + dy * hy + dz * hz;
      const fore = Math.max(Math.hypot(dx - hx * dd, dy - hy * dd, dz - hz * dd), 0.06);
      const pd = -nz * hx + nx * hz;
      const foreP = Math.max(Math.hypot(-nz - hx * pd, -hy * pd, nx - hz * pd), 0.06);
      const Lw = ex.P[2][o] * angW * rl / fore;
      const off = (ex.P[0][o + 1] + W.side * W.amp * Math.sin(1.7 * ph)) * 0.5 * angW * rl / foreP;
      const cx = px + -nz * off, cy = 0, cz = pz + nx * off;
      let bx = dy * hz - dz * hy, by = dz * hx - dx * hz, bz = dx * hy - dy * hx;
      const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
      const bw = ex.meta[o4 + 3] * Lw;
      Q[0][o] = cx - dx * 0.5 * Lw; Q[0][o + 1] = cy - dy * 0.5 * Lw; Q[0][o + 2] = cz - dz * 0.5 * Lw;
      Q[2][o] = cx + dx * 0.5 * Lw; Q[2][o + 1] = cy + dy * 0.5 * Lw; Q[2][o + 2] = cz + dz * 0.5 * Lw;
      Q[1][o] = cx + bx * bw; Q[1][o + 1] = cy + by * bw; Q[1][o + 2] = cz + bz * bw;
      S[o4] = ex.P[2][o + 1] * angW * rl; S[o4 + 1] = ex.size[o4 + 1]; S[o4 + 3] = ex.size[o4 + 3] * angW * rl;
    }
    return { n: ex.n, P: Q, size: S, meta: ex.meta };
  }

  // where a column under this light stands from this eye, in metres from the eye along the water: the same
  // arithmetic the shader does, for the harness to check against
  span(eyeP, lightP) {
    const A = eyeP[1], B = lightP[1], k = this.k;
    const D = Math.hypot(lightP[0] - eyeP[0], lightP[2] - eyeP[2]);
    if (!(A > 0.15 && B > 0.15 && D > 0.5)) return null;
    const b1 = A + B + k * D, c1 = A * D - k * A * B, d1 = b1 * b1 - 4 * k * c1;
    let near = d1 > 0 ? (b1 - Math.sqrt(d1)) / (2 * k) : A * D / (A + B);
    const b2 = A + B - k * D, c2 = A * D + k * A * B;
    let far = Math.min((-b2 + Math.sqrt(Math.max(b2 * b2 + 4 * k * c2, 0))) / (2 * k), D * 0.999);
    near = clamp(near, 0.2, far);
    const dirn = [(lightP[0] - eyeP[0]) / D, (lightP[2] - eyeP[2]) / D];
    const at = x => [eyeP[0] + dirn[0] * x, 0, eyeP[2] + dirn[1] * x];
    return { near, far, mirror: D * A / (A + B), D,
             angLen: Math.atan(A / near) - Math.atan(A / far),
             nearP: at(near), farP: at(far), midP: at(0.5 * (near + far)) };
  }
}

// The sea's own paint (DESIGN 5.2, 5.3, BUILD.md D4). D3 left the water bare between the columns and said so;
// this is what his Rhone's water has to say about it. What his hand gives is a mark -- how long it is against
// the spacing round it, how wide, how far off the wave's own line it lies, how much paint it carries, and what
// colour it is at each step of his own eight -- and one number it will not give: his water covers itself two
// and a half times over. A covering is what a canvas is; an unbounded sea cannot be paid for at that price. So
// the density is ours, like the motes' (5.3), and the ledger says so; everything else about a mark is his.
//
// The marks live on one cell that wraps round the eye, as the motes do, at height zero. They lie across the
// wind's drift, because a wave's front does, and because that is what makes his dashes horizontal on a canvas
// painted from a bank: a horizontal line on his canvas is a line of one distance on the water.
// The floor's own paint, in his hand at a density of ours (DESIGN 5.2, 5.3's rule for the motes; D4.5 for the
// shore). His Rhone's water covers itself 2.56 times over and his terrace's pavement 2.27: paint over paint,
// not a sprinkle, and an unbounded floor cannot be paid for at that price. So a surface of ours carries every
// measure of his mark -- its length and width against the spacing round it, how far off the line it lies, its
// bow, its curl, its impasto -- at a coverage that is ours, on a lattice that wraps along the floor.
//
// `rgb` retargets his colour bins without touching their spread, for the one surface where his paint cannot say
// what the place is: the shore's marks come from his terrace's pavement, which is the only ground he painted as
// a surface you stand on, but that whole square is under a lamp and his pavement gets *brighter* with distance
// (1.64 of his sky's brightness at 4 m, 2.80 at 90). What unlit town ground is at night his Starry Night's
// village says, and hand/nights.json measures it. The hand is one painter's; the colour is the place's.
export function makeSea(hand, o = {}) {
  const H = hand, M = H.mark, B = H.colour.bins.filter(Boolean);
  const cell = o.cell ?? 26, cover = o.cover ?? 0.03, at = o.at ?? 15;    // m, a share of the water, and the distance a mark is sized for
  const y0 = o.y ?? 0;
  const r = rng(o.seed ?? 20250920);
  let kc = [1, 1, 1];
  if (o.rgb) {
    const mean = [0, 1, 2].map(k => B.reduce((a, b) => a + b.share * b.rgb[k], 0) / Math.max(1e-9, B.reduce((a, b) => a + b.share, 0)));
    kc = [0, 1, 2].map(k => o.rgb[k] / Math.max(mean[k], 1e-6));
  }
  // a mark's size is his, read at one distance: his spacing is 0.64 cm on a canvas one metre from his eye
  const sp = H.spacing_m / H.canvas.f * at;                               // his spacing, in metres, at `at`
  const area = cell * cell;
  const mLen = draw(M.len_over_spacing, 0.5) * sp, mWid = draw(M.wid_over_spacing, 0.5) * sp;
  const n = Math.max(0, Math.round(cover * area / (mLen * mWid)));
  const P = [new Float32Array(n * 3), new Float32Array(n * 3), new Float32Array(n * 3)];
  const size = new Float32Array(n * 4), col = new Float32Array(n * 4), meta = new Float32Array(n * 4);
  const d0 = o.drift ?? [1, 0];                                           // the wind's drift, on the water
  const dl = Math.hypot(d0[0], d0[1]) || 1, dx = d0[0] / dl, dz = d0[1] / dl;
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * cell, z = (r() - 0.5) * cell;
    const len = draw(M.len_over_spacing, r()) * sp, wid = draw(M.wid_over_spacing, r()) * sp;
    // across the drift, off it by the angle his marks lie off his own horizontal
    const lie = draw(M.lie_deg, r()) * DEG * (r() < 0.5 ? -1 : 1);
    const cw = Math.cos(lie), sw = Math.sin(lie);
    const ax = -dz * cw + dx * sw, az = dx * cw + dz * sw;                 // across the drift, turned by the lie
    const bx = -az, bz = ax;
    const bow = draw(M.bow, r()) * len * (r() < 0.5 ? -1 : 1);
    const o3 = i * 3;
    P[0][o3] = x - ax * len * 0.5; P[0][o3 + 1] = y0; P[0][o3 + 2] = z - az * len * 0.5;
    P[2][o3] = x + ax * len * 0.5; P[2][o3 + 1] = y0; P[2][o3 + 2] = z + az * len * 0.5;
    P[1][o3] = x + bx * bow; P[1][o3 + 1] = y0; P[1][o3 + 2] = z + bz * bow;
    const b = B[Math.min(B.length - 1, Math.floor(r() * B.length))];
    const o4 = i * 4;
    size[o4] = wid;
    size[o4 + 1] = draw(M.h_mm, r()) / 1000 * (sp / H.spacing_m) * 0.001;  // his impasto, at our scale
    size[o4 + 2] = (i * 7) % 8;
    size[o4 + 3] = draw(M.curl_over_spacing, r()) * sp;
    for (let k = 0; k < 3; k++) col[o4 + k] = Math.max(0, (b.rgb[k] + (r() - 0.5) * 2 * b.sd[k]) * kc[k]);
    col[o4 + 3] = 0;
    meta[o4] = r(); meta[o4 + 1] = 1; meta[o4 + 2] = r() * 6.2832; meta[o4 + 3] = 0;
  }
  return { n, P, size, col, meta, cell, cover, at, y: y0, spacing_m: sp,
           len_m: mLen, wid_m: mWid, per_m2: +(n / area).toFixed(4) };
}
