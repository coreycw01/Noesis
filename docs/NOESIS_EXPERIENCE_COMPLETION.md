# Noesis Experience Completion

Started: 2026-11-06. Status: implementation in progress, not release complete.

## Current Release Checkpoint

2026-11-14. Not release-ready; no deployment or Play upload was performed.

| Gate | Status | Evidence or required next action |
| --- | --- | --- |
| Web build and static checks | Passed locally | Production build and typecheck passed; 281 logic and 16 security tests passed. Full lint reported zero errors and 26 warnings. No unapproved high or critical production advisories. |
| Workspace persistence and permissions | Verified in part | 43 Firebase emulator tests passed, including record ownership, concurrent edits, provenance/event pairing, recovery, upload rules and profile withdrawal. A local signed-in browser verified history pagination and inquiry offline retry and conflict recovery. Hosted cross-device sessions remain unverified. |
| Desktop and mobile experience | Verified in part | Production Chromium demo rendered 14 route headings at 390 and 1440 px with HTTP 200, no document-wide horizontal overflow, no uncaught errors and no failed Next asset responses. Earlier scoped keyboard, axe, Firefox and WebKit checks are documented below. This is not a full interaction-state or physical-device run. |
| Android wrapper | Verified in part | Pixel 8 emulator verified native Back, camera and mic denial, and recorded video playback after reload. Android debug and unsigned release builds passed. Physical capture and hosted upload need a connected test device and account. |
| Contextual AI | Verified in part | Local auth emulator verified request permissions and the disconnected-provider path. A verified staging account and an active provider are needed for generation, reviewed acceptance and reload on the hosted stack. |
| Android upload | Blocked externally | Signed build mode is ready to receive the existing Play upload key and matching Firebase Android config. No signed package or native Google sign-in verification exists. |
| Startup assets | Failed | Latest audit: 487/400 KiB on core routes and 492/450 KiB on public profiles. Core route initial assets fell from 630 KiB by deferring workspace styles; the full styles still download when the workspace opens. The shared runtime alone is roughly 437 KiB raw. |
| Deployment | Not run | Review the working tree before staging; the completion work is not all committed or shipped. |

Detailed evidence below distinguishes local implementation, browser
verification and unverified release requirements.

Mobile accessibility smoke passed in Chromium at 390 x 520 with reduced
motion: Atlas slider keyboard input and named controls, scoped axe scan
of Map Style, Evolution invalid-range alert, and named Settings switches
with keyboard toggling. To repeat, open a fresh local demo browser session
and run `playwright-cli run-code --filename scripts/smoke-mobile-accessibility.js`
from the repo with axe-core installed locally. This is not a full accessibility audit.

Profile sharing now uses the workspace's actual publication eligibility:
signed-in review workspaces show preview-only copy and no published link.
Real publication always opens the exact snapshot for confirmation, even if
an older setting would have skipped it. Withdrawal still does not require
a publication confirmation. Logic tests cover the policy; a 390 px demo
verified the example link, Cancel, and absence of a live link. No hosted
profile was published as part of this check.

The publication save path now rejects a snapshot that includes disabled
sections, unselected record IDs, or a different public URL. The emulator
regression publishes a bio and concept, rejects a mismatched preview,
then republishes at the same URL and verifies that a guest can no longer
read the removed bio or concept. This check does not retract content
already copied by visitors.

The cache-disabled Chromium startup smoke measured 25 same-origin JS/CSS
requests totaling 2,148 KiB decoded and 637 KiB transferred by the time
Today was visible at 390 px on the local production demo. This excludes
fonts, images and API calls and does not represent signed-in performance.
Repeat from a local production preview using
`playwright-cli run-code --filename scripts/smoke-workspace-startup.js`.

Workspace boot now renders with a small loading-frame stylesheet, then
loads the full styling with the workspace entry. The production build
passed and Chromium checked the rendered Today shell at 390 and 1440 px
without horizontal overflow. This is a first-document optimization, not
a reduction of all assets needed by a signed-in workspace.

AI origin details now let the owner remove the original suggestion after
confirmation. This removes the precursor from that private provenance entry
only, not the approved text, field targets, or historical acceptance event.
At 390 px, the local demo verified cancel, confirm, and reload. All 40
Firebase emulator tests passed, including owner-only removal, repeat
removal, and rejection of attempts to alter or restore protected content.
This does not redact other saved content, older exports, or event snapshots.

Deletion events retain the snapshot needed for Recently Deleted but no
longer duplicate it in the event diff. Restore events retain the item ID
and field-level origin references without copying restored text. At
390 px, a synthetic AI-assisted annotation was deleted, restored from
Settings > Data, and reopened with its origin indicator intact. The
production build and 277 logic tests passed. Existing snapshots were
not rewritten; the 30-day recovery window is not proof of data expiry.

Settings now subscribes to recovery history only while Data is open.
Failed reads have a panel-local retry that leaves other Settings state
intact. At 390 px the demo restored a synthetic deletion after switching
between Account, Data and Appearance. This browser test used demo
storage, not a live Firestore listener failure.

Inquiry edits now check the saved version before writing. Frame drafts
keep the version they began on and stop offering Save Context when a newer
version arrives, preserving the draft until the user chooses to discard it.
The 390 px demo verified context save and reload; a two-client Firebase
emulator regression verified that a stale save changes neither the newer
answer nor the event log. The hosted offline and conflict UI paths still
need browser verification.

Inquiry Answer now keeps an in-progress draft when the saved answer changes,
and Decide blocks conversion or resolution until the answer conflict is
cleared. Saving a provisional answer no longer rewrites an unrelated
resolution summary. Position conversion requires both the status and version
to match. Mobile demo verified answer save and reload; the 41-test Firebase
emulator suite verified that a stale conversion produces neither a position
nor an event and only one current conversion can win.

Evolution marks a date-filtered count as partial only when older history
could still match, and puts Load older history beside the timeline filters.
The same boundary controls the synthesis coverage note. Unit coverage
includes the oldest loaded day, no start date, and unloaded history;
Chromium verified invalid and empty date ranges at 390 and 1440 px without
horizontal overflow. A separate signed-in Chromium run against local
Firebase emulators seeded 205 events: a boundary-day filter correctly
reported 200 loaded matches, an older date first showed no loaded matches,
and Load older history revealed five matches without resetting the dates.
The same signed-in session verified Inquiry Frame offline retry and a
live concurrent edit notification: the draft survived both, Save was
blocked on conflict, and the newer context loaded on request. No hosted
data or live provider was used.

Atlas custom map updates now check the saved revision before writing; a
stale map style cannot undo a newer node drag. Map Style keeps its draft
until acknowledged and clearing a background no longer deletes its
file before Save. At 390 by 520 px, Cancel left the original font intact
and Save persisted the selected font on reopening the dialog. All 42
Firebase emulator tests passed, including the stale style regression.
Unreferenced background files are not yet individually reclaimed.

Commitment totals, Today check-ins, and Insights now use saved plans;
only the Active editor previews unsaved refinements and manual counts.
A 390 px demo verified that adding an unsaved fifth commitment did not
change the four saved active commitments or their four check-in actions.
The editor labels a changed count as a draft. Progress still uses the
highest of matching activity, manual count and completed check-ins to
avoid double counting.

Automatic goal counts shared by Home and Praxis now count each matching
source, inquiry, position, practice, or work once by record ID. Different
records with the same title still count separately. The regression covers
all five entity types; the distinct-day and per-practice streak rules are
unchanged. Typecheck and 279 logic tests passed.

Changing a commitment's progress category to a different kind clears
the old count measures and item filters, while preserving concept focus
and any position used to ground the commitment. This prevents a former
Position filter from silently narrowing Practice Completion. A 390 px
browser check switched categories without overflow, and all 280 logic
tests passed, including count and legacy-grounding coverage.

Annotation promotion to a new inquiry or position now carries references
to any original AI-assisted annotation text. It leaves the new record
user-owned and does not create a second AI acceptance. Inquiry-to-position
conversion carries the same references. The promotion dialog keeps the
footer in view and uses a percentage confidence input. At 360 by 520 px,
a synthetic reviewed annotation could be promoted to either destination;
the origin dialog showed the original suggestion after reload, and the
position retained 85% confidence. A separate 390 px demo run verified
the full annotation-to-inquiry-to-position chain: the inquiry became
converted and linked to the new position, and the position showed the
original annotation suggestion after reload without creating a second
provenance record. Escape restored focus to the origin button and Enter
reopened it. Hosted verification is still open.

WebKit initially requested HTTPS assets from the local HTTP dev server.
Development no longer sends HTTPS-upgrade or HSTS directives; production
retains both. The local demo worked after that change. WebKit also exposed
a Firebase iframe-loader script blocked by the content security policy.
Allowing its specific Google loader path let a fresh session reach the
login screen with no console errors; Continue with Google opened the Firebase
OAuth handler. No account was selected, so OAuth completion and signed-in
workspace access remain unverified.

WebKit appearance check: the named High contrast switch responded to Space,
and saved square controls and high contrast persisted on Library after
navigation and reload. Today, Atlas, Library, Inquiries, Positions,
Evolution, Goals within Praxis, and Settings all retained both preferences
without document-level horizontal overflow at 390 and 1440 px. This checks
preference application and layout, not every palette's contrast ratios
or native iOS Safari behavior.

Chromium contrast checks found that Violet, Sage, Blue, and Rose reused
light-mode accent ink on dark surfaces. Their dark accent, filled-accent
text, and focus-ring tokens were adjusted together. A rerun reported no
axe-core color-contrast violations on initial Today across all six palettes
in light and dark at 390 px, or on initial Today, Atlas, Evolution, Settings,
and Profile across all six dark palettes at 1440 px. This does not cover
every interactive state or all contrast checks that require manual review.

Evolution uses a memoized Library index for source chips in both timeline
and table event details. It preserves Library order, skips missing links,
and no longer scans the entire Library per row. Typecheck and 259 logic
tests passed, including the source lookup regression. At 390 px in Chromium,
Space opened and closed a position revision and exposed its Trigger details.
This avoids repeated work but is not a measured startup-size improvement.

Public profile HTTP smoke passed against an isolated Firestore emulator and
production Next build. The same URL went from unpublished to published to
withdrawn, returned `no-store` each time, and never included the seeded
private concept. This covers the visitor route separately from earlier
owner permission tests, not the hosted owner-facing publication flow.
To repeat, build with `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-noesis-rules`
and an isolated `NOESIS_BUILD_DIST_DIR`, then run
`firebase emulators:exec --project demo-noesis-rules --only firestore "node scripts/smoke-public-profile.mjs"`
with those same variables.
The Security workflow runs this smoke test after the Firebase rules suite.
The pinned Firebase CLI command passed locally; the updated workflow has
not yet run on GitHub.

An explicitly opened local demo now stays selected after refresh in that
browser tab. WebKit verified this with the Google sign-in loader stalled:
an inquiry edit survived refresh without reopening the demo manually,
and the private Home URL still required a session. Optional storage
failures remain non-blocking. Typecheck and 260 logic tests passed.

Contextual assistance always offers an on-demand preview of bounded request
context. The existing Settings preference controls whether it starts open.
A 390 px Chromium demo verified that turning the setting off starts the
Inquiry preview collapsed, Space reveals the current item, and Escape
closes assistance. No provider request was needed for these checks.

Evolution distinguishes a reversed date range from a valid search with
zero results, announces its result count through a status region, and
ignores outer whitespace in search. A 390 px Chromium demo confirmed
the date error did not show the empty-results state and clearing both
dates restored the original 12-of-16 result count.

Praxis commitments refresh day-based state at local midnight and when the
app regains focus. In a 390 px Chromium simulation, completing one item
changed 4 due / 0 done to 3 due / 1 done; advancing past midnight kept
the weekly item off the due list and reset today's done count without
reloading. A unit test covers the midnight boundary.

Atlas Connections announces filtered counts and names each row's type and
removal controls with their endpoints. The existing removal confirmation
returns focus to its opener on cancel from Connections or Review. A 390 px
Chromium check verified the Connections label, confirmation, and focus
return; typecheck passed. No relationship was deleted in that check.

