# The paintings

Every work here is by Vincent van Gogh (1853–1890) and is in the public domain. These are the source scans that
`tools/extract.py` will take apart into strokes (DESIGN.md §4.1). The files themselves live in `ref/originals/`, which
is deliberately outside the repository — 1.7 GB of scans does not belong in git.

Gathered 10 September 2026 by `tools/vgm_resolve.py`, `tools/commons_resolve.py`, `tools/fetch.py`,
`tools/fetch_commons.py` and `tools/micrio_stitch.py`. **40 scans, 4.41 gigapixels, 1.70 GB.**

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
| 4 | *The Harvest (The Blue Cart)* | Van Gogh Museum, Amsterdam | `s0030V1962` | museum IIIF (Micrio) | 11382 × 9053 | 103 | 91.8 × 73.4 | **124** |
| 4 | *The Sower* | Van Gogh Museum, Amsterdam | `s0029V1962` | museum IIIF (Micrio) | 7003 × 5625 | 39 | 40.3 × 32.5 | **174** |
| 4 | *Wheatfield with a Reaper* | Van Gogh Museum, Amsterdam | `s0049V1962` | museum IIIF (Micrio) | 12665 × 10012 | 127 | 92.7 × 73.2 | **137** |
| 5 | *Gauguin's Chair* | Van Gogh Museum, Amsterdam | `s0048V1962` | museum IIIF (Micrio) | 5578 × 6978 | 39 | 72.7 × 90.5 | **77** |
| 5 | *La Berceuse (Augustine Roulin)* | Stedelijk Museum, Amsterdam | `A965` | Commons | 4344 × 5258 | 23 | — † | **— †** |
| 5 | *Sunflowers* | National Gallery, London | `NG3863` | Commons | 4719 × 6000 | 28 | — † | **— †** |
| 5 | *Sunflowers* | Van Gogh Museum, Amsterdam | `s0031V1962` | museum IIIF (Micrio) | 6133 × 8061 | 49 | 73.0 × 95.0 | **84** |
| 5 | *The Bedroom (first version)* | Van Gogh Museum, Amsterdam | `s0047V1962` | museum IIIF (Micrio) | 30000 × 23803 | 714 | 91.3 × 72.4 | **329** |
| 5 | *The Bedroom (second version)* | Art Institute of Chicago | `1926.417` | Commons · Google Art Project | 7171 × 5596 | 40 | 92.3 × 73.6 | **78** |
| 5 | *The Bedroom (third version)* | Musée d'Orsay — C2RMF scan | `RF1959-2` | Commons · C2RMF research scan | 15016 × 11741 | 176 | — † | **— †** |
| 5 | *The Yellow House (The Street)* | Van Gogh Museum, Amsterdam | `s0032V1962` | museum IIIF (Micrio) | 9234 × 7233 | 67 | 91.5 × 72.0 | **101** |
| 5 | *Van Gogh's Chair* | National Gallery, London | `NG3862` | Commons | 4678 × 6000 | 28 | — † | **— †** |
| 6 | *Café Terrace at Night* | Kröller-Müller Museum | `KM105.462` | Commons | 6415 × 8000 | 51 | — † | **— †** |
| 6 | *Starry Night Over the Rhône* | Musée d'Orsay, Paris | `RF1975-19` | Commons · Google Art Project | 4331 × 3346 | 14 | — † | **— †** |
| 6 | *The Night Café* | Yale University Art Gallery | `1961.18.34` | Commons | 7408 × 5848 | 43 | — † | **— †** |
| 8 | *Cypresses* | The Metropolitan Museum of Art | `1949.30` | Commons | 4177 × 5306 | 22 | — † | **— †** |
| 8 | *Irises* | J. Paul Getty Museum | `90.PA.20` | Commons | 11516 × 8801 | 101 | — † | **— †** |
| 8 | *Irises (still life)* | Van Gogh Museum, Amsterdam | `s0050V1962` | museum IIIF (Micrio) | 13278 × 16806 | 223 | 73.9 × 92.7 | **180** |
| 8 | *Olive Grove* | Van Gogh Museum, Amsterdam | `s0045V1962` | museum IIIF (Micrio) | 12801 × 9998 | 128 | 92.2 × 73.2 | **139** |
| 8 | *The Garden of Saint-Paul's Hospital* | Van Gogh Museum, Amsterdam | `s0046V1962` | museum IIIF (Micrio) | 5619 × 6892 | 39 | 60.8 × 73.8 | **92** |
| 8 | *The Starry Night* | Museum of Modern Art, New York | `472.1941` | Commons · Google Art Project | 44567 × 35291 | 1573 | — † | **— †** |
| 8 | *Wheat Field with Cypresses* | National Gallery, London | `NG3861` | Commons | 10882 × 8653 | 94 | — † | **— †** |
| 9 | *Daubigny's Garden* | Van Gogh Museum, Amsterdam | `s0104V1962` | museum IIIF (Micrio) | 6540 × 6460 | 42 | 51.2 × 51.0 | **128** |
| 9 | *Stairway at Auvers* | Saint Louis Art Museum | `1-1935` | Commons | 6466 × 4569 | 30 | — † | **— †** |
| 9 | *Thatched Cottages at Cordeville* | Musée d'Orsay, Paris | `RF1954-15` | Commons · Google Art Project | 5067 × 4007 | 20 | — † | **— †** |
| 9 | *The Church at Auvers* | Musée d'Orsay, Paris | `RF1951-42` | Commons · Google Art Project | 3434 × 4433 | 15 | — † | **— †** |
| 9 | *Wheatfield under Thunderclouds* | Van Gogh Museum, Amsterdam | `s0106V1962` | museum IIIF (Micrio) | 4000 × 1962 | 8 | 101.3 × 50.4 | **39** |
| 10 | *Wheatfield with Crows* | Van Gogh Museum, Amsterdam | `s0149V1962` | museum IIIF (Micrio) | 7762 × 3718 | 29 | 103.0 × 50.5 | **75** |

