#!/usr/bin/env python3
"""Pack extracted strokes into the runtime blob. 24 bytes a stroke.

DESIGN.md 4.2, with BUILD.md's corrections 1-3 applied (order is a u16 fraction
of the sequence, control points are u16 fixed point over [-0.05, 1.05], colour
is sRGB-encoded rather than linear) and one more that only shows up when you go
to bind the thing:

  The design lists the fields in an order that cannot be bound as an attribute
  buffer. Taken literally it puts `order` at byte 17 and `depth` at 21, and
  WebGL requires a u16 or f16 attribute to sit at a multiple of two. So the
  fields are re-ordered here -- same fields, same 24 bytes, offsets that a
  vertexAttribPointer can actually address. Recorded in BUILD.md as correction 5.

    offset  size  field
       0     12   p0x p0y p1x p1y p2x p2y   u16 normalised over [-0.05, 1.05]
      12      3   r g b                     u8, sRGB-encoded
      15      1   width                     u8, of the canvas short edge x k
      16      1   height                    u8, impasto, 0 = flat wash
      17      1   act                       u8
      18      1   flags                     u8  1 contour 2 highlight
      19      1   (pad)                         4 chain-continues 8 edge-spill
      20      2   order                     u16 fraction of the sequence
      22      2   depth                     f16

The header is 256 bytes at version 2. It grew from 192 to carry what M0b added:
which colour profile the scan had, or that it had none, so a blob can never be
silently assumed sRGB later; what was cropped off the scan to reach the edge of
the painting; the underlayer's scale; and the band-pass ratio, which is the
number that says whether the strokes carry the picture. Every reader takes
hdr_len from the header rather than assuming it, so the growth costs nothing.

    tools/pack.py strokes/m0b/reaper-canvas.json
"""
import json, os, struct, sys
import numpy as np

MAGIC = b"VGST"
VERSION = 2
HDR = 256
STRIDE = 24
COORD_LO, COORD_HI = -0.05, 1.05


def q_coord(v):
    """u16 fixed point over [-0.05, 1.05]: 0.016 mm a step, uniform (BUILD 2)."""
    t = (np.asarray(v, np.float64) - COORD_LO) / (COORD_HI - COORD_LO)
    return np.clip(np.rint(t * 65535.0), 0, 65535).astype("<u2")


def pack(doc, dest):
    s = doc["strokes"]
    n = len(s)
    cw, ch = doc["canvas_px"]
    short = min(cw, ch)

    wid = np.array([r["w"] for r in s], np.float64)          # of the short edge
    k = float(np.ceil(wid.max() * 255.0) / 255.0) if n else 1.0
    k = max(k, 1e-6)

    buf = bytearray(HDR + n * STRIDE)
    rec = memoryview(buf)[HDR:]
    for i, r in enumerate(s):
        o = i * STRIDE
        p = np.array(r["p"], np.float64).ravel()
        rec[o:o + 12] = q_coord(p).tobytes()
        rec[o + 12] = int(r["rgb"][0])
        rec[o + 13] = int(r["rgb"][1])
        rec[o + 14] = int(r["rgb"][2])
        rec[o + 15] = int(np.clip(round(r["w"] / k * 255.0), 0, 255))
        rec[o + 16] = int(np.clip(round(r["h"] * 255.0), 0, 255))
        rec[o + 17] = int(r["act"]) & 0xFF
        rec[o + 18] = int(r["flags"]) & 0xFF
        rec[o + 19] = 0
        struct.pack_into("<H", rec, o + 20,
                         int(np.clip(round(r["o"] * 65535.0), 0, 65535)))
        rec[o + 22:o + 24] = np.float16(r["depth"]).tobytes()

    struct.pack_into("<4sHHHHI", buf, 0, MAGIC, VERSION, HDR, STRIDE,
                     1 if doc.get("height_method", 0) == 0 else 0, n)
    struct.pack_into("<II", buf, 16, cw, ch)
    struct.pack_into("<fff", buf, 24, doc["canvas_cm"][0], doc["canvas_cm"][1],
                     doc["px_per_cm"])
    struct.pack_into("<IIII", buf, 36, *doc["tile_rect"])
    struct.pack_into("<ff", buf, 52, COORD_LO, COORD_HI)
    struct.pack_into("<f", buf, 60, k)
    struct.pack_into("<f", buf, 64, float(doc.get("height_mm", 4.0)))
    struct.pack_into("<B", buf, 68, int(doc.get("height_method", 0)))
    struct.pack_into("<B", buf, 69, int(doc.get("colour_flags", 0)))
    struct.pack_into("<H", buf, 70, int(doc.get("under_ds", 0)))
    buf[72:104] = bytes.fromhex(doc["source_sha256"])
    buf[104:136] = bytes.fromhex(doc["params_sha256"])
    slug = (doc["slug"] + "-" + doc["tile"]).encode()[:32]
    buf[136:136 + len(slug)] = slug
    prof = (doc.get("profile") or "").encode("utf-8")[:24]
    buf[168:168 + len(prof)] = prof
    struct.pack_into("<IIII", buf, 192, *(doc.get("crop_rect") or [0, 0, 0, 0]))
    struct.pack_into("<f", buf, 208, float(doc.get("bandpass", 0.0)))

    with open(dest, "wb") as f:
        f.write(buf)
    return n, k, len(buf)


def main():
    src = sys.argv[1]
    doc = json.load(open(src))
    dest = os.path.splitext(src)[0] + ".bin"
    n, k, size = pack(doc, dest)
    print(f"{n} strokes  width_k {k:.5f}  {size/1024:.1f} KB  -> {dest}")
    print(f"  source  {doc['source_sha256'][:16]}...")
    print(f"  params  {doc['params_sha256'][:16]}...")
    print(f"  colour  {doc.get('profile') or 'no profile embedded in the scan'}"
          f"  (flags {doc.get('colour_flags', 0)})")


if __name__ == "__main__":
    main()