Firebase web startup no longer initializes Google's popup helper before
checking the local session. The login page supplies the resolver explicitly
for a pending redirect, a requested popup, or its redirect fallback.
Mobile WebKit reached the login form with zero Google helper requests,
then opened the Firebase handler on demand. Account selection, redirect
completion and a physical-device sign-in were not exercised.

Context Desk's review displays the unique affected exclusion count and
breakdown by record type. Closing the preview restores focus and no longer
implies approval or transmission. A 390 px Chromium test excluded one record,
verified the breakdown and focus restoration, and observed no AI POST.

Contextual AI concurrency is enforced through transactional, expiring
Firestore reservations rather than a process-local counter. Two independent
Admin SDK clients racing for three slots obtained only two; the emulator
also verified release, expiry and a late release that could not clear a
replacement slot. Typecheck and all 31 emulator tests passed. The existing
server-only API usage rules also cover the new reservation documents.

Quota responses now advertise the actual next UTC accounting window in
`Retry-After`; if both limits apply, the daily limit takes precedence.
The boundary test covers the final fractional second and midnight.
Typecheck and all 262 logic tests passed.

The assistance dialog now displays a human-readable manual retry wait
for HTTP 429 responses with a valid bounded `Retry-After` value. It does
not retry automatically. Logic coverage includes minute/daily feedback
and invalid values.

Contextual AI now uses the same 32,000-character memory ceiling in the
browser and on the server, separate from the prompt and byte limits.
Selected-position comparison reserves room for the second position rather
than sending a one-sided request or failing selection validation. Typecheck
and 264 logic tests passed, including a comparison with oversized inputs.

The contextual AI HTTP smoke test passed on the Auth emulator against
the current route. A verified user got 413 for 36,000 memory characters
and 400 for an action/scope mismatch. The exact 32,000-character boundary
with a separate prompt advanced to the deliberate provider-disabled
response. No provider call was made.

Source Index now distinguishes unavailable selections from exportable
sources and does not silently fall back to the full filtered catalog if
every selection disappears. The selection count is announced. A 390 px
Chromium demo verified that selecting a single source gives one matching
bibliography entry; live cross-device deletion was not exercised.

The contextual AI provider adapter now has executable tests with synthetic
responses: successful text excludes hidden thought parts; malformed JSON
and rate limits produce normalized errors without retry; timeout differs
from cancellation; an already canceled request never starts. Typecheck and
all 267 logic tests passed. No external provider was contacted.

The Security workflow now also runs the contextual AI HTTP smoke against
its isolated production build. The pinned CI command passed locally:
the server started with the Auth emulator and provider disabled, then
verified credentials, email, scope, and request size. The test removed
its synthetic account and stopped the server. GitHub and hosted AI have
not run this revision.

Cold local Chromium transfer measurement (390 px, separate fresh contexts)
through the first expected heading: private Home sign-in transferred 414 KiB
of same-origin Next JS/CSS (1,424 KiB decoded), demo Today transferred 623 KiB
(2,108 KiB decoded), and the unavailable public profile transferred 165 KiB
(610 KiB decoded). This includes chunks loaded after the first HTML arrives,
not images, fonts or external requests. It does not measure hosted network
performance or replace the raw startup budget.

Signed-out startup now initializes Firebase Auth without loading Firestore.
The signed-in workspace loads its Firestore provider separately; ordinary
demo users receive the offline demo provider. A fresh 390 px Chromium
production sign-in check measured 256 KiB transferred (889 KiB decoded),
down from 414 KiB (1,424 KiB decoded). Browser smoke also verified demo
Today and Library navigation, and the production build passed. The raw
startup gate remains 629/400 KiB on workspace routes; a signed-in hosted
session was not exercised after this split.

The signed-in startup split passed a local browser integration test with
isolated Auth and Firestore emulators. A synthetic account created an
inquiry at 390 px, reopened it after reload, and saw it from a separate
1440 px browser context. Local emulator connections require a development
build, an explicit opt-in, and a demo project ID. Hosted account behavior
and live AI remain unverified.
After authentication, the workspace entry now starts downloading its
workspace code and Firestore provider together instead of waiting for one
before requesting the other. A synthetic emulator account opened Concepts
at 390 px, retained sign-in on reload, and opened the separate demo Library
without page errors. The signed-out and demo paths retain separate loaders;
no transfer or wall-clock improvement was measured in this check.
The production build, typecheck, 270 logic tests and 16 security tests passed.
The startup audit still reports 629/400 KiB for workspace routes and
630/450 KiB for public profiles.

For release testing, the owner approved using the Android emulator for now
and indicated staging access will be provided. Physical-device behavior and
hosted Gemini generation remain unverified.

A 390 px signed-in Chromium run used a synthetic response intercepted at the
Contextual AI endpoint and real local Firestore persistence. Socratic
Challenge made no request until explicitly invoked, sent the current inquiry
and its uncertainty, and stored nothing on dismissal. Saving one selected
finding wrote one investigation note and one AI-assisted thinking event,
preserved the existing answer, and showed Reviewed challenge notes under
Investigate after reload. This tests the browser and write path, not hosted
authentication, provider generation, or live quota enforcement.
The same synthetic review at 320 by 470 exposed a 16 px editor viewport
in Focus mode. Focus now scrolls as one panel on short phones, with the
final save outside that scroll area. Previous and Next move focus to the
current finding, and a dismissed finding must be restored before it can be
kept. The browser verified the short-screen interaction and a one-note
save without horizontal overflow. Typecheck passed.
Evolution now states the exact loaded date-range sample beside period
synthesis and distinguishes it from timeline text and change-type filters.
At 390 px, Chromium verified that an unmatched search hides timeline rows
without changing the synthesis sample, a reversed range hides synthesis
and reports the error, and a valid empty range explains why there is
nothing to synthesize. Typecheck passed. No provider call was made.
Context Desk now includes the full ordered selection in its local review
identity. A selection change invalidates approval even when the bounded
request ID and excerpt text would otherwise match. A logic test reproduces
the ID collision with twelve records and checks that reordering the primary
record changes the review identity. Typecheck and 17 focused tests passed.
Context Desk acceptance retries now require the same Work references as
well as the same review and body. The Firebase emulator verified that a
changed reference is rejected without adding a Work or history event;
unchanged concurrent acceptance still creates exactly one of each. Typecheck,
all 272 logic tests and all 32 Firebase emulator tests passed.
Accepted review history no longer depends on a retired stored AI setting:
ordinary object reviews and Context Desk Work creation retain AI-assisted
event attribution, consistent with Inquiry and Evolution. No historical
events or stored preferences were rewritten. Typecheck and all 272 logic
tests passed. This is not the complete field-level provenance model.
Inquiry challenge acceptance is the first field-level path: notes reference
a private provenance document with their individual field targets, the
bounded generated precursor, and a hash of the reviewed text. The notes,
provenance and thinking event commit together; the event references the
origin without copying its precursor. Review-note edits preserve existing
references, and private workspace export includes the provenance collection.
Inquiry history now shows AI-assisted labels on mobile and opens origin
details for notes with an exact field-level reference. A 320 by 470 touch
browser test using a synthetic demo fixture opened the original suggestion,
checked the dialog fit, and verified Escape restored focus to the badge.
Other destinations, edit chronology in the detail dialog, tombstones and
backfill remain open. The rules change has not been deployed.
Context Desk-to-Work acceptance now also writes a private origin record,
document-body reference, and linked thinking event in one transaction.
It retains the generated precursor and bounded selected-record references
without copying them into the thinking event. The Work badge is visible
in default writing focus; a 320 by 470 demo fixture verified opening,
fitting and return focus. The concurrent acceptance test verified exactly
one Work, one origin record and one linked event; the 32-test rules suite
passed. Existing Works without provenance were not backfilled.
Profile philosophy approval now atomically saves its private review history,
field targets, origin record and thinking event. The working statement gets
an origin badge only if that section was approved; review-only findings
retain origin in private history. The authenticated emulator verified
concurrent acceptance, distinct stale and altered retries, preservation of
identity, and no precursor in the thinking event. Publishing is separate
and was not changed. A synthetic Chromium fixture at 320 and 1440 px
verified the private origin dialog fit and restored focus, and that the
Public tab did not render the origin. Logic tests also cover publishing the
statement without its provenance, and accepting a review without a statement.
Concept definitions and boundary reviews now keep separate private
provenance references. Acceptance updates only the intended field and its
private history, atomically with the origin and event. The emulator
verified a concurrent boundary acceptance preserves another client's
examples, refuses stale or altered approval, and does not copy the text
into the history event. A 320 by 470 demo fixture verified the definition
badge opens and returns focus. Typecheck passed.
Library summary and reflection approvals now bypass reading-note autosave
and commit only their approved field and private history with provenance.
Normal capture saves preserve accepted summary and reflection text. The
focused emulator test verified concurrent reflection saves preserve a newer
authored note and a separate summary, refuse altered retries, and produce
one private origin and one text-free event. A 320 by 470 demo fixture
verified the summary badge dialog and return focus. Typecheck passed.
Source claim and inquiry-prompt approvals now create individual annotations
with stable IDs and private field references in the same save as the source
history and thinking event. The focused emulator test verified that two
concurrent approvals create one new claim, preserve an existing matching
user note, and point provenance only at the newly created annotation.
The annotation detail exposes the original suggestion. Typecheck passed.
Annotation Effect Review now writes the private review and evidence of its
origin together with one timeline event, without overwriting the latest
canonical annotation text or links. The focused emulator case verified
concurrent acceptance, rejection of an altered retry, and matching
canonical and compatibility records. A 320 by 470 demo fixture verified
the source-generated annotation text badge opens and restores focus.
Typecheck passed; the effect-history badge was not browser-tested.
Practice outcome approvals now save the accepted review, private origin
and one thinking event together, and expose the origin from saved outcome
history. An emulator test verified simultaneous approvals save once,
preserve a newer authored observation and reject altered retries or new
reviews after reopening the practice. Typecheck passed; practice origin
history was not browser-tested here.
Position assistance now writes the selected destination (assumptions,
counterargument, evidence gaps, or comparison), private origin and one
event atomically. Reviews link to provenance from saved history. The
focused comparison test verified one concurrent save, preservation of
newer confidence, and rejection of a retry against a different position.
Typecheck passed. Per-row markers on the raw string lists and browser
verification of these new links remain open.
New Evolution period syntheses store approved text and the original
suggestion in private provenance, with bounded event references, rather
than embedding text in history. The expanded timeline entry opens the
approved text and origin; legacy entries remain readable. The focused
emulator test verified atomic and idempotent writes, rejection of changed
sample IDs, and that another account cannot read approved text.
Typecheck passed. A later browser test used a synthetic referenced
synthesis to verify its approved text and original suggestion separately,
without clipping and with focus restored after Escape. It passed at
320 px in Table view and 1440 px in timeline layout. Both display the
AI-assisted attribution.
Firestore rules now require owner-scoped provenance records and their
AI-assisted thinking events to reference one another. Emulator tests reject
standalone writes on either side and verify accepted reviews still save
with their destination. Typecheck, all 16 security tests and all 40
emulator tests passed. The rules are local and have not been deployed.

Profile now distinguishes demo preview and save controls from real
publication, including the example URL and the confirmation dialog.
At 390 px, Chromium verified that demo choices survive reload and that the
demo never offers an open-published-profile link. Typecheck passed. The
signed-in publication wording and write path are unchanged.
The signed-in browser workflow also passed against local Auth and Firestore
emulators. A synthetic 390 px owner saved identity, published a selected
snapshot without its introduction, and withdrew publication. A separate
signed-out browser saw the display name but not the excluded introduction;
refreshing the same URL after withdrawal showed Profile unavailable. This
exercise did not contact hosted Firebase or validate deployed cache behavior.

Today's recommendation and return signals now share the workspace selector
for practices that need a log, recalculated at the local day boundary.
A regression test shows a logged practice becomes due the next day and
stops requesting logs after its scheduled end without editing the record.

