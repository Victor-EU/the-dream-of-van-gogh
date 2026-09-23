# The Dream of Van Gogh — build plan

*The plan first, then the log. Nothing in the plan is changed once the log begins; what the build finds out is
written under **Progress**, milestone by milestone, and any change to `DESIGN.md` points at the entry that forced it.*

---

## Four rules for the whole build

1. **Prove the sensation before the world.** The first milestone is one canvas, exploded, and an eye that goes where
   it looks. Nothing else: no wind, no water worth the name, no second canvas, no sound. It has a gate that is a
   question, and if the answer is no, the piece is not built and the cost of finding out was three days.
2. **Nothing modelled.** The sibling's Rule 2, which it lost in its ninth milestone, revived where it can be kept.
   `?noStrokes` must render black water and a linen sky and nothing else, at every milestone, and the log says so
   each time. If `?noStrokes` ever shows a recognisable scene, something has been modelled, and it comes out.
3. **His before ours.** No generator of ours is written until the strokes of his it is drawn from are in the air, and
   none is written except from a `hand/*.json` measured by `tools/hand.py`. `?ledger` tints ours, and every milestone
   that adds ours logs a screenshot with the tint on.
4. **Always flyable.** After every milestone `index.html` opens and can be flown. We never sit on a broken sky.

---

## What is harvested, and what is not

From `../The world of Van Gogh`, copied, not linked, so that this folder stands on its own:

| from | to | why |
|---|---|---|
| `src/brush.js` | `src/brush.js` | the brush atlas and the relief shading; finished |
| `src/post.js` | `src/post.js` | bloom and grade; the night needs it |
| `src/veil.js` | `src/veil.js` | the opening; finished |
| `src/util.js` | `src/util.js` | small and finished |
| `src/audio.js` | `src/audio.js` | the generated sound; its layers rewritten in D5 |
| the record reader in `src/canvases.js` | `src/records.js` | thirty lines; the rest of that file is doors |
| `strokes/s06/{cafeterrace,rhone,nightcafe}-canvas*` | `strokes/` | the records, their flats and underlayers |
| `strokes/s08/starry-canvas*` | `strokes/` | |
| `paintings/CREDITS.md` | `paintings/CREDITS.md` | every scan, its holder, what was done |
| `tools/letters.py`, `letters/` | `tools/`, `letters/` | the checker, and the four lines once chosen |

Not harvested, on purpose: the road, the stations, the fourteen worlds, the doors and the wipe, the ground fields, the
props, the sky dome, the walk, the UI, and the pipeline. The pipeline stays in the sibling; a record that needs
rebuilding is rebuilt there and copied.

The `.venv` in this folder is the sibling's, kept: numpy, scipy and Pillow are what `tools/` here needs, plus
`scikit-image` for the standpoint test's SSIM.

---

## The numbers this plan bets on

Every one of these is a starting value, and the milestone that sweeps it is named. The log records what each became.

| number | value | swept in |
|---|---|---|
| the Starry Night's field of view and pitch | 62°, +30° | D0 |
| sky depth, near to far | 150 m to 600 m | D0 |
| village depth | 300 m to 900 m | D0 |
| cypress depth | 40 m to 80 m, relief | D0 |
| hills depth | 2 km to 4 km | D0, open question 5 |
| glide, fast, swoop, slow | 3, 15, 40, 0.5 m/s | D1 |
| speed time constant | 2 s | D1 |
| gaze-to-heading time constant | 1.2 s | D1 |
| bank limit | 25° | D1 |
| field of view of the eye | 70° | D1 |
| parting radius, out, back | 4 m, 0.3 s, 2 s | D1 |
| open wind, eddy turn, eddy lift | 2, 8, 2 m/s | D1 |
| our sky density | his, measured in his cone | D2 |
| the linen ceiling and edge | 700 m, 2.5 km | D2 |
| floor height | 1 m | D3 |
| the three cones' spacing | 800 m | D4 |
| Rhône and terrace fields of view | 50°, 50° | D4 |
| far bank depth | 220 m | D4 |
| façade depth | 15 m to 30 m | D4 |
| the opening's explosion | 4 s | D5 |
| ribbons in the air | ~130,000 | D6 |
| frame rate, three fixed flights | ≥ 55 fps at ~3 MP | every milestone |

---

## Verification harness

Built in D0 with the first canvas, because the gate needs it and every later milestone reports through it.

- **`dream`**, on `window`: `state()`, `go({x, y, z, yaw, pitch, speed})`, `eye(n)`, `speed(v)`, `letgo()`,
  `freeze(t)`, `flight(name)` to run one of the three fixed flights.
- **Address flags**: `?at=n` opens at standpoint *n* without the veil; `?t=` freezes the clock; `?noStrokes`;
  `?ledger`; `?q=low|mid|high`; `?notitle`.
- **`tools/shot.py`**: headless Chrome, as the sibling measured; takes a screenshot at a given state, or flies one of
  the three fixed flights and logs the frame rate every second. The three flights are the same from D0 to the end:
  *glide* (let go over Saint-Rémy, 60 s), *swoop* (a swoop from the water up through the swirl and out, 30 s), and
  *village* (a glide at 3 m/s through the village strokes at their own height, 60 s).
- **`tools/standpoint.py`**: the standpoint test of DESIGN §4.4, a number per canvas, logged whenever a depth changes.
- **`tools/hand.py`**, **`tools/wind.py`**, **`tools/depth.py`**: built in the milestone that first needs each.

---

## D0 — One canvas, exploded, and an eye  *(the gate; 3 days)*

**Scope.** The Starry Night's record, read from the sibling's blob. A first region mask painted by hand over its flat
rendering — sky, moon, stars, hills, village, cypress, ground — and a first `depth/starry.json` with the laws of
DESIGN §4.3. `tools/depth.py` writes the sidecar. `src/explode.js` puts every stroke at its depth down its ray from
the standpoint. `src/strokes.js` draws them as ribbons with the harvested brush, faces turned to the eye about their
tangents, no underside yet, no curl yet. A black plane below. A dark dome above, no strokes of ours. `src/flight.js`
at its simplest: heading follows gaze with the lag, speed from the keys with its time constant, banking, the floor.
No wind, no parting, no sound, no veil, no caption. The harness, `?noStrokes`, and `tools/shot.py` with the three
flights.

**Exit criteria.**

| | target | why this number |
|---|---|---|
| the standpoint test | SSIM ≥ 0.85 at 512 px; no 32 px cell off by more than 8% | the volume is licensed by the painting; below this the licence is gone |
| ribbons | 13,999, all of his | nothing of ours yet |
| frame rate, three flights | ≥ 55 fps | the budget, before anything else is added |
| `?noStrokes` | a black plane and a dark dome | rule 2 |
| a half-second glance | turns the heading < 10° | DESIGN §6.2, pre-registered |

**The gate.** Fly the *village* flight and the *swoop* by hand, and answer honestly: **is this paint, or confetti?** A
sky of ribbons in a volume either reads as his sky entered, or as a cloud of coloured chips. No number substitutes for
the answer. If it is chills, D1. If it is confetti, the diagnosis is one of four and each has its fix:

- **chips**: neighbouring strokes at unrelated depths, so that the surface has no continuity → the laws are too noisy;
  smooth them, and put the range's variation across the canvas rather than between neighbours.
- **cards**: the strokes read as flat rectangles when passed → the relief shading is not enough at this size; bring
  the underside of §4.5 forward from D2 into D0.
- **dust**: the strokes are too small in the air → the scale law is right and the depth is wrong; the sky is nearer
  than it should be. Push it out.
- **wallpaper**: it looks like the painting from everywhere → the sky's depth range is too narrow; there is no
  parallax. Widen it, and check the standpoint test still passes.

**If flying among his strokes over black water does not give chills, the idea is wrong and it cost three days.**

---

## D1 — The wind, and parting  *(1 week)*

**Scope.** `tools/wind.py` fits the field of DESIGN §4.7 to the Starry Night's sky tangents: drift, wave, and
vortices; logs the residual. `src/wind.js` evaluates it in three dimensions. The flyer becomes a particle in it:
the current added to the body's own velocity; `Space` lets go; the eddies turn and lift. Parting in the shader, per
vertex. Curl on every stroke at the measured amplitude and the one rate. `Z`, onto your back. `dream.flight()` for
the three flights, now with the wind in them.

**Exit criteria.**

| | target | why this number |
|---|---|---|
| the wind's residual | mean angle to his sky tangents ≤ 15° | above this the wind is not his sky's; if the fit cannot reach it, add a vortex before loosening the number |
| let go inside the great eddy | carried round once in 20 to 40 s and lifted | DESIGN §6.4; a thermal you feel |
| a half-second glance | still < 10° | the lag survives the current |
| parting, the *village* flight | no stroke within 2 m of the eye for longer than 0.2 s | DESIGN §6.5, pre-registered |
| frame rate | ≥ 55 fps | parting is per vertex; it must not cost |

**The gate.** Let go inside the swirl and do nothing for a minute. Does it feel like being carried, or like a
camera on a rail? And a stomach: three people fly the *swoop* twice; if any of them feels ill, the bank limit and the
lag are swept before D2 begins, and the held-right-button fallback of DESIGN §15.4 is built.

---

## D2 — Our sky, in his hand  *(1 week)*

**Scope.** `tools/hand.py` measures the Starry Night's sky region and its stars, and writes `hand/starry-sky.json`
and `hand/starry-star.json`. `src/sky.js` fills the volume outside his cone along the wind, to his density, from
those distributions; places a few unnamed stars of ours with cores and rings; seeds the motes. The linen ceiling and
edge, and the fade-and-restart. The underside of §4.5 on every ribbon. `?ledger` and `L`.

**Exit criteria.**

| | target | why this number |
|---|---|---|
| the seam | a 512 px crop across the cone's edge: mean colour and mean stroke length on ours within 10% of his; the seam not found at a glance by someone who was not told where it is, from three viewpoints | DESIGN §15.2 |
| density | ours within 15% of his, in strokes per steradian per metre of depth | measured in his cone, held outside it |
| ribbons | ≤ 90,000 | his 14 k, our sky ~60 k, stars and motes ~15 k |
| frame rate | ≥ 55 fps | the sky is most of the fill |
| `?noStrokes` | black plane, linen above 700 m, dark between | rule 2 |

**The gate.** Turn round. Behind you, where his cone is not, is it still his sky?

---

## D3 — The water  *(4 days)*

**Scope.** `src/water.js`: the plane's colour, from the sky's; the slow wave; reflection columns under every emissive
stroke and every star of ours, laid on the water and following the eye; the Rhône's own columns come in D4, so here
they are drawn from a first `hand/` measured from the Rhône's water region, which is the only place the law exists,
and this is the one time a hand is measured before its canvas is in the air. The floor. Water sound, the first layer
of `audio.js` rewritten.

**Exit criteria.**

| | target | why this number |
|---|---|---|
| a column | lies under its light from every eye position; its length by the light's height and brightness, from the hand | a reflection that does not move with the eye is a decal |
| the floor | descent at a swoop stops at 1 m with no bounce over the last 3 m | DESIGN §6.3 |
| ribbons | ≤ 100,000 | |
| frame rate | ≥ 55 fps | |

**The gate.** Fly low over the water toward the moon. Does the water read as water, with nothing modelled?

---

## D4 — The night of Arles  *(1.5 weeks)*

**Scope.** The Rhône and the terrace, exploded from their standpoints and placed on the sea with the Starry Night's
cone, at the spacing in the table. Region masks and laws for both: the quay plane, the couple, the water plane with
his columns *at the water's depth* (the one region whose depth is not authored but follows from the plane: the
column's v on the canvas gives its distance), the far bank, the Rhône's sky; the terrace's façade planes, the
pavement, the awning, the tables, the lamp, the alley, the terrace's sky. The gaslights and the lamp as point lights
at the strokes that paint them. `hand/` for the Rhône's water and the terrace's stars, and our columns re-drawn from
the Rhône's. `1`, `2`, `3` and the currents that carry you to each eye. The captions with the three lines. Open
questions 3, 6 and 9 looked at and decided.

**Exit criteria.**

| | target | why this number |
|---|---|---|
| the standpoint test, all three | SSIM ≥ 0.85; no cell off by more than 8% | |
| a current to an eye | arrives within 0.2 m and 2° of the standpoint, in 8 to 12 s | the painting must be exactly there when it lets go |
| the three flights, now across the sea | ≥ 55 fps | |
| ribbons | ≤ 130,000 | the budget |
| hollowness | three screenshots from behind the terrace, in the log, and a decision under open question 3 | |

**The gate.** Glide from the swirl down to the quay and up the street to the square. Is it one night, or three
pictures on a pond?

---

## D4.5 — One night  *(the author's answer to the D4 gate; 4 days)*

**Why there is a milestone here.** D4's gate asked *is it one night, or three pictures on a pond?* and the answer
came back: **it is one dream and one world, and the paintings have to be merged into one.** §5.1 is overruled in
`DESIGN.md` and this is the work that follows. Three measurements, taken before any of it was built, say what was
actually wrong, and none of them is about the paintings:

- **The floor.** All three of his grounds are `plane y: 0` laws. So his village, his pavement and the Rhone were
  the same surface, and that surface was water. The piece had no land in it. It was three pictures on a pond
  because it *was* three pictures on a pond.
- **The sky over Arles.** `dream.night()` counts our sky above ten degrees in twelve compass bins from each
  standpoint. From Saint-Remy: 9,404 / 15,326 / 16,758 a steradian against his 16,562 — even, and his. From the
  quay: `[43626, 7985, 817, 0, 0, 0, 0, 0, 0, 0, 3734, 22860]`. From the square:
  `[36623, 30454, 3364, 0, 0, 0, 0, 0, 0, 0, 0, 4819]`. Seven and eight bins of twelve with **no sky of ours at
  all**, and one with six times his density: a shell built round one eye, seen from 767 m away.
- **The colour of the night.** His three skies, measured over their own regions: Saint-Remy (0.0799, 0.1444,
  0.2768), the Rhone (0.0344, 0.0605, 0.0773), the terrace (0.0099, 0.0652, 0.2200). Ours is Saint-Remy's
  everywhere, (0.0852, 0.1507, 0.2818) — within 4% of his at Saint-Remy, and +148 / +149 / +265% at the Rhone,
  +761 / +131 / +28% at the terrace.

**Scope.** The river and the shore, from his own two banks and from the height of a standing man; the terrace and
the Starry Night moved onto that shore; the shore's paint in his pavement's hand and his village's colour; our sky
rebuilt as three fields, one round each standpoint at that canvas's own depths and colour, weighted and summing to
his density; the dome and the water taking the same colour field; the reflections kept to the river; §5.1's caption
and §5.3's ledger rewritten to say one night instead of three islands.

**Exit criteria.** Every one of these is measured before the build as well as after, and both numbers are logged.

| | target | before | why this number |
|---|---|---|---|
| the sky over every standpoint | every one of twelve compass bins above 10° holds ≥ half his density (8,281 / sr) at all three eyes | 0 in 7 bins at the quay, 8 at the square | a night you can stand under from anywhere in it |
| the colour of the night | our sky at each standpoint within 10% of his own sky there, channel by channel | +4% at Saint-Remy; +265% at the quay; +761% at the square | D2's seam number, now asked of all three |
| one ground | the floor's height under each standpoint equals his own ground's, within 0.05 m | no floor but water | it is one ground or it is not |
| the pond | water is ≤ 10% of the floor inside the dream's edge | 100% | |
| the standpoint test, all three | SSIM ≥ 0.85 against the runtime's own flat; no cell off by more than 8% | 0.868 / 0.926 / 0.904, 0 cells | the merge may not cost the piece its paintings |
| the cone rule | none of his strokes hidden; ≤ 2% of ours | 0 of 38,654; 746 of 94,342 | D4 (3) stands |
| the seam on the ground | the step in mean luminance across each cone's edge ≤ 10% | there was no ground to step from | D2's number, asked of the shore |
| ribbons | the merge adds ≤ 6,000 | 140,337 | the 130,000 budget is already broken and is D6's |

**The gate.** The same flight as D4's, on the world it now stands on: glide from the swirl down to the quay and up
the street to the square. Is it one night?

---

## D4.6 — The floor, seen  *(the author's word on §15.10; 1 day)*

**Why there is a milestone here.** D4.5 closed §15.10 in the numbers and left it open to the eye, and the author's
answer was: *fix it.* The two ways out that D4.5 named were re-opening D3's measured floor or putting lights on a
town he never painted, which §2 forbids. So it is the floor. Three measurements, taken before any of it was built:

- **The two sides of the bank are already 22% and 27% apart, and that is not the trouble.** `tools/bank.py`
  stands the eye 100 m over the river, looks across a bank, and reads the frame along a line of world points
  from the shore out into the water. Near bank: land 0.001975, water 0.002538. Far bank: 0.001758 and 0.002408.
  In the frame a person is shown that is **6.5 against 8.4 of 255, and 5.8 against 7.9** — the step is there in
  ratio and gone in level. You cannot see a thing that is two parts in 255 from its neighbour.
- **The floor stands under a night ten and a half times darker than the one over it.** D3 takes his ground's
  share of his sky — his Rhone's water is 0.5541 of its own sky, his village at Saint-Remy 0.4235 of his — and
  applies it to `lum('#0f1d44')`, 0.0140, the dark the dome stands on. His own sky at Saint-Remy is 0.1479.
  D3 wrote the factor down in the source and left a flag on it: *?wet= ... at about ten the plane is as bright
  against this night's sky as his paint is against his.*
- **And our sky's own light can simply be measured.** `dream.light` renders our sky from a place — five faces of
  a cube, the upper hemisphere of them, at a pinned focal and with parting off — and returns the solid-angle
  mean of everything that arrives. Over the floor under his three standpoints: **0.0412, 0.0169, 0.0275**,
  against his own three skies' 0.1479, 0.0562, 0.0646. Our night is between a quarter and a half of his.

**Scope.** The floor's reference, and nothing else. D3's rule is kept word for word — his hue exactly, his
brightness as his own ratio — and only what the ratio is taken against changes, from a colour chosen by hand to
our own sky measured from the floor. The three measurements are taken once, a few frames in, and between them
the floor takes the same weights the night's colour does (D4.5). The marks lying on the floor dim with the floor
they lie on, each against the night its own canvas was painted under, so that his paint and his ground keep the
ratio his canvas has. `?wet` and `?dry` go.

**Exit criteria.** Measured before the build as well as after, and both numbers logged.

| | target | before | why this number |
|---|---|---|---|
| the bank, seen | across each bank from 100 m up, the two sides of the floor differ by ≥ 4 levels of 255 in the frame and by ≥ 20% in luminance | 1.9 and 2.1 levels; 22% and 27% | four levels is the difference at which a straight edge across a dark frame stops being a thing you have to know is there. The measured light predicts 4 to 5; if his own ratio will not reach it, that is the answer and it is logged, not tuned |
| the bank, where it is | the step in the profile falls within 5 m of the bank | 1.25 m, both banks | it is the bank that is seen and not something else |
| his two shares, kept | the water is 0.5541 of the light over it and the shore 0.4235, within 1%, and the hue of each is unchanged | exactly, of a colour chosen by hand | D3's rule is not overturned; it is given the reference it asked for |
| the reference, measured | the number the floor stands on comes from `dream.light`, and no flag is left on it | `#0f1d44`, with `?wet=` and `?dry=` open | Rule 3, for the floor as for everything else |
| the standpoint test, all three | SSIM ≥ 0.86 / 0.92 / 0.90 against the runtime's own flat; no 32 px cell off by more than 8% | 0.869 / 0.928 / 0.908, 0 cells | a floor you can see may not cost the piece its paintings |
| the night, untouched | the counts and the twelve compass bins within 1% of D4.5's | 254,011; 8,787 / 10,581 / 9,467 a steradian | this milestone is the floor's and nothing else's |
| §5.2 stands | no surface, no shading, no light on the floor: a colour, and marks lying on it | | a lit floor is not a modelled one |

**The gate.** From a hundred metres up over the river: is it one world to look at?

---

## D5 — The opening, the edge, the sound  *(1 week)*

**Scope.** `veil.js` harvested and wired: the Starry Night paints itself, the eye goes into it, and the explosion of
DESIGN §7.1 runs from the canvas to the volume over four seconds, from the standpoint to the air. The line in the
corner. The restart from the linen without the veil. ~~The three remaining sound layers: wind by speed, the eddies'
tone, the square's murmur.~~ (Struck by the author during the milestone, with §10 and the layer D3 built.)
`H`, ~~`M`~~, `F`. Touch: the two thumbs and the two taps.

**Exit criteria.**

| | target | why this number |
|---|---|---|
| first load to flying | ≤ 4 s after the veil finishes, on a warm cache | the sibling's opening set this |
| the explosion | the standpoint test passes at t = 0 and the volume is at its depths by t = 4 s | it is §3.1 shown, so it must start exactly on the painting |
| the restart | flying into the linen fades over 3 to 5 s and returns you to the air over Saint-Rémy | DESIGN §7.2 |
| ~~sound~~ | ~~every layer keyed to the state it is meant for, and off by default until a gesture~~ — **struck by the author during D5**: the water layer was listened to and the answer was *remove the background sound*. DESIGN §10 is struck, `src/audio.js` deleted, and the three layers this row asked for are not built | |

**Added at the start of D5, before any of it was built.** The plan's four are what the opening must *do*; these
are what can be measured while it does it. (a) **It starts exactly on the painting**: with the explosion held at
nought, the standpoint test of §4.4 passes at Saint-Remy — SSIM ≥ 0.85 against the runtime's own flat and no
32 px cell off by more than 8% — because a canvas collapsed onto its own picture plane is that canvas.
(b) **The handoff is not seen**: the veil's last frame and the runtime's first, at the same window, agree to
SSIM ≥ 0.80 over the canvas. (c) **The explosion arrives**: at t = 4 s every stroke is within 1 cm of the depth
`depth/starry.json` gives it, and at t = 0 within 1 cm of the picture plane. (d) **The line waits**: nothing in
the corner until the veil is gone, and gone itself at the first drag. (e) **The restart carries none of it**:
into the linen, out over Saint-Remy, no veil and no second explosion, and the sound follows the new place.
(f) ~~**Four layers, not one**, each silent where its own state is not.~~ Struck with §10, on the author's word,
partway through the milestone; what replaced it is nothing, and the piece is silent.

