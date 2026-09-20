// Our sky, in his hand (DESIGN 4.6, 5.3). Rule 3 of the build: nothing of ours is invented. Every number a stroke
// of ours carries -- its colour, how long and how wide it is, how much it curls, how deep its paint stands, how far
// it lies off the band it is in, and how it bows -- is drawn from hand/starry-sky.json, which tools/hand.py measured
// from the Starry Night's own sky. What is ours is where it stands: outside his cone, at his density, on the shell
// his depth law gives when it is read in elevation, along the wind of 4.7 continued by its curl noise.
//
// Three generators, one draw call each. The sky: his density, 16,562 strokes a steradian, over the sky above the
// water that his canvas does not hold. The stars: few, unnamed, placed where the noise's eddies are not, each a
// core and rings out of the hand of his eleven. The motes: the one generator whose purpose is the sensation and
// not the picture, small marks of sky colour on a lattice that wraps round the eye, so that a swoop has speed in
// it and a glide has none. The ledger names all three.
import { rng, lerp, clamp, smoothstep, noise3 } from './util.js';

// a colour out of a measured paint: its mean, moved mostly along itself by its own spread and a little freely
function paint(mean, sd, r) {
  const z = r.normal() * 0.75;
  return [0, 1, 2].map(k => Math.max(0, mean[k] + sd[k] * (z + r.normal() * 0.55)));
}

const QS = [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98];
const DEG = Math.PI / 180;
const F1 = [31.7, 8.2, 57.4], F2 = [103.4, 61.9, 12.8];   // two fields of the same shape, laid over each other

// a measured quantile table, read back: the inverse of its own distribution, flat past the ends
function draw(tbl, u) {
  if (u <= QS[0]) return tbl[0];
  if (u >= QS[QS.length - 1]) return tbl[tbl.length - 1];
  let i = 1;
  while (i < QS.length - 1 && u > QS[i]) i++;
  return lerp(tbl[i - 1], tbl[i], (u - QS[i - 1]) / (QS[i] - QS[i - 1]));
}
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// where a point of his canvas plane stands against the edge of his cone: how far along that edge, and how far
// outside it. The same walk tools/hand.py takes when it writes down what his sky is doing there
function perim(x, y, A, B, out = [0, 0]) {
  const dx = Math.abs(x) - A, dy = Math.abs(y) - B;
  out[1] = dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
  const P = 4 * (A + B), cy = clamp(y, -B, B), cx = clamp(x, -A, A);
  out[0] = dx > dy ? (x >= 0 ? (cy + B) / P : (2 * B + 2 * A + (B - cy)) / P)
                   : (y >= 0 ? (2 * B + (A - cx)) / P : (4 * B + 2 * A + (cx + A)) / P);
  out[0] -= Math.floor(out[0]);
  return out;
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

class Rows {
  constructor(cap) {
    this.cap = cap; this.n = 0;
    this.P = [new Float32Array(cap * 3), new Float32Array(cap * 3), new Float32Array(cap * 3)];
    this.size = new Float32Array(cap * 4); this.col = new Float32Array(cap * 4); this.meta = new Float32Array(cap * 4);
  }
  rest(i, w, h, curl, rgb, shine, r, d) {
    this.size[i * 4] = w; this.size[i * 4 + 1] = h; this.size[i * 4 + 2] = Math.floor(r() * 8) % 8; this.size[i * 4 + 3] = curl;
    this.col[i * 4] = rgb[0]; this.col[i * 4 + 1] = rgb[1]; this.col[i * 4 + 2] = rgb[2]; this.col[i * 4 + 3] = shine;
    this.meta[i * 4] = r(); this.meta[i * 4 + 1] = 1; this.meta[i * 4 + 2] = r() * 6.2832; this.meta[i * 4 + 3] = d;
  }
  // a stroke: an arc on the sphere of radius d round his eye, as his own are -- three points at one depth,
  // a tangent, a bow off the chord, and the paint it is made of
  put(eye, dir, d, t, bow, L, w, h, curl, rgb, shine, r) {
    if (this.n >= this.cap) return;
    const i = this.n++, n = cross(dir, t);
    const a = [-0.5 * L, 0, 0.5 * L], b = [0, bow * L, 0];
    for (let c = 0; c < 3; c++) {
      const q = norm([dir[0] + (a[c] * t[0] + b[c] * n[0]) / d, dir[1] + (a[c] * t[1] + b[c] * n[1]) / d, dir[2] + (a[c] * t[2] + b[c] * n[2]) / d]);
      for (let k = 0; k < 3; k++) this.P[c][i * 3 + k] = eye[k] + q[k] * d;
    }
    this.rest(i, w, h, curl, rgb, shine, r, d);
  }
  // a mark at a place, not on a ray: the motes, which live on their own lattice
  putAt(c, t, n, bow, L, w, h, curl, rgb, shine, r, d) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    const a = [-0.5 * L, 0, 0.5 * L], b = [0, bow * L, 0];
    for (let k2 = 0; k2 < 3; k2++) for (let k = 0; k < 3; k++) this.P[k2][i * 3 + k] = c[k] + a[k2] * t[k] + b[k2] * n[k];
    this.rest(i, w, h, curl, rgb, shine, r, d);
  }
  done() {
    const n = this.n;
    return { n, P: this.P.map(p => p.subarray(0, n * 3)), size: this.size.subarray(0, n * 4),
             col: this.col.subarray(0, n * 4), meta: this.meta.subarray(0, n * 4) };
  }
}

