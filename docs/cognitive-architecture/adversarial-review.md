# Repository Adversarial Review

Date: October 4, 2026  
Branch reviewed: `codex/play-store-readiness`  
Baseline commit: `1c922d4`

The research brief asked the reviewer to try to disprove seven assumptions before schema design. This review treats the running code as evidence and deliberately looks for migration hazards.

## Executive result

The **canonical record plus rebuildable derived index** direction survives review, but four assumptions require qualification and two fail in their direct form. The architecture can proceed only through compatibility adapters and after the product owner answers the retention, authorship, event, deletion, local-only, uncertainty, endorsement, and redaction questions.

## Evidence from the current repository

- `Media.annotations` stores annotations as array elements inside source documents (`src/lib/types.ts`).
- Annotation mutations rewrite the parent media document (`src/app/noesis-home-page.tsx`).
- Firestore rules permit one-level user subcollections but deny unreviewed deeper writes (`firestore.rules`). A new first-class annotation path therefore needs an explicit rule and migration test.
- `timeline` and `thinkingEvents` are loaded independently (`src/hooks/use-noesis-workspace-data.ts`) and both are still page requirements (`src/lib/noesis-page-definitions.ts`).
- `createTimelineEvent` conditionally mirrors a legacy timeline event into `thinkingEvents`, while other mutations write `thinkingEvents` directly (`src/app/noesis-home-page.tsx`). This is not yet one event stream.
- `thinkingEvents` reads are limited to the newest 200 records (`src/hooks/use-noesis-workspace-data.ts`).
- Thinking events are immutable for production users and may copy complete before/after records (`firestore.rules`, `src/lib/thinkingEvents/writeThinkingEvent.ts`).
- Account deletion recursively deletes the user document tree (`src/app/api/account/delete/route.ts`), but individual object deletion intentionally leaves history and several UI confirmations say related history remains.
- Contextual AI receives bounded arrays of strings and is manually invoked (`src/lib/contextual-ai.ts`, `src/app/api/contextual-ai/route.ts`). It has no evidence-anchor contract or claim-level grounding validator.
- Canonical links use stable endpoint IDs in normal demo and UI flows, but their type excludes unknowns, insights, passages, claims, and regions; links have no evidence anchors or temporal validity (`src/lib/types.ts`).
- Concepts, inquiries, works, practices, and sources still use concept names/tags in several relationship fields, so IDs are not yet the only durable identity mechanism.
- The shell still requests multiple full collections for summary behavior (`NOESIS_SHELL_SUMMARY_REQUIREMENTS` in `src/lib/noesis-page-definitions.ts`), which is a scaling risk before corpus-wide retrieval is added.

## Assumption verdicts

### 1. Firestore can remain canonical through the first four stages

**Verdict: qualified pass.**

Firestore is already the ownership and authorization boundary, supports append-only event rules, user-scoped collections, transactions/batches, and private Storage references. Personal-workspace scale does not yet justify a canonical-store migration.

The assumption fails if interpreted as “Firestore alone must perform every retrieval operation.” Current full-collection listeners, the 200-event cap, no lexical ranking service, and no index job/outbox mean retrieval must sit behind a provider-neutral boundary. Stage 4 global analysis may eventually require a separate search or graph service, but that should remain derived infrastructure.

**Correction:** lock Firestore as canonical for Stages 0–3. Re-evaluate derived search infrastructure at measured scale; do not promise Firestore-only Stage 4.

### 2. Annotations can be normalized without disrupting source workflows

**Verdict: fails as a direct migration; viable with compatibility.**

Annotation cards, source detail, concept derivation, inquiry promotion, and position promotion all read `media.annotations`. Mutations replace the source's annotation array. Moving immediately to `/annotations/{id}` would break existing readers, offline demo data, counts, and parent-document update flows.

**Correction:** use a staged compatibility boundary: stable annotation IDs first; repository adapter second; dual-read/backfill verification third; switch authoritative reads only after parity tests; remove nested copies last. Do not dual-write indefinitely, and do not choose the final path until deletion/export semantics are confirmed.