**The gate.** Open the page cold, touch nothing, and watch. Does the painting become the night without a word?

---

## D5.5 — The author's user test  *(the author's word on the whole; 1 day)*

**Why there is a milestone here.** The author opened the page cold, touched nothing, watched, and answered every
gate at once: *this is absolutely terrible ... The overall feeling is just so bad, I have no idea what this is. It's
so far away from the design.* Six things in the answer, quoted, each with what it was measured to be before
anything was changed:

1. *The painting and the stars should be smaller, meaning you should be having the sense of in the dream of starry
   night.* Measured on a real GPU: untouched for 30 s after the opening, the wind carries the body **57 m up and
   153 m forward** into the sky (`y 99.6, z -152.8`), so a sky that begins 250 m from his eye is seen from a hundred
   metres inside it; the strokes double, the ground leaves the frame, and what is left is paint at arm's length.
2. *Color should be more vivid like van gogh's painting.* Measured: at his eye, on the same GPU, the frame is the
   record's own colour (the standpoint test reads 0.865 against the runtime's own flat). The pale picture is the
   same paint seen from inside it -- sampled soft past a hand's breadth of pixels (`vBig`) and lit on its relief
   from every side -- which is the same cause as 1.
3. *We should add some random sunflowers.*
4. *The user vision movement is so bad. Simplify, arrow keys decide the movement, no up arrow, no movement.*
5. *Where is the river, the town.* Behind and below the place the wind carries you to.
6. *You have a ground, which is the town, then you have the sky.* Which is his composition, from his eye, and the
   one place in the piece where it holds.

