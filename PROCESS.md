# Process overview

Written by you, for a reader: how you got from the brief to the harness and
agentic workflow behind this submission. Markers read this file and follow its
citations; they don't trawl the repo for evidence you didn't point at.

## What I built

A timetable prototype's data model: `courses`/`activities`/`sessions`/`picks`
in `src/lib/schema.ts`, a deterministic generator that seeds four real
(fictional) gallery courses (`src/lib/seed.ts`), and a re-runnable
`pnpm db:summary` check on the result. The pick/swap flow and the grid UI are
the next stage.

## How I got here

**Deciding where the data comes from.** Neither the brief nor the spec says
whether to use real ANU data. Since the repo and the running app both go
public at the cutoff, the only safe answer was: nothing real. Chose to reuse
the fictional courses from the A2 gallery instead of scraping or hand-typing
anything from a real ANU system. Documented in `README.md`
([`93dfd7c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/93dfd7c)).

**Guaranteeing a clash-free timetable exists.** Session times come from a
seeded PRNG, so a naive generator could hand every visitor an unwinnable
timetable — four courses with no way to pick one session per activity without
a clash. Rather than hand-type "safe" rows or trust the randomness, the
generator places each activity's baseline session into an already-free slot
*by construction*, before any random alternative or forced clash is added.
`spec/seed.test.ts` checks the baseline is mutually non-overlapping on every
run
([`40763c0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/40763c0)).

**Deleting the starter's shared-broadcast pattern.** The new schema drops
`messages` entirely, so the guestbook's SSE plumbing
(`api/messages.ts`, `api/events.ts`, `lib/events.ts`,
`spec/guestbook.test.ts`) had nothing left to read from. Deleted it rather
than leaving dead code that no longer runs against any table
([`438123e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/438123e)),
which also turned on SQLite's `foreign_keys` pragma — off by default per
connection in better-sqlite3, which would have left the new `picks` composite
foreign key declared but unenforced.

Cite the record as you go, as links whose text is the commit hash or range and
whose target is this repo's commit or compare URL, so a reader clicks straight
to the evidence:

- one commit: [`a1b2c3d`](https://github.com/YOUR-ORG/YOUR-REPO/commit/a1b2c3d)
- a range:
  [`a1b2c3d...e4f5a6b`](https://github.com/YOUR-ORG/YOUR-REPO/compare/a1b2c3d...e4f5a6b)

Screenshots are welcome where one carries the point better than a sentence does.
Commit the file to this repo and link it with a **relative** path, which is what
makes it render on GitHub: `![alt text](docs/before.png)`. Images don't count
towards the word count and don't replace the citation.

## Before you ship

`pnpm check:evidence` verifies that this comment is gone, that your citations
resolve to real commits, that a crit week's reflection entry is in
`reflections/`, and that your `CLAUDE.md` is there. It checks that your account
is traceable, not that it is good: that is the marker's call.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.
