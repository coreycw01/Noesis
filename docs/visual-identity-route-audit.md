# Noesis Visual Identity Route Audit

This record accompanies the visual identity implementation. It names each route's intellectual job so future UI work can reuse the shared grammar without collapsing every page into the same card grid.

## Shared grammar

- Editorial typography, horizontal rules, restrained rose accents, and quiet metadata establish the common Noesis voice.
- `PageHeader` provides a route role, margin marker, reading-width title block, action edge, and closing rule.
- `WorkbenchFlow` is a thought spine: a compact mobile selector and a visible desktop progression.
- `EditorialSection`, `ContextRail`, `EntityMeta`, `EvidenceRow`, `RelationshipList`, and `RevisionEvent` are the preferred semantic structures.
- Cards remain appropriate for individually selectable records, dialogs, and genuinely contained tools. Page sections and reasoning sequences use continuous layouts.

## Route identities

| Route | Intellectual job | Spatial identity | Primary motif |
| --- | --- | --- | --- |
| Home | Orient the next act of thinking | Editorial desk | Ordered recommendations |
| Atlas | Explore relationships | Full network field with inspector | Nodes, typed edges, regions |
| Concepts | Define and delimit ideas | Encyclopedia index and entry | Definitions, aliases, boundaries |
| Inquiries | Investigate an open question | Investigation desk with context rail | Question, frame, evidence, provisional answer |
| Library | Study a source | Research record | Citation, source context, annotations |
| Source Index | Export and review sources | Citation ledger | Bibliographic rows |
| Annotations | Revisit marginal thinking | Marginalia index | Source excerpt and consequence |
| Positions | Examine a claim | Claim dossier with evidence rail | Confidence, support, objection, revision |
| Works | Compose and express | Studio and document surface | Pages, tools, revisions |
| Labs | Test ideas in life | Experiment log | Setup, action, observation, result |
| Evolution | Trace change over time | Chronology | Revision spine and event history |
| Commitments | Connect intention to action | Commitment ledger | Target, focus, observed progress |
| Profile | Present a philosophy | Intellectual portrait | Identity, worldview, selected public record |
| Settings | Configure behavior | Quiet utility form | Grouped controls and save feedback |

## Baseline problems corrected

- Repeated rounded cards and pill badges made unrelated routes share the same silhouette.
- Page titles and actions did not consistently occupy a recognizable reading hierarchy.
- Workbench stages looked like navigation chips instead of an intellectual process.
- Position and inquiry detail views presented reasoning as dashboard widgets rather than an argument or investigation.
- Atlas carried decorative framing around the network field.
- Evolution mixed chronology with card-grid summaries.
- Violet was the default accent even though restrained rose is the product's semantic identity color.

## Verification checklist

- [x] Shared header hierarchy and route roles
- [x] Thought-spine workflow navigation
- [x] Semantic editorial primitives
- [x] Inquiry investigation silhouette
- [x] Position examination silhouette and revision history
- [x] Atlas network-field identity
- [x] Evolution chronology identity
- [x] Works studio identity
- [x] Route identities for Concepts, Library, Source Index, Annotations, Labs, Commitments, Profile, and Settings
- [x] Mobile collapse rules for context rails and semantic rows
- [x] Theme-safe semantic colors and restrained rose default
- [ ] Authenticated production screenshot comparison after deployment

The final unchecked item requires the deployed authenticated build. It should compare desktop and mobile examples of Home, Atlas, Concept detail, Inquiry detail, Source detail, Position detail, Works, Labs, and Evolution.
