// The ground: a painted terrain under three fields of strokes that follow the
// walker -- wheat and grass standing up and bending in the wind, and marks laid
// flat along the furrows, the road and the water. Nothing here is stored: every
// stroke asks the ground table what grows where it stands, so the land changes
// with the road and costs the same everywhere.
import * as THREE from 'three';
import { NOISE, BRUSH, LIGHT } from './brush.js';
import { TERRAIN } from './journey.js';
import { ribbon } from './sky.js';

const TERRAIN_VERT = /* glsl */`
  ${NOISE}
  ${TERRAIN}
  ${LIGHT}
  uniform vec2 uSnap;
  varying vec3 vP, vN, vBase;
  varying float vS;
  // the fields, the water and the square are worked out per vertex (two metres
  // apart, which a field boundary never notices); only the road's edge, which
  // is sharp, is left to the pixel
  void main() {
    vec2 p = position.xz + uSnap;
    vP = vec3(p.x, terrainH(p), p.y);
    vN = terrainN(p);
    float s = stationAt(p.y);
    vS = s;
    vec4 crop = crops(p, s);
    float river = riverMask(p, s), plaza = plazaMask(p, s);
    vec3 c;
    if (river > 0.5) c = WATERA(s) * 0.85;
    else if (crop.x > 0.5) c = mix(C1(s), WHEATB(s), 0.55);
    else if (crop.y > 0.5) c = mix(C1(s), GRASSA(s), 0.6);
    else c = mix(FURROWA(s), FURROWB(s), 0.45);
    c = mix(c, COBBLEA(s), plaza * COBBLE(s) * 0.7);
    c = mix(c, vec3(0.9, 0.92, 0.95), SNOW(s) * step(0.55, fbm(p * 0.09)));
    vBase = c;
    gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0);
  }
`;
const TERRAIN_FRAG = /* glsl */`
  ${NOISE}
  ${TERRAIN}
  ${LIGHT}
  uniform float uIntro;
  varying vec3 vP, vN, vBase;
  varying float vS;
  void main() {
    vec2 p = vP.xz;
    float s = vS;
    float d = roadDist(p), rw = ROADW(s);
    vec3 c = vBase;
    float road = d < rw && WATER(s) * step(0.5, (roadX(p.y) - 13.0) - p.x) < 0.5 ? 1.0 : 0.0;
    if (road > 0.5) c = mix(ROAD(s), ROADEDGE(s), smoothstep(rw * 0.5, rw, d));
    float n = vnoise(p * 1.3) * 0.5 + vnoise(p * 0.37 + 7.0) * 0.5;
    c *= 0.84 + 0.26 * n;
    vec2 rel = p - uCam.xz; float rr = length(rel);
    if (rr > 22.0) {
      float sweep = vnoise(vec2(atan(rel.y, rel.x) * 70.0, log(rr + 1.0) * 10.0)) * 0.6 + vnoise(vec2(atan(rel.y, rel.x) * 150.0, log(rr + 1.0) * 23.0)) * 0.4;
      c *= mix(1.0, 0.72 + 0.56 * sweep, smoothstep(22.0, 70.0, rr));
    }
    // the bare canvas past the last field is bare but for the road, which goes on across it to his portrait
    c = mix(c, LINEN, BARE(s) * (1.0 - road));
    if (uIntro < 1.0) c = mix(c, LINEN * (0.94 + 0.08 * n), smoothstep(pow(uIntro, 1.6) * 460.0 - 18.0, pow(uIntro, 1.6) * 460.0, rr));
    vec3 V = normalize(uCam - vP);
    vec3 col = paintShade(c, normalize(vN), V, vP, 0.0);
    gl_FragColor = vec4(fogged(col, vP), 1.0);
  }
`;

const TILE = /* glsl */`
  attribute vec2 aUV;
  attribute vec2 iOff;
  uniform float uPatch, uSpacing, uInner, uScale, uIntro;
  bool unrevealed(vec2 p, vec2 cam, float h) {
    if (uIntro >= 1.0) return false;
    return length(p - cam) > pow(uIntro, 1.6) * 460.0 * (0.82 + 0.3 * h);
  }
`;

