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

*Done, and the tool this milestone was named for could not do the thing it was named for. The Progress entry below
carries the numbers; the short version is that DESIGN 4.4's sentence about interiors splits cleanly in half. **The
room does come off the canvas** — the width and the height with no free constant in them at all, because the field
of view cancels out of both, and only the depth needs one. **The vanishing point does not.** Looked for twice, in
the strokes and then in the scan's own detected line segments, it will not land in the same place twice on any
canvas in this piece, and the calibration says what it would have taken: a fifth of every mark on the canvas lying
on a room line drawn to within six degrees. His rooms are not ruled. So the six numbers a room needs are authored,
in the station file, and the piece says so — and the claim the station actually rests on is measured instead, with
no hand in it anywhere: block for block, seven to ten in a hundred find themselves in the next Bedroom where a
wheatfield against another wheatfield finds none, and once the third canvas's own reframing is taken out the three
agree to between one and three percent. One room, three paintings of it, and the paint changes around you a mark at
a time.*

---

## M6 — The arc  *(2–3 weeks)*

**Scope.** All ten stations roughed in, in order, everything walkable and nothing polished. Station 2's colour flood.
Station 9's widening frame as the canvases go double-square. Station 1's lamp, and its shortness.

**Exit criteria.**
- Scrub from τ=0 to τ=1 without leaving the piece. Dark → flood → yellow → night → stop → stars → green → end.
- The flood at station 2 lands as a shock, which is only possible if station 1 was dark enough and short enough.
- No station is longer than its material justifies.

*Done. Ten stations, thirty canvases, 315,638 strokes, and the scrub runs end to end. The Progress entry below has
the numbers; the short version is three answers and one retraction. **The flood survives its audit** — 39.6 in the
lightness-and-chroma plane against 9.2 as the most a colour-profile mismatch could forge, 4.3× a bar pre-registered
before station 1's canvas existed — and then the same measurement says the design's sentence is in the wrong place:
the bleach is Paris and the flood is Arles, a station later and going on for three. **τ became a chronology and
immediately found four canvases in the wrong year**, two of them in stations already shipped, one of which was not a
slipped date but the wrong painting: the Van Gogh Museum's* Sunflowers *is the January 1889 repetition, which makes
station 5 a station of four repetitions instead of three. **The volume question is closed and the answer is that the
instrument was wrong** — and closing it meant taking M5's headline number back, because the eased return had been
reading its boundary from the standpoint while the instrument read it from the volume's centre. What replaces the
metric is `pressing`, time spent trying to leave rather than time spent standing at the edge, and it puts the
outdoor volumes at two to three times their old size rather than the seven M3 feared.*

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

*Done. Nine lines for ten stations, and the brush. The Progress entry below has the numbers; the short version is two
findings and an instrument. **The citations were wrong before anything was quoted** — seven of the nine letters M3 to
M6 had named were to someone else or on another day, which is the misquotation this section warns about made one step
earlier — so a line now gets into a station only through `tools/letters.py`, which reads the edition's own pages and
adds a test the design did not ask for: the line stands at the canvas the edition's own note says the passage is
about, and six of the nine do. **The silence is exactly zero** — at three stations every hold between two acts falls
to digital zero within 280 ms of the last stroke and stays there, and the louder ear is the paint's side in all 313
frames where it arrived off centre. What no number here can say is whether a person turning it on hears a roar or a
hiss, and that is the first thing to ask the people M8 is going to find for station 7.*

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

*First attempt: built, and not yet met by a person — which is the first exit criterion, so M8 is open. The Progress
entry below has the numbers. Station 7 has the canvas that did stop, the portrait of Augustine Roulin he was working on
when his illness came, by his own account a month later: painted to half its strokes, the brush cut to exact zero in
8 ms, and the scrub refusing every way forward for six seconds, where M6's refusal met only the scrub playing itself.
The ending is something the viewer did by construction: the scrub playing itself stops at the last stroke of the last
field, and station 11 — bare canvas, no date, the nothing held twenty-four seconds, then the crows — is reached with a
hand or not at all. The crows are his, out of* Wheatfield with Crows*, and have been at the edge of the frame since
Arles. What is not here is the stranger, F 504 itself — a stand-in is — and the coda decision, which is the author's.*

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
  station's blobs are committed when that station is frozen. *M6 freezes none — its own scope is "roughed in and
  nothing polished" — so they stay out. What is committed is the goldens, and thirty canvases at two 1200 px images
  each is **55 MB**, which is the first time that line has cost anything worth noticing.*
  *After M9, on the author's word, the records the page loads are committed: each station canvas's blob and its
  underlayer, 62 files and 12 MB, so that a clone, or any static host serving the repository, shows the paintings.
  The rest of each build (the stroke JSON, the flats and the height maps) stays a gitignored output, and so does the
  old station 7's stand-in, which nothing hangs.*
- **Sound design beyond the brush.** Mistral, cicadas, rooks. After M7's brush exists at scale.

---

## The risk table

| | what kills it | the number that says so | milestone |
|---|---|---|---|
| The strokes do not read as Van Gogh | fragmentation, uniform width, or a wrong height field | the gate, and arc length 250–700 px | M0a |
| The residual carries the picture | the underlayer does the work and the ribbons are sprinkles | band-pass energy ratio < 0.6 | M0b |
| The stations do not sit on one colour footing | forty scans, twelve institutions, loose profile handling | station 2's flood survives a profile audit | M0b, M6 — **it survives** |
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

| The volume reads as a rail | the viewer fights the boundary instead of looking | > 20% of walk-time within 0.5 m of it | M3 — **the instrument says yes**, M4 — **and it got worse**, M5 — **and it is two questions**, M6 — **and the instrument was the wrong one** |

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

*M5 is the first station the row does not fire on, and it changes what the row is asking. A built room's volume is
not a compromise between what the paint supports and what a body wants — it **is** the room, 2.8 × 3.8 m, off-centre
because the walls stand 2.39 m to the left of where he set the easel and 0.80 m to its right. Two of the three
walkers come in under the limit there: `forward` at **0.3%** and `look` at **7.1%**, where nothing at stations 4 or 8
came under 72%. The one that still fails is `wander`, at 71.8%, and it fails because forty seconds of walking in a
straightish line is not a thing a bedroom can absorb — a fact about ambling and not about the room. So the row splits
in two. **For an interior it is answered and there is nothing left to decide.** For a landscape it is exactly as open
as M4 left it, and M6 now has only that half to settle.*

***M6 takes M5's paragraph above back and then closes the row.*** The eased return that keeps a body inside a volume
was reading its half-extents from the standpoint while the instrument read them from the volume's own centre, which
M5 had just added. So at station 5 the walker was held inside a correctly-sized box in the wrong place — comfortably
inside the boundary being scored — and 0.3% and 7.1% are what that produced. With the return reading the same centre,
the three walkers there give **95.6%, 99.7% and 95.5%**. Nothing in this piece passes the edge test and station 5
never did.

And nothing could: **the edge test measures the walk.** Forty seconds at 1.45 m/s is 58 m, so any walker with a net
forward drift arrives at any boundary nearer than that and stands at it, and the metric scores standing as pushing —
which is why M3's sweep answered a slab bigger than the walk. That was the third of the three answers M3 wrote down
and it is the one that is true. The statistic that replaces it is **pressing**: the fraction of the walk spent
holding a key that would go further out while the ground takes the body back. `look`, the only scripted walker that
stops and turns and looks, presses **0.0%** in station 2's corridor, 27.1% at station 4, 32.6% at station 5 and
32.7% at station 8; `forward` and `wander` press 42–89% everywhere, which is a fact about walkers that never stop.
Swept at station 4: **27.0% at 12 × 7, 20.6% at 18 × 11, 12.7% at 26 × 16, 0.0% at 40 × 25.** The six outdoor
stations ship at 26 × 16 — the first size under the fifth M3 pre-registered, two to three times the old slab rather
than the seven M3 feared, and paid for with a far field a quarter as dense at six metres and thinner beyond. The row
is closed as far as an instrument can close it. A person in a chair is still what the criterion asks for.*

| We drift into modelling Provence | the world stops being made of strokes | `?noStrokes` shows a scene | every |
| Station 1 loses the viewer | too dark, too long, and no reason to continue | tested at M6, not argued about before | M6 — **dark and short, and still untested on a person** |

*Dark: the Potato Eaters' area-weighted mean lightness is **11.9**, a quarter of the corridor's 51.5 and a fifth of
the orchards' 64.3, and none of that darkness is a dimmer — there is no light in that room he did not paint. Short:
one canvas, 13,036 strokes, **6.5 seconds and 2.6% of the arc**, the shortest station in the piece that has paint in
it. A reason to continue: the road out of it is the longest in the piece, twenty-two seconds for the ten months
between Nuenen and Paris, and what is at the end of it is four times the light. Those are the three things the row
asks for and they are numbers. Whether a stranger stays is not a number and this milestone did not test it.*

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

---

### M5 — Interiors

**Asked.** Station 5, the Yellow House. The *built* treatment, with a small tool that takes the vanishing point and
the frame and returns the room. The three Bedrooms occupying the same space, so that walking forward changes the
colour of the room without a cut. The Sunflowers *present*, enormous and close.

**The question this milestone turns on.** DESIGN 4.4 justifies the built treatment in one sentence, and it is the
only treatment in the piece whose justification is a claim about the paintings rather than about the code: *his
interiors are already one-point perspective — the vanishing point gives you the room's proportions directly off the
canvas.* Two claims, and the first can be false while the second is worth having. `tools/room.py` tests them
separately, the way M1 tested the light, M2 the order, M3 the place and M4 the motion: the thing that makes the
effect and the thing that could refute it are the same code, and canvases that are not rooms go through it as
controls.

**The measurement, and its pre-registration.** Every stroke carries a direction, so every straight mark is a line.
Extend them all and ask which point in the plane the most of them pass nearest, weighted by arc length, at a
tolerance of 2% of the canvas. The null is the one `tools/place.py` already uses for the horizon: permute the
directions between strokes and keep the midpoints, which leaves the composition exactly as it was and destroys only
the fan. Written down before any canvas was run: **an interior must beat its own direction shuffle by 3× where the
outdoor controls do not**, and the three Bedrooms — three collections, three scans at 329, 203 and 78 px/cm — must
agree to within **2% of the canvas**.

**The controls were run first, and they are a tight band.**

| | over its own direction shuffle |
|---|---|
| *Olive Grove* | 1.95× |
| *The Harvest* | 1.93× |
| *Irises* | 1.77× |
| *Sunflowers* | 1.65× |
| *The Sower* | 1.61× |
| *Wheatfield with a Reaper* | 1.58× |
| *The Starry Night* | 1.35× |
| *Self-Portrait* | 1.13× |

Nothing that is not a room reaches 2, and the pre-registered 3.0 sits well clear of all eight. Then the three
Bedrooms came in at **1.37×, 1.28× and 1.25×** — *inside the control band*, below a wheatfield. **The pre-registered
test failed.**

**Why it failed is a fact about the instrument, and finding that out is most of this milestone.** `--sensitivity`
grades the tool on a known answer: take a canvas's own marks, keep every midpoint and every length, and re-point a
fraction *f* of them at one chosen place with a few degrees of hand in them.

| f | 0.00 | 0.05 | 0.10 | 0.20 | 0.35 | 0.50 | 1.00 |
|---|---|---|---|---|---|---|---|
| ratio | 1.25× | 1.31× | 1.44× | 1.98× | **3.47×** | 4.82× | 9.14× |
| found, from the truth | wrong | wrong | 2.2% | 0.8% | 0.5% | 0.3% | 0.2% |

The height of the peak says *how much of the paint* lies on the room's lines, and it does not reach 3× until a third
of every mark on the canvas is a perspective line. No painting is like that: the walls are painted with wall and the
bed with bed. **The location, though, is already right at a tenth**, where the ratio is an unremarkable 1.44. So the
bar was set on a quantity that answers a different question, and asking it of a painting was the error. The ratio is
kept and reported anyway, because a test that was made and failed is worth more than a test quietly replaced.

**What replaces it is the split half, at the bar this file already had.** Cut the marks in two at random, find the
point in each half alone, and ask how far apart the two answers are — 2% of the canvas, the same number already
written down for the three Bedrooms, asked of a second thing rather than chosen after seeing the data. Two
independent estimates of something that is there land on top of each other; two estimates of the place the marks
merely happen to be densest do not.

| | two halves, apart | its own shuffle | better by | |
|---|---|---|---|---|
| *Sunflowers* | **1.9%** | 39.9% | 20.7× | **stable** |
| *Olive Grove* | **2.4%** | 68.5% | 28.8× | just outside |
| *The Bedroom* (Amsterdam) | 7.8% | 29.0% | 3.7× | |
| *The Harvest* | 8.8% | 39.8% | 4.5× | |
| *Wheatfield with a Reaper* | 10.4% | 11.3% | 1.1× | |
| *The Sower* | 33.4% | 39.5% | 1.2× | |
| *The Starry Night* | 53.5% | 54.6% | 1.0× | |
| *Irises* | 54.9% | 62.0% | 1.1× | |
| *Self-Portrait* | 55.6% | 42.3% | 0.8× | |
| *The Bedroom* (Chicago) | **62.4%** | 13.8% | 0.2× | worse than chance |
| *The Bedroom* (Orsay) | **90.7%** | 54.3% | 0.6× | worse than chance |

**The instrument is not broken, and this table is the proof.** It finds a stable point on two canvases and both of
them are outdoors: a vase of sunflowers, whose flowers genuinely radiate from one place, at 1.9% and twenty times
better than its own shuffle; and an olive grove at 2.4%. It finds nothing on any Bedroom, and on two of the three it
does *worse than chance*. A tool that returned nothing everywhere would be a tool with a bug in it. This one says
where radial structure is, and it says there is none in these rooms.

The direction histogram says why in one line: **59% of the arc-weighted straight marks on the Chicago Bedroom lie
within ten degrees of vertical**, and in one-point perspective a vertical line stays vertical and never converges.
The vote's six strongest local maxima all sit on one vertical ridge at u ≈ 0.09, strung down it, and which of them
wins flips between halves.

**So the question was asked again of something that is not the stroke record.** A painting of a room is mostly paint
that is not the room, and if the vanishing point is in the picture but not in the marks, the failure is the record's
and not the painter's. `--scan` runs the working image the extractor already cached through a line-segment detector
and then through *exactly* the same vote, split half and shuffle. It does no better: the Chicago Bedroom's halves
land 14.4% apart against a 12.5% shuffle, the Orsay one 99.6% against 54.3%. Drawing the detected segments over the
canvas shows the reason plainly, and it is the interesting part: **the floorboards are not detected because they are
not drawn as lines.** They are bands of colour. The window frame is found, some picture frames are found, and the
architecture of the room — the wall/floor junction, the corners, the boards — is barely there at all.

**And how much hand the instrument can take settles it.** The same calibration with a jitter:

