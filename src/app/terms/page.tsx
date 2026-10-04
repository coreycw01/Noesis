import { LegalPage } from '@/components/LegalPage';

export const metadata = { title: 'Terms of Use | Noesis' };

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of Use"
      summary="Noesis is a reflective workspace. Its summaries, diagnostics, and optional assistance are tools for review, not professional advice or claims about your identity."
    >
      <section>
        <h2>Your workspace</h2>
        <p>You are responsible for the content you add and for keeping your account credentials secure. Do not upload content you do not have permission to store or process.</p>
      </section>
      <section>
        <h2>Reflective and AI features</h2>
        <p>Diagnostics are derived from recorded objects and events. Optional AI output can be incomplete or incorrect and must be reviewed before acceptance. Noesis does not provide medical, legal, financial, or mental-health advice.</p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>Do not abuse the service, attempt to access another user's data, evade usage limits, upload malicious material, or interfere with service availability.</p>
      </section>
      <section>
        <h2>Availability</h2>
        <p>The service may change, experience interruptions, or remove experimental features. Export important work regularly. Features that depend on external metadata, storage, or AI providers may be unavailable independently of the rest of the app.</p>
      </section>
      <section>
        <h2>Account termination</h2>
        <p>You may stop using Noesis or delete your account at any time. Noesis may restrict abusive activity needed to protect users, infrastructure, or legal obligations.</p>
      </section>
    </LegalPage>
  );
}
