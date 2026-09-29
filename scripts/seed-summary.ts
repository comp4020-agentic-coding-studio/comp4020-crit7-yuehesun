#!/usr/bin/env node
// Re-runnable seeded-data summary. Reads the live DATABASE_PATH database —
// the same one `pnpm dev`/the deployed app uses, not a fresh regeneration —
// and prints, per course: its activities, each activity's session count, and
// its time range. Also lists the gallery courses used, so they can be cited
// by name in PROCESS.md/README.md for crediting. See src/lib/seed.ts for the
// generator that produced these rows.
//
// Run directly with `node` (see package.json's db:summary script), so local
// relative imports need their .ts extension — Node's own module resolution,
// not a bundler, is what resolves them here.
import { asc, eq } from "drizzle-orm";
import { db } from "../src/lib/db.ts";
import { activities, courses, sessions } from "../src/lib/schema.ts";

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const allCourses = db.select().from(courses).orderBy(asc(courses.code)).all();

if (allCourses.length === 0) {
  console.log("No courses in the database yet — start the app once to trigger the seed.");
  process.exit(0);
}

for (const course of allCourses) {
  console.log(`${course.code} — ${course.title}`);

  const courseActivities = db
    .select()
    .from(activities)
    .where(eq(activities.courseId, course.id))
    .orderBy(asc(activities.code))
    .all();

  for (const activity of courseActivities) {
    const activitySessions = db.select().from(sessions).where(eq(sessions.activityId, activity.id)).all();
    const starts = activitySessions.map((s) => s.startMinutes);
    const ends = activitySessions.map((s) => s.endMinutes);
    const range = `${formatMinutes(Math.min(...starts))}–${formatMinutes(Math.max(...ends))}`;
    console.log(`  ${activity.code}: ${activitySessions.length} sessions, ${range}`);
  }
}

console.log("\nGallery courses used (for crediting):");
for (const course of allCourses) {
  console.log(`  ${course.code} — ${course.title}`);
}
