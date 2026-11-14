export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground" aria-busy="true">
      <p role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="size-4 rounded-full border-2 border-accent/30 border-t-accent motion-safe:animate-spin" aria-hidden="true" />
        Loading Noesis
      </p>
    </main>
  );
}
