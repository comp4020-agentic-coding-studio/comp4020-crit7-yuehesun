# Process notes (running log)

Candidate moments, kept as they happen. This is scratch, not the submission —
`PROCESS.md` is the curated version; moments get promoted there by hand, not
automatically. Not checked by `pnpm check:evidence`.

Each moment names the obvious alternative, what we did instead, and how we
knew it helped, then one tag:

- **harness** — a rule in `CLAUDE.md`, a check/test in `spec/`, or a deletion
  is actually committed.
- **pending** — the correction is real (or reasoned through), but nothing in
  the repo enforces it yet. States exactly what's missing and which stage
  adds it.
- **retry** — only corrected in chat; no trace in the repo. Named so it isn't
  lost, but it can't be cited in `PROCESS.md`.

`plan.md` is a scratch document and is never cited as evidence here or in
`PROCESS.md`, even when a decision is also described there.

## Moments

- **Decided the data-sourcing policy.** Obvious alternative: use real ANU
  course/timetable data, since it's the most direct source. Instead: no real
  ANU data or personal information anywhere in the seed data, since the repo
  and the running app go public at the cutoff — reused the fictional A2
  gallery courses instead. Documented in `README.md`
  ([`93dfd7c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/93dfd7c))
  and `PROCESS.md`
  ([`9c7af09`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/9c7af09)).
  Nothing in the repo checks that a future edit doesn't reintroduce real
  course codes.
  Tag: **pending** — missing: a test asserting seed course codes match the
  gallery's `SLOP####` pattern, not a real ANU code. Stage 2.

- **Dropped `messages` and its dead starter plumbing.** Obvious alternative:
  leave `api/messages.ts`, `api/events.ts`, `lib/events.ts` and
  `spec/guestbook.test.ts` in place since Stage 1 isn't supposed to touch
  pages/routes/UI. Instead: since the new schema drops the `messages` table
  entirely, that plumbing is dead code with no table to read from — deleted
  it and trimmed `index.astro` to a placeholder, rather than leaving code in
  the repo that no longer runs against anything.
  Committed as a deletion in
  [`438123e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/438123e).
  Tag: **harness** — a deletion, actually committed.

- **Guaranteed a clash-free timetable exists.** Obvious alternative:
  hand-type a few "safe" rows, or trust the seeded PRNG's output as-is.
  Either way a bad run could hand every visitor an unwinnable timetable —
  four courses with no way to pick one session per activity without a
  clash. Instead: the generator places each activity's baseline session into
  an already-free slot *by construction*, before any random alternative or
  forced clash is added, and `spec/seed.test.ts`'s
  `"the constructed baseline is mutually non-overlapping"` test checks this
  on every run.
  Committed together in
  [`40763c0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/40763c0).
  Tag: **harness** — a check in `spec/`, actually committed and currently
  green.

- **Turned on foreign-key enforcement.** Obvious alternative: trust the
  composite FK declared on `picks` in `schema.ts` to actually be enforced by
  SQLite. Instead: SQLite disables FK enforcement per-connection by default
  in better-sqlite3, which would have left `picks.(session_id, activity_id)`
  declared but never checked — added `client.pragma("foreign_keys = ON")`
  before running migrations.
  Committed in
  [`438123e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/438123e)
  (same commit as the schema rewrite).
  Tag: **pending** — missing: a test that inserting a `picks` row with a
  mismatched `(session_id, activity_id)` pair is actually rejected. Stage 2,
  once the picks API exists to exercise it.

- **Fixed the swap/clash ordering bug.** Reviewing the plan (not yet any
  code), found that changing a pick to a different session of the same
  activity would delete the old pick and insert the new one without
  clash-checking the new session against the owner's *other* picks first —
  a swap could silently create a clash, or fail after the old pick was
  already gone. Obvious alternative: build straight from that version.
  Instead: clash-check the candidate against the owner's other picks
  (excluding the one being replaced) *before* deleting or inserting
  anything; on a clash, reject and leave the old pick untouched.
  No commit exists yet — the fix lives only in this session's plan
  discussion and reasoning, not in anything committed.
  Tag: **pending** — missing: the picks API itself, plus a regression test
  that swapping into a clashing session is rejected and leaves the original
  pick untouched. Stage 2.

- **Rejected the shared-timetable, two-page design.** The first shape
  considered mirrored the starter's guestbook: one timetable shared by every
  visitor, and a two-page split (grid + course-browse). Everyone opening the
  crit URL at once would trample each other's picks, and reloading to see
  state is the exact problem this app is meant to fix. Obvious alternative:
  keep that shape, since it's what the starter already does. Instead:
  per-browser `owner_id` cookie (independent timetable per visitor) and a
  single page.
  No commit exists yet — this was decided before any plan.md revision was
  committed, so there's nothing in the repo to point at.
  Tag: **pending** — missing: a test that two different cookies get
  independent timetables (a pick under one `owner_id` is invisible to
  another). Stage 2.
