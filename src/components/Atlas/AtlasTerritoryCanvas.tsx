"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Concept, Media, PhilosophicalLink, Practice, Question, VaultEntry } from '@/lib/types';
import { conceptKey } from '@/lib/readex';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The Atlas as a folded paper map: regions are landmasses with coastlines,
 * concepts are nodes with contour lines, joined by routes for their links, and
 * the records that use a concept sit around it. Zoom moves through five levels
 * (whole map, regions, concepts, records, inside a concept). Everything drawn
 * comes from the user's records.
 */

type RecordType = 'position' | 'inquiry' | 'source' | 'practice';
interface MapRegion { id: string; name: string; conceptIds: string[] }
interface WorldConcept { id: string; name: string; definition: string; status?: string; clarity: number; born: number; region: number; wx: number; wy: number }
interface WorldRecord { id: string; type: RecordType; label: string; conceptId: string; born: number; wx: number; wy: number }
interface WorldNote { text: string; kind: string; conceptId: string }
export type AtlasCanvasSelection =
  | { kind: 'region'; region: MapRegion; index: number }
  | { kind: 'concept'; concept: WorldConcept }
  | { kind: 'record'; record: WorldRecord; conceptName: string };

const LEVELS: Array<[string, number]> = [['Whole map', 0.1], ['Regions', 0.26], ['Concepts', 0.85], ['Records', 2], ['Inside', 4.2]];
const RECORD_TONE: Record<RecordType, string> = { position: '--stage-claim', inquiry: '--stage-examine', source: '--stage-encounter', practice: '--stage-act' };
const LINK_TONE = (type: string) => /contradicts|challenges|weakens|questions/.test(type) ? '--stage-claim'
  : /supports|strengthens|coheres/.test(type) ? '--stage-act'
    : /defines|refines|exemplifies/.test(type) ? '--stage-encounter'
      : /tested_by|expressed_in/.test(type) ? '--stage-integrate' : '--stage-examine';

const time = (value?: string) => { const parsed = Date.parse(value || ''); return Number.isFinite(parsed) ? parsed : 0; };
const band = (k: number, lo: number, hi: number, soft: number) => {
  const fadeIn = Math.min(1, Math.max(0, (Math.log(k) - Math.log(lo) + soft) / soft));
  const fadeOut = Math.min(1, Math.max(0, (Math.log(hi) - Math.log(k) + soft) / soft));
  return Math.min(fadeIn, fadeOut);
};

