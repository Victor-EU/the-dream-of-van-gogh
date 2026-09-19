// The interface: one line that says how until a hand moves, one card of keys, the name of each painting as its
// world comes up round you, a plaque by each canvas, and the road itself as a line along the bottom that you can
// click to travel, with a tick per painting. The opening is the veil's (src/veil.js).
import { stationZ, tauAt } from './journey.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// a button pressed with a click or a tap gives the focus back, or the space bar would press it again instead of
// walking on its own; one reached with Tab keeps it
const press = (b, f) => b.addEventListener('click', e => { if (e.detail) b.blur(); f(e); });

export class UI {
  constructor(stations, api) {
    this.st = stations;
    this.api = api;
    this.cur = -1;
    const ticks = $('j-ticks');
    stations.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'tick';
      b.type = 'button';
      b.style.left = (tauAt(stationZ(i)) * 100).toFixed(2) + '%';
      const name = s.title || s.place, when = s.when || '';
      b.innerHTML = `<i></i><span>${esc(name)}${when ? `<em>${esc(when)}</em>` : ''}</span>`;
      b.setAttribute('aria-label', `Go to ${name}${when ? ', ' + when : ''}`);
      press(b, e => { e.stopPropagation(); api.jump(i); });
      ticks.appendChild(b);
    });
    press($('btn-pace'), () => api.pace());
    press($('btn-sound'), () => api.sound());
    press($('btn-help'), () => this.toggleHelp());
    press($('btn-fs'), () => api.fullscreen());
    press($('again'), () => api.jump(0));
    if (matchMedia('(pointer: coarse)').matches) {
      $('help').innerHTML = '<div class="k">left thumb · walk and turn</div><div class="k">right thumb · look around</div><div class="k">the line below · jump to a painting</div><div class="k">1× in the corner · walk faster</div>';
      $('hint').textContent = 'Left thumb walks · right thumb looks';
    }
  }
  loading(text) { window.veil?.status(text); }
  // the veil has lifted: after a moment, how to walk
  begin() {
    this.hintT = setTimeout(() => { if (!this.awake) $('hint').classList.add('show'); }, 2400);
  }
  // the first touch of a hand: the line goes, and the road and the corner come up
  wake() {
    this.awake = true;
    clearTimeout(this.hintT);
    $('hint').classList.remove('show');
    document.body.classList.add('awake');
  }
  showHelp(on, ms) {
    const h = $('help');
    h.classList.toggle('on', on);
    clearTimeout(this.helpT);
    if (on && ms) this.helpT = setTimeout(() => h.classList.remove('on'), ms);
  }
  toggleHelp() { this.showHelp(!$('help').classList.contains('on')); }
  moved() {
    if (this._moved) return;
    this._moved = true;
    clearTimeout(this.helpT);
    this.helpT = setTimeout(() => $('help').classList.remove('on'), 6000);
  }
  setSound(on) { const b = $('btn-sound'); b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); b.title = on ? 'Sound on (M)' : 'Sound off (M)'; }
  setAuto(on) { $('auto').classList.toggle('on', on); }
  setPace(k) {
    const b = $('btn-pace');
    b.textContent = `${k}×`;
    b.classList.toggle('on', k !== 1);
    b.title = `Walking speed ${k}× (X)`;
    b.setAttribute('aria-label', k === 1 ? 'Walking speed, normal' : `Walking speed, ${k} times`);
  }
  update(S) {
    $('j-fill').style.width = (S.tau * 100).toFixed(3) + '%';
    $('j-dot').style.left = (S.tau * 100).toFixed(3) + '%';
    // going through a door: the painting's name comes up as its world does
    if (S.begun && S.station !== this.cur) { this.cur = S.station; this.arrive(S.station); }
    // at the end of the road the card waits for his portrait to be finished, and takes the plaque's place
    const end = S.tau > 0.975 && S.done !== false;
    const p = S.near;
    if (p && p.dist < 8 && !end) {
      if (this._pl !== p.key) { this._pl = p.key; $('pl-title').textContent = p.title; $('pl-sub').textContent = p.sub; }
      $('plaque').classList.add('on');
    } else $('plaque').classList.remove('on');
    $('end').classList.toggle('on', end);
  }
  arrive(i) {
    const s = this.st[i], last = i === this.st.length - 1;
    const el = $('station');
    el.classList.remove('on');
    clearTimeout(this.stT);
    $('j-name').textContent = last ? '' : s.title || '';
    // the bare canvas at the end has no card: the one fading out keeps its words
    if (last || !s.title) return;
    $('st-place').textContent = [s.place, s.when].filter(Boolean).join(' · ');
    $('st-title').textContent = s.title;
    $('st-sub').textContent = s.where || '';
    void el.offsetWidth;
    el.classList.add('on');
    this.stT = setTimeout(() => el.classList.remove('on'), 7500);
  }
}
