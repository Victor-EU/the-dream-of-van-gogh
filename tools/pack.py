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

The header is 320 bytes and at version 4. It grew from 192 at M0b to carry
which colour profile the scan had, or that it had none, so a blob can never be
silently assumed sRGB later; what was cropped off the scan to reach the edge of
the painting; the underlayer's scale; and the band-pass ratio, which is the
number that says whether the strokes carry the picture.

Version 3 adds what M1 found out about the light. `height_method` says which of
the three estimates the heights in this blob came from, and the light fields say
why: the direction the cross-profile recovered, how much the canvas agreed on it,
and the relief that direction would imply at the most generous rig the physics
allows. On these scans that last number lands well under a millimetre and the
agreement lands inside the range the same estimator returns on a canvas with no
light at all, which is what put the shipped heights on method 2. A blob can
therefore always be asked what its relief is worth.

Version 4 adds what M2 found out about the order. `order_method` says whether
the sequence in this blob came from the crossings or from the habits alone, and
the numbers beside it are the held-out measurement that decided it: what
fraction of withheld crossings the order satisfies, what fraction the habits
satisfy on the same withheld crossings, and the size of the blocks that were
withheld -- because that last one moves the answer and a blob that carried the
margin without it would be quoting a number out of context. The act table is the
sequence's own structure: DESIGN 5.2's named groups, each one a span of order,
found by cutting the solved sequence rather than by drawing lines on the canvas.

Version 5 adds what M3 found out about where the canvas stands. `treatment`
says whether this canvas is a plain or a wall, and it is decided by a
measurement rather than by the table in DESIGN 7: how much better the best
level colour cut is than the best upright one, with two canvases that are not
places run through the same code to say where that line goes. `horizon` is
the level cut itself. `gamma` is the exponent the ground is built with and
`gamma_measured` is what the canvas's own foreshortening returned, and they
are stored separately on purpose -- the second one is near zero on every
canvas here, so the first is a construction and a blob that quoted only the
number it was built with would be hiding that.

Every reader takes hdr_len from the header rather than assuming it, so the
growth costs nothing.

    tools/pack.py strokes/m0b/reaper-canvas.json