| f = 0.20 | 3° | 6° | 10° | 15° |
|---|---|---|---|---|
| found, from the truth | 2.0% | 2.0% | 6.3% | 59.6% |
| two halves, apart | 1.2% | 4.5% | **56.5%** | 66.5% |

**It would have taken a fifth of every mark on the canvas, drawn to within six degrees.** That is the finding, and it
is a statement about what a painting is rather than a shrug: *his rooms are not ruled.* The perspective is carried by
the shapes of the objects — the foreshortening of the bed, the top of the table — and a human reads it from those
instantly, which is not line convergence and is not something this pipeline's atom can see.

**So the room is authored, and the arithmetic is not.** Six numbers in the station file where a person can read them
— the vanishing point, and the four edges of the back wall — exactly as station 8's depths are, and the caption says
so. What follows from them is not invention at all, and it is better than DESIGN 4.4 knew:

    D  = h·f / s          the back wall, in metres
    XL = h·(u₀ − u_l)·a / s      the room, left of the axis
    XR = h·(u_r − u₀)·a / s      and right of it
    H  = h·(1 + (v₀ − v_c)/s)    floor to ceiling

where s is how far the back wall's floor line sits below the vanishing point. **f cancels out of the width and the
height.** They are in units of the painter's eye height and nothing else, so a room's cross-section really does come
off the canvas with no free constant in it. Only the depth needs one. The Bedroom comes out **3.18 m wide and 2.57 m
to the ceiling** — and 4.37 m deep at hfov 70°, which is 70 rather than the 50 every other canvas uses because a
room is painted from inside it: at 50 the same six numbers give a room 6.1 m deep, which is longer than the house
was. The depth is the one dimension that moves when that number moves, and it moves as 1/tan(hfov/2).

**The measurement the station actually needed was a different one.** "The three Bedrooms occupy the same space" is
not a claim about vanishing points; it is a claim about the canvases, and it can be asked with no hand in it
anywhere. `--register` block-matches two canvases at the same canvas fractions, high-passed so it is the drawing
being compared and not the tone — which matters, because the whole point of these three is that the tone is
different. Every block of one canvas is looked for in a window of the other and counts only if its best match beats
its own second best, which is Lowe's idea applied where it works. Feature matching was tried first and is the wrong
tool: SIFT found forty matches between two Bedrooms and five survived RANSAC, because repeated brushwork fails the
ratio test everywhere. Fitting a homography was worse — eight degrees of freedom folded a wheatfield onto a bedroom
at a correlation as high as the two bedrooms scored.

| | blocks that found themselves | moved | net | left over |
|---|---|---|---|---|
| Amsterdam / Chicago | 45 of 456 (10%) | 2.48% | −0.70, +0.42% | **2.66%** |
| Amsterdam / Orsay | 38 of 456 (8%) | 7.00% | +5.88, +3.85% | **1.29%** |
| Chicago / Orsay | 32 of 456 (7%) | 8.44% | +7.26, +4.13% | **2.25%** |
| Chicago / *The Harvest* | 1 of 456 | — | — | nothing lines up |
| *Harvest* / *Reaper* | 2 of 456 | — | — | nothing lines up |
| Amsterdam / *Sunflowers* | 2 of 456 | — | — | nothing lines up |
| *Olive Grove* / *Harvest* | 0 of 456 | — | — | nothing lines up |

**The three are the same picture and nothing else is**, and the separation is not the thresholds doing the work: it
survives all twenty-seven combinations of width, block size and match threshold that were tried, with the Bedrooms
at 2–19% and every control at 0–1%, the two populations touching only at the loosest setting of all. What moved is
**the Orsay canvas's framing**: he re-cropped the small version nearly six percent to the right and four percent
down. Take that measured offset out and what is left between any two of them is **1.3% to 2.7% of the canvas** —
which is the tolerance this file already asks for, so one authored room fits all three, and the second and third
Bedrooms carry the first one's six numbers shifted by the measurement rather than authored again.

**And that offset has an independent check on it that shares no code.** `tools/place.py` measures each canvas's
strongest level colour cut without knowing anything about any of this, and returns v = 0.336, 0.322 and 0.362 for
the three. Subtract the measured reframing from the third and they become 0.336, 0.322 and **0.324** — from 4.0%
apart to 1.4%. Two measurements agreeing about how far one canvas moved.

**The handover is per stroke, not a cross-fade.** Each Bedroom has a distance into the room at which it *is* the
room, and walking forward runs a tent between the two nearest, so the weights sum to exactly one and the room is
never half-painted. A stroke is then either laid or not, decided by its own hash against that weight — so nothing is
ever half-transparent, no two rooms z-fight, the light and the relief stay exactly what they are, and `?still` comes
back byte-identical in the middle of a handover. It costs no coverage: each canvas covers about four fifths of
itself, so half of one and half of another cover four fifths together. And **a canvas τ has not reached cannot be
walked into** — two of the three Bedrooms are September 1889 and the first is October 1888, so until the scrub gets
there the room stays the room he was living in however far you walk. The chronology is the gate on the walk, which
is the closest the piece's two controls have come to being one.

**One correction to something M3 and M4 both shipped.** The scan and the catalogue disagree about the *shape* of a
canvas, and the code was using both: `tools/place.py` and the runtime squared the canvas up by the ratio of the
centimetres the holder publishes, while every stroke coordinate is a fraction of the scan. Measured across the nine
canvases in the piece the two run **0.1% to 3.1% apart** — worst on the Getty *Irises*, which is the canvas lying at
1:1 under the viewer's feet, and 2.2% on the Chicago *Bedroom*, where the reason is visible in the figure itself:
92.3 × 73.6 cm is 36¼ × 29 inches converted, and a rounded inch is ±1.3 cm on a canvas this size. It mattered here
because 2.2% is exactly the tolerance the three-Bedroom claim is argued at. The rule now is **the shape from the
scan, the size from the catalogue** — the scan is the artifact, cropped to the picture's own edge, and the museum is
the authority on how big it is. Nothing moved: all twelve existing goldens are byte-identical and every horizon
ratio holds to a rounding (71.7×, 53.6×, 10.6×, 1.7×, 2.0×, 104.9×, 2.6×).

**Eight things that were wrong, in the order they were found.**

1. **The vanishing point was measured with the wrong aspect.** Fixed above, and it had to be fixed before anything
   else, because a 2.2% squaring error and a 2% agreement bar cannot both be in the same argument.
2. **Two extractions of the same canvas ran at once.** A `nohup … &` inside a tool call returns exit 0 immediately
   and leaves the child running detached, so a second, tool-managed run started on top of it — both writing the same
   memory-mapped working image. Nothing corrupted because it was caught in three minutes, and the lesson is the
   harness's: if a long job is worth backgrounding it is worth backgrounding *once*, by the thing that will tell you
   when it is done.
3. **The ceiling was 5.78 m.** The JS mirror of the room arithmetic wrote `k·(1 + (v₀ − v_c))` where the formula is
   `h + k·(v₀ − v_c)`, so the constant term came out scaled by k. A 2.57 m room reported a ceiling four metres above
   the eye. Caught by putting the room into `vg.state` and reading it, which is the whole argument for the debug API.
4. **Lighting the paint by the wall it landed on relights the painting.** Each stroke taking its surface's normal is
   the obvious way to build a room and it is wrong: this world's light comes from above, so a floor normal takes 0.58
   of it and a back wall 0.34, and the Bedroom's wall/floor line lit up as a band ruled straight across the paint at
   47% of the canvas. Blending the five faces over a hand's width turned a ruled line into a ruled band and fixed
   nothing, because the fault was not the hardness of the join. The two choices differ by RMS **0.081** and every row
   of that difference is at the crease. So a built room lights its strokes the way a sky and a shell already do —
   facing back down their own ray, at the painter — and the room is a room because of what the walk does to it. The
   warmth is the paint's, which is where it was to begin with.
5. **The dissolve saved the fill and not the sweep.** Collapsing a handed-away canvas's strokes to nothing in the
   vertex shader still builds every ribbon: three Bedrooms' worth, 4.29 M triangles, so that two thirds could be
   thrown away. Skipping the draw outright takes it to 1.0–1.8 M.
6. **The room had no ceiling and no near floor**, because he cropped both out of the canvas, and a room you cannot
   see the ceiling of is not one you are standing in. The cloth now runs well past the edge of the painting — and
   past it there is no underlayer, and none is invented: it goes to `uGround`, the same *primed cloth of station 0,
   gone dark* that the whole unpainted world is made of. It also softens the canvas's own rectangular edge, which
   every station until now has had hard, and which M4 listed as still visible.
7. **Three canvases of one room were carrying three substrates**, which would z-fight along every wall. One cloth
   now, from the first Bedroom, and the other two declare `cloth: false` — which makes the shared shell a standing
   check on the measurement, since three rooms that did not agree would show through it.
8. **And it fired, one screenshot later.** At the second key most of the room went missing with every stroke still
   being drawn — 13,099 of them, all of Bedroom 2, none of them visible. The three canvases' own six numbers give
   rooms **3.18, 3.23 and 3.24 m wide** and 4.37, 4.44 and 4.45 deep: a 1.9% disagreement that comes entirely from
   their scans having slightly different aspects, and 1.9% of four metres is seven centimetres. The first Bedroom's
   back wall was standing seven centimetres in front of the second Bedroom's paint. So the box is the **station's**
   and not the canvas's, which costs nothing that matters: a canvas's rays stay its own, so from the standpoint each
   of the three is still exactly its own painting, and all the box decides is how far along those rays the paint
   sits — which is what the walk is for. The check the shared cloth was described as being, it turned out to be.

**And one that is a fact about a measurement rather than a bug.** The `?flat` parity came back at 0.0521 against
M4's published 0.0472, which looks like a regression and is not: **the number depends on the resolution it is taken
at.** At a 1272 px viewport it is **0.0476**; at 2544 it is 0.0521 — and M4's own `index.html`, checked out and
measured the same way at 2544, returns the identical 0.0521. The residual is antialiasing and edge placement, and
finer pixels resolve more of it. A parity figure should always carry the viewport it was measured at, and from here
this log quotes both.

**Verified.** `?flat` parity RMS **0.0476** at a 1272 px viewport against M4's 0.0472, and 0.0521 at 2544 where M4's
own build returns the same. All **twenty** goldens identical, colour and relief, across ten canvases. `?still` twice,
byte-identical by sha256, taken in the middle of a 50/50 handover. Three stations, ten canvases, **126,849 strokes
and 2.9 MB of blob**, everything resident by **0.56–1.26 s** over four runs. Balanced worst case anywhere in the
piece **2.06 M triangles, 25 draws, 8.1 ms of GPU, 60 fps** — at station 4, where it was at M4; station 5 runs 0.76 M
standing, 1.50 M mid-handover and 0.83 M at the last key, and the two roads are 73 k triangles and 2 draws. τ is
continuous across both transits and the date runs June 1888 → August → October → **December 1888** → March → May
1889 without a jump. Station 5's walkers return **0.3%, 71.8% and 7.1%** against the 20% limit — the first station in
the piece two of them pass. Params discipline ok for eleven files. `?station=4`, `?station=5` and `?station=8` each
stand alone; `?station=9` still fails in text.

*One number is worse than M4's and it needed taking apart before it could be written down. M4 reported a worst single
build of 7.7 ms; over four runs here the worst is 13, 25, 144 and 173 ms. Per canvas it is entirely the **first** one
to land — every canvas after it costs 1 to 23 ms with a median of 5, and the 20,734-stroke olive grove, the largest
in the piece, is 11 to 23. So it is not a per-canvas cost that has grown; it is the first big typed-array allocation
and the first pass through code the JIT has not seen, landing on whichever canvas arrives first. What that qualifies
is M4's exit criterion: **entering a station never stalls the frame, but arriving in the piece can**, for up to three
frames, once. It was invisible at M4 because six canvases happened to give a warm run and the number that got written
down was 7.7.*

**Still visible, and named rather than fixed.**

- **The room's six numbers are authored and no amount of care makes them measured.** The tool says exactly what it
  would have taken and cannot supply it. One diagnostic is left hanging on purpose: the floorboards of the *left
  half* of the Bedroom, taken alone, agree between random halves at **4.3% against a 25.7% shuffle** — six times
  better than chance and still twice the tolerance. It was found by choosing a region after seeing a failure, so it
  proves nothing, and it is the first thing to try again.
- **The ceiling is invented in all three versions**, because he cropped it out of all three. `v_c` is the one
  authored number with nothing on the canvas to read it off.
- **A stroke that straddles a corner of the room is stretched around it.** The ribbon follows the crease correctly
  but takes its width from its own midpoint, so a mark lying along the wall/floor line comes out fatter at one end.
  It is only conspicuous where many marks lie along the same crease, which is exactly where the Bedroom's do.
- **Two of the three Bedrooms are shown on Arles cloth** and were painted at Saint-Rémy on whatever was to hand. The
  substrate is a property of the room here rather than of the canvas, and that is the price of putting three canvases
  in one space.
- **The Orsay Bedroom's dimensions are still not verified against the holder**, the only canvas in the piece of
  which that is true — Orsay serves 403 to a plain request. What depends on it is every stroke width in millimetres;
  what does not is the room, because the built treatment works in units of eye height and the scan's own aspect.
- **The amble still fails at station 5**, at 71.8%, and it is not the room's fault: forty seconds of walking in a
  straightish line is not a thing a bedroom can absorb.
- Everything M4 left open that M5 did not touch: the depth buffer at the dome, the Starry Night's tacking margin,
  the Harvest's lopsided acts, station 8's thin standpoint.

**Not started, per scope.** The two chairs, which DESIGN 7 asks for at this station and M5's scope does not. Stations
1, 2, 3, 6, 7, 9, 10. The letters (`text` is null in all three station files). The far LOD tier. Sound.

---

### M6 — The arc

**Asked.** All ten stations roughed in, in order, everything walkable and nothing polished; station 2's colour
flood; station 9's widening frame; station 1's lamp and its shortness. And the three decisions M3, M4 and M5 each
deferred to here: **the viewing volume** for a landscape, **whether the transits are dead time**, and **what happens
to the Reaper when τ stops being a station-local scrub and becomes a chronology**.

**Built.** Nineteen more canvases extracted, packed and placed, for thirty in the piece. Seven station files —
1, 2, 3, 6, 7, 9, 10 — and edits to the three that existed. `params/_base.json`, so that the forty numbers the
extractor tunes with live in one file instead of thirty copies. Four new tools: `tools/palette.py` (the flood,
against what a wrong colour profile could forge), `tools/station.py` (the station files' arithmetic, and whether the
piece's time holds together), `tools/dates.py` (when each canvas was painted, from the holder's own record) and
`tools/tiles.py` (the two 1:1 regions a params file names, picked by measurement rather than by eye). In the
runtime: a station with no canvases at all, a corridor, a road whose length is the months it crosses, `vg.arc()`,
and the `pressing` statistic that finally answers DESIGN 15's oldest question.

