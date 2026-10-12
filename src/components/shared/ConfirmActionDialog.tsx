"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  alternateLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onAlternate?: () => void | Promise<void>;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  alternateLabel,
  destructive,
  onConfirm,
  onAlternate,
}: ConfirmActionDialogProps) {
  const busy = React.useRef(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => { if (open) setError(''); }, [open]);
  const perform = async (action: () => void | Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await action();
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The action could not be completed. Please try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!busy.current) onOpenChange(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-headline text-2xl italic">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          {alternateLabel && onAlternate && (
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => { event.preventDefault(); void perform(onAlternate); }}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              {alternateLabel}
            </AlertDialogAction>
          )}
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => { event.preventDefault(); void perform(onConfirm); }}
            className={cn(destructive && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
          >
            {pending ? 'Working...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
