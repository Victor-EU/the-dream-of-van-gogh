# The Dream of Van Gogh — design

*Written before the build, on 19 September 2026. Later changes, if any, go at the top, dated, each on the author's
word and each pointing at the entry in `BUILD.md` that records what was found.*

> **Changed in the build, D0 (19 September 2026).** Three things, each recorded under D0 in `BUILD.md`. (1) The
> standpoint test of §4.4 fails as written: the record's flat is drawn by a different brush, and SSIM against it is
> 0.44 by texture alone. The geometry is tested against the runtime's own flat instead, where it passes at 0.87, and
> the colour against the record by the cell count, where it does not yet pass and the log says by how much. (2) The
> Starry Night's standpoint is 40 m up and pitched 8°, not 30°: with a sea under the eye, 30° hangs the village above
> the horizontal. (3) §4.5's light: a flat face is exactly the record's colour from every side, and the moon lights
> the relief only; the sibling's filmic tone curve is switched off. The rest of §4 stands.

> **Changed in the build, D1 (20 September 2026).** Three things, each recorded under D1 in `BUILD.md`. (1) §4.7's
> residual, pre-registered at 15° against his sky strokes, sits on the scatter of his own hand: a stroke lies 14.8°
> off the common direction of its neighbours within 2.5 cm, so no smooth field can reach 15° on strokes. The fit
> is judged against his *bands*, each stroke's neighbourhood, where it reaches 15.4°; on strokes it is 21.7°, and
> both are logged. The fit needs an in-flow to lay his spirals, but §4.7 gives a vortex a turn and a strength, and
> a flown in-flow is a sink a body hangs at; the flown field turns without drawing in. And the plan's speeds, 2 m/s
> open and 8 in an eddy, make the eddies weaker against the drift than the lines say (the fit has the great eddy
> at 24 times the drift), so the flown field explains less of his sky than the fit does, by a number in the log.
> (2) §6.4's lift is along each eddy's axis, away from his eye, not straight up: a uniform lift added inside a
> vortex does not lift, it moves the closed orbits aside, measured. Along the axis the carry is a helix down the
> tunnel the depth law makes. (3) §6.5's third of a second out and two seconds back are distances along the line
> of flight at the body's speed, so that the paint parts the same at a glide and at a swoop. The rest of §3, §4
> and §6 stands.

> **Changed in the build, D2 (20 September 2026).** Four things, each recorded under D2 in `BUILD.md`. (1) §4.6's
> hand is a boundary as well as a set of distributions. His sky is not the same everywhere: its corners are a
> tenth darker than its mean, and a stroke at the edge of his cone covers two fifths less angle than the same
> stroke at its middle, because a canvas is flat and its edge is farther off and turned away. A generator that
> knows only his averages meets his edge with a step in it, which is the milestone's own question. So
> `tools/hand.py` walks the edge of his cone and writes down what his sky is doing along it, and ours carries his
> own value outward and lets go — over five degrees for the paint, which is how long his paint stays itself, and
> twelve for the size, which is not his composition but his canvas's perspective and is smooth across the whole
> cone. That is not a blend of two textures; it is his measurement as the boundary condition of ours. (2) §4.6's
> colour is banded in space on every one of its axes, not on one with noise on the rest. Two strokes of his a
> degree apart differ by about a quarter of the range along each of the three axes his sky's colours lie on, where
> chance would give a third; a generator that bands the first and scatters the other two speckles, and the speckle
> is what the eye finds. Ours lays two fields of the same measured shape over each other, one for each of the two
> axes that carry 99% of his colour, and leaves only the third to chance. (3) §4.5's thickness stands along the
> stroke's own ray from the standpoint, which is the way paint stands off a canvas, and not along the face that
> turns to the eye: along the face it would hide behind the stroke from every angle and never be an underside at
> all. Along the ray it hides exactly at his eye, which is what the standpoint test needs, and from anywhere else
> the stroke has a body. (4) §12's count for our sky was a guess of sixty thousand, and his own density says
> ninety-four: his sky holds 16,562 strokes a steradian, and the sky outside his cone and above the water is 5.7
> steradians. The ribbon budget follows from that, and the log says what it costs.

> **Changed in the build, D3 (20 September 2026).** Five things, each recorded under D3 in `BUILD.md`. (1) §5.2's
> law of a reflection is not the one the build plan wrote down. The plan asked for a column's length by its
> light's height and brightness; his ten columns on the Rhone say otherwise. Every one of them reaches the same
> depth below his waterline whatever lamp stands over it — 0.206 of his canvas height, with a spread of a ninth
> across the ten, against the lamp's height r = 0.30 and against its brightness r = 0.10, n = 10. That is what a
> reflection does: the near end of a glitter path is where the water would have to tilt further than it does to
> send the light to the eye, and that is set by the water and by how high the eye is, not by the lamp. What does
> follow the lamp is how much paint the column carries (r = 0.54). So a column's length comes from one measured
> number, the slope of his water, and its paint from the light's brightness, and the criterion in `BUILD.md` is
> logged as failing as written and passing as his canvas rewrites it. (2) §5.2's *near black, with the sky's
> colour in it* is the plane, and what `tools/columns.py` measures between his columns is paint. His water is his
> sky times [0.62, 0.55, 0.47] channel by channel; putting that on our plane, whose sky is a denser and brighter
> night than his Rhone's, gives a lit floor under the whole dream. The hue of his water is taken exactly and the
> darkness is taken as his ratio of brightness, 0.54, against the dark this night's sky stands on rather than
> against the paint that stands on it. It is the same distinction D2 drew for the relief: his paint is not his
> ground. (3) §5.4's linen has nothing to say about the floor. A ray is linen in the measure that it leaves the
> dream soon, and a ray that hits water does not leave at all: the water simply ends where the dream does and the
> dome carries on in the same colour. Before D3 the water went to linen past 2.5 km, and from any eye near it
> that was a bright line along the whole horizon — the edge of the canvas seen edge-on. (4) §6.3's soft floor is
> a deceleration and not a factor on the speed. A factor scales with how fast you are already going, so a swoop
> at forty metres a second was stopped in a fifth of a second, which is a wall with a soft name. The descent is
> now held to the speed a constant fifteen metres a second squared could still stop from here, so every descent
> is slowed at the same rate and arrives at a walking pace. (5) §5.1's *between the cones there is the sea, our
> sky over it, and the reflections* is a rule and not a description. Nothing of ours lies on the water inside his
> cone: his village lies on that same water, at the same height, and a reflection of ours there stands in front
> of his paint. With the reflections let into his cone the standpoint test of §4.4 falls to 0.843 with six cells
> over the limit; kept out of it, it is 0.871 and none.

