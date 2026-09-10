# Van Gogh's Universe — design

> **Status.** Written before the build, September 2026. This is the record of intent; `BUILD.md` will record what
> actually happened, milestone by milestone. Nothing here has been prototyped yet. §14 names the one experiment that
> decides whether the project is possible at all, and it comes before everything else.

A single web page. You begin on bare primed canvas — white, woven, nothing on it but a charcoal line going forward.
You drag one control, and the world starts being painted around you: strokes arriving in order, in his direction, at
the speed he worked. You walk through ten years of it. The colour comes up out of the brown, floods, turns yellow,
turns to night, rises into the Alpilles and goes over into stars, descends into green. Then the strokes stop arriving,
and you are standing on bare canvas again with a wheatfield behind you, and it is the 27th of July 1890.

---

## 1. Thesis: a painting is a recording, and real-time is the only medium that can play it back

What is Van Gogh, irreducibly? Not thick paint. Not swirls. Not yellow.

**He is the only major painter whose work is essentially a recording of motion.** A Monet patch wants to dissolve —
it is trying to stop being a mark and become atmosphere. A Van Gogh stroke never stops being a stroke. You can read
the loading of the brush, the direction, the speed, the instant it lifted. His canvases are closer to handwriting, or
to a seismograph trace, than to a window onto a place. They are a sequence of physical gestures, preserved in oil.

A painting cannot play back. A film of a painting cannot either. A gallery cannot. A projection show cannot — it can
only make the finished image large and move it around, which is a different thing and a lesser one.

A real-time engine can. Playback is its native capacity. So:

> **The subject of this piece is not Van Gogh's places. It is the act of painting them.**

Three further facts, all true, all unexploited:

1. **He narrated his own work.** About 900 surviving letters, most to Theo, nearly all dated, many describing the exact
   canvas on the easel that week in specific colour words. No other painter left a running commentary synchronised to
   the output. The text and the pictures are a matched, dated pair. We have his voice for free, and it is his, not a
   curator's.
2. **The corpus is dated to the week, and it is short.** Roughly 2,100 works; the ones everybody knows inside
   24 months; and then it ends. A time axis is *native* to him in a way it is to no other painter. Monet worked for
   sixty years and a timeline of him is a filing system. A timeline of Van Gogh is a life.
3. **His colour is a declared transform, not a perception.** He wrote that rather than reproduce what was in front of
   him he used colour arbitrarily, to express himself more forcefully. The house was not that yellow. Which means his
   colour can be applied to things he never painted — to the ground between two canvases, to a sky we need and he did
   not leave us. Monet's app could never take that license; this one can, and needs it.

### The test for close calls

When a decision is genuinely balanced, the question is: **does this make the viewer feel the hand, or does it make a
nice picture?** Anything that makes a nice picture at the cost of the hand loses. The finished image is the least
interesting state of a Van Gogh, because the finished image is the one thing you can already get.

---

## 2. What this is not

Three pieces already occupy the neighbourhood and we have to be clearly different from all three.

**Not an immersive projection show.** *Van Gogh Alive*, the *Immersive Experience*, and their many imitators take the
finished images, scale them to a wall, and animate them with drifting particles. They are all flat, all finished, all
spectacle with no subject, and none of them has an ending. Our defences: **real impasto with physical height**, **the
scrub**, **his voice**, and **a conclusion**. If a screenshot of this could be mistaken for one of those shows, we
have failed.

**Not *A town made of paint*** (`van-goghs-town.surge.sh`). That piece — the original reference for
`monets-universe` — builds a *generic* town out of procedural strokes. No canvases, no real places, no chronology.
It is a beautiful toy about the look of Van Gogh. This is a piece about Van Gogh. We take none of its furniture: no
dock, no numbered viewpoints, no walk/fly toggle, no light slider.

**Not Monet's Universe with a new palette.** `monets-universe` is the sibling project and the thing we have most to
learn from, including its mistakes. Its architecture is: coarse built geometry per place, the painting *projected*
onto it from the painter's standpoint, soft patches filling the gaps, and the hour as the primary axis. That is the
right design for Monet — he is light, the series are about light, and his paint wants to dissolve into the surface
anyway. Every one of those choices is wrong here:

| `monets-universe` | here | why |
|---|---|---|
| The canvas is **projected** onto geometry | The canvas is **decomposed into strokes**, which become geometry | A projected canvas is flat paint that is correct from one spot and degrades everywhere else. `monets-universe/scratch/` is a graveyard of seam, air and border fixes; that is the projection model failing, over and over. |
| Paint is a soft feathered patch, flat on the surface | Paint is a **ribbon with thickness**, standing off the surface, lit and casting | Monet's mark wants to stop existing. Van Gogh's mark is the subject. Impasto is the one thing no projection show on earth can do. |
| **The hour** is the primary axis | **The hand** is the primary axis | His repetitions are not about light. His work is about the act. |
| Geography: a fictional Normandy threaded by a promenade | Chronology: ten real years threaded by a path | The dates are the gift. The geography is not (Arles to Auvers is 700 km; no fiction survives that). |
| Eight controls (walk, fly, drift, viewpoints, hour, quality, photo, sound) | **Two** (scrub, walk) | Scrub is time, walk is space. Everything else is automatic or gone. |
| Begins at home, wanders, ends at a sea reveal | Begins on nothing, ends on nothing, peaks just before the end | That is the shape of the life. It is also a better shape. |

---

## 3. The three moves

Everything in this document follows from three decisions.

### 3.1 The stroke is the atom, and it has physical height

We do not put paintings on surfaces. We take each painting apart into its individual strokes — thirty to eighty
thousand of them per canvas — and rebuild the world out of those strokes as **lit geometry with real thickness**.
Nothing in the world is a texture of a painting. Everything in the world is a mark.

The consequence that makes this worth doing: **the piece looks better the closer you get.** A projected canvas falls
apart at two metres. A field of impasto ribbons resolves into paint — a ridge of chrome yellow standing a millimetre
and a half off the weave, catching the light, throwing a shadow the width of a hair onto the stroke beneath it. Get
your eye down to a sunflower and you should see the brush's track in the pigment.

Details: §4.

### 3.2 The control is not the hour. It is the hand.

One scrub. It runs the making.

- **Full left:** primed canvas. The weave, a thin ground wash, a charcoal underdrawing ghost.
- **Scrub right:** strokes arrive **in order** — thin and dark before thick and light, sky before land, the impasto
  highlights snapping on last — in bursts, with holds, at something like the rate he worked. He painted *Wheatfield
  with Crows* inside a day. He sat up three nights to paint the *Night Café*. He worked the *Potato Eaters* up through
  a whole winter of studies. That difference in tempo is in the historical record, and it is free drama.
- **Each arriving stroke draws itself**: the ribbon extrudes along its own length over ~120 ms, so you see the
  direction of the hand, not just the result.
- **Full right:** finished. And then, past finished, the strokes do not settle — the curl keeps tightening into 1890
  and the world begins to come apart.

**The image that sells the whole project:** stop the scrub halfway and you are standing inside an *unfinished* Van
Gogh. The sky complete, the ground still bare cloth, a cypress half there, the edge of the paint a ragged front across
the middle distance. That has never existed anywhere, in any medium, and it is one drag of a slider away.

Details: §5.

### 3.3 The map is the chronology, not France

We do not lay out Arles, Saint-Rémy and Auvers as a plausible south of France. We lay out **ten years as a path you
walk**, with the date under your feet and whatever he was painting that month standing around you. The path is one-way
and it **stops on 27 July 1890**. Past the stop: stretched canvas, primed, empty, and the crows.

His own sentences, dated, arrive in the air as you reach the canvas they describe. Not narration. Not a docent. One
line, his, the week he wrote it.

