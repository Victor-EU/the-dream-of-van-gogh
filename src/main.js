// The Dream of Van Gogh. The world is the painting: you stand on a knoll over Saint-Remy at night, and everything
// round you is made of his strokes -- the sky a turning dome of his swirls and his stars, the hills rolling to the
// river, the village with its lit windows and its spire, the cypress a flame beside you, and his sunflowers loose
// in the air. The arrows go where you look.
import * as THREE from 'three';
import { makeBrushAtlas, NOISE } from './brush.js';
import { Paint, LOG_VERT, LOG_PASS, LOG_FRAG, LOG_DEPTH } from './paint.js';
import { Flight, LOOK } from './flight.js';
import { Film, script, LINES, WAKE } from './film.js';
import { Post } from './post.js';
import * as W from './world.js';
import { lin, clamp, lerp, smoothstep, DEG, dirAzEl, rng } from './util.js';

const Q = new URLSearchParams(location.search);
const has = k => Q.has(k);

function fail(title, err) {
  document.getElementById('fail-h').textContent = title;
  document.getElementById('fail-p').textContent = String((err && err.message) || err);
  document.getElementById('fail-c').textContent = (err && err.stack) || '';
  document.getElementById('fail').hidden = false;
  console.error(err);
}
addEventListener('error', e => fail('Something stopped the paint.', e.error || e.message));
addEventListener('unhandledrejection', e => fail('Something stopped the paint.', e.reason));

const HFOV = 70;
const PART = 3;                                   // the parting radius, m: the paint moves aside for the body
const REACH = 1400;                               // how far from the middle of the world the body may go: to a star, 100 m short of its core
const PERSON = 1.7;
// the standpoint: on the brow of the knoll south of the village, looking north over it, a little up at the sky
const EYE = { x: 0, z: 100, yaw: 0, pitch: 9 };
const REVEAL_S = 7;                               // the world paints itself in over this many seconds

// what is behind the paint: a night gradient, and the ground's dark below the horizon
const DOME_VERT = /* glsl */`varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position * 3000.0, 1.0); gl_Position = p.xyww; }`;
const DOME_FRAG = /* glsl */`
  varying vec3 vDir; uniform vec3 uZen, uHor, uGround;
  void main() {
    vec3 d = normalize(vDir); float e = asin(clamp(d.y, -1.0, 1.0)) / 1.5708;
    vec3 c = mix(uHor, uZen, smoothstep(0.0, 0.8, e));
    c = mix(c, uGround, smoothstep(0.01, -0.02, e));
    gl_FragColor = vec4(c, 1.0);
  }`;
const LAND_VERT = /* glsl */`varying vec3 vW; ${LOG_VERT} void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); ${LOG_PASS} }`;
const LAND_FRAG = /* glsl */`
  ${NOISE}
  varying vec3 vW; uniform vec3 uLow, uHigh, uCam; uniform float uDark;
  ${LOG_FRAG}
  void main() {
    ${LOG_DEPTH}
    float n = fbm(vW.xz * 0.02);
    vec3 c = mix(uLow, uHigh, clamp(smoothstep(-2.0, 120.0, vW.y) * 0.8 + (n - 0.5) * 0.5, 0.0, 1.0));
    c *= exp(-length(vW - uCam) * uDark);
    gl_FragColor = vec4(c, 1.0);
  }`;

