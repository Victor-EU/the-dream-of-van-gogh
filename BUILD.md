# Van Gogh's Universe — build plan

The plan for building what `DESIGN.md` describes. `DESIGN.md` says what and why; this file says in what order, how we
know each step is done, and what number tells us to stop. A milestone is done when its exit criteria pass, not when
its code exists. **Sequencing changes land here, never in the design.** Where this plan contradicts the design on a
matter of fact rather than order, it says so out loud in "Four corrections" below and the design is patched.

The file has two parts. The first is the plan as written before the build: the rules, the corrections, the numbers,
the verification harness, milestones M0a to M9, and what is deferred. The second, under **Progress**, is the log: one
entry per milestone, each saying what was asked or wrong, what was built, how it was verified, and what is still
visible. The commit for each milestone carries the same title as its entry.

---

## Three rules for the whole build

1. **Prove the paint before the map.** Inherited from `monets-universe/BUILD.md`, where it was correct, and it matters
   more here. Every station is made of the same ribbons. If the ribbons are wrong, ten stations of them are ten times
   wrong. This is why M1 is paint and M2 is order, and the first *place* does not appear until M3 — a resequencing of
   the design's §14, recorded below.
2. **Nothing in the world that is not a stroke.** No modelled tree, no modelled roof, no ground mesh you can see. The
   built surfaces of §4.4 exist only to carry strokes and are never themselves visible. The test is a harness flag:
   `?noStrokes` must render a world that is essentially empty. **If `?noStrokes` shows a recognisable scene, we have
   built a game level and painted it, and that is the failure this project is most likely to die of.**
3. **Always walkable.** After every milestone `index.html` opens, renders, and can be walked. We never sit on a broken
   world.

---

## Two tracks, and why the loop between them is the schedule

`monets-universe` had one track. This has two, and they fail differently:

- **The pipeline** (Python, offline, `tools/`): `extract.py` → `order.py` → `pack.py`. Minutes to hours per canvas.
- **The runtime** (one HTML file): reads blobs, renders ribbons. Milliseconds.

The trap is that **extraction parameters cannot be judged in Python.** A stroke set that scores well on every
numerical measure can still read as fur, spaghetti or plastic when you are standing in it, and that judgement is only
available in the renderer. So the pipeline's real cost is not its runtime, it is the length of the
tune → re-extract → reload → look loop.

Therefore, from M0b onward (M0a is deliberately too small to need any of it):

- `tools/make.py <slug>` runs the whole pipeline for one canvas from a params file and writes the blob.
- Extraction caches its expensive intermediates (the working-resolution image, the structure tensors) keyed by their
  own parameters, so changing a tracing threshold does not recompute a tensor field.
- Every stroke parameter lives in `params/<slug>.json`, never in the source. Nothing is tuned by editing Python.
- The renderer hot-reloads a blob on a key press.

Target loop: **under 60 seconds from changing a number to standing in the result.**

Which a full canvas cannot meet — M0b allows twenty minutes for extracting the Reaper, so a tracing change costs
twenty minutes, and at that price we will tune three times instead of thirty and the paint will be worse. **So the
loop runs on one tile.** A single 3072 px region of the canvas — the reaper himself, the sun, a patch of open wheat —
extracts in about a minute, and the full canvas is run only to confirm a setting that already looked right on the
crop. The three tuning regions are named in `params/reaper.json` and are chosen to disagree with each other: one dense
directional passage, one with bare weave showing, one with the heaviest impasto. This is a schedule item, not a
nicety.

---

## Four corrections to the design, before any code

All four are arithmetic, and all four would have been found the expensive way.

**1. `order` as a u16 index overflows.** §4.1 expects up to 80,000 strokes per canvas; §4.2 stores `order` in two
bytes, which reaches 65,535. Above that the field cannot index its own sequence. **Fix: `order` is a u16 *fraction* of
the station's sequence, not an index** — position × 65535 / count. Ties are harmless because the scrub is a threshold
comparison, never a lookup, and a burst arrives thousands of strokes wide anyway. This is also strictly better: the
same field then works for a station of 4,000 strokes and one of 400,000, and `uScrubOrder` becomes a plain 0–1 number.

