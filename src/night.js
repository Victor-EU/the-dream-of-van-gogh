// One night (DESIGN 5.3 as D4.5 amends it). His three canvases are three nights, measured: the Starry Night's
// sky is (0.086, 0.153, 0.286), the Rhone's (0.034, 0.061, 0.077) and the terrace's (0.010, 0.065, 0.220) --
// a dim green-blue over the river, the ultramarine of *a night without black* over the square, and Saint-Remy's
// two and a half times brighter than either. Until D4.5 our sky was Saint-Remy's everywhere, so it stood +149%
// off his own paint at the Rhone's cone edge and +131% at the terrace's, against the ten per cent D2 holds a
// seam to. Three skies in one sky is three pictures, whatever the ground does.
//
// What is one is the hand. One painter painted all three, and hand/starry-sky.json is the only sky of his with
// strokes enough to generate from, so our sky keeps his hand everywhere and takes only its *colour* and its
// *depth* from the canvas nearest. The weight is a Gaussian on the distance to each of his eyes, at the depth
// his own sky paint stands at there (hand/nights.json), squared so that a standpoint is almost purely its own:
// at Saint-Remy's own sky it is 98.6% his, and between two towns it is a blend with no edge in it. The one
// authored number is that sharpness; everything else is measured.
//
// The floor takes the same field, by D3's rule: the hue is his and the brightness is a ratio against the night
// the place actually stands under. So the water darkens as you fly up the river to the square, because his
// terrace's night is darker than his Saint-Remy's, and it is one change and not a line.
const LUM = [0.2126, 0.7152, 0.0722];
const lum = c => LUM[0] * c[0] + LUM[1] * c[1] + LUM[2] * c[2];

