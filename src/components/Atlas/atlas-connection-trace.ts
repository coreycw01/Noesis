export interface AtlasConnectionTrace {
  edgeId: string;
  from: string;
  previousLinkIds?: ReadonlySet<string>;
}

export function shouldTraceAtlasConnection(
  trace: AtlasConnectionTrace | null,
  edgeId: string,
  groupedLinkIds?: string[],
) {
  if (!trace || trace.edgeId !== edgeId) return false;
  const previous = trace.previousLinkIds;
  return !previous || Boolean(groupedLinkIds?.some((id) => !previous.has(id)));
}