Details: §7 and §9.

---

## 4. The stroke system

This is the technical heart of the piece and the only genuinely hard part.

### 4.1 Extraction (offline)

A Python pipeline, run once per canvas, output committed as a binary blob. The runtime never does any of this.

Input: the highest-resolution scan available — 6,000 px on the long edge at minimum, ideally 10,000+. See §8.3 for
sources; licensing is easy here because everything is public domain and several of the holding museums publish
open-access masters.

1. **Colour management.** Decode to linear sRGB with the scan's ICC profile honoured. Do *not* attempt automatic
   varnish or yellowing correction — where a museum publishes a post-conservation image, prefer it, and otherwise
   leave the canvas as photographed and record the choice in `CREDITS.md`. Guessing at the original colour of a
   Van Gogh is a conservation research project, not a rendering step.

   *Audited at M0a and implemented at M0b. **31 of the 40 scans carry no embedded profile at all**, including all 24
   from the Van Gogh Museum and both sides of station 2's flood. There is nothing to honour in those files, so the
   pipeline records the absence in the blob header rather than assuming sRGB silently — the assumption is still made,
   but it is now written down where a later milestone can find it. `paintings/CREDITS.md` carries the full audit.*
2. **Orientation field.** Structure tensor at three scales (σ ≈ 2, 6, 16 px at 8k), giving a dominant direction
   θ(x, y) and a coherence c(x, y). High coherence is a stroke; low coherence is a scumbled or blended passage and has
   to be handled by the residual layer (step 7).
3. **Ridge detection.** On luminance *and* on each chroma channel independently. This matters: his strokes are very
   often a single loaded colour laid next to another single loaded colour at similar value, which is invisible to a
   luminance ridge filter and obvious in chroma. Union the ridge maps.

   *Built at M0b, and the union is the part that needed correcting. Taken literally it finds the same stroke three
   times: measured on the gate tile, **99% of chroma traces ran within one stroke width of a luminance trace**, and
   the three channels together nearly tripled the stroke count to buy 2.3 points of coverage. The operative clause is
   "invisible to a luminance ridge filter" — so a chroma seed is taken only where luminance has nothing to say, which
   on the Reaper is 61 traces rather than 3,266 and costs what it contributes. On a canvas where blue meets green at
   the same value it will be most of them; the mechanism is the same and only the arithmetic changes.*
4. **Tracing.** Walk each ridge along the orientation field, streamline-style, terminating on a coherence drop, a
   colour change beyond a ΔE threshold, a curvature limit, or a maximum arc length. This is the step that will need
   the most tuning per canvas; expect per-station parameter overrides in the station data rather than one global
   setting.
5. **Fitting.** Each trace becomes a **quadratic Bézier** — three control points. His marks are overwhelmingly a
   single arc; the Saint-Rémy spirals are chains of arcs, and a chain is just strokes that share endpoints and an
   order. Resist cubics; two control points of freedom is enough and keeps the per-stroke record small.
6. **Attributes.** Colour = median of a narrow band along the trace (median, not mean — the mean eats the neighbouring
   stroke at every crossing). Width = perpendicular extent of the ridge. **Height** = local luminance above a wide
   neighbourhood, which correlates with impasto because a raised ridge catches the photographer's light. That
   correlation is imperfect and it is the weakest link in the pipeline; the correct source is raking-light or
   photometric-stereo height data, which exists for a handful of canvases and not for most. Flag the estimate as an
   estimate and allow a hand multiplier per station.

   *Replaced at M1, and this section was right to call itself the weakest link. Local luminance above a wide
   neighbourhood is a picture of the palette: false-colour it over the Reaper and the sheaves are legible in it,
   stroke for stroke. Measured, **81% of its variance is explained by the stroke's own colour alone.***

   *M1 tried the physics first. The cross-profile of a stroke carries two cues — one flank lit and the other shaded,
   which depends on the light; and both feet darkened by self-shadowing, which does not. The antisymmetric cue was
   tested the way BUILD.md M1 specifies, by asking whether the recovered light agrees across the 24 Van Gogh Museum
   scans, which were shot on one rig. **It does not, and the interesting part is that we can say how badly.** The
   same estimator recovers a known light to within 0.7° on synthetic canvases whose flank statistics match the
   Reaper's, and fails completely below tan(incidence) ≈ 0.3; on canvases with **no light at all** it returns a
   resultant of 0.02 to 0.06 with the direction scattered. The museum's 24 scans return a median of 0.029. They are
   indistinguishable from unlit. Flat-field photography is built to do exactly this and it has done it.*

   *The symmetric cue fails differently and worse. It is not weak — it is 2.3% deep on a bright ridge — but splitting
   it by polarity shows +2.33% on bright ridges against −2.01% on dark ones, near-perfectly opposite: it is the ridge
   finder's own selection, because a bright ridge is chosen **because** its neighbours are lower. The relief-carrying
   part, which is the polarity-independent half, is 0.16%.*

   *So the shipped height is neither. It is a model, built from geometry and never from colour: a stroke stands as
   high as the film it lays down, which goes with its width, plus the paint it was laid on, which the raster sums as
   it draws. Its variance explained by colour is **0.5%**. It is labelled method 2 in the blob header, beside the
   recovered light and its resultant, so any blob can be asked what its relief is worth; `--height 0` and `--height 1`
   reproduce the other two for anyone who wants to look. What would make this a measurement rather than a model is
   raking-light or photometric-stereo height data, and **no scan in this set carries any**.*
7. **Residual.** Whatever the strokes do not account for — thin washes, blended passages, the ground — becomes a
   low-frequency **underlayer**: the residual image after the fitted strokes are subtracted, blurred, rendered as a
   thin flat surface beneath the ribbons, plus the canvas weave. The underlayer is what makes the half-finished state
   look like a real unfinished painting instead of like a loading bar.

*Built at M0b, with one change of evidence. Subtracting the fitted strokes leaves, in a covered passage, the
**fitting error** — and blurring that back in reintroduces exactly the stroke-scale structure the strokes are
supposed to be carrying, which is the "projection show with sprinkles" failure arriving through the back door. So
the underlayer is built only from the pixels no stroke covers: a normalised convolution weighted by (1 − coverage),
which is literally the ground as seen between the marks, continued smoothly underneath them. Passages where the
tracer found nothing at all — a scumbled sky, a thin wash — have no coverage, so they speak for themselves and are
reproduced. The band-pass ratio that M0b measures is the check that this is honest: on the Reaper the strokes carry
0.95 of the source's energy at stroke scale, so the underlayer is not doing the picture's work.*

### 4.2 The stroke record

Packed, 24 bytes, little-endian:

| field | bytes | notes |
|---|---|---|
| p0, p1, p2 | 12 | three 2-vectors, **u16 normalised fixed point** over [−0.05, 1.05], canvas coordinates |
| colour | 3 | RGB8, **sRGB-encoded**, decoded in the shader |
| width | 1 | u8, in units of 1/255 of the canvas short edge × k |
| height | 1 | u8, impasto, 0 = flat wash |
| order | 2 | u16, **fraction** of the reconstructed sequence, not an index |
| act | 1 | u8, which act of the making this belongs to (§5.2) |
| flags | 1 | u8: contour, highlight, chain-continues, edge-spill |
| depth | 2 | float16, see §4.4 |
| (pad) | 1 | |

*The field order above is the record's inventory, not its byte layout. Taken literally it puts `order` at byte 17
and `depth` at 21, and WebGL requires a u16 or f16 attribute to begin at a multiple of two — so the record as listed
cannot be bound as an attribute buffer at all. `tools/pack.py` holds the layout that can: same fields, same 24 bytes,
`order` at 20 and `depth` at 22. Found in M0a, the first time the thing was bound; recorded there as correction 5.*

