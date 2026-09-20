// The Dream of Van Gogh. One night, entered: his strokes in the air, and an eye that goes where it looks.
import * as THREE from 'three';
import { makeBrushAtlas } from './brush.js';
import { loadRecord, loadDepth } from './records.js';
import { explode, cone, focal } from './explode.js';
import { Strokes } from './strokes.js';
import { Sky } from './sky.js';
import { Water, lights, makeSea } from './water.js';
import { Sound } from './audio.js';
import { Flight } from './flight.js';
import { Wind } from './wind.js';
import { Post } from './post.js';
import { Nights, lum } from './night.js';
import { lin, clamp, lerp, smoothstep, DEG, dirAzEl } from './util.js';

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

const HFOV = 70;                                       // of the eye, in flight (DESIGN 6); a canvas's at its standpoint under ?test
const PART = 4;                                        // the parting radius, m (DESIGN 6.5)
// The linen, above and around (DESIGN 5.4). A ray is linen in the measure that it leaves the dream soon: within
// FADE metres of the ceiling or the edge it has gone over, and from the middle of the night there is dark above
const CEIL = 700, EDGE = 2500;
const LINEN = lin('#6d6350');                          // primed linen, at the brightness a night can hold
// the curl noise the wind is continued by outside his cone (DESIGN 4.7), authored against his measured bands:
// seventeen degrees across, and an amplitude in each field -- against the fit's drift, and in metres a second
const NOISE = { lam: 0.3, oct: 1, lay: 12, fly: 2.0 };
// The water's colour (DESIGN 5.2), which is his in the two ways it can be. Its hue is the colour tools/columns.py
// measured between his Rhone's columns, exactly. Its darkness is his too, but taken as a ratio and not as a
// value: his water is 0.54 of his sky in brightness, and what that is applied to is the dark this night's sky
// stands on, not the paint that stands on it. Measuring his water's paint and putting it on our plane would be
// the mistake D2 made with the relief -- his paint is not his ground -- and a plane at his paint's brightness
// reads as a lit floor under the whole dream. Near black, with the sky's colour in it, is what 5.2 asks for.
// the slow wave of 5.5, a person's: how far along its own column a mark slides, how fast, and how much across
const WAVE = { amp: 0.022, rate: 0.37, side: 0.5 };
// The river and the shore (DESIGN 5.1 as D4.5 amends it). Until D4.5 the floor of the world was water
// everywhere, and all three of his grounds are `plane y: 0` laws -- so his village at Saint-Remy, his pavement
// in the Place du Forum and the Rhone itself were one surface, and that surface was the river. The piece had no
// land in it. It read as three pictures on a pond because it was three pictures on a pond.
//
// None of the three numbers that make the floor is authored. They come out of his Rhone canvas and out of one
// number the piece already had, the 1.65 m person both Arles standpoints were derived from in D4:
//
//   the shore's height  = his eye over the water less a standing man     = 4.411 - 1.65 = 2.761 m
//   the near bank       = where his own lowest ray leaves the quay, so   = 1.65 / tan(21.95 deg) = 4.10 m out,
//                         that the bottom edge of his frame is the water   which is the top of the quay wall
//   the far bank        = his far bank's own law                          = 220 m out
//
// Set the shore at 2.761 and all three of his grounds land on it at once and exactly -- the terrace's pavement
// (eye 4.411 less 1.65), the Starry Night's village (eye 42.761 less 40) and the Rhone's water (eye 4.411 less
// 4.411) -- which is the whole of the merge, in the height of a standing man.
const PERSON = 1.65;
let SHORE = 2.761, BANK = [-95.9, 120];
// The three that fly (DESIGN 8), and where they stand on the one sea (DESIGN 5.1). The placement is authored:
// Arles' two are one place, the quay looking east across the water at its far bank and the square three hundred
// metres behind it looking west up its own street, so that the two cones open away from each other and you pass
// the standpoint of the one to reach the other. Saint-Remy stands off across the water, seven hundred and sixty
// metres north-west of the quay, its cone opening north over its village and its hills. No cone touches another:
// they need not, since strokes.js keeps each out of the others, but the rule costs nothing where they do not meet
const CANVASES = [
  { slug: 'starry', title: 'The Starry Night', date: 'June 1889', collection: 'Museum of Modern Art, New York' },
  { slug: 'rhone', title: 'Starry Night Over the Rh\u00f4ne', date: 'September 1888', collection: "Mus\u00e9e d'Orsay, Paris" },
  { slug: 'cafeterrace', title: 'Caf\u00e9 Terrace at Night', date: 'September 1888', collection: 'Kr\u00f6ller-M\u00fcller Museum, Otterlo' },
];

// What is behind the paint: the dark the canvas was primed over, going to linen where the dream ends. There is no
// wall (DESIGN 5.4) -- a ray is linen in the measure that it leaves the dream soon, which is what puts the linen
// above you and round the far edge and nowhere else. Under ?noStrokes this is the whole picture, with the water.
const DOME_VERT = /* glsl */`varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position * 3000.0, 1.0); gl_Position = p.xyww; }`;
const DOME_FRAG = /* glsl */`
  varying vec3 vDir; uniform vec3 uZen, uHor, uWater, uLinen, uAt; uniform float uCeil, uEdge, uFade;
  void main() {
    vec3 d = normalize(vDir); float e = asin(clamp(d.y, -1.0, 1.0)) / 1.5708;
    vec3 c = mix(uHor, uZen, smoothstep(0.0, 0.7, e));
    c = mix(c, uWater, smoothstep(0.0, -0.02, e));
    float tc = d.y > 1e-3 ? (uCeil - uAt.y) / d.y : 1e9;
    float A = dot(d.xz, d.xz), B = dot(uAt.xz, d.xz), C = dot(uAt.xz, uAt.xz) - uEdge * uEdge;
    float disc = B * B - A * C;
    float tr = (A > 1e-6 && disc > 0.0) ? (-B + sqrt(disc)) / A : 1e9;
    float t = min(max(tc, 0.0), max(tr, 0.0));
    gl_FragColor = vec4(mix(c, uLinen, 1.0 - smoothstep(0.0, uFade, t)), 1.0);
  }`;
// The water is a floor, and a floor is not a ray: you never see past it, so the rule that puts linen where a ray
// leaves the dream soon (5.4) has nothing to say about it. It simply stops where the dream does, and past that
// the dome carries on in the same colour. Before D3 it went to linen at the edge, and from any eye near the
// water that was a bright line along the whole horizon, which is the edge of the canvas seen edge-on
const WATER_FRAG = /* glsl */`
  varying vec3 vW; uniform vec3 uCol; uniform float uEdge; uniform vec2 uBand; uniform float uSide;
  void main() {
    if (length(vW.xz) > uEdge) discard;
    // one floor, two surfaces: the river between his two banks, and the shore everywhere else
    if (uSide != 0.0 && ((vW.x > uBand.x && vW.x < uBand.y) != (uSide > 0.0))) discard;
    gl_FragColor = vec4(uCol, 1.0);
  }`;

