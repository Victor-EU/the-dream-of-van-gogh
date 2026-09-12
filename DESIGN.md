# Van Gogh's Universe — design

> **Status.** Written before the build, September 2026. This is the record of intent; `BUILD.md` will record what
> actually happened, milestone by milestone. Nothing here has been prototyped yet. §14 names the one experiment that
> decides whether the project is possible at all, and it comes before everything else.
>
> **M9, on the author's word.** As built through M8 the piece opened on grey, scrubbed time with the arrow keys and hung
> most of its canvases in a void. After seeing it the author asked for a refactor, and three things in this document
> no longer hold. The scrub is not the control: the walk is, and time is distance along the road. The world between
> the canvases is painted rather than left as primed cloth. The opening is the world painting itself, not a wait.
> `BUILD.md` M9 records what changed and why. The thesis, the act of painting, survives where the paintings are: on
> their easels, stroke by stroke.
>
> **Station 7, on the author's word.** After M9 the author asked for station 7, *The strokes stop*, to be taken out,
> and it is. The road now goes from the night of Arles straight to Saint-Rémy. Its row and the notes on it below stay
> as the record of what was intended; `BUILD.md` records the removal after M9.
>
> **The opening, on the author's word.** After M9 the author asked for the opening to be more like Monet's Universe's,
> with its animation taken from *The Starry Night*. There is no title card and no button now. The page opens on *The
> Starry Night* painting itself on a primed canvas from its own stroke record while the world is built; then it
> comes towards you, dissolves into the world, and the world is walkable at once. §11's "a single line on first load"
> is back, as the line of keys that waits for the first touch of a hand. `BUILD.md` records it after M9.
>
> **The red vineyard, on the author's word.** Later the same day the author asked for a place after *The Red
> Vineyard*, and it stands where station 7 stood: the road goes from the night of Arles through a red vineyard in
> November 1888 to Saint-Rémy. The land is painted from what he wrote he saw there, and his canvas stands in it on an
> easel. `BUILD.md` records it.
>
> **The coda, on the author's word.** Then the author asked for the walk to end on *Self-Portrait as a Painter*, as a
> tribute to him: a giant portrait at the end of the last scene. §15 had left the coda open between nothing and the
> canvases in their museums, and M8 built the nothing. The answer is neither: it is the painter. Past the end of the
> road, beyond station 11's bare canvas, his portrait stands 36 m tall on the easel every station has, scaled to hold
> it. It paints itself from its own stroke record once you are there, and the end card waits for it. `BUILD.md`
> records it.

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

  *M5 builds it and that sentence splits exactly in half. **The second clause is true and better than it knew.** Put
  the window's own axis through the vanishing point and give it the four edges of the back wall, and the room follows:
  the depth is h·f/s, the width is h·(u₀−u_l)·a/s each side, the ceiling is h(1 + (v₀−v_c)/s), where s is how far the
  back wall's floor line sits below the vanishing point. **f cancels out of the width and the height.** They are in
  units of the painter's eye height and nothing else, so a room's cross-section really does come off the canvas with
  no free constant in it at all — only the depth needs one, and it is the same hfov §4.4 has been declaring since M3.*

  ***The first clause is not shown, and the shape of the nothing is the finding.*** *`tools/room.py` looks for the
  vanishing point twice over. In the strokes: every straight mark's line extended, and the place most of them pass
  nearest. Then in the scan itself, through a line-segment detector, because a stroke record is a record of paint and
  a painting of a room is mostly paint that is not the room. Neither can put the point in the same place twice. Cut a
  canvas's marks in half at random and find the point in each half alone, and on the three Bedrooms the two answers
  land **7.8%, 62.4% and 90.7% of the canvas apart** — and on two of the three that is *worse than the same canvas's
  direction-shuffled null*. The scan's own detected segments do no better.*

  *What says the instrument is sound rather than blunt is where it does fire. Run over every canvas in the piece it
  finds a stable point on exactly two, and neither is a room: **Sunflowers at 1.9%**, twenty times better than its own
  shuffle, because a vase of flowers really does radiate from one place; and the **Olive Grove at 2.4%**. So the tool
  finds radial structure where there is radial structure, and reports none in three paintings of a bedroom.*

  *What makes that a finding rather than a shrug is the calibration, which grades the instrument on a known answer:
  re-point a fraction f of a canvas's own marks at one place with a few degrees of hand in them, and ask what f and
  what steadiness it takes. **A fifth of every mark on the canvas, drawn to within six degrees.** Below that the point
  is not recoverable; above it, it is recoverable easily. No painting is like that — the walls are painted with wall
  and the bed with bed — and looking at what the detector actually finds on the Bedroom says why: the floorboards are
  not drawn as lines at all. They are bands of colour. **His rooms are not ruled. The perspective is in the objects,
  and a human reads it from the bed and the table, which is not line convergence.***

  *So the six numbers a built room needs are authored, in the station file where a person can read them, exactly as
  §4.4's shelled depths are — and the arithmetic they feed is not. That is the same division M3 drew for the lifted
  plain (a measured line, a constructed plane) and M4 for the shell (an authored depth, a measured tear).*
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