*Three fields were corrected by `BUILD.md` before any code was written, all by arithmetic. `order` held a
position index in two bytes, which cannot reach the 80,000 strokes this section expects — it is now a
fraction of the sequence, which also makes `uScrubOrder` a plain 0–1 number. `colour` held linear RGB8,
which leaves about four usable levels below 2% luminance and would have banded* The Potato Eaters *into mud;
sRGB encoding costs the same three bytes and one `pow` per instance. The control points held float16, which
spends its precision near zero and has a 0.45 mm step near one — worse at a canvas's right edge than at its left,
which is a strange thing to build into a painting; u16 fixed point is 0.016 mm everywhere, in the same twelve
bytes, and makes a chain's shared endpoints quantise identically so spirals cannot open at their joints.*

60,000 strokes ≈ 1.4 MB per canvas. Twenty-odd canvases across the ten stations ≈ 30–60 MB of blob, which wants
streaming per station rather than an upfront load. The scrub gives us a natural prefetch signal: we always know which
station is next.

### 4.3 Order: what is evidence and what is invention

This is the honesty question of the whole project, and it has a better answer than I expected.

**There is real evidence in the paint.** At every crossing of two strokes, one is on top. The upper stroke is
continuous and its colour dominates; the lower one is interrupted. Extraction sees this. So each canvas yields
thousands of pairwise "A is after B" facts, and a topological sort over that partial order gives a **reconstructed
sequence derived from the painting itself**, not from a guess.

*Measured at M2 (`BUILD.md`) — and the claim survives its own kill criterion, at about half the size it is stated
at here. Three things have to be said with it.*

*First, **the pairwise question is usually the wrong one.** On a canvas painted three and a half times over, three
quarters of the crossings the geometry finds have since been buried by a third mark, so the pixel at the crossing
belongs to neither A nor B. That is measured against its own control: shuffle which stroke owns which colour and a
third mark wins a quarter of the time and is worse by four ΔE, rather than three quarters of the time and better by
one. The reading that works asks instead **which of everything covering this point is the paint you can see** —
every mark whose footprint contains it is a candidate, the winner was laid after all the others there, and one point
yields as many facts as there are marks stacked on it. That uses what the extraction knows and a pairwise reading of
the scan cannot: every mark on the canvas rather than these two.*

*Second, **the second cue here is not there to be read.** "The lower one is interrupted" is a statement about shape,
and it is implemented — a section across the stroke at the crossing, regressed on the same section either side,
which reads the crest and both feet at once. On the museum's canvases it is barely distinguishable from a coin:
13.5% of its weight has to be cut to make its own graph acyclic against 17.7% for the same graph with its arrows
thrown at random, where the colour reading gives 0.2% against 5.9%. The reason is M1's: flat-field museum
photography has erased the relief shadows, so shape leaves no trace in the image. It ships at weight zero.*

*Third, and this is what the sentence above should be read as claiming: **the crossings recover local order, not
global sequence.** Withhold a fifth of the confident crossings by region and the reconstruction gets 58.9%, 53.7%
and 52.8% of them right on the Sower, the 1887 Self-Portrait and the Reaper, against 45.8%, 42.2% and 45.9% for the
habits below on the same withheld crossings — margins of +13.1, +11.5 and +6.8 — and the margin halves for every
doubling of the withheld block, so part of even that is proximity. Two marks that touch, the paint puts the right
way round. Two marks a hand's breadth apart, it mostly cannot, and what orders those is still the habits: the solved
sequence correlates 0.89 with the heuristic it started from. On a synthetic canvas where the true order is known and
the overpaint matches, the same machinery recovers 79% of the still-visible order, which is the ceiling this method
has and it is a long way above what a real canvas can be shown to reach.*

The partial order is sparse — most strokes never cross — so it needs tiebreakers, and these are habits rather than
evidence:

- thin and dark before thick and light (how he worked, and how oil works);
- sky before land in the landscapes, figure after ground in the interiors;
- the dark reed-pen-like contours of the Arles canvases late, not early;
- the brightest impasto highlights last, always;
- within an act, upper-left outward, which is ordinary right-handed habit.

**The timing is invention.** Pacing comes from the historical record where it exists (session counts, letters saying
how long something took, the known burst rates: ~14 orchard canvases in five weeks at Arles, ~70 canvases in 70 days
at Auvers) and from dramatic judgement where it does not.

**Disclose it.** Somewhere quiet and permanent — a line in the caption at the first station, and a paragraph in the
README — the piece says that the order is reconstructed from the overlaps and the timing is a reconstruction. It costs
nothing, it is more interesting than pretending, and a piece whose subject is his honesty about his own work cannot
open with a lie about its method.

### 4.4 From canvas to space: the viewing volume

A painting is two-dimensional and the world is not. How strokes get into 3D is the architectural decision, and the
answer is **different per station, chosen by what the canvas actually contains**, with a hard rule to keep us honest.

Four treatments:

- **Lifted.** Ground and sky. These are the two surfaces a body needs — something to stand on, something overhead.
  Ground strokes project onto a heightfield; sky strokes onto a dome. Always available, always cheap.
- **Shelled.** Middle distance. Each stroke gets a `depth` from a monocular depth estimate of the painting plus hand
  correction, so the scene becomes a shell with real parallax over a limited range. Convincing for a few metres of
  movement, grotesque beyond that.

  *M4 builds it, hand-authored as §15 expects, and measures the last sentence. Two strokes that are neighbours on
  the canvas sit on almost the same ray, so from the painter's position they touch; put them at depths d₁ and d₂,
  step sideways by δ, and the angle between them opens by δ|1/d₁ − 1/d₂| while a stroke still subtends what it
  subtends. The paint has a hole in it when the first exceeds the second, which is one division per pair and no
  simulation at all. On the olive grove a twentieth of the neighbouring pairs have opened a stroke-wide gap at
  **2.34 m**, a tenth at 3.4 m and a fifth at 5.4 m. "A few metres" is two and a third.*
- **Built.** A few interiors where you genuinely have to be inside: the Yellow House, the Bedroom, the Night Café.
  These are cheap to build because **his interiors are already one-point perspective** — the vanishing point gives you
  the room's proportions directly off the canvas. The strokes then bind to the built surfaces keeping their canvas
  direction.
- **Present.** Some paintings are not places and should not be made into places. The self-portraits, the Sunflowers.
  They stand in space, enormous, close, as walls of paint.

*M4 adds two names to that vocabulary and neither is a new mechanism — both are the lifted treatment's own rays with
something else deciding how far along them a stroke sits, which is exactly what M3's γ decides. **Sky**: the window
tipped up, every stroke on the dome, for a canvas of a sky. **Ground**: the wall laid flat, for a canvas that is a
picture of the ground. Both are chosen by the same measurement that chooses between lifted and present, and where a
station overrides that measurement the station file carries the reason.*

*M3 builds the lifted treatment and finds that only half of what it assumes is in the paint. The **horizon is
measured**: the row that best splits the canvas into two colour populations, and what says it is a horizon rather
than merely the strongest boundary on the canvas is that it is horizontal — the best level cut beats the best upright
cut by 72×, 39× and 11× on the three canvases of station 4, and by 2.4× and 2.1× on a self-portrait and a bed of
irises run through the same code as controls. The lines land on the Alpilles, on the wall at the far edge of the
Reaper's field, and on the edge of the ploughed ground under the Sower's sun.*

