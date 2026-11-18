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
 * ringed three-node chain for the Atlas, and a brain for Exercises.
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
const InkTrail = glyph('annotation', [
  ['path', { d: 'M3 11 L11 3', strokeWidth: 1.6 }],
  ['path', { d: 'M3 11 C4.5 12.6 7 11.2 8.5 12.4 C9.6 13.2 11 12.6 12.5 12.8', strokeWidth: 1, opacity: 0.75 }],
]);
const QuestionMark = glyph('inquiry', [
  ['path', { d: 'M4.4 4.8C4.4 3 5.6 1.8 7.2 1.8 8.9 1.8 10 3 10 4.4 10 6.4 7.4 6.6 7.4 8.8', strokeWidth: 1.7 }],
  ['circle', { cx: 7.4, cy: 11.6, r: 1.1, ...FILL }],
]);
const PlantedFlag = glyph('position', [
  ['path', { d: 'M3.5 13V1.8', strokeWidth: 1.5 }],
  ['path', { d: 'M3.5 2.2h7.5L9.2 4.6 11 7H3.5Z', ...FILL }],
]);
const PraxisTarget = glyph('praxis', [
  ['circle', { cx: 6.5, cy: 7.5, r: 5, strokeWidth: 1.3 }],
  ['circle', { cx: 6.5, cy: 7.5, r: 2.2, strokeWidth: 1.3 }],
  ['path', { d: 'M6.5 7.5 12.5 1.5M10.2 1.5h2.3v2.3', strokeWidth: 1.4 }],
]);
const EvolutionChevrons = glyph('evolution', [
  ['path', { d: 'M1.5 3.5 L4.5 7 L1.5 10.5 M5.5 3.5 L8.5 7 L5.5 10.5 M9.5 3.5 L12.5 7 L9.5 10.5', strokeWidth: 1.6 }],
]);
const AtlasChain = glyph('atlas', [
  ['circle', { cx: 7, cy: 7, r: 6, strokeWidth: 1.2 }],
  ['path', { d: 'M4.2 8.6 7 5 9.8 8.6', strokeWidth: 1.1 }],
  ['circle', { cx: 4.2, cy: 8.6, r: 1.4, ...FILL }],
  ['circle', { cx: 7, cy: 5, r: 1.4, ...FILL }],
  ['circle', { cx: 9.8, cy: 8.6, r: 1.4, ...FILL }],
]);
const AiSpark = glyph('ai', [['path', { d: 'M7 1.5 8.4 5.6 12.5 7 8.4 8.4 7 12.5 5.6 8.4 1.5 7 5.6 5.6Z', ...FILL }]]);
const WorkSheet = glyph('work', [['path', { d: 'M3 2h6l2 2v8H3Z', strokeWidth: 1.3 }]]);
const SettingsDial = glyph('settings', [
  ['circle', { cx: 7, cy: 7, r: 2.2, strokeWidth: 1.4 }],
  ['circle', { cx: 7, cy: 7, r: 5, strokeWidth: 1.4, strokeDasharray: '2 2' }],
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

export const NOESIS_ICONS: Record<NoesisIconKey, LucideIcon> = {
  home: TodaySun,
  atlas: AtlasChain,
  region: MapPinned,
  connection: Network,
  concept: ThoughtBubble as LucideIcon,
  inquiry: QuestionMark,
  library: LibraryShelf,
  'source-index': SourceRows,
  source: BookOpen,
  annotation: InkTrail,
  position: PlantedFlag,
  work: WorkSheet,
  context: AiSpark,
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
  evolution: 'evolution',
  profile: 'profile',
  settings: 'settings',
} as const satisfies Record<string, NoesisIconKey>;

export function iconForNoesisView(view: string): LucideIcon {
  const key = NOESIS_VIEW_ICON_KEYS[view as keyof typeof NOESIS_VIEW_ICON_KEYS];
  return NOESIS_ICONS[key || 'home'];
}
