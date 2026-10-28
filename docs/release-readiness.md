# Noesis completion work

The product goal is a dependable, user-owned philosophy workspace that actively
leads users through Encounter, Question, Claim, Praxis, and Revise. Guidance is the
default, but checkpoints may be skipped with a recorded reason. Accepted AI
output remains reviewed and user-owned. Goals become Commitments connected to
positions and practices; points and collectible achievements are removed.

## Delivery and evidence

- In progress: baseline checks, save reliability, and workflow data integrity.
- Pending: complete account isolation, counts, deletion/recovery, and relationship audit.
- Pending: full source-to-practice journey, including failure and retry behavior.
- Pending: all-page consistency, accessibility, and responsive verification.
- In progress: Works manual/autosave coordination and contextual AI cancellation.
- Pending: authenticated AI smoke tests for each action and acceptance destination.
- Implemented locally: independent first-use entry paths, a collapsed event-backed weekly review, the visible guided-cycle navigation, canonical stage derivation, deterministic Today guidance, Commitments, and the Say/Do Mirror. Transition checkpoints, discovery onboarding, and the Mentor voice remain pending.
- Implemented, not device-verified: native Google sign-in bridge. Pending Android Firebase configuration and physical recording/upload/back-button checks.
- Production build passed. Pending: staging load/security checks and Android release candidate.

Completed work and verification are recorded below as evidence becomes available.
An untested behavior is not considered release-ready. Local demo verification does
not establish authenticated Firestore, Storage, AI, or physical Android behavior.

## Baseline

- Typecheck passed before this implementation pass.
- Existing 33 logic tests passed before this implementation pass.
- Local Home renders at http://localhost:9073/demo/home/.
- Guided-path decisions were reconciled against the attached product audit before implementation.

## Defects identified

- Position confidence of 1-5 percent was reinterpreted as a legacy five-point score.
- Inquiry creation omitted remaining uncertainty from its persisted payload.
- Inquiry save messages appeared before Firestore completion.
- Works manual saves could overlap autosaves and clear the dirty state of newer edits.
- AI requests had no user cancellation and prevented closing their dialog while running.
- Restoring a deleted record could overwrite a live record with the same ID.

## Release gates

Run typecheck, logic/security tests, production build, and dependency audit.
Verify save/refresh/reopen and failure handling for every entity type. Review
mobile/desktop layouts, selected appearance settings, keyboard navigation,
account switching, deletion recovery, media permissions and interrupted uploads.
Deploy only after staging verification and explicit production release approval.

## Verified implementation pass

- Inquiry context saves await completion, retain failed edits, and preserve uncertainty.
- Works manual and automatic saves share a queue; shell navigation waits for dirty Works saves.
- AI requests are cancellable, bounded by a timeout, and checked against the requested target.
- Restore uses create-only transactions and refuses to overwrite an existing record.
- Disabled Firestore hooks return empty state immediately; private asset URLs cannot linger after a target change.
- Demo mutations persist in session storage isolated by demo identity. No production write is substituted for a demo edit.
- Network/save errors are no longer automatically labeled as permission failures.
- Confidence values use a consistent 0-100 scale; legacy conversion requires an explicit scale.
- 46 logic tests, 8 security tests, typecheck, and the production build passed in this implementation pass.
- Capacitor Android sync passed with the native authentication plugin.
- Mobile browser smoke check at 390x844: Home, Concepts, Inquiries, Library, Source Index, Annotations, Positions, Works, Practices, Evolution, Profile, Goals, Settings and Atlas rendered without horizontal document overflow. This is not full workflow validation.
- Inquiry uncertainty saved and survived refresh in the demo.
- Works text survived immediately navigating Home, reopening the Work, and refreshing. No browser error logs captured in that test.

## Remaining concrete limitations

