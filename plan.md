# Plan: a timetable I wish ANU had

Scratch working document, not a submission artefact — captures the decisions
before touching code, so they can be reviewed before any implementation
starts. `PROCESS.md` will cite the commits that follow this, not this file
itself.

Revision 2: single-page grid UI, choose-one-of-several-sessions modelling,
per-browser ownership, server-checked clashes with a native `<dialog>`,
responsive at both marking viewports, SSE dropped. Supersedes the two-page,
shared-timetable version.

## 1. The slice

C7's brief: pick an ANU system that reliably ruins your week and build the
full-stack replacement you wish existed. Chosen slice: **building a
clash-free personal timetable from a small set of course offerings** —
browse courses, see each one's alternative sessions (a lecture time, several
possible tutorial times), preview a session against your existing picks,
commit one session per activity, and get told immediately — before it's
saved — if it collides with something you already have.

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
  kind       text not null          -- "Lecture" | "Tutorial" | "Lab" | "Seminar"

sessions
  id            int pk autoincrement
  activity_id   int not null -> activities.id
  day           int not null        -- 0=Mon .. 4=Fri
  start_minutes int not null        -- minutes since midnight; plain integer comparison for clashes
  end_minutes   int not null
  location      text not null       -- invented room

picks
  id          int pk autoincrement
  owner_id    text not null         -- from the anonymous per-browser cookie, see §5
  session_id  int not null -> sessions.id
  created_at  text not null default (datetime('now'))
