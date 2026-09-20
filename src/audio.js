// Sound, made on the page, no samples (DESIGN 10). Four layers, each keyed to something you are doing: the wind
// by your speed through the air, the water under you, the eddies' tone as you enter one, and the square's murmur
// near the terrace. Nothing melodic, and nothing that marks an event.
//
// D3 builds the first of the four. The water is low, it is under you, it is louder the lower you fly and it is
// gone above fifty metres -- which is the one thing the design says about it, and the one thing a body a metre
// over a river actually hears. It is brown noise through a low-pass that opens as you come down, because water
// heard from far off is only its low end and water heard from a metre away has the slap of the small waves in
// it; a second, narrower band gives that slap, and it breathes at the rate the reflections' own wave breathes
// at (src/water.js, the wave), so that what you hear and what you see move together. The other three layers are
// D5's, and this file says so rather than pretending they are here.
const LAYERS = ['water', 'wind', 'eddies', 'square'];

function noiseBuffer(ctx, sec, colour) {
  const n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (colour === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (colour === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18; }
      else d[i] = w;
    }
  }
  return buf;
}

export class Sound {
  constructor(o = {}) {
    this.on = false; this.ctx = null;
    this.gone = o.gone ?? 50;          // above this many metres there is no water to hear (DESIGN 10)
    this.rate = o.rate ?? 0.37;        // the wave the reflections ripple with, so the two are one thing
    this.built = ['water'];
    this.pending = [];
  }
  // a browser will not make a sound until a person has done something, so the first gesture starts it
  arm(el) {
    const go = () => { if (!this.ctx) this.start(); };
    for (const e of ['pointerdown', 'keydown', 'touchstart']) el.addEventListener(e, go, { once: true, passive: true });
  }
  start() {
    if (!this.ctx) { try { this.build(); } catch (e) { console.warn('no sound:', e.message); return false; } }
    this.setOn(true);
    return true;
  }
  toggle() { if (!this.ctx) return this.start(); this.setOn(!this.on); return this.on; }
  setOn(v) {
    this.on = v;
    if (!this.ctx) return;
    if (v && this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(v ? 0.9 : 0, t, 0.4);
  }
  build() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 3;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    this.master.connect(comp).connect(ctx.destination);
    const loop = buf => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
    // the body of the water: brown noise, low, whose top opens as you come down to it
    this.bodyF = filt('lowpass', 160, 0.8); this.bodyG = gain(0);
    loop(noiseBuffer(ctx, 7, 'brown')).connect(this.bodyF).connect(this.bodyG).connect(this.master);
    // and the slap of the small waves, a narrow band that is only there when you are near
    this.slapF = filt('bandpass', 700, 0.9); this.slapG = gain(0);
    loop(noiseBuffer(ctx, 5, 'white')).connect(this.slapF).connect(this.slapG).connect(this.master);
  }
  // Called every frame; it acts ten times a second, because nothing here moves faster than that and a browser
  // whose sound is not running (no device, or a page that has never been touched) keeps its clock at zero, and
  // writing a ramp at the same instant sixty times a second piles up work that never gets done
  update({ y = 100, time = 0, dt = 0 } = {}) {
    // near is one at the floor and nothing at fifty metres, and it falls away as the sound does, not as the
    // height does: a river at ten metres is a good deal more than a fifth of a river at one
    const h = Math.max(0, y - 1);
    const near = Math.max(0, 1 - h / this.gone) ** 1.6;
    const wave = 0.82 + 0.18 * Math.sin(time * this.rate * 6.2832) * Math.sin(time * 0.081 + 0.7);
    this.want = { y: +y.toFixed(2), near: +near.toFixed(4), body: +(0.30 * near * wave).toFixed(4),
                  slap: +(0.055 * near * near * wave).toFixed(4), cut: Math.round(150 + 520 * near) };
    if (!this.ctx || !this.on || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    if (t - (this._last ?? -1) < 0.1) return;
    this._last = t;
    this.bodyG.gain.setTargetAtTime(this.want.body, t, 0.35);
    this.bodyF.frequency.setTargetAtTime(this.want.cut, t, 0.4);
    this.slapG.gain.setTargetAtTime(this.want.slap, t, 0.3);
    this.slapF.frequency.setTargetAtTime(520 + 900 * near, t, 0.5);
  }
  // for the ledger and the harness: what the layer asks for at this height, and what the graph is actually at.
  // The two differ where a browser is not making a sound at all, which is what a headless one does
  state() {
    const g = k => (this.ctx && this[k] ? +this[k].gain.value.toFixed(4) : 0);
    return { on: this.on, started: !!this.ctx, running: this.ctx ? this.ctx.state : 'none',
             layers: LAYERS, built: this.built, gone_above_m: this.gone, wave_rate: this.rate,
             asks: this.want || null,
             plays: { body: g('bodyG'), slap: g('slapG'), cut: this.ctx ? Math.round(this.bodyF.frequency.value) : 0 } };
  }
}