Profile's current snapshot and bounded philosophy assistance use the same
live-position eligibility as workspace attention. Suspended and replaced
positions cannot be presented as leading beliefs. Explicit public selection
retains its existing eligible records. Typecheck and the eligibility
regression passed.

Goals and Today now use live-position eligibility for the 100%-confidence
measure. Historical review and revision measures still count the recorded
work even if a position is later retired. Typecheck and 270 logic tests
passed, including the measure distinction.

Shared authenticated requests now use Firebase Auth without initializing
Firestore. They send credentials only to same-origin API paths, normalize
the trailing slash before sending, and do not follow redirects. Typecheck
and all 16 security tests passed, including external URL and path rejection.

Contextual AI's shared custom-question input shows the character limit,
rejects a one-character prompt before sending, and includes the question
in the context preview. A 390 px Context Desk smoke test verified the
blocked submission and visible question in the preview; typecheck passed.

Practices now derives awaiting-log filters, summary totals, and active
loop grouping from the same day-aware snapshot. Its inline log defaults
to the current day unless the user selects a date. In a 390 px Chromium
demo crossing local midnight, the Observe summary and Today list both
updated from three due to four without reloading. Typecheck and all
270 logic tests passed.

Works tool windows now roll back interrupted drags on pointer cancellation
or loss of window focus, rather than saving partial geometry. A desktop
Chromium demo verified pointer cancellation restores the prior position
and text selection, while a normal drop survives reload. Typecheck passed.

Settings recovery names each Restore control for its record, supports
Firestore timestamps, and returns focus to Recently deleted when the
restored row disappears. A fresh 390 px Chromium demo deleted a Work,
restored it through Settings > Data, checked focus, and saw the Work
back in the collection. Typecheck passed; hosted recovery was not tested.

Find now searches cached owner records when the browser is offline and marks
the results as potentially incomplete. Online searches still use server
reads and report failures rather than silently falling back. The emulator
verified warm-cache records, a separate empty cache and the existing owner
rules. Typecheck passed. This does not make a cold offline startup possible.

Atlas quick link and custom-map link creation now wait for the save before
closing. A pending save blocks duplicate submission, and failure retains
the draft with an inline alert. A desktop Chromium demo created an
Attention-to-Freedom support link and found it in Connections after reload.
Typecheck passed. A separate Chromium run simulated a demo storage failure:
the alert appeared, the note stayed editable, and a retry persisted exactly
one matching link after reload. Desktop and 390 px touch Chromium also
verified custom-map creation: a forced save failure kept the draft in the
dialog and retry persisted one matching map after reload. The mobile Map
options menu now uses the height available at its anchor, so its top rows stay
onscreen, and provides 44 px targets for its options. Typecheck passed.
The same scrollable menu sizing now serves desktop Atlas relationship types
and Context Desk exclusions. At 360 × 470, Context Desk's exclusions menu
previously extended below the screen. Chromium verified it now fits, provides
44 px touch rows, retains the menu after tapping a type, and supports keyboard
selection and clearing. The mobile Atlas custom-map retry still passed.
Shared collection filter panels also use their available viewport height.
At 360 by 470, Positions, Annotations and Concepts filters previously
extended past the bottom. Chromium now confirms all five tested panels fit
(those three, Library and Inquiries), choosing a nested Positions filter
keeps its outer panel open, and the Annotations related-source picker can
find and select Meditations. Typecheck passed.
An open-state axe-core sweep at 360 by 470 then verified eight panels:
Atlas Map options, Context Desk Exclusions, collection filters for Library,
Positions, Annotations, Concepts and Inquiries, and Annotations related
search. The fixes label the dialogs and filter controls, and give annotation
type chips a readable selected treatment and pressed state. The final
scoped scan reported zero violations; this is not an app-wide audit.
A fresh production build before the labeling edits passed. The unchanged
startup gate still failed at 629/400 KiB on workspace routes and 630/450 KiB
on public profiles. Typecheck passed after the labeling edits.

A separate production Turbopack build passed compilation and typechecking
but did not resolve the startup gate: its workspace routes measured 635 KiB
raw (170 KiB estimated gzip), versus Webpack's 628 KiB (169 KiB gzip).
The public profile improved from 630 to 618 KiB raw but still exceeded
its 450 KiB limit. Keep Webpack and the original budgets; prioritize shared
startup assets rather than switching bundlers.

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
- Home and Goals now share legacy goal conversion and preserve intentionally
  empty goal lists. Source goals honor their category unless explicitly
  refined to a source type. Check-ins replace the entry for the same local
  date without copying derived progress into manual progress; a failed save
  leaves the action available to retry. The editor separates manual and
  counted totals. Logic tests cover the shared rules; signed-in and browser
  verification of save failure and retry remains open.
- Explicit inquiry creation (including Home and annotation handoffs) now waits
  for persistence, guards duplicate clicks and retains drafts on failure.
  Annotation promotion preflight remains open on failure. Browser verified a
  question-only inquiry creates, opens and survives refresh. Source ids are no
  longer incorrectly written as annotation evidence ids at creation.
- Annotation-to-inquiry promotion now uses the shared mutation path and rejects
  missing selections before writing. The inquiry keeps selected source and
  annotation IDs; existing annotation backlinks are preserved. The Firebase
  emulator verified that a rejected annotation write rolls back the inquiry,
  source patch and history, and that a successful write persists all four.
  A two-client emulator test also verified that a newer source edit blocks a
  stale promotion without creating records, and that retrying from the latest
  source preserves the edited text. Annotation edits and deletes use the same
  source-version check. Signed-in UI and simultaneous independent workflows
  beyond this path still need verification.
- Annotation Connections, Apply, search, and Linked counts now recognize
  inquiries that cite the annotation as evidence, not only inquiries created
  from it. Connections can open the linked inquiry, position, or source.
  Logic coverage verifies deduplication, the original backlink's priority,
  and exclusion of stale or unrelated evidence references. Browser navigation
  and keyboard checks remain open.
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

- Direct Goals routes request concepts for saved refinements. Works list and
  detail wait for their saved defaults instead of applying fallback defaults
  on cold entry. Evolution no longer subscribes to unused thinking metrics,
  and Settings reuses the workspace document subscription for both consumers.
  Route contract tests cover the relevant data requirements. Live reads and
  browser timing changes have not been measured.

- Explicit demo and review URLs can fall back to the seeded local workspace
  if Firebase configuration is missing or initialization fails. The fallback
  uses a separate Firebase app with Firestore networking disabled; it does
  not sign in or use production records. A regression test verifies that it
  initializes without the default app and rejects server reads. If browser
  storage cannot be read, the demo opens with seed data; failed writes still
  report an error. Browser startup with missing configuration remains open.
- Session startup no longer waits indefinitely. After ten seconds, it offers
  a retry without treating an unresolved session as a signed-out account.
  Explicit demo and review links also offer a local demo while the session
  check is pending. Choosing it detaches the sign-in listener so late results
  cannot replace the local workspace. Browser checks for this handoff remain open.

- Contextual assistance now cancels credential preparation as well as the
  request, keeps the prompt available on cancellation, and shows failures
  inline. Known offline state stops before requesting credentials. Logic
  tests cover cancellation before work begins, a stalled credential request,
  and malformed error bodies. The production build, 189 logic tests, and 15
  security tests passed. The built server returned `401 auth_required` for
  unsigned GET and POST without contacting the provider. Browser cancellation,
  signed-in quota enforcement, and hosted provider checks remain open.

- Contextual AI now passes request cancellation to the provider fetch and
  rejects incomplete responses before they can be reviewed. Missing provider
  configuration and rejected concurrent requests do not consume local quota.
  Local unsigned GET/POST both returned 401. Typecheck, 154 logic tests, and
  15 security tests passed. Hosted disconnect propagation, verified-user and
  provider failures, and signed-in save/reload still need integration QA.
- Accepted assistance for source, annotation, concept, inquiry, position,
  practice, and profile now queues its optional audit event in the destination
  save instead of a separate browser event. Audit entries reference the review
  ID and do not copy its text. Logic coverage verifies stable event IDs and
  that edits/removals do not count as new acceptances. Typecheck, 152 logic
  tests, and 15 security tests passed. Signed-in provider/rules behavior and
  end-to-end retry semantics still need verification.
- Accepted Context Desk findings now save the Work and its AI-assisted creation
  event together, with review history available in the Work's context panel.
  The review is saved as escaped text; selecting an annotation preserves its
  source link. The shared acceptance listener no longer writes a second event
  for Evolution or Context Desk, copies reviewed text into event metadata, or
  writes to Firestore from the offline demo. Other detail flows still need
  atomic provenance verification. Typecheck, 150 logic tests, and 15 security
  tests passed; signed-in generation and save/reload remain unverified.
- Context Desk selections and exclusions are now isolated by account and
  workspace mode. Old unscoped session selections are not imported. The
  item handoff preserves the current workspace, reports a full desk, and
  the review dialog names the included records. Desktop demo QA verified
  the Meditations handoff and reload persistence without submitting an AI
  request. Selection isolation and cap behavior have logic coverage.
- Normal workspace boot no longer loads the full demo dataset. The production
  bundle has a separate demo/review chunk (134 KiB raw, 34 KiB gzip); the
  workspace entry no longer contains the seeded workspace identity. The local
  browser demo showed the expected seeded counts and navigated to Library
  without console errors. This reduces normal workspace downloads after the
  initial shell, not the shared initial-assets budget.
- Appearance, Works defaults, metacognition, and identity now save with their
  companion documents in one mutation. Companion writes update only the fields
  they own. Demo nested merge behavior has regression coverage. Reduced motion
  persisted after reload in the demo and the original setting was restored.
  Authenticated failure and cross-device sync still need verification.
- Latest production build passed (31 prerendered pages). The performance audit
  measured 667 KB of uncompressed referenced assets on each audited route and
  failed the 400-450 KB budgets. The shared Home HTML references include two
  JS chunks of roughly 199 KB and 238 KB plus 164 KB of CSS; deferred downloads
  and network timings have not been measured by this audit.
- Goals and Home use stable concept IDs for refinements, with legacy tag
  fallback only when there are no stable IDs. A missing concept cannot widen
  the count. The longest practice streak belongs to one practice; days logged
  still count distinct local dates across matching practices. A legacy
  incomplete commitment no longer blocks unrelated saves, and progress
  refreshes preserve unsaved edits. Desktop demo QA narrowed a source goal
  from 15/18 to 9/18, saved it, reloaded Goals, and confirmed 9/18 on Home.
  Signed-in persistence and the remaining goal variants still need UI QA.
- Public Profile uses one allowlisted snapshot for preview and save. Record
  sharing starts empty, requires explicit choices, and caps selections at 12
  per section. Unpublishing writes a disabled snapshot without profile content.
  Demo QA verified zero default choices, one selected concept in the preview,
  and publish cancellation leaving the profile private after reload. Logic
  tests cover omitted private fields, disabled sections, and the selection cap.
  Signed-in publish, slug change, visitor access, and unpublish are unverified.
- Evolution now reads accepted period syntheses from the canonical thinking
  event stream as well as legacy history, without rendering a duplicate when
  both stores hold the same review. New accepted syntheses are AI-assisted,
  and the period prompt is included in the request. Logic tests cover canonical
  decoding, changed values, and local-day date bounds. Desktop demo QA verified
  a 69% to 74% before/after revision and an earlier date excluding later events.
  The date scrubber now labels event counts as changes, not active items. Real
  provider generation and signed-in save/reload are not verified by this pass.
- Context Desk now allocates a bounded excerpt per selected record rather than
  dropping later selections when the linked-memory line cap is reached. The AI
  panel previews comparison-position context and refuses to apply a result if
  the request context changed. The twelve-record bound has regression coverage;
  signed-in generation and acceptance still need browser verification.
