export const POSITION_SCOPE_CASE_LIMIT = 600;

export const POSITION_SCOPE_VERDICTS = {
  holds: 'Holds here',
  narrower: 'Needs a narrower claim',
  outside: 'Does not apply here',
} as const;

export type PositionScopeVerdict = keyof typeof POSITION_SCOPE_VERDICTS;
export type PositionScopeCheck = { claim: string; situation: string; verdict: PositionScopeVerdict };

export function buildPositionScopeCheck(claim: string, situation: string, verdict: string): PositionScopeCheck | null {
  const text = situation.trim();
  if (!claim.trim() || !text || text.length > POSITION_SCOPE_CASE_LIMIT || !Object.hasOwn(POSITION_SCOPE_VERDICTS, verdict)) return null;
  return { claim: claim.trim(), situation: text, verdict: verdict as PositionScopeVerdict };
}

export function scopeCheckIsCurrent(check: PositionScopeCheck, claim: string) {
  return check.claim === claim.trim();
}

export function formatPositionScopeCheck(check: PositionScopeCheck) {
  return `${POSITION_SCOPE_VERDICTS[check.verdict]}: ${check.situation}`;
}
