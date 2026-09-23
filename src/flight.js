// Flight. Two controls: look, and go. Drag looks; the arrows go -- up goes where you look, down goes back, left
// and right turn -- and nothing pressed is nothing: the body stands where it is until a key is held, and stops
// when it is let go. No glide, no wind on the body, no bank, no lag between the eye and the way. The author's
// words, at the user test: *simplify, arrow keys decide the movement, no up arrow, no movement.* There is no
// gravity and no collision, but there is a ground: `floor(x, z)` is the height under you, and you go over it.
import { clamp, DEG } from './util.js';

export const LOOK = 0.0028;                 // radians a pixel
const MOVE = 8, FAST = 30;                  // m/s: an arrow, and an arrow with Shift
const TURN = 50 * DEG;                      // rad/s: a full turn in seven seconds
const T_SPEED = 0.2;                        // the body reaches its speed, and loses it, in a fifth of a second
const FLOOR = 1.0, FLOOR_A = 15;            // over the ground, and how hard it may take to stop you: 1.5 g
const LIFT_H = 45, LIFT_MAX = 12;           // the lift: the body goes faster the higher it is, twice at 45 m, twelve times at 495
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class Flight {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.dx = 0; this.dy = 0; this.drag = null;
    this.h = {};
    this.joy = { id: -1, y: 0 }; this.look = { id: -1 };
    // the body
    this.pos = [0, 40, 0];
    this.gaze = { yaw: 0, pitch: 0 };      // where the eye looks
    this.head = { yaw: 0, pitch: 0 };      // the way the body goes: the same, now
    this.speed = 0; this.target = 0; this.roll = 0; this.yawRate = 0;
    this.floor = null; this.reach = 0;     // the ground under you, and how far from the middle of the world you may go
    this.script = null;                    // a hand the harness holds
    this.carry = null;                     // a current carrying the body to a standpoint (DESIGN 6.4)
    this.coast = [0, 0, 0];                // what is left of the film's way when it lets the body go (E2)
    addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) this.emit('go');
      if (e.code === 'KeyH' || e.code === 'Slash') this.emit('help');
      if (e.code === 'KeyL') this.emit('ledger');
      if (e.code === 'KeyF') this.emit('fullscreen');
      if (e.code === 'Space') this.emit('dream');
      if (e.code === 'Escape') this.emit('escape');
      const dm = /^Digit(\d)$/.exec(e.code);
      if (dm) this.emit('eye', +dm[1]);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') return;
      this.drag = { x: e.clientX, y: e.clientY };
      try { el.setPointerCapture(e.pointerId); } catch {}
      this.emit('look');
    });
    el.addEventListener('pointermove', e => {
      if (!this.drag || e.pointerType === 'touch') return;
      this.dx += e.clientX - this.drag.x; this.dy += e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
    });
    const end = e => { if (e.pointerType !== 'touch') this.drag = null; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', e => e.preventDefault(), { passive: false });
    // touch (DESIGN 6.6): the left thumb goes, up and back; the right thumb looks. Nothing else
    el.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && this.joy.id < 0) { this.joy = { id: t.identifier, y0: t.clientY, y: 0 }; this.emit('go'); }
        else if (this.look.id < 0) this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) this.joy.y = clamp((this.joy.y0 - t.clientY) / 80, -1, 1);
        else if (t.identifier === this.look.id) {
          this.dx += (t.clientX - this.look.x) * 1.4; this.dy += (t.clientY - this.look.y) * 1.4;
          this.look.x = t.clientX; this.look.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const tend = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) this.joy = { id: -1, y: 0 };
        if (t.identifier === this.look.id) this.look = { id: -1 };
      }
    };
    el.addEventListener('touchend', tend); el.addEventListener('touchcancel', tend);
  }
  on(n, f) { (this.h[n] ||= []).push(f); }
  emit(n, v) { (this.h[n] || []).forEach(f => f(v)); }
  has(c) { return this.keys.has(c); }

  // put the body somewhere whole, looking and going one way
  go(o) {
    if (o.pos) this.pos = [...o.pos];
    if (o.yaw != null) { this.gaze.yaw = this.head.yaw = o.yaw * DEG; }
    if (o.pitch != null) { this.gaze.pitch = this.head.pitch = o.pitch * DEG; }
    if (o.speed != null) { this.speed = this.target = o.speed; }
    this.roll = 0; this.yawRate = 0; this.carry = null; this.coast = [0, 0, 0];
  }

  // The current (DESIGN 6.4, BUILD.md D4): 1, 2, 3 do not cut to a standpoint, they let the night carry you
  // there. The ease is nothing at either end, so it starts and stops without a jolt, and it lets go the moment
  // you take the controls back -- a current you cannot leave is a rail, and DESIGN 2 says this has none
  carryTo(to, T) {
    this.carry = { t: 0, T, p0: [...this.pos], p1: [to.x, to.y, to.z],
                   y0: this.gaze.yaw, y1: to.yaw * DEG, q0: this.gaze.pitch, q1: to.pitch * DEG, s0: this.speed };
    this.yawRate = 0; this.coast = [0, 0, 0];
    return T;
  }
  // is a key held that moves the body?
  pressed() {
    return this.has('ArrowUp') || this.has('KeyW') || this.has('ArrowDown') || this.has('KeyS') ||
           this.has('ArrowLeft') || this.has('ArrowRight') || this.has('KeyA') || this.has('KeyD') || this.joy.id >= 0;
  }

  update(dt) {
    const S = this.script;
    if (this.carry) {
      const C = this.carry, dxx = this.dx, dyy = this.dy;
      this.dx = this.dy = 0;
      C.t = Math.min(C.T, C.t + dt);
      const u = C.t / C.T, e = u * u * u * (u * (u * 6 - 15) + 10), de = 30 * u * u * (1 - u) * (1 - u) / C.T;
      const v = [0, 1, 2].map(k => (C.p1[k] - C.p0[k]) * de);
      for (let k = 0; k < 3; k++) this.pos[k] = C.p0[k] + (C.p1[k] - C.p0[k]) * e;
      this.gaze.yaw = this.head.yaw = C.y0 + angDiff(C.y1, C.y0) * e;
      this.gaze.pitch = this.head.pitch = C.q0 + (C.q1 - C.q0) * e;
      this.speed = this.target = C.s0 * (1 - e);
      this.roll *= Math.exp(-dt / 0.35);
      if (C.t >= C.T || (!S && (Math.abs(dxx) + Math.abs(dyy) > 6 || this.pressed()))) { this.carry = null; this.target = 0; }
      return { vx: v[0], vy: v[1], vz: v[2] };
    }
    // the gaze: a drag, or the harness's hand, or the left and right arrows
    let dx = this.dx, dy = this.dy; this.dx = this.dy = 0;
    if (S) { dx = (S.dx || 0) * dt / LOOK; dy = (S.dy || 0) * dt / LOOK; }
    const turn = ((this.has('ArrowRight') || this.has('KeyD')) ? 1 : 0) - ((this.has('ArrowLeft') || this.has('KeyA')) ? 1 : 0);
    const y0 = this.gaze.yaw;
    this.gaze.yaw += dx * LOOK + turn * TURN * dt;
    this.gaze.pitch = clamp(this.gaze.pitch - dy * LOOK, -85 * DEG, 88 * DEG);
    if (S && S.pitch != null) this.gaze.pitch += (S.pitch * DEG - this.gaze.pitch) * (1 - Math.exp(-dt * 1.5));
    const rate = angDiff(this.gaze.yaw, y0) / Math.max(dt, 1e-3);
    this.yawRate += (rate - this.yawRate) * (1 - Math.exp(-dt * 4));
    // the way is where the eye looks, with no lag
    this.head.yaw = this.gaze.yaw; this.head.pitch = this.gaze.pitch;
    // the speed: nothing pressed is nothing
    const fwd = this.has('ArrowUp') || this.has('KeyW'), back = this.has('ArrowDown') || this.has('KeyS');
    const run = this.has('ShiftLeft') || this.has('ShiftRight');
    // the lift (E1): near the ground you walk, and the higher you are the faster you go, so that a star 1,500 m up
    // is half a minute away at a walk and eight seconds with Shift, and grows the whole way; coming down you slow
    const fl = this.floor ? this.floor(this.pos[0], this.pos[2]) : FLOOR;
    const h = Math.max(this.pos[1] - fl, 0);
    const lift = Math.min(LIFT_MAX, 1 + h / LIFT_H);
    let t = 0;
    if (fwd) t = run ? FAST : MOVE; else if (back) t = -(run ? FAST : MOVE);
    if (this.joy.id >= 0) t = this.joy.y * MOVE;
    t *= lift;
    if (S && S.speed != null) t = S.speed;
    this.target = t;
    this.speed += (t - this.speed) * (1 - Math.exp(-dt / T_SPEED));
    if (t === 0 && Math.abs(this.speed) < 0.02) this.speed = 0;
    // the body
    const cp = Math.cos(this.head.pitch), sy = Math.sin(this.head.yaw), cy = Math.cos(this.head.yaw);
    const vx = sy * cp * this.speed, vz = -cy * cp * this.speed;
    let vy = Math.sin(this.head.pitch) * this.speed;
    // The floor (DESIGN 6.3): a soft floor a metre over the water. Not a wall and not a cushion that scales with
    // your own speed -- the descent is held to the speed a constant deceleration could still stop from here, so
    // however fast you come down you are slowed at the same rate and arrive at a walking pace
    if (vy < 0) vy = Math.max(vy, -(Math.sqrt(2 * FLOOR_A * h) + 0.4));
    // a body the film has let go keeps its way for a moment and comes to rest as a released key does (E2)
    const C = this.coast, ck = Math.exp(-dt / T_SPEED);
    for (let k = 0; k < 3; k++) C[k] = Math.abs(C[k] * ck) < 0.01 ? 0 : C[k] * ck;
    this.pos[0] += (vx + C[0]) * dt; this.pos[1] = Math.max(fl, this.pos[1] + (vy + C[1]) * dt); this.pos[2] += (vz + C[2]) * dt;
    // the ground under you rises and falls; and the reach is a sphere round the middle of the world, through the stars
    if (this.reach) { const r = Math.hypot(this.pos[0], this.pos[1], this.pos[2]); if (r > this.reach) for (let k = 0; k < 3; k++) this.pos[k] *= this.reach / r; }
    this.roll *= Math.exp(-dt / 0.35);         // nought in your own hands; a bank the film left goes out of it
    return { vx: vx + C[0], vy: vy + C[1], vz: vz + C[2] };
  }

  // the camera: at the body, looking where the gaze looks
  applyTo(camera) {
    camera.position.set(this.pos[0], this.pos[1], this.pos[2]);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(this.gaze.pitch, -this.gaze.yaw, this.roll);
    camera.updateMatrixWorld();
  }
  // the way the body is going, for the shader's parting
  heading() { const cp = Math.cos(this.head.pitch); return [Math.sin(this.head.yaw) * cp, Math.sin(this.head.pitch), -Math.cos(this.head.yaw) * cp]; }
  state() {
    return { x: +this.pos[0].toFixed(2), y: +this.pos[1].toFixed(2), z: +this.pos[2].toFixed(2),
             yaw: +(this.gaze.yaw / DEG).toFixed(2), pitch: +(this.gaze.pitch / DEG).toFixed(2),
             headYaw: +(this.head.yaw / DEG).toFixed(2), headPitch: +(this.head.pitch / DEG).toFixed(2),
             speed: +this.speed.toFixed(2), roll: 0, pressed: this.pressed(),
             carried: !!this.carry };
  }
}