**The flood survives its audit, and it is not a flood.** BUILD's risk table has carried one row since M0b that no
milestone could close: forty scans, twelve institutions, and if the decode is loose the stations do not sit on one
colour footing — with station 2's flood the effect most exposed to it, because the whole point of that station is
that the colour changes. `tools/palette.py` was **committed before station 1's canvas finished extracting**, so the
bar in it is a bar and not a description. The statistic is a canvas's area-weighted mean lightness and mean chroma
in CIE Lab over its own stroke record; a station's palette is the mean of its canvases'. The bound is on the
*difference* and it is adversarial: each station decoded under whichever of sRGB, Adobe RGB (1998) and Apple's
Generic RGB pulls the two furthest apart, less the flood that is really there. Neither alternative is hypothetical —
of the nine files in this set that carry a profile at all, two are Adobe RGB and two are Apple's.

| | lightness | chroma |
|---|---|---|
| station 1, *The Potato Eaters* | **11.9** | 11.1 |
| station 2, the corridor | **51.5** | 13.7 |
| the flood, in that plane | **39.6** | |
| the most a profile mismatch could forge | **9.2** | |

**4.3× the bound, and 4.7× with the one Art Institute canvas dropped** — the Potato Eaters and five of the six
corridor canvases come off one museum's rig, where a mismatch between two scans is least likely of all. The
pre-registered bar was 3×. It passes.

**And then the number says something the design did not.** Almost all of that 39.6 is lightness: 11.9 to 51.5, a
factor of four and a third. The chroma moves 11.1 to 13.7 and that is nearly nothing. DESIGN 7 says *the world
bleaches, then floods*, and both halves of that sentence are true — but they are not both at station 2. Measured
along the whole arc:

| station | lightness | chroma |
|---|---|---|
| 1 Nuenen, 1885 | **11.9** | 11.1 |
| 2 Paris, 1886–88 | 51.5 | 13.7 |
| 3 the orchards, 1888 | **64.3** | 22.5 |
| 4 the Harvest, June 1888 | 51.8 | 30.7 |
| 5 the Yellow House, 1888–89 | 59.3 | **35.9** |
| 8 Saint-Rémy, 1889 | 44.5 | 21.2 |
| 9 Auvers, 1890 | 55.9 | 27.7 |
| 10 the wheatfield, July 1890 | **37.1** | 34.7 |

**The bleach is Paris and the flood is Arles.** Paris is where the light arrives — four times the lightness of the
cottage, for almost no extra colour — and the colour arrives a station later and goes on arriving for three. The
smallest, palest thing in the whole piece is the 19 × 14 cm cardboard self-portrait that opens the corridor, at
chroma **4.6**, which is less than half the Potato Eaters' 11.1: he got *less* colourful before he got more. And
the last two rows are the shape of the ending, which is not the shape DESIGN 7 claims for it: the brightness peaks
in the orchards and the last canvas is the darkest thing since Nuenen, while the *chroma* climbs to the end. The
arc's peak immediately before nothing is real; it is a peak in colour and not in light.

**τ became a chronology, and the first thing it did was find four canvases standing in the wrong year — two of them
in stations this repository had already shipped.** M3 wrote that the Reaper's date would fight station 8 at M6 and
that this was the milestone to settle it in. It did not fight; it turned out to have company. `tools/dates.py` asks
the Van Gogh Museum's own object pages, which is the same rule `paintings/CREDITS.md` has kept for dimensions since
M0b and which nothing had ever applied to dates — the axis the entire piece is controlled by.

| | this repository said | the museum says | |
|---|---|---|---|
| *Sunflowers*, `s0031V1962` | August 1888 | **January 1889** | not the canvas, the repetition of it |
| *Olive Grove*, `s0045V1962` | June to July 1889 | **November 1889** | outside its own station's span |
| *The Sower*, `s0029V1962` | November 1888 ✓ | November 1888 | right since M3, and five months outside station 4 |
| *Orchard in Blossom*, `s0038V1962` | — | **April 1889** | a year after the spring station 3 is about |

The *Sunflowers* correction is the one that changes something. Station 5 has been standing what it called the
Sunflowers next to three Bedrooms and calling three of its four canvases repetitions; the museum dates its canvas
five months after the London one it repeats. **All four walls of that station are repetitions, and that was not
designed.** The *Olive Grove* is a plain error in a shipped file, corrected here; station 8's span was widened to
hold it rather than the date narrowed to fit, because DESIGN 7 calls that station "Saint-Rémy, 1889" and he was
there until May 1890, so the narrow May-to-July span was the thing that was wrong.

So the rule `tools/station.py` enforces is not that a canvas must be in its own year. The piece is allowed to put a
canvas where the argument wants it — it is what station 5 is *for*. **What it is not allowed to do is that
quietly.** A `when` outside its station's `span` with no `note` beside it is an error and the tool exits non-zero;
seven canvases are outside, every one with a note, and the date on the band says so at run time. The Reaper is
settled by being one of seven rather than by being moved.

**The volume question is answered, and the answer is that the instrument was wrong — which was one of the three
answers M3 wrote down and the only one that could be measured rather than chosen.** First a retraction. M5 reported
that station 5's room was the first volume in the piece to pass, at 0.3% and 7.1% against the pre-registered 20%.
It was not. The room's box is 2.8 × 3.8 m with its centre 0.8 m left of the standpoint and 1.6 m in front of it, and
the eased return that keeps a body inside it read the half-extents from the **origin** while the instrument read
them from the **centre** — so the walker was held inside a correctly-sized box in the wrong place, comfortably
inside the boundary being scored. With the return reading the centre the instrument does, the same three walkers
give 95.6%, 99.7% and 95.5%. **No station in this piece passes the edge test and station 5 never did.**

And none could have, because the edge test measures the walk. Forty seconds at 1.45 m/s is 58 metres; any walker
with a net forward drift reaches any boundary nearer than that and then stands at it, and standing at it scores as
pushing at it. That is why M3's sweep answered *50 × 40 m*: a slab a hundred by eighty is bigger than the walk. So
M6 adds **`pressing`** — the fraction of the walk spent holding a key that would go further out while the ground
takes the body back. Trying to leave, rather than standing at the edge.

| | forward | wander | look |
|---|---|---|---|
| 2 the corridor, 5.2 × 32 m | 51.7% · 42.7% | 89.1% · 68.1% | 36.8% · **0.0%** |
| 4 the plain, 24 × 14 m | 89.6% · 80.4% | 86.9% · 77.2% | 75.2% · 27.1% |
| 5 the room, 2.8 × 3.8 m | 95.6% · 86.2% | 99.7% · 89.0% | 95.5% · 32.6% |
| 8 Saint-Rémy, 18 × 12 m | 91.3% · 82.3% | 89.9% · 80.2% | 76.8% · 32.7% |

*(time within half a metre of the edge · time pressing against it)*

`forward` and `wander` press everywhere and that is a fact about them: a walker that never stops will reach the edge
of anything. `look` — walk a few paces, stop, turn, look, walk on — is the only one of the three that resembles
somebody looking at a painting, and it presses **0.0%** in the corridor and about a third of the time in all three
of the others. The corridor is the only volume in the piece longer than forty seconds of walking.

Then the sweep, at station 4, with `look`:

| slab, half-extents | 12 × 7 | 18 × 11 | **26 × 16** | 40 × 25 |
|---|---|---|---|---|
| pressing | 27.0% | 20.6% | **12.7%** | 0.0% |
| and `wander` | 77.2% | 68.3% | 49.6% | 28.5% |

**Two to three times the old slab, not seven.** The six outdoor stations ship at 26 × 16 — the first size in the
sweep that comes under the fifth M3 pre-registered, with a bar that was set three milestones before this sweep
existed. What it costs is a thin far field, and the number for that is M3's own: the plain is a quarter of its own
density six metres out and this walks to twenty-six. The interiors keep their rooms and the corridor keeps its
corridor, because in those the volume is the thing itself. `wander` still fails everywhere and always will.

**The roads had become the piece.** Nine of them at M4's flat sixteen seconds each is **144 seconds of going
somewhere against 102 of painting** — more than half the τ axis — and worse, it says every gap in his life is the
same size. He left Paris on 19 February 1888 and was painting in Arles the week after; between Nuenen and Paris
there are ten months this piece shows nothing of. A road is now as long as the months it crosses, four seconds at
least because two stations whose dates overlap still stand six hundred metres apart, twenty-four at most: **22, 4,
6, 8, 4, 10, 13, 15 and 4 seconds**. The roads fall to 40% of the axis and the longest of them is the one with the
most missing life in it. The metres stay at six hundred, which answers a question about the paint rather than about
time — a station's own plain runs to 260 m and two must not stand inside each other — so the speed on a road is
whatever those two facts require and is not a quantity this piece means anything by.

**Station 9's widening frame does not fall out of the geometry, and it happens anyway for a different reason.**
DESIGN 7's claim is causal: the canvases go double-square at Auvers, *so* the frame of the world widens. It does
not. A canvas is hung at a declared field of view — 50°, "a painter at an easel looking at the whole canvas at
once", named as the one free constant in the geometry since M3 — so a 2:1 canvas covers the same 50° of the world
as a 1.25:1 one and half the height. It gets shorter, not wider. What would produce the design's effect is holding
the painter's *distance* fixed instead of the angle, and M6 measures what the fixed angle implies about that
distance across all thirty canvases: **15 cm to 110 cm, a factor of seven.** Nobody paints a 14 cm panel from
15 cm away, so the fixed angle is a constant about the presentation and not about the painter, and it has never
claimed otherwise. Switching to a fixed distance would re-hang every station built so far — the Sower would go from
50° to 29.5° and its plain would run somewhere else — so it is named here and left to M9.

The frame does widen at station 9, for a reason the design did not give. Measured as the fraction of the horizontal
ring a station's paint covers: 19% at station 1, 42% at 3 and 4, 46% at 6, 14% at 8, **69% at station 9** and 14% at
station 10. Station 9 is the widest thing in the piece because he painted five canvases in nine weeks there and they
are all places, not because any of them is a double square. And then it shuts: the last station is one canvas and
14%, which is the narrowest painted station in the piece and is the right shape for an ending.

**There is no lamp at station 1, and there should not be one.** DESIGN 7 asks for a low dark room, one oil lamp,
five figures, and *you can barely see*. The lamp is in the painting. Putting a light source in that room would be
relighting a Van Gogh, which is precisely the mistake M5 caught and measured at station 5, where lighting built
surfaces by their own face normals ruled a bright band across the Bedroom at the wall–floor crease. The station is
dark because the canvas is dark, and the number is above: **lightness 11.9**, a quarter of the corridor's and a
fifth of the orchards'. It is also short, which is the other half of the risk-table row: 13,036 strokes, **6.5
seconds, 3.0% of the arc** — the shortest station in the piece that has paint in it.

Its room is authored, as M5 established a room must be, and this file says which of the six numbers came off the
canvas. Three did: the back wall's corners at 0.06 and 0.93, and the beams meeting it at 0.17. Two could not,
because the floor of that room is behind the table and is not in the painting: the row where the wall meets it, and
the row the window's axis crosses. Those two were chosen by running M5's arithmetic backwards until the room came
out the size a Brabant cottage room is — **4.63 m wide, 3.80 m deep, 2.59 m to the beams**, with the easel 2.23 m
from the left wall.

**The corridor is the one station where the walk and the scrub are the same axis by construction.** Six canvases
hung down a hallway, `along` increasing with the date, so walking forward is walking forward in time. Every one of
the six measures PRESENT on `tools/place.py`'s own test — a wall of paint with no horizon in it — which for once is
not an override but the reason the station works: DESIGN 7 asked for a hang and there is nothing here to stand
inside. It is also the only volume in the piece the `look` walker never pushes at.

**Nine things were wrong, and four of them were the same kind of wrong: something that worked because there were
three stations and stopped working at ten.**

1. **A missing blob ended the streaming queue.** `catch (e) { break; }` — with three stations and one directory of
   blobs that was invisible, because either everything was built or nothing was. With twenty-five canvases in ten
   directories, one missing file silently dropped **every canvas after it in τ order**. Found by having two of
   station 2's six not yet extracted and watching the other four fail to appear. A blob that does not arrive is now
   skipped, named in `vg.state.missing`, and counted in the streaming line.
2. **And the first blob failing was fatal.** `pull(0)` had a hard failure path, correctly, when the first canvas of
   the piece and the only canvas of the piece were the same thing. Now it is the first canvas of station 1, and one
   missing file there took the whole arc down with a message about running a web server. It tries each in τ order
   and fails hard only when *nothing* loads, which is what rule 2's failure path is actually for.
3. **`first = canvases[0]` in the debug API.** With index 0 allowed to be a hole, the `vg.state` getter threw on
   `first.blob` — so the page rendered perfectly, at 60 fps, with every measurement in the harness gone and
   `tools/shot.py` reporting only "the page did not reach window.vg". The most expensive twenty minutes of the
   milestone, and the fix is `canvases.find(c => c)`.
4. **The eased return ignored the volume's centre.** M5 added an offset volume and taught `edgeDist` about it; the
   line that actually pushes the body back still measured from the origin. Every station whose volume is centred
   anywhere else — the Bedroom, the corridor — measured one boundary and enforced another. This is the one that
   retracted a published number.
5. **The profile control returned linear light where its caller wanted sRGB bytes.** `as_if_adobe` converted into
   linear sRGB and handed that back to be decoded as sRGB again, so every canvas appeared to move 22 to 29 units in
   a plane where the whole flood is 39.6 and the honest bound is 9.2. It would have made the audit fail. Caught
   because a bound larger than the effect on *every single canvas* is not a bound, it is a bug.
6. **Two accession numbers in `tools/sources.tsv` were wrong**, and both were found by asking a holder for a date
   and being answered with an identifier that did not match. The Kröller-Müller publishes the *Café Terrace* as
   **KM 108.565**; this repository said KM105.462. Joconde's **RF 1954 15** is *Le jardin du docteur Gachet*, a
   portrait canvas; *Chaumes de Cordeville* is **RF 1954 14**. In both cases the scan's own aspect confirms the
   picture is the one named, so the number was wrong and never the image. The filenames under `ref/originals/` keep
   the old numbers, because renaming one changes a source path, which changes a params hash, which rebuilds a
   canvas to fix a string.
7. **Eleven params files carried forty identical copies of the same numbers**, and four of them said so in their own
   notes — *"borrowed rather than re-tuned … if this canvas ever needs its own, that is a finding"*. Thirty canvases
   would have carried thirty copies and the next re-tune would have been thirty edits. `params/_base.json` holds
   them; a canvas file holds its slug, its scan, its size and its regions, and anything it overrides is the only
   tuning in it and reads as tuning. The merged dict is what gets hashed, so **all eleven hashes are unchanged and
   no blob moved**.
8. **The band's ten station marks were a second list of dates** beside the station files' own spans, and they had
   already drifted — station 2 marked June 1886 against a span starting March, station 5 marked 20 September against
   18 August. Two lists of the same dates is how a station's tick
   ends up somewhere its own fill does not reach. The marks now come from the spans, with the old list kept only for stations a partial build has
   not loaded.
