import { createElement, forwardRef } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  BookOpen,
  FlaskConical,
  Handshake,
  MapPinned,
  Network,
  UserCircle2,
} from 'lucide-react';

/**
 * Noesis glyphs. Drawn on a 14px grid and rendered in currentColor, so a nav
 * item, header marker, or badge colors them with its stage token. Each one is
 * shaped to read as its page: a writing desk for My Desk, a shelf of books for the
 * Library, a grid of rows for the Source Index, an ink trail for Annotations,
 * a balance for Inquiries, a planted flag for Positions, a circular loop
 * for Praxis, three advancing chevrons for Evolution, a
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
const MyDesk = glyph('my-desk', [
  ['path', { d: 'M9.8 3.4 11.1 5.5v2.3M9.4 7.8h3.3', strokeWidth: 1.2 }],
  ['path', { d: 'M7.5 1.5 10.3 3l-1 2.4-3.6-1.9Z', ...FILL }],
  ['path', { d: 'M2.2 7.7h4.1', strokeWidth: 1.2 }],
  ['rect', { x: 1, y: 8.8, width: 12, height: 1.6, rx: 0.5, ...FILL }],
  ['path', { d: 'M2.6 10v2.9M11.4 10v2.9', strokeWidth: 1.4 }],
]);
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
  ['path', { d: 'M2.1 5.5a5.1 5.1 0 0 1 9.8 0M11.9 8.5a5.1 5.1 0 0 1-9.8 0', strokeWidth: 1.5 }],
  ['path', { d: 'M9.2 4.4 12 6l1.4-2.9ZM4.8 9.6 2 8 .6 10.9Z', ...FILL }],
];
const PraxisLoop = glyph('praxis', PRAXIS_PARTS);
const EvolutionChevrons = glyph('evolution', [
  ['path', { d: 'M1.5 3.5 L4.5 7 L1.5 10.5 M5.5 3.5 L8.5 7 L5.5 10.5 M9.5 3.5 L12.5 7 L9.5 10.5', strokeWidth: 1.6 }],
]);
const AtlasMap = glyph('atlas', [
  ['path', { d: 'M1 3.2 5 1.5 9 3.1 13 1.5v9.3l-4 1.7-4-1.6-4 1.6Z', strokeWidth: 1.15 }],
  ['path', { d: 'M5 1.8v3M5 8.8v1.8M9 3.5v1M9 8.2v3.8', strokeWidth: 0.75, opacity: 0.6 }],
  ['path', { d: 'm3.1 8.1 3.4-2.8 4.2 1.6', strokeWidth: 1.05 }],
  ...[[3.1, 8.1], [6.5, 5.3], [10.7, 6.9]].map(([cx, cy]): GlyphPart => ['circle', { cx, cy, r: 0.95, ...FILL }]),
]);
const ThoughtBubble = glyph('concept', [
  ['path', { d: 'M4 10a2.6 2.6 0 1 1 .1-5.2 3 3 0 0 1 5.6-.5A2.9 2.9 0 1 1 10.7 10Z', ...FILL }],
  ['circle', { cx: 4, cy: 11.5, r: .85, ...FILL }],
  ['circle', { cx: 2.2, cy: 13, r: .55, ...FILL }],
]);
const WORK_PARTS: GlyphPart[] = [['path', { d: 'M3 1.3h5.2v3.8H12v7.6H3Zm.9 6.2v.9h6.7v-.9Zm0 2.3v.9H9v-.9ZM9.2 1.5l2.6 2.6H9.2Z', fillRule: 'evenodd', ...FILL }]];
const WorkSheet = glyph('work', WORK_PARTS);
const PracticeSteps = glyph('practice', [
  ['path', { d: 'M2.2 5c.3-1.6 1.2-2.8 2.1-2.5s1 1.7.8 3.2c-.2 1.2-.9 2-1.8 1.8-.9-.2-1.3-1.3-1.1-2.5ZM2.3 8.2l2.2.4-.3 1.3a1.1 1.1 0 0 1-2.1-.4ZM8.5 7.7c-.3-1.5.1-2.8 1-3s1.8.9 2.2 2.4c.3 1.3-.1 2.4-1 2.6-.9.2-1.9-.8-2.2-2ZM9.5 10.8l2.2-.5.3 1.2a1.1 1.1 0 0 1-2.2.5Z', ...FILL }],
]);
const ExerciseBrain = glyph('exercise-solid', [
  ['path', { d: 'M6.4 2.1C5.1.7 2.8 1.6 2.7 3.5A2.4 2.4 0 0 0 1.3 7a2.5 2.5 0 0 0 1 3.9c.1 1.9 2.8 2.7 4.1 1.1V8.3c-1.7 0-2.7-.9-2.7-2.2h1.1c0 .7.6 1.1 1.6 1.1Zm1.2 0c1.3-1.4 3.6-.5 3.7 1.4A2.4 2.4 0 0 1 12.7 7a2.5 2.5 0 0 1-1 3.9c-.1 1.9-2.8 2.7-4.1 1.1V8.3c1.7 0 2.7-.9 2.7-2.2H9.2c0 .7-.6 1.1-1.6 1.1Z', ...FILL }],
]);

export const NOESIS_SOLID_DESK_ICONS = {
  source: glyph('source-solid', [['path', { d: 'M1 2h2.9A3 3 0 0 1 6.5 3.4v8.8a4 4 0 0 0-2.7-1H1.1A.7.7 0 0 1 .4 10.5V2.7A.7.7 0 0 1 1 2ZM13 2h-2.9a3 3 0 0 0-2.6 1.4v8.8a4 4 0 0 1 2.7-1h2.7a.7.7 0 0 0 .7-.7V2.7A.7.7 0 0 0 13 2Z', ...FILL }]]),
  annotation: glyph('annotation-solid', [['path', { d: 'M2 9.7 9.8 2 12 4.2l-7.8 7.7-3 .9ZM10.5 1.4l.5-.5a1 1 0 0 1 1.4 0l.7.7a1 1 0 0 1 0 1.4l-.5.5Z', ...FILL }]]),
  concept: ThoughtBubble,
  inquiry: glyph('inquiry-solid', [['path', { d: 'M6.3 2h1.4v2h5v1.2h-.8l1.9 4H9.4l1.9-4H7.7v6.2h2.4v1.4H3.9v-1.4h2.4V5.2H2.7l1.9 4H.2l1.9-4h-.8V4h5Z', ...FILL }]]),
  position: PlantedFlag,
  work: WorkSheet,
  practice: PracticeSteps,
  exercise: ExerciseBrain,
  unknown: glyph('unknown-solid', [['path', { d: 'M7 .9a6.1 6.1 0 1 0 0 12.2A6.1 6.1 0 0 0 7 .9Zm2.8 3.2L8.1 8.2 4 9.9l1.7-4.1Z', fillRule: 'evenodd', ...FILL }]]),
};
const SettingsDial = glyph('settings', [
  ['circle', { cx: 7, cy: 7, r: 2.2, strokeWidth: 1.4 }],
  ['circle', { cx: 7, cy: 7, r: 5, strokeWidth: 1.4, strokeDasharray: '2 2' }],
]);
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
  home: MyDesk,
  atlas: AtlasMap,
  region: MapPinned,
  connection: Network,
  concept: ThoughtBubble,
  inquiry: InquiryBalanceGlyph,
  library: LibraryShelf,
  'source-index': SourceRows,
  source: BookOpen,
  annotation: InkTrail,
  position: PlantedFlag,
  work: WorkSheet,
  context: ContextDesk,
  lab: FlaskConical,
  praxis: PraxisLoop,
  practice: PracticeSteps,
  commitment: Handshake,
  evolution: EvolutionChevrons,
  profile: UserCircle2,
  settings: SettingsDial,
  exercise: ExerciseBrain,
};

export const PRAXIS_METHOD_ICONS = {
  practice: NOESIS_ICONS.practice,
  experiment: NOESIS_ICONS.lab,
  commitment: NOESIS_ICONS.commitment,
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