- Atlas Connections shows computed map rank as read-only rather than offering a
  strength choice the write layer recalculates. Concept endpoint names resolve
  from current records; missing names no longer fall back to internal IDs in
  the registry. Desktop demo QA confirmed a relationship type edit survived
  reload; the original type was restored. Custom map creation now waits for
  persistence, selects the new map, and keeps inputs on failure. The new map
  survived reload in the demo. Canceling the delete confirmation left the map
  intact and the Connections tab usable. Actual deletion, failed writes, and
  signed-in persistence were not exercised in this check.
- Mobile Atlas now exposes the custom map picker, creation, style, node, and
  delete actions. The controls fit at 390px without page overflow. Single
  relationship removal from Connections and Review uses the shared confirmation;
  typed graph-edge removal also waits for storage. Canceling from Connections
  at 390px preserved the rows and closed the dialog with no console errors.
  Confirmed deletion and simulated storage failure remain open QA cases.
- Works follow-up: dragging and resizing now commit outside React state
  updaters. Drag, resize and reload were verified in the local demo. Fields
  remain directly editable; the pencil opens per-tool tint and opacity.
  Save/reload and phone-width panel fit were verified. Markdown export now
  preserves mind-map parent relationships, with logic coverage for legacy
  branches and timeline details. Full export/import remains unverified.
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
- Home commitment previews now use the same goal-kind, refinement, automatic
  progress, manual progress and completed-check-in calculation as Commitments.
  This removes the old source-only calculation from Home. Browser verified
  matching 15/18, 14/8 and 3/6 values on both surfaces in the isolated demo.
  These are existing goal rules, not new scoring or completion requirements.
- Logic: 122 tests pass. Security: 15 tests pass.
- Typecheck: passes. Lint: no errors, 29 existing warnings (hooks, images, fonts).
- Production build: passes using .next-build-readiness, isolated from preview.
  A restricted Windows run first failed to create a generated folder; rerunning
  with normal folder access succeeded. The latest isolated build after the inquiry
  and concept creation repairs also passed. No release rollout has been performed.
- Local preview: http://127.0.0.1:9097/demo/works/d_agency_notes/.
- Deployment: none for this pass. No production records or sharing choices changed.
- The performance audit was unable to read the current Next build format. It now
  reads the available build manifest and terminated client-reference JSON, and
  includes shared initial runtime assets. A regression fixture prevents silent
  omission of that runtime. The audit now also resolves encoded asset names and
  fails when a referenced file is missing. Removing shared widget imports from
  route fallback screens and keeping startup scripts directly in the document
  head reduced measured initial assets from 667 to 624 KB on workspace routes
  and from 669 to 626 KB on public profile. Both remain above the 400/450 KB budgets. This is a
  measured budget failure, not a measured user-perceived load-time regression;
  deferred app chunks and real-network timings require separate measurement.
  Both startup scripts were found and parsed in the generated Home HTML.
- The persistent workspace now mounts only inside a workspace route group.
  The production route manifest retains the existing Home, demo, Works,
  public profile and legal URLs. Generated Home HTML references the workspace
  layout chunk; Privacy, Terms and Account Deletion HTML do not. The
  performance audit resolves grouped routes through Next's route manifest.
  Its conservative reference totals are still over budget (626/400 KB
  workspace, 627/450 KB public profile); it still includes workspace references
  in the public profile client manifest, so that number is not a measured
  transfer size. Live route-transition and public-profile network checks remain open.
- Performance reporting now separates prerendered document JS/CSS from
  legacy-only scripts and reports an estimated gzip size without changing the
  raw budget. Home, Atlas, Library, Positions and Works reference 626 KB raw
  modern assets (168 KB estimated gzip) and 110 KB legacy-only raw scripts.
  Atlas trace and Works window styles now emit feature-specific chunks and
  are absent from Home's startup stylesheet. The production build passed;
  the raw budget is still unmet, and actual transfers, fonts and later
  workspace downloads are not measured by this report.
- Browser evidence is saved under artifacts/experience-qa (local QA only).
- Recently Deleted now uses the latest eligible deletion for each record,
  rejects stale snapshots and expired restores, and reports the restore
  outcome. The local demo verified inquiry deletion, restoration into the
  inquiry list, and a second deletion appearing exactly once.
- Workspace JSON export now reads persisted workspace collections, settings,
  profile, and account records rather than the active route's data. The demo
  browser downloaded a versioned file with 19 collection entries and 13 Works;
  regression tests cover saved revisions, practice logs, position versions,
  AI settings, and failed collection reads. This is a records export, not an
  uploaded-file archive or an import/restore feature.
- The Firebase emulator verified the same server-only export used by Settings:
  the owner can download saved account, profile, settings, linked annotations,
  Work revisions, and AI-assisted history; another account cannot. Settings
  now distinguishes an offline export failure from other failures and states
  that the JSON excludes uploaded files and cannot restore a workspace.
- Profile is the only place to manage public sharing; Settings links there
  instead of exposing inactive visibility preferences. The Firestore emulator
  verified concurrent URL changes leave one public snapshot, a conflicting URL
  preserves the previous publication, and withdrawal removes visitor access.
  Account deletion now removes all public snapshots belonging to the account;
  emulator coverage includes older URLs and a second cleanup attempt. Deploy
  the matching Firestore rules with the app. Hosted publication, end-to-end
  account deletion, and uploaded-file cleanup are not verified here.
- Account deletion now removes uploaded objects beneath the authenticated
  owner's storage prefix before deleting the workspace and sign-in account.
  The Storage emulator verified Works and Atlas cleanup, retry, and isolation
  from another account with a similar ID. The confirmation stays open on a
  failed request. Before release, verify the App Hosting service account can
  list and delete objects in the configured bucket, review object retention
  and soft delete, and exercise deletion end to end with a disposable staging
  account. No production account or object was deleted during verification.
- Automatic concept placeholders now save in the same operation as the
  record that links them. Equivalent labels share a stable placeholder ID;
  repeated writes do not overwrite a defined concept or add duplicate
  creation history. Existing records were not merged or deleted. Logic
  tests cover normalized matching, preservation, and demo rollback.
- Firebase rules now reject extra top-level public-profile fields and invalid
  visibility values. Five emulator tests passed for private workspace reads and
  exports, history immutability and atomic rollback, profile publish/withdraw
  permissions, concurrent tag saves, and Works upload/read/delete permissions.
  Run `npm run test:rules` with Firebase CLI and Java 21 on PATH. It uses only
  localhost with the isolated `demo-noesis-rules` project.
- Route navigation now resets the main scroll container rather than only the
  browser window, restores the parent list's remembered position, and keeps
  stale loading content out of the keyboard focus order. Route-policy tests
  cover fresh destinations, parent returns, and demo/review isolation.
  Browser verification was not run because access to the local origin was
  declined; desktop/mobile scroll and focus behavior still require a smoke test.
- Inquiries can now form a developing position from the written answer under
  Decide. Conversion saves the position, inquiry backlink and Evolution event
  together. The previous standalone Converted status action was removed.
  Assumptions and links carry forward, while candidate evidence only carries
  forward when its answer matches the adopted answer. The emulator covers
  competing conversion attempts; the UI journey still needs a browser check.
- Inquiry evidence now saves as editable records with independent direction,
  strength, reliability and optional candidate assignment. Unassigned evidence
  no longer changes the user's current view or a candidate's text. Removing a
  candidate leaves its evidence available for reassignment. Tests cover the
  bounded AI context, steelman checkpoint and promotion to a position without
  treating unknowns as evidence. Existing candidate notes are not rewritten.
  Browser verification of the evidence form and reassignment remains open.
- Shared cloud saves reject immediately when the browser reports it is already
  offline, and distinguish a slow pending write from a failed or completed
  save. Works no longer clears its dirty flag merely because the Firestore
  cache matches its editor buffer. A two-client emulator test verified that an
  interrupted write was visible in cache, absent on the server, then persisted
  on reconnect. Browser verification of offline UI remains open.
- Writing and notes can recover a bounded, account-scoped unsaved copy after
  reloading the same tab. Recovery is explicit, is not an autosave, and is
  guarded by the saved document version at commit time. Conflicting copies can
  be downloaded without replacing saved work. Logic tests cover storage
  round-trip, version conflicts and size limits; the emulator rejects stale
  writes. Actual browser reload, physical devices, closed-tab recovery and
  media recovery are not verified by those tests.
- Source deletion retains private annotation records; they do not appear in
  the workspace without their parent source. Restoration makes them visible
  again and atomically recreates missing records from bounded legacy snapshots
  without replacing newer annotation text. The Firestore emulator passed
  source delete/restore with both an existing and a missing annotation.
  Browser verification and retention/purge of retained records remain open.
- Recently Deleted loads its own 30-day lifecycle history instead of relying
  on the 200-event Evolution window. The emulator verified recovery after 201
  newer routine edits, including legacy string dates and Firestore timestamps,
  while excluding expired and recreated items. Settings distinguishes loading
  errors from an empty list. Signed-in deployment verification remains open.
- Route Retry now resubscribes to Firestore instead of refreshing only the
  Next route. Read errors in Settings, Profile and AI preferences are surfaced
  instead of treated as missing records. A slow blocking read offers Retry
  after ten seconds without removing navigation. The Firebase emulator verified
  that a denied listener stays closed and a new listener can read after access
  changes. Browser verification of the timeout and Retry control remains open.
- Annotation deep links now use the same missing-record handling as other
  detail pages, and lookup requires both the source and annotation ID. Route
  tests cover encoded IDs, malformed escapes, and metadata that omits internal
  IDs. Direct-open and return navigation still need browser verification.
- Atlas map nodes now use native buttons with visible keyboard focus. Node
  actions live in the inspector; keyboard activation moves focus there and
  closing returns focus to the node or map control. Quick Link targets are
  keyboard-activatable. Geometry tests verify that clipped focused nodes pan
  into view. Live keyboard, touch-drag, and assistive-technology checks remain open.
- Custom Maps no longer inherit the Auto Map's region filter, and drag previews
  are isolated by map or region. Opening a region switches to Auto Map and
  clears search. The canvas can receive background drags; the zoom readout
  resets pan and zoom, and saved zoom is no longer overwritten on mount.
  Logic tests cover node membership, layout scopes, and saved zoom bounds.
  The updated pan/reset interaction still needs desktop and touch verification.
- Shared workbench steps support Left/Right and Home/End focus movement,
  with Enter/Space still activating the focused step. Shared modal footers
  keep reading order and visual order aligned on mobile, and dialog/sheet
  close controls now have 44px targets at the default interface size.
  Regression tests cover the navigation rules, rendered descriptions and
  footer order. Live keyboard, mobile layout and screen-reader checks remain open.
- App and operating-system reduced motion now apply to programmatic scrolling
  in Works, Annotations and Concepts as well as CSS transitions. Native browser
  controls follow the selected light/dark scheme. A blocked browser storage
  write no longer turns a successful appearance save into a reported failure;
  the current tab still receives the default collection view. Tests cover
  both reduced-motion preferences and blocked storage. The full visual
  palette, device and assistive-technology matrix remains open.
- Accepted Evolution period syntheses use one stable review ID and a
  create-or-confirm transaction. Long reviewed text remains in the synthesis
  record instead of exceeding the history summary field's length limit. The
  emulator verified concurrent identical saves produce one event, and a
  different payload cannot overwrite it. Live provider and browser verification
  remain open.
- Evolution now shows one count for filtered results, distinguishes no matches
  from potentially unloaded history, and labels the bounded synthesis sample
  (up to 20 latest loaded matches). Synthesis retains only source references
  from that sample. Turning Points use recorded action types or confidence
  changes of at least 15 percentage points rather than generic importance or
  title keywords. The date controls have visible keyboard focus. Tests cover
  turning-point classification and source-reference bounds. Browser date,
  older-history pagination and live synthesis verification remain open.

## Still To Verify

Android packaging (2026-11-13): Capacitor sync followed by Gradle
`assembleDebug`, `testDebugUnitTest`, and `bundleRelease` passed. The Android
unit test is a starter test, not workflow coverage. APK inspection confirmed
camera, autofocus, and microphone are optional hardware. The release bundle
is unsigned. This checkout has no native Firebase configuration for Google
sign-in, and no connected physical device was available; signed-in recording,
permission denial, playback, and signed release validation remain open.

