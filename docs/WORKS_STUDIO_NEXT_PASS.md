# Works Studio and Mobile Optimization Next Pass

## Purpose

Use this brief for the next Noesis test-build implementation pass. It covers app-wide mobile quality, every item workbench, contextual AI, Labs, Atlas, and Works Studio. This document records requested changes and implementation decisions only; the app was not modified as part of creating it.

Starting point:

- Branch: `codex/fix-firebase-runtime`
- Commit: `8d2fe9d` (`Fix mobile navigation and modal recovery`)

## Requested Direction

### 1. Keep Both Ribbons Aligned

- Keep the drawing ribbon in the same position and alignment as the writing ribbon.
- Switching between writing and drawing must not move the toolbar to the left or cause the document to shift.
- Both modes should use the same toolbar container, width, spacing, and responsive behavior.
- The mode switch should change the available controls inside the stable ribbon rather than replacing the ribbon with a differently aligned layout.

### 2. Replace Worksheet-Like Tool

The current thinking tools still resemble worksheets or long embedded forms. Replace that presentation with visual desktop-style tool windows.

Each inserted tool should:

- Open as a floating overlay above the document.
- Use a thin, faint window frame that does not visually overpower the page.
- Allow an even quieter frameless state where the boundary is effectively invisible until the user selects the tool or touches a corner.
- Reveal resize corners and essential window controls on hover, focus, selection, or touch.
- Use a restrained title or handle area and a recognizable tool identity without resembling a heavy application dialog.
- Be draggable within the document workspace.
- Be resizable from its corners. Resize affordances should be subtle at rest and unmistakable during interaction.
- Remain functional at every supported size.
- Support minimize, close, and restore actions where appropriate.
- Preserve its position, dimensions, and content when the Work is saved and reopened.
- Avoid creating another horizontal scrollbar or forcing the document canvas wider.

Examples include mind maps, timelines, Venn diagrams, graphs, tables, and other visual thinking tools. Their content should remain visually distinct instead of becoming variations of the same worksheet panel.

### 3. Document Interaction

- Floating tools should behave like windows on a computer while remaining associated with the current Work.
- A selected window should rise above other tool windows without covering the main ribbon.
- Moving or resizing a window must not trigger text selection, page navigation, or accidental document edits.
- Selecting a tool should reveal its faint boundary and resize corners; deselecting it should return the frame to its quiet or invisible state.
- Users should still be able to type or draw on the document around the windows.
- Provide a clear way to reopen a minimized tool from the page/tool navigator.
- Ensure autosave does not repeatedly fire while a window is actively moving; persist the final state after the interaction ends.

### 4. Make Drawing Tools as Detailed as Writing Tools

The drawing mode should have the same level of care, hierarchy, and control as the writing ribbon. It should not present several names that all produce the same generic stroke.

Provide clearly differentiated utensils, including:

- **Normal pen:** a clean, consistent writing stroke with controlled pressure variation.
- **Calligraphy pen:** an angled nib with direction-sensitive width and a visibly different written character.
- **Marker:** an opaque, broad stroke with firmer edges and heavier coverage.
- **Highlighter:** a translucent broad stroke that layers color without obscuring text beneath it.

Each utensil should have an appropriate subset of controls rather than one generic control set:

- Stroke size, with presets suited to the selected utensil.
- Color swatches and a custom color option.
- Opacity where it makes sense, especially for the highlighter and marker.
- Pressure response or simulated pressure behavior for pen and calligraphy tools.
- Nib angle for calligraphy.
- Edge softness or hardness for marker-like tools.
- A small live stroke preview so the user can see the selected utensil before drawing.

The drawing ribbon should group prominent actions directly and place secondary settings in compact menus. Switching utensils must visibly change the cursor or preview, the rendered stroke, and the controls shown. Drawing data must retain utensil type and stroke attributes after save, reload, export, undo, and redo.

### 5. Mobile Behavior

Desktop-style dragging and resizing should not be forced into an unusable mobile interaction.

- On mobile, open a tool in a stable full-width panel or focused overlay.
- Keep the title and controls fixed while the tool content scrolls internally.
- Provide explicit Done, Minimize, and Close controls with adequate tap targets.
- Preserve the same tool data between desktop and mobile layouts.
- Do not allow tool overlays to cover the mobile navigation or become trapped off-screen.
- On touch devices, selecting an overlay should reveal large enough corner handles to resize it without making those handles permanently prominent.

