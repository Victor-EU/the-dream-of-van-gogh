// Hands. The arrow keys walk and turn, which is what a hand expects of them;
// WASD for those who reach for it; drag to look; the wheel walks too. On a
// phone the left thumb walks and the right one looks.
import { clamp } from './util.js';

const MOVE = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
const KEYMAP = { Space: 'auto', KeyZ: 'lie', KeyX: 'pace', KeyM: 'sound', KeyH: 'help', Slash: 'help', Enter: 'begin', Escape: 'escape', KeyF: 'fullscreen' };

export class Controls {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.drag = null;
    this.h = {};
    this.joy = { id: -1, x: 0, y: 0 };
    this.look = { id: -1 };
    addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target && e.target.tagName;
      if ((tag === 'BUTTON' || tag === 'A') && (e.code === 'Space' || e.code === 'Enter')) return;
      if (MOVE.includes(e.code) || e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
      if (MOVE.includes(e.code)) this.emit('move');
      if (e.repeat) return;
      if (KEYMAP[e.code]) this.emit(KEYMAP[e.code]);
      const dm = /^Digit(\d)$/.exec(e.code);
      if (dm) this.emit('jump', dm[1] === '0' ? 10 : +dm[1]);
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
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', e => { e.preventDefault(); this.wheel += e.deltaY; this.emit('move'); }, { passive: false });
    el.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && this.joy.id < 0) { this.joy = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: 0, y: 0 }; this.emit('move'); }
        else if (this.look.id < 0) this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          this.joy.x = clamp((t.clientX - this.joy.x0) / 60, -1, 1);
          this.joy.y = clamp((t.clientY - this.joy.y0) / 60, -1, 1);
        } else if (t.identifier === this.look.id) {
          this.dx += (t.clientX - this.look.x) * 1.4; this.dy += (t.clientY - this.look.y) * 1.4;
          this.look.x = t.clientX; this.look.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const tend = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) this.joy = { id: -1, x: 0, y: 0 };
        if (t.identifier === this.look.id) this.look = { id: -1 };
      }
    };
    el.addEventListener('touchend', tend);
    el.addEventListener('touchcancel', tend);
  }
  on(n, f) { (this.h[n] ||= []).push(f); }
  emit(n, v) { (this.h[n] || []).forEach(f => f(v)); }
  has(c) { return this.keys.has(c); }
  get forward() { return (this.has('ArrowUp') || this.has('KeyW') ? 1 : 0) - (this.has('ArrowDown') || this.has('KeyS') ? 1 : 0) - this.joy.y; }
  get turn() { return (this.has('ArrowRight') ? 1 : 0) - (this.has('ArrowLeft') ? 1 : 0) + (Math.abs(this.joy.x) > 0.25 ? this.joy.x * 0.8 : 0); }
  get strafe() { return (this.has('KeyD') ? 1 : 0) - (this.has('KeyA') ? 1 : 0); }
  get run() { return this.has('ShiftLeft') || this.has('ShiftRight'); }
  take() { const r = { dx: this.dx, dy: this.dy, wheel: this.wheel }; this.dx = this.dy = this.wheel = 0; return r; }
}