*M8 found the substrate hiding the paint. The cloth under every canvas was placed through its world position, a
32-bit coordinate of kilometres, and a wall's cloth hangs a quarter of a millimetre behind its strokes; at the
stations six hundred metres apart it had been coming out in front of paint that lies close to it since M4 put them
there — a quarter of the Bedroom frame, a third of Auvers, and at station 7 the whole canvas. It is placed relative
to the camera now, as the strokes always were.*

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

***M5 closes it, for the one kind of place where it was never really open.*** *A built room's volume is not a
compromise between what the paint supports and what a body wants — it is the room, and a room is a thing bodies are
the right size for. Station 5 ships at 2.8 × 3.8 m, off-centre, because the walls stand 2.39 m to the left of where
he put the easel and 0.80 m to its right and a volume centred on the standpoint would walk you through one of them.
Two of the three walkers pass there: **0.3% and 7.1%** against the 20% limit, where nothing at stations 4 or 8 came
under 72%. The amble still fails, at 71.8%, because forty seconds of walking in a straightish line is not a thing a
bedroom can absorb — which is a fact about ambling, not about the room. So the volume question splits: **for an
interior it is answered, and what is left for M6 is only the landscapes.***

*And station 5 adds the one thing the walk does that τ cannot, which is the reason DESIGN 7 wanted this station at
all. Three canvases of one room, each with a distance into it at which it *is* the room, and walking forward hands
the paint from one to the next. Deliberately **not** a cross-fade: a stroke is either laid or it is not, chosen by
its own hash against the canvas's weight, so nothing is ever half-transparent, no two rooms z-fight, the light and
the relief stay exactly what they are, and a still is still a still — `?still` comes back byte-identical in the
middle of a handover. It costs no coverage, because each canvas covers about four fifths of itself and half of one
with half of another covers four fifths together. What the viewer sees is his second and third versions of the same
mark replacing his first, one mark at a time, which is what a repetition actually is.*

---

## 7. The stations

Ten, plus the canvas before and the canvas after. The criterion for inclusion is not "can this be made walkable" —
it is **does this have a stroke system worth standing inside.** That admits the Potato Eaters and the self-portraits,
which are not places at all, and it lets us drop the geographic filler that a promenade would have needed.