### 6. Remove Studio Context

- Remove **Studio Context** from the Works interface.
- It duplicates the purpose or information already represented by **Studio Reel** and does not need a separate surface.
- Preserve any unique user data currently stored under Studio Context by merging it into the appropriate existing Studio Reel or Work metadata field before removing the UI.
- Do not leave an empty tab, navigation item, heading, or unused persistence path behind.

## App-Wide Mobile Optimization

This is not a narrow responsive-CSS cleanup. Audit and optimize every page so Noesis feels intentionally designed as a native mobile application. Do not hide broken structures or remove essential capabilities merely to make a screen fit.

### 7. Audit Every Mobile Route

Review all list pages, detail pages, workbenches, editors, overlays, dialogs, filters, and settings at realistic phone widths. The audit must include:

- Home
- Library and source details
- Annotations and annotation details
- Concepts and concept details
- Inquiries and inquiry details
- Positions and position details
- Labs, practices, and practice details
- Commitments and goals
- Works, the Works hub, and the complete studio
- Atlas map, regions, connections, and review
- Evolution
- Profile and public-profile controls
- Settings

For every route, verify navigation, hierarchy, spacing, typography, touch targets, keyboard behavior, safe-area padding, scrolling, dialogs, menus, search, filters, creation, editing, deletion, saving, and empty/error/loading states.

No mobile page should depend on desktop hover behavior, render controls off-screen, require horizontal page scrolling, or use a desktop layout merely compressed into a narrow viewport.

#### Phone-First Layout Contract

Design and verify the mobile experience for someone who primarily uses Noesis from a phone throughout the day. Mobile is a complete product surface, not a reduced companion.

- Support a minimum width of 360px without page-level horizontal scrolling.
- Keep all primary controls, menus, dialogs, editors, canvases, and workbench content within the visual viewport and safe areas.
- Use touch targets of at least 44px, with 48px preferred for primary and destructive controls.
- Place form labels and prompts above their controls. Do not compress a prompt and text field into narrow side-by-side columns.
- Use full-width, auto-growing text areas with a bounded maximum height and internal scrolling only after that height is reached.
- Keep the active field and its Save or Continue action visible when the software keyboard opens.
- Use a sticky primary action when a long workflow would otherwise force repeated scrolling.
- Move secondary actions into the same consistently placed overflow menu rather than wrapping a toolbar across many lines.
- Preserve complete claims, questions, and philosophically meaningful statements where truncation would change their meaning.
- Limit supporting titles and descriptions to intentional previews with an explicit expand action; do not let metadata push the main task several screens downward.
- Convert desktop tables and comparisons into readable mobile rows or focused comparison views. Allow internal horizontal scrolling only when the visual relationship itself requires it.
- Use full-height sheets or focused mobile canvases for complex tools instead of miniature desktop panels.
- Keep workbench and review headers stable while their internal content scrolls.
- Account for Android navigation, display cutouts, browser chrome, orientation changes, and pull-to-refresh behavior.
- Show loading, saving, saved, offline, conflict, and error states without replacing the application shell or trapping navigation.

### 8. Mobile Navigation

Library must become a primary mobile navigation destination. It represents the most common encounter and source-consumption workflow and should not be hidden under More.

Recommended primary navigation:

1. Today
2. Library
3. Inquiries
4. Positions
5. More

Move Labs/Test into the More page chooser. Keep More because the full application cannot be represented honestly with only five direct destinations. More should continue opening the dedicated bottom page chooser rather than the left sidebar.

Validate this recommendation against actual navigation frequency before finalizing it. If product evidence later shows Labs is used more often than Positions or Inquiries, change the ranking deliberately rather than adding a sixth cramped tab.

Requirements:

- Use the same semantic icon for each destination everywhere it appears.
- Keep labels visible; do not rely on icons alone for the primary navigation.
- Preserve the current destination visibly and accessibly.
- Respect bottom safe areas and maintain at least 44px touch targets.
- Do not allow navigation labels or icons to shift when counts or states change.

### 9. Give the Top-Corner Search a Defined Purpose

The top-corner control must not be a vague command symbol or a random collection of actions. Make it a focused **Find in Noesis** control and use a familiar magnifying-glass icon.

Its purpose is to find and open existing information across the user’s workspace:

- Sources
- Annotations
- Concepts
- Inquiries
- Positions
- Works
- Practices
- Relevant settings or destinations

