// The road. Walking it is the only control: every metre is a few days of his
// life, the stations stand along it in the order he painted them, and the land
// between two stations is painted with both, the way a palette carries one
// canvas's colours into the next.
import * as THREE from 'three';
import { STATIONS, GROUND_DEFAULTS } from './config.js';
import { clamp, lerp, smoothstep, lin } from './util.js';

export const SPAN = 90;                 // metres of road from one station to the next
export const Z1 = -30;                  // where station 1 stands
export const ZSTART = 14;               // where the walk begins
export const NST = STATIONS.length;
export const stationZ = i => Z1 - i * SPAN;
export const ZEND = stationZ(NST - 1) - 34;

// the road winds, and from where the walk on its own stops it goes straight on along its own line, to the foot of
// his portrait; the ground draws it as far as uRoadEnd
export const ZSTRAIGHT = ZEND + 4;
const windX = z => 3.0 * Math.sin(z * 0.021) + 1.6 * Math.sin(z * 0.057 + 1.3);
const windSlope = z => 0.063 * Math.cos(z * 0.021) + 0.0912 * Math.cos(z * 0.057 + 1.3);
const XS = windX(ZSTRAIGHT), SS = windSlope(ZSTRAIGHT);
export const roadX = z => (z > ZSTRAIGHT ? windX(z) : XS + SS * (z - ZSTRAIGHT));
export const roadSlope = z => (z > ZSTRAIGHT ? windSlope(z) : SS);
// the red vineyard's canal, on the right of the road from 16 to 27 m out, wherever
// a station's ground asks for one: its bed, and where its water lies
export const CANAL = [16, 27];
const canalBed = u => smoothstep(CANAL[0] - 1.2, CANAL[0], u) * (1 - smoothstep(CANAL[1], CANAL[1] + 1.2, u));
export function stationAt(z) {
  const s = (Z1 - z) / SPAN, f = s - Math.floor(s);
  return clamp(Math.floor(s) + smoothstep(0.3, 0.7, f), 0, NST - 1);
}
export const nearestStation = z => clamp(Math.round((Z1 - z) / SPAN), 0, NST - 1);
export const tauAt = z => clamp((ZSTART - z) / (ZSTART - ZEND), 0, 1);
export const zAtTau = t => ZSTART - t * (ZSTART - ZEND);

// ------------------------------------------------------- the ground table --
const ROWS = [
  ['c0', 'wheat'], ['c1', 'grass'], ['c2', 'furrow'], ['wheatA', 'wheatH'], ['wheatB', 'wind'],
  ['tip', 'flower'], ['grassA', 'grassH'], ['grassB', 'dots'], ['furrowA', 'snow'], ['furrowB', 'bare'],
  ['flowerA', 'hill'], ['flowerB', 'valley'], ['road', 'roadW'], ['roadEdge', 'swirl'],
  ['waterA', 'water'], ['waterB', 'cobble'], ['cobbleA', 'plaza'], ['glint', 'canal'],
];
const G = STATIONS.map(st => ({ ...GROUND_DEFAULTS, ...st.ground }));