> **Changed by the author at the D4 gate, D4.5 (20 September 2026).** §5.1 is overruled. It answered its own
> question before it was asked -- *a dream's geography, islands of place with nothing between, said in the caption
> rather than hidden* -- and the author, asked the gate's question, answered: **it is one dream and one world, and
> the paintings have to be one night.** So the piece no longer declares the gaps; it closes them. What that costs
> and what it is measured by is under D4.5 in `BUILD.md`, and six things follow.
> (1) **The floor of the world is not water.** §5.2's unbounded plane at height zero is the reason the three cones
> read as pictures on a pond: all three of his grounds are `plane y: 0` laws, so his village at Saint-Remy, his
> pavement in the Place du Forum and the Rhone itself were one and the same surface, and that surface was the
> river. The floor becomes a river and a shore. The river is his: a band between the two banks his own canvas
> measures, the near one where the bottom of his frame meets the water and the far one at his 220 m. The shore is
> the rest, at one height.
> (2) **The height of the shore is not authored: it is the height of a standing man.** His Rhone eye is 4.411 m
> over the water and his terrace eye 1.65 m over his pavement, and both numbers were derived in D4 from a person
> 1.65 m tall. A man standing on a quay puts the quay 4.411 - 1.65 = 2.761 m over the river. Set the shore there
> and all three of his grounds land on it exactly and at once: the terrace's pavement (eye 4.411 - 1.65), the
> Starry Night's village (eye 42.761 - 40) and the Rhone's water (eye 4.411 - 4.411). One ground, and the number
> that joins them is a man's eye.
> (3) **His three nights are not one night, and ours was only one of them.** Measured: his sky is (0.080, 0.144,
> 0.277) at Saint-Remy, (0.034, 0.061, 0.077) over the Rhone and (0.010, 0.065, 0.220) over the terrace -- the
> Rhone's night is a dim green-blue, the terrace's the ultramarine of *a night without black*, and Saint-Remy's
> two and a half times brighter than either. Our sky was Saint-Remy's everywhere, so at the Rhone's cone it stood
> +149% off his own sky and at the terrace's +131%, against the ten per cent D2 holds a seam to. §5.3 gains a
> field: our sky keeps his hand, which is one painter's, and takes its colour from the canvas nearest, exactly
> his at each standpoint and blended between. The dome and the water take the same field, so the colour of the
> night changes as you fly from one town to the other. And the two Arles canvases turn out never to have
> disagreed: **the Rhone's sky is 1.0 to 17.6 degrees above the horizontal and the terrace's is 18.8 to 35.2, and
> the two bands do not touch.** One painted the horizon and the other the top of the sky, and the Starry Night,
> whose sky spans both, says what they both say about a night going up -- greener and lighter low, a purer and
> darker blue high. So the field is in place *and* in elevation: a canvas speaks for the band of sky it painted.
> (4) **A sky built round one eye is a bubble.** §5.3's *from the sky's near distance to its far one* was built as
> one shell round the Starry Night's eye, and from the quay 767 m away that left **seven of twelve** compass bins
> with no sky of ours in them at all, and one with six times his density. Our sky becomes three fields, one round
> each standpoint at that canvas's own sky depths, each weighted by how near it is, so that every standpoint has
> his density overhead in every direction and the three add to one sky.
> (5) **The shore is paint, in his hand, like the sea.** §5.2's sea took every measure of his Rhone water's mark
> at a density of ours. The shore does the same with the only ground he painted as a surface -- the terrace's
> pavement -- and takes its colour from the only unlit ground he painted, the Starry Night's village, by D3's
> rule: his hue, and his brightness as a ratio against the night's own sky. The ledger calls it ours.
> (6) **§5.1's placement follows the geography and not the other way round.** Saint-Remy stood at x = 0, which is
> in the river; it moves onto the shore, upstream of Arles and on the same bank, so that the village, the square
> and the quay are one shore with the water along it. §5.1's *three cones, one sea* becomes **one shore, one
> river, three standpoints on it**. The cone rule of D4 (3) stands unchanged and is what still keeps each
> painting its own.

