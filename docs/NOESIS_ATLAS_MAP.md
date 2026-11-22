# The Atlas: one map, three distances

The Atlas answers three questions, and the distance you are reading at decides
which one it answers.

| Distance | What it shows | What you can do |
| --- | --- | --- |
| **Regions** (`k` ≲ 0.45) | A sky of constellations. One region is one group of stars. | See the shape of the workspace, search, preview a region, or zoom at any point. |
| **Concepts** (`k` ≈ 0.3–1.5) | Water and islands. Each concept is its own island, its coastline drawn in contour rings. | Pan the neighbourhood, compare islands, preview a concept, keep zooming. |
| **Records** (`k` ≳ 1.2) | Landmarks on and around the island. | Inspect a landmark, open a count as a list, open the record itself. |

These are reading distances, not screens or stops. Zoom is continuous and
anchored to the cursor or the pinch midpoint, nothing has to be selected before
the map will move, and the three buttons are shortcuts to a distance, never a
gate. The bands overlap so landmarks fade in and out rather than appearing.

## The landmark alphabet

Every landmark is a **silhouette**. The test is a screenshot with the colour
removed: if two landmarks are still telling apart, the alphabet works. Colour
carries the stage tone as it does everywhere else in the app; it is never the
only difference.

| Record | Landmark | Drawn from |
| --- | --- | --- |
| Region | a constellation: its concepts' stars, joined by straight segments, closed into an outline at three or more | its concepts |
| Concept | a star far out; its own island up close | — |
| Position | a **flag** planted in the ground; the banner's length is the **stated confidence** | `confidence` |
| Inquiry | **fog** over the ground with a small `?` to aim at | `status` |
| Source | an open **book** resting on the shore | — |
| Work | a **workshop**: a roof over a bench | — |
| Praxis | **footprints** — a practice is walked, not claimed | — |
| Annotation | a **map pin** pushed into the ground, point down | — |
| Boundary | a **boat** holding station just offshore | `notSameAs`, `counterexamples`, `edgeCases` |

The flag is the app's own position icon, so the map and the rest of Noesis
agree. Praxis takes footprints rather than a second flag family for the same
reason: two flags would be two things that look alike and mean different
things. Practices, experiments and commitments share the footprint; the preview
names which one it is, because the difference is worth reading, not worth a
third silhouette at sixteen pixels.

## What the landmarks are allowed to say

- **A flag's banner is stated confidence only.** It is what the person says
  they hold. It never rates the evidence, and the preview shows the exact
  percentage with that said in words.
- **Fog follows the recorded state of an inquiry and nothing else.** Full while
  it is open, gathering evidence or under tension; thinner once a working
  answer exists; gone when it is resolved or no longer meaningful; back in full
  when it is reopened. A resolved inquiry draws no fog and no landmark — its
  record is still reachable through the concept's inquiry count.
- **A boat is a boundary the person recorded.** Nothing is inferred. A concept
  with no `notSameAs`, no counterexamples and no edge cases gets no boats, and
  selecting a boat says which kind of boundary it is and quotes the reason if
  one was written.
- **The island's size is how much rests on the concept**, and so is the number
  of contour rings. Both read one number — its records, its notes and its
  concept links, each counted once — so a worked concept is a visibly bigger
  island carrying more lines than an untouched one: across the demo workspace
  the spread runs 57px to 123px. The island grows with that count and the
  growth diminishes — doubling the work adds the same small step each time — so
  a busy concept never swells across its neighbours' water. Confidence and
  repeated edits do not enter into it. The rings step at a fixed height rather
  than being spread to fit, so they crowd toward the summit the way they do on
  a real topographic map, and the concepts carrying the most get a summit mark.
- **No island is ever too small for its own landmarks.** Landmarks are seated
  on concentric rings, and the rings are worked out from each one's own
  circumference, so every landmark clears its neighbours by a fixed distance —
  about 25 world units against a glyph of roughly 17 — whether a concept
  carries three records or a hundred. That spacing is a constant, not a
  proportion: a landmark does not become easier to tell apart because it sits
  on a bigger island. Whatever the growth curve says, the island is then grown
  until its own landmarks fit with a shore outside them, so **the count can
  set the size** and crowding cannot happen by arithmetic.
- **The rings open out to the ground the island has.** An island is usually
  larger than the tightest packing needs, because what rests on a concept also
  counts its links. Rather than huddling everything on the summit, the rings
  spread across the island, which is also what puts sources on the coast: they
  are seated last, so they take the outermost ring. Spreading only ever adds
  room, so nothing it touches can start to crowd.
- **A constellation groups a region. It asserts nothing.** The segments are a
  reading aid, drawn only within one region; two adjacent stars are not thereby
  related, and no line is ever drawn between groups.
- **Every region draws its own figure.** A plain ring would give every region
  of the same size the same outline — five four-concept regions as five
  identical squares — so each region draws from its own id: its rotation, how
  flattened it is, which way it leans, how wide each concept's wedge of sky is,
  and a slow swell in and out of the centre. A small region has sky to spare
  and is pulled about freely; a crowded one is held closer to the ring. The
  seed is the region's **id**, never its position in the list, so adding or
  removing a region leaves every other constellation exactly as it was.
  Two-concept regions are the one case with nothing to vary: two stars make a
  line, and only its angle and length can differ.
  The figure is then sized by scaling it **whole** until every pair of
  coastlines clears open water — so a region of worked-over concepts opens out
  to make room for them — rather than nudging stars apart one at a time, which
  would pull every constellation back toward the circle this replaces.

## Where concepts sit

Within a region, concepts a person has explicitly marked as easy to confuse —
`notSameAs`, or a shared alias — are placed side by side, because that is where
the distinction is worth seeing. Ones marked `opposedTo` are pushed apart, and
the ring is turned so its seam falls where it costs least. Only explicit
records count: **silence between two concepts means nothing**, and never an
opposition. The walk is deterministic, so the map does not rearrange itself
between visits.

Hand-placed layouts are untouched by all of this. Custom Maps are a separate
surface with their own saved coordinates; nothing here reads or writes them.

## Deliberately not done

- **Evolution replay on the map.** The data supports some of it — a confidence
  revision could redraw a flag, an answered inquiry could thin fog — but
  showing current contours or fog as historical fact would be a lie, and the
  honest version needs per-date state the records do not all carry. The
  timeline window (`asOf`, `from`) already hides records not yet born and marks
  new ones; that is as far as the data goes.
- **Praxis subtype silhouettes.** See above: named in the preview instead.
- **Island growth from routine edits.** Growth comes from distinct linked
  records and definition work, never from editing the same field repeatedly.
