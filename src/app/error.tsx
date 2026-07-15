"use client";

import { useEffect } from 'react';
import { PageErrorState } from '@/components/shared/PageState';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[NoesisRouteError]', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="min-h-screen bg-background p-6">
      <PageErrorState
        title="Noesis could not open this page"
        description="The page hit a runtime problem while loading its workspace data or interface."
        savedState="Your persisted Firestore data was not cleared by this page error."
        nextStep="Retry the page. If it fails again, refresh the browser or return to Atlas."
        retryLabel="Retry Page"
        onRetry={reset}
        className="min-h-[calc(100vh-3rem)]"
      />
    </main>
  );
}
