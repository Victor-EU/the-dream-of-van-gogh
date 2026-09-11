// The interface: one line that says how until a hand moves, one card of keys, the name of each place as you
// arrive, his words, a plaque by each painting, and the road itself as a line along the bottom that you can
// click to travel. The opening is the veil's (src/veil.js).
import { stationZ, tauAt } from './journey.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(stations, api) {
    this.st = stations;
    this.api = api;
    this.cur = -1;
    this.from = Infinity;
    const ticks = $('j-ticks');
    stations.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'tick';
      b.type = 'button';
      b.style.left = (tauAt(stationZ(i)) * 100).toFixed(2) + '%';
      const name = s.json.title || s.place, when = s.json.when || '';
      b.innerHTML = `<i></i><span>${esc(name)}${when ? `<em>${esc(when)}</em>` : ''}</span>`;
      b.setAttribute('aria-label', `Go to ${name}${when ? ', ' + when : ''}`);
      b.addEventListener('click', e => { e.stopPropagation(); api.jump(i); });
      ticks.appendChild(b);
    });
    $('btn-sound').addEventListener('click', () => api.sound());
    $('btn-help').addEventListener('click', () => this.toggleHelp());
    $('btn-fs').addEventListener('click', () => api.fullscreen());
    $('again').addEventListener('click', () => api.jump(0));
    if (matchMedia('(pointer: coarse)').matches) {
      $('help').innerHTML = '<div class="k">left thumb · walk and turn</div><div class="k">right thumb · look around</div><div class="k">the line below · travel</div>';
      $('hint').textContent = 'Left thumb walks · right thumb looks';
    }
  }
  loading(text) { window.veil?.status(text); }
  // the veil has lifted: once the world has come up, say where you stand, and after a moment how to walk
  begin() {
    this.from = performance.now() + 900;
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
  update(S) {
    $('j-fill').style.width = (S.tau * 100).toFixed(3) + '%';
    $('j-dot').style.left = (S.tau * 100).toFixed(3) + '%';
    if (S.date !== this._date) { this._date = S.date; $('j-date').textContent = S.date; }
    // the walk begins 44 m short of the first station, so where you stand is named once, as the veil lifts
    const here = S.stationDist < 42 || (this.cur === -1 && performance.now() > this.from);
    if (S.begun && here && S.station !== this.cur) { this.cur = S.station; this.arrive(S.station); }
    if (S.stationDist > 52 && this.cur === S.station) { clearTimeout(this.lT1); $('letter').classList.remove('on'); }
    if (S.stationDist > 52 && this.cur !== -1 && S.station !== this.cur) { clearTimeout(this.lT1); $('letter').classList.remove('on'); }
    const p = S.near;
    if (p && p.dist < 8) {
      if (this._pl !== p.key) { this._pl = p.key; $('pl-title').textContent = p.title; $('pl-sub').textContent = p.sub; }
      $('plaque').classList.add('on');
    } else $('plaque').classList.remove('on');
    $('end').classList.toggle('on', S.tau > 0.975);
  }
  arrive(i) {
    const s = this.st[i], j = s.json;
    $('st-place').textContent = [s.place, j.when].filter(Boolean).join(' · ');
    $('st-title').textContent = j.title || '';
    $('st-sub').textContent = j.where || '';
    const el = $('station');
    el.classList.remove('on');
    void el.offsetWidth;
    if (j.title && i < this.st.length - 1) el.classList.add('on');
    clearTimeout(this.stT);
    this.stT = setTimeout(() => el.classList.remove('on'), 7500);
    clearTimeout(this.lT1); clearTimeout(this.lT2);
    $('letter').classList.remove('on');
    const L = j.letter;
    if (L && L.text) {
      this.lT1 = setTimeout(() => {
        $('letter-q').textContent = L.text;
        $('letter-c').textContent = `Vincent to ${L.to}, ${L.place}, ${L.date} · letter ${L.n}`;
        $('letter').classList.add('on');
        this.showHelp(false);
        this.lT2 = setTimeout(() => $('letter').classList.remove('on'), 12000);
      }, 4000);
    }
  }
}
