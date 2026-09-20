# The paintings

Every work here is by Vincent van Gogh (1853–1890) and is in the public domain. These are the source scans that
`tools/extract.py` will take apart into strokes (DESIGN.md §4.1). The files themselves live in `ref/originals/`, which
is deliberately outside the repository — 1.7 GB of scans does not belong in git.

Gathered 10 September 2026 by `tools/vgm_resolve.py`, `tools/commons_resolve.py`, `tools/fetch.py`,
`tools/fetch_commons.py` and `tools/micrio_stitch.py`. **40 scans, 4.41 gigapixels, 1.70 GB.** One more
after M9, on the author's word: *The Red Vineyard*, 104 MP and 41 MB, fetched on 11 September 2026 from the Commons
address in `tools/sources.tsv`. *Self-Portrait as a Painter* hangs twice, from the same scan and the same stroke
record: in the corridor at station 2 and, after M9, giant at the end of the road.
Two more on 19 September 2026, for two worlds of their own: *The Pink Orchard*, stitched from the Van Gogh Museum's
tiles (`tools/micrio_stitch.py`) at 36 MP and 25 MB, and *Olive Trees with the Alpilles in the Background*, which the
Museum of Modern Art does not publish a scan of -- the Google Art Project reproduction on Commons, 13 MP and 5.7 MB,
is the best there is, and at 44 px/cm it is the coarsest source in the set after the Church at Auvers. Its object
number is Wikidata's copy of MoMA's, since MoMA's own pages answer a script with a bot wall.

## How resolution was judged

Not "as many pixels as possible". A Van Gogh brushstroke runs roughly 3–15 mm wide, so the useful ceiling is the point
where a stroke's ridge and width are cleanly measurable and the scan has not started resolving canvas weave and
craquelure instead — which is noise for stroke fitting, and expensive noise at that.

**Target: ~120 px/cm (≈305 dpi).** A 4 mm stroke then lands across ~48 px, which is where the structure-tensor scales
of §4.1 step 2 are aimed. The `px/cm` column below is the number that matters; megapixels alone are misleading,
because a 42 MP scan of a 114 cm canvas is a *worse* source than a 42 MP scan of a 33 cm one.

## Three things worth knowing about the sources

**The Van Gogh Museum's IIIF server silently caps a single request at about 42 megapixels.** Its Micrio endpoint
(`iiif.micr.io`) answers `full/max` with a downsampled image and no warning — *Daubigny's Garden* arrives at 42 MP
when the scan behind it is 449 MP. Region requests are not capped, so `tools/micrio_stitch.py` pulls each work in
4096 px tiles and reassembles it. Seven works were recovered this way; seams were checked and sit at or below
neighbouring-pixel noise. Anything already at or above target was left alone rather than stitched for its own sake.

**Almost none of these files says what colour it is in.** Checked across all forty: **31 carry no embedded ICC
profile at all**, including every one of the 24 Van Gogh Museum scans. Of the nine that do, only four are sRGB —
*La Berceuse* (Stedelijk) and *Stairway at Auvers* (Saint Louis) are **Adobe RGB (1998)**, a wider gamut, and both
Orsay files are Apple's **Generic RGB Profile**, which is gamma 1.8. Decoding either of those as sRGB shifts the
canvas visibly, and assuming a profile for the 31 that have none is a guess that has to be recorded as one.

This lands hardest on station 2. The flood there is a Nuenen canvas from the Van Gogh Museum against Paris canvases
from Chicago — and *neither side carries a profile*, so neither can be colour-managed from its own file. Both are
assumed sRGB, and that assumption is now written down rather than made silently. `DESIGN.md` §4.1 step 1 and
`BUILD.md` M0b own the decode; the risk table's "station 2's flood survives a profile audit" is this paragraph.