*The **recession is not measured**, and the shape of the nothing is worth having. If a canvas encodes a receding
plane its marks shrink with distance. Across the whole depth of these pictures the marks vary by under a fifth —
5.8 mm at the horizon against 5.3 mm at the viewer's feet on the Reaper — where a plane over the same depth demands a
factor of twenty-six. On two canvases of three the drift runs the wrong way. It is statistically real and physically
negligible: the brush does not know how far away anything is. The one other place the evidence could have been, the
convergence of the marks themselves on the measured horizon, fires on the Harvest at 1.21× a shuffled control and
fires on a self-portrait at exactly the same 1.21×, so it separates nothing.*

*So a lifted canvas is a measured line with a constructed plane hung under it, and the piece says so in the caption
rather than in a footnote. The construction has one property that earns it: **every stroke stays on the ray it came
off the canvas on**, so from the painter's position the lifted world is the painting, exactly, whatever the plane
does behind it. The scale is not chosen either — it is DESIGN 6's eye height of 1.65 m and the measured horizon,
which between them put the bottom edge of the canvas 4.7 m in front of you on the Harvest. The one free constant is
how wide the canvas is taken to be from where he stood, and it is 50°.*

*And the treatment is now chosen by that measurement rather than asserted in §7's table. A canvas whose level cut
does not beat its upright cut by 5× has no horizon in it and is not a place; it stands as a wall of paint, which is
what *present* already meant.*

The rule that keeps this from becoming a promise we cannot keep: **every station declares a viewing volume**, sized by
how much depth information its canvases really carry. Inside it you walk freely. At its boundary you are eased back,
not blocked — and the way to leave is the scrub, which is the transport. The Potato Eaters is a small dark room. The
Harvest is a wide shallow slab: you can walk the ridge, not out into the plain. Saint-Rémy is large, because a hill
and a sky dome are both genuinely 3D.

Stating this explicitly is what stops us from quietly drifting into modelling the whole of Provence, which is the
failure mode that ate `monets-universe`'s schedule.

### 4.5 Rendering

- **Geometry.** One instanced draw per (station, act). The instance is a unit ribbon; a vertex shader sweeps it along
  the stroke's Bézier, applying width, height and a slight twist. Six segments near, two mid.

  *M1: segments **along** the ribbon were never the problem; columns **across** it were. Three columns is a
  triangular prism, which is invisible while the ribbons are nearly flat and is a tent with a ridge line down it the
  moment they have real height. Near is now seven columns and eleven segments, mid is three and two.*
- **The scrub is one uniform.** `uScrubOrder`. Strokes with `order > uScrubOrder` are collapsed to degenerate
  triangles in the vertex shader. Strokes inside the arrival window extrude partially. **Nothing is ever rebuilt, no
  buffer is ever re-uploaded, and the entire ten-year timeline is a single float.** This is the same trick
  `monets-universe` uses for the hour, and it is the reason that app can re-light a whole world in a frame.
- **Impasto.** The ribbon carries a normal that bows across its width, so the paint has a rounded top and catches a
  rim. One tight specular lobe, one broad. Contact shadow approximated per-stroke from `height` and the light
  direction rather than with a shadow map — cheap, and at this scale indistinguishable.

  *M1 adds one thing this list does not have, and the 1:1 gate would not pass without it: **a brush has hairs, and
  they leave furrows running along the mark.** A ribbon whose normal only bows across its width turns through about
  19°, which is too little for any specular lobe to catch, and the scan's brightest one percent sits at luma 208
  against the render's 165 — the whole difference between wet paint and wax. Furrows turn the surface through that
  much every half millimetre, and they are where the sheen lives. Two frequencies, a per-stroke phase, an amplitude
  of about a tenth (a furrow is tens of microns deep on a half-millimetre pitch), and faded by how fast the phase
  moves across the screen or it becomes corduroy at the second step backwards.*
- **The substrate is a character.** The weave shows where paint is thin, and it **changes over the ten years**: he ran
  out of canvas at Saint-Rémy and painted on coarse jute, so the cloth under the world visibly roughens in 1889. True,
  free, and nobody has ever shown it.
- **LOD, three tiers.** Near: full lit ribbon (~24 tris). Mid: a single oriented quad with a soft mask — which is
  exactly `monets-universe`'s patch, so that work is reusable. Far: baked to a texture, because at forty metres a
  Van Gogh *is* a flat image. Tier by screen-space stroke width, not by distance.
- **Motion.** Slow, and only where the canvas itself moves: the Starry Night spirals turn **along their own curl**,
  each at its own rate, which is a per-stroke rotation about its arc centre and nothing like a scrolling texture. The
  mistral moves the cypresses and the wheat. Finished paint otherwise holds still. A Van Gogh does not shimmer.

  *M4 measures that sentence and half of it does not survive. The measurable part is **how far a stroke may go**:
  slide it along the circle through its two ends and its own midpoint, sample the scan underneath, and stop where
  the colour it lands on stops being a colour the tracer would have accepted as part of it. That is a distance in
  millimetres per stroke and it is what the runtime spends — a mark in the crowded middle of a vortex barely moves,
  a long one in the open sky moves further, and neither number was chosen.*

  *What does not survive is "nothing like a scrolling texture". Against a straight slide along the tangent, the arc
  wins by 1.29× on the Starry Night — and by 1.35× on a bed of irises and 1.38× on an olive grove, which are not
  vortices. It separates nothing: sliding a curved stroke along its own curve beats sliding it straight on any
  canvas of curved strokes. What does separate is the **mirrored** arc, which breaks 1.4× to 2.1× sooner
  everywhere, so the direction of the curl is real paint. And a test of whether neighbouring strokes agree about
  where the centre is puts the Starry Night at 2.04× its own shuffled null against the irises' 2.19×. So: the curl
  is real, and it is not special to this canvas. His mark-making is locally coherent everywhere and the swirls are
  a composition out of that habit rather than a different local statistic. The rate is not in the paint at all —
  there is no time in a painting — and it is one declared number per station.*

---

## 5. The scrub: time as the primary control

### 5.1 Model

A single scalar `τ ∈ [0, 1]` mapping to the ten years, non-linearly — the dense months get more of the range, so
Nuenen 1885 and Paris 1887 are not the same length as July 1890. Mouse wheel, two-finger scroll, swipe, or drag the
timeline at the bottom edge. `←` `→` step by a week, `,` `.` by a day.

τ drives two things: **which station you are in** (and the transit between them), and **how far the making has got**
within that station. Both from one number, because in this piece they are the same thing — the world is painted in the
order it was painted in, and walking forward in time is walking north.

*M4 builds that axis and the non-linearity turns out to need no curve: **a station's share of τ is its own strokes
over its own burst rate**, which is how long the making takes, and between two stations is a transit of a flat
sixteen seconds because nothing is being painted on one. With stations 4 and 8 built, two weeks of June 1888 get 33%
of τ and the eleven months after them get 28%. The band along the bottom edge is the ten real years, linear, so the
handle crosses it in lurches — and that is the mapping the paragraph above asks for, with the record making it
non-linear rather than a curve. The two axes must not be confused: τ is time in the piece and the band is time in
his life. Dragging the band inverts the map by bisection.*

### 5.2 Acts

Within a station, the strokes are grouped into a handful of named **acts** so that arrival has structure instead of
being a uniform fizz: typically *ground*, *sky*, *land*, *subject*, *contour*, *light*. Acts arrive in bursts with
holds between them. The hold is what lets the viewer look — a burst of four thousand strokes over two seconds, then
three seconds of standing in a sky with no ground under it.

*M2 makes the boundaries fall out rather than be drawn. The solved sequence is cut where cutting it most reduces the
within-span scatter of what a stroke is — where it sits, how light, how wide, contour, highlight — and each span is
named by a rule over its own contents, from the six names above. The Reaper comes out contour 460, land 10,276,
subject 4,160, sky 3,340, light 425 and a second sky of 263: six acts, five holds, about twenty-one seconds
for one canvas. Only the
vocabulary and the naming rule are chosen; where one act ends is a fact about the order.*

