# Noesis design system

The audit, the taxonomy, the tokens, the detail-page template and the plan,
in that order. Counts below were measured on `claude/workbench-instruments`
at the start of the refactor and are rechecked at the end of each phase.

## 1. Inventory of inconsistencies

| Area | What was measured | Finding |
| --- | --- | --- |
| Buttons | 200 raw `<button>` vs 52 `<Button>` imports | Four parallel button systems: `ui/button` (cva, uppercase mono), `.noesis-record-tool` (serif, 36px), `.noesis-back-link`, and ~90 one-off Tailwind strings (`underline`, `text-xs hover:text-accent`, `rounded-full border border-[hsl(var(--stage-examine))] ...`). No shared tertiary/link or icon-only primitive, so every page writes its own. |
| Pills / badges | 26 `<Badge>` uses; 100 distinct `rounded-full … border` class strings | Pills are hand-rolled per page (`noesis-tag-chip`, `noesis-territory__chip`, `noesis-tray__chip`, `noesis-relations__chip`, `noesis-loop__badge`, `StageBadge`, plus Tailwind). They mix tag, filter, status and stage meanings with the same look, and set colours directly. |
| Colour | 80 hex literals in TSX, 66 Tailwind palette classes (`bg-red-500`, `text-emerald-600`…), 12 `.noesis-*` chips with their own tints | There is a stage palette (`--stage-*`) but no semantic set: success/warning/danger/info are improvised per page (Atlas uses green/amber/red hexes, Concepts uses Tailwind amber/emerald, prototype uses `--green/--yellow/--red`). `--destructive` is the only semantic token that exists. |
| Eyebrow / section labels | 12 distinct `font-code text-[8–10px] uppercase tracking-*` recipes, 350+ occurrences | Same semantic (a small caps label) in 12 sizes and 6 trackings. Should be one `.noesis-label` with two sizes. |
| Form controls | 42 raw `<input>` vs 101 `<Input>`; 22 raw `<select>` vs 21 `<Select>`; 3 distinct raw input class strings | Search fields and inline selects bypass `ui/input` and `ui/select`, so focus rings, heights and disabled states differ (28px/36px/44px). |
| Tabs | `WorkspaceTabs` (7 files), `ui/tabs` (1), handmade `role="tablist"` (2), `WorkbenchFlow` (4) | Four tab implementations. `WorkbenchFlow` (numbered rings) is being retired by the approved prototype. |
| Overlays | 20 `DialogContent`, 3 `SheetContent`, 1 `AlertDialog`, 12 `ConfirmActionDialog`, 4 custom `fixed inset-0`, 3 `window.confirm` | Three ways to confirm a destructive action (ConfirmActionDialog, AlertDialog, window.confirm) and four hand-built overlays. |
| Cards / panels | 17 `<Card>`; 119 distinct `rounded-(2xl|xl) border …` strings; `WorkbenchPanel` with its own header grammar | Cards are mostly Tailwind one-offs. Radii used: `rounded-full`, `2xl`, `xl`, `lg`, `md`, `sm`, and bracket values; tokens define only `--card-radius` and `--button-radius`. |
| Detail pages | 10 detail surfaces, 4 anatomies | Position/Inquiry/Concept use `RecordTools`+`WorkbenchFlow`+`RecordFooter`; Praxis uses a partial version; Source and Annotation use `PageHeader` only; Work (Atelier) has its own editor chrome; Goals uses `WorkspaceTabs`. Back links, titles (`noesis-page-title` with 3 different size recipes) and metadata placement differ per page. |
| Workflows | Add / link / remove / revise flows | "Add evidence", "Add support", "Link concept", "Remove" appear with different wording, placement (toolbar vs inline vs footer) and feedback (toast in 21 files, inline text elsewhere, none in some). |
| States | 18 files use `PageState`; 8 distinct "No X yet." strings inline | Page-level empty/loading/error states are shared; section-level empties are ad hoc and unstyled. |
| Stage tone | 27 files use `data-stage-tone` | Good: this is the one consistent mechanism. It becomes the backbone of the semantic colour system rather than being replaced. |
| Accessibility | Touch targets forced via `max-sm:min-h-11` on `Button` only | Raw buttons and chips are 24–32px on phones. Focus styles are present on `ui/*` and `.noesis-record-tool`, absent on most Tailwind one-offs. |

### Semantic duplicates vs genuine distinctions

