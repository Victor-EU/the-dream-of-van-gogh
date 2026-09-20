// Flight (DESIGN 6). Two controls: look, and speed. You go where you look, with a lag, so that a glance is a
// glance; nothing pressed is a glide, never a stop; the view banks into a turn. The body is a particle in the wind:
// main.js reads wind.js at the body each frame into `current`, and it is added to the body's own velocity, so that
// letting go (Space) is being carried. There is no walking, no landing, no gravity and no collision.
import { clamp, lerp, DEG } from './util.js';

const LOOK = 0.0028;                        // radians a pixel
const GLIDE = 3, FAST = 15, SWOOP = 40, SLOW = 0.5;
const T_SPEED = 2.0, T_HEAD = 1.2, T_ROLL = 0.5;
const BANK = 25 * DEG;
const FLOOR = 1.0, FLOOR_A = 15;      // a metre over the water, and how hard it may take to stop you: 1.5 g
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class Flight {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.dx = 0; this.dy = 0; this.wheel = 0; this.drag = null;
    this.h = {};
    this.joy = { id: -1, y: 0 }; this.look = { id: -1 };
    // the body
    this.pos = [0, 40, 0];
    this.gaze = { yaw: 0, pitch: 0 };      // where the eye looks
    this.head = { yaw: 0, pitch: 0 };      // the way the body goes, easing toward the gaze
    this.speed = GLIDE; this.target = GLIDE; this.roll = 0; this.yawRate = 0;
    this.letgo = false;
    this.onBack = false;                   // Z: the gaze goes to the zenith, the body keeps its way
    this.gazeTo = null;                    // a pitch the gaze is easing to, rad, or null
    this.current = [0, 0, 0];              // the wind at the body, m/s (wind.js), added to its own velocity
    this.script = null;                    // a hand the harness holds
    this.carry = null;                     // a current carrying the body to a standpoint (DESIGN 6.4)
    addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'Space') this.emit('letgo');
      if (e.code === 'KeyZ') this.emit('back');
      if (e.code === 'KeyH' || e.code === 'Slash') this.emit('help');
      if (e.code === 'KeyL') this.emit('ledger');
      if (e.code === 'KeyF') this.emit('fullscreen');
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
    el.addEventListener('wheel', e => { e.preventDefault(); this.wheel += e.deltaY; }, { passive: false });
    el.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && this.joy.id < 0) this.joy = { id: t.identifier, y0: t.clientY, y: 0 };
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
    this.roll = 0; this.yawRate = 0; this.letgo = false; this.onBack = false; this.gazeTo = null; this.carry = null;
  }
  // Z, onto your back: the gaze eases to the zenith while the body keeps its heading; Z again, or a vertical
  // drag, or a speed key, and the gaze comes back to the way the body is going
  back() {
    this.onBack = !this.onBack;
    this.gazeTo = this.onBack ? 88 * DEG : this.head.pitch;
  }

  // The current (DESIGN 6.4, BUILD.md D4): 1, 2, 3 do not cut to a standpoint, they let the night carry you
  // there. The ease is nothing at either end, so it starts and stops without a jolt, and it lets go the moment
  // you take the controls back -- a current you cannot leave is a rail, and DESIGN 2 says this has none
  carryTo(to, T) {
    this.carry = { t: 0, T, p0: [...this.pos], p1: [to.x, to.y, to.z],
                   y0: this.gaze.yaw, y1: to.yaw * DEG, q0: this.gaze.pitch, q1: to.pitch * DEG, s0: this.speed };
    this.letgo = false; this.onBack = false; this.gazeTo = null; this.roll = 0; this.yawRate = 0;
    return T;
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
      if (C.t >= C.T || (!S && Math.abs(dxx) + Math.abs(dyy) > 6)) { this.carry = null; this.target = GLIDE; }
      return { vx: v[0], vy: v[1], vz: v[2] };
    }
    // the gaze
    let dx = this.dx, dy = this.dy; this.dx = this.dy = 0;
    if (S) { dx = (S.dx || 0) * dt / LOOK; dy = (S.dy || 0) * dt / LOOK; }
    const turn = (this.has('ArrowRight') ? 1 : 0) - (this.has('ArrowLeft') ? 1 : 0);
    const y0 = this.gaze.yaw;
    this.gaze.yaw += dx * LOOK + turn * 1.2 * dt;
    if (Math.abs(dy) > 2 && this.onBack) { this.onBack = false; this.gazeTo = null; }
    this.gaze.pitch = clamp(this.gaze.pitch - dy * LOOK, -85 * DEG, 88 * DEG);
    if (S && S.pitch != null) this.gaze.pitch += (S.pitch * DEG - this.gaze.pitch) * (1 - Math.exp(-dt * 1.5));
    if (this.gazeTo != null) {
      this.gaze.pitch += (this.gazeTo - this.gaze.pitch) * (1 - Math.exp(-dt / 0.8));
      if (!this.onBack && Math.abs(this.gazeTo - this.gaze.pitch) < 0.5 * DEG) this.gazeTo = null;
    }
    const rate = angDiff(this.gaze.yaw, y0) / Math.max(dt, 1e-3);
    this.yawRate += (rate - this.yawRate) * (1 - Math.exp(-dt * 4));
    // the speed
    const fwd = this.has('ArrowUp') || this.has('KeyW'), back = this.has('ArrowDown') || this.has('KeyS');
    const run = this.has('ShiftLeft') || this.has('ShiftRight');
    let t = GLIDE;
    if (run) t = SWOOP; else if (fwd) t = FAST; else if (back) t = SLOW;
    if (this.joy.id >= 0) t = this.joy.y > 0 ? lerp(GLIDE, FAST, this.joy.y) : lerp(GLIDE, SLOW, -this.joy.y);
    if (S && S.speed != null) t = S.speed;
    if (this.wheel) { t = clamp(this.speed - this.wheel * 0.02, SLOW, SWOOP); this.wheel = 0; this.target = t; }
    if (fwd || back || run || dx || dy || this.joy.id >= 0) this.letgo = false;
    if (fwd || back || run) { if (this.onBack) { this.onBack = false; this.gazeTo = this.head.pitch; } }
    if (this.letgo) t = 0;
    this.target = t;
    this.speed += (this.target - this.speed) * (1 - Math.exp(-dt / T_SPEED));
    // the heading follows the gaze, late
    const k = 1 - Math.exp(-dt / T_HEAD);
    if (!this.onBack) {
      this.head.yaw += angDiff(this.gaze.yaw, this.head.yaw) * k;
      if (this.gazeTo == null) this.head.pitch += (this.gaze.pitch - this.head.pitch) * k;   // not while the gaze is coming back from the zenith
    }
    // the body
    const cp = Math.cos(this.head.pitch), sy = Math.sin(this.head.yaw), cy = Math.cos(this.head.yaw);
    let vx = sy * cp * this.speed + this.current[0], vy = Math.sin(this.head.pitch) * this.speed + this.current[1], vz = -cy * cp * this.speed + this.current[2];
    // The floor (DESIGN 6.3): a soft floor a metre over the water. Not a wall and not a cushion that scales with
    // your own speed -- the descent is held to the speed a constant deceleration could still stop from here, so
    // however fast you come down you are slowed at the same rate and arrive at a walking pace. Before D3 it was
    // a factor on the speed, which took a swoop from thirty metres a second to one in a fifth of a second
    const h = Math.max(this.pos[1] - FLOOR, 0);
    if (vy < 0) vy = Math.max(vy, -(Math.sqrt(2 * FLOOR_A * h) + 0.4));
    this.pos[0] += vx * dt; this.pos[1] = Math.max(FLOOR, this.pos[1] + vy * dt); this.pos[2] += vz * dt;
    // the bank
    const rollT = clamp(-this.yawRate * 0.55, -BANK, BANK);
    this.roll += (rollT - this.roll) * (1 - Math.exp(-dt / T_ROLL));
    return { vx, vy, vz };
  }

  // the camera: at the body, looking where the gaze looks, rolled into the turn
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
             speed: +this.speed.toFixed(2), roll: +(this.roll / DEG).toFixed(2), letgo: this.letgo, onBack: this.onBack,
             carried: !!this.carry,
             wind: this.current.map(c => +c.toFixed(2)) };
  }
}
