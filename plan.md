# Plan: a timetable I wish ANU had

Scratch working document, not a submission artefact — captures the decisions
before touching code, so they can be reviewed before any implementation
starts. `PROCESS.md` will cite the commits that follow this, not this file
itself.

Revision 3: fixes the swap/clash ordering bug from review, models real
variable-shaped activities (not a fixed set of four kinds), moves the grid to
half-hour granularity, enforces one-pick-per-activity in the database itself,
places the Remove control, handles long session lists, generates seed data
from a deterministic function instead of hand-typing it, and de-prioritises
the no-JS fallback relative to the JS partial-update path (the actual point
of this prototype). Supersedes revision 2.

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

picks
  id          int pk autoincrement
  owner_id    text not null         -- from the anonymous per-browser cookie, §7
  session_id  int not null -> sessions.id
  activity_id int not null -> activities.id   -- denormalised, see below
  created_at  text not null default (datetime('now'))

  unique (owner_id, activity_id)
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
  - **No Remove control on the grid itself** — clicking/tapping a block
    only previews/inspects it (whatever §6 of the highlight design calls
    for), so a stray tap while scanning the grid can't accidentally remove
    a pick. Removal is a deliberate action taken in the panel, per above.

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
- `spec/invariants.test.ts` and `spec/readme.test.ts` untouched;
  `spec/routes.ts` stays `["/", "/readme/"]`.

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
entry and a note to you at each milestone. **First milestone, and the only
one to build before the next review: schema + migration + seed generator +
a readable console/log summary of what was seeded** (per course: its
activities, each activity's session count, and its time range) — no pages,
no API routes, no UI yet. Stop there and wait for review before continuing
to the grid/panel skeleton.

## 13. Open questions for review

- None blocking — revision 2's open question on Add-button scope is
  resolved (per-row, kept). Remaining judgement calls (exact 4 courses, the
  per-course colour palette, the specific per-course activity shapes and
  which slots are forced to clash) will be made concretely inside the
  seed generator at milestone 1, where they're easiest to see and adjust.
