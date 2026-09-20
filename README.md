# The Dream of Van Gogh

One night, entered. Three of his night canvases — *The Starry Night*, *Starry Night Over the Rhone*, *Cafe Terrace
at Night* — are exploded into the air, every stroke down its own ray from where he stood, at a distance a person
typed, and you fly among them. Stand at his eye and the frame is the painting; move, and it comes apart. Inside a
cone there is his painting and nothing else.

It is **one night and one world**, and the three stand in it on one shore. All three of his grounds are the same
`plane y: 0` law, so until D4.5 his village at Saint-Remy, his pavement in the Place du Forum and the Rhone itself
were one surface — and that surface was water. Now the river runs between the two banks his own Rhone canvas
measures, and the shore beside it stands at the height of a standing man: his Rhone eye is 4.411 m over the water
and a man is 1.65 m tall, so the quay is 2.761 m up, and all three of his grounds land on it exactly and at once.
Our sky is three fields, one round each of his eyes, each at the depth his own sky paint stands at there and in
the colour his own night is, because his three nights are not one colour — and they never disagreed: the Rhone's
sky is 1 to 18 degrees above the horizontal and the terrace's 19 to 35, bands that do not touch. Where his canvas
ends the sky goes on in ours, made of nothing but what was measured from his; every light lays a column of marks
on the river, in the hand of the ones the Rhone paints; and above it all is bare linen. The river and the shore
carry his own two grounds' colours at his own two shares of the light — his Rhone's water is 0.554 of its sky and
his village at Saint-Remy 0.424 of his — and what that is a share of is not chosen but measured, by rendering our
own sky from the floor it stands over. `DESIGN.md` is the design, written before the build; `BUILD.md` is the plan
and, under **Progress**, the log of what each milestone found.

It opens on the painting. *The Starry Night* paints itself on primed linen from its own stroke record while the
world is built behind it; then the eye goes into it, and behind the veil the same canvas is already standing in
three dimensions with every stroke slid back up its ray to where the ray crosses his picture plane — the canvas
whole, which the standpoint test reads at 0.998. When the veil has gone, what is left is the painting, and it
explodes: four seconds down the rays to their depths, and you are in the air over Saint-Remy. It makes no sound.

Its sibling, *The World of Van Gogh* (github.com/Victor-EU/the-world-of-van-gogh), is a walk along a road through
fourteen of his paintings. This piece is built clean beside it, from the same stroke records.

## Run it

```bash
python3 -m http.server 8712
```

Then <http://127.0.0.1:8712/>. Drag to look; you fly where you look. `W` is faster, `S` slower, `Shift` a swoop,
`Space` lets go and the wind has you, `Z` turns you onto your back, `1` `2` `3` let a current carry you to one of
his three eyes in eight to twelve seconds — touch the controls and it lets you go — `H` the keys, `L` the ledger,
which says what is his, what is ours, which of it was measured, and his own line at each canvas. Fly into the linen and
the dream fades and begins again. Address flags for looking at one thing at a time: `?nowind`, `?nopart`, `?nocurl`,
`?noStrokes`, `?nosky`, `?nostars`, `?nomotes`, `?nosea`, `?noshore`, `?noreflections`, `?nocaption`,
`?sky=0.5` (our sky at half his density), `?water=0.5` (a column at half his count of marks), `?sea=0.5` and
`?shore=0.5` (the river's and the shore's own marks at half), `?d3floor` (the floor on the reference D3 gave it,
which is what D4.6 measured its way off), `?nonight` (our sky in the Starry Night's colour everywhere, as it was
before D4.5), `?sharp=`, `?shoulder=` and
`?behind=` (how purely a standpoint is its own night: by distance, by the band of sky he painted, and by which way
his canvas faces), `?only=sky|stars|motes|sea|shore|reflections|his|starry|rhone|cafeterrace` (one thing alone), `?nocones`
(the rule of §5.1 off, so that what it hides can be seen), `?ledger` (ours tinted), `?debug`, `?test` and
`?at=1|2|3` (a canvas's eye, its field of view, the body still), `?flat`, `?dull`, `?nopost`, `?t=` (the clock
frozen), `?flight=glide|swoop|village`, `?burst=0` (the opening's explosion held anywhere between his canvas on
its own picture plane and the world at its depths) and `?hold` (the painting left up until `dream.holdOpen(false)`).

