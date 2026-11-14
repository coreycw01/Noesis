# Noesis Release Handoff

Checkpoint: 2026-11-14. Local changes are retained. No new release was pushed or deployed at this checkpoint.

## Start Here

Create a review checkpoint on a feature branch, not a production rollout. Review and stage changes by feature; the current working tree is large and contains pre-existing edits and untracked files. Keep local credentials, generated builds, signing files, and test recordings out of Git. The last tracked checkpoint was `85fcd8e` on `codex/security-audit-2026-10`.

Run typecheck, lint, logic and security tests, Firebase emulator rules tests, production dependency audit, production build, and performance audit against the exact candidate commit. Push the reviewed branch for CI. Use staging for the next deployment, then verify the deployed commit before considering production.

## Remaining Checks

- **Startup performance:** The latest production build and typecheck passed, but the asset audit still reports 487/400 KiB on Home, Atlas, Library, Positions, and Works, and 492/450 KiB on public profiles. Moving the shell's save-status import out of the mutation module did not change those numbers. Inspect the largest shared runtime chunks and public route manifest membership before further splitting. Keep the existing budgets and rerun the cache-disabled mobile startup smoke test.
- **Hosted persistence and privacy:** On staging, test real sign-in, create/edit/delete/recover, permissions, and reload from a second session. Verify public profile preview, selective publishing, and withdrawal using synthetic records.
- **Contextual AI:** Use a verified staging account and configured Gemini provider. Test generation with synthetic context, edit and accept an output, reload to verify the correct destination and provenance, then verify dismiss persists nothing. Check error recovery without affecting ordinary saves.
- **Cross-device and accessibility:** Expand beyond route smoke checks. Verify keyboard, focus, touch, responsive layouts, and both themes on the candidate build. Exercise Atlas fit and controls, Evolution filters and history, Home attention, Goals/Praxis progress, Profile sharing, Settings persistence, Library capture, and Works editing and export. Include Safari and a physical Android phone.
- **Android release:** Emulator recording saved and played after reload. Physical camera and microphone permissions, hosted upload and playback, native Google sign-in, and signed Play upload bundle remain unverified. Use the owner's existing upload key and matching Firebase Android config; do not commit either.
- **Deployment:** After CI and staging pass, verify the hosting rollout and deployed revision. Confirm live startup, sign-in, record saves, and any required rules/index changes. Do not call the build Play Store ready until the signed artifact and device checks pass.

See [Noesis Experience Completion](NOESIS_EXPERIENCE_COMPLETION.md) for the detailed implementation and verification history.