> **Changed in the build, D4 (20 September 2026).** Six things, each recorded under D4 in `BUILD.md`. (1) §4.2's
> standpoints for the Rhone and the terrace are not authored numbers, because each canvas fixes its own. The Rhone
> gives two: its far bank stands on the water at the plan's 220 m, so its waterline must lie that far below the
> horizontal; and the couple on the shore are 1.65 m tall where they stand. Solved together those put his eye
> 4.41 m over the water and pitch it 2.14 degrees *down*, not six up -- at six up his far bank floats above the
> horizontal, which nothing standing on water can do. The terrace gives one: the waiter in the road is 1.65 m
> tall, which puts him 17.1 m off, and his head sits at v 0.580; a standing eye sees a standing man's head on the
> horizon, so the horizon is at v 0.580 and the pitch is +5.19, not +14. The eye heights, 4.41 m and 1.65 m, come
> with them and are not chosen. (2) §4.3 needs two more laws for the one canvas with walls. A `plane` may be a
> ceiling as well as a floor -- an awning 3.65 m up is the same law read upward, and it puts the cafe's canopy at
> 4 m over your head and 17 at its far end. A `wall` is a vertical plane: `d = c / (n . r)` for a horizontal
> normal at a bearing from the canvas's own forward. Three regions of the terrace are one of those two, and the
> tables are neither: a table top is 0.9 m under the eye where the pavement is 1.65, so a table is the pavement
> at 0.545 of its distance, which is the whole of it. (3) §5.1's rule, which D3 read for our strokes, is general:
> **inside a cone there is his painting and nothing else** -- not our sky, not a reflection, not a mote, and not
> another canvas of his. That is what lets three standpoint tests stand with all three canvases in the air, and
> it is one line in the shader. The placement is then free of the test, and is chosen instead so that the rule
> costs nothing: the two Arles cones stand back to back on one quay, the river in front and the square behind,
> and Saint-Remy stands off across the water. (4) §9's line for *The Starry Night* does not survive the check.
> Letter 777's morning star is Venus seen from a window, the edition puts no work on that paragraph, and the one
> note within two paragraphs of it names *Starry Night Over the Rhone* -- so by the sibling's own rule the line
> may not stand at the canvas by an explanation. It becomes letter 782, whose note identifies F 612 at the
> paragraph itself. And §9's *never again unless asked (`L`)* is resolved against §11, which gives `L` to the
> ledger: the ledger carries all three lines with their letters, so the line can always be read again and there
> are still four keys. (5) §15's three questions for this milestone are answered. §15.9: the couple are at 12.3 m,
> not four, and they are two flat shells and stay so. §15.6: eight hundred metres became 767 and 860 between the
> towns and 300 within Arles, which is what §5.1's own sentence asks for. §15.3: the hollowness is left as it is.
> The third answer -- continuing the facade in the hand of his facade strokes -- would be paint of a thing he
> never painted, which is the line §2 draws, and the screenshots are in the log so that a reader can disagree.
> (6) §5.2's water has a hand and it is a covering. His Rhone's 8,415 water marks cover the water of his canvas
> two and a half times over: paint over paint, not a sprinkle. An unbounded sea cannot be paid for at that price,
> so our sea carries every measure of his mark -- its length and width against the spacing round it, how far off
> the wave's line it lies, its paint, its bow, its curl -- at a density that is ours, and the ledger calls it
> ours, exactly as §5.3 does for the motes. The rest of §4, §5, §9 and §15 stands.

> **Changed by the author on §15.10, D4.6 (20 September 2026).** §15.10 closed D4.5 as answered in the numbers and
> open to the eye: one shore, one river, and a bank between them that from a hundred metres up cannot be seen. The
> author's word was to fix it, and of the two ways §15.10 named -- measuring D3's floor again, or putting lights on
> a town he never painted -- the second is the line §2 draws. So it is the first, and D3's rule is not overturned
> but finished. **The floor keeps his hue exactly and his own ratio of brightness; what that ratio is taken against
> is no longer chosen by hand, it is measured.** D3 had two references to pick between and said which it took: his
> ground over his sky's *paint*, which on a sky as sparse as ours gives a floor brighter than the sky over it, or
> over the *dark that paint stands on*, which is what it took. Our sky is neither of those. It is his paint at a
> coverage, and what a ground stands under is what actually arrives there -- which can be rendered and read.
> `dream.light` takes five faces of a cube from a place, keeps the upper hemisphere of them, and returns the
> solid-angle mean of everything in it: our ribbons, his canvas where a cone opens overhead, the dome behind both.
> Over the floor under his three standpoints it is **0.0412, 0.0169 and 0.0275**, against his own three skies'
> 0.1479, 0.0562 and 0.0646 -- our night is between a quarter and a half of his -- and the dark D3 took its ratio
> against was 0.0140, ten and a half times under his own sky. That factor was already written down in the source,
> with a flag on it: *?wet= ... at about ten the plane is as bright against this night's sky as his paint is
> against his.* Three things follow. (1) `?wet` and `?dry`, the two judgements left open on the floor, are gone,
> and there is no authored number in it. (2) The three measurements are taken once, a few frames in and not at
> boot, and between them the floor takes the same weights the night's colour does, so the floor is one field and
> not three steps. (3) A mark lying on the floor dims with the floor it lies on -- each against the night its own
> canvas was painted under -- so that his paint and his ground keep the ratio his canvas has. §5.2's own sentence
> is untouched: the floor is still not a thing you see, still no surface and nothing modelled, a colour and marks
> lying at its height. It is the right colour now. What it costs and what it is measured by is under D4.6 in
> `BUILD.md`.

> **Changed by the author, D5 (20 September 2026).** **§10 is struck. The piece is silent.** One of its four
> layers was built -- the water, in D3, measured and logged -- and the author listened to it and said: *remove
> the background sound, current sound is too bad.* So it goes, and the three layers D5 was to add with it: the
> wind by your speed, the eddies' tone, the square's murmur. `src/audio.js` is deleted rather than left unwired,
> because a file that is not in the piece is not in the piece; `M` stops being a key and §11's four become three;
> `?nosound` and `dream.sound()` go with them. The design's reasoning for sound was that each layer is keyed to
> something you are doing, and nothing in that argument says a night must be heard at all. If sound comes back it
> starts again from nothing and from the author's word, not from this section. The D3 log keeps what was measured
> about his water, which was never only about sound.

---

**What this is.** A second piece, built clean, from the same stroke records as its sibling *The World of Van Gogh*
(the folder beside this one, `../The world of Van Gogh`, and github.com/Victor-EU/the-world-of-van-gogh). The sibling
is a walk along a road through fourteen of his paintings, each the door into its own world, with an eye at 1.65 m
that never leaves the ground. This is one night, and you are in the air. Nothing of the sibling's architecture is
kept. Five of its files are, because they are finished libraries and not architecture, and §13 names them.

**What it is made of.** Four of his night canvases, painted within nine months of each other: *Café Terrace at
Night* and *Starry Night Over the Rhône* (Arles, September 1888), *The Night Café* (Arles, the same month), and *The
Starry Night* (Saint-Rémy, June 1889). Their strokes were extracted from museum scans by the sibling's pipeline and
are the whole material of this piece. Three of them fly. The fourth is a room, and this piece has no indoors (§8).

---

## 1. Thesis: we take death to go to a star; a dream takes flight

