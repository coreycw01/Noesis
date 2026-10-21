import { createElement, forwardRef } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  BookOpen,
  CircleHelp,
  Cloud,
  FlaskConical,
  Highlighter,
  History,
  Home,
  Library,
  Map,
  MapPinned,
  Network,
  PenTool,
  Repeat2,
  ScanSearch,
  Settings,
  ShieldCheck,
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
  | 'practice'
  | 'commitment'
  | 'evolution'
  | 'profile'
  | 'settings';

export const NOESIS_ICONS: Record<NoesisIconKey, LucideIcon> = {
  home: Home,
  atlas: Map,
  region: MapPinned,
  connection: Network,
  concept: ThoughtBubble as LucideIcon,
  inquiry: CircleHelp,
  library: Library,
  source: BookOpen,
  annotation: Highlighter,
  position: ShieldCheck,
  work: PenTool,
  context: ScanSearch,
  lab: FlaskConical,
  practice: Repeat2,
  commitment: Target,
  evolution: History,
  profile: UserCircle2,
  settings: Settings,
};

export const NOESIS_VIEW_ICON_KEYS = {
  home: 'home',
  atlas: 'atlas',
  concepts: 'concept',
  questions: 'inquiry',
  library: 'library',
  'source-index': 'source',
  annotations: 'annotation',
  vault: 'position',
  writing: 'work',
  'context-desk': 'context',
  practices: 'lab',
  goals: 'commitment',
  evolution: 'evolution',
  profile: 'profile',
  settings: 'settings',
} as const satisfies Record<string, NoesisIconKey>;

export function iconForNoesisView(view: string): LucideIcon {
  const key = NOESIS_VIEW_ICON_KEYS[view as keyof typeof NOESIS_VIEW_ICON_KEYS];
  return NOESIS_ICONS[key || 'home'];
}