9. **The 1:1 regions were about to be picked nineteen times by eye.** M0a picked the Reaper's three by looking at
   the canvas, which was right for one canvas and is nineteen chances to pick a flattering one. `tools/tiles.py`
   picks two — the window carrying the most band-pass energy at stroke scale and the one carrying the least — from
   an eighth-scale decode, in seconds.

**And one thing that is not a bug and is worse: a blob can be stale and say so to nobody.** The header records the
scan's hash and the params' hash, so staleness is a fact about the artifact rather than a timestamp — which is right,
and misses the pipeline itself entirely. M4 fixed a colour decode in `tools/order.py`, in exactly two lines, both of
them feeding the solver its stroke colours; the commit that carries that fix also carries the goldens, and the
goldens were accepted from blobs built earlier in the same session. **Nothing was ever force-rebuilt afterwards**,
because `make.py` correctly found every blob up to date with its source and its params — which had not moved, because
the code is in neither hash.

M6 force-rebuilt all eleven canvases older than itself, and five of the goldens moved:

| | colour | relief |
|---|---|---|
| *Wheatfield with a Reaper* | 0.00624 | 0.01248 |
| *The Harvest* | 0.00560 | 0.01018 |
| *The Sower* | 0.00366 | 0.00712 |
| *Self-Portrait 1887* | 0.00174 | 0.00572 |
| *The Starry Night* | 0.00386 | 0.00725 |

Every one of those canvases comes back with **the identical stroke count, the identical coverage, identical geometry,
identical colour and identical height** — and a different order. The difference image is a scatter of individual
stroke-shaped patches, two or three pixels at the median, over between a third of a percent and two percent of the
canvas — the Self-Portrait least, the Reaper most — which is precisely what marks swapping over and under their
neighbours looks like, and the bare canvas between the strokes is the same pixels in every one. Two consecutive
rebuilds of the same canvas are byte-identical, so the pipeline is deterministic; it was the code between the golden
and today that moved, and the golden is the thing that was stale.

The canvases M5 built — the three Bedrooms and the Sunflowers — were solved **after** that commit, so they should not
move, and they do not. M4's own three split along the same line: the Irises and the Olive Grove hold to the pixel, so
they were solved after the fix, and the Starry Night, which that session had solved before it, moves with the four
older canvases. And the direct test: put the `/ 255` back into those two lines of today's `order.py`, rebuild the five
in a scratch directory, and **all five come back identical to their old goldens** — colour and relief, RMS 0.00000,
every one — so nothing else that has changed in the tools since M4 reaches them. That is the check that makes this a
diagnosis rather than a story.

`tools/make.py --check` now lists blobs older than the tools that write them. It is a modification time and not a
hash, so a checkout resets it. After the rebuild it lists seven blobs, all seven the M0a-to-M2 builds in their
milestone directories, which no station loads and which are exactly as old as it says. The real fix is the
pipeline's own hash in the blob header, which costs a rebuild of everything to install and is named below rather
than done.

**And a trap that was four seconds from being sprung.** `tools/make.py <slug>` without `--shell` or `--room` rebuilds
a canvas without the stage whose input is a station file, and produces a perfectly valid blob with no depth in it and
nothing downstream that complains — the station just quietly stops having a middle distance. The first version of
M6's rebuild script omitted both flags and was killed after the first canvas. `make.py` now refuses to rebuild a
canvas whose existing blob carries `shell` or `room` unless the flag is there.

**Verified.**

| | measured | |
|---|---|---|
| τ from 0 to 1 without leaving the piece | all ten stations entered, over 600 samples of `vg.arc()` | exit criterion 1 |
| the date across the arc | April 1885 → July 1890, monotone except twice | station 6 overlaps 5 by **42 days** and 10 overlaps 9 by **12 days**, because he painted both at once |
| the flood against a profile mismatch | **4.3×**, and **4.7×** inside one museum | pre-registered 3×, committed before station 1 existed |
| station 1's darkness | lightness **11.9** against the corridor's 51.5 | exit criterion 2 |
| station 1's length | **6.5 s, 2.6%** of the arc, one canvas | exit criterion 2 |
| the stations' lengths | 6.5 s to 23.9 s of paint; the roads 34.4% of the axis | exit criterion 3 |
| `?flat` parity against `tools/flat.py` | RMS **0.0476** at 1272 px | M5 0.0476, M4 0.0472 |
| goldens, thirty canvases | identical | five re-baselined for M4's order fix, explained above; the other six older canvases held |
| `?still` twice, mid-station | byte-identical PNG | seed 18531890 holds |
| Balanced, worst over the whole arc | **1.27 M triangles, 25 draws, 3.4 ms submit, 10.3 ms GPU, 60 fps** | budget 2.5 M and 120 |
| strokes resident | **315,638** over 30 canvases | budget 400 k |
| blob per station | 0.29 to **1.15 MB** | ≤ 6 MB |
| params discipline | 30 files, **not one override** | the base holds everywhere |
| the station audit | 10 stations, 7 canvases outside their span, every one with a note | `tools/station.py` exits 0 |

**Still visible, and named rather than fixed.**

- **A `wander` fails every volume in the piece and always will.** Forty seconds of walking in a straightish line is
  not something any bounded place absorbs. The number that matters is `look` and it is under the bar at the six
  outdoor stations; at the two interiors and the corridor the volume is the room or the hallway and there is nothing
  to size.
- **The room at station 1 has two of its six numbers invented**, and unlike station 5 it is not the ceiling — it is
  the floor. The Potato Eaters' floor is behind the table and is not in the painting, so the row where the back wall
  meets it, and the row the window's axis crosses, were chosen by running the arithmetic backwards until the room
  came out the size a cottage room is.
- **DESIGN 7 asks for two chairs at station 5, a shell at station 6 and snow at station 3**, and gets none of the
  three. The chairs and the shell are work this milestone chose not to do; the snow is a canvas — *Landscape with
  Snow* — that is in DESIGN 8.2's list and was never in `tools/sources.tsv`, so it was never fetched. That is the
  one gap here that is a hole in the material rather than in the build.
- **The bright specular on near paint at station 1.** A built room puts the canvas's nearest strokes half a metre
  from the eye, where a ray normal faces the viewer head-on and the tight lobe is at its strongest. In a canvas this
  dark the few marks that catch it read as white. It is the correct behaviour of a lighting model chosen at M5 for
  good reasons and it is conspicuous exactly once, here.
- **Every canvas's rectangle still has hard edges**, and at station 9 — five lifted canvases around one standpoint,
  covering 69% of the ring — the gaps between them are more conspicuous than anywhere else in the piece.
- **`tools/make.py --check` knows a blob's age only by its modification time.** Today it lists seven, the M0a-to-M2
  builds that no station loads, and is right about all seven; but a checkout resets a modification time, and a blob
  built before a fix and touched since would pass. The real fix is the pipeline's own hash in the header, which costs
  a rebuild of everything to install and is named here rather than done.
- **The goldens are 55 MB.** Thirty canvases at two 1200 px images each, and every legitimate re-baseline adds
  another 55 MB to the history. The regression is worth it and the cost should be looked at once more at M9.
- Everything M5 left open that M6 did not touch: the ceiling invented in three Bedrooms, a stroke stretched around a
  room corner, two Saint-Rémy canvases on Arles cloth, the depth buffer at the dome, the Starry Night's tacking
  margin, the Harvest's lopsided acts.

**Not started, per scope.** The letters — `text` is null in all ten station files and M7 owns the verification. Sound.
The far LOD tier, which the resident-stroke row will need before the piece has its full 550,000. Station 11, the
coda, and station 7's beat beyond the fact that it exists — M8 owns both and expects to get station 7 wrong twice.
The two chairs, *Van Gogh's Chair* and *Gauguin's Chair*, both fetched and neither extracted. The other four
*Sunflowers*. Committing a station's blobs, which `.gitignore` says happens once a station is frozen and M6 freezes
none.

### M7 — The voice and the brush

**Asked.** The letters, DESIGN 9: one line from his own letters per station, two at most, every quotation verified
against `vangoghletters.org` by letter number and date before it ships and cited in `letters/`, nothing from memory.
The sound, DESIGN 10: the brush — a stroke laid has a sound, four thousand of them a roar, from the direction the
paint is arriving from — off by default behind one button. Exit: every line traceable to a letter number and
checkable by a stranger; every quotation in the DOM as text for a screen reader; a burst felt, and the silence after
it enormous.

**Built.** `tools/letters.py`, which reads the edition's pages for each station's letter and is now the only way
text gets into a station file, and `letters/`: the record it writes, `letters.json`, and a `README.md` that says how
to check it and whose words these are. Nine lines in nine station files. In the runtime, DESIGN 11's letter —
centred low, italic, the citation beneath in very small type — arriving once the caption has had its four seconds,
`aria-live`, with all nine in a list in the DOM whatever τ is; and the brush, with the one corner button and M on the
keyboard. `tools/listen.py`, which plays a station headless from bare canvas with the brush on, records what came out
on the audio context's own clock and measures it; `tools/shot.py` learns `--wav` to carry the recording back.

**Seven of the nine citations were wrong, and they were wrong before anything was quoted.** DESIGN 9's rule is that
no line goes in from memory, and M3 kept it by leaving `text` null and writing only a citation — a letter number, a
recipient and a date. Those were typed from memory, which is the same mistake one step earlier: it would have sent
this milestone to the wrong letter for a right-sounding line at seven stations of nine. The edition's index settled
each in one request:

| station | M3 to M6 said | the edition says |
|---|---|---|
| 2 | 569, to Wil, 1 October 1887 | 569 is to **Horace Mann Livens**, Paris, September or October 1886 |
| 3 | 590, to Theo | 590 is to **Wil** |
| 4 | 628, to Theo, 12 June 1888 | 628 is to **Émile Bernard**, on or about 19 June |
| 6 | 678, to Theo, 8 September 1888 | 678 is to **Wil**, 9 and about 14 September |
| 8 | 782, 19 June 1889 | on or about **18** June |
| 9 | 898, 2 July 1890 | on or about **10** July, to Theo **and Jo** |
| 10 | 902, 10 July 1890 | **23** July |

Four to the wrong person and three on the wrong day; stations 1 and 5 were right. So the recipient, the place and
the date in a station file are now written in by the tool from the edition's own words and never typed, and a person
chooses only the letter, the paragraph, the words and the canvas.

**And the edition says which canvas a line is about, which DESIGN 9 did not think to ask.** "Appearing in the air as
you reach the canvas it describes" was a judgement until the edition's notes turned out to identify every work a
passage discusses, by catalogue number, holder and size. So `tools/letters.py` checks that the canvas a line stands
at is one the edition's own note says the passage is about — within two paragraphs of the line, and matched on the
holder, the title and the size together, because each alone names a crowd: the Van Gogh Museum holds five canvases in
this piece within two centimetres of 73 × 92, which is a size-30 off the shelf, and a holder-and-size match would
have hung the Harvest's line on the Reaper. The sizes are allowed a twentieth apart because they are two authorities
measuring one object — the edition gives the *Night Café* as 70 × 89 cm and Yale, whose figure this repository has
used since M6, as 72.4 × 92.1 — and the record says so wherever they differ by more than two centimetres. Six of the
nine lines are tied to their canvas that way:

| station | letter | to | date | at | the edition's note |
|---|---|---|---|---|---|
| 1 | 499 | Theo | on or about 2 May 1885 | *The Potato Eaters* | F 82 |
| 5 | 705 | Theo | 16 October 1888 | *The Bedroom* | F 482 |
| 6 | 676 | Theo | 8 September 1888 | *The Night Café* | F 463 |
| 8 | 782 | Theo | on or about 18 June 1889 | *The Starry Night* | F 612 |
| 9 | 879 | Wil | 5 June 1890 | *The Church at Auvers* | F 789 |
| 10 | 898 | Theo and Jo | on or about 10 July 1890 | *Wheatfield with Crows* | F 779, with F 778 |

and three are about a run of days rather than one canvas — the corridor (569), the orchards (594), the week of the
harvest (627) — and say so in a `why` that the tool checks is true: no note within two paragraphs of any of them
names a canvas its station has. The same test took three of DESIGN 9's own subjects away from the stations they were
meant for, each for a reason the design would accept. The mistral pegging his easel to the ground is letter 628, and
the edition's note puts that painting at Winterthur. The pink peach trees "painted with a certain passion" are the
Kröller-Müller's *Souvenir de Mauve*, not the Van Gogh Museum's peach tree at station 3. And the sunflowers painted
from sunrise are the August 1888 canvases, while station 5 stands the January 1889 repetition — M6's finding, arriving
again from the other side.

**Two of the nine are his own words.** He wrote to Livens and to Russell in English, so those two lines are checked
against his original and not a translation; the other seven are the edition's English, and `letters.json` carries
the paragraph he wrote beside each. The edition publishes its source files under CC BY-NC-SA 4.0, and `letters/`
says that the quotations are used on those terms and are not MIT.

**The letter waits for the caption.** The first version appeared 1.4 s after arrival just above the hint line, and a
screenshot of the page as a person sees it put it on top of both the hint and the long captions this piece writes.
It now sits in the lower third and arrives at 4.4 s, as the caption fades: the plaque first and then his words, never
the two in the same seconds. **A still is still a still**: `?still` shows no letter unless `?letter` asks, and M6's
reference frame — which happens to stand at the Bedroom, a letter's canvas — is byte-identical after M7, before the
brush went in and after.

**The brush is noise shaped by the record.** Nothing in it is a recording. Each frame, the strokes that crossed the
scrub are counted chunk by chunk, and that count is the whole of the input: the rate sets the loudness, ten decibels
for every tenfold because the strokes are incoherent, compressed past the 2,000-a-second burst so that a hand on the
scrub thirty times faster is louder but not thirty times louder; the chunks they fell in, weighted by how near they
are, give the direction, and an HRTF panner puts it there. Under a few hundred a second the single strokes are
audible on their own — high-passed noise rippled at the rate a brush crosses threads, with the knock of oil letting
go of the hair at the front — and above that they are grain in a roar. When nothing arrives the bed falls with a
30 ms time constant and is set to zero at 250 ms: not a tail, not a floor, not a room. The noise is seeded, so two
runs of the harness hear the same brush.

**The silence is exactly zero, and the roar comes from where the paint is.** `tools/listen.py` plays a station from
bare canvas with the brush on and keeps the output sample for sample, on the context's clock — the recording and the
page's log agree to within 6 ms on the first stroke. Three stations, chosen for paint on both sides of the head:

| | burst, dBFS RMS | peak | holds | exact zero after the last stroke | off-centre frames louder on the paint's side |
|---|---|---|---|---|---|
| 2 the corridor | −25.9 (never sustained) | −8.9 | 9 | 265 ms median, 278 ms most | 14 of 14, paint at −32°: left ear +5.2 dB |
| 4 the Harvest | **−16.0** | −3.8 | 5 | 272 ms | 21 of 21, paint at −68°: left ear +5.9 dB |
| 6 the night of Arles | **−13.9** | −1.0 | 7 | 272 ms median, 278 ms most | 278 of 278, paint at +60°: right ear +6.5 dB |

