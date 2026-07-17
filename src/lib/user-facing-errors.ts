function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error || '');
}

export function noesisUserError(error: unknown, fallback: string) {
  const message = errorText(error);
  const lower = message.toLowerCase();

  if (!message) return fallback;
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('too many requests') || lower.includes('quota')) {
    return 'The AI provider is temporarily out of quota or rate-limited. Your data is still saved; try again after billing or quota is restored.';
  }
  if (lower.includes('permission') || lower.includes('unauthorized') || lower.includes('not authorized')) {
    return 'Noesis does not have permission to complete that action. Check account access, provider setup, or workspace rules.';
  }
  if (lower.includes('api key') || lower.includes('apikey') || lower.includes('credential')) {
    return 'The provider credentials are missing or invalid. Check the server environment settings before retrying.';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timeout')) {
    return 'Noesis could not reach the service in time. Your workspace data was not changed by this failed request.';
  }
  if (lower.includes('private') || lower.includes('localhost') || lower.includes('internal') || lower.includes('metadata')) {
    return 'Noesis blocked that URL because it is not a public source. Use a public http or https link.';
  }

  return fallback;
}