Release gate rerun (2026-11-13): production build and dependency audit passed;
typecheck, 171 logic tests, 15 security tests and 10 Firebase emulator tests
passed. ESLint reported 0 errors and 28 warnings. The latest initial-asset
audit remains over budget at 625/400 KB on the measured workspace routes
and 627/450 KB on public profile. GitHub's Security workflow now includes
the logic suite and a separate, pinned local-emulator job. The emulator command
passed locally; the updated GitHub workflow has not run remotely.

After the export verification, the production build, typecheck, 180 logic
tests, 15 security tests, and 13 emulator tests passed. Lint reported 0 errors
and 28 warnings. The startup audit still failed at 626/400 KB raw on the
workspace routes (168 KB estimated gzip) and 627/450 KB on public profile.

Startup comparison: the alternate Turbopack build passed compilation but
measured 633 KB workspace and 617 KB public-profile assets, versus 626 KB and
627 KB with the current webpack build. No bundler switch was made. The audit
now recognizes both manifest formats and fails on oversized assets referenced
directly in prerendered HTML even when the manifest reports fewer bytes.
The comparison measures built assets, not transfer or interaction timings.

The sign-in entry now loads independently of the main workspace. Build
inspection confirmed the separate 207 KiB raw (56 KiB gzip) workspace module
is absent from the initial Home HTML and loaded only after the entry gate
renders an authenticated or demo workspace. Typecheck, production build,
189 logic tests and 15 security tests passed. Shared first-document bytes
remain 626 KiB; signed-in and demo startup timings were not measured.

Works manual save, autosave, and recovery now check the last acknowledged
revision and timestamp before writing. A stale tab preserves a local copy and
blocks subsequent queued saves rather than overwriting the server. A late
workspace snapshot cannot roll the editor back after a successful save. The
Firestore emulator verified sequential acknowledged saves and rejected a
stale save even when the timestamps matched. Typecheck, 194 logic tests, 15
security tests and 17 emulator tests passed. A two-tab browser test of the
conflict banner, download, and return to the current document is still open.

Atlas now indexes direct tag counts once per dataset and keeps relationship
scoring separate from drag coordinates. An isolated Node benchmark with 120
concepts and 2,000 tagged records averaged 398 ms for the old counting pass
and 3 ms for the index. A logic test verifies count parity, including repeated
tags on one record. This is not a browser frame-rate or startup measurement;
large-map interaction on a phone still needs verification.

Demo batch writes now resolve prior values through in-batch overrides and
per-collection indexes instead of reconstructing the full workspace per
write. Regression tests cover delete/recreate/update ordering, batch rollback,
and reads through the legacy profile alias. The full logic suite reached 197
passing tests. This change addresses demo save work, not startup bundle size;
browser timing and sign-in routing were not changed or verified.

Evolution keeps the current view and filters mounted when older history is
requested. Every view can load older events, and a failed request can be
retried without hiding previously loaded changes. Permission failures still
use the normal page error. One extra record distinguishes a full final page
from a page with more history. Live browser pagination and retry still need
verification.

Evolution's timeline now uses one native change filter grouped by event
and object type instead of a strip of 15 chips. Date fields use the selected
control radius, larger mobile targets, and an accessible explanation for a
reversed range. The controls remain beside the count on wide layouts and
wrap on narrower layouts. Typecheck and 197 logic tests passed. Mobile
picker, keyboard and theme verification for this change remain open.

Shared search now cancels pending input when cleared and waits for text
composition to finish. Clear search has a 44px mobile target and returns
focus to the input. Card/table controls announce their selected state, and
related-item lookup can reveal matches beyond its first 12 results. Static
accessibility markup is covered by the 198 passing logic tests; touch,
keyboard and input-method behavior still need browser verification.

The public profile and its private preview now use one section formatter:
empty sections stay hidden, record types use workspace labels, and the
public page uses the same entity icons. Public records are presented in
divided lists rather than nested cards. No publication rules or stored
sharing choices changed. The 199 logic tests cover disabled and empty
sections and the shared labels; hosted comparison remains open.

Goals and Home now count active inquiries using the shared inquiry state
rules. The answered goal counts nonblank saved answers, including converted
inquiries, while the resolved goal still requires resolution. The source
refinement names an inherited category restriction instead of calling it
"Any source type." Regression coverage distinguishes these inquiry measures;
the full logic suite passed 200 tests. Browser verification remains open.

Demo startup now requests the seed and workspace modules concurrently and
mounts the editor only after both are ready. Signed-in routing and the local
demo fallback remain unchanged. The production build and all 200 logic tests
passed. The asset audit still fails (627/400 KiB on measured workspace routes,
628/450 KiB on public profile) and now identifies the largest contributors:
two shared JavaScript chunks at 238 and 199 KiB and global CSS at 163 KiB.
This is a change to request sequencing, not proof of faster browser startup.

Public-profile responses explicitly opt out of browser and shared caches.
The production routing manifest includes the no-store rule for /p/:slug.
Publication and visitor reads now share the same URL validation. Typecheck,
202 logic tests, and the production build passed. The hosted response
headers and withdrawal journey still need verification after rollout;
withdrawal cannot revoke content a visitor already copied.

Contextual assistance now preserves edits when the bounded request context
changes during review. Saving is blocked and the review offers a copy action
instead of discarding work. Structured copy only enables once there is text
marked to keep. This behavior is implemented locally; the stale-review
interaction still needs a browser check.

Settings applies unsaved appearance changes only while the Appearance
section is open. Switching sections restores the last acknowledged theme
without throwing away the draft; Discard preview restores the saved
controls. A failed save leaves the draft available, and the local theme
snapshot excludes unrelated settings metadata. Browser checks of rapid
switching, save failure, and the appearance matrix remain open.

Settings now incorporates incoming changes to untouched fields within a
section without replacing local edits. Appearance saves merge changed
controls only, including the corresponding legacy theme fields when needed.
A logic regression covers an independent font and contrast edit and the
resulting narrow write. Same-field edits are still last-write-wins, and
the signed-in two-tab interaction remains to be tested.

The Firebase emulator verified independent writes from two authenticated
clients against the same appearance document using the app's write builder
and mutation service. Both changes persisted, the compatibility theme write
preserved the existing palette and writing defaults, and an outsider write
was denied. All 18 emulator tests passed. This is persistence and rules
coverage, not a browser or hosted signoff.

The history feed now reads Firestore timestamps and legacy date strings
through separate bounded queries and merges them by date before selecting
the visible page. The emulator verified the merge with interleaved records
from both formats. All 19 emulator tests and 203 logic tests passed.
An expanded emulator regression verified 200, 400 and final 437-event
windows in exact order, and verified another account could query neither
date format. Signed-in browser verification of older-history navigation
remains open.

The mobile sidebar and More sheet now register their actual openers with
the shared dialog primitive for expanded state and focus restoration. More
keeps a stable label and does not masquerade as a page link; the active
destination is still marked inside the sheet. Destination titles can wrap.
Browser verification of focus return and narrow-phone layout remains open.

Mobile pull-to-refresh now cancels interrupted or reversed gestures,
ignores drawing and editing controls, and does not reload while a write is
pending or the workspace is offline. Gesture logic covers cancellation,
direction and the refresh threshold; physical-device verification remains
open.

Atlas Auto Map now retains an explicitly opened concept even outside the
selected region or the eight-node mobile preview. Selecting a visible node
does not reorder the preview; a hidden focus replaces only the last slot.
Custom-map membership remains unchanged. Logic coverage verifies both cases;
device and keyboard-navigation verification of the complete map remains open.

Context Desk now applies a shared exclusion predicate to search, selection,
review and the request payload. Source exclusion also covers directly
referenced annotations and known legacy evidence sources. Stale selection
keys no longer consume slots when adding a valid item. The exclusion logic
has regression coverage; signed-in context review and provider verification
remain open.

Context Desk acceptance now uses a stable review-derived Work ID. The Work,
its backlinks and history are written together, and an identical retry
does not repeat the writes. An altered retry cannot overwrite the Work.
The emulator verified concurrent acceptance produced one Work and one
event and rejected altered content. Signed-in browser verification remains open.

New Work creation and revision events store a compact summary instead of
duplicating editor content and accepted review text in Evolution. The
canonical Work, its versions and deletion recovery snapshots retain their
existing data. No historical records were rewritten. Typecheck and all
209 logic tests passed.

Release gate recheck (2026-11-13): the current startup audit still fails at
627/400 KiB for workspace routes and 628/450 KiB for public profile. CI now
reports the measurements and an explicit warning after a successful build;
the local audit still exits nonzero. No physical device was connected.
The feature branch and main were inspected remotely, but the current
worktree changes have not been pushed or deployed.

Workspace navigation now has a keyboard skip link and moves focus to the
ready destination after a route change. It avoids inert outgoing content and
preserves restored list scroll positions. Local tabs retain their own focus.
Typecheck and 209 logic tests passed; browser keyboard verification is open.

Inquiries, Goals, Home, Profile and workspace attention now share active
inquiry semantics. Partial and provisional answers stay active; suspended
and closed inquiries do not. Home distinguishes reviewing a working answer
from investigating an unanswered question. Logic coverage verifies the
state rules and attention counts; browser verification remains open.

Works-specific chart, image, caption and inline-tool rules now ship with
the editor stylesheet. Production output contains those selectors in a
separate stylesheet not referenced by Home's initial HTML. The workspace
asset audit still fails at 626/400 KiB; visual parity in the editor is
not yet browser-verified.

Startup can retry a missing application script with a guarded reload.
Automatic recovery no longer reloads an open workspace, an offline page,
or a tab where the reload guard cannot be saved. Script execution tests
cover those cases and unrelated resource errors. All 212 logic tests
passed; a live rollout/recovery test remains open.

All eight stages remain subject to the complete acceptance list above. Earlier
feature completion claims do not prove these checks passed. In particular:

- The current local demo rendered Inquiry and Atlas at desktop and 390px
  widths. Inquiry's Frame, Investigate, Answer and Decide steps were visible
  on mobile. A Work linked from Investigate appeared in the demo's linked
  list. Existing Work and Practice links now save both directions together,
  and either picker can repair an older one-sided link. Signed-in verification
  remains open.
- Atlas fits measured node cards inside the canvas without changing saved
  map coordinates. Links use the displayed node positions. The mobile
  canvas no longer shrinks into a clipped remainder below the controls.
  In the local demo, all five initial cards fit at desktop and 390px widths.
  At 390px, full-screen zoom reached 50% with all five card bounds inside
  the canvas, and the inspector and full-screen exit buttons both worked.
  Physical touch gestures and larger custom maps still need verification.
  Inline Atlas now has its own mobile scroll region and leaves vertical
  touch gestures to the page. Touch panning and node dragging are reserved
  for full screen; mouse dragging remains available inline. At 390px,
  the browser confirmed the scroll container, opened the bottom Habit node,
  and switched between inline and full screen with no console errors.
- Find now loads and builds its workspace item index on demand rather than
  deriving Atlas regions and search results during every workspace startup.
  Compared with the prior local production build, the workspace chunk
  containing the sync banner decreased from 235,447 to 204,334 bytes raw;
  the separate Find index chunk is 19,490 bytes raw. This is a build-output
  comparison, not a network timing measurement. The first-document budget
  still fails at 626/400 KiB on workspace routes and 628/450 KiB on public
  profile. A local demo search opened the exact Paterson annotation from
  its preview; a logic test covers two sources sharing an annotation ID.
  Typecheck, targeted lint, all 214 logic tests, and the production build passed.
- Find no longer truncates collections before matching or depends on the
  current route's subscriptions. Opening Find reads the signed-in owner's
  searchable collections; closing it drops the index. Recent previews
  remain in memory for the current workspace, not shared browser storage.
  Exact titles rank above incidental matches, and Find shares the workspace's
  annotation merge. In the demo, a search from Settings opened the exact
  annotation that was beyond the former 25-item cap, with no console errors.
  The emulator verified that all 32 seeded concepts were read, the current
  annotation replaced its nested copy, and guests and other accounts were
  denied. Very large signed-in workspaces still need read-volume and latency
  measurements; the current implementation reads whole searchable collections
  when Find opens.