In July 1888, a month before he painted the first of these canvases, he wrote to Theo that the sight of the stars
made him dream the way the black spots on a map, the towns and villages, made him dream — and asked why the spots of
light in the sky should be less reachable than the spots on the map of France. His answer was that they are not,
only that the fare is different: *just as we take the train to go to Tarascon or Rouen, we take death to go to a
star* (letter 638). While alive, he wrote, we cannot go to a star.

That sentence is the piece. **It is the night as he painted it, with the one condition removed.** You are in the air
among his strokes, and the star is a place you can fly to.

Three facts make this honest rather than sentimental:

1. **The Starry Night is already a dream.** He painted it in the asylum by day, from memory of what he saw before
   sunrise from his window — *nothing but the morning star, which looked very big* (letter 777) — and the village
   under it is invented. The view from his window had no village and no spire like that. So the sky of this piece is
   not our dream of his; it is his own, and the licence to fly in it is his.
2. **The night was where he went to look for what he could not name.** Two weeks before the Rhône he wrote that he
   had a tremendous need for — *shall I say the word — for religion*, and so he went outside at night to paint the
   stars (letter 691). To Wil, that the night was *even more richly coloured than the day* (letter 678). The night
   canvases are the ones where he was reaching. This piece is about reaching, and its one control is going where you
   look.
3. **His mark is a recording of a gesture,** which the sibling's design argued at length and this one takes as given.
   The consequence here is different. On the road you watched the gesture being laid down. In the air you pass it at
   arm's length, at every altitude, and read the loading, the turn and the lift of a stroke ten metres long. The hand
   is felt not in the laying-down but in the shape of the thing you fly past.

> **The subject of this piece is his night, entered. The material is his paint, and only his paint, in the air.**

### The two tests for close calls

When a decision is balanced, ask, in this order:

1. **Does this feel like flying in his paint, or like a game with a Van Gogh skin?** A level with a nice palette
   loses. A world you could survey from above, with a map in it, loses.
2. **Is this mark his, or ours?** Ours are permitted only where his are absent, only drawn from his own strokes'
   measured distributions (§4.6), and only where the ledger (§11) says so. A mark that is ours where his could have
   been loses.

---

## 2. What this is not

**Not the sibling with a fly mode.** The sibling's §6 said: *no fly mode. Flight belongs to a world you survey.
This one you stand in.* That was right for that piece and it is not contradicted here. This one you do not survey
either. There is no altitude from which it becomes a map, because there is no map: at every height there is paint
at arm's length, and the highest thing in it is bare linen. The sibling refused flight because flight surveys. This
piece uses it because a dream does not.

**Not an immersive projection show.** They move the finished image around a room. Here the image is exploded into a
volume and you are inside its geometry. The test: from anywhere but his standpoint, a screenshot of this shows a
painting that does not exist. If a screenshot could be one of those shows, we have failed.

**Not a modelled Provence painted in his colours.** The sibling's build log names the failure this kind of piece is
likeliest to die of: *a game level, painted*. Its Rule 2 — nothing in the world that is not a stroke — died in its
ninth milestone, when houses became boxes with paint sprayed on. Here the rule is revived and made easy to keep,
because there are no houses. There are his strokes of houses, given depth. Nothing in this piece is modelled: not a
wall, not a tree, not the water. §3.1 says how that is possible.

**Not a flight simulator and not a game.** No altitude, no speed, no fuel, no collision, no landing, no score, no
route, no end.

**Not the *town made of paint*** (`van-goghs-town.surge.sh`), which builds a generic town from procedural strokes
and lets you fly over it. That is a toy about the look. This has no generic anything: three real standpoints, three
real canvases, and what lies between them declared as ours.

---

## 3. The three moves

### 3.1 The explosion: a painting is a set of rays, and a dream is the freedom to go down them

A painting is what one eye saw from one place. Every stroke on it lies on a ray from that eye. Give each stroke a
distance along its ray and the painting comes apart into a volume: the sky strokes hundreds of metres out and metres
long, the façade strokes twenty metres out at their real size, the quay strokes at your feet, the water's reflections
lying on the water. **Stand at his eye and you see the painting exactly. Move and it comes apart.** Nothing is
animated to make this happen; it is what the geometry does.

What is measured: the rays. They follow from the stroke's place on the canvas and the standpoint's field of view,
and nothing else. What is authored: the distance, by region of the canvas (§4.3) — a person looking at the canvas
and typing metres, as the sibling's shell treatment already did, and declared in the same words. What is checked:
that from the standpoint the frame reproduces the flat rendering of the record (§4.4, the standpoint test). The
dream's one licence over the sibling's shell is scale: the sky is put far, so that its strokes are huge.

Three such explosions, on one dark sea, are the world (§5).

### 3.2 The wind: the flow his strokes lie along is the air you fly in

The Starry Night's sky strokes lie along a flow: bands that run with the wind and curl into two eddies and a moon's
halo. In this piece that flow **is** the air. A velocity field is fitted to his strokes' tangents (§4.7), extended
into three dimensions, and the flyer is a particle in it: the currents carry you, the eddies turn you and lift you,
and letting go means being carried. His strokes turn on their own curls, at the amplitude the pipeline measured for
each one. You are, in effect, one more of his strokes.

This is the one invention the piece is built on, and it is declared as such. What makes it more than a conceit is
that the field is fitted, not drawn: the eddies are where his strokes say they are, turning the way his strokes turn.

### 3.3 Parting, not collision

Nothing stops you. Any stroke within a few metres of the eye bends aside, around you, along the shortest way out,
and returns behind you. A wall of paint is a flock. A star's rings open and close as you go through. This is the
only rule of contact in the piece, it is the physics of a dream, and it removes collision, landing and gravity from
the design at once.

---

## 4. The stroke system

### 4.1 The records

The sibling's pipeline (`tools/` there: `extract.py` → `order.py` → `pack.py`) turns a museum scan into a stroke
record, `<slug>-canvas.bin`: 24 bytes a stroke — three control points of a quadratic arc in canvas coordinates, its
colour, its width, the amplitude of its curl (how far it can slide along its own arc before the paint under it stops
being a colour it could have been traced from), and his order, a fraction of the sequence. Beside each record an
underlayer image and a flat rendering, `-flat.png`, which is the pipeline's own picture of the record and the thing
§4.4 tests against. The records are copied from the sibling and not re-extracted; if one is ever rebuilt it is
rebuilt there, with its parameters, and copied again.

