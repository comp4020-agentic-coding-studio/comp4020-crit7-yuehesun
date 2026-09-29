# Plan: a timetable I wish ANU had

Scratch working document, not a submission artefact. It records decisions
before code so I can review them.

I want to build a better ANU course-enrolment timetable page for this crit. Before writing any code, please produce a plan, write it to plan.md, and wait for my review before doing anything else.

**Basis**
First read the C7 brief and spec (https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/07-anu-system/, plus the spec that ships with the starter and the spec/ directory in this repo). The whole project should be grounded in them.

**The problem**
In the current ANU enrolment page, the main area is my own timetable, and the course titles are listed in a left-hand navigation bar. To see all the available time slots for a course, I have to click its title in the left bar; clicking through from the timetable only shows the one slot I already chose. Once I click in, I only get a list of slots, so I can't see my timetable at the same time and can't compare options against it. Going back to the timetable makes the whole page reload.

**What I want**
Clicking a course shows its available slots as a list on the right side of the page, while the timetable stays in the main area. Clicking a slot in the list highlights the matching area on the timetable. No more going in and out of pages or reloading; each click only updates a small part of the page.


**Status** (change after every stage is done)
- Stage 1 is done and committed: schema, migration, seed generator, its
  spec test, and `pnpm db:summary`. `pnpm check` is green (verified again
  before Stage 2 planning: 4 test files, 29 tests, 0 typecheck errors).
- The starter's messages/SSE/guestbook code is already deleted and
  `index.astro` is a placeholder page.
- **Stage 2 is now planned and approved — see §12.** Ordered as 2a
  (server-rendered shell + ownership) → 2b (write path + clash logic +
  `spec/timetable.test.ts` — the point where the spec's hard "persists
  across a reload" requirement is actually met) → 2c (JS partial-update +
  preview highlighting) → 2d (ship: fix the CI conflict below, deploy,
  docs). Stop after 2b if time runs out; it's already spec-satisfying.
- **Found reviewing the plan: `.github/workflows/checks.yml`'s `deploy` job
  still has a step verifying `/api/events` streams — the starter's SSE
  endpoint, deleted in Stage 1.** Untouched since the initial commit. Once
  the repo goes public, this will fail every deploy even though the app
  itself works. Fix is in Stage 2d: remove that verification step (the
  other deploy checks — HTTPS origin, CSRF, site-online, link check — stay).
- Also found: `src/pages/readme.astro`'s nav still says "Guestbook" instead
  of "Timetable" (starter leftover). One-line fix, folded into 2a.
- The new migration has not been run on the Fly volume yet — 2b is the
  first safe point to deploy and check.
- Deadline: Wed 30 Sep 2026, 12:00 (Australia/Sydney). Prefer a deployed,
  spec-satisfying version first; interaction polish comes after.


## 1. The slice

C7's brief: pick an ANU system that reliably ruins your week and build the
full-stack replacement you wish existed. Chosen slice: **building a
clash-free personal timetable from a small set of course offerings** —
browse courses, see each one's activities and their alternative sessions,
preview a session against your existing picks, commit one session per
activity, and get told immediately — before it's saved — if it collides
with something you already have.

End-to-end flow, all in SQLite: pick a course → preview a session (client
side, no write) → Add → server validates against your existing picks →
either it lands in your grid, or it doesn't and you're told why.

## 2. Data model (my call — nothing in the brief or spec dictates this)

Four tables in `src/lib/schema.ts`, replacing `messages` entirely:

```
courses
  id      int pk autoincrement
  code    text unique not null      -- "SLOP4225"
  title   text not null
  color   text not null             -- hex, one per course, hand-picked for contrast

activities
  id         int pk autoincrement
  course_id  int not null -> courses.id
  code       text not null          -- "LecA" | "LecB" | "TutA" | "ComA" | "Asm" — free text, not an enum

sessions
  id            int pk autoincrement
  activity_id   int not null -> activities.id
  day           int not null        -- 0=Mon .. 4=Fri
  start_minutes int not null        -- multiple of 30; minutes since midnight
  end_minutes   int not null        -- multiple of 30
  location      text not null       -- invented room

  unique (id, activity_id)          -- lets picks reference the pair, see below

picks
  id          int pk autoincrement
  owner_id    text not null         -- from the anonymous per-browser cookie, §7
  session_id  int not null
  activity_id int not null          -- denormalised, see below
  created_at  text not null default (datetime('now'))

  unique (owner_id, activity_id)
  foreign key (session_id, activity_id) references sessions (id, activity_id)
```

