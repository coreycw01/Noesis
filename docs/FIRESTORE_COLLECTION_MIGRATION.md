# Firestore Collection Migration

## Purpose

Schema version 5 makes annotations and long-running histories first-class records, makes `thinkingEvents` the canonical Evolution stream, backfills stable concept IDs, and bounds embedded history caches. Existing data remains readable while migration parity is verified.

## Safety model

- The migration is a dry run unless `--execute` is supplied.
- Nested source annotations are copied, not deleted.
- Legacy `timeline` records are copied into deterministic `thinkingEvents` records, not deleted.
- Full practice logs, Work revisions, and Position versions are copied before their embedded caches are bounded.
- Existing first-class records win when their stable IDs already exist.
- Annotation ID collisions are reported and skipped instead of overwriting another source's annotation.
- Re-running the migration is idempotent.

## Staging rollout

1. Authenticate Application Default Credentials for the staging Firebase project.
2. Run `npm run migrate:collections -- --project=<staging-project-id>`.
3. Review annotation, concept-ID, timeline, and collision counts.
4. Run `npm run migrate:collections -- --project=<staging-project-id> --execute`.
5. Verify source annotations, Evolution history, links, exports, and edits in staging.
6. Deploy `firestore.rules` and `firestore.indexes.json` only after existing oversized arrays have been checked.
7. Repeat the dry run and execute steps for production.

Use `--uid=<firebase-uid>` to limit either mode to one account.

## Compatibility window

The application dual-writes annotations to `/annotations` and to a bounded source cache. Reads merge both paths by annotation ID. New Evolution syntheses write only to `thinkingEvents`; the legacy timeline remains readable until parity and retention checks are complete.