| canvas | record | strokes | canvas, cm | collection |
|---|---|---|---|---|
| *The Starry Night*, June 1889 | `starry` | 13,999 | 73.7 × 92.1 | Museum of Modern Art, New York, 472.1941 |
| *Starry Night Over the Rhône*, September 1888 | `rhone` | 14,859 | 72.5 × 92 | Musée d'Orsay, Paris, RF 1975-19 |
| *Café Terrace at Night*, c. 16 September 1888 | `cafeterrace` | 9,796 | 80.7 × 65.3 | Kröller-Müller Museum, Otterlo, KM 108.565 |
| *The Night Café*, September 1888 | `nightcafe` | 13,133 | 72.4 × 92.1 | Yale University Art Gallery, 1961.18.34 |

Three fly: 38,654 strokes of his. The Night Café's record is kept in the folder and not loaded (§8).

### 4.2 The standpoint

Each canvas gets one eye: a position in the world, a heading, a pitch, and a horizontal field of view. The field of
view fixes the focal length in canvas units, `f = (W / 2) / tan(hfov / 2)`, and with it the ray of every stroke and
the size of every stroke in space: a stroke `l` long on the canvas, at distance `d` down its ray, is `l · d / f`
long in the world. The standpoints are authored, and these are the starting numbers, taken from what the sibling used
or measured and to be argued with in the build:

| canvas | hfov | pitch | why |
|---|---|---|---|
| *The Starry Night* | 62° | +30° | the sibling hung it tipped up 52° for a lying viewer; in the air the eye is not lying down, and the frame's horizon at v 0.74 puts the village low and the sky high, which is the canvas |
| *Starry Night Over the Rhône* | 50° | +6° | the sibling's measurement: the closest call in its collection, 4.95× against a threshold of 5, so nearly a place |
| *Café Terrace at Night* | 50° | +14° | measured by the sibling as a wall with no horizon; in the air that no longer matters, since the eye is not asked to stand on its pavement |

With `hfov` 62° on a 92.1 cm canvas, `f` is 76.6 cm. A 3 cm sky stroke at 300 m is 11.7 m long. A 1.5 cm mark on a
façade 20 m off is 39 cm. These are the sizes you fly past.

### 4.3 Depth: authored by region, declared

One new tool, `tools/depth.py`. For each canvas a person paints a region mask over the flat rendering — a PNG in
which each colour is a region: sky, moon, stars, hills, village, cypress, ground, water, far bank, façade, awning,
pavement, figures — and writes a law per region in `depth/<slug>.json`. The laws are few:

- **constant**: a façade at 18 m; the far bank at 220 m; the cypress at 60 m.
- **plane**: the ground and the water, `d = h / sin(θ)` for a ray `θ` below the horizon and an eye `h` above the
  plane. The eye height is the standpoint's, not 1.65 m: on the Rhône quay it is 1.65 m; over Saint-Rémy it is
  whatever puts the village at the distance the law for the village says.
- **range**: the sky, from a near distance to a far one, with the distance chosen by a band across the canvas
  (bottom of the sky nearer, zenith farther) and a little noise so that no two neighbouring strokes are exactly
  coplanar.
- **relief**: for a region that has structure inside it — the swirl, the cypress — a base distance plus a term from
  the stroke's brightness or its order, so that the region has a front and a back.

The tool writes a sidecar, `depth/<slug>-depth.bin`, one float per stroke, in record order. The record itself is not
touched. Every number in the JSON is a person's; the caption and the ledger say so.

### 4.4 The standpoint test

The one thing about depth that is checkable, and it is pre-registered: **rendered from his standpoint, with his
field of view, the frame must reproduce the record's flat rendering.** `tools/standpoint.py` takes a headless
screenshot from the standpoint and compares it with `-flat.png` at 512 px on the long edge. Pass: SSIM ≥ 0.85 and no
region where the mean colour differs by more than 8% of full scale over a 32 px cell. It is run for every canvas at
every milestone that touches its depth, and the numbers are logged. A depth authoring that cannot pass it is wrong,
however good the volume looks from elsewhere, because the volume is only licensed by the painting.

### 4.5 Rendering: one shader for every stroke in the piece

Every stroke, his or ours, is one instance of one ribbon: a world position, a tangent, a length, a width, a colour,
an emissive weight, a curl axis and phase, and a flag for whose it is. The brush atlas is the sibling's
(`brush.js`, eight prints, procedural), and so is the relief shading that lets a ribbon read as a loaded stroke
rather than a card. What is new:

- **The face turns to the eye about its tangent.** A stroke keeps its measured direction and turns its flat face
  toward the viewer around that axis, so that it never shows you its edge. At the standpoint this puts the face
  exactly perpendicular to the ray, which is what the standpoint test needs; from elsewhere it is what keeps a
  stroke a stroke and not a line.
- **Thickness.** Passed at a metre, a flat card is a card. Each ribbon carries a second, narrower ribbon offset along
  its normal by its impasto height scaled like its length, drawn darker, so that the stroke has an underside. The
  height is the record's, from the pipeline's height field, and it scales with distance like everything else.
- **Curl.** Each stroke slides along its own arc by up to its measured amplitude, at one rate for the whole piece,
  0.42 rad/s — the sibling's constant, which is a swing of fifteen seconds. The rate is the one invented number in the
  motion, as it was there.
- **Parting** (§6.5), computed per vertex in the shader from the eye's position and heading, so that a long stroke
  bends around you rather than jumping.
- **Light.** The moon, from the direction the Starry Night puts it; the gaslights and the terrace's lamp, as point
  lights placed at the emissive strokes that paint them; the sky's colour as ambient; and the strokes that paint
  light — stars, lamps, windows, reflections — emissive by a weight taken from their colour. Bloom (`post.js`) does
  the rest. No fog: the night is clear, and distance darkens rather than greys, except at the edge (§5.4) where it
  goes to linen.