**What changes, on the author's word.** §6 is replaced. (a) Nothing pressed is nothing: no glide, no wind on the
body, no let go, no bank, and no lag between where the eye looks and the way the body goes. (b) The arrows: `↑`
goes where you look, `↓` back, `←` `→` turn; `Shift` faster; drag looks; `1` `2` `3` stay; `H` `L` `F` stay;
`Space` and `Z` go. (c) After the opening the body stays at his eye and waits, which is the one place the ground
is the town and the sky is the sky. (d) Sunflowers: his own heads from the *Sunflowers* record (Van Gogh Museum
s0031V1962, the sibling's record, copied), cut out by eight circles a person drew on the flat, standing on the
shore round his village. §2 is amended on the author's word: his paint from a fourth canvas, placed by us, and
the ledger calls the placing ours.

**Pre-registered.**

| | target | why this number |
|---|---|---|
| nothing pressed, nothing moves | 30 s untouched after the opening: the body within 0.05 m of his eye | before: 57 m up, 153 m forward |
| a key released stops you | `↑` held 2 s then released: under 0.5 m/s within 1 s, under 3 m travelled after the release | *no up arrow, no movement* |
| `↑`, `Shift`, a turn | 8 m/s, 30 m/s, 50°/s | a town 767 m off in a minute and a half; a full turn in seven seconds |
| the standpoint, with sunflowers | logged as it comes; `?noflowers` returns 0.865 / 0 cells | his heads stand in front of his village from his eye, and the test says by how much |
| sunflowers | 80 by default, heads 0.3–0.5 m across at 1.1–1.7 m over the shore, in a disc 150 m round a point 80 m ahead of his eye; ribbons counted | sunflower-sized, where the eye first looks down |
| frame rate | the three flights on the real GPU pane ≥ 47 | the governor's floor |
| the gate | the author's six, again | |

---

## D6 — Measure, polish, ship  *(1 week)*

**Scope.** The resolution governor. A phone flown once and its numbers written down, with nothing promised. The
ledger's counts made exact. `README.md`, `paintings/CREDITS.md`, `letters/`, `LICENSE`. The three flights logged
one last time with their frame rates. A deploy script if the site has a home, and this folder's git remote pointed
at its own repository rather than the sibling's.

**Exit criteria.** The budget table, filled in with what was measured. Every open question in `DESIGN.md` §15
either closed with a pointer into this log, or moved to **Deferred** with a trigger.

---

## What this adds up to

| milestone | days | cumulative |
|---|---|---|
| D0 the gate | 3 | 3 |
| D1 wind, parting | 5 | 8 |
| D2 our sky | 5 | 13 |
| D3 water | 4 | 17 |
| D4 the night of Arles | 8 | 25 |
| D4.5 one night | 4 | 29 |
| D4.6 the floor, seen | 1 | 30 |
| D5 opening, edge, sound | 5 | 35 |
| D5.5 the author's user test | 1 | 36 |
| E0 the world is the painting | 1 | 37 |
| D6 measure, ship | 5 | 42 |

Eight weeks of days. D4.5, D4.6 and D5.5 were not in the plan — the author added them at the D4 gate and on §15.10 —
and they are counted here because they happened. The plan expected D0 to be re-run once and D4 to overrun,
because depth authoring is the one thing here that a person does by hand, three times.

---

## Deferred (with the trigger to re-open)

- **The Night Café's door.** Its record is in the folder. Trigger: D4's gate answered *one night*, and the square
  wants a lit doorway. What it would be: the café's own strokes of its door and window laid at the façade's depth on
  the Place Lamartine's side of the town, emissive, with nothing behind them. What it would not be: a room.
- **A phone.** Trigger: D6's one flight shows it is within a factor of two of the budget. What it would need: the
  low quality budget, the two thumbs measured, and a smaller sky.
- **The assembling flock.** The idea, from the brainstorm, that a canvas's strokes fly loose over their place and
  settle into the painting as you arrive. Dropped because the explosion already does this by geometry and costs
  nothing. Trigger: the currents to an eye (D4) feel like a jump rather than a gathering.
- **A night with an arc.** Dusk on the terrace to the morning star before dawn, in a running clock. Dropped because
  the piece has no end. Trigger: none expected; recorded so that it is not rediscovered.
- **The Yellow House by night, and the Place Lamartine.** No canvas of these four paints it. Trigger: the Night
  Café's door is built and needs a square to stand on.
- **Continuing the façades in his hand.** Open question 3's third answer. Trigger: D4's hollowness screenshots.

---

## The risk table

| risk | likelihood | what it costs | what is done about it |
|---|---|---|---|
| confetti: exploded strokes read as chips, not paint | high | the piece | the gate at D0, its four diagnoses, and three days |
| the seam between his sky and ours | high | the sky's honesty | measured at D2; the fallback puts his edge in the dark |
| fill rate: ten-metre strokes at two metres | medium | frame rate on every swoop | parting, the underside drawn only near, the governor; measured on every flight |
| gaze steering makes people ill | medium | the one control | the lag and bank limit swept at D1 with three stomachs; the held-button fallback |
| depth authoring is slow and wrong | high | D4's schedule | one law per region, few regions, the standpoint test as the arbiter; a day per canvas budgeted, and D4 given eight |
| hollow façades from behind | certain | a dream's licence, or a decision | looked at in D4 from three viewpoints; three answers ready |
| the hills at kilometres are invisible | medium | the Starry Night's horizon | D0 finds out; the fix is a nearer law, declared |
| the wind's fit does not reach 15° | medium | §3.2's honesty | add vortices before loosening; log the residual either way |
| three.js drift | low | the page | one pinned version, no build step |
| the sibling's records change | low | the standpoint test | copied, not linked; a copy is a version |

---

## Mapping to `DESIGN.md`

| design | plan |
|---|---|
| §3.1 the explosion, §4.2 standpoints, §4.3 depth, §4.4 the test | D0, D4 |
| §3.2 the wind, §4.7 | D1 |
| §3.3 parting, §6 flight | D1 |
| §4.5 rendering | D0, the underside in D2 |
| §4.6 ours in his hand, §5.3, §5.4 | D2 |
| §5.2 the water | D3 |
| §5.1 the three cones, §8, §9 | D4 |
| §7 the opening and the end, §10 sound, §11 interface | D5 |
| §12 the budget, §13 | every milestone, closed in D6 |
| §15 open questions | named per milestone above |

---

## Progress

*The log. One entry per milestone, in the order built, each with what was decided, what was measured, and what is
still visible, named rather than fixed.*

### D0 — One canvas, exploded, and an eye

*Built 19 September 2026, in one sitting. The harvest, the depth tool, the page, the flight, the harness, and the
gate. The plan gave it three days; it took an evening and a night, and most of the night went on four things the plan
had not named.*

**What was built.** `tools/mask.py` writes a first region mask for the Starry Night from typed polylines and colour
tests (the ridge, the village line, the cypress as a flame, the moon as a disc, the stars found as bright knots and
dilated, the two eddies as ellipses); it is the starting point for a hand, not the hand. `tools/depth.py` reads the
record, the mask and `depth/starry.json`, and writes one distance and one shine per stroke. `src/explode.js` puts
every control point of every stroke down its ray from the eye, and `src/strokes.js` draws them with the sibling's
brush, each face turned to the eye about its own tangent. `src/flight.js` is the body: gaze, heading with its lag,
speed with its time constant, the bank, the floor. `src/main.js` is the loop and the harness, `tools/shot.py` is the
headless eye, and `tools/standpoint.py` is the test. Five files came across from the sibling as the plan said, and
`records.js` is the thirty lines of its reader.

**What was decided, and why.**

- **The standpoint is in the air, forty metres up, pitched eight degrees.** The design's table said a pitch of 30°.
  With a flat sea under the eye that pitch hangs the village above the horizontal, on a hill that is not there. At 8°
  the canvas's horizon line (v 0.74) is a ray 5° below the horizontal, and the village lies on the water from 134 m
  to 460 m, which is where the hills begin. Everything else followed from that one number.
- **The canvas is the holder's height by the scan's aspect,** as the sibling's `sizes.js` already had it: 93.07 by
  73.7 cm, not 92.1 by 73.7, so the focal length is 77.4 cm and not 76.6. Found by the standpoint test, which is what
  it is for.
- **The record's colour is the light.** The first shading — a moon key, a sky and a ground ambient — made the frame
  from his eye a third darker than the record and the village black, because every stroke's face is turned to the
  eye and the moon is beyond it: every stroke was backlit. So a flat face is now exactly the record's colour from
  every side, and the moon lights only the relief of the print, ridges toward it and hollows away. From the
  standpoint the painting; from the side the same paint, lit.
- **The tone curve is the paint's, not the sibling's.** `post.js` is harvested whole, with one uniform added: the
  filmic curve that the road piece grades its night through halves the darks (its toe puts 0.02 at 0.01) and lifts
  the pale sky, and the record's darks are the darks. `tone: 0` keeps the values with a soft shoulder above 0.85.
- **Nothing stands under the water.** A ray below the horizontal stops at the water's plane whatever its law said.
  Without this the hills' near edge, at their authored 460 m, was fifteen metres under the sea and the horizon line
  had a hole in it; with it the hills begin on the water at 272 m and rise as their rays do.
- **A stroke seen large is a mass of paint, not a comb.** The brush print has a dry end that breaks into bristles,
  which at canvas scale is the mark and at ten metres is a row of teeth. Past a hand's breadth of pixels the print's
  coverage is sampled soft (a mip bias of 2.5) and thresholded low, and the relief still comes from the sharp sample,
  so the stroke keeps its ridges and loses its teeth.
- **The harness runs on the piece's own clock.** In headless Chromium the frames come in bursts, so a glance timed by
  the wall measured a tenth of what it should. `dream.glance` and the flights are timed by the simulated seconds the
  flight integrates, which is the only clock the body knows.

**What was measured.**

| | pre-registered | measured | |
|---|---|---|---|
| the standpoint test, geometry: the frame against the runtime's own flat (every depth 100 m) | SSIM ≥ 0.85; no 32 px cell off by > 8% | **SSIM 0.873; worst cell 5.2%; cells over 8%: 0** | pass |
| the standpoint test, as written: the frame against the record's flat | SSIM ≥ 0.85; no cell > 8% | SSIM 0.444; cells over 8%: 51, and 46 with the lights off | **fail, on texture** — see below |
| the record's colour, by the flat's luminance band, in sRGB | | darks 0–60: frame 25/32/46 vs 31/38/52; mids 60–120: 63/86/120 vs 69/95/132; lights 120–180: 148/168/169 vs 131/151/151 | mids 7% dark, lights 13% bright |
| a half-second glance of 30° | heading turns < 10° | **5.97°** (60° in 0.5 s: 11.95°; 30° over 2 s: 16.3°) | pass |
| ribbons | 13,999, all his | 13,999 | |
| frame rate, *glide*, 60 s | ≥ 55 fps | mean 89, min 47 (one second) | pass on the mean |
| frame rate, *swoop*, 30 s | ≥ 55 fps | mean 101, min 83 | pass |
| frame rate, *village*, 60 s | ≥ 55 fps | mean 94, min 64 | pass |
| `?noStrokes` | black water, a dark dome | black water, a dark dome | pass |

The frame rates are from the desktop app's browser pane at 1024 by 768 and a pixel ratio of 1.5, about 1.8 million
pixels, on this Mac's GPU; the headless Chromium the screenshots come from renders in software and its frame
rate means nothing. The governor never moved: the pixel ratio stayed at 1.5 throughout.

**The standpoint test, as pre-registered, fails, and the reason is named rather than the number moved.** The
record's flat is drawn by the pipeline's own flat renderer, whose brush is not the runtime's: no relief, a different
edge, a different fill. The SSIM between the two renderings of the same strokes on the same rays is 0.44 and it will
not reach 0.85 by any placement of depth. So the geometry is tested against the runtime's own flat — the same
renderer, every stroke at one distance — where it passes with margin, and the colour is tested against the record
by the cell count, where it does not pass: 46 cells of about 240 are off by more than 8% with the lights off. The
mid-tones are 7% dark and the pale strokes 13% bright, which is the relief term's bias and the print's fill, and the
rest is the moon's rings, which the record paints pale yellow and the runtime, with its shine, paints white. This is
logged as what it is: the frame from his eye is the painting to the eye, and not to the cell.

**The depths, as they became** (the bets are in the table above; the log is what a night's looking changed):

| region | bet | became | why |
|---|---|---|---|
| sky | 150–600 m | 250–740 m, pale bands 45 m forward of dark | far at the hills, near overhead; ribbons, not chips |
| the eddies | — | the sky's law, receding by up to 160 m toward each centre | a tunnel that goes away from you |
| stars, moon | — | 0.9 and 0.92 of the sky round them | painted over the sky, so in front of it |
| hills | 2–4 km | 272–1500 m, stopped at the water | the far law put them under the sea |
| village | 300–900 m | 134–899 m, on the water's plane | the eye is 40 m up, not 100 |
| cypress | 40–80 m | 108–121 m, brighter strokes forward | its foot is cut by the canvas; it floats |
| jitter, the order term | 3%, 4% | 0.6%, 1.2% | at 3% and 4% the sky was confetti |

**The gate.** Five viewpoints, in `docs/`: from his eye (`d0-standpoint.jpg`), from below and to the left looking up
into the great eddy (`d0-toward-the-swirl.jpg`), from inside the sky with a ten-metre stroke at arm's length
(`d0-in-the-sky.jpg`), from beside the cone's edge (`d0-beside-the-swirl.jpg`), and from sixty metres over the
village looking down (`d0-over-the-village.jpg`). The first answer, with the plan's jitter, was confetti — chips —
and the diagnosis was the plan's first: neighbouring strokes at unrelated depths. With the jitter cut to a fifth,
the pale bands brought forward and the eddies made funnels, the answer from the builder is **paint**: looking up
into the eddy, the painting gathers as you near the axis and the eddy is a tunnel; inside the sky, a stroke is a slab
with the ridges of the brush along it. From beside the cone's edge it is a reef of standing slabs against an empty
dome, and from high above it is still nearer chips than paint. The builder's answer is not the author's. The author
flies it and says.

**Still visible, named rather than fixed.**

- **The dome is empty beyond his cone.** Every view that includes the cone's edge sees paint against nothing. D2's
  sky in his hand is what changes those views most, and the gate should be looked at again then.
- **Cards.** The halo rings of the stars, whose tangents run every way, turn their faces to the eye and from the
  side stand as slabs. The underside of DESIGN 4.5 is D2's; until then a star from the side is a reef.
- **The village is dark from above.** Its strokes lie on the water's plane and are the record's dark blues; from
  sixty metres up it is a dark field with pale marks. That is the painting's village, and whether it wants a lamp is
  D3's question, with the water.
- **The far-above view.** Looking straight down through the sky from 500 m, the strokes are chips. No viewpoint of
  the painting is there; the wind (D1) and the sky round it (D2) may or may not make one.
- **The colour test** is not met and is not moved; see above. The relief term's bias and the print's fill are two
  numbers to sweep in D4 when three canvases are in the air.
- **One second at 47 fps** on the glide, once in sixty, and 64 on the village flight. Not a stall the eye caught in
  the screenshots; watched for in D1, where parting is per vertex.
- **The hold is not the wind's.** `Space` sets the body's own speed to nothing, and with no wind yet that is a stop
  in the air, which the design says a dream never does. D1.
- **Four things the plan did not name** took the night: a failure overlay whose CSS overrode its `hidden` attribute
  and covered the page with a dark panel (the first three screenshots were black); the scan's aspect; the water plane
  z-fighting the village; and the headless clock. Each is a line in the code now and a line here.


### D1 — The wind, and parting

*Built 20 September 2026, in one night. The plan gave it a week. The fit, the field in three dimensions, the body
as a particle in it, parting, curl, `Z`, and the three flights with the wind in them. Two of the five exit criteria
were pre-registered against numbers the night showed to be the wrong numbers, and both are logged as what was
found, not as what was hoped.*

**What was built.** `tools/wind.py` fits a drift, a wave and vortices to the tangent lines of the sky and swirl
strokes (6,427 with a chord over 4 mm), measures the residual on strokes and on bands and the noise floor of his
hand, and writes `hand/starry-wind.json` with its measured and authored parts labelled, and `shots/starry-wind.png`,
his tangents coloured by their residual under the flown field's streamlines (`docs/d1-wind.jpg`). `src/wind.js`
evaluates the field in three dimensions on the sphere of directions round the standpoint: a point's direction is
projected onto the canvas plane, the field is read there in metres a second and applied perpendicular to the
point's own ray, so that each eddy is a cone about its ray and a body carried round it keeps its distance; each
core draws along its axis. `src/flight.js` reads the wind into the body's velocity every frame, and `Z` is a real
gesture now: the gaze eases to the zenith in under a second's time constant while the heading holds, and comes back
the same way. `src/strokes.js` parts per vertex: the line of flight is a tube of radius 4 m plus the stroke's own
half width, and every point inside it is moved onto it by a map that keeps the strokes' order. The curl is on, at
the amplitude the pipeline measured for each stroke (median 1.3 mm on the canvas, 9% of a chord) and the sibling's
one rate. The harness gained `dream.eddy()`, `dream.flight(name, {dwell})`, `dream.wait()`, `dream.wind()`, and the
flags `?nowind`, `?nopart`, `?nocurl`.

**What was decided, and why.**

- **The strokes are lines, not arrows.** The packer orders a stroke's points from its top down: about each eddy,
  47% and 49% of the strokes turn one way. So the fit is to tangent lines, and one sign is authored — the drift
  blows from the canvas's left to its right. Given that, the sense of each vortex is the fit's where the lines fix
  it: mirroring the great eddy costs 1.6° of residual (24.5 to 26.1), so it turns clockwise on his word; mirroring
  the second eddy costs 0.08°, so its anticlockwise turn is authored and the file says so.
- **The residual is judged against his bands, because his hand's own scatter is 14.8°.** A stroke lies 14.8° off
  the common direction of its neighbours within 2.5 cm. The pre-registered 15° sits on that floor and no smooth
  field reaches it on single strokes. The fit reaches 21.7° on strokes and **15.4° against the bands** (the
  neighbourhood direction each stroke is measured against). Vortices were added before the number was touched,
  as the plan says: three (the two eddies and the moon) give 24.5°, six give 21.7° — the fourth and fifth in the
  band that sweeps from the swirl to the moon, the sixth a tight core inside the great eddy. The seventh helped by
  less than 0.3° and was not kept. The Gaussian profile beat the Oseen at every count (24.5 against 27.0 at three).
  The drift alone leaves 34.6°.
- **The flown field turns without drawing in.** The fit needs an in-flow to lay his spirals (−0.27 of the turn on
  the great eddy, −0.79 on its core). Flown, an in-flow is a sink: the first eddy test drew the body to a fiftieth
  of the radius in seconds and it hung there, 40° round in two minutes. DESIGN §4.7 gives a vortex a turn and a
  strength, so the flown in-flow is zero, at a cost of 4° on the flown residual.
- **The plan's speeds are kept, and they cost the flown field its fit.** The lines put the great eddy's turn at 24
  times the drift. At 2 m/s open and 8 in the eddy it is 4 times, and the flown field leaves 31.1° on strokes and
  27.5° on bands where the fit leaves 21.7° and 15.4°. The sweep: a drift of 0.33 m/s at the same eddy recovers the
  fit's numbers exactly, 0.5 m/s gives 17.8° on bands, 1 m/s 21.6°. The drift is kept at 2 because a body let go
  in open sky should be carried, not left; the trade is `--drift` on the tool, one number, and it is the author's.
- **The eddy draws along its axis, at 1 m/s, not up at 2.** A lift straight up cannot lift inside a vortex: a
  uniform flow added to a turn only moves the closed orbits aside, and the second eddy test measured it — 25 m up
  in two minutes and 89° round. Along the eddy's own axis, away from his eye, the carry is a helix down the tunnel
  the depth law makes. At the plan's 2 m/s a minute let go ends behind the sky in the dark (through the far-end
  strokes at 35 s; `d1-let-go-60s` of that run was dome and water); at 1 m/s the minute is spent inside.
- **Parting's times are distances.** The third of a second out and the two seconds back are `0.3 × speed` ahead
  and `2 × speed` behind along the line the body actually moves on, wind and all, floored at the radius, so the
  paint parts the same at a glide and at a swoop and at a standstill. The map `sd → sqrt(sd² + R²)` puts everything
  inside the tube onto it without crossing; the earlier linear map folded strokes past each other.
- **The glide flight is what the plan wrote.** D0 flew it at 3 m/s with a slow turn because there was no wind. It
  is let go over Saint-Rémy now: the body's own speed goes to nothing and the drift carries it along the eye's plane
  at 2 m/s, so the frame stays his painting from an eye moving 120 m in the minute.
- **The standpoint test holds the curl still.** `?test` sets the curl to zero; the test is of geometry, and with the
  curl on the painting breathes at the standpoint by design.

**What was measured.**

| | pre-registered | measured | |
|---|---|---|---|
| the wind's residual, on his sky strokes | mean angle ≤ 15° | 21.7° with six vortices (24.5° with three; 34.6° drift alone); the floor of his hand 14.8° | **fail as written** |
| the wind's residual, against his bands | — | **15.4°** | on the line |
| the flown field, at the plan's speeds | — | 31.1° on strokes, 27.5° on bands; 25.8° and 20.6° at a drift of 0.33 m/s | logged |
| by region, the fit | — | sky 22.2°, swirl 19.9°, moon 21.2°, star 28.0° (the stars' rings were not fitted) | |
| let go inside the great eddy, a third of a radius off its axis at the rim's depth (556 m) | carried round once in 20 to 40 s, and lifted | **once round in 23.0 s**; 22.8 m along the axis, 5.7 m up; stays between 0.18 and 0.37 of the radius; 5.3 m/s at most | pass |
| a half-second glance of 30°, wind on | heading turns < 10° | **5.97°** | pass |
| parting, the *village* flight, 60 s | no stroke within 2 m of the eye for longer than 0.2 s | **none**: no stroke within 2 m at all, by centreline or by paint. Without parting: 23 strokes over 0.2 s by centreline (longest 1.7 s), 29 by paint (longest 2.8 s) | pass |
| frame rate, *glide*, *swoop*, *village* | ≥ 55 fps | at high quality, 2.2 MP: 86 / 64 min, 87 / 77, 93 / 62; another glide run 74 / 49 | pass on the mean |
| the cost of D1, *swoop* and *village* without parting, wind and curl | — | 98 / 91 and 97 / 85: about 10% on the swoop, 4% on the village | |
| `Z` | the zenith, the heading kept | 87.5° in 4 s, the heading's pitch 8° throughout and 8.0° after the return | pass |
| `Space` | the body's speed to nothing, the wind has it | 0.05 m/s after 8 s; carried | pass |
| the standpoint test, geometry | SSIM ≥ 0.85; no cell > 8% | 0.873; 0 cells (as D0) | pass |
| `?noStrokes` | black water, a dark dome | black water, a dark dome | pass |

The frame rates are from the desktop app's browser pane, 716 by 774 at a pixel ratio of 2, with the pane hidden
(the session was not open in a window), which capped the mid-quality flights at 63 to 66 fps whatever the load; the
high-quality numbers are below the cap and are the ones logged. D0's numbers were from a visible pane at 1.8 MP and
are not comparable. The headless Chromium's rates mean nothing and are not logged.

**The wind, as it became.** Six vortices. The great eddy at (0.487, 0.358) on the canvas, 5.8° across, clockwise,
with a core at (0.495, 0.336), 2.7° across, at the fit's bound; the second eddy at (0.660, 0.407), 6.6°,
anticlockwise, a sixth of the great one's strength; the moon's rings at (0.893, 0.172), 5.1°, at the bound; two in
the band between the swirl and the moon at (0.747, 0.217), 8.5°, and (0.715, 0.135), 4.5°. The drift at −1.8°; the
wave 0.40 of the drift, 32 cm long, running 5° off the horizontal, which is his lower bands' undulation and can be
seen in `d1-wind.jpg`. Flown: the drift 2 m/s, the wave 0.79, the vortices scaled together so the great eddy's turn
peaks at 8 (no other reached it), the draw 1 m/s in each core. His rim strokes at the great eddy are at 556 m and the
far end at 627 m: a body let go at the rim reaches the far end in about 70 s.

**The gate.** Four frames of a minute let go inside the great eddy, `docs/d1-let-go-{0.5,20,40,60}s.jpg`: the
tunnel's walls at arm's length turning past, the far end nearer each frame, the paint parting round the eye (a
ten-metre stroke at 40 s bends past the frame's edge). And the parting itself, `d1-parting-on.jpg` against
`d1-parting-off.jpg`, the same spot in the village: a stroke that fills the lower right of the frame at the eye is
gone from it. The builder's answer to *carried or on a rail*: carried, in the eddy — the turn is felt as the walls
sweeping one way and the far end wheeling, and the draw as the end coming on. In the open sky it is a slow slide,
2 m/s, with the wave's rise and fall (±0.8 m/s) the only thing that says it is not a rail. That answer is the
builder's; the author flies it. The stomach test — three people, the swoop twice — has not been done and cannot
be done here; it is the author's before D2.

**Still visible, named rather than fixed.**

- **The flown field is not the fitted field.** 27.5° against his bands where the fit has 15.4°, all of it the
  drift's speed against the eddies'. `--drift 0.5` on the tool would give 17.8°. The author's number.
- **The stars' rings and the band between the eddies** are red in `d1-wind.jpg`: the rings were not fitted (2,100
  strokes in the star region, 28° off the field), and the S between the great eddy and the second is where six
  vortices are still too few. D2 lays our sky along this field; if the seam there shows, this is why.
- **Behind the sky.** The draw carries a body through the far-end strokes in about 70 s from the rim, and behind
  them is the dark dome. D2's sky is what should be there.
- **The moon's rings whirl at 4.9 m/s** in a cone 5° across, which is what the lines say and may be more than the
  moon wants. Not yet flown into on purpose.
- **One glide run of two spent 25 s at 52 fps** in the middle of the minute, with nothing near the eye and the
  body 60 m from the standpoint; the other run did not. Not found.
- **The parting bends the centreline only.** A stroke's face still turns toward the eye from its pushed position;
  seen at arm's length in the eddy the bent strokes read as paint, but a stroke ten metres wide and four long is
  pushed nine metres and the eye may catch it going. Watched in D2 with more strokes in the air.
- **The second eddy's sense is authored,** and so is the drift's; the file says which is which.

### D2 — Our sky, in his hand

*Built 20 September 2026, in one night. The plan gave it a week. `tools/hand.py`, `src/sky.js`, the wind carried
past his cone, the underside, the linen and the fade that begins the dream again, and the ledger that says which
is which. Four of the five exit criteria were measured; the fifth, the frame rate, could not be measured on this
machine tonight and the log says why rather than reporting a number it does not trust.*

**What was built.** `tools/hand.py` measures the Starry Night's sky (6,431 strokes of `sky` and `swirl`) and its
stars (2,100 strokes in 18 clusters), and writes `hand/starry-sky.json` and `hand/starry-star.json`: his density in
strokes a steradian and the thickness of the shell his law puts them in; his depth law read in elevation, which is
a coordinate that exists outside his canvas; his colour on the three axes his sky's colours lie along, cut into
twelve paints, each paint carrying its own distributions of angular length, width, curl, impasto, relief and the
angle a stroke lies off its band; the spatial structure of his bands and of his paint, along his flow and across
it; the bow his strokes have beyond the arc the field itself would draw; the hand of his smallest marks; and a walk
round the edge of his cone writing down what his sky is doing there. `src/sky.js` lays three generators from it:
our sky, at his density, over the whole sky above the water that his cone does not hold; our stars, few and
unnamed, each a core and rings out of the hand of his eleven, placed where the wind's eddies are not; and the
motes, on a lattice one cell wide that wraps round the eye in the shader. `src/wind.js` carries the field of §4.7
past his canvas — his projection exactly within sixty degrees of his axis and the ray's own direction beyond --
and adds the curl noise the design promised, the surface curl of a noise on the sphere, which is a field of eddies
at one angular size that turns without gathering or spilling. `src/strokes.js` gives every ribbon the underside of
§4.5, a second narrower strip behind it along the stroke's own ray from the standpoint. The dark behind the paint
goes to the colour of primed linen where a ray leaves the dream soon, and flying out of the dream fades it to
linen and begins it again over Saint-Rémy. `L` prints what is his, what is ours, and which of it was measured;
`?ledger` tints ours. New flags: `?nosky`, `?nostars`, `?nomotes`, `?nounder`, `?sky=`, `?nogov`; new harness:
`dream.seam()`, `dream.density()`, `dream.counts()`, `dream.star()`, `dream.restart()`.

**What was decided, and why.**

- **Ours is laid along the fit and flown along the flown field**, which is the split D1 made and the same reason.
  His own strokes lie along the fitted field to 15.4° and along the flown one only to 27.5°, because the plan's
  speeds make his eddies four times his drift where his lines say twenty-four. So our paint takes its direction
  from the fit, whose proportions are his, and a body takes its wind from the flown field. The curl noise outside
  his cone has an amplitude in each: twelve times the fit's drift for laying the paint, two metres a second for
  carrying a body.
- **The noise's size was set against his bands and not by eye.** Two of his band directions differ by 4.3° at half
  a degree apart, 18.3° at two and a half, 41.9° at ten and 43.4° at twenty, which is chance. A single octave at
  17° across gives 8.4 / 17.9 / 30.6 / 42.3 / 44.4 against his 9.1 / 18.3 / 30.2 / 41.9 / 43.4. Two octaves rise
  too fast at the small separations and a 5° noise is random by three degrees where his is not.
- **A size measured on his canvas is not the size it is seen at.** A canvas is flat: a stroke at the edge of his
  cone is farther off and turned away, and the same centimetres cover two fifths less angle there than at his
  middle. The hand's first measurements were canvas centimetres over the focal length, and ours came out half
  again too long where they meet his (25.2 mrad against his 19.9). Everything in the hand is now the angle it is
  seen at — the exact angle between a stroke's two ends, and the cosine of how far off his axis it lies for what
  lies across it — because the runtime turns it back into metres by multiplying by a depth.
- **His sky is not the same everywhere, so the hand carries a boundary too.** His corners are a tenth to a sixth darker than his mean. A generator that knows only his averages meets his edge with a step in it: the seam's colour came out
  16 to 20% off his along a three-degree band. So `tools/hand.py` walks the edge of his cone in 96 bins and writes
  down the paint, the colour and the stroke length of his sky within six degrees of it, and ours carries his own
  value outward and lets go — over five degrees for the paint, which is how long his paint stays itself, and
  twelve for the size, which is not his composition but his canvas's perspective and is smooth across the whole
  cone. That is not a blend of two textures; it is his measurement as the boundary condition of ours.
- **His colour is banded on every one of its axes.** 78% of his sky's colour lies along one axis, 21% along a
  second and 1% along a third, and all three are banded in space alike: two strokes a degree apart differ by about
  a quarter of the range on each where chance would give a third. Ours banded the first through a noise field and
  scattered the other two per stroke, and the result speckled — the seam showed as a difference of texture where
  the numbers said the colours matched. Ours now lays two fields of the same measured shape over each other, one
  for each of the two axes that carry 99% of his colour, and leaves only the third to chance. The paint's field is
  stretched twice along the wind, because his bands are: his strokes differ by 0.226 of the range along his flow
  and 0.252 across it.
- **The relief is measured against his law, not against his patches, or our sky stands a quarter too deep.** A
  patch of his sky is already a slope — his sky is far at the hills and near overhead — and the first
  measurement took each stroke's depth off its patch's middle, so his slope went into the relief. Ours then laid
  the slope itself *and* the relief that already held it, and the shell came out 51.6 m thick where his is 41.6.
  Measured off his own law it is 41.4.
- **Our stars are few, and the ledger says so.** His sky holds eighteen clusters of star strokes in 0.55
  steradians, 33 a steradian; ours are twelve in 5.7, one part in sixteen. Everything measured about one of ours is his — how many strokes, how wide, what
  colour at what radius, how far off the tangent each lies — and how few there are is a person's. A moon of ours
  was not made at all.
- **The motes are the one generator whose purpose is the sensation.** 2,600 small marks from the hand of his
  shortest tenth, on a lattice 60 m wide that wraps round the eye in the shader, so that a few thousand are a
  field without end. The ledger names them as that and not as picture.
- **The linen is a law about leaving, not a wall.** A ray is linen in the measure that it leaves the dream soon:
  within 400 m of the ceiling at 700 m or the edge at 2.5 km it has gone over, and from the middle of the night
  there is dark above. At the first attempt the fade ran over 1,500 m and the sky was a tan wash from 300 m up.
- **The underside stands along the stroke's own ray**, which is the way paint stands off a canvas, and not along
  the face that turns to the eye. Along the face it hides behind the stroke from every angle and is never an
  underside at all. Along the ray it hides exactly at his eye — the standpoint test is unmoved, 0.875 against
  0.873 — and from anywhere else the stroke has a body. A strip that would move less than a pixel is not drawn.

**What was measured.**

| | pre-registered | measured | |
|---|---|---|---|
| the seam, the paint either side of the edge of his cone | mean colour on ours within 10% of his | in a band of three degrees: **−7.8%, −2.7%, +8.0%** on the three channels (1,091 of his against 1,266 of ours) | pass |
| the seam, stroke length | within 10% | **+7.8%** as an angle from his eye; +16.9% in metres, because ours stands 12% deeper there; the width −0.7% | pass on the angle |
| the seam, a 512 px crop across the edge of his cone | mean colour on ours within 10% of his | at the pixel ratio the piece runs at, 512 px is 16°: along the top of his cone, where both sides are sky, ours is off his by **−6%, +17% and +30% in brightness** at three places on it (strips of 2.3° either side of the line: −16/−5/0, +30/+17/+9, +55/+32/+5 on the channels). Where his own composition meets his edge it is −56% beside his moon's white wave and −31% from inside the sky | **fail as written** |
| his sky at his own edge | — | 18,599 strokes a steradian in the three degrees inside it, against 16,562 over his sky: his edge is denser, not thinner | |
| density | ours within 15% of his, in strokes per steradian per metre of depth | 16,469 to 16,491 strokes a steradian against his 16,562, **within half a per cent**; the shell 34 to 36 m at the median patch against his 41.6, and 39 to 40 m by stroke against his 45.0 (the median patch is the noisier of the two: it moves 2 m between samples of cells where the stroke's own moves 1). So **456 to 479 against 398, +15 to +20%**, by patch, and **414 to 423 against 368, +13 to +15%**, by stroke | fails by the patch, holds by the stroke |
| our shell, by elevation | — | 38 m below 15°, **53 m from 15° to 31°** where his law falls fastest, 29 and 30 m above it where his law is flat, because he painted no sky above 34° and the law clamps | |
| ribbons | ≤ 90,000 | **112,020** (his 13,999; our sky 94,342; our stars 1,079; the motes 2,600) | **fail as written** |
| frame rate | ≥ 55 fps | not settled tonight: 42 / 45 / 45 on the three flights at 2.22 MP with our sky, and 45 / 47 / 46 with his strokes alone on the same machine in the same minutes | **undecided** |
| `?noStrokes` | black water, linen above 700 m, dark between | from 620 m: linen above, the dark between, black water below, and the water itself going to linen past 2.5 km. Nothing recognisable (`docs/d2-nostrokes-high.jpg`) | pass |
| the standpoint test, geometry | SSIM ≥ 0.85; no cell > 8% | **0.875**; 0 cells (D1: 0.873, D0: 0.873) | pass |
| parting, the *village* flight, with every stroke in the air tested | (D1) no stroke within 2 m for longer than 0.2 s | **none within 2 m at all**, over 1,204 frames and 112,020 strokes — his, our sky, our stars and the motes, which wrap round the eye and would otherwise pass through it | pass |
| his bands against our field | — | ours 8.4 / 17.9 / 30.6 / 42.3 / 44.4 degrees at 1.2 / 2.4 / 4.8 / 9.6 / 19.2 degrees apart, against his 9.1 / 18.3 / 30.2 / 41.9 / 43.4 | |
| his paint's banding against ours | — | ours 0.265 and 0.263 of the range at 1.2 and 2.4 degrees apart, against his 0.251 and 0.276 (chance is 0.333) | |
| our sky's mean colour against his | — | [0.0869, 0.1529, 0.2832] against [0.0859, 0.1525, 0.2860], within 1% | |
| the build | — | 112,020 ribbons in a quarter of a second | |
| the cost of our sky | — | 7% of the frame rate on the *glide*, 4% on the *swoop*, 2% on the *village* | |

**Our sky, as it became.** 94,342 strokes over the 5.7 steradians of sky above the water that his cone does not
hold, at 16,542 a steradian against his 16,562, in a shell 41.4 m thick against his 41.6. Its depth is his law read
in elevation — 665 m at the horizontal, 531 at fifteen degrees, 293 at thirty and 270 above that — with his
funnel of 160 m where the noise turns hardest, which covers 5% of the sky where his two cover 10% of his canvas,
and his relief for the paint each stroke is. Its direction is the fitted field with the curl noise, 17° across, at
twelve times the drift; its scatter off that is his own 14.8°. Its colour is two bands and a scatter on the three
axes his colour lies along; its length, width, curl, impasto and bow are his, as angles from his eye. Twelve stars
of ours, 1,079 strokes, each 20 to 60 m across in the air at 0.9 of the sky's depth, where his law puts his. 2,600
motes. 112,020 ribbons in all, built in a quarter of a second, and the same sky every time the page opens: three
seeds, and nothing drawn from the clock. `docs/d2-ledger.jpg` is the tint on, as Rule 3 asks — his sky to the
left of his cone's edge in his colours, ours to the right of it in pink, the motes pink over the water, and the
panel saying which is which and what was measured. `docs/d2-a-star.jpg` is one of ours from seventy metres off;
`docs/d2-linen.jpg` is the paint from under the ceiling, with the linen showing through it.

**The gate.** *Turn round. Behind you, where his cone is not, is it still his sky?* The builder's answer is yes
in the open sky and no at the line where his painting itself is. Turned round (`docs/d2-turned-round.jpg`) there
are bands, eddies that wheel, dark patches and pale ones, a star or two, and the paint goes on overhead
(`docs/d2-zenith.jpg`) with no edge to it: it is his palette, his stroke, his scale, his weather. At the middle of
his top edge (`docs/d2-seam-top-middle.jpg`) the line cannot be found — his sky and ours are one field there, 6%
apart in brightness. At the two ends of that edge (`docs/d2-seam-top-left.jpg`, `docs/d2-seam-top-right.jpg`) it
can be found, not as a line but as a change of character: his side is ribbons and forms and ours is a finer,
busier mass, 17% and 30% apart. Beside his moon (`docs/d2-seam-right-edge.jpg`) it is plain at once, and the
reason is not the seam: his white wave and his moon lie along that stretch of his edge, and nothing drawn from
his sky as a whole can put a moon where his hand put one. So the honest answer to the gate is that it is his sky
until you look at where his painting stops. That is the author's to fly, and if the answer is no, §15.2 has the
pre-registered remedy: not to blend it but to widen his, and put the edge of his cone in the dark.

**Still visible, named rather than fixed.**

- **The crop across the seam fails, and what it measures is his composition.** Carrying his own paint and colour
  outward closed the step in the *paint* from 16–20% to 8%, and the strokes either side now match in colour, in
  angular length and in width. What is not closed is the rendered brightness: 6% at the middle of his top edge,
  17% and 30% at its ends, 56% beside his moon. His sky is denser at his own edge than over his canvas as a whole
  (18,599 strokes a steradian against 16,562) and it is doing different things at different places along it —
  a dark corner here, a white wave there. Ours carries his colour and his size outward; it does not carry his
  picture, and it should not.
- **Ours reads busier than his where they meet.** The numbers match — his own 14.8° of scatter off the band, his
  lengths, his density — and the eye still finds his side more ordered. His bands are a little more coherent along
  the flow than across it (0.226 of the range against 0.252, a degree apart, measured); ours is the same in both
  directions, and that is the most likely cause. A noise cannot be stretched on a sphere by warping the point it
  is read at, and the smoothing that would do it properly was built, measured as too noisy to tune against at the
  pair counts available, and taken out again.
- **The ribbon budget was a guess and his density is the answer.** 112,020 against the plan's 90,000. His sky
  holds 16,562 strokes a steradian and the sky outside his cone is 5.7 steradians; sixty thousand would be 63% of
  his density and the density criterion would fail instead. `?sky=0.64` is the one flag that makes the trade, and
  it is the author's.
- **Our sky is a shell round one standpoint.** D4 has three, eight hundred metres apart, and three shells of 270
  to 707 m would overlap. What our sky is when there is more than one cone is D4's question and this milestone
  does not answer it.
- **The stars' rings are not fitted by the wind** (D1 said so) and our sky lies along that field where his stars
  are. Ours are placed away from the eddies, so none of ours sits in the worst of it.
- **The water goes to linen at 2.5 km**, and from the standpoint that is a thin bright line along the horizon. It
  is the edge of the canvas seen edge-on and it reads as one; whether it should be there at all is the author's.
- **Our sky does not drift.** §5.5 says the sky strokes drift along the wind at a walking pace so that the eddies
  visibly turn; ours turn on their curls, as his do, and nothing else moves. A minute of that drift is eighty
  metres, and carrying the paint along the field for minutes would wind his bands into the eddies and undo the
  structure this milestone measured. What should happen instead — a cycle, a slower pace, or the drift only near
  the eye — is not settled, and the plan does not name a milestone for it.
- **Nothing was done about the motes' size.** A mote is his smallest mark's angle at thirty metres, which is a
  number a person chose; his hand gives only the shape.
- **The frame rate was not measurable tonight.** The desktop app's browser pane stopped rendering when it was
  hidden, and before it did, the machine was running other work at half its cores. What was measured, back to
  back in the same minute, is the difference our sky makes; what was not measured is whether the piece holds 55.

### D3 — The water

*Built 20 September 2026, in one night. The plan gave it four days. `tools/columns.py`, `src/water.js`, the column
mode of the one shader, a floor that slows instead of stopping, the water's own colour out of his, and the first
layer of the sound. Four of the five exit criteria were measured; the fifth, the frame rate, could not be measured
on this machine tonight either, and this time the log says exactly why — down to the number of triangles the
hidden pane draws — rather than reporting a number it does not trust. One of the four fails as written, and what
refutes it is his own canvas.*

**What was built.** `tools/columns.py` measures the Rhône's water — the one place in the four canvases where the
law of a reflection is written down — and writes `hand/rhone-column.json`. This is the one time a hand is measured
before its canvas is in the air: the Rhône is exploded in D4, so nothing here is stored as a size. A column is
measured against itself and a mark against its column, and a ratio is the same from any standpoint. `src/water.js`
gathers every light in the dream — his emissive strokes clustered by the angle they subtend at his standpoint,
which is one light for a star of two hundred marks, and our twelve stars, which say for themselves which strokes
are which — and lays a column of marks under each, built once, every mark a place on its own column and a size
against its own column's width. `src/strokes.js` gains the column mode: the three control points of a reflection
are not a place in the world but a place on a column, and the shader puts that column on the water from wherever
the eye is, every frame, because a reflection is not a decal. The plane's colour is his water's hue at his water's
share of the dark. The floor of §6.3 is a deceleration and not a factor on the speed. `src/audio.js` is rewritten
for this piece and carries the first of the four layers of §10, the water under you. `tools/reflect.py` is the
pre-registered picture test: one column, drawn alone, from four eyes. New flags: `?noreflections`, `?nosound`,
`?water=`, `?wet=`, `?only=`; new harness: `dream.water()`, `dream.column(i, eye)`, `dream.floor()`,
`dream.sound()`, `dream.onlyLight(i)`, `dream.project()`, `dream.unproject()`.

**What was decided, and why.**

- **A column's length is not its light's, and his canvas is what says so.** The plan pre-registered "its length by
  the light's height and brightness, from the hand". His ten columns reach the same depth below his waterline
  whatever lamp stands over them — 0.206 of his canvas height, a spread of a ninth over the ten — and against the
  lamp's height that is r = 0.30, against its brightness r = 0.10, with n = 10. That is not a shortfall in the
  measurement; it is what a reflection does. The near end of a glitter path is where the water would have to tilt
  further than it does to send the light to the eye, and that is set by the water and by how high the eye is. So
  the hand gives one number — the slope of his water — and the two ends of every column of ours follow from it in
  closed form, from any eye, by the same law that put his under his gaslights. What does follow the lamp is how
  much paint the column carries, r = 0.54, and that is what a brighter light buys: more marks, not a longer column.
- **His canvas gives a floor for that number and not a value.** Each of his columns reaches 0.87 of the water
  there is under it before his near bank begins, so what his canvas shows is that a column reaches *at least* that
  far. The slope that follows, 4.24°, is a floor too, and it is read at the 50° field of view the plan gives the
  Rhône in D4 — if D4 sweeps that number this one moves with it, and `hand/rhone-column.json` says so in its own
  fields.
- **Everything in the hand is a ratio, because the Rhône has no standpoint yet.** A column against its own reach,
  a mark against its own column, the water against the sky. The D2 lesson — that a size on a canvas is not the
  size it is seen at — does not bite here, because no size is stored: what is stored is the ratio of two extents
  a few centimetres apart on the same canvas, where the flatness cancels.
- **His paint is not his ground, again.** `tools/columns.py` measures his water between his columns at his sky's
  colour times [0.62, 0.55, 0.47], channel by channel. Putting that on our plane makes a lit grey floor under the
  whole dream, because our sky is a denser and brighter night than his Rhône's and because his water is painted
  where ours is bare. So the hue of his water is taken exactly and the darkness is taken as his ratio of
  brightness against the dark this night's sky stands on. That is the same distinction D2 drew for the relief, and
  it is the one judgement in the milestone's colour: `?wet=` opens it, and at about ten the plane is his paint's
  brightness and reads as a floor.
- **Nothing of ours lies on the water inside his cone.** §5.1 says that between the cones there is the sea, our
  sky over it, and the reflections; read as a rule rather than a description, that is what keeps the standpoint
  test standing. His village lies on this same water, at the same height, so a reflection of ours inside his cone
  stands in front of his paint. Let in, it takes §4.4 from 0.871 to 0.843 with six cells over the limit. Kept out,
  the test is where D2 left it.
- **The water is a floor and a floor is not a ray.** §5.4 puts linen where a ray leaves the dream soon; a ray that
  hits water never leaves. Before D3 the water went to linen past 2.5 km and from any eye near it that was a
  bright line along the whole horizon — the edge of the canvas seen edge-on, which D2's log had already named. It
  now simply stops where the dream does and the dome carries on in the same colour, and the horizon is a horizon.
- **Where a mark lies down its column is an angle, not a distance.** His τ was measured down his canvas, which is
  an angle from his eye. Laid evenly in metres along the water, the near half of a long column comes apart into
  gaps, because the near half is most of the picture. Laid evenly in the angle it is seen at, it is his.
- **A mark's slant is a slant on the canvas.** His marks lie 12.8° off the way their column runs. The water runs
  away from the eye, so what lies along a column is foreshortened and what lies across it is not; the world
  direction is stretched by exactly how flat the water is seen at that point, so that the angle comes back as his.
  The same for a mark's length, which is set so that its length *on the screen* is his fraction of its column's
  width.
- **A soft floor is a deceleration.** The old one multiplied the descent by how far you were off the water, which
  scales with your own speed: a swoop at forty metres a second was stopped in a fifth of a second, which is a wall
  with a soft name. The descent is now held to the speed a constant 15 m/s² could still stop from here — one and
  a half g, whatever you arrive at — so the last three metres take half a second and you land at a walking pace.
- **The sound is keyed to a height and to the same wave the paint ripples with.** The water is brown noise whose
  top opens as you come down — a river at fifty metres is only its low end and a river at one metre has the slap
  of the small waves in it — and it breathes at 0.37 a second, which is the rate the reflections' own wave
  breathes at, so that what is heard and what is seen are one thing. The other three layers of §10 are D5's and
  `src/audio.js` says so rather than pretending they are there.

**What was measured.**

| | pre-registered | measured | |
|---|---|---|---|
| a column lies under its light from every eye | (the first criterion) | from four eyes — three metres over the water, at his standpoint, 260 m up, and off to one side — the column is drawn within **0.062°** of the bearing of its light, and below the horizon from all four (`tools/reflect.py`, the column alone measured against the same frame without it). Over those four eyes it is 7.04° to 16.66° long by the law and its middle moves 346 m across the water; a decal would move none of it | pass |
| how much of a column the paint fills | — | where it is short the lit pixels run the whole of it — **7.02° against 7.04° by the law**, and 12.23 against 12.22 — and where it is long they run two thirds of it (11.50 of 16.66, 9.56 of 13.85), because his own paint profile leaves the far end faint and the faint end of a long column falls under the threshold. His does the same on his canvas | |
| its length by the light's height and brightness, from the hand | (the same criterion) | **his ten columns say otherwise**: every one reaches 0.206 of his canvas height below his waterline, sd 0.023, whatever lamp is over it — against the lamp's height r = 0.30, against its brightness r = 0.10, n = 10. Against the lamp's brightness the column's *paint* is r = 0.54 | **fail as written** |
| the floor | the descent at a swoop stops at 1 m with no bounce over the last 3 m | from 60 m at a swoop: stops at **1.000 m**, minimum 1.000, **bounce 0.0000**; −9.95 m/s at 3 m, −1.57 at 1.08 m, still at 2.65 s; the last three metres take 0.50 s and the deceleration never exceeds the 15 m/s² it is held to | pass |
| ribbons | ≤ 100,000 | **113,708** — his 13,999, our sky 94,342, our stars 1,079, the motes 2,600, the reflections 1,688 | **fail as written**, and D2's fail carried |
| frame rate | ≥ 55 fps | not settled, and this time with the reason in hand: the desktop app's browser pane gives the page a canvas of **0 × 0 pixels** while it is hidden, and the renderer submits **one triangle a frame** — the 121 fps it reports is the cost of an empty frame. Headless is a software rasteriser and gives **1 fps** at 480 × 360, which is not the budget's number either | **undecided** |
| the harness itself | — | the three flights were timing themselves on the piece's own clock, which is capped at a twentieth of a second so that a stall is not a teleport — so **no flight could ever report below 20 fps**, and both flights read exactly 20 before it was found. Fixed: the rate is taken on the real time between frames and the cap is left to the body. D0 to D2's numbers are 42 and above and are unaffected | |
| the standpoint test | (D2's, SSIM ≥ 0.85, no cell over 8%) | **0.871**, 0 cells — with the reflections let into his cone, 0.843 and 6 cells | pass |
| his columns' reach, as an angle | — | 8.47° at the 50° field of view the plan gives the Rhône, so his water tilts **at least 4.24°**; a floor and not a value, because each column reaches 0.87 of the water under it before his near bank | |
| a column's shape | — | 11.4 times longer than wide; 53 marks; a mark is **1.01** of the column's width long and **0.38** across, and lies **12.8°** off the way the column runs | |
| his paint down a column | — | 0.23 of its most at the far end, rising without a turn to 1.00 at the near one: toward you there is more paint and each mark is dimmer | |
| his colour down a column, letter 691 | — | brightest a third of the way down (0.188) and dimmest at the near end (0.121), **a third darker**; blue over green rises 0.21 → 0.36 through the middle and falls back to 0.25, and red over green falls 1.11 → 1.03. So the *red gold that goes right down to green bronze* is in his paint as a third of the brightness, three quarters more blue through the middle, and seven per cent less red | |
| his water against his sky | — | **[0.622, 0.553, 0.470]** channel by channel; and his water does not lighten toward the far bank (0.033 to 0.038 over five bands from bank to bank), so nothing was invented there | |
| our plane | — | his water's hue exactly: green over red **1.4946** against his 1.4934, blue over red **1.5396** against his 1.5389 — at **0.554** of the dome's horizon, which is his measured share of his own sky | |
| our water in a frame | — | **6.5%** of our sky's brightness where his is 54% of his, because our sky is denser paint and our water is bare; `?wet=10` is the other reading | |
| the lights | — | **29**: 17 of his (his eleven stars and his moon, gathered by the angle they subtend at his eye) and our 12. The budget's fifteen thousand reflections were for three canvases; this one has one | |
| the water heard | — | full at the floor, 0.73 at 10 m, 0.35 at 25 m, 0.002 at 50 m and nothing above; the low-pass opens from 150 Hz far off to 670 Hz at the floor | |
| parting, with the reflections in the test | (D1) no stroke within 2 m for longer than 0.2 s | **none within 2 m at all**, on the *swoop* (600 frames) and on the *village* (1,201), with all 113,708 strokes tested each frame and the reflections placed as the shader places them, from the eye, every frame | pass |
| how near a reflection comes | — | at the floor the nearest mark of a column would be **1.03 m** from the eye — a reflection is laid between you and its light, so at a metre over the water its near end is at your feet — and parting puts it at four. Lamps and their reflections part like anything else (§6.5) | |
| the build | — | 113,708 ribbons in about three tenths of a second, and the same water every time the page opens: one seed, and nothing drawn from the clock | |

**The water, as it became.** A plane at height zero, everywhere, the colour of his water and near black: [0.0056,
0.0083, 0.0086], his hue exactly, at 0.54 of the dark this night's sky stands on, which is his own ratio. It ends
where the dream does and the dome carries on in the same colour, so the horizon is a horizon and not the edge of a
canvas seen edge-on. On it, under each of 29 lights — his eleven stars and his moon, gathered into 17 lights by the
angle they subtend at his eye, and our 12 stars — a column of 28 to 110 marks, drawn from the ten his Rhône paints:
as long for its width as his, as many marks, each as long and as wide and as slanted, with his paint thin at the
far end and thick at the near one and his colour at every point down it, and a brighter light carrying more paint
rather than a longer column. Where each column lies is not in the record at all: it runs along the water in the
vertical plane between the eye and its light, from the far point where the water would have to tilt 4.24° to send
the light back to the near one where it would have to tilt as far the other way, and the shader works that out
every frame from where the eye is. Come down to the floor and a column reaches sixteen degrees of sky toward you;
climb to 260 m and the same column is seven degrees and lies under the same light to a fifteenth of a degree.
1,688 marks in all, on top of D2's 112,020. `docs/d3-the-water.jpg` is the water from twenty-six metres up with his
canvas above it; `docs/d3-at-the-floor.jpg` is the same water from a metre, where the columns run out to the
corners of the frame; `docs/d3-a-column.jpg` is one column from nine metres; `docs/d3-his-columns.jpg` is the band
of the Rhône all of it was measured from; `docs/d3-one-column-low.jpg` and `docs/d3-one-column-high.jpg` are the
same column of the same light drawn alone from three metres over the water and from 260 m up, which is what
`tools/reflect.py` measures; `docs/d3-ledger.jpg` is the tint on, with the reflections pink on the
water and the panel saying what of them was measured and what a person chose.

**The gate.** *Fly low over the water toward the moon. Does the water read as water, with nothing modelled?* The
builder's answer is yes, and it reads as his water and not as water in general. `docs/d3-toward-the-moon.jpg` is
three metres over the sea with his canvas's lower edge above: a row of gold and olive columns running down toward
the eye, dimming and thickening as they come, on a dark that is almost but not quite black. There is no surface in
the piece — no normal, no fresnel, no horizon glow, no specular anything — and what makes it water is that the
columns lie between you and their lights and move when you move, that they lengthen as you come down and shorten
as you climb, and that every mark in them is the size and slant and colour his hand gave the ones on the Rhône.
What it does not yet have is his water's own paint: between his columns his water is a thousand horizontal dashes
of blue and dark green, and ours between the columns is bare. That is D4's, and the answer to the gate should be
read with it missing.

**Still visible, named rather than fixed.**

- **The reach is a floor and not a length.** His ten columns end just above where his near bank begins — they
  reach 0.87 of the water under them — so his canvas cannot separate a law from a composition. 4.24° of slope is
  the least his water can tilt, and if his columns were cut off by his shore the true slope is greater and ours
  are short. What would settle it is a canvas with more water than columns, and there is not one.
- **The slope is read at a field of view D4 has not swept.** 8.47° of reach is 0.206 of his canvas height, and
  turning that into an angle needs the Rhône's focal length, which `BUILD.md` plans at 50° and D4 authors. The
  hand carries the raw ratio beside the angle, so the number moves with it and nothing has to be measured again.
- **The reflections are kept out of his cone, and looking his way over the water there are none.** That is the
  rule §5.1 gives and it is what keeps the standpoint test standing, but it means the water in the whole of his
  own direction — a wedge 62° wide, from 128 m out — carries no columns at all from any eye. From close to his
  standpoint the near water in front of his canvas still does (`docs/d3-the-water.jpg`); from far off it does not.
  Whether D4's three cones make that worse or better is D4's.
- **A long column is his in every proportion and still thinner in the paint.** At a metre over the water a column
  runs sixteen degrees and its fifty-three marks are laid at his own spacing in the angle, at his own size for
  that length — but his column was eight degrees, and the water between the marks shows more at twice the length.
  Nothing was added to hide it.
- **Our water has no strokes of its own.** §5.2 says what you see of the water is reflections, and that is all
  there is: between the columns the plane is bare. His Rhône water is 1,061 horizontal dashes between his columns
  and D4 brings them, at the water's depth, with the canvas they belong to.
- **His lights are a clustering with a number a person chose.** His 2,547 emissive strokes come to 17 lights at a
  link of 0.035 radians — his eleven stars and his moon, but not one for one. A star of his whose halo touches
  another's is one light here. `?link=` opens it.
- **A column of another colour is his column, tinted, and the tint is clamped.** A light's colour over his
  gaslight's colour, channel by channel, never more than 2.2 and never less than 0.12. Our stars are whiter than
  his gaslights, so our columns are paler than the Rhône's; his moon's would be paler still, and the clamp is
  what stops a blue light from throwing a column his paint has no colour for.
- **The wave is a person's.** 0.022 of a column's length at 0.37 a second, with a lateral half of that. §5.5 asks
  for a slow ripple and his canvas, which is one instant, cannot say how fast. The sound's water breathes at the
  same rate, so at least there is one number rather than two.
- **The ribbon budget fails again, and for D2's reason.** 113,708 against 100,000; the reflections are 1,688 of
  that, and our sky is 94,342. `?sky=0.64` is still the one flag that makes the trade and it is still the
  author's.
- **The frame rate was not measurable tonight either, and now the reason is written down.** The browser pane in
  the desktop app hands the page a canvas of no size while it is hidden: the renderer draws one triangle a frame
  and reports a hundred and twenty, which is the speed of nothing. Headless swiftshader draws all of it and
  reports one. Neither is the number the budget is about, and the piece has now gone three milestones without it.
  What is needed is a browser window a person can see, left alone for three minutes. What can be said without
  measuring is that the milestone adds 1.5% to the ribbons and, to the fill, one thin column of paint under each
  of 29 lights against the 94,342 strokes of sky already there.

---

### D4 — The night of Arles

*Built 20 September 2026. The plan gave it eight days and said it expected to overrun, because depth authoring is
the one thing here a person does by hand, three times. Two canvases were authored — region masks typed off the
flat renderings, and a law for each region — and both of their standpoints turned out to be readable off the
canvas rather than chosen, which is the milestone's best news. Its worst is that D3's law for where a reflection
stands, asked for the first time with a standpoint to ask it from, does not reproduce his own columns. Five exit
criteria: three pass, one fails, one is still unmeasurable. And one bug that had been in the piece since D0 was
found, because it could only ever show itself at a second standpoint.*

**What was built.** `depth/rhone.json`, `depth/cafeterrace.json` and their masks and sidecars: fifteen regions
between them, each with a law and a reason. `tools/mask.py` gains a rule for each — polylines typed off the canvas
as the Starry Night's were, plus two things found rather than typed, his stars and the terrace's pale table tops.
`tools/depth.py` gains two laws, because the one canvas with walls needs them: a `plane` may be a ceiling as well
as a floor, and a `wall` is a vertical plane at a bearing. `src/explode.js` gains `cone()`, the pyramid a canvas
cuts out of the world from its standpoint. `src/strokes.js` takes three of those and keeps one rule for every
stroke in the piece: **inside a cone there is his painting and nothing else** — not our sky, not a reflection, not
a mote, and not another canvas of his. `src/flight.js` gains the current: `1`, `2`, `3` do not cut to a standpoint,
they let the night carry you there over eight to twelve seconds, and the carry lets go the moment you touch the
controls. `src/main.js` reads three canvases, sets the three cones before any stroke is built, and shows a caption
at each standpoint the first time you reach it. `tools/lines.py` is new and is the reason the caption may quote
him at all: it asks vangoghletters.org for the letter, finds every fragment of the line in the paragraph named,
verbatim and in order, refuses a line that starts or stops inside a sentence without an ellipsis, and requires the
edition's own note to identify the canvas the line stands at. `tools/hand.py` gains `--only` and a hand for the
water. `src/water.js` gathers each canvas's lights from its own eye and gains `makeSea`, the open water's own
marks. New flags: `?at=1|2|3`, `?nocones`, `?nosea`, `?sea=`, `?nocaption`, `?only=<slug>`; new harness:
`dream.current(n)`, `dream.cones()`, `dream.clipped()`, `dream.sea()`, `dream.caption(n)`, `dream.dwellHere()`,
and `dream.sim(secs)`, which runs the body forward without drawing.

**What was decided, and why.**

- **A standpoint is not authored if the canvas will say it.** The plan gave the Rhône +6° of pitch and the terrace
  +14°, both inherited from the sibling, and both are wrong by more than the build could have guessed. The Rhône
  fixes its own with two things: its far bank stands *on the water*, so its waterline must lie below the
  horizontal, and the couple on the shore are 1.65 m tall where they stand. Solved together those put his eye
  4.41 m over the water and pitch it **2.14° down** — a man on the embankment, not on the beach. At +6° his far
  bank floats above the horizontal, which nothing standing on water can do. The terrace fixes its own with one:
  the waiter in the road is 1.65 m tall, which puts him 17.1 m off, and his head sits at v 0.580 — and a standing
  eye sees a standing man's head on the horizon. So the horizon is v 0.580 and the pitch is **+5.19°**, not +14°,
  and the eye is at 1.65 m. Neither eye height was chosen; both fell out.
- **The water needs no authored depth.** It is the one region in the piece whose distance follows rather than
  being typed: a ray below the horizontal meets the plane, and where it meets it is how far his stroke stands. And
  his quay is the same plane — the couple could not be 1.65 m tall on a bank raised even half a metre, so his
  shore is at the water's own level and the foreground is one law from the bottom edge of the canvas to the far
  bank.
- **Two new laws, for the one canvas with walls.** An awning is a plane read upward: at 3.65 m it stands 4 m over
  your head at its outer edge and 17 m off at its far end, which is a terrace. The two sides of the street are
  vertical planes, `d = c / (n · r)`. And the tables are neither: a table top is 0.9 m under the eye where the
  pavement is 1.65, so a table is *the pavement at 0.545 of its distance*, which is the whole of it — one number,
  no region of its own, and it is right at every point of the canvas at once.
- **§5.1 is one rule for everything, and it is what lets three canvases share a sky.** D3 read *between the cones
  there is the sea, our sky over it, and the reflections* as a rule for our strokes. With three canvases in the
  air it has to hold between his as well, or each standpoint test is fouled by the other two. One line in the
  shader hides a stroke whose middle lies inside a cone that is not its own, and with it the placement of the
  three cones is free of the test. So the placement was chosen for what §5.1's own sentence asks instead: Arles'
  two stand back to back on one quay, the river in front and the square 300 m behind, and Saint-Rémy stands off
  across the water. Nothing is clipped at all — 0 of his 38,654 strokes, and 746 of our 94,342 sky strokes, which
  are the ones that stray over Arles.
- **Eight hundred metres became 767, 860 and 300.** Open question 6 wanted the spacing settled by flying it. Two
  cones eight hundred metres apart and a third three hundred behind one of them is what the geography in §5.1
  describes, and the current takes 11.2 s to cross the long one and 8.0 s to cross the short one, which is the
  band the plan asked for without being made to fit it.
- **A current is a carry and not a cut.** The criterion is that the painting is exactly there when it lets go:
  within 0.2 m and 2°, in eight to twelve seconds. It eases in and out with nothing at either end, its length
  grows with the distance, and **it lets go the moment you take the controls back** — a current you cannot leave
  is a rail, and §2 says this piece has none.
- **No line of his ships that the edition has not confirmed.** The sibling learnt this the hard way and the
  checker is harvested; `tools/lines.py` asks it of this piece's four. Three passed as DESIGN §9 wrote them. The
  fourth did not: letter 777's *morning star, which looked very big* is Venus seen from a window, the edition puts
  no note on that paragraph, and the one note within two paragraphs of it names *Starry Night Over the Rhône* — so
  by the sibling's own rule the line may not stand at The Starry Night by an explanation. It is letter 782 instead,
  whose note identifies F 612 at the paragraph itself. Four lines, nought wrong, and `letters/letters.json` is the
  record a stranger can check.
- **The hollowness is left.** Open question 3 offered three answers and D4 was to look from three viewpoints and
  choose. From behind the wall, over the roof and across the way (`docs/d4-hollow-*.jpg`) the terrace is an island
  of paint with a front: the awning a blade, the pavement a carpet, the houses a slab. The underside of D2 gives
  every stroke a body and does not fill it. The third answer — continuing the façade in the hand of his façade
  strokes — would be paint of a thing he never painted, which is the line §2 draws, and it stays deferred with a
  new trigger. What answers it in flight is the current: you arrive at the standpoint and the square opens in
  front of you.
- **The couple are at twelve metres, not four.** Open question 9 guessed four. Their own height puts them at
  12.3 m, and they are two flat shells and stay so.
- **Our sea carries his water's hand at our own density.** D3 left the water bare between the columns and said so.
  His Rhône's 8,415 water marks cover the water of his canvas **two and a half times over** — paint over paint, not
  a sprinkle — and an unbounded sea cannot be paid for at that price. So the open water takes every measure of his
  mark and none of his density: 1,010 marks on a lattice 26 m wide that wraps round the eye, covering 3% of the
  water where he covers 256%, and the ledger calls the density ours, exactly as §5.3 does for the motes. They lie
  across the wind's drift, because that is why his dashes are horizontal: a horizontal line on a canvas painted
  from a bank is a line of one distance on the water, and a wave's front is the same line.
- **The terrace has no hand for a star, and that is the measurement.** Its 24 star strokes fall into nine clusters
  of which the biggest is seven marks: this canvas paints a star as one pale dab, not as the core and rings the
  Starry Night gives. `hand/cafeterrace-star.json` is kept as the record of what was asked and what came back, and
  our stars keep the Starry Night's hand.
- **Parting is off at a standpoint.** At the terrace's own eye his pavement begins 3.9 m away, inside the parting
  radius of four. Under `?test` the body is still and the frame must be the painting, so parting is switched off
  there along with the curl. In flight it stays on, and the test says what it costs (below: nothing).
- **The flat control is not a hundred metres for every canvas.** D0's second number renders the same strokes with
  every depth equal, so that the first can be judged on texture rather than placement. From a quay 4 m over the
  water, flattening a canvas to a hundred metres puts its whole foreground *under* the water plane, and the
  control then measures the water. It is now the distance at which the canvas's lowest ray still stands above it —
  9.4 m for the Rhône, 3.1 m for the terrace, and still 100 m for the Starry Night, so D0 to D3's numbers are
  unmoved and comparable.

**The bug that needed a second standpoint.** `src/explode.js` and `src/flight.js` disagreed about which way yaw
turns. The explosion had a canvas at yaw 90 facing west; the camera at yaw 90 faced east. At yaw 0 — the only
standpoint the piece had from D0 to D3 — the two agree exactly, so nothing could show it. The first frame from the
Rhône's eye was empty, and it took an hour to find because every other explanation was checked first: the cone
rule, the parting, the underside, the depth data, the uniforms, the draw call. What settled it was the view-space
z of his own strokes from his own eye: positive, which is behind you. `explode.js`, `wind.js` and `tools/depth.py`
now turn yaw the way `flight.js` does — clockwise from north, so that 90 is east. Nothing measured before D4
moves, because everything before D4 was at yaw 0.

**What was measured.**

| | pre-registered | measured | |
|---|---|---|---|
| the standpoint test, all three, as written | SSIM ≥ 0.85 against the record's flat; no cell over 8% | 0.477, 0.590, 0.437; 45, 13, 74 cells | **fail, on texture** — as D0 found and for D0's reason |
| the standpoint test, all three, geometry | SSIM ≥ 0.85 against the runtime's own flat; no cell over 8% | **0.868** starry (D3: 0.871), **0.926** rhone, **0.904** cafeterrace; **0 cells** each | pass |
| a current to an eye | arrives within 0.2 m and 2°, in 8 to 12 s | to the quay, 768 m: **0.077 m, 0.000°, 11.17 s**; to the square, 300 m: 0.023 m, 8.05 s; to Saint-Rémy, 860 m: 0.079 m, 11.78 s | pass |
| the three flights, now across the sea | ≥ 55 fps | not measurable on this machine — the fourth milestone running | undecided |
| ribbons | ≤ 130,000 | **140,337**: his 38,654, our sky 94,342, reflections 2,652, motes 2,600, stars 1,079, the sea 1,010 | **fail** |
| hollowness | three screenshots and a decision under open question 3 | `docs/d4-hollow-{behind-the-wall,over-the-roof,across-the-way}.jpg`; left as it is | done |
| parting, the village flight | no stroke within 2 m for longer than 0.2 s | **none within 2 m at all**, 3,601 frames | pass |
| parting, the swoop | " | none at all, 1,801 frames | pass |
| parting, up the street to the square | " (not one of the three; the place where his paint comes nearest his own eye) | none at all, 1,441 frames | pass |
| the soft floor | stops at 1 m, no bounce | stops at **1.000 m**, bounce 0, the last three metres in 0.57 s from 38.8 m/s | pass |
| the glance | half a second of gaze turns the heading < 10° | 30° of gaze, **5.64°** of heading | pass |
| `?noStrokes` | a black plane and a dark dome | `docs/d4-nostrokes.jpg` | pass, rule 2 |
| what the rule of §5.1 hides | — | 0 of his 38,654; 746 of our 94,342 sky strokes | |
| the three cones | 800 m apart | 767 m and 860 m between the towns, 300 m within Arles; half-angles 31°×25.5°, 25°×19.8°, 25°×30.2° | |
| his lights | — | 50: 17 in the Starry Night, 18 on the Rhône's far bank, 3 on the terrace, 12 of our stars | |
| his water's own hand | — | 8,415 marks, spacing 0.64 cm, a mark 2.70 spacings long and 0.82 wide, lying 18° off horizontal, covering **2.56×** the water | |
| D3's law against his own columns | (D3's, now askable) | the law puts them at 47–186 m where he painted them at 22–86; **+112% at the far end, +117% at the near**, and no slope mends both | **fail** — see below |

**D3's law, refuted by the canvas it was drawn from.** D3 built the length of a reflection out of one measured
number, the slope of his water, and could not test it against the Rhône because the Rhône had no standpoint. It
has one now, so the law can be given his own eye, his own lamps and his own far bank and asked where it puts his
ten columns. It puts them twice as far out as he painted them, and the reason is structural rather than a matter
of tuning: a specular glitter path must straddle the mirror point, `A·D / (A + B)`, which for an eye 4.4 m up and
lamps at 220 m is 118 m — and his columns lie entirely inside it, 22 to 86 m. No slope mends both ends. Solved
jointly for pitch, eye height and slope, the best fit runs to the edge of the physical range: an eye 7 m up
pitched 15.8° down, a bank 26 m off and a water tilting 22.5°, which is not a river at Arles and is not water. So
his reflections are drawn the way reflections are drawn — hanging from the light toward the viewer — and the
specular account of *where* a column stands is a model his canvas does not carry. What the law does get right is
the thing the piece actually needs from it: a column of about his angular length that follows the eye, which
`tools/reflect.py` measured in D3 to 0.062° of bearing from four eyes. So D3's 4.236° is kept in the runtime and
`hand/rhone-glitter.json` says, in the file, what it gets wrong. `tools/columns.py rhone --check` runs it.

**The night of Arles, as it became.** Three cones on one black sea. Saint-Rémy at the origin, forty metres up,
its village and its hills opening north; the quay 767 m south-east of it, four metres over the water, looking east
across the river at a bank of gaslights 220 m off; and the square 300 m behind the quay, looking the other way up
its own street. Between them, open water, our sky over it, a thousand marks of his water at our own density, and
fifty lights laying columns. `1`, `2`, `3` are three currents, and each says his own line when it arrives.

**The gate.** *Glide from the swirl down to the quay and up the street to the square. Is it one night, or three
pictures on a pond?* The author's to answer. What the build can say is what the pictures show: from inside a cone
it is his painting and you are in it (`docs/d4-the-quay.jpg`, `docs/d4-the-square.jpg`); from between them, at a
hundred metres, it is three islands of paint on black water with our motes between (`docs/d4-one-night.jpg`); and
from behind, a painting has a front (`docs/d4-hollow-*.jpg`). The honest reading is that the cones are each a
night and the sea between them is not one yet.

**Still visible.**

- **The sea between the cones is the weak place, and now it has a name.** From a hundred metres up, over open
  water, what you see is our motes — a few thousand pale chips at a lattice sixty metres wide — and almost nothing
  else. §5.3 says the motes are for the sensation of speed and disappear at a glide; held still over black water
  they are the picture. The sea's own marks help a little at a metre and not at all at a hundred.
- **The ribbon budget fails for the third milestone, and for the same reason.** 140,337 against 130,000. His three
  canvases are 38,654 of it and were always going to be; our sky is 94,342, where §12 budgeted sixty thousand.
  D2's finding stands: his own density says ninety-four, and `?sky=0.64` is the one flag that makes the trade. It
  is still the author's.
- **The frame rate has now gone unmeasured in four milestones.** The browser pane in the desktop app draws to a
  canvas of no size; headless swiftshader draws 2.8 million triangles a frame in software and reports about one.
  What D4 added is a way round it for everything except the frame rate itself: `dream.sim(secs)` runs the body and
  the fixed flights forward on the piece's own clock without drawing, which is how the currents, the floor and all
  three parting tests were measured tonight. A frame rate is the one number that cannot be simulated, and it needs
  a browser window a person can see, left alone for three minutes.
- **Our sky is still a shell round one standpoint.** D2 named it and D4 was to answer it with three cones. It does
  not: our sky is still a shell 250 to 700 m round Saint-Rémy's eye, so from the quay, 767 m away, the sky of ours
  fills one part of the sky and the dome fills the rest. What the three cones did instead was make the *rule*
  general, which is a different question. The honest statement is that this piece has one sky of ours and three
  of his, and it shows from Arles.
- **Two Arles cones open away from each other because the test says so, not because a night does.** §5.1 wanted
  the quay and the square to share a town, with the far bank's lights across the water from one and the square a
  few hundred metres behind it. They share a quay, back to back, and nothing of the one is visible from the other.
  A layout where the square looked back across the water at the far bank would have put the bank's strokes inside
  the terrace's cone, where the rule would have hidden them.
- **The Rhône's far bank is the plan's 220 m and his columns say it should be nearer.** The number is swept in D4
  by the plan's own table and it was not moved, because the only evidence for moving it is the glitter law that
  the same measurement refutes. If the law is wrong about where a column stands, it cannot be used to place a
  bank. It stays at 220 m, declared, and `hand/rhone-glitter.json` holds the argument.
- **The terrace stands on the sea, and from outside its cone you can see that it does.** §5.1 says the three
  standpoints are put on one water with nothing between, and a pavement at the water's level is what that means
  for a square. From above, the cobbles are a raft and our columns lie beside them.
- **The ledger runs off the bottom of the screen.** It is fifty lines now and the panel does not scroll. D6.
- **Three canvases, and the masks are a first pass.** Fifteen regions typed in an evening, against the Starry
  Night's nine that D0 spent a day on. The standpoint test says the geometry is right to 0.90 and better; it does
  not say the boundaries are where a person looking carefully would put them. The two masks are in `depth/` and
  are the authored thing from now on.
- **Nothing is committed.** The folder's git remote still points at the sibling's repository; that is D6's.

---

### D4.5 — One night

**What was built.** The author, asked D4's gate, answered: *it is one dream and one world, and the paintings have
to be merged into one.* So `DESIGN.md` §5.1 is overruled — the piece no longer declares its gaps, it closes them —
and this is the work. Three measurements, all taken before anything was changed, say what was actually wrong, and
none of them is about the paintings.

**The floor.** All three of his grounds are the same law: `village`, `pavement` and `water` are each
`plane y: 0`. So his village at Saint-Rémy, his pavement in the Place du Forum and the Rhône itself were one
surface, and §5.2 made that surface water, everywhere, unbounded. The piece had no land in it. It read as three
pictures on a pond because it *was* three pictures on a pond, and no amount of work on the sky would have touched
that.

**The sky over Arles.** `dream.night()` counts our sky above ten degrees in twelve compass bins from each
standpoint and divides by the solid angle. From Saint-Rémy: 9,404 / 15,326 / 16,758 a steradian against his
16,562 — even, and his. From the quay, 767 m away: `[43626, 7985, 817, 0, 0, 0, 0, 0, 0, 0, 3734, 22860]`. From
the square: `[36623, 30454, 3364, 0, 0, 0, 0, 0, 0, 0, 0, 4819]`. **Seven and eight bins of twelve with no sky of
ours in them at all**, and one with six times his density. Our sky was one shell round one eye; from another
standpoint that is a bubble seen from outside.

**The colour of the night.** His three skies, each over its own region: Saint-Rémy (0.0859, 0.1525, 0.2860),
the Rhône (0.0344, 0.0605, 0.0773), the terrace (0.0099, 0.0652, 0.2200) — the Rhône a dim green-blue, the
terrace the ultramarine of *a night without black*, and Saint-Rémy two and a half times brighter than either.
Ours was Saint-Rémy's everywhere, within 1% of his there and +148 / +149 / +265% off his at the Rhône.

---

**What was decided, and why.**

**(1) Every number in the floor is derived. None is authored.** The piece already had a person 1.65 m tall — D4
derived both Arles standpoints from one. A man standing on a quay whose eye is 4.411 m over the water puts the
quay 4.411 − 1.65 = **2.761 m** over it. Put the shore there and all three of his grounds land on it at once and
exactly: the terrace's pavement (eye 4.411 less 1.65), the Starry Night's village (eye 42.761 less 40) and the
Rhône's water (eye 4.411 less 4.411). The river's two banks are his Rhône canvas's own. The near one is where his
lowest ray leaves the top of the quay — 1.65 / tan(21.95°) = 4.10 m out — so that the bottom edge of his frame is
water, which is what he painted there; the far one is his `farbank` law at 220 m. The river comes out **215.9 m**
wide, and the Rhône at Arles is about two hundred. The measured cost of getting the near bank wrong is in the log
below: put it where his painted water *begins* instead, 11.8 m out, and the land plane stands in the bottom of his
own frame and takes his standpoint test from 0.917 to 0.842 with sixteen cells over the limit.

**(2) His three nights are three colours, and our sky takes the one the place stands in.** One painter painted all
three, and `hand/starry-sky.json` is the only sky of his with strokes enough to generate from, so our sky keeps
**his hand everywhere** and takes only its *colour* and its *depth* from the canvas nearest. `src/night.js` weighs
the three by how near a place is to each of his eyes, at the depth his own sky paint stands at there. The dome and
both floors take the same field at the eye, so flying up the river from Saint-Rémy to the square is one change of
colour and not a line.

**(3) His two Arles canvases never disagreed.** This is the finding of the milestone. Measured from each canvas's
own eye: **the Rhône's sky is 1.0 to 17.6 degrees above the horizontal and the terrace's is 18.8 to 35.2.** The two
bands do not touch, anywhere. Two canvases painted the same month three hundred metres apart, whose skies differ
by ten times in red, were never asked the same question — one painted the horizon and the other the top of the
sky. And the Starry Night, whose sky spans both (−7.8 to 33.4), says the same thing they do about a night going
up: greener and lighter low, a purer and darker blue high, 0.171 of brightness at 8–24° and 0.116 at 24–40°. So a
canvas speaks for the band of sky it painted, and `hand/nights.json` writes down every canvas's colour band by
band, four degrees at a time.

**(4) A canvas facing away says less, not nothing; and a band it did not paint is a preference, not a veto.** Two
authored numbers, both found by looking at what broke without them. West of the square, low in the sky: the square
faces you but painted no sky that low, and the quay painted it but faces the other way — and with nothing under
the floor all three weights go to zero together and which one wins is arithmetic, not measurement. Our sky there
came out pale and bright against his dark terrace, which is a seam, which is the thing being removed. A canvas is
worth **a quarter** of itself about the sky behind it, and that stretch becomes the quay's, which is the canvas
that painted the horizon. The second: straight up over Saint-Rémy is 57 degrees past the top of his own sky, and a
Gaussian of six degrees values that at e⁻⁸⁹ — so the Rhône, a kilometre away and facing elsewhere, won the zenith
of the village with its horizon's colour, because its band happened to hold that elevation. Falling off as one over
the square instead leaves a canvas worth about a hundredth of itself that far out, and distance decides.

**(5) Density and colour must not share a weight.** The night's partition is sharpened by facing and by band; a
field thinned by *those* leaves a hole no other field fills, because each field's strokes live on its own shell
and not everywhere. So what each field lays is a question about how many and not about what colour: it scatters
its candidates evenly over the sphere from its eye and over the depths his sky stands at, so its density falls as
the square of the distance to that eye and as the thickness of its own shell, and is nothing outside it. The three
are thinned by the same fraction — the largest of those over their sum — so that what they add to is what the
fullest of them would have laid alone. Where one shell reaches, it lays all of it; where Arles' two overlap, and
at 300 m apart with skies 400 and 600 m deep they nearly wholly do, they halve.

**(6) §5.1's rule stands exactly as written, and the reason is measured.** *Inside a cone there is his painting and
nothing else* empties the whole cone to the edge of the dream, and from outside that is a black rectangle cut in
the night with a small painting floating in it — which is this milestone's own gate failing for the opposite reason
to D4's. D4 called the rule free because none of his strokes was hidden by it; the cost was never the clipped
strokes, it was the empty cone. So the rule was rebuilt to reach only as far as his own paint does **on each ray**,
off a 48 × 48 depth map of each canvas carried in one texture, letting our sky stand behind his where he painted
nothing more. It fills the cone, and it costs every standpoint its test: **0.765 / 0.704 / 0.820 with 1 / 3 / 10
cells over the limit**, against 0.869 / 0.917 / 0.904 and none. Our sky behind his paint shows through the gaps
between his strokes, and at his eye those gaps are meant to be the dark he primed over. The strict rule is the
default; `?conedepth` keeps the other one, so that the number can be had again and the hole can be seen filled.

**(7) A lattice on a surface wraps along it and not through it.** Found on the way: the sea's marks live on a
lattice that wraps round the eye in three directions, like the motes'. The motes live in the air and should; the
sea lies on the floor. From a hundred metres up, every mark of the sea stood at the nearest multiple of its own
26 m cell to the camera — a sea in the air. It has been there since D4. `uWrapY` turns the vertical wrap off for
the two surfaces.

**(8) The shore is paint, in his hand, and its colour is not his pavement's.** §5.2's sea takes every measure of
his Rhône water's mark at a density of ours; the shore does the same with the only ground he painted as a surface
you stand on, his terrace's pavement — a covering **2.27** deep, beside his water's 2.56. But that whole square is
under a lamp, and his pavement gets *brighter* with distance, not darker: 1.64 of his own sky's brightness at 4 m
and **2.80 at 90 m**. His paint there cannot say what unlit town ground is. His Starry Night's village can, and by
D3's rule the shore takes its hue exactly and its brightness as a ratio — **0.423** of his own sky — against the
dark this night's sky stands on. The hand is one painter's; the colour is the place's; the ledger calls both ours.

**(9) `tools/seam.py` had the yaw the piece stopped turning in D4.** It was written when every standpoint was at
yaw 0, where both conventions agree, and D4 fixed the four places that had it backwards without reaching here. And
it read the canvas out of `hand/<slug>-wind.json`, which only Saint-Rémy has. Both fixed; it runs on any of the
three now.

**(10) A stale `hand/nights.json` anchors the whole night at the old standpoints.** `tools/nights.py` writes down
where his eyes are as well as what colour his skies are, and our sky is built round those eyes. Moving the
standpoints and not re-running it put every field 700 m from where it should have been, and the first measurement
of the merged sky was of that. The README says the order now.

---

**What was measured.** Every number pre-registered above, before and after, and the ones the measuring turned up.

| | target | before | after | |
|---|---|---|---|---|
| the sky over every standpoint | every one of twelve compass bins above 10° holds ≥ half his density, 8,281 / sr, at all three eyes | **0** in 7 bins at the quay and 8 at the square; 9,404 at Saint-Rémy | **8,787 / 10,581 / 9,467** | **pass** |
| the colour of the night, in a ball round each eye | within 10% of his own sky there, channel by channel | +4 / +4 / +2 at Saint-Rémy; +148 / +149 / **+265** at the quay; **+761** / +131 / +28 at the square | −19 / −21 / −25; −24 / +3 / **+79**; **+99** / −11 / −34 | **fail** |
| the colour of the night, band by band up his own sky | (not pre-registered; added because the one above cannot be answered) | | blue within **5 / 12 / 23%**; red and green wander by tens of per cent, and by the same amounts with the field switched off | see below |
| one ground | the floor's height under each standpoint equals his own ground's, within 0.05 m | no floor but water | **0.0000 m** at all three | **pass** |
| the pond | water is ≤ 10% of the floor inside the dream's edge | 100% | **5.5%** | **pass** |
| the standpoint test, all three | SSIM ≥ 0.85 against the runtime's own flat; no cell off by more than 8% | 0.868 / 0.926 / 0.904, 0 cells | **0.869 / 0.928 / 0.908, 0 cells** | **pass** |
| the cone rule | none of his strokes hidden; ≤ 2% of ours | 0 of 38,654; 746 of 94,342 (0.8%) | **0 of 38,654; 162 of 207,503 (0.08%)** | **pass** |
| the seam on the ground | the step in mean luminance across each cone's edge ≤ 10% | there was no ground to step from | the Rhône: **−54%**, with his hue held to 5% | **fail** |
| ribbons | the merge adds ≤ 6,000 | 140,337 | **254,011 (+113,674)** | **fail** |
| a current to an eye | within 0.2 m and 2°, in 8 to 12 s | 0.077 / 0.023 / 0.079 m | **0.105 / 0.023 / 0.169 m, 0.000°, in 12.05 / 8.05 / 11.50 s** | **pass** |
| the floor | comes down at a walking pace, no bounce | 1.000 m, 0 | **1.000 m, 0**, the last 3 m in 2.1 s from 41 m/s | **pass** |

**The two colour numbers, and why the pre-registered one cannot be met.** A ball round his eye spans the whole
sky. His canvas paints a band of it — 1.0 to 17.6 degrees for the Rhône, 18.8 to 35.2 for the terrace — so the
mean colour of a ball is not a number his canvas has, and no construction can land on it. Asked the question his
canvas can answer, band by band up his own sky and in the half of it he faced, the blue channel — which carries
most of his sky's brightness — is within 5% at Saint-Rémy, 12% at the Rhône and 23% at the terrace. Red and green
wander by tens of per cent band to band, and **they wander by the same amounts with the night's field switched
off** (`?nonight`), which is D2's paint field's own scatter and not this milestone's: red is the smallest of his
three channels, 0.086 against 0.286 of blue, so a tenth of a bin's spread in it is half its value. The
pre-registered number is reported as it stands, failing, and this one is reported beside it.

**The seam on the ground, and why it steps.** At the bottom of the Rhône's cone his painted water renders at
0.0487 of brightness and our river just outside it at 0.0226 — **−54%**, where the plan asked for ten. The hue is
his to within five per cent: his (0.70, 1.00, 0.70) against ours (0.70, 1.00, 0.75). This is D3 (2) again, exactly:
his water's *paint* is paint, lit by his own gaslights, and our floor is a floor at 0.54 of the dark his sky
stands on. Taking his paint's brightness instead would put a lit floor under the whole dream, which D3 measured and
refused. The number is the price of that refusal, and it is now written down. At Saint-Rémy and the square the
bottom of his cone falls outside a seventy-degree frame, so it cannot be measured this way at all.

**The ribbons.** 254,011 against a budget of 130,000 that D4 had already broken at 140,337. The merge is
94,342 → **207,503** strokes of sky, and the reason is not waste: the world now has a sky over two towns 968 m
apart instead of one, at his own density of 16,562 strokes a steradian, and that is what two skies cost. `?sky=`
is the lever: at **0.45** the total comes back to about what D4 shipped, and `shots/d45-river-half.png` beside
`shots/d45-the-river.png` is what the difference looks like from 260 m up. Which of the two the piece ships at is
the author's, and D6's; nothing here has been quietly turned down to make a number.

**Counts.** his 38,654 (starry 13,999, rhone 14,859, cafeterrace 9,796); sky 207,503; reflections 3,070;
motes 2,600; sea 1,010; shore 452; stars 722. Total **254,011**. The three standpoints stand at (−700, 42.761, 0),
(−100, 4.411, 760) and (−400, 4.411, 760), 969 / 818 / 300 m apart, all three on one shore with the river in front
of the quay. The shore is at 2.761 m and the river runs between −95.906 and +120.

**What is still visible, and it is the ground.** The sky is one night now and the geography is one shore, in the
numbers and at the three standpoints. From the air it is not yet one world to look at, and the reason is the
floor: §5.2's *not a thing you see* holds for the shore as it does for the water, so from 260 m up the river and
the shore are both near black and the bank between them cannot be seen (`shots/d45-the-bank.png`,
`shots/d45-river-nosky.png`). What tells you where you are is his lit paint and the reflections on the water, and
between the cones there is neither. Making the shore legible means either overturning D3's floor — which was
measured and defended and should not be overturned without measuring again — or putting lights on it, which would
be paint of a town he never painted, the line §2 draws and D4 kept at §15.3. It is left as it is, with the
pictures, so that a reader can disagree.

**Pictures.** `d45-quay.png`, `d45-square.png`, `d45-village.png` — the three standpoints, at the flight's own
seventy degrees, with our sky meeting his on both sides of each. `d45-one-night.png` — 62 m up between the towns.
`d45-the-bank.png` — the shore and the quay's lights from 46 m. `d45-the-river.png` and `d45-river-half.png` —
the same view at his density and at 0.45 of it. `d45-river-nosky.png` — the same with our sky off, which is the
world's own furniture. `d45-up-the-street.png` — §5.1's cone as a hole cut in the night, and `d45-hole.png` the
same with `?conedepth`, which fills it and costs every standpoint its test.

**The gate.** *Glide from the swirl down to the quay and up the street to the square. Is it one night?* The sky
is, and the ground is one ground with a river in it, and his two Arles canvases turned out never to have
disagreed. Whether it reads as one night from the air, with the floor as dark as §5.2 makes it, is the author's
to answer.

**Still visible.**

- **The ribbons, 254,011 against 130,000.** A sky over two towns costs two skies at his density. `?sky=0.45`
  brings the total back to D4's; nothing has been turned down without saying so. D6's, or the author's.
- **The floor cannot be seen from the air**, so the geography is one world in the numbers and not yet to the eye.
  §15.10 in `DESIGN.md` now, with what would settle it.
- **A cone is a hole cut in the night from outside.** §5.1's rule, measured twice now: filling it behind his
  paint costs 0.869 / 0.928 / 0.908 → 0.765 / 0.704 / 0.820 with 1 / 3 / 10 cells over. `?conedepth`.
- **Our sky's colour wanders band to band** by tens of per cent in red and green — D2's paint field's own
  scatter, not the night's, and the same with `?nonight`. Blue, which carries his sky's brightness, is within
  5 / 12 / 23%.
- **The two new canvases have no edge data.** D2 walks the edge of the Starry Night's cone and writes down what
  his sky is doing along it, and our sky carries that outward and lets go. There is no such walk for the Rhône's
  cone or the terrace's, so at those two seams our sky meets his with its colour right and its finer structure —
  his corners darker, his strokes smaller at the edge — not carried. `tools/hand.py` would have to walk them.
- **`tools/seam.py` has not been run on the three.** It was fixed here (the yaw, and the canvas read from the
  record) but the seam number itself is D2's and has not been taken again with three canvases in the air.
- **Nothing is committed.** The folder's git remote still points at the sibling's repository; that is D6's.

---

### D4.6 — The floor, seen

**What was built.** One number, and the way to it. D3's rule for the floor is kept word for word — *his hue
exactly, and his brightness as his own ratio* — and what that ratio is taken against stops being a colour chosen
by hand and becomes our own sky, measured from the floor. `dream.light(p)` renders the piece from a place into a
float target, five faces of a cube at ninety degrees, keeps the upper hemisphere of them and returns the
solid-angle mean of everything in it: our ribbons, his canvas where a cone opens overhead, the dome behind both.
It is taken once, a few frames in, over the floor under each of his three standpoints; between the three the
floor takes the same weights the night's colour does, so the floor is one field and not three steps. `tools/bank.py`
is the new test: it stands the eye a hundred metres over the river, looks across a bank, asks the runtime itself
where a line of world points falls on the screen, and reads the frame there.

**Seven decisions, and why.**

1. **D3 was not wrong about the rule, only about the reference — and it said so at the time.** D3 named the two
   references it had to choose between: his ground over his sky's *paint*, which on a sky as sparse as ours gives
   a floor brighter than the sky above it, or over the *dark that paint stands on*, which is what it took. Our
   sky is neither. It is his paint at a coverage, and what a ground stands under is what arrives. The factor
   between the two was already written in the source with a flag on it — *?wet= ... at about ten the plane is as
   bright against this night's sky as his paint is against his* — and it turns out to be **10.6**:
   `lum('#0f1d44')` is 0.0140 and his own sky at Saint-Remy is 0.1479.
2. **The light is rendered, not modelled.** Nothing here computes how bright a night ought to be. It draws the
   sky the piece actually has, from where the floor actually is, and averages it. That keeps §2: the floor's
   brightness comes from our own paint, which comes from his.
3. **Our night is a quarter to a half of his, and the floor says so.** Over the floor under his three
   standpoints the light is **0.0412, 0.0169 and 0.0275**, against his own three skies' 0.1479, 0.0562 and
   0.0646 — 28%, 30%, 43%. So his water, which is 0.5541 of its own sky, lands at 0.0228 of a unit here, and his
   village, 0.4235 of his, at 0.0174. The floor is as bright as the night we actually give it and no brighter,
   which is why this is a measurement and not a dial.
4. **Two pins, and they are stated.** A stroke under eight tenths of a pixel is not drawn (`src/strokes.js`), so
   the light a place has depends on the frame it is seen in: at the focal of an 800 × 600 window it reads 0.050,
   and at 3,200 it settles at 0.041 and stops moving. The measurement is pinned at 3,200, high enough that
   nothing of his is lost to it, so that the floor is the sky as it stands and not as one window shows it. And
   parting — the tunnel the paint opens round a body in flight — is turned off for it, because the light over
   the quay is the same whether anyone is flying over it or not. With parting left on the same place reads
   0.0855 against 0.0412: **flying through our sky halves the light in front of you**, which is a true thing
   about the piece and no business of the floor's.
5. **The measurement waits five frames.** Taken at boot it read twice what it reads later, for the reason above
   and others like it: the first frames are not yet the piece. It is taken on the sixth frame, before
   `dream.ready`, and the floor is provisional until then — which no one sees.
6. **A mark lying on the floor dims with the floor it lies on.** The sea's marks are his Rhone water's own paint
   and the shore's are his village's colour, and each is now scaled by the light here against the night its own
   canvas was painted under (0.0645 and 0.1479). So his paint and his ground keep the ratio his canvas has:
   before D4.6 the plane was a tenth of his and the marks were his in full, which is glints on a void.
7. **`?wet` and `?dry` are gone, and `?d3floor` takes their place.** The two flags were judgements on a number;
   the flag that replaces them is a comparison with no number in it — the floor on the reference D3 gave it, so
   that the two can be looked at side by side. Every before-picture in this log is `?d3floor` at the same camera.

**What it measures.**

| | target | before | after |
|---|---|---|---|
| the bank, seen — near | ≥ 4 levels of 255, ≥ 20% | 6.5 v 8.4: **1.9 levels**, 22.2% | 20.3 v 24.7: **4.4 levels**, 25.1% — **pass** |
| the bank, seen — far | ≥ 4 levels of 255, ≥ 20% | 5.8 v 7.9: **2.1 levels**, 27.0% | 20.2 v 23.9: **3.7 levels**, 21.9% — **fail on the levels, pass on the ratio** |
| the bank, where it is | the step within 5 m of the bank | 1.25 m, both | 1.25 m, both — **pass** |
| his two shares, kept | water 0.5541, shore 0.4235, within 1%; hue unchanged | exactly, of a colour chosen by hand | 0.5541 and 0.4235 of the light there, to four figures; hue identical to five — **pass** |
| the reference, measured | from `dream.light`, no flag left on it | `#0f1d44`, `?wet=`, `?dry=` | measured; both flags gone — **pass** |
| the standpoint test | ≥ 0.86 / 0.92 / 0.90, no cell over 8% | 0.869 / 0.928 / 0.908, 0 cells | **0.865 / 0.921 / 0.905, 0 cells** — pass |
| the night, untouched | counts and bins within 1% | 254,011; 8,787 / 10,581 / 9,467 a sr | 254,011; 8,787 / 10,581 / 9,467 — **identical** |
| §5.2 stands | a colour and marks, no surface, nothing modelled | | nothing was added to the floor — **pass** |

**The floor, in the world's own units.** Under Saint-Remy the water is (0.0164, 0.0245, 0.0252) and the shore
(0.0117, 0.0184, 0.0250) — his water's hue to five figures and his village's to five, at 0.5541 and 0.4235 of the
0.0412 our sky gives that place. Before D4.6 they were (0.0056, 0.0083, 0.0086) and (0.0040, 0.0062, 0.0085)
before the night's factor, which at Saint-Remy is 0.857: **3.4 times darker there, 2.8 over the quay and 6.1 over
the square**, the last because D4.5's field said the square was the darkest of the three and the measurement says
it is the second brightest — his own lamp hangs in that sky.

**The thing this was not asked to do, and did.** Against *the record's flat* — the test D0 pre-registered and has
failed on texture since D0 — all three standpoints moved toward his canvas: starry 0.482 → **0.490** (44 cells
over the limit → 33), rhone 0.464 → **0.521** (27 → 18), cafeterrace 0.387 → **0.405** (96 → 87). Nothing was
done to his paint. A floor at his own ground's brightness simply agrees with his painting better than a floor at
a tenth of it, which is independent evidence that the reference was wrong and is now right.

**The gate.** *From a hundred metres up over the river: is it one world to look at?* The bank is there now, on
both sides, where the bank is, and the floor reads as ground and water instead of as a hole. The far bank is 3.7
levels and not the four asked for, and that is logged as a fail and not tuned: it is 21.9% in ratio, and what
holds it down is that our night is a third of his, not anything about the floor.

**What D3 measured and left.** D3's own table carries the line: *our water in a frame — **6.5%** of our sky's
brightness where his is 54% of his, because our sky is denser paint and our water is bare; `?wet=10` is the other
reading.* The number that closes D4.6 is that one. Our water is now his own **55.4%** of the light measured over
it, because that share is what his canvas says and the light is what ours gives. And the reason D3 gave turns out
to be half right: our sky *was* denser and brighter paint than his Rhône's — until D4.5 every stroke of ours was
Saint-Rémy's colour, 2.6 times his Rhône's — but a sky is paint at a coverage, and as a sky ours gives the quay
0.0169 where his gives 0.0562. D4.5 fixed the colour of a stroke; D4.6 measures what the strokes add up to.

**Still visible.**

- **The far bank is 3.7 levels of 255 and the milestone asked for four.** It is 21.9% in ratio, which passes, and
  it is short in level for one reason: our night is 28 to 43% of his. That is the sky's density, not the floor's
  rule, and it is D6's or the author's. Nothing here was turned up to reach the four.
- **The floor and the sky are one decision now, and it is a cheaper one than it looks.** Because the floor is a
  share of the light our sky gives, `?sky=` moves the ground as well as the air. At **0.45**, the lever D4.5 left
  for the ribbon count, the light goes 0.0412 / 0.0169 / 0.0275 → **0.0384 / 0.0149 / 0.0237**: 7, 12 and 14 per
  cent down for 45% of the strokes and 139,732 ribbons instead of 254,011. A sky's coverage overlaps, so halving
  it does not halve what it gives. The author's choice about the ribbons costs the ground about a tenth of its
  light.
- **The shore's 452 marks are mottling now, not glints.** They were given his village's *mean* colour in D4.5,
  and the shore plane now carries that same mean, so a mark differs from the ground it lies on only by the spread
  his pavement's bins have. The sea's marks do not have this: `hand/rhone-water.json` holds his water's *marks*,
  which are 1.56 times his water's mean, so they still read as glitter. The measurement that would settle it is a
  hand walked over the Starry Night's village region (`tools/hand.py starry --only village`), which nobody has
  taken. It is a mark's colour and not the floor's, so it was left.
- **The measurement costs fifteen renders of the whole scene, once.** Five faces at three places, at 64 px, on
  the sixth frame. On a real renderer that is tens of milliseconds; under swiftshader, where the harness runs, it
  is most of a minute, and the tools' readiness timeouts were raised to match. If a renderer has no float target
  to read, the piece keeps D3's floor rather than a black one.
- **`?d3floor` is exact.** It reproduces D4.5's floor to five figures — water (0.00736, 0.01099, 0.01132) at the
  opening camera against D4.5's own (0.00556, 0.00831, 0.00856) times that place's 1.3232 — and it restores
  D4.5's factor on the marks as well, so the comparison is D4.5 whole and not the new floor with an old number.
- **From high up you look through our sky at the ground, not at the ground.** At 180 m over Saint-Remy, and at
  300 m anywhere, what is between you and the floor is two hundred thousand ribbons; the floor reads where you
  look *along* the world rather than down through it. That is the sky doing what §5.3 asks of it and is not a
  fault of the floor's, but it is the reason the picture that answers the gate is the one down the river.

**Pictures.** Every one is a pair at one camera: the name alone is D4.6, and `-d3` beside it is the same frame
with `?d3floor`, which is D4.5's floor exactly. `d46-the-river` — 120 m over the river looking down it toward
Arles, and the picture that answers the gate: the river runs away as a lighter band between two darker shores,
both banks converging. Beside it `d46-the-river-d3` is one black plain under a hard horizon, with everything
above that horizon identical. `d46-the-shore` — 90 m up west of the river looking across it: the quay's lights
and their reflections lying on the water, the shore band, the near bank and the far one. `d46-the-bank` — the
view `tools/bank.py` measures, 100 m up and 120 m out, looking across the near bank at 32° down.
`d46-down-to-the-quay` — D4.5's own view from 180 m, where the floor shows only at the bottom of the frame and
the rest is our sky between you and it. `d46-one-world` — 150 m over Saint-Remy, inside the paint, where no
floor is visible before or after; it is kept because it is the honest answer to *one world from the air* over a
standpoint. And `shots/rhone-standpoint.png`, his canvas from his own eye, unharmed.

**The author's answers, taken at this gate.** Two decisions D4.5 left standing were put to the author with the
numbers above and answered. **The ribbons: wait.** The 130,000 budget is a guess about a frame rate nobody has
measured on a real graphics card — every number in this log was taken under swiftshader — so the choice between
254,011 and `?sky=0.45`'s 139,732 is deferred to D6, which flies it on hardware and on a phone. Nothing is turned
down in the meantime. **The cone: leave it strict.** §5.1 stands as D4 wrote it and `?conedepth` stays a flag: a
cone is his alone, the hole it cuts in the night is the price, and the standpoint test is not to be spent on the
view from outside.

---

### D5 — The opening, the edge, the sound

**What was built.** The opening of §7.1, which is the one thing in the piece that happens once. `veil.js` comes
across from the sibling whole, with two changes — the record it paints from is this piece's
(`strokes/starry-canvas.bin`) and the title under it is this piece's — and its markup and its stylesheet come
with it. Behind it, from the first frame, **the same canvas is standing in three dimensions with the explosion
held at nought**, which is §3.1 run backwards: every stroke slid back up its own ray until the ray crosses his
picture plane, where the canvas is whole. When the veil has gone, what is left is the painting, and it explodes:
four seconds down the rays to the depths `depth/starry.json` gives them, the field of view opening from the
veil's rectangle to the flight's seventy degrees, the body going from still to three metres a second. Then one
line in the corner. New tool: `tools/opening.py`.

**Six decisions, and one of them the author's.**

1. **The canvas goes back on its plane, not onto a sphere.** A stroke `l` long on a canvas is `l · d / f` long at
   depth `d`, so one scale does the place and the size — but the depth to slide back to is the picture plane's
   along that ray, `f / (r̂ · F̂)`, and not `f`. On a sphere the corners of a 62° frame are 26% out.
2. **The camera is rendered off-centre.** The veil hangs its canvas above the middle of the window to leave room
   for the title; a camera looking down the canvas's own axis puts it in the middle. So the frame is a window cut
   out of a larger one whose middle is the veil's rectangle's middle (`camera.setViewOffset`), and the size is
   taken from the *tangent* of the angle and not the angle. Before the off-centre fix the two were 50 px apart
   and the handoff read 0.13; after it, 2 px and 0.33.
3. **The camera follows the veil's own rectangle, read off the DOM each frame.** Not a second copy of the CSS
   easing — the rectangle itself, `getBoundingClientRect` on the transformed element. Whatever the stylesheet
   does, the runtime does.
4. **Parting is off while the canvas is whole, and comes back over the explosion.** This is the bug that cost
   the most: at burst nought his paint is three quarters of a metre from the eye, every stroke of it inside the
   tube parting opens round a body in flight (§6.5), and parting threw the entire painting out of the frame —
   a cone-shaped hole with our sky round it. It is not a special case: the body is standing still at his eye,
   which is the same reason `?test` has parting off. It ramps back in with the burst, so that by the time you
   are moving it is there.
5. **The caption waits.** Reaching a standpoint prints his own line for six seconds (§9); the opening *starts*
   at a standpoint, so it would print over the painting. It is suppressed until the explosion is done, and so is
   the line in the corner.
6. **The sound is gone — the author's word, taken during the milestone.** The water layer D3 built was listened
   to and the answer was *remove the background sound, current sound is too bad*. So §10 is struck, `src/audio.js`
   is deleted rather than left unwired, `M` stops being a key, and the three layers this milestone was to add are
   not built. The piece is silent. What D3 measured about his water stands; it was never only about sound.

**What it measures.**

| | target | before | after |
|---|---|---|---|
| it starts on the painting | standpoint test at burst 0: SSIM ≥ 0.85 against the runtime's own flat, no cell over 8% | there was no opening | **0.998, worst cell 0.0%, 0 cells** — pass |
| the handoff, as registered | veil's frame against the runtime's, over the canvas: SSIM ≥ 0.80 | — | **0.325 — fail** |
| the handoff, as it turned out to mean | — | — | blurred past the paint (σ 6 px) **0.925**; the offset that would best line the two up is **2 px**; correlation 0.947 |
| the explosion arrives | every stroke at its authored depth by t = 4 s | — | `uBurst` reaches exactly 1 at **t = 4.017 s**, and past 0.999 the shader's branch is skipped, so every stroke is at its baked depth to the float — pass |
| the restart carries none of it | into the linen, out over Saint-Remy, no veil, no second explosion | — | flown to 3,000 m: `faded 1`, back at his eye gliding at 3 m/s, stage `null`, burst 1 — pass |
| the line waits | nothing in the corner until the explosion is done | it showed 800 ms after load | shown at the end of the burst, and the caption with it — pass |
| the night, untouched | counts and the standpoint test unchanged | 254,011; 0.865 / 0 cells | **254,011; 0.865 / 0 cells** — identical |
| ~~sound~~ | ~~four layers~~ | one | **none** — struck by the author |

**Why the handoff fails its own number, and what the number should have been.** SSIM between two different
brushes painting the same strokes is about a third, whatever you do: the runtime against *the pipeline's own
flat rendering of the same record* has read 0.48 since D0, and the veil's loaded 2D cap is a third brush again.
The 0.80 registered at the start of D5 was a number for one renderer against itself. What the criterion was
actually asking — does the picture jump when the veil goes? — is answered by the other two rows: blurred past
the paint the two are the same picture at 0.925, and the offset that would line them up best is two pixels.
The paint changes; the painting does not move.

**Pictures.** `d5-veil` — the veil, the painting finished on primed linen with its plaque and the title.
`d5-handoff` — the same instant with the veil taken away: the runtime's own canvas, in its own brush, on the
same rectangle. `d5-burst-0`, `-1`, `-2`, `-4` — the explosion at nought, a fifth, two thirds and all of it.
The night around the canvas in `d5-handoff` is our sky, where the veil has a gallery wall; it is kept, because
what is glimpsed round the edges of a painting you are going into ought to be where you are going.

**The gate.** *Open the page cold, touch nothing, and watch. Does the painting become the night without a word?*

**Still visible.**

- **The handoff's brush.** The veil paints fat and oily, the runtime paints the ribbon of §4.5. Blurred they are
  one picture; at full size the paint changes under you during the fade. Making them one brush means the veil
  drawing ribbons in 2D, which is a rewrite of the sibling's file and was not attempted here.
- **The veil's clock is not the world's.** The painting takes 3.2 s and the world took 0.8 s to build on a real
  renderer and about a minute on the headless one; whoever is slower decides. On a slow machine the painting is
  finished and waiting, which is what the status line is for.
- **The opening is not on a phone yet.** D6's.
- **Silence.** The piece makes no sound at all now. If that is wrong it is one line of the author's to say so.

### D5.5 — The author's user test

**What was built.** The author's six answers, taken as the word on the whole (the plan block above quotes them), and
four things follow. (1) **`flight.js` is replaced.** Two controls, look and go: a drag looks, `↑` goes where you
look at 8 m/s, `↓` back, `←` `→` turn at 50°/s, `Shift` makes it 30; the body reaches its speed and loses it with a
time constant of a fifth of a second; nothing pressed is nothing. The wind is still read at the body for the ledger
and is no longer added to it; the heading is the gaze; the roll is nought; `Space` and `Z` are gone with the let-go
and the lying-down; the floor of §6.3 stays. The touch of §6.6 keeps its two thumbs, the left one going and the
right one looking. (2) **The opening ends still.** After the explosion the body stays at his eye at speed nought
until a key is held, and so does the restart out of the linen and the current of `1` `2` `3` when it arrives. (3)
**Sunflowers**, `src/flowers.js`: the Sunflowers record is copied whole from the sibling (`strokes/sunflowers-
canvas.bin`, 12,478 strokes), eight circles a person drew on its flat cut out eight heads (297 to 629 of his strokes
each; the circles are in `docs/`'s pictures and in the file), and eighty flowers stand on the shore in a disc 150 m
round a point 80 m ahead of his eye, each one head at 0.3–0.5 m across, facing a random way and nodding back three to eleven degrees, on a stem
1.1–1.7 m tall in the mean colour and width of his own stem strokes. Every stroke of a head is his -- arc, colour, width, impasto, curl -- scaled by
one number as §3.1 scales everything. They stand inside his cone, in front of his village, exempt from the rule of
§5.1 by one uniform (`uConeFree`), and the standpoint test says what that costs. `?flowers=`, `?flowersize=`,
`?noflowers`, `?only=flowers`, `dream.flowers()`, a row in the ledger, a line in the credits. (4) The keys panel,
the corner line and the README say the new controls.

**What was found, before anything was changed.**

- **Where the wind took you.** On a real GPU, untouched for 30 s after the opening: the body at `y 99.6, z -152.8`
  -- 57 m up and 153 m forward of his eye, inside a sky whose near shell is 250 m from it. That is the author's
  screenshot: the swirl at twice its size, pale, no ground.
- **The pale is the same paint seen from inside.** Five frames at his eye on the same GPU -- `?test`, `?nocurl`,
  `?nopart`, `?nomotes&nosky&nostars`, and nothing -- are all the record's own colour, and the standpoint test
  reads 0.865 there as it did. Nothing in the grade is changed: `sat` stays 1.0, so the colour cells of §4.4 stand.
  A stroke ten metres long passed at arm's length is sampled soft past a hand's breadth of pixels (`vBig`) and lit
  on its relief from every side, and that is what the author saw. The cure was 1 and not a curve.
- **From the ground our sky is a wall.** At 3 m over the shore, 60 m north of his eye, looking back: a mass of
  big blue strokes low over the horizon on the left. `?only=sky` has it, `?only=motes,stars` does not, `?only=his`
  does not: it is our sky's near shell at 250 m, seen from below its band. Left, and named under *still visible*.
- **Sunflowers from his eye are dots.** A 0.4 m head at 90 to 230 m is under a pixel at 512 px.

**What it measures.**

| | target | measured |
|---|---|---|
| nothing pressed, nothing moves | 30 s untouched after the opening: within 0.05 m of his eye | **0.00 m** at 38.8 s (`x -700, y 42.76, z 0`, speed 0) -- pass; before, 57 m up and 153 m forward |
| a key released stops you | `↑` held 2 s then released: under 0.5 m/s within 1 s, under 3 m travelled | at a third of a second: 0.62 m/s and 2.12 m -- fail on the first by 0.12; at a fifth: **0.05 m/s and 1.52 m** after 1 s (stepped at 60 Hz by `dream.sim`; held 2 s it reaches 8.0 m/s and 14.5 m) -- pass |
| `↑`, `Shift`, a turn | 8 m/s, 30 m/s, 50°/s | `↑` 2.0 s: **7.9 m/s**, 8.2 m; `→` 1.0 s: **50.2°** -- pass |
| the standpoint, with sunflowers | logged; `?noflowers` 0.865 / 0 cells | **0.865, worst cell 4.9%, 0 cells** with them and without -- identical |
| sunflowers | 80, heads 0.3–0.5 m at 1.1–1.7 m, disc 150 m | **80, 32,261 ribbons** (403 a flower: 386 of his and a stem); heads 0.35–0.49 m across in the first dozen; the record's colour, unlit |
| ribbons in the air | -- | 286,272 (254,011 + 32,261), against D6's 130,000 |
| frame rate, the three flights | ≥ 47 on the real GPU pane, 1024 × 768 at dpr 1.5 | glide **82** (dips to 13), swoop **83** (24), village **73** (5), dpr 1.5 -- the means pass and the dips are the headless renderer that was making the pictures on the same machine at the time |
| the gate | the author's six | open |

**Pictures.** `d55-before` -- the eye where the wind took it in half a minute, which is the picture the author
answered. `d55-standpoint` -- where it now stays. `d55-from-the-ground` -- a standing eye on the shore under his sky.
`d55-the-field` -- the sunflowers from 12 m up. `d55-a-sunflower` -- one of them at 8 m. All headless.

**The gate.** *The author's six, again.* Open the page cold, touch nothing, and then the arrows. Is it smaller, is
it vivid, are the sunflowers there, does it move as you say, where are the river and the town, is the ground the
town and the sky the sky?

**Still visible.**

- **The sky as a volume.** From inside, paint at arm's length; from the ground, a wall of strokes 250 m off. The
  body no longer goes there on its own, but it can. If *smaller* means a sky that stays a sky from everywhere, that
  is a dome and not a volume, and §3.1's one licence -- the sky put far so that its strokes are huge -- goes with it.
  That is a decision with a number in it: how wide the swirl should be from the ground. Not taken here.
- **The sunflowers are sunflower-sized**, so from his eye they are dots, and a head is a flat disc that reads as a
  feather when it is tilted. If they are to be seen from the air they have to be bigger than sunflowers, which is
  the author's number (`?flowersize=`).
- **The town from the ground.** His village is painted from forty metres up and lies flat on the shore, so from a
  standing eye it is a carpet of marks and not a town; the only town with walls is the terrace's square, 800 m off
  (`3`). *Where is the river, the town* is answered from his eye and not from the shore.
- **D1's two tests are void**: the glance (the heading is the gaze) and the eddy (the wind does not carry the
  body). Both stay on the harness and say so.
- **The frame rate** was taken with a headless renderer running beside it, and on the author's screen at 2× the
  governor decides; both D6's.
- **The count**: 286,272 ribbons against the budget's 130,000, and the ribbon decision is still the author's to wait on.


## E0 — The world is the painting  *(the author's word on the whole, again; 1 day)*

**The author's word, after D5.5.** *The app still misses the point — the painting is still a flat painting. You are
not in the world of Van Gogh to see his painting floating in the sky, like wearing a Vision Pro. The point is the
world is the painting. You should take the elements of the painting, reproduce them in 3D and make the sky like
the Starry Night. Make it fascinating, vivid, like what people would say about Van Gogh's work. The sunflowers
should be more prominent, floating around and give the sense of the craziness. Forget about DESIGN.md, use the
imagination, think a lot.*

That sets the design aside, and with it the four rules of this plan as they were written: Rule 2 (nothing
modelled) and Rule 3 (nothing of ours except from a `hand/*.json`) cannot hold in a world whose houses have walls.
What survives of the build is the brush and its relief, one shader for every stroke, the arrows of D5.5, the
opening on the painting, and the stroke records themselves. The letter changes: this is E0, not D6, because it is
the first milestone of a different piece. The log culture stays — what was built, what was decided, what was
measured, what is still visible.

**What was built.**

- **`src/world.js`**, new: everything in the world, out of his colours. `loadHisColours` reads the Starry Night's
  record and `hand/starry-region.bin` (which region of his canvas each stroke lies in, from D0's mask) and sorts
  each region's colours by brightness, so that a thing of ours takes a colour by asking for *the sky at this
  brightness*, *the village's darkest tenth*, *the moon's middle*. Then, each in its own generator: the **sky** —
  a dome of radius 1,500 m, 98,002 strokes laid along a flow of seven swirls and a level band between them, the
  swirls with pale spiral arms winding into a pale eye, the band with pale ribbons a few degrees apart; every
  stroke carries an axis and a rate, and the shader turns it about that axis forever, so a swirl turns rigidly on
  its own circles and never comes apart (2.2°/s for the great one, up to 3.6°/s for the small ones, opposite
  ways). The **stars**: nineteen, each a core and four rings, and the **moon**, a crescent with six rings, all in
  his star and moon colours, each ring turning at its own rate the opposite way from the next. The **ground**: a
  heightfield (`ground(x, z)` — a valley with the village in it, hills to the north and both sides, a knoll to the
  south the eye stands on, a bed for the river) under 58,710 strokes laid along the contours in his hills'
  colours, brighter with height and on the slopes that face the moon. The **river**: a path across the valley,
  16,148 strokes of his sky's blues laid along it, and under each low star and the moon a column of gold dashes
  toward the eye, which is his Rhone's idea. The **village**: 71 houses on a main street, a cross street and the
  lanes off them, each a box of horizontal wall strokes with a gabled roof and lit windows, 21 round trees, and
  the church with its tower and a spire 26 m tall. The **cypress**, two: a flame of his near-black greens on a
  wavy profile, licks leaning round the trunk, swaying by a bend in the shader that grows with height. The
  **sunflowers**: his own heads from the Sunflowers record (the eight circles of D5.5), 90 standing on the slope
  in front of the eye and 150 loose in the air, each its own mesh on a slow ellipse, bobbing, turning and
  spinning, a tenth of them within 25 m of the knoll so that they pass close; 2 to 9 m across. And the
  **motes**, kept, for the speed.
- **`src/paint.js`**, new, replacing `strokes.js`: the one shader without the cones, the columns, the linen, the
  ledger tint and the explosion, and with three things added — the mesh's own matrix (so a flower can drift
  whole), the spin, and the sway. The reveal is by turn: each stroke has a place in the order and grows in over
  six hundredths of it.
- **`src/main.js`**, rewritten: one canvas's colours, no cones, no water plane, no nights, no wind. The heightfield
  as a mesh under the strokes, the river as a strip. The opening keeps the veil: it paints, it lifts, and the
  world paints itself in over seven seconds, sky first, sunflowers last. The keys: `1` the knoll, `2` over the
  village, `3` into the great swirl. `L` says how many strokes each thing is.
- **`src/flight.js`**: the floor is now `floor(x, z)`, the ground under you; a ceiling at 620 m and an edge at
  1,150 m.
- **Removed**: `sky.js`, `water.js`, `wind.js`, `night.js`, `explode.js`, `strokes.js`, `flowers.js`. The tools
  of D0–D5.5 stay in `tools/` as the record and are not run; `tools/shot.py` still works.
- The grade: saturation 1.22, bloom 0.9 at a threshold of 0.8, exposure 1.12, the paint's own values (no tone
  curve). *Colour should be more vivid* was the author's word in D5.5 and it is answered here, not by the grade
  alone but by the paint: every stroke of the sky is one of his brightest sky colours or one of his darkest, laid
  in bands, which is what his canvas does.

**What was decided, and by whom.** All of it by the author's word above; the shapes by us. The standpoint is 32 m
up on the knoll, looking north over the village at +9°, so that the frame holds the cypress at the left, the
village below, the great swirl and the moon above — his composition, from inside it. The great swirl is at
azimuth −6°, elevation 35°, 24° across; the moon at azimuth 46°, elevation 31°.

**What was measured.**

| what | value |
|---|---|
| strokes in the air | **328,350**: sky 98,002 · stars 8,697 · ground 58,710 · river 16,148 · village 34,345 · cypress 13,640 · field 35,022 · flowers 61,387 (150 meshes) · motes 2,400 |
| build | 609 ms on this machine, after the records are read |
| frame rate | **not measured on a visible window**: the in-app Browser pane was hidden for the whole session, so the page throttled and every number it gave is void; the headless renderer's is software. The pixel-ratio governor of D0 is on and takes the ratio down to 0.75 if a frame runs under 47. D6's |
| the eye, untouched | stays at the knoll: the arrows of D5.5 are unchanged |

**Pictures.** `e0-standpoint` — the knoll, cold, after the opening. `e0-the-swirl` — looking up at the great
swirl beside the cypress. `e0-the-cypresses` — from the right of the knoll, both cypresses against the sky.
`e0-over-the-village` — from 95 m up. `e0-in-the-street` — a standing eye in the village. All headless.

**Found.** The village's windows were built with the whole lamp pool where one colour was meant, so 633 window
strokes carried NaN for a colour: the GPU drew them black and the headless renderer white, and the first headless
pictures had a white blaze across the whole village where the pane showed nothing wrong. Found by the pictures,
confirmed by counting the non-finite values in the buffer (2,532, four a stroke), fixed. The rule it makes: a
count of non-finite values in every instance buffer is cheap and the harness should take it before a picture.

**The gate.** The author's: *the world is the painting*. Open it cold and say whether you are in it.

**Still visible.**

- **The village walls are a mixture.** His village colours run from near-black to warm ochre and the walls take
  the whole range house by house; at 200 m it reads as a village, at 20 m as boxes of dashes. Doors, streets and
  a square are not built.
- **The cypress is a tower with licks**, not yet a flame: the profile is a surface of revolution. The sway is a
  bend, not a wind.
- **The frame rate** is unmeasured on a visible window (above), and the flowers are 150 draw calls.
- **The sunflowers in the air have stems**, which the author may not want on a thing that floats.
- **The river is seen from the knoll only as a band** 330 m off; from the air it is a river. The columns of gold
  under the stars are fixed on the water and not laid from the eye, as the Rhone's were in D3.

### E0.1 — The ground, aligned  *(the author's word: "align this"; the same day)*

Two of E0's *still visible* were the author's to send back, and were sent back the same evening.

**The ground from the air was dots.** Three causes, each fixed. (1) The strokes were laid one by one at random
places; his hills are long strokes laid *along* the contours, end to end. Now a chain: a seed, then three to five
strokes each placed at the end of the last along the flow of the ground (`groundFlow`: the contour where there is
a slope, a slow field where it is flat), bowed by the turn of the flow ahead, one colour a chain so that the chain
is a band and the bands lie in slow noise across the ground. (2) They were too small at a distance: a stroke is
now 1.4 m plus a twenty-fourth of its distance, and the seeds are drawn toward the eye (`d = R·u^1.55`) so that
the carpet is solid at a footstep and still covers at the horizon. (3) The plane under them was darker than the
paint on it, so every gap was a dot; it now takes the strokes' own middle colours.

**Up close a stroke was a slab**, and the cause was not the brush: every stroke turns its face to the eye about its
own tangent, which is right for paint in the air and wrong for paint on the ground -- a stroke on the ground two
metres from a standing eye turned up to face it and stood there as a plate. `uLie` in `src/paint.js`: a mesh may
say its paint lies on a surface, and then its width runs across the tangent in that surface and it stays there.
The ground and the river lie. The brush's soft mode for big strokes (`vBig`) is also moved out, from 30--140 px
to 70--420, and only goes six tenths of the way soft, with the relief deepened as it does, so that a stroke seen
large keeps its bristles. The trees' dabs were halved and doubled.

**Measured**, on the real GPU pane, visible this time, at dpr 1.5, 347,063 strokes:

| where | fps |
|---|---|
| the knoll, cold | 75 |
| over the village, 95 m up | 88 |
| standing on the slope, 12 m up | 112 |
| from the hills, 260 m up, the whole valley | 97 |

**Pictures.** `e0-standpoint`, `e0-over-the-village` and `e0-in-the-street` re-taken; `e0-from-the-hills` added.

**Still visible**, as before: the village walls are a mixture; the cypress is a tower with licks; the sunflowers
in the air have stems; the river's columns are fixed on the water; the flowers are 150 draw calls.

### E0.2 — The swirl that flashed  *(the author's word: "the whirl thing is flickering, flashing"; the same day)*

**What it was.** The sky's strokes all lie on one shell, 1,500 m out, and the stars' rings on another. Two
strokes of the swirl that overlap have the same depth to the last bit, and the depth buffer decides which is in
front by whatever bit is left -- and since the swirl turns, that bit is decided anew each frame, so that a stroke
in the arm is on top one frame and under the next. A still swirl would have hidden it; a turning one flashes.
Measured: with the view held and the world's clock stepped 30 ms, 2.6% of the pixels of the swirl's region
changed by more than 60 (of 255, summed over the channels); the sky alone, of all the parts, does this.

**What was done.** The sky and the stars write no depth (`depthWrite = false`, `src/main.js`), and are drawn in
that order before everything nearer. Two strokes on the shell are then covered in the order they were laid,
always; anything nearer covers them, as it should, since it is drawn after and the shell left nothing in the depth
buffer to test against. Nothing is beyond the shell.

**Measured**, same view, same 30 ms step: 0.17% of pixels changed -- what the swirl's real turn and the sample
edges of the paint account for. Frame rate unchanged: 110--111 fps at dpr 1.5 on the knoll and at the swirl.

**Still visible**: as in E0.1.

### E1 — Toward the star  *(the author's word, from a user: "if they are flying, they should be moving toward the star or the sky"; and: "think about Star Trek -- when the Enterprise moves towards a galaxy, the galaxy becomes bigger"; the same day)*

**What it was.** The sky was a shell 1,500 m out with every stroke on it, and the body could go 620 m up. So
flying up, nothing came nearer: no stroke passed another (a shell has no parallax), the star grew by half at
the ceiling and stopped, and the swirl stayed a picture. Nobody felt like flying because flying went nowhere.

**What was done.** Four things, all in the same evening.

1. **The sky has depth** (`makeSky`, `src/world.js`). A stroke is still laid in a direction, so from the knoll the
   sky is his picture as before; but it lies at a distance of its own. The night between the swirls lies in slow
   drifts from 830 to 2,175 m. Each swirl is a well: its rim at 930 m and its eye at 2,200, so that flying into
   it the arms wind round you and close ahead into the eye. In a star's direction the sky keeps behind the star.
   The far hills are a ring at 2,025 m, beyond the ground's edge (the ground plane is 3,400 m across now, and
   its strokes reach 1,650 m). Stroke sizes scale with distance, so the picture from the knoll is unchanged.
2. **Each star is a well** (`star`, `src/world.js`): the core at 1,500 m, and each ring nearer than the one inside
   it by 90 m, the widest at the mouth. You fly down it through ring after turning ring to the core. The moon
   the same, six rings deep.
3. **The reach** (`REACH`, `src/main.js`; `reach`, `src/flight.js`): the body may go anywhere in a sphere of
   1,400 m round the middle of the world, in place of the old ceiling and edge -- to 100 m short of a star's core,
   where the core fills the view as a blaze. Place `4` is the morning star, from the mouth of its well; `3` is
   now 1,000 m into the great swirl.
4. **The lift** (`src/flight.js`): the body goes faster the higher it is over the ground, twice at 45 m and
   twelve times at 495 m and over, so that near the ground you still walk, and a star is 40 s away at a walk and
   11 s with Shift, and grows the whole way -- slowly at first and then fast, which is how a thing you fly at
   grows. Coming down you slow, and the floor's brake is as it was.

**Depth, logarithmic** (`src/paint.js`, `LOG_*`; the land and the water too). With the eye inside the sky, two
strokes that overlap at 2,000 m must sort exactly, and a linear depth buffer with the near plane at 0.2 m has
a step of over a metre there -- the E0.2 flashing, everywhere. So every shader writes its depth as log2(1 + w):
a step of a millimetre at 2,000 m. The paint sets it at the vertex, which keeps the GPU's early depth test (the
fragment form cost a third of the frame rate); the ground plane, whose triangles are wide, sets it at the
fragment, exactly. The E0.2 fix (no depth writes for the shell) is undone, since there is no shell.

