// The interface: a title over the living world, one card of keys, the name of
// each place as you arrive, his words, a plaque by each painting, and the
// road itself as a line along the bottom that you can click to travel.
import { stationZ, tauAt } from './journey.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
      const name = s.json.title || s.place, when = s.json.when || '';
      b.innerHTML = `<i></i><span>${esc(name)}${when ? `<em>${esc(when)}</em>` : ''}</span>`;
      b.setAttribute('aria-label', `Go to ${name}${when ? ', ' + when : ''}`);
      b.addEventListener('click', e => { e.stopPropagation(); api.jump(i); });
      ticks.appendChild(b);
    });
    $('btn-sound').addEventListener('click', () => api.sound());
    $('btn-help').addEventListener('click', () => this.toggleHelp());
    $('btn-fs').addEventListener('click', () => api.fullscreen());
    $('begin').addEventListener('click', () => api.begin());
    $('again').addEventListener('click', () => api.jump(0));
    if (matchMedia('(pointer: coarse)').matches) {
      $('help').innerHTML = '<div class="k">left thumb · walk and turn</div><div class="k">right thumb · look around</div><div class="k">the line below · travel</div>';
      document.querySelector('#title .keys').textContent = 'Left thumb walks · right thumb looks · best with sound';
    }
  }
  loading(f, text) {
    $('loadbar').firstElementChild.style.transform = `scaleX(${f})`;
    if (text) $('begin-text').textContent = text;
  }
  ready() {
    $('begin').disabled = false;
    $('begin-text').textContent = 'Begin the walk';
    $('title').classList.add('ready');
  }
  showTitle() { $('title').classList.add('show'); }
  hideTitle() { $('title').classList.add('gone'); document.body.classList.add('begun'); }
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
    if (S.begun && S.stationDist < 42 && S.station !== this.cur) { this.cur = S.station; this.arrive(S.station); }
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
