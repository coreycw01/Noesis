# Context Desk delivery

Baseline reviewed: origin/main 2d8468c (merged PR #82). The local committed tree at 2d08bee matched that tree. Existing uncommitted onboarding and Atlas changes were not part of this work. The older separate worktree was not readable in this session; its draft history implementation was not imported.

## Implemented locally

- Signed-in accounts can explicitly save the current session selection and exclusions as a named desk, reopen it, rename it with Save desk, save a copy, or delete the saved desk without deleting workspace records.
- The owner-only settings document at `users/{uid}/settings/contextDesks` stores desk names, revisions, and record keys, not excerpts or conversation text. Existing settings export includes this document. Saves use a transaction and reject a stale revision instead of silently replacing another device's edit.
- Membership holds up to 300 references, separate from the existing limit of 12 records per AI request. Saving, opening, and rearranging membership do not call Gemini or spend AI allowance. The selection list renders 40 rows initially and can show more.
- The current session selection can be saved without reselecting everything. Old sessions are not imported automatically. Missing memberships can be removed explicitly. Exclusions apply before sampling; the first eligible 12 are shown in Review Context. Prioritize moves an item into that review without removing the others. A Work saved from an accepted review references only the records supplied to that request.
- The existing item-assisted History and Gemini limits are unchanged. Local demo sessions can hold a larger temporary desk but do not write named desks to Firebase.

## Verified

- Synthetic logic fixtures for 12, 80, and 300 members: round-trip membership, duplicate IDs, duplicate titles, excluded sources, missing records, and the existing request character budget.
- Conflict detection on update and delete; exclusions retained beyond the membership cap.
- These are not browser, Firestore security integration, real model, or load tests.

## Remaining release work

1. Verify signed-in save/reopen/delete from two browser sessions, including owner isolation, offline failure, and settings export. Verify mobile navigation and focus in the desk library. Decide whether named desks should reopen automatically.
2. Replace the current eager workspace reads with a paged searchable index before claiming large-workspace load improvements.
3. Add focused passage retrieval, durable question history and validated citation excerpts, with explicit capture, retention, export and deletion policies. Keep prior item-level history separate and reachable.
4. Add whole-desk manifests, batch scheduling, partial completion, cancellation and stale-review handling. Do not turn on deep review until server-owned reservations, reconciliation and retried request tests are in place.
5. Run the wider synthetic position, inquiry and concept corpus tests and record latency, reads, evidence recall, cost and device data. Only enable additional processing in staging or production with authorization.
