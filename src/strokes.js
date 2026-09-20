// One shader for every stroke in the piece (DESIGN 4.5), his and ours. A stroke is a quadratic arc in the world
// with a width, a colour, a shine, a curl and an order. Its face turns to the eye about its own tangent, so that it
// keeps his direction and never shows its edge; at the standpoint that is exactly the canvas. The brush print and
// the relief are the sibling's (brush.js). Curl (uCurl) slides each stroke along its own arc by the amplitude the
// pipeline measured, at one rate; parting (uPart) bends the paint round the eye.
//
// D3 adds a fourth: the column mode (uColumn), in which the three control points are not a place in the world
// but a place on a reflection -- how far down its column a mark lies, how far across, and how it is turned --
// with its light in the second slot. A reflection is not a decal: it lies between the eye and its light and
// moves with the eye, so only the shader can know where it is. The arithmetic is DESIGN 5.2 read as what a
// reflection is: a column runs along the water between the eye and the light, from the far point where the
// water would have to tilt by the slope his columns measure to send the light back, to the near one where it
// would have to tilt as far the other way. Everything else about the mark -- its size, its slant, its paint --
// is a ratio of its own column's width, which is how tools/columns.py measured his.
//
// D4 makes the rule of DESIGN 5.1 general. There are three cones now, and inside a cone there is his painting
// and nothing else: not our sky, not a reflection, not a mote, and not another canvas of his. A stroke is hidden
// when its middle lies inside a cone that is not its own, which is what keeps each standpoint test standing with
// the other two canvases in the air, and what says in one line where the dream's islands end.
//
// D2 adds three things. The underside: every ribbon carries a second, narrower one behind it, along the stroke's
// own ray from the standpoint, which is the way the paint stands off the canvas, by the impasto height the record
// measured. From his eye it hides exactly behind the face, so the standpoint is unchanged; from anywhere else the
// stroke has a body and a dark side. The lattice (uWrap): the motes live in one cell that wraps round the eye, so
// that a few thousand marks are a field without end. And the linen (DESIGN 5.4): above the ceiling and past the
// edge of the dream the paint goes to the colour of primed linen, wherever the paint happens to be.
import * as THREE from 'three';
import { BRUSH, NOISE } from './brush.js';

const SEG = 5;

// two strips: the face, and the underside behind it
export function ribbon(seg, strips = 2) {
  const uv = [], idx = [];
  for (let s = 0; s < strips; s++) {
    const o = s * (seg + 1) * 2;
    for (let i = 0; i <= seg; i++) uv.push(i / seg, -1, s, i / seg, 1, s);
    for (let i = 0; i < seg; i++) { const a = o + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 3));
  g.setIndex(idx);
  return g;
}

