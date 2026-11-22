"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Concept, Draft, GoalItem, Media, PhilosophicalLink, Practice, Question, VaultEntry } from '@/lib/types';
import type { AtlasRegionViewModel } from './atlas-diagnostics';
import { conceptKey } from '@/lib/readex';
import { cssColor } from '@/lib/css-color';
import { conceptBoundaryMarks, type BoundaryKind } from '@/lib/concept-boundary-findings';
import { NOESIS_GLYPH_PARTS, type NoesisGlyphKey } from '@/lib/noesis-icons';
import { Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { cn } from '@/lib/utils';

/** The Atlas night sky, read from the theme so it follows light and dark. */
const CANVAS_SKY = () => cssColor('--canvas-sky', 1, '#111d2b');

/**
 * The Atlas is one continuous map read at three distances.
 *
 *   Far   — a sky of constellations. Each region is one group of stars, joined
 *           by straight segments and closed into an outline when it has three
 *           or more. The outline groups the region; it claims nothing about
 *           how those concepts relate.
 *   Mid   — the water comes up and each concept is its own island, its
 *           coastline drawn in contour rings for how much rests on it.
 *   Near  — the records are landmarks on and around that island: flags for
 *           positions, fog for open inquiries, docks for sources, workshops
 *           for works, footprints for praxis, pins for annotations, and boats
 *           offshore for the boundaries the concept records about itself.
 *
 * Zoom is continuous throughout: the three names are places to jump to, never
 * stops, and nothing has to be selected before the map will move.
 */

type RecordType = 'position' | 'inquiry' | 'source' | 'practice' | 'work' | 'annotation';
interface MapRegion { id: string; name: string; conceptIds: string[] }
interface WorldConcept { id: string; name: string; definition: string; status?: string; clarity: number; born: number; region: number; wx: number; wy: number; island: number }
interface WorldRecord {
  id: string; type: RecordType; label: string; conceptId: string; born: number; wx: number; wy: number;
  /** Stated confidence for a position, 0–100. Never a judgement of its evidence. */
  confidence?: number;
  /** How thick an inquiry's fog is: 1 open, less once an answer is written, 0 resolved. */
  fog?: number;
  detail?: string;
}
export interface WorldBoundary { id: string; conceptId: string; kind: BoundaryKind; text: string; reason?: string; wx: number; wy: number }

export type AtlasCanvasSelection =
  | { kind: 'region'; region: MapRegion; index: number }
  | { kind: 'concept'; concept: WorldConcept }
  | { kind: 'record'; record: WorldRecord; conceptName: string }
  | { kind: 'boundary'; boundary: WorldBoundary; conceptName: string };

/** Three reading distances. Zoom runs smoothly between and past them. */
const LEVELS: Array<[string, number]> = [['Regions', 0.13], ['Concepts', 0.8], ['Records', 2.4]];

/**
 * A landmark takes the colour of its own kind, read from the same `--kind-*`
 * tokens the rest of the app reads. The map used to name the stage colours
 * directly and had drifted: works were drawn in the Integrate purple while
 * every other surface drew them in the works colour.
 */
const RECORD_TONE: Record<RecordType, string> = {
  position: '--kind-position', inquiry: '--kind-inquiry', source: '--kind-source',
  practice: '--kind-practice', work: '--kind-work', annotation: '--kind-annotation',
};
/** Each record wears the glyph its own tab wears. */
const GLYPH_FOR: Record<RecordType, NoesisGlyphKey> = {
  position: 'position', inquiry: 'inquiry', source: 'source',
  practice: 'praxis', work: 'work', annotation: 'annotation',
};
const RECORD_NOUN: Record<RecordType, string> = {
  position: 'positions', inquiry: 'inquiries', source: 'sources',
  practice: 'praxis', work: 'works', annotation: 'annotations',
};
const LINK_TONE = (type: string) => /contradicts|challenges|weakens|questions/.test(type) ? '--stage-claim'
  : /supports|strengthens|coheres/.test(type) ? '--stage-act'
    : /defines|refines|exemplifies/.test(type) ? '--stage-encounter'
      : /tested_by|expressed_in/.test(type) ? '--stage-integrate' : '--stage-examine';

const time = (value?: string) => { const parsed = Date.parse(value || ''); return Number.isFinite(parsed) ? parsed : 0; };
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
/** Fades in over `soft` octaves once the zoom passes `at`. */
const fadeIn = (k: number, at: number, soft = 0.5) => clamp01((Math.log(k) - Math.log(at)) / soft);
const fadeOut = (k: number, at: number, soft = 0.5) => 1 - fadeIn(k, at, soft);

/** How many records, links and notes rest on each concept. */
export function conceptInvolvement(world: { concepts: Array<{ id: string }>; records: Array<{ conceptId: string }>; notes: Array<{ conceptId: string }> }, links: PhilosophicalLink[]) {
  const counts = new Map(world.concepts.map((concept) => [concept.id, 0]));
  const bump = (id: string) => { if (counts.has(id)) counts.set(id, (counts.get(id) || 0) + 1); };
  world.records.forEach((record) => bump(record.conceptId));
  world.notes.forEach((note) => bump(note.conceptId));
  links.forEach((link) => { if (link.fromType === 'concept') bump(link.fromId); if (link.toType === 'concept') bump(link.toId); });
  return counts;
}

/** Elevation in contour rings: one for bare ground, then one per doubling of involvement, up to eight. */
export function elevationRings(involvement: number) {
  return Math.min(8, 1 + Math.floor(Math.log2(1 + Math.max(0, involvement))));
}

/**
 * The clear air a landmark needs around its centre, in world units.
 *
 * A landmark's glyph spans about 17 world units at the Records distance, so a
 * seat of 26 leaves air on every side at the zoom where landmarks are read.
 * Spacing is a constant, not a proportion: a landmark does not become easier
 * to tell apart because it sits on a bigger island.
 */
const SEAT = 26;
/** Islands are drawn flattened, so a seat needs more room north–south. */
const ISLAND_SQUASH = 0.85;
/** The first ring stands off the summit, where the elevation mark sits. */
const FIRST_RING = SEAT * 0.95;
/** Shore left between the outermost landmark and the coastline. */
const SHORE = SEAT * 0.8;

/** The radial step between rings, widened because the island is flattened. */
const RADIAL = SEAT / ISLAND_SQUASH;

/** How many seats fit on one ring before they start to crowd. */
function ringCapacity(reach: number) {
  return Math.max(1, Math.floor((Math.PI * 2 * reach * ISLAND_SQUASH) / SEAT));
}

/**
 * Where a concept's landmarks stand, and how big its island has to be to hold
 * them without crowding.
 *
 * Landmarks sit on concentric rings. Every seat clears its neighbours by at
 * least one `SEAT` — along a ring because the ring's capacity is worked out
 * from its own circumference, and between rings because the rings never step
 * closer than `RADIAL`. That is the whole guarantee: **the count decides the
 * size**, and a concept can never end up with more landmarks than its ground
 * can seat.
 *
 * Called with a count alone, it packs as tightly as it legibly can and reports
 * the smallest island that works — which is what floors `islandRadius`. Called
 * with the island it is actually seating, it opens the rings out across the
 * ground available, so a worked-over concept's records are spread over its
 * island rather than huddled on the summit of a large empty one.
 *
 * Seats come back ordered from the summit outward, which is what gives sources
 * the coast: they are seated last, so they take the outermost ring.
 */
export function islandSeating(count: number, island?: number) {
  const seats: Array<{ reach: number; angle: number }> = [];
  // Nothing rests on it, so nothing has to fit: an untouched concept is left
  // to whatever size the growth curve gives it.
  if (count <= 0) return { radius: 0, seats };

  // The tightest legible packing, which sets the smallest island that works.
  let tight = FIRST_RING;
  let held = 0;
  let needed = 1;
  while (held + ringCapacity(tight) < count) { held += ringCapacity(tight); tight += RADIAL; needed += 1; }
  const radius = tight + SHORE;

  // Then spread over the ground the island actually has.
  const edge = Math.max(FIRST_RING, Math.max(island ?? radius, radius) - SHORE);
  const rings = Math.max(needed, Math.min(Math.floor((edge - FIRST_RING) / RADIAL) + 1, count));
  const step = rings > 1 ? (edge - FIRST_RING) / (rings - 1) : 0;
  const reaches = Array.from({ length: rings }, (_, ring) => FIRST_RING + ring * step);
  const caps = reaches.map(ringCapacity);

  // Share the landmarks out by how much room each ring has, never leaving a
  // ring bare and never pushing one past what it can hold.
  const room = caps.reduce((sum, cap) => sum + cap, 0);
  const take = caps.map((cap) => Math.max(1, Math.min(cap, Math.floor((count * cap) / room))));
  const spare = () => take.reduce((sum, value) => sum + value, 0);
  while (spare() < count) {
    let best = 0;
    for (let ring = 1; ring < rings; ring += 1) if (caps[ring] - take[ring] > caps[best] - take[best]) best = ring;
    take[best] += 1;
  }
  while (spare() > count) {
    let best = 0;
    for (let ring = 0; ring < rings; ring += 1) if (take[ring] > take[best]) best = ring;
    if (take[best] <= 1) break;
    take[best] -= 1;
  }

  reaches.forEach((reach, ring) => {
    // Each ring is turned by a share of its own step so the rings do not line
    // up into spokes running down the hillside.
    const turn = ring * 2.399;
    for (let seat = 0; seat < take[ring]; seat += 1) {
      seats.push({ reach, angle: turn + (seat / take[ring]) * Math.PI * 2 });
    }
  });
  return { radius, seats };
}

/**
 * An island grows with what rests on it, and the growth diminishes: doubling
 * the work adds the same small step each time, so a busy concept never eats
 * its neighbours' water. Confidence and repeated edits do not enter into it.
 *
 * Whatever that curve says, the island is never smaller than the room its own
 * landmarks need: `landmarks` sets a floor, so a crowded concept grows until
 * its records have space rather than stacking them on top of each other.
 */
export function islandRadius(involvement: number, clarity: number, landmarks = 0) {
  const grown = 30 + 21 * Math.log2(1 + Math.max(0, involvement)) + 6 * Math.max(0, clarity);
  // The seating floor rounds up, never down: rounding an island a fraction
  // smaller than its own seats need would put a landmark in the water.
  return Math.max(Math.round(grown), Math.ceil(islandSeating(landmarks).radius));
}

/**
 * How thick an inquiry's fog is.
 *
 * Open questions sit under full fog. Writing a working answer thins it,
 * resolving it clears the air, and reopening brings the fog back — the fog
 * follows the recorded state and nothing else.
 */
export function inquiryFog(status?: string) {
  const state = (status || 'open').toLowerCase();
  if (/resolved|converted|no_longer_meaningful|archived/.test(state)) return 0;
  if (/answered/.test(state)) return 0.38;
  if (/suspended|enduring/.test(state)) return 0.6;
  return 1;
}

/**
 * The order concepts sit in around their region.
 *
 * Concepts a person has explicitly marked as easy to confuse — "not the same
 * as", or sharing an alias — are placed side by side, because that is where
 * the distinction is worth seeing. Ones marked as opposed are pushed apart.
 * Only explicit records count: silence between two concepts means nothing.
 * The walk is deterministic, so a map does not rearrange itself between visits.
 */
export function orderRegionConcepts(concepts: Array<Pick<Concept, 'id' | 'name' | 'notSameAs' | 'opposedTo' | 'aliases'>>) {
  if (concepts.length < 3) return concepts.map((concept) => concept.id);
  const names = new Map(concepts.map((concept) => [concept.id, conceptKey(concept.name)]));
  const mentions = (concept: typeof concepts[number], list: string[] | undefined, other: typeof concepts[number]) =>
    (list || []).some((value) => conceptKey(value) === names.get(other.id));
  const affinity = (a: typeof concepts[number], b: typeof concepts[number]) => {
    if (a.id === b.id) return 0;
    let score = 0;
    if (mentions(a, a.notSameAs, b) || mentions(b, b.notSameAs, a)) score += 2;
    if ((a.aliases || []).some((alias) => (b.aliases || []).some((other) => conceptKey(alias) === conceptKey(other)))) score += 1;
    if (mentions(a, a.opposedTo, b) || mentions(b, b.opposedTo, a)) score -= 4;
    return score;
  };
  const pull = new Map(concepts.map((concept) => [concept.id, concepts.reduce((sum, other) => sum + Math.abs(affinity(concept, other)), 0)]));
  const rest = [...concepts].sort((a, b) => (pull.get(b.id) || 0) - (pull.get(a.id) || 0) || a.name.localeCompare(b.name));
  const chain = [rest.shift()!];
  while (rest.length) {
    const last = chain[chain.length - 1];
    let best = 0;
    for (let index = 1; index < rest.length; index += 1) {
      const gain = affinity(last, rest[index]) - affinity(last, rest[best]);
      if (gain > 0 || (gain === 0 && rest[index].name.localeCompare(rest[best].name) < 0)) best = index;
    }
    chain.push(rest.splice(best, 1)[0]);
  }
  // The ring closes, so the join between the last and the first is a seam like
  // any other. Turn the chain so the seam falls where it costs least.
  let seam = 0;
  for (let turn = 1; turn < chain.length; turn += 1) {
    const here = affinity(chain[(turn + chain.length - 1) % chain.length], chain[turn]);
    const bestSoFar = affinity(chain[(seam + chain.length - 1) % chain.length], chain[seam]);
    if (here > bestSoFar) seam = turn;
  }
  return [...chain.slice(seam), ...chain.slice(0, seam)].map((concept) => concept.id);
}

/**
 * A small deterministic generator, seeded from a stable string.
 *
 * Seeded from the region's **id**, never its index, so adding or removing a
 * region leaves every other constellation exactly as it was.
 */
function seeded(id: string) {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) { hash ^= id.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return () => {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Open water left between two coastlines. */
const WATER = 46;

/**
 * The shape of one region's constellation.
 *
 * A regular ring would give every region with the same number of concepts the
 * same outline, so five four-concept regions would be five identical squares.
 * Each region instead draws its own figure from its id: its own rotation, how
 * flattened it is, which way it leans, how wide each concept's wedge of sky
 * is, and a slow swell in and out of the centre.
 *
 * Two things are deliberately held fixed. The **order** around the ring is
 * left exactly as `orderRegionConcepts` worked it out — each concept is
 * jittered only within its own wedge, so concepts marked easy to confuse stay
 * neighbours. And the figure is sized by scaling it **whole**: the shape the
 * seed drew is kept, and grown until every pair of coastlines clears open
 * water. Nudging stars apart one at a time would pull every constellation back
 * toward a circle, which is the thing being fixed.
 *
 * Because the clearance is read from the islands' own radii, a region of
 * worked-over concepts opens out to make room for them.
 */
export function constellationShape(seed: string, radii: number[]) {
  const count = radii.length;
  if (count === 0) return [];
  if (count === 1) return [{ dx: 0, dy: 0 }];
  const random = seeded(seed);
  const turn = random() * Math.PI * 2;
  const squash = 0.62 + random() * 0.38;
  const lean = (random() - 0.5) * 0.6;
  // How far the figure is allowed to depart from a plain ring. A small region
  // has sky to spare, so it can be pulled about freely; a crowded one is held
  // closer to the ring, because the scale that clears its coastlines is set by
  // its tightest pair and wild shapes would push every region apart.
  const licence = 0.22 + 1.8 / count;
  const swell = { amount: Math.min(0.46, 0.08 + random() * licence), pace: 1 + Math.floor(random() * 3), phase: random() * Math.PI * 2 };
  // Every concept gets a wedge of sky. The widths vary but sum to a full turn,
  // so the ring stays closed and no two wedges overlap.
  const widths = radii.map(() => 1 - licence / 2 + random() * licence);
  const total = widths.reduce((sum, width) => sum + width, 0);
  let swept = 0;
  const points = radii.map((_, slot) => {
    const width = (widths[slot] / total) * Math.PI * 2;
    const angle = turn + swept + width / 2;
    swept += width;
    const out = 1 + swell.amount * Math.sin(slot * swell.pace + swell.phase);
    const x = Math.cos(angle) * out;
    const y = Math.sin(angle) * out * squash;
    return { x: x + y * lean, y };
  });
  const mid = points.reduce((sum, point) => ({ x: sum.x + point.x / count, y: sum.y + point.y / count }), { x: 0, y: 0 });
  const centred = points.map((point) => ({ x: point.x - mid.x, y: point.y - mid.y }));
  let scale = 1;
  for (let a = 0; a < count; a += 1) {
    for (let b = a + 1; b < count; b += 1) {
      const apart = Math.hypot(centred[a].x - centred[b].x, centred[a].y - centred[b].y);
      if (apart > 1e-6) scale = Math.max(scale, (radii[a] + radii[b] + WATER) / apart);
    }
  }
  return centred.map((point) => ({ dx: point.x * scale, dy: point.y * scale }));
}

export function buildAtlasWorld({ regions, concepts, positions, inquiries, sources, practices, works, commitments, links }: {
  regions: MapRegion[]; concepts: Concept[]; positions: VaultEntry[]; inquiries: Question[]; sources: Media[]; practices: Practice[]; works?: Draft[];
  /** Commitments ride with the position they promise to live out. */
  commitments?: GoalItem[];
  /** Counted into how much rests on a concept, which sets its height. */
  links?: PhilosophicalLink[];
}) {
  const byKey = new Map(concepts.map((concept) => [conceptKey(concept.name), concept]));
  const regionOf = new Map<string, number>();
  regions.forEach((region, index) => region.conceptIds.forEach((id) => { if (!regionOf.has(id)) regionOf.set(id, index); }));
  const loose = concepts.filter((concept) => !regionOf.has(concept.id));
  const allRegions: MapRegion[] = loose.length ? [...regions, { id: 'loose', name: 'Unmapped', conceptIds: loose.map((concept) => concept.id) }] : regions;
  loose.forEach((concept) => regionOf.set(concept.id, allRegions.length - 1));
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));

  const conceptIdForTags = (tags: string[], ids: string[] = []) => {
    const direct = ids.find((id) => conceptById.has(id));
    if (direct) return direct;
    for (const tag of tags) { const match = byKey.get(conceptKey(tag)); if (match) return match.id; }
    return undefined;
  };
  // A commitment has no concept of its own: it is a promise about a position,
  // so it belongs on whatever island that position stands on. One without a
  // linked position has nothing to anchor it, and gets no landmark.
  const conceptForCommitment = (commitment: GoalItem) => {
    for (const id of commitment.relatedObjectIds?.positionIds || []) {
      const position = positions.find((item) => item.id === id);
      const concept = position && conceptIdForTags(position.tags || []);
      if (concept) return concept;
    }
    return undefined;
  };

  // Which landmarks each island will carry, gathered before anything is
  // placed. The island has to be sized to seat exactly these, so this list is
  // the one source of truth: anything counted here gets a seat, and nothing
  // gets a seat that was not counted.
  type Landmark = Omit<WorldRecord, 'wx' | 'wy'>;
  const landmarks: Landmark[] = [];
  const claim = (type: RecordType, id: string, label: string, born: string | undefined, conceptId: string | undefined, extra: Partial<WorldRecord> = {}) => {
    if (!conceptId || !conceptById.has(conceptId) || !label?.trim()) return;
    landmarks.push({ id: `${type}:${id}`, type, label, conceptId, born: time(born), ...extra });
  };
  positions.filter((p) => !['abandoned', 'rejected', 'replaced'].includes(p.status)).forEach((p) =>
    claim('position', p.id, p.title, p.dateCreated, conceptIdForTags(p.tags || []), { confidence: typeof p.confidence === 'number' ? Math.max(0, Math.min(100, p.confidence)) : undefined, detail: p.statement }));
  inquiries.forEach((q) =>
    claim('inquiry', q.id, q.text, q.dateCreated, conceptIdForTags((q as Question & { conceptTags?: string[] }).conceptTags || [], (q as Question & { conceptIds?: string[] }).conceptIds || []), { fog: inquiryFog(q.status), detail: q.status?.replace(/_/g, ' ') }));
  practices.forEach((x) => claim('practice', x.id, x.title, x.startDate || x.dateCreated, conceptIdForTags(x.conceptTags || []), { detail: (x.type || 'practice').replace(/_/g, ' ') }));
  (works || []).forEach((w) => claim('work', w.id, w.title, w.dateCreated, conceptIdForTags(w.conceptTags || []), { detail: (w.type || 'work').replace(/_/g, ' ') }));
  (commitments || []).filter((item) => !['completed', 'abandoned'].includes(item.status)).forEach((item) =>
    claim('practice', item.id, item.title, item.createdAt, conceptForCommitment(item), { detail: 'commitment' }));
  sources.forEach((source) => (source.annotations || []).forEach((note) =>
    claim('annotation', note.id || `${source.id}:${note.text.slice(0, 12)}`, note.text, note.date || source.dateAdded, conceptIdForTags(note.conceptTags || [], []), { detail: source.title })));
  sources.forEach((s) => claim('source', s.id, s.title, s.dateAdded, conceptIdForTags(s.tags || [], s.conceptIds || []), { detail: s.creator }));

  const seatCount = new Map<string, number>(concepts.map((concept) => [concept.id, 0]));
  landmarks.forEach((landmark) => seatCount.set(landmark.conceptId, (seatCount.get(landmark.conceptId) || 0) + 1));

  // How much rests on each concept — the one number behind both its height in
  // contour rings and how far its coast reaches. Annotations are handed over
  // as the notes, separately from the rest, so a note is counted once.
  const involvement = conceptInvolvement({
    concepts,
    records: landmarks.filter((landmark) => landmark.type !== 'annotation'),
    notes: landmarks.filter((landmark) => landmark.type === 'annotation'),
  }, links || []);

  const clarityOf = (concept: Concept) => [concept.description?.trim(), (concept.examples || []).length, (concept.aliases || []).length || (concept.notSameAs || []).length, (concept.counterexamples || []).length].filter(Boolean).length;
  const radiusOf = (concept: Concept) => islandRadius(involvement.get(concept.id) || 0, clarityOf(concept), seatCount.get(concept.id) || 0);

  // Each region draws its own figure, sized so its islands never touch.
  const regionPlans = allRegions.map((region, index) => {
    const members = region.conceptIds.map((id) => conceptById.get(id)).filter((concept): concept is Concept => Boolean(concept) && regionOf.get(concept!.id) === index);
    const order = orderRegionConcepts(members);
    const sorted = order.map((id) => members.find((concept) => concept.id === id)!).filter(Boolean);
    const radii = sorted.map(radiusOf);
    const shape = constellationShape(region.id, radii);
    const reach = Math.max(210, ...shape.map((point, slot) => Math.hypot(point.dx, point.dy) + radii[slot])) + 70;
    return { members: sorted, radii, shape, reach };
  });

  const span = Math.max(430, ...regionPlans.map((plan) => plan.reach));
  const columns = Math.max(1, Math.ceil(Math.sqrt(allRegions.length * 1.6)));
  const rows = Math.ceil(allRegions.length / columns);
  const jitter = (seed: number) => Math.sin(seed * 12.9898) * 43758.5453 % 1;
  const regionCenters = allRegions.map((_, index) => {
    if (allRegions.length === 1) return { wx: 0, wy: 0 };
    const column = index % columns; const row = Math.floor(index / columns);
    const wx = (column - (columns - 1) / 2) * span * 2.25 + (row % 2 ? span * 0.34 : -span * 0.34) + jitter(index + 1) * 78;
    const wy = (row - (rows - 1) / 2) * span * 1.85 + jitter(index + 7) * 70;
    return { wx, wy };
  });

  const worldConcepts: WorldConcept[] = [];
  regionPlans.forEach((plan, region) => {
    plan.members.forEach((concept, slot) => {
      worldConcepts.push({
        id: concept.id, name: concept.name, definition: concept.description || '', status: concept.philosophyStatus,
        clarity: clarityOf(concept), born: time(concept.dateCreated), region, island: plan.radii[slot],
        wx: regionCenters[region].wx + plan.shape[slot].dx,
        wy: regionCenters[region].wy + plan.shape[slot].dy,
      });
    });
  });

  // Seat the landmarks each island was sized for. Sources are seated last so
  // they take the outermost ring: a source docks at the shore.
  const conceptPlace = new Map(worldConcepts.map((concept) => [concept.id, concept]));
  const perIsland = new Map<string, Landmark[]>();
  landmarks.forEach((landmark) => {
    const list = perIsland.get(landmark.conceptId) || [];
    list.push(landmark);
    perIsland.set(landmark.conceptId, list);
  });
  const records: WorldRecord[] = [];
  perIsland.forEach((list, conceptId) => {
    const concept = conceptPlace.get(conceptId);
    if (!concept) return;
    const ordered = [...list.filter((item) => item.type !== 'source'), ...list.filter((item) => item.type === 'source')];
    // Seated against this island, so the rings use the ground it actually has.
    const { seats } = islandSeating(ordered.length, concept.island);
    ordered.forEach((landmark, index) => {
      const seat = seats[index];
      records.push({
        ...landmark,
        wx: concept.wx + Math.cos(seat.angle) * seat.reach,
        wy: concept.wy + Math.sin(seat.angle) * seat.reach * ISLAND_SQUASH,
      });
    });
  });

  // Boats ride the water just off each shore, one for each boundary recorded.
  const boundaries: WorldBoundary[] = [];
  worldConcepts.forEach((concept) => {
    const source = conceptById.get(concept.id);
    if (!source) return;
    conceptBoundaryMarks(source).slice(0, 7).forEach((boundary, index) => {
      const angle = Math.PI * 0.35 + index * 0.72;
      const reach = concept.island * 1.5;
      boundaries.push({
        id: `boundary:${concept.id}:${index}`, conceptId: concept.id, kind: boundary.kind, text: boundary.text, reason: boundary.reason,
        wx: concept.wx + Math.cos(angle) * reach, wy: concept.wy + Math.sin(angle) * reach * 0.8,
      });
    });
  });

  const notes = records.filter((record) => record.type === 'annotation').map((record) => ({ text: record.label, kind: 'note', conceptId: record.conceptId }));
  return { regions: allRegions, regionCenters, regionPlans, concepts: worldConcepts, records, boundaries, notes, involvement };
}

export function AtlasTerritoryCanvas({ regions, concepts, positions, inquiries, sources, practices, works, commitments, links, asOf, from, onOpen, onOpenRegion, focus, fullScreen, onToggleFullScreen }: {
  regions: AtlasRegionViewModel[]; concepts: Concept[]; positions: VaultEntry[]; inquiries: Question[]; sources: Media[]; practices: Practice[]; works?: Draft[]; commitments?: GoalItem[];
  links: PhilosophicalLink[]; asOf?: number | null; from?: number | null;
  focus?: { id: string } | null;
  fullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onOpenRegion?: (id: string) => void;
  onOpen: (target: { type: 'concept' | RecordType; id: string }) => void;
}) {
  const world = useMemo(() => buildAtlasWorld({ regions, concepts, positions, inquiries, sources, practices, works, commitments, links }), [regions, concepts, positions, inquiries, sources, practices, works, commitments, links]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ x: 0, y: 0, k: LEVELS[0][1], tx: 0, ty: 0, tk: LEVELS[0][1] });
  const [level, setLevel] = useState(0);
  const [selection, setSelection] = useState<AtlasCanvasSelection | null>(null);
  /** Which of a concept's record counts has been opened into a list. */
  const [listed, setListed] = useState<RecordType | null>(null);
  /** Whether the phone-sized sheet is open. On a wide screen the panel is always there. */
  const [sheetOpen, setSheetOpen] = useState(false);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const timeRef = useRef({ asOf, from });
  timeRef.current = { asOf, from };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = 0; let height = 0; let raf = 0; let alive = true;
    const css = (name: string) => `hsl(${getComputedStyle(canvas).getPropertyValue(name).trim()})`;
    const alpha = (color: string, a: number) => color.replace(/^hsl\((.*)\)$/, `hsl($1 / ${a})`);
    let dark = document.documentElement.classList.contains('dark');
    let sea: CanvasPattern | null = null;
    let sky: CanvasPattern | null = null;
    const stars = document.createElement('canvas');
    stars.width = 317; stars.height = 277;
    const starlight = stars.getContext('2d');
    if (starlight) {
      starlight.fillStyle = CANVAS_SKY(); starlight.fillRect(0, 0, stars.width, stars.height);
      let seed = 11;
      const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 43; i++) {
        starlight.fillStyle = `rgba(210, 228, 246, ${0.14 + random() * 0.30})`;
        starlight.fillRect(random() * stars.width, random() * stars.height, i % 7 === 0 ? 2 : 1, 1);
      }
      sky = ctx.createPattern(stars, 'repeat');
    }
    const refreshSea = () => {
      dark = document.documentElement.classList.contains('dark');
      const tile = document.createElement('canvas'); tile.width = 256; tile.height = 256;
      const p = tile.getContext('2d'); if (!p) return;
      p.fillStyle = dark ? '#112c38' : '#d2e8ea'; p.fillRect(0, 0, 256, 256);
      p.strokeStyle = dark ? '#224451' : '#badadc'; p.lineWidth = 1;
      for (const [x, y] of [[32, 40], [148, 104], [62, 174], [198, 222]]) {
        p.beginPath(); p.moveTo(x, y);
        p.bezierCurveTo(x + 5, y - 3, x + 11, y + 3, x + 18, y); p.stroke();
      }
      sea = ctx.createPattern(tile, 'repeat');
    };
    // The first view holds the whole sky with room around it, so no region is
    // pinned in a corner and any of them can be zoomed toward straight away.
    let fitted = false;
    const fit = () => {
      if (fitted || !width || !height || !world.concepts.length) return;
      fitted = true;
      const xs = world.concepts.map((concept) => concept.wx);
      const ys = world.concepts.map((concept) => concept.wy);
      const pad = 300;
      const left = Math.min(...xs) - pad; const right = Math.max(...xs) + pad;
      const top = Math.min(...ys) - pad; const bottom = Math.max(...ys) + pad;
      // The side panel sits over the canvas, so the sky is fitted into what is
      // left of it: no constellation opens underneath the panel.
      const reserve = width >= 760 ? 330 : 0;
      const room = Math.max(240, width - reserve);
      const k = Math.max(0.05, Math.min(0.42, Math.min(room / Math.max(1, right - left), height / Math.max(1, bottom - top))));
      const v = view.current;
      v.x = v.tx = (left + right) / 2 + reserve / (2 * k);
      v.y = v.ty = (top + bottom) / 2;
      v.k = v.tk = k;
    };
    const size = () => { const ratio = window.devicePixelRatio || 1; width = canvas.clientWidth; height = canvas.clientHeight; canvas.width = width * ratio; canvas.height = height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); fit(); };
    refreshSea();
    const themeWatch = new MutationObserver(refreshSea);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    size();
    const observer = new ResizeObserver(size); observer.observe(canvas);
    const toScreen = (x: number, y: number) => { const v = view.current; return [(x - v.x) * v.k + width / 2, (y - v.y) * v.k + height / 2] as const; };
    const seen = (born: number) => !timeRef.current.asOf || !born || born <= timeRef.current.asOf + 86399999;
    const isNew = (born: number) => Boolean(timeRef.current.from && born && born >= (timeRef.current.from || 0) && seen(born));
    const blob = (x: number, y: number, r: number, seed: number) => {
      ctx.beginPath();
      for (let i = 0; i <= 28; i += 1) {
        const a = (i / 28) * Math.PI * 2; const rr = r * (1 + 0.13 * Math.sin(a * 3 + seed) + 0.07 * Math.cos(a * 5 + seed * 1.7));
        const px = x + Math.cos(a) * rr * 1.2; const py = y + Math.sin(a) * rr * 0.85;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
    };
    let placed: number[][] = [];
    const label = (text: string, x: number, y: number, font: string, color: string) => {
      ctx.font = font; const w = ctx.measureText(text).width; const box = [x - w / 2 - 4, y - 16, w + 8, 22];
      if (placed.some((p) => box[0] < p[0] + p[2] && box[0] + box[2] > p[0] && box[1] < p[1] + p[3] && box[1] + box[3] > p[1])) return;
      placed.push(box); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(text, x, y);
    };
    const wrap = (text: string, x: number, y: number, max: number, lineHeight: number, align: CanvasTextAlign = 'center', maxLines = 3) => {
      ctx.textAlign = align; const words = text.split(' '); let line = ''; let n = 0;
      for (const word of words) { const test = line ? `${line} ${word}` : word; if (ctx.measureText(test).width > max && line) { ctx.fillText(line, x, y + n * lineHeight); line = word; n += 1; if (n >= maxLines) return; } else line = test; }
      ctx.fillText(line, x, y + n * lineHeight);
    };

    // ---------- the landmark alphabet ----------
    // Each one is a silhouette: they stay apart in a screenshot with the
    // colour removed, which is the only way a map legend ever really works.
    const star = (x: number, y: number, s: number) => {
      ctx.beginPath(); ctx.moveTo(x, y - s * 1.3);
      ctx.lineTo(x + s * .32, y - s * .32); ctx.lineTo(x + s, y);
      ctx.lineTo(x + s * .32, y + s * .32); ctx.lineTo(x, y + s * 1.3);
      ctx.lineTo(x - s * .32, y + s * .32); ctx.lineTo(x - s, y);
      ctx.lineTo(x - s * .32, y - s * .32); ctx.closePath();
    };
    /**
     * Landmarks are the navigation's own glyphs.
     *
     * A position on the map is the planted flag from the Positions tab; a
     * source is the book from the Library. The geometry comes from
     * NOESIS_GLYPH_PARTS rather than being redrawn here, so the map cannot
     * drift away from the navigation: change a glyph once and both follow.
     * Drawn on the glyph's own 14 x 14 grid under a transform, which keeps
     * stroke weights in the proportions the icon was designed with.
     */
    const glyphCache = new Map<string, Path2D>();
    const drawGlyph = (key: NoesisGlyphKey, x: number, y: number, size: number) => {
      const parts = NOESIS_GLYPH_PARTS[key];
      ctx.save();
      ctx.translate(x - size / 2, y - size / 2);
      ctx.scale(size / 14, size / 14);
      for (const [tag, attrs] of parts) {
        const a = attrs as Record<string, string | number>;
        const filled = a.fill === 'currentColor';
        ctx.globalAlpha = ctx.globalAlpha * (typeof a.opacity === 'number' ? a.opacity : 1);
        // The glyphs are drawn for a 14–24px tab icon, where a 1px hairline
        // reads. Shrunk onto the map that hairline disappears and the mark
        // becomes a smudge, so hold a floor of roughly a screen pixel while
        // keeping the proportions each glyph was designed with.
        const designed = typeof a.strokeWidth === 'number' ? a.strokeWidth : 1.2;
        ctx.lineWidth = Math.max(designed, (14 / size) * 1.05);
        let path: Path2D;
        if (tag === 'path') {
          const d = String(a.d);
          path = glyphCache.get(d) || new Path2D(d);
          glyphCache.set(d, path);
        } else if (tag === 'circle') {
          path = new Path2D();
          path.arc(Number(a.cx), Number(a.cy), Number(a.r), 0, Math.PI * 2);
        } else {
          path = new Path2D();
          path.rect(Number(a.x), Number(a.y), Number(a.width), Number(a.height));
        }
        if (filled) ctx.fill(path); else ctx.stroke(path);
        ctx.globalAlpha = ctx.globalAlpha / (typeof a.opacity === 'number' ? a.opacity : 1);
      }
      ctx.restore();
    };

    /**
     * An inquiry: fog lying on the ground.
     *
     * Real fog is not a glow. It is many thin banks of vapour, wider than they
     * are tall, drifting at different speeds and thickening where they
     * overlap — so this draws nine of them rather than one, each faint, and
     * lets the density come from the stacking. The banks drift slowly and
     * deterministically from the inquiry's own seed, so the weather over one
     * question is always its own and never jitters between frames.
     */
    const fogPatch = (x: number, y: number, r: number, density: number, seed: number, drift: number) => {
      ctx.save();
      for (let layer = 0; layer < 9; layer += 1) {
        const wobble = Math.sin(seed * 1.7 + layer * 2.3);
        const speed = 0.45 + ((layer * 37 + seed * 13) % 10) / 14;
        const bank = r * (0.42 + (layer % 4) * 0.19);
        const px = x + wobble * r * 0.46 + Math.sin(drift * speed + layer) * r * 0.2;
        const py = y + Math.cos(seed * 2.1 + layer * 1.9) * r * 0.26 + Math.sin(drift * speed * 0.6 + layer) * r * 0.06;
        const cloud = ctx.createRadialGradient(px, py, 0, px, py, bank);
        const weight = 0.17 * density * (1 - layer / 16);
        cloud.addColorStop(0, `rgba(232, 240, 248, ${weight})`);
        cloud.addColorStop(0.6, `rgba(220, 232, 243, ${weight * 0.55})`);
        cloud.addColorStop(1, 'rgba(220, 232, 243, 0)');
        ctx.fillStyle = cloud;
        // Banks are flat: fog settles along the ground rather than balling up.
        ctx.beginPath(); ctx.ellipse(px, py, bank * 1.65, bank * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    };
    /** A boundary: a small boat holding station just off the shore. */
    const boat = (x: number, y: number, s: number) => {
      ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.35); ctx.quadraticCurveTo(x, y + s * 1.05, x + s, y + s * 0.35); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, y + s * 0.3); ctx.lineTo(x, y - s * 1.25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + s * 0.12, y - s * 1.2); ctx.lineTo(x + s * 0.95, y + s * 0.15); ctx.lineTo(x + s * 0.12, y + s * 0.15); ctx.closePath(); ctx.fill();
    };

    const conceptById = new Map(world.concepts.map((concept) => [concept.id, concept]));
    const conceptLinks = links.filter((link) => link.fromType === 'concept' && link.toType === 'concept' && conceptById.has(link.fromId) && conceptById.has(link.toId));
    // Worked out alongside the island sizes, so a concept's height and the
    // reach of its coast can never tell different stories.
    const involvement = world.involvement;

    const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const started = performance.now();

    const frame = () => {
      if (!alive) return;
      const drift = calm ? 0 : (performance.now() - started) / 2600;
      const v = view.current;
      v.x += (v.tx - v.x) * 0.18; v.y += (v.ty - v.y) * 0.18; v.k = Math.exp(Math.log(v.k) + (Math.log(v.tk) - Math.log(v.k)) * 0.18);
      const k = v.k; placed = [];
      const accent = css('--stage-integrate'); const fg = css('--foreground');
      // The three distances, overlapping so nothing pops into being.
      const starA = fadeOut(k, 0.46, 0.55);
      const land = fadeIn(k, 0.2, 0.42);
      const islandA = fadeIn(k, 0.26, 0.5);
      const recordA = fadeIn(k, 1.15, 0.55);
      const deepA = fadeIn(k, 3.2, 0.5);
      ctx.fillStyle = sky || CANVAS_SKY();
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.globalAlpha = land;
      ctx.fillStyle = sea || css('--background');
      const driftX = -(v.x * k * .18) % 256, driftY = -(v.y * k * .18) % 256;
      ctx.translate(driftX, driftY); ctx.fillRect(-driftX, -driftY, width, height); ctx.restore();
      const ink = land < 0.6 ? 'hsl(211 51% 94%)' : fg;
      const visibleConcepts = world.concepts.filter((concept) => seen(concept.born));
      const regionVisible = (index: number) => visibleConcepts.some((concept) => concept.region === index);
      const selected = selectionRef.current;
      const selectedId = selected?.kind === 'concept' ? selected.concept.id : null;

      // ---------- the shelf each region's islands sit on ----------
      ctx.globalAlpha = land * 0.55;
      for (let index = 0; land > 0 && index < world.regions.length; index++) {
        if (!regionVisible(index)) continue;
        const [x, y] = toScreen(world.regionCenters[index].wx, world.regionCenters[index].wy);
        const r = (world.regionPlans[index]?.reach || 300) * k;
        if (x + r * 1.6 < 0 || x - r * 1.6 > width || y + r * 1.25 < 0 || y - r * 1.25 > height) continue;
        blob(x, y, r, index * 1.3); ctx.fillStyle = dark ? '#18394544' : '#bfdfe055'; ctx.fill();
        const focusedRegion = selected?.kind === 'region' && selected.index === index;
        ctx.strokeStyle = focusedRegion ? accent : dark ? '#3c6a71' : '#9bc3c0'; ctx.lineWidth = focusedRegion ? 2.5 : 1; ctx.setLineDash([9, 7]); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;

      // ---------- far: one constellation per region ----------
      if (starA > 0.01) {
        ctx.globalAlpha = starA;
        world.regions.forEach((region, index) => {
          if (!regionVisible(index)) return;
          const members = world.regionPlans[index].members
            .map((member) => visibleConcepts.find((concept) => concept.id === member.id))
            .filter((concept): concept is WorldConcept => Boolean(concept));
          if (!members.length) return;
          const points = members.map((concept) => toScreen(concept.wx, concept.wy));
          // Straight segments around the group, closed once there are three.
          // Only ever within one region: no line crosses to another group.
          if (points.length > 1) {
            ctx.strokeStyle = alpha('hsl(211 51% 94%)', 0.5); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
            for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
            if (points.length >= 3) ctx.closePath();
            ctx.stroke();
          }
          points.forEach(([x, y]) => { star(x, y, Math.max(2.6, Math.min(7, 7 * k * 2.2))); ctx.fillStyle = '#ffedbc'; ctx.fill(); });
          const cx = points.reduce((sum, point) => sum + point[0], 0) / points.length;
          const low = Math.max(...points.map((point) => point[1]));
          ctx.textAlign = 'center';
          ctx.font = 'italic 600 15px "Playfair Display", Georgia, serif'; ctx.fillStyle = 'hsl(211 51% 94%)'; ctx.fillText(region.name, cx, low + 26);
          ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = alpha('hsl(211 51% 94%)', 0.65); ctx.fillText(`${members.length} CONCEPT${members.length === 1 ? '' : 'S'}`, cx, low + 41);
        });
        ctx.globalAlpha = 1;
      }

      // ---------- routes between concepts ----------
      if (islandA > 0.01) {
        conceptLinks.forEach((link) => {
          const a = conceptById.get(link.fromId)!; const b = conceptById.get(link.toId)!;
          if (!seen(a.born) || !seen(b.born)) return;
          const [x1, y1] = toScreen(a.wx, a.wy); const [x2, y2] = toScreen(b.wx, b.wy);
          const focused = selectedId && (a.id === selectedId || b.id === selectedId);
          if (selectedId && !focused && recordA > 0.4) return;
          ctx.globalAlpha = islandA * (focused ? 1 : 0.75);
          ctx.strokeStyle = alpha(css(LINK_TONE(link.type)), focused ? 0.95 : selectedId ? 0.18 : 0.5);
          ctx.lineWidth = focused ? 2.6 : 1.3; ctx.beginPath();
          if (link.type === 'contradicts') {
            ctx.moveTo(x1, y1);
            for (let i = 1; i < 10; i += 1) { const t = i / 10; const x = x1 + (x2 - x1) * t; const y = y1 + (y2 - y1) * t; const o = (i % 2 ? 1 : -1) * 7; const nx = -(y2 - y1); const ny = x2 - x1; const l = Math.hypot(nx, ny) || 1; ctx.lineTo(x + (nx / l) * o, y + (ny / l) * o); }
            ctx.lineTo(x2, y2);
          } else { ctx.setLineDash([7, 5]); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 26 * Math.min(k, 2), x2, y2); }
          ctx.stroke(); ctx.setLineDash([]);
          if (k > 0.7 && focused) { ctx.fillStyle = css(LINK_TONE(link.type)); ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(link.type.replace(/_/g, ' ').toUpperCase(), (x1 + x2) / 2, (y1 + y2) / 2 - 14 * Math.min(k, 2)); }
        });
        ctx.globalAlpha = 1;
      }

      // ---------- mid: one island per concept ----------
      if (islandA > 0.01) {
        visibleConcepts.forEach((concept, index) => {
          const [x, y] = toScreen(concept.wx, concept.wy);
          const r = concept.island * k;
          if (x + r * 2 < 0 || x - r * 2 > width || y + r * 1.6 < 0 || y - r * 1.6 > height) return;
          ctx.globalAlpha = islandA;
          const fresh = isNew(concept.born);
          blob(x, y, r * 1.16, index * 1.7); ctx.fillStyle = dark ? '#24505a' : '#a9d3d4'; ctx.fill();
          blob(x, y, r, index * 1.7); ctx.fillStyle = dark ? '#28403b' : '#ecedda'; ctx.fill();
          const rings = elevationRings(involvement.get(concept.id) || 0);
          for (let ring = 0; ring < rings; ring += 1) {
            // Each line is a fixed step up, so the lines bunch near the top of
            // a high concept exactly as they do on a real topographic map.
            const step = Math.pow(1 - ring / (rings + 0.55), 1.25);
            blob(x, y, r * step, index * 1.7 + ring * 0.35);
            ctx.strokeStyle = ring === 0
              ? (concept.id === selectedId ? accent : dark ? '#7fa39c' : '#6f958f')
              : alpha(ink, Math.min(0.7, 0.26 + ring * 0.09));
            ctx.lineWidth = ring === 0 ? (concept.id === selectedId ? 2.6 : 1.4) : 0.75 + ring * 0.08;
            if (ring === 0 && concept.status === 'contested') ctx.setLineDash([6, 4]);
            ctx.stroke(); ctx.setLineDash([]);
          }
          // A summit on the concepts most of the thinking rests on.
          if (rings >= 4 && r > 34) {
            const peak = r * 0.07;
            ctx.beginPath();
            ctx.moveTo(x - peak, y + peak * 0.6); ctx.lineTo(x, y - peak); ctx.lineTo(x + peak, y + peak * 0.6);
            ctx.closePath();
            ctx.strokeStyle = alpha(ink, 0.55); ctx.lineWidth = 1; ctx.stroke();
          }
          if (fresh) { ctx.fillStyle = accent; ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('NEW', x, y - r * 1.25); }
          if (starA < 0.5) label(concept.name, x, y - r * 1.05 - 10, `italic 600 ${Math.max(13, Math.min(21, 15 * Math.max(k, 0.9)))}px "Playfair Display", Georgia, serif`, ink);
        });
        ctx.globalAlpha = 1;
      }

      // ---------- fog sits on the land, under the landmarks ----------
      if (islandA > 0.01) {
        world.records.forEach((record) => {
          if (record.type !== 'inquiry' || !record.fog) return;
          const owner = conceptById.get(record.conceptId); if (!owner || !seen(record.born) || !seen(owner.born)) return;
          const [x, y] = toScreen(record.wx, record.wy);
          const r = Math.max(15, Math.min(104, owner.island * 0.46 * k));
          if (x + r * 2 < 0 || x - r * 2 > width || y + r * 2 < 0 || y - r * 2 > height) return;
          ctx.globalAlpha = islandA * (0.55 + recordA * 0.45);
          const seed = [...record.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 97;
          fogPatch(x, y, r, record.fog, seed, drift);
          ctx.globalAlpha = 1;
        });
      }

      // ---------- boats offshore, one for each recorded boundary ----------
      if (islandA > 0.01) {
        world.boundaries.forEach((boundary) => {
          const owner = conceptById.get(boundary.conceptId); if (!owner || !seen(owner.born)) return;
          const [x, y] = toScreen(boundary.wx, boundary.wy);
          const s = Math.max(4, Math.min(13, owner.island * 0.17 * k));
          if (x < -40 || x > width + 40 || y < -40 || y > height + 40) return;
          ctx.globalAlpha = islandA;
          const chosen = selected?.kind === 'boundary' && selected.boundary.id === boundary.id;
          ctx.fillStyle = chosen ? accent : dark ? '#e7ddc6' : '#4c4334';
          ctx.strokeStyle = ctx.fillStyle as string; ctx.lineWidth = Math.max(1, s * 0.16);
          boat(x, y, s);
          if (chosen) { ctx.beginPath(); ctx.arc(x, y, s * 2.1, 0, 7); ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.stroke(); }
          ctx.globalAlpha = 1;
        });
      }

      // ---------- near: the landmarks on the island ----------
      if (recordA > 0.01) {
        world.records.forEach((record) => {
          const owner = conceptById.get(record.conceptId); if (!owner || !seen(record.born) || !seen(owner.born)) return;
          if (record.type === 'inquiry' && !record.fog) return;
          const [x, y] = toScreen(record.wx, record.wy);
          if (x < -60 || x > width + 60 || y < -60 || y > height + 60) return;
          const s = Math.max(5, Math.min(16, owner.island * 0.17 * k));
          const tone = css(RECORD_TONE[record.type]);
          ctx.globalAlpha = recordA;
          ctx.fillStyle = tone; ctx.strokeStyle = tone; ctx.lineWidth = Math.max(1.2, s * 0.18);
          drawGlyph(GLYPH_FOR[record.type], x, y, s * 2.6);
          if (selected?.kind === 'record' && selected.record.id === record.id) {
            ctx.strokeStyle = fg; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, s * 2.2, 0, 7); ctx.stroke();
          }
          if (recordA > 0.45) label(record.label.length > 30 ? `${record.label.slice(0, 28)}…` : record.label, x, y + s * 2.4, '13px Spectral, Georgia, serif', alpha(ink, 0.92));
          ctx.globalAlpha = 1;
        });
      }

      // ---------- closest: the definition itself ----------
      if (deepA > 0.01) {
        ctx.globalAlpha = deepA;
        visibleConcepts.forEach((concept) => {
          const [x, y] = toScreen(concept.wx, concept.wy); if (x < -400 || x > width + 400 || y < -400 || y > height + 400) return;
          ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = accent; ctx.textAlign = 'center'; ctx.fillText(concept.definition ? 'DEFINITION' : 'NO DEFINITION YET', x, y - 10);
          ctx.fillStyle = fg; ctx.font = `italic ${Math.min(17, 3.4 * k)}px "Playfair Display", Georgia, serif`;
          if (concept.definition) wrap(concept.definition, x, y + 12, Math.min(190, 46 * k), 19);
        });
        ctx.globalAlpha = 1;
      }

      const nextLevel = k < 0.42 ? 0 : k < 1.5 ? 1 : 2;
      setLevel((current) => current === nextLevel ? current : nextLevel);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const zoomAt = (factor: number, mx: number, my: number) => {
      const v = view.current; const nk = Math.max(0.04, Math.min(9, v.tk * factor));
      const wx = (mx - width / 2) / v.k + v.x; const wy = (my - height / 2) / v.k + v.y;
      v.tx = wx - (mx - width / 2) / nk; v.ty = wy - (my - height / 2) / nk; v.tk = nk;
    };
    const onWheel = (event: WheelEvent) => { event.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - r.left, event.clientY - r.top); };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    const pointers = new Map<number, [number, number]>(); let lastDistance = 0; let moved = false;
    const hitConcept = (mx: number, my: number) => world.concepts.find((concept) => {
      if (!seen(concept.born)) return false;
      const [x, y] = toScreen(concept.wx, concept.wy);
      return Math.hypot(x - mx, y - my) < Math.max(22, concept.island * view.current.k * 0.9);
    });
    const hitRecord = (mx: number, my: number) => view.current.k > 1.1 ? world.records.find((record) => {
      if (record.type === 'inquiry' && !record.fog) return false;
      const [x, y] = toScreen(record.wx, record.wy);
      return Math.hypot(x - mx, y - my) < 16;
    }) : undefined;
    const hitBoundary = (mx: number, my: number) => view.current.k > 0.4 ? world.boundaries.find((boundary) => {
      const [x, y] = toScreen(boundary.wx, boundary.wy);
      return Math.hypot(x - mx, y - my) < 16;
    }) : undefined;
    const down = (event: PointerEvent) => { canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, [event.clientX, event.clientY]); moved = false; };
    const hitRegion = (mx: number, my: number) => {
      const v = view.current;
      let nearest = -1;
      let distance = Infinity;
      world.regionCenters.forEach((center, index) => {
        const [x, y] = toScreen(center.wx, center.wy);
        const radius = Math.max(32, (world.regionPlans[index]?.reach || 300) * v.k);
        const gap = Math.hypot((x - mx) / 1.2, (y - my) / 0.85);
        if (gap >= radius || gap >= distance || !world.concepts.some(concept => concept.region === index && seen(concept.born))) return;
        nearest = index; distance = gap;
      });
      return nearest;
    };
    const move = (event: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      if (!pointers.has(event.pointerId)) {
        const mx = event.clientX - r.left; const my = event.clientY - r.top;
        canvas.style.cursor = hitRecord(mx, my) || hitBoundary(mx, my) || hitConcept(mx, my) || hitRegion(mx, my) >= 0 ? 'pointer' : 'grab';
        return;
      }
      const previous = pointers.get(event.pointerId)!; pointers.set(event.pointerId, [event.clientX, event.clientY]);
      const v = view.current;
      if (pointers.size === 1) { const dx = event.clientX - previous[0]; const dy = event.clientY - previous[1]; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; v.tx -= dx / v.k; v.ty -= dy / v.k; v.x = v.tx; v.y = v.ty; }
      else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (lastDistance) zoomAt(d / lastDistance, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); lastDistance = d; moved = true; }
    };
    const up = (event: PointerEvent) => {
      const r = canvas.getBoundingClientRect(); const mx = event.clientX - r.left; const my = event.clientY - r.top; const v = view.current;
      if (!moved && pointers.size === 1) {
        const record = hitRecord(mx, my);
        const boundary = record ? undefined : hitBoundary(mx, my);
        if (record) setSelection({ kind: 'record', record, conceptName: world.concepts.find((concept) => concept.id === record.conceptId)?.name || '' });
        else if (boundary) setSelection({ kind: 'boundary', boundary, conceptName: world.concepts.find((concept) => concept.id === boundary.conceptId)?.name || '' });
        else {
          const concept = v.k >= 0.42 ? hitConcept(mx, my) : null;
          if (concept) {
            setSelection({ kind: 'concept', concept });
            // Bring the island close enough to read, but never further than the
            // records level: the map should not leap past what was asked for.
            if (v.k < 1.4) { v.tx = concept.wx; v.ty = concept.wy; v.tk = 1.8; }
          } else {
            const index = hitRegion(mx, my);
            if (index >= 0) setSelection({ kind: 'region', region: world.regions[index], index });
          }
        }
      }
      pointers.delete(event.pointerId); if (pointers.size < 2) lastDistance = 0;
    };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    return () => {
      alive = false; cancelAnimationFrame(raf); observer.disconnect(); themeWatch.disconnect();
      canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
    };
  }, [world, links]);

  // Choosing something else closes the list that was open on the last concept.
  const listedFor = useRef<string | null>(null);
  const conceptInHand = selection?.kind === 'concept' ? selection.concept.id : null;
  if (listedFor.current !== conceptInHand) { listedFor.current = conceptInHand; if (listed) setListed(null); }
  const hadSelection = useRef(false);
  if (Boolean(selection) !== hadSelection.current) { hadSelection.current = Boolean(selection); if (selection && !sheetOpen) setSheetOpen(true); }

  useEffect(() => {
    if (!focus) return;
    const concept = world.concepts.find(item => item.id === focus.id);
    if (!concept || (asOf && concept.born && concept.born > asOf + 86_399_999)) return;
    const v = view.current; v.tx = concept.wx; v.ty = concept.wy; v.tk = 1.6;
    setSelection({ kind: 'concept', concept });
  }, [focus, world, asOf]);

  const goLevel = (index: number) => {
    const v = view.current; v.tk = LEVELS[index][1];
    if (index === 0 && world.concepts.length) {
      const xs = world.concepts.map((concept) => concept.wx); const ys = world.concepts.map((concept) => concept.wy);
      v.tx = (Math.min(...xs) + Math.max(...xs)) / 2 + (canvasRef.current && canvasRef.current.clientWidth >= 760 ? 330 / (2 * LEVELS[0][1]) : 0);
      v.ty = (Math.min(...ys) + Math.max(...ys)) / 2;
    }
    if (index === 2) { const target = selection?.kind === 'concept' ? selection.concept : world.concepts[0]; if (target) { v.tx = target.wx; v.ty = target.wy; } }
  };
  const zoom = (factor: number) => { const v = view.current; v.tk = Math.max(0.04, Math.min(9, v.tk * factor)); };
  const regionDetail = selection?.kind === 'region' ? regions.find(region => region.id === selection.region.id) : undefined;
  const regionConcepts = selection?.kind === 'region' ? world.concepts.filter((concept) => concept.region === selection.index && (!asOf || !concept.born || concept.born <= asOf + 86_399_999)) : [];
  const openConcept = (concept: WorldConcept) => { setSelection({ kind: 'concept', concept }); const v = view.current; v.tx = concept.wx; v.ty = concept.wy; v.tk = 1.8; };
  const selectedBoundaries = selection?.kind === 'concept' ? world.boundaries.filter((boundary) => boundary.conceptId === selection.concept.id) : [];

  return (
    <div className={cn("noesis-territory", fullScreen && "noesis-territory--fullscreen")}>
      <canvas ref={canvasRef} className="noesis-territory__canvas" aria-label="Atlas map. Scroll or pinch to zoom anywhere, drag to pan, select a region, concept, landmark, or boundary." />
      <div className="noesis-territory__levels" role="group" aria-label="Zoom to a reading distance">
        {LEVELS.map(([name], index) => (
          <button key={name} type="button" aria-current={level === index} onClick={() => goLevel(index)}><i />{name}</button>
        ))}
      </div>
      <div className="noesis-territory__zoom">
        <button type="button" aria-label="Zoom out" onClick={() => zoom(0.7)}>−</button>
        <button type="button" aria-label="Zoom in" onClick={() => zoom(1.4)}>+</button>
        {onToggleFullScreen && <button type="button" className="grid place-items-center" aria-label={fullScreen ? 'Exit full screen map' : 'Open full screen map'} aria-pressed={!!fullScreen} onClick={onToggleFullScreen}>
          {fullScreen ? <Minimize size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}
        </button>}
      </div>
      <aside className="noesis-territory__panel" aria-label="Selection" data-open={sheetOpen ? 'true' : 'false'}>
        {/* On a phone the panel is a sheet: it stays out of the map until it is
            asked for, and opens on its own when something is selected. */}
        <button type="button" className="noesis-territory__handle" aria-expanded={sheetOpen} onClick={() => setSheetOpen((open) => !open)}>
          <span>{selection?.kind === 'concept' ? selection.concept.name
            : selection?.kind === 'region' ? selection.region.name
              : selection?.kind === 'record' ? selection.record.label
                : selection?.kind === 'boundary' ? selection.boundary.text
                  : 'Map key'}</span>
          <i aria-hidden="true">{sheetOpen ? '▾' : '▴'}</i>
        </button>
        {selection?.kind === 'region' && (
          <div className="noesis-territory__card">
            <div className="flex items-center justify-between gap-2">
              <span className="noesis-territory__eyebrow">Region</span>
              <Button variant="ghost" size="sm" onClick={() => setSelection(null)}>Close</Button>
            </div>
            <h2>{selection.region.name}</h2>
            {!asOf && (regionDetail?.description || regionDetail?.explanation) && <p className="break-words">{regionDetail.description || regionDetail.explanation}</p>}
            {!asOf && regionDetail && <dl className="my-3 grid grid-cols-2 gap-2 text-xs">
              <div><dt>Positions</dt><dd className="font-semibold">{regionDetail.positionIds.length}</dd></div>
              <div><dt>Inquiries</dt><dd className="font-semibold">{regionDetail.inquiryIds.length}</dd></div>
              <div><dt>Sources</dt><dd className="font-semibold">{regionDetail.sourceIds.length}</dd></div>
              <div><dt>Praxis</dt><dd className="font-semibold">{regionDetail.practiceIds.length}</dd></div>
            </dl>}
            <p>{regionConcepts.length} concept{regionConcepts.length === 1 ? '' : 's'} in this constellation.</p>
            <div className="flex flex-wrap gap-2 pb-2">
              <Button size="sm" variant="outline" onClick={() => {
                const center = world.regionCenters[selection.index]; if (!center) return;
                const v = view.current; v.tx = center.wx; v.ty = center.wy; v.tk = 0.75;
              }}>Zoom to region</Button>
              {regionDetail && <Button size="sm" variant="ghost" onClick={() => onOpenRegion?.(regionDetail.id)}>Region details</Button>}
            </div>
            <div className="flex flex-wrap gap-1.5">{regionConcepts.map((concept) => <Pill key={concept.id} tone="concept" onClick={() => openConcept(concept)}>{concept.name}</Pill>)}</div>
          </div>
        )}
        {selection?.kind === 'concept' && (
          <div className="noesis-territory__card">
            <span className="noesis-territory__eyebrow">Concept{selection.concept.status ? ` · ${selection.concept.status}` : ''}</span>
            <h2>{selection.concept.name}</h2>
            {selection.concept.definition ? <p className="italic">{selection.concept.definition}</p> : <p>No definition yet.</p>}
            <div className="noesis-territory__stats">
              {(['position', 'inquiry', 'source', 'work', 'practice', 'annotation'] as RecordType[]).map((type) => {
                const held = world.records.filter((record) => record.conceptId === selection.concept.id && record.type === type);
                return (
                  <button key={type} type="button" disabled={!held.length} aria-pressed={listed === type}
                    onClick={() => setListed((current) => current === type ? null : type)}>
                    <b>{held.length}</b>
                    <span>{RECORD_NOUN[type]}</span>
                  </button>
                );
              })}
            </div>
            {listed && (() => {
              const held = world.records.filter((record) => record.conceptId === selection.concept.id && record.type === listed);
              if (!held.length) return null;
              return (
                <div className="noesis-scrollbox grid gap-1">
                  <span className="noesis-territory__eyebrow">{RECORD_NOUN[listed]} · {held.length}</span>
                  {held.map((record) => (
                    <button key={record.id} type="button" className="text-left text-xs leading-5 underline-offset-2 hover:underline"
                      onClick={() => setSelection({ kind: 'record', record, conceptName: selection.concept.name })}>
                      {record.label}
                      {record.type === 'inquiry' && !record.fog
                        ? <span className="text-muted-foreground"> · fog cleared</span>
                        : record.detail ? <span className="text-muted-foreground"> · {record.detail}</span> : null}
                    </button>
                  ))}
                </div>
              );
            })()}
            {selectedBoundaries.length > 0 && (
              <div className="grid gap-1.5">
                <span className="noesis-territory__eyebrow">Boundaries · {selectedBoundaries.length}</span>
                {selectedBoundaries.map((boundary) => (
                  <button key={boundary.id} type="button" className="text-left text-xs leading-5 underline-offset-2 hover:underline"
                    onClick={() => setSelection({ kind: 'boundary', boundary, conceptName: selection.concept.name })}>
                    <b className="font-mono text-label uppercase tracking-wider">{boundary.kind}</b> · {boundary.text}
                  </button>
                ))}
              </div>
            )}
            <Button type="button" size="sm" onClick={() => onOpen({ type: 'concept', id: selection.concept.id })}>Open concept</Button>
          </div>
        )}
        {selection?.kind === 'boundary' && (
          <div className="noesis-territory__card">
            <span className="noesis-territory__eyebrow">Boundary of {selection.conceptName}</span>
            <h3>{selection.boundary.text}</h3>
            <p>This is what you recorded as <b>{selection.boundary.kind}</b> for {selection.conceptName}.</p>
            {selection.boundary.reason && <p className="italic">{selection.boundary.reason}</p>}
            <Button type="button" size="sm" onClick={() => onOpen({ type: 'concept', id: selection.boundary.conceptId })}>Open {selection.conceptName}</Button>
          </div>
        )}
        {selection?.kind === 'record' && (
          <div className="noesis-territory__card">
            <span className="noesis-territory__eyebrow">{selection.record.type === 'practice' ? 'praxis' : selection.record.type} · on {selection.conceptName}</span>
            <h3>{selection.record.label}</h3>
            {selection.record.type === 'position' && typeof selection.record.confidence === 'number' && (
              <p><b>{selection.record.confidence}%</b> stated confidence — what you say you hold, not a score for the evidence.</p>
            )}
            {selection.record.type === 'inquiry' && (
              <p>{selection.record.fog ? `Still under fog · ${selection.record.detail || 'open'}.` : 'The fog has cleared on this one.'}</p>
            )}
            {selection.record.type !== 'position' && selection.record.type !== 'inquiry' && selection.record.detail && <p>{selection.record.detail}</p>}
            {selection.record.type !== 'annotation' && (
              <Button type="button" size="sm" onClick={() => onOpen({ type: selection.record.type, id: selection.record.id.split(':').slice(1).join(':') })}>
                Open {selection.record.type === 'practice' ? 'praxis' : selection.record.type}
              </Button>
            )}
          </div>
        )}
        {!selection && (
          <div className="noesis-territory__card">
            <span className="noesis-territory__eyebrow">Nothing selected</span>
            <p>Scroll or pinch to zoom anywhere — no need to pick something first. Far out, each region is a constellation; closer in, every concept is an island; closer still, its records are landmarks on the ground.</p>
          </div>
        )}
        <details className="noesis-territory__card">
          <summary className="noesis-territory__eyebrow cursor-pointer">What the landmarks mean</summary>
          <div className="mt-2 grid gap-1.5 text-xs">
            <p className="mb-1 text-xs">Every landmark is the glyph its own tab uses, so a record looks the same on the map as it does in the navigation.</p>
            {[
              ['Star', 'a concept, seen from the sky'],
              ['Island', 'that concept up close. It grows with the records, notes and links resting on it, so a worked concept is a bigger island than an untouched one'],
              ['Contours', 'one line per doubling of what rests on the concept — they crowd toward a summit on the ones carrying the most'],
              ['Flag', 'a position — the same planted flag the Positions tab wears'],
              ['Fog', 'an open inquiry lying over the ground; it thins with a working answer and clears when resolved'],
              ['Book', 'a source, from the Library tab'],
              ['Sheet', 'a work, from the Works tab'],
              ['Target', 'praxis — a practice, experiment or commitment'],
              ['Ink trail', 'an annotation, from the Annotations tab'],
              ['Boat', 'a boundary: what this concept is not'],
            ].map(([name, text]) => (
              <span key={name} className="flex gap-2"><b className="w-20 shrink-0 font-mono text-label uppercase tracking-wider">{name}</b><span>{text}</span></span>
            ))}
          </div>
        </details>
        <details className="noesis-territory__card">
          <summary className="noesis-territory__eyebrow cursor-pointer">Link colours</summary>
          <div className="mt-2 grid gap-1.5 text-xs">
            {[['--stage-act', 'supports · strengthens · coheres'], ['--stage-claim', 'challenges · weakens · contradicts'], ['--stage-encounter', 'defines · refines · exemplifies'], ['--stage-examine', 'explains · depends on · derived from'], ['--stage-integrate', 'tested by · expressed in']].map(([tone, text]) => (
              <span key={tone} className="flex items-center gap-2"><i className="inline-block h-[3px] w-5 rounded" style={{ background: `hsl(var(${tone}))` }} />{text}</span>
            ))}
          </div>
        </details>
        {selection && <button type="button" className={cn('noesis-territory__clear')} onClick={() => setSelection(null)}>Clear selection</button>}
      </aside>
    </div>
  );
}