Every hold is zero from the moment it falls until the next act begins. The instrument's first answer said one of the
Harvest's holds never went silent at all, and the recording said it did: the window had run on into the next act's
attack. It now stops 60 ms short of the next act, and the WAV and a picture of its envelope go beside every run.

**Verified.**

| | measured | |
|---|---|---|
| every line against the edition | 9 of 9, 6 at the canvas the edition's note names | `tools/letters.py --check` exits 0; exit criterion 1 |
| the citations M3 to M6 typed | 7 of 9 wrong | replaced from the edition's own metadata |
| every quotation in the DOM | 9 of 9, verbatim, in `#letterlist` | exit criterion 2 |
| each letter at its canvas | 9 of 9 `?still&letter` frames show exactly their own line | `vg.state.letter` |
| a burst | −16.0 and −13.9 dBFS RMS at stations 4 and 6 | exit criterion 3 |
| the silence | 21 of 21 holds exactly zero within 280 ms | exit criterion 3 |
| the direction | 313 of 313 off-centre frames louder on the paint's side | DESIGN 10 |
| `?still` at the Bedroom | byte-identical to M6's, `01337c1d` | twice |
| `?flat` parity against `tools/flat.py` | RMS **0.0476** at 1272 px | M6 0.0476 |
| the brush's cost | 60 fps, 1.5 to 2.3 ms submit mid-burst, Rich | nothing to see |
| the station audit | 10 stations | `tools/station.py` exits 0 |

**Still visible, and named rather than fixed.**

- **Nobody has listened to it.** Every number above is about a recording, and whether a person hears a roar or a hiss
  is in none of them. `tools/listen.py` makes the WAV; a person has to judge it.
- **The harness cannot see a letter.** `vg.snap()` is the WebGL canvas and the letter is DOM, so every frame
  `tools/shot.py` takes is a frame without his words in it. The screenshot that found the collision above was
  Chrome's own `--screenshot`, which writes its file and then does not exit. M9's photo mode has to decide whether a
  photograph carries the line.
- **The hint line and a long caption overlap** at 1200 px whenever the caption is up. The hint is permanent where
  DESIGN 11 asks for a single line on first load; that is M9's.
- **The licence rests on the edition's source files.** The edition releases those under CC BY-NC-SA 4.0 and its web
  pages say all rights reserved, and `tools/letters.py` reads the pages. The XML itself, `vangoghxml.zip`, 9.6 MB, is
  the licensed artefact, and reading the lines out of it instead is a small change that needs the download.
- **Station 10's line is M8's to keep or cut.** It is the one sentence the edition ties to *Wheatfield with Crows*,
  and it stops before the half that says what he was trying to express, because DESIGN 9 asks for the working painter
  and not the biography; what the ending means is M8's to get right.
- **The corridor is quiet** — ten decibels under the Harvest and the night, because its canvases are small and its
  acts short. That is the record, and it may be right; it may also want to be louder.

**Not started, per scope.** The mistral, the cicadas and the rooks, deferred until the brush has been lived with.
Station 7's beat, which the brush now cuts with and M8 has to make land, and stations 10 and 11. Photo mode, the
accessibility pass and the performance pass, M9's.

### M8 — The two beats, first attempt

**Asked.** Station 7 and stations 10–11, DESIGN 7: the painting stops mid-canvas, the brush cuts, the scrub refuses
to advance for a beat, and no ear, no blood, no razor; then the rush with no holds, the crows that have been in the
corner of the eye since Arles, and nothing, held far too long. Exit: station 7 tested on people who do not know the
design; the ending something the viewer did, because the scrub is in their hand; the coda decided — nothing, or the
canvases in their museums.

**Built.** A canvas that stops: `stop` in a station file is the fraction of a canvas's own strokes the piece lays, its
share of τ is that part, and what is past it is never laid. The refusal: a gate at the end of any station whose
pacing says `refuse`, which every way forward goes through — the arrows, the wheel, the band, the slider and the
playing — and which holds for that many seconds of the viewer's own time, arms again when they go back before the
station began, and keeps a log of what they did there, `vg.beats()`. The brush learns to be cut rather than to fall.
The readout gains a day at the gate and loses its date at the end. The scrub playing itself stops at the last stroke of
the last field. Station 11, a station file: bare primed canvas, no charcoal line, `pacing.nothing` seconds of nothing,
then its crows. The crows: `tools/crows.py`, which finds them in *Wheatfield with Crows*' own record and writes
`stations/crows.json`, and the runtime that stands them in the world. `tools/beat.py`, which meets the gate and the end
with scripted hands in headless Chrome, and for it the page learns `?begin`, `?trace` and `?hand` and opens at τ 0.
`tools/station.py` and `tools/letters.py` read only station files, now that `stations/` holds the crows as well, and
`station.py` counts what is laid. And the cloth under every canvas is placed relative to the camera, as the strokes
always were — which is a fix to every station but the first, below.

**The painting that stops is the one that did.** M6 read DESIGN 7 as a station with nothing in it, and a station with
nothing in it cannot stop anything. The edition says what was on the easel. Searching its letters from November 1888 to
April 1889 for the Berceuse finds letter 743, to Theo, 28 January 1889, and that passage's own note leads back to
741, 22 January, which calls it the portrait of Roulin's wife: in both he says it was the canvas he had been working on
when his illness interrupted him, and the notes to both name it: **F 504 / JH 1655, Kröller-Müller Museum, Otterlo.** The notes name the other four
versions too, and that settled which one this repository already had. The *La Berceuse* in `ref/originals/` since the
sources were gathered is **F 507**, the Stedelijk's, the fifth — and it is not a scan but a gallery photograph of the
picture in its gilt frame, which `tools/canvas_edge.py` cannot find the painting inside, because a frame is not a
quiet border. The Kröller-Müller serves F 504 through Micrio at 4800 × 6077, 66 px/cm. Fetching it is a download this
milestone has not been given, so station 7 stands a stand-in, cropped by hand to its painted area — at an aspect
within a tenth of a percent of the edition's size, so the photograph was taken square on — and says so in the station
file, in `params/berceuse.json` and in CREDITS. Two glare streaks near its top edge are traced as paint. He finished
F 504 in January and painted four more; the piece shows it stopping, and leaves the rest to the road to Saint-Rémy,
which is January to May 1889 and has nothing on it.

**M6's refusal met only the hand that did not need one.** It held the scrub on the way into station 7 when the scrub
was playing itself; the arrows, the wheel, the band and the slider went through December 1888 like any other month. A
refusal the viewer's own hand never meets is not a refusal, so every way forward now goes through one function, and the
first move across the gate, by any of them, lands on it and stays. A click on the band at Auvers lands on the gate
instead of Auvers. A push against it nudges the knob four pixels and lets it back, so that a hand meets a refusal
rather than a page that has stopped. After the beat it opens: if the scrub was playing it plays on, and a hand's next
push goes through. Going back before the station began arms it again, because it is a fact about the date and not an
event that gets used up.

**Where it stops.** Half its strokes, and the number claims nothing: nobody knows how far he had got, and the record
says in what order the canvas was painted, not where he was in it. The order found one long act for almost all of
this canvas, so any stop is in the middle of one. `tools/flat.py` at 0.35 is a face not yet begun, at 0.5 a face
arriving, at 0.7 one nearly done; 0.5 is where the canvas is plainly a portrait and plainly not finished. The strokes
in the last hundredth before the stop are left part-way along their own length, because that is how an arriving
stroke is drawn, so the brush has stopped in the middle of marks as well as in the middle of the canvas.

**The cut was not a cut, the first time.** The brush fell after the stop exactly as it falls after every act, to zero
279 ms after the last stroke, because the gate cut it and then, in the same frame, the stop's own last strokes arrived
and lifted the cut. It now stays cut until the gate opens or the viewer goes back: **8.0 ms to exact zero**, taking
everything the brush is making, the strokes already scheduled a frame ahead included.

**Station 7's canvas vanished behind its own underlayer, and every station but the first had been losing paint the
same way since M4.** The first frame of station 7 at its stop showed the Berceuse as a blur: 3,404 strokes counted as
drawn at the near tier and not one of them on the screen. Loaded alone with `?station=7` the canvas painted perfectly,
and so it did with the stations sixty metres apart, and six thousand; it was only at the piece's own spacing that it
went. What cared where it stood was the cloth's vertex shader, which took every vertex through its world position — a
32-bit coordinate of kilometres — while a wall's cloth hangs a quarter of a millimetre behind its paint. The strokes
were always placed relative to the camera, and the cloth never was. With the cloth placed the same way, station 7
paints; and rendered finished from its standpoint, before the fix and after it, every station but the first moves:

| station | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| metres from the origin | 0 | 600 | 1,200 | 1,800 | 2,400 | 3,000 | 3,600 | 4,200 | 4,800 | 5,400 |
| pixels of the frame that change | 0 | 1.0% | 5.6% | 4.0% | **24.2%** | 5.1% | 12.5% | 4.8% | **33.3%** | 16.7% |

What changes is paint arriving where the cloth had been in front of it — most where the paint lies closest to its
cloth, a room or a wall or a canvas seen close, and never at station 1, which stands at the origin. So every frame of
the whole piece taken since M4 put two stations six hundred metres apart has been missing some of its paint, and no
single-station frame ever was, because `?station=N` puts its one station at the origin. M6's reference frame at the
Bedroom is one of the frames that was missing paint: it came back byte-identical with all the rest of M8, and the fix
moves it by RMS 0.049, all of it strokes the old frame did not have.

**The ending is something the viewer did, by construction.** While space could play the piece to its last frame, the
ending was something the viewer let happen. So the scrub playing itself stops at the last stroke of the field — past
it there is nothing to paint, so nothing for "let it paint itself" to do, and space there does nothing — and what is
past it is station 11, the last stretch of τ: the road out of the back of the field, which goes dark behind you, and
then bare primed canvas, lit, with no charcoal line on it and no date on the readout. Twenty-four seconds of nothing,
in the viewer's own time and starting again if they leave, and then the crows. The page opens at τ 0 now, on primed
canvas, because the other end is the ending and nobody should arrive there by opening it.

**The crows are his.** `tools/crows.py` finds them in the Crows canvas's own stroke record by three tests with every
number written down: *black* — under 0.20 in every channel, within 0.08 of grey, and neither the sky's blue-black nor
the field's green-brown; *standing out* — at least 4× darker than the median of the paint within 1.5 cm that is not
itself black, which drops the top of the sky, black on black at 0.7 to 2; and *in the air* — above 0.6 of the canvas's
height, a test chosen after looking, because the shadowed edge of the near field passes the other two. **32 birds of
108 strokes**, and drawn over the scan every one of them is a crow. The rule misses the smallest birds against the
darkest sky in the top right, about a third of the flock, and says so. In the world a bird is its own strokes as flat
ribbons, facing whoever looks at it, at the angle it has in the painting — a degree and a half to three and a quarter —
and nearly twice that at the end, flying a slow circle a long way out and a little above the horizon, in the unpainted sky of its station: every
canvas takes its own width and twelve degrees more out of that sky, and the birds keep to what is left, at the edges of
the paint first and then behind. One at station 3, two at 4, 8 and 9 — at Auvers only behind you, because five
canvases leave nothing else — three at 10, and nine at the end. The painted crows in the last field are paint and stay
where he put them; none of these ever comes out of a canvas, which is the one thing the projection shows do with them.

**What the stills show.** Station 7 stopped: the contours laid, half the face and the dress, the ground he painted
on showing between, and the readout on 23 December 1888. The end: bare primed canvas and nothing on it, then black
marks circling over it which, at the distance they fly, are exactly what they are in the painting: a few strokes of black
and not birds anybody modelled. At the stations since Arles a crow faced directly is a small dark mark over dark
cloth, and at the edge of the frame a smaller one. The smallest of the thirty-two were specks there at the angle the
painting gives them, so the ones that fly are the thirteen that are three centimetres or more across; the rest stay
in `stations/crows.json`, and in the painting. Whether anybody sees one at the edge of the frame is the protocol's
question and not the stills'.

**Verified.**

| | measured | |
|---|---|---|
| the gate, playing | arrives in the middle of a burst, 1,807 strokes a second; held **6.016 s** against 6; goes on by itself | `beat.py play` |
| the cut | **8.0 ms** to exact zero, and zero for the 5.99 s of the beat recorded | `beat.py play` |
| the gate, the right arrow held | held **5.983 s**, the arrow down for 6 s of it; the same hand then reaches τ 1 | `beat.py hold` |
| the gate, the wheel | held **6.050 s**; 22 turns refused of about 23; the first turn after it opened went on, 0.07 s later | `beat.py wheel` |
| the gate, the band | a click on Auvers lands on the gate, τ 0.650980 | `beat.py jump` |
| the playing | stops at the field's last stroke, τ 0.981757, and not at 1 | `beat.py end` |
| the end | a hand reaches station 11; no crows at 17 s; all nine by 41 s | `beat.py after` |
| M6's reference frame | found at τ 0.4551039 — the same moment of station 5, by where it is in the station rather than by τ, because station 11 and a stopped canvas moved every τ in the piece: **byte-identical to M6's and M7's `01337c1d`** with everything in M8 but the cloth fix, and with it re-baselined at `6df366ea`, RMS 0.049, every pixel of which is paint the old frame did not have | `?still` |
| the station audit | eleven stations; station 7 is 1.7 s of making, the whole arc 246.9 s | `tools/station.py` exits 0 |
| the letters | nine lines, nothing wrong | `tools/letters.py --check` exits 0 |

**How to test station 7 on a person, which is the exit criterion and the one thing no script here can do.**

- **Who.** Three to five people who have not read DESIGN or this file and have not been told what station 7 is. Some
  who know his life and some who do not; the two groups can fail it in opposite directions.
- **Where.** The dev Mac, the page served as always (`python3 -m http.server 8710`), full screen,
  `index.html?begin=5` — the Yellow House, about a minute and a half before 23 December 1888 — or `index.html` for the
  whole piece if there is time. Headphones on the table; say the corner button is the sound and leave it to them.
- **What to say.** Only this: *this is a piece about Van Gogh's paintings; the arrow keys or the scroll wheel move
  through time, and W A S D walks; take as long as you like.* Nothing about a stop, a date, or what happens.
- **What to watch.** At the portrait of the woman in the chair: whether they push against the refusal and how, whether
  they stop pushing and wait, whether they go back, whether they reach for reload or say it has frozen, what they say
  unprompted. Afterwards `vg.beats()` in the console has each arrival: how it came, how many pushes, how long the
  arrow was held, whether they left before it opened, and how long after it opened they moved on.
- **What to ask, after, in this order.** *What happened at the portrait of the woman?* — *Did anything seem broken?* —
  *Was anything too much, or too little?* — and only then, to those who know his life: *did the date mean anything?*