Consolidated (same meaning, different look):
- `noesis-record-tool`, `ui/button[secondary]`, back-link, inline underline buttons → one `Button` with a hierarchy.
- `noesis-tag-chip`, `noesis-territory__chip`, `noesis-tray__chip`, `noesis-relations__chip`, Tailwind pills → `Pill` (interactive: filter/toggle/choice) and `Badge` (read-only: status/kind/count).
- 12 eyebrow recipes → `Label` (`.noesis-label`, sizes `sm`/`md`).
- 3 confirm mechanisms → `ConfirmActionDialog`.
- Raw `<input>`/`<select>` → `ui/input`, `ui/select`, plus a `SearchField` built on `Input`.
- 119 card strings → `Panel` (`.noesis-panel`) with `tone` and `inset` options; `WorkbenchPanel` becomes a `Panel` with a header slot.

Kept distinct (different meaning), and named so:
- **Stage tone** (which part of the loop you are in) vs **semantic status** (good/caution/problem/neutral). A position is `claim`-toned; its "contested" status is `warning`. These never share a token.
- **Pill** (you can press it; it filters, toggles or chooses) vs **Badge** (tells you something; never pressable).
- **Instrument** surfaces (scale, caliper, gauge, day-strip, ember) keep their own drawing styles; they share the panel, label and colour tokens but not component code.
- **Path bar** (one-page flow with named stops) vs **tabs** (switch between unrelated views). Detail pages use the path bar; index pages use tabs.

## 2. Component taxonomy

```
tokens            theme.css        colour, type, space, radius, shadow, motion
primitives        ui/              Button, IconButton, Pill, Badge, Label, Input,
                                   Textarea, Select, Switch, Checkbox, Panel,
                                   Dialog, Sheet, Tooltip, Toast, Skeleton
composites        shared/          PageHeader, SearchField, FilterToolbar, WorkspaceTabs,
                                   ConfirmActionDialog, PageState (empty/loading/error),
                                   SectionEmpty, StageBadge (= Badge tone=stage)
record anatomy    shared/record/   RecordPage, RecordHeader, RecordPath (sticky stops),
                                   RecordSection, RecordTools, NextMove, SuggestionCard,
                                   RecordFooter, FooterSection
instruments       <feature>/       InquiryBalance (beam/springs/meter), ConfidenceEmber,
                                   ConceptBoundaryBench, PraxisInstrument, MarkupSurface
pages             pages/, <feature>/  compose the above; own no styling of their own
```

Rules:
1. Pages import primitives and composites; they do not define `rounded-*`, hex colours, or label recipes.
2. A new visual appears first as a token or primitive, then is used.
3. Instrument CSS lives next to the instrument and uses tokens only.

## 3. Design tokens (theme.css)

Colour, all HSL triplets consumed as `hsl(var(--x) / a)`:

| Token | Meaning |
| --- | --- |
| `--background`, `--foreground`, `--card`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring` | surfaces and ink (existing) |
| `--accent` | the page's current stage colour, set by `data-stage-tone` (existing) |
| `--stage-encounter/examine/claim/act/integrate/outline/more` | where in the loop (existing; Outline added) |
| `--ok`, `--caution`, `--problem`, `--info`, `--neutral` | semantic status (new). Fits/Same-as = ok; Edge/Not-the-same = caution; Doesn't fit/Opposed = problem |
| `--kind-source`, `--kind-work`, `--kind-position`, `--kind-practice`, `--kind-concept`, `--kind-inquiry`, `--kind-annotation` | what kind of record something is (new; aliased to stage colours so "Evidence = sources colour" is one place) |
| `--destructive` | kept as alias of `--problem` |

Type: `--font-heading` (Playfair), `--font-body` (Spectral), `--font-interface` (Inter), `--font-code` (JetBrains). Scale: `--text-label-sm: 9px`, `--text-label: 10px`, `--text-sm: .875rem`, `--text-base: 1rem`, `--text-lg: 1.125rem`, `--text-title: clamp(1.75rem, 3vw, 2.5rem)`.

Space: `--space-1..8` = 4, 8, 12, 16, 24, 32, 48, 64px. Page gutter `--page-gutter` (existing).

Radius: `--radius-sm: 6px` (inputs, inner rows), `--radius-md: 12px` (panels; = `--card-radius`), `--radius-lg: 18px` (dialogs, instruments), `--radius-pill: 999px`.

Shadow: `--shadow-card`, `--shadow-elevated` (existing). Motion: `--motion-quick`, `--motion-calm`, `--ease-noesis` (existing); all transitions off under `prefers-reduced-motion`.

Sizing: `--control-h: 36px`, `--control-h-sm: 28px`, `--touch-min: 44px` (applied at `max-sm`).

## 4. Shared detail-page template

```
RecordPage                                  max-width 72rem, gutter --page-gutter
├─ RecordHeader
│   ├─ back link (tertiary button, stage-toned)   "Positions" / "Inquiries" / …
│   ├─ DetailLabel  (kind · status Badge · updated)
│   ├─ title  (.noesis-page-title, one size recipe)
│   └─ primary tools (RecordTools: 1 primary + ≤3 secondary, overflow in menu)
├─ RecordPath  (sticky; named stops; "You are here" from state; no numbers)
├─ RecordSection × n   (title, optional Label, body; tools live INSIDE the section they act on)
│   └─ instrument where the record has one
├─ SuggestionCard × 0–2  (only when the app has a specific suggestion)
└─ RecordFooter
    └─ FooterSection (Relations, History, Provenance, Danger zone) — collapsed