Results should explain their object type and why they matched. Keep direct creation actions separate from search so the user always understands whether they are finding something or creating something.

Remove the redundant mobile plus action that appears in a search no-results state when the page already exposes its standard Add action in the top corner. Empty search results should state that nothing matched and offer a clear way to clear or change the search. Do not present multiple competing creation controls.

### 10. Repair Atlas on Mobile and Desktop

The Atlas canvas currently becomes clipped and does not use its available area correctly. Repair the layout architecture rather than masking the issue with overflow rules.

Requirements:

- The graph canvas must fill the available content viewport on mobile, tablet, desktop, and wide desktop.
- The canvas must not be cut off halfway across its width or height.
- Account for the app header, bottom navigation, Atlas controls, and safe areas when calculating its usable dimensions.
- Resize the graph when its container, orientation, selected tab, sidebar, or browser viewport changes.
- Keep nodes, edges, labels, zoom controls, and selected-node details within reachable bounds.
- Center or fit the initial graph after layout without forcing all nodes toward one side.
- Prevent panels and filters from shrinking the map into a secondary sliver.
- On mobile, use focused overlays or bottom sheets for node and region details instead of permanently taking canvas space.
- Verify pan, zoom, node selection, edge selection, region switching, and orientation changes with touch and mouse input.

### 11. Standardize List and Detail Architecture

Every entity should feel like part of the same application while retaining the utilities and workbench appropriate to that entity.

Create shared structural patterns for:

- List-page headers, Add actions, search, filters, view controls, counts, and empty states.
- Item cards and rows, including consistent clickable areas, overflow menus, metadata order, and touch targets.
- Detail headers, including back navigation, entity icon, title, status, linked context, Edit, and the overflow menu.
- Workbench navigation, selected-tool state, contextual assistance, save feedback, and history placement.

Do not make every page identical. The shared frame should be predictable, while the actual inquiry, position, concept, source, annotation, practice, and Work interactions remain specific to their purpose.

### 12. Keep Workbenches Immediately Reachable

Users should not have to scroll through an entire detail record before reaching the primary workbench.

Use a common detail-page hierarchy:

1. Compact identity header
2. Essential current state or summary
3. Workbench navigation and active workbench
4. Supporting relationships, history, diagnostics, and secondary information

On mobile:

- Keep the workbench selector near the top after the essential item context.
- Use a stable-height focused workspace where appropriate, with internal scrolling rather than moving the whole interface when tools change.
- Preserve the selected workbench when returning to the item when that helps the workflow.
- Place secondary material behind clear tabs, disclosures, or dedicated destinations.
- Avoid stacking every tool and every relationship into one long page.

Each workbench should have its own coherent sequence, plain-language prompts, focused inputs, and one obvious next action. Consistency should come from structure and interaction quality, not from forcing unrelated entities through the same fields.

## Workbench and AI Audit

### 13. Audit What Every Field Is For

Every user-entered field must serve at least one clear purpose:

- Help the user understand or develop the current item.
- Supply structured context that can improve a specific contextual-AI action.
- Record evidence, uncertainty, confidence, or a decision that the app can use elsewhere.
- Advance the item to a meaningful next state.

Remove, merge, rename, or relocate fields that merely repeat another field, collect information that is never used, or ask for prose without explaining why. Do not create fields solely to make a page look intellectually dense.

For each field, document:

- The plain-language question shown to the user.
- Whether it is required or optional.
- The domain field where it is persisted.
- Which deterministic selector, workflow state, or AI context line reads it.
- Where the saved value is shown again.
- What happens when it is empty.

The workbench should reveal only the current step. It may show a short summary from earlier steps when that context is necessary, but it should not turn the entire detail page into one continuous form.

### 14. Shared Intellectual Input Model

Use a consistent underlying reasoning model without giving every entity identical questions:

1. **Object:** What source, note, concept, question, claim, or action is being examined?
2. **Interpretation:** What does the user think it means?
3. **Stakes:** Why does it matter to the user’s philosophy or action?
4. **Uncertainty:** What remains unclear, unsupported, or contested?
5. **Support and challenge:** What evidence or counterevidence bears on it?
6. **Judgment:** What does the user currently conclude, and with what confidence?
7. **Test or next move:** What could clarify, pressure, express, or change the current judgment?

