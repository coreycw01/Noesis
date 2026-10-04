# Cognitive Architecture Milestone Plan

This plan preserves a working Noesis at every boundary. Each milestone is independently testable and has a rollback path.

## M0 — Invariants and benchmark contract

**Status:** implemented in this change.

### Dependencies

- Governing research brief reviewed.
- Current data model, rules, event writes, deletion, AI path, and route data requirements inspected.

### Deliverables

- Repository-specific adversarial review.
- Locked architecture invariants.
- Synthetic evidence-anchor fixture.
- 60 benchmark questions with citation groups, contrary and excluded evidence, relation authority, attribution, temporal/review state, security scenarios, completeness targets, budgets, and abstention requirements.
- Deterministic validation tests.

### Acceptance tests

- Exactly 60 cases with the required distribution.
- Every referenced anchor exists.
- Every answerable case requires evidence.
- Every insufficient-evidence case requires abstention and no supporting anchor.
- Authorship and temporal-replacement regression cases exist.
- Existing typecheck, logic tests, security tests, and production build pass.

### Rollback

Remove the Stage 0 library contract, fixtures, tests, and documentation. No runtime or stored data changes are made.

### Stop point

Stop before schema design. Obtain product-owner decisions D1–D8.

## M0.5 — Review-account vertical slice

**Authorized only for isolated, reversible evaluation fixtures.**

### Dependencies

- User signs in to the existing dedicated review account.
- In-memory identity checks match the existing review account constants and `workspaceMode === 'review'`.
- Metadata-only inventory confirms whether non-fixture material must be preserved.

### Work

- Run a read-only account inventory first.
- Establish deterministic fixture ownership and dry-run reset behavior.
- Measure exact/lexical retrieval before semantic retrieval.
- Compare semantic, hybrid, and reranked retrieval independently from generation.
- Run bounded generation only after retrieval metrics are recorded.

### Acceptance

- No test record can escape the review UID.
- No unmarked record can be reset.
- Local-only, deleted, invalidated, and stale evidence is excluded as required.
- Prompt-injection content receives no instruction authority.
- Correction/rejection recurrence and stale-index invalidation are measurable.
- Per-case latency, weighted cost, evidence count, recall, and citation results are reproducible.

### Rollback

- Dry-run lists only records marked with the evaluation run ID.
- Execute removes only that run's test artifacts.
- Canonical non-fixture records, billing, sharing, email, and other users remain untouched.

### Stop point

Do not reuse the evaluation namespace as the production cognitive-index schema.

## M1A — Event completeness and compatibility report

**Not authorized until D3 and D8 are answered.**

### Work

- Inventory every meaningful mutation and its event coverage.
- Make required domain events independent of metacognitive analysis flags.
- Define compact semantic-diff and redaction rules.
- Build a read-only adapter that maps thinking events to the current Evolution view.
- Produce parity metrics against legacy `timeline` without deleting or rewriting it.

### Acceptance

- All required mutations have atomic or recoverably idempotent events.
- Event pagination and time-range queries exceed the current 200-item window.
- Evolution output parity is measured on demo and staging workspaces.
- Sensitive field redaction tests pass.

### Migration and rollback

- New reads remain behind a feature flag.
- `timeline` remains untouched until two releases of parity evidence.
- Rollback switches Evolution to the old source; no event data is deleted.

### Stop point

Do not deprecate `timeline` until parity, backfill, and redaction acceptance pass.

## M1B — First-class annotation compatibility layer

**Not authorized until D4, D5, D7, and D8 are answered.**

### Work

- Define stable annotation identity and a repository interface.
- Add an explicit Firestore rule and emulator tests for the chosen user-owned path.
- Backfill nested annotations idempotently with source/revision provenance.
- Dual-read through one adapter and compare counts/content hashes.
- Switch writes only after parity; preserve a bounded compatibility representation for rollback.

### Acceptance

