import { LegalPage } from '@/components/LegalPage';

export const metadata = { title: 'Privacy Policy | Noesis' };

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      summary="Noesis stores your intellectual workspace under your authenticated account and does not use an empty or failed workspace as permission to substitute another user's data."
    >
      <section>
        <h2>Information Noesis handles</h2>
        <p>Noesis processes account details provided through Firebase Authentication and the content you intentionally save, including sources, annotations, concepts, inquiries, positions, works, practices, links, settings, and thinking-event history.</p>
      </section>
      <section>
        <h2>How information is used</h2>
        <p>Your information is used to authenticate you, synchronize your private workspace, calculate deterministic workspace summaries, restore your settings, and provide features you explicitly invoke. Noesis does not sell personal information.</p>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>Noesis uses Google Firebase for authentication, database, storage, hosting, and abuse protection. Source lookup may contact public metadata providers. Contextual AI runs only after an explicit action, sends bounded context for the selected item, and may use Google generative services when the feature is enabled.</p>
      </section>
      <section>
        <h2>Data isolation and security</h2>
        <p>Workspace records are scoped to the authenticated user. Demo content is isolated from production accounts. Network requests use HTTPS, protected server routes require authentication, and private uploaded assets are stored under user-scoped paths.</p>
      </section>
      <section>
        <h2>Retention and deletion</h2>
        <p>Your workspace remains available until you delete individual records or request account deletion. The in-app account deletion control is available in <a href="/settings/">Settings &gt; Account</a>. Deletion removes the Firebase account and its user-scoped workspace.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Export your workspace from Settings.</li>
          <li>Disable optional AI and metacognition features.</li>
          <li>Delete individual objects or the complete account.</li>
        </ul>
      </section>
      <section>
        <h2>Questions</h2>
        <p>Privacy and deletion questions can be filed through the <a href="https://github.com/coreycw01/Noesis/issues" rel="noreferrer">Noesis support repository</a>.</p>
      </section>
    </LegalPage>
  );
}