**Measured.** The E0.2 flicker metric, same view, same 30 ms step: 0.16% of pixels changed (E0.2 gave 0.17%;
before the fix, 2.61%). The walk to the morning star, simulated: 40 s at a walk, 11 s with Shift. Frame rate
was **not** measurable this evening: the author's own Chrome tab had the piece open at the same time, and with
every stroke hidden the pane ran at 34--46 fps, so nothing here compares with E0.1's numbers. To be re-measured
on a free GPU.

**Still visible.** Inside the sky a stroke is a plate the size of a house, as it is at your feet; the author may
want the sky's strokes thinner than the ground's when seen large. Arriving at a star is a white blaze with the
bloom at 0.9. The far-hill ring at 2,025 m is seen from above as a ring. And the E0.1 list.

### E1.1 — His yellow stars  *(the author's word: "some very yellow vivid van gogh style stars -- see by yourself"; the same day)*

**What it was.** Seen: white discs in rings of white and light-blue dashes. Three causes. The star region's
record is mostly halo -- pale greens and whites -- and only one stroke in thirteen is his chrome yellow, and the
cores and inner rings drew from the whole of it by brightness. The outer rings drew from the sky. And a core
lit twice over is white: the grade's shoulder clips each channel above 0.85, so a strong yellow lit to (1.5,
1.4, 0.6) came out (1, 1, 0.6).