export class Sky {
  constructor(o) {
    const { hand, star, wind, laws } = o;
    this.hand = hand; this.starHand = star; this.wind = wind;
    this.eye = wind.eye; this.f = hand.canvas.f;
    // the three nights and the three cones (D4.5): one field of ours round each of his eyes, at the depth his
    // own sky stands at there, and the rule that keeps every one of them out of all three cones
    this.nights = o.nights;
    this.night = o.night !== false;   // ?nonight: the hand's own colour everywhere, to measure the field against
    this.cones = o.cones ?? [];
    this.anchors = o.nights.spec.nights.map((n, i) => ({ i, slug: n.slug, at: [n.eye.x, n.eye.y, n.eye.z],
                                                         near: n.depth_m[0], far: n.depth_m[1], mean: n.depth_m[2] }));
    const m0 = this.anchors[0].mean;
    for (const A of this.anchors) { A.lo = 200 * A.mean / m0; A.hi = 1000 * A.mean / m0; }
    this.density = o.density ?? 1;
    this.nStars = o.stars ?? 12;
    this.mote = { n: o.motes ?? 2600, cell: o.cell ?? 60, ref: 30 };
    this.funnel = laws.regions.swirl.law.amp;               // his eddies are tunnels; ours are his law's, 160 m
    this.jitter = laws.regions.sky?.noise ?? laws.noise ?? 0.006;
    this.ceiling = o.ceiling ?? 700;
    this.edge = o.edge ?? 2500;
    this.linenCol = o.linen ?? [0.16, 0.14, 0.10];
    // the paint is banded, not salt and pepper: a noise of the measured size plus a white part of equal weight,
    // which is what his measured structure asks for (0.24 of the scale at half a degree against 0.33 at twenty)
    this.pl = o.paintLam ?? 0.087;
    this.cdf = this._cdf();
    this.built = { sky: null, stars: null, motes: null };
  }
  base(elDeg) {                                            // his depth law, read in elevation (hand.py)
    const c = this.hand.depth.by_elevation, R = this.hand.depth.range_m;
    return clamp(c[0] + c[1] * elDeg + c[2] * elDeg * elDeg, R[0], R[1]);
  }
  // The paint's own field, at the angular size his paint stays itself over. His bands run a little more along the
  // flow than across it (0.226 of the range against 0.252, a degree apart); ours does not, and the log says so
  pnoise(d, o = F1) {
    const s = 1 / this.pl;
    return noise3(d[0] * s + o[0], d[1] * s + o[1], d[2] * s + o[2]);
  }
  _cdf() {                                                 // so that a paint's share of our sky is its share of his
    const r = rng(90210), a = new Float64Array(4096);
    for (let i = 0; i < 4096; i++) {
      const z = 2 * r() - 1, w = 2 * Math.PI * r(), c = Math.sqrt(Math.max(0, 1 - z * z));
      a[i] = (this.pnoise([c * Math.cos(w), z, c * Math.sin(w)]) - 0.5) / 0.19 + (r() - 0.5) / 0.289;
    }
    return a.sort();
  }
  paintAt(d, u, o) {
    const v = (this.pnoise(d, o) - 0.5) / 0.19 + (u - 0.5) / 0.289;
    let lo = 0, hi = this.cdf.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (this.cdf[m] < v) lo = m + 1; else hi = m; }
    return clamp(lo / this.cdf.length, 0, 0.999999);
  }
  // how far into the linen a point is: above the ceiling, or beyond the edge of the dream (DESIGN 5.4)
  linen(p) {
    const h = smoothstep(this.ceiling - 120, this.ceiling, p[1]);
    return Math.max(h, smoothstep(this.edge - 300, this.edge, Math.hypot(p[0], p[2])));
  }
  // ---- our sky -----------------------------------------------------------------------------------------------
  // Our sky, three fields, one night (DESIGN 5.3 as D4.5 amends it). Before D4.5 this was one shell round the
  // Starry Night's eye, and seen from the quay 968 m away seven of twelve compass bins above ten degrees held
  // no sky of ours at all while one held six times his density: a bubble round one standpoint, which is one of
  // the two reasons the three cones read as pictures on a pond. Now there is one field round each of his eyes,
  // at the depth his own sky paint stands at there and in the colour his own night is, each thinned by how much
  // of that night the place stands in (src/night.js). The three weights sum to one, so the three fields sum to
  // his density, 16,562 strokes a steradian, wherever their shells overlap -- and they overlap because the
  // towns are 300 and 968 m apart and his skies are 400 to 600 m deep.
  //
  // The hand is one hand and is his: every measure a stroke carries still comes from hand/starry-sky.json, and
  // so do the two fields of the world a stroke is put into -- the paint's own field and the wind's -- which are
  // read in the direction the stroke stands in from the eye those were measured at, not from the eye that made
  // it. What each field takes from its own canvas is the two things a canvas can say about its night without a
  // hand: how deep his paint stands in it, and what colour it is.
  makeSky() {
    const H = this.hand, w = this.wind, r = rng(4271), E = H.edge, N = this.nights;
    const eyeS = this.eye, AN = this.anchors;
    const per = H.density.per_sr * this.density;
    const M = Math.round(per * 2 * Math.PI);               // candidates over the sky above the shore, per field
    const rows = new Rows(Math.round(M * AN.length * 0.75));
    const t0 = [0, 0, 0], sh = [0, 0, 0], pv = [0, 0, 0];
    for (const A of AN) {
      const kd = A.mean / AN[0].mean;                      // his own sky's depth, against the one our hand is from
      for (let i = 0; i < M; i++) {
        const y = r(), az = 6.2832 * r(), c = Math.sqrt(Math.max(0, 1 - y * y));
        const dir = [c * Math.sin(az), y, -c * Math.cos(az)];
        // where this would stand, so that the fields of the world can be asked what they are doing there. They
        // live on the sphere round the eye his sky was measured at, so they are asked in that direction
        for (let k = 0; k < 3; k++) pv[k] = A.at[k] + dir[k] * A.mean;
        const dv = norm([pv[0] - eyeS[0], pv[1] - eyeS[1], pv[2] - eyeS[2]]);
        let q = this.paintAt(dv, r()), lenK = 1, ec = null, ek = 0;
        const b = H.paints[Math.min(H.paints.length - 1, Math.floor(q * H.paints.length))];
        const el = Math.asin(y) / DEG;
        // the depth: his law in elevation, his funnel where the noise turns hardest, his relief for this paint,
        // and his jitter, so that neighbours are not exactly coplanar -- all of it moved to the depth this
        // canvas's own sky paint stands at, which keeps every angle and changes only how far off it all is
        const psi = Math.abs(w.psi(dv));
        let d = this.base(el) + this.funnel * smoothstep(0.62, 1.05, psi) + b.ddep_mean + draw(b.ddep, r());
        d = clamp(d * (1 + (r() - 0.5) * 2 * this.jitter) * kd, 200 * kd, 1000 * kd);
        const p = [A.at[0] + dir[0] * d, A.at[1] + dir[1] * d, A.at[2] + dir[2] * d];
        if (p[1] < 8) continue;                            // nothing of the sky stands in the water
        if (r() >= this.share(p)) continue;                // this field's share of the sky standing over there
        if (this.inAnyCone(p)) continue;                   // inside a cone there is his painting and nothing else
        if (r() < this.linen(p)) continue;                 // toward the linen the paint goes sparse
        const dS = norm([p[0] - eyeS[0], p[1] - eyeS[1], p[2] - eyeS[2]]);
        w.layDir(dS, t0);
        // at the edge of his cone our sky takes his own value and lets go over the angle his paint takes to
        // forget itself: his corners are darker than his sky's mean and his strokes cover less angle there, and
        // a generator that knows only his averages meets him with a step. The walk is his one measured edge,
        // the Starry Night's, and a stroke of any of the three fields that stands near it takes it
        const pp = w.planeOf(dS, this._pp || (this._pp = [0, 0]));
        const pe = perim(pp[0], pp[1], E.A, E.B, this._pe || (this._pe = [0, 0]));
        if (pe[1] > 0) {
          const bi = Math.min(E.n - 1, Math.floor(pe[0] * E.n));
          if (E.q[bi] !== null) {
            ek = Math.exp(-(pe[1] / this.f) / (E.let_go_deg * DEG));
            q = clamp(q + ek * (E.q[bi] - 0.5), 0, 0.999999);
            lenK = 1 + Math.exp(-(pe[1] / this.f) / (E.let_go_size_deg * DEG)) * (E.len[bi] / E.len_mean - 1);
            ec = E.rgb[bi];
          }
        }
        const b2 = H.paints[Math.min(H.paints.length - 1, Math.floor(q * H.paints.length))];
        // the tangent: the fitted field's direction at this ray, turned by the angle a stroke of his lies off its band
        const ang = draw(b2.off, r()) * DEG, ca = Math.cos(ang), sa = Math.sin(ang);
        const nn = cross(dir, t0);
        for (let k = 0; k < 3; k++) sh[k] = t0[k] * ca + nn[k] * sa;
        const L = draw(b2.len, r()) * lenK * d, wid = draw(b2.wid, r()) * d;
        // his colour on its own three axes: the first is the paint this stroke is, the second a field of its own
        // laid over it, the third -- one per cent of his colour -- the stroke's alone
        const nb = H.paints.length, bi2 = Math.min(nb - 1, Math.floor(q * nb));
        const a1 = draw(b2.a[0], clamp(q * nb - bi2, 0, 1)), a2 = draw(b2.a[1], this.paintAt(dS, r(), F2)), a3 = draw(b2.a[2], r());
        const CM = H.colour.mean, AX = H.colour.axes;
        const rgb = [0, 1, 2].map(k => Math.max(0, CM[k] + a1 * AX[0][k] + a2 * AX[1][k] + a3 * AX[2][k]));
        // and what the paint a stroke is made of cannot say, his edge's own colour does: the last of the step closed
        if (ec) for (let k = 0; k < 3; k++) rgb[k] = Math.max(0, rgb[k] + ek * (ec[k] - b2.rgb[k]));
        // and last, the night it stands in: his own sky's colour there, as a ratio on the sky this hand is from
        if (this.night) { const kn = N.ratio(p); for (let k = 0; k < 3; k++) rgb[k] *= kn[k]; }
        rows.put(A.at, dir, d, norm([sh[0], sh[1], sh[2]]), draw(b2.bow, r()), L, wid,
                 draw(b2.h_mm, r()) / 1000 * d / this.f, draw(b2.curl, r()) * d, rgb, 0, r);
      }
    }
    this.built.sky = rows.done();
    this.built.sky.candidates = M * AN.length;
    return this.built.sky;
  }
  // How much of the sky over a place each field is to lay. This is a question about *how many* and not about
  // *what colour*, and the two must not share a weight: the night's partition (src/night.js) is sharpened by
  // which way a canvas faces and which band of sky it painted, and a field thinned by those would leave a hole
  // that no other field fills, because each field's strokes live on its own shell and not everywhere.
  //
  // What each field would lay here on its own is a number: it scatters its candidates evenly over the sphere
  // of directions from its eye and over the depths his sky paint stands at, so its density at a place falls as
  // the square of the distance to that eye and as the thickness of its own shell, and is nothing outside it.
  // The three are thinned by the same fraction, the largest of those over their sum, so that what they add up
  // to is what the fullest of them would have laid alone -- his density, once. Where one shell reaches, it
  // lays all of it; where Arles' two overlap, and they nearly wholly do at 300 m apart, they halve; and where
  // Saint-Remy's far edge reaches over Arles it is a twentieth as dense there and is thinned away to almost
  // nothing, instead of piling a second sky on the first.
  share(p) {
    let s = 0, top = 0;
    for (const A of this.anchors) {
      const r = Math.hypot(p[0] - A.at[0], p[1] - A.at[1], p[2] - A.at[2]);
      const n = (r >= A.lo && r <= A.hi) ? 1 / ((A.hi - A.lo) * r * r) : 0;
      s += n; if (n > top) top = n;
    }
    return s > 0 ? top / s : 1;
  }
  // Inside a cone there is his painting and nothing else (DESIGN 5.1, D4 (3)). The shader keeps this rule for
  // every stroke in the piece; a generator that also keeps it does not pay for the ones that would be hidden
  inAnyCone(p) {
    for (const k of this.cones) {
      const dx = p[0] - k.at[0], dy = p[1] - k.at[1], dz = p[2] - k.at[2];
      const L = Math.hypot(dx, dy, dz);
      if (L > (k.far ?? 1e9)) continue;                  // past the end of his paint: his cone is over
      const q = [dx / L, dy / L, dz / L];
      const z = q[0] * k.Fw[0] + q[1] * k.Fw[1] + q[2] * k.Fw[2];
      if (z <= 0) continue;
      const cx = (q[0] * k.R[0] + q[1] * k.R[1] + q[2] * k.R[2]) / (k.hw * z);
      const cy = (q[0] * k.U[0] + q[1] * k.U[1] + q[2] * k.U[2]) / (k.hh * z);
      if (Math.abs(cx) >= 1 || Math.abs(cy) >= 1) continue;
      if (!k.depthMap) return true;
      const N = k.depthMap.n;
      const gx = Math.min(N - 1, Math.max(0, Math.floor((0.5 + 0.5 * cx) * N)));
      const gy = Math.min(N - 1, Math.max(0, Math.floor((0.5 - 0.5 * cy) * N)));
      const hisD = k.depthMap.d[gy * N + gx];
      if (hisD > 0 && L > hisD) continue;
      return true;
    }
    return false;
  }
  // ---- our stars ---------------------------------------------------------------------------------------------
  makeStars() {
    const S = this.starHand, w = this.wind, r = rng(881), N = this.nights, AN = this.anchors;
    const rows = new Rows(this.nStars * 400);
    const placed = [], ranges = [];
    let guard = 0;
    // over the whole night and not over one standpoint: each star belongs to one of his skies in turn, at that
    // sky's own depth, and two stars of ours stand at least 150 m apart in the world rather than 22 degrees
    // apart at one eye -- which is the same rule once there is more than one place to stand
    while (placed.length < this.nStars && guard++ < 20000) {
      const A = AN[placed.length % AN.length], eye = A.at, kd = A.mean / AN[0].mean;
      const y = 0.08 + 0.85 * r(), az = 6.2832 * r(), c = Math.sqrt(Math.max(0, 1 - y * y));
      const dir = [c * Math.sin(az), y, -c * Math.cos(az)];
      const d = 0.9 * this.base(Math.asin(y) / DEG) * kd;   // his stars stand a little in front of the sky (depth/starry.json)
      const at = [eye[0] + dir[0] * d, eye[1] + dir[1] * d, eye[2] + dir[2] * d];
      const dS = norm([at[0] - this.eye[0], at[1] - this.eye[1], at[2] - this.eye[2]]);
      if (this.inAnyCone(at)) continue;
      if (Math.abs(w.psi(dS)) > 0.35) continue;             // where the wind's eddies are not (DESIGN 5.3)
      if (placed.some(q => Math.hypot(q.at[0] - at[0], q.at[1] - at[1], q.at[2] - at[2]) < 150)) continue;
      placed.push({ dir, at, of: A.slug });
      const from = rows.n;
      const R = draw(S.per_star.radius_rad, r());
      const n = Math.round(draw(S.per_star.strokes, r()));
      const kn = N.ratio(at);
      const fr = w.frame(dir);
      for (let i = 0; i < n; i++) {
        let u = r(), k = 0, acc = 0;
        for (; k < S.rings.length - 1; k++) { acc += S.rings[k].share; if (u < acc) break; }
        const ring = S.rings[k];
        const rad = R * lerp(ring.r[0], ring.r[1], r()), th = 6.2832 * r();
        const ct = Math.cos(th), st = Math.sin(th);
        const out = [0, 1, 2].map(j => fr.Rp[j] * ct + fr.Up[j] * st);         // the way out from the star's middle
        const sd = norm([0, 1, 2].map(j => dir[j] * Math.cos(rad) + out[j] * Math.sin(rad)));
        const tang = norm(cross(sd, out));                                     // round the star, which is where his lie
        const a = draw(ring.off_tangent_deg, r()) * DEG * (r() < 0.5 ? -1 : 1);
        const nn = cross(sd, tang);
        const t = norm([0, 1, 2].map(j => tang[j] * Math.cos(a) + nn[j] * Math.sin(a)));
        const rgb = paint(ring.rgb, ring.sd, r).map((v, k) => v * kn[k]);
        rows.put(eye, sd, d, t, (r() - 0.5) * 0.5, draw(ring.len, r()) * d, draw(ring.wid, r()) * d,
                 draw(ring.h_mm, r()) / 1000 * d / this.f, draw(ring.curl, r()) * d, rgb, ring.shine, r);
      }
      ranges.push({ from, n: rows.n - from, dir, at, of: A.slug });
    }
    this.built.stars = rows.done();
    this.built.stars.places = placed;
    this.built.stars.groups = ranges;
    return this.built.stars;
  }
  // ---- the motes ---------------------------------------------------------------------------------------------
  // On a lattice one cell wide that wraps round the eye in the shader, so that a handful of thousands is a field
  // without end. The one generator whose purpose is the sensation; the ledger says so.
  makeMotes() {
    const S = this.hand.small, r = rng(5150), L = this.mote.cell, D = this.mote.ref;
    const rows = new Rows(this.mote.n);
    for (let i = 0; i < this.mote.n; i++) {
      const c = [r() * L, r() * L, r() * L];
      const z = 2 * r() - 1, az = 6.2832 * r(), s = Math.sqrt(Math.max(0, 1 - z * z));
      const dir = [s * Math.cos(az), z, s * Math.sin(az)];
      const t = norm(cross(dir, [0.31, 0.83, -0.47]));
      const len = draw(S.len, r()) * D, wid = draw(S.wid, r()) * D;
      const rgb = paint(S.rgb, S.sd, r);
      rows.putAt(c, t, norm(cross(dir, t)), (r() - 0.5) * 0.4, len, wid,
                 draw(S.h_mm, r()) / 1000 * D / this.f, draw(S.curl, r()) * D, rgb, 0, r, D);
    }
    this.built.motes = rows.done();
    this.built.motes.cell = L;
    return this.built.motes;
  }
}
