import { createElement, forwardRef } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  BookOpen,
  Brain,
  Cloud,
  FlaskConical,
  MapPinned,
  Network,
  Repeat2,
  Target,
  UserCircle2,
} from 'lucide-react';

const ThoughtBubble = forwardRef<SVGSVGElement, LucideProps>(({ children, ...props }, ref) => createElement(
  Cloud,
  { ...props, ref },
  createElement('circle', { cx: 5, cy: 19.25, r: 1 }),
  createElement('circle', { cx: 2.25, cy: 21.75, r: 0.65 }),
  children,
));
ThoughtBubble.displayName = 'ThoughtBubble';

/**
 * Noesis glyphs. Drawn on a 14px grid and rendered in currentColor, so a nav
 * item, header marker, or badge colors them with its stage token. Each one is
 * shaped to read as its page: a sun for Today, a shelf of books for the
 * Library, a grid of rows for the Source Index, an ink trail for Annotations,
 * a question mark for Inquiries, a planted flag for Positions, a target with
 * an outbound arrow for Praxis, three advancing chevrons for Evolution, a
 * folded map with linked nodes for the Atlas, and a brain for Exercises.
 */
type GlyphPart = [tag: 'path' | 'circle' | 'rect', attrs: Record<string, string | number>];

function glyph(name: string, parts: GlyphPart[]) {
  const Glyph = forwardRef<SVGSVGElement, LucideProps>(({ size = 24, strokeWidth: _strokeWidth, absoluteStrokeWidth: _absolute, color = 'currentColor', className, children, ...props }, ref) => createElement(
    'svg',
    {
      ref,
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 14 14',
      fill: 'none',
      stroke: color,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: ['lucide', `noesis-glyph noesis-glyph--${name}`, className].filter(Boolean).join(' '),
      'aria-hidden': props['aria-label'] ? undefined : true,
      ...props,
    },
    ...parts.map(([tag, attrs], index) => createElement(tag, { key: index, ...attrs })),
    children,
  ));
  Glyph.displayName = `NoesisGlyph(${name})`;
  return Glyph as unknown as LucideIcon;
}

const FILL = { fill: 'currentColor', stroke: 'none' };
const sunRays: GlyphPart[] = Array.from({ length: 8 }, (_, index) => {
  const angle = (index * Math.PI) / 4;
  const round = (value: number) => Math.round(value * 100) / 100;
  return ['path', {
    d: `M${round(7 + Math.cos(angle) * 4.2)} ${round(7 + Math.sin(angle) * 4.2)}L${round(7 + Math.cos(angle) * 6)} ${round(7 + Math.sin(angle) * 6)}`,
    strokeWidth: 1.3,
  }];
});

const TodaySun = glyph('today', [['circle', { cx: 7, cy: 7, r: 2.6, strokeWidth: 1.5 }], ...sunRays]);
const LibraryShelf = glyph('library', [
  ['rect', { x: 1.5, y: 3, width: 2.4, height: 9.5, rx: 0.4, ...FILL }],
  ['rect', { x: 4.5, y: 1.5, width: 2.4, height: 11, rx: 0.4, ...FILL, opacity: 0.75 }],
  ['rect', { x: 7.5, y: 4, width: 2.2, height: 8.5, rx: 0.4, ...FILL }],
  ['rect', { x: 10.4, y: 3.6, width: 2.2, height: 9, rx: 0.4, ...FILL, opacity: 0.75, transform: 'rotate(14 11.5 12.5)' }],
  ['path', { d: 'M1 13h12', strokeWidth: 1 }],
]);
const SourceRows = glyph('source-index', [1.5, 5.5, 9.5].flatMap((y, row) => [1.5, 5.5, 9.5].map((x): GlyphPart => (
  ['rect', { x, y, width: 3, height: 3, ...FILL, opacity: [1, 0.7, 0.45][row] }]
))));
const ANNOTATION_PARTS: GlyphPart[] = [
  ['path', { d: 'M3 11 L11 3', strokeWidth: 1.6 }],
  ['path', { d: 'M3 11 C4.5 12.6 7 11.2 8.5 12.4 C9.6 13.2 11 12.6 12.5 12.8', strokeWidth: 1, opacity: 0.75 }],
];
const InkTrail = glyph('annotation', ANNOTATION_PARTS);
/* Inquiry is the balance it weighs its candidate answers on, not a question
   mark. The page already puts that instrument under every answer; the glyph
   now says the same thing, in the nav and on the Atlas alike. */
