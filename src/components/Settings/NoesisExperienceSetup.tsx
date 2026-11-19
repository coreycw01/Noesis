'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { ArrowRight, BookOpen, CircleHelp, Flag, NotebookPen } from 'lucide-react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DEFAULT_EXPERIENCE, EXPERIENCE_OPTIONS, readExperience, type NoesisExperience } from '@/lib/noesis-experience';
import type { NoesisView } from '@/lib/noesis-routes';

const prompts = {
  primaryPurpose: 'What brings you to Noesis?',
  guidance: 'How involved should Noesis be?',
  activationSensitivity: 'When should Noesis start connecting your ideas?',
  challengeStyle: 'How should Noesis challenge your thinking?',
} as const;
type Dimension = keyof typeof prompts;
const dimensions = Object.keys(prompts) as Dimension[];
const choiceLabel = (field: Dimension, value: NoesisExperience[Dimension]) => EXPERIENCE_OPTIONS[field].find(([id]) => id === value)?.[1];

export function NoesisExperienceSetup({ db, uid, initialSignIn, emptyHome, showSettings, navigate, children }: {
  db: Firestore; uid: string; initialSignIn: boolean; emptyHome: boolean; showSettings: boolean;
  navigate: (view: NoesisView) => void; children: ReactNode;
}) {
  const ref = useMemo(() => doc(db, 'users', uid, 'settings', 'experience'), [db, uid]);
  const { data, loading, error } = useDoc(ref);
  const [draft, setDraft] = useState<NoesisExperience | null>(null);
  const [sessionSaved, setSessionSaved] = useState<NoesisExperience | null>(null);
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const lock = useRef(false);
  const saved = sessionSaved || readExperience(data);
  const requiredOffer = initialSignIn && !loading && !error && !saved.onboardingCompleted && !closed;
  const settingsOpen = draft !== null;
  const current = draft || saved;
  const field = dimensions[step - 1];
  const openSetup = () => { setFailure(''); setStep(0); setDraft(saved); };
  const select = (key: Dimension, value: string) => {
    const next = readExperience({ ...current, [key]: value });
    setDraft(next);
  };
  const save = async (value: NoesisExperience) => {
    if (lock.current) return;
    lock.current = true; setSaving(true); setFailure('');
    const next = { ...value, onboardingCompleted: true };
    try {
      await setDoc(ref, next);
      setSessionSaved(next); setClosed(true); setDraft(null); setStep(0);
    } catch { setFailure('Preferences could not be saved. Retry or continue without saving.'); }
    finally { lock.current = false; setSaving(false); }
  };
  const entry = [
    ['library', 'Add a book, article, or video', BookOpen],
    ['questions', 'Explore a question', CircleHelp],
    ['vault', 'Record an idea I believe', Flag],
    ['annotations', 'Add something I learned', NotebookPen],
  ] as const;
  const ordered = saved.primaryPurpose === 'develop_philosophy' || saved.primaryPurpose === 'challenge'
    ? [entry[1], entry[2], entry[3], entry[0]] : entry;

  return <>
    {emptyHome && (initialSignIn || saved.onboardingCompleted) && !loading ? <section className="noesis-page mx-auto w-full max-w-3xl">
      <h1 className="font-headline text-3xl font-semibold">Where would you like to begin?</h1>
      <ul className="mt-5 divide-y divide-border border-y border-border">{ordered.map(([view, label, Icon]) => <li key={view}>
        <button type="button" onClick={() => navigate(view)} className="flex min-h-12 w-full items-center gap-3 py-2 text-left text-sm hover:text-accent focus-visible:outline focus-visible:outline-ring">
          <Icon size={18} aria-hidden="true" /><span className="flex-1">{label}</span><ArrowRight size={16} aria-hidden="true" />
        </button>
      </li>)}</ul>
    </section> : children}
    {showSettings && <section className="noesis-page mx-auto w-full max-w-5xl border-t border-border">
      <h2 className="font-headline text-xl font-semibold">My Noesis Experience</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{dimensions.map(key => <div key={key}><dt className="text-muted-foreground">{prompts[key]}</dt><dd>{choiceLabel(key, saved[key])}</dd></div>)}</dl>
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={openSetup} disabled={loading || Boolean(error)}>Review setup</Button><Button variant="ghost" onClick={() => { setFailure(''); setDraft(DEFAULT_EXPERIENCE); setStep(5); }} disabled={loading || Boolean(error)}>Review default preferences</Button></div>
      {error && <p role="status" className="mt-2 text-sm">Experience preferences are unavailable. Other settings are unchanged.</p>}
    </section>}
    <Dialog open={requiredOffer || settingsOpen} onOpenChange={open => { if (!open && !saving) { setClosed(true); setDraft(null); setStep(0); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === 0 ? 'A place for your mind to grow.' : field ? prompts[field] : 'Your Noesis experience'}</DialogTitle>
          <DialogDescription>{step === 0 ? 'Collect ideas, explore questions, and see how your thinking changes.' : field === 'primaryPurpose' ? 'Choose your primary purpose, then add others as needed.' : step === 5 ? 'Your preferences are yours to change. This setup does not start background analysis or send notifications.' : 'You can change this independently in Settings.'}</DialogDescription>
        </DialogHeader>
        {step === 0 ? <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setDraft(saved); setStep(1); }} disabled={saving}>Shape my experience</Button>
          <Button variant="outline" onClick={() => void save(DEFAULT_EXPERIENCE)} disabled={saving}>Explore with defaults</Button>
        </div> : field ? <>
          <fieldset className="grid gap-1">
            <legend className="sr-only">{prompts[field]}</legend>
            {EXPERIENCE_OPTIONS[field].map(([id, label]) => <label key={id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--button-radius)] border border-border px-3 py-2 text-sm">
              <input name={field} type="radio" value={id} checked={current[field] === id} onChange={() => select(field, id)} />{label}
            </label>)}
          </fieldset>
          {field === 'primaryPurpose' && <fieldset className="grid gap-2 text-sm">
            <legend className="mb-2 text-muted-foreground">Other purposes (optional)</legend>
            {EXPERIENCE_OPTIONS.primaryPurpose.filter(([id]) => id !== current.primaryPurpose).map(([id, label]) => <label key={id} className="flex items-center gap-2 py-1">
              <input type="checkbox" checked={current.purposes.includes(id)} onChange={e => setDraft({ ...current, purposes: e.target.checked ? [...current.purposes, id] : current.purposes.filter(purpose => purpose !== id) })} />{label}
            </label>)}
          </fieldset>}
          <div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button><Button onClick={() => setStep(step + 1)}>Continue</Button></div>
        </> : <>
          <ul className="divide-y divide-border text-sm">{dimensions.map(key => <li className="py-2" key={key}>{choiceLabel(key, current[key])}</li>)}</ul>
          <div className="flex flex-wrap gap-2"><Button onClick={() => void save(current)} disabled={saving}>{saving ? 'Saving…' : requiredOffer ? 'Enter Noesis' : 'Save preferences'}</Button><Button variant="ghost" disabled={saving} onClick={() => setStep(1)}>Adjust my preferences</Button></div>
        </>}
        {requiredOffer && step > 0 && <Button variant="ghost" className="justify-self-start" onClick={() => void save(DEFAULT_EXPERIENCE)} disabled={saving}>Explore with defaults</Button>}
        {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
      </DialogContent>
    </Dialog>
  </>;
}