Only ask the subset appropriate to the current entity and step. The UI should use short prompts, examples, and structured controls where possible. AI should receive explicit labels for these values instead of an undifferentiated paragraph dump.

### 15. Page-Specific Workbench Contracts

#### Source

- **Prepare:** purpose for engaging, current view, and one live question.
- **Engage:** session progress plus concise notes, quotations, claims, questions, and reactions.
- **Reflect:** central idea in the user’s words, what held up, what did not, what changed, and what remains open.
- **Connect:** concepts and existing inquiries, positions, practices, or works actually influenced by the source.

#### Annotation

- **Understand:** preserve the original excerpt or note while separating the source’s meaning from the user’s interpretation.
- **Apply:** decide whether it supports, challenges, clarifies, questions, defines, or merely references the user’s thinking.
- **Connect:** attach only the concepts and objects genuinely affected.
- **Trace:** show provenance, promotions, links, and later use without mixing in editing or interpretation controls.

#### Concept

- **Define:** working definition, ordinary-language explanation, and the distinction that makes the concept useful.
- **Test boundaries:** examples, counterexamples, edge cases, and what the concept should not include.
- **Diagnose:** missing definition, distinction, evidence, linked position, or practical test.
- **Connect:** typed incoming and outgoing relationships with filters.
- **History:** recorded changes only.

#### Inquiry

- **Frame:** why it matters, current intuition, and remaining uncertainty.
- **Answer:** one leading provisional answer with confidence and the reason for that confidence.
- **Investigate:** assumptions, supporting and challenging evidence, competing answers, and a possible practice or observation.
- **Decide:** keep open, adopt provisionally, suspend, transform, resolve, or archive.

#### Position

- **State:** the claim in direct language plus scope and conditions.
- **Ground:** why it currently seems warranted, supporting evidence, assumptions, and confidence rationale.
- **Pressure:** counterposition, missing evidence, contradictions, and steelman challenge.
- **Test:** linked practice, prediction, or observation that could affect confidence.
- **Revise:** update, replace, retire, or retain with a recorded reason.
- **History:** belief biography and confidence-over-time line graph only.

#### Practice

- **Design:** concrete action, philosophical basis, hypothesis, success signal, cadence, and end/review condition.
- **Run and log:** fast observation entry with the expected action visible.
- **Review:** compare expectation with observations and identify confounds.
- **Integrate:** state which position, inquiry, or concept should change, remain stable, or require another test.

#### Evolution and Profile

- Evolution should synthesize only a user-selected period of meaningful events.
- Profile should infer from developed records and ask the user only for identity, naming, publication, and correction decisions that cannot be inferred responsibly.

#### Works

- Works remains an expression studio, not a duplicate inquiry, concept, or position workbench.
- Contextual support may analyze user-selected excerpts or linked items, but it must not replace authorship or silently write into the document.

## Library Engagement Redesign

### 16. Replace Reading-Only Language

Use source-neutral language because Library includes books, articles, papers, videos, films, podcasts, recordings, and other media:

- “Before engaging” instead of “Pre-reading.”
- “Engage with source” instead of “Read.”
- “Source session” instead of “Reading session.”
- Type-aware verbs such as read, watch, listen, or review only when the source type is known.

### 17. Intentional Before-Engaging Questions

Keep the preparation step concise and broadly useful:

1. **What brought you to this source now?**
2. **What do you currently expect or believe about its subject?**
3. **What question would make this source worth your attention?**

Each question should appear above a full-width textarea on mobile. Do not place the prompt beside a narrow input. Use a useful minimum height, natural text wrapping, and automatic growth up to a bounded height.

Add one optional deterministic source-type prompt when useful:

- Books/articles/papers: “What claim, argument, or distinction are you looking for?”
- Film/video: “What perspective, example, or experience are you watching for?”
- Podcast/audio: “What idea or disagreement are you listening for?”
- Reference material: “What fact or definition do you need to verify?”

Do not generate these preparation questions with AI. Their role is to create clean user-authored context before engagement.

### 18. Intentional After-Engaging Questions

Use progressive disclosure and keep the core reflection focused:

1. **What is the central idea in your own words?**
2. **What strengthened, challenged, or changed your thinking?**
3. **What evidence, example, or moment mattered most?**
4. **What did not hold up for you?**
5. **What question remains worth carrying forward?**

Store the user’s response separately from source claims and AI analysis. The AI reflection should compare these answers with saved notes, annotations, connections, and linked objects, then clearly distinguish source content, user interpretation, and AI inference.

