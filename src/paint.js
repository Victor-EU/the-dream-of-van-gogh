// The paint. One shader for every stroke in the world. A stroke is a quadratic arc with a width, a colour, a shine,
// a curl and a spin. Its face turns to the eye about its own tangent, so that it keeps its direction and never
// shows its edge; behind the face there is a narrower dark strip, the body of the paint. The brush print and the
// relief are the sibling's (brush.js).
//
// Two things move a stroke. Spin: an axis and a rate a stroke, and it turns about that axis through the mesh's own
// centre, forever -- a swirl of the sky is a rigid turn of the strokes laid on its circles, so that it slides along
// its own streamlines and never comes apart. Curl: each stroke slides a little along its own arc at one rate. And
// the mesh's own matrix, for things that move whole: a sunflower drifting, a cypress swaying.
import * as THREE from 'three';
import { BRUSH, NOISE } from './brush.js';

const SEG = 5;

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
  attribute vec4 iSize, iCol, iMeta, iSpin;
  uniform vec3 uCam, uHead, uEye, uSpinC;
  uniform float uTime, uCurl, uPart, uPartA, uPartB, uReveal, uFocalPx, uWrap, uWrapY, uWrapLow, uWrapHigh, uUnder, uSway, uLie;
  uniform vec3 uUp;
  varying vec2 vST; varying vec3 vCol, vP, vT, vB, vN; varying float vRow, vEmit, vBig, vUnder;
  vec3 spin(vec3 p, vec3 k, float a) {
    vec3 q = p - uSpinC;
    float c = cos(a), s = sin(a);
    return uSpinC + q * c + cross(k, q) * s + k * dot(k, q) * (1.0 - c);
  }
  void main() {
    // the world paints itself in (the opening): a stroke is not there before its turn, and grows for a moment after
    float grow = smoothstep(iMeta.x, iMeta.x + 0.06, uReveal);
    if (grow <= 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    vec3 iQ0 = iP0, iQ1 = iP1, iQ2 = iP2;
    float wid = iSize.x * grow, imp = iSize.y, crl = iSize.w;
    if (dot(iSpin.xyz, iSpin.xyz) > 0.5) {
      float a = iSpin.w * uTime;
      iQ0 = spin(iQ0, iSpin.xyz, a); iQ1 = spin(iQ1, iSpin.xyz, a); iQ2 = spin(iQ2, iSpin.xyz, a);
    }
    // a sway, for the things that stand: a bend that grows with height over the mesh's own foot
    if (uSway > 0.0) {
      float ph = uTime * 0.5 + iMeta.z * 0.1;
      vec3 off = vec3(sin(ph), 0.0, cos(ph * 0.83 + 1.3)) * uSway;
      iQ0 += off * iQ0.y * iQ0.y; iQ1 += off * iQ1.y * iQ1.y; iQ2 += off * iQ2.y * iQ2.y;
    }
    iQ0 = (modelMatrix * vec4(iQ0, 1.0)).xyz; iQ1 = (modelMatrix * vec4(iQ1, 1.0)).xyz; iQ2 = (modelMatrix * vec4(iQ2, 1.0)).xyz;
    // the lattice the motes live on: one cell, carried to the eye, so that the field has no end
    if (uWrap > 0.0) {
      vec3 o = uWrap * floor((uCam - iQ1) / uWrap + 0.5);
      if (uWrapY < 0.5) o.y = 0.0;
      iQ0 += o; iQ1 += o; iQ2 += o;
      if (iQ1.y < uWrapLow || iQ1.y > uWrapHigh) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    }
    float chord = max(length(iQ2 - iQ0), 1e-3);
    float slide = uCurl * crl * sin(uTime * 0.42 + iMeta.z) / chord;
    float t = clamp(aUV.x + slide, -0.2, 1.2), mt = 1.0 - t;
    vec3 pos = mt * mt * iQ0 + 2.0 * t * mt * iQ1 + t * t * iQ2;
    vec3 tan = normalize(2.0 * mt * (iQ1 - iQ0) + 2.0 * t * (iQ2 - iQ1) + vec3(1e-5, 0.0, 0.0));
    // the body of the paint, behind the face, along the stroke's own ray from the eye it was painted for
    if (aUV.z > 0.5) {
      if (uUnder < 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
      vec3 ray = normalize(iQ1 - uEye);
      vec3 toEye = uCam - iQ1;
      float dist = max(length(toEye), 0.5);
      if (imp * length(cross(ray, toEye / dist)) * uFocalPx / dist < 0.8) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
      pos += ray * imp;
    }
    // parting: the line of flight is a tube of radius uPart, and every point of every stroke inside it is moved
    // out onto it, along the shortest way, by a map that keeps their order
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
    // the face turns to the eye about its own tangent -- or, for paint that lies on a surface (uLie), it lies
    // there: its width runs across the tangent in the surface, and a stroke on the ground stays on the ground
    // instead of standing up as a plate when you are near it
    vec3 S = normalize(mix(cross(tan, E), cross(tan, uUp), uLie) + vec3(0.0, 1e-5, 0.0));
    vec3 N = cross(S, tan);
    float taper = sqrt(max(0.0, 1.0 - pow(abs(2.0 * aUV.x - 1.0), 6.0)));
    vec3 p = pos + S * aUV.y * 0.5 * wid * (aUV.z > 0.5 ? 0.62 : 1.0) * (0.3 + 0.7 * taper);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    vBig = smoothstep(70.0, 420.0, wid * uFocalPx / max(length(uCam - pos), 1.0));
    vUnder = aUV.z;
    vST = vec2(aUV.x, aUV.y); vRow = iSize.z; vCol = iCol.rgb; vEmit = iCol.w; vP = p; vT = tan; vB = S; vN = N;
  }
`;
const FRAG = /* glsl */`
  ${NOISE}
  ${BRUSH}
  uniform vec3 uCam, uKeyDir, uKeyCol, uTint;
  uniform float uDark, uGlow;
  varying vec2 vST; varying vec3 vCol, vP, vT, vB, vN; varying float vRow, vEmit, vBig, vUnder;
  void main() {
    vec4 br = brush(vST, vRow);
    float soft = texture2D(uBrush, brushUV(vST, vRow), 2.5 * vBig).g;
    float a = mix(smoothstep(0.18, 0.46, br.g), smoothstep(0.05, 0.3, soft), 0.6 * vBig);
    if (a < 0.02) discard;
    vec3 nt = brushNormal(vST, vRow, br.r, 2.2);
    vec3 N = normalize(vT * nt.x + vB * nt.y + vN * nt.z);
    vec3 V = normalize(uCam - vP);
    // the paint's colour is the light: a flat face is the record's colour from every side, and the moon lights
    // only the relief -- the ridges of the print toward it, the hollows away
    vec3 alb = vCol * uTint * (0.94 + 0.12 * br.b);
    float relief = dot(N, uKeyDir) - dot(normalize(vN), uKeyDir);
    vec3 H = normalize(uKeyDir + V);
    float sp = pow(max(dot(N, H), 0.0), 30.0);
    vec3 c = alb * (1.0 + (0.5 + 0.5 * vBig) * relief) + uKeyCol * sp * 0.05 * br.r;
    c += alb * vEmit * uGlow * (0.6 + 0.8 * br.r);
    if (vUnder > 0.5) c = alb * 0.3 * (0.7 + 0.5 * br.b);
    c *= exp(-length(vP - uCam) * uDark);
    gl_FragColor = vec4(c, a);
  }
`;

// what every mesh shares, and what one may override
export class Paint {
  constructor(U, ex, ov) {
    const g = ribbon(SEG, U.uUnder && U.uUnder.value > 0.5 ? 2 : 1);
    const add = (name, arr, k) => g.setAttribute(name, new THREE.InstancedBufferAttribute(arr, k));
    add('iP0', ex.P[0], 3); add('iP1', ex.P[1], 3); add('iP2', ex.P[2], 3);
    add('iSize', ex.size, 4); add('iCol', ex.col, 4); add('iMeta', ex.meta, 4);
    add('iSpin', ex.spin || new Float32Array(ex.n * 4), 4);
    g.instanceCount = ex.n;
    this.u = { ...U, uReveal: { value: 2 }, uWrap: { value: 0 }, uWrapY: { value: 1 }, uWrapLow: { value: -1e9 }, uWrapHigh: { value: 1e9 },
               uSpinC: { value: new THREE.Vector3() }, uSway: { value: 0 }, uLie: { value: 0 }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uTint: { value: new THREE.Vector3(1, 1, 1) },
               uEye: { value: new THREE.Vector3(0, 30, 0) }, ...(ov || {}) };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.u,
      side: THREE.DoubleSide, alphaToCoverage: true }));
    this.mesh.frustumCulled = false;
    this.n = ex.n;
  }
}
