import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  BrainCircuit,
  CircleHelp,
  FlaskConical,
  Highlighter,
  History,
  Home,
  Library,
  Map,
  MapPinned,
  Network,
  PenTool,
  Settings,
  ShieldCheck,
  Target,
  UserCircle2,
} from 'lucide-react';

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
  concept: BrainCircuit,
  inquiry: CircleHelp,
  library: Library,
  source: BookOpen,
  annotation: Highlighter,
  position: ShieldCheck,
  work: PenTool,
  practice: FlaskConical,
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
  practices: 'practice',
  goals: 'commitment',
  evolution: 'evolution',
  profile: 'profile',
  settings: 'settings',
} as const satisfies Record<string, NoesisIconKey>;

export function iconForNoesisView(view: string): LucideIcon {
  const key = NOESIS_VIEW_ICON_KEYS[view as keyof typeof NOESIS_VIEW_ICON_KEYS];
  return NOESIS_ICONS[key || 'home'];
}
