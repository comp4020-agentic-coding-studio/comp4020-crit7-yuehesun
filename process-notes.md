# Process notes (running log)

Candidate moments, kept as they happen. This is scratch, not the submission —
`PROCESS.md` stays empty until all the coding is done, then we pick the most
important moment(s) from here together. Not checked by `pnpm check:evidence`.

A moment is a real fork: a point where the obvious thing to do carried a
mistake or a risk, and we did something else instead for a reason. What makes
it worth logging is the judgment call, not whether the artifact happens to be
a rule, a check, or a deletion — a decision can be logged here before its
enforcing test lands, as long as we say what's missing and when it's coming.
Not logged here: chat-only corrections, renames, tool workarounds, progress
notes, or mechanical cleanup with no real alternative considered.

Each entry: what happened, the obvious alternative, what we did instead, why
it helped (evidence, or what's still missing), and the commit hash — real,
from `git log`/`git show`, or `pending: Stage N` if nothing's committed yet.

## Moments

- **Decided the data-sourcing policy.** Obvious alternative: use real ANU
  course/timetable data, since it's the most direct source. Instead: no real
  ANU data or personal information anywhere in the seed data, since the repo
  and the running app go public at the cutoff — reused the fictional A2
  gallery courses instead.
  Evidence: documented in `README.md`. Missing: a test asserting seed course
  codes match the gallery's `SLOP####` pattern rather than a real ANU code,
  so a future edit can't silently reintroduce one. Stage 2.
  Commit: [`93dfd7c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/93dfd7c) (README.md).

- **Guaranteed a clash-free timetable exists.** Session times come from a
  seeded PRNG, so a naive generator could hand every visitor an unwinnable
  timetable — four courses with no way to pick one session per activity
  without a clash. Obvious alternative: hand-type a few "safe" rows, or trust
  the random output. Instead: the generator places each activity's baseline
  session into an already-free slot *by construction*, before any random
  alternative or forced clash is added.
  Evidence: `spec/seed.test.ts`'s `"the constructed baseline is mutually
  non-overlapping"` test — a real check, currently green, that would fail if
  the placement algorithm regressed to something unguaranteed.
  Commit: [`40763c0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/40763c0).

- **Turned on foreign-key enforcement.** Obvious alternative: trust the
  composite FK declared on `picks` in `schema.ts` to actually be enforced by
  SQLite. Instead: SQLite disables FK enforcement per-connection by default
  in better-sqlite3, which would have left `picks.(session_id, activity_id)`
  declared but never checked — added `client.pragma("foreign_keys = ON")`
  before running migrations.
  Evidence: the pragma is in `db.ts`. Missing: a test that inserting a
  `picks` row with a mismatched `(session_id, activity_id)` pair is actually
  rejected, once the picks API exists to exercise it. Stage 2.
  Commit: [`438123e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/438123e).

- **Fixed the swap/clash ordering bug.** Reviewing the plan (not yet any
  code), found that changing a pick to a different session of the same
  activity would delete the old pick and insert the new one without
  clash-checking the new session against the owner's *other* picks first —
  a swap could silently create a clash, or fail after the old pick was
  already gone. Obvious alternative: build straight from that version.
  Instead: clash-check the candidate against the owner's other picks
  (excluding the one being replaced) *before* deleting or inserting
  anything; on a clash, reject and leave the old pick untouched.
  Evidence: none yet — the fix exists only as reasoning from this session,
  not in anything committed. Missing: the picks API itself, plus a
  regression test that swapping into a clashing session is rejected and
  leaves the original pick untouched. Stage 2.
  Commit: pending: Stage 2.

- **Rejected the shared-timetable, two-page design.** The first shape
  considered mirrored the starter's guestbook: one timetable shared by every
  visitor, and a two-page split (grid + course-browse). Everyone opening the
  crit URL at once would trample each other's picks, and reloading to see
  state is the exact problem this app is meant to fix. Obvious alternative:
  keep that shape, since it's what the starter already does. Instead:
  per-browser `owner_id` cookie (independent timetable per visitor) and a
  single page.
  Evidence: none yet — decided before any code existed. Missing: a test that
  two different cookies get independent timetables (a pick under one
  `owner_id` is invisible to another). Stage 2.
  Commit: pending: Stage 2.