const INQUIRY_PARTS: GlyphPart[] = [
  ['path', { d: 'M7 1.7V12.2', strokeWidth: 1.5 }],
  ['path', { d: 'M4.3 12.2h5.4', strokeWidth: 1.4 }],
  ['path', { d: 'M1.7 4.3h10.6', strokeWidth: 1.5 }],
  ['path', { d: 'M1.7 4.3 0.5 7.3h2.4Z', strokeWidth: 1.2 }],
  ['path', { d: 'M12.3 4.3 11.1 7.3h2.4Z', strokeWidth: 1.2 }],
];
const InquiryBalanceGlyph = glyph('inquiry', INQUIRY_PARTS);
const POSITION_PARTS: GlyphPart[] = [
  ['path', { d: 'M3.5 13V1.8', strokeWidth: 1.5 }],
  ['path', { d: 'M3.5 2.2h7.5L9.2 4.6 11 7H3.5Z', ...FILL }],
];
const PlantedFlag = glyph('position', POSITION_PARTS);
const PRAXIS_PARTS: GlyphPart[] = [
  ['circle', { cx: 6.5, cy: 7.5, r: 5, strokeWidth: 1.3 }],
  ['circle', { cx: 6.5, cy: 7.5, r: 2.2, strokeWidth: 1.3 }],
  ['path', { d: 'M6.5 7.5 12.5 1.5M10.2 1.5h2.3v2.3', strokeWidth: 1.4 }],
];
const PraxisTarget = glyph('praxis', PRAXIS_PARTS);
const EvolutionChevrons = glyph('evolution', [
  ['path', { d: 'M1.5 3.5 L4.5 7 L1.5 10.5 M5.5 3.5 L8.5 7 L5.5 10.5 M9.5 3.5 L12.5 7 L9.5 10.5', strokeWidth: 1.6 }],
]);
const AtlasMap = glyph('atlas', [
  ['path', { d: 'M1 3.2 5 1.5 9 3.1 13 1.5v9.3l-4 1.7-4-1.6-4 1.6Z', strokeWidth: 1.15 }],
  ['path', { d: 'M5 1.8v3M5 8.8v1.8M9 3.5v1M9 8.2v3.8', strokeWidth: 0.75, opacity: 0.6 }],
  ['path', { d: 'm3.1 8.1 3.4-2.8 4.2 1.6', strokeWidth: 1.05 }],
  ...[[3.1, 8.1], [6.5, 5.3], [10.7, 6.9]].map(([cx, cy]): GlyphPart => ['circle', { cx, cy, r: 0.95, ...FILL }]),
]);
const WORK_PARTS: GlyphPart[] = [['path', { d: 'M3 2h6l2 2v8H3Z', strokeWidth: 1.3 }]];
const WorkSheet = glyph('work', WORK_PARTS);
const SettingsDial = glyph('settings', [
  ['circle', { cx: 7, cy: 7, r: 2.2, strokeWidth: 1.4 }],
  ['circle', { cx: 7, cy: 7, r: 5, strokeWidth: 1.4, strokeDasharray: '2 2' }],
]);
/* The Context Desk, drawn as a desk: a worktop on two legs with two records
   laid out on it. It was a scanning eye before, which described the AI looking
   at things rather than the surface you lay them on. */
/* A desk, drawn as one: a top, a leg, and the drawers the Context Desk keeps
   its saved sets in. It carried records on its surface before, which read as
   clutter at 14px rather than as a desk. */
