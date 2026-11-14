"use client";

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkFailure = /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i.test(error.message);

  useEffect(() => {
    console.error('[NoesisRouteError]', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <section className="w-full max-w-lg rounded-[var(--card-radius)] border border-destructive/25 bg-surface p-6 text-center sm:p-8">
        <div role="alert">
          <h1 className="font-headline text-2xl font-semibold">{chunkFailure ? 'Noesis was updated' : 'Noesis could not open this page'}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {chunkFailure ? 'Reload to open the current version. Saved work will not be deleted.' : 'Your saved data was not cleared. Retry the page, or refresh the browser if the problem persists.'}
          </p>
        </div>
        <button type="button" className="mt-6 min-h-11 rounded-[var(--button-radius)] border border-border bg-card px-5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={chunkFailure ? () => window.location.reload() : reset}>
          {chunkFailure ? 'Reload Noesis' : 'Retry Page'}
        </button>
      </section>
    </main>
  );
}