Changes from revision 2, and why:

- **`activities.code` replaces the fixed `kind` idea.** Real course
  structures vary: some courses run two lecture streams that each need their
  own pick (`LecA`, `LecB`), some use a computer lab instead of a tutorial
  (`ComA`), some add an assignment-consultation slot (`Asm`). None of that
  is a fixed set of kinds, so `code` is free text decided per-course by the
  seed data (§3), not a column with a hardcoded set of allowed values. It
  doubles as the short label shown in the UI (§4) — no separate long-form
  label column, since nothing in this UI needs one.
- **`picks.activity_id` is new, and denormalised on purpose.** The
  "one session per activity per owner" rule now has a real database
  constraint behind it (`unique (owner_id, activity_id)`), not just app-level
  discipline — see §5 for exactly how a write stays consistent with it. This
  is the fix for the swap-ordering bug flagged in review: the constraint
  only means anything if `activity_id` lives on the row being constrained,
  so it has to be written alongside `session_id`, not looked up separately
  by a second query that could drift.
- Everything else — `start_minutes`/`end_minutes` as integers for a plain
  comparison clash check, no `description`/`level`/`term` on `courses`,
  `owner_id` cookie-scoped ownership — carries over from revision 2
  unchanged.

**Revision 4 addition — closing the denormalisation gap.** Denormalising
`activity_id` onto `picks` (above) only pays for itself if the database can
actually stop it disagreeing with `session_id`. Fixed with a composite
foreign key rather than a test-only guarantee: `sessions` gets a
`unique (id, activity_id)` constraint (free, since `id` is already unique —
this doesn't allow any new rows, it just makes the pair addressable), and
`picks.(session_id, activity_id)` is declared as a composite foreign key
against it. Since a given `sessions.id` only ever pairs with its own real
`activity_id` in that unique index, the only `activity_id` value SQLite will
accept for a given `session_id` *is* that session's actual activity — a
mismatched pair is rejected at insert time, not just avoided by careful
application code. §10 adds a test that deliberately attempts a mismatched
insert and asserts SQLite rejects it, so the constraint itself is exercised
by the suite rather than trusted by inspection.

## 3. Seed data

Per the standing decision in `README.md`: no real ANU data, course-level
content reused from the fictional A2 gallery. **4 courses, one term**,
unchanged from revision 2. What's new: **seeding is generated, not
hand-typed.**

`src/lib/seed.ts` exports a pure, deterministic function — fixed inputs in,
identical rows out, every run (including CI's throwaway database and a
fresh clone). Concretely:

- The 4 courses (code, title, hand-picked colour) are a small literal array
  — that part *is* hand-typed, since it's copied straight from the gallery
  and there's nothing to generate.
- Each course's **activity list is authored, not derived**: which
  activities it has and how many alternative sessions each one gets is a
  deliberate per-course choice, e.g. one course gets `LecA` (1 session) +
  `TutA` (6 alternatives); another gets `LecA` + `LecB` (1 session each,
  both compulsory picks) + `ComA` (4 alternatives); realistic tutorial-sized
  activities get 5–6 sessions, at least one gets 10+ to actually exercise a
  long list (§4). This variety is the point of §2's redesign, so it's
  written by hand per course rather than randomised.
- **Session times within each activity** are generated by a small seeded
  PRNG (a fixed numeric seed, e.g. a plain 32-bit LCG/mulberry32 inline —
  no new dependency), placing each session on a half-hour boundary within a
  working window (09:00–18:00, Mon–Fri). Seeded, not `Math.random()`, so
  the same rows come out every time.
- A handful of specific slots are **deliberately forced to overlap** across
  courses (e.g. two different courses each get a session at the same
  day/time) — written explicitly, not left to chance, so the clash flow is
  guaranteed demoable rather than hoping the PRNG happens to produce one.
- `seedIfEmpty()` in `src/lib/db.ts` calls this generator once at boot,
  after `migrate()`, only if `courses` is empty — same mechanism as before,
  still no live fetch of the gallery site at runtime.

**Guaranteeing a clash-free full selection exists (revision 4).** A
generator that scatters every alternative session with a seeded PRNG and
separately forces a few deliberate overlaps has no reason to guarantee that
picking *one session per activity, across all activities in all 4 courses*
is even possible without a clash somewhere — and if it isn't, the demo has
no "happy path" to show. Checking this after the fact would mean a
combinatorial search (activities × alternatives across 4 courses is too
large to brute-force honestly). Instead it's **guaranteed by construction**:

1. The generator first builds one **baseline session per activity** —
   chosen so that, across every activity in all 4 courses, no two baseline
   sessions overlap. This is the reference clash-free selection, built
   directly (placing each activity's baseline in a free slot relative to
   the baselines already placed), not searched for.
2. Each activity's *remaining* alternative sessions (to reach the realistic
   5–6, or 10+, count) are then generated around that baseline using the
   seeded PRNG — free to overlap each other or the baselines, since realism
   is the point, not clash-freedom.
