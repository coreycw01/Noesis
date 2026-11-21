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
| Source | a **dock** at the shoreline | — |
| Work | a **workshop**: a roof over a bench | — |
| Praxis | **footprints** — a practice is walked, not claimed | — |
| Annotation | a quiet **pin** | — |
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
- **Contour rings are how much rests on the concept**, counted from its
  records, notes and links. The island grows with that count and the growth
  diminishes — doubling the work adds the same small step each time — so a busy
  concept never swells across its neighbours' water. Confidence and repeated
  edits do not enter into it.
- **A constellation groups a region. It asserts nothing.** The segments are a
  reading aid, drawn only within one region; two adjacent stars are not thereby
  related, and no line is ever drawn between groups.

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