### 5.3 Pacing, per station

*The global constant is fixed at M2 and it is **4,000×**. Stroke density is 2.75 per square centimetre, within six
percent across three canvases spanning three times the area and three stations, so the Reaper is 18,924 strokes and
a canvas of that size is something like ten hours of painting: he worked at about half a stroke a second, and
§5.2's burst of 2,000 a second is four thousand times that. The absolute rate is therefore fiction and there is no
version of this where it is not; what one constant buys is that every relative tempo is true. The hold does not take
the constant — a night between sessions at 4,000× would be eleven seconds of nothing — so a hold is punctuation at
a fixed 2.4 s and what the record supplies is how many there are, not how long. The whole work is about 550,000
strokes and 273 seconds of arrival, which is a third of a fifteen-minute piece rather than the fifth `BUILD.md`
assumed.*

Real where the record supports it (§4.3), invented where it does not. The *Potato Eaters* accumulates slowly out of a
winter. The orchards detonate. *Wheatfield with Crows* is one continuous rush with no holds at all, and it is the last
thing that happens.

### 5.4 Past finished

At the right-hand end of a station's making, do not stop dead. Let the last act overshoot slightly — a few hundred
extra strokes, curl tightened, value pushed — then settle. It reads as the hand not wanting to put the brush down,
which is both true of him and a much better transition than a fade.

---

## 6. The walk: space as the secondary control

- Drag to look; click for pointer lock. WASD / arrows to walk. Touch: look by drag, walk by a thumb pad.
- **No fly mode.** Flight belongs to a world you survey. This one you stand in.
- Eye height 1.65 m and the body has weight: the head moves slightly on each step, and it is worth getting the gait
  right because it is the only thing telling the viewer they have a body.
- **Lie down.** `Z`, or a long press. The camera goes to the ground and looks up. The single best thing in the piece
  is *The Starry Night* overhead with its spirals turning, and you cannot see a sky properly standing up. No other
  piece of this kind lets you lie down.
- The viewing volume (§4.4) bounds the walk. Its boundary is a gentle return, never a wall and never an invisible
  collider — if the viewer is fighting the edge, the volume is the wrong size.

*M4 makes the transit real and it costs one line: `body.x, body.z` stop being world coordinates and become where
you are inside a station, the base is which station, and on the road the base is between two. Adding them is the
whole transit — τ moves the base, the walk moves the body, neither knows about the other, and the sum is continuous
in both, so τ cannot jump. The road runs out of the back of a station, where nothing is painted, so a viewer facing
forward watches the plain he has just made recede and arrives at the next station already facing its first canvas.
A station's paint goes dark by distance from its own standpoint, because paint laid to be seen from six metres and
seen from a hundred is DESIGN 4.4's own word for it, grotesque.*

*M3 instruments that last sentence and it is not comfortable reading. Station 4's slab is 12 × 7 m, its depth taken
from where the lifted paint thins to a quarter of the density it has underfoot — six metres on the Harvest. Three
scripted walkers spend 93%, 83% and 72% of their time within half a metre of the boundary, because any walker with a
net forward drift arrives at the edge and then stays, and a body walks 87 m in a minute. Growing the slab, the amble
comes under a fifth at **50 × 40 m** — a hundred metres by eighty. So the volume the canvas can justify and the
volume a walking body wants differ by about seven times in each direction, and one of the two has to give. This is
§15's open question with numbers on it; a person is still what decides it.*

*M4 puts a second number beside it from a treatment that fails differently. A shell does not thin, it tears, and the
step that opens a stroke-wide hole in a twentieth of the olive grove's neighbouring pairs is **2.34 m**. Station 8
ships at 9 × 6 m and its walkers return 94%, 84% and 84%. So the three numbers are 2.3 m shelled, 6 m lifted, and
fifty for an ambling body. The gap did not close; it widened.*

---

## 7. The stations

Ten, plus the canvas before and the canvas after. The criterion for inclusion is not "can this be made walkable" —
it is **does this have a stroke system worth standing inside.** That admits the Potato Eaters and the self-portraits,
which are not places at all, and it lets us drop the geographic filler that a promenade would have needed.

```
                                        bare primed canvas, and the crows
                                                    ▲
                            [10] THE WHEATFIELD — 27 July 1890
                                 three paths, storm at noon, and the strokes stop
                             [9] AUVERS — May–July 1890
                                 cool green, thatch, the church, the frame widens
            ——————————————————— the descent north ———————————————————
                             [8] SAINT-RÉMY — 1889
                                 the walled garden · the window · THE STARRY NIGHT overhead
                                 olive groves where the ground writhes
            ——————————————————— the climb, the Alpilles ——————————————
                             [7] THE STROKES STOP — 23 December 1888
                             [6] THE NIGHT OF ARLES — September 1888
                                 the terrace · the café · the Rhône
                             [5] THE YELLOW HOUSE, INSIDE — Sept–Oct 1888
                                 the three bedrooms, superimposed · the sunflowers · two chairs
                             [4] THE HARVEST — June 1888
                                 wide, hot, yellow · the sower at the far edge
                             [3] SNOW, THEN BLOSSOM — Feb–April 1888
                             [2] THE CORRIDOR OF SELF-PORTRAITS — Paris 1886–87
                                 the world bleaches, then floods
                             [1] THE POTATO EATERS — Nuenen, April 1885
                                 one lamp, five figures, almost no colour
                                                    ▲
                                        bare primed canvas, one charcoal line
```

| | Station | Date | What you stand in | Treatment |
|---|---|---|---|---|
| 0 | **Primed canvas** | — | White, woven, empty. One charcoal line on the ground going forward. This is also the loading screen: the wait is the thesis. | — |
| 1 | **The Potato Eaters** | Nuenen, Apr 1885 | A low dark room, one oil lamp, five figures, coffee. Strokes thick, muddy, slow, earth and bitumen. You can barely see. This sets the floor of the piece so that everything after it can fly. | built |
| 2 | **The corridor of self-portraits** | Paris, 1886–87 | Walk out of the cottage and the world **bleaches, then floods**. He painted ~25 self-portraits in two years because he could not afford models: hang them as a corridor, each in a different stroke system, because he is learning colour in public and you can watch it happen down the length of a hallway. Asnières, the Seine, the Montmartre windmills to either side. The most violent palette change in the history of painting, and it costs us nothing because it is simply what happened. | present |
| 3 | **Snow, then blossom** | Arles, Feb–Apr 1888 | He arrived in the south to unexpected snow. Then the orchards go off — fourteen canvases in five weeks, **the fastest scrub in the piece**, blossom arriving in volleys. *Almond Blossom* as a ceiling; flat is fine when it is overhead. | lifted |
| 4 | **The Harvest** | La Crau, Jun 1888 | Wide, hot, yellow, the blue cart. *The Sower* at the far edge of the plain. The mistral, which he complained about in letter after letter and which physically moved his easel. | shelled |
| 5 | **The Yellow House, inside** | Sept–Oct 1888 | Home, and it is small. Up the stairs: **the three Bedrooms occupying the same space**, so that walking forward changes the colour of the room around you without a cut. That is what a repetition actually *is*, and no gallery can hang it that way. The Sunflowers enormous and close. The two chairs facing each other across the floor. The only safe place in the universe. | built |
| 6 | **The night of Arles** | Sep 1888 | Out into dusk. The Café Terrace, the Night Café, the Rhône under the Dipper. Here each individual stroke becomes **a star or a gaslight** — the atom of the paint and the atom of the subject are the same object, which happens nowhere else in his work. | built + shelled |
| 7 | **The strokes stop** | 23 Dec 1888 | No ear. No blood. No razor. **The painting simply stops mid-canvas**, the brush sound cuts, and the scrub refuses to advance for a beat. Then it resumes somewhere else, on rougher cloth. The restraint is the entire effect and it will be tempting to ruin. | — |
| 8 | **Saint-Rémy** | 1889 | The walled garden, *Irises* as the literal ground at your feet — he painted them in that garden. Then the window, and the night: **The Starry Night as a sky, overhead, each spiral turning along its own curl.** Cypresses. Olive groves where the ground itself writhes. The summit of the piece, and the reason to lie down. | lifted + shelled |
| 9 | **Auvers** | May–Jul 1890 | Descend into cool green and grey-blue. Thatch, *Daubigny's Garden*, the church with its two paths splitting around it. The canvases go double-square here (50 × 100 cm) — so **the frame of the world itself widens**, which the viewer will feel and not notice. | lifted |
| 10 | **The wheatfield** | 27 Jul 1890 | Three paths. Crows — the only living creatures in the universe, and if the viewer looks back they have been in the corner of the eye since Arles. The rush with no holds. Then the strokes stop arriving and you are standing on bare primed canvas with the field behind you. | lifted |
| 11 | **After** | — | Nothing, held far too long. Then the crows again, and the end. | — |