export function buildAtlasWorld({ regions, concepts, positions, inquiries, sources, practices }: {
  regions: MapRegion[]; concepts: Concept[]; positions: VaultEntry[]; inquiries: Question[]; sources: Media[]; practices: Practice[];
}) {
  const byKey = new Map(concepts.map((concept) => [conceptKey(concept.name), concept]));
  const regionOf = new Map<string, number>();
  regions.forEach((region, index) => region.conceptIds.forEach((id) => { if (!regionOf.has(id)) regionOf.set(id, index); }));
  const placed = concepts.filter((concept) => regionOf.has(concept.id));
  const loose = concepts.filter((concept) => !regionOf.has(concept.id));
  const allRegions: MapRegion[] = loose.length ? [...regions, { id: 'loose', name: 'Unmapped', conceptIds: loose.map((concept) => concept.id) }] : regions;
  loose.forEach((concept) => regionOf.set(concept.id, allRegions.length - 1));
  // Regions sit like land on a folded map: a staggered grid with seeded
  // jitter, so the layout is irregular but stable between visits.
  const columns = Math.max(1, Math.ceil(Math.sqrt(allRegions.length * 1.6)));
  const rows = Math.ceil(allRegions.length / columns);
  const jitter = (seed: number) => Math.sin(seed * 12.9898) * 43758.5453 % 1;
  const regionCenters = allRegions.map((_, index) => {
    if (allRegions.length === 1) return { wx: 0, wy: 0 };
    const column = index % columns; const row = Math.floor(index / columns);
    const wx = (column - (columns - 1) / 2) * 660 + (row % 2 ? 230 : -100) + jitter(index + 1) * 120;
    const wy = (row - (rows - 1) / 2) * 560 + jitter(index + 7) * 110;
    return { wx, wy };
  });
  const worldConcepts: WorldConcept[] = [...placed, ...loose].map((concept) => {
    const region = regionOf.get(concept.id) ?? 0;
    const siblings = allRegions[region].conceptIds.filter((id) => concepts.some((item) => item.id === id && regionOf.get(item.id) === region));
    const slot = Math.max(0, siblings.indexOf(concept.id));
    const angle = (slot / Math.max(1, siblings.length)) * Math.PI * 2 + region;
    const ring = siblings.length === 1 ? 0 : Math.min(190, 70 + siblings.length * 14) + (slot % 2) * 40;
    const clarity = [concept.description?.trim(), (concept.examples || []).length, (concept.aliases || []).length || (concept.notSameAs || []).length, (concept.counterexamples || []).length].filter(Boolean).length;
    return {
      id: concept.id, name: concept.name, definition: concept.description || '', status: concept.philosophyStatus, clarity,
      born: time(concept.dateCreated), region,
      wx: regionCenters[region].wx + Math.cos(angle) * ring, wy: regionCenters[region].wy + Math.sin(angle) * ring * 0.8,
    };
  });
  const conceptForTags = (tags: string[], ids: string[] = []) => {
    const byId = ids.map((id) => worldConcepts.find((concept) => concept.id === id)).find(Boolean);
    if (byId) return byId;
    for (const tag of tags) { const match = byKey.get(conceptKey(tag)); if (match) return worldConcepts.find((concept) => concept.id === match.id); }
    return undefined;
  };
  const records: WorldRecord[] = [];
  const orbit = new Map<string, number>();
  const add = (type: RecordType, id: string, label: string, born: string | undefined, concept?: WorldConcept) => {
    if (!concept || !label?.trim()) return;
    const n = orbit.get(concept.id) || 0;
    orbit.set(concept.id, n + 1);
    const angle = n * 2.399;
    const radius = 54 + (n % 3) * 16;
    records.push({ id: `${type}:${id}`, type, label, conceptId: concept.id, born: time(born), wx: concept.wx + Math.cos(angle) * radius, wy: concept.wy + Math.sin(angle) * radius * 0.85 });
  };
  positions.filter((p) => !['abandoned', 'rejected', 'replaced'].includes(p.status)).forEach((p) => add('position', p.id, p.title, p.dateCreated, conceptForTags(p.tags || [])));
  inquiries.forEach((q) => add('inquiry', q.id, q.text, q.dateCreated, conceptForTags((q as Question & { conceptTags?: string[] }).conceptTags || [], (q as Question & { conceptIds?: string[] }).conceptIds || [])));
  sources.forEach((s) => add('source', s.id, s.title, s.dateAdded, conceptForTags(s.tags || [], s.conceptIds || [])));
  practices.forEach((x) => add('practice', x.id, x.title, x.startDate || x.dateCreated, conceptForTags(x.conceptTags || [])));
  const notes: WorldNote[] = sources.flatMap((source) => (source.annotations || []).flatMap((note) => {
    const concept = conceptForTags(note.conceptTags || [], []);
    return concept ? [{ text: note.text, kind: note.type, conceptId: concept.id }] : [];
  }));
  return { regions: allRegions, regionCenters, concepts: worldConcepts, records, notes };
}

