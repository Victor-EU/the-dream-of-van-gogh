// His paintings, on their easels. Each is his own strokes -- read from the
// stroke records the pipeline extracted from the museum scans -- laid on a
// primed canvas in the order he laid them, as you walk up to it.
import * as THREE from 'three';
import { NOISE, BRUSH, LIGHT } from './brush.js';
import { ribbon } from './sky.js';
import { lerp } from './util.js';

function readBlob(buf) {
  const v = new DataView(buf);
  const magic = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3));
  if (magic !== 'VGST') throw new Error(`bad stroke record "${magic}"`);
  const hdr = v.getUint16(6, true), stride = v.getUint16(8, true), count = v.getUint32(12, true);
  if (stride !== 24) throw new Error(`stroke stride ${stride}`);
  return { hdr, count, buf, coordLo: v.getFloat32(52, true), coordHi: v.getFloat32(56, true), widthK: v.getFloat32(60, true) };
}

const STROKE_VERT = /* glsl */`
  ${NOISE}
  ${LIGHT}
  attribute vec2 aUV;
  attribute vec2 aP0, aP1, aP2;
  attribute vec3 aColor;
  attribute float aWidth, aOrder;
  uniform float uCoordLo, uCoordSpan, uWidthK, uShort, uProgress, uArrive;
  uniform vec2 uSize;
  varying vec2 vST; varying vec3 vCol, vP, vT, vB, vN; varying float vRow, vArr;
  void main() {
    float arrive = clamp((uProgress - aOrder) / uArrive, 0.0, 1.0);
    if (arrive <= 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    vec2 S = vec2(uSize.x, -uSize.y);
    vec2 c0 = (aP0 * uCoordSpan + uCoordLo - 0.5) * S, c1 = (aP1 * uCoordSpan + uCoordLo - 0.5) * S, c2 = (aP2 * uCoordSpan + uCoordLo - 0.5) * S;
    float t = aUV.x * arrive, mt = 1.0 - t;
    vec2 pos = mt * mt * c0 + 2.0 * t * mt * c1 + t * t * c2;
    vec2 tan = normalize(2.0 * mt * (c1 - c0) + 2.0 * t * (c2 - c1) + vec2(1e-6, 0.0));
    vec2 nr = vec2(-tan.y, tan.x);
    float w = aWidth * uWidthK * uShort;
    float taper = sqrt(max(0.0, 1.0 - pow(abs(2.0 * aUV.x - 1.0), 6.0)));
    vec2 q = pos + nr * aUV.y * 0.62 * w * (0.3 + 0.7 * taper);
    vec4 wp = modelMatrix * vec4(q, 0.002 + aOrder * 0.006, 1.0);
    mat3 m3 = mat3(modelMatrix);
    vP = wp.xyz; vT = normalize(m3 * vec3(tan, 0.0)); vB = normalize(m3 * vec3(nr, 0.0)); vN = normalize(m3 * vec3(0.0, 0.0, 1.0));
    vST = aUV; vRow = floor(fract(aOrder * 97.31 + aWidth * 13.7) * 7.99);
    vCol = pow(aColor, vec3(2.2)); vArr = arrive;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const STROKE_FRAG = /* glsl */`
  ${NOISE}
  ${BRUSH}
  ${LIGHT}
  uniform vec3 uKey, uKeyDir;
  uniform float uGain;
  varying vec2 vST; varying vec3 vCol, vP, vT, vB, vN; varying float vRow, vArr;
  void main() {
    vec4 br = brush(vST, vRow);
    float a = smoothstep(0.18, 0.46, br.g);
    if (a < 0.02) discard;
    vec3 nt = brushNormal(vST, vRow, br.r, 2.6);
    vec3 N = normalize(vT * nt.x + vB * nt.y + vN * nt.z);
    vec3 V = normalize(uCam - vP);
    vec3 alb = vCol * (0.92 + 0.16 * br.b) * uGain;
    vec3 c = paintShade(alb, N, V, vP, 0.7 * br.r);
    c += alb * uKey * max(dot(N, uKeyDir), 0.0);
    c += uKey * pow(max(dot(N, normalize(uKeyDir + V)), 0.0), 40.0) * 0.3 * br.r;
    c *= mix(0.6, 1.0, vArr);
    gl_FragColor = vec4(fogged(c, vP), a);
  }
`;
const BASE_VERT = /* glsl */`
  ${NOISE}
  ${LIGHT}
  varying vec2 vUv; varying vec3 vP, vN;
  void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }
`;
const BASE_FRAG = /* glsl */`
  ${NOISE}
  ${LIGHT}
  uniform sampler2D uUnder; uniform float uProgress, uHas, uGrain, uGain; uniform vec3 uKey, uKeyDir, uTint;
  varying vec2 vUv; varying vec3 vP, vN;
  void main() {
    vec2 g = vUv * vec2(260.0, 220.0) * uGrain;
    float weave = 0.5 + 0.5 * sin(g.x * 6.283) * sin(g.y * 6.283);
    vec3 linen = vec3(0.80, 0.76, 0.66) * (0.93 + 0.09 * weave);
    vec3 under = uHas > 0.5 ? pow(texture2D(uUnder, vUv).rgb, vec3(2.2)) : linen;
    vec3 alb = mix(linen, under * uGain, clamp(uProgress * 2.2, 0.0, 1.0) * 0.94 * uHas);
    alb *= uTint;
    vec3 N = normalize(vN), V = normalize(uCam - vP);
    vec3 c = paintShade(alb, N, V, vP, 0.0) + alb * uKey * max(dot(N, uKeyDir), 0.0);
    gl_FragColor = vec4(fogged(c, vP), 1.0);
  }
