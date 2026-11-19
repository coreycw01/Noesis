# Noesis: Visual Thinking and Workbench Redesign
## Design and implementation handoff for Claude

### The assignment

Make Noesis feel like one app designed by one person with a clear point of view. When I move from a Concept to an Inquiry, a Position, or a Praxis record, I should know where to find the overview, the tools, the workbench, and the record details. What I do in that workbench should feel distinctly suited to that kind of thinking.

I want clickable interactions I can see and try, not another pass that changes the font, redraws the cards, and leaves the same workflow underneath. Keep the personality of the existing Noesis prototype. The job is to bring that visual ambition into the real item details and tie it to the work people actually do.

**References:** The existing `Noesis Prototype.html` is the visual reference, not a source of production data. The current app is the functional reference. The Context Desk execution plan and delivery notes govern persistence, evidence, and AI scope. Compare the latest checkout and deployed version before assuming a feature is missing or finished. Do not overwrite unrelated changes or reintroduce prototype mock data.

### 1. A familiar layout for item details

Use the same visual order for **Concepts, Inquiries, Positions, and Praxis**. Apply the same landmarks to relevant Library and Annotation details, without making them use the same workflow.

| Location | What goes there |
| --- | --- |
| **Overview** | Item type and state, the title, and the item's defining content: definition, question, claim, or action. Keep the original item easy to refer to while working. |
| **Tools** | A short strip for what the user can actually do here: edit, add evidence or an example, log, Ask Noesis, link, or open a focused tool. Put rare actions in overflow. Avoid empty tool containers. |
| **Workbench** | A shared symbol and compact visible label, then the instrument and its controls. Start with the work, not a large banner repeating the item type or a numbered 1–2–3–4 workflow. |
| **Footer** | Dates, provenance, source and related records, and recorded history. Use disclosures for long lists. Keep metadata out of the working area unless the action needs it. |

- Use the same workbench symbol on every detail. A simple wrench is already present in the shared workflow control; retain it or prototype one clearer alternative, then standardize. Keep the visible word **Workbench**: the symbol alone is not the label.
- Use the same layout anatomy, not the same interaction. The instruments should share typography, line weights, accent logic, selection states, control sizes, and how detail opens. Keep the actual mechanics different.
- Let users enter the workbench at the point they need. No artificial completion percentages or checkmarks that imply a definition or belief is finished.
- On Concepts, Inquiries, and Positions, show **one quiet next move** when there is a useful one. Put it under the overview or near the relevant action. It should be a brief text link, not a stack of recommendations, a required step, or a dominant card. **Annotations is the exception**: its next direction is the central experience.

### 2. Make each workbench feel like an instrument

| Item | Signature interaction | What it must not become |
| --- | --- | --- |
| **Concept** | A boundary or caliper. Sort a case into **Fits / Edge case / Doesn't fit** by moving it or choosing a label. Make moving one case feel like checking a definition. Offer the reason only when needed. | Not three forms to fill out. Do not widen the boundary just because there are more examples, or automatically alter the definition. |
| **Inquiry** | Anchor the original question. Let the reader develop possible answers, pull in evidence, and weigh those answers on the **evidence scale**. Keep the working answer accessible alongside the investigation. | Not a prompt parade. Don't make users answer a questionnaire before they can think, or collapse the whole investigation into a form. |
| **Position** | Use its own **confidence gauge**, separate from the Inquiry scale. Let users see the stated confidence alongside support, challenges, and assumptions. Selecting evidence should reveal what changed and where it came from. Offer a before/after view for an actual revision. | Do not turn evidence counts into objective truth or silently adjust the user's confidence. No copy of the Inquiry scale. |
| **Praxis** | Show the action first. For **Practices**, a check-in and a legible run of days. For **Experiments**, put prediction beside observation and show what the result bears on. For **Commitments**, put the principle next to the action and what was actually upheld. | Do not make a simple action like “decompress after a long day” require an experiment protocol. Do not split Commitments into a visually unrelated page or use shapes without labels. |

**Inquiry scale is a priority.** In the current code, `InquiryBalance` exists and is referenced by the Inquiry workspace, but the user reports it missing on the live detail. Verify the actual route, visibility conditions, and small-screen layout before building a duplicate. With zero or one possible answer, make the scale findable and give one clear way to add the next answer. With two, show a balance; with more, show comparable pans or a clearly labeled mobile equivalent. Supporting evidence adds weight, challenging evidence offsets it, and context does not change the weight. The user assigns the evidence and assesses its strength. This is a visualization of recorded judgments, not a verdict. Demo adding an answer, assigning evidence, and seeing the scale respond and persist after reopening.

### 3. Annotations: a guided landing, not a generic workbench

This is the place for the most expressive guidance. Keep the quote, source, and what the user selected in sight. Design an interactive **Apply** surface that makes the destinations legible before the user chooses one:

- **Inquire:** What question could you investigate?
- **Take a position:** What claim would you state in your own words? Or does this support or challenge a position you already hold?
- **Clarify a concept:** What meaning or boundary does the passage help define?
- **Try an action:** What small practice might help you understand or test it?
- **Keep as reference:** A valid outcome with no forced follow-up.

Prototype a branching visual with the passage as its anchor and a short preview of the selected destination. A branch click shows what will carry over, lets the user name or edit it, and offers one confirmation. It does not create an item immediately. Provide an equally usable labeled list on mobile and with the keyboard. No drag-only destinations. Use simple in-app guidance without requiring AI; Ask Noesis can propose ideas the user reviews and chooses.

