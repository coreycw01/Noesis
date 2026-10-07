"use client";

import { useEffect, useState } from 'react';
import { BookOpen, Compass, FileText, FlaskConical, Library, Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { PublicProfileSnapshot } from '@/lib/types';

export default function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const [profile, setProfile] = useState<PublicProfileSnapshot | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    void params.then(async ({ slug }) => {
      try {
        const { firestore } = initializeFirebase();
        const snapshot = await getDoc(doc(firestore, 'publicProfiles', slug.toLowerCase()));
        if (!active) return;
        if (!snapshot.exists() || snapshot.data().enabled !== true) {
          setState('missing');
          return;
        }
        setProfile(snapshot.data() as PublicProfileSnapshot);
        setState('ready');
      } catch {
        if (active) setState('error');
      }
    });
    return () => { active = false; };
  }, [params]);

  if (state === 'loading') {
    return <PublicState icon={<Loader2 className="size-6 animate-spin" />} title="Opening philosophy" body="Loading the public profile." />;
  }
  if (state === 'missing') {
    return <PublicState title="Profile unavailable" body="This philosophy profile is private, unpublished, or no longer available." />;
  }
  if (state === 'error' || !profile) {
    return <PublicState title="Profile could not be loaded" body="Please try this link again in a moment." />;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center gap-3 border-b border-border/70 pb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="Noesis" className="size-10 rounded-xl object-contain" />
          <div>
            <div className="font-headline text-xl font-semibold italic">Noesis</div>
            <div className="font-code text-[8px] uppercase tracking-[0.2em] text-muted-foreground">Public philosophy</div>
          </div>
        </header>

        <section className="py-10 sm:py-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-border bg-card text-3xl font-semibold">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : profile.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="max-w-3xl">
              <div className="font-code text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Philosophy profile</div>
              <h1 className="mt-2 font-headline text-4xl font-semibold italic sm:text-5xl">{profile.displayName}</h1>
              {profile.bio && <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">{profile.bio}</p>}
              {profile.philosophyName && (
                <div className="mt-5 rounded-2xl border border-border bg-card p-4">
                  <div className="font-code text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                    {profile.philosophyNameStatus === 'established' ? 'Established philosophy' : 'Working philosophy name'}
                  </div>
                  <div className="mt-1 font-headline text-2xl font-semibold italic">{profile.philosophyName}</div>
                  {profile.philosophyStatement && <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{profile.philosophyStatement}</p>}
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {profile.currentSeason && <Badge variant="outline" className="rounded-full">{profile.currentSeason}</Badge>}
                {profile.themes.slice(0, 5).map((theme) => <Badge key={theme} variant="secondary" className="rounded-full">{theme}</Badge>)}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <PublicSection icon={Compass} title="Concepts" empty="No concepts are shared." items={profile.concepts.map((item) => ({ id: item.id, title: item.name, body: item.description }))} />
          <PublicSection icon={FileText} title="Positions" empty="No positions are shared." items={profile.positions.map((item) => ({ id: item.id, title: item.statement, meta: `${Math.round(item.confidence)}% confidence` }))} />
          <PublicSection icon={BookOpen} title="Works" empty="No works are shared." items={profile.works.map((item) => ({ id: item.id, title: item.title, meta: item.type }))} />
          <PublicSection icon={FlaskConical} title="Practices" empty="No practices are shared." items={profile.practices.map((item) => ({ id: item.id, title: item.title, meta: item.type }))} />
          <PublicSection icon={Library} title="Sources" empty="No sources are shared." items={profile.sources.map((item) => ({ id: item.id, title: item.title, body: item.creator, meta: item.type }))} />
          <PublicSection icon={BookOpen} title="Belief History" empty="No belief history is shared." items={profile.beliefHistory.map((item) => ({ id: item.id, title: item.summary, meta: formatPublicDate(item.date) }))} />
        </div>

        <footer className="mt-10 border-t border-border/70 py-6 text-xs leading-5 text-muted-foreground">
          This page contains only information its owner chose to publish. Private notes, annotations, uncertainty records, and tendency feedback are excluded.
        </footer>
      </div>
    </main>
  );
}

function PublicSection({ icon: Icon, title, items, empty }: {
  icon: typeof Compass;
  title: string;
  items: Array<{ id: string; title: string; body?: string; meta?: string }>;
  empty: string;
}) {
  if (!items.length) return null;
  return (
    <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-accent" />
        <h2 className="font-headline text-xl font-semibold italic">{title}</h2>
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((item) => (
          <article key={item.id} className="rounded-xl border border-border/60 bg-background/60 p-3">
            <h3 className="text-sm font-medium leading-6">{item.title}</h3>
            {item.body && <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p>}
            {item.meta && <div className="mt-2 font-code text-[8px] uppercase tracking-widest text-muted-foreground">{item.meta}</div>}
          </article>
        )) : <p className="text-sm text-muted-foreground">{empty}</p>}
      </div>
    </Card>
  );
}

function PublicState({ icon, title, body }: { icon?: React.ReactNode; title: string; body: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="max-w-md text-center">
        {icon && <div className="mx-auto mb-4 flex justify-center text-accent">{icon}</div>}
        <h1 className="font-headline text-3xl font-semibold italic">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
    </main>
  );
}

function formatPublicDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
