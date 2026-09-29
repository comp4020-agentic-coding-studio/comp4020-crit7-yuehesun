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
  `src/lib/fragments.ts` (`isLecture` — a `code.startsWith("Lec")` check)
  layering a stripe pattern onto non-lecture blocks, no schema change.
  Reason: `src/lib/schema.ts` already documents `activities.code` as
  deliberately free text, not an enum, because "real course structures vary
  too much for a fixed set of activity kinds" — a `kind` column would
  directly contradict a design decision already made and recorded, to fix a
  problem that's purely about how a pick *looks*, not what it *is*.
  Evidence: `src/lib/schema.ts`'s comment above the `activities` table is
  the standing rule this followed. Missing: no test pins the "Lec* prefix ⇒
  lecture" convention, so a future seed course using a different lecture
  prefix would silently lose the stripe with nothing failing red.
  Commit: [`d146d4d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/d146d4d) (`src/lib/fragments.ts`, `src/styles.css`).