const VERT = /* glsl */`
  attribute vec3 aUV;
  attribute vec3 iP0, iP1, iP2;
  attribute vec4 iSize, iCol, iMeta;
  attribute float iLight;                       // which light a reflection belongs to; nought where there is none
  uniform vec3 uCam, uHead, uEye, uWave;
  uniform float uTime, uCurl, uPart, uPartA, uPartB, uReveal, uFocalPx, uWrap, uCeil, uEdge, uUnder;
  uniform float uColumn, uColWidth, uOnly, uMine, uWrapLow, uSide, uWrapY;
  uniform float uConeFree;                      // one for what may stand inside his cone: the sunflowers (D5.5)
  // the opening (DESIGN 7.1): nought puts a canvas back on its own picture plane, one is the world. uFocalM is
  // this canvas's focal length in metres and uFw the way its eye looks; both are nought for anything of ours
  uniform float uBurst, uFocalM; uniform vec3 uFw;
  uniform vec2 uBand;                           // the river's two banks, in x (DESIGN 5.1 as D4.5 amends it)
  uniform vec3 uTint;                           // the colour of the night where the eye is, for a lattice that wraps
  uniform mat3 uCone[3]; uniform vec3 uConeAt[3]; uniform vec3 uConeHW[3];   // right, up, forward; the eye; half-widths and whether it is there
  uniform float uConeFar[3];                  // and how far his own paint reaches down it, at its farthest
  uniform sampler2D uConeDepth;               // his three depth maps side by side, one tile each
  uniform float uConeCells, uConeRule;        // cells across a tile; and 0 for the whole cone, 1 for his paint's own depth
  varying vec2 vST; varying vec3 vCol, vP, vT, vB, vN; varying float vRow, vEmit, vMine, vBig, vUnder, vPale;
  // Inside a cone there is his painting and nothing else (DESIGN 5.1): is this point in a cone not its own?
  bool inSomeoneElses(vec3 P) {
    for (int i = 0; i < 3; i++) {
      if (uConeHW[i].z < 0.5 || abs(float(i) - uMine) < 0.5) continue;
      vec3 v = P - uConeAt[i];
      // and not past the end of his paint. The rule is there so that at his eye the frame is his painting and
      // nothing else, and a stroke standing *behind* the farthest thing he painted cannot get in front of it.
      // Hiding those as well empties his whole cone out to the edge of the dream, and from outside that is a
      // black rectangle cut in the sky with a small painting floating in it, which is D4.5's own gate failing
      // for the opposite reason to D4's. What it costs at the standpoint is measured (BUILD.md D4.5)
      if (uConeRule > 0.5 && dot(v, v) > uConeFar[i] * uConeFar[i]) continue;
      vec3 q = normalize(v);
      float qz = dot(q, uCone[i][2]);
      if (qz <= 0.0) continue;
      float cx = dot(q, uCone[i][0]) / (uConeHW[i].x * qz);
      float cy = dot(q, uCone[i][1]) / (uConeHW[i].y * qz);
      if (abs(cx) >= 1.0 || abs(cy) >= 1.0) continue;
      if (uConeRule < 0.5) return true;                 // the whole cone is his, to the edge of the dream
      // his own paint's depth along this very ray, off his canvas: a stroke behind it cannot stand in front
      // of it, and leaving those in is what keeps a cone from being a hole cut in the night
      vec2 uv = vec2((float(i) + clamp(0.5 + 0.5 * cx, 0.0, 1.0)) / 3.0, clamp(0.5 - 0.5 * cy, 0.0, 1.0));
      float hisD = texture(uConeDepth, uv).r;
      if (hisD > 0.0 && length(v) > hisD) continue;
      return true;
    }
    return false;
  }
  void main() {
    if (iMeta.x > uReveal) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    if (uOnly >= 0.0 && abs(iLight - uOnly) > 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    vec3 iQ0 = iP0, iQ1 = iP1, iQ2 = iP2;
    float wid = iSize.x, imp = iSize.y, crl = iSize.w;
    // The explosion of DESIGN 3.1, run backwards and then forwards once (DESIGN 7.1). Every stroke already lies
    // on its ray from his eye at the depth the sidecar gives it; slide it back up that ray to where the ray
    // crosses his picture plane and the canvas is whole again, at the size it is on the canvas -- because a
    // stroke that is l long on a canvas is l * d / f long at depth d, so one scale does the place and the size.
    // The plane and not a sphere: at the corner of a 62 degree frame the two are 26% apart in size
    if (uBurst < 0.999 && uFocalM > 0.0) {
      float d = max(iMeta.w, 1e-3);
      vec3 r1 = iQ1 - uEye;
      float k1 = mix(uFocalM / max(dot(normalize(r1), uFw), 0.05), d, uBurst) / d;
      vec3 r0 = iQ0 - uEye, r2 = iQ2 - uEye;
      iQ0 = uEye + r0 * (mix(uFocalM / max(dot(normalize(r0), uFw), 0.05), d, uBurst) / d);
      iQ1 = uEye + r1 * k1;
      iQ2 = uEye + r2 * (mix(uFocalM / max(dot(normalize(r2), uFw), 0.05), d, uBurst) / d);
      wid *= k1; imp *= k1; crl *= k1;
    }
    // a reflection: laid on the water under its light, where this eye puts it (DESIGN 5.2)
    if (uColumn > 0.0) {
      vec3 L = iP1;
      float A = uCam.y, B = L.y;
      vec2 n2 = L.xz - uCam.xz;
      float D = length(n2);
      if (A < 0.2 || B < 0.2 || D < 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
      n2 /= D;
      // the two ends: k x^2 - x (A + B + kD) + (AD - kAB) = 0 for the near one, and the same with the tilt the
      // other way for the far one. k is the tangent of twice the water's slope; at k -> 0 both go to the flat
      // mirror's point, AD / (A + B), which is where a still water would put the light exactly
      float k = uColumn;
      float b1 = A + B + k * D, c1 = A * D - k * A * B, d1 = b1 * b1 - 4.0 * k * c1;
      float xn = d1 > 0.0 ? (b1 - sqrt(d1)) / (2.0 * k) : A * D / (A + B);
      float b2 = A + B - k * D, c2 = A * D + k * A * B;
      float xf = min((-b2 + sqrt(max(b2 * b2 + 4.0 * k * c2, 0.0))) / (2.0 * k), D * 0.999);
      xn = clamp(xn, 0.2, xf);
      // the slow wave of 5.5: the whole column breathes along itself, and each mark slides a little across
      float ph = uTime * uWave.y + iP2.z;
      float t = clamp(iP0.x + uWave.x * sin(ph), 0.0, 1.0);
      // how far down the column a mark lies was measured on his canvas, which is an angle and not a distance:
      // laid evenly in the distance along the water, the near end of a long column comes apart into gaps
      float x = A / tan(mix(atan(A / xf), atan(A / xn), t));
      vec3 P = vec3(uCam.x + n2.x * x, 0.0, uCam.z + n2.y * x);
      vec3 rr = P - uCam;
      float rl = max(length(rr), 0.3);
      vec3 rh = rr / rl;
      vec3 perp = vec3(-n2.y, 0.0, n2.x), along = vec3(n2.x, 0.0, n2.y);
      // his column keeps its proportions as they are seen: as wide, against how long it looks from here, as his
      float angW = uColWidth * (atan(A / xn) - atan(A / xf));
      // a mark's slant is a slant on the canvas, and the water runs away from the eye, so what lies along the
      // column is stretched by how flat it is seen -- exactly by how much, so the angle comes back as his
      float stretch = clamp(sqrt(x * x + A * A) / A, 1.0, 40.0);
      vec3 dw = normalize(perp * cos(iP0.z) + along * (sin(iP0.z) * stretch));
      float fore = max(length(dw - rh * dot(dw, rh)), 0.06);
      float foreP = max(length(perp - rh * dot(perp, rh)), 0.06);
      float Lw = iP2.x * angW * rl / fore;
      wid = iP2.y * angW * rl;
      imp = iSize.y * angW * rl;                  // the paint stands off the water in his own proportion to it
      crl = iSize.w * angW * rl;
      P += perp * ((iP0.y + uWave.z * uWave.x * sin(1.7 * ph)) * 0.5 * angW * rl / foreP);
      vec3 nb = normalize(cross(dw, rh));
      iQ0 = P - dw * (0.5 * Lw); iQ2 = P + dw * (0.5 * Lw); iQ1 = P + nb * (iMeta.w * Lw);
    }
    // the lattice the motes live on: one cell, carried to the eye, so that the field has no end and no edge
    if (uWrap > 0.0) {
      vec3 o = uWrap * floor((uCam - iP1) / uWrap + 0.5);
      // a lattice on a surface wraps along it and not through it: the motes live in the air and wrap in three
      // directions, but the sea and the shore lie on the floor, and carrying them in y lifts the water to the
      // height of the eye. Found in D4.5; before it, every mark of the sea stood at the nearest multiple of
      // its own cell to the camera, which from a hundred metres up is a sea in the air
      if (uWrapY < 0.5) o.y = 0.0;
      iQ0 += o; iQ1 += o; iQ2 += o;
      if (iQ1.y < uWrapLow || iQ1.y > uCeil) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    }
    // a mark of the river must not lie on the shore, nor the shore's in the water: one floor, two surfaces, and
    // a mark belongs to the one it was measured from. A reflection is the river's too (DESIGN 5.2, D4.5)
    if (uSide != 0.0 && ((iQ1.x > uBand.x && iQ1.x < uBand.y) != (uSide > 0.0))) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    // Between the cones there is the sea, our sky over it, and the reflections (DESIGN 5.1). Inside one there is
    // only what was painted there, which is what keeps every standpoint test standing with all three in the air
    if (uConeFree < 0.5 && inSomeoneElses(iQ1)) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    float chord = max(length(iQ2 - iQ0), 1e-3);
    float slide = uCurl * crl * sin(uTime * 0.42 + iMeta.z) / chord;
    float t = clamp(aUV.x + slide, -0.2, 1.2), mt = 1.0 - t;
    vec3 pos = mt * mt * iQ0 + 2.0 * t * mt * iQ1 + t * t * iQ2;
    vec3 tan = normalize(2.0 * mt * (iQ1 - iQ0) + 2.0 * t * (iQ2 - iQ1) + vec3(1e-5, 0.0, 0.0));
    // the underside: the paint stands off the canvas along the stroke's own ray from the standpoint, so from his
    // eye it is exactly behind the face and from anywhere else it is the stroke's body. Seen from near his eye
    // the body hides behind the face exactly, and a strip that would move less than a pixel is not drawn at all
    if (aUV.z > 0.5) {
      if (uUnder < 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
      vec3 ray = uColumn > 0.0 ? vec3(0.0, 1.0, 0.0) : normalize(iQ1 - uEye);   // paint stands off what it lies on
      vec3 toEye = uCam - iQ1;
      float dist = max(length(toEye), 0.5);
      if (imp * length(cross(ray, toEye / dist)) * uFocalPx / dist < 0.8) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
      pos += ray * imp;
    }
    // parting (DESIGN 3.3, 6.5): the line of flight is a tube of radius uPart, and every point of every stroke
    // inside it is moved out onto it, along the shortest way, by a map that keeps their order (sd -> sqrt(sd^2 +
    // R^2)); a stroke clears the tube by its own half width too. The third of a second out and the two seconds
    // back are distances along the line at the body's speed: uPartA ahead, uPartB behind, set by main.js
    if (uPart > 0.0) {
      vec3 rel = pos - uCam;
      float along = dot(rel, uHead);
      vec3 side = rel - uHead * along;
      float sd = length(side);
      float ka = smoothstep(-uPartB, -0.15 * uPartB, along) * (1.0 - smoothstep(uPartA, 2.0 * uPartA, along));
      float Rt = ka * (uPart + 0.5 * wid);
      if (Rt > 0.0) {
        vec3 dir = sd > 1e-3 ? side / sd : normalize(cross(uHead, abs(uHead.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        pos += dir * (sqrt(sd * sd + Rt * Rt) - sd);
      }
    }
    vec3 E = normalize(uCam - pos);
    vec3 S = normalize(cross(tan, E) + vec3(0.0, 1e-5, 0.0));
    vec3 N = cross(S, tan);
    float taper = sqrt(max(0.0, 1.0 - pow(abs(2.0 * aUV.x - 1.0), 6.0)));
    vec3 p = pos + S * aUV.y * 0.5 * wid * (aUV.z > 0.5 ? 0.62 : 1.0) * (0.3 + 0.7 * taper);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    // how wide the stroke is on the screen: past a hand's breadth of pixels its bristles are read as a mass
    vBig = smoothstep(30.0, 140.0, wid * uFocalPx / max(length(uCam - pos), 1.0));
    vPale = max(smoothstep(uCeil - 140.0, uCeil, p.y), smoothstep(uEdge - 400.0, uEdge, length(p.xz)));
    vUnder = aUV.z;
    vST = vec2(aUV.x, aUV.y); vRow = iSize.z; vCol = iCol.rgb * uTint; vEmit = iCol.w; vP = p; vT = tan; vB = S; vN = N; vMine = iMeta.y;
  }
`;
const FRAG = /* glsl */`
  ${NOISE}
  ${BRUSH}
  uniform vec3 uCam, uKeyDir, uKeyCol, uLinen;
  uniform float uDark, uLedger;
  varying vec2 vST; varying vec3 vCol, vP, vT, vB, vN; varying float vRow, vEmit, vMine, vBig, vUnder, vPale;
  void main() {
    vec4 br = brush(vST, vRow);
    // seen large, the print is sampled soft, so that the dry end is a body of paint and not teeth
    float soft = texture2D(uBrush, brushUV(vST, vRow), 2.5 * vBig).g;
    float a = mix(smoothstep(0.18, 0.46, br.g), smoothstep(0.05, 0.3, soft), vBig);
    if (a < 0.02) discard;
    vec3 nt = brushNormal(vST, vRow, br.r, 2.2);
    vec3 N = normalize(vT * nt.x + vB * nt.y + vN * nt.z);
    vec3 V = normalize(uCam - vP);
    // the painting's colour is the light: a flat face is exactly the record's colour from every side, and the
    // moon lights only the relief -- the ridges of the print toward it, the hollows away
    vec3 alb = vCol * (0.94 + 0.12 * br.b);
    float relief = dot(N, uKeyDir) - dot(normalize(vN), uKeyDir);
    vec3 H = normalize(uKeyDir + V);
    float sp = pow(max(dot(N, H), 0.0), 30.0);
    vec3 c = alb * (1.0 + 0.5 * relief) + uKeyCol * sp * 0.05 * br.r;
    c += vCol * vEmit * (0.6 + 0.8 * br.r);
    if (vUnder > 0.5) c = vCol * 0.3 * (0.7 + 0.5 * br.b);          // the side of the ridge, in its own shadow
    c *= exp(-length(vP - uCam) * uDark);
    c = mix(c, uLinen, vPale);                                       // at the edge of the dream, bare linen
    if (uLedger > 0.5 && vMine > 0.5) c = mix(c, vec3(1.0, 0.15, 0.6), 0.5);
    gl_FragColor = vec4(c, a);
  }
`;

export class Strokes {
  constructor(U, ex, ov) {
    const g = ribbon(SEG, U.uUnder && U.uUnder.value > 0.5 ? 2 : 1);
    const add = (name, arr, k) => g.setAttribute(name, new THREE.InstancedBufferAttribute(arr, k));
    add('iP0', ex.P[0], 3); add('iP1', ex.P[1], 3); add('iP2', ex.P[2], 3);
    add('iSize', ex.size, 4); add('iCol', ex.col, 4); add('iMeta', ex.meta, 4);
    if (ex.light) add('iLight', ex.light, 1);
    g.instanceCount = ex.n;
    this.u = { ...U, uReveal: { value: 2 }, uMine: { value: -1 }, uWrapLow: { value: 2 },
               uSide: { value: 0 }, uWrapY: { value: 1 }, uTint: { value: new THREE.Vector3(1, 1, 1) },
               uFocalM: { value: 0 }, uFw: { value: new THREE.Vector3(0, 0, -1) }, uConeFree: { value: 0 }, ...(ov || {}) };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.u,
      side: THREE.DoubleSide, alphaToCoverage: true }));
    this.mesh.frustumCulled = false;
    this.n = ex.n;
  }
}