const BLADE_VERT = /* glsl */`
  ${NOISE}
  ${TERRAIN}
  ${LIGHT}
  ${TILE}
  varying vec2 vST; varying vec3 vCol, vCol2, vN, vP; varying float vRow, vT;
  void main() {
    vec2 cam = uCam.xz;
    vec2 cell = iOff + uPatch * floor((cam - iOff) / uPatch + 0.5);
    vec4 h = hash42(cell * 0.713 + vec2(13.1, 7.7));
    vec2 p = cell + (h.xy - 0.5) * uSpacing * 1.3;
    vec2 rel = abs(p - cam); float cheb = max(rel.x, rel.y);
    float fade = 1.0 - smoothstep(uPatch * 0.34, uPatch * 0.48, cheb);
    if (uInner > 0.0) fade *= smoothstep(uInner * 0.8, uInner, cheb);
    float s = stationAt(p.y);
    float d = roadDist(p), rw = ROADW(s);
    vec4 crop = crops(p, s);
    float plaza = plazaMask(p, s), river = riverMask(p, s);
    float k = h.z, kind = -1.0;
    if (d > rw + 0.15 && river < 0.5) {
      float verge = 1.0 - smoothstep(rw + 0.9, rw + 1.7, d);
      float pw = crop.x * (1.0 - verge) * (1.0 - plaza) * 0.94;
      float pf = (crop.y * 0.4 + verge * 0.35 + crop.x * 0.03) * FLOWER(s);
      float pg = min(crop.y * 0.82 + crop.z * 0.1 + crop.x * 0.03 + verge * 0.75 + plaza * 0.3, 1.0 - pw - pf);
      if (k < pw) kind = 0.0; else if (k < pw + pf) kind = 2.0; else if (k < pw + pf + pg) kind = 1.0;
    }
    float cob = plaza * COBBLE(s);
    if (cob > 0.35) kind = -1.0;
    // on the bare canvas nothing grows but a fringe of grass along the road
    float fringe = 1.0 - smoothstep(rw + 0.24, rw + 0.6, d);
    if (fract(h.w * 13.7) < BARE(s) * (1.0 - 0.7 * fringe)) kind = -1.0;
    if (unrevealed(p, cam, h.w)) kind = -1.0;
    if (kind < 0.0 || fade < 0.01) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    float r2 = fract(h.w * 7.31 + h.x * 3.7), r3 = fract(h.y * 5.3 + h.z * 1.9);
    float H, W; vec3 cb, ct;
    if (kind == 0.0) { H = WHEATH(s) * (0.62 + 0.45 * r2); W = 0.11; cb = mix(WHEATB(s), WHEATA(s), r3); ct = mix(cb, TIP(s), 0.55 + 0.45 * r2); }
    else if (kind == 1.0) { H = GRASSH(s) * (0.5 + 0.8 * r2); W = 0.075; cb = mix(GRASSA(s), GRASSB(s), r3); ct = mix(cb, GRASSB(s) * 1.3, 0.5); }
    else { H = 0.38 + 0.3 * r2; W = 0.05; cb = GRASSA(s); ct = mix(FLOWERA(s), FLOWERB(s), step(0.6, r3)); }
    float dots = DOTS(s);
    H *= mix(1.0, 0.55, dots) * fade; W *= mix(1.0, 1.7, dots);
    vec3 base = vec3(p.x, terrainH(p) - 0.03, p.y);
    vec3 toCam = uCam - base; toCam.y = 0.0; toCam = normalize(toCam + vec3(1e-4, 0.0, 0.0));
    float tw = (h.x - 0.5) * 1.6;
    vec3 side = normalize(vec3(toCam.z, 0.0, -toCam.x) * cos(tw) + toCam * sin(tw));
    float wind = WIND(s);
    float g1 = sin(uTime * 1.7 + p.x * 0.31 + p.y * 0.23 + h.y * 1.2);
    float g2 = sin(uTime * 0.63 + p.x * 0.07 - p.y * 0.11);
    vec3 wdir = normalize(vec3(0.85, 0.0, -0.45));
    vec3 lean = vec3(h.x - 0.5, 0.0, h.y - 0.5) * 0.95;
    float t = aUV.x;
    float bend = (0.1 + wind * (0.3 + 0.28 * g1 + 0.3 * g2)) * H;
    vec3 pos = base + vec3(0.0, t * H, 0.0) + (lean * H + wdir * bend) * t * t;
    float wm = kind == 2.0 ? mix(0.55, 3.4, smoothstep(0.74, 0.92, t)) : (1.0 - 0.4 * t);
    pos += side * aUV.y * W * 0.5 * wm;
    vST = vec2(t, aUV.y); vRow = floor(r3 * 7.99); vT = t;
    vCol = kind == 2.0 ? (t > 0.76 ? ct : cb) : mix(cb, ct, smoothstep(0.15, 0.95, t));
    vCol2 = kind == 0.0 ? mix(TIP(s), vec3(0.95, 0.45, 0.08), 0.35 * r2) : mix(vCol, GRASSB(s) * 1.35, 0.5);
    vN = normalize(toCam * 0.5 + vec3(0.0, 0.85, 0.0));
    vP = pos;
    gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
  }
`;
const BLADE_FRAG = /* glsl */`
  ${NOISE}
  ${BRUSH}
  ${LIGHT}
  varying vec2 vST; varying vec3 vCol, vCol2, vN, vP; varying float vRow, vT;
  void main() {
    vec4 br = brush(vST, vRow);
    float a = smoothstep(0.25, 0.55, br.g);
    if (a < 0.02) discard;
    vec3 V = normalize(uCam - vP);
    vec3 alb = mix(vCol, vCol2, br.a * 0.6) * (0.8 + 0.4 * br.b);
    vec3 c = paintShade(alb, normalize(vN), V, vP, 0.3 * br.r);
    float back = pow(max(dot(-V, uSunDir), 0.0), 3.0);
    c += alb * uSunCol * back * 0.5 * vT;
    gl_FragColor = vec4(fogged(c, vP), a);
  }
`;