- **How to read it.** Too coy is a bug: they reload, or say it froze, or never connect the stop to anything. Too
  literal is a biopic: they name the event before anything on the screen has, or say the piece became about it.
  Landing is in between: something stopped, they noticed, they waited, and they went on differently.
- **What attempt two can move,** each a number in `stations/s07-the-strokes-stop.json` or one line in `index.html`:
  the beat (`refuse`, 6 s), where the canvas stops (`stop`, 0.5), the day on the readout, the nudge of the knob, the
  plaque, and the cut.
- **The same people, at the end.** Whether they push past the finished field at all, how long they stand in the
  nothing before the crows or before they leave, and whether they saw the crows before — "in the corner of the eye
  since Arles" is true only if somebody says so afterwards without being asked about crows first.

**A bug from M0a, found by the author at the first look.** The second click on the canvas put up *The page
stopped.* over a piece that was still running. DESIGN 6 asks for drag to look and click for pointer lock, and M0a's
`pointerdown` asked for pointer capture on every press; capture under a held lock throws `InvalidStateError`, and the
page's catch-all showed it as the failure screen. Capture is now skipped under a lock and can no longer throw, and the
lock's promise, which a refusing browser rejects (the in-app pane refuses it outright), is caught. It lived this long
because nothing here has ever sent real input: `tools/shot.py` has no protocol client by design, and the pane refuses
the lock. Checked with real input in headless Chrome over the DevTools protocol, from a throwaway driver on Node's own
WebSocket: before the fix the second click stopped the page with the author's exact message; after it the lock held
through a second and a third click with no exception, a 100 px drag turned the view by 0.22 rad and 100 px back under
the lock returned it to 0, the pane's clicks leave the console clean, and M6's reference frame is still `6df366ea`.

**A walk with a pair of hands, and what it met.** After the second click the author asked for a real walk and for
the glitches it found to be fixed: the whole piece from bare canvas to the crows, with real input in real Chrome —
keys held the way a person holds them, with the repeat a keyboard sends, the mouse, the wheel, the band — and a
screenshot and the page's own numbers at every step. The in-app pane can neither hold a key nor take the lock, so it
ran in headless Chrome over the DevTools protocol at 1440 × 813 CSS px and twice the pixels, 60 fps throughout. Past
the second click it met seven things, and all seven are fixed:

1. **Space and Z read every repeat.** A held key repeats, and both toggles took each repeat as a new press. Held for
   1.25 s, space turned play on and off eleven times and left it paused; Z bobbed the eye between lying and standing
   and left it standing. Both now ignore the repeat: the same holds change play once and leave it playing, and lay
   the viewer down, 1.69 m to 0.24 m, and leave them there. M had the guard already.
2. **R reloaded the first canvas.** A developer's key since M0a, one key from W and D and open to every viewer, that
   refetched station 1's blob and rebuilt a chunk of it. It is behind `?debug`.
3. **The refusal's nudge froze under the arrow.** A held arrow pushes on every frame and every push restarted the
   knob's nudge, so it sat on its first frame: in 54 samples of a held arrow at the gate the knob moved 0 px, where one
   push of the wheel moves it 4. A push now lands a new nudge only once the last has run, and a held arrow nudges the
   full 3.98 px, again and again.
4. **The light did not turn with the strokes that face the painter.** M5's fourth lesson turned a room's strokes — and
   a sky's, and a shell's — to face back down their own rays, so that a room would not relight the painting. The light
   stayed one direction fixed in the world, so a stroke facing up a ray on the left took almost none of it and one on
   the lower right took all of it and the sheen: from where he stood, the Potato Eaters' left and top thirds came out
   at 0.62 and 0.59 of the flat painting and its right and bottom at 1.07 and 1.09, the lower right in grey-white
   sheen; the Night Café spread 1.67×; the wheatfield's sky kept 86% of the painting's contrast with its ground. A
   stroke that faces the painter is now lit as the flat canvas is — the same light, in the frame that canvas would have
   hung square across its ray — and the spreads are 1.20× and 1.18×, which is the crop rather than the light, the
   sheen is gone, and the sky keeps 91%. Ground strokes and hung canvases are lit as they were. M6's reference frame
   moves by the Bedroom's few early strokes, mean 1.3/255 over 4.4% of its pixels, and is re-baselined at `0d7c416f`.
5. **Every room's walls could be walked through.** The eased return pushes back at 1.8 m/s against a walk of 1.45, so
   a viewer pushing a wall settles 0.81 of `ease` past the volume's edge, and every room put its walls nearer than
   that. Three seconds of pushing stood the viewer 0.42 m inside the Bedroom's plaster on either side, 0.22 m through
   the Potato Eaters' back wall, 0.29 m through its right one and 0.19 m through the corridor's near canvases.
6. **Running left every station for good.** Shift walks at 4.64 m/s, which the return never catches: three seconds of
   it carried the viewer 8 to 10 m out of any room, and three seconds after letting go they were still 2 to 4 m out.
   DESIGN 15's fear, never measured because nothing had ever held Shift.

   For both: the step outward now gives out past the edge and is gone at `ease` metres, judged by where the step would
   end, so a runner settles at most 0.72 of `ease` out and a walker 0.45; and the three rooms' `ease` is set by their
   own walls rather than by feel — 0.3 at the Potato Eaters, 0.65 in the corridor, 0.18 in the Bedroom, each written
   into its station file with the reason. Walking or running, the viewer now stops 0.12–0.19 m short of every wall.
   `vg.state.rooms` reports each room's walls, which is how those margins were read rather than guessed.
7. **The band's clicks went to the keyboard's slider.** DESIGN 11's control for the keyboard is a range input laid,
   invisible, over the band, and it took every click and every drag and read them as tau rather than as a date: a
   click on June 1888 asked for tau 0.79, which is past station 7, and landed on its gate in December. The band's own
   handler, dated by bisection, had never been reached by a mouse. The slider is the keyboard's alone now, and the
   band takes the click and, as its comment always said, the drag: a click on 20 June 1888 lands in the Harvest at
   tau 0.3734, a drag keeps the knob within 0.01% of the pointer, and a drag across station 7's gate is one arrival and
   no pushes in `vg.beats()`, however many moves it is made of. The wheel now takes the scrub from the playing as the
   arrows, the band and the slider do: pushed against the refusal with it, the final walk went on up the road the
   moment the gate opened, and its four views of the stopped canvas were of the dark.

The harness's lessons, because headless Chrome is not a pair of hands everywhere. Under the pointer lock, which it
grants only after `Page.bringToFront`, any key held with its repeat stalls the renderer for tens of seconds — the same
for Q, which the page ignores, and not at all without the repeat — so the walk looks by dragging, which DESIGN 6 gives
the viewer anyway, and the lock was verified on its own. And a key the page does not consume goes back to the browser
to look for a menu shortcut, which in headless Chrome on macOS segfaults in AppKit's menu validation
(`-[NSMenu _enableItems]`): twice, on Shift+S and on a held arrow. So the final walk scrubs with the wheel and walks
without the repeat, held arrows and Shift were measured with DOM key events, and a walk that loses its browser resumes
at the station it was in.


**Verified, with the fixes in.** The final walk went through the whole piece in one browser, 97 frames, and the
page threw nothing: no exception, no console error, no failed request, never the failure screen, 60 fps at the
median and 56.3 at the worst. Space held for 1.25 s changed the playing not once; every station paused on its own
last stroke; at station 7 six turns of the wheel nudged the knob its 3.98 px and the gate opened at 6.00 s; at the field
the last stroke stopped the playing and space did nothing there; the wheel reached the end, where there were 0 crows at
20 s, 9 at 37 s and 9 at 44 s; and space at the very end began again. Station 7 was walked again after the wheel was
fixed, and its four views of the stopped canvas are of the canvas. `tools/beat.py` holds 24 of 24, `tools/station.py` and
`tools/letters.py --check` exit 0, and M6's reference frame is `0d7c416f`. The frames and the before-and-after sheets went to
the author and live in the session's scratchpad; none of them is committed.

**Still open, and named rather than fixed.**

- **Nobody has met station 7.** Everything above is a mechanism doing what DESIGN 7 says; whether it reads as a bug, a
  biopic or a stop is the first exit criterion, and the protocol above is how to find out. M8 stays open until it has
  been done, and the design expects the answer to be *not yet* twice.
- **F 504 is not fetched.** Station 7 stands the wrong version from the weakest kind of source in the piece — 46 px/cm,
  glare traced as paint — and its plaque and its readout say 1889, which is the stand-in's date and not the one on the
  easel. Fetching the Kröller-Müller's scan is one row in `tools/sources.tsv` and one run of `tools/micrio_stitch.py`,
  about 10 MB into `ref/originals/`, and it waits on the author's word.
- **The coda is the author's.** Nothing is built, as DESIGN 15 has it; the museum coda is not.
- **Nobody has listened** — to the brush, since M7, and now to the cut.
- **Six seconds, half the canvas and twenty-four seconds are guesses**, each one number in a station file.
- **The crows since Arles are judged by stills.** Whether anybody sees them at the edge of the frame, and remembers
  them at the end, is the second half of the protocol, and the design's sentence about them is true only if somebody
  says so unprompted.
- **The Berceuse's goldens are a stand-in's**, committed as every canvas's are, and they go when it does.
- **The hint line still offers space** where space at the end does nothing. The hint is M9's.
- **The walk's driver is throwaway.** It lives in the session's scratchpad and not in `tools/`; M9's touch and
  accessibility passes will want one that stays, and the two ways headless Chrome fails a pair of hands, above,
  are why that is not a small job.
- **The date goes back six weeks on one road.** From the Yellow House to the night of Arles the band's date runs from
  October back to September 1888, 42 days, because station 6's September lies inside station 5's span: the knob steps
  backwards while tau goes forwards, and a click in those weeks has two answers, of which the bisection takes one.
  `vg.arc` says the arc holds if the date never goes backwards; here it does.
- **The Night Café can be walked out of.** It is a room inside an open station: station 6's volume is the two
  landscapes' 26 by 16 m, so the café's walls are not the volume's and nothing keeps a viewer inside them. A
  volume of its own, or a room you may leave, is a design question rather than a margin.

**Not started, per scope.** M9: measured quality, touch, photo mode, the accessibility pass, the performance pass,
the disclosure paragraph, `LICENSE`. The mistral, the cicadas and the rooks, and with them any voice for the crows.

### M9 — The refactor: a world, not a gallery

**What was asked.** After M8 the author opened the piece and said it plainly: you land on a grey zone; the controls
are not intuitive — walking forward is the arrow keys, not WASD, and ← → moved time; the visuals have no moment of
*this is incredible*; the app needs a significant refactoring. The M8 walk's own frames agree. Nine stations of ten
are canvases hung as flat rectangles in a dark grey void, the opening is primed canvas that stays grey until space
is held, and the arrow keys scrub τ.

**What was decided, on the author's word.** Three of this plan's founding decisions are reversed, and they are
named here so nobody mistakes the new runtime for the old one improved:

1. **The walk is the control.** Time is distance along one road, 90 m a station. ↑ ↓ walk, ← → turn, drag looks, the
   wheel walks, space walks on its own, Z lies down, 1–0 jump, and the line along the bottom is a map you can click.
   The scrub, burst-and-hold and the refusal at station 7 are gone as controls; station 7 is now a place where the
   paint thins back to bare cloth and charcoal.
2. **The world is painted everywhere, not only where a canvas was.** Rule 2 — nothing in the world that is not a
   stroke — no longer holds. There is a painted terrain under the marks and plain cores inside the houses and trees
   so the sky does not show through the gaps; `?noStrokes` would show a scene. The marks between the canvases are
   procedural, in each station's palette (sampled from the golden flats and pushed), and his paintings stand on
   easels by the road.
3. **The opening is the world painting itself, not a wait.** It starts on bare primed canvas, as §0 of the design
   did, and the sky, the ground and the first station are laid outward from where you stand in about five seconds,
   under the title.

**What was kept.** The stroke records. Every painting on an easel is his strokes from `strokes/sXX/*.bin`, laid in
the solved order as you walk up to it (13 s a canvas) over the extractor's underlayer. Also kept: the station files,
their dates and letters, the calendar, the crows from station 3 on, and the ending on bare canvas.

**What was built.** A new runtime in `src/`: ES modules, no build step, three r180 from the CDN as before.

- `main.js`: boot, the body, each station's light, the loop, and `window.vgu` for the harness.
- `journey.js`: the road and the ground table. The table is an 11 × 17 float texture the shaders read, interpolated
  between stations. Terrain height is written in GLSL and JS line for line. The calendar is here too.
- `config.js`: each station's art direction. Sky palettes and eddies (The Starry Night's placed from the canvas),
  ground crops, light, fog and sound.
- `brush.js`: one procedural brush atlas and the shared lighting. The atlas has eight prints, each with bristles, a
  loaded start, a dry end and a height field.
- `sky.js`: a painted dome, plus 11–24k marks a station.
  - The marks lie along a flow field, curled round eddies that turn.
  - It has stars with ringed halos, a moon and a sun.
  - One station's sky repaints into the next mark by mark.
- `ground.js`: the terrain, plus four camera-following fields of about 191k marks, worked out on the GPU from the
  ground table.
  - Standing wheat and grass bend in the wind.
  - Flat marks lie along the furrows, the road and the water.
- `scenes.js` with `strokes.js`: everything that stands in the land, as surface marks that paint themselves in
  nearest-first when you arrive.
  - Poplars at Nuenen, windmills over Paris, orchards, haystacks and the blue cart.
  - The Yellow House, the café terrace and the gaslit Rhône.
  - The cypress and the village under the Starry Night, olive trees and irises.
  - The church and cottages at Auvers, crows, and the easels.
- `canvases.js`: the stroke records on the easels.
- `post.js`: HDR, bloom, a tone curve, vignette and grain.
- `audio.js`: sound generated on the spot.
  - Wind, and the mistral at La Crau.
  - Birds by day, crickets and the river at night, crows over the wheat.
  - Footsteps, and the brush while a canvas paints.
  - A quiet chord that changes key from station to station.
- `ui.js` and `index.html`: the interface.
  - The title, one card of keys, and the name of each place as you arrive.
  - His letters, and a plaque by each painting.
  - The road as a timeline you can click, and sound, controls and full-screen buttons.

The M8 runtime is removed, and so are `tools/shot.py`, `beat.py` and `listen.py`, which could only drive it. All of
them are in the history at `768ca51`. `tools/station.py` stays: it audits the station files, which the new runtime
still reads.

**How it was verified.** The runtime was driven in headless Chrome over the DevTools protocol, with real key events.

- **Keys:**
  - ↑ held 3 s walked 9.1 m, and → held 0.7 s turned 76°.
  - Space walked 13.9 m on its own in 6 s, and an arrow key took over.
  - 8 jumped to Saint-Rémy, Z lay down (pitch 64°) and stood back up.
  - No exceptions and no console errors.