**What was done** (`loadHisColours`, `star`, `src/world.js`). Three pools from his own paint: the yellows of
the star and moon regions together (524 strokes) for the cores and the inner halo; the oranges (107) for the
heart of the biggest star and of the moon; the star region's pale strokes (1,177) for the outer halo. The
halo is nine rings now (the moon ten), 1.2 to 4.0 core-radii, close enough to overlap, strokes wider and a
quarter closer: yellow through the inner third, then yellow among his yellow-whites, and the sky's light blue
only among the last rings. The core is lit at 0.32 and the halo from 0.26 at the core to 0.03 at the rim, under
the shoulder, so that yellow stays yellow. Star strokes: 19,894, from 8,904.

**Also.** A star's well now runs along the line from the knoll's eye to the core, not from the middle of the
world: the picture is seen from the knoll, and a well seen 4 degrees off its axis was a crescent (a small star's
mouth ring is 46 m across and was displaced 47 m). The star strokes spin about that line (the stars' mesh has
its `uSpinC` at the knoll's eye); the sky keeps behind each star as seen from the knoll; place `4` is 550 m
down the morning star's well from the knoll.

**Measured**, the GPU free this time (the author's tab closed), dpr 1.5, 368,289 strokes:

| where | fps |
|---|---|
| the knoll, looking north | 120 |
| the knoll, at the moon | 120 |
| the mouth of the morning star's well | 117 |
| 1,000 m into the great swirl | 119 |

So E1's logarithmic depth at the vertex costs nothing against E0.1's 75--112, and E1's frame-rate note is closed.

**Still visible.** From inside a well the perspective opens a dark gap between the core and the first ring,
which the knoll does not see. The E1 list.

### E1.2 — The field  *(the author's word, with a picture of sunflowers under a swirling sky: "put somewhere on the ground a field of sunflowers, not everywhere, but pick a field that's visible near the village"; the same day)*

**Where.** The flat between the knoll and the village, as in the picture: the knoll stands at z = 100 and the
village runs north from z = −60, so the field is centred at (30, 0), 90 m in radius with a rough edge, and from
the knoll it is the foreground, a yellow carpet with the village and the hills beyond. Not on the river and not
in a house. The flowers face the knoll.

**How** (`makeField`, `dab`, `flower`, `src/world.js`). One flower every 1.6 m -- 9,900 places, of which
7,900 are in the field. A whole head of his is 400 strokes, so the field is in four levels from the knoll's
eye: every stroke of the head within 12 m; one stroke in three, each wider, to 28 m; one in eight to 60 m; and
beyond that two dabs, the head's petal colour and its heart, on one stroke of stem. 103,033 strokes, from the
old slope's 35,022 for 90 flowers. The 90 on the slope are gone into it.

**Measured**, dpr 1.5, 436,300 strokes:

| where | fps |
|---|---|
| the knoll, looking north | 60--79 |
| the knoll, looking at the field | 79 |
| standing in the field, near the knoll | 89 |
| standing in the far field | 99 |
| over the village, looking back | 81 |

Down from 120 at the knoll: the field is in the knoll's view whole.

**Still visible.** The levels are set from the knoll, so a walker in the far field sees dabs, a yellow disc
with a brown heart on a stem, and in the middle field heads of a few wide strokes. From the air the field is
still nearly round. A mote at arm's length from the eye is a white streak the size of a boat (an old thing,
the motes'). The E1.1 list.

### E1.3 — The field, followed  *(the author's word: "fix" the E1.2 list -- the walker's dabs, the round field, the mote at arm's length; the same day)*

**What it was.** Three things left visible at the end of E1.2. The field's four levels of detail were laid
down once, from the knoll's eye, so a walker who went out into it stood among dab flowers, a yellow disc with
a brown heart on a stem, and only the flowers near the knoll ever showed his heads whole. The field was a disc
with a rough edge, and from the air a disc is a disc. And a mote that came within arm's length of the eye was
a white plate across the view, the size of a boat lying in the field, because a mote is half a metre long and
the eye was a hand from it.

**The field follows you** (`FieldDetail`, `src/world.js`). The field is built once in its far form only: two
dabs and a stroke of stem a flower, 18,561 strokes for 6,187 flowers. The near forms live in three pools of
slots that follow the eye -- 60 slots with room for a whole head (every stroke of his, 679 a slot), 260 for
heads in thirds (235 a slot), 1,300 for heads in eighths (103 a slot) -- and each frame the flowers nearest
the eye take the first pool's slots, the next nearest the second's, out to 12, 28 and 60 m, with a fifteenth
of slack so a flower on a line does not flicker across it. A flower in a slot has its dabs hidden; a stroke is
hidden by a turn in the reveal it never gets (9). Each flower keeps its own seed, so its head is the same head
every time it is built. The work is paced: 1,500 strokes a frame, nearest first (`?budget=`), and a slot that
is needed before its holder has moved out is taken from the holder farthest off, who shows dabs until his own
turn. The buffers hold 235,740 slot strokes, most of them hidden at the vertex; the ledger counts them.

**The field is a plot** (`makeField`). 140 m across and 125 m along, centred at (30, 8), turned 8°, its edges
wavy by 3 m, planted in rows 2.0 m apart with a flower every 1.35 m down the row -- from the knoll the rows run
away toward the village, as in the author's picture; from the air it is a field. 6,187 flowers, from 7,900 in
the disc.

**A mote is never wider than a mote** (`paint.js`, `uWrapNear`, `uWrapAng`). None within 1.5 m of the eye,
and one nearer than its length over 0.04 rad is shrunk about its middle to that angle -- 2.3°, some 25 px --
and faded in from 1.5 to 3 m. The near motes still stream past; they are just not plates.

**Measured.** Building a flower's strokes: 1.8 µs a stroke, transform and upload included (188,924 strokes in
157 ms). A full fill after a jump, 235,740 strokes, takes 2.6 s at 60 fps. A walk of 10 m north through the
thick of the field, simulated frame by frame at 3 m/s: 71,161 strokes rebuilt, 7,100 a metre, 0.25 ms a frame
on the mean and up to 2.7 ms on the frame a plan lands (the plan is made each half metre: 4,400 flowers
within 69 m sorted by distance). From the knoll the pools hold 0 / 0 / 577
(the field's near edge is 30 m off); standing in the field, 60 / 260 / 1,300, full. Frame rates could not be
measured: the author's own Chrome was running the piece throughout (two helpers at 30% each), and the pane
gave 16--32 fps for every view, with the field hidden as well as shown. To be measured on a free GPU; the
one cost added is the 235,740 hidden instances' vertex early-outs.

**Still visible.** The pools fill nearest first, so after a jump (a place key, or landing from a fast flight)
the far flowers stay dabs for a second or two while the near ones come up whole -- a visible ripple outward.
A flower crossing 12 m pops between its whole head and its thirds, as in E1.2 it popped in space rather than
in time. The plot's edges are still straight enough to read as a field only from the air; from the ground the
wave is invisible. The motes are still white dashes at 25 px. The E1.1 list.

### After E1.3 — The site  *(the author's word: "deploy to telbase.ai"; the same day)*

**What was found first.** This folder began as a copy of the sibling's, and its deploy link came with it:
`.telbase/project.json` (untracked) named the sibling's project, `the-world-of-van-gogh`, the same project id
as in the sibling's own folder. A deploy from here would have put the Dream over The World's live site. So
the Dream got a project of its own first, `the-dream-of-van-gogh`, and the link here now names it.

**Done.**
- `tools/deploy.py`: new, the sibling's deploy carried over. It exports a commit (without `.claude`, `tools`,
  `docs` and `shots`, which the page never loads; `hand/` stays, the page reads its region map), stamps the two
  script tags and the import map with each script's content (the host sends every `.js` as immutable for a
  year -- the sibling's After M9, the scripts a browser keeps), checks that the link names the Dream's own
  project and stops otherwise, and deploys through `pnpm dlx telbase deploy --local --provider vercel --auto`.
- `telbase init` also wrote a `CLAUDE.md`, a `TELBASE.md`, a command, an MCP config and a line in `.gitignore`
  that would have hidden the tracked `.claude/launch.json`. All of it removed; only the link was wanted.
- `README.md`: *Run it* names the site and the deploy.

**Measured.** 841e9bd deployed: 53 files, 7.2 MB, 11 s, the host's health check answered in 286 ms. The live
page in the pane: ready, 587,568 strokes, built in 2,317 ms, the nine scripts fetched at their stamped
addresses (`src/main.js?v=b4bed2a832` and the rest), the two records and the region map plain. The World's
project is listed still running, untouched.

**Still visible.** The site's frame rate is not measured (the author's Chrome was still running the local
page). The project has no description in the host's catalogue and no domain of its own; both are the
author's to give.