const FLAT_VERT = /* glsl */`
  ${NOISE}
  ${TERRAIN}
  ${LIGHT}
  ${TILE}
  varying vec2 vST; varying vec3 vCol, vCol2, vP, vT3, vB3; varying float vRow, vEmit;
  void main() {
    vec2 cam = uCam.xz;
    vec2 cell = iOff + uPatch * floor((cam - iOff) / uPatch + 0.5);
    vec4 h = hash42(cell * 0.519 + vec2(3.3, 9.1));
    vec2 p = cell + (h.xy - 0.5) * uSpacing * 1.4;
    vec2 rel = abs(p - cam); float cheb = max(rel.x, rel.y);
    float fade = 1.0 - smoothstep(uPatch * 0.36, uPatch * 0.49, cheb);
    if (uInner > 0.0) fade *= smoothstep(uInner * 0.75, uInner, cheb);
    float s = stationAt(p.y);
    float d = roadDist(p), rw = ROADW(s);
    // on the bare canvas the marks are the canvas's own, few and the colour of the linen, and none lies across the
    // road, whose marks are the road's
    float bare = BARE(s) * step(rw, d), edge = 1.0 - step(rw + 0.42 * uScale, d);
    if (fract(h.w * 17.3) < bare * (0.9 + 0.1 * edge) || fade < 0.01 || unrevealed(p, cam, h.z)) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    vec4 crop = crops(p, s);
    float plaza = plazaMask(p, s), river = riverMask(p, s);
    vec2 dir; vec3 c; float emit = 0.0;
    float len = mix(0.2, 0.42, h.y), wid = mix(0.055, 0.095, h.x);
    if (river > 0.5) {
      dir = normalize(vec2(1.0, (h.z - 0.5) * 0.2));
      c = mix(WATERA(s), WATERB(s), h.y * h.y);
      len *= 1.8;
      for (int i = 0; i < 4; i++) {
        if (uLampCol[i].w <= 0.0) continue;
        vec2 L = uLampPos[i].xz; vec2 toC = cam - L; float lc = length(toC); vec2 u = toC / max(lc, 1e-3);
        vec2 q = p - L; float along = dot(q, u); float lat = abs(q.x * u.y - q.y * u.x);
        if (along <= 0.0) continue;
        float k2 = exp(-lat * lat / (0.1 + along * 0.02)) * smoothstep(0.0, 1.5, along) * (1.0 - smoothstep(lc * 0.4, lc * 0.9, along));
        c = mix(c, uLampCol[i].rgb * 0.8, clamp(k2, 0.0, 1.0));
        emit += k2 * 1.6;
        dir = mix(dir, vec2(u.y, -u.x), clamp(k2, 0.0, 1.0));
      }
      // by day the sun lies on the water as a path of broken light: the view,
      // reflected in the surface, falling near the sun's own direction. GLINT is
      // black wherever a station has no sun on its water, which is everywhere
      // but the red vineyard
      vec3 gl = GLINT(s);
      if (gl.r + gl.g + gl.b > 0.004) {
        vec3 rf = normalize(vec3(p.x, -0.35, p.y) - uCam); rf.y = -rf.y;
        float daz = atan(rf.x, -rf.z) - atan(uSunDir.x, -uSunDir.z);
        daz = atan(sin(daz), cos(daz));
        float del = asin(clamp(rf.y, -1.0, 1.0)) - asin(clamp(uSunDir.y, -1.0, 1.0));
        float g = exp(-daz * daz / 0.005 - del * del / 0.02) * (0.75 + 0.35 * sin(uTime * 1.7 + h.w * 40.0));
        c += gl * g * 1.3;
        emit += g * 1.1;
      }
      dir = length(dir) > 1e-3 ? normalize(dir) : vec2(1.0, 0.0);
    } else if (d < rw) {
      dir = normalize(vec2(roadSlope(p.y), -1.0) + (h.zx - 0.5) * 0.35);
      c = mix(ROAD(s), ROADEDGE(s), smoothstep(rw * 0.45, rw, d) * 0.8);
      c *= 1.0 - 0.3 * (1.0 - smoothstep(0.08, 0.22, abs(d - rw * 0.55)));
    } else {
      float sw = SWIRL(s);
      float curl = (fbm(p * 0.045 + 3.1) - 0.5) * 6.2831 * (0.3 + sw * 1.7);
      float ang = crop.w * 6.2831 + curl + (h.z - 0.5) * 0.7;
      dir = vec2(cos(ang), sin(ang));
      if (crop.x > 0.5) c = mix(C1(s), WHEATB(s), 0.35 + 0.5 * h.y);
      else if (crop.y > 0.5) c = mix(GRASSA(s), mix(C1(s), GRASSB(s), 0.5), h.y);
      else c = mix(FURROWA(s), FURROWB(s), step(0.0, sin(dot(p, vec2(-dir.y, dir.x)) * 2.4)) * 0.8 + h.y * 0.2);
      c = mix(c, C0(s), 0.25 * (1.0 - h.w));
      c = mix(c, C2(s), 0.18 * h.z);
      if (plaza * COBBLE(s) > 0.3) { c = COBBLEA(s) * (0.65 + 0.7 * h.y); len = wid * 1.7; wid *= 1.5; }
    }
    float dots = DOTS(s);
    if (dots > 0.0) { len = mix(len, wid * 1.3, dots); wid *= mix(1.0, 1.35, dots); }
    c *= 0.86 + 0.28 * h.z;
    c = mix(c, vec3(0.9, 0.92, 0.95), SNOW(s) * step(0.55, fbm(p * 0.09)));
    c = mix(c, LINEN, bare);
    len *= uScale * fade; wid *= uScale * mix(0.4, 1.0, fade);
    float x = aUV.x * 2.0 - 1.0;
    float taper = sqrt(max(0.0, 1.0 - pow(abs(x), 6.0)));
    vec2 side = vec2(-dir.y, dir.x);
    vec2 q = p + dir * len * x + side * wid * aUV.y * (0.35 + 0.65 * taper);
    float y = river > 0.5 ? -0.35 : terrainH(q) + 0.02 + h.z * 0.015;
    vP = vec3(q.x, y, q.y);
    vT3 = vec3(dir.x, 0.0, dir.y); vB3 = vec3(side.x, 0.0, side.y);
    vST = aUV; vRow = floor(h.w * 7.99);
    // the second colour in a mark is the station's; the bare canvas's is the linen, so the road's there is its verge's
    vec3 c2 = mix(C2(s), ROADEDGE(s), BARE(s) * step(d, rw));
    vCol = c; vCol2 = mix(c, c2 * 1.2, 0.35); vEmit = emit;
    gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0);
  }
`;
const FLAT_FRAG = /* glsl */`
  ${NOISE}
  ${BRUSH}
  ${LIGHT}
  varying vec2 vST; varying vec3 vCol, vCol2, vP, vT3, vB3; varying float vRow, vEmit;
  void main() {
    vec4 br = brush(vST, vRow);
    float a = smoothstep(0.2, 0.52, br.g);
    if (a < 0.01) discard;
    vec3 nt = brushNormal(vST, vRow, br.r, 2.2);
    vec3 N = normalize(vT3 * nt.x + vB3 * nt.y + vec3(0.0, 1.0, 0.0) * nt.z);
    vec3 V = normalize(uCam - vP);
    vec3 alb = mix(vCol, vCol2, br.a * 0.7) * (0.84 + 0.32 * br.b);
    vec3 c = paintShade(alb, N, V, vP, 0.55 * br.r);
    c += vCol * vEmit;
    gl_FragColor = vec4(fogged(c, vP), a);
  }
`;