export class Nights {
  constructor(spec, o = {}) {
    this.spec = spec;
    this.sharp = o.sharp ?? 2;                       // authored: how purely a standpoint is its own night
    this.at = spec.nights.map(n => [n.eye.x, n.eye.y, n.eye.z]);
    // which way each canvas looks, in the piece's own convention (src/explode.js): a canvas is evidence about
    // the sky it faces and none at all about the sky behind it, which is what lets the quay and the square be
    // 300 m apart and still disagree. Without this the two Arles nights average into one that is neither
    this.fw = spec.nights.map(n => {
      const y = n.eye.yaw * Math.PI / 180, q = n.eye.pitch * Math.PI / 180;
      return [Math.sin(y) * Math.cos(q), Math.sin(q), -Math.cos(y) * Math.cos(q)];
    });
    this.sig = spec.nights.map(n => n.depth_m[2]);   // his own sky's mean depth, from his canvas
    this.k = spec.nights.map(n => n.over_starry);    // his colour, as a ratio on the one our hand is from
    // and the band of sky each canvas actually paints. Measured, and the whole of what looked like a quarrel:
    // the Rhone's sky is 1.0 to 17.6 degrees above the horizontal and the terrace's 18.8 to 35.2, and the two
    // do not touch. Two canvases painted the same month 300 m apart, whose skies differ by ten times in red,
    // were never asked the same question -- one painted the horizon and the other the top of the sky. All
    // three say the same thing about a night going up: greener and lighter low, a purer and darker blue high.
    // So a canvas speaks for the elevations it painted and falls silent over `shoulder` degrees outside them
    this.el = spec.nights.map(n => n.el_deg);
    this.bands = spec.nights.map(n => n.by_el || []);
    this.shoulder = o.shoulder ?? 6;
    this.behind = o.behind ?? 0.25;   // what a canvas is still worth about the sky behind it
    this.mean = spec.nights[0].rgb;                  // the colour our hand reproduces, which the ratio is on
    this.w = new Float64Array(spec.nights.length);
    this._r = [0, 0, 0]; this._e = new Float64Array(spec.nights.length);
  }
  // the elevation of a place above the horizontal, from his eye: which band of his sky it stands in
  elOf(i, p) {
    const a = this.at[i], dx = p[0] - a[0], dy = p[1] - a[1], dz = p[2] - a[2];
    return Math.asin(dy / (Math.hypot(dx, dy, dz) || 1)) * 57.29578;
  }
  // his own sky's colour at that elevation, out of the bands his canvas measures, flat past its ends
  bandAt(i, el) {
    const B = this.bands[i];
    if (!B.length) return this.spec.nights[i].rgb;
    if (el <= B[0].el) return B[0].rgb;
    const last = B[B.length - 1];
    if (el >= last.el) return last.rgb;
    let k = 0;
    while (k < B.length - 2 && el > B[k + 1].el) k++;
    const t = (el - B[k].el) / (B[k + 1].el - B[k].el);
    return [0, 1, 2].map(j => B[k].rgb[j] + (B[k + 1].rgb[j] - B[k].rgb[j]) * t);
  }
  // how much of each of his nights a point of the world stands in; they sum to one everywhere
  weights(p, out = this.w) {
    let s = 0;
    for (let i = 0; i < this.at.length; i++) {
      const a = this.at[i], f = this.fw[i], R = this.el[i];
      const qx = p[0] - a[0], qy = p[1] - a[1], qz = p[2] - a[2];
      const l = Math.hypot(qx, qy, qz) || 1e-9, d = l / this.sig[i];
      // how near, how nearly in front, and how far into the band of sky this canvas actually painted. A canvas
      // facing away says less, not nothing: west of the square, low in the sky, the square faces you but
      // painted no sky that low and the quay painted it but faces the other way, and with nothing under the
      // floor the three weights all go to zero together and which one wins is arithmetic and not measurement.
      // The floor is the one authored number here, and with it that stretch of sky is the quay's, which is the
      // canvas that painted the horizon
      const ahead = this.behind + (1 - this.behind) * (0.5 + 0.5 * (qx * f[0] + qy * f[1] + qz * f[2]) / l);
      const el = this._e[i] = Math.asin(qy / l) * 57.29578;
      // how far outside the band he painted, as a preference and not a veto. A Gaussian here is a veto: straight
      // up over Saint-Remy is 57 degrees past the top of his own sky, which a Gaussian of six degrees values at
      // e^-89, and the Rhone a kilometre off -- whose band happens to hold that elevation -- wins the zenith of
      // the village with its horizon's colour. Falling off as one over the square keeps a canvas worth about a
      // hundredth of itself that far out, so distance decides and the band only tips it
      const o = (el < R[0] ? R[0] - el : el > R[1] ? el - R[1] : 0) / this.shoulder;
      const v = ahead * Math.exp(-this.sharp * d * d) / (1 + o * o);
      out[i] = v; s += v;
    }
    if (!(s > 0)) { out[0] = 1; s = 1; }             // farther from everything than a double can say: his first
    for (let i = 0; i < out.length; i++) out[i] /= s;
    return out;
  }
  // The colour of the night there, channel by channel, as a ratio on the sky our hand was measured from: each
  // canvas's own colour at the elevation this place stands at in his sky, weighted by how much of that night
  // the place is in. At his own standpoint, in his own band, it is his own paint; between them it is a blend
  // with no edge in it; and up the sky it carries the trend all three of his canvases agree on.
  // `el` overrides the place's own elevation, for the dome and the floor, which are not sky strokes.
  ratio(p, out = this._r, el = null) {
    const w = this.weights(p);
    out[0] = out[1] = out[2] = 0;
    for (let i = 0; i < w.length; i++) {
      if (w[i] < 1e-6) continue;
      const c = this.bandAt(i, el === null ? this._e[i] : el);
      for (let k = 0; k < 3; k++) out[k] += w[i] * c[k] / this.mean[k];
    }
    return out;
  }
  ratioAt(p, el, out = this._r) { return this.ratio(p, out, el); }
  // his sky's own colour there, in the world's units, for a tool to check a standpoint against his canvas
  sky(p) {
    const r = this.ratio(p), s = this.spec.nights[0].rgb;
    return [0, 1, 2].map(k => s[k] * r[k]);
  }
  // how deep his sky paint stands there: near and far, blended the same way, so that our sky meets his at the
  // depth his own is at and the shells of the three overlap instead of leaving a standpoint with a bare sky
  depth(p, out = [0, 0]) {
    const w = this.weights(p);
    out[0] = out[1] = 0;
    for (let i = 0; i < w.length; i++) {
      out[0] += w[i] * this.spec.nights[i].depth_m[0];
      out[1] += w[i] * this.spec.nights[i].depth_m[1];
    }
    return out;
  }
  // The floor's colour, by D3's rule (BUILD.md D3 (2)): his hue exactly, and his brightness as a ratio against
  // the dark this night's sky stands on -- not against his paint. `of` is a measured {rgb, over_sky}.
  floor(of, ground) {
    const k = of.over_sky * lum(ground) / Math.max(lum(of.rgb), 1e-6);
    return of.rgb.map(c => c * k);
  }
}
export { lum };