```

Stops per record (from the approved prototype):
- Inquiry: Question → Answers → Evidence → Scale → Working answer
- Position: Claim → Grounds → Confidence → Challenges → Revision
- Concept: Definition → Boundary → Relations → Where it stands
- Praxis: Action → Instrument → Review → Carry forward
- Annotation: Passage → Marks → Move down the pipeline
- Source / Work: Overview → Content → Annotations/Marks → Related

Workflow grammar (same on every page): **Add** opens an inline form inside the section; **Pull from workspace** opens the search+filter picker; **Remove** is a tertiary "×" with a one-line undo toast, no dialog; **Delete the record** lives only in the footer Danger zone behind `ConfirmActionDialog`; successful saves show the inline "Saved" tick, not a toast.

## 5. Phased plan

| Phase | Scope | Done when |
| --- | --- | --- |
| 1 Tokens + primitives | semantic colour tokens; Label; Button hierarchy (primary/secondary/tertiary/destructive/icon); Pill; Badge (tone: stage/status/kind); Panel; SearchField; SectionEmpty. Retire `.noesis-record-tool`, `noesis-*__chip`, 12 label recipes. | typecheck/lint pass; primitives documented here; `/demo` renders |
| 2 Record anatomy | RecordPage/Header/Path/Section/SuggestionCard; retire WorkbenchFlow | Inquiry + Position rebuilt on it 1:1 with the prototype |
| 3 Remaining records | Concept, Praxis (+Commitments folded, `/goals` redirect), Annotation markup, Source, Work header | each at parity with prototype or template |
| 4 Index pages + shell | FilterToolbar, WorkspaceTabs, cards, Loop dock, Home desk, Atlas/Evolution chrome, Settings, Exercises games | no page defines its own pill/button/label |
| 5 Sweep | hex/palette classes → tokens; raw inputs → ui; confirm → dialog; touch targets; focus; reduced motion; 200% zoom; high contrast; screenshots desktop+phone | counts in §1 at zero or justified |

## 6. Screen checklist

Updated at the end of each phase. ✓ = on the system, ◐ = partly, ✗ = not yet.

| Screen | P1 tokens | P2–3 anatomy | P4 chrome | P5 sweep |
| --- | --- | --- | --- | --- |
| Home / desk | ✗ | – | ✗ | ✗ |
| Library index / Source detail | ✗ | ✗ | ✗ | ✗ |
| Annotations index / detail | ✗ | ✗ | ✗ | ✗ |
| Works index / editor | ✗ | ✗ | ✗ | ✗ |
| Concepts index / detail | ✗ | ✗ | ✗ | ✗ |
| Inquiries index / detail | ✗ | ✗ | ✗ | ✗ |
| Positions index / detail | ✗ | ✗ | ✗ | ✗ |
| Praxis index / detail (+goals) | ✗ | ✗ | ✗ | ✗ |
| Exercises | ✗ | – | ✗ | ✗ |
| Atlas | ✗ | – | ✗ | ✗ |
| Evolution | ✗ | – | ✗ | ✗ |
| Context desk | ✗ | – | ✗ | ✗ |
| Profile / Settings | ✗ | – | ✗ | ✗ |
| Shell / nav / Loop dock | ✗ | – | ✗ | ✗ |
