// The explosion (DESIGN 3.1): a canvas at its standpoint. Every stroke lies on a ray from his eye, fixed by its
// place on the canvas and the field of view; the depth sidecar says how far down that ray it stands; and a stroke
// `l` long on the canvas is `l * d / f` long in the air. Stand at the eye and the frame is the painting.
import { DEG } from './util.js';

// the direction of a canvas point (u right, v down, in canvas fractions) from an eye looking down -z at yaw 0, pitched up
export function ray(u, v, eye, W, H, f) {
  let x = (u - 0.5) * W, y = (0.5 - v) * H, z = -f;
  const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
  const cp = Math.cos(eye.pitch * DEG), sp = Math.sin(eye.pitch * DEG);
  const y2 = y * cp - z * sp, z2 = y * sp + z * cp;
  // yaw turns the way flight.js turns it: clockwise from north, so that yaw 90 looks east. They agreed at
  // yaw 0 and nowhere else, which is why it took a second standpoint (D4) to find that they disagreed at all
  const cy = Math.cos(eye.yaw * DEG), sy = Math.sin(eye.yaw * DEG);
  return [x * cy - z2 * sy, y2, x * sy + z2 * cy];
}

export function focal(hfov, W) { return (W / 2) / Math.tan(hfov * DEG / 2); }

// The cone a canvas cuts out of the world from its standpoint (DESIGN 5.1): the eye's own frame -- right, up,
// forward -- and the half-angles of the canvas as tangents. Inside it there is his painting and nothing else,
// which is the rule strokes.js keeps for all three at once.
export function cone(eye, rec) {
  const H = rec.cm[1] / 100, W = H * rec.px[0] / rec.px[1], f = focal(eye.hfov, W);
  const cy = Math.cos(eye.yaw * DEG), sy = Math.sin(eye.yaw * DEG);
  const cp = Math.cos(eye.pitch * DEG), sp = Math.sin(eye.pitch * DEG);
  return { at: [eye.x, eye.y, eye.z], f, W, H, hw: (W / 2) / f, hh: (H / 2) / f,
           R: [cy, 0, sy], U: [-sy * sp, cp, cy * sp], Fw: [sy * cp, sp, -cy * cp] };
}

// instance arrays for strokes.js: three control points in the world, the size row, the colour row, the meta row
export function explode(rec, depth, eye, mine = 0) {
  const n = rec.n, H = rec.cm[1] / 100, W = H * rec.px[0] / rec.px[1], short = Math.min(W, H);   // the holder's height, the scan's aspect
  const f = focal(eye.hfov, W);
  const P = [new Float32Array(n * 3), new Float32Array(n * 3), new Float32Array(n * 3)];
  const size = new Float32Array(n * 4), col = new Float32Array(n * 4), meta = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const d = depth.d[i], k = d / f;
    for (let c = 0; c < 3; c++) {
      const r = ray(rec.p[i * 6 + c * 2], rec.p[i * 6 + c * 2 + 1], eye, W, H, f);
      P[c][i * 3] = eye.x + r[0] * d; P[c][i * 3 + 1] = eye.y + r[1] * d; P[c][i * 3 + 2] = eye.z + r[2] * d;
    }
    size[i * 4] = rec.w[i] * short * k;                       // width, m
    size[i * 4 + 1] = rec.h[i] * rec.heightMm / 1000 * k;     // impasto, m
    size[i * 4 + 2] = (i * 7) % 8;                            // the brush print
    size[i * 4 + 3] = rec.curl[i] * short * k;                // how far it may slide along its arc, m
    col[i * 4] = rec.rgb[i * 3]; col[i * 4 + 1] = rec.rgb[i * 3 + 1]; col[i * 4 + 2] = rec.rgb[i * 3 + 2];
    col[i * 4 + 3] = depth.shine[i];
    meta[i * 4] = rec.order[i]; meta[i * 4 + 1] = mine; meta[i * 4 + 2] = (i * 0.618034) % 1 * 6.2832; meta[i * 4 + 3] = d;
  }
  return { n, P, size, col, meta, f };
}