async function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  const qual = Q.get('q') || (matchMedia('(pointer: coarse)').matches ? 'low' : 'mid');
  const budget = qual === 'high' ? 5.5e6 : qual === 'low' ? 1.2e6 : 3.2e6;
  renderer.setPixelRatio(Math.max(0.75, Math.min(devicePixelRatio || 1, qual === 'high' ? 2 : 1.5, Math.sqrt(budget / (innerWidth * innerHeight)))));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const cv = renderer.domElement;
  cv.tabIndex = 0;
  cv.setAttribute('aria-label', 'The Dream of Van Gogh. Drag to look; you fly where you look. W is faster, S slower, Shift a swoop, Space lets go, Z turns you onto your back.');
  document.getElementById('stage').appendChild(cv);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.2, 6000);
  let hfov = HFOV;

  const U = {
    uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uHead: { value: new THREE.Vector3(0, 0, -1) },
    uBrush: { value: makeBrushAtlas() },
    uKeyDir: { value: new THREE.Vector3() }, uKeyCol: { value: new THREE.Color() },
    uAmbSky: { value: new THREE.Color() }, uAmbGnd: { value: new THREE.Color() },
    uDark: { value: 1 / 6000 }, uLedger: { value: has('ledger') ? 1 : 0 },
    // the curl is off under ?test so that the standpoint test sees the painting still; parting has no reach there
    uCurl: { value: has('nocurl') || has('test') ? 0 : 1 },
    // parting is a flight's business, not a painting's: under ?test it is off, because at the terrace's own
    // eye his pavement begins at 3.9 m and would be pushed aside by it (DESIGN 6.5, BUILD.md D4)
    uPart: { value: has('nopart') || has('test') ? 0 : PART }, uPartA: { value: PART }, uPartB: { value: 2 * PART },
    uFocalPx: { value: 800 },
    uEye: { value: new THREE.Vector3() }, uWrap: { value: 0 }, uUnder: { value: has('nounder') ? 0 : 1 },
    uCeil: { value: CEIL }, uEdge: { value: EDGE }, uLinen: { value: new THREE.Color(...LINEN) },
    // the column mode of the one shader (DESIGN 4.5, 5.2): nought for a stroke that stands where it stands
    uColumn: { value: 0 }, uColWidth: { value: 0 }, uWave: { value: new THREE.Vector3(WAVE.amp, WAVE.rate, WAVE.side) },
    uOnly: { value: -1 }, uBand: { value: new THREE.Vector2(BANK[0], BANK[1]) },
    // the three cones (DESIGN 5.1): each canvas's frame, its eye, and its half-angles. The third component of
    // uConeHW says whether the cone is there at all, so that a piece with fewer canvases needs no other shader
    uCone: { value: [new THREE.Matrix3(), new THREE.Matrix3(), new THREE.Matrix3()] },
    uConeFar: { value: [1e9, 1e9, 1e9] }, uConeDepth: { value: null }, uConeCells: { value: 48 },
    // 5.1's rule (D4 (3), and measured again in D4.5): nought for the whole cone to the edge of the dream,
    // which is what it says and what the standpoint test needs; one for only as far as his own paint reaches
    // on each ray, under ?conedepth, which fills the cone from outside and costs every standpoint its test
    uConeRule: { value: has('conedepth') ? 1 : 0 },
    uConeAt: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
    uConeHW: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
  };
  // the light: the moon where the Starry Night puts it, a blue ambient from the sky, a darker one from the water
  const md = dirAzEl(25, 26);
  U.uKeyDir.value.set(md[0], md[1], md[2]).normalize();
  // at the standpoint the light on a stroke sums to about one, so that the frame there is the record's own colour
  U.uKeyCol.value.setRGB(...lin('#fff0c8').map(c => c * 0.7));
  U.uAmbSky.value.setRGB(...lin('#c8d4f0').map(c => c * 0.72));
  U.uAmbGnd.value.setRGB(...lin('#8890b0').map(c => c * 0.6));

  const post = new Post(renderer);
  const scene = new THREE.Scene();
  const domeU = { uZen: { value: new THREE.Color(...lin('#060b22')) }, uHor: { value: new THREE.Color(...lin('#0f1d44')) },
    uWater: { value: new THREE.Color(0, 0, 0) }, uLinen: U.uLinen, uAt: { value: new THREE.Vector3() },
    uCeil: U.uCeil, uEdge: U.uEdge, uFade: { value: 400 } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.ShaderMaterial({ vertexShader: DOME_VERT, fragmentShader: DOME_FRAG,
    uniforms: domeU, side: THREE.BackSide, depthTest: false, depthWrite: false }));
  dome.frustumCulled = false; dome.renderOrder = -10;
  scene.add(dome);
  const colHand = await (await fetch('hand/rhone-column.json')).json();
  const nightSpec = await (await fetch('hand/nights.json')).json();
  const nights = new Nights(nightSpec, { sharp: +(Q.get('sharp') ?? 2), shoulder: +(Q.get('shoulder') ?? 6), behind: +(Q.get('behind') ?? 0.25) });
  const wat = new Water({ hand: colHand, wave: WAVE, marks: +(Q.get('water') ?? 1) * colHand.mark.n_per_column });
  // the canvases at their standpoints, and the wind fitted to the first. The records and the laws are read
  // first and the cones set from them, because every stroke built after this has to know where all three are
  const layers = [];
  for (let i = 0; i < CANVASES.length; i++) {
    const c = CANVASES[i];
    const laws = await (await fetch(`depth/${c.slug}.json`)).json();
    const rec = await loadRecord(`strokes/${c.slug}-canvas.bin`);
    const depth = await loadDepth(`depth/${c.slug}-depth.bin`, rec.n);
    // the runtime's own flat, for the standpoint test: every stroke at one distance, so that only the brush and
    // the light can differ. The distance is not a hundred metres for every canvas -- from a quay 4 m over the
    // water a canvas flattened to a hundred metres puts its foreground under the water and the control measures
    // the water. It is the distance at which the canvas's lowest ray still stands above it
    if (has('flat')) {
      const Hm = rec.cm[1] / 100, Wm = Hm * rec.px[0] / rec.px[1];
      const low = (laws.eye.pitch - Math.atan((Hm / 2) / focal(laws.eye.hfov, Wm)) / DEG) * DEG;
      // over this canvas's own floor, which since D4.5 is the shore under two of the three and not the water
      const up = laws.eye.y - (laws.floor ?? 0);
      depth.d.fill(low < -0.01 ? Math.min(100, 0.8 * up / Math.sin(-low)) : 100);
    }
    if (has('dull')) depth.shine.fill(0);               // nothing lit, for the colour half of it
    layers.push({ ...c, i, eye: laws.eye, laws, rec, depth, cone: cone(laws.eye, rec) });
  }
  const only = Q.get('only') ? new Set(Q.get('only').split(',')) : null;
  // his three depth maps, side by side in one texture, so that the shader needs one sampler and no array of them
  const CDN = 48;
  const coneDepth = new Float32Array(CDN * CDN * 3);
  U.uConeDepth.value = new THREE.DataTexture(coneDepth, CDN * 3, CDN, THREE.RedFormat, THREE.FloatType);
  U.uConeDepth.value.minFilter = U.uConeDepth.value.magFilter = THREE.NearestFilter;
  U.uConeDepth.value.needsUpdate = true;
  for (let i = 0; i < 3; i++) {
    const L = layers[i];
    if (!L || has('nocones')) { U.uConeHW.value[i].set(0, 0, 0); continue; }
    const k = L.cone;
    U.uCone.value[i].set(k.R[0], k.U[0], k.Fw[0], k.R[1], k.U[1], k.Fw[1], k.R[2], k.U[2], k.Fw[2]);
    U.uConeAt.value[i].set(k.at[0], k.at[1], k.at[2]);
    U.uConeHW.value[i].set(k.hw, k.hh, 1);
    // How far his own paint reaches down each ray of this cone. The rule of 5.1 is there so that at his eye
    // the frame is his painting and nothing else; a stroke standing *behind* the farthest paint on its own ray
    // cannot get in front of it, and hiding those as well empties the whole cone to the edge of the dream --
    // from outside, a black rectangle cut in the sky with a small painting floating in it, which is this
    // milestone's gate failing for the opposite reason to D4's. One number for the cone will not do it: the
    // terrace paints a pavement at 4 m and a sliver of sky at 584, and the cone's own far would hide our sky
    // out to 584 m over the whole of it. So it is his depth map, coarsely, on his own canvas
    const CD = 48;                                       // cells across and down, per canvas
    const dm = new Float32Array(CD * CD);
    for (let j = 0; j < L.rec.n; j++) {
      const u = clamp(0.5 * (L.rec.p[j * 6] + L.rec.p[j * 6 + 4]), 0, 0.999999);
      const v = clamp(0.5 * (L.rec.p[j * 6 + 1] + L.rec.p[j * 6 + 5]), 0, 0.999999);
      const c = Math.floor(v * CD) * CD + Math.floor(u * CD);
      if (L.depth.d[j] > dm[c]) dm[c] = L.depth.d[j];
    }
    // a cell his brush never reached takes the farthest of the cells round it, so that the edge of a region is
    // not a hole in the rule; a cell no pass reaches at all keeps nothing, and our sky stands there
    for (let pass = 0; pass < 3; pass++) {
      const was = dm.slice();
      for (let y = 0; y < CD; y++) for (let x = 0; x < CD; x++) {
        if (was[y * CD + x] > 0) continue;
        let m = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || yy >= CD || xx < 0 || xx >= CD) continue;
          if (was[yy * CD + xx] > m) m = was[yy * CD + xx];
        }
        dm[y * CD + x] = m;
      }
    }
    for (let j = 0; j < dm.length; j++) dm[j] *= 1.02;
    k.depthMap = { n: CD, d: dm };
    for (let y = 0; y < CD; y++) for (let x = 0; x < CD; x++) coneDepth[y * (CD * 3) + i * CD + x] = dm[y * CD + x];
    let far = 0;
    for (let j = 0; j < dm.length; j++) if (dm[j] > far) far = dm[j];
    k.far = U.uConeFar.value[i] = far;
    if (!has('conedepth')) { k.far = 1e9; k.depthMap = null; }
  }
  U.uConeDepth.value.needsUpdate = true;
  for (const L of layers) {
    L.ex = explode(L.rec, L.depth, L.eye, 0);
    // the underside stands off along this canvas's own ray, from its own eye, and his strokes are exempt from
    // his own cone and from no one else's
    L.st = new Strokes(U, L.ex, { uEye: { value: new THREE.Vector3(L.eye.x, L.eye.y, L.eye.z) }, uMine: { value: L.i } });
    L.st.mesh.visible = !has('noStrokes') && (!only || only.has('his') || only.has(L.slug));
    scene.add(L.st.mesh);
  }
  // The floor, out of his Rhone canvas and a standing man (DESIGN 5.1 as D4.5 amends it). Built here and not
  // earlier because all three numbers are read off a canvas that has to be loaded first
  {
    const R = layers.find(l => l.slug === 'rhone');
    SHORE = +(R.eye.y - PERSON).toFixed(3);
    const Hm = R.rec.cm[1] / 100, Wm = Hm * R.rec.px[0] / R.rec.px[1];
    // the lowest ray of his frame, and where it leaves the top of the quay: past that the bottom of his canvas
    // is water, which is what his canvas paints there. Nearer than that and the quay stands in his own picture
    const low = -(R.eye.pitch - Math.atan((Hm / 2) / focal(R.eye.hfov, Wm)) / DEG);   // degrees below the horizontal
    BANK = [+(R.eye.x + PERSON / Math.tan(low * DEG)).toFixed(3),
            +(R.eye.x + R.laws.regions.farbank.law.d).toFixed(3)];
    U.uBand.value.set(BANK[0], BANK[1]);
  }
  // His hue, at his own share of the light that stands over the floor (DESIGN 5.2 as D4.6 amends it). Both
  // shares are measured and both are his: his Rhone's water is 0.554 of its own sky and his village at
  // Saint-Remy is 0.4235 of his. What changes in D4.6 is what they are a share *of*. D3 had two references to
  // choose between -- his ground over his sky's paint, or over the dark that paint stands on -- and chose the
  // dark, because our sky is his paint at a coverage and his is a canvas painted solid, so his ratio on his
  // paint gives a floor brighter than the sky over it. But our sky is neither of those two things, and it can
  // simply be measured: see `lightAt` below. The dark D3 chose, lum('#0f1d44'), is 0.0140; his own sky at
  // Saint-Remy is 0.1479; and the floor stood under a night ten and a half times darker than the one over it,
  // which is what `?wet=` was for and why at about ten it looked right. These two are now the hue and the
  // share alone, at a light of one, and `paintNight` multiplies in the light the place actually has
  const ZEN = lin('#060b22'), HOR = lin('#0f1d44');
  const waterCol = wat.colour([1, 1, 1]);
  const shoreCol = nights.floor(nightSpec.shore, [1, 1, 1]);
  const floorMat = (col, side) => new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vW; void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: WATER_FRAG, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(...col) }, uEdge: U.uEdge, uBand: U.uBand, uSide: { value: side } } });
  const waterMat = floorMat(waterCol, 1), shoreMat = floorMat(shoreCol, -1), wallMat = floorMat(shoreCol, 0);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.6;                            // his water lies on the plane; the plane is a little under it
  scene.add(water);
  const land = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), shoreMat);
  land.rotation.x = -Math.PI / 2;
  land.position.y = SHORE - 0.6;                      // and his village and his pavement lie on this one
  scene.add(land);
  // the two quay walls, so that the shore has a thickness when you fly along the water and do not look through
  // the land from under it. Nothing is modelled here either: it is the floor, seen edge on
  const floorParts = [water, land];
  for (const [x, sgn] of [[BANK[0], 1], [BANK[1], -1]]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40000, SHORE), wallMat);
    wall.rotation.y = sgn * Math.PI / 2;
    wall.position.set(x, SHORE / 2 - 0.6, 0);
    scene.add(wall);
    floorParts.push(wall);
  }


  const windSpec = await (await fetch('hand/starry-wind.json')).json();
  const wind = new Wind(windSpec, NOISE);
  if (has('nowind')) wind.on = 0;
  U.uEye.value.set(wind.eye[0], wind.eye[1], wind.eye[2]);   // ours stand off the Starry Night's eye

  // ours, in his hand (DESIGN 4.6, 5.3). Rule 3: every measure of ours is his, from hand/*.json
  const skyHand = await (await fetch('hand/starry-sky.json')).json();
  const starHand = await (await fetch('hand/starry-star.json')).json();
  const laws0 = await (await fetch('depth/starry.json')).json();
  const regionOf = new Uint8Array(await (await fetch('hand/starry-region.bin')).arrayBuffer());
  const regionNames = Object.keys(laws0.regions);
  const sky = new Sky({ hand: skyHand, star: starHand, wind, laws: laws0, nights, cones: layers.map(l => l.cone), night: !has('nonight'),
    density: +(Q.get('sky') ?? 1), stars: +(Q.get('stars') ?? 12), motes: +(Q.get('motes') ?? 2600),
    ceiling: CEIL, edge: EDGE, linen: LINEN });
  const ours = [];
  const addOurs = (name, ex, ov) => {
    if (!ex.n || has('no' + name)) return;
    const st = new Strokes(U, ex, ov);
    st.mesh.visible = !has('noStrokes') && (!only || only.has(name));
    scene.add(st.mesh);
    ours.push({ name, ex, st });
  };
  const t0build = performance.now();
  addOurs('sky', sky.makeSky());
  addOurs('stars', sky.makeStars());
  addOurs('motes', sky.makeMotes(), { uWrap: { value: sky.mote.cell }, uTint: { value: new THREE.Vector3(1, 1, 1) } });
  // the floor's own paint, in his hand at our density (DESIGN 5.2, 5.3's rule for the motes). Two surfaces now:
  // the river, in his Rhone water's hand, and the shore, in his terrace pavement's -- the only ground he painted
  // as a surface you stand on -- in the colour his unlit village at Saint-Remy is. Each keeps to its own side of
  // the bank, and each lies on the floor instead of wrapping up to the height of the eye
  const seaHand = await (await fetch('hand/rhone-water.json')).json();
  const sea = makeSea(seaHand, { cover: +(Q.get('sea') ?? 1) * 0.03, drift: [wind.fl.drift[0], wind.fl.drift[1]] });
  addOurs('sea', sea, { uWrap: { value: sea.cell }, uWrapLow: { value: -1 }, uWrapY: { value: 0 },
                        uSide: { value: 1 }, uTint: { value: new THREE.Vector3(1, 1, 1) } });
  const shoreHand = await (await fetch('hand/cafeterrace-pavement.json')).json();
  const shore = makeSea(shoreHand, { cover: +(Q.get('shore') ?? 1) * 0.03, y: SHORE, seed: 4041,
                                     rgb: nightSpec.shore.rgb, drift: [wind.fl.drift[0], wind.fl.drift[1]] });
  addOurs('shore', shore, { uWrap: { value: shore.cell }, uWrapLow: { value: -1 }, uWrapY: { value: 0 },
                            uSide: { value: -1 }, uTint: { value: new THREE.Vector3(1, 1, 1) } });
  // the reflections: one column under every light in the dream, his and ours (DESIGN 5.2), on the river only --
  // a reflection needs water under it, and past the bank there is none
  const lit = lights({ layers, ours, eye: wind.eye, link: +(Q.get('link') ?? 0.014) });
  const cols = wat.makeColumns(lit);
  addOurs('reflections', cols, { uColumn: { value: cols.column }, uColWidth: { value: wat.widthOverReach },
                                 uSide: { value: 1 } });
  const buildMs = Math.round(performance.now() - t0build);

  // The light the floor stands under, measured (DESIGN 5.2 as D4.6 amends it). `measureLight` renders our own
  // sky from a place -- five faces of a cube at ninety degrees, and the upper hemisphere of them -- and gives
  // back the solid-angle mean of everything that arrives there: our ribbons, his canvas where a cone opens
  // overhead, the dome behind both. His `over_sky` is a share of a sky region's mean on a canvas painted
  // solid; this is that same quantity for ours, which is his paint at whatever coverage our ribbons reach.
  // It is taken once, a few frames in (see the loop), over the floor under each of his three standpoints, and
  // between the three the floor takes the same weights the night's colour does: one field, three measurements
  const floorAt = x => (x > BANK[0] && x < BANK[1] ? 0 : SHORE);
  const FOCAL = 3200;
  let LIT = null, tried = false;
  const wbuf = [0, 0, 0], kbuf = [0, 0, 0];
  // ?d3floor puts the floor back on the reference D3 gave it, the dark the dome stands on, so that the two can
  // be looked at side by side in one page. It is a comparison and not a setting: there is no number in it
  const d3 = has('d3floor');
  const lightAt = p => {
    // D3's own reference, which is what the floor stands on until the measurement is taken -- and stays on if it
    // cannot be: a renderer with no float target to read gives the piece its old floor and not a black one
    if (d3 || !LIT) { const k = nights.ratioAt(p, 2, kbuf); return lum([HOR[0] * k[0], HOR[1] * k[1], HOR[2] * k[2]]); }
    const w = nights.weights(p, wbuf);
    let s = 0;
    for (let i = 0; i < w.length; i++) s += w[i] * LIT[i];
    return s;
  };
  function measureLight(q, N = 64, focal = FOCAL) {
    const rt = new THREE.WebGLRenderTarget(N, N, { type: THREE.FloatType, samples: 4 });
    const cam = new THREE.PerspectiveCamera(90, 1, 0.2, 6000);
    const keep = U.uCam.value.clone(), keepAt = domeU.uAt.value.clone();
    const keepF = U.uFocalPx.value, keepP = U.uPart.value;
    U.uCam.value.set(q[0], q[1], q[2]); domeU.uAt.value.set(q[0], q[1], q[2]);
    // pinned, both of them, so that the same place gives the same light whoever is looking and however fast.
    // A stroke under eight tenths of a pixel is not drawn (src/strokes.js), so a coarse frame is a darker
    // night -- true of the piece, and no business of the floor's; the focal here is high enough that nothing
    // of his is lost to it. And parting opens a tunnel round a body in flight, which is the body's business
    // and not the place's: the light over the quay is the same whether anyone is flying over it or not
    U.uFocalPx.value = focal; U.uPart.value = 0;
    paintNight(q);
    // the floor is not its own light. Everything whose colour is the floor's is taken out of the frame while
    // this is read -- the two planes, the two walls, and the marks lying on them -- so that what comes back is
    // the sky over the place and nothing that waits on the answer
    const off = floorParts.concat(ours.filter(o => o.name === 'sea' || o.name === 'shore').map(o => o.st.mesh));
    const was = off.map(m => m.visible);
    for (const m of off) m.visible = false;
    const buf = new Float32Array(N * N * 4), d = new THREE.Vector3();
    const s = [0, 0, 0];
    let sw = 0;
    for (const f of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
      cam.position.set(q[0], q[1], q[2]);
      cam.up.set(0, f[1] ? 0 : 1, f[1] ? -1 : 0);
      cam.lookAt(q[0] + f[0], q[1] + f[1], q[2] + f[2]);
      cam.updateMatrixWorld();
      renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
      renderer.readRenderTargetPixels(rt, 0, 0, N, N, buf);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const u = 2 * (i + 0.5) / N - 1, v = 2 * (j + 0.5) / N - 1;
        d.set(u, v, -1).transformDirection(cam.matrixWorld);
        if (d.y <= 0) continue;                                    // the floor is not its own light
        const w = Math.pow(1 + u * u + v * v, -1.5), o = (j * N + i) * 4;
        s[0] += w * buf[o]; s[1] += w * buf[o + 1]; s[2] += w * buf[o + 2]; sw += w;
      }
    }
    off.forEach((m, i) => { m.visible = was[i]; });
    U.uCam.value.copy(keep); domeU.uAt.value.copy(keepAt);
    U.uFocalPx.value = keepF; U.uPart.value = keepP;
    rt.dispose();
    const m = s.map(c => c / sw);
    return { at: q.map(v => +v.toFixed(1)), rgb: m.map(c => +c.toFixed(6)), lum: +lum(m).toFixed(6),
             focal: focal, sr: +(sw * 4 / (N * N)).toFixed(3) };
  }

  // The colour of the night where the eye is (DESIGN 5.3 as D4.5 amends it). His three nights are three
  // colours, and the dome, the floor and every mark of ours that wraps round the eye take the one the place
  // stands in, so that flying up the river from Saint-Remy to the square is one change and not a line. The
  // floor's hue does not move with it -- his water's hue is his and his village's is his, by D3's rule -- only
  // its brightness, which is a ratio against the sky the place actually stands under
  const tintOf = n => (ours.find(o => o.name === n) || { st: { u: { uTint: { value: null } } } }).st.u.uTint.value;
  const tints = ['motes', 'sea', 'shore'].map(n => [n, tintOf(n)]).filter(t => t[1]);
  const camPos = [0, 0, 0];
  // each floor mark was painted under its own canvas's night, so each dims by the light here against that one
  const SEA_SKY = colHand.water.sky_lum, SHORE_SKY = nightSpec.nights[0].lum, hlum = lum(HOR);
  const kz = [0, 0, 0], wc = [0, 0, 0], sc = [0, 0, 0];
  function paintNight(p) {
    // the horizon at the horizon's own elevation and the zenith at the top of his sky, since a night is not
    // one colour up the sky and all three of his canvases say the same thing about how it changes
    const kn = nights.ratioAt(p, 2);
    const kzz = nights.ratioAt(p, 30, kz);
    const L = lightAt(p);
    domeU.uZen.value.setRGB(ZEN[0] * kzz[0], ZEN[1] * kzz[1], ZEN[2] * kzz[2]);
    domeU.uHor.value.setRGB(HOR[0] * kn[0], HOR[1] * kn[1], HOR[2] * kn[2]);
    for (let k = 0; k < 3; k++) { wc[k] = waterCol[k] * L; sc[k] = shoreCol[k] * L; }
    domeU.uWater.value.setRGB(wc[0], wc[1], wc[2]);            // under the horizon the dome is the water's own
    waterMat.uniforms.uCol.value.setRGB(wc[0], wc[1], wc[2]);
    for (const m of [shoreMat, wallMat]) m.uniforms.uCol.value.setRGB(sc[0], sc[1], sc[2]);
    // a mark lying on the floor dims with the floor it lies on, so that the ratio between his paint and his
    // ground stays the one his canvas has. The motes are not on the floor and take the night's colour instead
    for (const [n, v] of tints) {
      if (n === 'motes') { v.set(kn[0], kn[1], kn[2]); continue; }
      // under ?d3floor the marks take the factor D4.5 gave them too, so that the comparison is D4.5 whole
      const t = d3 ? L / hlum : L / (n === 'sea' ? SEA_SKY : SHORE_SKY);
      v.set(t, t, t);
    }
    return { kn, L: +L.toFixed(6) };
  }
  paintNight([layers[0].eye.x, layers[0].eye.y, layers[0].eye.z]);

  const flight = new Flight(cv);
  // sound (DESIGN 10): the water layer, which D3 builds; a browser makes no sound until a person has done
  // something, so the first look starts it, and M turns it off and on again
  const sound = new Sound({ rate: WAVE.rate });
  if (!has('nosound')) sound.arm(cv);
  flight.on('sound', () => sound.toggle());
  const at = has('at') || has('test') ? clamp(parseInt(Q.get('at') || Q.get('test'), 10) || 1, 1, layers.length) : 1;
  const eyeOf = n => { const e = layers[n - 1].eye; flight.go({ pos: [e.x, e.y, e.z], yaw: e.yaw, pitch: e.pitch, speed: 3 }); };
  eyeOf(at);
  if (has('test')) { hfov = layers[at - 1].eye.hfov; flight.script = { speed: 0, dx: 0, dy: 0 }; flight.speed = 0; wind.on = 0; }
  // the current to a standpoint (DESIGN 6.4): eight to twelve seconds, longer the farther it is
  const seen = new Set();
  const currentTo = n => {
    const e = layers[n - 1].eye;
    const d = Math.hypot(e.x - flight.pos[0], e.y - flight.pos[1], e.z - flight.pos[2]);
    const T = clamp(6 + d / 150, 8, 12);
    flight.carryTo(e, T);
    pending.push({ t: time + T + 0.05, f: () => caption(n) });
    return T;
  };

  const line = document.getElementById('line'), panel = document.getElementById('panel'), dbg = document.getElementById('debug');
  // the caption (DESIGN 9, 11): his own line at each standpoint, once, for six seconds. What it quotes was
  // checked against the edition by tools/lines.py before it shipped, and letters/letters.json is the record
  const capEl = document.getElementById('caption');
  const said = await (await fetch('letters/letters.json')).json();
  const lineOf = id => said.lines.find(l => l.id === id);
  let capT = 0;
  function caption(n, force = false) {
    const L = layers[n - 1];
    if (!L || has('nocaption') || has('test') || has('notitle') || (seen.has(n) && !force)) return;
    seen.add(n);
    const q = lineOf(L.slug);
    capEl.innerHTML = `<b></b><i></i><q></q>`;
    capEl.children[0].textContent = L.title;
    capEl.children[1].textContent = `${L.date}. ${L.collection}`;
    capEl.children[2].textContent = q ? '\u201c' + q.text + '\u201d' : '';
    capEl.classList.add('on');
    line.classList.remove('on');           // one thing in the corner at a time (DESIGN 11)
    capT = time + 6;
  }
  let looked = false;
  flight.on('look', () => { looked = true; line.classList.remove('on'); cv.focus({ preventScroll: true }); });
  flight.on('letgo', () => { flight.letgo = !flight.letgo; });
  flight.on('back', () => flight.back());
  flight.on('eye', n => { if (n >= 1 && n <= layers.length) currentTo(n); });
  flight.on('fullscreen', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {}));
  const KEYS = 'drag        look; you fly where you look\nW  ↑        faster\nS  ↓        slower\nShift       a swoop\nSpace       let go; the wind has you\nZ           onto your back\n1           to his eye\nL           the ledger\nM           sound\nF           full screen';
  const NAMED = { sky: 'our sky   ', stars: 'our stars ', motes: 'the motes ', reflections: 'reflections', sea: 'the sea   ' };
  const NOTE = { sky: 'outside his cone, at his density', stars: `${sky.nStars} unnamed, where the eddies are not`,
                 motes: `a lattice ${sky.mote.cell} m wide, round you`,
                 reflections: `${lit.length} lights, his and ours, on the water`,
                 sea: `a lattice ${sea.cell} m wide on the water, ${sea.per_m2}/m\u00b2` };
  const LEDGER = () => {
    const his = layers.reduce((s, l) => s + l.ex.n, 0);
    const mine = ours.reduce((s, o) => s + o.ex.n, 0);
    const M = windSpec.measured, A = windSpec.authored, D = skyHand.density;
    return `his strokes   ${his}\n` +
      layers.map(l => `  ${l.title.padEnd(26)}${String(l.ex.n).padStart(6)}   ${l.date}, ${l.collection}`).join('\n') +
      `\nours          ${mine}\n` +
      ours.map(o => `  ${NAMED[o.name]}${String(o.ex.n).padStart(6)}   ${NOTE[o.name]}`).join('\n') +
      `\n\nmeasured: his strokes, their rays, their curl;\n  the wind's shape, fitted to ${M.strokes} sky strokes\n` +
      `  (${M.residual_deg}° off his strokes, ${M.residual_bands_deg}° off his bands;\n  his hand scatters ${M.noise_floor_deg}°);\n` +
      `  every measure a stroke of ours carries, from his sky\n  (hand/starry-sky.json): its colour, length, width, curl,\n` +
      `  impasto, depth, bow, and the angle it lies off its band;\n  and his density, ${D.per_sr} strokes a steradian in a\n  shell ${D.shell_m} m thick\n` +
      `  every measure a mark of ours on the water carries,\n  from his Rhone's ten columns (hand/rhone-column.json):\n` +
      `  how far a column reaches, how wide it is for that,\n  how many marks, how long and how slanted each is,\n` +
      `  what colour it is at each point down it, and his\n  water's own colour, which is his sky's times\n` +
      `  ${colHand.water.over_sky.join(', ')}\n` +
      `  every measure a mark of ours on the river carries,\n  from his Rhone's own water (hand/rhone-water.json),\n` +
      `  and of one on the shore from his terrace's pavement\n  (hand/cafeterrace-pavement.json): its length and\n` +
      `  width against the spacing round it, how far off the\n  line it lies, its bow and its curl -- but not his\n` +
      `  density, which is a covering ${seaHand.cover} deep on his water and\n  ${shoreHand.cover} on his pavement and cannot be paid for on\n` +
      `  an open floor: ours is ${sea.cover.toFixed(3)}, and ours is what the\n  ledger calls it. Nor his pavement's colour, which is\n` +
      `  a lamp's: the shore's is his unlit village at\n  Saint-Remy, ${nightSpec.shore.over_sky} of his own sky (hand/nights.json)\n` +
      `  the colour of the night itself, canvas by canvas and\n  band by band up the sky (hand/nights.json): his sky\n` +
      `  is ${nightSpec.nights.map(n => n.slug + ' ' + n.lum.toFixed(4)).join(', ')}\n  in brightness, and he painted ` +
      nightSpec.nights.map(n => `${n.slug} from ${n.el_deg[0].toFixed(0)}\u00b0 to ${n.el_deg[1].toFixed(0)}\u00b0`).join(',\n  ') + `\n  above the horizontal -- bands that do not touch\n` +
      `  and the light our own sky gives the floor, rendered\n  from it (D4.6): ${(LIT || []).map(v => v.toFixed(4)).join(', ') || 'not read here'} under his three\n` +
      `  standpoints, against his own skies' ${nightSpec.nights.map(n => n.lum.toFixed(4)).join(', ')} --\n` +
      `  a night between a quarter and a half of his, and the\n  floor is his ground's own share of it and nothing else\n` +
      `\nhis own words, checked against the edition before they\n  shipped (tools/lines.py, letters/letters.json):\n` +
      layers.map(l => { const q = lineOf(l.slug); return q ? `  \u201c${q.text}\u201d\n    letter ${q.letter} to ${q.to}, ${q.date}` : ''; }).filter(Boolean).join('\n') + '\n' +
      `\nderived, not authored (DESIGN 5.1-5.2, D4.5 and D4.6):\n  the shore stands ${SHORE} m over the river, which is\n` +
      `  his Rhone eye at 4.411 m less a standing man at 1.65,\n  and all three of his grounds lie on it exactly;\n` +
      `  the river runs between his own two banks, ${BANK[0]} and\n  ${BANK[1]} m from his eye, and is ${(BANK[1] - BANK[0]).toFixed(1)} m across;\n` +
      `  the floor's colour, which is his hue and his share of\n  the light over it: water ${wc.map(v => v.toFixed(4)).join(', ')}\n  shore ${sc.map(v => v.toFixed(4)).join(', ')}, here\n` +
      `\nauthored: where the three standpoints stand on that\n  shore (DESIGN 5.1): ` +
      layers.map(l => `${l.slug} ${l.eye.x},${l.eye.y},${l.eye.z} facing ${l.eye.yaw}\u00b0`).join(';\n  ') + `;\n` +
      `  the depths by region for each\n  (depth/*.json, depth/*-mask.png);\n` +
      `  the wind's speeds: ${A.drift_mps} m/s open, ${A.peak_mps} in an eddy,\n  ${A.draw_mps} along its axis (hand/starry-wind.json);\n` +
      `  the curl noise outside his cone, ${Math.round(NOISE.lam * 57.3)}° across;\n  how few our stars are; and the motes, which are for\n  the sensation and not the picture`;
  };
  let panelOn = null;
  const show = (k, text) => { if (panelOn === k) { panel.hidden = true; panelOn = null; return; } panel.textContent = text; panel.hidden = false; panelOn = k; };
  flight.on('help', () => show('help', KEYS));
  flight.on('ledger', () => show('ledger', LEDGER()));
  if (!has('notitle')) setTimeout(() => { if (!looked && !capT) line.classList.add('on'); }, 800);

  const grade = { exposure: +(Q.get('exposure') || 1.0), bloom: 0.7, sat: 1.0, contrast: 1.0, vignette: has('test') ? 0 : 0.3, grain: 0.02, time: 0, warm: 0, black: 0, thresh: 1.0, tone: 0 };

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = 2 * Math.atan(Math.tan(hfov * DEG / 2) / camera.aspect) / DEG;
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    post.setSize(Math.floor(w * pr), Math.floor(h * pr));
    U.uFocalPx.value = (h * pr / 2) / Math.tan(camera.fov * DEG / 2);
  }
  addEventListener('resize', resize);
  resize();
  renderer.compile(scene, camera);

  // the three fixed flights (BUILD.md, the harness): the same from D0 to the end, a hand the harness holds.
  // glide is let go over Saint-Rémy: the body's own speed goes to nothing and the wind has it for a minute
  const FLIGHTS = {
    glide: { pos: null, yaw: 0, pitch: 8, speed: 0, T: 60, dx: 0, pitchTo: 8 },
    swoop: { pos: [0, 2, 220], yaw: 0, pitch: 22, speed: 40, T: 30, dx: 0, pitchTo: 22 },
    village: { pos: [0, 24, -80], yaw: 0, pitch: -8, speed: 3, T: 60, dx: -0.3 * DEG, pitchTo: -8 },
  };
  let running = null;
  const pending = [];                                  // things to do at a time of the piece's own clock
  const watchers = [];                                 // things to do every frame until they say they are done
  function runFlight(name, opts = {}) {
    const F = FLIGHTS[name];
    if (!F) return Promise.reject(new Error('no flight ' + name));
    const e = layers[0].eye;
    flight.go({ pos: F.pos || [e.x, e.y, e.z], yaw: F.yaw, pitch: F.pitch, speed: F.speed });
    flight.script = { speed: F.speed, dx: F.dx, dy: 0, pitch: F.pitchTo };
    return new Promise(res => { running = { name, t: 0, T: F.T, fps: [], acc: 0, n: 0, res, dwell: opts.dwell ? newDwell() : null }; });
  }

  // the parting test (DESIGN 6.5, BUILD.md D1): on a flight, how long does any stroke stay within 2 m of the eye?
  // The parted positions are computed here as the shader computes them, at five points along each stroke, and
  // the paint's distance is the centreline's less the stroke's half width. Two numbers a stroke: the longest it
  // stayed within 2 m, and whether it ever stayed longer than 0.2 s.
  // every stroke in the air is tested, his and ours; a stroke whose middle is farther off than it can reach --
  // half its chord, half its width, and the tube's radius -- cannot be within two metres, and is skipped
  const tested = [...layers.map(l => ({ name: l.slug, ex: l.ex })), ...ours.map(o => ({ name: o.name, ex: o.ex }))];
  for (const t of tested) {
    // a reflection does not stand where it is built: it is laid on the water from the eye every frame, so the
    // test asks water.js for the marks as they actually stand and measures those (src/water.js, place)
    if (t.name === 'reflections') { t.place = true; t.N = t.ex.n; continue; }
    const e = t.ex, R = new Float32Array(e.n);
    for (let i = 0; i < e.n; i++) {
      const o = i * 3;
      R[i] = 2.5 + 0.6 * Math.hypot(e.P[2][o] - e.P[0][o], e.P[2][o + 1] - e.P[0][o + 1], e.P[2][o + 2] - e.P[0][o + 2])
           + 0.5 * e.size[i * 4] + e.size[i * 4 + 3];
    }
    t.reach = R;
    t.N = e.n;
  }
  const nTested = tested.reduce((s, t) => s + t.N, 0);
  function newDwell() {
    return { acc: new Float32Array(nTested), accP: new Float32Array(nTested), max: 0, maxP: 0,
             over: new Uint8Array(nTested), overP: new Uint8Array(nTested), frames: 0, by: {} };
  }
  function dwellFrame(D, dt) {
    let base = 0;
    for (const t of tested) { dwellOne(D, dt, t, base); base += t.N; }
    D.frames++;
  }
  function dwellOne(D, dt, T_, base) {
    const cam = flight.pos, hd = [U.uHead.value.x, U.uHead.value.y, U.uHead.value.z];
    const ex0 = T_.place ? wat.place(T_.ex, cam, U.uTime.value) : T_.ex, reach = T_.reach;
    const R0 = U.uPart.value, A = U.uPartA.value, B = U.uPartB.value, T = U.uTime.value, curl = U.uCurl.value;
    const wrap = T_.name === 'motes' ? sky.mote.cell : 0;
    const P0 = ex0.P[0], P1 = ex0.P[1], P2 = ex0.P[2];
    for (let i = 0; i < ex0.n; i++) {
      const o = i * 3, w = ex0.size[i * 4], cw = ex0.size[i * 4 + 3], ph = ex0.meta[i * 4 + 2];
      let wx = 0, wy = 0, wz = 0;
      if (wrap > 0) { wx = wrap * Math.round((cam[0] - P1[o]) / wrap); wy = wrap * Math.round((cam[1] - P1[o + 1]) / wrap); wz = wrap * Math.round((cam[2] - P1[o + 2]) / wrap); }
      const j = base + i;
      const rr = reach ? reach[i] : 2.5 + 0.6 * Math.hypot(P2[o] - P0[o], P2[o + 1] - P0[o + 1], P2[o + 2] - P0[o + 2]) + 0.5 * w + cw;
      if (Math.hypot(P1[o] + wx - cam[0], P1[o + 1] + wy - cam[1], P1[o + 2] + wz - cam[2]) > rr) { D.acc[j] = D.accP[j] = 0; continue; }
      const chord = Math.max(Math.hypot(P2[o] - P0[o], P2[o + 1] - P0[o + 1], P2[o + 2] - P0[o + 2]), 1e-3);
      const slide = curl * cw * Math.sin(T * 0.42 + ph) / chord;
      let best = 1e9, bestP = 1e9;
      for (let k = 0; k <= 4; k++) {
        const t = clamp(k / 4 + slide, -0.2, 1.2), mt = 1 - t;
        const taper = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(2 * (k / 4) - 1), 6)));
        let x = mt * mt * P0[o] + 2 * t * mt * P1[o] + t * t * P2[o] + wx;
        let y = mt * mt * P0[o + 1] + 2 * t * mt * P1[o + 1] + t * t * P2[o + 1] + wy;
        let z = mt * mt * P0[o + 2] + 2 * t * mt * P1[o + 2] + t * t * P2[o + 2] + wz;
        if (R0 > 0) {
          const rx = x - cam[0], ry = y - cam[1], rz = z - cam[2];
          const along = rx * hd[0] + ry * hd[1] + rz * hd[2];
          const sx = rx - hd[0] * along, sy = ry - hd[1] * along, sz = rz - hd[2] * along;
          const sd = Math.hypot(sx, sy, sz);
          const ka = smoothstep(-B, -0.15 * B, along) * (1 - smoothstep(A, 2 * A, along));
          const Rt = ka * (R0 + 0.5 * w);
          if (Rt > 0) {
            const push = Math.sqrt(sd * sd + Rt * Rt) - sd;
            if (sd > 1e-3) { x += sx / sd * push; y += sy / sd * push; z += sz / sd * push; } else { y += push; }
          }
        }
        const d = Math.hypot(x - cam[0], y - cam[1], z - cam[2]);
        if (d < best) best = d;
        if (d - 0.5 * w * (0.3 + 0.7 * taper) < bestP) bestP = d - 0.5 * w * (0.3 + 0.7 * taper);
      }
      if (best < 2) { D.acc[j] += dt; if (D.acc[j] > D.max) D.max = D.acc[j]; if (D.acc[j] > 0.2) { D.over[j] = 1; D.by[T_.name] = (D.by[T_.name] || 0) + 1; } } else D.acc[j] = 0;
      if (bestP < 2) { D.accP[j] += dt; if (D.accP[j] > D.maxP) D.maxP = D.accP[j]; if (D.accP[j] > 0.2) D.overP[j] = 1; } else D.accP[j] = 0;
    }
  }
  const dwellResult = D => ({ maxCentre: +D.max.toFixed(3), overCentre: D.over.reduce((a, b) => a + b, 0), maxPaint: +D.maxP.toFixed(3), overPaint: D.overP.reduce((a, b) => a + b, 0), frames: D.frames, by: D.by });

  // one step of a fixed flight, used by the frame loop and by dream.sim alike: what the flight measures --
  // where the paint goes and how near it comes -- is a function of the piece's clock, not of the renderer
  function stepFlight(dt) {
    if (!running) return;
    running.t += dt;
    if (running.dwell) dwellFrame(running.dwell, dt);
    if (running.t >= running.T) {
      const r = { name: running.name, fps: running.fps, dpr: +dprCur.toFixed(2),
                  mean: running.fps.length ? Math.round(running.fps.reduce((a, b) => a + b, 0) / running.fps.length) : null,
                  min: running.fps.length ? Math.min(...running.fps) : null, simulated: !!running.sim };
      if (running.dwell) r.dwell = dwellResult(running.dwell);
      flight.script = null; running.res(r); running = null; window.__flight = r;
    }
  }

  const linenEl = document.getElementById('linen');
  let fade = 0, fading = 0, faded = 0;
  const outside = () => flight.pos[1] > CEIL || Math.hypot(flight.pos[0], flight.pos[2]) > EDGE;
  function restart() {
    eyeOf(1); flight.letgo = false; flight.onBack = false; flight.gazeTo = null; faded++;
  }
  let time = 0, frozen = has('t') ? parseFloat(Q.get('t')) : null, fps = 60, frames = 0;
  let dprCur = renderer.getPixelRatio(), slow = 0, quick = 0;
  const dprMax = dprCur;
  let last = performance.now();
  const headDir = [0, 0, -1];
  function frame(now) {
    // the real time between frames, and the time the piece is allowed to advance by. They are the same until a
    // frame takes longer than a twentieth of a second, which the piece caps so that a stall is not a teleport --
    // but the frame rate has to be measured on the real one, or a renderer slower than twenty can never say so
    const real = Math.max(0.0005, (now - last) / 1000);
    const dt = Math.min(0.05, real);
    last = now;
    fps += (1 / real - fps) * 0.05;
    time = frozen ?? time + dt;
    U.uTime.value = time;
    if (frames > 150 && frozen === null && !has('test') && !has('nogov')) {
      if (fps < 47) { slow += dt; quick = 0; } else if (fps > 58.5) { quick += dt; slow = 0; } else { slow = quick = 0; }
      if (slow > 1.5 && dprCur > 0.75) { dprCur = Math.max(0.75, dprCur - 0.15); renderer.setPixelRatio(dprCur); resize(); slow = 0; }
      if (quick > 8 && dprCur < dprMax) { dprCur = Math.min(dprMax, dprCur + 0.1); renderer.setPixelRatio(dprCur); resize(); quick = 0; }
    }
    // the body in the wind
    wind.at(flight.pos, flight.current);
    const sdt = frozen !== null ? 0 : dt;
    const v = flight.update(sdt);
    // parting follows the way the body actually goes, wind and all, and reaches ahead and behind by its speed
    const sp = Math.hypot(v.vx, v.vy, v.vz);
    const dir = sp > 0.3 ? [v.vx / sp, v.vy / sp, v.vz / sp] : flight.heading();
    const kh = 1 - Math.exp(-sdt / 0.25);
    for (let k = 0; k < 3; k++) headDir[k] += (dir[k] - headDir[k]) * kh;
    const hl = Math.hypot(headDir[0], headDir[1], headDir[2]) || 1;
    U.uHead.value.set(headDir[0] / hl, headDir[1] / hl, headDir[2] / hl);
    U.uPartA.value = Math.max(0.3 * sp, PART);
    U.uPartB.value = Math.max(2.0 * sp, 2 * PART);
    sound.update({ y: flight.pos[1], time, dt: sdt });
    if (capT && time > capT) { capEl.classList.remove('on'); capT = 0; }
    if (!has('nocaption')) for (let i = 0; i < layers.length; i++) {
      if (seen.has(i + 1)) continue;
      const e = layers[i].eye;
      if (Math.hypot(flight.pos[0] - e.x, flight.pos[1] - e.y, flight.pos[2] - e.z) < 25) caption(i + 1);
    }
    if (fading === 0 && outside()) fading = 1;
    if (fading === 1) { fade = Math.min(1, fade + sdt / 2.5); if (fade >= 1) { restart(); fading = -1; } }
    else if (fading === -1) { fade = Math.max(0, fade - sdt / 1.5); if (fade <= 0) fading = 0; }
    if (linenEl) linenEl.style.opacity = fade;
    for (let i = pending.length - 1; i >= 0; i--) if (time >= pending[i].t) pending.splice(i, 1)[0].f();
    for (let i = watchers.length - 1; i >= 0; i--) if (watchers[i](sdt)) watchers.splice(i, 1);
    if (running) { running.acc += real; running.n++;
      if (running.acc >= 1) { running.fps.push(Math.round(running.n / running.acc)); running.acc = 0; running.n = 0; }
      stepFlight(dt);
    }
    flight.applyTo(camera);
    U.uCam.value.copy(camera.position);
    domeU.uAt.value.copy(camera.position);
    camPos[0] = camera.position.x; camPos[1] = camera.position.y; camPos[2] = camera.position.z;
    paintNight(camPos);
    // the measurement the floor waits on: the light over the floor under each of his three standpoints, where
    // a person standing there would have their eyes (DESIGN 5.2 as D4.6 amends it). Taken a few frames in and
    // not at boot, because the first frames are not yet the piece -- the renderer's own state settles over
    // them, and taken at boot this read twice what it reads five frames later. Until then the floor is D3's,
    // which is five frames of the old floor and not five frames of a wrong one
    if (!tried && frames >= 5) {
      tried = true;
      const got = layers.map(l => measureLight([l.eye.x, floorAt(l.eye.x) + PERSON, l.eye.z]).lum);
      if (got.every(v => v > 0 && isFinite(v))) LIT = got;
      paintNight(camPos);
    }
    grade.time = time;
    if (has('nopost')) { renderer.setRenderTarget(null); renderer.render(scene, camera); } else post.render([scene], camera, grade);
    if (++frames === 6) { window.dream.ready = true; }
    if (dbg && frames % 15 === 0) { const s = flight.state(); dbg.textContent = `${fps.toFixed(0)} fps  dpr ${dprCur.toFixed(2)}\n${s.x} ${s.y} ${s.z}\nyaw ${s.yaw} pitch ${s.pitch} speed ${s.speed} roll ${s.roll}\nwind ${s.wind.join(' ')}${s.letgo ? '  let go' : ''}${s.onBack ? '  on your back' : ''}`; }
    requestAnimationFrame(frame);
  }
  if (has('debug')) dbg.hidden = false;

  const dream = window.dream = {
    ready: false,
    state: () => ({ ...flight.state(), fps: Math.round(fps), dpr: +dprCur.toFixed(2), hfov, strokes: layers.reduce((s, l) => s + l.ex.n, 0) + ours.reduce((s, o) => s + o.ex.n, 0), time: +time.toFixed(2), faded, fade: +fade.toFixed(2) }),
    counts: () => ({ his: layers.reduce((s, l) => s + l.ex.n, 0), ...Object.fromEntries(layers.map(l => [l.slug, l.ex.n])),
                     ...Object.fromEntries(ours.map(o => [o.name, o.ex.n])),
                     total: layers.reduce((s, l) => s + l.ex.n, 0) + ours.reduce((s, o) => s + o.ex.n, 0), buildMs }),
    restart: () => restart(),
    // the water (DESIGN 5.2, BUILD.md D3): what the plane is, and where every column stands from this eye
    water: () => ({ colour: wc.map(v => +v.toFixed(5)), of_his_sky: colHand.water.over_sky,
                    slope_deg: +(wat.slope / DEG).toFixed(3), lights: lit.length, marks: cols.n,
                    by: lit.reduce((a, l) => (a[l.of] = (a[l.of] || 0) + 1, a), {}) }),
    // one column, measured: where its light is, where the still water would put it, where it actually lies, and
    // how far off the line from the eye to its light the whole of it is -- which is what "under its light" means
    column: (i = 0, eye = null) => {
      const L = lit[i % lit.length], p = eye || flight.pos;
      const sp = wat.span(p, L.p);
      if (!sp) return null;
      const ex = cols, g = cols.lights[i % lit.length];
      const ph = wat.place(ex, p, U.uTime.value);
      let off = 0, n = 0, lo = 1e9, hi = -1e9;
      const az = Math.atan2(L.p[0] - p[0], L.p[2] - p[2]);
      for (let k = g.from; k < g.from + g.n; k++) {
        const o = k * 3, x = 0.5 * (ph.P[0][o] + ph.P[2][o]), z = 0.5 * (ph.P[0][o + 2] + ph.P[2][o + 2]);
        if (Math.abs(x) > 1e5) continue;
        const a = Math.atan2(x - p[0], z - p[2]);
        off = Math.max(off, Math.abs(Math.atan2(Math.sin(a - az), Math.cos(a - az))) / DEG);
        const d = Math.hypot(x - p[0], z - p[2]);
        lo = Math.min(lo, d); hi = Math.max(hi, d); n++;
      }
      return { light: { of: L.of, at: L.p.map(v => +v.toFixed(1)), rel: +L.rel.toFixed(2) },
               eye: p.map(v => +v.toFixed(1)), marks: n,
               mirror_m: +sp.mirror.toFixed(1), near_m: +sp.near.toFixed(1), far_m: +sp.far.toFixed(1),
               laid_m: [+lo.toFixed(1), +hi.toFixed(1)], to_light_m: +sp.D.toFixed(1),
               angLen_deg: +(sp.angLen / DEG).toFixed(2), off_bearing_deg: +off.toFixed(3),
               midP: sp.midP.map(v => +v.toFixed(1)), nearP: sp.nearP.map(v => +v.toFixed(1)),
               farP: sp.farP.map(v => +v.toFixed(1)) };
    },
    // the floor (DESIGN 6.3): come down at a swoop and see where it stops, whether it bounces, and how hard the
    // last three metres are. Timed on the piece's own clock, so a slow renderer measures the same thing
    floor: (o = {}) => new Promise(res => {
      const from = o.from ?? 60;
      flight.go({ pos: [o.x ?? 0, from, o.z ?? 0], yaw: 0, pitch: -85, speed: o.speed ?? 40 });
      flight.script = { speed: o.speed ?? 40, dx: 0, dy: 0, pitch: -85 };
      const trace = [];
      let t0 = time, lasty = from, minY = from, bounce = 0, settled = null;
      watchers.push(dt => {
        const y = flight.pos[1], vy = dt > 0 ? (y - lasty) / dt : 0;
        trace.push([+(time - t0).toFixed(3), +y.toFixed(3), +vy.toFixed(2)]);
        if (y - lasty > 0.002 && time - t0 > 0.1) bounce = Math.max(bounce, y - minY);
        minY = Math.min(minY, y); lasty = y;
        if (settled === null && Math.abs(vy) < 0.05 && time - t0 > 0.3) settled = time - t0;
        const done = (settled !== null && time - t0 > settled + 1.5) || time - t0 > (o.T || 12);
        if (done) {
          flight.script = null;
          const last3 = trace.filter(r => r[1] <= 4);
          res({ from, stopped_at: +flight.pos[1].toFixed(3), min: +minY.toFixed(3), bounce: +bounce.toFixed(4),
                settled_s: settled === null ? null : +settled.toFixed(2),
                last3_s: last3.length ? +(last3[last3.length - 1][0] - last3[0][0]).toFixed(2) : 0,
                vy_at_3m: last3.length ? +last3[0][2].toFixed(2) : null,
                vy_max_down: +Math.min(...trace.map(r => r[2])).toFixed(2), frames: trace.length,
                trace: o.trace ? trace : trace.filter((r, k) => k % 5 === 0 || r[1] < 4) });
        }
        return done;
      });
    }),
    // one of our stars, from a few tens of metres off it: each is a place, and its rings are metres across
    star: (i = 0, o = {}) => {
      const st = ours.find(x => x.name === 'stars');
      if (!st) return null;
      const d = st.ex.places[i % st.ex.places.length];
      const dep = 0.9 * sky.base(Math.asin(d[1]) / DEG);
      const c = [0, 1, 2].map(k => wind.eye[k] + d[k] * dep);
      const fr = wind.frame(d);
      const pos = [0, 1, 2].map(k => c[k] - d[k] * (o.back ?? 70) + fr.Up[k] * (o.up ?? 14) + fr.Rp[k] * (o.side ?? 0));
      const dir = [0, 1, 2].map(k => c[k] - pos[k]), L = Math.hypot(dir[0], dir[1], dir[2]);
      flight.go({ pos, yaw: Math.atan2(dir[0], -dir[2]) / DEG, pitch: Math.asin(dir[1] / L) / DEG, speed: o.speed ?? 0 });
      flight.script = { speed: o.speed ?? 0, dx: 0, dy: 0 };
      return { at: pos.map(v => +v.toFixed(1)), depth: +dep.toFixed(0), of: st.ex.places.length };
    },
    // the density ours was laid at, measured back off the strokes as tools/hand.py measures his: sixty-four cells
    // of two and a half degrees, outside his cone, which together are about the solid angle his own sky covers
    density: (cells = 160, rad = 1.55) => {
      const o = ours.find(x => x.name === 'sky');
      if (!o) return null;
      const e = wind.eye, cs = [], cosr = Math.cos(rad * DEG);
      for (let i = 0; cs.length < cells && i < 400000; i++) {
        const y = 0.03 + 0.96 * ((i * 0.618034) % 1), az = i * 2.39996, c = Math.sqrt(1 - y * y);
        const d = [c * Math.sin(az), y, -c * Math.cos(az)];
        if (wind.inCone(d) || wind.outside(d) < 1) continue;
        if (cs.some(q => q.d[0] * d[0] + q.d[1] * d[1] + q.d[2] * d[2] > Math.cos(2 * rad * DEG))) continue;
        cs.push({ d, dep: [] });
      }
      const ex = o.ex;
      for (let i = 0; i < ex.n; i++) {
        const j = i * 3, rx = ex.P[1][j] - e[0], ry = ex.P[1][j + 1] - e[1], rz = ex.P[1][j + 2] - e[2];
        const L = Math.hypot(rx, ry, rz), dx = rx / L, dy = ry / L, dz = rz / L;
        for (const c of cs) if (c.d[0] * dx + c.d[1] * dy + c.d[2] * dz > cosr) { c.dep.push(L); break; }
      }
      const Om = cs.length * 2 * Math.PI * (1 - cosr);
      const n = cs.reduce((s, c) => s + c.dep.length, 0);
      const good = cs.filter(c => c.dep.length >= 30).map(c => { const a = c.dep.slice().sort((x, y) => x - y);
        return { t: (a[Math.floor(0.9 * a.length)] - a[Math.floor(0.1 * a.length)]) / 0.8, n: c.dep.length }; });
      const srt = good.map(g => g.t).sort((x, y) => x - y);
      const shell = srt.length ? srt[srt.length >> 1] : 0;                       // the median patch
      const shellW = good.reduce((s2, g) => s2 + g.t * g.n, 0) / (good.reduce((s2, g) => s2 + g.n, 0) || 1);
      const per = n / Om, his = skyHand.density;
      return { cells: good.length, sr: +Om.toFixed(4), n, per_sr: Math.round(per),
               shell_m: +shell.toFixed(1), shell_by_stroke_m: +shellW.toFixed(1),
               per_sr_per_m: +(per / shell).toFixed(1), per_sr_per_m_by_stroke: +(per / shellW).toFixed(1),
               his: { per_sr: his.per_sr, shell_m: his.shell_m, shell_by_stroke_m: his.shell_by_stroke_m,
                      per_sr_per_m: his.per_sr_per_m, per_sr_per_m_by_stroke: his.per_sr_per_m_by_stroke },
               off_pct: +(100 * (per / shell / his.per_sr_per_m - 1)).toFixed(1),
               off_pct_by_stroke: +(100 * (per / shellW / his.per_sr_per_m_by_stroke - 1)).toFixed(1) };
    },
    // the seam (BUILD.md D2): his sky within `band` degrees inside the edge of his cone against ours within the
    // same band outside it -- the colour of the paint, and how long a stroke is, in the air and as an angle
    seam: (band = 3) => {
      const e = wind.eye, W = wind.W, H = wind.H, edge = band * DEG * wind.f;
      const side = (ex, inside, keep) => {
        const a = { n: 0, rgb: [0, 0, 0], ang: 0, len: 0, wid: 0 };
        for (let i = 0; i < ex.n; i++) {
          if (keep && !keep(i)) continue;
          const j = i * 3, rx = ex.P[1][j] - e[0], ry = ex.P[1][j + 1] - e[1], rz = ex.P[1][j + 2] - e[2];
          const L = Math.hypot(rx, ry, rz);
          const p = wind.planeOf([rx / L, ry / L, rz / L], [0, 0]);
          if (rx * wind.Fw[0] + ry * wind.Fw[1] + rz * wind.Fw[2] <= 0) continue;
          const m = Math.min(W / 2 - Math.abs(p[0]), H / 2 - Math.abs(p[1]));
          if (inside ? !(m > 0 && m < edge) : !(m < 0 && m > -edge)) continue;
          const c = Math.hypot(ex.P[2][j] - ex.P[0][j], ex.P[2][j + 1] - ex.P[0][j + 1], ex.P[2][j + 2] - ex.P[0][j + 2]);
          a.n++; a.len += c; a.ang += c / L; a.wid += ex.size[i * 4];
          for (let k = 0; k < 3; k++) a.rgb[k] += ex.col[i * 4 + k];
        }
        const m = a.n || 1;
        return { n: a.n, rgb: a.rgb.map(v => +(v / m).toFixed(5)), len_m: +(a.len / m).toFixed(2),
                 ang_mrad: +(1000 * a.ang / m).toFixed(2), wid_m: +(a.wid / m).toFixed(2) };
      };
      const skyish = i => { const r = regionNames[regionOf[i]]; return r === 'sky' || r === 'swirl'; };
      const his = side(layers[0].ex, true, skyish);
      const mine = side(ours.find(x => x.name === 'sky').ex, false, null);
      const pct = (a, b) => +(100 * (a / b - 1)).toFixed(1);
      return { band, his, ours: mine,
               off_pct: { rgb: his.rgb.map((v, k) => pct(mine.rgb[k], v)), len: pct(mine.len_m, his.len_m),
                          ang: pct(mine.ang_mrad, his.ang_mrad), wid: pct(mine.wid_m, his.wid_m) } };
    },
    go: o => flight.go(o),
    eye: n => eyeOf(n),
    speed: v => { flight.speed = flight.target = v; },
    hold: () => { flight.script = { speed: 0, dx: 0, dy: 0 }; flight.speed = 0; },
    free: () => { flight.script = null; },
    letgo: () => { flight.letgo = true; },
    back: () => flight.back(),
    freeze: t => { frozen = t; },
    wait: secs => new Promise(res => pending.push({ t: time + secs, f: () => res(dream.state()) })),
    flight: (name, opts) => runFlight(name, opts),
    // the parting test on whatever the body is doing now, for a place none of the three fixed flights goes --
    // the square, where his own pavement begins 3.9 m from his own eye
    dwellHere: (T = 20, name = 'here') => new Promise(res => {
      running = { name, t: 0, T, fps: [], acc: 0, n: 0, res, dwell: newDwell() };
    }),
    hfov: v => { hfov = v; resize(); },
    layers: o => { if ('strokes' in o) [...layers, ...ours].forEach(l => l.st.mesh.visible = o.strokes);
                   if ('his' in o) layers.forEach(l => l.st.mesh.visible = o.his);
                   if ('ours' in o) ours.forEach(l => l.st.mesh.visible = o.ours);
                   if ('water' in o) water.visible = o.water;
                   if ('only' in o) { layers.forEach(l => l.st.mesh.visible = o.only === 'his');
                                      ours.forEach(l => l.st.mesh.visible = o.only === l.name); } },
    eyes: () => layers.map((l, i) => ({ n: i + 1, slug: l.slug, ...l.eye })),
    // the current (DESIGN 6.4, BUILD.md D4): does it put you at the standpoint, and how long did it take?
    current: (n = 1, o = {}) => {
      const from = flight.pos.slice(), T = currentTo(n), e = layers[n - 1].eye, t0 = time;
      const done = () => { const st = flight.state();
        return { n, slug: layers[n - 1].slug, T: +T.toFixed(2), took: +(time - t0).toFixed(2),
                 from: from.map(v => +v.toFixed(1)), went_m: +Math.hypot(from[0] - e.x, from[1] - e.y, from[2] - e.z).toFixed(1),
                 off_m: +Math.hypot(flight.pos[0] - e.x, flight.pos[1] - e.y, flight.pos[2] - e.z).toFixed(3),
                 off_yaw_deg: +Math.abs(((st.yaw - e.yaw + 540) % 360) - 180).toFixed(3),
                 off_pitch_deg: +Math.abs(st.pitch - e.pitch).toFixed(3), at: [st.x, st.y, st.z],
                 speed: st.speed, carried: st.carried }; };
      if (o.sim !== false) { dream.sim(T + 0.05); return done(); }
      return new Promise(res => watchers.push(() => flight.carry ? false : (res(done()), true)));
    },
    caption: n => caption(n, true),
    // The body is a function of its own clock, so a renderer too slow to show a current is not too slow to
    // measure one: this runs the flight forward without drawing, at the step a browser holding sixty would take
    sim: (secs, step = 1 / 60) => { for (let t = 0; t < secs; t += step) {
        const d = Math.min(step, secs - t);
        wind.at(flight.pos, flight.current); flight.update(d);
        time += d; U.uTime.value = time;
        if (running) running.sim = true;
        stepFlight(d);
        for (let i = pending.length - 1; i >= 0; i--) if (time >= pending[i].t) pending.splice(i, 1)[0].f();
        for (let i = watchers.length - 1; i >= 0; i--) if (watchers[i](d)) watchers.splice(i, 1);
      } return dream.state(); },
    // One night, or three pictures on a pond (BUILD.md D4.5): from each standpoint, how much sky of ours stands
    // over it and what colour it is. A sky built round one eye is a bubble, and seen from another standpoint it
    // thins on one side and stops on the other; and his three nights are not one night's colour
    night: () => {
      const sk = ours.find(o => o.name === 'sky');
      if (!sk) return [];
      const NB = 12, sr = 2 * Math.PI * (1 - Math.sin(10 * DEG)) / NB;
      return layers.map(L => {
        const e = [L.eye.x, L.eye.y, L.eye.z], cnt = new Array(NB).fill(0), rgb = [0, 0, 0];
        let n = 0;
        for (let i = 0; i < sk.ex.n; i++) {
          const j = i * 3, d = [sk.ex.P[1][j] - e[0], sk.ex.P[1][j + 1] - e[1], sk.ex.P[1][j + 2] - e[2]];
          const dl = Math.hypot(d[0], d[1], d[2]) || 1;
          if (d[1] / dl < Math.sin(10 * DEG)) continue;
          cnt[Math.min(NB - 1, Math.floor(((Math.atan2(d[0], -d[2]) / 6.28319 + 1) % 1) * NB))]++;
          n++;
          for (let k = 0; k < 3; k++) rgb[k] += sk.ex.col[i * 4 + k];
        }
        // and what colour ours is where you can see it from here, against his own sky on this canvas: the
        // strokes within one of his own sky depths of his eye, which are the ones overhead at his standpoint
        const near = [0, 0, 0]; let nn = 0;
        const sig = nightSpec.nights[L.i].depth_m[1];
        for (let i = 0; i < sk.ex.n; i++) {
          const j = i * 3;
          if (Math.hypot(sk.ex.P[1][j] - e[0], sk.ex.P[1][j + 1] - e[1], sk.ex.P[1][j + 2] - e[2]) > sig) continue;
          nn++;
          for (let k = 0; k < 3; k++) near[k] += sk.ex.col[i * 4 + k];
        }
        // and again where his canvas actually speaks. A ball round his eye spans the whole sky, and his own
        // paint covers only a band of it -- the Rhone's sky is 1.0 to 17.6 degrees up and the terrace's 18.8
        // to 35.2 -- so a ball mean is not a thing his canvas has a number for. This takes our strokes inside
        // his own band of elevation, in the half of the sky he faced, and no farther off than his own paint
        // and band by band up his own sky, which is the only comparison his canvas can answer. Our strokes
        // are spread evenly over the solid angle and his are spread the way he composed, so a single mean
        // over his whole band compares two different distributions; inside one four-degree band they are the
        // same question. His measured bands are in hand/nights.json
        const N2 = nightSpec.nights[L.i], R = N2.el_deg, f = nights.fw[L.i], BE = N2.by_el;
        const acc = BE.map(() => ({ n: 0, c: [0, 0, 0] }));
        let bn = 0;
        const bd = [0, 0, 0];
        for (let i = 0; i < sk.ex.n; i++) {
          const j = i * 3, qx = sk.ex.P[1][j] - e[0], qy = sk.ex.P[1][j + 1] - e[1], qz = sk.ex.P[1][j + 2] - e[2];
          const l = Math.hypot(qx, qy, qz) || 1;
          if (l > N2.depth_m[1]) continue;
          if (qx * f[0] + qy * f[1] + qz * f[2] < 0) continue;
          const el = Math.asin(qy / l) / DEG;
          if (el < R[0] || el > R[1]) continue;
          // and not in the ring just outside his cone, where D2's carry is deliberately taking his own edge's
          // colour rather than the night's: that ring is the seam's business (tools/seam.py), not this one
          const K = L.cone, zz = (qx * K.Fw[0] + qy * K.Fw[1] + qz * K.Fw[2]) / l;
          if (zz > 0) {
            const xx = Math.abs(qx * K.R[0] + qy * K.R[1] + qz * K.R[2]) / l / (K.hw * zz);
            const yy = Math.abs(qx * K.U[0] + qy * K.U[1] + qz * K.U[2]) / l / (K.hh * zz);
            if (Math.max(xx, yy) < 1.3) continue;
          }
          bn++;
          for (let k = 0; k < 3; k++) bd[k] += sk.ex.col[i * 4 + k];
          let bi = 0, best = 1e9;
          for (let z = 0; z < BE.length; z++) { const dz = Math.abs(BE[z].el - el); if (dz < best) { best = dz; bi = z; } }
          if (best > 2.01) continue;
          acc[bi].n++;
          for (let k = 0; k < 3; k++) acc[bi].c[k] += sk.ex.col[i * 4 + k];
        }
        const bands = BE.map((B, z) => ({ el: B.el, his_n: B.n, our_n: acc[z].n,
          off_pct: acc[z].n < 30 ? null : acc[z].c.map((v, k) => +(100 * (v / acc[z].n / B.rgb[k] - 1)).toFixed(1)) }));
        const worst = [0, 1, 2].map(k => bands.reduce((a, b) => b.off_pct && Math.abs(b.off_pct[k]) > Math.abs(a) ? b.off_pct[k] : a, 0));
        const bm = bd.map(v => v / Math.max(1, bn));
        const his = nightSpec.nights[L.i].rgb;
        const om = near.map(v => v / Math.max(1, nn));
        return { slug: L.slug, n, per_sr_min: Math.round(Math.min(...cnt) / sr), per_sr_mean: Math.round(n / (NB * sr)),
                 per_sr_max: Math.round(Math.max(...cnt) / sr), his_per_sr: Math.round(skyHand.density.per_sr),
                 bins: cnt, ours_rgb: rgb.map(v => +(v / Math.max(1, n)).toFixed(4)),
                 near_n: nn, near_rgb: om.map(v => +v.toFixed(4)), his_rgb: his,
                 off_pct: om.map((v, k) => +(100 * (v / his[k] - 1)).toFixed(1)),
                 band_deg: R, band_n: bn, band_rgb: bm.map(v => +v.toFixed(4)),
                 band_off_pct: bm.map((v, k) => +(100 * (v / his[k] - 1)).toFixed(1)),
                 by_el: bands, worst_pct: worst };
      });
    },
    sea: () => ({ n: sea.n, cell: sea.cell, cover: sea.cover, his_cover: seaHand.cover, per_m2: sea.per_m2,
                  mark_m: [+sea.len_m.toFixed(3), +sea.wid_m.toFixed(3)], sized_at_m: sea.at }),
    // the floor (DESIGN 5.1, 5.2 as D4.5 amends them): one river between his two banks, one shore at the height
    // of a standing man, and what each of his own grounds is doing on it
    floorOf: () => {
      const at = p => (p[0] > BANK[0] && p[0] < BANK[1] ? 0 : SHORE);
      const E = U.uEdge.value, band = (BANK[1] - BANK[0]);
      // the share of the floor inside the dream that is water: the band's area over the disc's
      const a = Math.min(E, Math.max(-E, BANK[0])), b = Math.min(E, Math.max(-E, BANK[1]));
      const F = x => x * Math.sqrt(Math.max(0, E * E - x * x)) + E * E * Math.asin(Math.max(-1, Math.min(1, x / E)));
      return { shore_m: SHORE, bank_m: BANK, river_m: +band.toFixed(1),
               water_share: +((F(b) - F(a)) / (Math.PI * E * E)).toFixed(4),
               water_rgb: wc.map(v => +v.toFixed(6)), shore_rgb: sc.map(v => +v.toFixed(6)),
               of_his_sky: [+(colHand.water.lum / colHand.water.sky_lum).toFixed(4), nightSpec.shore.over_sky],
               // the light over the floor under each of his three standpoints, and the light where the eye is
               light: LIT && LIT.map(v => +v.toFixed(6)), light_here: +lightAt(camPos).toFixed(6),
               his_sky: [+SEA_SKY.toFixed(5), +SHORE_SKY.toFixed(5)],
               shore_of: nightSpec.shore.of, shore_hand: nightSpec.shore.hand,
               shore_marks: shore.n, sea_marks: sea.n,
               // his own ground under each of his standpoints, against the floor this world puts there. The
               // floor is read fifty metres out along the way his canvas looks, because that is where his own
               // ground plane is: the Rhone's is the river in front of him and the other two are the shore
               his: layers.map(l => {
                 const g = l.laws.regions.village || l.laws.regions.pavement || l.laws.regions.water;
                 const y = g && g.law.type === 'plane' ? (g.law.y ?? 0) : null;
                 const q = [l.eye.x + l.cone.Fw[0] * 50, 0, l.eye.z + l.cone.Fw[2] * 50];
                 return { slug: l.slug, region: g === l.laws.regions.village ? 'village' : g === l.laws.regions.pavement ? 'pavement' : 'water',
                          ground: y, floor: at(q), eye_over_ground: +(l.eye.y - y).toFixed(3),
                          off_m: y === null ? null : +Math.abs(y - at(q)).toFixed(4) };
               }) };
    },
    // the colour of the night at a place, and how much of each of his three it is
    nightAt: (p) => { const q = p || flight.pos, w = [...nights.weights(q)], r = [...nights.ratio(q)];
                      return { at: q.map(v => +v.toFixed(1)), of: Object.fromEntries(nightSpec.nights.map((n, i) => [n.slug, +w[i].toFixed(4)])),
                               ratio: r.map(v => +v.toFixed(4)), sky: nights.sky(q).map(v => +v.toFixed(5)) }; },
    // the light the floor stands under at a place, measured (D4.6, and `measureLight` above for what it does)
    light: (p = null, N = 96, f) => measureLight(p || [flight.pos[0], flight.pos[1], flight.pos[2]], N, f),
    // the three cones on one water (DESIGN 5.1): where each stands, how wide it opens, and how far apart they are
    cones: () => layers.map(l => ({ slug: l.slug, at: l.cone.at, yaw: l.eye.yaw, pitch: l.eye.pitch, hfov: l.eye.hfov,
      half_deg: [+(Math.atan(l.cone.hw) / DEG).toFixed(2), +(Math.atan(l.cone.hh) / DEG).toFixed(2)],
      to: layers.map(m => +Math.hypot(m.eye.x - l.eye.x, m.eye.y - l.eye.y, m.eye.z - l.eye.z).toFixed(1)) })),
    // how much of a canvas, or of ours, is hidden by standing inside someone else's cone
    clipped: () => {
      const inC = (P, mine) => layers.some(l => {
        if (l.i === mine) return false;
        const q = [0, 1, 2].map(k => P[k] - l.cone.at[k]), L = Math.hypot(q[0], q[1], q[2]) || 1;
        const d = q.map(v => v / L), k = l.cone;
        const z = d[0] * k.Fw[0] + d[1] * k.Fw[1] + d[2] * k.Fw[2];
        if (z <= 0) return false;
        return Math.abs(d[0] * k.R[0] + d[1] * k.R[1] + d[2] * k.R[2]) < k.hw * z
            && Math.abs(d[0] * k.U[0] + d[1] * k.U[1] + d[2] * k.U[2]) < k.hh * z;
      });
      const count = (ex, mine) => { let c = 0; for (let i = 0; i < ex.n; i++) if (inC([ex.P[1][i * 3], ex.P[1][i * 3 + 1], ex.P[1][i * 3 + 2]], mine)) c++; return c; };
      const out = {};
      for (const l of layers) out[l.slug] = { n: l.ex.n, hidden: count(l.ex, l.i) };
      for (const o of ours) if (o.name !== 'reflections' && o.name !== 'motes') out[o.name] = { n: o.ex.n, hidden: count(o.ex, -1) };
      return out;
    },
    wind: p => wind.at(p || flight.pos, [0, 0, 0]).map(c => +c.toFixed(3)),
    part: r => { U.uPart.value = r; },
    // one column alone, for tools/reflect.py, and where a point of the world falls on the screen
    onlyLight: (i = -1) => { U.uOnly.value = i; },
    project: q => { const v = new THREE.Vector3(q[0], q[1], q[2]).project(camera);
                    return [ (v.x * 0.5 + 0.5) * innerWidth, (0.5 - v.y * 0.5) * innerHeight, +v.z.toFixed(4) ]; },
    // and back: the way the world lies along a pixel, so that a tool can ask what bearing a mark was drawn at
    unproject: q => { const v = new THREE.Vector3(q[0] / innerWidth * 2 - 1, 1 - q[1] / innerHeight * 2, 0.5).unproject(camera);
                      v.sub(camera.position).normalize();
                      return { dir: [+v.x.toFixed(5), +v.y.toFixed(5), +v.z.toFixed(5)],
                               az: +(Math.atan2(v.x, -v.z) / DEG).toFixed(4), el: +(Math.asin(v.y) / DEG).toFixed(4) }; },
    under: k => { U.uUnder.value = k; },
    sound: v => { if (v !== undefined) { sound.start(); sound.setOn(v); } return sound.state(); },
    curl: k => { U.uCurl.value = k; },
    _: { renderer, scene, camera, post, layers, ours, U, flight, wind, wat, lit, sound },
    // the pre-registered glance (DESIGN 6.2): the gaze turns `deg` over `secs` of the piece's own time; how far
    // did the heading follow? Timed by the clock the flight runs on, not the wall's, so that a slow renderer
    // measures the same thing
    glance: (deg = 30, secs = 0.5) => new Promise(res => {
      const y0 = flight.head.yaw, g0 = flight.gaze.yaw;
      flight.script = { dx: deg * DEG / secs, dy: 0, speed: 3 };
      pending.push({ t: time + secs, f: () => { flight.script = { dx: 0, dy: 0, speed: 3 };
        res({ gaze: +((flight.gaze.yaw - g0) / DEG).toFixed(2), heading: +((flight.head.yaw - y0) / DEG).toFixed(2) }); } });
    }),
    // the eddy test (DESIGN 6.4, BUILD.md D1): let go inside eddy `i`, at the depth of his rim strokes, a third of
    // its radius off the axis, and do nothing. How long until the body has been carried once round -- its
    // velocity, seen along the eddy's axis, has turned through 360 degrees -- and how far along the axis and up
    // did it go? The turn is measured on the velocity and not on the angle about the fitted centre, because the
    // drift moves the orbits' centre aside. Timed by the piece's clock; gives up after `T` seconds
    eddy: (i = 0, o = {}) => new Promise(res => {
      const ax = wind.axis(i), M = windSpec.measured.vortices[i];
      const D = o.depth || M.depth_rim_m || 400, rw = ax.r * D / ax.f, off = (o.frac ?? 1 / 3) * rw;
      const pos = [0, 1, 2].map(k => wind.eye[k] + ax.dir[k] * D + ax.Rp[k] * off);
      flight.go({ pos, yaw: o.yaw ?? 0, pitch: o.pitch ?? 8, speed: 0 });
      flight.script = null; flight.letgo = true;
      const y0 = pos[1], t0 = time; let lastA = null, lastP = [...pos], turned = 0, rmin = 1e9, rmax = 0, al0 = null, al = 0, vmax = 0;
      watchers.push(dt => {
        const rel = [0, 1, 2].map(k => flight.pos[k] - wind.eye[k]);
        al = rel[0] * ax.dir[0] + rel[1] * ax.dir[1] + rel[2] * ax.dir[2];
        if (al0 === null) al0 = al;
        const q = [0, 1, 2].map(k => rel[k] - ax.dir[k] * al);
        const rr = Math.hypot(q[0], q[1], q[2]) / (ax.r * al / ax.f);        // in radii of the cone at this depth
        rmin = Math.min(rmin, rr); rmax = Math.max(rmax, rr);
        const v = [0, 1, 2].map(k => flight.pos[k] - lastP[k]); lastP = [...flight.pos];
        const sp = dt > 0 ? Math.hypot(v[0], v[1], v[2]) / dt : 0; vmax = Math.max(vmax, sp);
        if (sp > 0.2) {
          const a = Math.atan2(v[0] * ax.Up[0] + v[1] * ax.Up[1] + v[2] * ax.Up[2], v[0] * ax.Rp[0] + v[1] * ax.Rp[1] + v[2] * ax.Rp[2]);
          if (lastA !== null) turned += Math.atan2(Math.sin(a - lastA), Math.cos(a - lastA));
          lastA = a;
        }
        const done = Math.abs(turned) >= 2 * Math.PI, out = time - t0 > (o.T || 120);
        if (done || out) res({ eddy: i, period: done ? +(time - t0).toFixed(1) : null, turned: +(turned / DEG).toFixed(0), up: +(flight.pos[1] - y0).toFixed(1),
          along: +(al - al0).toFixed(1), radius: [+rmin.toFixed(2), +rmax.toFixed(2)], speedMax: +vmax.toFixed(2), start: pos.map(v => +v.toFixed(1)), own: +flight.speed.toFixed(2) });
        return done || out;
      });
    }),
  };
  if (has('flight')) runFlight(Q.get('flight'));
  requestAnimationFrame(frame);
}

boot().catch(e => fail('The dream did not load.', e));
