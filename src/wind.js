// The wind (DESIGN 3.2, 4.7): the field tools/wind.py fitted to his sky's tangent lines, at the speeds a person set,
// evaluated in three dimensions. The field lives on the sphere of directions round the standpoint: a point's
// direction from his eye is projected onto the canvas plane, the field is read there in metres a second, and it is
// applied perpendicular to the point's own ray, so that a body carried round an eddy stays at its distance and the
// eddy is a cone about its ray, as the funnel of its depth law is. Each core draws a body along its axis, away from
// the eye, so that the turn is a helix down the tunnel.
//
// D2 extends it past his canvas, because our sky lies along it there. The projection is his exactly within sixty
// degrees of his axis, which holds his whole canvas and more, and beyond that it is continued with the ray's own
// direction so that the drift and the wave go on round the sky and the vortices die as their profiles say. And
// outside his cone the field gains the curl noise of 4.7: the surface curl of a noise on the sphere, which is a
// field of eddies at one angular size and turns without gathering or spilling. Its size and its speed are the two
// authored numbers, set against the measured structure of his bands (hand/starry-sky.json).
//
// Two fields, as hand/starry-wind.json has two: the fit, whose eddies stand to its drift as his lines say (24 to
// one), and the flown, at the speeds a person set (4 to one). Our sky's strokes are laid along the fit, because
// his are -- the fit is what explains his bands to 15.4 degrees and the flown field only to 27.5 -- and the body
// flies the flown one. So `layDir` reads the fit and `at` reads the flown, and the curl noise has an amplitude in
// each: what his sky looks like, and what a body is carried by.
import { DEG, smoothstep, fbm3, clamp } from './util.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const LIM = 0.5;                     // cos 60 degrees: the canvas's far corner is at 39

