# Van Gogh's Universe

<p align="center">
  <img src="docs/saint-remy.jpg" width="100%" alt="Saint-Rémy at night: a sky of long blue strokes with the stars and moon of The Starry Night, a black cypress, a road through irises, and his Irises and The Starry Night on easels beside it.">
</p>

A walk through the world Vincent van Gogh painted, 1885 to 1890, in which his canvases paint themselves stroke by
stroke.

One road runs from the cottage at Nuenen where he painted *The Potato Eaters*, in April 1885, to the wheatfield above
Auvers-sur-Oise, in July 1890, and every metre of it is a few days of his life. Eleven places stand along it in the
order he painted them. The land at each is painted in the colours of his canvases of that place and month, and his
canvases stand beside the road on easels: thirty-one of them. Each is made of its own brushstrokes, extracted from a
museum's photograph, and as you walk up they are laid down again in the order he laid them. At ten of the places
there is a line from his letters.

It opens on *The Starry Night* painting itself. It ends past the last field, on bare primed canvas, where
*Self-Portrait as a Painter*, thirty-six metres tall on an easel at the end of the road, paints itself last.

The subject is not his places but the act of painting them. The piece is one HTML page and a folder of ES modules,
with three.js from a CDN and no build step.

<p align="center">
  <img src="docs/opening.jpg" width="49%" alt="The opening: The Starry Night painting itself on a primed canvas, above the title Van Gogh's Universe.">
  <img src="docs/painting-itself.jpg" width="49%" alt="Sunflowers on its easel by the Yellow House, partway through painting itself: its first strokes laid over bare linen.">
  <img src="docs/red-vineyard.jpg" width="49%" alt="The red vineyard: red rows on either side of a violet road with puddles of yellow light, under a low sun in a yellow sky, with his canvas on an easel.">
  <img src="docs/the-end.jpg" width="49%" alt="The end: his Self-Portrait as a Painter on a giant easel past the end of the road, above the words Vincent van Gogh, 1853 to 1890.">
</p>

## Run it

Serve the folder over HTTP (import maps and `fetch` do not work from `file://`) and open it in a browser with
WebGL 2:

```bash
python3 -m http.server 8710
```

Then visit <http://127.0.0.1:8710/>. Any static host works the same way.

