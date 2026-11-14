# Noesis Release Handoff

Checkpoint: 2026-11-14. Review commit `22844d9` was pushed to `codex/noesis-experience-checkpoint`. It was not merged or deployed.

## Start Here

Start with the pushed review branch, not a production rollout. Keep local credentials, generated builds, signing files, and test recordings out of Git.

Local rechecks on `22844d9`: 281 logic tests and 16 security tests passed; lint exited successfully with 26 warnings and no errors. The alternative Turbopack build was stopped during compilation, before an asset measurement, so the Webpack budget result below still stands. CI was not verified in this pass.

Run typecheck, lint, logic and security tests, Firebase emulator rules tests, production dependency audit, production build, and performance audit against the exact release candidate. Use staging for the next deployment, then verify the deployed commit before considering production.

## Remaining Checks

The release audit now prints the shared framework baseline: 443 KiB raw in the current Webpack build, before route assets. The startup thresholds are unchanged and still fail. A fresh production dependency audit could not reach the npm advisory registry from this environment; obtain a successful audit before release.

Production Chromium passed local demo persistence at 390 and 1440 px: save and reload inquiry stakes, save the Work title, autosave body text without clicking Save, reload, delete the Work, restore it from Settings > Data, and reopen it with both title and body intact. Repeat in a disposable local demo session with `scripts/smoke-workspace-persistence.js`. This does not verify cloud persistence.

Production Chromium verified saving Dark at 390 px and Light at 1440 px, then loading Today, Atlas, and Evolution from fresh navigations with the saved appearance applied. Repeat with `scripts/smoke-theme-persistence.js`. This verifies local demo appearance persistence, not signed-in cross-device synchronization.

The current production demo passed all 26 Chromium route checks across 390 and 1440 px: 13 routes returned HTTP 200, rendered the expected headings, and showed no document-wide horizontal overflow or uncaught page errors. Repeat with `scripts/smoke-release-routes.js`. This verifies route rendering, not every editing or persistence workflow.

Today now loads an exercise preview without the full game controls. The production build passed, and the Today-to-Praxis Exercises flow passed at 390 and 1440 px. The cache-disabled mobile run measured 24 requests, 2,128 KiB decoded, and 630 KiB transferred by visible Today, compared with 25 requests and 632 KiB transferred before this split. Physical Android verification is deferred at the owner's request.

Follow-up local Webpack build: six AI approval handlers now load on demand. At 390 x 760 in cache-disabled Chromium, two production builds both reached Today with 25 JS/CSS requests. The baseline was 2,148 KiB decoded / 637 KiB transferred; the revised build was 2,133 / 632 KiB. This checks the demo startup, not hosted approval or timing. The first-document budgets remain unchanged.

Release retest: the local production Chromium build passed the 390 x 520 keyboard and accessibility smoke for Atlas map settings (including a scoped axe scan), Evolution date validation, Settings switches, and Inquiry practice fields. This was not a full accessibility audit. Android debugging reported no connected devices. The checked-in Firebase project mapping exposes only a default project; no staging endpoint was supplied for hosted persistence or Gemini.

- **Startup performance:** The latest production build and typecheck passed, but the asset audit still reports 487/400 KiB on Home, Atlas, Library, Positions, and Works. The public profile measures 473/450 KiB after correcting a 19 KiB overcount from the workspace-only layout. The regression test passed; this is a reporting correction, not a download reduction. The shared Next.js and React runtime accounts for roughly 437 KiB before app code. Keep the existing budgets and rerun the cache-disabled mobile startup smoke test for any production build change.
- **Hosted persistence and privacy:** On staging, test real sign-in, create/edit/delete/recover, permissions, and reload from a second session. Verify public profile preview, selective publishing, and withdrawal using synthetic records.
- **Contextual AI:** Use a verified staging account and configured Gemini provider. Test generation with synthetic context, edit and accept an output, reload to verify the correct destination and provenance, then verify dismiss persists nothing. Check error recovery without affecting ordinary saves.
- **Cross-device and accessibility:** Expand beyond route smoke checks. Verify keyboard, focus, touch, responsive layouts, and both themes on the candidate build. Exercise Atlas fit and controls, Evolution filters and history, Home attention, Goals/Praxis progress, Profile sharing, Settings persistence, Library capture, and Works editing and export. Include Safari and a physical Android phone.
- **Android release:** Emulator recording saved and played after reload. Physical camera and microphone permissions, hosted upload and playback, native Google sign-in, and signed Play upload bundle remain unverified. Use the owner's existing upload key and matching Firebase Android config; do not commit either.
- **Deployment:** After CI and staging pass, verify the hosting rollout and deployed revision. Confirm live startup, sign-in, record saves, and any required rules/index changes. Do not call the build Play Store ready until the signed artifact and device checks pass.

See [Noesis Experience Completion](NOESIS_EXPERIENCE_COMPLETION.md) for the detailed implementation and verification history.
