# Noesis Product Direction

Last reviewed: 28 October 2026

This document is the broader product source of truth for Noesis. The concise mission and architectural principles remain in [blueprint.md](./blueprint.md). Technical requirements for accepted AI provenance remain in `Noesis AI Provenance Implementation Handoff.docx` and take precedence when implementation details differ from this overview.

## Decision status

- **Current:** implemented product behavior or an established architectural invariant.
- **Approved:** a product decision that implementation should follow.
- **Confirmed repair:** observed product friction approved for correction.
- **Planned:** a direction that still needs a dedicated implementation specification.
- **Exploratory:** an idea that must not be treated as approved implementation scope.

## Mission

Noesis turns thought into understanding. It helps a person develop, examine, test, express, and revise thinking without losing the path that produced it.

Noesis is not primarily a note-taking or storage product. Persistent records matter because they let the user inspect intellectual development over time. The differentiator is how Noesis helps the user reason with those records while preserving authorship, uncertainty, and history.

The governing principle is:

> The user owns the knowledge system. Noesis helps the user examine it.

## Core intellectual cycle

**Approved:**

> Encounter -> Question -> Claim -> Praxis -> Revise

- **Encounter:** Sources and Annotations preserve what the user encountered and how it was interpreted.
- **Question:** Concepts clarify recurring vocabulary; Inquiries organize uncertainty and investigation.
- **Claim:** Positions state claims the user is prepared to examine, challenge, and revise.
- **Praxis:** Labs, Practices, and Commitments bring thought into deliberate action.
- **Revise:** Evolution records consequential intellectual change.

Works, Atlas, and Noesis AI are cross-cutting capabilities rather than additional stages. Works express and synthesize thought. Atlas reveals relationships in the system. Noesis AI assists with bounded understanding, examination, and exploration.

## Navigation

**Approved current structure:**

```text
NEED ATTENTION

TODAY
  Home

ENCOUNTER
  Library
  Annotations

QUESTION
  Concepts
  Inquiries

CLAIM
  Positions

PRAXIS
  Labs
  Practices
  Commitments

REVISE
  Evolution

MORE
  Atlas
  Works
  Noesis AI
  Settings
```

Need Attention remains above Home and acts as triage for records requiring judgment or action. It is not interchangeable with AI Signals.

Atlas, Works, Noesis AI, and Settings remain under More until usage testing supports a better grouping. Annotations remain top-level. Moving Annotations into Library is an unapproved direction, not current implementation scope. Source Index is already part of the Library experience even where a direct route remains available.

## Praxis

**Approved:** Praxis replaces Test as the user-facing stage name.

> Put your thinking into practice through experiments, practices, and commitments.

The three object roles remain distinct:

- **Lab:** something the user is trying to find out through a bounded experiment.
- **Practice:** something the user repeatedly does to cultivate, explore, embody, or test an idea.
- **Commitment:** a principle, promise, standard, constraint, or decision the user has chosen to uphold.

These objects may relate to the same Position without becoming interchangeable records.

## Noesis AI

### Interaction model

**Approved:** contextual assistance uses three behavioral categories.

1. **Understand:** summarize or explain what is already present.
2. **Examine:** analyze, challenge, compare, or stress-test the selected material.
3. **Explore:** think through a user question using bounded selected context.

Actions should use object-specific language. A Source may offer Summarize Source and Analyze Source. A Position should use Stress Test Position rather than a vague generic analysis label.

Every action remains manually invoked, item-first, bounded, reviewable, and non-blocking. AI never silently changes canonical content, status, confidence, or relationships.

### Context Desk

**Current:** the user deliberately chooses which records Noesis may consider. Accepted findings become a user-owned Work.

**Confirmed repairs:**

- Source exclusions must use searchable multi-select rather than a long dropdown.
- Review Context must remain readily accessible in a sticky action area.
- Review Context opens an inspectable summary of included and excluded records.
- The user sees the exact bounded selection before running contextual assistance.

### Signals

**Planned:** Signals are investigations initiated from patterns Noesis notices across the knowledge system.

Signals may propose support, contradiction, refinement, dependency, shared assumptions, missing distinctions, or relevant uncaptured relationships. They must explain why a candidate was surfaced and cite contributing records.

