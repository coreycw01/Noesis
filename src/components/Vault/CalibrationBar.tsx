"use client";

import { InstrumentHelp } from '@/components/shared/InstrumentHelp';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { zoneLabel } from '@/components/Vault/PositionCalibration';
import { ConfidenceEmber } from '@/components/Vault/ConfidenceEmber';

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
  const cancel = () => { setDragged(stated); setAsking(false); setReason(''); };

  return (
    <div className="noesis-calbar" data-tone="position">
      <div className="noesis-calbar__instrument">
      <div className="noesis-confbox">
        <ConfidenceEmber confidence={dragged} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            <Eyebrow>{moved ? 'Confidence preview' : 'Stated confidence'}</Eyebrow>
            <InstrumentHelp instrument="calibration" />
          </div>
          <div className="noesis-confbox__big">{dragged}%</div>
          <div className="text-xs text-muted-foreground">{zoneLabel(dragged).toLowerCase()}</div>
        </div>
      </div>
      <div className="noesis-calbar__track">
        {grounds !== null && (
          <>
            <span className="noesis-calbar__grounds" style={{ left: `${grounds}%` }} aria-hidden="true" />
            <span className="noesis-calbar__grounds-label" style={{ left: `clamp(2.5rem, ${grounds}%, calc(100% - 2.5rem))` }}>For {grounds}%</span>
          </>
        )}
        {grounds !== null && (
          <span className="noesis-calbar__gap" style={{ left: `${Math.min(dragged, grounds)}%`, width: `${Math.abs(dragged - grounds)}%` }} aria-hidden="true" />
        )}
        <input
          type="range" min={0} max={100} value={dragged} disabled={disabled}
          className="noesis-calbar__range"
          aria-label={`Stated confidence, ${dragged} percent`}
          onChange={(event) => { setDragged(Number(event.target.value)); setAsking(false); }}
          onPointerUp={() => { if (dragged !== stated) setAsking(true); }}
          onKeyUp={(event) => { if ((event.key.startsWith('Arrow') || ['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) && dragged !== stated) setAsking(true); }}
        />
        <span className="noesis-calbar__stated-label" style={{ left: `clamp(1rem, ${dragged}%, calc(100% - 1rem))` }}>{dragged}%</span>
      </div>
      </div>

      <p className="noesis-lean" aria-live="polite">
        {grounds === null ? <>Nothing weighed yet. Add support or a challenge to see the balance.</>
          : !supportCount ? <>Only challenges are recorded. Is there a reason or observation that supports the claim?</>
            : !challengeCount ? <>Only support is recorded. Consider the strongest counterargument.</>
              : <>Would the strongest ground for or against the claim change your confidence?</>}
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
        Grounds in support is the share of recorded grounds classified as support: {supportCount} for · {challengeCount} against. It does not estimate how confident you should be. Your confidence only changes when you save it with a reason.
      </p>
    </div>
  );
}