The page draws each canvas from its stroke record, `strokes/sNN/<slug>-canvas.bin`, with an underlayer image
beside it. The records for all thirty-one canvases are in the repository and come to 12 MB. The 1.7 GB of museum
scans they were extracted from are not: you need those only to change a canvas or add one (see
[Rebuilding the stroke records](#rebuilding-the-stroke-records)).

It has been measured in headless Chrome on a Mac. The resolution adapts to hold the frame rate, and a touch screen
gets a smaller budget and two-thumb controls, but no real phone has been measured yet.

## Controls

| | Keyboard and mouse | Touch |
|---|---|---|
| Walk | ↑ ↓ or W S, or the scroll wheel; Shift runs | the left thumb, up and down |
| Turn | ← →; A D step sideways | the left thumb, sideways |
| Look around | drag | the right thumb |
| Walk on its own | Space; ← → steer it off the road, ↑ ↓ take over | |
| Lie down and look up | Z | |
| Go to a place | 1 to 9, and 0 for the tenth; or click the line along the bottom, which reaches all eleven | tap the line |
| Sound | M, or the speaker button | the speaker button |
| The keys | H or ? | the keyboard button |
| Full screen | F | the full-screen button |

The walk on its own keeps to the road: drag to look around and it walks on regardless. ← → steer it off the
road, and once let go it finds the road again. It slows at every place and stops where the road ends. The last
eighty metres, up to the portrait, are for a hand.

## The walk

| | Place | When | On the easels | His letter |
|---|---|---|---|---|
| 1 | Nuenen: a poplar avenue at sunset, a cottage with its lamp lit | April–May 1885 | *The Potato Eaters* | 499, to Theo |
| 2 | Paris, with the windmills of Montmartre | 1886–1888 | four self-portraits lining the road, *Bank of the Seine*, *Montmartre: Behind the Moulin de la Galette* | 569, to Horace Mann Livens |
| 3 | The orchards outside Arles, in blossom | February–April 1888 | *The White Orchard*, *The Pink Peach Tree*, *Orchard in Blossom*, *Almond Blossom* | 594, to Theo |
| 4 | La Crau: wheat, haystacks and the blue cart | June 1888 | *The Harvest*, *The Sower*, *Wheatfield with a Reaper* | 627, to John Peter Russell |
| 5 | The Yellow House, Place Lamartine | August–October 1888 | *Sunflowers*, and the three versions of *The Bedroom* | 705, to Theo |
| 6 | Arles at night: the café terrace, gaslight on the Rhône | September 1888 | *The Night Café*, *Café Terrace at Night*, *Starry Night Over the Rhône* | 676, to Theo |
| 7 | A red vineyard by a canal, after the rain | November 1888 | *The Red Vineyard* | 717, to Theo |
| 8 | Saint-Rémy: the cypress and the village under *The Starry Night*, olive trees, irises | May–November 1889 | *Irises*, *The Starry Night*, *Olive Grove* | 782, to Theo |
| 9 | Auvers-sur-Oise: thatch, gardens, the church | May–July 1890 | *The Church at Auvers*, *Thatched Cottages at Cordeville*, *Daubigny's Garden*, *Stairway at Auvers*, *Wheatfield under Thunderclouds* | 879, to Willemien |
| 10 | The wheatfield above the village, in the wind, with crows | July 1890 | *Wheatfield with Crows* | 898, to Theo and Jo |
| 11 | After: bare primed canvas, and past the end of the road his portrait | | *Self-Portrait as a Painter*, 36 m tall | |

Seven canvases stand at a place outside their own dates. The *Sunflowers* at the Yellow House is the Van Gogh
Museum's version of January 1889, for example, and *Wheatfield with a Reaper* is Saint-Rémy's. Each has a note in its
station file saying why, and `tools/station.py` fails any that does so without one. The piece may put a canvas where
the argument wants it, but not quietly.

## How it works

### The strokes

The strokes are extracted offline, in Python (`tools/`), from a museum scan of each canvas at about 120 pixels a
centimetre:

1. an orientation field from the structure tensor at three scales;
2. ridges, found on luminance and also on colour where luminance has nothing to say, because he often laid one loaded
   colour beside another of the same value;
3. each ridge traced along the field into a stroke: a curve, a width, a colour and a height;
4. an underlayer image for the passages no stroke carries;
5. an order for the strokes, described in the next section;
6. everything packed at 24 bytes a stroke.

The thirty-one canvases on the easels come to 326,887 strokes; *Wheatfield with a Reaper* alone has 18,924. Every
number the extractor uses lives in `params/<slug>.json`, merged over `params/_base.json`. Every build is compared
with its golden image in `strokes/golden/`, a flat render and a height map of each canvas at 1200 px.

### What is evidence and what is invention

Where two strokes cross, one is on top, and the photograph shows which. The pipeline reads every such overlap by
asking, at each point, which of all the marks covering it is the paint you can see. It then solves a sequence that
respects those facts. That recovers local order, not the order of the whole canvas. On crossings held back from the
solver it gets 53–59% right, where his habits alone get 42–46%, and the margin shrinks as the strokes get further
apart.

Most pairs of strokes never touch, and those are put in order by his habits. Thin and dark goes before thick and
light, sky before land, the contours late, and the brightest impasto last. So the solved sequence still correlates
0.89 with the habits it started from.

The timing is invented: every canvas paints itself in thirteen seconds, and the portrait at the end in twenty,
or sooner if you walk up to it.
The strokes are fitted to flat-lit photographs, so they are a reading of the paint, not a measurement of it; a scan
keeps no shadow of the relief. And the world between the canvases is not his. It is painted procedurally, in colours
sampled from his canvases of each place and pushed the way he pushed them. `DESIGN.md` §4.3 and the M2 entry in
`BUILD.md` give the measurements.

### The world

The runtime (`src/`) is ES modules on three.js r180.

- **The road.** One road runs 90 m from one place to the next. A ground table, a small float texture with a column
  per place, holds each one's crops, colours, wind and water, and the shaders read it between places. The
  height of the land is the same function in GLSL and JavaScript, line for line.
- **The sky and the ground.**
  - The sky is a painted dome with 11,000 to 24,000 marks laid along a flow field and curled round turning eddies.
    *The Starry Night*'s eddies are placed from the canvas.
  - The ground carries about 191,000 marks that follow the camera and are worked out on the GPU.
  - Everything standing is made of marks on its surface: trees, houses, windmills, the café terrace. These paint
    themselves in, nearest first, as you arrive.
  - One place's sky repaints into the next mark by mark.
- **The canvases.** Each draws its strokes as instanced ribbons with a procedural brush that has bristles, a loaded
  start, a dry end and a height, lit by the place's light.
- **Sound** is generated on the spot: wind, birds, crickets, the river, the crows, your steps, the bristles on the
  cloth while a canvas paints, and a quiet chord that changes key from place to place.
- **The opening** is *The Starry Night* painted from its own stroke record, 13,999 strokes in 3.2 seconds, in a
  worker so that building the world cannot stall it.

### His words

Each line from his letters was chosen by a person and checked by `tools/letters.py` against the Van Gogh Museum and
Huygens ING edition:

- the letter, its recipient, place and date are the edition's own;
- the words are in the named paragraph, verbatim;
- the edition's notes say the passage is about the canvas it appears beside.

`letters/README.md` shows how to check each one.

## URL parameters

These exist for testing and for reproducing a frame.

| Parameter | Effect |
|---|---|
| `?at=N` | start at place N, 1 to 11, without the opening |
| `?notitle` | skip the opening |
| `?q=low`, `mid`, `high` | the resolution budget; `mid` by default, `low` on touch screens |
| `?painted` | everything already painted |
| `?t=seconds` | freeze the clock, so that frames repeat |
| `?debug` | a readout of frame rate, position, place and progress along the road |

## Debug API

`window.vgu` exposes the state and a few controls for headless checks.

- `vgu.state()` returns position, place, progress, frame rate and whether the walk is on its own.
- `vgu.go({ station, dz, x, z, yaw, pitch, lie })` puts you somewhere, and `vgu.jump(n)` travels to a place as the
  line does.
- `vgu.easels()` lists every canvas, and `vgu.easel(i, metres)` stands you in front of one.
- `vgu.paint()` finishes every painting, and `vgu.freeze(t)` stops the clock.
- `vgu.layers({ sky, ground, props, paintings })` shows or hides a layer.
- `vgu.coda()` reports the portrait at the end: where it is, and how far through painting itself.

## Rebuilding the stroke records

The records the page needs are already here; this is for changing a canvas or adding one. You need the scans,
Python 3.9 or later, and a few minutes a canvas.

```bash
python3 -m venv .venv
.venv/bin/pip install numpy scipy pillow opencv-python-headless   # OpenCV only for tools/room.py
.venv/bin/python tools/fetch.py
.venv/bin/python tools/make.py harvest --out strokes/s04
```

- **The scans.** `tools/fetch.py` downloads the scans listed in `tools/sources.tsv` into `ref/originals/`. Most
  canvases' parameters name those files as they arrive. A few were stitched from tiles at full resolution
  (`tools/micrio_stitch.py`), found on Wikimedia Commons (`tools/commons_resolve.py`, `tools/fetch_commons.py`) or
  cropped by hand. `paintings/CREDITS.md` records every one: its holder, its accession number, its resolution and
  what was done to it.
- **One canvas.** `tools/make.py <slug> --out strokes/sNN` builds one canvas and reports whether its golden image
  moved. The slug is its file in `params/`, and `sNN` is its place's number.
- **The audits.**
  - `tools/make.py --check` audits the parameters.
  - `tools/station.py` checks the station files against the blobs.
  - `tools/letters.py --check` checks the letters against the edition.

## Repository layout

```
index.html            the page: markup, CSS, the opening, and the import map for three.js
src/                  the runtime: the road, the art direction of each place, the sky, the ground, what stands
                      in the land, the canvases, the post-processing, the sound and the interface
stations/             one file per place: its canvases and their dates, its span, and his line
letters/              the quotations, how to check them, and their licence
paintings/CREDITS.md  every canvas, its collection, and the scan its strokes came from
params/               the extraction parameters for each canvas
tools/                the offline pipeline: gathering the scans, extracting and ordering the strokes, packing
                      the records, and the audits
strokes/golden/       the pipeline's regression images
strokes/sNN/          the stroke records the page loads, each with its underlayer
ref/                  not in the repository: the museum scans
DESIGN.md             the design, written before the build, with the author's later changes at the top
BUILD.md              the build plan, then the log
.claude/launch.json   the dev server for Claude Code's browser pane
```

`BUILD.md` is the log of how this was made, milestone by milestone, from one tile of the Reaper standing up to the
portrait at the end. Each entry records what was decided and what was measured, and most end with what is still
visible, named rather than fixed. That part is worth reading before trusting anything above.

## Credits and licence

- **The code** is released under the MIT licence; see `LICENSE`.
- **The paintings** are by Vincent van Gogh (1853–1890) and are in the public domain. `paintings/CREDITS.md` lists
  every canvas, its collection and the reproduction its strokes were extracted from. The scans themselves are not
  here.
- **The letters** are quoted from *Vincent van Gogh – The Letters*, edited by Leo Jansen, Hans Luijten and Nienke
  Bakker (Van Gogh Museum and Huygens ING, <https://vangoghletters.org>). They are used under the edition's
  CC BY-NC-SA 4.0 licence. The quotations in `letters/` and the `letter` in each station file are under that licence,
  not MIT.
- **three.js** is used under the MIT licence, from jsDelivr, and Cormorant Garamond comes from Google Fonts.
- **The first-person world of paint** follows its sibling,
  [Monet's Universe](https://github.com/Victor-EU/monets-universe), and through it *A town made of paint*
  (van-goghs-town.surge.sh). `DESIGN.md` §2 says what was kept and what had to be different.