export function AtlasTerritoryCanvas({ regions, concepts, positions, inquiries, sources, practices, links, asOf, from, onOpen }: {
  regions: MapRegion[]; concepts: Concept[]; positions: VaultEntry[]; inquiries: Question[]; sources: Media[]; practices: Practice[];
  links: PhilosophicalLink[]; asOf?: number | null; from?: number | null;
  onOpen: (target: { type: 'concept' | RecordType; id: string }) => void;
}) {
  const world = useMemo(() => buildAtlasWorld({ regions, concepts, positions, inquiries, sources, practices }), [regions, concepts, positions, inquiries, sources, practices]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ x: 0, y: 0, k: 0.26, tx: 0, ty: 0, tk: 0.26 });
  const [level, setLevel] = useState(1);
  const [selection, setSelection] = useState<AtlasCanvasSelection | null>(null);
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
    // The sheet: a folded, crinkled paper map, drawn once per size and theme.
    let paper: HTMLCanvasElement | null = null;
    const buildPaper = () => {
      const ratio = window.devicePixelRatio || 1;
      const sheet = document.createElement('canvas'); sheet.width = Math.max(1, width * ratio); sheet.height = Math.max(1, height * ratio);
      const p = sheet.getContext('2d'); if (!p) return null;
      p.scale(ratio, ratio);
      const dark = document.documentElement.classList.contains('dark');
      const ink = dark ? '235, 225, 205' : '60, 45, 25';
      const shade = dark ? '0, 0, 0' : '70, 50, 20';
      const light = dark ? '255, 245, 225' : '255, 255, 250';
      p.fillStyle = dark ? 'hsl(33 20% 20%)' : 'hsl(40 42% 90%)'; p.fillRect(0, 0, width, height);
      let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < (width * height) / 90; i += 1) { p.fillStyle = `rgba(${ink}, ${0.015 + rand() * 0.03})`; p.fillRect(rand() * width, rand() * height, 1, 1); }
      for (let i = 0; i < 90; i += 1) {
        let x = rand() * width; let y = rand() * height; const steps = 4 + Math.floor(rand() * 6);
        p.beginPath(); p.moveTo(x, y);
        for (let j = 0; j < steps; j += 1) { x += (rand() - 0.5) * 60; y += (rand() - 0.5) * 60; p.lineTo(x, y); }
        p.strokeStyle = `rgba(${shade}, ${dark ? 0.22 : 0.08})`; p.lineWidth = 1; p.stroke();
        p.translate(1, 1); p.strokeStyle = `rgba(${light}, ${dark ? 0.07 : 0.3})`; p.stroke(); p.translate(-1, -1);
      }
      const folds = (count: number, vertical: boolean) => {
        const span = vertical ? width : height;
        for (let i = 1; i < count; i += 1) {
          const at = (span / count) * i; const valley = i % 2 === 1; const w = 70;
          const g = vertical ? p.createLinearGradient(at - w, 0, at + w, 0) : p.createLinearGradient(0, at - w, 0, at + w);
          g.addColorStop(0, `rgba(${shade}, 0)`);
          g.addColorStop(0.5, valley ? `rgba(${shade}, ${dark ? 0.28 : 0.1})` : `rgba(${light}, ${dark ? 0.06 : 0.35})`);
          g.addColorStop(0.5001, valley ? `rgba(${light}, ${dark ? 0.05 : 0.3})` : `rgba(${shade}, ${dark ? 0.24 : 0.09})`);
          g.addColorStop(1, `rgba(${shade}, 0)`);
          p.fillStyle = g;
          if (vertical) p.fillRect(at - w, 0, w * 2, height); else p.fillRect(0, at - w, width, w * 2);
          p.strokeStyle = `rgba(${shade}, ${dark ? 0.45 : 0.16})`; p.lineWidth = 1; p.beginPath();
          if (vertical) { p.moveTo(at, 0); p.lineTo(at, height); } else { p.moveTo(0, at); p.lineTo(width, at); }
          p.stroke();
        }
      };
      folds(4, true); folds(3, false);
      const vignette = p.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
      vignette.addColorStop(0, `rgba(${shade}, 0)`); vignette.addColorStop(1, `rgba(${shade}, ${dark ? 0.45 : 0.16})`);
      p.fillStyle = vignette; p.fillRect(0, 0, width, height);
      return sheet;
    };
    const size = () => { const ratio = window.devicePixelRatio || 1; width = canvas.clientWidth; height = canvas.clientHeight; canvas.width = width * ratio; canvas.height = height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); paper = buildPaper(); };
    const themeWatch = new MutationObserver(() => { paper = buildPaper(); });
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
    const conceptById = new Map(world.concepts.map((concept) => [concept.id, concept]));
    const conceptLinks = links.filter((link) => link.fromType === 'concept' && link.toType === 'concept' && conceptById.has(link.fromId) && conceptById.has(link.toId));

    const frame = () => {
      if (!alive) return;
      const v = view.current;
      v.x += (v.tx - v.x) * 0.18; v.y += (v.ty - v.y) * 0.18; v.k = Math.exp(Math.log(v.k) + (Math.log(v.tk) - Math.log(v.k)) * 0.18);
      const k = v.k; placed = [];
      const accent = css('--stage-integrate'); const fg = css('--foreground'); const dim = css('--muted-foreground');
      const sA = band(k, 0.02, 0.14, 0.5); const rA = band(k, 0.19, 0.5, 0.4); const cA = band(k, 0.55, 1.3, 0.4); const recA = band(k, 1.45, 2.9, 0.3); const iA = band(k, 3.3, 20, 0.3);
      if (paper) ctx.drawImage(paper, 0, 0, width, height); else { ctx.fillStyle = css('--card'); ctx.fillRect(0, 0, width, height); }
      const ink = fg;
      const visibleConcepts = world.concepts.filter((concept) => seen(concept.born));
      const regionVisible = (index: number) => visibleConcepts.some((concept) => concept.region === index);
      if (sA > 0) {
        ctx.globalAlpha = sA;
        world.regions.forEach((region, index) => {
          if (!regionVisible(index)) return;
          const [cx, cy] = toScreen(world.regionCenters[index].wx, world.regionCenters[index].wy);
          const count = visibleConcepts.filter((concept) => concept.region === index).length;
          const r = Math.max(26, 230 * k);
          blob(cx, cy, r, index * 1.3); ctx.fillStyle = alpha(accent, 0.16); ctx.fill(); ctx.strokeStyle = alpha(ink, 0.6); ctx.lineWidth = 1.2; ctx.stroke();
          ctx.textAlign = 'center'; ctx.font = 'italic 600 15px "Playfair Display", Georgia, serif'; ctx.fillStyle = ink; ctx.fillText(region.name, cx, cy + r + 20);
          ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = alpha(ink, 0.6); ctx.fillText(`${count} CONCEPTS`, cx, cy + r + 35);
        });
        ctx.globalAlpha = 1;
      }
      if (rA > 0) {
        ctx.globalAlpha = rA;
        world.regions.forEach((region, index) => {
          if (!regionVisible(index)) return;
          const [cx, cy] = toScreen(world.regionCenters[index].wx, world.regionCenters[index].wy);
          blob(cx, cy, 230 * k * 1.07, index * 1.3); ctx.setLineDash([3, 5]); ctx.strokeStyle = alpha(ink, 0.25); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
          blob(cx, cy, 230 * k, index * 1.3); ctx.fillStyle = alpha(ink, 0.07); ctx.fill(); ctx.fillStyle = alpha(accent, 0.1); ctx.fill(); ctx.strokeStyle = alpha(ink, 0.65); ctx.lineWidth = 1.6; ctx.stroke();
          if (rA > sA) label(region.name.toUpperCase(), cx, cy - 230 * k * 0.95 - 10, `600 ${Math.max(11, Math.min(16, 40 * k))}px "JetBrains Mono", monospace`, alpha(ink, 0.85));
        });
        ctx.globalAlpha = 1;
      }
      // Concept nodes and their routes show from the regions level up, so the
      // first view is already a map of connected nodes.
      const conceptLayer = Math.max(cA, recA, iA, rA * 0.85);
      const selected = selectionRef.current;
      const selectedId = selected?.kind === 'concept' ? selected.concept.id : null;
      if (conceptLayer > 0) {
        conceptLinks.forEach((link) => {
          const a = conceptById.get(link.fromId)!; const b = conceptById.get(link.toId)!;
          if (!seen(a.born) || !seen(b.born)) return;
          const [x1, y1] = toScreen(a.wx, a.wy); const [x2, y2] = toScreen(b.wx, b.wy);
          const focus = selectedId && (a.id === selectedId || b.id === selectedId);
          ctx.globalAlpha = conceptLayer * (1 - iA * 0.85);
          ctx.strokeStyle = alpha(css(LINK_TONE(link.type)), focus ? 0.95 : selectedId ? 0.16 : 0.55);
          ctx.lineWidth = focus ? 2.6 : 1.3; ctx.beginPath();
          if (link.type === 'contradicts') {
            ctx.moveTo(x1, y1);
            for (let i = 1; i < 10; i += 1) { const t = i / 10; const x = x1 + (x2 - x1) * t; const y = y1 + (y2 - y1) * t; const o = (i % 2 ? 1 : -1) * 7; const nx = -(y2 - y1); const ny = x2 - x1; const l = Math.hypot(nx, ny) || 1; ctx.lineTo(x + (nx / l) * o, y + (ny / l) * o); }
            ctx.lineTo(x2, y2);
          } else { ctx.setLineDash([7, 5]); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 26 * Math.min(k, 2), x2, y2); }
          ctx.stroke(); ctx.setLineDash([]);
          if (k > 0.7 && focus) { ctx.fillStyle = css(LINK_TONE(link.type)); ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(link.type.replace(/_/g, ' ').toUpperCase(), (x1 + x2) / 2, (y1 + y2) / 2 - 14 * Math.min(k, 2)); }
        });
        visibleConcepts.forEach((concept, index) => {
          const [x, y] = toScreen(concept.wx, concept.wy);
          if (x < -300 || x > width + 300 || y < -300 || y > height + 300) return;
          const radius = 34 * k * (1 + iA * 0.55); const fresh = isNew(concept.born);
          ctx.globalAlpha = conceptLayer;
          for (let ring = 0; ring < 4; ring += 1) {
            blob(x, y, radius * (1 - ring * 0.2), index + ring * 0.3);
            if (ring === 0) { ctx.fillStyle = alpha(accent, fresh ? 0.25 : 0.1); ctx.fill(); }
            ctx.strokeStyle = alpha(accent, ring < concept.clarity ? 0.85 - ring * 0.15 : 0.1);
            ctx.lineWidth = ring ? 1 : concept.id === selectedId ? 2.5 : 1.5;
            if (ring === 0 && concept.status === 'contested') ctx.setLineDash([6, 4]);
            ctx.stroke(); ctx.setLineDash([]);
          }
          ctx.beginPath(); ctx.arc(x, y, Math.max(3, Math.min(7, 5 * k)), 0, 7); ctx.fillStyle = ink; ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, Math.max(5, Math.min(11, 8 * k)), 0, 7); ctx.strokeStyle = alpha(ink, 0.5); ctx.lineWidth = 1; ctx.stroke();
          if (fresh) { ctx.fillStyle = accent; ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('NEW', x, y - radius * 0.9 - 4); }
          label(concept.name, x, iA > 0.3 ? y - radius * 0.85 - 12 : y + Math.max(20, 14 * k), `italic 600 ${Math.max(13, Math.min(20, 15 * k))}px "Playfair Display", Georgia, serif`, fg);
        });
        ctx.globalAlpha = 1;
      }
      const recordLayer = Math.max(recA, iA);
      if (cA > 0 || recordLayer > 0) {
        world.records.forEach((record) => {
          const owner = conceptById.get(record.conceptId); if (!owner || !seen(record.born) || !seen(owner.born)) return;
          const [x, y] = toScreen(record.wx, record.wy); const [cx, cy] = toScreen(owner.wx, owner.wy); const color = css(RECORD_TONE[record.type]);
          if (recordLayer > 0) { ctx.globalAlpha = recordLayer * 0.6; ctx.strokeStyle = alpha(color, 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); }
          ctx.globalAlpha = Math.max(cA * 0.5, recordLayer); const s = recordLayer > 0 ? 6 + recordLayer * 2 : 2.5;
          ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
          if (record.type === 'position') { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); }
          else if (record.type === 'inquiry') { ctx.arc(x, y, s, -Math.PI / 2, Math.PI * 1.1); ctx.stroke(); }
          else if (record.type === 'source') ctx.fillRect(x - s * 0.8, y - s * 0.8, s * 1.6, s * 1.6);
          else { ctx.arc(x, y, s * 0.8, 0, 7); ctx.fill(); }
          if (selected?.kind === 'record' && selected.record.id === record.id) { ctx.strokeStyle = fg; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, s + 6, 0, 7); ctx.stroke(); }
          if (recordLayer > 0.3) { ctx.globalAlpha = recordLayer; label(record.label.length > 32 ? `${record.label.slice(0, 30)}…` : record.label, x, y + s + 15, '13px Spectral, Georgia, serif', dim); }
        });
        ctx.globalAlpha = 1;
      }
      if (iA > 0) {
        ctx.globalAlpha = iA;
        visibleConcepts.forEach((concept) => {
          const [x, y] = toScreen(concept.wx, concept.wy); if (x < -400 || x > width + 400 || y < -400 || y > height + 400) return;
          ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = accent; ctx.textAlign = 'center'; ctx.fillText(concept.definition ? 'DEFINITION' : 'NO DEFINITION YET', x, y - 6);
          ctx.fillStyle = fg; ctx.font = `italic ${Math.min(16, 3 * k)}px "Playfair Display", Georgia, serif`; if (concept.definition) wrap(concept.definition, x, y + 14, Math.min(170, 44 * k), 18);
          const notes = world.notes.filter((note) => note.conceptId === concept.id).slice(0, 4);
          notes.forEach((note, i) => {
            const a = -Math.PI * 0.75 + i * ((Math.PI * 2) / Math.max(notes.length, 1)); const radius = 40 * k; const nx = x + Math.cos(a) * radius * 1.15; const ny = y + Math.sin(a) * radius * 0.9 - 20; const w = Math.min(170, 40 * k);
            ctx.fillStyle = css('--card'); ctx.strokeStyle = alpha(css('--stage-encounter'), 0.8); ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(nx - w / 2, ny - 18, w, 66); ctx.fill(); ctx.stroke();
            ctx.fillStyle = css('--stage-encounter'); ctx.fillRect(nx - w / 2, ny - 18, 3, 66);
            ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText((note.kind || 'note').toUpperCase(), nx - w / 2 + 10, ny - 4);
            ctx.fillStyle = fg; ctx.font = '12px Spectral, Georgia, serif'; wrap(note.text, nx - w / 2 + 10, ny + 12, w - 18, 14, 'left', 3);
          });
        });
        ctx.globalAlpha = 1;
      }
      const nextLevel = k < 0.19 ? 0 : k < 0.52 ? 1 : k < 1.4 ? 2 : k < 3.1 ? 3 : 4;
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
    const hitConcept = (mx: number, my: number) => world.concepts.find((concept) => { if (!seen(concept.born)) return false; const [x, y] = toScreen(concept.wx, concept.wy); return Math.hypot(x - mx, y - my) < Math.max(22, 38 * view.current.k * (view.current.k > 3 ? 1.5 : 1)); });
    const hitRecord = (mx: number, my: number) => view.current.k > 1.3 ? world.records.find((record) => { const [x, y] = toScreen(record.wx, record.wy); return Math.hypot(x - mx, y - my) < 14; }) : undefined;
    const down = (event: PointerEvent) => { canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, [event.clientX, event.clientY]); moved = false; };
    const move = (event: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      if (!pointers.has(event.pointerId)) { const mx = event.clientX - r.left; const my = event.clientY - r.top; canvas.style.cursor = hitRecord(mx, my) || hitConcept(mx, my) ? 'pointer' : 'grab'; return; }
      const previous = pointers.get(event.pointerId)!; pointers.set(event.pointerId, [event.clientX, event.clientY]);
      const v = view.current;
      if (pointers.size === 1) { const dx = event.clientX - previous[0]; const dy = event.clientY - previous[1]; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; v.tx -= dx / v.k; v.ty -= dy / v.k; v.x = v.tx; v.y = v.ty; }
      else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (lastDistance) zoomAt(d / lastDistance, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); lastDistance = d; moved = true; }
    };
    const up = (event: PointerEvent) => {
      const r = canvas.getBoundingClientRect(); const mx = event.clientX - r.left; const my = event.clientY - r.top; const v = view.current;
      if (!moved && pointers.size === 1) {
        const record = hitRecord(mx, my);
        if (record) setSelection({ kind: 'record', record, conceptName: world.concepts.find((concept) => concept.id === record.conceptId)?.name || '' });
        else if (v.k < 0.52) {
          world.regions.forEach((region, index) => { const center = world.regionCenters[index]; const [x, y] = toScreen(center.wx, center.wy); if (Math.hypot(x - mx, y - my) < Math.max(70, 230 * v.k)) { v.tx = center.wx; v.ty = center.wy; v.tk = v.k < 0.19 ? 0.3 : 0.8; setSelection({ kind: 'region', region, index }); } });
        } else { const concept = hitConcept(mx, my); if (concept) { setSelection({ kind: 'concept', concept }); if (v.k < 3.1) { v.tx = concept.wx; v.ty = concept.wy; v.tk = 3.8; } } }
      }
      pointers.delete(event.pointerId); if (pointers.size < 2) lastDistance = 0;
    };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    return () => {
      alive = false; cancelAnimationFrame(raf); observer.disconnect(); themeWatch.disconnect();
      canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
    };
  }, [world, links]);

  const goLevel = (index: number) => {
    const v = view.current; v.tk = LEVELS[index][1];
    if (index <= 1) { v.tx = 0; v.ty = 0; }
    if (index === 4) { const target = selection?.kind === 'concept' ? selection.concept : world.concepts[0]; if (target) { v.tx = target.wx; v.ty = target.wy; } }
  };
  const zoom = (factor: number) => { const v = view.current; v.tk = Math.max(0.04, Math.min(9, v.tk * factor)); };
  const regionConcepts = selection?.kind === 'region' ? world.concepts.filter((concept) => concept.region === selection.index) : [];

  return (
    <div className="noesis-territory">
      <canvas ref={canvasRef} className="noesis-territory__canvas" aria-label="Atlas territory map. Scroll or pinch to zoom, drag to pan, select a region, concept, or record." />
      <div className="noesis-territory__levels" role="group" aria-label="Zoom level">
        {LEVELS.map(([name], index) => (
          <button key={name} type="button" aria-current={level === index} onClick={() => goLevel(index)}><i />{name}</button>
        ))}
      </div>
      <div className="noesis-territory__zoom">
        <button type="button" aria-label="Zoom out" onClick={() => zoom(0.7)}>−</button>
        <button type="button" aria-label="Zoom in" onClick={() => zoom(1.4)}>+</button>
      </div>
      <aside className="noesis-territory__panel" aria-label="Selection">
        {selection?.kind === 'region' && (
          <div className="noesis-territory__card">
            <span className="noesis-territory__eyebrow">Region</span>
            <h2>{selection.region.name}</h2>
            <p>{regionConcepts.length} concept{regionConcepts.length === 1 ? '' : 's'} on this landmass.</p>
            <div className="flex flex-wrap gap-1.5">{regionConcepts.map((concept) => <button key={concept.id} type="button" className="noesis-territory__chip" onClick={() => { setSelection({ kind: 'concept', concept }); const v = view.current; v.tx = concept.wx; v.ty = concept.wy; v.tk = 3.8; }}>{concept.name}</button>)}</div>
          </div>
        )}
        {selection?.kind === 'concept' && (
          <div className="noesis-territory__card">
            <span className="noesis-territory__eyebrow">Concept{selection.concept.status ? ` · ${selection.concept.status}` : ''}</span>
            <h2>{selection.concept.name}</h2>
            {selection.concept.definition ? <p className="italic">{selection.concept.definition}</p> : <p>No definition yet.</p>}
            <div className="noesis-territory__stats">
              {(['position', 'inquiry', 'source', 'practice'] as RecordType[]).map((type) => <div key={type}><b>{world.records.filter((record) => record.conceptId === selection.concept.id && record.type === type).length}</b><span>{type === 'inquiry' ? 'inquiries' : `${type}s`}</span></div>)}
            </div>
            <Button type="button" size="sm" onClick={() => onOpen({ type: 'concept', id: selection.concept.id })}>Open concept</Button>
          </div>
        )}
        {selection?.kind === 'record' && (
          <div className="noesis-territory__card">
            <span className="noesis-territory__eyebrow">{selection.record.type} · in {selection.conceptName}</span>
            <h3>{selection.record.label}</h3>
            <Button type="button" size="sm" onClick={() => onOpen({ type: selection.record.type, id: selection.record.id.split(':').slice(1).join(':') })}>Open {selection.record.type}</Button>
          </div>
        )}
        {!selection && (
          <div className="noesis-territory__card">
            <span className="noesis-territory__eyebrow">Nothing selected</span>
            <p>Tap a region, concept, or record to see it here. Scroll or pinch to zoom, drag to pan, and use the timeline to watch the map change.</p>
          </div>
        )}
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
