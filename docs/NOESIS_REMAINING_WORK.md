# Noesis: Remaining Work

Updated 2026-11-14. The local web build has passed targeted verification; the web release and Play Store release are not complete. Performance implementation and deployment are deferred for now. This checklist updates the outstanding work; the [release handoff](NOESIS_RELEASE_HANDOFF.md) and [Experience Completion log](NOESIS_EXPERIENCE_COMPLETION.md) retain the detailed test history.

## 1. Close the Web Performance Gate

- [ ] Keep the existing Webpack entry as the production default until a replacement is verified. The current audit reports 487 KiB against a 400 KiB raw budget on Home, Atlas, Library, Positions, and Works, and 473 KiB against 450 KiB on public profiles. The shared framework baseline is 443 KiB. Do not treat the public-profile audit correction or the standalone estimate as passing production results.
- [ ] Reduce the standalone request overhead without putting all route code into the initial bundle. The styled local entry was estimated at about 313 KiB; the test harness is not a deployable production entry.
- [ ] Rerun cache-disabled mobile measurements on matching builds. Track initial raw JS/CSS, requests and transferred bytes through visible Today, and time to visible Today on a throttled connection. The last local run had a 5.33 s Webpack median (24 requests, 630 KiB transferred) versus 5.46 s standalone (67 requests, 605 KiB). Do not switch on bundle size alone.
- [ ] If the standalone approach wins, integrate it behind a reversible production switch. Preserve direct links, reloads, Back/Forward, route focus and scroll, Firebase auth and App Check, and the existing API behavior. Verify the final signed-in entry, not only the offline demo.
- [ ] Optimize and measure the public-profile path separately. Preserve selective publication, withdrawal, and no-store privacy behavior. Run the production asset audit on the exact release candidate and confirm both budgets pass.

## 2. Verify the Hosted Candidate

- [ ] Identify or provision an isolated staging deployment with its own Firebase configuration and synthetic records. No staging endpoint is configured in the repo. Use a verified test account; do not share credentials or use a real workspace for test mutations.
- [ ] Verify hosted email and Google sign-in, session reload, sign-out and account switching. Check access isolation with a second account and persistence from a second signed-in session.
- [ ] Run create, edit, save, reload, link, delete and recovery checks on representative records; cover offline, rejected permissions and conflicting edits. Verify selective public profile publishing and withdrawal without leaking private records.
- [ ] Run live Gemini with selected synthetic context. Verify the context sent matches the preview, edited acceptance persists at the intended destination with provenance and a history event, dismissal persists nothing, and provider failures do not block ordinary saves.
- [ ] Finish the candidate browser pass beyond route rendering: keyboard focus, touch, both themes, responsive widths and Safari. Exercise Atlas map controls, Evolution history and filters, Today attention, Goals/Praxis progress, Profile sharing, Settings persistence, Library capture and Works editing/export.

## 3. Complete Web Release Delivery

- [ ] Review the local changes and separate release code from standalone experiments. As of this checkpoint, review branch `codex/noesis-experience-checkpoint` was pushed at `22844d9`; `e28d3f8` is one local commit ahead, and the later standalone scripts and handoff updates are not committed. Exclude local logs, generated builds, credentials and signing files.
- [ ] Push the reviewed candidate and open or update its PR. Confirm CI on the exact candidate: typecheck, lint, logic/security tests, Firebase emulator rules, production build, production dependency advisory audit, and performance. A fresh local advisory audit was not verified because outbound access to the registry was blocked.
- [ ] After CI and staging pass, merge and roll out the approved candidate. Check hosting rollout status and the deployed revision, then smoke-test live startup, sign-in and an authorized test save. Verify any required rules/index changes. Keep a known-good rollback revision available.

## 4. Android Is Separate

- [ ] Physical Android testing is deferred at the owner's request. Before a Play release, verify real camera and microphone permissions, recording, hosted upload/playback, and native Google sign-in.
- [ ] Build and verify a signed Play upload bundle using the existing upload key and matching Firebase Android configuration. Keep signing material out of Git. Do not mark Play Store readiness based on emulator or unsigned builds.

## Already Verified Locally

- Production Webpack build and typecheck passed; the checkpoint passed 281 logic and 16 security tests, with no lint errors in the full lint run.
- Chromium passed 26 route-rendering checks at phone and desktop widths, plus targeted keyboard/accessibility smoke and dark/light persistence checks. These were not a full accessibility or workflow audit.
- Local demo inquiry edits and Works title/body saves survived reload; a deleted Work was restored with title and body intact.
- Standalone inquiry deep links and Praxis Back, Forward and reload passed. A disposable emulator account signed in with email and stayed signed in after reload.
- Pixel emulator recording saved and played after reload. This did not verify physical capture or hosted upload.

**Restart here:** Reduce standalone request overhead and rerun the throttled comparison. Staging setup can proceed independently. Do not deploy the standalone test harness.