**Audited at M6, and the flood survives.** Of the thirty canvases actually in the piece, **26 carry no profile at
all**; the four that do are the Yale *Night Café* (sRGB), *Stairway at Auvers* (Adobe RGB 1998) and both Orsay files
at stations 6 and 9 (Apple's Generic RGB, gamma 1.8), and all four are converted with the profile they carry. So the
two alternatives `tools/palette.py` bounds the flood against are not hypotheses about what a museum might have done —
they are what two museums in this set actually did. The bound is adversarial and on the *difference*: each station
decoded under whichever of the three pulls the two furthest apart, less the flood that is really there, which is how
much flood a mismatch could forge out of nothing. It comes to **9.2**, and the flood is **39.6** — 4.3×, and 4.7×
with the one Art Institute canvas dropped so that both sides are one museum's rig. The pre-registered bar was 3×.
The risk table's oldest open row closes here.

**Two of the forty are not cropped to the painting.** Whole-canvas coordinates only mean anything if 0 and 1 are the
edges of the *picture*, and a scan carrying a strip of backdrop or stretcher puts every stroke at the wrong fraction
of its canvas — an error invisible in any single tile, because it is a translation plus a scale, and visible the day
two canvases hang beside each other and one is a percent bigger than it should be. Audited at M0b with
`tools/canvas_edge.py`: **38 scans are cropped tight, and two are not** — the Orsay/C2RMF *Bedroom* carries 53 px of
black surround and the Getty *Irises* 32 px of grey backdrop. Both are cropped before extraction and the crop is
recorded in the blob header.

*The first draft of that detector took quiet to mean margin and cropped 503 px of sky off the church at Auvers, which
is 11% of that painting. A dark passage is quiet too. The test that separates them is that **a margin ends and a sky
continues**: activity steps at a real edge and ramps across a dark passage.*

**The Musée d'Orsay publishes nothing usable.** Its IIIF service (`iiif.musee-orsay.fr`) serves a maximum of 850 px
on the long edge, and it holds two canvases this piece cannot do without. Both fall back to Google Art Project copies
on Commons at roughly 46 px/cm — the weakest sources in the set. See "Known gaps" below.

## The scans

| # | work | collection | accession | reproduction | delivered px | MP | canvas cm | px/cm |
|---|---|---|---|---|---|---|---|---|
| 1 | *Study for 'The Potato Eaters'* | Van Gogh Museum, Amsterdam | `s0135V1962r` | museum IIIF (Micrio) | 7479 × 5648 | 42 | 44.5 × 33.6 | **168** |
| 1 | *The Potato Eaters* | Van Gogh Museum, Amsterdam | `s0005V1962` | museum IIIF (Micrio) | 7698 × 5428 | 42 | 114.0 × 82.0 | **68** |
| 2 | *Bank of the Seine* | Van Gogh Museum, Amsterdam | `s0077V1962` | museum IIIF (Micrio) | 7569 × 5194 | 39 | 46.0 × 32.0 | **165** |
| 2 | *Montmartre: Behind the Moulin de la Galette* | Van Gogh Museum, Amsterdam | `s0018V1962` | museum IIIF (Micrio) | 7229 × 5816 | 42 | 100.0 × 81.0 | **72** |
| 2 | *Self-Portrait* | Van Gogh Museum, Amsterdam | `s0155V1962` | museum IIIF (Micrio) | 5303 × 7203 | 38 | 14.1 × 19.1 | **376** |
| 2 | *Self-Portrait (1887)* | Art Institute of Chicago | `1954.326` | Commons · Google Art Project | 4747 × 6000 | 28 | 32.5 × 41.0 | **146** |
| 2 | *Self-Portrait (1887)* | Van Gogh Museum, Amsterdam | `s0065V1962` | museum IIIF (Micrio) | 5828 × 7249 | 42 | 33.0 × 41.0 | **177** |
| 2 | *Self-Portrait as a Painter* | Van Gogh Museum, Amsterdam | `s0022V1962` | museum IIIF (Micrio) | 5309 × 6989 | 37 | 50.0 × 65.1 | **106** |
| 3 | *Almond Blossom* | Van Gogh Museum, Amsterdam | `s0176V1962` | museum IIIF (Micrio) | 7195 × 5676 | 41 | 92.4 × 73.3 | **78** |
| 3 | *Orchard in Blossom* | Van Gogh Museum, Amsterdam | `s0038V1962` | museum IIIF (Micrio) | 7115 × 5599 | 40 | 93.1 × 73.2 | **76** |
| 3 | *The Pink Peach Tree* | Van Gogh Museum, Amsterdam | `s0025V1962` | museum IIIF (Micrio) | 5336 × 7192 | 38 | 60.2 × 80.9 | **89** |
| 3 | *The White Orchard* | Van Gogh Museum, Amsterdam | `s0024V1962` | museum IIIF (Micrio) | 12074 × 8884 | 107 | 81.0 × 60.0 | **149** |
| 3 | *The Pink Orchard* | Van Gogh Museum, Amsterdam | `s0026V1962` | museum IIIF (Micrio), stitched | 6759 × 5362 | 36 | 81.0 × 65.0 | **83** |
| 4 | *The Harvest (The Blue Cart)* | Van Gogh Museum, Amsterdam | `s0030V1962` | museum IIIF (Micrio) | 11382 × 9053 | 103 | 91.8 × 73.4 | **124** |
| 4 | *The Sower* | Van Gogh Museum, Amsterdam | `s0029V1962` | museum IIIF (Micrio) | 7003 × 5625 | 39 | 40.3 × 32.5 | **174** |
| 4 | *Wheatfield with a Reaper* | Van Gogh Museum, Amsterdam | `s0049V1962` | museum IIIF (Micrio) | 12665 × 10012 | 127 | 92.7 × 73.2 | **137** |
| 5 | *Gauguin's Chair* | Van Gogh Museum, Amsterdam | `s0048V1962` | museum IIIF (Micrio) | 5578 × 6978 | 39 | 72.7 × 90.5 | **77** |
| 5 | *La Berceuse (Augustine Roulin)* | Stedelijk Museum, Amsterdam | `A965` | Commons | 4344 × 5258 | 23 | — † | **— †** |
| 5 | *Sunflowers* | National Gallery, London | `NG3863` | Commons | 4719 × 6000 | 28 | — † | **— †** |
| 5 | *Sunflowers* | Van Gogh Museum, Amsterdam | `s0031V1962` | museum IIIF (Micrio) | 6133 × 8061 | 49 | 73.0 × 95.0 | **84** |
| 5 | *The Bedroom (first version)* | Van Gogh Museum, Amsterdam | `s0047V1962` | Commons · Google Art Project ◊ | 30000 × 23803 | 714 | 91.3 × 72.4 | **329** |
| 5 | *The Bedroom (second version)* | Art Institute of Chicago | `1926.417` | Commons · Google Art Project | 7171 × 5596 | 40 | 92.3 × 73.6 | **78** |
| 5 | *The Bedroom (third version)* | Musée d'Orsay — C2RMF scan | `RF1959-2` | Commons · C2RMF research scan | 15016 × 11741 | 176 | 74.0 × 57.5 ◊◊ | **202 ◊◊** |
| 5 | *The Yellow House (The Street)* | Van Gogh Museum, Amsterdam | `s0032V1962` | museum IIIF (Micrio) | 9234 × 7233 | 67 | 91.5 × 72.0 | **101** |
| 5 | *Van Gogh's Chair* | National Gallery, London | `NG3862` | Commons | 4678 × 6000 | 28 | — † | **— †** |
| 6 | *Café Terrace at Night* | Kröller-Müller Museum | `KM 108.565` ✕ | Commons | 6415 × 8000 | 51 | 65.3 × 80.7 ‡‡ | **98 ‡‡** |
| 6 | *Starry Night Over the Rhône* | Musée d'Orsay, Paris | `RF1975-19` | Commons · Google Art Project | 4331 × 3346 | 14 | — † | **— †** |
| 6 | *The Night Café* | Yale University Art Gallery | `1961.18.34` | Commons | 7408 × 5848 | 43 | 92.1 × 72.4 ‡‡ | **80 ‡‡** |
| 7 | *The Red Vineyard* | Pushkin State Museum of Fine Arts, Moscow | `Ж-3372` | Commons · the museum's photograph | 11406 × 9092 | 104 | — § | **— §** |
| 8 | *Cypresses* | The Metropolitan Museum of Art | `1949.30` | Commons | 4177 × 5306 | 22 | — † | **— †** |
| 8 | *Irises* | J. Paul Getty Museum | `90.PA.20` | Commons | 11516 × 8801 | 101 | 94.3 × 74.3 ‡ | **122** |
| 8 | *Irises (still life)* | Van Gogh Museum, Amsterdam | `s0050V1962` | museum IIIF (Micrio) | 13278 × 16806 | 223 | 73.9 × 92.7 | **180** |
| 8 | *Olive Grove* | Van Gogh Museum, Amsterdam | `s0045V1962` | museum IIIF (Micrio) | 12801 × 9998 | 128 | 92.2 × 73.2 | **139** |
| 8 | *Olive Trees with the Alpilles in the Background* | Museum of Modern Art, New York | `581.1998` | Commons · Google Art Project | 4043 × 3211 | 13 | 91.4 × 72.6 | **44** |
| 8 | *The Garden of Saint-Paul's Hospital* | Van Gogh Museum, Amsterdam | `s0046V1962` | museum IIIF (Micrio) | 5619 × 6892 | 39 | 60.8 × 73.8 | **92** |
| 8 | *The Starry Night* | Museum of Modern Art, New York | `472.1941` | Commons · Google Art Project | 44567 × 35291 | 1573 | 92.1 × 73.7 ‡ | **484** |
| 8 | *Wheat Field with Cypresses* | National Gallery, London | `NG3861` | Commons | 10882 × 8653 | 94 | — † | **— †** |
| 9 | *Daubigny's Garden* | Van Gogh Museum, Amsterdam | `s0104V1962` | museum IIIF (Micrio) | 6540 × 6460 | 42 | 51.2 × 51.0 | **128** |
| 9 | *Stairway at Auvers* | Saint Louis Art Museum | `1-1935` | Commons | 6466 × 4569 | 30 | 70.5 × 50.0 ‡‡ | **92 ‡‡** |
| 9 | *Thatched Cottages at Cordeville* | Musée d'Orsay, Paris | `RF 1954-14` ✕ | Commons · Google Art Project | 5067 × 4007 | 20 | 92.0 × 73.0 ‡‡ | **55 ‡‡** |
| 9 | *The Church at Auvers* | Musée d'Orsay, Paris | `RF1951-42` | Commons · Google Art Project | 3434 × 4433 | 15 | 74.5 × 94.0 ‡‡ | **46 ‡‡** |
| 9 | *Wheatfield under Thunderclouds* | Van Gogh Museum, Amsterdam | `s0106V1962` | museum IIIF (Micrio) | 4000 × 1962 | 8 | 101.3 × 50.4 | **39** |
| 10 | *Wheatfield with Crows* | Van Gogh Museum, Amsterdam | `s0149V1962` | museum IIIF (Micrio) | 7762 × 3718 | 29 | 103.0 × 50.5 | **75** |

† Canvas dimensions confirmed from the holder for the Van Gogh Museum works (scraped from the object pages) and for
the Art Institute of Chicago works (its open-access API). For the remaining holders — Orsay, MoMA, Yale, the Getty,
the National Gallery, Kröller-Müller, Saint Louis, the Stedelijk — dimensions are **not yet verified against the
holder's own catalogue** and are left blank rather than filled in from Wikidata, which returns series-level entities
for the three Bedrooms and would have put the same wrong figure against all of them.

◊ **Corrected at M5.** This row said "museum IIIF (Micrio)" and was wrong: the file came from Commons, by way of
Google Art Project, and `tools/sources.tsv` has always said so. It is also internally impossible — this document's
own paragraph above records that the Micrio endpoint caps a single request at about 42 MP, and this is 714. Found by
diffing every row of this table against `sources.tsv`: **one row of forty-one disagreed, and it was the one about to
be used.** The other forty are right.

◊◊ **Verified at M6, and not by the museum.** This footnote said through the whole of M5 that the third *Bedroom*
was the only canvas in the piece whose dimensions no holder confirmed. The Musée d'Orsay still answers a plain
request with 403 — but the Ministry of Culture publishes the catalogue of every *musée de France* in the **Joconde**
database, which is the museum's own record rather than a third party's, and its notice for **RF 1959 2** gives
57.5 cm high by 74 cm wide. That is exactly the figure in general circulation that this footnote entered under
protest. The same database supplied both Auvers canvases at station 9 and corrected an accession number this
repository has had wrong since M0b. What it does **not** hold is *Starry Night Over the Rhône*: fourteen notices
either side of the Orsay's Van Gogh block were read and RF 1975-19 is not among them, so **that** canvas is now the
only one in the piece with no confirmed size. The original text of this footnote is kept below because the reasoning
in it is why the figure was allowed in at all. 74.0 × 57.5 cm was the figure in general circulation; it was entered
as that and not as the museum's, and it was the reason the dagger rule had an exception. What depends on it is the working resolution and
therefore every stroke width in millimetres this canvas reports. What does **not** depend on it is the room: M5's
built treatment recovers a room in units of the painter's eye height and the scan's own aspect, so the one
measurement this canvas is here for survives the dimension being wrong. The scan's aspect after cropping 53 px of
black surround is 1.2834 against this figure's 1.2870 — consistent, which is not confirmation.

✕ **The accession number in this row was wrong and is corrected here.** Two of the forty-one, found at M6 by
asking each holder for a date and being answered with an identifier that did not match. The Kröller-Müller's own
object page for the *Café Terrace* gives **KM 108.565** and no other number; this table and `tools/sources.tsv` both
said KM105.462. Joconde's **RF 1954 15** is *Le jardin du docteur Gachet*, a portrait canvas 73 × 52 cm; *Chaumes de
Cordeville* is **RF 1954 14**, 73 × 92 cm, and this table and `sources.tsv` both said RF1954-15. In both cases the
scan's own aspect confirms the picture is the one this table names, so what was wrong was the number and never the
image. The **filenames under `ref/originals/` still carry the old numbers**, because `tools/fetch.py` wrote them into
the name and every `params/*.json` points at them: renaming would change a source path, which changes a params hash,
which rebuilds forty canvases to fix a string. That is recorded here instead.

‡‡ **Confirmed at M6, when five more canvases entered the piece.** Yale publishes *The Night Café* as 28½ × 36¼ in
(72.4 × 92.1 cm) and the Kröller-Müller publishes the *Café Terrace* as 80,7 × 65,3 cm, each on its own object page.
The Saint Louis Art Museum publishes *Stairway at Auvers* as 19 11/16 × 27¾ in (50 × 70.5 cm). The two Orsay canvases
at station 9 come from the Ministry of Culture's Joconde record, as described under ◊◊: *L'église d'Auvers-sur-Oise*,
RF 1951 42, 94 × 74.5 cm, and *Chaumes de Cordeville à Auvers-sur-Oise*, RF 1954 14, 73 × 92 cm. Every one of those
is height × width in the holder's own order; this table's column is width × height.

‡ **Confirmed at M4, when both canvases entered the piece.** The Getty publishes *Irises* as unframed
74.3 × 94.3 cm on its own object page for `90.PA.20`; MoMA publishes *The Starry Night* as 29 × 36¼ in
(73.7 × 92.1 cm) in its own open collection dataset, which is the museum's data rather than a third party's. Both
are entered here on the holder's authority, and neither is from Wikidata. The rule of the dagger stands for the
rest: a dimension goes in this table when the institution that owns the canvas says so.

*M3 made one exception on purpose and M4 has closed it. `params/irises.json` carried 94.3 × 74.3 cm unverified,
because the canvas was not in any station — it was M3's negative control, a picture that is all ground and has no
horizon in it at all, run through `tools/place.py` to find out whether the horizon test measures a horizon or merely
the strongest edge in any picture. It scored 1.7×, the lowest in the collection. M4 puts it in station 8 as the
ground at your feet, at 1:1, which is a use that depends on the dimension being right rather than only on px/cm —
so it was confirmed against the Getty first, and the figure the museum publishes is the figure the file already had.*

§ **Added after M9, on the author's word, and not confirmed by the holder.** The Pushkin Museum's own page on the
canvas gives neither a size nor an inventory number. The number, **Ж-3372**, is the one both Commons records of the
museum's photographs carry. The size is the edition's, 75 × 93 cm, from its notes to letters 717 and 718, and it is
what `params/redvineyard.json` enters, under a note that says so; one of the two Commons records says 73 × 91
instead. By the edition's width the scan is about 123 px/cm, which is the collection's target. So *Starry Night Over
the Rhône* is no longer the only canvas in the piece whose size nobody who owns it has confirmed: this is the second.
The scan's own shape, 1.2545, is 1.2% from the edition's figure and 0.6% from the other, inside the band the next
section measures. The file the author gave first, `File:Red_vineyards.jpg` at 2001 × 1560, is 3.4% off the canvas's
shape and a sixth of the resolution, and was set aside.

## The scan and the catalogue disagree about the shape

*Measured at M5, when it started to matter.* Whole-canvas coordinates only mean anything if the shape they are
fractions of is right, and there are two answers to what that shape is: the ratio of the centimetres the holder
publishes, and the ratio of the scan's own pixels after `tools/canvas_edge.py` has cropped it to the picture's edge.
**They differ, by 0.1% to 3.1%.**

| canvas | scan | catalogue | apart |
|---|---|---|---|
| *Irises* (Getty) | 1.3084 | 1.2692 | **+3.1%** |
| *The Bedroom* (Chicago) | 1.2815 | 1.2541 | **+2.2%** |
| *Olive Grove* | 1.2804 | 1.2596 | +1.7% |
| *The Starry Night* | 1.2628 | 1.2497 | +1.0% |
| *The Harvest* | 1.2574 | 1.2507 | +0.5% |
| *The Sower* | 1.2451 | 1.2400 | +0.4% |
| *The Bedroom* (Amsterdam) | 1.2603 | 1.2610 | −0.1% |
| *Wheatfield with a Reaper* | 1.2650 | 1.2664 | −0.1% |
| *Self-Portrait* (1887) | 0.8039 | 0.8049 | −0.1% |

The reason is often visible in the figure itself. Chicago publishes 92.3 × 73.6 cm for the second *Bedroom*, which is
36¼ × 29 inches converted, and a rounded inch is ±1.3 cm on a canvas that size. The Van Gogh Museum, measuring its
own canvases in centimetres, agrees with its own scans to a tenth of a percent on all three of its entries here.

So the rule from M5 is **the shape from the scan, the size from the catalogue**: the scan is the artifact and the
holder is the authority on how big it is, and neither is asked the other's question. It changed nothing that could
be seen — all twelve goldens are byte-identical and every horizon ratio holds to a rounding — and it had to be done
before station 5, because the claim that three Bedrooms are the same room is argued at a tolerance of 2% and one of
the three carried a 2.2% error in its own shape.

## When each canvas was painted, and who says so

*Added at M6, when τ stopped being a station-local scrub and became the chronology the whole piece is controlled by.*
This document has refused since M0b to enter a canvas's dimensions unless the institution that owns it says so.
Nothing applied that rule to **dates**, which are the axis. `tools/dates.py` asks the Van Gogh Museum's own object
pages — 24 of the 40 scans are its — and the two Orsay canvases at station 9 come from the Ministry of Culture's
Joconde record. What that turned up is two dates this repository had wrong in files it had already shipped:

| canvas | this repository said | the holder says |
|---|---|---|
| *Sunflowers*, `s0031V1962` | August 1888 | **Arles, January 1889** |
| *Olive Grove*, `s0045V1962` | June to July 1889 | **Saint-Rémy, November 1889** |

The first is not a slipped month, it is the wrong painting: the Van Gogh Museum's canvas is the **repetition**,
painted five months after the London version it repeats. Station 5 has been hanging it as the original beside three
Bedrooms, and it turns out to be a fourth repetition — which makes that station's argument stronger and was not
designed. The second is a plain error, corrected, and station 8's span was widened to hold the canvas rather than the
canvas's date narrowed to fit its station.

Two more canvases were found standing outside their station's dates with nobody having written it down: *The Sower*
is November 1888 at a June 1888 station and has been since M3, and *Orchard in Blossom* is **April 1889** at a
station about the spring of 1888. `tools/station.py` now refuses a canvas whose date is outside its station's span
and has no note beside it. Seven are outside; all seven have notes.

Every date in `stations/*.json` is the holder's own words in `date` and an ISO date in `when`. Where the holder
publishes only a year — the Art Institute for both its canvases, Joconde for the third *Bedroom* — the ISO date is a
month chosen inside that year and the canvas's note says so. The Pushkin gives *early November 1888* for *The Red
Vineyard*, and its `when` is the 5th, inside the week between letter 717, where he is at work on it, and letter 718,
where it is finished.

## Known gaps

| work | station | best available | why it matters |
|---|---|---|---|
| *Starry Night Over the Rhône* | 6 | 4331 × 3346, ~47 px/cm | Orsay. One of the five canvases §7 says must be perfect. The only Commons file above this is a visitor's snapshot of the framed picture on the gallery wall, at an angle — unusable. |
| *The Church at Auvers* | 9 | 3434 × 4433, ~46 px/cm | Orsay. Station 9's facade. The reproduction is clean and flat, just small. |
| *Wheatfield under Thunderclouds* | 9 | 4000 × 1962, ~39 px/cm | The weakest scan in the set; the museum has published nothing better. |
| *The Potato Eaters* | 1 | 7698 × 5428, ~68 px/cm | At Micrio's native size. A 114 cm canvas at 42 MP; the station opens on it. |
| *Sunflowers* (both) | 5 | ~84 px/cm (VGM), ~65 px/cm (London) | Below target, and station 5 wants them enormous and close. |
| *La Berceuse (Augustine Roulin)* | 7 | 3320 × 4230, ~46 px/cm, cropped by hand from the Commons photograph above | **The wrong canvas, from the weakest kind of source, standing in.** Station 7 stops the canvas he was painting when his illness interrupted him, which the edition's notes to letters 741 and 743 identify as F 504 at the Kröller-Müller (KM 109.725). The museum serves it through Micrio at 4800 × 6077, about 66 px/cm, and it has not been fetched. What is here is F 507, the Stedelijk's, the last of the five versions: a gallery photograph of the picture in its gilt frame, cropped to the painted area at (510, 510, 3830, 4740) — its aspect agrees with the edition's 91 × 71.5 cm to a tenth of a percent, so it was taken square on — with two glare streaks near the top edge that are traced as paint. `params/berceuse.json` records all of it. |

The C2RMF scan of the third *Bedroom* (176 MP, from the French national museum research centre rather than from Orsay
itself) shows the route worth trying for the two Orsay gaps: the laboratory, not the museum.

## Rights

Public domain throughout — Van Gogh died in 1890. The Met and the Art Institute of Chicago release their scans CC0;
Yale and the Getty are open access; the Van Gogh Museum publishes downloads of its collection. The Commons files are
mirrors of museum or Google Art Project photography of public-domain works. Nothing here is redistributed by this
project: `ref/` is local working material, and only the derived stroke data (`strokes/*.bin`) is committed.

## Used by *The Dream of Van Gogh*, D5.5

*Sunflowers*, Van Gogh Museum, Amsterdam, `s0031V1962` (the January 1889 repetition, as the correction above says):
its stroke record `strokes/sunflowers-canvas.bin` and flat rendering are copied whole from the sibling's
`strokes/s05/`, unchanged. Eight of its heads, cut out by circles drawn on the flat (`src/flowers.js`), stand on the
shore round the Starry Night's village on the author's word. Nothing was re-extracted; if the record is ever
rebuilt it is rebuilt there and copied again.
