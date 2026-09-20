// Sunflowers (BUILD.md D5.5, on the author's word: *we should add some random sunflowers*). His heads, from his
// own Sunflowers record -- the Van Gogh Museum's canvas, s0031V1962, extracted by the sibling's pipeline and copied
// whole -- cut out by eight circles a person drew on its flat rendering, and stood on the shore round his village,
// each at the size of a sunflower. The strokes are his in every measure: their arcs, colours, widths, impasto and
// curl are the record's, scaled as DESIGN 3.1 scales everything, by one number. What is ours is where each stands,
// which way it faces, and a stem: one straight ribbon in the mean colour and width of his own stem strokes. The
// ledger calls the placing ours, and ?ledger tints it.
import { loadRecord } from './records.js';
import { rng } from './util.js';

// the eight heads, as circles on the canvas: u across, v down (fractions of the width and the height), r as a
// fraction of the width. Drawn by hand on strokes/sunflowers-canvas-flat.png and checked there
export const HEADS = [[0.16, 0.33, 0.10], [0.55, 0.38, 0.11], [0.41, 0.31, 0.09], [0.62, 0.15, 0.11],
                      [0.80, 0.49, 0.10], [0.91, 0.32, 0.09], [0.50, 0.58, 0.10], [0.21, 0.70, 0.09]];

export async function makeFlowers(o) {
  const rec = await loadRecord('strokes/sunflowers-canvas.bin');
  const Hm = rec.cm[1] / 100, Wm = Hm * rec.px[0] / rec.px[1], short = Math.min(Wm, Hm), asp = Hm / Wm;
  // his strokes in each circle
  const heads = HEADS.map(([u, v, r]) => {
    const idx = [];
    for (let i = 0; i < rec.n; i++) {
      const du = rec.p[i * 6 + 2] - u, dv = (rec.p[i * 6 + 3] - v) * asp;
      if (du * du + dv * dv < r * r) idx.push(i);
    }
    return { u, v, r, idx };
  });
  // his stems: the green strokes below the heads, for the one thing of ours a flower needs
  let sg = [0, 0, 0], sw = 0, sn = 0;
  for (let i = 0; i < rec.n; i++) {
    const v = rec.p[i * 6 + 3], g = rec.rgb[i * 3 + 1], r = rec.rgb[i * 3], b = rec.rgb[i * 3 + 2];
    if (v > 0.5 && v < 0.85 && g > r * 1.1 && g > b * 1.8) { sg[0] += r; sg[1] += g; sg[2] += b; sw += rec.w[i]; sn++; }
  }
  if (sn) { sg = sg.map(c => c / sn); sw /= sn; } else { sg = [0.13, 0.2, 0.03]; sw = 0.01; }
  const N = o.count, R = rng(o.seed ?? 8888);
  // where each stands, and which head it is
  const plan = [];
  for (let j = 0; j < N; j++) {
    let x, z, tries = 0;
    do {
      const a = R() * 6.2832, d = o.radius * Math.sqrt(R());
      x = o.centre[0] + Math.cos(a) * d; z = o.centre[2] + Math.sin(a) * d;
    } while (x > o.bank - 5 && ++tries < 20);            // on the shore, not in the river
    plan.push({ x, z, head: heads[Math.floor(R() * heads.length)], h: 1.1 + 0.6 * R(), D: o.size * (0.75 + 0.5 * R()),
                phi: R() * 6.2832, tilt: (0.05 + 0.15 * R()) });   // a head nods back three to eleven degrees; more and it reads as a feather from the ground
  }
  const total = plan.reduce((s, f) => s + f.head.idx.length + 1, 0);
  const P = [new Float32Array(total * 3), new Float32Array(total * 3), new Float32Array(total * 3)];
  const size = new Float32Array(total * 4), col = new Float32Array(total * 4), meta = new Float32Array(total * 4);
  let n = 0;
  const put = (c0, c1, c2, w, imp, crl, rgb, row) => {
    for (let k = 0; k < 3; k++) { P[0][n * 3 + k] = c0[k]; P[1][n * 3 + k] = c1[k]; P[2][n * 3 + k] = c2[k]; }
    size[n * 4] = w; size[n * 4 + 1] = imp; size[n * 4 + 2] = row; size[n * 4 + 3] = crl;
    col[n * 4] = rgb[0]; col[n * 4 + 1] = rgb[1]; col[n * 4 + 2] = rgb[2]; col[n * 4 + 3] = 0;
    meta[n * 4] = 0; meta[n * 4 + 1] = 1; meta[n * 4 + 2] = (n * 0.618034) % 1 * 6.2832; meta[n * 4 + 3] = 1;
    n++;
  };
  for (const f of plan) {
    const y0 = o.floor, C = [f.x, y0 + f.h, f.z];
    // the head's frame: across, and up, tilted back a little from the way it faces
    const cs = Math.cos(f.phi), sn2 = Math.sin(f.phi), ct = Math.cos(f.tilt), st = Math.sin(f.tilt);
    const Rt = [cs, 0, sn2], Up = [-sn2 * st, ct, cs * st];
    const k = f.D / (2 * f.head.r * Wm);                       // metres per metre of his canvas
    const { u, v } = f.head;
    const at = (cu, cv) => { const dx = (cu - u) * Wm * k, dy = -(cv - v) * Hm * k;
                             return [C[0] + Rt[0] * dx + Up[0] * dy, C[1] + Rt[1] * dx + Up[1] * dy, C[2] + Rt[2] * dx + Up[2] * dy]; };
    for (const i of f.head.idx) {
      put(at(rec.p[i * 6], rec.p[i * 6 + 1]), at(rec.p[i * 6 + 2], rec.p[i * 6 + 3]), at(rec.p[i * 6 + 4], rec.p[i * 6 + 5]),
          rec.w[i] * short * k, rec.h[i] * rec.heightMm / 1000 * k, rec.curl[i] * short * k,
          [rec.rgb[i * 3], rec.rgb[i * 3 + 1], rec.rgb[i * 3 + 2]], (i * 7) % 8);
    }
    // the stem: from the ground to just under the head, straight, in his stems' colour and width
    const top = [C[0] - Up[0] * f.D * 0.35, C[1] - Up[1] * f.D * 0.35, C[2] - Up[2] * f.D * 0.35];
    const foot = [f.x, y0, f.z], mid = [(foot[0] + top[0]) / 2, (foot[1] + top[1]) / 2, (foot[2] + top[2]) / 2];
    put(foot, mid, top, sw * short * k * 1.5, 0.002, 0, sg, 3);
  }
  return { n, P, size, col, meta, flowers: N, heads: heads.map(h => h.idx.length), stem: sg.map(c => +c.toFixed(4)),
           at: plan.slice(0, 12).map(f => [+f.x.toFixed(1), +(o.floor + f.h).toFixed(2), +f.z.toFixed(1), +f.D.toFixed(2), +(f.phi * 57.3).toFixed(0)]) };
}