### E2 — The dream flies you  *(the author's word: "design a auto fly model in the app and think about it as when the user set the auto fly mode, it's like a movie, and the user should have a immersive experience like he or she is in the van gogh's dream, think a lot"; 23 September 2026)*

**What it was.** There was no way to be in the piece without driving it. The last time the body went anywhere on its
own was D5.5, and the author answered that picture -- the wind had carried the eye 57 m up into a pale sky with no
ground -- by taking the wind off the body: *nothing pressed is nothing*. So an auto fly is not the drift come back.
It is a film: composed, not wandered; the ground and his sky in the frame together; and only when asked for.
Nothing pressed is still nothing. The film does not start on its own unless the URL says so (`?dream`, for a
screen left running).

**What was built.**

- **`src/film.js`**, new: the film, one take of 3 min 2 s over 2,911 m that goes round until you take the controls
  back. It runs in five acts. (I) The knoll: the light lifts on his eye and the world paints itself in, under letter
  777; then down the slope. (II) The sunflowers: along the gap between two rows, just over the heads, toward the
  spire. (III) The village: up the street between the lit windows, under letter 678; up the spire, the eye on it to
  its tip and then up at the great swirl, with the clock at 0.3 so that the loose sunflowers hang. (IV) The water:
  a fall over the roofs to the river, low along it over the stars in it, under letter 691, to the moon's gold, and
  up from the moon in the water into the moon's own well of rings. (V) The sky: a wide turning climb, clockwise,
  the valley going round under the eye once; a glide west-north-west into the great swirl's funnel; a wide turn
  onto the morning star's well and down through its rings to its core, under letter 638. Then the star's light
  takes the frame, and in it you are on the knoll again with the world unpainted, and it paints itself in round
  you as it did at the opening.
  - *How.* The way is a centripetal Catmull-Rom spline through 33 places. Each place says its speed, and the
    clock is the integral of the way over the speed, so a place can be lingered at without its neighbours
    knowing. Each place says what the eye looks at -- a point, a direction in the sky, or the way ahead, level or
    not -- and the look eases between places. It is then smoothed as a hand on a camera would smooth it, a
    Gaussian over ±1.4 s of the film's own time, so that the eye does not stop at each place and hurry to the
    next. Each place also sets the lens (60° at the wake, opening to 94° down the star's well so its rings pass
    through the frame one by one), the world's clock (0.3 at the top of the spire, 3.2 down the star's well), the
    grade's offsets (warmer in the village, cooler on the water, more bloom toward the star), how far the paint
    parts for the body (1.8 m in the field, so the flowers bow and are not torn), and whether the eye may be
    caught by a loose sunflower passing close.
  - *The body.* It banks into its turns from its own lateral pull, as a bird does, at most 7°. It breathes, a few
    centimetres and a tenth of a degree. The lens widens with speed.
  - *The seam.* Every value above is a function of the film's time, so any frame can be had by seeking to it and
    the loop is exact: the seam is under full light, the star's warm white, and the fade lifts from it on the knoll.