3. The specific forced-clash pairs (above) are added as extra alternatives
   distinct from the baseline sessions, so forcing a clash can never
   accidentally remove the guarantee from step 1.
4. The generator's return value exposes which sessions are the baseline
   (e.g. a `baseline: true` flag, or a separate `baselineSessionIds` list)
   so §10's test can assert non-overlap directly against that known set —
   a property check, not a search.

**Re-runnable seeded-data summary (revision 4).** `pnpm db:summary` (new
script, `scripts/seed-summary.ts`) connects to the real `DATABASE_PATH`
database — the same one the running app uses, not a re-generation — and
prints, per course: its activities (code), each activity's session count,
and its time range (earliest start–latest end, as `HH:MM`). It also lists
the 4 gallery courses used (code + title, straight from the `courses`
table), specifically so you can cite them by name in `PROCESS.md`/`README.md`
for crediting. Re-runnable rather than a one-off log line, so it can be
checked again anytime the seed changes, without re-reading the generator's
source to find out what it produced.

## 4. Page and layout — one page

Everything lives at `/`. Three regions:

- **Left — course list.** The 4 seeded courses, colour swatch + code +
  title. Selecting one loads its activities into the right panel.
- **Right — session panel.** The selected course's activities, each a
  heading (its `code`, e.g. "TutA", with a check mark if it already has a
  pick) and its candidate sessions listed under it, each row showing
  time/location plus its own explicit **Add** button (kept from revision 2
  — per-row, not one shared button). The row for whichever session is
  *currently picked* for that activity shows a **Remove** button instead of
  Add (this is where Remove lives — see below).
  - **Long lists (10+ sessions):** each activity's own session list is a
    fixed-height scroll region (`overflow-y: auto`, roughly 6 rows visible)
    rather than letting it stretch the whole panel — the same rule on both
    viewports, so a 10-session tutorial behaves identically on desktop and
    phone instead of needing separate mobile logic. The panel's outer
    container also caps its own height and scrolls independently of the
    page/grid on desktop; on phone, where everything is stacked (below),
    it's allowed to take the width it needs and the page scrolls normally —
    only the *individual activity's* session list gets its own internal
    scroll everywhere.
- **Main — the week grid**, now with **half-hour granularity**: the header
  row shows whole-hour labels only ("09:00", "10:00", …), but each hour
  spans two internal half-hour row-tracks, so a session starting or ending
  on the half-hour occupies exactly one of those tracks rather than
  rounding to the nearest hour. The grid's overall time range is the
  earliest session start and latest session end **rounded outward to whole
  hours** (so a 09:30 start still gets a full "09:00" header and a visible
  half-empty first hour, rather than an orphaned half-hour column). Rows
  are computed from the seeded sessions, not hardcoded. Committed picks
  render as solid blocks in their course's colour spanning their half-hour
  tracks, course code + activity code visible in the block.
  - **No Remove control on the grid itself, and clicking a block is fully
    defined (fixes the undefined behaviour flagged in review):** clicking
    or tapping a committed pick's block selects that pick's course in the
    left list and opens its activities in the right panel (scrolled/focused
    to the relevant activity), so you can inspect or swap it from there. It
    never removes anything and never previews anything else — it's
    navigation to the panel, not a grid-level action. Clicking an empty
    grid cell (no pick there) does nothing, since an empty cell isn't
    associated with any one session until a panel row is hovered/focused.