```
                     his portrait, as a painter, past the end of the road   (added after M9)
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
                             [7] THE STROKES STOP — 23 December 1888   (removed after M9)
                             [7] THE RED VINEYARD — November 1888   (added after M9)
                                 red rows · a canal · the sun low in a yellow sky
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
| 7 | **The strokes stop** | 23 Dec 1888 | No ear. No blood. No razor. **The painting simply stops mid-canvas**, the brush sound cuts, and the scrub refuses to advance for a beat. Then it resumes somewhere else, on rougher cloth. The restraint is the entire effect and it will be tempting to ruin. | removed after M9 |
| 7 | **The red vineyard** | Arles, Nov 1888 | A vineyard by a canal after the rain, the sun low in a yellow sky: red like red wine, he wrote, yellow in the distance, the wet ground violet and catching the setting sun. Nobody in the rows. The pickers and the woman under the parasol are on his canvas, which stands among them on an easel, and the canal carries the sun's broken path toward you. | added after M9 |
| 8 | **Saint-Rémy** | 1889 | The walled garden, *Irises* as the literal ground at your feet — he painted them in that garden. Then the window, and the night: **The Starry Night as a sky, overhead, each spiral turning along its own curl.** Cypresses. Olive groves where the ground itself writhes. The summit of the piece, and the reason to lie down. | lifted + shelled |
| 9 | **Auvers** | May–Jul 1890 | Descend into cool green and grey-blue. Thatch, *Daubigny's Garden*, the church with its two paths splitting around it. The canvases go double-square here (50 × 100 cm) — so **the frame of the world itself widens**, which the viewer will feel and not notice. | lifted |
| 10 | **The wheatfield** | 27 Jul 1890 | Three paths. Crows — the only living creatures in the universe, and if the viewer looks back they have been in the corner of the eye since Arles. The rush with no holds. Then the strokes stop arriving and you are standing on bare primed canvas with the field behind you. | lifted |
| 11 | **After** | — | Nothing, held far too long. Then the crows again, and the end. After M9, on the author's word, the road ends at his portrait: *Self-Portrait as a Painter*, 36 m tall on a giant easel past the bare canvas, painting itself; and then, on the author's word again, the crows of this station are gone, and the sky over him is empty. | — (the coda added after M9) |

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

*M5 builds station 5, and its column stays **built** for the three Bedrooms while the fourth canvas keeps what the
measurement gave it. **Sunflowers** scores **0.7×** on the level-against-upright cut — the lowest number the test has
returned on any canvas in this piece, below the Getty irises' 1.7× and a self-portrait's 2.6× — so it is not a place
by the widest possible margin, and *present* is not an override here but the answer. It stands 2.4 m tall a metre and
a half behind where he stood, which is the open side of the room and the thing you meet when you turn round. The
three **Bedrooms** score 3.9×, 1.0× and 2.6×: no horizon, correctly, because an interior has none — and `built` is
the override, with the reason being that the canvas is a room.*

*Two of the three Bedrooms are out of place by this table's own chronology and knowingly so, which is the second time
this has happened and the first time it was the point. The first Bedroom is Arles, October 1888. The second and third
are Saint-Rémy, September 1889 — a year later, painted in the asylum from the first, and by date they belong past
station 8. They are here because the station exists to put the three in one room. What it costs is the same violation
the Reaper makes at station 4 and it is recorded the same way. What it buys was not designed and fell out of the
dates: **walking forward in that room takes you from the room he was living in to the room he remembered a year later
from an institution, twice** — and because a canvas that τ has not reached cannot be walked into, you cannot get there
early. The chronology is the gate on the walk, which is the closest this piece has come to its two controls being one.*

*M6 builds the other seven and the treatment column stops being a column, because by now the measurement decides it
almost everywhere. Station 2 is six canvases and every one of them measures PRESENT — a wall of paint with no horizon
in it — which is not an override but the reason the station works: DESIGN 7 asked for a hang down a hallway and there
is nothing in a self-portrait to stand inside. Station 9 is five canvases with `treatment: null` on all five, and the
test finds a place in four of them and a wall in the fifth: the* Church at Auvers *scores **18.3×**, the seventh
strongest horizon of thirty, because there really is a line where the two paths part from the grass, while*
Daubigny's Garden *scores 0.9× and is a garden seen close. Two stations override, and both are rooms: the* Potato
Eaters *and the* Night Café *are `built`, which is what a canvas that is a room gets. Two canvases are hung overhead:
the* Almond Blossom *at 72° as a canopy at station 3, and the Starry Night at 52° as the sky at station 8.*

*The closest call in the collection is at station 6. * Starry Night Over the Rhône *scores **4.95×** against a
threshold of 5, and misses being a place by one percent. It is a wall, and the piece does not lean on the scale to
make it a river.*

The arc: **dark → flood → yellow → night → stop → stars → green → end.** The brightness peaks immediately before
there is nothing, which is the true shape, and because the scrub is in the viewer's hand **the ending is something
they did.**

*M6 measures the arc and half of that sentence is wrong. Area-weighted over each station's own stroke record, the
lightness runs 11.9 at Nuenen, 51.5 in Paris, **64.3** in the orchards, 51.8 at the Harvest, 59.3 in the Yellow
House, 44.5 at Saint-Rémy, 55.9 at Auvers and **37.1** in the last wheatfield; the chroma runs 11.1, 13.7, 22.5,
30.7, **35.9**, 21.2, 27.7, **34.7**. So the world **bleaches** in Paris — four times the lightness of the cottage
for almost no extra colour — and **floods** in Arles, one station later than this section puts it and going on for
three. And the brightness does not peak before there is nothing: it peaks in the blossom and the last canvas is the
darkest thing since Nuenen. What peaks at the end is the **colour**, which climbs again through Auvers to the
wheatfield. The shape is right and it is a shape in chroma rather than in light.*

*M8 builds the two beats a first time, and station 7 stops being empty. The sentence above is that **the painting
simply stops mid-canvas**, and M6 had read the station as the absence of a painting, which cannot stop. So it has
the canvas that did: in letters to Theo of 22 and 28 January 1889 he says the portrait of Augustine Roulin was the
canvas he had been working on when his illness interrupted him, and the edition's notes to both identify it as* La
berceuse*, F 504, at the Kröller-Müller. It is painted to half its strokes and no further; the brush is cut in the
middle of a burst, to exact zero in 8 ms; and the scrub refuses to advance for six seconds of the viewer's own time,
**whichever way it is being moved** — M6 had built the refusal for the scrub playing itself and let every hand
through. The readout gains a day, 23 December 1888, for the only time in the piece, and the plaque says what the
canvas is and nothing else. No ear, no blood, no razor. What stands there today is a stand-in, F 507, the last of the
five versions, until F 504 is fetched.*

*The end is station 11, a station file from M8: the last stretch of τ, six hundred metres out of the back of the
last field, bare primed canvas with no charcoal line on it, and no date on the readout at all. **The scrub playing
itself stops at the last stroke of the field**, so what is past it is reached with a hand or not at all, which is how
"the ending is something they did" is made true rather than likely. There the nothing is held for twenty-four
seconds and then the crows come, nine of them, in from behind and circling over the bare canvas. Every crow is his:
the birds are the black strokes of* Wheatfield with Crows*, found in its own record, and they have been in the corner
of the eye since Arles — one at station 3, two at 4, 8 and 9, three at 10 — each on a slow circle in the unpainted sky
outside every canvas, by a rule that keeps them off his paint rather than by hand.*

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

**Station 7** — *The Red Vineyard* (early November 1888, Pushkin State Museum of Fine Arts, Moscow): the station added
after M9.

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
| Pushkin State Museum of Fine Arts, Moscow | not open access; its own photograph of *The Red Vineyard* is on Commons at 11,406 × 9,092, and that is the file used |

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
- **The scan and the catalogue disagree about the shape of the canvas, and the piece was using both.** *Found at M5,
  and it is the same species of error as the two uncropped scans above: invisible in any one canvas, and visible the
  day two hang beside each other. Measured across the nine canvases in the piece, the ratio the scan's own cropped
  pixels give runs from 0.1% to **3.1%** away from the ratio of the centimetres the holder publishes — worst on the
  Getty's* Irises, *which is the canvas lying at 1:1 under the viewer's feet at station 8, and next worst on the
  Chicago* Bedroom *at 2.2%. The reason is usually visible in the figures themselves: Chicago publishes 92.3 × 73.6
  cm, which is 36¼ × 29 inches converted, and a rounded inch is ±1.3 cm on a canvas this size. So the rule from M5 is
  that **the shape comes from the scan and the size from the catalogue** — the scan is the artifact, cropped to the
  picture's own edge by `tools/canvas_edge.py`, and the catalogue is the holder's authority on how big it is. Nothing
  moved when it was corrected: all twelve goldens are byte-identical and every horizon ratio holds to a rounding.*
- **A date is a measurement too, and two of the ones this piece shipped were wrong.** *Found at M6, the moment τ
  became a chronology rather than a station-local scrub. `CREDITS.md` has refused since M0b to enter a canvas's
  dimensions unless the institution that owns it says so; nothing applied that rule to dates, which are the axis
  the whole piece is controlled by. `tools/dates.py` asks the Van Gogh Museum's own object pages, and the answers
  moved two canvases in stations already built. The Museum dates its* Sunflowers **January 1889**, *not August
  1888 — station 5 has been standing a repetition of the London canvas and calling it the original, which makes
  that station a station of four repetitions rather than three and was not designed. And it dates the* Olive Grove
  **November 1889**, *not the June-to-July the station file has said since M4, which put the canvas outside its own
  station's span; the span was widened rather than the date narrowed, because DESIGN 7 calls station 8 'Saint-Rémy,
  1889' and he was there until May 1890. Two more canvases turned out to be out of place and nobody had written it
  down:* The Sower *is November 1888 at a June 1888 station and has been since M3, and* Orchard in Blossom *is
  April **1889** at a station about the spring of 1888. So the rule `tools/station.py` now enforces is not that a
  canvas must be in its own year — the piece is allowed to put a canvas where the argument wants it —* **but that
  it may not do so quietly**: *a date outside its station's span with no note beside it is an error, and seven
  canvases are outside with notes.*

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

*M7 checked the citations before a word of text went in, and seven of the nine that M3 to M6 had typed were wrong:
the right number to the wrong person four times — 569 is to Horace Mann Livens and not to Wil, 590 and 678 are to Wil
and not to Theo, 628 is to Bernard — and three letters on a day the edition does not give them. The rule above that
no line goes in from memory had been kept for the quotations and broken for the citations, which is the same mistake
made one step earlier. So a line now gets into a station only through `tools/letters.py`, which finds it verbatim in
the named paragraph of the edition, writes the recipient, place and date in from the edition's own pages, and applies
a test this section did not ask for: **a line appears at the canvas the edition's own note says the passage is
about**, matched on the holder, the title and the size. Six of the nine do. The other three are about a week or a
whole station rather than one canvas, and their station files say why. Two of the nine are his words exactly,
because he wrote to Livens and to Russell in English. Of the subjects listed above, two are here — the red and the
green of the Night Café, and the colour doing the work in the Bedroom — and two could not be: the sunflowers painted
from sunrise are the August 1888 canvases and the piece stands the January 1889 repetition, and the mistral that
pegged his easel to the ground is, by the edition's note, on a painting the piece does not have.*

*M8 keeps station 10's line, which M7 left to it. It is about the work — the canvases he was making that week, and
what they were of — and it arrives after the rush, in the silence over the finished field, as the last words in the
piece. It stops before the half of the sentence that says what he meant them to express, for the reason station 7 has
no letter at all.*

---

## 10. Sound

Not ambience. **The brush.**

A stroke being laid has a sound — bristle dragging on weave, the small stick of loaded oil. One stroke is nearly
nothing; four thousand arriving over two seconds is a roar, and it comes from the direction the paint is arriving from.
When the burst ends the silence is enormous, and at station 7 the silence is the event.

Underneath: the mistral at Arles, cicadas in the Provence heat, the asylum's quiet, rooks at Auvers. Nothing else. No
score. No piano. Off by default, behind one button, because it is the one thing that will make a stranger close the
tab in the first two seconds — but it is half the piece for anyone who turns it on.

*M7 builds the brush, and `tools/listen.py` measures it from a recording of what the page actually played. There is
no sample in it: it is noise shaped by the record — the strokes crossing the scrub each frame set the loudness, ten
decibels for every tenfold, and the chunks they land in say where it comes from. A burst is **−16.0 dBFS RMS** at the
Harvest and **−13.9** at the night of Arles, peaking at −3.8 and −1.0; the corridor's small canvases never sustain
one and sit ten decibels under, which is the record's doing and not a setting. **When an act ends the output is
exactly zero within 280 ms of the last stroke** and stays zero for the whole hold — not quiet, zero — in all
twenty-one holds at three stations. **The louder ear is the side the paint is arriving on** in every one of the 313
frames where it arrived twenty degrees or more off centre, on the left at the corridor and the Harvest and on the
right at the night. What it has not had is a person listening to it, which is the half of this section a number
cannot do. The mistral, the cicadas and the rooks stay deferred until the brush has been lived with.*

*M8: at station 7 the silence is not left to the ordinary end of a burst. The brush is **cut** — everything it is
making, the strokes already scheduled a frame ahead included — to exact zero in 8 ms, where an act's end takes 280,
and it stays cut until the refusal is over. The first version let the stop's own last strokes lift the cut in the
same frame, and `tools/beat.py` heard the ordinary fall where the cut should have been.*

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

*M6 is the first measurement of the whole piece rather than one station: ten stations, thirty canvases, **315,638
strokes** and every one of them resident. Swept across the arc at Balanced and 2× DPR, τ from 0.02 to 0.995, the
worst frame anywhere is **1.27 M triangles, 25 draw calls, 3.4 ms of submit and 10.3 ms of GPU, at 60 fps
throughout** — against a budget of 2.5 M triangles and 120 draws. The triangle count is *lower* than M3's single
station because the chunk gating now has ten stations' worth of paint to reject: everything six hundred metres down
the road is dimmed to nothing and then not drawn at all. The resident row is the one under pressure, at 315 k of a
400 k budget with the piece a little over half its material — DESIGN 5.3 expects about 550,000 strokes — so the
milestone that has to face it is M9 with the far LOD tier that M4 already said would come back.*

*M4 measures two stations at once — six canvases, 82,627 strokes, 1.90 MB of blob, all resident — and the worst
frame anywhere in it is **2.07 M triangles and 28 draw calls at 10.3 ms of GPU**, still 60 fps and still inside the
table. Load: every canvas of both stations is fetched and built by **0.85 s** and the single worst build is 7.7 ms,
so "entering a station never stalls the frame" is true because by then there is nothing left to do. The scrub is a
prefetch signal and at this size it does not have to be.*

*M5 measures three stations — ten canvases, 126,849 strokes, 2.9 MB of blob — and the worst frame anywhere is still
**2.06 M triangles and 25 draws at 8.1 ms**, at station 4, which is where it was at M4. Station 5 is cheaper than
either of the others (0.76 M standing, 1.50 M in the middle of a handover) because a room only ever shows one of its
three canvases at a time, and the two roads are cheaper still: **73 k triangles and 2 draws** with nothing painted on
them. Everything is resident by 0.56–1.26 s. The one number that got worse is the worst single build, and taking it
apart is the useful part: it is entirely the **first** canvas to land, at 13–173 ms across runs, where every canvas
after it costs 1–23 ms with a median of 5. That is the first big allocation and the first pass through cold code, not
a per-canvas cost — so entering a station never stalls the frame, and arriving in the piece can, once.*

*One thing the dissolve does not save is vertex work. A canvas the walk has handed away collapses every stroke to
nothing in the vertex shader, which saves the fill and not the sweep — three Bedrooms' worth of ribbon was being built
every frame so that two thirds of it could be thrown away, at 4.29 M triangles. Skipping the draw outright takes it to
1.0–1.8 M, and only during a handover, when two canvases are genuinely alive, does it reach 1.5 M. The lesson is the
one M3's LOD row already carries: the triangle row is the row that means something.*

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
  strokes/s01/*.bin      extracted stroke blobs, one per canvas, a directory a station
  strokes/s02/*.bin      ... s01 the Potato Eaters through s10 the wheatfield, ten of them
  underlayers/*.jpg      the residual wash layers (§4.1 step 7), small
  stations/*.json        station data: canvases, treatment, viewing volume, acts, pacing, letters
  params/_base.json      every number the extractor tunes with, in one place
  params/<slug>.json     what is a fact about one canvas: its scan, its size, its regions
  letters/               verified quotations with letter numbers and dates
  paintings/CREDITS.md   every canvas, collection, accession, reproduction and its dimensions
  tools/extract.py       the extraction pipeline — offline, numpy/scipy/opencv
  tools/order.py         the crossing-order solver
  tools/place.py         where a canvas stands: the horizon test and its controls
  tools/curl.py          how far a stroke may move along its own arc, and its controls
  tools/shell.py         hand-authored per-stroke depth, and where the shell tears
  tools/room.py          the vanishing point that is not there, and the room built anyway
  tools/palette.py       the flood at station 2, against what a wrong profile could forge
  tools/station.py       the station files: stroke counts, and whether the arc's time holds
  tools/dates.py         when each canvas was painted, from the holder's own record
  tools/tiles.py         the two 1:1 regions a params file names, picked by measurement
  tools/pack.py          blob packing
  ref/                   not in the repository: full-resolution scans
  LICENSE
```

