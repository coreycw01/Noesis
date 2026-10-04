# Product-Owner Decision Gate

These choices block the production schema because they determine ownership, correction, deletion, and privacy semantics. Recommendations are evidence-based defaults, not silently selected implementation decisions.

## D1 — What remains after rejecting an AI inference?

**Plain-language choice:** Should Noesis remember enough to avoid making the same bad suggestion again, or erase the rejection entirely?

- Option A: erase everything;
- Option B: retain only a private fingerprint, decision, and optional reason;
- Option C: retain the full rejected wording and audit trail.

**Recommendation:** B. It supports correction recurrence tests while minimizing retained sensitive prose.

## D2 — Who authored accepted AI wording?

**Plain-language choice:** If AI drafts wording and the user edits and accepts it, should the final text count as the user's writing while the original remains visible as provenance?

**Recommendation:** Yes. The edited canonical text is user-authored; generated precursor, model, and evidence stay as provenance only.

## D3 — What belongs permanently in intellectual history?

**Plain-language choice:** Which actions are meaningful enough to appear in Evolution and long-term memory?

**Recommendation:** include creation/deletion, explicit accept/reject, material revision, belief-status or confidence change, relationship confirmation/removal, inquiry resolution/reopening, and completed practice outcomes. Exclude navigation, formatting, filter changes, and transient UI operations.

## D4 — What happens when a cited source is deleted?

**Plain-language choice:** Should dependent user ideas be deleted, preserved but detached, or retained with a source tombstone?

**Recommendation:** remove private source text and its derived index; preserve user-authored objects; mark dependent evidence/inferences unsupported; keep only a non-sensitive tombstone when necessary to explain the broken support.

## D5 — Can content be local/searchable but never sent to an external model?

**Recommendation:** Yes. Add an explicit per-object processing policy inherited by revisions, anchors, passages, and derivations. Local exact search remains available.

## D6 — How visible should uncertainty be?

**Recommendation:** show a short ordinary-language qualifier in the answer. Put evidence strength, contrary evidence, retrieval path, and model diagnostics in an inspectable detail surface.

## D7 — Does saving or annotating a source imply agreement?

**Recommendation:** Never. Source-author claims remain source-author claims until the user explicitly authors or accepts a position.

## D8 — Can old history keep sensitive text after correction or deletion?

**Recommendation:** No automatic permanence for private plaintext. Preserve a narrow non-sensitive tombstone or semantic change marker where history continuity matters; allow privileged redaction of copied snapshots and derived artifacts.

## Decision response format

The product owner can approve all recommendations or provide changes using:

```text
D1: A/B/C (and reason if desired)
D2: approve/change
D3: approve/change
D4: approve/change
D5: approve/change
D6: approve/change
D7: approve/change
D8: approve/change
```

Until these answers are recorded, do not finalize retention fields, deletion cascades, annotation authority switching, event redaction behavior, or AI-output promotion workflows.