## Contextual AI Experience

### 19. Support Custom Questions Where They Add Value

Keep a freeform “Ask about this item” field on contextual-AI surfaces where open questioning is useful:

- Source
- Annotation
- Concept
- Inquiry
- Position
- Practice outcome
- Evolution period
- Profile philosophy synthesis

Do not add freeform AI to list pages, filters, Settings, or routine creation dialogs. Works may use it only with explicitly selected excerpts or linked records.

The custom question must be combined with the selected action rather than replacing it. The request must show the exact item and linked context being sent before submission when that setting is enabled.

### 20. Add Item-Specific Suggested Questions

Every eligible contextual-AI panel should offer a short, curated list of useful questions. Call them **Suggested questions**, not FAQs, because they are thinking prompts rather than product-support answers.

Examples:

- **Source:** What is the strongest claim? What assumptions organize it? What in my notes contradicts it? What changed in my thinking? What inquiry should remain open?
- **Annotation:** Is this evidence, interpretation, reaction, or question? What could this change? Which linked position does it pressure? Am I overstating what the source says?
- **Concept:** Where is my definition vague? What is the nearest concept I should distinguish it from? What counterexample breaks this boundary? Do I use this term consistently?
- **Inquiry:** What assumption is hiding in the question? What evidence is missing? What is the strongest competing answer? What observation could move this forward?
- **Position:** Is confidence proportionate to evidence? What is the strongest counterargument? Which assumption is carrying the most weight? What would change my confidence? Does this conflict with another selected position?
- **Practice:** Do the logs support the hypothesis? What confound could explain the result? What should change in the linked position? Is another run justified?
- **Evolution:** What changed meaningfully? Did confidence move ahead of evidence? Which contradiction was resolved or merely avoided? What pattern repeated?
- **Profile:** What commitments recur? Which positions form a coherent worldview? What tension prevents a stable name? What working statement is supported by the selected records?

Show four to six high-value prompts for the current item and action. Selecting one should populate an editable question rather than immediately sending it.

### 21. Make AI Reasoning Accountable

For every contextual response:

- Distinguish facts from the selected records, user-authored interpretation, and AI inference.
- Reference the selected source or item behind each important claim.
- Compare confidence with evidence quantity, quality, challenges, assumptions, and unresolved contradictions where applicable.
- State when the available context is insufficient.
- Identify contradictions and alternative interpretations instead of only summarizing.
- Never modify fields, status, confidence, links, or content automatically.
- Present review units separately so users can edit, approve, reject, or dismiss each meaningful item.
- Save accepted output into a named, visible destination on the item.
- Leave dismissed output transient.

### 22. Replace the Response Modal With a Unified Context Review Workspace

Contextual AI should not return one scrollable Markdown response inside a cleaner prompt modal. It should open a single responsive **Context Review Workspace** in which each meaningful contribution becomes an individually reviewable finding.

Every review follows the same information architecture on desktop and mobile:

1. **Review overview:** action performed, item reviewed, context used, short synthesis, and finding counts by type.
2. **Findings:** assumptions, counterpoints, contradictions, evidence gaps, questions, and next moves, grouped and ordered consistently.
3. **Focused review:** one selected finding with its explanation, provenance, editor, destination, and actions.
4. **Review summary:** kept, edited, dismissed, and saved findings with their final destinations.

Each atomic finding must include:

- A stable ID and finding type.
- A concise title or proposition.
- A short explanation of why it appeared.
- The user-authored and linked records that support the finding.
- A clear marker when the content is AI inference.
- `Keep`, `Edit`, and `Dismiss` actions.
- Contextual actions such as `Connect evidence`, `Turn into inquiry`, or `Save as assumption` only when valid for that item type.
- Review state and selected destination.

Do not require the user to accept or reject an entire AI response. Editing should isolate one finding at a time, and accepting selected findings should not affect the rest.

#### Responsive Parity

Desktop and mobile are two arrangements of the same workspace, not separate tools.

- **Desktop:** section navigation, a central findings workspace, and a selected-finding or review-summary pane can coexist when space permits.
- **Mobile:** use the same sections and finding order in a single readable stream. Open the selected finding in a full-height sheet and expose the review summary from a persistent action area.
- All actions, destinations, provenance, comparisons, and review states available on desktop must remain reachable on mobile.
- Secondary actions may move into an overflow menu, but they must not disappear.
- The visual language, terminology, finding types, status model, and ordering must remain identical.

