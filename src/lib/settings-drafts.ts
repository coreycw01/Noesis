import type { AiSettings, MetacognitionSettings, WorksSettings } from './types';

export function resolveAiSettings(defaults: AiSettings, saved: Partial<AiSettings> | null, localDemo: boolean): AiSettings {
  return {
    ...defaults,
    ...saved,
    aiAssistanceEnabled: saved?.aiAssistanceEnabled ?? (localDemo || defaults.aiAssistanceEnabled),
  };
}

function equalSetting(left: unknown, right: unknown) {
  return Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right);
}

function isSettingsSection(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype);
}

export function changedSettingsFields<T extends object>(draft: T, baseline: T): Partial<T> {
  return Object.fromEntries(
    (Object.keys(draft) as Array<keyof T>).filter((key) => !equalSetting(draft[key], baseline[key]))
      .map((key) => [key, draft[key]]),
  ) as Partial<T>;
}

export function reconcileSettingsDrafts<T extends object>(current: T, previous: T, incoming: T): T {
  let next = current;
  for (const key of Object.keys(incoming) as Array<keyof T>) {
    const draft = current[key];
    const old = previous[key];
    const saved = incoming[key];
    if (equalSetting(draft, saved)) continue;
    if (equalSetting(draft, old)) {
      next = { ...next, [key]: incoming[key] };
    } else if (isSettingsSection(draft) && isSettingsSection(old) && isSettingsSection(saved)) {
      const merged = { ...saved, ...changedSettingsFields(draft, old) };
      if (!equalSetting(draft, merged)) next = { ...next, [key]: merged };
    }
  }
  return next;
}


export function workDefaultPreferencePatch(changes: Partial<WorksSettings>) {
  const { defaultWorkType, defaultDraftStatus, defaultPaperStyle, defaultEditorMode } = changes;
  return {
    ...(defaultWorkType !== undefined ? { type: defaultWorkType } : {}),
    ...(defaultDraftStatus !== undefined ? { status: defaultDraftStatus } : {}),
    ...(defaultPaperStyle !== undefined ? { writingStyle: defaultPaperStyle } : {}),
    ...(defaultEditorMode !== undefined ? { editorFeel: defaultEditorMode } : {}),
  };
}

export function metacognitionFeatureFlagPatch(changes: Partial<MetacognitionSettings>) {
  return {
    ...(changes.enableMetacognitionFeatures !== undefined ? { metacognitionEnabled: changes.enableMetacognitionFeatures } : {}),
    ...(changes.enableBeliefBiographies !== undefined ? { beliefBiographiesEnabled: changes.enableBeliefBiographies } : {}),
    ...(changes.enableUnknownsTracking !== undefined ? { unknownsEnabled: changes.enableUnknownsTracking } : {}),
    ...(changes.enableThinkingPatternDetection !== undefined ? { thinkingPatternsEnabled: changes.enableThinkingPatternDetection } : {}),
    ...(changes.enableMissingPerspectivesDetection !== undefined ? { missingPerspectivesEnabled: changes.enableMissingPerspectivesDetection } : {}),
    ...(changes.enableCognitionMetrics !== undefined ? { thinkingMetricsEnabled: changes.enableCognitionMetrics } : {}),
  };
}
