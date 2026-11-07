# Noesis Experience Completion

Started: 2026-11-06. Status: implementation in progress, not release complete.

Checkpoint: approximately 45% of the full implementation and verification pass.
Commit the current repairs without treating this checkpoint as release signoff.
The Praxis reliability batch below is now implemented and browser checked.
Resume with deeper Atlas, AI, Home, Goals, Profile and Settings workflows,
then full appearance/device checks and the measured performance-budget failure.

## Direction

Noesis is a place to develop a philosophy, not a dashboard to maintain.
Preserve existing user data, domain boundaries, appearance preferences and AI
review requirements. No automatic canonical AI changes. Do not manufacture
relationships, evidence, or confidence from decorative visualizations.

The owner has delegated design decisions. Do not require approval for every
layout choice. Validate decisions through complete working journeys instead.

## Delivery Order

1. Foundation: capture existing routes, shared controls and failure states;
   establish legible type, intentional actions, stable mobile workspaces and
   reliable modal dismissal. Preserve distinctive object workflows.
2. Works: document-first writing, selection and formatting, useful marginal
   context, unobtrusive drawing and visual tools, page handling, undo, autosave,
   keyboard and mobile editing. Preserve old documents and exports.
3. Encounter: Library, Source Index and Annotations. Capture a source, preserve
   attribution, interpret a passage, and deliberately develop an idea from it.
4. Develop: Concepts, Inquiries and Positions. Define, question, ground and
   challenge ideas through actionable workspaces, not redundant forms. Keep
   question, current answer and claim prominent.
5. Act: Praxis exercises, experiments, practices and commitments. Make the
   distinction evident through the task, with understandable setup, logging,
   progress, review and abandonment.
6. Connect and revise: Atlas, Evolution and contextual AI. Relationships must
   be inspectable; history must describe actual changes. AI results must be
   individually reviewable and accepted into useful, persistent destinations.
7. Return and share: Home, Profile and Goals. Make returning useful without
   engagement pressure. Profiles represent actual user thinking and explicit
   public selections. Goals count matching real activity.
8. Finish: Settings, account/privacy, accessibility, loading, empty and error
   states, device layouts, production readiness and release verification.

## Acceptance Per Journey

- Navigate, create, edit, cancel, save, refresh, link and delete/recover.
- Confirm persisted content and provenance, not only success messages.
- Verify keyboard operation, touch scrolling and dialog dismissal.
- Inspect narrow mobile, tablet and desktop; check light and dark themes.
- No offscreen essential actions, clipped text or decorative dead ends.
- Check console/network failures and graceful permission/offline failures.
- Run relevant logic/security tests, lint, typecheck and production build.
- Record implemented versus browser-verified versus live-deployed separately.

## Progress

- Works document flex sizing and writing typography: implemented; inspected in
  desktop and 390px mobile browser viewports.
- Writing focus: opens documents with the paper and ribbon foremost; metadata,
  page settings and context remain reachable by leaving focus. Browser verified.
- Works context starts collapsed unless explicitly expanded: implemented and
  corrected the preference loader that previously defeated the default.
- Rich-text preservation: browser testing revealed the sanitizer discarded
  ribbon formatting. Added a restricted CSS allowlist and two security tests;
  bold survived explicit save and reload in an isolated demo tab.
- Demo work revision writes: repaired missing workRevisions support that blocked
  atomic document saves; added persistence/atomicity regression coverage.
- Multi-page selection: formatting/find/replace target the last selected document
  body. Observed second-page formatting; regression coverage for active-page
  detection now prevents page settings switching to an upcoming page early.
- Ribbons: removed fixed dead height, enabled keyboard button activation and
  moved mobile undo/redo into Edit to prevent right-edge clipping.
- Shared workbench actions visible on mobile: implemented; inspected in the
  practice editor. Workspace tabs support arrow, Home and End keyboard navigation.
- Library Engage now separates Prepare, Sessions and Reflect, preserving each
  activity instead of presenting all three simultaneously. Source capture,
  annotation capture, reflection and AI acceptance await persistence; failed
  saves retain drafts. Browser verified reflection save and source-to-annotation
  navigation. Incorrect seeded source artwork replaced by the existing fallback.
- Annotation detail uses the actual source and creator as context; user thoughts
  are not presented as quotations. Editing and accepted AI notes await saving.
- Concept refinement and accepted AI material await saving; failed refinement
  keeps its input. Entered name casing is preserved by the editor.
- Position editing waits for persistence; confidence history is owned by the
  mutation layer rather than duplicated by the editor. Added revision tests.
- Position creation now returns only after persistence, including source and
  annotation promotion. Source-entered reasoning reaches confidenceReasoning,
  and source connections link every related record instead of silently showing
  four unclickable names. Browser verified creation, refresh, related-record
  navigation and the reasoning destination. Repeated claim text is suppressed;
  update dates are localized. Duplicate clicks are guarded during creation.
- Practice Run and log now records observations directly. Setup requirements
  still gate logging; completed days count unique successful dates. Browser
  verified save, refresh, reopening and dismissal without an input lock.
- Demo persistence supports annotations, work revisions, practice logs, position
  versions, account identity and domain-specific unknown/pattern identifiers.
  Profile save failure found in browser and repaired; success feedback verified.
- Atlas nodes open with one tap, separate from dragging. Mobile full-screen
  canvas and inspector opening/closing were inspected.
- Context Desk no longer silently caps the reported result count at 100. The
  full matching count is shown with incremental display and Show more. Search,
  selection, exact-context review and dismissal were browser verified without
  sending a model request.
- Shared labeled fields now connect Profile, Settings and Practice labels to
  inputs/selects. Added label/id regression tests. Notification dismissal has
  an accessible name and a 44px target, with reserved space for its text.