function grid(patch, spacing) {
  const n = Math.floor(patch / spacing), off = new Float32Array(n * n * 2);
  let k = 0;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) { off[k++] = (i + 0.5) * spacing; off[k++] = (j + 0.5) * spacing; }
  return { off, count: n * n, patch: n * spacing };
}

export class Ground {
  constructor(U, quality = 'mid') {
    this.U = U;
    this.group = new THREE.Group();
    const tg = new THREE.PlaneGeometry(640, 640, 320, 320);
    tg.rotateX(-Math.PI / 2);
    this.tU = { ...U, uSnap: { value: new THREE.Vector2() } };
    const terrain = new THREE.Mesh(tg, new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG, uniforms: this.tU,
      polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }));
    terrain.frustumCulled = false;
    this.group.add(terrain);
    const q = quality === 'low' ? 1.45 : quality === 'high' ? 0.85 : 1;
    this.field('blade', 40, 0.17 * q, 0, 1, 0);
    this.field('blade', 100, 0.5 * q, 19.5, 1, 0);
    this.field('flat', 300, 1.3 * q, 27, 3.3, 1);
    this.field('flat', 56, 0.27 * q, 0, 1, 2);
  }
  field(kind, patch, spacing, inner, scale, order) {
    const { off, count, patch: P } = grid(patch, spacing);
    const g = ribbon(kind === 'blade' ? (inner > 0 ? 2 : 3) : 2);
    g.setAttribute('iOff', new THREE.InstancedBufferAttribute(off, 2));
    g.instanceCount = count;
    const u = { ...this.U, uPatch: { value: P }, uSpacing: { value: spacing }, uInner: { value: inner }, uScale: { value: scale } };
    const mat = kind === 'blade'
      ? new THREE.ShaderMaterial({ vertexShader: BLADE_VERT, fragmentShader: BLADE_FRAG, uniforms: u, side: THREE.DoubleSide, alphaToCoverage: true })
      : new THREE.ShaderMaterial({ vertexShader: FLAT_VERT, fragmentShader: FLAT_FRAG, uniforms: u, side: THREE.DoubleSide, transparent: true, depthWrite: false });
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    m.renderOrder = order;
    this.group.add(m);
  }
  update(cam) {
    this.tU.uSnap.value.set(Math.round(cam.x / 2) * 2, Math.round(cam.z / 2) * 2);
  }
}