### 4.6 Ours, in his hand

His three cones do not fill the sky, and the sea between them is empty. What fills the rest is ours, and it is made
this way and no other. `tools/hand.py` measures a region of one of his canvases — the Starry Night's sky, the
Rhône's water, the terrace's stars — and writes `hand/<slug>-<region>.json`: the joint distribution of colour, of
length and width, of curl amplitude, and of direction *relative to the flow* at that point. The runtime's generators
(§5.3) draw strokes from those distributions and lay them along the wind. So ours are his in every measured respect
but position, and position follows his flow. The `?ledger` flag (§11) tints ours so that the seam between his and
ours can be looked at, and the build plan measures it.

### 4.7 The wind, fitted

`tools/wind.py` fits the velocity field of §3.2 to the tangents of the Starry Night's sky strokes: a slow drift, a
wave, and a small number of vortices, each with a centre on the sphere of directions, a radius, a turn and a
strength. The fit minimises the angle between his tangents and the field; the residual, in degrees, is logged and is
the measure of how much of his sky the wind explains. The fitted centres are then given depths by the sky's law and
become axes in space. Outside his cone the field is extended by the same terms plus a curl noise, and it is the field
our sky strokes lie along and the field the flyer is carried by.

---

## 5. The world

### 5.1 The geography of a dream: three cones, one sea

Arles and Saint-Rémy are twenty-five kilometres apart. Two of the standpoints are three hundred metres apart on the
same bank of the same river. This piece does not build the distance between them; it declares one dark water and
puts the three standpoints on it, with what each of them saw around it, and nothing else. Between the cones there is
the sea, our sky over it, and the reflections. That is a dream's geography — islands of place with nothing between —
and it is said in the caption rather than hidden.

The placement is authored and is a build-time number (§12): the three standpoints about eight hundred metres apart,
so that a glide from one to the next is a few minutes and a swoop a few tens of seconds. Arles' two cones share a
town: the Rhône's far bank lights lie across the water from the quay, and the terrace's square opens a few hundred
metres behind the quay, in the town that the Rhône canvas paints as *blue and violet* at its edge. The Starry Night's
cone stands off across the water with its hills far behind it at the distance its law gives them, kilometres, which
is where they are in the canvas.

### 5.2 The water

The floor of the world is water, everywhere, an unbounded plane at height zero. It is not a thing you see; it is a
colour, near black, with the sky's colour in it. What you see of it is reflections, and reflections are strokes: the
Rhône canvas paints every gaslight as a column of marks lying on the water, and letter 691 gives the law — the
gaslight yellow, its reflections *red gold and go right down to green bronze*. His columns are his strokes at the
water's depth. Ours — for the moon, for every star of ours, for the lit windows of the far bank — are drawn from the
hand of his columns and laid on the water under each light, and they follow the eye as a reflection does. Nothing
about the water is modelled: it obeys the rule of §2 because there is no surface, only marks lying at height zero.

### 5.3 Our sky, our stars, the motes

- **The sky** outside his cones is a volume of strokes from the Starry Night sky's hand (§4.6), along the wind
  (§4.7), from the sky's near distance to its far one, thinning toward the linen. Its density matches his: strokes
  per steradian per metre of depth, measured in his cone and held outside it.
- **Our stars** are few and unnamed, placed where the wind's vortices are not, each a core and rings from the hand of
  his stars, and each a place: its rings are metres across in the air and you fly through them. His eleven stars and
  the moon are his, at their depths, and are the places worth reaching.
- **Motes**: small strokes of sky colour, sparse, seeded through the open air at a density that gives a sense of
  speed at a swoop and disappears at a glide. Ours, from the hand of his smallest sky marks. They are the one
  generator whose purpose is the sensation and not the picture, and the ledger names them.

### 5.4 Above and beyond: the linen

Above about seven hundred metres and beyond about two and a half kilometres from the centre, the paint thins, the
strokes go sparse and pale, and the dark goes to the colour of primed linen. The edge of the canvas is the edge of
the dream, in every direction, including up. Fly into it and the dream fades to linen over a few seconds and begins
again (§7.2). There is no wall.

### 5.5 What moves

His strokes turn on their curls; ours too. The sky strokes drift along the wind at a walking pace, so that the sky is
alive and the eddies visibly turn, while his stars and moon stay where they are, since a star does not drift with the
paint round it. The reflections ripple with a slow wave. The lamps breathe. The stars do not wheel: a sky exploded
from a standpoint cannot rotate without breaking the standpoint, and the piece keeps the painting over the astronomy.

---

## 6. Flight

### 6.1 The eight sensations

On a screen, flight is five sensations, and dream flight adds three. Every rule below exists to produce one of them,
and nothing in the flight exists for any other reason.

| sensation | what produces it here |
|---|---|
| things streaming past, close | the sky is a volume; the motes; the stroke scale law puts ten-metre marks in the air |
| the horizon tilting as you bank | the view rolls into turns, to a limit |
| rising and sinking | pitch is altitude; the eddies lift |
| inertia, no hard stops | velocity and heading follow their targets with time constants, never snap |
| never blocked | parting (§3.3) |
| you go where you look | heading follows gaze |
| effort is absent | nothing pressed is still a glide; the wind carries |
| scale is uncertain | a stroke is a metre near the pavement and ten metres in the sky, and both are strokes |

### 6.2 The controls

Two, as the sibling had two, and the second is optional.

- **Look.** Drag with a mouse, or the right thumb on a screen. The heading eases toward the gaze with a time constant
  of about 1.2 s, so that a glance sideways does not swerve you: pre-registered, a half-second glance turns the
  heading by less than ten degrees. Look long enough and you go there.
- **Speed.** Nothing pressed is a glide at 3 m/s, never a stop, because a dream never quite stops. `W` or `↑` or
  the wheel takes it up to 15 m/s over two seconds; `Shift` is a swoop at 40; `S` or `↓` slows to half a metre a
  second. The left thumb on a screen.

And three gestures that are not controls:

- **`Space`: let go.** Your own speed goes to nothing and the wind has you. Any key or drag takes over again.
- **`Z`: onto your back.** The pitch goes to the zenith while the glide keeps its heading, and the sky is overhead.
  This is the sibling's lying down, which its design called the single best thing in its piece, kept for the one sky
  it was made for.
- **`1`, `2`, `3`: to his eye.** A current takes you to a standpoint over about ten seconds along a curve, turns you
  to his heading and pitch, holds a moment while the painting is exactly there, and lets go. Not a jump: you watch
  the strokes gather as you come.

Banking is not a control: the roll follows the yaw rate, to a limit of 25°, eased. There is no walking, no landing,
no gravity, no stamina, no collision. `M` is sound, `F` full screen, `H` the keys, `L` the ledger.

### 6.3 The floor and the ceiling

A soft floor a metre above the water: coming down onto it slows the descent over the last few metres and holds you
there; there is no bounce and no splash. The ceiling is the linen (§5.4).

### 6.4 The current

The wind's velocity at your position is added to your own. In open sky it is a couple of metres a second along the
drift; inside an eddy, up to eight along the turn and two upward, so that an eddy is a thermal. Your own speed at
a glide is more than the open wind, so you can always go where you look; at a swoop you cross an eddy; let go inside
one and it carries you round in about half a minute.

### 6.5 Parting

Within four metres of the eye, every vertex of every stroke is pushed out to four metres along the direction from the
flight line, over a third of a second, and comes back over two seconds once you are past. Because it is per vertex, a
long stroke bends around you and closes behind. Lamps and their reflections part like anything else. The number is a
build-time number; what is pre-registered is the test in `BUILD.md`: on a minute of flight through the village at a
glide, no stroke stays within two metres of the eye for longer than a fifth of a second.

### 6.6 Touch

The left thumb is speed, up and down; the right thumb looks; a tap with the right thumb is `Z`; a tap with both is
`Space`. Nothing else. No phone has been measured and the build plan says when one is.

---

## 7. Time

### 7.1 The opening

The sibling's veil is kept whole (`veil.js`): on first load, *The Starry Night* paints itself on primed linen from its
own record, in his order, while the world is built. What happens next is new. The finished canvas does not dissolve.
The eye moves into it, and as it passes the picture plane **the painting explodes**: every stroke slides down its ray
from the canvas to its authored depth over about four seconds, the sky racing away and the village dropping below,
until you are in the air over Saint-Rémy, gliding forward at 3 m/s, the swirl ahead, the water below, the moon on
the right. §3.1's move is shown once, at the start, and never explained.

Then one line, in the corner, until the first drag: *you fly where you look.*

### 7.2 No arc, no end

There is no scrub, no chronology, no route and no coda. The world is alive at one tempo, the curl rate, and it stays.
A flight ends when you close the page, or when you fly into the linen, which fades the dream over a few seconds and
begins it again from the air over Saint-Rémy, without the veil. The sibling ended on his portrait because its subject
was the painter; this has no end because its subject is the night, and a night is left, not finished.

---

## 8. The paintings

Four records, three in the air. **The Night Café is not in this piece.** It is a room, and the piece is outdoors by
decision: an interior you fly into is a level, and the sibling's log already records that its Night Café *can be
walked out of* — a room in an open station has no inside. Its record stays in the folder as the one that does not
fly, and §15 keeps one door open for it: its light through a doorway, seen from the square, and nothing behind the
door.

The three that fly, with what each brings:

- **The Starry Night** brings the sky, the wind, the moon and the morning star, the cypress, the village and the
  hills. It is the largest cone and the highest, and the piece opens inside it.
- **Starry Night Over the Rhône** brings the water and its law, the gaslights and their columns, the Great Bear, the
  far bank, and the two figures on the quay, which from the side are two flat shells and are left so.
- **Café Terrace at Night** brings the town: the one place in the piece with walls, a pavement, an awning, tables and
  a lamp, all of them his marks at authored distances, and the *painting of night without black* (letter 678) that
  fixes the piece's palette: blue, violet, green, and the square pale sulphur and lemon.

Sources, resolutions and what was done to each scan are in the sibling's `paintings/CREDITS.md`, copied here.

---

## 9. The voice

One line of his per canvas, from the letters, shown once, when you pass through its standpoint for the first time:
the title, the date, the collection, and the line, for six seconds, and then never again unless asked (`L`). And one
line for the piece, under the title at the opening, from letter 638. The lines are quoted from *Vincent van Gogh —
The Letters* (Van Gogh Museum and Huygens ING, vangoghletters.org) under the edition's CC BY-NC-SA 4.0 licence, and
`letters/` holds each with the letter number, the paragraph and the edition's date, checked by the sibling's
`tools/letters.py`:

| canvas | letter | the line, in short |
|---|---|---|
| the piece | 638, to Theo, July 1888 | we take death to go to a star |
| *Starry Night Over the Rhône* | 691, to Theo, September 1888 | the starry sky at last, actually painted at night |
| *Café Terrace at Night* | 678, to Wil, September 1888 | a painting of night without black |
| *The Starry Night* | 777, to Theo, June 1889 | nothing but the morning star, which looked very big |

---

## 10. Sound

Generated on the page, as the sibling's was (`audio.js`, adapted); no samples. Four layers, each keyed to something
you are doing:

- **Wind**, filtered noise whose level and pitch follow your speed through the air, so that a swoop is heard.
- **Water**, low, under you, louder the lower you fly, gone above fifty metres.
- **The eddies**, a low tone that rises as you enter one, at the pitch of its turn.
- **The square**, a murmur of voices as filtered noise with a slow pulse, within a hundred metres of the terrace.

Nothing melodic, nothing that marks an event. Off by default until the first gesture, as a browser requires, and `M`.

---

## 11. Interface

Nothing on the screen. One line in the corner at the start, gone at the first drag. A caption for six seconds the
first time you reach a standpoint. Four keys that open something and close it again: `H` the keys, `L` the ledger,
`M` sound, `F` full screen. The chrome, when it is there, in none of his colours.

