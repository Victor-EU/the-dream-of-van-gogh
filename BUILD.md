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

| The volume reads as a rail | the viewer fights the boundary instead of looking | > 20% of walk-time within 0.5 m of it | M3 |
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
