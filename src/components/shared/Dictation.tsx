"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appendToField, useDictation } from '@/lib/use-dictation';

/**
 * One dictation control for a whole writing surface, rather than a microphone
 * in every field. It remembers the last field you were typing in inside this
 * surface and appends what you say to that one; if you have not touched a
 * field yet it uses the first one. Hidden where the browser cannot listen.
 */
export function Dictation({ label = 'Dictate', hint, className, children }: {
  label?: string;
  hint?: string;
  className?: string;
  /** The writing surface. Fields inside it can be dictated into. */
  children: React.ReactNode;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [targetName, setTargetName] = useState('');

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const remember = (event: FocusEvent) => {
      const field = event.target as HTMLElement | null;
      if (field instanceof HTMLTextAreaElement || (field instanceof HTMLInputElement && ['text', 'search', ''].includes(field.type))) {
        target.current = field;
        setTargetName(field.getAttribute('aria-label') || field.placeholder || '');
      }
    };
    element.addEventListener('focusin', remember);
    return () => element.removeEventListener('focusin', remember);
  }, []);

  const { listening, supported, notice, toggle } = useDictation((words) => {
    const field = target.current && surface.current?.contains(target.current)
      ? target.current
      : surface.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>('textarea, input[type="text"], input:not([type])');
    if (!field) return;
    appendToField(field, words);
    field.focus();
  });

  return (
    <div ref={surface} className={className}>
      {children}
      {supported && (
        <div className="noesis-dictation">
          <Button type="button" variant="ghost" size="sm" onClick={toggle} aria-pressed={listening}>
            {listening ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
            {listening ? 'Stop dictation' : label}
          </Button>
          <span role="status" className="text-xs text-muted-foreground">
            {notice || (listening ? `Listening${targetName ? ` · ${targetName}` : ''}…` : hint || 'Dictates into the box you last typed in.')}
          </span>
        </div>
      )}
    </div>
  );
}