- Evolution no longer drops all legacy milestones when canonical history
  exists. It prefers the canonical event for matching object, action and
  timestamp, and keeps other milestones. The Belief Revisions filter now
  excludes creation events and revisions of non-position objects. Period
  synthesis sends bounded summaries and recorded changes, not raw event
  metadata. The demo showed 16 merged changes, three Belief Revisions,
  and one revision after applying a June 26 start date with the keyboard.
  At 390px the document had no horizontal overflow, and no console errors
  appeared. Regression tests cover matching milestones and synthesis
  excerpts. Signed-in history and live AI generation remain unverified.
- Inquiry challenge acceptance reads the current inquiry and writes only
  its investigation notes and update timestamp, together with one stable
  AI-assisted event. The emulator exercised simultaneous acceptance from
  two clients, preserved an answer edited in another tab and an existing
  user note, and rejected a new acceptance on an archived inquiry. Ordinary
  inquiry edit snapshots exclude AI challenge text. Live provider generation
  and the signed-in browser review flow remain unverified.
- Commitment check-ins now save independently of unsaved planning edits.
  The due list uses saved goals. Goal saves retain the latest check-ins,
  and a transaction prevents duplicate same-day logs from another tab.
  In the local demo, a check-in changed four due to three due and one
  done. An unsaved title remained editable until reload; after reload,
  the original title and the saved check-in were present. The emulator
  verified concurrent title editing and same-day logging. Hosted signed-in
  verification remains open.
- Profile publication uses the saved identity and philosophy instead of
  unsaved private edits. The confirmation holds the exact reviewed snapshot.
  Profile photos are opt-in on the next publication; this does not silently
  change existing public snapshots. Belief history accepts Firestore timestamps
  and older date strings, and its picker is no longer capped below the
  section's selection limit. The 390px demo showed the saved name, the photo
  switch off, and a working confirmation cancel without console errors.
  Typecheck and 221 logic tests passed. No hosted publication was changed.
- Settings now exposes a Today preference that actually hides or shows the
  commitment summary. The local demo verified save, navigation, reload and
  re-enabling it. A separate check verified an unsaved AI preference survived
  switching sections, without console errors. AI and Today preference saves
  patch only edited fields. The manual AI configuration check times out,
  prevents overlapping checks and reports malformed responses as unavailable;
  it does not verify provider credentials. Hosted verification remains open.
- Today's recent-change feed merges legacy milestones with canonical events,
  deduplicates mirrored changes, and understands Firestore timestamps.
  Annotation links use both source and annotation IDs. Deleted or ambiguous
  records route to Evolution rather than a missing detail. At 390px in the
  demo, a recent revision opened the exact Position workbench with no
  console errors. Logic tests cover mixed dates and annotation routing.
  Today commitment rows now open a focused editor at a dedicated URL.
  At 390px the demo opened only the selected commitment, kept it after
  reload, and returned to the list without horizontal overflow or console
  errors. A missing commitment offered a return to the list. Signed-in
  hosted navigation remains unverified.
- Optional sidebar preferences and legacy demo-draft lookup no longer throw
  when browser storage is blocked. Real demo writes still report storage
  failures. Today visit markers and exercise completion are scoped to the
  active account or demo workspace. Logic tests cover blocked storage and
  key isolation. The browser demo verified sidebar collapse, reload and
  restoration without console errors; blocked storage was not emulated in
  the browser.
- Demo and review routes start downloading the workspace module and preparing
  the local seed data while Firebase checks the session. This does not mount
  the workspace or change which account it uses; the existing gate still
  makes that decision. A fresh local demo tab rendered Today and navigated to
  Library without console errors. The startup ordering changed, but no cold
  network timing improvement has been measured.
- Find, Needs Attention, contextual assistance, and the object preview
  restore focus to their opening control on dismissal. The Find-to-preview
  handoff retains the original opener, and route navigation does not pull
  focus back to the old control. Desktop demo keyboard checks verified
  Enter and Escape for Find, Needs Attention, Socratic Challenge, and
  a Find result preview. This does not replace a full screen-reader audit.
- The Works overlay was checked at desktop width and at 390px. The
  phone layout now keeps the tool above the document ribbons and starts
  scrolling at the first field; Dialectic stacks its stages at phone widths.
  The appearance pencil and Done worked in the local demo without console
  errors. This does not verify physical-device editing or drawing.
- Concurrent placeholder saves passed against the local Firestore emulator.
  Signed-in staging verification and older unexercised promotion callbacks
  still need end-to-end coverage. Explicit source/annotation
  position promotion, inquiry creation and concept creation have been
  repaired; that does not prove every indirect mutation path has been exercised.
- Physical phone keyboard/drawing/camera, deployed Firestore/Storage permissions,
  actual provider AI generation and offline recovery are not browser-demo proofs.
- Full export/import round trips, authenticated deletion/recovery across
  supported item types, every appearance palette,
  every advanced inquiry branch and all public profile combinations need their
  own checks. Home, Goals, Evolution and Source Index have smoke coverage, not
  comprehensive end-to-end signoff.

- Evolution assistance now rejects impossible dates, reversed ranges,
  mismatched period IDs, and selections without change excerpts before
  contacting the provider. Local unauthenticated GET and POST checks both
  returned 401 with private, no-store caching headers. Typecheck, 228 logic
  tests and 15 security tests passed. Authenticated provider output was not
  exercised in this check.

- The workspace now loads the sign-in form only when it needs to display
  it. Compared with the earlier production build, the chunk containing the
  session gate fell from 42,960 to 30,083 raw bytes; the sign-in form is now
  in a separate 13,549-byte chunk. The local browser rendered the signed-out
  form and demo Today without console errors; credential submission was not
  tested. The production build passed, but the first-document budget still
  fails at 627/400 KiB for workspace routes and 628/450 KiB for public profile.
  No network timing improvement was measured.

- Recently Deleted now includes annotations with a known source, including
  older annotation deletions recorded as abandoned. A 390px local demo
  check deleted, restored, and reopened the original Paterson annotation
  after navigation with no console errors. The emulator verified that a
  missing source writes nothing and a duplicate restore cannot overwrite
  the annotation or repeat its history event. All 229 logic and 25 emulator
  tests passed. No hosted recovery was exercised. Workspace JSON remains an
  export only; uploaded files and workspace import are not supported.

- Annotations, Practices, Concepts, Inquiries, and Positions now share a
  card/row click guard that ignores nested controls and portaled menus.
  Position titles provide a keyboard target in card and table views.
  In the local demo, Enter opened the correct Position at 390px and at
  1440px in table view. The Practice Delete menu opened only its
  confirmation at 390px, and Escape dismissed it without a write.
  Typecheck and all 229 logic tests passed; targeted lint reported two
  existing hook warnings and no errors. This is not a full keyboard audit.

- Evolution preserves date-only records without displaying a made-up time.
  Dates use the browser locale, and table rows show the recorded actor for
  canonical events. Collapsed timeline entries preview recorded before and
  after values when both exist. In the 390px demo, June 26 showed two
  matching events and exposed period synthesis; a revision preview showed
  confidence moving from 69% to 74%. Typecheck, targeted lint and 230 logic
  tests passed. The date-only case was verified in tests, not seeded browser
  data, and no provider call or deployment was made.

- Commitment grounding and the Position progress filter no longer share an
  editable value. Legacy records retain their existing selections until
  edited; new records keep these choices independent. A 390px local demo
  save and reload preserved two different selected Positions without
  console errors. The progress regression test verifies that clearing
  the count filter broadens the counted records without dropping the
  grounding. Typecheck and 231 logic tests passed; signed-in persistence
  was not exercised.

- Profile publication pickers now search the available records while keeping
  checked items visible and removable. Selection still requires an explicit
  checkbox and is bounded to 12 per section. Profile Reflection reads
  Firestore timestamps when describing the history range. At 390px, the
  local demo found Meditations, selected it with Space, retained focus on
  its checkbox, and kept it visible under a nonmatching search. No console
  errors or publication writes occurred. Typecheck and 232 logic tests passed.

- Atlas Escape now dismisses the active map layer before exiting full
  screen, ignores portaled control events, and returns focus to the
  relevant control. Zoom buttons communicate their bounds with disabled
  states. At 390px in the local demo, the first Escape closed the
  inspector and kept full screen open; the second exited and focused the
  full-screen button. At 1440px, five zoom-out actions reached 50% and
  disabled further zooming out while leaving Reset available. Typecheck
  and 232 logic tests passed. No hosted or physical-device checks were run.

- Contextual review item titles open focused review at phone widths.
  The focused Edit command moves focus to the editor without selecting
  unchanged text for saving. The review mode exposes its pressed state,
  and entering Focus moves keyboard focus into the review. At 390px the
  demo verified the assistance dialog description and Escape focus return;
  the corrected dialog opened without the prior description warning.
  Typecheck, 232 logic tests and targeted lint passed. Generated-result
  interactions and provider output were not exercised in that demo check.

- Settings now saves only edited fields in every section. The older
  writing-default and metacognition compatibility records are patched
  field-by-field too. Two emulator clients saved different Work Defaults
  concurrently and preserved both changes and an existing older status.
  At 390px, the demo saved Focused editor feel, reloaded it, and preserved
  the existing Belief Review paper style without console errors. Typecheck,
  233 logic tests and 26 emulator tests passed. Hosted persistence and
  navigation away with an unsaved draft were not verified in this pass.

- Unsaved Settings edits now survive in-app navigation in the same
  workspace session. They are not written to disk or applied outside
  Appearance. At 1440px the demo previewed high contrast, returned to the
  saved theme on Today, recovered the unsaved switch on reopening Settings,
  and cleared it through Discard preview. No console errors occurred.
  Typecheck and 234 logic tests passed. A full reload intentionally drops
  unsaved edits; signed-in navigation remains unverified.

- Today and Find now count raw annotations by source and annotation ID
  together. The Find processing shortcut opens the annotation inbox rather
  than previewing a record with an ambiguous ID. Today compares current
  positions with active inquiries and excludes published and abandoned
  Works from its in-progress count. The 390px demo verified the Today
  annotation summary opens the inbox and focuses its heading; the seeded
  demo had zero raw notes, so the Find shortcut was covered by a fixture
  rather than a browser click. Typecheck and 236 logic tests passed.

- Commitment action cadence is separate from review reminders. Paused
  commitments do not accept action check-ins; a skip closes the current
  occurrence without awarding progress. Details show the last check-in
  and its note. At 390px, skipping in the demo changed four due to three
  due and left zero done after reload, with no console errors. Logic
  tests verify the next weekly occurrence and review acknowledgment.
  Typecheck and 238 logic tests passed; hosted check-ins were not tested.

- Cold Chromium contexts against the local production build measured
  same-origin JS/CSS through visible screen controls at 390px and 1440px:
  Today 613 KiB encoded, Atlas 702 KiB, Library 715 KiB, and Works 732 KiB
  before the editor split. Deferring the editor until a document opens
  reduced the Works list to 662 KiB encoded at both widths (2,506 to
  2,248 KiB decoded). Opening the demo Agency document loaded the editor
  with no page errors. This is local asset evidence, not a hosted timing
  benchmark. Production build, targeted lint, security tests and dependency
  audit passed. The first-document budget still fails at 627/400 KiB
  for workspace routes and 628/450 KiB for public profile.

- Library now loads Source Index and the source editor on demand.
  Positions can open the shared concept preview without downloading the
  Library. Cold local production Chromium runs at 390px and 1440px
  measured Library at 700 vs 716 KiB encoded and Positions at 693 vs
  722 KiB through their visible headings. At 390px in the local dev
  demo, Add Source opened and canceled, and Source Index opened with its
  export action. Production build and targeted lint passed (existing
  warnings only). This does not verify provider calls or hosted timing.