### 3. `timeline` can safely become a projection of `thinkingEvents`

**Verdict: fails as an immediate replacement; valid as a target state.**

Both collections are live inputs. The legacy timeline has a smaller vocabulary and entity naming (`media`, `vault`, `question`, `draft`) while thinking events use semantic names (`source`, `position`, `inquiry`, `work`). Some timeline events are conditionally mirrored only when metacognition is enabled, while recent core mutation fixes write events directly.

**Correction:** define an event-compatibility adapter and parity report. New meaningful mutations must always emit `thinkingEvents`. Evolution should read a projection from those events plus explicitly marked unmigrated legacy events until backfill coverage is proven. Removal of `timeline` is a separate reversible milestone.

### 4. Existing link types are adequate for canonical links

**Verdict: partially falsified.**

The relationship vocabulary is broad enough for current user-confirmed philosophical links. It is not sufficient as the complete cognitive relation contract because it lacks evidence anchors, validity intervals, review rationale, and endpoints for several future analytical objects. `connectionScore` and `connectionStrength` also risk presenting unsupported strength as authoritative.

**Correction:** preserve the current vocabulary for user-confirmed entity links. Add evidence and temporal capability through a versioned interface later. Candidate relations must have a separate lifecycle and must not reuse canonical strength fields as model confidence.

### 5. Selective claim extraction is sufficient for the initial query set

**Verdict: unproven.**

There is no retrieval evaluation today. The app's existing curated string context cannot establish whether passages alone, selective claims, or mixed representations win for temporal, contradiction, and gap questions.

**Correction:** the 60-case Stage 0 benchmark must be run first against passage-only retrieval. Add selective claims only where a measured query class misses required evidence or cannot preserve scope. Do not make claim extraction universal by assumption.

### 6. A provider-neutral retrieval boundary can be added without redesigning every page

**Verdict: qualified pass.**

AI is already centralized behind `requestContextualAi`, an authenticated API, and a bounded `AiContextEnvelope`. This is a usable seam. However, page components construct free-form memory strings themselves, so adding retrieval directly to those builders would spread evidence policy across the UI.

**Correction:** add a server-side query planner and evidence-bundle interface behind a new read-only service. Existing item-level actions can adapt to it gradually. Pages should supply target identity and user choices, not compose authoritative evidence strings.

### 7. Privacy/export/deletion expectations are compatible with append-only history

**Verdict: disproven until policy and mechanism change.**

Production thinking events are immutable and may contain complete before/after snapshots. Individual deletion leaves history. That conflicts with deleting or correcting sensitive plaintext unless a privileged redaction path, compact semantic diff policy, and tombstone contract exist. Recursive account deletion is not enough.

**Correction:** no permanent-memory schema may ship before decisions 1, 3, 4, 5, and 8 in `product-owner-decisions.md`. Event payload minimization and a server-authorized redaction mechanism are prerequisites, not cleanup work.

## Additional corrections to the research brief

1. **Current AI is bounded, not grounded.** Authentication, quotas, scope checks, and prompt-injection framing exist, but evidence is untyped text and generated claims do not cite exact anchors.
2. **Event completeness improved but is not yet universal.** Core object mutations now write events more consistently, but tag-created concepts and legacy timeline mirroring still include metacognition-dependent paths.
3. **Identity cleanup is broader than annotations.** Concept names/tags remain relationship mechanisms in works, practices, questions, and Atlas-derived logic. Stable IDs need incremental adapters rather than a single migration.
4. **Derived demo artifacts are not architecture evidence.** Demo thinking patterns and AI suggestions are fixtures; they must not be mistaken for a production inference pipeline.
5. **Performance work precedes corpus-wide memory.** Adding indexing to a shell that still loads many full collections would hide rather than solve current data-boundary costs.

## Stop decision

Proceed with Stage 0 contracts and benchmark fixtures only. Do not create production collections for anchors, passages, claims, candidate relations, or syntheses. Do not finalize annotation migration, event redaction, or promotion fields until the product-owner gate is answered.
