"use client";

import { PageLoadingState } from '@/components/shared/PageState';

export default function Loading() {
  return (
    <main className="min-h-screen bg-background">
      <PageLoadingState
        title="Loading Noesis"
        description="Opening the workspace surface and syncing the data this route needs."
      />
    </main>
  );
}