- Public profile saves check that sharing choices still match the version
  used for the preview before changing the public snapshot or URL. If a
  newer save arrives, the page offers to discard the stale draft and reload
  the saved choices. The Firebase emulator verified that a stale tab could
  not republish a withdrawn profile and that guest access stayed denied.
  The 390px demo saved reviewed sharing choices without console errors or
  publishing a public page. Typecheck, 238 logic tests, and 27 emulator tests
  passed. Hosted public sharing was not changed or tested.

- Library metadata edits now check the source version used to open the
  editor. A conflict leaves the draft open and rejects the source,
  annotation, and history changes together. The local demo verified
  edit cancellation on desktop and at 390px, and a saved title survived
  reload at 390px without console errors. Typecheck and all 28 emulator
  tests passed, including the stale-source regression. Hosted Library
  persistence was not tested in this pass.

- Interface marks now use display-sized transparent WebP assets. The brand
  mark dropped from 250 to 7.5 KiB and the contextual marks from 351/299 to
  about 10 KiB each. The 48px favicon is 3.6 KiB; the original 512px mobile
  install and maskable icons remain available separately. Local Chromium
  confirmed the brand loaded, the contextual mark followed light and dark,
  and the manifest retained the two install icons. The production build and
  all 15 security tests passed. The separate JS/CSS startup gate remains
  over budget (627/400 KiB workspace, 629/450 KiB public profile).

- Workspace route focus now waits for the destination to render and does not
  treat the triggering element as intentional focus inside the destination.
  Library, Inquiry and Position details derive their selection from the URL
  when routed, so the previous view cannot claim the new route's focus.
  Local Chromium verified the keyboard skip link, heading focus and top scroll
  for Library and Inquiry details on desktop and a Position detail at 390px.
  Browser Back restored Library list scroll and focused its main landmark.
  Typecheck and all three navigation logic tests passed. Other routes and
  assistive technology still need end-to-end verification.

- Concepts and Works now use the active URL to select their routed record.
  The mobile-width Chromium demo opened Agency at the top with focus on its
  heading, then Browser Back returned to the Concepts list. A direct link
  to the Agency Work rendered its named canvas and document text. Typecheck
  and all 238 logic tests passed. This did not test native navigation or
  authenticated Work saves.

- Praxis ignores the retired stored Commitments tab value; Commitments still
  opens from an explicit click. Browser Back closes the route-owned practice
  editor. Legacy timestamps now show valid calendar days in the editor and
  follow the same day boundaries in scheduling. Mobile-width Chromium
  verified the legacy preference fallback, Back, and the two restored date
  fields on a direct practice link with no date warnings after the fix.

- Evolution period reviews now detect changes to the sampled event identities
  or saved source links even when the provider excerpts are identical. The
  additional identity check stays on the device. A regression test covers
  text-identical event and source replacements. At 390px the local demo
  showed two June 26 changes and previewed exactly those two for synthesis,
  with no console errors. Authenticated generation was not exercised.

- Atlas Connections matches region members and directional concept endpoints
  by type and ID. An empty region does not fall back to workspace-wide results;
  when there is no selected region the scope reads All connections. The
  390px demo showed 39 of 48 links for Discipline and 48 of 48 for All
  connections with no console errors. Typecheck and 242 logic tests passed,
  including typed-ID collisions and empty-region coverage.

- Settings save controls now use the same field diff as the save request.
  Clean sections do not offer an enabled no-op, and concurrent section saves
  are disabled while another save is pending. The mobile-width demo verified
  that an AI preference enabled Save, showed one inline confirmation after
  acknowledgment, and survived reload without console errors. The original
  demo preference was restored. Typecheck and 242 logic tests passed; this
  does not verify hosted or cross-device persistence.

- Commitments no longer mounts its permanently hidden duplicate editor and
  tracker controls. The remaining editor distinguishes manual count from
  total progress and explains the existing non-additive rule. Mobile-width
  Chromium verified that raising a manual count from 9 to 10 kept the
  higher automatic total at 13. The test edit was reverted without saving.
  Typecheck and all 242 logic tests passed; signed-in goal saves remain open.

- The populated and empty Today views now use the shell's single main
  landmark. The populated demo showed one main landmark and no document-level
  horizontal overflow at phone, tablet, and desktop widths, with no console
  errors. This is not a screen-reader or physical-device signoff.
- Release recheck after the navigation, settings, and goal changes: lint
  passed with 28 warnings, typecheck passed, 242 logic tests and 15 security
  tests passed, and the Firebase emulator suite, production build, and
  production dependency audit passed. The JS/CSS budget still failed at
  627/400 KiB (workspace) and 628/450 KiB (public profile). Android device
  enumeration returned no connected device. No deployment was attempted.

- A Chromium layout sweep at 320, 820 and 1440px covered Today, Atlas,
  Evolution, Commitments, Profile, Settings, Context Desk, a Library record,
  and a Work. Measured controls did not extend past the main viewport; the
  sweep did not measure controls inside scrolling areas, tables, or tabs.
  Page headers now use the shared route parser, including Praxis and review
  route aliases. The 390px demo confirmed the Praxis heading and that opening
  the Agency Work focuses its named header without focusing an input.
  The local review route reached sign-in; its authenticated header remains
  unverified. Typecheck passed.

- Praxis and Commitments method tabs now use manual keyboard activation.
  Moving focus across routes does not navigate until Enter or Space; local
  tabs still respond immediately to arrows. Shared tabs keep a single Tab
  entry point and use an inset focus ring so the scroll strip does not clip
  it. Chromium at 390 and 1440px verified End, Enter or Space, and automatic
  activation of a local Commitments tab. Typecheck, focused lint, and 244
  logic tests passed. This is not screen-reader signoff.

- Published profile snapshots can still be read by slug, but Firestore
  denies collection listing to guests, other accounts, and owners. Public
  profile HTML asks crawlers not to index or follow the page; this is not an
  access control. An invalid local URL returned the unavailable view with
  no-store and noindex. Typecheck and all 28 emulator tests passed, including
  listing denial, public read by slug, withdrawal, and stale preview rejection.
  Production rules and authenticated hosted publication were not changed.

- AI Assistance now defaults on only in the local seeded demo, and an
  explicitly saved off setting wins there as well as in real accounts.
  At 390px the demo saved off, kept it off after reload, and removed the
  Inquiry Socratic Challenge action. The original preference was restored.
  This verifies the settings-to-feature path without a provider request.

- Evolution Table now renders a compact, real table on phones, with additional
  columns on wider screens. Both views share expandable event details,
  including provenance and saved period reviews. Chromium at 320, 820 and
  1440px verified that the table fit its container and expanded an event;
  keyboard expansion was also verified on desktop. Typecheck and 245 logic
  tests passed. Other collection table modes were not changed here.

- Concepts and Inquiries now honor Table view on narrow screens. Compact
  tables show the record title and state, with more columns at wider widths.
  Chromium verified both tables fit without horizontal scrolling at 320, 820,
  and 1440px. Clicking titles opened the matching records; Space opened a
  Concept at 320px and Enter opened an Inquiry at 1440px. Typecheck and the
  245-test logic suite passed during this pass. Not deployed.

- Library and Annotations now render compact tables on mobile instead of
  switching to cards under the selected Table control. Annotation selection
  and row actions remain present at narrow widths. Chromium at 320, 820 and
  1440px verified that both tables fit without horizontal scrolling and
  that Enter opens a record. At 320px the annotation menu opened and Escape
  dismissed it without deleting anything. No hosted writes were made.

- Works and Praxis now render compact tables at narrow widths. Praxis
  keeps the status filters in both layouts and opens saved practices from
  the detail URL rather than opening a separate editor before navigation.
  Chromium verified both tables fit at 320, 820, and 1440px, Enter opens
  the record, and Back dismisses the Praxis editor at each width. The Works
  overflow opened and dismissed at 320px without opening or deleting a
  document. Typecheck and all 245 logic tests passed. Not deployed.

- Source Index Table now fits narrow screens and keeps selection, citation
  and external-source actions reachable without hover. Title and year
  sorting are keyboard controls with an announced direction when used.
  Chromium verified no table overflow, source title sorting, single
  selection, and keyboard open/dismiss of a preview at 320, 820 and 1440px.
  Typecheck and 245 logic tests passed. Export downloads and clipboard
  permissions were not exercised in this specific check.

- Positions Table now uses the same table at all widths instead of falling
  back to cards. Full claims, confidence, and the next action are retained
  in the compact layout; wider screens show more columns. Chromium verified
  no horizontal table overflow and keyboard entry to the correct detail at
  320, 820, 1440, and 1920px. Typecheck and 245 logic tests passed.

- Atlas separates an in-progress node preview from a completed position.
  Pointer cancellation or lost capture discards the preview without a
  write; successful release uses the last pointer position held by the
  gesture. Panning tracks the initiating pointer and stops on lost capture.
  At 390px the local full-screen map moved a node and restored its original
  bounds after a simulated pointer cancellation. At 1440px a completed drag
  kept its new position on screen. Typecheck and 245 logic tests passed.
  Physical touch and authenticated persistence were not verified.

- Custom Atlas dragging now updates the moved node against the latest stored
  layout instead of saving the whole map. A failed write clears the optimistic
  position and reports the failure. The desktop demo kept a new node location
  after reload. The Firebase emulator preserved simultaneous moves of distinct
  nodes and the map's links, rejected recreating a removed node, and denied an
  unrelated account. Typecheck and all 29 emulator tests passed. No hosted
  custom map or production data was touched.

- Source Index BibTeX uses unique keys for same-author/year entries and
  respects multi-author metadata. Clipboard feedback waits for success;
  denial leaves the preview and download available. At 390px, Chromium
  selected All About Love, observed the controlled clipboard-denial message,
  downloaded the file, and confirmed it contained only the selected entry.
  Typecheck and all 247 logic tests passed. No hosted data was modified.

- Works manual document saves survived reload in local Chromium at 390
  and 1440px; test text was removed afterward. The reload prompt exposed
  a race where autosave could finish before exit and leave a redundant
  recovery copy. Recovery now compares current content with the saved
  content, and its page-exit handler reads the current acknowledged
  version. Chromium confirmed identical copies stay hidden and that a
  differing tab-local copy can be discarded while retaining the saved
  title. Authenticated cross-tab UI conflict coverage remains open.

- Contextual assistance now aborts a pending request when its selected
  context changes or assistance is disabled. Older results cannot be applied
  against changed context; already-reviewed text can still be copied.
  Typecheck and 247 logic tests passed after the change. A signed-in provider
  request interrupted by a preference change has not been exercised.

- A local Chromium route pass returned 200, showed a heading and reported
  zero document-wide horizontal overflow across 15 demo routes at 390 and
  1440px. Separately, the named Settings controls saved light mode, Classic
  (Georgia), square controls, high contrast and reduced motion. Atlas, Works
  document, Inquiry detail and Source detail retained those settings and
  used Georgia for their main headings after direct navigation at 390,
  1024 and 1440px. The original demo settings were restored. These checks
  do not establish full contrast, component layout or physical-device coverage.

- Chromium axe-core checks found and then verified repairs for the mobile
  header landmark, shared Find and Attention accessible names, Atlas node
  labels and desktop filters, Goals progress indicators and check-in
  labels, and Evolution timestamp contrast. The final scan reported no
  violations on the initial Evolution, Goals/Praxis, Profile, Settings,
  Atlas and Context Desk views at 390 and 1440px in the demo's dark Amber
  theme. This does not cover every theme, dialog, keyboard flow, or
  assistive-technology combination.

- The follow-up Chromium axe-core pass covered the initial Home, Concepts,
  Inquiries, Library, Annotations, Positions, Works and Source Index views,
  plus representative Inquiry, Source, Position and Work details. It found
  no violations at 390 and 1440px in the demo's dark Amber theme after
  repairs to headings, metadata contrast, the sidebar landmark, the Position
  comparison picker and document canvas. Works and Library now use real
  title buttons with full-card hit areas; Chromium verified clicking the
  Works card body and Library cover, opening and dismissing the independent
  Works menu by keyboard, and focusing the document canvas at both widths.
  Typecheck passed. Other view states and themes remain outside this scan.

