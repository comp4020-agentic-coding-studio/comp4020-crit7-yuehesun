# Process notes (running log)

Candidate moments, kept as they happen. This is scratch, not the submission —
`PROCESS.md` stays empty until all the coding is done, then we pick the most
important moment(s) from here together. Not checked by `pnpm check:evidence`.

A moment is a real fork: a point where the obvious approach — to the build,
or to how we work together — carried a mistake or a risk, and we did
something else instead for a reason. That covers product decisions (the
obvious design was rejected) and workflow decisions (a choice that changed
how we direct or check this work) alike. What makes it worth logging is the
judgment call, not whether the artifact happens to be a rule, a check, or a
deletion — a decision can be logged here before its enforcing test lands, as
long as we say what's missing and when it's coming. Not logged here:
chat-only corrections, renames, tool workarounds, progress notes, or
mechanical cleanup with no real alternative considered.

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

- **Fixed the swap/clash ordering bug.** Reviewing the plan (not yet any
  code), found that changing a pick to a different session of the same
  activity would delete the old pick and insert the new one without
  clash-checking the new session against the owner's *other* picks first —
  a swap could silently create a clash, or fail after the old pick was
  already gone. Obvious alternative: build straight from that version.
  Instead: clash-check the candidate against the owner's other picks
  (excluding the one being replaced) *before* deleting or inserting
  anything; on a clash, reject and leave the old pick untouched.
  Evidence: `spec/timetable.test.ts`'s `"rejects swapping into a clash with
  a different activity's pick, leaving the original untouched"` test —
  green, and it would fail under the rejected ordering (old pick deleted
  before the clash check).
  Commit: [`e07e1ba`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/e07e1ba) (`src/lib/db.ts`'s `addOrSwapPick`, `spec/timetable.test.ts`).

- **Found the CI deploy pipeline still verifies a deleted feature.**
  Reviewing `plan.md` against the repo's actual CI config (not just the
  spec/), `.github/workflows/checks.yml`'s `deploy` job has a step that
  curls `/api/events` and fails the job if it gets no bytes back — a
  leftover check for the starter's SSE stream, which Stage 1 already
  deleted (per-browser ownership means no client needs to hear about
  another's pick). Obvious alternative: leave `checks.yml` alone, since
  `CLAUDE.md` treats the CI workflow as one of the files that "says what it
  fixes," i.e. something not ours to touch. Instead: it gets edited in
  Stage 2d, because that verification step doesn't describe a fixed
  requirement of the deploy pipeline — it describes a feature of the
  starter that no longer exists in this app, and leaving it in would fail
  every deploy once the repo goes public, directly costing half the
  shipped mark (green CI checks) for a reason that has nothing to do with
  whether the app actually works.
  Evidence: `git log --oneline -- .github/workflows/checks.yml` is empty
  (untouched since the initial commit) while `git log --diff-filter=D`
  confirms `src/pages/api/events.ts` was deleted in `438123e`. Missing: the
  fix itself and a deploy that shows the pipeline green without it.
  Commit: pending: Stage 2d.

- **Rejected the shared-timetable, two-page design.** The first shape
  considered mirrored the starter's guestbook: one timetable shared by every
  visitor, and a two-page split (grid + course-browse). Everyone opening the
  crit URL at once would trample each other's picks, and reloading to see
  state is the exact problem this app is meant to fix. Obvious alternative:
  keep that shape, since it's what the starter already does. Instead:
  per-browser `owner_id` cookie (independent timetable per visitor) and a
  single page.
  Evidence: `spec/timetable.test.ts`'s `"isolates picks between two owners"`
  test — two cookie jars against the running server, green.
  Commit: [`dc387dd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/dc387dd) (`src/middleware.ts`) and [`e07e1ba`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/e07e1ba) (the isolation test).

- **Tested the DB constraints against an isolated fixture, not the live
  `db.ts` singleton.** Writing the "duplicate `(owner_id, activity_id)`" and
  "mismatched `(session_id, activity_id)`" constraint tests, the obvious
  approach was to import `src/lib/db.ts` directly and insert conflicting
  rows against its exported `db`. Instead: a throwaway sqlite file + the
  real migrations, built inline in the test, never touching the app's own
  module. Importing `db.ts` runs its module-level side effects
  (`migrate()`, `seedIfEmpty()`) against whatever `DATABASE_PATH` the
  process happens to have — in the vitest worker (not `global-setup.ts`'s
  spawned server) that's the default `./.data/app.db`, i.e. a real
  developer's local database, on every test run.
  Evidence: `spec/timetable.test.ts`'s `"database constraints (isolated
  fixture, no HTTP)"` block — both constraint tests pass without opening or
  writing `.data/app.db`.
  Commit: [`e07e1ba`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/e07e1ba).

- **Shared "what a picked session looks like" as plain TS functions, not
  Astro-component rendering.** `plan.md` §5 names the obvious approach
  explicitly: "one Astro partial/component reused by the full page and by
  the API route for its fragment response" — implying Astro's Container API
  (`astro/container`), which can render a `.astro` component to a string
  from inside an API route. Instead: `src/lib/fragments.ts` holds plain
  TypeScript functions (`renderGridPick`, `renderActivityPanel`,
  `renderClashDialogInner`) that build the HTML strings directly;
  `index.astro` calls them via `<Fragment set:html={...} />` and
  `src/pages/api/picks*.ts` call the same functions for their JSON fragment
  responses. Reason: with ~10.5h left, the Container API is a less-used
  Astro surface (per-request container construction, `renderToString`
  semantics for a non-page component, slot/locals plumbing) with real risk
  of eating the remaining budget on something that isn't the deliverable;
  plain functions get the thing the plan actually cares about — one
  implementation, not two that can drift — without that risk, at the cost
  of writing HTML as strings instead of JSX.
  Evidence: `src/lib/fragments.ts` is the only place any of these three
  fragments are built; `index.astro` and `src/pages/api/picks.ts` /
  `src/pages/api/picks/remove.ts` all import and call it rather than
  reimplementing the markup. Missing: no test asserts the two call sites
  stay in sync (nothing stops a future edit from inlining a one-off
  override at either call site) — a snapshot test comparing the full-page
  render's fragment markup to the API's fragment response would close this,
  not yet written given the time budget.
  Commit: [`4de44ab`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/4de44ab) (`src/lib/fragments.ts` and its two call sites).

- **Kept lecture-vs-tutorial colour coding out of the schema.** Manual
  testing found same-course activities (a lecture and its tutorial) looked
  identical on the grid — same course colour, distinguishable only by
  reading the code text. Obvious alternative: add a `kind` column to
  `activities` (enum: lecture/tutorial/lab/assessment) so the renderer could
  branch on real data. Instead: a display-only heuristic in
  `src/lib/fragments.ts` (`isLecture` — a `code.startsWith("Lec")` check,
  later extracted to its own module, `src/lib/activity-kind.ts`)
  distinguishing non-lecture blocks visually, no schema change. (The visual
  treatment itself was revised once, from a diagonal stripe to a left-edge
  `box-shadow` bar, in `4c26f6f` — the stripe's white overlay lightened the
  fill so it no longer read as the course's true colour; a mechanical CSS
  fix, not a second fork, so not its own entry.)
  Reason: `src/lib/schema.ts` already documents `activities.code` as
  deliberately free text, not an enum, because "real course structures vary
  too much for a fixed set of activity kinds" — a `kind` column would
  directly contradict a design decision already made and recorded, to fix a
  problem that's purely about how a pick *looks*, not what it *is*.
  Evidence: `src/lib/schema.ts`'s comment above the `activities` table is
  the standing rule this followed. Missing: no test pins the "Lec* prefix ⇒
  lecture" convention, so a future seed course using a different lecture
  prefix would silently lose the distinguishing treatment with nothing
  failing red.
  Commit: [`d146d4d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/d146d4d) (`src/lib/fragments.ts`, `src/styles.css`); visual revision in [`4c26f6f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/4c26f6f) (`src/styles.css`).

- **Found the clash rule didn't match a real timetable, while chasing a
  display bug.** Manually testing the clash-dialog flow in small steps —
  our habit of checking behaviour by hand as each piece landed, not just
  running `pnpm check` — found the clash-warning border on an existing grid
  pick never cleared once the dialog closed. That was a real, separate bug
  (`applyClash()` kept tracking the DOM node it had just detached via
  `replaceWith()`, which is a silent no-op on a parentless node), fixed on
  its own in `d146d4d`. But watching that flow closely enough, repeatedly,
  to diagnose *why* the border stuck made a second, deeper problem visible:
  the clash being demonstrated to test the fix was a lecture overlapping a
  tutorial — and treating that as a clash at all doesn't match how ANU
  timetables actually work, since lectures aren't attendance- or
  mark-checked and nothing stops a real student "attending" two sessions at
  once. Obvious alternative: the display bug was already fixed in
  `d146d4d`; stop there and leave the underlying "any time overlap is a
  clash" rule exactly as already built and tested — it wasn't broken by any
  test in the suite. Instead: proposed narrowing the rule itself (a clash
  only when *both* sides are non-lecture) rather than leaving a technically-
  working rule that models the wrong thing, and got it approved with three
  conditions — the hover preview must split on every allowed overlap (not
  only when the candidate itself is a lecture), the seed data and its tests
  needed updating for the new rule, and the slice layout had to be one
  shared pure function imported by both the server render and the client
  preview, never two implementations that could drift.
  Reason: fixing only the border-revert bug would have left the app
  correctly *displaying* a clash between a lecture and a tutorial that a
  real ANU timetable would never treat as a conflict — testing by hand in
  small, closely-watched steps throughout the build, rather than saving
  manual verification for one pass at the end, is what surfaced that
  mismatch while it was still cheap: one contained change (a new pure
  module, a seed fixture, one function in `db.ts`, two renderers) instead of
  a late-discovered rearchitecture found during final polish or after
  marking.
  Evidence: `spec/overlap.test.ts` (the shared `computeSlices`/
  `isDisallowedClash` module, unit-tested standalone); `spec/timetable.test.ts`'s
  `"allows a lecture and a non-lecture activity to overlap"` test;
  `spec/seed.test.ts` re-asserting every forced clash is non-lecture/
  non-lecture and every forced overlap includes a lecture — all green.
  Missing: no automated browser check of the hover-preview split itself
  (`src/scripts/timetable-client.ts`) — this repo has no browser-automation
  tooling, so that path was verified by typecheck/reasoning, not by
  observing it render, and is flagged to the user as such.
  Commit: [`d146d4d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/d146d4d)
  (the display-bug fix that prompted the closer look);
  [`15da208`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/15da208),
  [`3f8382c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/3f8382c),
  [`1246c98`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/1246c98),
  [`9bba39b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/9bba39b),
  [`db4be08`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/db4be08),
  [`83a575f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/83a575f)
  (the rule change itself, built across these small commits).

- **Wrote the cross-`/clear` workflow into `CLAUDE.md` instead of leaving it
  as tacit habit.** `plan.md` already had a "Status" block, and this session
  was already committing in small steps and pausing to test by hand — but
  none of that was written down as a rule a *future* session would inherit.
  It existed only as whatever the current session happened to remember to
  do, so how carefully a fresh session after `/clear` re-verified state,
  refined the next stage's plan, or resisted editing before diagnosing a
  reported problem depended entirely on that session's own judgment, not on
  anything `@plan` or `CLAUDE.md` told it to do. Obvious alternative: keep
  relying on that tacit habit — it had been working, and `CLAUDE.md` already
  says commits should be incremental and reported. Instead: added a
  `## Workflow` section spelling out the whole loop as a standing rule — one
  continuously-iterated `plan.md` with a mandated top structure (read
  brief/spec, background, current state), refine-then-verify per stage,
  *analyse and present the diagnosis before editing* when the user reports a
  problem, and fold the stage's state update into its last commit so
  progress is never lost to a `/clear`.
  Reason: the immediately preceding moment in this log — finding the
  clash-rule mismatch only because we were testing by hand in small,
  closely-watched steps rather than saving verification for one pass at the
  end — is itself the case for codifying that discipline rather than trusting
  it to survive by habit alone. The same session that discovered how much a
  small-step, diagnose-before-editing loop is worth is the session that
  would otherwise have taken that lesson with it into the next `/clear`.
  Evidence: the rule text was drafted, restated back to the user in full
  twice, and only written into `CLAUDE.md` after explicit confirmation both
  times (nothing here was assumed). Missing: nothing enforces that a future
  session actually follows it — there's no test or check that fails if an
  agent skips refining a stage's plan or edits before presenting a diagnosis;
  a process rule about how we collaborate isn't the kind of thing
  `pnpm check` can verify, so this one depends on being read and followed at
  the start of each conversation.
  Commit: [`6970b4f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/6970b4f) (`CLAUDE.md`).

- **Diagnosed the generated migration's real transactional behaviour
  instead of trusting drizzle-kit's statement order and shipping it as
  generated.** Adding `sessions_lecture_activity_unique` required a
  table-rebuild migration (SQLite can't add a `FOREIGN KEY` to an existing
  table). `pnpm db:generate` wrote one that looked plausible — it even
  included the standard `PRAGMA foreign_keys=OFF;`/`...=ON;` bracketing
  drizzle-kit always emits around a rebuild. The obvious path was to accept
  that as evidence FK checks were off for the whole file and move on.
  Instead, booting the real built server against a scratch database first
  (rather than only trusting `pnpm check`'s in-memory test DB, which
  happened not to exercise this exact path) surfaced a genuine
  `DrizzleError` on the rebuild's `INSERT INTO __new_sessions`. Reading
  drizzle-orm's own `SQLiteSyncDialect.migrate()` source showed it wraps
  every migration file in one outer `BEGIN...COMMIT`; SQLite documents
  `PRAGMA foreign_keys` as a no-op once issued inside an active
  transaction, so the generated file's own `OFF` pragma was never real —
  FK enforcement stayed on for the whole rebuild. That meant the
  `CREATE TABLE __new_sessions` (whose FK target was a new
  `activities(id, code)` unique index) failed because drizzle-kit had
  placed that index's `CREATE UNIQUE INDEX` at the *end* of the file, after
  the table that depended on it. Reproduced the exact failure in isolation
  first, with a small `better-sqlite3` script replaying the file's
  statements inside an explicit transaction, before touching the migration
  — so the fix (moving that one `CREATE UNIQUE INDEX` earlier in the file)
  was applied against a confirmed cause, not a guess.
  Reason: shipping the as-generated file would have passed local dev (a
  fresh `pnpm dev` on an empty DB never runs this particular rebuild path)
  and only broken on the next real upgrade of an existing database — likely
  first noticed against the production Fly volume.
  Evidence: the manual `better-sqlite3` replay script reproduced
  `foreign key mismatch - "__new_sessions" referencing "activities"`
  before the fix and ran clean after it; a subsequent `pnpm build` +
  fresh `node ./dist/server/entry.mjs` boot against a new scratch
  `DATABASE_PATH` came up clean (`curl` returned `status=200`).
  Commit: [`7106ad8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/7106ad8)
  (`drizzle/0002_messy_storm.sql`).
