'use client';

import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { noesisUserError } from '@/lib/user-facing-errors';
import { buildPositionScopeCheck, POSITION_SCOPE_CASE_LIMIT, POSITION_SCOPE_VERDICTS, scopeCheckIsCurrent, type PositionScopeCheck, type PositionScopeVerdict } from '@/lib/position-scope-check';

export function PositionScopeTool({ claim, saved, onSave }: { claim: string; saved?: PositionScopeCheck; onSave: (check: PositionScopeCheck) => Promise<void> }) {
  const fieldId = useId();
  const current = saved && scopeCheckIsCurrent(saved, claim) ? saved : undefined;
  const [draft, setDraft] = useState<{ situation: string; verdict: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const situation = draft?.situation ?? current?.situation ?? '';
  const verdict = draft?.verdict ?? current?.verdict ?? '';
  const result = buildPositionScopeCheck(claim, situation, verdict);
  const unchanged = current && result && current.situation === result.situation && current.verdict === result.verdict;

  return (
    <form className="grid min-w-0 gap-3" onSubmit={async event => {
      event.preventDefault();
      if (!result || unchanged || savingRef.current) return;
      savingRef.current = true;
      setSaving(true);
      setError('');
      try {
        await onSave(result);
        setDraft(null);
      } catch (cause) {
        setError(noesisUserError(cause, 'Could not save the scope check. Try again.'));
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    }}>
      <blockquote className="break-words border-l-2 border-tone/50 pl-3 text-sm leading-6">{claim}</blockquote>
      <label className="grid gap-1 text-sm font-medium" htmlFor={fieldId}>
        One situation
        <Textarea id={fieldId} value={situation} maxLength={POSITION_SCOPE_CASE_LIMIT} disabled={saving} onChange={event => setDraft({ situation: event.target.value, verdict })}
          placeholder="What is one situation where this claim might not apply?" className="min-h-20" />
      </label>
      <fieldset disabled={saving} className="grid min-w-0 gap-2 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium">How does the claim fit this case?</legend>
        {Object.entries(POSITION_SCOPE_VERDICTS).map(([value, label]) => (
          <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--card-radius)] border border-border px-3 py-2 text-sm has-[:checked]:border-tone has-[:checked]:bg-tone/10">
            <input type="radio" name={fieldId} value={value} checked={verdict === value} onChange={() => setDraft({ situation, verdict: value as PositionScopeVerdict })} className="shrink-0 accent-[hsl(var(--accent))]" />
            {label}
          </label>
        ))}
      </fieldset>
      <Button type="submit" variant="secondary" className="min-h-11 justify-self-start" disabled={!result || Boolean(unchanged) || saving}>{saving ? 'Saving...' : 'Save to Revise'}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