*M3 builds station 4 and the treatment column moves for it: **lifted**, not shelled. Shelled is per-stroke depth and
that is M4's; what M3 establishes is that the lifted treatment is not a fallback but the thing the canvas can
actually support, because the horizon is measurable and the depth is not. The station stands three canvases at 0°,
+68° and −68° around one standpoint, on one continuous plain under one dome, painted in the order he painted them.
One of the three is out of place and knowingly so: *Wheatfield with a Reaper* is Saint-Rémy, September 1889, and by
this table it belongs at station 8 — §8.2's own list asks for* Haystacks in Provence *here instead. It is at station 4
because it is the canvas the whole pipeline was built and measured on. The station file records that, and the date
readout says September 1889 while the timeline's handle is still inside June 1888. It has to be settled at M6, when τ
becomes a chronology.*

*M4 builds station 8 and its treatment column becomes three columns, because the station's three canvases get three
different answers out of one rule. **Irises** scores 1.7× on the level-against-upright cut — the lowest in the whole
collection, below a self-portrait's 2.6× — so there is no horizon in it and it is not a place; it is a picture of
the ground, so it is laid flat at 1:1 and it is where your feet are. **The Starry Night** scores 2.0×, which is
what a self-portrait scores, so by the same rule it is not a place either: it is hung by its middle rather than by
a horizon it has not got, tipped up 52°, and it is the sky. **The Olive Grove** scores 105×, the strongest in the
collection, and is shelled anyway — the override is a fact about the station rather than about the canvas, because
station 8 already has a sky overhead and a ground underfoot and what it has not got is a middle distance. The
horizon the measurement found is still what puts it at eye level.*

*Tipping the sky up is the one decision at this station that is not a measurement, and it has a cost worth writing
down. A canvas is about forty degrees of the world and a sky is a hundred and eighty, so a canvas cannot go
overhead without either being stretched or being put somewhere it is not. Hanging it by angle — a fixed number of
degrees per centimetre — makes it read the same from any direction and stops it being the painting from any single
one. Keeping M3's window makes it exactly the painting from wherever the window points. So the window points where
a lying viewer looks, and standing up the sky is above you and you have to lie down for it, which is §6's whole
argument arrived at by having to choose.*

The arc: **dark → flood → yellow → night → stop → stars → green → end.** The brightness peaks immediately before
there is nothing, which is the true shape, and because the scrub is in the viewer's hand **the ending is something
they did.**

---

## 8. The paintings

### 8.1 Criterion

Does it have a stroke system worth standing inside? That is the only test. A work can be included as a room, a ground,
a ceiling, a wall, or a sky, and the treatment follows the canvas rather than the reverse.

### 8.2 The list

**Station 1** — *The Potato Eaters* (Apr 1885, Van Gogh Museum), with two or three of the Nuenen head studies on the
wall behind.

**Station 2** — a corridor of self-portraits, 1886–87, drawing on the Van Gogh Museum's and the Art Institute's
holdings; plus *Bathing Boat on the Seine at Asnières*, *Restaurant de la Sirène*, and a Montmartre windmill.

**Station 3** — *Landscape with Snow* (Feb 1888); the orchard series — *The Pink Peach Tree*, *Orchard in Blossom*,
*The White Orchard*; *Almond Blossom* (1890, painted at Saint-Rémy but it belongs overhead here) as the ceiling.

**Station 4** — *The Harvest / The Blue Cart* (Jun 1888, Van Gogh Museum); *The Sower* (Jun and Nov 1888); *Haystacks
in Provence*.

**Station 5** — *The Yellow House (The Street)* (Sep 1888, Van Gogh Museum); **the three Bedrooms** (Van Gogh Museum /
Art Institute of Chicago / Musée d'Orsay); the Sunflowers (five versions — London, Munich, Amsterdam, Tokyo,
Philadelphia); *Van Gogh's Chair* and *Gauguin's Chair*; *La Berceuse*; *The Postman Joseph Roulin*.

**Station 6** — *Café Terrace at Night* (Kröller-Müller); *The Night Café* (Yale); *Starry Night Over the Rhône*
(Orsay). All three motifs are within about three hundred metres of each other in the real Arles, which is a gift: the
station is geographically honest even though the piece is not.

**Station 8** — *Irises* (Getty); *The Starry Night* (MoMA); *Wheat Field with Cypresses* (Met, and the National
Gallery London); *The Olive Trees* (MoMA) and the other olive groves; *Cypresses*; the asylum corridor and garden
studies; *Enclosed Field with Rising Sun* as the daylight state of the Starry Night enclosure.

**Station 9** — *The Church at Auvers* (Orsay); *Thatched Cottages at Cordeville* (Orsay); *Stairway at Auvers* (Saint
Louis); *Daubigny's Garden*; *Wheatfield Under Thunderclouds*.

**Station 10** — *Wheatfield with Crows* (Jul 1890, Van Gogh Museum).

**Deliberately excluded.** The Hague and Drenthe work, which would stretch the opening past its usefulness. *Père
Tanguy* and the Paris portraits beyond the self-portraits. The Saint-Rémy copies after Millet and Delacroix, which are
fascinating and are a different essay. And anything whose location would have to be invented — the strength of the
thing is that every station is a findable place or a real room.

### 8.3 Sources and rights

Everything is public domain; he died in 1890. Reproduction access is considerably easier than it was for
`monets-universe`:

| Holder | Terms |
|---|---|
| Van Gogh Museum, Amsterdam | high-resolution downloads of the collection |
| The Metropolitan Museum of Art | Open Access, CC0 |
| Art Institute of Chicago | CC0 for public-domain works |
| Yale University Art Gallery | open access |
| J. Paul Getty Museum | Open Content |
| Musée d'Orsay, Kröller-Müller, MoMA | not open access; use the highest-resolution Wikimedia Commons files and record the provenance |

`paintings/CREDITS.md` follows `monets-universe`'s example exactly: every canvas, its collection and accession number,
the reproduction used, its pixel dimensions, and any reason one source was preferred over another. That file was one
of the best things about the Monet project and it should be written as the scans are gathered, not afterwards.

**Written, and the gathering is done: 40 scans, 4.41 gigapixels, in `ref/originals/`.** Four findings from it that
this document did not anticipate:

