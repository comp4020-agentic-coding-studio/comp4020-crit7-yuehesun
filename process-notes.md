# Process notes (running log)

Candidate moments, kept as they happen. This is scratch, not the submission —
`PROCESS.md` is the curated version; moments get promoted there by hand, not
automatically. Not checked by `pnpm check:evidence`.

## Moments

- **Decided the data-sourcing policy** (2026-09-29): no real ANU data or
  personal information in the seed data, since the repo/app go public at the
  cutoff. Reusing the fictional A2 gallery courses instead. Documented in
  `README.md` ([`93dfd7c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/93dfd7c))
  and `PROCESS.md` ([`9c7af09`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/9c7af09)).
- **Set process discipline in `CLAUDE.md`** (2026-09-29): incremental commits,
  this running log, a pre-ship trim reminder, a reflection reminder.
- **Revision 5 of `plan.md`: terminology cleanup** (2026-09-29): "milestone"
  was doing double duty for both build steps and `process-notes.md` moments.
  Renamed build steps to Stage 1, Stage 2, … throughout, and added a Status
  line so the plan states Stage 1's approval state on its own, without
  needing the conversation that produced it.
- **Resolved a Stage 1 scope conflict before writing code** (2026-09-29):
  plan.md §2 says the new schema "replac[es] `messages` entirely", but §12
  says Stage 1 has no pages/API routes/UI. Dropping `messages` from the
  schema breaks `db.ts`, `index.astro`, `api/messages.ts`, `api/events.ts`,
  `events.ts` and `guestbook.test.ts`, which all reference it. Asked; the
  call was to drop `messages` now and delete/trim the now-dead starter
  plumbing so `pnpm check` stays green, without building any Stage-2 UI —
  i.e. cleanup of superseded starter code, not new pages.
- **Reset the migration history instead of fighting drizzle-kit's rename
  prompt** (2026-09-29): `pnpm db:generate` after the schema rewrite asked
  (interactively, no TTY available) whether each new table was a rename of
  `messages` — it isn't. Since nothing has deployed with real data yet,
  deleted `drizzle/` and generated a fresh baseline migration instead of
  answering prompts; a real deployed volume would need the rename path
  handled properly instead.
- **`better-sqlite3` doesn't enforce foreign keys unless asked** (2026-09-29):
  SQLite disables FK enforcement per-connection by default, which would have
  silently defeated the `picks` composite FK from plan.md §2 (the whole
  point of which is that the database rejects a mismatched
  `(session_id, activity_id)` pair). Added `client.pragma("foreign_keys =
  ON")` in `db.ts` — caught before it could hide a real test gap, since Stage
  1 doesn't yet have a test that exercises this FK directly (that's a Stage
  2 spec test per plan.md §10).
- **`scripts/seed-summary.ts` needs explicit `.ts` import extensions**
  (2026-09-29): it's invoked with plain `node`, not through Astro/Vite, and
  Node's own ESM resolution (unlike a bundler) requires the extension on
  relative specifiers. Gave `db.ts`'s own internal imports the same `.ts`
  extensions so it loads correctly either way — TypeScript's
  `allowImportingTsExtensions` (already on via `astro/tsconfigs/strict`)
  keeps `pnpm typecheck` and Vite happy with the explicit extension too.
- **Stage 1 complete** (2026-09-29): `src/lib/schema.ts` (four tables),
  `drizzle/0000_mushy_doctor_faustus.sql`, `src/lib/seed.ts` (deterministic
  generator: 4 real gallery courses — SLOP4225, SLOP1836, SLOP2805, SLOP3092
  — authored activity shapes, seeded-PRNG alternatives, constructed
  clash-free baseline, 2 forced clash pairs), `spec/seed.test.ts`, and `pnpm
  db:summary`. `pnpm check` green (17 files typechecked, 29 tests passing).
  No pages/API routes/UI touched beyond deleting the now-dead
  messages/SSE starter plumbing and trimming `index.astro` to a placeholder.