**2. float16 is the wrong type for a bounded coordinate.** §4.2 stores the three control points as float16 in
canvas-normalised coordinates. Float16 spends its precision near zero and runs out near one: in [0.5, 1) its spacing
is 2⁻¹¹, which on the Reaper's 927 mm width is **0.45 mm** — an eighth of the narrowest stroke we intend to fit, and
worse at the right-hand edge of every canvas than at the left, which is a strange thing to build into a painting.
**Fix: u16 normalised fixed point over [−0.05, 1.05]** (the margin carries the `edge-spill` flag's strokes). Step:
**0.016 mm, uniform across the canvas** — 29× finer at the worst point and never worse anywhere. Identical 12 bytes,
and `gl.UNSIGNED_SHORT` with `normalized = true` decodes it in the attribute fetch for free. It also fixes chains
(§4.1 step 5) for nothing: two strokes sharing an endpoint quantise to the same integer, so a spiral cannot develop
gaps at its joints.

**3. RGB8 *linear* will destroy station 1.** §4.2 stores colour as 8-bit linear. Linear 8-bit gives roughly four
usable levels below 2% luminance, and *The Potato Eaters* is a canvas that lives almost entirely there — the design
already worries (§15) that the station is too dark to hold a viewer, and banding it into mud is how that worry comes
true. **Fix: store sRGB-encoded RGB8 and decode in the vertex shader** (one `pow`, per instance, not per pixel). Same
three bytes, roughly 4× the effective precision in the shadows where every one of them is needed.

**4. The stroke counts in §4.1 and §12 are most likely an order of magnitude too high — and that is good news.**
*Wheatfield with a Reaper* is 92.7 × 73.2 cm, so 6,786 cm² of canvas. A Van Gogh stroke in that painting runs roughly
7 mm wide and 35 mm long — 2.4 cm². Covering the canvas three times over is then about **8,500 strokes**, not 60,000.
For 60,000 strokes to be right, each would have to occupy 0.11 cm² — a 3 × 4 mm dab — which is not what is on that
canvas.

**A second part of the design agrees, and it was written without reference to the first.** §5.2 describes a burst as
"four thousand strokes over two seconds", and §7 gives ten stations of roughly six acts each — sixty bursts. Sixty
bursts of four thousand is 240,000 strokes for the whole piece, which is twenty canvases at about 12,000 each. At the
design's own 60,000 per canvas the arithmetic breaks: 1.2 M strokes over sixty acts is 20,000 per burst, which at the
stated rate is **ten continuous seconds of arrival** — a fizz, not a burst, and the exact thing §5.2 was written to
avoid. Two unrelated sections of the design corroborate ~10,000 strokes per canvas. The one that says 60,000 is the
outlier.

So the design's "thirty to eighty thousand per canvas" is not a target. It is a **hypothesis M0b tests**, and if
extraction hits it the most likely explanation is not that the estimate was wrong but that **the tracer is chopping
long strokes into fragments**, which is precisely the failure mode that reads as fur. Stroke count is therefore a
diagnostic, not a goal, and the diagnostic that matters more is mean traced arc length: it should land near the paint,
2–6 cm, which at the working resolution below is **250–700 px**. See M0a's exit criteria.

The consequence for §12 is that the performance budget gets much looser than the design assumed. Twenty canvases at
~10,000 strokes is 200,000 strokes for the *entire piece*, against a stated 400,000 resident. At 24 triangles for a
near-tier ribbon, 80,000 lit ribbons is 1.92 M triangles — and 80,000 is more strokes than any single station will
contain. **Everything visible can be at the near tier.** That de-risks M1's LOD work considerably and lets the far
tier be deferred (see Deferred). The budget table is not relaxed on paper until M0b measures a whole canvas.

*The design has been patched for corrections 1, 2 and 3, which are simply errors. Correction 4 is left in the design
as written, because it is an estimate arguing with an estimate and M0b settles it with a number.*

*A fifth correction of exactly this kind — arithmetic, invisible until something touches it — was found in M0a, the
first time the record was bound as an attribute buffer. It is recorded in its Progress entry and the design is
patched. Four is what could be found by reading; the fifth needed a compiler.*

*Two more of the design's steps needed correcting at M0b, and neither was arithmetic: §4.1 step 3's union of the
ridge maps finds every stroke three times unless chroma is seeded only where luminance is blind, and §4.1 step 7's
subtracted residual smuggles stroke-scale structure back under the strokes unless the underlayer is built from the
uncovered pixels alone. Both are recorded in the M0b entry and the design is patched with the reasoning.*

---

## The numbers this plan bets on

**Working resolution is 120 px/cm, and everything above it is downsampled to it.** This follows from
`paintings/CREDITS.md` and it is not merely a saving — extracting at 484 px/cm would spend most of its effort
resolving canvas weave and craquelure, which are noise for stroke fitting and would be traced as strokes.

| | native | at 120 px/cm | why it matters |
|---|---|---|---|
| *Wheatfield with a Reaper* | 12665 × 10012 (127 MP) | 11124 × 8784 (98 MP) | a mild downsample; the M0a/M0b canvas |
| *The Starry Night* † | 44567 × 35291 (1573 MP) | 11052 × 8844 (98 MP) | a 4× downsample, and the difference between possible and impossible |
| *The Potato Eaters* | 7698 × 5428 (42 MP) | unchanged, 68 px/cm | already below target; extraction runs at native and the tensor scales scale with it |

† *The Starry Night's canvas size is one of the dimensions `paintings/CREDITS.md` marks unverified — MoMA is not open
access and the figure is not from the holder's own catalogue. Its working resolution is therefore provisional, and the
scan's aspect (1.263) and the usual cited dimensions (1.250) disagree by about a percent, which is roughly a
centimetre of frame margin. It is a station-8 problem, not an M0b one, but it must be settled before that canvas is
extracted or the whole sky is fitted at the wrong scale.*

**Memory forces tiling.** A 98 MP working image as float32 RGB is 1.17 GB, and extraction holds a dozen or more
intermediate planes — structure tensors at three scales, ridge maps on luminance and three chroma channels. That is
comfortably past this machine's 8 GB. **Extraction is tiled: 3072 px tiles with 1024 px of overlap.**

The overlap has to exceed the longest arc the tracer can produce, or a trace is cut by a tile edge — and the number
that must clear is the tracer's **hard cap**, not the mean of 250–700 px below. Sizing an overlap against a mean is
how you discover, at station 8, that every long sky stroke has a seam in it. The cap is set equal to the overlap:
**1024 px, which is 8.5 cm**, comfortably clear of the band the mean should land in.

Marks longer than that become chains, and they would have to anyway: a quadratic Bézier is a single arc, so a 15 cm
sky sweep is not one stroke in this format under any circumstance — §4.1 step 5 already says so about the Saint-Rémy
spirals. Which means **the overlap merge does two jobs, not one**: deduplicate traces that were found twice, and
re-chain the ones that were split by the boundary. That second job is the part of the pipeline most likely to be
quietly wrong, which is why M0b's exit criteria look for it directly.

The cost of the wider overlap here is nothing: 3072 px tiles stepping by 2048 still cover the Reaper's working image
in **5 × 4 = 20 tiles**, and a tile costs
113 MB per float32 RGB plane and 38 MB per single-channel one — three of the former and twenty of the latter is about
1.1 GB, with the working image itself memory-mapped rather than resident. Peak RSS is measured and recorded; the
ceiling is 6 GB.

**The blob is small.** At ~10,000 strokes and 24 bytes, a canvas is 240 KB. §12's "≤ 6 MB streamed per station" then
binds on nothing at all, and the true constraint is the near-tier count. If M0b finds 60,000 strokes instead, a canvas
is 1.4 MB and station 5 — nine canvases — is 13 MB, over budget; the resolution in that case is that **the streaming
unit is the act, not the station**, since acts arrive in sequence and a station's later acts can stream while you
watch its earlier ones. Decided at M3 with a real number in hand.

**Time is compressed by a constant, and we say so.** §3.2 wants strokes arriving "at something like the rate he
worked". Taken literally that is unbuildable: a canvas of 10,000 strokes laid at about one every three seconds is
eight hours, and station 4 has perhaps forty seconds. §5.2's burst rate of 2,000 strokes per second against a real
rate near 0.35 puts the compression **on the order of 5,000× during a burst**, and a few thousand times averaged over
the holds. The absolute rate is therefore fiction and there is no version of this where it is not.

But **one global compression constant makes every relative tempo true.** The orchards really were faster than the
Potato Eaters, and if the constant never changes, the viewer is seeing that ratio rather than our dramatic preference.

Two things fall out of holding the constant fixed, and both are better than what the design has:

- **§5.1's non-linear τ stops being a dramatic choice and becomes a consequence.** If strokes arrive at a constant
  multiple of his working rate, then viewer-time in a station is proportional to the *painting he did there*, not to
  the calendar. That is exactly §5.1's "the dense months get more of the range" — derived rather than asserted.
- **The holds get a source.** A burst is a painting session and a hold is the gap between sessions, and session counts
  are in the letters for a good number of these canvases. Better than "acts arrive in bursts", because it is found
  rather than staged.

**And it sizes the piece.** 200,000 strokes at a burst rate of 2,000 per second is **200 seconds of arrival for the
entire work.** If the piece is to run ten to fifteen minutes, then arrival is a fifth of it at most and everything
else is holds, transits, and standing still looking — which is a pacing fact worth knowing before we write the pacing
rather than after. Fixed at M2.

*Fixed, and both numbers in that paragraph were wrong. 200,000 at 2,000 a second is 100 seconds, not 200 — and the
200,000 is itself low by 2.7×. Stroke density is now measured at **2.75 per square centimetre**, within six percent
across three canvases spanning three times the area and three stations, which gives **356,000 strokes** over the 26
scans in `CREDITS.md` whose dimensions are known and about **550,000** pro rata over all forty. So arrival is 273
seconds, a third of a fifteen-minute piece rather than a fifth of it. The constant is **4,000×**, from the Reaper's
18,924 strokes over something like ten hours of painting — about half a stroke a second — against §5.2's 2,000 a
second. And the hold does not take the constant: a night between sessions at 4,000× is eleven seconds of nothing, so
a hold is punctuation at a fixed 2.4 s and the record supplies how many, not how long.*

---

## Verification harness

Set up in M0b. M0a runs without it — the gate is one tile and a pair of eyes — but every milestone after is
checked with it.

**URL hooks.** Hidden from the interface, free at runtime.

| | |
|---|---|
| `?tau=0.42` | set τ directly |
| `?station=8` | jump to a station's start |
| `?cam=x,y,z,yaw,pitch` | place the camera |
| `?still` | freeze all time-based motion so a frame repeats exactly |
| `?debug` | live readout: τ, station, strokes per tier, draw calls, triangles, frame time, RSS |
| `?quality=light\|balanced\|rich` | override the measured tier |
| `?flat` | **render the strokes orthographically, flat-lit, at the canvas's aspect** |
| `?xray` | centrelines only, no width, no height — shows what the tracer actually found |
| `?heights` | false-colour the impasto field — the fastest way to see M1's height estimate failing |
| `?noStrokes` | everything except the strokes, for rule 2 |
| `?volume` | draw the station's viewing volume |

`?flat` earns its place: it makes the runtime produce **the same image the Python tuning loop produces**, from the
packed blob rather than from the extractor's own state. The two rasterisers will never agree pixel for pixel and are
not asked to — what shows up instantly in the difference is the class of bug that is otherwise invisible until it
merely looks like bad art: a colour space applied twice or not at all, a flipped V coordinate, an off-by-one in the
order fraction, a dropped flag, a width scale that lost its `k`. Without this hook those are found by staring.

**Debug API** on `window.vg`, per §13: `vg.state`, `vg.scrub(τ)`, `vg.station(n)`, `vg.snap()`, plus
`vg.strokes()` for per-tier counts and `vg.reload(slug)` for the hot-reload loop.

**Headless frames.** Inherited from the sibling project's log, which paid for this lesson: the Claude browser pane is
usually hidden, which pauses `requestAnimationFrame` and throttles the CPU, so **timings taken from it are
worthless**. Frames and numbers come from headless Chrome — `--headless=new --use-angle=metal --screenshot`, no
virtual-time budget — against `?still&debug`. The render loop must advance under a patched `rAF`, and motion uses a
clock with a clamped delta so a stalled loop never teleports the camera.

**Pipeline regression.** The flat reconstruction of the Reaper at 1200 px is committed as a golden image. Any
pipeline change reports its RMS difference against it. A change that moves that number without meaning to is a
regression, and this catches it in seconds instead of in a milestone.

**Provenance.** `pack.py` writes the source scan's SHA-256 and the params hash into every blob header. A blob can
always be traced back to the exact file in `ref/originals/` and the exact numbers that produced it.

**Determinism.** Seed `18531890` everywhere (§13). `?still` plus a fixed τ produces the same `snap()` twice.

**Failure is visible.** No WebGL 2, no blob, a malformed blob: the page says so in text. It never shows a blank
rectangle. `monets-universe` got this right in its own M0 and it costs ten lines.

---

## M0a — One tile, standing up  *(the gate; 2–3 days)*

**The design says the cost of finding out is a day. That is only true if M0 is kept small, and the first draft of
this plan did not keep it small** — it had the full tiled extractor, the harness, colour management and station 0 in
the same milestone, which is a fortnight, and a fortnight is not a gate. So M0 splits, and everything that is not
strictly needed to answer the question moves out.

**Scope.** **One 3072 px tile of *Wheatfield with a Reaper*** — 25.6 cm of canvas at the working resolution, a few
hundred strokes of wheat and the edge of the sun — extracted by the simplest extractor that could possibly work
(structure tensor at one scale, luminance ridges only, streamline trace, quadratic fit, median colour, width from the
ridge), packed, and rendered as lit ribbons with height, in a page you can walk into. Heuristic order: thin and dark
before thick and light. No chroma ridges, no residual layer, no tiling, no LOD, no station.

**Exit criteria.**

| | target | why this number |
|---|---|---|
| Mean traced arc length | 250–700 px at 120 px/cm | that is 2–6 cm, which is the paint on that canvas; the hard cap is 1024 |
| Strokes in the tile | 300 – 1500 | scaled from correction 4; above ~2500 the tracer is fragmenting |
| Coverage | ≥ 75% of the tile inside a stroke footprint | he covered the canvas; bare weave is deliberate and local |
| Extraction wall time | ≤ 2 min | this is the tuning loop; everything depends on it staying short |

**The gate.** We stand in it, close, at eye level, and answer honestly: **does this read as Van Gogh, or as noodles?**
A quarter of the canvas cannot tell us about composition and is not being asked to. It can tell us whether a field of
fitted ribbons is paint, and that is the only question worth three days. No number substitutes for it.

If it is noodles, the diagnosis is one of four and each has a different fix: **fur** (tracer fragmenting → arc
length), **spaghetti** (widths too uniform → the attribute pass), **mud** (colour medians eating the neighbouring
stroke at crossings → the median band is too wide), **plastic** (the height field is wrong → M1's job, so M0a may
pass provisionally on nearly-flat ribbons with the gate re-run at M1).

**If it does not give chills, the idea is wrong and the cost of finding out was three days.**

---

## M0b — The pipeline and the harness  *(1–1.5 weeks)*

Only started once M0a passes. Nothing here is speculative work; all of it is machinery the gate proved worth building.

**Scope.** `git init`. The harness above, in full. `tools/make.py` and the params-file discipline. The tiled extractor
with its overlap merge, running the whole Reaper. Chroma ridges (§4.1 step 3 — his strokes are very often one loaded
colour beside another at the same value, which a luminance ridge cannot see). The residual underlayer. The packer with
corrections 1 to 3 applied. The golden image.

Two things no milestone owned in the first draft of this plan, both added here:

- **Colour management (§4.1 step 1) is a cross-station problem, not a per-canvas one.** These forty scans come from
  twelve institutions with different profiles and different photographic intent — Google Art Project files, Micrio
  JPEGs, a C2RMF laboratory scan. If the decode is loose, the stations will not sit on the same colour footing, and
  **station 2's flood is the single effect in the piece most exposed to that**: it is a Nuenen canvas from the Van
  Gogh Museum against Paris canvases from Chicago, and if that shock turns out to be a profile mismatch we will have
  shipped a lie about the most famous change in his work. Decode to linear sRGB with the embedded profile honoured,
  record the profile in the blob header, flag any scan that has none rather than assuming one. Checked properly at M6.
- **Station 0 is the first thing anyone ever sees**, and it is also the loading screen (§7), so it is not a thing to
  get to later. White, woven, one charcoal line. The underdrawing ghost of §3.2 is free and derived: the
  earliest-order contour strokes, drawn flat, dark and without height — the extraction's own opinion about what he
  drew first, rather than an illustration of one.

**Exit criteria.** The full canvas, and the numbers M0a could not reach:

| | target | why this number |
|---|---|---|
| Stroke count, whole canvas | 5 k – 25 k | > 40 k means fragmentation, per correction 4 |
| Band-pass energy at stroke scale, strokes ÷ source | ≥ 0.6 | **if the residual carries the picture, we have built a projection show with sprinkles** |
| Flat reconstruction at 1200 px | recognisably the painting | |
| Flat reconstruction at 1:1 | recognisably paint | |
| Extraction wall time, whole canvas | ≤ 20 min | |
| Peak RSS | ≤ 6 GB | this machine has 8 |
| Tile seams | invisible in `?flat`; no duplicate strokes in an overlap; no chain broken at a boundary | the merge is the part most likely to be quietly wrong |

Then the runtime: ribbons with per-stroke width, height and a bowed normal; one tight specular lobe and one broad;
`uScrubOrder` collapsing unarrived strokes to degenerate triangles with nothing rebuilt and no buffer re-uploaded;
arriving strokes extruding along their own length over ~120 ms; look and walk; the failure path visible in text;
60 fps at 2× DPR.

---

## M1 — Paint  *(1–1.5 weeks)*

**Scope.** Still one canvas. The underlayer, the weave, and the thing the design correctly calls its weakest link.

**Impasto height is the real work here.** §4.1 step 6 derives height from local luminance above a wide neighbourhood,
which is systematically wrong: it gives every light-on-dark passage relief and every dark-on-light passage a dent,
because it is measuring colour, not geometry. The consequence looks like Van Gogh moulded in plastic.

The signal that actually carries relief is the **cross-profile of the stroke**, sampled perpendicular to its own
direction and averaged along its length. Two cues, and we fit both:

- **Antisymmetric** — one flank lit, the other shaded. Amplitude ∝ h·(ℓ·n), so it depends on the stroke's own
  orientation relative to the light ℓ. Solve ℓ **globally per canvas** by maximising consistency over all strokes.
- **Symmetric** — both flanks darkened by self-shadowing at the ridge's foot. This one survives cross-lighting.

That second cue matters because of a real possibility this plan has to name: **museum flat-field photography is
deliberately cross-lit to kill relief shadows**, and if the Van Gogh Museum's rig is symmetric enough, the
antisymmetric cue is gone and the method returns noise dressed as data.

The test that tells us which world we are in is free, because we have 22 canvases from the same institution shot on
the same rig: **the recovered light direction ℓ must agree across all Van Gogh Museum scans.** If it does, we are
measuring the photography and therefore the relief. If ℓ scatters, we are measuring nothing, and the fallback is
declared rather than discovered: the design's crude heuristic applied conservatively, plus **hand-authored relief per
act** — the highlight act stands proud, the ground act is flat — which is honest, cheap, and probably 80% as good.

Also in M1: the residual underlayer of §4.1 step 7, rendered as a thin flat surface beneath the ribbons; the canvas
weave, with the parameters that let it roughen into jute at station 8; and the three LOD tiers.

**The obvious way to do the tiers does not work, and it is worth writing down why before someone builds it.** The
tempting design is the one that mirrors `uScrubOrder`: draw the whole buffer once per tier and reject the wrong tier
in the vertex shader. But a rejected instance still spawns its full vertex count, so three passes over 400,000
instances at 28 vertices is **33.6 M vertices a frame — 2.0 G/s at 60 fps — spent almost entirely on geometry that
collapses.** It would present as "20 fps with nothing on screen", which is a bad afternoon.

The tiers are therefore **per chunk**, and the chunk is fixed at pack time:

- Strokes are packed into spatial chunks of one to four thousand, **order-sorted within the chunk**, each carrying its
  bounds and its order range.
- The CPU frustum-culls and tier-assigns per chunk. A few hundred chunks is a trivial loop; 400,000 strokes is not,
  and no CPU loop ever touches an individual stroke.
- **The scrub shortens the draw instead of hiding it.** Because a chunk is order-sorted, the arrived strokes are a
  prefix, so `uScrubOrder` sets the draw's instance *count*. Early in a station the GPU is issued the work that
  exists, not the work that will exist.
- Only a chunk straddling a tier boundary is drawn twice with in-shader rejection, and it is one chunk, not the world.
- Draw calls: about forty visible chunks at roughly 1.5 draws each is **~60**, inside §12's 120.

One more thing falls out of the order field for free. Strokes lie on top of each other and the later one must win;
with real height the depth buffer handles most of it, but two strokes laid flat in the same pass will z-fight.
**Give each stroke a height offset proportional to its order** — a few hundredths of a millimetre across the whole
sequence, far below the relief cap and invisible. The z-fighting goes away and the paint is then physically stacked in
the order it was laid, which is the thing the piece is about.

*Done. The Progress entry below carries the numbers; the short version is that the antisymmetric cue was tested
against its own null and found to be one, the symmetric cue turned out to be the ridge finder's selection bias, and
what ships is a geometric model that never reads a colour. The three LOD tiers are two: chunks and near/mid are
built and measured, and the far tier stays deferred with its trigger unchanged.*

**Exit criteria.**
- **Relief is calibrated and capped in millimetres, not in taste.** Van Gogh's heaviest impasto runs a few millimetres;
  the cap is measured against the raking-light or photometric-stereo images that exist for a handful of canvases, and
  then applied everywhere and never exceeded. §15 asks for exactly this and it is the difference between this piece and
  a projection show.
- ℓ agrees across the VGM scans, **or** the fallback is in place and the design's §4.1 step 6 is amended to say so.
- `?heights` shows relief following the paint, not the palette: no bright-yellow-on-dark stroke standing proud unless
  it is actually thick.
- **Close-up gate:** a 1:1 crop of the render beside a 1:1 crop of the scan. Does it look like oil?
- **Half-finished gate:** stop the scrub at 0.5. Does it look like an unfinished painting, or like a loading bar?
  This is §3.2's "image that sells the whole project" and if it fails, the underlayer is what is wrong.
- The M0a gate re-run, now with height.

---

## M2 — Order  *(1 week)*

**Scope.** The crossing solver of §4.3, which is the best idea in the design and the one most likely to return
nothing. Still one canvas, plus two others for cross-checking.

At each crossing of two traces, evidence for "A is above B" is gathered from the source at that point: A's colour
continuous across the intersection while B's shifts toward A's; A's ridge profile continuous while B's breaks; A's
edge crossing unbroken. Each edge carries a **confidence** from the margin between the two hypotheses. The confident
subgraph will contain cycles — extraction errors guarantee it — so it is resolved by approximate minimum feedback arc
set, then extended over the sparse remainder by the habits listed in §4.3.

**The validation, and it needs a control.** Hold out 20% of the confident edges, **by region rather than at random**
— a random hold-out leaks, because a topological order is globally coupled and a withheld crossing is half-implied by
the chain of crossings around it, which would flatter the solver. Withhold spatial blocks. Build the order on the
rest. Measure the fraction of held-out edges the resulting order satisfies. Chance is 50%. **But the number that matters is
the comparison against the heuristics alone** — because "thin and dark before thick and light" will already satisfy a
lot of held-out crossings on its own, and if the solver merely reproduces that, it has found no evidence in the paint
and §4.3's claim is not earned. So M2 reports two numbers, always together:

| | |
|---|---|
| solver vs held-out crossings | |
| heuristics alone vs **the same** held-out crossings | the control |

*Done, and split. The Progress entry below carries the numbers; the short version is that the kill criterion did not
fire and the exit criterion was met on two canvases of three. The design's pairwise reading of a crossing turned out
to be the wrong question — three quarters of crossings have a third mark on top of them — and asking instead which
of everything covering a point is visible there is what made the evidence usable.*

**Exit criteria.**
- Solver beats the heuristic control by **≥ 10 points**, on three canvases, one of which is not a landscape.
- **Kill criterion:** if the margin is under 5 points, the claim that the sequence is "derived from the painting
  itself" is **removed from `DESIGN.md` §4.3, from the first station's caption and from the README**, and the ordering
  is declared as what it then is: informed heuristic. This is written down in advance so that the decision is made by
  the number and not by how much we like the idea by then.
- Acts (§5.2) fall out of the order as named groups; the burst-and-hold structure is proposed from session counts per
  the compression note above, with the global constant fixed here.
- `?xray` at three τ values shows the sequence doing something legible — sky before land, highlights last.

---

## M3 — The first station  *(1.5–2 weeks)*

**Scope.** Station 4, *The Harvest*: the Reaper, *The Harvest (The Blue Cart)*, *The Sower*. The first time the piece
is a place rather than a canvas.

Ground strokes onto a heightfield, sky strokes onto a dome (the *lifted* treatment); the walk with weight, eye at
1.65 m, and the gait that tells the viewer they have a body; **the viewing volume** with an eased return at its
boundary; `stations/*.json` fixed as a schema — canvases, treatment, volume, acts, pacing, letter; blob streaming and
the scrub as a prefetch signal; the caption; the timeline band.

*Done, and the volume question fired. The Progress entry below carries the numbers; the short version is that the
horizon is measurable and the plane is not, so the station is built with one of those as evidence and the other
named as construction — and that a viewer who keeps walking lives at the edge of the volume the paint can justify.*

**Exit criteria.**
- Standing at the painter's position, the framing reads as *The Harvest* to someone who knows it.
- The scrub paints the station from bare canvas to finished with acts, bursts and holds, and nothing is rebuilt.
- **§15's open question, instrumented:** a tester who has not seen the design walks it while the runtime logs the
  fraction of walk-time spent within 0.5 m of the volume boundary. **Over 20% and the volume is wrong** — or the idea
  is, and we would rather learn that at M3 than at M6.
- `?noStrokes` renders essentially nothing (rule 2).
- §12's Balanced budget holds, or the table is revised here with the measurement that justifies it.

---

## M4 — Two stations and the transit  *(1.5 weeks)*

**Scope.** Station 8, Saint-Rémy — and it is chosen second deliberately, because it contains the summit of the piece
and the two things most likely to be hard: *The Starry Night* as a sky overhead with each spiral turning **along its
own curl** (a per-stroke rotation about its own arc centre, which is nothing like a scrolling texture and will be the
single most-scrutinised effect in the piece), and the *shelled* treatment with per-stroke depth. Plus **lie down**
(`Z`), the substrate change to jute, and τ as a global axis with the transit between stations.

Depth is hand-authored first. §15 is right that monocular depth estimation on a Van Gogh is outside the training
distribution of every model worth using; the estimate is a first draft at best and it is not on the critical path.

*Done, and the motion is real but not special. The Progress entry below carries the numbers; the short version is
that a stroke can be measured for how far it may slide along its own arc before the paint it lands on stops being a
colour it could have been traced from, that this beats sliding along the mirrored arc on every canvas by 1.4x to
2.1x, and that it beats sliding straight by 1.29x on the Starry Night and by 1.35x on a bed of irises -- so the
per-stroke amplitude is measured and DESIGN 4.5's "nothing like a scrolling texture" is not. The shell's own limit
comes out in closed form at **2.34 m**, which is smaller than the lifted plain's 6 m, so M3's open question got
worse rather than better.*

**Exit criteria.**
- Lie down under the Starry Night. This is the shot the piece is for.
- Spirals turn along their curl at per-stroke rates; at `?still` they freeze; nothing shimmers.
- The transit between stations 4 and 8 is continuous, and τ never jumps.
- Prefetch: entering a station never stalls the frame.
- The jute is visible at 8 and the finer canvas at 4, and nobody had to be told.

---

## M5 — Interiors  *(1.5 weeks)*

**Scope.** Station 5, the Yellow House. The *built* treatment: geometry recovered from the one-point perspective the
canvases already contain, with a small tool that takes the vanishing point and the frame and returns the room. **The
three Bedrooms occupying the same space**, so that walking forward changes the colour of the room without a cut — the
thing no gallery can do and the reason this station exists. The Sunflowers *present*, enormous and close.

**Exit criteria.**
- The Bedroom is the right proportions, checked against the canvas's own perspective, and you can stand in it.
- Walking the three versions reads as one room changing colour, not as three rooms.
- The strokes bound to built surfaces keep their canvas direction.
- It is warm. This is the only station whose exit criterion is a feeling, and the design is right that it should be.

---

## M6 — The arc  *(2–3 weeks)*

**Scope.** All ten stations roughed in, in order, everything walkable and nothing polished. Station 2's colour flood.
Station 9's widening frame as the canvases go double-square. Station 1's lamp, and its shortness.

**Exit criteria.**
- Scrub from τ=0 to τ=1 without leaving the piece. Dark → flood → yellow → night → stop → stars → green → end.
- The flood at station 2 lands as a shock, which is only possible if station 1 was dark enough and short enough.
- No station is longer than its material justifies.

---

## M7 — The voice and the brush  *(1 week)*

**Scope.** The letters (§9) and the sound (§10).

**Every quotation is verified against `vangoghletters.org` by letter number and date before it ships**, and cited in
`letters/`. Nothing goes in from memory, including the famous ones — he is among the most misquoted people in art. One
line per station, two at most.

The brush: a stroke laid has a sound, four thousand of them is a roar, and it comes from the direction the paint is
arriving from. Off by default behind one button.

**Exit criteria.**
- Every line traceable to a letter number, in the repository, checkable by a stranger.
- The DOM carries every quotation as text for a screen reader.
- With sound on, a burst is felt; when it ends, the silence is enormous.

---

## M8 — The two beats  *(1–2 weeks, and expect to redo them)*

**Scope.** Station 7 and stations 10–11. These get their own milestone because they carry the emotional load of the
piece and because they will be got wrong first.

Station 7: the painting stops mid-canvas, the brush cuts, the scrub refuses to advance for a beat. No ear, no blood,
no razor. **The restraint is the entire effect and it will be tempting to ruin.**

Stations 10–11: the rush with no holds, the crows — who have been in the corner of the eye since Arles — and then
nothing, held far too long.

**Exit criteria.**
- Station 7 tested on people who do not know the design. Too coy and it reads as a bug; too literal and the piece
  becomes a biopic. The design expects two failed attempts and so does this plan.
- The ending is something the viewer did, because the scrub is in their hand.
- The coda decision (§15) is made here: nothing, or the canvases in their museums. Current position is nothing, and
  the museum coda is the safer choice and the worse one.

---

## M9 — Polish, mobile, ship  *(1.5 weeks)*

**Scope.** Measured quality (never chosen — §12); touch; photo mode with the date in the filename; the accessibility
pass of §11; the performance pass against §12 on the dev Mac and one phone; the disclosure paragraph of §4.3 in the
README; `LICENSE`.

**Exit criteria.**
- §12 holds on Balanced and Rich on the dev Mac and Light on a phone at ≥ 30 fps, or the table is revised with the
  measurement that justifies it.
- Every control reachable by keyboard; the timeline is a real slider; caption and letter regions are `aria-live`.
- Someone who has never seen it can, with no instructions, scrub from primed canvas to 27 July 1890.
- **A screenshot of this cannot be mistaken for *Van Gogh Alive*.** §2 sets that test and it is the last one.

---

## What this adds up to

M0a through M9 as estimated above is **roughly 70 to 90 working days — three and a half to four and a half months
full time**, of which the first three days decide whether any of the rest is worth doing. That total belongs in the plan because a plan that
does not state it is a plan that gets believed. The two milestones most likely to run over are M6 (ten stations, and
the only real defence is that nothing in it is polished) and M8 (which the design already expects to get wrong twice).

---

## Deferred (with the trigger to re-open)

- **The far LOD tier (baked textures).** Correction 4 suggests everything visible fits at the near tier — but that
  rests on ~10,000 strokes per canvas, so **the trigger is M0b's measured count**, not a later milestone. Above ~25,000
  a station passes 100,000 strokes and the far tier comes back into M1 immediately. Otherwise re-open at M4 if one
  station is visible from another and costs more than 2 ms.
  *M0b measured 18,924 on the Reaper: the trigger fired and did not trip. Still deferred, and re-open at M4 as
  above. M1 built the chunk table and the near/mid tiers on top of it, and measured that **mid is never selected at
  one canvas** — a stroke stays above the threshold out to about forty metres. The machinery the far tier would need
  is therefore already in the blob and in the runtime; what is missing is a reason.*
  *M3 found the reason it will eventually need, and it is structural rather than a matter of counts: a lifted canvas
  puts every stroke back on the ray it came off the canvas on, so from the painter's position a stroke subtends
  exactly what it subtends on the canvas — about eight pixels, at the horizon and at your feet alike — and a
  screen-space threshold therefore demotes nothing at all from where the viewer starts. The LOD only begins to work
  once the viewer walks away from a wedge. Station 4 is 37,535 strokes and fits anyway; a station of four lifted
  canvases at 15,000 each will not, and that is where this comes back.*
- **Monocular depth estimation.** Hand-authored depth first. Re-open if M5's interiors need more shells than hand
  authoring can carry.
- **The other four Sunflowers.** One version at M5. The rest are a data file each once the pipeline is frozen.
- **Wheatfield with Crows' extraction.** Deferred to M8 by §14, once the pipeline is tuned, because it is the weakest
  source in the set (75 px/cm) and deserves the best version of the extractor rather than the first.
- **Committing the blobs.** Until M6 the blobs are gitignored build outputs, reproducible from `ref/` plus
  `params/`, because re-tuning forty canvases through git history is hundreds of megabytes of churn. From M6 a
  station's blobs are committed when that station is frozen.
- **Sound design beyond the brush.** Mistral, cicadas, rooks. After M7's brush exists at scale.

---

## The risk table

| | what kills it | the number that says so | milestone |
|---|---|---|---|
| The strokes do not read as Van Gogh | fragmentation, uniform width, or a wrong height field | the gate, and arc length 250–700 px | M0a |
| The residual carries the picture | the underlayer does the work and the ribbons are sprinkles | band-pass energy ratio < 0.6 | M0b |
| The stations do not sit on one colour footing | forty scans, twelve institutions, loose profile handling | station 2's flood survives a profile audit | M0b, M6 |
| Impasto is measuring colour, not relief | flat-field museum photography has erased the signal | ℓ scatters across the VGM scans | M1 — **it had** |

*That last row fired. The 24 VGM scans return a resultant of 0.029, which is inside the 0.020–0.058 the same
estimator gives on canvases with no light at all, and the same estimator recovers a real light to 0.7°. So the
signal is not weak, it is absent, and the milestone's declared fallback is what ships: a geometric relief model that
never reads a colour, whose variance explained by colour is 0.005 against 0.814 for the design's own estimate.*
| The order claim is unearned | the solver only reproduces "light over dark" | margin over heuristic control < 5 points | M2 — **it did not fire** |
*That row did not fire, and it did not clear either. The margin is +12.9, +11.4 and +6.8 on the Sower, the 1887
Self-Portrait and the Reaper: above the kill line everywhere and above the exit line on two of three. What the paint
turned out to buy is local order — two marks that touch, put the right way round; two marks a hand apart, not — and
the solved sequence still correlates 0.89 with the habits it started from. The claim stands and is now stated at
that size, in §4.3 and in the caption, rather than at the size the design first gave it.*

*M4 runs the same held-out audit on three canvases M2 never saw and re-runs it on the Harvest, so the row now rests
on six rather than three. Starry Night **+6.4**, Olive Grove **+6.3**, Getty Irises **+7.9**, the Harvest **+5.4** —
against the Sower's +13.0, the Self-Portrait's +11.4 and the Reaper's +6.8. Every one of the six is above the kill
line and two are above the exit line, which is the same verdict at twice the evidence, and the spread is a fact
about the canvases: the two that clear +10 are the two whose marks cross at every angle, and the four that sit near
+6 are fields of long nearly-parallel strokes where a crossing is shallow and the colour cue has less to work with.
The claim did not need revising. It needed to be tried somewhere it might have failed.*

| The volume reads as a rail | the viewer fights the boundary instead of looking | > 20% of walk-time within 0.5 m of it | M3 — **the instrument says yes**, M4 — **and it got worse** |

*The instrument is built and reads out; the tester is not, and a person is what the criterion actually asks for. What
it returns for three scripted ways of moving is 93%, 83% and 72% of the time within half a metre of the boundary —
because any walker with a net forward drift arrives at the edge and then stays there, which the metric counts as
pushing at it. Sweeping the volume's size says the amble would need a slab of **50 × 40 m** to come in under a fifth,
and the paint has thinned to a quarter of its own density by **6 metres** out. So the volume the canvas can justify
and the volume a walking body wants differ by about seven times in each direction. That is the open question of §15
answered as far as it can be without a person in the chair, and it is a real result rather than a missing feature:
either the volumes are much larger than the paint supports and the far field is thin, or the walk is not a free walk.
The decision belongs to M6, with these numbers in front of it.*

*M4 puts a second number beside it, from a treatment that fails differently. A shelled canvas does not thin, it
tears: two strokes that are neighbours on the canvas sit on almost the same ray, so stepping sideways by δ opens an
angle of δ|1/d₁ − 1/d₂| between them, and the paint has a hole in it when that exceeds what a stroke subtends. That
is one division per pair and no simulation. On the olive grove a twentieth of the neighbouring pairs have opened a
stroke-wide gap at **2.34 m**, a tenth at 3.4 m and a fifth at 5.4 m. The walkers at station 8 return 94%, 84% and
84%. So the three numbers now read: the paint justifies 2.3 m shelled and 6 m lifted, and an ambling body wants 50.
The gap did not close.*

| We drift into modelling Provence | the world stops being made of strokes | `?noStrokes` shows a scene | every |
| Station 1 loses the viewer | too dark, too long, and no reason to continue | tested at M6, not argued about before | M6 |

---

## Mapping to `DESIGN.md` §14

One resequencing and two splits. §14's M1 (the first station) and M2 (paint) are **swapped**; its M0 is **split**
into the gate (M0a), the pipeline behind it (M0b) and the order solver (M2), for the reason in rule 1: every station
is made of the same ribbons, and the two hardest unknowns in the whole project — whether relief can be recovered at all, and whether the crossing
evidence exists — are both answerable on one canvas without building a single place. Building a place first would mean
discovering them with a station's worth of work resting on top.

| §14 | here |
|---|---|
| 0 one canvas standing up | **M0a** the gate, one tile · **M0b** the pipeline, heuristic order |
| 2 paint | **M1** |
| — | **M2** order, split out of §14's 0 |
| 1 the first station | **M3** |
| 3 two stations and the transit | **M4** |
| 4 interiors | **M5** |
| 5 the arc | **M6** |
| 6 the voice and the brush | **M7** |
| 7 the two beats | **M8** |
| 8 polish | **M9** |

---

## Progress

### M0a — One tile, standing up

**Asked.** One 3072 px tile of *Wheatfield with a Reaper* — 25.6 cm of canvas at 120 px/cm — extracted by the
simplest extractor that could possibly work, packed, and rendered as lit ribbons with height in a page you can walk
into. Then the only question that mattered: does a field of fitted ribbons read as paint, or as noodles?

**The tile.** `params/reaper.json` names three regions that disagree with each other; M0a runs `gate`, at
(1100, 3600) — the reaper himself, the sheaves to his left, dense directional wheat, and bare weave showing between
them. Chosen by looking at the canvas, not by picking a corner. At 1:1 the paint there measures 60–90 px across for a
loaded stroke and about 25 px for the dark reed-pen contours, against canvas weave at ~9 px and brush-hair striation
at ~6 px — which set every smoothing scale in the file, because a filter below those two traces the cloth and the
hairs and calls them strokes.

**Built.** `tools/extract.py` (structure tensor at one scale, luminance ridges, a vectorised parallel streamline walk
that re-centres on the stroke each step, quadratic fit with chain splitting, median colour, width from the ridge's own
flanks), `tools/pack.py` (the 24-byte record, corrections 1–3 applied), `tools/flat.py` (orthographic reconstruction
from the packed bytes), and `index.html` (instanced ribbons, one `ShaderMaterial`, the scrub as one uniform, walk with
weight, and the failure path in text). Every number lives in `params/reaper.json`; nothing is tuned by editing Python.

**Verified.** All four exit criteria pass, on a clean run from an empty `strokes/`:

| | measured | target |
|---|---|---|
| Strokes in the tile | **1425** | 300 – 1500 |
| Mean traced arc length | **376 px** as traced, **304 px** per fitted arc = 25.4 mm | 250 – 700 px |
| Coverage | **88.9%** | ≥ 75% |
| Extraction wall time | **17 s** (20 s for extract → pack → flat) | ≤ 2 min |

Peak RSS 1.0 GB. The blob is 33.6 KB. The runtime draws it in **2 draw calls and 34.2 k triangles**, and `?still`
twice produces byte-identical PNGs, so the seed holds. `?noStrokes` renders an empty rectangle of bare canvas and
nothing else, which is rule 2 passing on the only milestone where passing it is easy.

**Colour agrees end to end**, which is the check that says the packed record is not lying. Mean RGB over the tile:

| | R | G | B |
|---|---|---|---|
| the scan | 187.2 | 151.4 | 76.2 |
| `tools/flat.py`, from the blob | 192.3 | 161.8 | 78.1 |
| the runtime under `?flat` | 185.9 | 153.7 | 70.6 |

Lit, over the same rectangle, it comes out about a tenth darker than flat — which is what lighting does, and most of
that tenth is the 11% of bare ground that flat and lit both show but only lit puts in shadow.

**Nine things were wrong, and the useful ones were wrong in ways worth writing down.**

1. **A ridge-sign termination killed a third of all traces.** I had the tracer stop when the ridge's curvature flipped
   sign. A wide loaded stroke is a *plateau*, not a crest — its centre has no curvature to speak of and the sign there
   is noise. §4.1 step 4 lists four termination conditions and this is not among them; the design was right and the
   extra condition was mine. Removed.
2. **The orientation field's own jitter read as curvature.** At a 6 px step the tensor wobbles enough to trip a
   67 px-radius turn limit on a dead straight stroke. The step direction is now blended with the direction the trace
   was already going, so the limit measures bend rather than noise.
3. **The width measure collapsed to 1.7 mm.** Half-prominence against the nearest local minimum falls apart whenever
   the trace sits on a stroke's shoulder rather than its exact crest, which on wide paint is most of the time. It now
   walks out to the shadowed gap on either side — the same thing the eye uses — and lands at 8.3 mm against the
   7 mm the plan estimated.
4. **The overlap merge was iterating traces it had already rejected**, so stubs and shadows came back in and the merge
   removed almost nothing. This is the M0a-sized rehearsal of the bug M0b's exit criteria are watching for.
5. **The colour median band was 70% of the stroke width**, so every median ate its neighbour and the palette
   collapsed toward its own mean: stroke-to-stroke lightness spread 0.049 against the scan's 0.109. This is exactly
   the "mud" in M0a's diagnosis list, and it is the one failure I would not have identified without the list.
   Narrowing the band to 0.12 recovers it to 0.073, and the rest of that gap is *within*-stroke variation that the
   relief is supposed to carry, not the flat colour.
6. **Crests and troughs were competing for the same seeds**, so a loaded impasto ridge suppressed the dark contour
   lying against it — and on this canvas those contours *are* the figure. Seeding the two polarities separately
   brought the reaper back and took coverage from 78.8% to 88.9%.
7. **Dark traces were following the shadows between strokes.** A trough in luminance is a stroke or a gap, and the
   difference is chroma: his contour here is blue laid on yellow, the gap is the same yellow with less light on it.
   A trough is now kept only if its colour differs from the paint on both flanks. 71 traces dropped.
8. **The hard arc cap was not being enforced.** The walk counted steps, and re-centring moves a trace sideways as
   well as forward, so a 6 px step can lay down 19 px of polyline: marks were reaching 1300 px against a 1024 px cap.
   It now accumulates the path it actually walks, and the longest mark in the tile is 1022 px. This is the one to
   care about, because that cap is what has to clear M0b's tile overlap — an unenforced cap means every long sky
   stroke at station 8 acquires a seam, and it is found there, a milestone and a half from here, by looking.
9. **Correction 5: the stroke record as §4.2 lists it cannot be bound as an attribute buffer.** Field order puts
   `order` at byte 17 and `depth` at 21; WebGL requires a u16 or f16 attribute to begin at an even offset. Same
   fields, same 24 bytes, reordered so `order` sits at 20 and `depth` at 22. The design is patched. This is the only
   one of the nine that could have been caught by reading, and it wasn't.

**And one that only the harness could have found.** Every ribbon was wound clockwise seen from the front, so all of
them were back-facing, and the shader dutifully flipped the normal and lit the whole tile with ambient alone. `?flat`
ignores normals, so the flat view was *correct* while the lit view was 35% dark — and it was the disagreement between
the two, not either one alone, that pointed at the winding. This is the case BUILD.md argued `?flat` would earn its
place on, arriving one milestone earlier than the hook was scheduled.

**The gate.** Standing in it: **it reads as paint.** Not fur — the marks are long and coherent, and the traced arc
sits where the paint does. Not spaghetti — the widths genuinely vary, slabs beside contours. Not mud — the palette
survived once the median band was narrowed. At the distance where a stroke subtends what it would at arm's length
from the real canvas, the wheat has his character: the curls turn the right way, the sheaves sweep, and the figure
holds.

It does read somewhat **plastic**, and that is the fourth diagnosis, expected, and already assigned. The height field
here is §4.1 step 6's luminance-above-a-wide-neighbourhood estimate, which M1 exists to replace, and `?heights`
false-colours it into an obviously speckled mess — relief does not look like that. **M0a passes provisionally on
relief, with the gate to be re-run at M1**, exactly as this plan allowed for.

**Still visible, and left visible.**

- **11% of the tile is bare.** The uncovered passages are the plateau strokes — a slab of one loaded colour beside
  another at the same value, invisible to a luminance ridge. That is the case §4.1 step 3 puts chroma ridges in for,
  and it is M0b's. No width was inflated to hide it.
- **The ground under the strokes is one flat measured tone** (the mean of the darkest tenth of the tile, which is
  what actually shows between ridges). The residual underlayer is M0b's.
- **The canvas edge is the scan's edge.** The scan carries a few pixels of margin beyond the stretcher. It does not
  matter for an interior tile and it will matter for whole-canvas coordinates, so M0b needs a canvas-edge step.
- **Frame cost is 15.1 ms at 2800 × 1800 headless**, which is a soft number: it is an EMA that includes shader
  compile, taken through ANGLE with no display attached. It is fill, not geometry — 34.7 k triangles is nothing. M0b
  owns the real measurement.

**One finding that belongs to a later milestone, recorded now because it was cheap to get.** The risk table wants
station 2's flood to survive a profile audit. It has now had one: **31 of the 40 scans carry no embedded ICC profile
at all**, including all 24 from the Van Gogh Museum, and of the nine that do, two are Adobe RGB (1998) and two are
Apple's Generic RGB at gamma 1.8. Both sides of station 2's flood are profile-less, so both must be *assumed* sRGB —
a guess, now written down as one in `paintings/CREDITS.md` rather than made silently in M6.

**Not started, per scope:** `git init`, the harness in full, tiling and the overlap merge, chroma ridges, the residual
layer, the order solver, LOD, and any station. `?flat`, `?still`, `?xray`, `?heights`, `?noStrokes`, `?debug`,
`?tau`, `?cam` and `window.vg` exist because M0a could not be checked without them; the rest of M0b's harness does
not.

### M0b — The pipeline and the harness

**Asked.** The machinery the gate proved worth building: `git init`, the harness in full, `tools/make.py` and the
params discipline, the tiled extractor with its overlap merge over the whole Reaper, chroma ridges, the residual
underlayer, colour management, the golden image, and station 0.

**Verified.** All seven exit criteria pass, on a clean run of the whole canvas:

| | measured | target |
|---|---|---|
| Stroke count, whole canvas | **18,924** | 5 k – 25 k |
| Band-pass energy at stroke scale, strokes ÷ source | **0.95** | ≥ 0.60 |
| Flat reconstruction at 1200 px | the painting, unmistakably | recognisably the painting |
| Flat reconstruction at 1:1 | ribbons with his sweep and curl | recognisably paint |
| Extraction wall time, whole canvas | **5 min 36 s** | ≤ 20 min |
| Peak RSS | **2.1 GB** | ≤ 6 GB |
| Tile seams | see below | invisible; no duplicates in an overlap; no chain broken |

20 tiles of 3072 px stepping 2048, exactly as this plan's arithmetic predicted. 14,985 traces merge to 10,853 marks
and fit to 18,924 strokes at 1.74 arcs a mark. Mean mark **452 px = 37.6 mm** against correction 4's estimate of
35 mm; median width **69 px = 5.7 mm** against its 7 mm; longest mark 1024 px, which is the cap, held. Coverage
91.7%. The blob is 444 KB and the underlayer a 696 × 550 PNG beside it.

**The seams have a number and a control, because a number alone would not mean anything.** Marks end everywhere, so
"2,089 marks end near a tile boundary" says nothing until you know what that count looks like when nothing is wrong.
Against 200 sets of arbitrary interior lines: **1,906 against 1,789 ± 150, z = +0.78.** Inside the spread. And
duplicates near a boundary: **157, against 165 expected** if boundaries were not special — slightly fewer, not more.
The merge does its job.

**The runtime, measured properly for the first time.** 60 fps at 2× DPR, and the honest part is what that cost:

| | |
|---|---|
| GPU time, 2560 × 1440 at 2× DPR | **5.3 ms** of a 16.7 ms budget |
| CPU submit | 1.1 – 2.4 ms |
| Draw calls · triangles | **3 · 757 k** |

**M0a guessed the frame was fill and not geometry, and that is confirmed, but not where it expected.** `?noStrokes`
— everything except the strokes — costs *more* than the full canvas: 6.3 ms against 6.0, because without ribbons in
front of it every pixel of the substrate runs its full shader. The strokes are nearly free; the cloth they lie on is
the frame. Skipping the weave where both its fades have already killed it took `?noStrokes` to 4.2 ms.

**Colour agrees end to end, which is what says the packed record is not lying.** Mean RGB over the canvas:

| | R | G | B |
|---|---|---|---|
| the scan | 177.4 | 162.0 | 91.8 |
| `tools/flat.py`, from the blob | 182.1 | 166.8 | 92.9 |
| the runtime under `?flat` | 180.0 | 164.6 | 91.9 |

RMS between the two reconstructions is **0.047**; each against the scan is 0.083. The two rasterisers agree with each
other about twice as closely as either agrees with the painting, which is exactly the shape this hook was argued for.
`?still` twice gives byte-identical PNGs.

**Ten things were wrong. The ones worth writing down:**

1. **Chroma ridges, taken as the union DESIGN §4.1 step 3 asks for, find the same stroke three times.** Measured on
   the gate tile: **99% of chroma traces ran within one stroke width of a luminance trace**, the three channels had
   the same mean colour and width and arc as each other, and together they nearly tripled the stroke count to buy
   2.3 points of coverage. The operative clause in the design is *"invisible to a luminance ridge filter"* — so a
   chroma seed is now refused within half a stroke width of a luminance ridge. On this canvas that is 61 traces
   instead of 3,266. On a canvas where blue meets green at the same value it will be most of them, and the mechanism
   does not change; only the arithmetic does.
2. **The merge stamped its claim at nine points across the stroke, whatever the stroke's width.** Across 100 px of
   paint that is 12 px gaps, and a near-parallel duplicate lying in a gap registers no hit and is kept. With one
   ridge field this merely under-merged and M0a never saw it. With three fields finding the same stroke three times,
   the tile came out with three of everything.
3. **The strokes were half as wide again as the paint.** M0a measured 8.3 mm and never looked at 1:1. Drawing each
   fitted footprint on the scan shows the outlines straddling two and three neighbouring marks, and the
   reconstruction at 1:1 is fat lozenges rather than ribbons. `width_gap_frac` 0.72 → 0.50 puts the outlines on the
   marks and the median at 5.7 mm.
4. **The instrument was wrong before the data was.** The flat rasteriser feathered every edge by 35% of the stroke's
   half-width, which on a 105 px stroke at 1:1 is an 18 px blur on each side — the first 1:1 reconstruction looked
   like smeared blobs and every bit of that was one line of the renderer. Nothing about widths could be judged until
   it was fixed.
5. **The band-pass ratio was measuring the holes.** Compositing the reconstruction over black turns every uncovered
   pixel into the highest-contrast edge on the canvas: the ratio read 4.07. Over the underlayer, which is what the
   runtime actually draws, it reads 0.95.
6. **A seam excess made of arithmetic.** The duplicate test counted a stroke as "near a boundary" if *either* end
   was, and took the expectation from start points alone — which doubles the denominator and manufactures a 1.7×
   excess out of nothing. It very nearly went into this log as a defect of the merge.
7. **Two tiles could each keep a maximum a pixel from the other's.** Seed suppression was masked to the tile's core
   *before* it ran, so a peak just inside a core boundary and one just outside never suppressed each other and both
   tiles traced the same stroke. Suppression now runs over the core dilated by its own radius and only then drops
   what belongs to the neighbour. Duplicates at boundaries went from 2.2× the canvas rate to level with it.
8. **The canvas-edge detector cropped 503 px of sky off the church at Auvers** — 11% of that painting, all of it
   paint. Quiet is not enough of a test, because a dark passage is quiet too. **A margin ends and a sky continues:**
   the activity steps at a real boundary and ramps across a dark passage. With that test, 2 of the 40 scans carry a
   margin and the church is not one of them.
9. **The underlayer was upside down.** three.js flips an image on upload and the shader flipped it again, so the sky
   sat under the wheat. This is the flipped-V case this plan named when it argued for `?flat`, arriving in the one
   milestone where the hook could not catch it, because both views take the texture from the same place.
10. **Holding each tile so colour could be sampled after the merge is 3.6 GB** against a 6 GB ceiling. Colour now
    comes off the memory-mapped canvas at fitting time and height from a canvas-wide field computed in bands — which
    also removed the last thing that was still being computed per tile and could therefore differ across a boundary.

**Two things are calibrated once for the canvas rather than per tile, and both are seams if they are not.** The seed
strength threshold, because a percentile asks each tile what counts as a stroke *here*, so a tile of sky and a tile of
wheat disagree and the disagreement lands exactly on the line between them. And the wide blur under the height
estimate, where σ is 140 px and a tile invents 420 px in from each of its own edges.

**The overlap merge does one job, not two.** This plan expected it to deduplicate *and* re-chain traces cut by a
boundary. It does not have to re-chain, because the cores that own the seeding partition the canvas at the midpoints
of the overlaps, which puts every core at least half the hard arc cap in from its own tile's edges — so a trace
seeded anywhere in a core can walk its full length in both directions without ever reaching a tile edge. Truncation
is not repaired; it cannot happen. That rests entirely on the cap being enforced, which is M0a's bug 8, and it is the
second time that bug has turned out to be load-bearing.

**Station 0 stands, and it is the loading screen.** White, woven, one charcoal line on the ground going forward, and
the underdrawing ghost — the 439 strokes the extraction flagged as contour and put earliest, drawn thin and flat and
charcoal before they arrive. It is built before anything is fetched and the painting is hung into it, rather than the
other way round, which is what §7 means by the wait being the thesis. The ground wash at τ = 0 is the underlayer
sampled at a coarse mip, so it is one tone rather than a legible composition; the bias falls to zero as the paint
arrives, and the ground *resolves* into the tonal map underneath instead of the picture being readable before a
stroke has been laid.

**Correction 4 is settled.** 18,924 strokes for a canvas, against the design's "thirty to eighty thousand". Twenty
canvases is roughly 380,000 strokes for the whole piece, and the largest station will be well under 100,000 — so
everything visible fits at the near tier and **the far LOD tier stays deferred**, its trigger having fired and not
tripped.

**Still visible, and left visible.**

- **8% of the canvas is bare.** With the widths corrected the strokes no longer paper over the gaps between marks,
  and what is left uncovered is mostly real: the shadowed cloth between ridges, which the underlayer now supplies.
- **9.4% of strokes are near-duplicates of another stroke**, canvas-wide and not at boundaries — the merge's own
  tolerance rather than a tiling artifact. It costs about a tenth of the geometry and nothing visible.
- **The height field is still the design's known-wrong estimate**, method 0 in the blob, and `?heights` still shows
  it as a speckled mess. M1.
- **The order is still the heuristic**, thin and dark before thick and light. The caption says so. M2.
- **`?station`, `?volume` and `vg.station()` are recognised and refuse**, in the console and in the `?debug` readout,
  because there is nothing to answer with until M3. A hook that silently does nothing is worse than one that is
  missing.

**Not started, per scope:** M1's cross-profile height, M2's order solver, the LOD tiers, any station past 0, the
transit, interiors, the voice, sound, mobile.

---

### M1 — Paint

**Asked.** The impasto height, which the design calls its own weakest link; the underlayer beneath the ribbons; the
canvas weave with the parameters that let it roughen into jute; and the LOD tiers.

**The headline is a negative result with a number attached, and it is worth more than the positive one would have
been.** DESIGN §4.1 step 6 derives height from local luminance above a wide neighbourhood. False-colour that field
over the Reaper and you can read the composition in it, sheaf by sheaf: **81% of its variance is explained by the
stroke's own colour alone.** It is a picture of the palette.

So M1 tried the physics the plan specifies — the cross-profile of the stroke, sampled perpendicular to its own
direction, with its two cues. And the plan's own test is the one that settles it.

| the antisymmetric cue | resultant R | direction |
|---|---|---|
| 24 Van Gogh Museum scans, one rig | median **0.029** | scattered, circular sd 72° |
| five synthetic canvases with **no light at all**, contrast matched to the Reaper | 0.020 – 0.058 | scattered |
| the same synthetic under one lamp at 45°, tan(incidence) 1.0 | 0.223 | recovered to **0.7°** |
| tan(incidence) 0.30 | 0.028 | 45° out |
| tan(incidence) ≤ 0.10 | at or below the null | random |

**The museum's canvases are indistinguishable from unlit ones**, and the method demonstrably works when there is
something to find. That is a sharper answer than the plan's "ℓ scatters": we know the estimator is sound, we know
its threshold, and we know the rig sits at least twenty times below it. Flat-field photography is built to kill
relief shadows and on this evidence it has done it. `tools/light_audit.py --synthetic` runs the control.

**The symmetric cue fails differently and worse, and only a polarity split shows it.** It is not weak — 2.3% deep at
the feet of a bright ridge — but split by polarity it is **+2.33% on bright ridges and −2.01% on dark ones**, near
perfectly opposite. That is the ridge finder's own selection: a bright ridge is chosen *because* its neighbours are
lower. The polarity-independent half, which is the only part that could be relief, is 0.16%.

**What ships is a model, and it is labelled as one.** A stroke stands as high as the film it lays down, which goes
with its width, plus the paint it was laid on, which the raster sums as it draws. Both terms are geometry and
neither reads a colour. The two exponents are set against the one anchor here that is physical: the height-to-width
aspect of a paint ridge, ordinary brushed oil near 0.03–0.05 and loaded impasto 0.15–0.25.

Paint **adds**. The first version multiplied the two terms, which gives a big isolated loaded mark almost no height
at all because nothing crosses it — and on this canvas that is the sheaves.

**Exit criteria.**

| | measured | target |
|---|---|---|
| `?heights` follows the paint, not the palette | **variance explained by colour: 0.005**, against 0.814 for the design's estimate | no bright-on-dark stroke proud unless thick |
| Relief capped in millimetres, applied everywhere | 1.25 mm cap, 0.54 mm mean, never exceeded, in the header | calibrated, not taste |
| ℓ agrees across the VGM scans, **or** the fallback is in place and §4.1 step 6 amended | fallback, and the design is patched with the numbers | either |
| Close-up gate: 1:1 crop beside the scan | it reads as loaded, furrowed paint | does it look like oil? |
| Half-finished gate at τ = 0.5 | an unfinished painting, ground and sky laid in, wheat half built | not a loading bar |
| The M0a gate re-run, now with height | passes; the "plastic" diagnosis M0a left open is closed | — |
| 60 fps at 2× DPR | **60 fps, GPU 8.1 ms of 16.7**, 10 draws, 2.50 M triangles | 60 fps |

**The millimetre cap is the weakest number in this milestone and it should be read as such.** The criterion asks for
it to be measured against raking-light or photometric-stereo images, and **no scan in this set carries any** — all
forty are flat-field colour photographs. So the cap is set so the relief field's *range* matches the one published
scan of Van Gogh-style impasto this build could check: 1.1 mm peak-to-valley at 25 µm in-plane
([arXiv:1910.10836](https://arxiv.org/abs/1910.10836)), on paintings made in his manner for that study rather than
on his own canvases. Better than taste, short of a measurement, and written into `params/reaper.json` as such. The
thing that would settle it is height data from the Van Gogh Museum's own 3D scanning, and the day it exists the cap
becomes one number in one file.

**The tiers are built and the far one is still deferred, both for measured reasons.** Chunks are fixed at pack time —
a median cut on the longer side until each holds ≤ 2,500 strokes, order-sorted inside — and the runtime frustum-culls
and picks a tier per chunk. WebGL 2 has no `baseInstance`, so a chunk is drawn by binding the same interleaved buffer
at an offset; no copy and no second upload.

| | strokes | triangles | GPU |
|---|---|---|---|
| whole canvas, standing back | 18,924 | 2.50 M | 8.1 ms |
| the scrub at τ = 0.30 | **5,677** | **749 k** | **5.1 ms** |
| at 1:1, four of eight chunks in frustum | 9,463 | 1.25 M | 2.2 ms |
| mid tier forced (`?midpx=99`) | 18,924 | 151 k | 1.5 ms |

**The scrub shortens the draw rather than hiding it**, which is what order-sorting inside a chunk buys. The mid tier
works and is **never selected at one canvas** — a stroke stays above the 5 px threshold out to about 42 m, which is
correction 4's prediction arriving in a different form. The far tier stays deferred; re-open at M4.

**M0b's "the substrate is the frame" no longer holds, and that is this milestone's doing.** `?noStrokes` costs
3.9 ms against the full canvas's 8.1. Seven columns and a furrowed shader moved the cost onto the paint, where it
should be. Rule 2 still passes: `?noStrokes` renders **4 triangles**.

**Colour still agrees end to end.** Scan 177.3 / 162.0 / 91.7, `tools/flat.py` 182.1 / 166.7 / 92.9, runtime `?flat`
178.3 / 162.5 / 90.2; RMS between the two rasterisers 0.051 against 0.047 at M0b. Extraction 5 min 26 s, peak RSS
2.0 GB, and the stroke count, seam z and band-pass ratio are unchanged from M0b to the digit — which is the point,
because M1 was not supposed to touch them.

**Twelve things were wrong. The ones worth writing down:**

1. **My own control had the Lambertian sign inverted.** The normal of a height field is (−∂z/∂x, −∂z/∂y, 1), and I
   lit the synthetic with the opposite sign — so the estimator came back *exactly* 180° out and looked broken. It
   was the one part of the experiment that could not be wrong and was.
2. **Crop overlap put a null result in a finding's clothes.** Eight random 1536 px crops of a canvas photographed at
   376 px/cm — which comes down to 1693 × 2300 at the working resolution — are eight views of nearly the same paint.
   The votes are correlated and the resultant sits well above its nominal chance level for no reason but the
   sampling. Non-overlapping crops took the museum's median R from **0.055 to 0.029**, which is half the apparent
   signal.
3. **And the chance level itself was nine times too low**, because nine stations along one 64 px run were counted as
   nine independent votes. One vote per ridge point.
4. **The profile walk ran on unsmoothed luminance** and terminated on canvas weave, so the window collapsed to its
   clamp on every stroke — the feet were "found" at 0.35 of the expected half-width everywhere.
5. **Three columns across the ribbon is a triangular prism.** M0a and M0b ran that way and it never showed, because
   their ribbons were nearly flat. Give a stroke real height and it is a tent with a ridge line down the middle and
   a silhouette made of straight edges — the "plastic" M0a's gate named and deferred to here.
6. **A specular lobe at exponent 120 never fires on a surface whose normal turns 19°.** The scan's brightest one
   percent sits at luma 208 and the render's at 165. What fixed it was not the lobe but the furrows.
7. **Furrows at amplitude 0.85 are corduroy.** A hair furrow is tens of microns deep on a half-millimetre pitch: it
   tilts the surface by about a tenth, not by half.
8. **And their fade cut them to a third of strength at seven pixels a furrow**, which is three times Nyquist and
   plainly resolvable.
9. **`?flat` fell to the mid tier in every frame**, because an orthographic camera has no `fov`, and NaN compares
   false. In the one mode whose entire job is to agree with `tools/flat.py` pixel for pixel.
10. **The flat golden is blind to relief.** M1 replaced the height field outright and the golden came back identical
    to five decimal places — correct, and exactly the blind spot. There are now two goldens, colour and relief.

**Still visible, and named rather than fixed.**

- **The mm scale is asserted, not measured.** Above.
- **At 1:1 the scan shows bare grey weave between the marks and the render shows a smooth ground.** The underlayer is
  a σ = 220 px field and cannot carry cloth; the weave shader can, but it is behind the paint rather than between it.
- **No craquelure, and no granularity within a colour.** Both are visible in a 1:1 scan and neither is in the record.
- **The relief field follows density**, so a passage worked over reads thick and an isolated thin drag reads thin.
  That is the model's claim and it is a claim, not a measurement.
- **The order is still the heuristic.** M2.

**Not started, per scope:** M2's order solver, the far LOD tier, any station past 0, the transit, interiors, the
voice, sound, mobile.

---

### M2 — Order

**Asked.** §4.3's crossing solver — "the best idea in the design and the one most likely to return nothing" — on
three canvases, one not a landscape, with the heuristics-alone control and the pre-registered kill criterion.

**It returned something, and the design's framing of it was wrong in a way worth more than the framing was.** The
design reads a crossing as a two-horse race: is the pixel A's colour or B's? On a canvas painted three and a half
times over, that question usually has no answer, because a third mark has since been laid across the crossing and
the pixel is neither of theirs. Measured on the Reaper, and against its own control:

| at a crossing of A and B | some third mark explains the pixel better | by |
|---|---|---|
| the real canvas | **74%** of crossings | 1.03 ΔE |
| the same canvas with the strokes' colours shuffled between them | 24% | −3.94 ΔE (worse) |

So the third mark is not noise to be vetoed. **It is the answer.** Every stroke whose footprint contains the point
is a candidate; the one whose colour the paint actually is was laid after all the others there; and one point yields
as many facts as there are marks stacked on it instead of one. That is what lifts the graph over the density at
which an order can propagate at all — and it uses the thing the extraction knows and a pairwise reading of the scan
does not, which is *every* mark on the canvas rather than these two.

**Three canvases, at constants fixed on the synthetic and then not touched.**

| | strokes | confident crossings | solver | habits alone | **margin** |
|---|---|---|---|---|---|
| *The Sower* — landscape, station 4 | 3,677 | 1,631 | 58.7% | 45.9% | **+12.9** |
| *Self-Portrait 1887* — not a landscape, station 2 | 3,588 | 1,925 | 53.2% | 41.8% | **+11.4** |
| *Wheatfield with a Reaper* — landscape, station 4 | 18,924 | 8,172 | 52.8% | 46.0% | **+6.8** |

**Two of three clear the bar and the third does not.** The kill criterion — under +5 points — is not triggered on
any canvas, so §4.3's claim survives; the exit criterion of +10 on three canvases is met on two. Both are recorded
as they fell rather than as either one alone.

**The margin is partly leakage and the test says so.** Withholding scattered blocks rather than a random fifth was
the design's idea and it was right; it is also not a cure, only a dial. On all three canvases the margin roughly
halves for every doubling of the block:

| block, in stroke lengths | 2 | 4 *(the size fixed in advance)* | 8 | 16 |
|---|---|---|---|---|
| Reaper | +13.3 | **+6.8** | +4.1 | +1.6 |
| Sower | +19.6 | **+12.9** | +6.1 | — |
| Self-Portrait | +18.6 | **+11.4** | +3.9 | — |

Read plainly: **the crossings recover local order and not global sequence.** Two marks that touch, the paint can
put in the right order. Two marks a hand's breadth apart, it mostly cannot, and what orders them is still the
habits. The solved sequence correlates **0.89** with the heuristic it started from on the Reaper (0.92 on the
Sower), and 31% of strokes moved more than a twentieth of the sequence. That is the honest description of what was
bought, and it is what the caption now says.

**The estimator was also run where the answer is known.** `tools/order.py --synthetic` paints strokes in a known
random permutation — opaque ribbons with rounded tops, on a mottled ground, with weave and scan noise, at the same
three-and-a-half-times overpaint the real canvas has — and then runs the whole pipeline against the truth:

- **the stacking facts are 92% right**, and the merged, thresholded edges 90–97% depending on where the threshold
  sits, which is what a calibrated confidence looks like;
- **only 33% of crossings are still visible** — the rest have been buried by a later mark — and of the visible ones
  the confident edges are **97% right**. The ceiling on this method is not the estimator, it is how much of the
  evidence still exists;
- the solved order agrees with the truth on **78.6%** of the crossings that are still visible, against the
  heuristic's 50% (the synthetic's truth is random, so 50 is where its control belongs);
- **and that same solver scores +6.0 on the held-out margin**, at the same block size and the same fold count the
  museum's canvases are scored with. A solver recovering four fifths of the recoverable truth returns six points.
  **The +10 bar was set without that conversion in hand**, and on this evidence it is above what the test returns
  for a near-ceiling solver on a canvas of this density. The synthetic is not the Reaper — its truth is random and
  its palette is eight well-separated hues — so this calibrates rather than excuses: the Sower's +12.9 and the
  Self-Portrait's +11.4 are *above* it, and the Reaper's +6.8 sits on it.

**The design's second cue failed its own control, and M1 explains why.** §4.3 lists ridge-profile continuity and
unbroken edges beside colour. Both are one measurement — a section across the stroke at the crossing, regressed on
the same section either side, which reads crest and both feet at once — and it is implemented, run and reported.
The test that decides it is not the exit number but the one measure of quality a real canvas offers without a
ground truth: **how much of a cue's own weight has to be cut to make its graph acyclic, against the same graph with
its arrows thrown at random.** A cue that is guessing produces a graph as cyclic as a random orientation of itself.

| | its own weight that is a cycle | with the arrows thrown | ratio | true accuracy, on the synthetic |
|---|---|---|---|---|
| stacking, Reaper | 0.2% | 5.9% | **30×** | — |
| stacking, synthetic | 0.43% | 15.7% | **36×** | 86% |
| profile, Reaper | 13.5% | 17.7% | **1.3×** | — |
| profile, synthetic | 7.5% | 14.8% | 2.0× | 60% |

The diagnostic reads correctly where the truth is known, and on the museum's canvases it says the profile cue is
barely distinguishable from a coin. **It ships at weight zero, and the decision was made by that table rather than
by the margin.** The reason connects straight back to M1: the profile cue reads *shape*, and M1 established there
is no raking light in these scans, so shape leaves no trace in the image. There is nothing there for it to read.

**The constant is fixed, and the piece is bigger than the plan assumed.** Stroke density came out at **2.75 strokes
per square centimetre**, within six percent across three canvases spanning three times the area and three stations
(2.79, 2.81, 2.65). That is a genuinely useful invariant, and it sizes the work off `CREDITS.md` directly: 12.93 m²
of canvas across the 26 scans whose dimensions are known, **356,000 strokes**, and about **550,000** pro rata across
all forty. The plan's 200,000 is low by 2.7×. At §5.2's 2,000-a-second burst that is **273 s of arrival**, so
arrival is a third of a fifteen-minute piece rather than the fifth the plan expected — and the plan's own
arithmetic there was wrong besides (200,000 at 2,000 a second is 100 seconds, not 200).

The compression constant follows from the measurement rather than from taste: the Reaper is 18,924 strokes and a
canvas of that size is something like ten hours of painting, so he worked at about **half a stroke a second** and
the constant is **4,000×**. The hold is *not* compressed by it — a night between sessions at 4,000× is eleven
seconds of nothing — so a hold is punctuation at a fixed 2.4 s and what the record supplies is how many there are,
not how long. Press space and the canvas paints itself: five bursts, four holds, about nineteen seconds.

**Acts fall out of the order rather than being drawn on the canvas.** The solved sequence is cut where cutting most
reduces the within-span scatter of what a stroke *is* — where it sits, how light, how wide, contour, highlight —
and each span is named by a rule over its own contents. The Reaper comes out *contour* 460, *land* 10,276, *subject*
4,160, *sky* 3,340, *light* 425 and a second *sky* of 263; the Sower *ground, land, subject, sky, light*. `?xray` paints one hue an
act, so a still at any τ shows what the order is doing instead of what the palette is doing.

**Exit criteria.**

| | measured | target |
|---|---|---|
| solver beats the heuristic control | **+12.9, +11.4, +6.8** | ≥ +10 on three canvases — **met on two** |
| one of them not a landscape | *Self-Portrait 1887*, +11.4 | — |
| kill criterion | not triggered on any canvas | < +5 removes the claim |
| acts fall out of the order as named groups | 4–5 acts a canvas, named by rule | — |
| the global compression constant fixed here | 4,000×, from a measured 2.75 strokes/cm² | — |
| `?xray` at three τ shows the sequence doing something legible | yes — contours first, then land, then subject | — |
| … *sky before land* | **no: it is land before sky**, and it comes from the habits, not the paint | — |
| 60 fps, and nothing else moved | 60 fps, GPU 8.0 ms, 10 draws, 2.50 M triangles; `?flat` parity RMS **0.050** against M1's 0.051; geometry, colour and height byte-identical to M1 | — |

**Eleven things that were wrong, and four of them were mine rather than the code's.**

1. **The design's crossing is the wrong event.** Extraction returns short fat arcs — a Reaper stroke is 3.3 times as
   long as it is wide — and two of those overlap constantly while their centrelines miss. 143,000 pairs share a
   bounding box; only 47,000 cross in the strict sense. The event is now the closest approach of the two
   centrelines, kept when the cores overlap, which is a strict generalisation: 61,000 events instead of 26,000.
2. **A pair whose votes cancelled became an edge pointing whichever way the indices ran.** With the profile cue at
   weight zero, every pair it alone had voted on merged to a net of exactly zero — and `net > 0` sent all thirty-nine
   thousand of them from the higher index to the lower. The solver then scored **45.6%** on held-out edges, below
   chance, which is the shape of a systematic bug rather than a weak signal.
3. **Withholding one contiguous fifth of the canvas is not a strict test, it is a broken one.** The strokes inside
   the withheld region then have no constraints left at all, so the solver is reduced to the prior there and the
   test can only return zero. It returned +0.0 on four folds of five, which looked exactly like a null result and
   was not one. Blocks, scattered, several stroke lengths across.
4. **A hinge loss does not propagate.** It stops pulling the moment an edge is satisfied, so the cheapest solution
   is every constraint met locally and nothing travelling further than one edge. Squared — a weighted Laplacian,
   solved by Jacobi sweeps — is worth a point and a half of agreement with the true order and six points of margin.
5. **Two clean samples either side of a crossing are not enough to find the stroke's own colour.** At 92% coverage a
   mark is crossed again a centimetre away, and a sample taken there is somebody else's paint. Four samples with the
   odd one out dropped, and the stroke's own median colour behind that.
6. **One pixel at the fitted intersection is one pixel, and the intersection is fitted.** Five points inside the
   overlap, medianed.
7. **The lattice sounded better than it measured.** A stacking fact needs no crossing at all, only a point where two
   marks are present, so sampling the whole canvas on a lattice should have found far more. On the synthetic it is a
   small gain. On all three museum canvases it is a loss, and the two exit-blind diagnostics agree about why: the
   consistency ratio falls from 30×, 44× and 24× to 16×, 20× and 10×, and repeated readings of one pair stop
   agreeing as often, 96% down to 92%. A lattice point has no crossing geometry near it, so its gate is scaled by
   the canvas-median noise instead of the neighbourhood's own. Reachable by `--lattice`, off, and the reason is in
   the source rather than in a commit message.
8. **My first synthetic canvas judged the estimator against unanswerable questions.** Two thirds of its crossings
   have since been buried, and scoring the cue on those made a 97%-accurate method look like a 72%-accurate one.
   The synthetic now records which stroke ended up visible at each point and reports both numbers.
9. **`ndarray.ptp` again** — removed in NumPy 2.0, and this file had inherited the call from `pack.py`.
10. **The venv.** The first background extraction ran under `/usr/bin/python3`, which has no NumPy, and reported
    success with exit code 0 because the failure was inside a pipeline.
11. **The solver read the habits out of the file it had just written them over.** `extract.py` puts the heuristic
    sequence in each stroke's `o` and `order.py` overwrites it, so running the solver twice measured the solver
    against itself: margin +0.0, correlation with the habits 1.00, and both look like findings rather than like a
    program with no fixed point. The habits are a function of the strokes, so they are recomputed from the strokes.

**Still visible, and named rather than fixed.**

- **The Reaper does not clear the bar.** +6.8 against +10, and it is the canvas the piece opens station 4 with. It
  is also the biggest and the most nearly monochrome — a wheatfield is one colour laid over itself thousands of
  times, which is precisely the case where "whose colour is this pixel" has least to say.
- **The global sweep of the sequence is still the habits**, at ρ = 0.89. The paint rearranges neighbours.
- **The reconstruction says land before sky**, which is the reverse of the design's expectation, and it says it
  because the heuristic puts light paint last, not because the crossings do. The crossings do not overturn it and
  do not confirm it.
- **Session counts are not in yet.** The number of holds is currently the number of act boundaries, which is a
  structure rather than a record. The letters are M3's job.
- **A pair that overlaps twice is read once**, at its squarest touch. Rare, and unmeasured.
- **The acts are named by a rule, and the rule is thresholds on y, contour and highlight fractions.** The boundaries
  are found; the names are asserted.

**Not started, per scope:** the far LOD tier, any station past 0, the transit, interiors, the voice, sound, mobile.

---

### M3 — The first station

**Asked.** Station 4, *The Harvest*: three canvases, ground strokes onto a heightfield and sky strokes onto a dome,
a walk with weight inside a declared viewing volume, `stations/*.json` fixed as a schema, blob streaming with the
scrub as the prefetch signal, a caption and a timeline band. And §15's open question instrumented: over a fifth of
walk-time spent within half a metre of the volume's boundary and the volume is wrong, or the idea is.

**The question this milestone actually turns on.** DESIGN 4.4 says ground strokes go onto a heightfield and sky
strokes onto a dome, which quietly assumes two things about a canvas: that there is a line where one becomes the
other, and that the ground behind that line recedes. Both are testable on the strokes, and `tools/place.py` is
written the way M1 wrote the light and M2 wrote the order — the estimator and the test that could refute it are the
same code, and two canvases that are not places are run through it as controls.

**One of the two is there.**

A horizon is not the strongest colour boundary on a canvas — every picture has one of those, including a face. It is
a boundary that is *horizontal*. So the same two-population split (Otsu's criterion in Lab, weighted by arc length)
is scanned across the rows and again down the columns, and what decides is the ratio between them:

| | strokes | best level cut | best upright cut | **ratio** | horizon | against shuffled colours |
|---|---|---|---|---|---|---|
| *The Harvest* | 14,934 | 1.062 | 0.015 | **71.8×** | v = 0.210 | 792× |
| *Wheatfield with a Reaper* | 18,924 | 1.001 | 0.026 | **38.9×** | v = 0.398 | 953× |
| *The Sower* | 3,677 | 1.367 | 0.123 | **11.1×** | v = 0.464 | 193× |
| *Self-Portrait 1887* — control | 3,588 | 0.504 | 0.211 | **2.4×** | — | 68× |
| *Irises*, Getty — control | 10,359 | 0.303 | 0.142 | **2.1×** | — | 144× |

The lines land where a person would put them: the base of the wall at the far side of the Reaper's wheatfield, the
Alpilles behind the Harvest, the edge of the ploughed field under the Sower's sun. **The pre-registered threshold was
2× and it was wrong** — both controls came back above it, and a bed of irises would have been called a plain by a
tenth. The controls are the only thing in the file that knows where the line goes, and they put it at **5×**, in the
gap between 2.4 and 11.1. That is a threshold set by two negative controls, which is two more than a threshold
usually gets and fewer than it deserves.

**The other one is not, and the shape of the nothing is the finding.** If a canvas encodes a receding plane then the
marks on it shrink with distance, so their apparent size falls to zero at the horizon and the fit's zero crossing is
a second, independent estimate of the same line. It was fitted. It returned this:

| | far bin | near bin | **observed** | a plane over that depth demands | γ if fitted | by arc |
|---|---|---|---|---|---|---|
| *The Harvest* | 75 px | 77 px | **×1.03** | ×34.0 | −0.09 [−0.11, −0.08] | −0.06 |
| *Reaper* | 70 px | 64 px | **×0.91** | ×26.2 | −0.02 [−0.03, −0.01] | +0.00 |
| *The Sower* | 93 px | 76 px | **×0.82** | ×23.7 | −0.10 [−0.13, −0.06] | −0.00 |
| *Self-Portrait* — control | 84 px | 80 px | ×0.96 | ×28.9 | −0.02 | −0.03 |
| *Irises* — control | 81 px | 86 px | ×1.06 | ×29.7 | −0.07 | −0.03 |

At 120 px/cm those far and near bins are 5.8 mm and 5.3 mm. **The brush does not know how far away anything is.**
Across the entire depth of the picture — from the paint at your feet to the far side of the plain — the marks vary by
under a fifth, and on two of three canvases they get *narrower* toward the viewer, which is the opposite of
foreshortening. The drift is real: on all three landscapes it beats a null built by permuting the strokes' heights on
the canvas, at the 0.00 percentile of 400 shuffles. It is real, negligible and pointing the wrong way, which is
exactly why the null was pre-registered as a percentile and exactly why a percentile is not enough on its own. And it
is not a floor artefact: 0% of far-field widths and 2% of far-field arcs sit on the parameter clip.

There is a confound and it is worth naming rather than hiding: a painter reaches for a smaller brush to paint the far
side of a field, and that produces the same gradient as optics. But the confound only matters when there *is* a
gradient, and there is not one.

**The one other place evidence for a plane could live is the drawing rather than the touch**, so the long ground
strokes were extended to the measured horizon and their crossings counted: parallel lines on a ground converge, and
where they converge is on the horizon. That fired on the Harvest and it does not survive its control:

| | long ground strokes | peak | shuffled | ratio |
|---|---|---|---|---|
| *The Harvest* | 2,032 | 0.104 | 0.086 | **1.21×** |
| *The Sower* | 364 | 0.151 | 0.139 | 1.09× |
| *Reaper* | 2,650 | 0.089 | 0.095 | 0.94× |
| *Self-Portrait* — control | 235 | 0.306 | 0.253 | **1.21×** |

A face converges on its own painted horizon exactly as hard as the plain of La Crau does. The test does not separate a
place from a portrait, so it is reported and not used.

**So the station is built with one measurement and one construction, and the piece says which is which.** The horizon
is evidence. The plane hung under it is not: it is built at γ = 1, which is what a plane *is*, rather than at a fitted
exponent, because there is no exponent to fit. The caption says so, in those terms, standing in front of it.

**The construction, and the one property that makes it honest.** The canvas is a window and a point on it is a ray
from where he stood. Above the horizon the ray runs to the dome; below it, it falls to the ground. **Every stroke
stays on its own ray** — γ says how far along the ray a stroke sits and never which ray it is on — so from the
painter's position the lifted world *is* the painting, by construction rather than by tuning. The exponent bends the
surface the ground lies on rather than moving the picture: at 1 it is flat, and as it falls the far field stands up
until at 0 the whole thing is a wall at one distance with the horizon painted on it, which is DESIGN 4.4's *present*
treatment arrived at from the other end.

Nothing in the geometry is a free constant except one. The scale of the world is the eye height of DESIGN 6 — 1.65 m
— and the measured horizon; standing that tall in front of that line is what puts the bottom edge of the canvas
where it goes. The free one is **hfov, how wide the canvas is taken to be from where he stood, and it is 50°**: a
painter at an easel looking at the whole canvas at once. Widen it and the plain runs closer and steeper.

| | horizon | near paint | far paint | the plain thins to a quarter |
|---|---|---|---|---|
| *The Harvest* | 0.210 | 4.7 m | 21 m | **6 m** |
| *Reaper* | 0.398 | 6.2 m | 27 m | **8 m** |
| *The Sower* | 0.464 | 7.1 m | 30 m | **9 m** |

The swell on top of the plane is invention on top of construction, and what makes it safe is *where it is applied*:
along the ray, so a stroke slides toward or away from the eye and never off the line it came in on. From the
standpoint the invented hill is therefore exactly invisible, and it only exists once the viewer walks.

**The station.** `stations/s04-harvest.json` fixes the schema — canvases, treatment, volume, ground, weave, pacing,
letter, caption — and station 4 fills it with three canvases in the order he painted them, standing at 0°, +68° and
−68° around one standpoint, on one continuous plain and under one dome. Treatment is `null` per canvas, meaning *take
what the measurement decided*; a string there overrides it and carries its reason. Stroke counts are cached in the
file and checked against the blob that arrives, which is what lets the scrub be a prefetch signal — the spans are
known before anything is fetched, so the station's timing does not shift under the viewer as the blobs land.

**And the station contains a canvas that does not belong to it, knowingly.** *Wheatfield with a Reaper* is
Saint-Rémy, September 1889 — by the chronology of DESIGN 7 it belongs at station 8, and DESIGN 8.2's own list for
station 4 asks for *Haystacks in Provence* instead. It is here because it is the canvas M0a, M1 and M2 were built and
measured on and because M3's scope names it. The `note` field in the station file says so, and the date readout on
the band says so at run time: the handle sits inside the June 1888 mark while the caption reads September 1889. It
will fight station 8 at M6, when τ becomes a chronology rather than a station-local scrub, and that is the milestone
to settle it in.

**Verified.**

| | measured | |
|---|---|---|
| The framing from the painter's position | *The Harvest*, whole, filling the view | exit criterion 1 |
| `?flat` parity against `tools/flat.py` | RMS **0.0472** | M2 0.050, M1 0.051, M0b 0.047 |
| Golden colour and relief, all three canvases | RMS **0.00000**, identical | geometry, colour and height did not move |
| `?still` twice | byte-identical PNG | seed 18531890 holds |
| Blobs streamed for the station | **0.89 MB** | ≤ 6 MB |
| The scrub as prefetch | nearest-to-τ first, spans fixed in advance | |
| Acts across the station | **15**, from the three canvases' own cuts | one hue sweep in `?xray` |
| The station paints itself | 18.8 s of arrival + 14 holds × 2.4 s = **52 s** | at M2's 4,000× |

§12's budget, measured at 1600 × 1113 from the standpoint with everything visible:

| | Light | Balanced | Rich | budget (L / B / R) |
|---|---|---|---|---|
| Strokes resident | 37,535 | 37,535 | 37,535 | 150 k / 400 k / 800 k ✓ |
| At the near tier | 32,805 | 32,805 | 32,805 | **20 k ✗** / 80 k ✓ / 180 k ✓ |
| Triangles | 0.49 M | **1.94 M** | 4.43 M | 0.8 M ✓ / **2.5 M ✓** / 5 M ✓ |
| Draw calls | 24 | 24 | 24 | 90 / 120 / 160 ✓ |
| GPU | 1.6 ms | 6.3 ms | 9.7 ms | of 16.7 ✓ |

Balanced holds, which is what the exit criterion asks. **The Light row for near-tier strokes is exceeded and the table
is revised here with the measurement that justifies it**: that row was written when a near-tier stroke was ~24
triangles, and the Light ribbon is now three segments by three columns, so 32,805 of them is 0.49 M triangles —
*less* than 20,000 cost when the number was set. The budget that matters is triangles, draws and frame time, and all
three hold with room. What cannot be fixed by tessellation is that the LOD never fires: a lifted canvas puts every
stroke back on its own ray, so from the standpoint a stroke subtends what it subtends on the canvas, and a
screen-space threshold demotes nothing. See Deferred.

**The volume, instrumented — and the criterion fired.** The instrument is what M3 owed and it is built: the runtime
logs walk-time, time within half a metre of the boundary, time outside it and the furthest excursion, and
`vg.volume()` returns them with a verdict. What it does not have is the tester, and a person is what the criterion
asks for. So three scripted walkers calibrate it instead — they are not that test and do not pretend to be:

| | within 0.5 m of the edge | outside it | furthest out |
|---|---|---|---|
| **forward** — hold W, never turn | 92.9% | 92.3% | 1.18 m |
| **look** — walk a few paces, stop, turn, look | 82.8% | 82.2% | 1.17 m |
| **wander** — an amble, new heading every few seconds | **72.0%** | 69.6% | 1.18 m |

Any walker with a net forward drift arrives at the boundary and then stays, and the metric counts standing there as
pushing at it. Sweeping the volume rather than arguing about it:

| slab, half-extents | 12 × 7 m | 20 × 14 m | 32 × 24 m | 50 × 40 m |
|---|---|---|---|---|
| the amble's time at the edge | 72.0% | 60.0% | 38.8% | **20.2%** |

**So the amble needs a hundred metres by eighty to come in under a fifth, and the paint has thinned to a quarter of
its own density by six metres out.** Those two numbers are the answer to §15's question as far as it can be answered
without a person: the volume a canvas can justify and the volume a walking body wants differ by about seven times in
each direction. Station 4 ships at 12 × 7 m — the depth measured from the thinning, the width chosen — with the
numbers above beside it, because sizing the volume to make the instrument look good is exactly the move the
instrument exists to catch. The decision belongs to M6.

**Rule 2.** `?noStrokes` renders the primed cloth of station 0 — a ground, a dome, and each canvas's own ground wash
laid into the world on the same rays its strokes are on. There is no modelled tree, roof or hill anywhere in it. It
is more than M1's canvas-on-a-wall showed, because a lifted wash fills the view rather than hanging in a rectangle,
and the number that says it cannot carry the picture is the band-pass ratio the extractor measures: **1.17 on the
Harvest, 0.95 on the Reaper, 1.16 on the Sower**, against a kill line of 0.6. The wash is a wash.

**Seven things were wrong, and five of them were the same kind of wrong.**

1. **The swell was sampled in each canvas's own frame.** A canvas is lifted about the standpoint and then its group is
   turned to face out of the ring, so the ground under the Sower was riding a hill rotated 68° away from the one the
   floor was riding. What that looks like is the floor coming up through the middle of the painting in a great smooth
   curve. Neither formula was wrong; they were in different rooms. The terrain now rotates its argument into world
   coordinates and everything — floor, cloth, strokes, and the body's own eye height — agrees by construction.
2. **A quad straddling the horizon has its top corners on the dome and its bottom corners on the ground.** One grid
   across the whole canvas therefore contains a row of enormous sheets standing across the middle distance, black
   because they face away. The canvas's cloth is now two meshes split exactly at the horizon.
3. **And then a hairline of void, ruled across the picture where the land meets the sky**, because everything past
   the dome is capped to the dome and the strip of canvas between the horizon and that cap stands up as a wall out
   there — which the mesh had no row for. The first row of the ground is now the horizon itself.
4. **The dome cap and the swell correction multiplied.** A point already pushed out to the cap was then scaled by
   (eye − height)/eye, and half a metre of swell against an eye at 1.65 m moves it between sixty and a hundred and
   twenty metres. Adjacent rows landed at wildly different distances and the sheet folded through itself. The swell
   now dies out past forty metres, where it was never doing any work.
5. **The floor and a lifted canvas's cloth are the same surface, tessellated differently**, and they interpenetrated.
   A polygon offset handles the near field, where the depth slope is what the factor term is for; at the horizon the
   surface is exactly edge-on and no offset can win, so the floor is put underneath, sinking six millimetres for every
   metre away. A quarter of a degree of grade against a metre of depth precision out there.
6. **The weave on the floor was reading x and y.** A hanging canvas is upright so its threads are x and y; a ground is
   not. One sine and a constant is not a weave, it is corduroy, and it never showed until M3 made the ground the thing
   you look at.
7. **The act list was rebuilt before it existed.** The first blob to land calls `rebuildActs`, and the prefetch reads
   the scrub to decide what to fetch next — both of them from above their own `let`. The station showed the "strokes
   did not load" panel with a temporal-dead-zone error in it, which is at least a page that says what happened.

**And one that was a bad measurement rather than a bug**, recorded because it will happen again: the `?flat` parity
first came back at **0.195** against M2's 0.050, which looks exactly like a broken renderer. `tools/shot.py --size`
sets the *window*, and headless Chrome's viewport comes out about 87 px shorter, so the orthographic frustum was
letterboxing the canvas and a tenth of the frame was black in one image and paint in the other. The renderer was
fine. Measured at a viewport that actually matches the canvas aspect it is 0.0472.

**Two things were tried and taken out, both for the same reason.** A ±4° tilt scan on the horizon, whose idea was
that a horizon a degree off level is a fact about how he stood: what it actually fitted was the diagonal of the
Alpilles, climbing to the edge of the search and dragging the Reaper's horizon 16% of the canvas up onto the hills. A
knob a mountain can turn is not measuring the easel. And the first `wander` walker, whose heading was a random walk
with no mean reversion: it spun, walked in tight circles near the origin and reported **0.0%** at the boundary —
a clean null that was entirely an artefact of the walker.

**Still visible, and named rather than fixed.**

- **The volume fails its own instrument** on every scripted walker, and the sweep says it would have to be seven
  times bigger in each direction to pass. Named above; the decision is M6's.
- **The Harvest's acts are lopsided.** M2's cutter gives it contour 1,156, subject 13,227, light 373, land 178 —
  one act holding 89% of the canvas, because several adjacent spans all earned the name *subject* and merged. Its
  arrival is one long burst with its punctuation in the wrong places. Changing the naming rule to make the pacing
  nicer is tuning the evidence to taste, so it stands.
- **The canvases have hard rectangular edges** where they meet the void, because that is what the edge of a painted
  region is. It is honest and it is startling.
- **A `present` canvas inside a station is implemented and unexercised** — all three of station 4's are lifted, and
  the only thing driving that path is `?blob` and `?flat`.
- **The letter is a citation and not a quotation.** `letter` carries the number, the recipient and the date; `text`
  is deliberately `null` until M7, which owns the voice and the verification against the Van Gogh Museum and Huygens
  edition. A quotation typed from memory is not a quotation.
- **The timeline's fill runs from the left edge of the ten years**, which reads as though 1880–1888 has been painted.
  τ is station-local until M4 makes it the global axis with the transits in it.
- **The Sower is 3,677 strokes over a whole plain** and it shows: lifted, its far field is nearly bare. The thinning
  number says 9 m and means it.

**Not started, per scope:** the far LOD tier, the shelled treatment and per-stroke depth, any other station, the
transit, interiors, the voice, sound, mobile, photo mode, the sound button.

---

### M4 — Two stations and the transit

**Asked.** Station 8, Saint-Rémy: *The Starry Night* as a sky overhead with each spiral turning along its own curl,
the *shelled* treatment with per-stroke depth, lie down, the substrate change to jute, and τ as a global axis with
the transit between stations 4 and 8.

**The question this milestone actually turns on.** DESIGN 4.5 gives the piece exactly one moving thing and describes
it in one sentence: *the Starry Night spirals turn along their own curl, each at its own rate, which is a per-stroke
rotation about its arc centre and nothing like a scrolling texture.* Every clause of that is a claim about the
canvas rather than about the renderer, and `tools/curl.py` is written the way M1 wrote the light, M2 the order and
M3 the place — the thing that makes the effect and the thing that could refute it are the same code, and canvases
that are not vortices go through it as controls.

**The measurement.** A stroke is already a quadratic through three points, so the circle through its two ends and
its own midpoint gives a centre, a radius and a total turn for nothing. Slide the stroke along that circle and
sample the scan underneath: as long as the colour it lands on is a colour it could have been traced from, the
picture survives the motion. So the question *how far may this stroke move* has an answer in millimetres, per
stroke, and the threshold is not a new number — it is the extractor's own `de_max`, the tolerance the tracer used to
decide that a piece of paint belonged to this stroke in the first place. The same slide is then run two more ways:
along the arc **mirrored** through the stroke's midpoint, which is the same radius and the same speed and the wrong
curl, and straight along the **tangent**, which is a scrolling texture.

| | strokes | turn ≥ 0.25 | **arc** | mirror | tangent | **arc / tangent** | arc / mirror |
|---|---|---|---|---|---|---|---|
| *The Starry Night* | 13,999 | 11,461 | 0.29 | 0.16 | 0.22 | **1.29×** | 1.78× |
| *Olive Grove* | 20,734 | 17,518 | 0.66 | 0.33 | 0.47 | **1.38×** | 2.00× |
| *Irises*, Getty — control | 10,359 | 8,340 | 0.45 | 0.22 | 0.33 | **1.35×** | 2.05× |
| *Wheatfield with a Reaper* — control | 18,924 | 16,518 | 0.47 | 0.27 | 0.36 | **1.29×** | 1.72× |
| *Self-Portrait 1887* — control | 3,588 | 3,166 | 0.97 | 0.59 | 0.79 | **1.23×** | 1.65× |
| *The Harvest* — control | 14,934 | 12,320 | 0.72 | 0.47 | 0.63 | **1.15×** | 1.53× |
| *The Sower* — control | 3,677 | 3,141 | 0.61 | 0.43 | 0.54 | **1.13×** | 1.43× |

Lengths are in the stroke's own length: 0.29 means a mark may slide by 29% of itself before the paint it is standing
on stops being paint it could have come from.

**Half the sentence is true and it is not the half the design leans on.** The pre-registered bar was 1.3× over the
tangent among strokes that actually turn, with the prediction that the ratio should *grow* with the turn. The
prediction holds cleanly — on the Starry Night the ratio runs 1.01, 0.99, 1.14, 1.25, **1.33** across bins of
increasing turn, and a mark that barely bends cannot tell its arc from its tangent, exactly as it should not be able
to. The bar does not. The Starry Night comes in at **1.29×**, a hundredth under it, and **a bed of irises clears it
at 1.35×** — as does the olive grove at 1.38×. So the tangent comparison separates nothing: sliding a curved stroke
along its own curve beats sliding it straight on every canvas of curved strokes, and the vortices do it *less* than
the flowers do.

**What does separate is the mirror.** Every canvas breaks 1.4× to 2.1× sooner along the arc curving the wrong way,
and there the Starry Night sits mid-table too. The reading that survives all seven rows is: **the curl is real and
it is not special to this canvas.** Van Gogh's mark-making is locally coherent everywhere, so a stroke's own
continuation is where its own colour is, and the swirls of the Starry Night are a *composition* out of that habit
rather than a different local statistic. The second structural test says the same thing from another direction —
whether neighbouring curved strokes agree about where the centre is, against a null that permutes which stroke got
which curvature — and it returns 2.04× on the Starry Night against 2.19× on the irises, 2.01× on the Harvest and
2.35× on the Sower. There is no measurable sense in which this sky's strokes agree about centres more than any
other canvas's do.

**One number does come out of it that is worth having, and it is the one the runtime uses.** The Starry Night has
the *shortest* coherence length in the set: 0.29 of a stroke against 0.45 for the irises and 0.97 for the
self-portrait. The sky that looks like it is moving is the one whose paint can move least, because it is the most
crowded. So the amplitude is per stroke, measured, and packed in byte 19 of the record; a mark in the middle of a
vortex barely moves and a long lazy one in the open sky moves further, and neither number was chosen. What is
invention is the rate, and there is no version of this where it is not: **there is no time in a painting.** It is
one number in the station file and it says so.

**The shelled treatment, and how far you can walk before it tears.** DESIGN 4.4 says a shell is *convincing for a
few metres of movement, grotesque beyond that*, and how many metres is a measurement. Two strokes that are
neighbours on the canvas sit on almost the same ray, so from the painter's position they touch; put them at depths
d₁ and d₂, step sideways by δ, and the angle between them opens by δ|1/d₁ − 1/d₂| while a stroke still subtends
what it subtends. The paint has a hole in it when the first exceeds the second, so every neighbouring pair has a
tear distance and it is one division. No simulation, no sampling, and the only judgement in it is how much tearing
is too much.

| torn pairs | 1% | 2% | **5%** | 10% | 20% | 40% |
|---|---|---|---|---|---|---|
| the step that does it | 1.27 m | 1.60 m | **2.34 m** | 3.38 m | 5.41 m | 11.62 m |

**So M3's open question got worse, not better.** The lifted plain of station 4 thins to a quarter of its density by
6 m. A shell tears at **2.3 m**. Three scripted walkers at station 8 spend 94%, 84% and 84% of their time within
half a metre of the boundary of a 9 × 6 m slab, against the pre-registered 20%. The paint justifies two metres and
change; a walking body wants fifty. M6 still owns the decision and it now has two treatments' worth of evidence
that the decision has to be made rather than designed around.

**A bug in a measurement M3 had already published.** `srgb_to_linear` in the extractor takes bytes, every caller
inside that file hands it a scan, and it never said so. Three callers outside had divided by 255 first — which puts
every value under the sRGB toe, makes the whole transfer curve linear and quietly turns "Lab" into a linear map of
sRGB. `place.py`'s horizon test was one of them. It was found by writing the fourth such caller, watching a stroke
slide two lengths across a canvas without its colour changing by a single ΔE, and going to look at why.

| | M3, as published | M4, with the decode fixed |
|---|---|---|
| *The Harvest* | 71.8× | **71.6×** |
| *Wheatfield with a Reaper* | 38.9× | **53.8×** |
| *The Sower* | 11.1× | **10.6×** |
| *Self-Portrait 1887* — control | 2.4× | **2.6×** |
| *Irises*, Getty — control | 2.1× | **1.7×** |

**The finding survived the bug**, which is worth as much as the correction: the threshold of 5× still sits in the
gap between the controls and the landscapes, and the gap is wider than it was. The other two misuses were in
`order.py` and one of them does nothing at all — its result goes through a rank transform, which is invariant under
any monotone map — while the other only moves where the act boundaries fall. The docstring now says what the input
is, which is the actual fix.

**Two canvases went through the same measurement for the first time.** *The Starry Night* returns **2.0×** on the
horizon test — the company it keeps is the self-portrait at 2.6× and the irises at 1.7×, and by M3's own rule it is
**not a place**: there is no horizontal boundary in it worth hanging it by. The *Olive Grove* returns **105×**, the
strongest in the whole collection. So the station's three canvases are decided against the same rule that decided
station 4's, and two of the three then have that decision overridden by the station file with the reason written
next to it: a canvas that is not a place and is a picture of the ground is laid flat at 1:1 (*Irises*), and a canvas
that is a place but is the only middle distance the station has is shelled rather than lifted (*Olive Grove*).

**τ is now the axis and the two halves of it are not the same axis.** τ is time in the *piece* and it is spent where
the painting is: a station's share is its own strokes over its burst rate, a transit's is a flat sixteen seconds,
and station 4's two weeks of June 1888 get 33% of the whole while the eleven months after it get 28%. The band along
the bottom is the ten real years, linear, with the ten station marks where they fall — so the handle crosses it in
lurches, and that is DESIGN 5.1's non-linear mapping with the record rather than a curve making it non-linear.
Dragging the band inverts it by bisection.

**The transit is a walk and the arithmetic of it is one line.** `body.x, body.z` stopped being world coordinates and
became where you are *inside* a station; the base is which station, and on the road it is between two. Adding them
in the frame loop is the entire transit — τ moves the base, the walk moves the body, neither knows about the other,
and the sum is continuous in both, so τ cannot jump. Six hundred metres, sixteen seconds, out of the **back** of
station 4, because its three canvases stand at 0° and ±68° and the way out with nothing painted across it is behind
you. A viewer facing forward then watches the plain he has just made recede and arrives at the next station already
facing its first canvas, and both of those came free from a sign.

**Seven bugs.**

1. **The road ran straight through the painting.** With the stations laid out along −z the transit went out through
   the far half of the Harvest's plain — 260 m of ground strokes laid to be seen from six metres, seen from a
   hundred and edge-on, forty metres long each. Fixed twice over: the road now leaves out the back, and a station's
   paint goes dark by distance from its own standpoint rather than by anything about the transit, which costs
   nothing inside a volume and needs no special case for a station that does not exist yet.
2. **A dark station is a silhouette.** Dimming to black was not enough. Standing at Saint-Rémy before it has been
   painted, the world is the primed white cloth of station 0 — and station 4, six hundred metres back and dimmed to
   nothing, was a set of black shapes on it, more conspicuous than the lit thing had been. A station's canvases are
   now not drawn at all once its dim reaches zero, which happens a hundred metres out and in the dark.
3. **A rotation by zero degrees is not the identity in floating point.** At `?still` the curl's displacement is
   exactly zero, so the still should have been the painting — and it came back at RMS 0.0128 against the same frame
   with the motion switched off, at *every* amplitude including a millionth. It is not the arithmetic: at the dome a
   canvas short edge is two hundred metres, so the depth buffer's own resolution out there is about a tenth of a
   metre while two strokes laid one after the other are separated by a tenth of a millimetre, and which one wins is
   decided by whatever the last bit rounded to. The fix is to leave the points alone when there is nothing to move.
   The depth precision at the dome is real and is **not** fixed; see *Still visible*.
4. **The swell was centred on the world.** `terrain()` fell off with distance from the origin, which stopped being
   the same as distance from the station the moment there were two of them. It now carries its own centre, and the
   floor's centre follows whichever station τ is inside — which is exact rather than a blend, because each swell
   dies out at 38 m and the stations are 600 apart.
5. **The floor sank by its distance from the world origin**, at 6 mm a metre. That was indistinguishable from
   distance-from-the-eye while there was one station at the origin; at station 8 it was 3.6 metres of sink. It is
   measured from the eye now, which is what the comment above it always said it was for.
6. **The Getty *Irises* had no acts.** It was built at M3 as a negative control, never as a canvas in the piece, so
   nothing had ever asked it for a sequence — and the station showed one act called `all`, which is the fallback
   working exactly as intended and saying so. Re-run: contour 722, subject 9,072, light 389, and a second subject of 176.
7. **The station-8 standpoint had nothing in front of it.** The olive grove was at −46°, the sky was overhead and
   the irises were underfoot, so standing and looking ahead was an empty dark garden. Moved to −18°.

**One thing that looked like a bug and was a stale file.** An audit output left over from an earlier session
reported the Reaper's held-out margin as −0.1 from 1,224 confident crossings, and two paragraphs were written on top
of that before it was checked against the blob, which records 8,172 crossings and +6.8. Re-run, every canvas agrees
with what is packed in its own header. A number from a log is not a number from the artifact.

**The one design decision that is not a measurement, and what it cost.** A canvas is about 40° of the world and a
sky is 180°, so a canvas cannot be put overhead without either stretching it or lying about where it is. Two ways
out: hang it by angle, so that a centimetre of canvas is the same number of degrees everywhere and it reads the
same from any direction — which stops it being the painting from any single position, and at 96° wide the edges bow
visibly. Or keep M3's window, which is exactly the painting from wherever its axis points, and **point the axis
where a lying viewer looks.** The second is what ships: tipped up 52°, which is 6° off where lying down puts the
eye, so from the floor of the garden the Starry Night is the painting and from standing it is above you and you have
to lie down. That is DESIGN 6's whole argument for lying down, arrived at by having to choose rather than by wanting
it.

**§12's Balanced budget holds.** Two stations, six canvases, 82,627 strokes and 1.90 MB of blob, all of it resident.

| | worst measured | §12 Balanced |
|---|---|---|
| triangles | **2.07 M** | ≤ 2.5 M |
| draw calls | **28** | ≤ 120 |
| blob streamed | **1.90 MB**, both stations | ≤ 6 MB a station |
| strokes resident | **82,627** | 400 k |
| GPU | **10.3 ms** | 60 fps |

**Prefetch, measured rather than asserted.** Every one of the six canvases is fetched and built by **0.85 s**, and
the worst single build — the one synchronous hitch in the piece — is **7.7 ms**, under half a frame. At playback
rate the scrub reaches station 8 nineteen seconds later. Entering a station does not stall the frame because by
then there is nothing left to do.

**Verified.** `?flat` parity RMS **0.0472** against `tools/flat.py`, unchanged from M3. All twelve goldens
identical, colour and relief, across six canvases. `?still` twice, byte-identical by sha256; `?still` with the
motion on and with it off, RMS **0.000000**, so a still is the painting rather than a frame of an animation.
Two moments nine seconds apart differ by RMS 0.052, so the motion is there. The jute reads against the linen
without being pointed at. Params discipline ok for seven files. `?station=4` and `?station=8` each stand alone;
`?station=9` still fails in text.

**Still visible.**

- **The depth buffer gives up at the dome.** 260 m out with a 4 cm near plane leaves about a tenth of a metre of
  depth resolution, and the per-stroke order lift out there is a tenth of a millimetre. So which of two overlapping
  sky strokes is on top is not decided by the order they were painted in. It has been true since M3 and M4 is the
  milestone that measured it. The fix is a logarithmic depth buffer or a per-canvas depth range and it is not M4's.
- **The canvases still have hard rectangular edges against the void**, and the shell makes it worse: strokes are
  traced past the frame and the cloth stops at it, so the olive grove's bottom edge is scalloped with paint hanging
  below it. The extractor already flags those strokes as edge-spill; nothing yet uses the flag.
- **The Starry Night's scan carries a strip of unpainted tacking margin at its left edge** that `canvas_edge.py`
  does not catch, because it is paint-adjacent rather than quiet. It is about 1.5% of the canvas.
- **The Harvest's acts are still lopsided** — M2's cutter gives one act 89% of that canvas — and nothing at station
  4 moves, because the mistral is a wind and not a curl.
- **Station 8's standpoint is thin.** Ahead is one canvas, above is one canvas, below is a 94 cm bed of irises, and
  the rest of the walled garden is dark ground.

**Not started, per scope.** Station 5 and the built treatment. The letters (`text` is still null in both station
files). The far LOD tier. Sound. Any station but 4 and 8.