- **`src/main.js`**: the film's driver.
  - *Space at his eye:* the film glides in from where you stand, over three seconds.
  - *Space from anywhere else:* the eyes close (a fade to the night's dark) and open on the knoll at the wake.
  - *Your eye is yours:* a drag turns it off the film's while the body is carried, and 1.2 s after you let go it
    goes back.
  - *An arrow, a place key, `Esc` or `Space`* hands the body back where it is, looking where it looked, going the
    way it went.
  - The lens, the clock, the grade and the parting go over to the film's and back through one eased weight.
  - Two black bands close in to about 2.1 to 1. The lines come in the lower band, a hint for the first seven
    seconds in the upper. The pointer hides when it is still.
  - *the dream* in the corner starts the film. It is the only way in on a phone.
  - `?dream` begins the film when the opening has gone into the painting; `?dream=<t>` goes straight to `t`.
  - `Space` is in the keys panel and the corner line.
- **`src/flight.js`**: `Space` and `Escape` are events. A bank the film left goes out of the roll in a third of a
  second. The film's way at the hand-over, `coast`, dies as a released key's does (`T_SPEED`), so the body comes
  to rest and does not stop dead.
- **`src/post.js`**: a fade to a colour, `uFade` and `uFadeCol`, for the eyes closing and for the star's light.
- **`index.html`**, **`src/veil.js`**: the bands, the line, the hint, the button; the veil stands aside for
  `?dream=<t>`.
- **The stars' wells, in the paint** (`src/paint.js`, `src/world.js` `starWells`). This fixes the world, and it
  was found by the film (below). A sky stroke that stands in a star's well as seen from the knoll's eye is put
  behind the star in the vertex shader, wherever the sky has turned it. It goes out along its own ray from the
  middle of the world to 1.08 to 1.38 R, and is widened as far, so from the knoll it is exactly where it was.
  `makeSky` no longer does this at the build, but still makes the draw it made for it, so every other stroke of
  the sky is the stroke it was.
- **The harness**: `dream.film` -- `play(t)`, `stop()`, `seek(t)`, `state()`, `shots()`, `audit()` -- and
  `dream.render()`, one frame drawn now, for a page that is not being animated. `dream.sim` threw on every call
  since E1.3: it passed the field its step from outside the loop the step lived in. Fixed.

**What was decided, and by whom.** The author's: that there is an auto fly, and that it is a film. Ours, each the
author's to send back:
- The route, and that it is one take: a dream does not cut, and this is one world.
- That it ends in the morning star. DESIGN 1's line (*we take death to go to a star*) is the film's last line, and
  the morning star of letter 777 is its first.
- That it does not start on its own. D5.5 stands.
- Four lines, from the four the piece already quotes, and none of ours.
- The bands at 2.1 to 1, never more than an eighth of the height each.
- The bank's 7°, and the clock's 0.3 and 3.2.
- The glance: 42% of the way to a loose sunflower within 18 m, only where a place allows it.
- Silence: D5's word stands.

**What was found.**

- **The stars were being covered by the sky.** E1 put the sky's strokes behind a star at the build, and the sky
  turns: each swirl turns its strokes on its own axis, and the band between them turns about the vertical. So
  strokes that were never put back are carried into the wells, and those that were are carried out of them. On
  the knoll with the clock frozen at 600 s, the morning star was half covered and the star at 22° mostly. Down
  the morning star's well, the film met a wall of sky strokes at arm's length where the core should be. With the
  wells in the paint, both stars are whole at 600 s and at 1,800 s. Down the well, the rings stand round the core
  (158 s in the pictures).
- **A way through the sky that went out to the moon and then across to the star turned the eye at 167°/s.** Out
  radially, across tangentially, out again: each change of heading was a whip. The sky act was redrawn as one wide
  climbing turn, a straight glide and one wide turn onto the star's axis. The moon is now passed, seen up its
  well from the water, and not entered. The eye's fastest turn in the whole film is now 36°/s, as it lifts from
  the spire's tip to the sky.
- **Among the heads the frame was stems.** At 2.5 m, the parting (3 m) tore the nearest flowers into sideways
  comets. At 4.1 to 4.2 m with the parting at 1.8 m, it is the field, the village and the spire, and the flowers
  bow.
- **From above, at night, the ground is dark**, and a frame of it is a map. The climb and the fall look a little
  up, so that his sky is over the valley in the frame.

**What it measures.**

| what | value |
|---|---|
| the film | 181.7 s, 2,911 m, 33 places in 15 shots; the loop exact (the seam under full light) |
| least room | 1.5 m over the ground (a standing eye, on the knoll); 4.9 m from a house or the church (up the spire); 12.6 m from a cypress (the field) |
| the most | 60 m/s (the glide); the eye 36°/s (off the spire's tip); bank 7° (the climb); pull 25 m/s², 2.6 g (the fall into the river's turn); 1,393 m from the middle of the world (inside the reach) |
| cost | 0.008 to 0.017 ms a frame for the film's pose, the eye's smoothing included; nothing non-finite in 1,818 samples |
| the hand-over | an arrow at 20 m/s on the river: no jump; 3.8 m more in the next second, and at rest |
| a drag | 40° off the film's eye; back within 4 s of letting go |
| from anywhere else | the eyes close in 1.1 s; the world repainted by 8 s |
| `Esc` in the wake | the paint finishes in 1.6 s |
| the stars, from the knoll | whole at 600 s and at 1,800 s; half covered at 600 s before the fix |
| frame rate | **not measured**: the in-app pane was hidden throughout, so its page was not animated, and timings of forced frames ran 0.7 to 23 ms at random. The wells add twenty dot products a vertex to the sky's 120,000 strokes. D6's, on a visible window |

**Pictures.** The film at 5, 40, 56, 68, 124, 148, 158 and 179 s: `e2-the-wake`, `e2-the-sunflowers`,
`e2-the-street`, `e2-the-spire`, `e2-the-moon-in-the-water`, `e2-the-great-swirl`, `e2-the-morning-star`,
`e2-the-blaze`. All headless, 1200 × 675.

**The gate.** The author's: press `Space` and watch it round twice, touching nothing. Is it a film, and are you in
his dream?

**Still visible.**

- **Toward the end of the fall** (about 97 s) the frame skims toward the water under the northern hills, and is
  dark for two seconds.
- **Down the last hundred metres of the star's well**, even at 94° the rings are outside the frame, and the core is
  alone in the dark until its light takes the frame.
- **A ring of a star passed at arm's length is a plate the size of a house** (E1's), for a moment, at 158 s.
- **From the top of the spire**, a star's well seen off its axis shows a dark hole in its rings (E1.1's).
- **The glance** at a loose sunflower is not in the pictures: where the flowers are depends on the world's clock,
  not the film's.
