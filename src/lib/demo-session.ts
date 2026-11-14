import type { buildDemoWorkspace } from './demo-workspace';
import type { AiSettings } from './types';
import type { ExportRecord } from './workspace-export';

type Workspace = ReturnType<typeof buildDemoWorkspace> & {
  settingsAi?: AiSettings;
  workRevisions?: RecordData[];
  aiProvenance?: RecordData[];
  annotations?: RecordData[];
  practiceLogs?: RecordData[];
  positionVersions?: RecordData[];
  userIdentity?: RecordData;
};
type RecordData = Record<string, any>;
export type DemoChange = { path: string; operation: 'set' | 'update' | 'delete' | 'create' | 'create-if-missing'; data?: RecordData; merge?: boolean; onCreate?: DemoChange };
type Overrides = Record<string, RecordData | null>;

let demoFactory: typeof buildDemoWorkspace | undefined;

export async function loadDemoSession() {
  if (!demoFactory) demoFactory = (await import('./demo-workspace')).buildDemoWorkspace;
}

function demoBase(uid: string) {
  if (!demoFactory) throw new Error('The demo workspace has not loaded.');
  return demoFactory(uid);
}
const documentFields: Record<string, keyof Workspace> = {
  '': 'userIdentity',
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
const documentPathsByField = new Map<keyof Workspace, string[]>();
for (const [path, field] of Object.entries(documentFields)) {
  const paths = documentPathsByField.get(field) ?? [];
  paths.push(path);
  documentPathsByField.set(field, paths);
}
const listeners = new Set<() => void>();
let version = 0;
export const demoSessionVersion = () => version;
export const subscribeDemoSession = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const keyFor = (uid: string) => `noesis-demo-session-v1:${uid}`;
const recordId = (record: RecordData) => record.id || record.unknownId || record.patternId || record.positionId || record.eventId;
function readOverrides(uid: string): Overrides {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(keyFor(uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export function applyDemoOverrides(base: Workspace, overrides: Overrides): Workspace {
  // Revision documents are written atomically with works but have no seeded rows.
  const next = {
    workRevisions: [], practiceLogs: [], positionVersions: [], aiProvenance: [],
    annotations: base.media.flatMap((source) => (source.annotations || []).map((annotation) => ({ ...annotation, sourceId: source.id }))),
    ...base,
  } as Workspace & Record<string, any>;
  for (const [path, value] of Object.entries(overrides)) {
    const field = documentFields[path];
    if (field) { next[field] = value as never; continue; }
    const [collection, id, extra] = path.split('/');
    if (!id || extra || !Array.isArray(next[collection])) continue;
    const records = next[collection] as Array<RecordData>;
    next[collection] = value === null ? records.filter((item) => recordId(item) !== id)
      : records.some((item) => recordId(item) === id)
        ? records.map((item) => recordId(item) === id ? { ...value, id } : item)
        : [...records, { ...value, id }];
  }
  return next;
}

export function readDemoSession(uid: string): Workspace {
  return applyDemoOverrides(demoBase(uid), readOverrides(uid));
}

export function demoExportCollection(workspace: Workspace, name: string): ExportRecord[] {
  if (name === 'settings' || name === 'profile') {
    return Object.entries(documentFields).flatMap(([path, field]) => {
      const [collection, id] = path.split('/');
      const record = workspace[field];
      return collection === name && record ? [{ ...record, id }] : [];
    });
  }
  if (name === 'thinkingMetrics') return [{ ...workspace.thinkingMetrics, id: 'summary' }];
  const items = workspace[name as keyof Workspace];
  return Array.isArray(items) ? items.map((record) => ({ ...record, id: recordId(record) })) : [];
}

function mergeDemoSet(previous: RecordData | undefined, patch: RecordData = {}): RecordData {
  const next = { ...previous };
  for (const [key, value] of Object.entries(patch)) {
    const existing = Object.hasOwn(next, key) ? next[key] : undefined;
    next[key] = value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length
      ? mergeDemoSet(existing && Object.getPrototypeOf(existing) === Object.prototype ? existing : undefined, value)
      : value;
  }
  return next;
}

export function applyDemoChanges(base: Workspace, overrides: Overrides, uid: string, changes: DemoChange[]): Overrides {
  const next = { ...overrides };
  const workspace = applyDemoOverrides(base, {}) as Workspace & Record<string, any>;
  const indexes = new Map<string, Map<string, RecordData>>();
  const ownerPath = `users/${uid}`;
  const prefix = `${ownerPath}/`;

  const apply = (change: DemoChange) => {
    if (change.path !== ownerPath && !change.path.startsWith(prefix)) throw new Error('This change belongs to another workspace.');
    const path = change.path === ownerPath ? '' : change.path.slice(prefix.length);
    const field = Object.hasOwn(documentFields, path) ? documentFields[path] : undefined;
    const [collection, id, extra] = path.split('/');
    if (!field && (!id || extra || !Array.isArray(workspace[collection]))) throw new Error('This demo action is not supported.');
    let previous: RecordData | null | undefined;
    if (field) {
      const aliases = documentPathsByField.get(field) ?? [];
      const lastOverride = aliases.length > 1 ? Object.keys(next).findLast((key) => aliases.includes(key)) : path;
      previous = lastOverride !== undefined && Object.hasOwn(next, lastOverride) ? next[lastOverride] : workspace[field];
    } else if (Object.hasOwn(next, path)) {
      const override = next[path];
      previous = override ? { ...override, id } : override;
    } else {
      let index = indexes.get(collection);
      if (!index) {
        index = new Map();
        for (const item of workspace[collection] as RecordData[]) {
          const key = recordId(item);
          if (!index.has(key)) index.set(key, item);
        }
        indexes.set(collection, index);
      }
      previous = index.get(id);
    }
    if (change.operation === 'create-if-missing' && previous) return;
    if (change.operation === 'create' && previous) throw new Error('This item already exists.');
    if (change.operation === 'update' && !previous) throw new Error('This item is no longer available.');
    next[path] = change.operation === 'delete' ? null
      : change.operation === 'update' ? { ...previous, ...change.data }
      : change.merge ? mergeDemoSet(previous ?? undefined, change.data)
      : { ...change.data };
    if (change.operation === 'create-if-missing' && change.onCreate) {
      apply(change.onCreate);
    }
  };
  changes.forEach(apply);
  return next;
}

export function commitDemoChanges(uid: string, changes: DemoChange[]) {
  const next = applyDemoChanges(demoBase(uid), readOverrides(uid), uid, changes);
  // Write before notifying readers so a full browser store cannot report a false save.
  window.sessionStorage.setItem(keyFor(uid), JSON.stringify(next));
  version += 1;
  listeners.forEach((listener) => listener());
}
