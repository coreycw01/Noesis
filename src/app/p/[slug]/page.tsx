import { Badge } from '@/components/ui/badge';
import { NOESIS_ICONS } from '@/lib/noesis-icons';
import { isValidPublicProfileSlug, publicProfileSections } from '@/lib/public-profile';
import { adminFirestore } from '@/lib/server/firebase-admin';
import type { PublicProfileSnapshot } from '@/lib/types';
import type { Metadata } from 'next';
import '../../public.css';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug.toLowerCase();
  let profile: PublicProfileSnapshot | null = null;

  if (isValidPublicProfileSlug(slug)) {
    try {
      const snapshot = await adminFirestore().collection('publicProfiles').doc(slug).get();
      const data = snapshot.data();
      if (snapshot.exists && data?.enabled === true) profile = data as PublicProfileSnapshot;
    } catch {
      return <PublicState title="Profile could not be loaded" body="Please try this link again in a moment." />;
    }
  }

  if (!profile) {
    return <PublicState title="Profile unavailable" body="This philosophy profile is private, unpublished, or no longer available." />;
  }
  const sections = publicProfileSections(profile, formatPublicDate);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center gap-3 border-b border-border/70 pb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/noesis-brand-mark.webp" alt="Noesis" width={40} height={40} className="size-10 rounded-xl object-contain" />
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
                <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : profile.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 max-w-3xl break-words">
              <div className="font-code text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Philosophy profile</div>
              <h1 className="mt-2 font-headline text-4xl font-semibold italic sm:text-5xl">{profile.displayName}</h1>
              {profile.bio && <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">{profile.bio}</p>}
              {(profile.philosophyName || profile.philosophyStatement) && (
                <div className="mt-5 rounded-2xl border border-border bg-card p-4">
                  <div className="font-code text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                    {!profile.philosophyName ? 'Philosophy statement' : profile.philosophyNameStatus === 'established' ? 'Established philosophy' : 'Working philosophy name'}
                  </div>
                  {profile.philosophyName && <div className="mt-1 font-headline text-2xl font-semibold italic">{profile.philosophyName}</div>}
                  {profile.philosophyStatement && <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{profile.philosophyStatement}</p>}
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {profile.currentSeason && <Badge variant="outline" className="rounded-full">{profile.currentSeason}</Badge>}
                {profile.themes?.slice(0, 5).map((theme) => <Badge key={theme} variant="secondary" className="rounded-full">{theme}</Badge>)}
              </div>
            </div>
          </div>
        </section>

        {sections.length > 0 && <div className="grid gap-x-10 gap-y-5 md:grid-cols-2">
          {sections.map((section) => <PublicSection key={section.icon} {...section} />)}
        </div>}

        <footer className="mt-10 border-t border-border/70 py-6 text-xs leading-5 text-muted-foreground">
          This page contains only information its owner chose to publish. Private notes, annotations, uncertainty records, and tendency feedback are excluded.
        </footer>
      </div>
    </main>
  );
}

function PublicSection({ icon, label, items }: ReturnType<typeof publicProfileSections>[number]) {
  const Icon = NOESIS_ICONS[icon];
  return (
    <section className="min-w-0 border-t border-border pt-4" aria-label={label}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="font-headline text-xl font-semibold italic">{label}</h2>
      </div>
      <ul className="mt-2 divide-y divide-border/60">
        {items.map((item) => (
          <li key={item.id} className="break-words py-3">
            <h3 className="text-sm font-medium leading-6">{item.label}</h3>
            {item.detail && <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p>}
          </li>
        ))}
      </ul>
    </section>
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
