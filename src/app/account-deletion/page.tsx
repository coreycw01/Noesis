import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';

export const metadata = { title: 'Delete Your Account | Noesis' };

export default function AccountDeletionPage() {
  return (
    <LegalPage
      eyebrow="Account control"
      title="Delete your Noesis account"
      summary="Account deletion is available inside Noesis and removes the authenticated account together with its user-scoped workspace."
    >
      <section>
        <h2>Delete from the app</h2>
        <ol className="space-y-2">
          <li>Sign in to the Noesis account you want to delete.</li>
          <li>Open <strong>Settings</strong>, then <strong>Account</strong>.</li>
          <li>Select <strong>Delete account and workspace</strong>.</li>
          <li>Review the warning and confirm deletion.</li>
        </ol>
        <Link href="/settings/" className="mt-5 inline-flex min-h-11 items-center rounded-full border border-accent bg-accent px-5 font-code text-[10px] uppercase tracking-[0.08em] text-accent-foreground no-underline">
          Open account settings
        </Link>
      </section>
      <section>
        <h2>What is deleted</h2>
        <p>The Firebase Authentication account and records stored beneath the account's <code>/users/&#123;uid&#125;</code> workspace are deleted. This includes sources, annotations, concepts, inquiries, positions, works, practices, links, settings, and history.</p>
      </section>
      <section>
        <h2>If you cannot sign in</h2>
        <p>File a deletion request through the <a href="https://github.com/coreycw01/Noesis/issues" rel="noreferrer">Noesis support repository</a>. Do not include passwords, authentication codes, private workspace content, or API keys in the request.</p>
      </section>
    </LegalPage>
  );
}