Provide the same two modes on every device:

- **Overview:** scan, group, select, and compare findings.
- **Focus review:** move through findings individually without losing access to the overview.

Switching modes or devices must preserve finding order, edits, decisions, selected destinations, and progress. Review sessions should use stable finding IDs and synchronized states: `unreviewed`, `kept`, `edited`, `dismissed`, and `saved`.

The workspace should feel expansive through typography, spacing, and staged disclosure rather than glow, decorative AI effects, nested cards, or oversized modal framing. Raw Markdown headings, hashtags, and a single editable response block should never be the primary review interface.

### 23. Add a Manually Curated Multi-Item Context Desk

Create an overall contextual-AI workspace that never reads the full workspace automatically. The user explicitly assembles the context.

Working name: **Context Desk**.

Entry points:

- “Add to Context Desk” from an item overflow menu.
- Search and add existing items from inside the Context Desk.
- Start with selected items from Atlas, a comparison, or a detail page.

Initial supported items:

- Sources and annotations
- Concepts and inquiries
- Positions
- Practices and selected logs
- Works or selected Work excerpts
- Evolution periods

Rules:

- Start empty or with only the item from which it was opened.
- Never silently include the rest of the workspace.
- Show every selected item as a removable context entry with type, title, and included fields.
- Cap selected items and payload size; explain what was omitted.
- Let the user ask a custom question or choose a suggested cross-item task.
- Suggested tasks may include compare, find contradiction, trace influence, evaluate evidence, identify missing perspective, and propose a next inquiry or test.
- Answers must cite the selected items and clearly mark inference.
- Conversations are transient by default.
- Saving requires review and an explicit destination such as an inquiry note, position comparison, concept boundary review, practice outcome, or new user-owned Work.
- Do not create a generic AI chat history or permanent pending-suggestion collection.

## Labs and Practice Semantics

### 24. Separate Labs From Practices Visually

The current code maps the `practices` route and individual Practice objects to the same flask icon. Split these meanings:

- **Labs:** keep the flask icon for the workspace/container.
- **Practice:** use a distinct repeated-action icon, such as a loop/repeat mark, on practice cards, practice detail, logs, links, and references.

Apply these icons consistently in navigation, cards, detail headers, Atlas, contextual search, links, goals, Evolution, and the Context Desk. The mobile Practice detail must display the Practice icon rather than inheriting the Labs icon.

### 25. Define the First Labs Tool Set

Do not add a collection of vague tools. Each Labs tool needs a distinct workflow and data purpose.

Recommended test-build scope:

1. **Practices:** repeated actions used to embody or test a position over time.
2. **Experiments:** bounded tests with a hypothesis, protocol, variables or conditions, duration, evidence standard, and conclusion.

Practice logs and experiment observations should be embedded in those tools rather than becoming another top-level Lab type. Defer additional tools until testing demonstrates a non-overlapping need.

Potential later candidates to validate, not automatically build:

- Prediction and calibration trials.
- Structured decision trials.
- One-time field observations linked to an inquiry.

Before adding one, prove that it is not already an Annotation, Practice log, Inquiry test, Position stress test, or Commitment.

## Test-Build Stages

### Stage 0: Baseline and Error Inventory

- Record the current branch, environment, route inventory, data migrations, and known failures.
- Run typecheck, lint, logic tests, security tests, production audit, and production build.
- Capture mobile and desktop screenshots for every route before editing.
- Record console errors, failed requests, save failures, hydration warnings, layout shifts, and inaccessible controls.
- Trace every create, edit, save, delete, restore, link, AI accept, and navigation mutation to its persistence path.
- Resolve blockers that would invalidate later visual testing.

Exit: the baseline is reproducible, failures have owners, and no unknown data mutation path remains.

### Stage 1: Mobile Shell, Navigation, and Icons

- Finalize Today, Library, Inquiries, Positions, and More as the proposed primary mobile navigation.
- Implement Find in Noesis with a magnifying-glass icon and a narrow retrieval purpose.
- Separate Labs and Practice icon semantics.
- Standardize safe areas, pull-to-refresh, Android back behavior, offline/sync feedback, route loading, and bottom-sheet behavior.
- Remove redundant mobile creation controls and no-result plus buttons.