- Persistent layout now owns one workspace instance. Browser tests confirmed sidebar continuity during navigation with loading confined to content. Slow-network, back/forward and authenticated route coverage remain pending.
- Production route entry reports 103 kB, but the workspace is loaded separately. This is not a measurement of total startup JavaScript; the performance target is not yet verified.
- Some legacy mutation callbacks still return before persistence; remaining create/link/delete flows need the same awaited contract and failure tests.
- Demo drafts now share the normal demo store. Demo recording blobs use IndexedDB and private local URLs instead of cloud uploads. Physical recording, interrupted uploads and local media retention/purge still need testing.
- Live AI, Firestore/Storage rules, account switching, failure injection, all appearance modes and physical Android behavior are not validated by the local demo tests.
- Android Google sign-in requires the correct google-services.json for com.noesis.app plus registered signing fingerprints. No configuration file was invented and no real Google login was claimed successful.
- The full end-to-end workflow acceptance matrix remains unfinished.

## Nine-batch continuation evidence

1. Baseline: configured repeatable ESLint execution; corrected JSX escaping and an invalid ARIA attribute. Lint passes with 31 warnings still requiring review, mainly hook dependencies and image optimization.
2. Data/navigation: removed duplicate workspace mounting, stopped copying private Next history state, synchronized browser titles, keyed workspace state by account/mode, and consolidated demo Work mutations. Practice summary pills count each matching record once.
3. Workflows: inquiry-created Practices and Works await persistence and atomically update inquiry backlinks. Only explicitly attached positions are inherited. Existing-item linking reports partial failure instead of false success. Practice edits are not reset by background snapshots; failed log/review saves retain inputs.
4. UI/mobile: login inputs have associated labels; inquiry answer has an accessible label; practice setup warnings use theme tokens and the action says Finish setup. Mobile Home checked at 390x844 without horizontal document overflow. This does not establish all-page accessibility compliance.
5. Works: shared save queue, retained media on recoverable deletion, shared demo persistence, and local demo recording storage. Hardware recording/upload and every ribbon control remain unverified.
6. AI/security: item-first context capped to 32,000 characters; preview and submitted context match. Selected-pair and period validation are enforced. Request bodies are bounded while streaming, not only after allocation. Live model quality and authenticated provider success remain unverified.
7. Guidance: Today now selects one next move and the longest-waiting unanswered inquiry. The navigation follows Encounter → Question → Claim → Praxis → Revise, while the internal stage value remains `test` for data compatibility. Mutations preserve a canonical stage alongside legacy status. Commitments replace the visible points/achievement experience and include an evidence-backed Say/Do Mirror.
8. Android: native Google credential bridge and Capacitor sync implemented. Missing project Firebase Android configuration and physical-device verification block release sign-off.
9. Regression: 44 logic tests and 8 security tests pass; typecheck, production build and production dependency audit pass. Production audit reports no unapproved high/critical findings, not a claim that every development dependency is vulnerability-free.

### Concrete browser checks

- Local demo used for this pass: http://localhost:9074/demo/home.
- Created a Practice from inquiry q_comfort_growth; practice count increased from 8 to 9 and survived refresh. The practice appeared in Other Practices with its action, linked inquiry and setup warning.
- Home/Inquiries/Practices route transitions retained the sidebar; loading stayed inside page content. Browser title now follows the selected route.
- Home rendered at desktop and 390x844, retaining mobile navigation and its current appearance tokens.
- Earlier console RSC fetch failures occurred before the navigation repair; do not treat those historical logs as a clean all-session console report.

### Still required before completion

- Authenticated staging matrix: create/edit/save/reload/delete/restore across all record types, account switching, offline/permission failures, and AI acceptance destinations.
- Firestore/Storage emulator rules, quota/concurrency/load tests, retention cleanup, real camera/microphone uploads, and Android release build/device verification.
- Remaining legacy fire-and-forget mutations and two-step existing-item links need transactional service coverage; linked-record partial saves are surfaced but not yet universally atomic.
- Full keyboard, mobile, back/forward and appearance-matrix coverage; remaining lint warnings; total startup performance measurement. Browser checks confirmed that ordinary route changes now reset main-content scroll without moving the sidebar.
- No production deployment or commit was performed in this continuation. None of these nine batches is being signed off as fully release-ready solely from the demo.

Native authentication follows the [Capawesome Firebase JS SDK integration](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/firebase-js-sdk.md): native credential acquisition with skipNativeAuth, followed by Firebase JavaScript signInWithCredential.