† Canvas dimensions confirmed from the holder for the Van Gogh Museum works (scraped from the object pages) and for
the Art Institute of Chicago works (its open-access API). For the remaining holders — Orsay, MoMA, Yale, the Getty,
the National Gallery, Kröller-Müller, Saint Louis, the Stedelijk — dimensions are **not yet verified against the
holder's own catalogue** and are left blank rather than filled in from Wikidata, which returns series-level entities
for the three Bedrooms and would have put the same wrong figure against all of them.

*One exception, and it is an exception on purpose. `params/irises.json` carries 94.3 × 74.3 cm for the Getty
*Irises*, which is **not** verified against the Getty's catalogue and is not entered in the table above. The canvas
is not in any station: it is M3's negative control, a picture that is all ground and has no horizon in it at all, run
through `tools/place.py` to find out whether the horizon test is measuring a horizon or merely the strongest edge in
any picture. The dimension enters that answer only through px/cm, which sets the tracer's smoothing scales; the test
itself is a ratio of two colour splits and is scale-free. If the canvas is ever wanted for the piece, the dimension
has to be confirmed first like every other.*

## Known gaps

| work | station | best available | why it matters |
|---|---|---|---|
| *Starry Night Over the Rhône* | 6 | 4331 × 3346, ~47 px/cm | Orsay. One of the five canvases §7 says must be perfect. The only Commons file above this is a visitor's snapshot of the framed picture on the gallery wall, at an angle — unusable. |
| *The Church at Auvers* | 9 | 3434 × 4433, ~46 px/cm | Orsay. Station 9's facade. The reproduction is clean and flat, just small. |
| *Wheatfield under Thunderclouds* | 9 | 4000 × 1962, ~39 px/cm | The weakest scan in the set; the museum has published nothing better. |
| *The Potato Eaters* | 1 | 7698 × 5428, ~68 px/cm | At Micrio's native size. A 114 cm canvas at 42 MP; the station opens on it. |
| *Sunflowers* (both) | 5 | ~84 px/cm (VGM), ~65 px/cm (London) | Below target, and station 5 wants them enormous and close. |

The C2RMF scan of the third *Bedroom* (176 MP, from the French national museum research centre rather than from Orsay
itself) shows the route worth trying for the two Orsay gaps: the laboratory, not the museum.

## Rights

Public domain throughout — Van Gogh died in 1890. The Met and the Art Institute of Chicago release their scans CC0;
Yale and the Getty are open access; the Van Gogh Museum publishes downloads of its collection. The Commons files are
mirrors of museum or Google Art Project photography of public-domain works. Nothing here is redistributed by this
project: `ref/` is local working material, and only the derived stroke data (`strokes/*.bin`) is committed.