- **Frame rate:**
  - 60 fps at 1440 × 900 at every station.
  - At 1728 × 1117 and device pixel ratio 2: 51–59 fps. The resolution started at 1.29 from the pixel budget
    (about 3.2 Mpx), and the adaptive rule did not have to go lower; it steps 0.15 down below 47 fps.
- **The road tour:** 44 frames, one every 22.5 m of the road. It found five things, now fixed:
  - A NaN in the river's lamp reflections: an exponential of a negative denominator behind each lamp. The bloom
    spread it into a black rectangle; it is now guarded in the shader and in both post passes.
  - The café's awning, pitched so nearly through the eye that from the road it read as a laser line.
  - The Yellow House's railway bridge, standing in the Arles night.
  - Stars, moon and sun blowing out to white.
  - Letters outstaying their station.
- **An audit of every prop mark:** it found iris petals whose direction was their own normal.

**Still visible.**

- **The marks between the canvases are invention.** The paintings on the easels are his and nothing else in the land
  is. The design's test for close calls, the hand or a nice picture, was answered the other way here, deliberately.
- **The frame-rate numbers are headless, on this machine.** Integrated GPUs are unmeasured. Quality is adaptive, and
  `?q=low` exists.
- **The touch controls are written but untested on a phone.** The left thumb walks and the right looks.
- **Nothing yet measures the new world the way M3 to M8 measured theirs.** The old runtime's harness went with it;
  the new one's checks live in `window.vgu` and were driven from a scratch script, not a tool in this repo.

### After M9 — Station 7 taken out

**What was asked.** On seeing station 7, *The strokes stop* (Arles, 23 December 1888), the author asked for it to be
removed. It was the charcoal outline of a house, two bare trees and *La Berceuse* on a pale, half-painted field.

**What changed.**

- The station is gone from the walk, and so is everything that existed only for it:
  - its entry in `config.js` and its builder in `scenes.js`;
  - the two things only it drew, `charcoalHouse` and `bareTree`;
  - its entry in the chord list, and the extra light its painting got in `canvases.js`;
  - `stations/s07-the-strokes-stop.json`, which is in the history at `cd7beb2`.
- The road is 90 m shorter, and the night of Arles hands straight over to Saint-Rémy. Everything after it stands one
  place earlier:
  - the ground table is 10 × 17;
  - the line along the bottom has ten ticks;
  - the digits 1 to 9 reach the nine painted places, and 0 the end;
  - the crows keep their stations.
- A station's sky and props are now seeded by the station's own number, not its place on the road. So Saint-Rémy,
  Auvers, the wheatfield and the end keep their props and skies. The bend of the road and the scatter of the ground
  differ a little there, because both follow from where a station stands.

**What was kept.** The source material of *La Berceuse*, in case the canvas is hung somewhere else:
`params/berceuse.json`, its two golden images, and its blob under `strokes/s07/`. The bare ground and sky stay too,
because the ending is painted with them.

**How it was verified.** Headless Chrome again, driven by the same scratch script as M9.

- No exceptions and no console errors.
- The line along the bottom has ten ticks with the right names. There are 30 easels, all on the nine painted
  stations, and none holds *La Berceuse*.
- 7 goes to Saint-Rémy and shows its name, 9 goes to the wheatfield, and 0 to the end.
- The road was photographed 30 m and 50 m past the night of Arles. Night goes into night, and the date runs through
  January and March 1889.
- Saint-Rémy, Auvers and the wheatfield were photographed from the same standpoints as during M9. They have the same
  props, skies and easels.
- `tools/station.py` passes over the ten station files that remain.

### After M9 — A quicker walk, and a level eye

**What was asked.** Two things about the walk. It should be 1.5 times as fast. And the eye should stop bobbing, which
felt like riding a horse and which people did not understand.

**What changed.** Only `main.js`.

- Every way of walking is 1.5 times as fast:
  - the arrows walk at 4.5 m/s, up from 3;
  - Shift runs at 10.5 m/s, up from 7;
  - space walks at 3.6 m/s between places, up from 2.4, and still slows to 40% of that at a station;
  - a flick of the wheel carries half as far again;
  - the side step and the thumb pad follow the walking speed, and turning is unchanged.
- The bob is gone. The eye used to rise and fall 2.8 cm each way, 2.6 times a second at a walk and 6.4 when running,
  which is a trot, not a step. It now stays level at eye height above the ground. The footsteps still sound, and they
  quicken with the pace as before.

**How it was verified.** In headless Chrome, before and after, with a probe that holds the keys and logs every frame.
It uses DOM key events and a synthetic wheel event.

| | before | after |
|---|---|---|
| ↑ held | 3.00 m/s | 4.50 m/s |
| Shift + ↑ | 7.00 m/s | 10.50 m/s |
| space, between places | 2.40 m/s | 3.60 m/s |
| one flick of the wheel | 1.67 m | 2.49 m |
| the eye off its height | ±2.8 cm, 2.6 times a second walking, 6.4 running | 0.000 cm on every frame, at every speed |

No exceptions and no console errors, at 60 fps. The probe lives in the session's scratchpad, like M9's driver.

### After M9 — The red vineyard

**What was asked.** A place after *The Red Vineyard*. The author gave the painting, as the Commons file they had saved,
and then the word to fetch the museum's own photograph instead.

**What was decided.**

- **Where it stands.** Between the night of Arles, September 1888, and Saint-Rémy, 1889, where station 7 stood until
  it was taken out. It is station 7 again, *The red vineyard*, November 1888.
  - The road is 90 m longer again, and the line along the bottom has eleven ticks.
  - The digits 1 to 9 and 0 reach the ten painted places, and the end is walked to or clicked on the line, as in M9.
- **What the land is painted from.** His own description of what he saw on the Sunday walk, in letter 717: the
  vineyard red like red wine, yellow in the distance, a green sky with a sun, and the violet ground sparkling yellow
  after the rain where the setting sun was in it. The colours are sampled from the scan and pushed.
- **No one in the rows.** The world keeps no people anywhere on the road, and it keeps none here. The pickers and the
  woman under the parasol are on his canvas, which stands among the vines on an easel.

**What changed.**

- `journey.js` and `ground.js`: a canal the ground table can ask for.
  - It lies on the right of the road, 16 to 27 m out, wherever a station sets `canal`. Only the red vineyard does.
  - The terrain dips for its bed, in GLSL and JS line for line, and the water marks and the blades follow it.
  - By day the sun lies on its water as a path of broken light: the view reflected in the surface, falling near the
    sun's own direction, and twinkling slowly. The ground table's new row carries the canal and the colour of that
    light, which is black, meaning none, at every other station.
- `config.js`: the station's art direction.
  - A golden sky of short strokes, with a white sun in rings of yellow low on the right of the road.
  - Wine-red vines, violet furrows, a violet road, and a yellow haze so that the distance turns yellow.
- `scenes.js`: what stands in the land.
  - About 750 bush vines in rows along both sides of the road, each a gnarled stock, often a stake, and a low dome of
    red leaves.
  - The blue cart, a farm on the horizon to the left of the sun, and the wind-bent trees of his top left corner.
  - Puddles on the road that catch the sun.
  - The easel, turned back up the road so that, standing at it, the sun is just past the canvas's right edge;
    `easelsAt` takes an optional turn for it.
  - No crows. The crow plan is M9's again, so every other station keeps its birds.
- `audio.js`: the station's chord is E, the night of Arles' key by daylight.
- The canvas, its source and its records:
  - `params/redvineyard.json`, `strokes/s07/redvineyard-canvas.*` (the blob is not committed), its two goldens,
    `sizes.js`, `tools/sources.tsv` and `paintings/CREDITS.md`.
  - The source is the Pushkin Museum's photograph as Commons carries it, 11,406 × 9,092, about 123 px/cm.
  - The file the author gave first, 2001 × 1560, is a sixth of that resolution and 3.4% off the canvas's shape. It was
    set aside before a build of it finished.
  - It has 11,249 strokes and covers 81.1% of the canvas. `tools/place.py` finds no horizon in it (1.9×), so it is a
    wall, which on an easel is what it is.
  - Its size is the edition's 75 × 93 cm and not the holder's. CREDITS § says so.
- `stations/s07-the-red-vineyard.json` and its letter:
  - Letter 717, to Theo, about 3 November 1888, paragraph 21, ten words.
  - The edition ties the canvas to paragraph 4 of the same letter and to letter 718. This paragraph names no canvas:
    it is the place, and the station file's `why` says so.
  - `letters/letters.json` and `letters/README.md` carry it.
- `DESIGN.md` records the station on the author's word.

**How it was verified.**

- The tools:
  - `tools/make.py redvineyard` built the canvas and created its goldens; asked again, it reports both identical.
  - `tools/make.py --check` passes the params file.
  - `tools/station.py` passes over the eleven station files.
  - `tools/letters.py --check` finds ten lines and nothing wrong.
- Headless Chrome, driven by the same scratch harness as M9:
  - No exceptions and no console errors.
  - Eleven ticks with the right names, and 7 jumps to the red vineyard.
  - Frames from the road in and out, the easel, both sides of the road, and the canal bank. Both roads into its
    neighbours were checked too: the night going into the vineyard, and the vineyard into Saint-Rémy.
  - The canvas paints itself on its easel; a frame at 4 s shows it half laid.
- What the scenery costs:
  - The station's scenery is 65,883 marks, between Saint-Rémy's 54,891 and the orchards' 73,773.
  - A first cut had 94,908 and cost 8 fps against the scenery hidden, so it was thinned.
  - The frame rate was measured with five other headless browsers running on the machine, and every station was held
    at 30 frames a second (median frame 33.3 ms).
  - Back to back in one page: the orchards 38.0 and 38.7 fps, the vineyard 39.3 and 38.4, Saint-Rémy 38.0. So the
    vineyard costs what the orchards do. M9's 60 fps could not be re-measured on a machine that busy.

**Still visible.**

- **The canal is about 80 m long.** A station's ground holds for about 27 m either side of it, so the water ends in a
  shallow basin where the ground table hands over to the neighbours.
- **The vines are invention, and the pickers are not in them, deliberately.** Putting them in would be a new prop,
  not a switch.
- **The canvas's size is the edition's, not the holder's.**
- **The farm and the far trees stand in the land between the vineyard and Saint-Rémy.** The road passes them at a
  distance on the way there.
- **Coming from the night of Arles, the vineyard's yellow sky arrives mark by mark through the night's blue**, as every
  sky does.

### After M9 — The opening, after Monet's

**What was asked.** The opening should be more like Monet's Universe's, and its animation could be inspired by *The
Starry Night*. Monet's opens on a veil of the pond's palette that washes in while its world is built. Then the veil
lifts, you are standing in *The Water-Lily Pond* with its caption and one line of keys, and there is no button. Ours
opened on 0.7 s of black and then bare linen. A title card with a paragraph and "Begin the walk" came up at 2 s, and
the walk was locked until the button was pressed.

**What changed.**

- **The veil is *The Starry Night* painting itself.** `src/veil.js` is new. From the first paint the page is dark,
  with a primed canvas in the middle and the title and a plaque under it. The canvas is painted from the painting's
  own stroke record, `strokes/s08/starry-canvas.bin`: the 13,999 strokes its easel at Saint-Rémy plays back.
  - They come in the order the pipeline solved. That order runs dark to light and from the bottom up: the mean
    luminance of each tenth of it rises from 0.15 to 0.57. So the village, the hills and the cypress come first, then
    the wind, and the stars and the moon last.
  - All of them take 3.2 s: slowly at first, then a flurry, then slowly again.
  - Each is the easel's ribbon, drawn flat: its quadratic, its width and its taper, with one ridge lit from the upper
    left and one in shadow.
  - The extractor's underlayer comes up behind the strokes as they are laid, and never ahead of them.
  - When the canvas is finished, soft glows breathe on his eleven stars and the moon, where `config.js` places them.
- **The brush does not stop for the build.** The canvas is handed to a worker as an `OffscreenCanvas`, so the world's
  long task on the main thread cannot stall it. Where a canvas cannot be handed over, it paints in the page.
- **The veil lifts into the world.** It waits until the painting has been finished for 0.6 s and the world has been
  painting itself for 1 s. Then the canvas comes towards you until it fills the window, and only then dissolves into
  the dusk at Nuenen. The world's own opening, painting itself outward from bare linen, still runs, now behind the veil.
- **No title card and no button.** The world can be walked as soon as it is ready, and a key, a click or a touch during
  the veil lifts it at once.
- **The first view is Monet's.**
  - As the veil lifts, the card for where you stand comes up (Nuenen, *The Potato Eaters*), with his letter after it
    as before.
  - One line of keys follows at the bottom, which is what §11 asked for.
  - The line along the bottom and the corner buttons wait for the first touch of a hand, and the line of keys goes
    when they come.
  - The card of keys no longer shows by itself. H and its button still bring it.
- **The eye comes level smoothly.** Until a hand moves, the eye drifts a little and looks up into the sky, as it did
  under the title card. It used to snap level on Begin; it now eases level over about two seconds.
- **Sound starts with the first gesture**, as it started with Begin, unless M or the button has turned it off first.
  A sound started by the wheel or the start of a touch is born suspended, so the next key, click or touch wakes it.
- **Everything else:**
  - `?notitle`, `?at=` and `vgu.begin()` skip the veil and open in the world with the chrome up, as before.
  - Reduced motion paints the whole canvas at once, and the veil fades without the zoom.
  - Where the stroke record is missing, the veil keeps the title and the glows, and lifts a second after the world is
    ready. The blobs are not committed, so a clone without the pipeline's output gets this.
  - `.claude/launch.json` is new: the preview pane's settings for this page (8710) and for Monet's (8791).

**How it was verified.** Headless Chrome, driven over the DevTools protocol from a scratch script. The red vineyard
was being added in the same working tree at the time, so the timings were taken on copies: `HEAD` against `HEAD` plus
this change's four files. Each is three runs, old and new alternating, timed by the page's own clock, with no
screenshots taken during a run.

| | before | after |
|---|---|---|
| first thing on screen | 0.7 s of black | the veil, from the first paint |
| world ready | 0.73–0.81 s | 0.79–0.93 s, under the veil |
| title card | 1.95–2.04 s, walk locked until Begin | none |
| painting finished | — | 3.38–3.46 s |
| veil lifts, with no hand | — | 3.98–4.07 s |
| card for where you stand | after Begin, 2 m down the road | 4.90–4.98 s |
| line of keys | — | 6.38–6.46 s, until a hand moves |
| veil gone | — | 6.58–6.66 s |
| longest task on the main thread | 280–301 ms | 284–288 ms |
| the veil's brush | — | 3,200 ms for 13,999 strokes, 192 frames, longest gap 17 ms |

- **The frames.** The canvas is bare at 0.3 s, with the cypress and the village at 1.2 s, the sky at 2.2 s and all of
  it by 3.4 s. In the lift, the canvas fills the window by 1.2 s and has dissolved into Nuenen by 1.8 s.
- **A key during the veil.** Held 0.3 s after the world was ready, with the painting unfinished: the veil lifting, the
  chrome up, 4.06 m/s, and 7.5 m down the road after 3 s.