```

Changes from the first draft, and why:

- **`activities` sits between courses and sessions.** This is the actual
  shape of "choose one of several alternatives" — a course has a Lecture
  activity (one session, take it or don't) and a Tutorial activity (several
  candidate sessions, pick exactly one). Modelling this as its own table,
  rather than a `kind` column on `sessions`, is what makes "only one session
  per activity can be picked" an enforceable rule instead of a convention:
  the app looks up *existing picks for this activity* before writing a new
  one, and if found, replaces it (choosing a different tutorial time swaps
  your pick, it doesn't add a second one) — a delete-then-insert in one
  transaction, not a second unique constraint to maintain.
- **`picks.owner_id`** replaces the single shared list from the first draft.
  §5 covers why.
- **Dropped `description`, `level`, `term` from `courses`.** None of them
  are shown anywhere in this UI (no catalogue browsing, no filters, and all
  four seeded courses share one term by design — see §3) — kept out per
  "drop columns the UI doesn't use" rather than carried along as unused
  provenance.
- **Added `courses.color`.** The highlight design (§6) needs one fixed,
  contrast-checked colour per course; hand-picking and storing it is more
  predictable than deriving one at render time.
- **`start_minutes`/`end_minutes` stay integers**, as in the first draft —
  the clash check is `a.day = b.day AND a.start < b.end AND b.start < a.end`,
  a plain comparison.

## 3. Seed data

Per the standing decision in `README.md`: no real ANU data, course-level
content reused from the fictional A2 gallery (`courses.slop.university`).
Narrowed from the first draft's ~12–15 courses to **4 courses, all from the
same term** — enough variety for two or three real, demonstrable clashes,
without the browse-a-catalogue feel the two-page draft implied and this
design no longer has.

- `courses`: 4 entries hand-copied from the gallery (code, title only —
  description/level dropped, see §2), all tagged with the same term in the
  seed script's comment (not a column, since nothing reads it back), each
  given one hand-picked colour from a small accessible palette (§6).
- `activities` + `sessions`: invented by me — each course gets a Lecture
  (one session) and a Tutorial (2–3 alternative sessions). Times are chosen
  deliberately so some Lecture/Tutorial combinations across the 4 courses
  overlap and others don't, so both the clash path and the clean-add path
  are demoable at the crit.
- Seeding runs once at boot: `seedIfEmpty()` in `src/lib/db.ts`, called
  after `migrate()`, inserting only if `courses` is empty — same mechanism
  as the first draft, still no live fetch of the gallery site at runtime.

## 4. Page and layout — one page

Everything lives at `/`. Three regions:

- **Left — course list.** The 4 seeded courses, each a button showing its
  colour swatch, code and title. Selecting one loads its activities into
  the right panel.
- **Right — session panel.** The selected course's activities, each as a
  heading (with a check mark if it already has a pick) and its candidate
  sessions listed under it. Each session row shows kind/time/location and
  has its own **Add** button — an explicit, separate affordance from
  preview, satisfying "preview doesn't save" without needing to track which
  row was last hovered/focused as hidden state. *(Flagging this as my
  reading of "an explicit Add saves it" — happy to change to one shared Add
  button bound to the currently-previewed row if that's closer to what you
  had in mind.)*
- **Main — the week grid.** Day columns (Mon–Fri) × time rows, rows spanning
  the actual earliest-start to latest-end across all seeded sessions
  (computed, not hardcoded, so the grid doesn't carry dead space or clip a
  future seed change). Committed picks render as solid blocks in their
  course's colour, course code visible in the block. Previewing a session
  (see §6) highlights its would-be cell without writing anything.

`/readme/` is the only other route; `spec/routes.ts` stays `["/",
"/readme/"]`.

### Responsive behaviour (both marking viewports)

- **1920×1080**: three-column layout — course list, grid, session panel
  side by side, grid getting the most width.
- **390×844**: stacked, single column — course list, then session panel,
  then the grid. The grid itself (5 day columns) doesn't compress to
  fit 390px legibly, so it sits in its own `overflow-x: auto` container and
  scrolls horizontally, rather than shrinking text or columns to the point
  of being unreadable. One layout, CSS media query switches the stacking —
  no separate mobile template.

## 5. Interaction model and no-JS fallback

- **Preview** (hover, keyboard focus, or tap on a session row): pure CSS/JS,
  no request — toggles a highlight class on the matching (currently empty)
  grid cell. Reverts on blur/unhover/tap-away. No server involved.
- **Add**: a real `<form method="post" action="/api/picks">` per session
  row (`sessionId` hidden field) — works with no JS via a 303 redirect back
  to `/`, full reload, grid/panel reflect the new state from a fresh
  render. With JS, the same form's submit is intercepted, POSTed with
  `fetch`, and the response patches only the grid cell and the panel's
  check mark/Add-button state — no navigation. Progressive enhancement, not
  two implementations of the write path: the fetch path and the plain POST
  hit the identical route.
- **Remove**: same pattern, a small "Remove" form per picked session,
  posting to `/api/picks/:id/remove`.

## 6. Clash handling

Checked **only on the server**, at Add time — no client-side prediction,
per the brief:

1. `POST /api/picks` looks up the target session's activity. If that
   activity already has a pick for this owner, it's the swap case (§2) —
   delete the old pick, insert the new one, done, no clash check needed
   against itself.
2. Otherwise, query this owner's other picks joined to their sessions;
   if any share `day` and overlap `[start_minutes, end_minutes)` with the
   candidate, **reject**: nothing is written.
3. On reject: no-JS path 303-redirects to `/?clash=<candidateSessionId>&with=<existingSessionId>`; the page reads those params server-side and renders a `<dialog open>` naming both sessions (course code, kind, time) — visible even with no JS, since `<dialog open>` is a real HTML attribute, just not a true modal without script. With JS, the same information comes back as JSON from the intercepted `fetch` (409 status), and the page calls `.showModal()` on the dialog instead of navigating, then clears any stale `?clash=` params via `history.replaceState`.
4. While the dialog is open, the grid cell of the **existing** clashing
   session gets the clash visual (warning icon + text, §7) so the dialog and
   the grid agree on what collided; it clears when the dialog is dismissed.

## 7. Ownership: anonymous per-browser id

A shared single timetable (the first draft's design) doesn't survive
everyone opening the crit URL at once — picks would trample each other. Not
worth real accounts for a crit prototype, so: `src/middleware.ts` reads an
`owner_id` cookie on every request, generates one (`crypto.randomUUID()`) if
absent, and sets it (`httpOnly`, `sameSite=lax`, a long `Max-Age`, no
expiry-driven data loss mid-crit). Every query and write in `src/lib/db.ts`
takes `ownerId` as a parameter — nothing reads or writes `picks` without it.
No login, no visible identity, no name anywhere in the UI: purely a
partition key so `pnpm test`'s runs, my browser, and your browser each get
an independent, still-persistent timetable from the same seeded courses.

## 8. Highlight design (visual states)

Applies to a grid cell (a session's would-be or actual position):

- **Unselected** (default): plain white, no effect.
- **Preview** (hover / keyboard focus / tap on a session row): raised
  shadow + thicker border + a semi-transparent fill in the course's colour.
  Text stays dark, set explicitly rather than inherited, so it's readable
  over the partial fill regardless of the course colour underneath.
- **Selected** (a saved pick): solid fill in the course's own colour, no
  thick border. The course code renders inside the block in dark text, so
  colour is never the only cue distinguishing one course's block from
  another's.
- **Clash**: warning icon + text on the existing session's cell (§6 step 4),
  alongside the dialog — never relying on fill alone, since a semi-transparent
  preview can visually sit on top of an already-solid block and the two
  would otherwise be indistinguishable.
- **Colour palette**: 4 fixed, hand-picked light/pastel hex values (one per
  seeded course, stored in `courses.color`), chosen so plain dark text
  (`#1a1a1a` or similar) meets 4.5:1 contrast against the *solid* fill —
  the binding constraint, since the preview's transparent version over
  white background is always lighter still.
