export const MAX_CONTEXT_ITEMS = 12;

export function contextDeskReviewKey(records: ReadonlyArray<{ key: string }>) {
  // Keep every ID and its position: the first record supplies the primary context.
  return JSON.stringify(records.map(({ key }) => key));
}

export function contextDeskRecordIsExcluded(
  record: { key: string; type: string; sourceIds: readonly string[] },
  rules: { keys: ReadonlySet<string>; types: ReadonlySet<string>; sourceIds: ReadonlySet<string> },
) {
  return rules.keys.has(record.key) || rules.types.has(record.type) || record.sourceIds.some((id) => rules.sourceIds.has(id));
}

export function contextDeskSourceIds(sourceIds: readonly string[] | undefined, annotationIds: readonly (string | undefined)[], sourceByAnnotation: ReadonlyMap<string, string>) {
  return [...new Set([...(sourceIds || []), ...annotationIds.flatMap((id) => {
    const source = id && sourceByAnnotation.get(id);
    return source ? [source] : [];
  })])];
}

export function contextDeskStorageKeys(workspaceKey: string) {
  const prefix = `noesis:context-desk:v2:${encodeURIComponent(workspaceKey)}`;
  return { selection: `${prefix}:selected`, exclusions: `${prefix}:excluded` };
}

export function normalizeContextDeskSelection(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((key): key is string => typeof key === 'string' && Boolean(key.trim())))].slice(0, MAX_CONTEXT_ITEMS)
    : [];
}

export function addContextDeskSelection(keys: string[], key: string): string[] | null {
  if (keys.includes(key)) return keys;
  return keys.length < MAX_CONTEXT_ITEMS ? [...keys, key] : null;
}
