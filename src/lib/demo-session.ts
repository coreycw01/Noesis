import { buildDemoWorkspace } from './demo-workspace';
import type { AiSettings } from './types';

type Workspace = ReturnType<typeof buildDemoWorkspace> & { settingsAi?: AiSettings };
type RecordData = Record<string, any>;
export type DemoChange = { path: string; operation: 'set' | 'update' | 'delete' | 'create'; data?: RecordData; merge?: boolean };
type Overrides = Record<string, RecordData | null>;
const documentFields: Record<string, keyof Workspace> = {
  'settings/goal': 'goal', 'settings/preferences': 'preferences', 'settings/profile': 'profile',
  'settings/workspace': 'workspace', 'profile/main': 'profile', 'profile/privacy': 'profilePrivacy',
  'profile/metacognitionSummary': 'profileMetacognitionSummary',
  'settings/account': 'settingsAccount', 'settings/appearance': 'settingsAppearance',
  'settings/ai': 'settingsAi', 'settings/metacognition': 'settingsMetacognition',
  'settings/privacy': 'settingsPrivacy', 'settings/data': 'settingsData',
  'settings/sourceIntake': 'settingsSourceIntake', 'settings/works': 'settingsWorks',
  'settings/atlas': 'settingsAtlas', 'settings/notifications': 'settingsNotifications',
  'settings/goals': 'settingsGoals', 'settings/developer': 'settingsDeveloper',
};
const listeners = new Set<() => void>();
let version = 0;
export const demoSessionVersion = () => version;
export const subscribeDemoSession = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const keyFor = (uid: string) => `noesis-demo-session-v1:${uid}`;
function readOverrides(uid: string): Overrides {
  if (typeof window === 'undefined') return {};
  const raw = window.sessionStorage.getItem(keyFor(uid));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export function applyDemoOverrides(base: Workspace, overrides: Overrides): Workspace {
  const next = { ...base } as Workspace & Record<string, any>;
  for (const [path, value] of Object.entries(overrides)) {
    const field = documentFields[path];
    if (field) { next[field] = value as never; continue; }
    const [collection, id, extra] = path.split('/');
    if (!id || extra || !Array.isArray(next[collection])) continue;
    const records = next[collection] as Array<RecordData>;
    next[collection] = value === null ? records.filter((item) => item.id !== id)
      : records.some((item) => item.id === id)
        ? records.map((item) => item.id === id ? { ...value, id } : item)
        : [...records, { ...value, id }];
  }
  return next;
}

export function readDemoSession(uid: string): Workspace {
  return applyDemoOverrides(buildDemoWorkspace(uid), readOverrides(uid));
}

export function applyDemoChanges(base: Workspace, overrides: Overrides, uid: string, changes: DemoChange[]): Overrides {
  const next = { ...overrides };
  for (const change of changes) {
    const prefix = `users/${uid}/`;
    if (!change.path.startsWith(prefix)) throw new Error('This change belongs to another workspace.');
    const path = change.path.slice(prefix.length);
    const workspace = applyDemoOverrides(base, next) as Workspace & Record<string, any>;
    const field = documentFields[path];
    const [collection, id, extra] = path.split('/');
    if (!field && (!id || extra || !Array.isArray(workspace[collection]))) throw new Error('This demo action is not supported.');
    const previous = field ? workspace[field] : workspace[collection].find((item: RecordData) => item.id === id);
    if (change.operation === 'create' && previous) throw new Error('This item already exists.');
    if (change.operation === 'update' && !previous) throw new Error('This item is no longer available.');
    next[path] = change.operation === 'delete' ? null
      : change.operation === 'update' || change.merge ? { ...previous, ...change.data }
      : { ...change.data };
  }
  return next;
}

export function commitDemoChanges(uid: string, changes: DemoChange[]) {
  const next = applyDemoChanges(buildDemoWorkspace(uid), readOverrides(uid), uid, changes);
  // Write before notifying readers so a full browser store cannot report a false save.
  window.sessionStorage.setItem(keyFor(uid), JSON.stringify(next));
  version += 1;
  listeners.forEach((listener) => listener());
}
