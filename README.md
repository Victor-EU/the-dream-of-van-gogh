# The Dream of Van Gogh

The world is the painting. You stand on a knoll over Saint-Rémy at night, and everything round you is made of
his strokes: the sky is a dome of his sky, seven swirls turning in it, his stars and his moon each a core with
its rings, and each ring turning at its own rate; the hills roll down to a river with the stars laid in it; the
village has houses with lit windows and a church with a spire; a cypress stands beside you, a flame of his
near-black greens, swaying; and his sunflowers — the heads whole, out of the Van Gogh Museum's *Sunflowers* —
fill a plot in rows between you and the village, thousands of them facing you, whole where you stand and dabs
far off, and drift loose through the air, big,
spinning, some passing close. The
arrows go where you look.

Every colour is his, region by region of *The Starry Night*'s stroke record: the sky's blues and the swirl's pale
bands, the stars' yellows, the moon's, the hills', the village's and its lamps', the cypress's. What is ours is
the shape of the world. This is the piece the author asked for at the second user test (20 September 2026): *the
world is the painting — take the elements of the painting, reproduce them in 3D, make the sky like the starry
night; forget about the design.* `DESIGN.md` is that design, kept as the record of the piece this grew out of, with
the author's word at its top; `BUILD.md` is the plan and the log, and its last entry, E0, is this.

It opens on the painting. *The Starry Night* paints itself on primed linen from its own stroke record while the
world is built behind it; then the eye goes into it, and the world paints itself in round you over seven
seconds — the sky first, then the ground, the village, the cypress, the stars, and the sunflowers last. It makes
no sound.

`Space`, and the dream flies you. It is a film in one take, three minutes long and silent: from his eye on the knoll
down into the sunflowers and along a row of them to the village, up the street between the lit windows and up the
spire, where the clock nearly stops and the loose sunflowers hang; a fall to the river, low over the stars in the
water to the moon's gold; a wide turning climb out of it with the valley wheeling under you; a glide into the great
swirl; and down the morning star's well, through its turning rings, to its core. There the light takes the frame,
and you wake on the knoll with the world painting itself in round you again. Two black bands close in as a film's
frame does, and four of his lines come in the lower one, one an act. A drag looks round while the dream carries
you; an arrow, a place key, `Esc` or `Space` hands the body back where it is, and it comes to rest. On a phone,
*the dream* in the corner.

Its sibling, *The World of Van Gogh* (github.com/Victor-EU/the-world-of-van-gogh), is a walk along a road through
fourteen of his paintings. This piece is built clean beside it, from the same stroke records.

## Run it

It is live at <https://the-dream-of-van-gogh.telbase.ai>. `tools/deploy.py` puts a commit there, each script at an
address made of its content, so that a browser which has been before gets the new page with the new scripts
(the host keeps a script for a year otherwise). To run it here:

```bash
python3 -m http.server 8712
```

Then <http://127.0.0.1:8712/>. Drag to look. `↑` goes where you look, `↓` back, `←` `→` turn, `Shift` is faster,
and nothing pressed is nothing: the body stands until a key is held. There is a ground under you and you go over
it, and the higher you are the faster you go: near the ground you walk, and a star 1,500 m up is half a minute
away, ten seconds with `Shift`, and grows the whole way. The sky has depth -- its night lies 830 to 2,250 m out,
each swirl is a well you fly into, and each star a well of turning rings down to its core, which is as far as you
go. `1` carries you back to the knoll, `2` over the village, `3` into the great swirl, `4` to the morning star;
touch the controls and the carry lets you go. `Space` the dream (above), `H` the keys, `L` what is here — how many
strokes each thing is made of. Flags: `?at=1|2|3|4` (start at a place, no opening), `?flowers=300` (how many in
the air; 150 by default), `?sky=0.5`, `?ground=0.5` and `?motes=0` (the sky's, the ground's and the motes'
counts), `?no<thing>` and `?only=<thing>` for `sky`, `stars`, `ground`, `river`, `village`, `cypress`, `field`,
`flowers`, `motes`; `?noStrokes` (the bare ground and the night gradient, nothing else), `?nopart`, `?nocurl`,
`?nounder`, `?glow=0` (no emission), `?exposure=`, `?bloom=`, `?sat=` (the grade), `?test` (the body still, no
curl, no parting), `?t=` (the clock frozen), `?dbg`, `?nogov` (no pixel-ratio governor), `?q=low|mid|high`,
`?flight=glide|swoop|village`, `?hold` (the painting left up until `dream.holdOpen(false)`), `?dream` (the film
begins when the opening has gone into the painting, for a screen left running), `?dream=<t>` (straight into the film
at `t` seconds, no opening), `?nocaption` (no lines).

## The tools

`tools/shot.py` takes headless pictures and runs the three fixed flights; it needs the page served on 8712 and a
`.venv` with playwright (`python3 -m venv .venv && .venv/bin/pip install numpy scipy pillow playwright &&
.venv/bin/playwright install chromium`). The harness on `window.dream` has `state()`, `go({pos, yaw, pitch})`,
`place(n)`, `wait(secs)`, `sim(secs)`, `flight(name)`, `reveal(v)`, `parts()`, `village()`, `flowers()`,
`ground(x, z)`, `project(p)`, `layers({only})`, `render()` (one frame drawn now, for a page that is not being
animated), and `film`: `play(t)`, `stop()`, `seek(t)` (with `freeze` to hold a frame), `state()`, `shots()` and
`audit()` -- the whole film sampled for the least room it leaves from the ground, the houses, the church and the
cypresses, and its fastest, its hardest turn of the eye, its most bank and its hardest pull.

The rest of `tools/` — the depth laws, the region masks, the wind fit, the hand measurements, the standpoint,
seam, reflection and floor tests — belongs to the design this piece grew out of (D0 to D5.5 in `BUILD.md`). Of
their outputs the runtime still reads `strokes/starry-canvas.bin`, `strokes/sunflowers-canvas.bin` and
`hand/starry-region.bin`, which says which region of the canvas each stroke of his lies in, and nothing else.
They are kept as the record; none of them is run again.