- Source editor controls and concept-removal buttons are named; browser verified
  Edit source followed by Cancel leaves no dialog or pointer-events lock.
- Demo banner and Profile now share canonical concept exclusions with navigation;
  placeholder/tag-only records do not inflate the displayed concept total.
- Goal settings update local success state after persistence, not before it.
- Explicit inquiry creation (including Home and annotation handoffs) now waits
  for persistence, guards duplicate clicks and retains drafts on failure.
  Annotation promotion preflight remains open on failure. Browser verified a
  question-only inquiry creates, opens and survives refresh. Source ids are no
  longer incorrectly written as annotation evidence ids at creation.
- Explicit concept creation now waits for persistence in Concepts, Atlas and
  the shared Find or create picker. Failed picker creation retains the search.
  The duplicate list/detail concept editor markup is consolidated, labeled and
  height-bounded. Browser verified create/refresh with matching count 27 across
  list, header, banner and navigation in an isolated session.
- Explicit picker-created concepts are user-created records, distinct from
  automatic tag placeholders. Defining an existing automatic placeholder promotes
  it into the canonical concept set. Filtered Concepts totals say matching rather
  than masquerading as whole-workspace totals.
- Home inquiry handoffs preserve typed origin links instead of putting every
  target id into the legacy sourceDocumentId field. Inquiry creation also
  preserves linked practice ids.
- Fourteen main routes passed a 390x844 browser smoke sweep without page-level
  horizontal overflow or generic crash screens. This is not full workflow or
  accessibility certification. Light appearance save and reload verified and
  original dark appearance restored in the isolated demo.

## Verification Record

- Praxis follow-up: planned practices no longer acquire a start date before
  activation. A written intellectual basis satisfies setup; the automatic
  Unsorted Ideas tag does not. Future schedules wait, ended schedules request
  review, and abandoned/integrated records do not demand reviews indefinitely.
- Practice cards separate Today, Needs attention and Ongoing. Progress describes
  completed days rather than a fictitious current day. Multiple observations on
  one day do not inflate completion. Streaks allow today to remain unlogged until
  the day ends. Practice and commitment reminders use local calendar days,
  including daylight-saving boundaries and date-only check-ins.
- Practice saves and AI acceptance await persistence; accepted AI material merges
  only its own patch into an unsaved editor draft. Real provider generation and
  failure recovery still require authenticated verification.
- Practice editor keeps its header, workflow and footer stationary while each
  step scrolls independently. All four steps were checked at 320x740, 390x844,
  and 1280x900 without dialog movement or internal horizontal overflow. Landscape
  at 844x390 now leaves 187px for the form, up from an unusable 40px before the
  layout corrections; all four landscape steps retain identical bounds.
- Browser verified a newly saved plan has no start date; completed setup then
  activates and appears under Today. A saved observation survives reload as one
  completed day and a one-day streak. Closing the editor leaves zero dialogs and
  normal pointer interaction. No console errors in this tested journey.
- Shared attention follow-up: sidebar, Home summaries/recommendations and command
  suggestions use one selector for raw annotations, current positions, open
  inquiries and practice basis. The headline counts distinct records rather than
  adding overlapping categories. Closed/suspended records no longer repeatedly
  request development. A practice may be anchored by its written purpose or an
  inquiry, concept, source or position; a position is not mandatory. Promoted
  annotations do not remain in the raw queue. Stable-id duplicate inputs count
  once; this does not delete or merge persisted user records.
- Browser verified attention remains 14 across Today, Library and Atlas in the
  same isolated workspace, including the new practice with a written basis.
  The category dialog explicitly explains overlap. No console errors observed.
  Mobile Atlas zoom, inspector close and full-screen exit were exercised; this
  does not sign off every graph layout or relationship-editing path.
- Logic: 120 tests pass. Security: 15 tests pass.
- Typecheck: passes. Lint: no errors, 29 existing warnings (hooks, images, fonts).
- Production build: passes using .next-build-readiness, isolated from preview.
  A restricted Windows run first failed to create a generated folder; rerunning
  with normal folder access succeeded. The latest isolated build after the inquiry
  and concept creation repairs also passed. No release rollout has been performed.
- Preview: http://localhost:9096/demo/works/d_agency_notes/.
- Deployment: none for this pass. No production records or sharing choices changed.
- The performance audit was unable to read the current Next build format. It now
  reads the available build manifest and terminated client-reference JSON, and
  includes shared initial runtime assets. A regression fixture prevents silent
  omission of that runtime. The current build reports 664 KB uncompressed for
  initial referenced assets, above the existing 400/450 KB budgets. This is a
  measured budget failure, not a measured user-perceived load-time regression;
  deferred app chunks and real-network timings require separate measurement.
- Browser evidence is saved under artifacts/experience-qa (local QA only).

## Still To Verify

All eight stages remain subject to the complete acceptance list above. Earlier
feature completion claims do not prove these checks passed. In particular:

- Automatic tag-placeholder creation and older unexercised promotion callbacks
  still need a contract review. Explicit source/annotation position promotion,
  inquiry creation and concept creation have been repaired; that does not prove
  every indirect mutation path has been exercised.
- Physical phone keyboard/drawing/camera, authenticated Firestore permissions,
  actual provider AI generation and offline recovery are not browser-demo proofs.
- Full export/import round trips, deletion/recovery, every appearance palette,
  every advanced inquiry branch and all public profile combinations need their
  own checks. Home, Goals, Evolution and Source Index have smoke coverage, not
  comprehensive end-to-end signoff.

## Scope Guardrails

Do not replace useful existing capabilities with attractive nonfunctional
mockups. Avoid adding novel features until the core workflow has earned them.
Do not deploy migrations, discard records, change public visibility, or claim
Play Store readiness without the corresponding verification.