export function makeBiomeTexture() {
  const data = new Float32Array(NST * ROWS.length * 4);
  for (let i = 0; i < NST; i++)
    ROWS.forEach(([ck, nk], r) => {
      const c = lin(G[i][ck]), o = (r * NST + i) * 4;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = G[i][nk] ?? 0;
    });
  const t = new THREE.DataTexture(data, NST, ROWS.length, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

export function gnum(key, s) {
  const a = Math.floor(s), b = Math.min(a + 1, NST - 1), f = s - a;
  return lerp(G[a][key] ?? 0, G[b][key] ?? 0, f);
}

// the body's height; the same function the ground is drawn with, line for line
export function terrainH(x, z) {
  const s = stationAt(z);
  const hill = gnum('hill', s), valley = gnum('valley', s), water = gnum('water', s), canal = gnum('canal', s);
  const d = Math.abs(x - roadX(z));
  let h = valley * smoothstep(14, 120, d) * 9;
  h += hill * (1.4 * Math.sin(x * 0.043 + 1.7 * Math.sin(z * 0.021)) + 1.1 * Math.sin(z * 0.061 + x * 0.017)) * smoothstep(3, 16, d);
  h -= 0.05 * (1 - smoothstep(0, 2.2, d));
  h = lerp(h, -0.8, water * smoothstep(0.5, 1.5, (roadX(z) - 13) - x));
  h = lerp(h, -0.8, canal * canalBed(x - roadX(z)));
  return h;
}

const macros = ROWS.map(([ck, nk], r) =>
  `#define ${ck.toUpperCase()}(s) B(${r}, s).rgb\n#define ${nk.toUpperCase()}(s) B(${r}, s).a`).join('\n');

export const TERRAIN = /* glsl */`
  uniform sampler2D uBiome;
  uniform float uRoadEnd;
  #define Z1 ${Z1.toFixed(1)}
  #define SPAN ${SPAN.toFixed(1)}
  #define NSTI ${NST}
  vec4 B(int row, float s) {
    int a = int(floor(s)); int b = min(a + 1, NSTI - 1);
    return mix(texelFetch(uBiome, ivec2(a, row), 0), texelFetch(uBiome, ivec2(b, row), 0), s - float(a));
  }
  ${macros}
  #define ZSTRAIGHT ${ZSTRAIGHT.toFixed(1)}
  float roadX(float z) { return z > ZSTRAIGHT ? 3.0 * sin(z * 0.021) + 1.6 * sin(z * 0.057 + 1.3) : (${XS.toFixed(6)}) + (${SS.toFixed(7)}) * (z - ZSTRAIGHT); }
  float roadSlope(float z) { return z > ZSTRAIGHT ? 0.063 * cos(z * 0.021) + 0.0912 * cos(z * 0.057 + 1.3) : (${SS.toFixed(7)}); }
  float canalBed(float u) { return smoothstep(${(CANAL[0] - 1.2).toFixed(1)}, ${CANAL[0].toFixed(1)}, u) * (1.0 - smoothstep(${CANAL[1].toFixed(1)}, ${(CANAL[1] + 1.2).toFixed(1)}, u)); }
  float stationAt(float z) {
    float s = (Z1 - z) / SPAN;
    return clamp(floor(s) + smoothstep(0.3, 0.7, fract(s)), 0.0, float(NSTI - 1));
  }
  float terrainH(vec2 p) {
    float s = stationAt(p.y);
    float d = abs(p.x - roadX(p.y));
    float h = VALLEY(s) * smoothstep(14.0, 120.0, d) * 9.0;
    h += HILL(s) * (1.4 * sin(p.x * 0.043 + 1.7 * sin(p.y * 0.021)) + 1.1 * sin(p.y * 0.061 + p.x * 0.017)) * smoothstep(3.0, 16.0, d);
    h -= 0.05 * (1.0 - smoothstep(0.0, 2.2, d));
    h = mix(h, -0.8, WATER(s) * smoothstep(0.5, 1.5, (roadX(p.y) - 13.0) - p.x));
    h = mix(h, -0.8, CANAL(s) * canalBed(p.x - roadX(p.y)));
    return h;
  }
  vec3 terrainN(vec2 p) {
    float e = 0.4;
    float hx = terrainH(p + vec2(e, 0.0)) - terrainH(p - vec2(e, 0.0));
    float hz = terrainH(p + vec2(0.0, e)) - terrainH(p - vec2(0.0, e));
    return normalize(vec3(-hx, 2.0 * e, -hz));
  }
  // across the road; past its end, from the end, so that it stops in a round end
  float roadDist(vec2 p) { return p.y < uRoadEnd ? length(vec2(p.x - roadX(uRoadEnd), p.y - uRoadEnd)) : abs(p.x - roadX(p.y)); }
  float plazaMask(vec2 p, float s) {
    float si = clamp(floor((Z1 - p.y) / SPAN + 0.5), 0.0, float(NSTI - 1));
    float zc = Z1 - si * SPAN;
    float R = PLAZA(s);
    return 1.0 - smoothstep(R - 3.0, R, length(vec2(p.x - roadX(zc), (p.y - zc) * 0.75)));
  }
  float riverMask(vec2 p, float s) {
    float u = p.x - roadX(p.y);
    return max(WATER(s) * step(0.5, (roadX(p.y) - 13.0) - p.x),
               CANAL(s) * step(${(CANAL[0] - 0.6).toFixed(1)}, u) * step(u, ${(CANAL[1] + 0.6).toFixed(1)}));
  }
  // a patchwork of fields, each one crop; x wheat, y grass, z ploughed, w the field's own number
  vec4 crops(vec2 p, float s) {
    vec2 q = p + (vec2(fbm(p * 0.017), fbm(p * 0.017 + 31.7)) - 0.5) * 30.0;
    vec2 cell = floor(q / vec2(32.0, 24.0));
    float h = hash21(cell + 0.37);
    float W = WHEAT(s), G = GRASS(s), F = FURROW(s);
    float t = h * (W + G + F + 1e-4);
    vec3 o = t < W ? vec3(1.0, 0.0, 0.0) : (t < W + G ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
    return vec4(o, hash21(cell + 11.3));
  }
  const vec3 LINEN = vec3(0.807, 0.761, 0.644);
`;

// ------------------------------------------------------------- stations --
export async function loadStations() {
  return Promise.all(STATIONS.map(async (cfg, i) => {
    const r = await fetch(cfg.file);
    if (!r.ok) throw new Error(`${cfg.file}: HTTP ${r.status}`);
    const json = await r.json();
    return { ...cfg, json, index: i, z: stationZ(i) };
  }));
}

// a date for every metre of the road: station midpoints, linearly between
export function makeCalendar(stations) {
  const mids = stations.map(s => {
    const sp = s.json.span || [];
    const a = Date.parse(sp[0] || '1890-07-29'), b = Date.parse(sp[1] || sp[0] || '1890-07-29');
    return (a + b) / 2;
  });
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return z => {
    const s = clamp((Z1 - z) / SPAN, 0, NST - 1), i = Math.floor(s), j = Math.min(i + 1, NST - 1);
    const t = lerp(mids[i], mids[j], s - i);
    const d = new Date(t);
    return { ms: t, text: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, year: d.getUTCFullYear() };
  };
}
