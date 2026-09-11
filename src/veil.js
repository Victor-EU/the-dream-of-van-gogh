// The opening. Monet's Universe opens on a veil of the pond's palette washing in while its world is mixed; this
// one opens on The Starry Night, painted in front of you on a primed canvas from his own stroke record -- the
// canvas that stands on its easel at Saint-Rémy -- in the order the pipeline solved: the village, the hills and
// the cypress first, the wind after, the stars and the moon last. When the world behind it is ready, you go
// into the painting and it dissolves into the world.
//
// One file in two places. In the page it lays the veil out and hands its canvas to a worker; in the worker it
// paints, so the long task in which the world is built never stops the brush. Where a canvas cannot be handed
// over, it paints in the page.
(() => {
  const BLOB = 'strokes/s08/starry-canvas.bin';   // stations/s08-saint-remy.json
  const ASPECT = 92.1 / 73.7;                     // the canvas, in centimetres
  const PLAY = 3.2;                               // seconds for all 13,999 strokes
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function painter(cv, say) {
    const ctx = cv.getContext('2d');
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : f => setTimeout(() => f(performance.now()), 16);
    const L = new Float32Array(12), R = new Float32Array(12);
    let w = 1, h = 1, S = null, drawn = 0, clock = 0, last = -1, all = false, stop = false, started = false;
    let t0 = -1, sent = 0, ticks = 0, gap = 0;

    async function load(url) {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const b = await r.arrayBuffer(), v = new DataView(b);
        if (v.getUint32(0, true) !== 0x54534756) throw new Error('not a stroke record');   // "VGST"
        // the record as canvases.js reads it: 24 bytes a stroke -- a quadratic's three points, the colour, the
        // width, and the order the pipeline solved
        const hdr = v.getUint16(6, true), n = v.getUint32(12, true);
        const lo = v.getFloat32(52, true), span = v.getFloat32(56, true) - lo, wk = v.getFloat32(60, true);
        const u16 = new Uint16Array(b, hdr, n * 12), u8 = new Uint8Array(b, hdr, n * 24);
        const P = new Float32Array(n * 6), W = new Float32Array(n), C = [], Hi = [], Lo = [];
        const up = c => Math.min(255, c * 1.2 + 24) | 0, dn = c => c * 0.6 | 0;
        for (let i = 0; i < n; i++) {
          for (let k = 0; k < 6; k++) P[i * 6 + k] = u16[i * 12 + k] / 65535 * span + lo;
          W[i] = u8[i * 24 + 15] / 255 * wk;
          const r0 = u8[i * 24 + 12], g0 = u8[i * 24 + 13], b0 = u8[i * 24 + 14];
          C.push(`rgb(${r0},${g0},${b0})`);
          Hi.push(`rgba(${up(r0)},${up(g0)},${up(b0)},0.5)`);
          Lo.push(`rgba(${dn(r0)},${dn(g0)},${dn(b0)},0.45)`);
        }
        const ord = new Uint32Array(n).map((_, i) => i).sort((a, c) => u16[a * 12 + 10] - u16[c * 12 + 10]);
        S = { n, P, W, C, Hi, Lo, ord };
        say({ playing: true });
      } catch (e) {
        stop = true;
        say({ painted: true, failed: String(e.message || e) });
      }
    }

    // a ridge of the loaded brush, offset from the stroke's spine, a little short of its ends
    function ridge(x0, y0, x1, y1, x2, y2, nx, ny, d, col) {
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(x0 + (x1 - x0) * 0.25 + nx * d, y0 + (y1 - y0) * 0.25 + ny * d);
      ctx.quadraticCurveTo(x1 + nx * d, y1 + ny * d, x2 + (x1 - x2) * 0.25 + nx * d, y2 + (y1 - y2) * 0.25 + ny * d);
      ctx.stroke();
    }
    function stroke(j) {
      const i = S.ord[j], o = i * 6, P = S.P;
      const x0 = P[o] * w, y0 = P[o + 1] * h, x1 = P[o + 2] * w, y1 = P[o + 3] * h, x2 = P[o + 4] * w, y2 = P[o + 5] * h;
      const hw = 0.5 * S.W[i] * Math.min(w, h);
      // the ribbon the easel draws, as a polygon: along the curve and out to each side, tapered at both ends
      for (let k = 0; k < 6; k++) {
        const t = k / 5, m = 1 - t;
        const x = m * m * x0 + 2 * t * m * x1 + t * t * x2, y = m * m * y0 + 2 * t * m * y1 + t * t * y2;
        const tx = m * (x1 - x0) + t * (x2 - x1), ty = m * (y1 - y0) + t * (y2 - y1);
        const q = hw * (0.3 + 0.7 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(2 * t - 1), 6)))) / (Math.hypot(tx, ty) || 1);
        L[k * 2] = x - ty * q; L[k * 2 + 1] = y + tx * q;
        R[k * 2] = x + ty * q; R[k * 2 + 1] = y - tx * q;
      }
      ctx.beginPath();
      ctx.moveTo(L[0], L[1]);
      for (let k = 1; k < 6; k++) ctx.lineTo(L[k * 2], L[k * 2 + 1]);
      for (let k = 5; k >= 0; k--) ctx.lineTo(R[k * 2], R[k * 2 + 1]);
      ctx.closePath();
      ctx.fillStyle = S.C[i];
      ctx.fill();
      // one ridge catches the light from the upper left, the other lies in its own shadow
      const cx = x2 - x0, cy = y2 - y0, cl = Math.hypot(cx, cy) || 1, nx = -cy / cl, ny = cx / cl;
      const lit = nx * 0.6 + ny * 0.8 < 0 ? 1 : -1;
      ctx.lineWidth = Math.max(0.6, hw * 0.3);
      ridge(x0, y0, x1, y1, x2, y2, nx, ny, lit * 0.4 * hw, S.Hi[i]);
      ridge(x0, y0, x1, y1, x2, y2, nx, ny, -lit * 0.45 * hw, S.Lo[i]);
    }

    // the strokes come slowly at first, one by one, then in a flurry, then slowly again for the last lights. A
    // stalled frame holds the brush rather than dropping a lump of strokes at once
    function tick(now) {
      if (stop) return;
      if (last < 0) last = now;
      const d = now - last;
      last = now;
      if (S) {
        if (t0 < 0) t0 = now; else { ticks++; gap = Math.max(gap, d); }
        clock += Math.min(0.05, Math.max(0, d / 1000));
        const k = all ? 1 : Math.min(1, clock / PLAY), e = k * k * (3 - 2 * k);
        const n = Math.round(e * S.n);
        for (; drawn < n; drawn++) stroke(drawn);
        if (k >= 1) { say({ painted: true, stats: { ms: Math.round(now - t0), ticks, gap: Math.round(gap) } }); return; }
        if (now - sent > 100) { sent = now; say({ progress: e }); }
      }
      raf(tick);
    }
    function size(m) {
      w = m.w; h = m.h;
      cv.width = Math.max(1, Math.round(w * m.dpr));
      cv.height = Math.max(1, Math.round(h * m.dpr));
      ctx.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (S) for (let j = 0; j < drawn; j++) stroke(j);
    }
    return {
      msg(m) {
        if (m.w) size(m);
        if (m.all) all = true;
        if (m.stop) stop = true;
        if (m.url && !started) { started = true; load(m.url); raf(tick); }
      },
    };
  }

  // ------------------------------------------------------------------ the worker --
  if (typeof document === 'undefined') {
    let P = null;
    onmessage = e => {
      if (e.data.canvas) P = painter(e.data.canvas, d => postMessage(d));
      if (P) P.msg(e.data);
    };
    return;
  }

  // -------------------------------------------------------------------- the page --
  const $ = id => document.getElementById(id);
  const V = $('veil');
  const api = window.veil = { up: false, painted: true, stats: null, status() {}, lift() {}, skip() {} };
  if (!V) return;
  const Q = new URLSearchParams(location.search);
  if (Q.has('notitle') || Q.has('at')) { V.hidden = true; return; }

  const art = $('veil-art'), box = $('veil-canvas'), cv = $('veil-cv'), under = $('veil-under'), line = $('veil-status');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const me = document.currentScript && document.currentScript.src;
  let worker = null, local = null;

  function done() {
    V.hidden = true;
    if (worker) worker.terminate();
    worker = null;
    if (local) local.msg({ stop: true });
  }
  Object.assign(api, {
    up: true, painted: false,
    status(t) { line.textContent = t || ''; line.classList.toggle('off', !t); },
    // the world is ready: the painting comes towards you until its edges have left the window, and dissolves
    lift() { if (!api.up) return; api.up = false; V.classList.add('lift'); setTimeout(done, 2600); },
    skip() { if (!api.up) return; api.up = false; done(); },
  });

  // the canvas as large as the window allows, at its own proportions, with its plaque and the title under it,
  // the three together in the middle of the window
  function layout() {
    const W = innerWidth, H = innerHeight, gap = Math.max(58, H * 0.075), foot = 84;
    const bh = Math.min(H * 0.7, (H - gap - foot) * 0.92, W * 0.9 / ASPECT), bw = bh * ASPECT;
    const x = (W - bw) / 2, y = Math.max(14, (H - bh - gap - foot) / 2);
    Object.assign(box.style, { left: x + 'px', top: y + 'px', width: bw + 'px', height: bh + 'px' });
    V.querySelector('.veil-title').style.top = y + bh + gap + 'px';
    art.style.transformOrigin = `${x + bw / 2}px ${y + bh / 2}px`;
    V.style.setProperty('--fill', (Math.max(W / bw, H / bh) * 1.08).toFixed(3));
    return { w: bw, h: bh, dpr: Math.min(devicePixelRatio || 1, 2) };
  }
  // the extractor's underlayer comes up behind the strokes as they are laid, never ahead of them
  function heard(m) {
    if (m.playing) V.classList.add('under');
    if (m.progress != null) under.style.opacity = (0.94 * smooth(0.1, 0.9, m.progress)).toFixed(3);
    if (m.painted) {
      api.painted = true;
      api.stats = m.stats || null;
      under.style.opacity = '0.94';
      V.classList.add('painted');
      if (m.failed) { V.classList.add('bare'); console.warn('veil: no stroke record,', m.failed); }
    }
  }

  // his stars and the moon, where config.js places them on this canvas, breathe once the painting is done
  [[0.07, 0.13], [0.23, 0.07], [0.34, 0.24], [0.50, 0.12], [0.61, 0.20], [0.70, 0.31],
   [0.13, 0.46], [0.28, 0.44], [0.57, 0.46], [0.66, 0.06], [0.93, 0.33], [0.88, 0.12, 1]].forEach(([u, v, moon], i) => {
    const g = document.createElement('i');
    g.className = moon ? 'glow moon' : 'glow';
    g.style.left = u * 100 + '%';
    g.style.top = v * 100 + '%';
    g.style.animationDelay = (-i * 0.61).toFixed(2) + 's';
    box.appendChild(g);
  });

  if (under.complete && !under.naturalWidth) under.remove();
  else under.addEventListener('error', () => under.remove());
  const type = () => V.classList.add('type');
  if (document.fonts) document.fonts.ready.then(type);
  setTimeout(type, 1000);

  const first = { ...layout(), url: new URL(BLOB, location.href).href, all: calm };
  try {
    if (typeof OffscreenCanvas === 'undefined' || !cv.transferControlToOffscreen || !me || !new OffscreenCanvas(1, 1).getContext('2d')) throw 0;
    worker = new Worker(me);
    worker.onmessage = e => heard(e.data);
    worker.onerror = () => heard({ painted: true, failed: 'the painter did not start' });
    const off = cv.transferControlToOffscreen();
    worker.postMessage({ canvas: off, ...first }, [off]);
  } catch {
    if (worker) worker.terminate();
    worker = null;
    local = painter(cv, heard);
    local.msg(first);
  }
  addEventListener('resize', () => {
    if (!api.up) return;
    const m = layout();
    if (worker) worker.postMessage(m); else if (local) local.msg(m);
  });
})();