- **Judge a scan by px/cm, not megapixels.** A 42 MP scan of a 114 cm *Potato Eaters* is a far worse source than a
  42 MP scan of a 33 cm study. The target is ~120 px/cm; CREDITS.md carries the column and the reasoning.
- **The Van Gogh Museum's IIIF caps a single request at ~42 MP and says nothing.** Its gigapixel scans arrive
  silently downsampled — *Daubigny's Garden* at 42 MP when the source is 449 MP. Region requests are uncapped, so
  `tools/micrio_stitch.py` tiles and reassembles; seven works were recovered that way.
- **A gigapixel scan does not have to be decoded to be used.** *The Starry Night* is 44,567 × 35,291 and 4.7 GB of
  pixels, which does not fit in the machine this is built on. A JPEG can be decoded straight out of its DCT
  coefficients at a half, a quarter or an eighth, so the working image comes out at 120 px/cm without the full
  decode ever existing. The rule that keeps it honest is that the DCT step must never become the resampler: ask for
  at least twice the working width, so the LANCZOS pass that follows is still a downsample by two. Every other scan
  in the set is already inside that factor and reduces by nothing, which is why no golden moved.
- **The Musée d'Orsay serves 850 px maximum**, and holds two canvases the piece cannot do without
  (*Starry Night Over the Rhône*, *The Church at Auvers*). Both fall back to ~46 px/cm. This is the one sourcing
  problem with no solution in hand; the C2RMF laboratory scan of the third *Bedroom* suggests where to look next.

---

## 9. The voice

One line from his own letters per station, dated, appearing in the air as you reach the canvas it describes, in small
type, fading after several seconds. His words, not ours. No narrator, no audio guide, no actor.

Source: the Van Gogh Museum's complete annotated edition at `vangoghletters.org`, free and authoritative, with letter
numbers and dates. Rules:

- **Every quotation is verified against the edition before it ships, and cited by letter number and date** in
  `letters/`. Van Gogh is one of the most misquoted people in art and the web is full of lines he never wrote. No line
  goes in from memory, including the famous ones.
- One line per station. Two at most. The temptation will be to use a dozen and the piece will sag under them.
- Pick lines about *the work* — what he was trying to do that week, what colour he was after, how fast he was
  painting — not the biographical ones. The biography is already in the shape of the piece; the letters should be the
  voice of a working painter, because that is what they mostly are.
- Subjects to go looking for: the arbitrary use of colour to express rather than reproduce; the red and green of the
  Night Café; working on the sunflowers from sunrise because the flowers fade; colour doing the work in the Bedroom;
  the mistral; the cost of canvas and paint; the number of canvases at Auvers.

---

## 10. Sound

Not ambience. **The brush.**

A stroke being laid has a sound — bristle dragging on weave, the small stick of loaded oil. One stroke is nearly
nothing; four thousand arriving over two seconds is a roar, and it comes from the direction the paint is arriving from.
When the burst ends the silence is enormous, and at station 7 the silence is the event.

Underneath: the mistral at Arles, cicadas in the Provence heat, the asylum's quiet, rooks at Auvers. Nothing else. No
score. No piano. Off by default, behind one button, because it is the one thing that will make a stranger close the
tab in the first two seconds — but it is half the piece for anyone who turns it on.

---

## 11. Interface

Two controls and a caption. That is all.

- **The timeline**, a thin band at the bottom edge: ten years, the station marks, the date, and the position. It is
  the scrub and it is the only persistent chrome. It thins to a hairline when the mouse is away from it.
- **The walk** has no interface.
- **The caption**, bottom left: the painting, its date, and its collection, fading after four seconds on arrival. A
  gallery plaque, not a HUD.
- **The letter**, when one appears: centred low, small, italic, his words, with the letter number and date beneath in
  very small type.
- One corner button for sound. One for photo. Nothing else — **no dock**, no quality popover (quality is measured and
  set automatically), no viewpoint list, no help overlay beyond a single line on first load.
- Photo mode saves the frame at device resolution. It should be tempting to use in the half-painted state, and the
  filename should carry the date the viewer was standing in.
- Typography: a serif for the titles and the letters, system sans for the small labels. The chrome is near-black and
  bone white and uses **none of his colours** — the interface must stay out of the painting, which is the one rule
  `monets-universe` got exactly right.
- Accessibility: the canvas carries an `aria-label` describing both controls; the timeline is a real slider reachable
  by keyboard with sensible step sizes; the caption and letter regions are `aria-live`; every letter quotation is also
  in the DOM as text, so the voice of the piece is available to a screen reader.

---

## 12. Performance budget

Strokes-as-geometry is heavier than patches-as-quads, and the LOD tiers (§4.5) are what make it affordable. Target
60 fps on an M-series laptop at 2× DPR, 30 fps on a 2022 phone.

| | Balanced | Rich | Light |
|---|---|---|---|
| Strokes resident (GPU) | 400 k | 800 k | 150 k |
| Strokes at near tier (lit ribbon) | ≤ 80 k | ≤ 180 k | ≤ 20 k |
| Triangles | ≤ 2.5 M | ≤ 5 M | ≤ 0.8 M |
| Draw calls | ≤ 120 | ≤ 160 | ≤ 90 |
| Blob streamed per station | ≤ 6 MB | ≤ 12 MB | ≤ 3 MB |
| Pixel ratio cap | 2 | 2 | 1.5 |

*M3 measures station 4 — three canvases, 37,535 strokes, 0.89 MB of blob — from the painter's position with
everything visible: 1.94 M triangles and 24 draw calls at Balanced, 6.3 ms of GPU. The table holds with room, and one
row is revised with the measurement that justifies it. "Strokes at near tier ≤ 20 k" was written when a near-tier
ribbon was about 24 triangles; the Light ribbon is now three segments by three columns, so 32,805 of them is 0.49 M
triangles — less than 20,000 cost when the number was set. The row that means anything is the triangle row.*

*M4 measures two stations at once — six canvases, 82,627 strokes, 1.90 MB of blob, all resident — and the worst
frame anywhere in it is **2.07 M triangles and 28 draw calls at 10.3 ms of GPU**, still 60 fps and still inside the
table. Load: every canvas of both stations is fetched and built by **0.85 s** and the single worst build is 7.7 ms,
so "entering a station never stalls the frame" is true because by then there is nothing left to do. The scrub is a
prefetch signal and at this size it does not have to be.*

*What the tessellation cannot fix is that at a lifted station **the level-of-detail never fires from where the viewer
starts**. A lifted canvas puts every stroke back on the ray it came off the canvas on, so a stroke subtends exactly
what it subtends on the canvas — about eight pixels, at the horizon and at your feet alike — and a screen-space
threshold demotes nothing at all. The LOD begins to work only once the viewer walks away from a wedge. That is
correct behaviour and it is also the reason the far tier will come back: a station of four lifted canvases will not
fit the way one of three does.*

Quality is **measured, not chosen**: sample frame time over the first three seconds and settle on a tier, then adjust
once per station. The viewer is never asked.

Load: station 0 is white canvas and a charcoal line, which needs nothing, so the piece is interactive in well under a
second and the first station streams behind it. The scrub tells us what to prefetch.

---

## 13. Technical shape

```
Van Gogh universe/
  DESIGN.md              this document
  BUILD.md               the build plan, then the progress log, one entry per milestone
  index.html             the piece: markup, CSS, one module script
  strokes/s04/*.bin      extracted stroke blobs, one per canvas, a directory a station
  underlayers/*.jpg      the residual wash layers (§4.1 step 7), small
  stations/*.json        station data: canvases, treatment, viewing volume, acts, pacing, letters
  letters/               verified quotations with letter numbers and dates
  paintings/CREDITS.md   every canvas, collection, accession, reproduction and its dimensions
  tools/extract.py       the extraction pipeline — offline, numpy/scipy/opencv
  tools/order.py         the crossing-order solver
  tools/place.py         where a canvas stands: the horizon test and its controls
  tools/curl.py          how far a stroke may move along its own arc, and its controls
  tools/shell.py         hand-authored per-stroke depth, and where the shell tears
  tools/pack.py          blob packing
  ref/                   not in the repository: full-resolution scans
  LICENSE
```