`/readme/` is the only other route; `spec/routes.ts` stays `["/",
"/readme/"]`.

### Responsive behaviour (both marking viewports)

- **1920×1080**: three-column layout — course list, grid, session panel
  side by side, grid getting the most width.
- **390×844**: stacked, single column — course list, then session panel,
  then the grid, in its own `overflow-x: auto` horizontal-scroll container
  (5 day columns don't compress to phone width legibly).

## 5. Interaction model — priorities and no-JS fallback

**The JS-driven partial update is the core idea of this prototype and gets
built and polished first.** Preview (hover/focus/tap, §8) is JS-only by
nature. Add/Remove/swap are real forms POSTing to `/api/picks*`, but the
priority order is:

1. Get the `fetch`-intercepted submit path right: POST, read the JSON
   response, patch only the affected grid cell(s) and the panel's
   check-mark/Add-vs-Remove state — no navigation, no full re-render. This
   is what the crit demo shows.
2. The plain-POST, no-JS path (303 redirect back to `/`, full reload,
   state reflects from a fresh server render) exists as a correctness net,
   not a polished second UI — `spec/timetable.test.ts` (§10) exercises the
   HTTP layer directly anyway, which is what actually keeps it honest. It
   should *work*, but isn't where design or testing effort concentrates.

**My view on how the JS path should render (not building this yet — a note
for when Stage 2+ gets there).** Two options for what the `fetch`
response carries: (a) JSON describing what changed, with client-side JS
reconstructing the grid-cell/panel markup from it, or (b) server-rendered
HTML fragments (a small JSON envelope of named snippets, e.g. `{ gridCell,
panelActivity }`) that the client swaps in directly (`element.outerHTML =
fragment`). I'd reach for (b). This app is Astro SSR with no client
framework or state store — option (a) means a second, hand-maintained
implementation of "what a picked session looks like" living in client JS,
which can drift from the server-rendered version the full-page load and the
no-JS fallback already use. Option (b) means exactly one rendering
implementation (an Astro partial/component reused by the full page and by
the API route for its fragment response); client JS shrinks to "swap this
node's HTML in" plus the preview highlight logic (§8), which was always
client-only. Worth reconsidering only if a need for client-side state that
has no server round-trip shows up later — nothing in this plan needs that.

## 6. Clash handling — including the swap fix

Checked **only on the server**, at Add time. Corrected ordering (this is
the bug fix from review — checking now happens *before* any delete):

1. `POST /api/picks` receives a target `sessionId`, looks up its
   `activityId`.
2. Look up whether this owner already has a pick for that `activityId` (the
   "old" pick, if any — this is the swap case).
3. **Clash-check the candidate session against all of this owner's *other*
   picks, explicitly excluding the old pick found in step 2** (since it's
   about to be replaced, it must never count as a clash against itself).
   Overlap test: same `day`, and `start < otherEnd && otherStart < end`.
4. If step 3 finds a clash: **reject — nothing is written**, old pick (if
   any) stays exactly as it was. This is the fix: revision 2's ordering
   would have deleted the old pick first and only then discovered a clash,
   leaving the owner with neither the old pick nor the new one.
5. If no clash: in one transaction, delete the old pick (if any) and insert
   the new one (`session_id`, `activity_id`, `owner_id` together, satisfying
   the `unique (owner_id, activity_id)` constraint from §2 by construction
   rather than by catching a constraint violation).
6. On reject: no-JS path 303-redirects to
   `/?clash=<candidateSessionId>&with=<existingSessionId>`; the page reads
   those server-side and renders a `<dialog open>` naming both sessions.
   With JS (the priority path, §5), the same information comes back as
   JSON (409 status) and the page calls `.showModal()` instead of
   navigating.
7. While the dialog is open, the grid cell of the **existing** clashing
   session gets the clash visual (warning icon + text, §8) so the dialog
   and the grid agree on what collided; it clears when the dialog is
   dismissed.

## 7. Ownership: anonymous per-browser id

Unchanged from revision 2: `src/middleware.ts` sets an `owner_id` cookie
(generated with `crypto.randomUUID()` if absent) on every request —
`httpOnly`, `sameSite=lax`, long-lived. Every query and write in
`src/lib/db.ts` takes `ownerId` explicitly. No login, no visible identity —
purely a partition key so simultaneous crit visitors don't trample each
other's timetable.

## 8. Highlight design (visual states)

Unchanged from revision 2 — still the governing spec for grid-cell states:

- **Unselected**: plain white, no effect.
- **Preview** (hover / keyboard focus / tap): raised shadow + thicker
  border + semi-transparent fill in the course's colour; text stays dark,
  set explicitly, readable over any course's partial fill.
- **Selected**: solid fill in the course's own colour, no thick border,
  course code (now: code + activity code, e.g. "SLOP4225 · TutA") visible
  inside the block.
- **Clash**: warning icon + text on the existing session's cell, alongside
  the dialog — never fill alone.
- **Palette**: 4 fixed, hand-picked light/pastel hex values, one per
  course, chosen so dark text meets 4.5:1 against the *solid* fill (the
  binding case).
- **Motion**: one ~0.2s transition, wrapped in
  `prefers-reduced-motion: no-preference`; no flashing anywhere, including
  the clash state.
- **Touch**: the same highlight class toggles on `touchstart`/`click` as on
  hover/`:focus-visible`, so phones without `:hover` still get preview.

## 9. What's dropped

Unchanged from revision 2: SSE (`src/lib/events.ts`,
`src/pages/api/events.ts`, and `spec/guestbook.test.ts`'s broadcast
assertion all deleted — per-browser ownership means no other client needs
to hear about a pick); the two-page split; `courses.description/level/term`;
accounts, capacity/quota/waitlisting, prerequisite checking.

## 10. Spec tests

- Delete `spec/guestbook.test.ts`.
- Add `spec/timetable.test.ts`:
  - a pick **persists across a reload** for the same `owner_id` cookie.
  - **two different cookies** get independent picks (ownership isolation).
  - picking a second session in the **same activity replaces** the first —
    and, specifically, **replacing into a session that clashes with a
    different pick is rejected, leaving the original pick in that activity
    untouched** (the exact bug fixed in §6 step 4 — this test is the
    regression check for it).
  - a **genuinely overlapping** add (not a same-activity swap) is rejected,
    pick count unchanged, response identifies the clashing session.
  - a **non-overlapping** add from a different course succeeds.
  - the database itself refuses a second row for the same
    `(owner_id, activity_id)` — a direct test of the `unique` constraint
    from §2, independent of the application logic that's supposed to avoid
    triggering it.
  - the database itself refuses a `picks` row whose `(session_id,
    activity_id)` pair doesn't actually match a real session — a direct
    test of the composite foreign key from §2.
- `spec/invariants.test.ts` and `spec/readme.test.ts` untouched;
  `spec/routes.ts` stays `["/", "/readme/"]`.

**New — `spec/seed.test.ts`, testing the generator itself** (a pure-function
unit test, no HTTP calls; matches `vitest.config.ts`'s existing
`spec/**/*.test.ts` glob, though it doesn't depend on the running-server
`global-setup.ts` the way the HTTP-level tests above do):

  - every generated session's `start_minutes`/`end_minutes` are multiples
    of 30, and `end_minutes > start_minutes`.
  - the baseline set (§3) is mutually non-overlapping — the clash-free
    full-selection guarantee, checked directly against the known baseline,
    not searched for.
  - each pair the generator deliberately forced to clash (§3) actually does
    overlap in the generated output — catching a typo/off-by-one in the
    forcing logic itself, not just trusting it was written correctly.

## 11. Verifying what tests can't: human judgement, in a real browser

Unchanged in substance from revision 2 — checked by hand against the built
app at both marking viewports: the four highlight states (incl. contrast
across all 4 course colours, reduced-motion actually suppressing the
transition), the clash `<dialog>` as a real modal with JS and as a visible
`<dialog open>` without it, the three-region layout at 1920×1080 vs. the
stacked layout at 390×844, and — new in this revision — that a 10+-session
activity's scrollable sub-list actually scrolls instead of overflowing, on
both viewports. Since `axe`'s `color-contrast` rule is disabled in
`spec/invariants.test.ts`, the contrast check here is the only place it's
actually verified.

## 12. Process

Per `CLAUDE.md`: commits land incrementally, with a `process-notes.md`
entry and a note to you at each milestone (a `process-notes.md` moment —
not the same thing as a build stage; see the Status line above). Work is
broken into stages; **Stage 1 and Stage 2 are both approved to build.**

### Stage 1 (done — see the Status line above)

- `src/lib/schema.ts` — the four tables, including the `unique
  (owner_id, activity_id)` constraint and the `sessions (id, activity_id)`
  / `picks (session_id, activity_id)` composite foreign key.
- the migration `pnpm db:generate` produces from it.
- `src/lib/seed.ts` — the deterministic generator: the 4 hand-typed courses
  (real gallery entries), authored per-course activity shapes, seeded-PRNG
  alternative sessions, the constructed clash-free baseline, and the
  deliberately forced clash pairs.
- `spec/seed.test.ts` — the generator's own invariants (30-minute
  multiples, `end > start`, baseline non-overlap, forced clashes real).