export class Wind {
  constructor(spec, opts = {}) {
    const e = spec.eye, F = spec.flown;
    this.spec = spec;
    this.eye = [e.x, e.y, e.z]; this.f = spec.canvas.f; this.W = spec.canvas.W; this.H = spec.canvas.H;
    const cy = Math.cos(e.yaw * DEG), sy = Math.sin(e.yaw * DEG), cp = Math.cos(e.pitch * DEG), sp = Math.sin(e.pitch * DEG);
    // the eye's frame in the world, as explode.ray rotates it: right, up, forward
    this.R = [cy, 0, sy]; this.U = [-sy * sp, cp, cy * sp]; this.Fw = [sy * cp, sp, -cy * cp];
    this.draw = F.draw; this.gauss = F.profile !== 'oseen';
    const M = spec.measured, b = M.drift_deg * DEG;
    this.fl = { drift: F.drift, wave: F.wave, v: F.vortices };
    this.fit = { drift: [Math.cos(b), Math.sin(b)], wave: M.wave, v: M.vortices };
    this.drift = F.drift; this.v = F.vortices; this.wave = F.wave;
    this.axes = this.v.map((_, i) => this.axis(i).dir);
    this.speed = Math.hypot(F.drift[0], F.drift[1]);
    // the curl noise, outside his cone: one angular size, and an amplitude in each field -- against the fit's
    // drift of one, and in metres a second for the body. Both authored (BUILD.md D2)
    this.noise = { lam: opts.lam ?? 0.075, oct: opts.oct ?? 1, lay: opts.lay ?? 12, fly: opts.fly ?? 2.0, in: 0.82, out: 0.98, k: 1 };
    this.noise.k = 1 / (this._curlRms() || 1);
    this.on = 1;
    this._c = new Float64Array(this.v.length);
    this._g = [0, 0, 0];
  }
  // the field on the canvas plane, at (x, y) metres from its centre: [fx, fy, core], and each vortex's core weight
  plane(P, x, y, cores) {
    let fx = P.drift[0], fy = P.drift[1], core = 0;
    const w = P.wave;
    const ph = w.A * Math.sin(2 * Math.PI * (x * Math.cos(w.phi) + y * Math.sin(w.phi)) / w.lam + w.psi);
    fx += -Math.sin(w.phi) * ph; fy += Math.cos(w.phi) * ph;
    for (let i = 0; i < P.v.length; i++) {
      const v = P.v[i];
      const dx = x - v.c[0], dy = y - v.c[1], rho = Math.hypot(dx, dy) + 1e-9, u = rho / v.r;
      const g = v.s * (this.gauss ? u * Math.exp(0.5 * (1 - u * u)) : (1 - Math.exp(-u * u)) / Math.max(u, 1e-6));
      fx += g * (-dy / rho - v.q * dx / rho); fy += g * (dx / rho - v.q * dy / rho);
      const cw = Math.exp(-0.5 * u * u);
      core = Math.max(core, cw);
      if (cores) cores[i] = cw;
    }
    return [fx, fy, core];
  }
  // his canvas plane, read at a direction: exact while the ray is within sixty degrees of his axis, and continued
  // with the direction itself beyond, so that the drift and the wave go on round the whole sky
  planeOf(d, out = [0, 0]) {
    const z = Math.max(dot(d, this.Fw), LIM);
    out[0] = this.f * dot(d, this.R) / z; out[1] = this.f * dot(d, this.U) / z;
    return out;
  }
  inCone(d) {
    if (dot(d, this.Fw) <= LIM) return false;
    const p = this.planeOf(d, this._p || (this._p = [0, 0]));
    return Math.abs(p[0]) < this.W / 2 && Math.abs(p[1]) < this.H / 2;
  }
  // how far out toward the edge of his canvas a ray is, 0 in the middle of it and 1 at the edge and beyond: the
  // window the curl noise comes in through. It is full by the edge itself, so that our sky's first strokes at the
  // seam lie along a field with his bands' structure in it and not along a bare drift; the cost is that a body
  // flying through the outer fifth of his cone feels a little of it too
  outside(d) {
    const p = this.planeOf(d, this._p || (this._p = [0, 0]));
    const q = Math.max(Math.abs(p[0]) / (this.W / 2), Math.abs(p[1]) / (this.H / 2));
    const behind = dot(d, this.Fw) <= LIM;
    return behind ? 1 : smoothstep(this.noise.in, this.noise.out, q);
  }
  // the noise's potential at a direction, in [-1, 1]: our eddies' centres are where it is most extreme
  psi(d) {
    const s = 1 / this.noise.lam;
    return 2 * fbm3(d[0] * s + 11.3, d[1] * s + 4.7, d[2] * s + 19.1, this.noise.oct) - 1;
  }
  // the surface curl of that potential: a velocity in the ray's own tangent plane, divergence-free on the sphere
  curlAt(d, amp, out = [0, 0, 0]) {
    const h = 0.12 * this.noise.lam, k = this.noise.k * amp / (2 * h);
    const gx = this.psi([d[0] + h, d[1], d[2]]) - this.psi([d[0] - h, d[1], d[2]]);
    const gy = this.psi([d[0], d[1] + h, d[2]]) - this.psi([d[0], d[1] - h, d[2]]);
    const gz = this.psi([d[0], d[1], d[2] + h]) - this.psi([d[0], d[1], d[2] - h]);
    out[0] = k * (gy * d[2] - gz * d[1]); out[1] = k * (gz * d[0] - gx * d[2]); out[2] = k * (gx * d[1] - gy * d[0]);
    return out;
  }
  _curlRms() {
    this.noise.k = 1;
    let s = 0, n = 0;
    for (let i = 0; i < 256; i++) {
      const z = 2 * ((i * 0.618034) % 1) - 1, a = i * 2.39996, r = Math.sqrt(Math.max(0, 1 - z * z));
      const v = this.curlAt([r * Math.cos(a), r * Math.sin(a), z], 1, [0, 0, 0]);
      s += v[0] * v[0] + v[1] * v[1] + v[2] * v[2]; n++;
    }
    return Math.sqrt(s / n);
  }
  // the canvas frame carried onto a ray: right and up, perpendicular to it
  frame(d, out = { Rp: [0, 0, 0], Up: [0, 0, 0] }) {
    if (Math.abs(dot(d, this.R)) < 0.9) {
      const rr = dot(this.R, d), Rp = norm([this.R[0] - d[0] * rr, this.R[1] - d[1] * rr, this.R[2] - d[2] * rr]);
      out.Rp = Rp; out.Up = cross(Rp, d);
    } else {
      const uu = dot(this.U, d), Up = norm([this.U[0] - d[0] * uu, this.U[1] - d[1] * uu, this.U[2] - d[2] * uu]);
      out.Up = Up; out.Rp = cross(d, Up);
    }
    return out;
  }
  // the velocity of the air at a point of the world, m/s
  at(pos, out = [0, 0, 0]) {
    const rel = [pos[0] - this.eye[0], pos[1] - this.eye[1], pos[2] - this.eye[2]];
    const D = Math.hypot(rel[0], rel[1], rel[2]) || 1e-6;
    const d = [rel[0] / D, rel[1] / D, rel[2] / D];
    const cores = this._c;
    const p = this.planeOf(d, this._p || (this._p = [0, 0]));
    const [fx, fy] = this.plane(this.fl, p[0], p[1], cores);
    const fr = this.frame(d, this._f || (this._f = { Rp: [0, 0, 0], Up: [0, 0, 0] }));
    const Rp = fr.Rp, Up = fr.Up;
    for (let k = 0; k < 3; k++) out[k] = fx * Rp[k] + fy * Up[k];
    const w = this.outside(d);
    if (w > 0) { const c = this.curlAt(d, w * this.noise.fly, this._g); for (let k = 0; k < 3; k++) out[k] += c[k]; }
    // the draw: each eddy's core carries a body along the eddy's own axis, away from his eye, down the tunnel its
    // depth law makes. A lift straight up cannot lift inside a vortex: a uniform flow added to a turn only moves
    // the closed orbits aside (D1 measured it: 25 m in two minutes). Along the axis it is a helix, and the body goes
    let tot = 0;
    for (let i = 0; i < cores.length; i++) tot += cores[i];
    const dk = tot > 1 ? 1 / tot : 1;
    for (let i = 0; i < cores.length; i++) {
      if (cores[i] < 0.01) continue;
      for (let k = 0; k < 3; k++) out[k] += this.draw * cores[i] * dk * this.axes[i][k];
    }
    if (this.on !== 1) for (let k = 0; k < 3; k++) out[k] *= this.on;
    return out;
  }
  // the direction his sky's paint lies along at a ray: the fitted field, whose proportions are his lines'.
  // A unit vector in the ray's own tangent plane, which is where a stroke of his lies
  layDir(d, out = [0, 0, 0]) {
    const p = this.planeOf(d, this._p2 || (this._p2 = [0, 0]));
    const [fx, fy] = this.plane(this.fit, p[0], p[1], null);
    const fr = this.frame(d, this._f2 || (this._f2 = { Rp: [0, 0, 0], Up: [0, 0, 0] }));
    for (let k = 0; k < 3; k++) out[k] = fx * fr.Rp[k] + fy * fr.Up[k];
    const w = this.outside(d);
    if (w > 0) { const c = this.curlAt(d, w * this.noise.lay, this._g2 || (this._g2 = [0, 0, 0])); for (let k = 0; k < 3; k++) out[k] += c[k]; }
    const rad = out[0] * d[0] + out[1] * d[1] + out[2] * d[2];
    for (let k = 0; k < 3; k++) out[k] -= rad * d[k];
    const l = Math.hypot(out[0], out[1], out[2]) || 1;
    for (let k = 0; k < 3; k++) out[k] /= l;
    return out;
  }
  // an eddy's axis: the ray from his eye through the vortex's centre, and its radius on the canvas
  axis(i) {
    const v = this.v[i];
    const dir = norm([0, 1, 2].map(k => v.c[0] * this.R[k] + v.c[1] * this.U[k] + this.f * this.Fw[k]));
    const fr = this.frame(dir);
    return { dir, Rp: fr.Rp, Up: fr.Up, r: v.r, c: v.c, f: this.f };
  }
  // a direction from his eye, from the canvas frame: u right, v up, in metres on the plane
  dirOf(x, y) {
    return norm([0, 1, 2].map(k => x * this.R[k] + y * this.U[k] + this.f * this.Fw[k]));
  }
}
