"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { zoneLabel } from '@/components/Vault/PositionCalibration';

/**
 * One bar carrying both numbers. The grounds marker sits where the record
 * puts it and moves on its own as support and challenges are added; the
 * handle is the confidence you state, and moving it is a claim about your own
 * mind, so it only saves once you say why.
 */
export function CalibrationBar({ stated, grounds, supportCount, challengeCount, onCommit, disabled }: {
  stated: number;
  grounds: number | null;
  supportCount: number;
  challengeCount: number;
  onCommit: (value: number, reason: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [dragged, setDragged] = useState(stated);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { setDragged(stated); setAsking(false); setReason(''); }, [stated]);
  useEffect(() => { if (asking) field.current?.focus(); }, [asking]);

  const moved = dragged !== stated;
  const gap = grounds === null ? null : dragged - grounds;
  const cancel = () => { setDragged(stated); setAsking(false); setReason(''); };

  return (
    <div className="noesis-calbar" data-tone="position">
      <div className="noesis-calbar__track">
        {grounds !== null && (
          <>
            <span className="noesis-calbar__grounds" style={{ left: `${grounds}%` }} aria-hidden="true" />
            <span className="noesis-calbar__grounds-label" style={{ left: `${grounds}%` }}>Grounds {grounds}</span>
          </>
        )}
        {grounds !== null && (
          <span className="noesis-calbar__gap" style={{ left: `${Math.min(dragged, grounds)}%`, width: `${Math.abs(dragged - grounds)}%` }} aria-hidden="true" />
        )}
        <input
          type="range" min={0} max={100} value={dragged} disabled={disabled}
          className="noesis-calbar__range"
          aria-label={`Stated confidence, ${dragged} percent${grounds === null ? '' : `; grounds at ${grounds} percent`}`}
          onChange={(event) => { setDragged(Number(event.target.value)); setAsking(false); }}
          onPointerUp={() => { if (dragged !== stated) setAsking(true); }}
          onKeyUp={(event) => { if (event.key.startsWith('Arrow') && dragged !== stated) setAsking(true); }}
        />
        <span className="noesis-calbar__stated-label" style={{ left: `${dragged}%` }}>{dragged}%</span>
      </div>

      <p className="noesis-lean" aria-live="polite">
        {grounds === null ? <>Nothing weighed yet. Add support and a challenge and the grounds marker appears.</>
          : Math.abs(gap!) <= 10 ? <><b>Well calibrated.</b> Your {dragged}% sits close to the {grounds} your grounds support.</>
            : gap! > 0 ? <>You state {dragged}%, <b>{gap} above</b> what the grounds support ({grounds}). Add support, or lower it.</>
              : <>You state {dragged}%, <b>{-gap!} below</b> what the grounds support ({grounds}).</>}
        {' '}<span className="text-muted-foreground">{zoneLabel(dragged).toLowerCase()}</span>
      </p>

      {asking && moved && (
        <div className="noesis-calbar__why" role="group" aria-label="Why did your confidence move?">
          <Eyebrow size="sm">{stated}% → {dragged}%. What changed your mind?</Eyebrow>
          <div className="flex flex-wrap gap-2">
            <Input ref={field} value={reason} onChange={(event) => setReason(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && reason.trim()) { void onCommit(dragged, reason.trim()); } if (event.key === 'Escape') cancel(); }}
              placeholder="The reason, in a sentence" aria-label="Reason for the change" className="h-9 min-w-0 flex-1" />
            <Button variant="primary" tone="position" size="sm" disabled={!reason.trim()} onClick={() => void onCommit(dragged, reason.trim())}>Save the change</Button>
            <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        The grounds marker moves on its own, from what you record: {supportCount} for · {challengeCount} against. Your own number only moves when you move it, and only with a reason.
      </p>
    </div>
  );
}
