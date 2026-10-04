import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function LegalPage({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh overflow-y-auto bg-background px-5 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="size-4" /> Back to Noesis
        </Link>
        <header className="mt-10 border-b border-border pb-8">
          <div className="font-code text-[10px] uppercase tracking-[0.18em] text-accent">{eyebrow}</div>
          <h1 className="mt-3 font-headline text-4xl font-semibold italic sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{summary}</p>
          <p className="mt-4 font-code text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Effective October 4, 2026</p>
        </header>
        <div className="legal-copy space-y-8 py-9 text-sm leading-7 text-muted-foreground [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_h2]:font-headline [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:italic [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
          {children}
        </div>
      </div>
    </main>
  );
}
