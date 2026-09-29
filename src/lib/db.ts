import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { activities, type Course, courses, picks, type Session, sessions } from "./schema.ts";
import { generateSeed } from "./seed.ts";

// One SQLite file is the app's whole persistent state. In production
// fly.toml points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");
// Off by default per-connection in SQLite — without this, the composite FK
// on `picks` (schema.ts) would be declared but never actually enforced.
client.pragma("foreign_keys = ON");

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });
seedIfEmpty();

// Seeds the generated timetable once, on a fresh database only — never runs
// again once `courses` has rows, so it never touches a real visitor's picks.
// See src/lib/seed.ts for the generator itself.
function seedIfEmpty(): void {
  if (db.select().from(courses).limit(1).all().length > 0) return;

  const seed = generateSeed();
  db.transaction((tx) => {
    const courseIds = new Map<string, number>();
    for (const course of seed.courses) {
      const row = tx.insert(courses).values(course).returning({ id: courses.id }).get();
      courseIds.set(course.code, row.id);
    }

    const activityIds = new Map<string, number>();
    for (const activity of seed.activities) {
      const courseId = courseIds.get(activity.courseCode);
      if (courseId === undefined) throw new Error(`seed: unknown course ${activity.courseCode}`);
      const row = tx
        .insert(activities)
        .values({ courseId, code: activity.code })
        .returning({ id: activities.id })
        .get();
      activityIds.set(`${activity.courseCode}|${activity.code}`, row.id);
    }

    for (const session of seed.sessions) {
      const activityId = activityIds.get(`${session.courseCode}|${session.activityCode}`);
      if (activityId === undefined) {
        throw new Error(`seed: unknown activity ${session.courseCode}|${session.activityCode}`);
      }
      tx.insert(sessions)
        .values({
          activityId,
          day: session.day,
          startMinutes: session.startMinutes,
          endMinutes: session.endMinutes,
          location: session.location,
        })
        .run();
    }
  });
}

// --- Read queries for the page (Stage 2) ------------------------------

export function listCourses(): Course[] {
  return db.select().from(courses).orderBy(asc(courses.code)).all();
}

export interface ActivityWithSessions {
  id: number;
  code: string;
  sessions: Session[];
}

export function listActivitiesWithSessions(courseId: number): ActivityWithSessions[] {
  const rows = db.select().from(activities).where(eq(activities.courseId, courseId)).orderBy(asc(activities.code)).all();
  return rows.map((activity) => ({
    id: activity.id,
    code: activity.code,
    sessions: db
      .select()
      .from(sessions)
      .where(eq(sessions.activityId, activity.id))
      .orderBy(asc(sessions.day), asc(sessions.startMinutes))
      .all(),
  }));
}

export interface PickWithDetails {
  pickId: number;
  activityId: number;
  activityCode: string;
  courseId: number;
  courseCode: string;
  courseColor: string;
  sessionId: number;
  day: number;
  startMinutes: number;
  endMinutes: number;
  location: string;
}

// Every pick this owner currently has, joined enough to render both the
// week grid (course colour, day/time) and the session panel's check marks
// (activityId -> sessionId).
export function listPicksForOwner(ownerId: string): PickWithDetails[] {
  return db
    .select({
      pickId: picks.id,
      activityId: picks.activityId,
      activityCode: activities.code,
      courseId: courses.id,
      courseCode: courses.code,
      courseColor: courses.color,
      sessionId: sessions.id,
      day: sessions.day,
      startMinutes: sessions.startMinutes,
      endMinutes: sessions.endMinutes,
      location: sessions.location,
    })
    .from(picks)
    .innerJoin(sessions, eq(picks.sessionId, sessions.id))
    .innerJoin(activities, eq(picks.activityId, activities.id))
    .innerJoin(courses, eq(activities.courseId, courses.id))
    .where(eq(picks.ownerId, ownerId))
    .all();
}

// The week grid's overall time range: earliest session start / latest
// session end across ALL seeded sessions (not just what's picked or being
// browsed), rounded outward to whole hours (plan.md §4) so the header row
// can show whole-hour labels while half-hour sessions still land cleanly.
export function gridHourRange(): { startHour: number; endHour: number } {
  const rows = db.select({ startMinutes: sessions.startMinutes, endMinutes: sessions.endMinutes }).from(sessions).all();
  const minStart = Math.min(...rows.map((r) => r.startMinutes));
  const maxEnd = Math.max(...rows.map((r) => r.endMinutes));
  return { startHour: Math.floor(minStart / 60), endHour: Math.ceil(maxEnd / 60) };
}
