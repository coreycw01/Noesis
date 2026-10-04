# Architecture Invariants

These invariants are locked for the cognitive architecture. They are independent of model, provider, search engine, and storage implementation.

1. **Canonical content is user-owned.** Machine derivation never overwrites authored sources, annotations, concepts, inquiries, positions, works, practices, links, or meaningful history.
2. **Derived assertions are disposable.** Every generated passage, claim, relationship, pattern, profile, and synthesis is rebuildable and includes exact evidence and derivation metadata.
3. **Authorship is explicit.** The interface and data contract distinguish user views, source-author views, AI output, and deterministic system computation.
4. **Time is explicit.** Current and historical beliefs cannot be merged by recency heuristics. Supersession and meaningful revisions must be represented.
5. **Evidence is addressable.** A generated substantive claim must identify exact supporting evidence, not only a containing document.
6. **Unsupported output is omitted or qualified.** Insufficient or mixed evidence produces uncertainty or abstention.
7. **Ask Noesis is read-only by default.** It cannot change a canonical record, status, confidence, or link without a separate explicit user-confirmed mutation.
8. **Retrieved content is untrusted.** Source text and notes never gain instruction or tool authority.
9. **Domain history is not optional metacognition.** Meaningful intellectual mutations produce events independently of optional profiles, patterns, and metrics.
10. **Canonical capture remains available without AI.** Indexing and model failures do not block writing, saving, browsing, or exact local lookup.
11. **Derived indexes are replaceable.** Provider, embedding dimensions, chunking, reranking, and graph technology stay behind versioned interfaces.
12. **Privacy actions cross both layers.** Export, deletion, redaction, and processing exclusions account for canonical data, copied event text, storage assets, and all derived representations.

## Stage 0 enforcement

The executable constant in `src/lib/cognitive-architecture.ts` contains the subset that can already be enforced without choosing a production schema. The remaining invariants are acceptance requirements for later milestones and must be converted into tests before those milestones exit.

## Explicit non-goals

Stage 0 does not authorize:

- a production vector index;
- a dedicated graph database;
- full claim atomization;
- automatic belief promotion;
- autonomous memory consolidation;
- retention or deletion defaults;
- a direct removal of nested annotations or `timeline`.