- `pnpm db:summary` (`scripts/seed-summary.ts`) — reads the live database
  and prints the per-course/per-activity summary, plus the list of the 4
  gallery courses used for crediting.

**No pages, no API routes, no UI in Stage 1.**

### Stage 2 (approved — reviewed 2026-09-30, deadline day)

Ordered so a deployable, spec-satisfying app exists as early as possible;
each sub-stage ends with `pnpm check` green and is independently
deployable. **Stop after 2b if time runs out** — the spec's hard
requirement ("the core flow persists across a reload") is already met
there; 2c is the interactive polish the crit demo shows off, not a spec
requirement.

- **2a — ownership + server-rendered shell, no API, no JS.**
  `src/middleware.ts` (the `owner_id` cookie, §7); read helpers in
  `src/lib/db.ts` (`listCourses`, `listActivitiesWithSessions`,
  `listPicksForOwner`); `index.astro` rendering the real 3-region layout
  (§4) from seeded data, course selection via `?course=<id>` plain links so
  it works with JS off; the responsive CSS (both viewports) and the
  scrollable long-session sub-list, since the 11-session `TutA` needs it to
  be usable the first time it renders, not as later polish; fix
  `readme.astro`'s leftover "Guestbook" nav label.
- **2b — write path: Add/Remove/swap + clash logic (§6).** `POST
  /api/picks` implementing §6's algorithm exactly (resolve activity → find
  old pick → clash-check against every *other* pick, excluding the old one
  → reject-nothing-written on clash, else transactional delete+insert); a
  remove endpoint; the no-JS `<dialog open>` clash path (§6 step 6);
  `spec/timetable.test.ts` (§10) written alongside, including the
  swap-into-clash regression test for the bug already logged in
  `process-notes.md`. First safe point to deploy and check the Fly volume.
- **2c — JS partial-update layer + preview highlighting (§5/§8).**
  Fetch-intercepted Add/Remove patching only the affected grid cell/panel
  row, via server-rendered HTML fragments (§5 option (b) — one Astro
  partial reused by the full page and the API's fragment response, so
  there's exactly one implementation of "what a picked session looks
  like"); the 409-clash path opening the same dialog via `.showModal()`;
  the 4 preview/selected/clash highlight states (§8); the defined grid-click
  navigation behaviour (§4).
- **2d — ship.** Remove the stale SSE-verification step from
  `.github/workflows/checks.yml` (Status line above); deploy; the manual
  browser pass from §11 at both viewports; update `process-notes.md`,
  `PROCESS.md`, and `reflections/crit-7.md`.

## 13. Open questions for review

- None blocking — revision 2's open question on Add-button scope is
  resolved (per-row, kept). Remaining judgement calls (exact 4 courses, the
  per-course colour palette, the specific per-course activity shapes and
  which slots are forced to clash) will be made concretely inside the
  seed generator during Stage 1, where they're easiest to see and adjust.