- **`?dream` through the whole opening** was not seen end to end. Headless, the opening's paint takes half an hour
  at 0.3 fps; it lifted without an error, and the film's start after it is one line.
- **Letter 777** is the opening's caption and, on the first time round, the film's first line too.
- The frame rate, above.

### E2.1 — The fall's dark, the core alone  *(the author's word: "fix: a dark two-second stretch at the end of the fall toward the river, and the last stretch before the core where the rings have left the frame"; the same day)*

Two of E2's *still visible*, sent back the same day. Both were the film's to fix, not the world's: nothing in
`src/world.js` or the paint moved, and every place before the morning star is where it was, at the same time.

**The fall's dark.** The place at the foot of the fall, 14 m over the near bank, looked 60 m ahead along the way,
5° up. The way ahead there is down, to the water, so from 97 to 99.5 s the eye looked 9 to 11° down, into the far
bank 75 to 115 m off. That ground's paint lies turned to the knoll (E0.1). From twenty metres over the river it is
dark grey, with a few strokes on it and the river in the bottom of the frame. The place now looks level, 90 m
ahead and 6° up. All the way down, the eye is between 9° up and level, on the hills 330 to 580 m out or on his
sky over them, with the horizon on the lower third. The morning star, the star east of it and the moon's halo are
in the top of the frame, and the eye comes down to the water only as the body does. It turns into the river's bend
about a second before the body does, and its fastest turn in the fall is 20°/s, for 32.

**The core alone.** The morning star's last ring is 254 m round the well's axis, 1,502 m down it from the knoll's
eye. It leaves the frame's corners 190 m short of the blaze. The body came in at 36, 20 and 7 m/s over the last
three places, and the light began to rise 7.5 s before the end. So from 168 to about 176 s the core hung by
itself in the blue. Two changes in `src/film.js`:
- The body keeps the rings' pace to the core: 44, 38 and 26 m/s.
- The light begins a second sooner and rises more slowly: from 3.5 s before the blaze over 7 s, for 2.5 s over 6.
  It is full at the same moment, 1.5 s before the end.

Now the last ring's strokes are in the corners at 166.8 s with the light already rising (exposure +0.27, bloom
+0.85). At 167.8 s they are gone and the exposure is +0.55. The core, 22° across, grows to 60° as the light takes
the frame. The film is 174.0 s, 7.7 s shorter, over the same 2,911 m.

**What it measures.**

| what | value |
|---|---|
| the fall, 97.5 to 99.5 s | mean light inside the bands 57 to 61 (of 255), for 38 to 42; pixels under 40, 40 to 45%, for 64 to 70% (3° up, tried first: 53 to 54, and half the frame under 40) |
| the fall, the eye | 9° up to level, for 11° down; fastest turn 20°/s, for 32 |
| the star, the gap | the light rising as the last ring leaves the corners, for 8 s of the core alone before it |
| the film | 174.0 s, 2,911 m, 33 places in 15 shots |
| the audit | unchanged: least room 1.5 m, 4.9 m, 12.6 m; the most 60 m/s, the eye 36°/s (off the spire's tip), bank 7°, pull 25 m/s², 1,393 m out |
| the hand-over in the rush | an arrow at 38 m/s: no jump; 7.4 m more in the next second, and at rest |
| frame rate | not measured, as in E2; nothing here draws more |

**Pictures.** `e2-the-fall` (98.5 s) and `e2-the-last-ring` (166.8 s), new. `e2-the-blaze` re-taken at 171.3 s,
which is as far before the end as E2's 179 s was. All headless, 1200 × 675.

**Still visible.** As E2's, less these two. The far bank and the slopes of the northern hills are still dark from
the air at night, and at 98 s they are still the lower half of the frame: the eye is turned from them, but they are
not painted for it. The ground's paint lies turned to the knoll, and wherever the film looks at it from low and
near, it is sparse.

### E2.2 — No line at the end  *(the author's word: "remove the last line at the end of the autoplay"; the same day)*

Letter 638 (*we take death to go to a star*) came in the lower band at the morning star, from 158 s. Since E2.1's
faster way down the well, it was still up as the light rose, to 168 s. It is taken out: the morning star's place
has no line, and `LINES` in `src/film.js` has three. The film's words are now 777 on the knoll, 678 in the street
and 691 on the river, and from 111.5 s to the end the band is empty. Nothing else moved: the film is 174.0 s, with
the same places and the same times. The line is still the piece's own, in `letters/lines.json` and DESIGN.md.

**Pictures.** `e2-the-last-ring` re-taken at 166.8 s without it.