const ContextDesk = glyph('context', [
  ['rect', { x: 1, y: 3.4, width: 12, height: 1.7, rx: 0.5, ...FILL }],
  ['path', { d: 'M2.4 5.3V12.6', strokeWidth: 1.4 }],
  ['rect', { x: 6.9, y: 5.3, width: 5.1, height: 7.3, rx: 0.6, strokeWidth: 1.3 }],
  ['path', { d: 'M8.2 7.5h2.5M8.2 10h2.5', strokeWidth: 1.2 }],
]);

export type NoesisIconKey =
  | 'home'
  | 'atlas'
  | 'region'
  | 'connection'
  | 'concept'
  | 'inquiry'
  | 'library'
  | 'source'
  | 'annotation'
  | 'position'
  | 'work'
  | 'context'
  | 'lab'
  | 'praxis'
  | 'practice'
  | 'commitment'
  | 'evolution'
  | 'profile'
  | 'settings'
  | 'exercise'
  | 'source-index';

/**
 * The geometry behind the glyphs, on the same 14 × 14 grid the components use.
 *
 * The Atlas draws its landmarks from this, so a record is the same shape on
 * the map as it is in the navigation: change a glyph here and both follow.
 * `source` is the exception — it restates lucide's BookOpen on the 14 grid,
 * because that one icon is theirs rather than ours.
 */
export type NoesisGlyphPart = GlyphPart;
export const NOESIS_GLYPH_PARTS = {
  position: POSITION_PARTS,
  inquiry: INQUIRY_PARTS,
  annotation: ANNOTATION_PARTS,
  work: WORK_PARTS,
  praxis: PRAXIS_PARTS,
  source: [
    ['path', { d: 'M7 2.9v9.3', strokeWidth: 1.15 }],
    ['path', { d: 'M11.7 11.1a1.2 1.2 0 0 0 1.2-1.2V2.9a1.2 1.2 0 0 0-1.2-1.2L9.3 1.75A2.9 2.9 0 0 0 7 2.9a2.9 2.9 0 0 0-2.3-1.15H2.3A1.2 1.2 0 0 0 1.1 2.9v7a1.2 1.2 0 0 0 1.2 1.2h2.4A2.9 2.9 0 0 1 7 12.25a2.9 2.9 0 0 1 2.3-1.15Z', strokeWidth: 1.15 }],
  ] as GlyphPart[],
} satisfies Record<string, GlyphPart[]>;

export type NoesisGlyphKey = keyof typeof NOESIS_GLYPH_PARTS;

export const NOESIS_ICONS: Record<NoesisIconKey, LucideIcon> = {
  home: TodaySun,
  atlas: AtlasMap,
  region: MapPinned,
  connection: Network,
  concept: ThoughtBubble as LucideIcon,
  inquiry: InquiryBalanceGlyph,
  library: LibraryShelf,
  'source-index': SourceRows,
  source: BookOpen,
  annotation: InkTrail,
  position: PlantedFlag,
  work: WorkSheet,
  context: ContextDesk,
  lab: FlaskConical,
  praxis: PraxisTarget,
  practice: Repeat2,
  commitment: Target,
  evolution: EvolutionChevrons,
  profile: UserCircle2,
  settings: SettingsDial,
  exercise: Brain,
};

export const NOESIS_VIEW_ICON_KEYS = {
  home: 'home',
  atlas: 'atlas',
  concepts: 'concept',
  questions: 'inquiry',
  library: 'library',
  'source-index': 'source-index',
  annotations: 'annotation',
  vault: 'position',
  writing: 'work',
  'context-desk': 'context',
  labs: 'praxis',
  goals: 'commitment',
  exercises: 'exercise',
  evolution: 'evolution',
  profile: 'profile',
  settings: 'settings',
} as const satisfies Record<string, NoesisIconKey>;

export function iconForNoesisView(view: string): LucideIcon {
  const key = NOESIS_VIEW_ICON_KEYS[view as keyof typeof NOESIS_VIEW_ICON_KEYS];
  return NOESIS_ICONS[key || 'home'];
}