Keep edit and delete in the item menu. Do not restore standalone metadata, empty “Your notes,” or Connect/Trace workflow tabs. Keep Connections and History as disclosures, and keep authored interpretation available in Edit when it exists. Library and Works Markup should continue to feel like part of this loop: select a passage, color-coded tags appear, and saved marks populate the side rail. Don't replace it with always-visible form fields.

### 4. Context Desk: make it feel like a place to work

Design **Desk** and **History** as the two top-level tabs. Use the existing desktop/editorial and mobile layouts as two presentations of the same experience.

1. **The desk:** A material stack on the left, the working question and answer on the right. Drawers or paper tabs can organize sources, notes, concepts, inquiries, and positions. Keep the metaphor quiet and usable: real labels, counts, compact expandable stacks, and search. An 80-item stack should not become 80 floating cards. On mobile, the same stack opens as a labeled sheet, not a separate app.
2. **Bring material in:** Name and reopen desks. Add records to stacks, move between them, or exclude material. Give adds a short, tangible motion, with an immediate equivalent when motion is off. Keep membership, exclusions, and AI context visibly distinct.
3. **Follow the thinking:** Prototype a citation that reveals the exact excerpt in its stack or sheet. Closing it restores reading position and keyboard focus. Do not show a citation or complete coverage count the current data cannot support.
4. **Return to a question:** History should read by question, not by generic “AI response” events. Preserve accepted item-assisted history as a distinct, reachable group. Where durable question history and evidence snapshots aren't yet integrated, clearly label the prototype and leave existing history intact.
5. **Keep AI boundaries honest:** The larger desk is a collection, not a larger Gemini request. Preserve Review Context and existing exclusions. The current local saved-desk work shows the bounded first 12 eligible records for the next review. **Ask** is for a focused question. **Review whole desk** is a later explicit action that needs coverage and a usage estimate; do not add a working-looking button if batching, usage, and retention aren't ready. Do not change billing, permissions, or AI behavior for a UI demo.

Show me **one complete clickable scene**: add a record to a stack, ask a question, inspect the excerpt, return to the same answer, and find the question under History. Use synthetic content and label what is mocked vs. wired. Give me a desktop and a mobile version before expanding the design.

### 5. Scroll and motion

Use motion to explain what just happened, not to make every page perform. Scroll should still feel native.

- A compact workbench marker can stay visible while its instrument is active, then release before the footer. Test that it doesn't cover the selected section, nav, or keyboard focus.
- Tie motion to actions: a source joins a stack, a pan moves when evidence changes, a concept case crosses a boundary, or an annotation branch opens its destination preview.
- No scroll hijacking, forced scrolling on tab selection, bouncing headings, or parallax on every page. Do not fade critical content in only after it enters view. Preserve back-navigation scroll and text selection.
- Honor both Noesis and system reduced-motion preferences. Everything still needs to make sense when it changes instantly. No hover-only controls, drag-only tasks, or information conveyed only by color or shape.

### 6. Audit the whole app, without giving every page a new layout

Walk through **Today, Library, Source Index, Annotations, Concepts, Inquiries, Positions, Praxis and Commitments, Exercises, Works, Atlas, Evolution, Context Desk, Profile, and Settings**. Include the relevant item detail, empty state, and create/edit flow. Check:

- Page hierarchy, navigation, back links, position of actions, typography, spacing, borders, card vs. list views, icons and status language.
- Existing appearance choices keep working in light, dark, and high contrast. Use clear focus, comfortable touch targets, wrapping text, and labels that make sense to assistive technology. Check keyboard operation, 200% zoom, narrow phones, tablets, and wide screens. Put important controls on-screen without sideways scrolling.
- Preserve existing Atlas constellations and map/region interactions, the cleaned-up Evolution views, the Works editor, and the grouped Exercises. Unify them visually; don't flatten them into a generic collection.
- Keep backend contracts, accessibility names, data, routes, ownership, and recoverability intact. No real workspace content in demonstration artifacts.

### 7. Deliver it in this order

1. **Show the design language.** Make one comparison sheet with desktop and phone examples for Context Desk and the common item-detail anatomy. Show how the instruments are visibly related but not interchangeable.
2. **Prove the two highest-priority interactions.** Produce clickable Context Desk stack/citation and Inquiry scale scenes. Include a state without enough material and a reduced-motion mode. Visually compare with the existing prototype and live app.
3. **Apply the shared detail layout.** Build the compact Workbench marker and consistent overview/tools/footer. Then integrate Concept, Position, and Praxis instruments and Annotation Apply. Keep Approval, Cancel, Save and Back behavior working.
4. **Run the page-by-page pass.** Fix the systemic differences you find; don't simply write a critique. Report what changed, what was preserved, and what still needs engineering.
5. **Show proof.** Provide clickable demos or working routes and before/after screenshots. Demonstrate the real interactions at desktop and mobile widths, including add evidence, apply an annotation without AI, log a practice, inspect and close an excerpt, keyboard navigation, and reduced motion. Call out any unverified persistence or read-only prototype state. Don't deploy without approval.

**The test for success:** If I open a new item detail, I know where to look without being trained again. Once I reach the workbench, the interface makes the specific act of thinking easier, not merely prettier.