Exit: navigation is predictable with one hand, every icon has one meaning, and no shell control competes with page actions.

### Stage 2: Shared Mobile Page Architecture

- Build or repair shared mobile list headers, search/filter rows, cards, rows, detail headers, overflow menus, workbench shells, loading states, and empty states.
- Use stable dialog/workbench dimensions with internal scrolling.
- Standardize Add, Edit, Abandon, Delete, Restore, Save, and More interactions.
- Apply the frame to every route while retaining page-specific content.

Exit: all routes fit audited phone widths with no horizontal page scroll, clipped actions, overlapping controls, or unexplained structural variation.

### Stage 3: Atlas Repair

- Repair container measurement, graph resize, fit-to-view, panel allocation, and touch interaction.
- Verify every Atlas tab and region/node/edge detail on mobile and desktop.

Exit: the full canvas is usable at every test viewport and is never clipped halfway.

### Stage 4: Workbench Field and Workflow Audit

- Apply the page-specific contracts in this document.
- Map every field to persistence, downstream display, deterministic logic, and AI context.
- Remove dead, duplicative, or unexplained fields.
- Put each workbench near the top after essential context.
- Make prompts concise, source-neutral where appropriate, and easy to answer on mobile.

Exit: a new user can identify what to enter, why it matters, and what happens next without reading documentation.

### Stage 5: Library Engagement Pass

- Rebuild the Prepare, Engage, Reflect, and Connect mobile layouts.
- Place every question above a full-width, comfortable textarea.
- Add deterministic source-type wording.
- Verify sessions, notes, annotations, claims, concepts, links, and reflections save and reload correctly.

Exit: books, articles, films, videos, podcasts, audio, and reference sources all feel intentionally supported.

### Stage 6: Contextual AI Across Items

- Add editable suggested questions to each eligible item type.
- Audit every context envelope and accepted-output destination.
- Add evidence/confidence calibration, contradiction detection, provenance, insufficiency handling, and separate review units.
- Replace the response modal and raw Markdown block with the unified Context Review Workspace.
- Implement the shared overview, finding, focused-review, and review-summary model.
- Provide Overview and Focus review modes on both desktop and mobile.
- Persist stable finding IDs, edits, decisions, destinations, ordering, and review progress across responsive layouts and signed-in devices.
- Test custom questions, suggested questions, dismiss, edit, accept, failure, timeout, quota, offline, and duplicate-click paths.

Exit: AI is useful, bounded, understandable, and productive on every approved surface; findings are individually reviewable, desktop and mobile have feature parity, and nothing disappears into an unnamed note.

### Stage 7: Context Desk

- Implement explicit multi-item selection, context preview, bounded requests, citations, transient sessions, and reviewed save destinations.
- Test mixed item types, removed items, stale/deleted records, permissions, and payload limits.

Exit: users can reason across chosen records without granting AI implicit whole-workspace access.

### Stage 8: Labs and Practice Repair

- Introduce distinct Practice visuals.
- Preserve and simplify the Practice flow.
- Add Experiments only after the separate data and interaction contract is complete.
- Verify goals, Atlas, Evolution, links, and AI use the correct Lab/Practice/Experiment semantics.

Exit: Labs is a clear container, Practices are recognizable repeated actions, and Experiments are bounded tests rather than renamed practices.

### Stage 9: Works Studio

- Complete the stable writing/drawing ribbon, floating visual tools, differentiated utensils, page model, autosave, and mobile focused overlays described earlier.
- Remove Studio Context after safely merging unique information.

Exit: Works is a professional expression studio on desktop and mobile without freezes, worksheet-like inserts, or duplicated controls.

### Stage 10: Test-Build Hardening

- Re-run every automated verification command.
- Test 360×800, 390×844, 412×915, 768×1024, 1366×768, 1440×900, and 1920×1080 viewports.
- Test portrait/landscape changes, software keyboard opening, touch scrolling, swipe refresh, bottom navigation, Android back, and reduced motion.
- Test light, dark, system, high contrast, both tab-shape settings, and all interface-size settings.
- Perform keyboard and screen-reader-name checks on desktop and mobile-equivalent layouts.
- Verify no new console errors, unhandled rejections, failed saves, stale modal overlays, freezes, or build failures.
- Complete a route-by-route acceptance checklist with screenshots and concrete interaction results.

Exit: the build is ready for focused user testing, not merely ready for another cleanup pass.

## Delivery Rules

