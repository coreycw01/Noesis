"use client";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-[#11100d] p-6 text-[#f7f3ea]">
        <main className="w-full max-w-lg rounded-2xl border border-white/15 bg-white/5 p-8 text-center shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Noesis recovery</p>
          <h1 className="mt-3 text-3xl font-semibold">The app needs a clean reload.</h1>
          <p className="mt-4 text-sm leading-6 text-white/65">
            {/ChunkLoadError|Loading chunk .* failed/i.test(error.message)
              ? 'A newer version is available, but this tab still has an older app file cached.'
              : 'Noesis could not finish loading the workspace. Your saved data was not cleared.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 min-h-11 rounded-full bg-[#e7b643] px-6 font-semibold text-black focus:outline-none focus:ring-2 focus:ring-white"
          >
            Reload Noesis
          </button>
        </main>
      </body>
    </html>
  );
}