- three.js via import map from a CDN. One `ShaderMaterial` for strokes, one for the underlayer and weave, one for sky.
  No build step for the page.
- **But there is an asset pipeline**, which `monets-universe` did not have, and that is the real structural difference
  between the two repositories. The Python tools are run by hand, rarely, and their output is committed.
- Station data is data: adding a station should mean a JSON file, a directory of blobs, and nothing else.
- Seeded PRNG for every random choice, seed `18531890`, so the world is identical on every load and a shared frame can
  be found again.
- A small debug API on `window.vg`: the camera, τ, the current station, stroke counts per tier, fps, and
  `vg.scrub(τ)`, `vg.station(n)`, `vg.axis()`, `vg.volume()`, `vg.wander(kind, seconds)`, `vg.snap()`.
- No analytics, no fetched fonts, no network traffic after the blobs.

---

## 14. Build order

**M0 is a gate, and nothing else starts until it passes.**

0. **One canvas, standing up.** Extract ***Wheatfield with a Reaper*** (Saint-Rémy, September 1889; Van Gogh Museum
   `s0049V1962`) and render it as nothing but lit ribbons with real height, viewable from any angle, with a working
   scrub. One painting, one file. **Stroke extraction is the entire project**: everything in this document is
   worthless if the strokes do not read as Van Gogh when you are standing among them. If M0 does not give you chills,
   the idea is wrong and the cost of finding out was a day.

   *This used to say* Wheatfield with Crows, *on the assumption it was available at high resolution. Gathering the
   sources showed otherwise: it is a 103 cm canvas scanned at 7762 px, which is 75 px/cm — the lowest of any major
   work in the set, and the museum's native size, so there is nothing better to fetch. The Reaper is the same
   subject and the same violently directional wheat, on a 92.7 cm canvas at 12665 px: **137 px/cm, 1.8× the sampling**,
   and it adds the writhing sun, which is the hardest thing in the piece to fit and therefore the honest test. Crows
   stays as station 10 and is extracted later, once the pipeline is tuned. See `paintings/CREDITS.md`.*
1. **The first station.** That same canvas as part of station 4: ground lifted, sky dome, the walk, the viewing
   volume, the arrival animation, the acts. One station that works completely.
2. **Paint.** The underlayer, the weave, the impasto lighting pass, the three LOD tiers. The gate here is: does a
   close-up look like oil, and does the half-finished state look like an unfinished painting?
3. **Two stations and the transit.** Station data as JSON, the scrub as transport, a second station (station 8, for
   the sky) and the move between them.
4. **Interiors.** Station 5 — the Yellow House, and the three Bedrooms in one room. Proves geometry recovered from
   vanishing points, and it is the warmest thing in the piece.
5. **The arc.** All ten stations roughed in order, with the colour flood at station 2 and the substrate change at
   station 8. Everything walkable, nothing polished.
6. **The voice and the brush.** Letters, verified and cited. Sound.
7. **The two beats.** Station 7 and station 10–11 get their own milestone because they are the emotional load of the
   whole piece and they will need several attempts each. Expect to get station 7 wrong twice before it is quiet enough.
8. **Polish.** Automatic quality, mobile, photo mode, the accessibility pass, the performance pass against §12.

---

## 15. Open questions

- **Is the viewing volume enough walking?** The fear is that it reads as a rail. Test at M3 with someone who has not
  seen the design: if they spend their time pushing at the boundary rather than looking, the volumes are wrong or the
  idea is.
  *M3 built the instrument and could not supply the person. What the instrument returns for three scripted ways of
  moving is 93%, 83% and 72% of walk-time within half a metre of the boundary, against a limit of 20%; the amble
  needs a slab of 50 × 40 m to come in under it, and the paint thins to a quarter of its density six metres out.
  Read plainly: for a viewer who keeps walking, the volume the canvas justifies **is** a rail. That leaves three
  answers and the milestone that has to pick one is M6 — the volumes are much larger than the paint supports and the
  far field is thin; or the walk is not a free walk and the boundary should be something other than a return; or the
  metric is wrong because it counts standing at the edge as pushing at it, and what should be counted is a viewer
  who is trying to leave.*
  *M4 adds the shelled treatment's own limit, which is sharper and smaller: 2.34 m, where a twentieth of the
  neighbouring stroke pairs have opened a gap a stroke wide. Three answers stand; the second one gained weight,
  because a boundary at two metres is not a volume a free walk can be had in at all.*
- **Continuous scrub or quantised to stations?** Current position: continuous, because the transits are part of the
  arc. Revisit if the transits turn out to be dead time.
  *M4 builds one and it is dead time at the moment, honestly so: the eleven months between June 1888 and May 1889
  are stations 5, 6 and 7 and none of them exists, so the road is six hundred metres of dark with the date running
  under it. That is not an argument for quantising — it is an argument for M5 and M6, after which the road is short
  and has things on it. The question stays open until there is a road worth judging.*
- **How much impasto is too much.** The height estimate of §4.1 is weak, and a slightly exaggerated relief will read
  as more Van Gogh than the true one. That way lies the projection show. Position: calibrate against raking-light
  photographs for the two or three canvases where they exist, then apply that calibration everywhere and do not
  exceed it.
- **Station 1's ugliness gate.** The *Potato Eaters* is deliberately dark and nearly colourless, and some viewers will
  leave in the first thirty seconds. Mitigations: keep it short, make the lamp genuinely beautiful, and let the
  charcoal line of station 0 visibly lead somewhere. But do not brighten it. The flood at station 2 only works because
  of it.
- **Station 7.** Too coy and it is a bug; too literal and the piece becomes a biopic. One beat of silence and a
  refusal to advance is the current answer and it needs testing on strangers, not on us.
- **The coda.** Nothing, or the canvases as they are now, in their museums, with labels? Current position: nothing,
  held uncomfortably long, then the crows. The museum coda is the safer choice and the worse one.
- **Depth estimation.** Monocular depth on a Van Gogh is outside the training distribution of every model worth using.
  Expect to hand-author most depth and to treat the estimate as a first draft.
  *M4 hand-authored it — twenty-seven control points in canvas coordinates with a depth in metres each, interpolated
  by inverse distance, written in the station file where a person can read and argue with them. No estimate was
  attempted and the position above is unchanged. What the milestone adds is that the authoring does not have to be
  good for the number that follows from it to be honest: where a shell tears is a closed form over the authored
  depths, so a worse authoring gives a worse volume rather than a wrong measurement.*
- **Title.** "Van Gogh's Universe" is the folder, and it is the sibling of `monets-universe`. Something about the hand
  would be truer. Not urgent.

---

## 16. Licence

The code will be MIT. The paintings are by Vincent van Gogh (1853–1890) and are in the public domain;
`paintings/CREDITS.md` records every canvas, its collection and the reproduction it was extracted from. The letters
are quoted from the Van Gogh Museum and Huygens Institute edition at `vangoghletters.org` and cited by letter number.
three.js is used under the MIT licence.

The experience shape owes its existence to `monets-universe` in this repository's neighbour directory, and through it
to *A town made of paint* (`van-goghs-town.surge.sh`). §2 records what is kept — almost nothing but the discipline of
one HTML file, data-driven places, and an interface that stays out of the painting — and why everything else had to
change.