- Complete the stages in order. Do not begin a dependent visual pass while its data, persistence, or shared-shell blocker remains unresolved.
- Keep each stage in a reviewable commit with its automated results and browser-verification evidence.
- Do not combine unrelated schema changes, mobile layout changes, AI behavior, and Works Studio changes into one release.
- Preserve user-owned records throughout migrations. Run versioned cleanup or backfill scripts in dry-run mode before staging and production execution.
- Treat screenshots as evidence, not completion. A workflow passes only when create, edit, save, reload, link, delete or abandon, restore, and navigation behavior have been exercised where applicable.
- Stop a rollout when a release gate fails. Fix the underlying shared component, selector, mutation, or data contract rather than patching one page locally.

## Acceptance Criteria

- Writing and drawing ribbons remain in exactly the same alignment when switching modes.
- The document canvas does not jump or resize when the active ribbon changes.
- Visual tools no longer look like worksheet sections.
- Tools open as draggable overlay windows with thin, faint, or invisible-at-rest frames.
- Selecting or touching an overlay reveals its boundary and usable corner resize handles.
- Tool windows never create a page-level horizontal scrollbar.
- Window position, size, state, and content survive save and reload.
- Normal pen, calligraphy pen, marker, and highlighter create meaningfully different strokes.
- Utensil-specific settings and live previews make those differences understandable before drawing.
- Drawing strokes preserve utensil type, color, size, opacity, and relevant nib behavior after save and reload.
- Mobile tools use a stable focused overlay with fixed controls and usable scrolling.
- Studio Context is removed without losing unique saved information.
- Studio Reel remains the single relevant studio-summary surface.
- No tool action freezes Works or causes repeated `Autosave paused` messages.
- Library is directly available in the primary mobile navigation.
- More opens the mobile page chooser, and the hamburger remains the full sidebar control.
- The top-corner magnifying-glass control only finds existing Noesis information and destinations.
- Mobile search empty states do not show a redundant plus action.
- Atlas fills its available canvas and is not clipped at any audited viewport.
- Every entity detail page exposes its workbench near the top after essential context.
- List and detail pages share consistent controls, spacing, icons, menus, and interaction patterns.
- Every audited route works without horizontal page scrolling or off-screen controls on mobile.
- Mobile dialogs and workbenches remain stable while their internal content scrolls.
- Every changed route works at 360px width with Android safe areas and the software keyboard open.
- Primary mobile touch targets are at least 44px and remain reachable without multi-line toolbar wrapping.
- Long supporting content uses intentional previews and expansion, while complete philosophical claims and questions remain readable.
- Labs uses the flask icon while Practice uses its own repeated-action icon everywhere, including mobile detail pages.
- Every Library preparation and reflection prompt sits above a full-width, auto-growing mobile text area.
- Library wording and prompts work for written, watched, listened-to, and reference sources.
- Every workbench field has a persistence path, a user-facing purpose, and a defined downstream or AI use; dead fields are removed.
- Eligible contextual-AI surfaces support an editable custom question and four to six item-specific suggested questions.
- Suggested questions never send automatically, and AI never reads unselected workspace records.
- AI output distinguishes user material, linked evidence, and inference; unsupported conclusions and confidence/evidence mismatches are explicit.
- Contextual AI opens a responsive Context Review Workspace rather than presenting one Markdown response in a prompt modal.
- Every AI assumption, counterpoint, contradiction, evidence gap, question, and next move is an independently reviewable finding.
- Overview and Focus review expose the same information and actions on desktop and mobile.
- Switching viewport or signed-in device preserves review order, edits, decisions, destinations, and progress.
- Mobile may rearrange or collapse secondary controls, but it never removes a desktop review capability.
- Accepted AI review units save to a visible, user-selected destination on the relevant item; dismissed output leaves no pending record.
- The Context Desk starts with explicit user selections, shows exactly what will be sent, enforces item and payload caps, and cites contributing records.
- Practices and Experiments have distinct purposes, workflows, data, icons, and downstream behavior; Labs contains no vague or duplicative tool type.
- Create, edit, save, delete or abandon, restore, linking, AI review, and route navigation do not freeze the interface or require a manual refresh.
- No changed route introduces console errors, hydration warnings, unhandled promise rejections, failed network mutations, or inaccessible icon-only controls.
- Typecheck, logic tests, security tests, production build, and desktop/mobile browser checks pass.