- three.js via import map from a CDN. One `ShaderMaterial` for strokes, one for the underlayer and weave, one for sky.
  No build step for the page.
- **But there is an asset pipeline**, which `monets-universe` did not have, and that is the real structural difference
  between the two repositories. The Python tools are run by hand, rarely, and their output is committed.
- Station data is data: adding a station should mean a JSON file, a directory of blobs, and nothing else.
  *Held at M6, which added seven stations. What each of them needed beyond its own file: `along`, so a corridor can
  hang canvases down a hallway rather than around a standpoint; a station with an empty `canvases` list, so station
  7 can be a beat rather than a place; and a road whose length comes from the two spans it joins. Three fields and
  no shader.*
- **Tuning is data too, and it is in one file.** *M6. Eleven `params/*.json` had each carried the same forty
  extraction numbers, copied from the Reaper — four of them said so in words. Thirty canvases would have carried
  thirty copies. `params/_base.json` holds them, `params/<slug>.json` holds what is a fact about that canvas, and
  anything a canvas overrides is the only tuning in its file and reads as tuning. The merged dict is what is hashed,
  so writing it down this way moved no blob.*
- Seeded PRNG for every random choice, seed `18531890`, so the world is identical on every load and a shared frame can
  be found again.
- A small debug API on `window.vg`: the camera, τ, the current station, stroke counts per tier, fps, and
  `vg.scrub(τ)`, `vg.station(n)`, `vg.axis()`, `vg.arc(n)`, `vg.at(x, z, yaw)`, `vg.presence()`, `vg.volume()`,
  `vg.wander(kind, seconds)`, `vg.snap()`. And two URL parameters that between them make any frame reproducible:
  `?tau=` says when, `?at=x,z[,yaw]` says where — which M5 needs, because at station 5 the walk is what changes the
  painting.
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
  ***M5 is the first station the instrument passes, and it changes the shape of the question.** Station 5's volume is
  a room — 2.8 m across and 3.8 m deep, off-centre because the painter was not standing in the middle — and two of
  the three walkers come in under the limit there: `forward` at **0.3%** and `look` at **7.1%** against 20%, where at
  stations 4 and 8 every walker failed at 72% to 94%. The one that still fails is `wander`, at 71.8%, and it fails
  for a reason that is not a fault in the room: an amble walks in a straightish line for forty seconds and a bedroom
  is three seconds wide. So **the volume question is not one question.** A room bounds a body correctly because a
  room is a thing bodies are already the right size for, and there is nothing to argue about at station 5. A landscape
  does not, and the argument there is entirely about how much invented ground is acceptable behind measured paint.
  M6 now has to answer only the second half.*
  ***M6 answers it, and first it has to take M5's number back.*** Station 5's volume is a box 2.8 × 3.8 m whose
  centre is 0.8 m to the left of the standpoint and 1.6 m in front of it, and the eased return that keeps a body
  inside it was measuring the half-extents from the **origin** while the instrument measured them from the
  **centre**. So the walker was held inside a box of the right size in the wrong place, comfortably within the
  boundary being scored, and reported 0.3%. With the return reading the same centre the instrument does, the same
  three walkers give **95.6%, 99.7% and 95.5%**. No station in this piece passes the edge test, and station 5 never
  did.
  **And nothing could have, because the edge test measures the walk rather than the volume.** Forty seconds at
  1.45 m/s is 58 metres. Any walker with a net forward drift reaches any boundary closer than that and then stands
  at it, and standing at it is scored as pushing at it — which is exactly why M3's sweep answered *50 × 40 m*: a
  slab a hundred metres by eighty is simply bigger than the walk. So M6 measures the third of M3's three answers
  instead of choosing between the first two. **Pressing** is the fraction of the walk spent holding a key that
  would take the viewer further out while the ground takes them back. Not standing at the edge — trying to leave.

  | | forward | wander | look |
  |---|---|---|---|
  | 2 the corridor, 5.2 × 32 m | 51.7% · **42.7%** | 89.1% · **68.1%** | 36.8% · **0.0%** |
  | 4 the plain, 24 × 14 m | 89.6% · **80.4%** | 86.9% · **77.2%** | 75.2% · **27.1%** |
  | 5 the room, 2.8 × 3.8 m | 95.6% · **86.2%** | 99.7% · **89.0%** | 95.5% · **32.6%** |
  | 8 Saint-Rémy, 18 × 12 m | 91.3% · **82.3%** | 89.9% · **80.2%** | 76.8% · **32.7%** |

  *(time at the edge · time pressing)*

  `forward` and `wander` never stop moving and press everywhere, which is a fact about them and not about any room:
  a walker that holds W for forty seconds is going to arrive at the edge of anything. `look` — walk a few paces,
  stop, turn, look, walk on, the only one of the three that resembles somebody looking at a painting — presses
  **0.0%** in the corridor at station 2 and about a third of the time at all three of the others. The corridor is
  the only volume in the piece longer than a viewer's forty seconds of walking, and it is the only one that holds.
  So the answer is the third one and it comes with a size: **the volume this piece needs is not what the paint
  supports and not a hundred metres — it is however far a looking viewer travels before they stop, which is tens of
  metres, and the instrument to check it with is `pressing` and not `nearEdge`.** Swept at station 4, `look` gives
  27.0% at the old 12 × 7 half-extents, 20.6% at 18 × 11, **12.7% at 26 × 16** and 0.0% at 40 × 25, so the six
  outdoor stations are set to 26 × 16 — the first size that comes under the fifth M3 pre-registered, and two to
  three times the old slab rather than the seven M3 feared. What that costs is a thin far field, because the plain
  is a quarter of its own density six metres out and this walks to twenty-six. `wander` still fails there at 49.6%
  and always will. This still wants a person in the chair, and it is still the only open question in this document
  a person could settle in ten minutes.*