async function boot() {
  const say = t => { if (window.veil) window.veil.status(t); };
  say('Reading his strokes');
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  const qual = Q.get('q') || (matchMedia('(pointer: coarse)').matches ? 'low' : 'mid');
  const budget = qual === 'high' ? 5.5e6 : qual === 'low' ? 1.2e6 : 3.2e6;
  renderer.setPixelRatio(Math.max(0.75, Math.min(devicePixelRatio || 1, qual === 'high' ? 2 : 1.5, Math.sqrt(budget / (innerWidth * innerHeight)))));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const cv = renderer.domElement;
  cv.tabIndex = 0;
  cv.setAttribute('aria-label', 'The Dream of Van Gogh. Drag to look. The up arrow goes where you look, the down arrow back, left and right turn; Shift is faster. Nothing pressed, nothing moves. Space, and the dream flies you.');
  document.getElementById('stage').appendChild(cv);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.2, 9000);
  let hfov = HFOV;

  const U = {
    uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uHead: { value: new THREE.Vector3(0, 0, -1) },
    uBrush: { value: makeBrushAtlas() },
    uKeyDir: { value: new THREE.Vector3() }, uKeyCol: { value: new THREE.Color() },
    uDark: { value: 1 / 12000 }, uGlow: { value: +(Q.get('glow') ?? 1) },
    uCurl: { value: has('nocurl') || has('test') ? 0 : 1 },
    uPart: { value: has('nopart') || has('test') ? 0 : PART }, uPartA: { value: PART }, uPartB: { value: 2 * PART },
    uFocalPx: { value: 800 }, uUnder: { value: has('nounder') ? 0 : 1 },
  };
  const md = dirAzEl(W.MOON.az, W.MOON.el);
  U.uKeyDir.value.set(md[0], md[1], md[2]).normalize();
  U.uKeyCol.value.setRGB(...lin('#fff0c8').map(c => c * 0.7));

  const post = new Post(renderer);
  const scene = new THREE.Scene();

  // his colours, region by region
  const his = await W.loadHisColours();
  const pools = his.pools;
  const at = (pool, q) => pool[clamp(Math.floor(q * pool.length), 0, pool.length - 1)];
  const skyLow = at(pools.sky, 0.12), skyMid = at(pools.sky, 0.3), hillLow = at(pools.hills, 0.2), hillHigh = at(pools.hills, 0.6);
  const domeU = { uZen: { value: new THREE.Color(...skyLow.map(c => c * 0.7)) }, uHor: { value: new THREE.Color(...skyMid.map(c => c * 0.9)) },
                  uGround: { value: new THREE.Color(...at(pools.hills, 0.08).map(c => c * 0.8)) } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.ShaderMaterial({ vertexShader: DOME_VERT, fragmentShader: DOME_FRAG,
    uniforms: domeU, side: THREE.BackSide, depthTest: false, depthWrite: false }));
  dome.frustumCulled = false; dome.renderOrder = -10;
  scene.add(dome);

  // the ground: a heightfield under the strokes, in the hills' own dark
  say('Raising the hills');
  const SEGS = 300, SIZE = 3400;
  const landG = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  landG.rotateX(-Math.PI / 2);
  { const p = landG.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, W.ground(p.getX(i), p.getZ(i))); p.needsUpdate = true; }
  const landU = { uLow: { value: new THREE.Color(...hillLow.map(c => c * 0.95)) }, uHigh: { value: new THREE.Color(...hillHigh.map(c => c * 0.95)) }, uCam: U.uCam, uDark: U.uDark };
  const land = new THREE.Mesh(landG, new THREE.ShaderMaterial({ vertexShader: LAND_VERT, fragmentShader: LAND_FRAG, uniforms: landU }));
  land.frustumCulled = false;
  scene.add(land);
  // the river: a strip of dark water along its path
  {
    const pos = [], idx = [];
    for (let i = 0; i < W.RIVER.length; i++) {
      const [x, z] = W.RIVER[i], a = W.RIVER[Math.max(0, i - 1)], b = W.RIVER[Math.min(W.RIVER.length - 1, i + 1)];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      pos.push(x + nx * W.RIVER_W * 0.55, W.RIVER_Y - 0.25, z + nz * W.RIVER_W * 0.55, x - nx * W.RIVER_W * 0.55, W.RIVER_Y - 0.25, z - nz * W.RIVER_W * 0.55);
      if (i) { const o = (i - 1) * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const water = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: LAND_VERT, fragmentShader: LAND_FRAG, side: THREE.DoubleSide,
      uniforms: { uLow: { value: new THREE.Color(...at(pools.sky, 0.1).map(c => c * 0.7)) }, uHigh: { value: new THREE.Color(...at(pools.sky, 0.1).map(c => c * 0.7)) }, uCam: U.uCam, uDark: U.uDark } }));
    water.frustumCulled = false;
    scene.add(water);
  }

  // the things, in his paint
  const only = Q.get('only') ? new Set(Q.get('only').split(',')) : null;
  const parts = [];
  const add = (name, ex, ov, mesh = null) => {
    if (!ex || !ex.n || has('no' + name)) return null;
    const st = new Paint(U, ex, ov);
    st.mesh.visible = !has('noStrokes') && (!only || only.has(name));
    scene.add(st.mesh);
    let p = parts.find(q => q.name === name);
    if (!p) { p = { name, n: 0, meshes: [] }; parts.push(p); }
    p.n += ex.n; p.meshes.push(st.mesh);
    return st;
  };
  const eyeAt = new THREE.Vector3(EYE.x, W.ground(EYE.x, EYE.z) + PERSON, EYE.z);
  const t0build = performance.now();
  say('Turning the sky');
  const ridge = az => 6 + 3 * Math.sin(2 * az + 0.4) + 2 * Math.sin(5 * az + 1.7) + 4 * Math.max(0, Math.cos(az));
  // the sky has depth (E1): its night lies in drifts 830 to 2,250 m out, each swirl is a well with its rim near
  // and its eye deep, and each star a well of rings down to its core; you fly into them. Depth is logarithmic
  // (paint.js), so the strokes sort exactly at any distance and the E0.2 flashing does not come back
  // and the stars' wells, which the paint keeps clear wherever the sky has turned its strokes (paint.js, E2)
  const wells = W.starWells(eyeAt.toArray()).slice(0, 20).map(w => new THREE.Vector4(...w.b, w.th));
  add('sky', W.makeSky({ pools, n: Math.round(+(Q.get('sky') ?? 1) * 120000), ridge, eye: eyeAt.toArray() }), { uEye: { value: new THREE.Vector3(0, 0, 0) },
    uWells: { value: wells.concat(Array.from({ length: 20 - wells.length }, () => new THREE.Vector4())) }, uWellN: { value: wells.length }, uWellEye: { value: eyeAt.clone() }, uWellR: { value: W.SKY_R } });
  add('stars', W.makeStars({ pools, eye: eyeAt.toArray() }), { uEye: { value: new THREE.Vector3(0, 0, 0) }, uSpinC: { value: eyeAt.clone() } });
  say('Laying the ground');
  add('ground', W.makeGround({ pools, n: Math.round(+(Q.get('ground') ?? 1) * 80000), radius: 1650 }), { uEye: { value: eyeAt.clone() }, uLie: { value: 1 } });
  const lights = W.STARS.filter(s => s.el < 32).map(s => ({ az: s.az, s: s.s })).concat([{ az: W.MOON.az, s: 2.2, moon: true }]);
  add('river', W.makeRiver({ pools, lights }), { uEye: { value: eyeAt.clone() }, uLie: { value: 1 } });
  say('Building the village');
  const village = W.makeVillage({ pools });
  add('village', village, { uEye: { value: eyeAt.clone() } });
  say('Growing the cypress');
  const cypresses = [], CYPRESSES = [[-28, 55, 78, 6, 61], [-50, 22, 46, 4, 62]];
  for (const [x, z, h, base, seed] of CYPRESSES) {
    const ex = W.makeCypress({ pools, height: h, base, seed, n: Math.round(h * 110) });
    const st = add('cypress', ex, { uEye: { value: new THREE.Vector3(0, h * 0.5, 0) }, uSway: { value: 0.0006 } });
    if (st) { st.mesh.position.set(x, W.ground(x, z) - 1.5, z); cypresses.push(st); }
  }
  say('The sunflowers');
  const SF = await W.loadHeads();
  const NF = +(Q.get('flowers') ?? 150);
  // the field (E1.2, E1.3): a plot of sunflowers in rows between the knoll and the village, facing the knoll. Its
  // far form is built here, two dabs a flower; its near forms are pools of slots that follow you (FieldDetail)
  const field = W.makeField({ SF, centre: [30, 8], size: [140, 125], yaw: -8 * DEG, avoid: village.houses, face: [0, 1] });
  const detail = new W.FieldDetail(field, SF, { budget: +(Q.get('budget') ?? 1500) });
  const fieldSt = add('field', field, { uEye: { value: eyeAt.clone() } });
  const tierSt = detail.tiers.map(T => add('field', T.ex, { uEye: { value: eyeAt.clone() } }));
  if (fieldSt) detail.bind(fieldSt.mesh.geometry, tierSt.map(st => st && st.mesh.geometry));
  const floating = [];
  {
    const rr = rng(8888);
    for (let i = 0; i < NF; i++) {
      const near = i < NF * 0.12;
      const D = near ? 1.6 + 2.2 * rr() : rr() < 0.08 ? 6 + 3 * rr() : 2.2 + 2.6 * rr();
      const ex = W.flower(SF, i, D, rr, { glow: 0.3 });
      const st = add('flowers', ex, { uEye: { value: new THREE.Vector3(0, 0, -30) } });
      if (!st) break;
      const ang = rr() * 6.2832, rad = near ? 6 + 18 * rr() : 30 + 250 * Math.sqrt(rr());
      const c = near ? [eyeAt.x + rad * Math.sin(ang), eyeAt.y + (rr() - 0.4) * 10, eyeAt.z - rad * Math.cos(ang)]
                     : [rad * Math.sin(ang), 3 + Math.pow(rr(), 1.4) * 130, -60 - rad * Math.cos(ang)];
      c[1] = Math.max(c[1], W.ground(c[0], c[2]) + 2 + D);
      floating.push({ mesh: st.mesh, D, c, a: near ? 3 + 8 * rr() : 10 + 50 * rr(), b: near ? 3 + 8 * rr() : 10 + 50 * rr(),
                      w: (rr() < 0.5 ? 1 : -1) * (near ? 0.06 + 0.1 * rr() : 0.02 + 0.06 * rr()), ph: rr() * 6.2832, ph2: rr() * 6.2832,
                      bob: 2 + 6 * rr(), spin: (rr() < 0.5 ? 1 : -1) * (0.08 + 0.4 * rr()), yawRate: (rr() - 0.5) * 0.3, tilt: 0.2 + 0.4 * rr() });
    }
  }
  add('motes', W.makeMotes({ pools, n: +(Q.get('motes') ?? 2400) }), { uWrap: { value: 60 }, uWrapLow: { value: 0 }, uWrapHigh: { value: REACH + 100 },
                                                                           uWrapNear: { value: 1.5 }, uWrapAng: { value: 0.04 } });
  const buildMs = Math.round(performance.now() - t0build);
  const total = parts.reduce((s, p) => s + p.n, 0);
  say('The night between them');

  // the flight
  const flight = new Flight(cv);
  flight.floor = (x, z) => W.ground(x, z) + PERSON * 0.7;
  flight.reach = REACH;
  const standpoint = () => ({ x: EYE.x, y: W.ground(EYE.x, EYE.z) + PERSON, z: EYE.z, yaw: EYE.yaw, pitch: EYE.pitch });
  const PLACES = {
    1: standpoint,
    2: () => ({ x: 10, y: 95, z: -60, yaw: -5, pitch: -28 }),
    3: () => { const V = W.VORTICES[0], d = dirAzEl(V.az, V.el); return { x: d[0] * 1000, y: d[1] * 1000, z: d[2] * 1000, yaw: V.az, pitch: V.el }; },
    4: () => { const S = W.STARS[0], d = dirAzEl(S.az, S.el), e = eyeAt, b = new THREE.Vector3(d[0] * W.SKY_R - e.x, d[1] * W.SKY_R - e.y, d[2] * W.SKY_R - e.z).normalize();
               return { x: e.x + b.x * 550, y: e.y + b.y * 550, z: e.z + b.z * 550, yaw: Math.atan2(b.x, -b.z) / DEG, pitch: Math.asin(b.y) / DEG }; },
  };
  const goTo = n => { const p = PLACES[n]; if (!p) return; const e = p(); flight.carryTo(e, clamp(4 + Math.hypot(e.x - flight.pos[0], e.y - flight.pos[1], e.z - flight.pos[2]) / 120, 5, 10)); };
  { const e = standpoint(); flight.go({ pos: [e.x, e.y, e.z], yaw: e.yaw, pitch: e.pitch, speed: 0 }); }
  if (has('at')) { const p = PLACES[+Q.get('at')]; if (p) { const e = p(); flight.go({ pos: [e.x, e.y, e.z], yaw: e.yaw, pitch: e.pitch, speed: 0 }); } }
  if (has('test')) { flight.script = { speed: 0, dx: 0, dy: 0 }; flight.speed = 0; }

  // the opening: the veil paints The Starry Night while the world is built; then it lifts, and the world paints
  // itself in round you, sky first and the sunflowers last
  const veil = window.veil || { up: false, painted: true, status() {}, lift() {}, skip() {} };
  let opening = veil.up && !has('test') && !has('at') ? 'wait' : null, openT = 0, reveal = opening ? 0 : 2;
  const setReveal = v => { for (const p of parts) for (const m of p.meshes) m.material.uniforms.uReveal.value = v; };
  setReveal(reveal);
  let held = has('hold');
  function openStep(dt) {
    if (opening === 'wait') {
      const e = standpoint();
      flight.pos[0] = e.x; flight.pos[1] = e.y; flight.pos[2] = e.z;
      flight.gaze.yaw = flight.head.yaw = e.yaw * DEG; flight.gaze.pitch = flight.head.pitch = e.pitch * DEG;
      flight.speed = flight.target = 0;
      if (!veil.painted || held) return;
      veil.status('');
      veil.lift();
      opening = 'paint'; openT = 0;
    }
    openT += dt;
    if (opening === 'paint') {
      reveal = clamp((openT - 0.4) / REVEAL_S, 0, 1.1);
      setReveal(reveal);
      if (reveal >= 1.1) { opening = null; showDreamButton(); if (wantDream) begin(); }
    }
  }

  const line = document.getElementById('line'), panel = document.getElementById('panel'), dbg = document.getElementById('debug');
  const capEl = document.getElementById('caption');
  let capT = 0, looked = false;
  function caption() {
    if (has('nocaption') || has('test') || has('notitle') || reel) return;
    capEl.innerHTML = `<b></b><i></i><q></q>`;
    capEl.children[0].textContent = 'The Starry Night';
    capEl.children[1].textContent = 'Saint-Rémy, June 1889. Museum of Modern Art, New York';
    capEl.children[2].textContent = '“This morning I saw the countryside from my window a long time before sunrise, with nothing but the morning star, which looked very big.”';
    capEl.classList.add('on');
    line.classList.remove('on');           // one thing in the corner at a time
    capT = time + 9;
  }
  flight.on('look', () => { looked = true; line.classList.remove('on'); cv.focus({ preventScroll: true }); });
  flight.on('go', () => { looked = true; line.classList.remove('on'); if (reel) wake(); });
  flight.on('eye', n => { if (reel) wake(); goTo(n); });
  flight.on('dream', () => (reel ? wake() : begin()));
  flight.on('escape', () => { if (reel) wake(); });
  flight.on('fullscreen', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {}));
  const KEYS = 'drag        look\n↑           go where you look\n↓           back\n← →         turn\nShift       faster\n1           the knoll\n2           over the village\n3           into the swirl\n4           the morning star\nSpace       the dream flies you\n            (an arrow or Esc, and you fly)\nL           what is here\nF           full screen\n\nnothing pressed, nothing moves';
  const NOTE = { sky: 'his sky, 830 to 2,250 m out, seven swirls turning, each a well', stars: `${W.STARS.length} stars and the moon, wells of turning rings`,
                 ground: 'the hills, along their own contours', river: 'the water, and the stars in it',
                 village: `${village.houses.length} houses, ${village.trees.length} trees, the church`, cypress: 'two, swaying',
                 field: `${field.flowers.length} standing in rows between the knoll and the village, two dabs each, and room for ${detail.tiers.map(T => T.slots).join(', ')} near you whole, in thirds, in eighths`, flowers: `${floating.length} loose in the air`, motes: 'round you, for the speed' };
  const LEDGER = () => `strokes in the air   ${total}\n` + parts.map(p => `  ${p.name.padEnd(10)}${String(p.n).padStart(7)}   ${NOTE[p.name] || ''}`).join('\n') +
    `\n\nall of it in his colours: the sky's, the stars', the moon's,\n  the hills', the village's and the cypress's from\n  The Starry Night; the sunflowers whole from Sunflowers\n  (Van Gogh Museum, Amsterdam)\nbuilt in ${buildMs} ms`;
  let panelOn = null;
  const show = (k, text) => { if (panelOn === k) { panel.hidden = true; panelOn = null; return; } panel.textContent = text; panel.hidden = false; panelOn = k; };
  flight.on('help', () => show('help', KEYS));
  flight.on('ledger', () => show('ledger', LEDGER()));
  if (!has('notitle')) setTimeout(() => { if (!looked && !capT && !opening && !reel) line.classList.add('on'); }, 800);

  const grade = { exposure: +(Q.get('exposure') || 1.12), bloom: +(Q.get('bloom') || 0.9), sat: +(Q.get('sat') || 1.22), contrast: 1.04,
                  vignette: has('test') ? 0 : 0.28, grain: 0.02, time: 0, warm: 0, black: 0, thresh: 0.8, tone: 0 };

  // the lens: the horizontal field of view, the piece's own (hfov) or the film's, eased between them
  let lens = hfov;
  function setLens(h) {
    lens = h;
    camera.fov = 2 * Math.atan(Math.tan(h * DEG / 2) / camera.aspect) / DEG;
    camera.updateProjectionMatrix();
    U.uFocalPx.value = (innerHeight * renderer.getPixelRatio() / 2) / Math.tan(camera.fov * DEG / 2);
  }
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    const pr = renderer.getPixelRatio();
    post.setSize(Math.floor(w * pr), Math.floor(h * pr));
    setLens(lens);
    // the film's bands: the frame closed to about two to one, never more than an eighth of the height a band
    const b = w > h * 1.15 ? clamp((h - w / 2.1) / 2, h * 0.065, h * 0.13) : h * 0.075;
    document.getElementById('bars').style.setProperty('--bar', Math.round(b) + 'px');
  }
  addEventListener('resize', resize);
  resize();
  renderer.compile(scene, camera);

  // ---------------------------------------------------------------- the dream flies you (E2, src/film.js)
  // Space, and the piece is a film: one take through the night, round and round, until you take the controls back.
  // It begins where you are if you are at his eye; from anywhere else the eyes close, and open on the knoll with the
  // world painting itself in. Your eye is still yours -- a drag looks round while the dream carries the body, and a
  // moment after you let go it goes back to the film's -- and it may be caught by a loose sunflower passing close.
  // An arrow, a place key, Esc or Space hands the body back where it is, looking where it looked, going the way it
  // went, and it comes to rest as a released key does. The lens, the clock and the grade go over to the film's and
  // come back eased (fw), so that nothing steps.
  const film = new Film(script(eyeAt.toArray(), field.plot), { calm: matchMedia('(prefers-reduced-motion: reduce)').matches });
  const obstacles = {
    boxes: village.houses.concat(village.church).map(H => { const y0 = W.ground(H.x, H.z) - 0.4; return { x: H.x, z: H.z, yaw: H.yaw, hw: H.w / 2, hd: H.d / 2, y0, y1: y0 + H.h + H.d * 0.36 }; })
      .concat([{ x: village.spire[0], z: village.spire[2], yaw: 0, hw: 3.5, hd: 3.5, y0: village.spire[1] - 26, y1: village.spire[1] + 0.5 }]),
    trunks: CYPRESSES.map(([x, z, h, base]) => ({ x, z, h, base, y0: W.ground(x, z) - 1.5 })),
  };
  const bars = document.getElementById('bars'), reelTitle = document.getElementById('reel-title'), reelHint = document.getElementById('reel-hint');
  const dreamBtn = document.getElementById('dream-btn'), coarse = matchMedia('(pointer: coarse)').matches;
  const JOIN = WAKE + 0.5;                                  // a film begun at his eye begins here, the world already painted
  const DARK = [0.016, 0.024, 0.06], LIGHT = [1.0, 0.965, 0.84];   // the two fades, as displayed: the night's, and the star's light
  const smoother = u => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  let reel = null, F = null, fw = 0, leave = false, shownTitle = null, clock = 1, fade = 0, fadeCol = DARK, still = 0, hintTimer = 0;
  let wantDream = has('dream') && !Q.get('dream');          // ?dream: the film begins when the opening has gone into the painting
  const own = { yaw: 0, pitch: 0, idle: 9 };                // your own eye, turned from the film's
  const gl = { w: 0, d: [0, 0, -1] };                       // the glance at a sunflower
  function showDreamButton() { if (!has('test') && !has('notitle')) dreamBtn.classList.toggle('on', !reel); }
  function begin(t0 = null) {
    if (reel) return;
    if (opening) { wantDream = true; return; }
    const here = { p: [...flight.pos], yaw: flight.gaze.yaw, pitch: flight.gaze.pitch };
    const J = film.at(JOIN).p, near = Math.hypot(here.p[0] - J[0], here.p[1] - J[1], here.p[2] - J[2]) < 30;
    reel = t0 != null ? { mode: 'play', t: clamp(t0, 0, film.T - 0.01), k: 0 } : near ? { mode: 'bridge', t: JOIN, k: 0, here } : { mode: 'close', t: 0, k: 0 };
    flight.carry = null; flight.coast = [0, 0, 0]; flight.speed = flight.target = 0;
    own.yaw = own.pitch = 0; own.idle = 9; gl.w = 0; fadeCol = DARK; wantDream = false; looked = true;
    bars.classList.add('on'); dreamBtn.classList.remove('on');
    line.classList.remove('on'); capEl.classList.remove('on'); capT = 0; panel.hidden = true; panelOn = null;
    reelHint.textContent = coarse ? 'drag to look round · touch the left to fly yourself' : 'drag to look round · an arrow, and you fly yourself · F full screen';
    reelHint.classList.add('on');
    clearTimeout(hintTimer); hintTimer = setTimeout(() => reelHint.classList.remove('on'), 7000);
  }
  function wake() {
    if (!reel) return;
    // the body is handed back where the film has it, looking where it looks, and going the way it went
    if (F && reel.mode !== 'close') { flight.coast = [...F.vel]; flight.roll = F.roll; }
    flight.speed = flight.target = 0;
    reel = null; leave = true;
    bars.classList.remove('on'); reelHint.classList.remove('on'); document.body.classList.remove('still');
    showTitle(null); showDreamButton();
  }
  function showTitle(id) {
    shownTitle = id;
    if (id == null || has('nocaption')) { reelTitle.classList.remove('on'); return; }
    reelTitle.children[0].textContent = LINES[id].text; reelTitle.children[1].textContent = LINES[id].by;
    reelTitle.classList.add('on');
  }
  // a frame of the film: the body and the eye where the film has them, and yours on top
  function drive(dt) {
    const dx = flight.dx, dy = flight.dy; flight.dx = flight.dy = 0;
    if (dx || dy) { own.yaw += dx * LOOK; own.pitch -= dy * LOOK; own.idle = 0; }
    else if (!flight.drag && flight.look.id < 0 && (own.idle += dt) > 1.2) { const k = 1 - Math.exp(-dt / 1.4); own.yaw -= own.yaw * k; own.pitch -= own.pitch * k; }
    own.yaw = angDiff(own.yaw, 0);
    if (reel.mode === 'close') {                           // the eyes close where you are, and open on the knoll
      reel.k += dt; fadeCol = DARK; fade = Math.max(fade, smoother(reel.k / 1.1));
      if (reel.k < 1.25) return { vx: 0, vy: 0, vz: 0 };
      reel.mode = 'play'; reel.t = 0;
    } else reel.t += dt;
    if (reel.t >= film.T) reel.t -= film.T;               // round again, in the star's light
    F = film.at(reel.t);
    // the glance: a loose sunflower passing close in front of the eye draws it a little, where the film allows
    if (F.glance > 0.01 || gl.w > 0.002) {
      let best = null, bd = 18;
      for (const f of floating) {
        const q = f.mesh.position, ex = q.x - F.p[0], ey = q.y - F.p[1], ez = q.z - F.p[2], d = Math.hypot(ex, ey, ez);
        if (d < bd && d > 2.5 && (ex * F.dir[0] + ey * F.dir[1] + ez * F.dir[2]) / d > 0.45) { bd = d; best = [ex / d, ey / d, ez / d]; }
      }
      gl.w += ((best ? F.glance * 0.42 * smoothstep(18, 8, bd) : 0) - gl.w) * (1 - Math.exp(-dt / 0.9));
      if (best) { const k = 1 - Math.exp(-dt / 0.45); gl.d = [0, 1, 2].map(i => gl.d[i] + (best[i] - gl.d[i]) * k); }
    }
    const gyaw = gl.w * angDiff(Math.atan2(gl.d[0], -gl.d[2]), F.yaw), gpitch = gl.w * (Math.asin(clamp(gl.d[1] / (Math.hypot(...gl.d) || 1), -1, 1)) - F.pitch);
    let p = F.p, yaw = F.yaw + gyaw + own.yaw, pitch = F.pitch + gpitch + own.pitch;
    if (reel.mode === 'bridge') {                          // begun at his eye: from where you were into the film, in three seconds
      reel.k += dt; const u = smoother(reel.k / 3);
      p = [0, 1, 2].map(i => lerp(reel.here.p[i], F.p[i], u));
      yaw = reel.here.yaw + angDiff(yaw, reel.here.yaw) * u; pitch = lerp(reel.here.pitch, pitch, u);
      if (reel.k >= 3) reel.mode = 'play';
    }
    flight.pos[0] = p[0]; flight.pos[1] = p[1]; flight.pos[2] = p[2];
    flight.gaze.yaw = flight.head.yaw = yaw; flight.gaze.pitch = flight.head.pitch = clamp(pitch, -85 * DEG, 88 * DEG);
    flight.roll = F.roll; flight.speed = flight.target = 0;
    // the light and the paint: the fade is the star's from the blaze until the wake has lifted it
    if (reel.t > film.Tb) fadeCol = LIGHT;
    fade = F.fade;
    if (F.reveal !== reveal) { reveal = F.reveal; setReveal(reveal); }
    if (F.title !== shownTitle) showTitle(F.title);
    return { vx: F.vel[0], vy: F.vel[1], vz: F.vel[2] };
  }
  // each frame, whoever has the body: the lens, the clock and the grade eased between yours and the film's, and what
  // the film leaves when it lets go -- its light fading, and the paint finishing if the wake was not done
  function reelStep(dt) {
    fw += ((reel ? 1 : 0) - fw) * (1 - Math.exp(-dt / 0.7));
    const lf = hfov + ((F ? F.hfov : hfov) - hfov) * fw;
    if (Math.abs(lf - lens) > 1e-3) setLens(lf);
    clock = 1 + ((F ? F.time : 1) - 1) * fw;
    if (U.uPart.value > 0) U.uPart.value = PART + ((F ? F.part : PART) - PART) * fw;
    if (leave) {
      fade *= Math.exp(-dt / 0.35); if (fade < 0.003) fade = 0;
      if (reveal < 1.1) { reveal = Math.min(1.1, reveal + dt / 1.6); setReveal(reveal); }
      if (!fade && reveal >= 1.1) leave = false;
    }
    if (reel) { still += dt; document.body.classList.toggle('still', still > 2.5); }
  }
  addEventListener('pointermove', () => { still = 0; document.body.classList.remove('still'); });
  dreamBtn.addEventListener('click', () => { dreamBtn.blur(); cv.focus({ preventScroll: true }); begin(); });
  function graded() {
    const g = { ...grade, fade, fadeCol };
    if (F && fw > 1e-3) {
      const G = F.grade;
      g.warm += G.warm * fw; g.sat += G.sat * fw; g.bloom += G.bloom * fw; g.exposure *= 1 + G.exposure * fw;
      g.vignette += (G.vignette + 0.1) * fw; g.grain += 0.012 * fw;        // a film's frame: a little darker at its corners, and its grain
    }
    return g;
  }

  // the three fixed flights, for the harness: up from the knoll into the sky; a swoop over the village; a walk
  const FLIGHTS = {
    glide: { pos: null, yaw: -10, pitch: 30, speed: 8, T: 60, dx: 0, pitchTo: 30 },
    swoop: { pos: [0, 120, 260], yaw: 0, pitch: -14, speed: 30, T: 30, dx: 0, pitchTo: -10 },
    village: { pos: [0, 4, -80], yaw: 0, pitch: 4, speed: 4, T: 60, dx: -0.2 * DEG, pitchTo: 4 },
  };
  let running = null;
  const pending = [], watchers = [];
  function runFlight(name) {
    const F = FLIGHTS[name];
    if (!F) return Promise.reject(new Error('no flight ' + name));
    const e = standpoint();
    flight.go({ pos: F.pos || [e.x, e.y, e.z], yaw: F.yaw, pitch: F.pitch, speed: F.speed });
    flight.script = { speed: F.speed, dx: F.dx, dy: 0, pitch: F.pitchTo };
    return new Promise(res => { running = { name, t: 0, T: F.T, fps: [], acc: 0, n: 0, res }; });
  }
  function stepFlight(dt) {
    if (!running) return;
    running.t += dt;
    if (running.t >= running.T) {
      const r = { name: running.name, fps: running.fps, dpr: +dprCur.toFixed(2),
                  mean: running.fps.length ? Math.round(running.fps.reduce((a, b) => a + b, 0) / running.fps.length) : null,
                  min: running.fps.length ? Math.min(...running.fps) : null, simulated: !!running.sim };
      flight.script = null; running.res(r); running = null; window.__flight = r;
    }
  }

  // the sunflowers in the air: each on its own slow orbit, bobbing, turning, spinning
  function moveFlowers(t) {
    for (const f of floating) {
      const a = f.w * t + f.ph;
      f.mesh.position.set(f.c[0] + f.a * Math.cos(a), f.c[1] + f.bob * Math.sin(0.6 * a + f.ph2), f.c[2] + f.b * Math.sin(a));
      f.mesh.rotation.set(f.tilt * Math.sin(0.4 * a + f.ph2), f.yawRate * t + f.ph, f.spin * t, 'YXZ');
    }
  }

  let time = 0, frozen = has('t') ? parseFloat(Q.get('t')) : null, fps = 60, frames = 0;
  let dprCur = renderer.getPixelRatio(), slow = 0, quick = 0;
  const dprMax = dprCur;
  let last = performance.now();
  const headDir = [0, 0, -1];
  function frame(now) {
    const real = Math.max(0.0005, (now - last) / 1000);
    const dt = Math.min(0.05, real);
    last = now;
    fps += (1 / real - fps) * 0.05;
    time = frozen ?? time + dt * clock;
    U.uTime.value = time;
    if (frames > 150 && frozen === null && !has('test') && !has('nogov')) {
      if (fps < 47) { slow += dt; quick = 0; } else if (fps > 58.5) { quick += dt; slow = 0; } else { slow = quick = 0; }
      if (slow > 1.5 && dprCur > 0.75) { dprCur = Math.max(0.75, dprCur - 0.15); renderer.setPixelRatio(dprCur); resize(); slow = 0; }
      if (quick > 8 && dprCur < dprMax) { dprCur = Math.min(dprMax, dprCur + 0.1); renderer.setPixelRatio(dprCur); resize(); quick = 0; }
    }
    const sdt = frozen !== null ? 0 : dt;
    const v = reel ? drive(sdt) : flight.update(sdt);
    const sp = Math.hypot(v.vx, v.vy, v.vz);
    const dir = sp > 0.3 ? [v.vx / sp, v.vy / sp, v.vz / sp] : flight.heading();
    const kh = 1 - Math.exp(-sdt / 0.25);
    for (let k = 0; k < 3; k++) headDir[k] += (dir[k] - headDir[k]) * kh;
    const hl = Math.hypot(headDir[0], headDir[1], headDir[2]) || 1;
    U.uHead.value.set(headDir[0] / hl, headDir[1] / hl, headDir[2] / hl);
    U.uPartA.value = Math.max(0.3 * sp, PART);
    U.uPartB.value = Math.max(2.0 * sp, 2 * PART);
    if (capT && time > capT) { capEl.classList.remove('on'); capT = 0; if (!looked && !has('notitle')) line.classList.add('on'); }
    for (let i = pending.length - 1; i >= 0; i--) if (time >= pending[i].t) pending.splice(i, 1)[0].f();
    for (let i = watchers.length - 1; i >= 0; i--) if (watchers[i](sdt)) watchers.splice(i, 1);
    if (running) { running.acc += real; running.n++;
      if (running.acc >= 1) { running.fps.push(Math.round(running.n / running.acc)); running.acc = 0; running.n = 0; }
      stepFlight(dt);
    }
    if (opening) openStep(sdt);
    reelStep(dt);
    moveFlowers(time);
    flight.applyTo(camera);
    U.uCam.value.copy(camera.position);
    if (fieldSt) detail.update(camera.position, sdt);
    grade.time = time;
    post.render([scene], camera, graded());
    frames++;
    if (has('dbg')) {
      dbg.hidden = false;
      const s = flight.state();
      dbg.textContent = `${s.x} ${s.y} ${s.z}  yaw ${s.yaw} pitch ${s.pitch}  v ${s.speed}  fps ${fps.toFixed(0)} dpr ${dprCur.toFixed(2)}  strokes ${total}  t ${time.toFixed(1)} reveal ${reveal.toFixed(2)}` +
        (reel && F ? `\nfilm ${reel.t.toFixed(1)} / ${film.T.toFixed(1)}  ${F.shot}  ${F.speed.toFixed(1)} m/s  lens ${lens.toFixed(1)}  clock ${clock.toFixed(2)}` : '');
    }
    requestAnimationFrame(frame);
  }

  const state = () => ({ ...flight.state(), fps: Math.round(fps), dpr: +dprCur.toFixed(2), hfov: +hfov.toFixed(2), strokes: total, time: +time.toFixed(2), reveal: +reveal.toFixed(2),
                         film: reel ? { mode: reel.mode, t: +reel.t.toFixed(2), shot: F ? F.shot : null } : null });
  const dream = window.dream = {
    ready: true, state, buildMs, total,
    parts: () => parts.map(p => ({ name: p.name, n: p.n, meshes: p.meshes.length })),
    go: o => flight.go(o),
    place: n => goTo(n),
    holdOpen: v => { held = !!v; },
    reveal: v => { reveal = v; setReveal(v); opening = null; },
    speed: v => { flight.speed = flight.target = v; },
    hold: () => { flight.script = { speed: 0, dx: 0, dy: 0 }; flight.speed = 0; },
    free: () => { flight.script = null; },
    freeze: t => { frozen = t; },
    wait: secs => new Promise(res => pending.push({ t: time + secs, f: () => res(state()) })),
    flight: name => runFlight(name),
    hfov: v => { hfov = v; resize(); },
    layers: o => { if ('strokes' in o) for (const p of parts) for (const m of p.meshes) m.visible = o.strokes;
                   if ('only' in o) for (const p of parts) for (const m of p.meshes) m.visible = p.name === o.only; },
    sim: (secs, step = 1 / 60) => { for (let t = 0; t < secs; t += step) {
        const d = Math.min(step, secs - t);
        if (reel) drive(d); else flight.update(d);
        reelStep(d); time += d * clock; U.uTime.value = time;
        if (running) running.sim = true;
        stepFlight(d);
        for (let i = pending.length - 1; i >= 0; i--) if (time >= pending[i].t) pending.splice(i, 1)[0].f();
        for (let i = watchers.length - 1; i >= 0; i--) if (watchers[i](d)) watchers.splice(i, 1);
      } flight.applyTo(camera); if (fieldSt) { detail.since = 1e9; detail.update(camera.position, step); } return state(); },
    field: () => ({ flowers: field.flowers.length, held: detail.count(), queued: detail.queue.length, built: detail.built, builtStrokes: detail.builtStrokes, ms: +detail.ms.toFixed(1) }),
    ground: (x, z) => W.ground(x, z),
    // one frame drawn now, as the loop would draw it: for a pane whose page is not being animated (a hidden tab)
    render: () => { moveFlowers(time); flight.applyTo(camera); U.uCam.value.copy(camera.position); post.render([scene], camera, graded()); return state(); },
    project: q => { const v = new THREE.Vector3(q[0], q[1], q[2]).project(camera); return [(v.x * 0.5 + 0.5) * innerWidth, (0.5 - v.y * 0.5) * innerHeight, +v.z.toFixed(4)]; },
    village: () => ({ houses: village.houses.length, trees: village.trees.length, spire: village.spire.map(v => +v.toFixed(1)) }),
    flowers: () => floating.slice(0, 12).map(f => ({ D: +f.D.toFixed(2), at: f.mesh.position.toArray().map(v => +v.toFixed(1)) })),
    // the film (E2): play it (from t, or as Space does), stop it, put it at t for a picture (with dream.freeze to hold
    // it there), say where it is, list its shots, and audit the whole of it -- the least room it leaves from the
    // ground, the houses, the church and the cypresses, the fastest, the hardest turn, the most bank
    film: {
      play: t => begin(t == null ? null : +t), stop: () => wake(),
      seek: t => { if (!reel) begin(+t); reel.mode = 'play'; reel.t = clamp(+t, 0, film.T - 0.01); drive(0); reelStep(1); flight.applyTo(camera); return { t: +F.t.toFixed(2), shot: F.shot, speed: +F.speed.toFixed(1) }; },
      state: () => ({ on: !!reel, mode: reel ? reel.mode : null, t: reel ? +reel.t.toFixed(2) : null, T: +film.T.toFixed(2), shot: reel && F ? F.shot : null,
                      speed: reel && F ? +F.speed.toFixed(1) : null, lens: +lens.toFixed(1), clock: +clock.toFixed(2), title: shownTitle }),
      shots: () => film.shots(),
      audit: () => film.audit(obstacles),
    },
    _: { renderer, scene, camera, post, parts, U, flight, floating, cypresses, pools, field, detail, film },
  };
  pending.push({ t: 0.5, f: () => { if (!opening) caption(); else watchers.push(() => (opening ? false : (caption(), true))); } });
  if (has('flight')) runFlight(Q.get('flight'));
  if (!opening) showDreamButton();
  if (Q.get('dream')) begin(+Q.get('dream'));               // ?dream=<t>: straight into the film at t, no opening
  else if (wantDream && !opening && !has('test')) begin();
  requestAnimationFrame(frame);
}

boot().catch(e => fail('The dream did not load.', e));