**The ledger** is the piece's honesty made visible, and it is part of the design rather than a debug flag. `L`
prints, in the corner: which strokes are his and which are ours, how many of each, what was measured (the strokes,
their rays, their curl, the wind's fit and its residual) and what was authored (the standpoints, the depths, the
placement of the three cones on one water). `?ledger` in the address tints ours so that the seam can be seen. No
line of stations, no map, no compass.

---

## 12. Performance budget

| | count | note |
|---|---|---|
| his strokes | 38,654 | three records |
| our sky | ~60,000 | to his density, outside his cones |
| reflections | ~15,000 | his columns plus ours under every light |
| motes | ~10,000 | sparse |
| stars and rings, ours | ~5,000 | |
| **ribbons** | **~130,000** | each a five-segment ribbon plus its underside: about 2.6 M triangles |

One draw call per kind, instanced, no sorting: `alphaToCoverage` as the sibling used. The cost is not the triangles,
it is fill: a ten-metre stroke passed at two metres covers the frame. Parting bounds the worst of it, and the
sibling's resolution governor (drop pixel ratio to hold 47 fps, take it back above 58) is kept. Target: 60 fps at
about three million pixels in Chrome on a Mac, and the build plan measures it at every milestone with the frame-rate
logged from three fixed flights.

---

## 13. Technical shape

One HTML page, ES modules, three.js from a CDN pinned to one version, no build step, served by `python3 -m
http.server`. The layout:

```
index.html          the page, the veil's markup, the import map
src/main.js         boot, the loop, the harness object `dream`
src/flight.js       the body in the wind: gaze, speed, bank, floor, let go, the current, the way to a standpoint
src/wind.js         the fitted field of §4.7, extended to three dimensions
src/records.js      the record reader (from the sibling's canvases.js) and the depth sidecar
src/strokes.js      the one ribbon shader of §4.5 and the instance packing
src/explode.js      a canvas at its standpoint: rays, depths, positions; the opening's explosion
src/sky.js          ours in his hand: the sky volume, our stars, the motes, from hand/*.json along the wind
src/water.js        the plane's colour and the reflection columns
src/light.js        the moon, the lamps, the ambient, the linen edge
src/brush.js        harvested whole
src/post.js         harvested whole
src/veil.js         harvested whole
src/util.js         harvested whole
src/audio.js        harvested, the layers rewritten
src/ui.js           the line, the caption, the four panels
tools/depth.py      §4.3
tools/standpoint.py §4.4
tools/hand.py       §4.6
tools/wind.py       §4.7
tools/shot.py       headless screenshots and the three fixed flights, for the log
strokes/            the four records, their flats and underlayers, copied from the sibling
depth/              the region masks and the laws
hand/               the measured distributions
letters/            the four lines and their provenance
paintings/          CREDITS.md
```

The harness object `dream` does for this what `vgu` did for the sibling: `dream.state()`, `dream.go({x, y, z, yaw,
pitch})`, `dream.eye(n)` to stand at a standpoint, `dream.speed(v)`, `dream.letgo()`, `dream.freeze(t)`, and the
address flags `?at=n`, `?t=`, `?noStrokes`, `?ledger`, `?q=`, `?notitle`.

---

## 14. Build order

`BUILD.md` is the plan. Its shape follows from one rule: the sensation is proved before the world. The first
milestone is the Starry Night alone, exploded over black water, with an eye that goes where it looks, and its gate is
a question and not a number: is flying among his strokes paint, or confetti? Everything after it — the wind, our
sky, the water, the night of Arles, the opening, the edge — is added only if the first answer is paint.

---

## 15. Open questions

Each with what would settle it, and where the plan expects the answer.

1. **Paint or confetti.** Exploded strokes seen from oblique angles may read as a cloud of confetti rather than a
   sky. The gate of D0. If confetti, the four diagnoses are in the plan, and the likeliest is that depth varies too
   much between neighbouring strokes: the fix is smoother laws, not smaller strokes.
2. **The seam between his and ours.** Measured in D2 by a crop across the cone's edge. If the seam is visible at a
   glance, the answer is not to blend it but to widen his: put his cone's edge in the dark and ours behind it.
3. **Hollowness.** From behind, a façade of his strokes is nothing. The design accepts this; the plan looks at it in
   D4 from three viewpoints behind the terrace and decides between leaving it, giving each stroke an underside
   (already in §4.5), or continuing the façade in the hand of his façade strokes.
4. **Gaze steering and nausea.** The lag, the bank limit and the field of view are the three numbers; D1 sweeps them
   with the three fixed flights and one person's stomach. The fallback is a held right button that looks without
   steering.
5. **The hills.** The Starry Night's hills at their canvas distance are kilometres off, and in a clear night they may
   be too dark to see. D0 finds out; the answer is a law that puts them nearer, declared, before it is a fog.
6. **The distance between the cones.** Eight hundred metres is a guess. Settled in D4 by flying it.
7. **The Night Café's door.** Deferred, with the trigger in the plan.
8. **A phone.** Nothing here has been measured on one. Deferred, with the trigger in the plan.
9. **The couple on the quay.** Two flat shells at four metres. Accepted, and looked at in D4.
10. **The floor, seen.** Answered in D4.6, on the author's word, by the first of the two ways: D3's reference was
    measured again rather than chosen, and the floor is his ground's own share of the light our sky actually gives
    it. From a hundred metres up the near bank now steps **4.4 levels of 255** and the far bank 3.7, against 1.9
    and 2.1 before, and both steps fall within 1.25 m of the bank. Nothing was added to the floor and §5.2 stands.
    What is left over is not the floor's: the far bank is short of the four levels the milestone asked for because
    our night is between a quarter and a half of his, which is the sky's density and D6's. The before and after
    are in the D4.6 log, and `?d3floor` shows the two side by side.

---

## 16. Licence

The code, MIT. The paintings are his and in the public domain; the scans they were extracted from are named in
`paintings/CREDITS.md` and are not here. The letters are quoted under the edition's CC BY-NC-SA 4.0, and `letters/`
is under that licence and not MIT. three.js, MIT, from a CDN.