- Source capture, annotation inbox, concept linking, inquiry promotion, position promotion, export, and delete pass end-to-end tests.
- Stable IDs survive source edits.
- Cross-user reads/writes fail.
- Duplicate retries are idempotent.
- Deleting a source follows the chosen dependent-object policy.

### Migration and rollback

- Backfill is versioned, dry-runnable, and does not remove nested data.
- Authority switch is feature-flagged.
- Rollback restores nested authoritative reads until a later cleanup milestone.

### Stop point

Do not remove nested annotation arrays in the same release as authority switching.

## M1C — Stable identity adapters

### Work

- Replace durable name/tag foreign keys incrementally with IDs while retaining labels for display/search.
- Add referential-integrity diagnostics for links and denormalized arrays.
- Do not auto-merge concepts by normalized name.

### Acceptance

- Rename operations preserve relationships.
- Broken references are surfaced and repairable.
- Existing Atlas and filters remain usable during mixed-format migration.

### Rollback

- Readers support old and new representations by migration version.
- No destructive cleanup until integrity reaches the agreed threshold.

## M2 — Evidence foundation

**Depends on M1A, M1B, M1C and all product decisions.**

### Work

- Introduce immutable revisions and exact evidence-anchor interfaces.
- Add local/external-processing policy inheritance.
- Add export, deletion, redaction, and stale-reference behavior.
- Open citations at the exact revision and passage.

### Acceptance

- Citation survives later edits by revision/hash.
- Current and historical text are distinguishable.
- Export and deletion cover canonical and copied event text.
- AI-excluded content never appears in an external request fixture.

### Rollback

- Anchors are additive and ignored by old clients.
- No canonical field is overwritten by derived data.

### Stop point

Do not build embeddings until exact citation and privacy tests pass.

## M3 — Retrieval MVP

### Work

- Add replaceable contextual passages and versioned embeddings.
- Add exact/lexical and semantic candidate generation behind a provider-neutral interface.
- Add rank fusion, reranking, bounded budgets, evidence bundles, claim-level answer validation, and abstention.
- Keep Ask Noesis read-only.

### Acceptance

- Benchmark retrieval recall, citation precision, attribution, temporal correctness, obsolete-memory suppression, abstention, latency, privacy, and prompt-injection targets are agreed and met.
- Exact retrieval works without a generative model.
- Index failure never blocks canonical capture.

### Rollback

- Disable the retrieval feature flag and delete/rebuild the derived index.
- Canonical data and existing item-level workflows remain intact.

### Stop point

Do not add claim extraction to compensate for unmeasured retrieval failures.

## M4 — Selective claims and candidate relations

### Work

- Add claims only for benchmark classes that need them.
- Add candidate relation review with exact evidence, freshness, and rejection suppression.
- Promote only through explicit canonical mutations.

### Acceptance

- Contradiction/tension precision is measured after human review.
- Temporal replacements are not mislabeled as contradictions.
- Rejected candidates do not recur above the agreed rate.

### Rollback

- Delete the derived claim/relation index and disable its planner channel.
- Accepted canonical links remain user-owned and auditable.

## M5 — Evidence-backed derived cognition

### Work

- Add belief biographies, patterns, gaps, and syntheses as materialized views.
- Add freshness, invalidation, correction, review, and alternative-interpretation controls.
- Consider global/community graph analysis only after benchmark evidence justifies it.

### Acceptance

- Every substantive statement has exact evidence and visible uncertainty.
- Stale views invalidate when input revisions change.
- User corrections are respected and measurable.
- Cost and latency stay inside declared budgets.

### Rollback

- Derived views are disposable and can be regenerated by version.
- No canonical intellectual record depends on them for integrity.

## Cross-milestone quality gate

Every milestone must report:

- cohesion and identity consistency;
- interaction fluency and accessibility;
- latency and cost;
- groundedness, attribution, temporal correctness, and abstention;
- inspectability and correction behavior;
- privacy, authorization, deletion, and prompt-injection results;
- migration state, rollback procedure, and unresolved risks.