- **`?notitle` and `?at=5`** open on Nuenen and on the Yellow House, with the chrome up and the veil hidden.
- **Reduced motion.** The painting is whole at 0.9 s, in no frames, and the veil has lifted by 4.9 s.
- **A resize mid-painting** (1280 × 720 to 1000 × 800): the canvas was laid out again at 700 × 560 and repainted, and
  the brush kept its 3.2 s.
- **No stroke record** (a copy of the site without it): the bare veil, one warning, and the lift at 1.9 s.
- **A phone**, 390 × 844 at 3× with touch: the canvas, plaque and title centred as one group, and the touch line of
  keys. The brush's longest gap there was 450 ms, once, while the world's shaders compiled. It holds the brush rather
  than dropping strokes.
- No exceptions and no console errors in any run.

**Still visible.**

- **The veil is not the lit easel.** Its strokes are flat paint with painted ridges, not relief under a light.
- **A clone without the pipeline's output gets the bare veil**, because the stroke records are not in the repository.
- **The lift's zoom enlarges the canvas's pixels**, 2.2 times at 16:9 and more in a wider window, while it dissolves.
- **Measured headless on this machine only**, not on a phone or an integrated GPU.

### After M9 — The coda: his portrait at the end of the road

**What was asked.** To end the walk on *Self-Portrait as a Painter* (Van Gogh Museum, s0022V1962): a giant portrait
at the end of the final scene, as a tribute to him. The walk ended at station 11, *After*: bare primed canvas, no
date, nine crows, and a card with his name and dates. DESIGN §15 had left the coda open between nothing and the
canvases in their museums. M8 built the nothing and called the decision the author's.

**What was decided.**

- **Past the road, not in a station.** The portrait stands 80 m past the end of the road, where the walk on its own
  now stops (`ZEND + 4`). It is centred on the line of sight from there and turned to face it. It is not a station
  and has no share of τ. The line along the bottom is full where the road ends, and what is past it is the tribute,
  not more of the life.
- **36 m tall and 27.35 m wide**, at the canvas's own aspect, with its bottom edge 4 m up. From where the walk stops,
  all of it is in view with the eye level, from 1.7° to 26° above the horizon. The top of the frame is at 31°.
- **On the easel every station has, scaled 15.7 times.** It has the station easel's three legs, tray and clamp.
  - Each timber is a 1.1 m square core with marks down all four faces, so that it reads from the side as well.
  - The marks are the ochres of the easel in the portrait.
  - Its ledge is lower than the station easel's, so the canvas is set 0.3 m in front of the legs, where they would
    otherwise pass through it.
- **The same stroke record as the corridor at station 2**, `strokes/s02/selfpainter-canvas.bin`. That is 8,428
  strokes in the solved order: the contours and the dark of the smock from the bottom up, then the figure, the pale
  ground behind him, and the highlights last. Nothing was extracted again. At this size a stroke is about 0.4 m
  wide. From 80 m that is the angle the same stroke makes on its easel in the corridor from four metres.
- **None of it is there until you are.** From the last field the road ahead is as empty as it was. The coda begins
  once you are on the bare canvas past it, at `stationAt` 9.85, about 55 m past station 10.
  - The easel paints itself in from the ground up, over 6 s.
  - The primed canvas comes up on it as the easel finishes.
  - The blank canvas is held for 6 s, which is what is left of the nothing.
  - Then he paints himself on it in 32 s, two and a half times as long as any canvas on the road takes.
- **A haze of its own.**
  - The station's fog is what makes station 11 a white void, and at full strength it left his colours pale at 80 m.
    The portrait keeps 0.12 of it.
  - The same uniform, raised, is what brings it up out of the haze when you walk back to it from the field.
  - Its cloth has no weave: scaled with the canvas, the threads would be 0.3 m wide and would alias from 100 m.
- **What says how big it is.** The bare canvas has nothing in it whose size you know, and from the road's end the
  first film showed an ordinary easel twenty metres off.
  - The nine crows of station 11 now circle the portrait, from the height of his hands to over its top, instead of
    the empty plaza. They keep its haze, so that they are no paler than it is.
  - An empty easel of the ordinary size at the road's end was tried and taken out. Without a canvas over it, the
    station easel's marks read from 7 m as a letter A.
- **The walk on its own stops where the road does.** It slows over the last 10 m, with the whole canvas in view.
  A hand can go on: the walk's limit is now 7 m in front of the canvas, not the road's end. From there his palette
  and brushes are over your head, and one stroke is wider than you are.
- **The end card waits for him.** "Vincent van Gogh, 1853 – 1890" comes up when the portrait is finished and you
  are at the road's end.
  - It sits under the portrait rather than over it: it moved from the middle of the window to 12vh above the bottom.
  - It gives way to the painting if you walk on to within 60 m of it.
  - While he is painting, the painting's plaque is up instead, at any distance on the bare canvas.
- **Sound.** The bristles on the cloth are heard while it paints, fading out over 170 m instead of 34. The chord
  under everything, silent at station 11 since M8, comes back for it: F, the chord of Paris, where he painted it.

**What changed.**

- `stations/s11-after.json`:
  - `coda`: the blob, title, date and collection, and `height`, `beyond`, `hold` and `paint`;
  - `_coda`: the decision.
- `src/scenes.js`:
  - `coda()` and `timber()` build the big easel, as a mesh of its own;
  - the crows of station 11 circle the portrait.
- `src/canvases.js`:
  - the coda's sequence and haze;
  - `uLift`, which holds strokes further off a canvas seen from far away;
  - a polygon offset on its cloth, and its stretcher set further back;
  - its plaque at any distance.
- `src/main.js`:
  - the walk's far limit is the portrait's foot;
  - the walk on its own stops at the road's end;
  - `vgu.coda()` reports the sequence.
- `src/ui.js` and `index.html`: the end card waits for the portrait and sits under it.
- `src/audio.js`: the chord at the coda.
- `tools/station.py` audits the coda's blob and its count.
- The docs:
  - DESIGN.md's header, §7's diagram and row 11, and §15 record the decision;
  - `paintings/CREDITS.md` notes that the portrait hangs twice.

**How it was verified.** Headless Chrome, driven over the DevTools protocol from a scratch script.

- **The sequence, from the tick for station 11:** the easel is in at 6 s and the canvas up at 7.5 s. The first
  stroke lands at 13.5 s, and he is finished at 45.5 s.
- **The walk on its own, from station 10:**
  - It came onto the bare canvas 33 s after the key, and slowed at station 11 as it slows at every station.
  - It stopped by itself at the road's end, at z −959.8, and turned itself off.
  - The portrait finished 45.5 s after the walk came onto the bare canvas.
  - Then the end card was up, the plaque had gone and the walk stayed off.
- **From the last field**, 24 m past station 10, none of it shows.
- **At 50 m** the end card has given way to the painting. At its foot and from the side, the strokes and the timbers
  hold together.
- **Depth.**
  - In the first films the blank canvas was the stretcher's darker face: all over from 128 m, and in blocks from
    110 m. The two were 5.5 cm apart, and the polygon offset that keeps the cloth behind the strokes had pushed the
    cloth back into it.
  - The stretcher now stands 0.2 m further back, and from 128 m the blank canvas is clean.
- **Frame rate**, at 1440 × 900 over 4 s of frames with no screenshots taken:

  | | fps | slowest 5% of frames |
  |---|---|---|
  | the road's end, the portrait finished | 42.6, then 48.1 | 33 ms |
  | at its foot | 51.6 | 33 ms |
  | the wheatfield | 39.9 | 33 ms |
  | the red vineyard | 33.7, then 37.2 | 50 ms, then 33 ms |

  The bare canvas with the portrait on it is no slower than the stations before it.
- **A phone**, 390 × 844 at 3×: the end card wraps to five lines under the portrait and clears the line along the
  bottom. The plaque wraps to three.
- No exceptions and no console errors in any run. `tools/station.py` exits 0.

**Still visible.**

- **The record is the corridor's.** 8,428 strokes cover 985 m² of canvas. Between them shows the extractor's
  underlayer, which at 375 × 494 pixels is 7 cm a pixel on this canvas, and soft from its foot.
- **From where the walk stops, it is a picture of a big easel.** Its size is read from the crows and from the walk
  up to it, and it is felt only near it.
- **The tick for station 11 lands on a bend 128 m from it.** From there the portrait is 10° right of the way you
  face, so on a phone it starts at the window's edge.
- **Walk it again does not repaint it**, as it does not repaint any canvas on the road.
- **Measured headless on this machine only**, not on a phone or an integrated GPU.

### After M9 — The README, and the paintings in the repository

**What was asked.** A README for the repository on GitHub, and then the stroke records committed, so that a clone
shows the paintings.

**What changed.**

- `README.md`: what the piece is, how to run it, the controls, the eleven places, how the strokes are extracted and
  ordered, what is evidence and what is invention (DESIGN §4.3's disclosure paragraph, which M9 owed the README),
  the URL parameters and the debug API, how to rebuild a canvas, the layout, and the credits and licences.
- `docs/`: five frames for it, shot headless from this build: Saint-Rémy, the opening, *Sunflowers* partway through
  painting itself, the red vineyard and the end.
- The stroke records: 62 files, 12 MB, the blob and the underlayer of every canvas a station hangs, now tracked.
  `.gitignore` lets them through and keeps out the rest of each build and the unhung *La berceuse*.

**How it was verified.** Before the records were committed, an exact copy of `HEAD` served on its own showed the whole
world with every easel empty and the opening lifting without its painting, which is what the first draft of the README
said. After, the same copy of the new `HEAD` loads every record with no 404.

### After M9 — The portrait without its crows, and sooner

**What was asked.** Two things about the last scene, the author's portrait at the end of the road. The crows
circling it were creepy, and should go. And the portrait should be fully there sooner as you approach it.

**What was decided.**

- **No crows past the last field.** The nine of station 11, which M8 sent in from behind over the bare canvas and
  which the coda entry set circling the portrait from the height of his hands to over its top, are taken out. Over
  a wheatfield they are his; over him they were an omen, not a tribute. The sixteen over the wheatfield stay, and so
  do the eleven that have been in the corner of the eye since station 3. The caws that station 11 still carried at
  0.3 go with the birds.
  - The coda entry had them as what says how big the portrait is on the bare canvas. That is now the walk up to it
    alone, and the timbers of the easel.
- **Faster, and faster as you come.** The blank canvas is held for 3 s instead of 6, and he paints himself in 20 s
  instead of 32: half as long again as a canvas on the road, not two and a half times.
  - The whole sequence, easel, hold and paint, now runs at a pace set by how far off you are: its own time from
    120 m out, where it begins, up to three times as fast at its foot, with the ramp smooth between. Standing
    still at the road's end it finishes in half a minute; walking up to it, it finishes as you come.
  - The pace is `approach` in `stations/s11-after.json`, next to `hold` and `paint`, and 1 leaves the old behaviour.

**What changed.**

- `src/scenes.js`: `Crows` has no bird past the wheatfield and no flock of its own for the portrait; it takes no
  coda. The coda's easel entry carries `approach`.
- `src/canvases.js`: `coda()` scales its clock by the pace before the easel, the hold or the painting see it.
- `stations/s11-after.json`: `hold` 3, `paint` 20, `approach` 3, and `_coda` says why.
- `src/config.js`: station 11 has no `crows` in its audio.
- The docs: DESIGN.md's row 11, README.md's timing paragraph, and this entry.

**How it was verified.** Headless Chrome over the DevTools protocol, from a scratch script that logs the coda's
state on the page's own frames and, in the second run, carries the body forward at walking pace (4.5 m/s) from the
moment the coda begins. Both runs start at `?at=11`, 128 m from the portrait.

| | easel in | first stroke | finished | where it finished |
|---|---|---|---|---|
| before, standing still | 6 s | 13.5 s | 45.5 s | 128 m |
| now, standing still | 6 s | 10.5 s | 30.5 s | 128 m |
| now, walking up to it | 6 s | 9.5 s | 19.8 s | 47 m off |

- Twenty-seven birds are built, none of them past the wheatfield; the wheatfield's own are in its sky as before.
- From the road's end, finished: the portrait on its easel with an empty sky round it, and the end card under it.
  From 12 m at its foot the strokes and the timbers hold together as they did.
- `tools/station.py` exits 0 and reports the coda's 8,428 strokes.

**Still visible.**

- **From where the walk stops, it is a picture of a big easel**, and now nothing in the sky says how big. The walk
  up to it is what says.
- **The pace is a ramp on distance, not on approach.** Standing at 47 m it runs at twice its time whether you
  walked there or arrived by the line.
- **Measured headless on this machine only.**

### After M9 — The vines, low

**What was asked.** The red vineyard did not look like a vineyard: round red things in a field. The author was right.
From the road it was a mass of tall red wheat with red balls standing in it.

**What was decided.**

- **What was wrong, in two parts.** The vine was a dome: leaves laid on the surface of a half-sphere, each with the
  sphere's own normal, so the light shaded every vine as a ball. And the ground between them was the wheat the
  ground table draws, red and 0.6 m tall, so the field read as grass with balls in it. His canvas has neither: a low
  tangle of red, orange and yellow that lies flat across the field, thin dark stakes standing out of it, and the
  violet earth showing between and across the front.
- **The vine is a tangle now, wider than it is tall.** 0.3 to 0.4 m high and 0.6 to 0.9 m across, where it was
  0.5 to 0.8 m high and 0.36 to 0.52 m across.
  - Its leaves lie through a flat mound rather than on a surface, and each has a normal of its own, so that there
    is no ball to shade. The marks are larger, 0.1 to 0.2 m, nearer the size of his.
  - Five to eight shoots go out of the stock as long bent canes, low over the ground and lifting at the ends. A
    quarter are olive and yellow, as the green in his rows is.
  - Four vines in five have a stake, and they stand higher than the vine: the one vertical in the field.
- **The ground is a carpet.** The wheat is 0.22 m tall at 0.4 instead of 0.6 m at 0.8; the olive tufts are lower; the
  violet furrow is stronger, and the yellow and orange dots more, so that the earth shows between the rows.
- **The rows are 1.6 m apart** instead of 1.45, to pay for the wider vines.

**What changed.**

- `src/scenes.js`: `vine()`, and the vineyard's palette gains `cane`.
- `src/config.js`: station 7's ground cover.

**How it was verified.** Headless Chrome, `?at=7&painted`, from the road at the station and from beside the easel,
before and after.

- From the road, the field is a low tangle with the stakes standing out of it and the earth showing, and no ball
  anywhere in it. From beside the easel, the near vines are canes and leaves.
- The station's scenery is 70,889 marks, from 65,883: the leaves were thinned once, from 80,673, to keep it near what
  it was. Single frame-rate readings in the same runs were 41 before and 36 after, which is within the noise of a
  headless reading and was not measured back to back.
- No exceptions. `tools/station.py` exits 0.

**Still visible.**

- **The pickers are still not in it**, by the decision in the vineyard's own entry.
- **The blue dashes in the sky are the sky's**, as they were.