- Fresh Chromium contexts on production builds identified Google Fonts as
  a render-blocking request on Home, Atlas, Library, and Works. The stylesheet
  now loads without blocking first paint and keeps the same font families
  and no-JavaScript fallback. When delayed two seconds in a production
  browser test, the page painted first and the stylesheet applied afterward.
  One unthrottled localhost run per route showed document-ready times of
  45-53 ms after the change versus 195-271 ms before; these are not field
  metrics. The production build passed, but the unchanged size gate still
  fails at 628/400 KiB for workspace routes and 629/450 KiB for public profile.

- Evolution builds summaries only when their view is selected and groups
  events without repeatedly copying growing arrays. Monthly and area
  summaries preserve the chronology already established by the timeline.
  The AI-period sample is computed only when an eligible period is selected
  with assistance enabled. Chromium opened all six views at 390 and 1440px
  and returned to the original timeline content; Arrow Right, Home and End
  selected the expected tabs. Typecheck passed. This reduces unnecessary
  render work; no frame-time improvement or startup-size reduction is claimed.

- Contextual AI tries the configured model before requesting a model catalog.
  A successful model now avoids one provider round trip; only a missing
  model triggers discovery and fallback. Deterministic tests cover primary
  success, ordered fallback, no catalog, quota errors and cancellation.
  Typecheck, 250 logic tests, and 15 security tests passed. An unsigned
  local request returned 401 before any provider contact. Signed-in live
  provider latency and behavior remain unverified.

- The contextual-AI endpoint passed a loopback-only Auth emulator smoke test:
  anonymous and invalid tokens returned 401, unverified email returned 403,
  and a verified account reached settings status and body validation. A valid
  question-only inquiry returned the expected 503 with the provider disabled.
  The synthetic account was deleted, with no workspace reads or provider calls.
  To repeat, run `firebase emulators:start --only auth --project demo-noesis-rules`
  and a local app on 127.0.0.1:9101 with
  `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9198`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-noesis-rules`, a blank
  `GEMINI_API_KEY` (override any local key with whitespace), and
  `NOESIS_REQUIRE_APP_CHECK=false`. Run `node scripts/smoke-contextual-ai-auth.mjs`.
  Hosted App Check and live provider acceptance remain outside this test.

- Works now distinguishes opening a document from editing it. Recently
  Opened shows only actual opens, and the full collection sorts missing or
  invalid activity dates after recorded ones. Blank searches skip text and
  relationship work; active searches use ID lookups instead of scanning
  whole related collections per draft. The 390px demo showed one recorded
  open and correctly filtered a matching and missing query. Typecheck and
  251 logic tests passed. No production timing is claimed for this change.

- Adjusted light Amber's shared accent and light destructive colors after
  mobile Chromium found low contrast on Today and Profile. Dark Amber
  retains its accent and the dark sidebar uses its own attention color.
  Settled light Amber scans reported no axe-core violations on the initial
  Today, Atlas, Evolution, Goals/Praxis, Profile, Settings, Context Desk,
  Works and Library screens at 390 and 1440px. Other palettes and interaction
  states were not part of this check.

- Work recency is recorded when the document route resolves the record, not
  only when a work card is clicked. The write does not block navigation. In
  an isolated 390px Chromium demo, Recently Opened started empty, a directly
  opened document appeared there, and its entry survived reload. Typecheck
  passed. Cross-device recency on an authenticated account was not tested.

- Practices, Home, Goals, the Say/Do commitment view, and workspace search
  use the same completed-practice dates. Legacy timestamp prefixes retain
  their recorded day across time zones; impossible dates, repeated entries,
  and failed observations do not add completed days. Typecheck and all 252
  logic tests passed in America/New_York, with 21 targeted tests passing
  in Pacific/Kiritimati. No stored records were migrated.

- Commitment Say/Do now compares completed days within the commitment's
  active window against elapsed calendar days. Earlier and future logs are
  excluded, and the same day's practice and check-in do not count twice.
  A regression test covers a 30-day commitment checked just after midnight
  on day two. Typecheck and 253 logic tests passed.

- Commitment check-ins now store the local calendar day separately from
  their timestamp; old entries remain readable without migration.
  A regression test verifies cross-date timestamps, day-level duplicate
  protection and invalid calendar dates. In the isolated 390px demo, a
  skip note stayed with its own commitment while switching to another
  commitment and back. Typecheck and 254 logic tests passed.

- Commitment plan saves compare the editor's original plan with the current
  stored plan inside the save transaction. A newer plan is not overwritten;
  the stale editor keeps its draft and can discard it to load the latest.
  Check-ins can still save independently. Typecheck, 255 logic tests and
  29 Firebase emulator tests passed, including two-client verification that
  a check-in survives an edit and a stale save cannot replace the newer title.
  Hosted cross-device behavior was not exercised.

- The public-profile confirmation now includes the exact URL and snapshot
  staged for publication, with the same content renderer as the inline
  preview. Chromium at 390px opened the confirmation by keyboard, verified
  the normalized URL, and confirmed Escape dismissed it and returned focus
  to Save public profile without publishing. Typecheck and 255 logic tests
  passed. Hosted publishing was not exercised.

- Profile sharing now previews the normalized URL beside its field and
  blocks invalid names before opening publication confirmation. Confirm
  dialogs can scroll within a short viewport. Chromium at 320 by 480
  verified the invalid field was focused, a valid preview fit, and Cancel
  closed it without publishing. Typecheck passed.

- Profile form saves now patch only changed authored fields. AI review
  saves no longer rewrite identity fields, and manual edits do not overwrite
  review history or account activity. Explicit avatar clears are preserved.
  Chromium at 390px verified an introduction edit survived reload.
  Typecheck and 257 logic tests passed. Concurrent edits to the same
  profile field and hosted AI acceptance were not verified here.

- Signed-in daily activity records the local calendar day when the workspace
  is visible, including after returning to the tab or reconnecting. A
  transaction preserves concurrent days and existing profile fields, and
  uses the legacy profile when the main record has no activity. Typecheck
  and 30 Firebase emulator tests passed, including two concurrent clients,
  a duplicate day, and a denied write from another account. Hosted
  cross-device activity was not tested.
  A later emulator run covered simultaneous writes to a missing main
  profile. Activity retries a first-write collision once and keeps both
  dates. The workspace now also checks at local midnight while open, using
  the existing local-day hook. Typecheck and all 32 emulator tests passed.
  Two signed-in Chromium runs at 390 px used a controlled New York clock
  and a separate authenticated Firestore emulator read: the open workspace
  retained both dates after local midnight, and going offline across the
  boundary deferred the second date until reconnect, without a reload.

- Settings distinguishes a signed-out AI configuration check from an
  unverified email, an unconfigured provider, and an unavailable check.
  The status is announced and does not imply that a model request ran.
  Chromium at 390px verified the signed-out message and disabled action.
  Typecheck, 15 security tests, the production build, and the production
  dependency audit passed. The current startup audit remains over budget:
  628/400 KiB workspace and 630/450 KiB public profile. Android tooling lists
  a Pixel_8 virtual device but no active ADB target during this check.

- The debug Android wrapper built and ran the local demo on the Pixel_8
  emulator. Library and Inquiries opened from the native WebView. Android
  Back originally went to the launcher with More open; after the fix, Back
  dismissed More within Library and a second Back returned to Today, with
  Noesis still foregrounded. Typecheck passed, and generated Capacitor
  settings were restored to the hosted URL. Emulator console output also
  captured existing Google Auth CSP and early Capacitor safe-area warnings.
  A physical device, permissions for real media capture, and signed release
  behavior remain unverified.

- Release checkpoint: native Firebase initialization no longer configures
  the web popup resolver; browser Firebase Auth retains its helper script
  through an exact CSP path. Capacitor uses native inset handling rather
  than injecting unused safe-area variables. Updated Android debug,
  unit-test task, and release bundle builds passed, as did the web build,
  typecheck and 15 security tests. The release AAB was verified unsigned.
  There was no connected physical device or local Google Services config.
  The two startup warnings need an updated emulator runtime retest; hosted
  sign-in, live Gemini and release signing still require external setup.

- The updated Pixel_8 emulator run did not reproduce the Google Auth CSP
  or early safe-area errors. Denying camera and microphone permissions
  produced an actionable error and kept Record disabled. With runtime
  permissions granted, Capacitor still denied recording because its
  WebView capture request also checks MODIFY_AUDIO_SETTINGS, absent from
  the app manifest. After declaring it, the debug build recorded and
  saved a demo video that decoded and played after reload. The emulator
  was shut down and generated settings restored to the hosted URL.
  Physical-device capture, cloud upload, and signed release remain open.
  Startup audit still reports 628/400 KiB workspace and 630/450 KiB public.

- Recording releases a camera or microphone stream granted after leaving
  the studio or switching documents. Input enumeration is best-effort and
  no longer blocks a successfully opened stream. A 390px Chromium test
  held the permission response, navigated from Works to Library, then
  returned the stream and confirmed the track was stopped. Typecheck passed.

- Android now has an explicit signed-upload build mode. It requires a
  configured upload key, Firebase Android config, and production HTTPS
  wrapper settings. The unsigned bundle and Android unit-test task still
  pass, and the signed mode rejected missing credentials with a specific
  error. No signing credentials were created or used; a signed bundle
  still needs the owner's existing Play upload key and Firebase config.

- Persistent startup script failures now show a plain reload notice after
  the guarded automatic retry, including when offline or storage is blocked.
  The startup recovery script does not reload an open workspace. A 390px
  Chromium test blocked every Next JavaScript chunk and observed exactly
  one retry followed by the visible fallback. Both focused tests and
  typecheck passed. This does not reduce startup bundle size.

- Home now calculates attention once per data change and reuses the result
  for recommendations, the prompt, diagnostics and workspace counts.
  The shared selector indexes position IDs from practices in one pass
  rather than scanning all practices for every position. The regression
  covers repeated links and one practice testing several positions.
  Typecheck and 258 logic tests passed. Startup transfer size is unaffected.

- Firefox loaded Today, Atlas, Evolution, Context Desk, Goals/Praxis, Profile,
  Settings and a Works document in the local demo at 390 and 1440px. All 16
  navigations returned 200, rendered the expected heading, had no document-
  wide horizontal overflow and emitted no uncaught page exceptions. The
  development browser console did emit a microtask warning on initial load.
  These were route smoke checks, not full Firefox workflow or Safari tests.

- Collection covers in Library, Source Index and Works use deferred image
  loading; the selected Library source still loads its cover eagerly.
  A failed source image falls back without suppressing a replacement URL.
  Chromium at 390px blocked external covers, verified a visible fallback
  and opened its source successfully. Typecheck passed; this can defer
  offscreen image requests but does not change the JS/CSS budget.

## Scope Guardrails

Public profiles and legal pages now share theme tokens but not the full
workspace utility stylesheet. Privacy can scroll at both tested viewport
sizes. Chromium verified Today, Library, Atlas, Privacy and the
unavailable-profile route at 390 and 1440 px on a production build, with
no document-wide overflow or uncaught page exceptions. The audit's
regression test confirms that a sibling route's CSS is not counted as
public-profile CSS. The existing startup budgets remain unchanged.

Latest Pixel 8 retest: the local Android app opened Works and recorded
with emulator camera and microphone permissions granted. The clip
saved locally and played after reload (480 x 640). The retest exposed
an internal demo recording reference briefly reaching the video player
before IndexedDB resolved it. The player now waits for a playable URL;
reload and playback passed without a media policy error. The Works
creation dialog also gained an accessible description. Typecheck passed.
This does not verify physical capture, hosted upload, or live Gemini.

Do not replace useful existing capabilities with attractive nonfunctional
mockups. Avoid adding novel features until the core workflow has earned them.
Do not deploy migrations, discard records, change public visibility, or claim
Play Store readiness without the corresponding verification.