- **Continuous scrub or quantised to stations?** Current position: continuous, because the transits are part of the
  arc. Revisit if the transits turn out to be dead time.
  *M4 builds one and it is dead time at the moment, honestly so: the eleven months between June 1888 and May 1889
  are stations 5, 6 and 7 and none of them exists, so the road is six hundred metres of dark with the date running
  under it. That is not an argument for quantising — it is an argument for M5 and M6, after which the road is short
  and has things on it. The question stays open until there is a road worth judging.*
  *M5 halves it. There are two roads now instead of one, June–August 1888 and October 1888–May 1889, and the second
  of them runs through **December 1888** with nothing on it — which is exactly where station 7 goes, and station 7 is
  the one station in the plan whose whole content is that nothing happens. So one of the two remaining stretches of
  dead road is not dead road at all; it is a station that has not been built yet and whose material is silence. The
  question stays open, and it now has one fewer piece of evidence against it.*
  ***M6 makes the roads mean something, which is not the same as closing this.*** With ten stations there are nine
  roads, and at M4's flat sixteen seconds each that was **more than half of the whole τ axis spent going somewhere**
  — and worse, it said every gap in his life was the same size. He left Paris on 19 February 1888 and was painting
  in Arles the week after; between Nuenen and Paris there are ten months this piece shows nothing of. So a road is
  now as long as the months it crosses: four seconds at least, because two stations whose dates overlap still stand
  six hundred metres apart and the body has to cross, and twenty-four at most. They come out **22, 4, 6, 8, 4, 10,
  13, 15 and 4 seconds**, the longest being Nuenen to Paris, and the roads fall from 57% of the axis to 44% with
  two stations still missing their paint. The metres stay at six hundred, because that number answers a question
  about the paint — a station's own plain runs to 260 m and two of them must not stand inside each other — so the
  *speed* on a road is whatever those two facts require, and it is not a quantity this piece means anything by.
  The question stays open until M7 puts a letter on the road and M8 decides whether the ending is quantised.*
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
  *M8 builds the first attempt — §7 says what it is — and cannot supply the stranger. What a person has to settle is
  written into BUILD M8 as a protocol: who, what to tell them, what to watch, what to ask, and the three ways to read
  it. Six seconds and half the canvas are the numbers they will be arguing with.*