"""
import json, os, struct, sys
import numpy as np

MAGIC = b"VGST"
VERSION = 5
HDR = 448
STRIDE = 24
CSTRIDE = 24
ASTRIDE = 24
CHUNK_MAX = 2500
COORD_LO, COORD_HI = -0.05, 1.05


def q_coord(v):
    """u16 fixed point over [-0.05, 1.05]: 0.016 mm a step, uniform (BUILD 2)."""
    t = (np.asarray(v, np.float64) - COORD_LO) / (COORD_HI - COORD_LO)
    return np.clip(np.rint(t * 65535.0), 0, 65535).astype("<u2")


def chunks(s, limit=CHUNK_MAX):
    """Split the strokes into spatial chunks, order-sorted inside each one.

    BUILD.md M1 argues this out and the argument is worth keeping: the tempting
    LOD design mirrors `uScrubOrder` and rejects the wrong tier in the vertex
    shader, but a rejected instance still spawns its whole vertex count, so
    three passes over the buffer is millions of vertices a frame spent entirely
    on geometry that collapses. So the tier is chosen per chunk, on the CPU, and
    a few dozen chunks is a loop that never touches a stroke.

    Order-sorted inside the chunk is what makes the scrub *shorten* the draw
    rather than hide it: the arrived strokes are then a prefix, so the scrub
    sets the draw's instance count and early in a station the GPU is issued the
    work that exists rather than the work that will exist.

    The split is a median cut on the longer side, recursively, so the chunks
    follow where the paint actually is instead of a fixed grid putting four
    hundred strokes in one cell and nine thousand in the next.
    """
    def mid(r):
        p = np.array(r["p"], np.float64)
        return (1 / 4) * p[0] + (1 / 2) * p[1] + (1 / 4) * p[2]

    c = np.array([mid(r) for r in s]) if s else np.zeros((0, 2))
    out = []

    def cut(idx):
        if len(idx) <= limit:
            out.append(idx)
            return
        q = c[idx]
        ax = 0 if np.ptp(q[:, 0]) >= np.ptp(q[:, 1]) else 1
        o = idx[np.argsort(q[:, ax], kind="stable")]
        h = len(o) // 2
        cut(o[:h])
        cut(o[h:])

    if len(s):
        cut(np.arange(len(s)))
    order = np.array([r["o"] for r in s], np.float64) if s else np.zeros(0)
    table, perm = [], []
    for idx in out:
        idx = idx[np.argsort(order[idx], kind="stable")]     # a prefix, by order
        p = np.array([r["p"] for r in (s[i] for i in idx)], np.float64)
        w = max((s[i]["w"] for i in idx), default=0.0)
        table.append(dict(first=len(perm), count=len(idx),
                          box=(p[..., 0].min(), p[..., 1].min(),
                               p[..., 0].max(), p[..., 1].max()),
                          olo=order[idx].min(), ohi=order[idx].max(), wmax=w))
        perm.extend(int(i) for i in idx)
    return perm, table


def pack(doc, dest):
    s = doc["strokes"]
    perm, table = chunks(s)
    s = [s[i] for i in perm]
    n = len(s)
    cw, ch = doc["canvas_px"]
    short = min(cw, ch)

    wid = np.array([r["w"] for r in s], np.float64)          # of the short edge
    k = float(np.ceil(wid.max() * 255.0) / 255.0) if n else 1.0
    k = max(k, 1e-6)

    acts = doc.get("acts") or []
    coff = HDR + n * STRIDE
    aoff = coff + len(table) * CSTRIDE
    buf = bytearray(aoff + len(acts) * ASTRIDE)
    rec = memoryview(buf)[HDR:coff]
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
                     1 if doc.get("height_method", 0) == 0 else 0, n)   # flags bit 0: estimated height
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
    lt = doc.get("light") or [0.0, 0.0]
    struct.pack_into("<ffff", buf, 212, float(lt[0]), float(lt[1]),
                     float(doc.get("light_R", 0.0)), float(doc.get("light_mm", 0.0)))
    struct.pack_into("<f", buf, 228, float(doc.get("order_lift_mm", 0.0)))
    struct.pack_into("<IIH", buf, 232, len(table), coff, CSTRIDE)

    rep = doc.get("order_report") or {}
    aud = rep.get("audit") or {}
    struct.pack_into("<B", buf, 256, int(doc.get("order_method", 0)))
    struct.pack_into("<H", buf, 258, len(acts))
    struct.pack_into("<I", buf, 260, aoff)
    struct.pack_into("<H", buf, 264, ASTRIDE)
    struct.pack_into("<fff", buf, 268, float(aud.get("margin", 0.0)),
                     float(aud.get("solver", 0.0)), float(aud.get("heuristic", 0.0)))
    struct.pack_into("<I", buf, 280, int(rep.get("edges", 0)))
    struct.pack_into("<ff", buf, 284, float(rep.get("feedback", 0.0)),
                     float(rep.get("feedback_shuffled", 0.0)))
    struct.pack_into("<II", buf, 292, int(rep.get("stacking", 0)),
                     int(rep.get("overlaps", 0)))
    struct.pack_into("<f", buf, 300, float(aud.get("block", 0.0)))

    pl = doc.get("place") or {}
    struct.pack_into("<ffff", buf, 320, float(pl.get("horizon", 0.5)),
                     float(pl.get("gamma", 1.0)), float(pl.get("gamma_measured", 0.0)),
                     float(pl.get("horizon_ratio", 0.0)))
    struct.pack_into("<ff", buf, 336, float(pl.get("split", 0.0)),
                     float(pl.get("split_null", 0.0)))
    struct.pack_into("<ff", buf, 344, float(pl.get("size_ratio", 0.0)),
                     float(pl.get("size_demand", 0.0)))
    struct.pack_into("<ff", buf, 352, float(pl.get("null_p", 0.0)),
                     float(pl.get("vp_ratio", 0.0)))
    struct.pack_into("<II", buf, 360, int(pl.get("sky_strokes", 0)),
                     int(pl.get("ground_strokes", 0)))
    struct.pack_into("<fff", buf, 368, float(pl.get("hfov", 50.0)),
                     float(pl.get("eye", 1.65)), float(pl.get("dome", 90.0)))
    struct.pack_into("<BB", buf, 380, 1 if pl.get("treatment") == "lifted" else 0,
                     1 if pl.get("gradient") else 0)
    struct.pack_into("<ffff", buf, 384, float(pl.get("far", 0.0)),
                     float(pl.get("near", 0.0)), float(pl.get("reach", 0.0)),
                     float(pl.get("dmax", 0.0)))
    for j, t in enumerate(table):
        o = coff + j * CSTRIDE
        struct.pack_into("<II", buf, o, t["first"], t["count"])
        buf[o + 8:o + 16] = q_coord(t["box"]).tobytes()
        struct.pack_into("<HHH", buf, o + 16,
                         int(np.clip(round(t["olo"] * 65535), 0, 65535)),
                         int(np.clip(round(t["ohi"] * 65535), 0, 65535)),
                         int(np.clip(round(t["wmax"] / k * 65535), 0, 65535)))

    ordv = np.array([r["o"] for r in s], np.float64) if n else np.zeros(0)
    for j, a in enumerate(acts):
        o = aoff + j * ASTRIDE
        m = np.array([r["act"] for r in s], np.int32) == j if n else np.zeros(0, bool)
        lo, hi = (float(ordv[m].min()), float(ordv[m].max())) if m.any() else (0.0, 0.0)
        struct.pack_into("<HH", buf, o, int(np.clip(round(lo * 65535), 0, 65535)),
                         int(np.clip(round(hi * 65535), 0, 65535)))
        struct.pack_into("<I", buf, o + 4, int(m.sum()))
        nm = a["name"].encode("utf-8")[:16]
        buf[o + 8:o + 8 + len(nm)] = nm

    with open(dest, "wb") as f:
        f.write(buf)
    return n, k, len(buf), len(table)


def main():
    src = sys.argv[1]
    doc = json.load(open(src))
    dest = os.path.splitext(src)[0] + ".bin"
    n, k, size, nch = pack(doc, dest)
    print(f"{n} strokes  width_k {k:.5f}  {size/1024:.1f} KB  -> {dest}")
    print(f"  chunks  {nch} spatial, order-sorted inside"
          f"   {n/max(nch,1):.0f} strokes a chunk")
    print(f"  source  {doc['source_sha256'][:16]}...")
    print(f"  params  {doc['params_sha256'][:16]}...")
    print(f"  colour  {doc.get('profile') or 'no profile embedded in the scan'}"
          f"  (flags {doc.get('colour_flags', 0)})")
    import math
    lt = doc.get("light") or [1.0, 0.0]
    rep = doc.get("order_report") or {}
    aud = rep.get("audit") or {}
    acts = doc.get("acts") or []
    print(f"  order   method {doc.get('order_method', 0)}"
          f"   {rep.get('edges', 0)} confident crossings"
          f"   held out: {aud.get('solver', 0)*100:.1f}% against the habits'"
          f" {aud.get('heuristic', 0)*100:.1f}%"
          f"  (margin {aud.get('margin', 0)*100:+.1f})")
    print(f"  acts    " + "  ".join(f"{a['name']} {a['count']}" for a in acts))
    pl = doc.get("place") or {}
    if pl:
        print(f"  place   {pl['treatment']}   horizon v {pl['horizon']:.3f}"
              f"  ({pl['horizon_ratio']:.0f}x the best upright cut)"
              f"   gamma {pl['gamma']:.2f} built, {pl['gamma_measured']:+.2f} measured"
              f"   sky/ground {pl['sky_strokes']}/{pl['ground_strokes']}")
    print(f"  relief  method {doc.get('height_method', 0)}"
          f"   cap {doc.get('height_mm', 0):.2f} mm"
          f"   light {math.degrees(math.atan2(-lt[1], lt[0])):+.0f} deg"
          f" at R {doc.get('light_R', 0):.4f}"
          f" (implies <= {doc.get('light_mm', 0):.2f} mm)")


if __name__ == "__main__":
    main()