- **Motion**: one short transition (~0.2s) on the state changes above,
  wrapped in `@media (prefers-reduced-motion: no-preference)` so it's
  skipped entirely under reduced-motion. No flashing, ever (including the
  clash state — text + icon, not a blinking cell).
- **Touch**: preview must work without hover — `:focus-visible` and a
  `touchstart`/`click` listener toggle the same highlight class hover does,
  so phones (no `:hover`) get the same preview behaviour via tap.

## 9. What's dropped from the first draft

- **SSE.** With per-browser ownership (§7), there's no other client to
  broadcast to — each browser only ever sees its own picks. `src/lib/events.ts`
  and `src/pages/api/events.ts` are deleted, not left unused.
  `spec/guestbook.test.ts`'s SSE-broadcast assertion goes with them.
- **The two-page split** (`/` timetable + `/courses/` browse) — merged into
  the single grid+panels page in §4.
- **`courses.description`, `.level`, `.term`** — see §2.
- **Capacity/quota/waitlisting, accounts, prerequisite checking** — still
  out of scope, as in the first draft, for the same reason: not what this
  slice is about.

## 10. Spec tests

- Delete `spec/guestbook.test.ts` (messages flow and SSE both gone).
- Add `spec/timetable.test.ts`, covering what's mechanically checkable:
  - a pick **persists across a reload** for the same `owner_id` cookie —
    the spec's explicit "create something, and it's still there."
  - **two different cookies** (two `fetch` calls with separate `Cookie`
    jars) get independent picks — proves ownership isolation actually
    works, not just that a cookie gets set.
  - picking a second session in the **same activity replaces** the first
    (only one pick for that activity afterward).
  - a **genuinely overlapping** add is rejected: the pick count doesn't
    change, and the response identifies the clashing session (redirect
    query params for the no-JS path, JSON body for the `fetch` path).
  - a **non-overlapping** add from a different course succeeds.
- `spec/invariants.test.ts` and `spec/readme.test.ts` untouched.
  `spec/routes.ts` stays as-is (`/`, `/readme/`) since `/courses/` no longer
  exists.

## 11. Verifying what tests can't: human judgement, in a real browser

Automated checks cover persistence, ownership isolation, and clash
rejection at the HTTP level — they can't see a highlight, a modal, or a
layout. Before calling this done, check by hand (agent-browser or manual)
against the **built** app, at both marking viewports:

- **Highlight states**: preview (hover *and* keyboard-tab *and* tap/touch
  emulation), selected, and clash cells actually look like §8 describes —
  in particular that dark text stays legible over every one of the 4
  course colours in both the preview (transparent) and selected (solid)
  states, and that reduced-motion actually suppresses the transition
  (toggle the OS/browser setting or `prefers-reduced-motion` in devtools).
- **The clash `<dialog>`**: opens as a real modal with JS (focus moves in,
  `Esc` or a close control dismisses it, page underneath is inert while
  open), and separately, with JS disabled, that the no-JS path still shows
  the clash information via the redirect + `<dialog open>` render (not a
  blank or broken page).
- **Layout at 1920×1080 and 390×844**: the three-region layout side-by-side
  at desktop width, correctly stacked in course-list → panel → grid order
  at phone width, and the grid's horizontal scroll container actually
  scrolls rather than overflowing the page.
- Since `axe`'s `color-contrast` rule is disabled in
  `spec/invariants.test.ts` (jsdom can't compute rendered colour), the
  contrast check above is the only place contrast actually gets verified —
  worth a screenshot in `PROCESS.md`/`docs/` either way.

## 12. Process

Per `CLAUDE.md`: commits land incrementally as each piece goes green
(schema + migration + seed → grid/panel skeleton → preview interaction →
add/remove + clash check → cookie ownership → highlight/dialog polish →
spec tests → manual verification pass → README/PROCESS updates), with a
`process-notes.md` entry and a note to you at each milestone.

## 13. Open questions for review

- **Add button scope** (§4): one Add button per session row (my current
  read), vs. one shared Add button acting on whichever row is currently
  previewed.
- Exact 4 courses and their colours — will pick once the layout direction
  above is confirmed, so the palette can be chosen alongside it rather than
  redone after.
