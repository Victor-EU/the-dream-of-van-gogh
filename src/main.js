// Van Gogh's Universe. One road through the world he painted, 1885 to 1890.
import * as THREE from 'three';
import { makeBrushAtlas } from './brush.js';
import * as J from './journey.js';
import { Sky } from './sky.js';
import { Ground } from './ground.js';
import { World } from './scenes.js';
import { Paintings } from './canvases.js';
import { Post } from './post.js';
import { Controls } from './controls.js';
import { UI } from './ui.js';
import { Sound } from './audio.js';
import { lin, mixc, lerp, clamp, smoothstep, dirAzEl } from './util.js';

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

const WALK = 4.5, RUN = 10.5, TURN = 1.9, LOOK = 0.0032, EYE = 1.65;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const roadYaw = z => Math.atan2(-J.roadSlope(z), 1);
// the opening's veil (src/veil.js); a page without it simply opens on the world
const veil = window.veil || { up: false, painted: true, status() {}, lift() {}, skip() {} };

async function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  const qual = Q.get('q') || (matchMedia('(pointer: coarse)').matches ? 'low' : 'mid');
  // resolution: as fine as the screen, up to about three million pixels, then the frame rate decides
  const budget = qual === 'high' ? 5.5e6 : qual === 'low' ? 1.2e6 : 3.2e6;
  renderer.setPixelRatio(Math.max(0.75, Math.min(devicePixelRatio || 1, qual === 'high' ? 2 : 1.5, Math.sqrt(budget / (innerWidth * innerHeight)))));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const cv = renderer.domElement;
  cv.tabIndex = 0;
  cv.setAttribute('aria-label', 'Van Gogh’s Universe. The arrow keys walk and turn; drag to look around; space walks on its own.');
  document.getElementById('stage').appendChild(cv);
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.08, 4000);
  camera.rotation.order = 'YXZ';

  const U = {
    uTime: { value: 0 }, uCam: { value: new THREE.Vector3() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
    uSkyAmb: { value: new THREE.Color() }, uGndAmb: { value: new THREE.Color() },
    uFogCol: { value: new THREE.Color() }, uFogDen: { value: 0.005 }, uFogStart: { value: 30 },
    uLampPos: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
    uLampCol: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
    uBrush: { value: makeBrushAtlas() }, uBiome: { value: J.makeBiomeTexture() },
    uNight: { value: 0 }, uIntro: { value: 0 },
  };

  const stations = await J.loadStations();
  const calendar = J.makeCalendar(stations);
  const post = new Post(renderer);
  const sky = new Sky(U, stations);
  const world = new THREE.Scene();
  const ground = new Ground(U, qual);
  world.add(ground.group);
  const props = new World(U, stations);
  world.add(props.group);
  const paintings = new Paintings(U, stations, props.easels);
  world.add(paintings.group);
  // the road ends 34 m past the last station, and the walk on its own stops there; his portrait stands beyond it,
  // and a hand can take you up to it
  const coda = props.easels.find(e => e.coda);
  const zLast = coda ? coda.z + coda.coda.foot : J.ZEND + 4;
  const controls = new Controls(cv);
  const sound = new Sound(stations);

  // -------------------------------------------------------------- the body --
  const body = { x: 0, z: J.ZSTART, yaw: 0, pitch: 0.02, pitchT: null, v: 0, vs: 0, wheelV: 0,
                 lie: 0, lieT: 0, auto: false };
  const startIdx = has('at') ? clamp(parseInt(Q.get('at'), 10) || 1, 1, J.NST) - 1 : -1;
  if (startIdx >= 0) body.z = J.stationZ(startIdx) + 18;
  body.x = J.roadX(body.z);
  body.yaw = roadYaw(body.z);
  let begun = false, awake = false, ready = false, hush = false, time = 0, frozen = has('t') ? parseFloat(Q.get('t')) : null;
  let jump = null, black = 0, fps = 60, frames = 0, sNow = 0;
  // the opening: the veil's Starry Night paints itself while all this is built; once it is finished the world
  // paints itself outward from where you stand, from bare primed canvas, and the veil lifts into it
  let intro = has('notitle') || startIdx >= 0 ? 1 : 0, introT = 0, held = 0;
  // until a hand moves, the eye drifts a little and looks up into the sky; it comes level when one does
  let idle = 1;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dprCur = renderer.getPixelRatio(), slow = 0, quick = 0;
  const dprMax = dprCur;

  const ui = new UI(stations, {
    jump: i => jumpTo(i),
    sound: () => { ui.setSound(sound.toggle()); hush = !sound.on; },
    fullscreen: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {}),
  });
  ui.loading('Mixing the colours');

  // the veil lifts, and the world is yours to walk; `now` takes it away at once (?notitle, ?at, the harness)
  function begin(now = false) {
    if (begun) return;
    begun = true;
    if (now) veil.skip(); else veil.lift();
    ui.begin();
    cv.focus({ preventScroll: true });
  }
  // the first touch of a hand: the road and the corner come up, the hint goes, the eye comes level, and the
  // sound starts, as the title's button used to start it -- unless it has been turned off already
  function wake(withSound = true) {
    if (!begun) begin();
    if (awake) return;
    awake = true;
    ui.wake();
    if (withSound && !hush) { sound.start(); ui.setSound(sound.on); }
  }
  // a hand counts once the world under the veil can be walked
  const hand = () => { if (!ready) return false; wake(); return true; };
  function jumpTo(i) {
    wake();
    jump = { t: 0, z: J.stationZ(clamp(i, 0, J.NST - 1)) + 18, done: false };
    body.auto = false;
    ui.setAuto(false);
  }
  controls.on('begin', hand);
  controls.on('move', () => { if (hand()) ui.moved(); });
  controls.on('look', () => { if (hand()) body.pitchT = null; });
  controls.on('auto', () => { if (!hand()) return; body.auto = !body.auto; ui.setAuto(body.auto); });
  controls.on('lie', () => { if (!begun) return; body.lieT = body.lieT ? 0 : 1; body.pitchT = body.lieT ? 1.12 : 0.02; });
  controls.on('sound', () => { ui.setSound(sound.toggle()); hush = !sound.on; if (ready) wake(false); });
  controls.on('help', () => ui.toggleHelp());
  controls.on('jump', n => { if (ready) jumpTo(n - 1); });
  controls.on('fullscreen', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {}));
  document.getElementById('veil')?.addEventListener('pointerdown', hand);
  // a sound started on a wheel or the start of a touch is born suspended; the next gesture a browser counts wakes it
  for (const ev of ['keydown', 'pointerup', 'touchend'])
    addEventListener(ev, () => { if (sound.on && sound.ctx && sound.ctx.state === 'suspended') sound.ctx.resume(); }, true);

  const autoSpeed = () => {
    const d = Math.abs(body.z - J.stationZ(J.nearestStation(body.z)));
    return 3.6 * (0.4 + 0.6 * smoothstep(6, 28, d));
  };

  function step(dt) {
    const inp = controls.take();
    if (begun && !(jump && !jump.done)) {
      body.yaw += inp.dx * LOOK;
      if (inp.dy) { body.pitch = clamp(body.pitch - inp.dy * LOOK, -1.25, 1.45); body.pitchT = null; }
      body.wheelV = clamp(body.wheelV - inp.wheel * 0.027, -RUN, RUN);
      const f = clamp(controls.forward, -1, 1), st = clamp(controls.strafe, -1, 1), tr = controls.turn;
      if (f || st || tr) { if (body.auto) { body.auto = false; ui.setAuto(false); } }
      if ((f || st) && body.lieT) { body.lieT = 0; body.pitchT = 0.02; }
      body.yaw += tr * TURN * dt;
      let target = f * (controls.run ? RUN : WALK), side = st * WALK * 0.8;
      if (body.auto && body.z < J.ZEND + 4.3) { body.auto = false; ui.setAuto(false); }
      if (body.auto) {
        target = autoSpeed() * clamp((body.z - J.ZEND - 4) / 10, 0.15, 1);
        const want = roadYaw(body.z - 6) + clamp((J.roadX(body.z - 9) - body.x) * 0.09, -0.35, 0.35);
        body.yaw += angDiff(want, body.yaw) * (1 - Math.exp(-dt * 1.1));
        if (body.pitchT === null) body.pitch += (0.03 - body.pitch) * (1 - Math.exp(-dt * 0.6));
      }
      target += body.wheelV;
      body.wheelV *= Math.exp(-dt * 2.2);
      if (body.lieT) { target = 0; side = 0; }
      body.v += (target - body.v) * (1 - Math.exp(-dt * 5));
      body.vs += (side - body.vs) * (1 - Math.exp(-dt * 5));
      const sy = Math.sin(body.yaw), cy = Math.cos(body.yaw);
      let nx = body.x + (sy * body.v + cy * body.vs) * dt;
      let nz = body.z + (-cy * body.v + sy * body.vs) * dt;
      const lat = nx - J.roadX(nz), LIM = 42;
      if (Math.abs(lat) > LIM) nx = J.roadX(nz) + Math.sign(lat) * LIM;
      nz = clamp(nz, zLast, J.ZSTART + 8);
      for (const c of props.colliders) {
        const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz);
        if (d < c.r && d > 1e-4) { nx = c.x + dx / d * c.r; nz = c.z + dz / d * c.r; }
      }
      body.x = nx; body.z = nz;
    }
    if (body.pitchT !== null) {
      body.pitch += (body.pitchT - body.pitch) * (1 - Math.exp(-dt * 2.2));
      if (Math.abs(body.pitchT - body.pitch) < 0.003) body.pitchT = null;
    }
    body.lie += (body.lieT - body.lie) * (1 - Math.exp(-dt * 2.4));
    if (jump) {
      jump.t += dt;
      black = smoothstep(0, 0.35, jump.t);
      if (jump.t >= 0.35 && !jump.done) {
        body.z = jump.z; body.x = J.roadX(body.z); body.yaw = roadYaw(body.z);
        body.pitch = 0.02; body.v = body.vs = body.wheelV = 0; body.lie = body.lieT = 0; jump.done = true;
      }
      if (jump.t > 0.35) black = 1 - smoothstep(0.5, 1.2, jump.t);
      if (jump.t > 1.2) { jump = null; black = 0; }
    }
  }

  // -------------------------------------------- the light of the station --
  const grade = { exposure: 1, bloom: 0.6, sat: 1.12, contrast: 1.06, vignette: 0.34, grain: 0.022, time: 0, warm: 0, black: 0, thresh: 1.0 };
  function light(s) {
    const a = Math.floor(s), b = Math.min(a + 1, J.NST - 1), f = s - a;
    const A = stations[a], B = stations[b], la = A.light, lb = B.light;
    const d = dirAzEl(lerp(la.az, lb.az, f), lerp(la.el, lb.el, f));
    U.uSunDir.value.set(d[0], d[1], d[2]).normalize();
    const k = lerp(la.k, lb.k, f), sc = mixc(lin(la.col), lin(lb.col), f);
    U.uSunCol.value.setRGB(sc[0] * k * 0.55, sc[1] * k * 0.55, sc[2] * k * 0.55);
    const amb = lerp(la.amb, lb.amb, f);
    const sa = mixc(lin(la.sky), lin(lb.sky), f), ga = mixc(lin(la.gnd), lin(lb.gnd), f);
    U.uSkyAmb.value.setRGB(sa[0] * amb, sa[1] * amb, sa[2] * amb);
    U.uGndAmb.value.setRGB(ga[0] * amb, ga[1] * amb, ga[2] * amb);
    const fc = mixc(lin(A.fog), lin(B.fog), f);
    U.uFogCol.value.setRGB(fc[0], fc[1], fc[2]);
    U.uFogDen.value = lerp(A.fogDen, B.fogDen, f);
    U.uFogStart.value = lerp(A.fogStart, B.fogStart, f);
    const night = lerp(la.night || 0, lb.night || 0, f);
    grade.exposure = lerp(la.exposure, lb.exposure, f);
    grade.bloom = lerp(0.32, 0.6, night);
    grade.thresh = lerp(1.35, 1.0, night);
    U.uNight.value = night;
    return night;
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    post.setSize(Math.floor(w * pr), Math.floor(h * pr));
  }
  addEventListener('resize', resize);
  resize();

  ui.loading('Laying the ground');
  sky.update(J.stationAt(body.z));
  await new Promise(r => setTimeout(r, 30));
  renderer.compile(sky.scene, camera);
  renderer.compile(world, camera);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
    last = now;
    fps += (1 / dt - fps) * 0.05;
    time = frozen ?? time + dt;
    U.uTime.value = time;
    if (intro < 1 && ready) {
      introT += dt;
      intro = smoothstep(0.15, 5.0, introT);
    }
    // the veil lifts a moment after its painting is finished, once the world under it has begun to paint itself
    if (veil.painted) held += dt;
    if (!begun && ready && held > 0.6 && introT > 1.0) begin();
    U.uIntro.value = intro;
    // keep the frame rate: give up resolution before smoothness, take it back when there is room
    if (frames > 150 && frozen === null) {
      if (fps < 47) { slow += dt; quick = 0; } else if (fps > 58.5) { quick += dt; slow = 0; } else { slow = quick = 0; }
      if (slow > 1.5 && dprCur > 0.75) { dprCur = Math.max(0.75, dprCur - 0.15); renderer.setPixelRatio(dprCur); resize(); slow = 0; }
      if (quick > 8 && dprCur < dprMax) { dprCur = Math.min(dprMax, dprCur + 0.1); renderer.setPixelRatio(dprCur); resize(); quick = 0; }
    }
    step(dt);

    idle += ((awake ? 0 : 1) - idle) * (1 - Math.exp(-dt * 1.4));
    const drift = calm ? 0 : 1;
    const sway = idle * drift * (0.16 * Math.sin(time * 0.06) + 0.05 * Math.sin(time * 0.17));
    const eye = lerp(EYE, 0.3, body.lie);
    // the eye stays level while you walk: a bob here read as riding, not walking
    camera.position.set(body.x, J.terrainH(body.x, body.z) + eye, body.z);
    camera.rotation.y = -(body.yaw + sway);
    camera.rotation.x = body.pitch + idle * (0.13 + 0.03 * drift * Math.sin(time * 0.11));
    camera.updateMatrixWorld();
    U.uCam.value.copy(camera.position);

    sNow = J.stationAt(body.z);
    const night = light(sNow);
    sky.update(sNow);
    ground.update(camera.position);
    props.update(camera.position, time, dt, intro);
    const lamps = props.lampsNear(camera.position);
    for (let i = 0; i < 4; i++) {
      const L = lamps[i];
      if (L) { U.uLampPos.value[i].set(L.x, L.y, L.z, L.r); U.uLampCol.value[i].set(L.c[0], L.c[1], L.c[2], L.k * night); }
      else U.uLampCol.value[i].set(0, 0, 0, 0);
    }
    const near = paintings.update(camera, time, dt, begun, sNow);
    const ns = J.nearestStation(body.z);
    ui.update({ tau: J.tauAt(body.z), date: calendar(body.z).text, station: ns,
                stationDist: Math.abs(body.z - J.stationZ(ns)), begun, near, done: paintings.done });
    sound.update({ s: sNow, v: body.v, cam: camera.position, dt, time, stations, painting: paintings.painting, coda: paintings.codaOn });

    grade.time = time;
    grade.black = black;
    post.render([sky.scene, world], camera, grade);

    if (++frames === 6) { ready = true; window.vgu.ready = true; ui.loading(''); }
    if (dbg && frames % 15 === 0)
      dbg.textContent = `${fps.toFixed(0)} fps\nz ${body.z.toFixed(1)}  x ${body.x.toFixed(1)}\ns ${sNow.toFixed(2)}  τ ${J.tauAt(body.z).toFixed(3)}`;
    requestAnimationFrame(frame);
  }
  const dbg = has('debug') ? document.getElementById('debug') : null;
  if (dbg) dbg.hidden = false;
  if (has('notitle') || startIdx >= 0) { begin(true); wake(false); idle = 0; }

  window.vgu = {
    ready: false,
    state: () => ({ x: body.x, z: body.z, y: camera.position.y, yaw: body.yaw, pitch: body.pitch, s: sNow,
                    station: J.nearestStation(body.z) + 1, tau: J.tauAt(body.z), fps: Math.round(fps),
                    begun, awake, auto: body.auto, lie: body.lie, v: body.v, date: calendar(body.z).text }),
    go: o => {
      if (o.station) { body.z = J.stationZ(o.station - 1) + (o.dz ?? 18); body.x = J.roadX(body.z) + (o.dx ?? 0); body.yaw = roadYaw(body.z); }
      if (o.x != null) body.x = o.x;
      if (o.z != null) body.z = o.z;
      if (o.yaw != null) body.yaw = o.yaw;
      if (o.pitch != null) { body.pitch = o.pitch; body.pitchT = null; }
      if (o.lie != null) body.lie = body.lieT = o.lie;
      body.v = body.vs = 0;
    },
    // straight into the world, as ?notitle does
    begin: () => { begin(true); wake(false); idle = 0; },
    freeze: t => { frozen = t; }, jump: i => jumpTo(i - 1),
    // for the harness: everything painted at once, and a place to stand in front of any easel
    paint: () => {
      props.st.forEach(s => { s.started = true; s.progress = 1.05; });
      paintings.items.forEach(it => { it.started = true; it.progress = 1.02; });
    },
    world: () => props,
    coda: () => paintings.codaState(),
    layers: o => {
      if ('sky' in o) sky.scene.visible = o.sky;
      if ('props' in o) props.group.visible = o.props;
      if ('paintings' in o) paintings.group.visible = o.paintings;
      if ('ground' in o) ground.group.visible = o.ground;
      return 1;
    },
    easels: () => props.easels.map((e, i) => ({ i, station: e.station + 1, slug: e.slug, title: e.title })),
    easel: (i, d = 4.2) => {
      const e = props.easels[i], nx = Math.sin(e.yaw), nz = Math.cos(e.yaw);
      body.x = e.x + nx * d; body.z = e.z + nz * d; body.yaw = Math.atan2(-nx, nz); body.pitch = 0.0; body.pitchT = null; body.v = body.vs = 0;
    },
  };
  if (has('painted')) window.vgu.paint();
  requestAnimationFrame(frame);
}

boot().catch(e => fail('The universe did not load.', e));
