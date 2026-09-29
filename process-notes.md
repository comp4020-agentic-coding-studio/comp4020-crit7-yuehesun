# Process notes (running log)

Candidate moments, kept as they happen. This is scratch, not the submission —
`PROCESS.md` stays empty until all the coding is done, then we pick the most
important moment(s) from here together. Not checked by `pnpm check:evidence`.

A moment is a real fork where a mistake or risk was turned into something
that stays in the repo: a rule in `CLAUDE.md`, a check or test in `spec/`, or
an attempt thrown away and committed as a deletion. Not logged here: chat-only
corrections, renames, tool workarounds, progress notes — and not logged until
that rule/check/deletion is actually committed (a real fix with no test or
rule backing it yet isn't a moment; it's just a fix).

Each entry: what happened, the obvious alternative, what we did instead, why
it helped (evidence), and the real commit hash.

## Moments

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

- **Dropped `messages` and its dead starter plumbing.** The new schema
  (`courses`/`activities`/`sessions`/`picks`) drops the `messages` table
  entirely. Obvious alternative: leave `api/messages.ts`, `api/events.ts`,
  `lib/events.ts` and `spec/guestbook.test.ts` in place, since Stage 1 isn't
  supposed to touch pages/routes/UI. Instead: deleted that plumbing, since it
  had no table left to read from, rather than leaving dead code in the repo.
  Evidence: before/after — `pnpm check` stays green with the files gone;
  nothing in the app referenced them once `messages` was removed.
  Commit: [`438123e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/438123e).

## Watching, not yet moments

Real corrections with no committed rule/check/deletion behind them yet — not
logged as moments above, but tracked here so they aren't lost. Move up once
Stage 2 actually lands the check:

- FK enforcement: `client.pragma("foreign_keys = ON")` in `db.ts` (part of
  `438123e`) — SQLite disables FK enforcement per-connection by default,
  which would've left the `picks` composite FK declared but unenforced. No
  test yet exercises a mismatched `(session_id, activity_id)` insert.
- Swap/clash ordering: changing a pick to a different session of the same
  activity must clash-check the candidate against the owner's *other* picks
  (excluding the one being replaced) *before* deleting or inserting anything
  — caught during plan review, not yet built. No picks API or regression
  test exists yet.
- Per-browser ownership: rejected a shared single timetable + two-page split
  (the starter's guestbook shape) in favour of a per-browser `owner_id`
  cookie and one page, since everyone opening the crit URL at once would
  trample each other's picks. Decided before any code existed; no test yet
  that two different cookies get independent timetables.
