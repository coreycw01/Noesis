# Test-Account Validation Plan

The existing Noesis review identity is authorized for cognitive-architecture testing. The repository already defines it through `REVIEW_ACCOUNT_EMAIL` and `REVIEW_WORKSPACE_UID` in `src/lib/demo-workspace.ts`. Tests should reference those constants rather than duplicating identifiers in new configuration.

No credentials, tokens, cookies, passwords, API keys, or authenticated browser state may be written to source control, test output, screenshots, or chat.

## Current access state

No authenticated browser session was available when this plan was created. The next live-account step requires the user to open Noesis and sign in to the existing dedicated review account. Authentication itself remains user-controlled.

## Preflight before any write

1. Read the authenticated Firebase UID and email from the active session without logging either value.
2. Compare them in memory against `REVIEW_WORKSPACE_UID` and `REVIEW_ACCOUNT_EMAIL`.
3. Confirm `workspaceMode === 'review'` and the review/demo feature flags.
4. Stop immediately on any mismatch. Never redirect tests to the current user's personal workspace.
5. Read a metadata-only inventory:
   - document counts by collection;
   - seeded versus non-seeded counts;
   - current schema/demo seed versions;
   - newest update timestamp;
   - dangling-reference count.
6. Treat any record without explicit fixture/demo ownership as preserved user material.
7. Export or snapshot a manifest before a reset. Do not export private plaintext unless the user explicitly requests it.

## Isolation rules

- Every evaluation artifact receives a deterministic evaluation run ID and `evaluationFixture: true` marker.
- Reset removes only records owned by that run ID.
- Existing non-fixture records are never deleted or overwritten.
- Tests may not send email, publish content, modify sharing, create keys, alter billing, or access another UID.
- External AI calls remain disabled for local-only and prompt-injection cases.
- Provider quotas use the existing tester/demo account limits and report weighted cost.
- The harness fails closed when workspace identity or fixture ownership cannot be proven.

## Smallest safe vertical slice

### Slice A — read-only inventory

- Authenticate to the review workspace.
- Capture metadata-only collection counts and ownership markers.
- Report whether the workspace is empty, deterministic demo data, mixed data, or unknown.
- Make no writes.

### Slice B — test-only exact/lexical baseline

- Load the synthetic benchmark into an isolated evaluation namespace or local harness, not production collections.
- Resolve exact evidence anchors and measure completeness, attribution filtering, invalidation filtering, privacy filtering, and latency.
- Do not call a generative model.
- Exit criterion: exact retrieval and “show everything” completeness cases have reproducible metrics.

### Slice C — semantic baseline

- Only after the exact baseline is stable, generate versioned test embeddings for externally allowed fixture passages.
- Never embed `local_only`, deleted, redacted, or invalidated fixture text.
- Measure semantic recall independently of answer generation.
- Derived test artifacts remain disposable by evaluation run ID.

### Slice D — hybrid and reranking

- Fuse exact/lexical and semantic candidates.
- Add reranking only after recording the hybrid baseline.
- Compare recall, irrelevant-context rate, latency, evidence count, and weighted cost.

### Slice E — bounded generation

- Assemble a typed evidence bundle from the best measured retrieval strategy.
- Generate only where the case budget permits generation.
- Validate every expected answer claim against required citation groups.
- Measure attribution, temporal correctness, contrary-evidence coverage, abstention, injection resistance, and stale/deleted evidence exclusion.

### Deferred channels

- Add selective claims only when a measured query class fails with passage retrieval.
- Add bounded graph expansion only when a relationship or multi-hop class demonstrably needs it.
- Do not add global GraphRAG or a dedicated graph database during this validation.

## Reproducibility and reset

Each run report must include:

- fixture version and content hashes;
- retrieval strategy and version;
- model/embedding/reranker versions when used;
- per-case candidate and selected anchor IDs;
- latency, evidence count, and weighted cost;
- deterministic pass/fail checks;
- invalidated/stale/deleted evidence exclusions;
- reset result for the exact evaluation run ID.

The reset path must support dry-run, list every owned artifact it would remove, reject unmarked records, and be tested against a mixed fixture/non-fixture workspace before execution.

## Account actions blocked pending product decisions

The test account may exercise read-only inventory and isolated benchmark fixtures now. These remain blocked until the product-owner decisions are confirmed:

- production annotation migration;
- event snapshot redaction behavior;
- source deletion cascades;
- persistent rejection fingerprints;
- accepted-AI provenance promotion;
- production local-only inheritance fields.