- **The coda.** Nothing, or the canvases as they are now, in their museums, with labels? Current position: nothing,
  held uncomfortably long, then the crows. The museum coda is the safer choice and the worse one.
  *M8 builds the first of the two — nothing, held twenty-four seconds, then the crows — because it is this document's
  position, and leaves the museum coda unbuilt. BUILD M8 says the decision is made there; it is the author's, and it
  is asked for rather than assumed.*
  *After M9 the author decided it, and the answer is neither of the two: the walk ends on the painter. His*
  Self-Portrait as a Painter *stands past the end of the road, giant, and paints itself; what is left of the nothing
  is the blank canvas held before it. `BUILD.md`, after M9, records it.*
- **Where the room came from, and whether authoring it is enough.** *Opened at M5. `tools/room.py` cannot recover a
  vanishing point from either the stroke record or the scan's own line segments, and says precisely what that would
  have taken — a fifth of the paint on the room's lines, drawn to within six degrees. So a built room's six numbers
  are a person reading a canvas. Three things could still change that and none is M5's: fit the room to the shapes of
  the **objects** rather than to lines, which is what a human does and what the failure points at; use the fact that
  three canvases of one room over-determine it, which the block match already shows they do; or accept the authoring
  and spend the effort on the ceiling, which he cropped out of all three and which is therefore invented in every
  version. One diagnostic is left hanging deliberately: the floorboards of the left half of the Bedroom, taken alone,
  do agree between random halves at 4.3% against a 25.7% shuffle — six times better than chance and still twice the
  tolerance. It was found by choosing a region after seeing a failure, so it proves nothing, and it is the first
  thing to try again.*
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

*M7: the edition publishes its source files under CC BY-NC-SA 4.0, and the nine quotations are used on those terms —
attributed in the edition's own form, not for commercial use, and shared alike — so `letters/` and the `letter` in
each station file are CC BY-NC-SA 4.0 and not MIT. `letters/README.md` says so where the quotations are.*
three.js is used under the MIT licence.

The experience shape owes its existence to `monets-universe` in this repository's neighbour directory, and through it
to *A town made of paint* (`van-goghs-town.surge.sh`). §2 records what is kept — almost nothing but the discipline of
one HTML file, data-driven places, and an interface that stays out of the painting — and why everything else had to
change.
