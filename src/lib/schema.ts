import { sql } from "drizzle-orm";
import { foreignKey, int, sqliteTable, text, unique, uniqueIndex } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.

export const courses = sqliteTable("courses", {
  id: int().primaryKey({ autoIncrement: true }),
  code: text().notNull().unique(),
  title: text().notNull(),
  color: text().notNull(),
});

// `code` is free text ("LecA", "TutA", "ComA", "Asm", ...), not an enum: real
// course structures vary too much for a fixed set of activity kinds — see
// plan.md §2.
export const activities = sqliteTable(
  "activities",
  {
    id: int().primaryKey({ autoIncrement: true }),
    courseId: int("course_id")
      .notNull()
      .references(() => courses.id),
    code: text().notNull(),
  },
  (table) => [
    // A course may have at most one activity of each lecture code ("LecA",
    // "LecB", ...) — the "Lec" prefix convention shared with
    // src/lib/activity-kind.ts's isLecture. Scoped to that prefix only (a
    // partial index): non-lecture kinds (TutA, ComA, ...) aren't restricted
    // this way, since nothing about them implies "one stream per code".
    // The literal is written straight into the SQL template rather than
    // passed through like() (which drizzle-kit compiles to a bound `?`
    // placeholder — meaningless in a standalone CREATE INDEX migration
    // statement, and fails at migrate time with no value ever bound).
    uniqueIndex("activities_course_lecture_code_unique")
      .on(table.courseId, table.code)
      .where(sql`${table.code} like 'Lec%'`),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: int().primaryKey({ autoIncrement: true }),
    activityId: int("activity_id")
      .notNull()
      .references(() => activities.id),
    day: int().notNull(), // 0=Mon .. 4=Fri
    startMinutes: int("start_minutes").notNull(), // multiple of 30; minutes since midnight
    endMinutes: int("end_minutes").notNull(), // multiple of 30
    location: text().notNull(),
  },
  (table) => [
    // Lets `picks` address the (id, activityId) pair below — free, since
    // `id` is already unique on its own.
    unique().on(table.id, table.activityId),
  ],
);

export const picks = sqliteTable(
  "picks",
  {
    id: int().primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id").notNull(), // from the anonymous per-browser cookie
    sessionId: int("session_id").notNull(),
    activityId: int("activity_id").notNull(), // denormalised, see below
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    // One session per activity per owner — enforced by the database itself,
    // not just app-level discipline.
    unique().on(table.ownerId, table.activityId),
    // activityId is denormalised onto picks so the constraint above can see
    // it, and this composite FK is what keeps that copy honest: a given
    // sessionId only ever pairs with its own real activityId in the unique
    // index above, so SQLite rejects any mismatched (sessionId, activityId)
    // pair at insert time rather than trusting the application to keep them
    // in sync.
    foreignKey({
      columns: [table.sessionId, table.activityId],
      foreignColumns: [sessions.id, sessions.activityId],
    }),
  ],
);

export type Course = typeof courses.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Pick = typeof picks.$inferSelect;