## Rebuild the depths and the wind

```bash
python3 -m venv .venv && .venv/bin/pip install numpy scipy pillow playwright && .venv/bin/playwright install chromium
.venv/bin/python tools/depth.py starry        # depth/starry.json and depth/starry-mask.png -> depth/starry-depth.bin
.venv/bin/python tools/standpoint.py starry   # the standpoint test, with the page served on 8712
.venv/bin/python tools/wind.py starry --vortices 6   # fits the wind to the sky's tangents -> hand/starry-wind.json, shots/starry-wind.png
.venv/bin/python tools/hand.py starry         # measures his sky and his stars -> hand/starry-sky.json, hand/starry-star.json
.venv/bin/python tools/seam.py starry         # the seam test: crops across the edge of his cone -> shots/starry-seam-*.png
.venv/bin/python tools/columns.py rhone       # measures his reflections on the Rhone -> hand/rhone-column.json
.venv/bin/python tools/reflect.py --light 20  # does a column lie under its light from every eye? -> shots/d3-reflect*.png
.venv/bin/python tools/mask.py rhone          # a first region mask for a canvas -> depth/rhone-mask.png
.venv/bin/python tools/depth.py rhone         # and its depths, from depth/rhone.json -> depth/rhone-depth.bin
.venv/bin/python tools/hand.py rhone --only water,star     # his water's own marks -> hand/rhone-water.json
.venv/bin/python tools/hand.py cafeterrace --only water --water pavement   # the shore's marks -> hand/cafeterrace-pavement.json
.venv/bin/python tools/nights.py              # his three nights, band by band up each sky -> hand/nights.json
.venv/bin/python tools/bank.py --out shots/bank.png   # can the bank be seen from the air? -> the floor's profile across it
.venv/bin/python tools/opening.py --strip     # the handoff from the veil to the world, and the explosion second by second
.venv/bin/python tools/lines.py               # his four lines, checked against the edition -> letters/letters.json
.venv/bin/python tools/shot.py --flight swoop --out shots/swoop.png
```

`tools/hand.py` must be run after `tools/wind.py`, because a stroke of his is measured against the wind it lies
along, and `src/sky.js` reads both. `tools/nights.py` must be run after any move of a standpoint, because it
writes down where his eyes are as well as what colour his skies are, and our sky is built round those eyes — a
stale `hand/nights.json` anchors the whole night at the old places, which is a thing that happened in D4.5. `tools/columns.py` needs neither: it measures the Rhone's water against itself,
in ratios, because the Rhone had no standpoint until D4. `tools/lines.py` asks vangoghletters.org itself and will
not let a line ship that is not in the paragraph it names. Nothing of ours exists except through the `hand/` files.

The harness on `window.dream` has the tests: `dream.glance(30, 0.5)`, `dream.flight('village', {dwell: true})` for the
parting test, `dream.eddy(0)` to let go inside the great eddy, `dream.seam()` and `dream.density()` for the two
numbers D2 pre-registers, `dream.water()`, `dream.column(i, eye)` and `dream.floor()` for the three D3
pre-registers, `dream.current(n)` for D4's, `dream.night()`, `dream.floorOf()` and `dream.nightAt(p)` for D4.5's,
`dream.light(p)` for D4.6's — our own sky rendered from a place, five faces of a cube and the upper hemisphere of
them, which is the light the floor there stands under — `dream.opening()` and `dream.holdOpen(v)` for D5's,
`dream.cones()` and `dream.clipped()` for the three cones
and what the rule of §5.1 hides, `dream.sea()`, `dream.counts()`, `dream.wait(secs)` for a shot at a time of the
piece's own clock, and `dream.sim(secs)` to run the body forward without drawing, for a renderer too slow to show
what it can still measure.

`tools/mask.py <slug>` writes a first region mask from rules — the polylines in it are typed by a person off the
canvas — and from then on the mask is painted by hand.
