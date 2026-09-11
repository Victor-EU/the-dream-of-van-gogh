// Sound, made on the spot: the wind (and the mistral at La Crau), birds by
// day, crickets and the river at night, the crows over the wheat, your own
// steps, the bristles on the cloth while a painting paints itself, and under it
// all a quiet chord that changes key from one place to the next.
const CHORDS = [
  [146.8, 220.0, 349.2, 293.7],   // Nuenen: D minor
  [174.6, 261.6, 440.0, 349.2],   // Paris: F
  [110.0, 164.8, 277.2, 440.0],   // Arles in blossom: A
  [146.8, 220.0, 370.0, 293.7],   // the harvest: D
  [98.0, 146.8, 246.9, 392.0],    // the Yellow House: G
  [164.8, 246.9, 392.0, 329.6],   // the night of Arles: E minor
  [164.8, 246.9, 415.3, 329.6],   // the red vineyard: E, the night's key by daylight
  [116.5, 174.6, 293.7, 523.3],   // Saint-Remy: B flat, with the ninth
  [130.8, 196.0, 329.6, 523.3],   // Auvers: C
  [146.8, 220.0, 261.6, 349.2],   // the wheatfield: D minor seventh
  null,                           // after
];
// his portrait at the end of the road brings a chord back into the silence after: F, Paris's key, where he painted it
const CODA = CHORDS[1];

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

function cricketBuffer(ctx) {
  const sr = ctx.sampleRate, n = Math.floor(sr * 3.1), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  for (let t0 = 0.05; t0 < 3.0; t0 += 0.42 + Math.random() * 0.12) {
    for (let k = 0; k < 3; k++) {
      const s0 = Math.floor((t0 + k * 0.034) * sr), len = Math.floor(0.018 * sr);
      for (let i = 0; i < len && s0 + i < n; i++) {
        const env = Math.sin(Math.PI * i / len);
        d[s0 + i] += Math.sin(2 * Math.PI * 4700 * i / sr) * env * 0.6;
      }
    }
  }
  return buf;
}

export class Sound {
  constructor(stations) { this.st = stations; this.on = false; this.ctx = null; this.chord = -1; }
  start() {
    if (!this.ctx) { try { this.build(); } catch (e) { console.warn('no sound:', e.message); return; } }
    this.setOn(true);
  }
  toggle() { if (!this.ctx) { this.start(); return this.on; } this.setOn(!this.on); return this.on; }
  setOn(v) {
    this.on = v;
    if (!this.ctx) return;
    if (v && this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(v ? 0.9 : 0, t, 0.35);
  }
  build() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 3;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    this.master.connect(comp).connect(ctx.destination);
    const loop = (buf, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };
    const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };

    this.windF = filt('bandpass', 500, 0.6); this.windG = gain(0);
    loop(noiseBuffer(ctx, 6, 'pink')).connect(this.windF).connect(this.windG).connect(this.master);
    this.rumbleG = gain(0);
    loop(noiseBuffer(ctx, 5, 'brown')).connect(filt('lowpass', 170)).connect(this.rumbleG).connect(this.master);
    this.riverG = gain(0);
    loop(noiseBuffer(ctx, 4, 'white')).connect(filt('bandpass', 1400, 0.8)).connect(this.riverG).connect(this.master);
    this.cricketG = gain(0); this.cricketG.connect(this.master);
    const cb = cricketBuffer(ctx);
    [[1, -0.55], [1.07, 0.6], [0.94, 0.1]].forEach(([r, pan], k) => {
      const s = ctx.createBufferSource(); s.buffer = cb; s.loop = true; s.playbackRate.value = r;
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      s.connect(p).connect(this.cricketG); s.start(ctx.currentTime + k * 0.37);
    });
    this.brushG = gain(0);
    loop(noiseBuffer(ctx, 3, 'white')).connect(filt('bandpass', 3200, 1.1)).connect(this.brushG).connect(this.master);
    this.stepBuf = noiseBuffer(ctx, 0.3, 'white');
    // the chord: four soft voices through a low-pass, gliding from key to key
    this.padG = gain(0);
    const lp = filt('lowpass', 1100, 0.5);
    lp.connect(this.padG).connect(this.master);
    this.voices = [0, 1, 2, 3].map(i => {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = 220; o.detune.value = (i - 1.5) * 4;
      const g = gain(i === 0 ? 0.5 : 0.3), p = ctx.createStereoPanner(); p.pan.value = (i - 1.5) * 0.4;
      const lfo = ctx.createOscillator(), lg = gain(0.12); lfo.frequency.value = 0.07 + i * 0.03; lfo.connect(lg).connect(g.gain); lfo.start();
      o.connect(g).connect(p).connect(lp); o.start();
      return o;
    });
    this.nextBird = 0; this.nextCrow = 0; this.phase = 0.6;
  }
  bird() {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.02, pan = ctx.createStereoPanner(), out = ctx.createGain();
    pan.pan.value = Math.random() * 1.6 - 0.8; out.gain.value = 0.045;
    out.connect(pan).connect(this.master);
    const base = 2400 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.08 + Math.random() * 0.07), o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.3), t);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t + 0.07);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.1);
    }
  }
  caw() {
    const ctx = this.ctx, pan = ctx.createStereoPanner(), out = ctx.createGain();
    pan.pan.value = Math.random() * 1.8 - 0.9; out.gain.value = 0.07;
    out.connect(pan).connect(this.master);
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + 0.02 + i * 0.42, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(520 + Math.random() * 60, t); o.frequency.linearRampToValueAtTime(430, t + 0.26);
      const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
      f1.type = f2.type = 'bandpass'; f1.frequency.value = 1150; f2.frequency.value = 2300; f1.Q.value = f2.Q.value = 4;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(f1).connect(g); o.connect(f2).connect(g); g.connect(out); o.start(t); o.stop(t + 0.32);
    }
  }
  step(speed) {
    const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime;
    s.buffer = this.stepBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    f.type = 'lowpass'; f.frequency.value = 700 + Math.random() * 500;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06 * Math.min(1, speed / 3), t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + 0.15);
  }
  update({ s, v, dt, time, stations, painting = 0, coda = false }) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const a = Math.floor(s), b = Math.min(a + 1, stations.length - 1), f = s - a;
    const A = stations[a].audio || {}, B = stations[b].audio || {};
    const lv = k => (A[k] || 0) * (1 - f) + (B[k] || 0) * f;
    const wind = lv('wind'), gust = 0.55 + 0.45 * Math.sin(time * 0.23) * Math.sin(time * 0.071 + 1);
    this.windG.gain.setTargetAtTime(0.2 * wind * gust, t, 0.3);
    this.windF.frequency.setTargetAtTime(380 + 520 * gust * wind, t, 0.5);
    this.rumbleG.gain.setTargetAtTime(0.14 * wind * wind, t, 0.5);
    this.cricketG.gain.setTargetAtTime(0.05 * lv('night'), t, 0.8);
    this.riverG.gain.setTargetAtTime(0.05 * lv('river'), t, 0.8);
    this.brushG.gain.setTargetAtTime(0.09 * painting * (0.35 + 0.65 * Math.random()), t, 0.025);
    if (time > this.nextBird) { const l = lv('birds'); if (Math.random() < l) this.bird(); this.nextBird = time + 1.2 + Math.random() * 3.5; }
    if (time > this.nextCrow) { const l = lv('crows'); if (Math.random() < l) this.caw(); this.nextCrow = time + 2.5 + Math.random() * 5; }
    const speed = Math.abs(v);
    if (speed > 0.4) { this.phase += dt * (1.2 + speed * 0.27); if (this.phase > 1) { this.phase -= 1; this.step(speed); } }
    else this.phase = 0.6;
    const k = coda ? 'coda' : Math.round(s);
    if (k !== this.chord) {
      this.chord = k;
      const ch = coda ? CODA : CHORDS[k];
      this.padG.gain.setTargetAtTime(ch ? 0.03 : 0, t, ch ? 2.5 : 1.2);
      if (ch) this.voices.forEach((o, i) => o.frequency.setTargetAtTime(ch[i], t, 1.6));
    }
  }
}