`;

export class Paintings {
  constructor(U, stations, easels) {
    this.U = U;
    this.group = new THREE.Group();
    this.items = easels.map(e => ({ e, state: 'idle', progress: 0, started: false }));
    this.tex = new THREE.TextureLoader();
    this.painting = 0;
  }
  async load(it) {
    it.state = 'loading';
    const e = it.e;
    try {
      const r = await fetch(e.blob);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = readBlob(await r.arrayBuffer());
      const g = ribbon(5);
      const body = blob.buf.slice(blob.hdr, blob.hdr + blob.count * 24);
      const u16 = new THREE.InstancedInterleavedBuffer(new Uint16Array(body), 12, 1);
      const u8 = new THREE.InstancedInterleavedBuffer(new Uint8Array(body), 24, 1);
      g.setAttribute('aP0', new THREE.InterleavedBufferAttribute(u16, 2, 0, true));
      g.setAttribute('aP1', new THREE.InterleavedBufferAttribute(u16, 2, 2, true));
      g.setAttribute('aP2', new THREE.InterleavedBufferAttribute(u16, 2, 4, true));
      g.setAttribute('aOrder', new THREE.InterleavedBufferAttribute(u16, 1, 10, true));
      g.setAttribute('aColor', new THREE.InterleavedBufferAttribute(u8, 3, 12, true));
      g.setAttribute('aWidth', new THREE.InterleavedBufferAttribute(u8, 1, 15, true));
      g.instanceCount = blob.count;
      const keyDir = new THREE.Vector3(Math.sin(e.yaw), 0.55, Math.cos(e.yaw)).normalize();
      const u = { ...this.U, uCoordLo: { value: blob.coordLo }, uCoordSpan: { value: blob.coordHi - blob.coordLo },
        uWidthK: { value: blob.widthK }, uShort: { value: Math.min(e.w, e.h) }, uSize: { value: new THREE.Vector2(e.w, e.h) },
        uProgress: { value: 0 }, uArrive: { value: 0.012 }, uKey: { value: new THREE.Color() }, uKeyDir: { value: keyDir },
        uGain: { value: e.slug === 'potatoeaters' ? 1.6 : 1.05 } };
      const strokes = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: STROKE_VERT, fragmentShader: STROKE_FRAG, uniforms: u,
        side: THREE.DoubleSide, alphaToCoverage: true }));
      strokes.frustumCulled = false;
      const bu = { ...this.U, uUnder: { value: null }, uHas: { value: 0 }, uProgress: u.uProgress, uKey: u.uKey, uKeyDir: u.uKeyDir, uGrain: { value: 1 }, uGain: u.uGain, uTint: { value: new THREE.Vector3(1, 1, 1) } };
      const base = new THREE.Mesh(new THREE.PlaneGeometry(e.w, e.h), new THREE.ShaderMaterial({ vertexShader: BASE_VERT, fragmentShader: BASE_FRAG, uniforms: bu }));
      const su = { ...bu, uHas: { value: 0 }, uGrain: { value: 0.3 }, uTint: { value: new THREE.Vector3(0.34, 0.27, 0.2) } };
      const frame = new THREE.Mesh(new THREE.BoxGeometry(e.w + 0.04, e.h + 0.04, 0.035), new THREE.ShaderMaterial({ vertexShader: BASE_VERT, fragmentShader: BASE_FRAG, uniforms: su }));
      frame.position.z = -0.021;
      this.tex.load(e.under, t => { t.colorSpace = THREE.NoColorSpace; bu.uUnder.value = t; bu.uHas.value = 1; }, undefined, () => {});
      const grp = new THREE.Group();
      grp.position.set(e.x, e.y, e.z);
      grp.rotation.y = e.yaw;
      grp.add(frame, base, strokes);
      this.group.add(grp);
      Object.assign(it, { grp, u, count: blob.count, state: 'ready' });
    } catch (err) {
      console.warn('painting not loaded:', e.blob, err.message);
      it.state = 'failed';
    }
  }
  update(camera, time, dt, begun) {
    const cam = camera.position;
    const night = this.U.uNight.value;
    let near = null;
    this.painting = 0;
    for (const it of this.items) {
      const e = it.e, d = Math.hypot(cam.x - e.x, cam.z - e.z);
      if (it.state === 'idle' && d < 180) this.load(it);
      if (it.state !== 'ready') continue;
      it.grp.visible = d < 240;
      if (d < 34 && begun) it.started = true;
      if (it.started && it.progress < 1.02) {
        it.progress = Math.min(1.02, it.progress + dt / 13);
        if (it.progress < 1) this.painting = Math.max(this.painting, 1 - d / 34);
      }
      it.u.uProgress.value = it.progress;
      const k = lerp(0.62, 0.92, night) * (it.e.gain || 1);
      it.u.uKey.value.setRGB(1.0 * k, 0.88 * k, 0.7 * k);
      if (d < 9 && (!near || d < near.dist))
        near = { key: e.key, title: e.title, sub: [e.date, e.collection].filter(Boolean).join(' · '), dist: d };
    }
    return near;
  }
}