AI proposes relationships; the user confirms the graph. A possible tension does not become a canonical contradiction without confirmation. Unresolved Signals may appear in Need Attention, but Need Attention remains a broader triage system.

## AI provenance

**Approved and required:** accepted AI material remains visibly and persistently distinguishable at the smallest meaningful field or sub-record.

**Current partial behavior:** accepted assistance creates an AI-assisted history event, but the complete atomic field-level provenance model, deletion tombstones, promotion chains, and representative badges remain confirmed repair work. This document does not describe those repairs as complete.

- **AI-assisted:** AI proposed material that the user reviewed, edited if desired, and accepted.
- **AI suggestion:** provisional material that has not entered canonical data.
- **AI-generated:** material inserted automatically without user review. Noesis must not use this path for canonical records.

Accepted canonical wording is user-owned while its AI origin remains traceable. Later manual edits add user revision history without erasing original provenance.

The shared implementation model uses `AiProvenanceRecord`, `ProvenanceRef`, and field-level targets. It must not be replaced with scattered `isAI` booleans. Destination mutation, provenance creation, and the corresponding thinking event must be atomic and idempotent.

The provenance handoff defines field coverage, redaction, deletion tombstones, promotion chains, accessibility, security, migration, and verification requirements.

## Concept development

**Approved direction:** describe Concept maturity as integration, not truth or strength.

Useful dimensions include connectivity, diversity of object types, evidence depth, development of the definition, and use in Inquiries, Positions, Works, or Praxis. Names such as Emerging, Developing, Established, and Deeply Integrated are suitable starting language.

**Planned:** exact thresholds and scoring require a separate specification. Raw link totals must not imply that a Concept is true or well supported.

## Confirmed repair backlog

1. Searchable Context Desk source exclusions with removable selected-source chips.
2. Sticky Context Desk selection summary and Review Context action.
3. Review Context summary dialog covering included and excluded records by type.
4. Mobile floating create control shown only on Home; mobile navigation remains persistent.
5. User-facing Test stage renamed Praxis with explanatory copy.
6. Atomic, idempotent AI provenance with field-level references, thinking events, and accessible badges.
7. Provenance preserved through normal edits, promotion, deletion tombstones, Evolution, search, Atlas, and representative list/detail views.

## Roadmap

### Near-term

- Finish the confirmed repair backlog.
- Clarify contextual action names according to Understand, Examine, and Explore.
- Define Signal confirmation and dismissal semantics before building background discovery.

### Planned but not specified

- Signals discovery and investigation.
- Concept integration scoring.
- User-facing AI usage reporting and background-analysis controls.
- Advanced Source intelligence grounded in the user's own records.

### Exploratory only

- Premium pricing or usage purchases.
- Free, Premium, and Pro packaging.
- Thought and vocabulary games.
- Personalized exercises, learning packs, and guided programs.
- Daily Thought placement.
- Monthly or annual intellectual reviews.
- Expert-created packs or marketplaces.

Exploratory ideas must not introduce prices, quotas, navigation, entitlement checks, or data restrictions without a separately approved product specification.

## Monetization principle

> Do not charge users to own their thinking. Charge for Noesis helping them understand it.

Capture, organization, personal records, and export should not become hostile retention mechanisms. Potential paid value comes from deeper analysis, discovery, challenge, personalization, automation, and advanced research assistance.

## Product invariants

- Canonical content is user-owned.
- Derived assertions remain disposable and evidence-backed.
- Authorship, time, evidence, and uncertainty remain explicit.
- AI does not block capture, saving, browsing, or exact local lookup.
- Meaningful mutations create factual thinking events; routine interface activity does not.
- Deletion, export, redaction, and processing exclusions apply to canonical and derived layers.
- Noesis never equates saving a source with agreeing with its author.

## Change log

### 28 October 2026

- Established this document as the broader product-direction source of truth.
- Approved Praxis as the user-facing stage term.
- Kept Atlas, Works, Noesis AI, and Settings under More pending usage testing.
- Classified Context Desk, mobile create, and AI provenance issues as confirmed repairs.
- Kept monetization, games, recaps, Signals frequency, and exact maturity scoring outside approved implementation scope.
