# Noesis Cognitive Architecture

Status: Stage 0 architecture and evaluation contract  
Governing research brief: `noesis-cognitive-architecture-research-brief.md` (October 4, 2026)

This directory records the repository-specific decisions that must precede any production memory or retrieval schema.

## Current boundary

Noesis currently has canonical user-owned records, typed links, meaningful `thinkingEvents`, and manually invoked contextual AI. It does **not** yet have a corpus-wide cognitive index, exact evidence anchors, hybrid retrieval, claim-level citation validation, or a safe migration path from nested annotations and legacy timeline events.

Stage 0 therefore adds only:

- architecture invariants;
- an adversarial review of the research assumptions against this repository;
- a milestone and rollback plan;
- a synthetic 60-case evaluation contract and validation tests;
- a product-decision gate before any irreversible schema or retention work.

No production index collection, embedding, claim extraction, deletion cascade, or promotion workflow is authorized by this stage.

## Documents

- [Architecture invariants](./architecture-invariants.md)
- [Repository adversarial review](./adversarial-review.md)
- [Milestone plan](./milestone-plan.md)
- [Product-owner decision gate](./product-owner-decisions.md)
- [Test-account validation plan](./test-account-validation.md)
- [Stage 0 lexical baseline](./stage0-lexical-baseline.md)

## Executable Stage 0 artifacts

- `src/lib/cognitive-architecture.ts` defines UI- and storage-neutral benchmark contracts and invariants.
- `tests/fixtures/cognitive-benchmark.ts` contains 60 synthetic questions, exact evidence anchors, and canonical/candidate/semantic relationship fixtures.
- `tests/logic/cognitive-architecture-stage0.test.ts` checks distribution, referential integrity, abstention coverage, attribution boundaries, and the invariant set.

The benchmark uses synthetic content so it can run in CI without reading a real user's intellectual record.
