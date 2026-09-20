// The stroke records, as the sibling's pipeline packs them (its tools/pack.py: 24 bytes a stroke behind a header),
// and the depth sidecar this piece adds beside each (tools/depth.py: two floats a stroke, in record order).
export async function loadRecord(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const buf = await r.arrayBuffer(), v = new DataView(buf);
  const magic = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3));
  if (magic !== 'VGST') throw new Error(`${url}: not a stroke record`);
  const hdr = v.getUint16(6, true), stride = v.getUint16(8, true), n = v.getUint32(12, true);
  if (stride !== 24) throw new Error(`${url}: stride ${stride}`);
  const px = [v.getUint32(16, true), v.getUint32(20, true)];
  const cm = [v.getFloat32(24, true), v.getFloat32(28, true)];
  const lo = v.getFloat32(52, true), hi = v.getFloat32(56, true);
  const wk = v.getFloat32(60, true), heightMm = v.getFloat32(64, true);
  const ck = hdr >= 452 ? v.getFloat32(448, true) : 0;
  const p = new Float32Array(n * 6), rgb = new Float32Array(n * 3), w = new Float32Array(n), h = new Float32Array(n);
  const curl = new Float32Array(n), order = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = hdr + i * stride;
    for (let k = 0; k < 6; k++) p[i * 6 + k] = v.getUint16(o + k * 2, true) / 65535 * (hi - lo) + lo;
    for (let k = 0; k < 3; k++) rgb[i * 3 + k] = Math.pow(v.getUint8(o + 12 + k) / 255, 2.2);   // sRGB in the record
    w[i] = v.getUint8(o + 15) / 255 * wk;
    h[i] = v.getUint8(o + 16) / 255;
    curl[i] = v.getUint8(o + 19) / 255 * ck;
    order[i] = v.getUint16(o + 20, true) / 65535;
  }
  return { n, p, rgb, w, h, curl, order, cm, px, heightMm };
}

export async function loadDepth(url, n) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const f = new Float32Array(await r.arrayBuffer());
  if (f.length !== n * 2) throw new Error(`${url}: ${f.length / 2} depths for ${n} strokes`);
  const d = new Float32Array(n), shine = new Float32Array(n);
  for (let i = 0; i < n; i++) { d[i] = f[i * 2]; shine[i] = f[i * 2 + 1]; }
  return { d, shine };
}
