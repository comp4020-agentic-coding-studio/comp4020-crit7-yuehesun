import { describe, expect, it } from "vitest";
import { isLecture } from "../src/lib/activity-kind";
import { isDisallowedClash } from "../src/lib/overlap";
import { generateSeed } from "../src/lib/seed";

// A pure-function unit test of the generator itself — no HTTP calls, no
// database, so it doesn't depend on spec/global-setup.ts's running server
// the way the other spec/*.test.ts files do.
describe("seed generator", () => {
  const seed = generateSeed();

  it("every session sits on a half-hour boundary with a positive duration", () => {
    for (const session of seed.sessions) {
      expect(session.startMinutes % 30).toBe(0);
      expect(session.endMinutes % 30).toBe(0);
      expect(session.endMinutes).toBeGreaterThan(session.startMinutes);
    }
  });

  it("the constructed baseline never has a disallowed (non-lecture vs non-lecture) overlap", () => {
    // The clash-free full-selection guarantee from plan.md §2/§10, checked
    // directly against the known baseline set — not searched for. Baselines
    // are otherwise mutually non-overlapping by construction (placeBaseline),
    // except FORCED_OVERLAPS' one deliberate pinned pair of cross-course
    // lecture baselines — which is fine, since a lecture/lecture overlap is
    // allowed, not a genuine clash (src/lib/overlap.ts's isDisallowedClash).
    for (const a of seed.baselineSessions) {
      for (const b of seed.baselineSessions) {
        if (a === b || a.day !== b.day) continue;
        const overlaps = a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
        if (!overlaps) continue;
        expect(isDisallowedClash({ isLecture: isLecture(a.activityCode) }, { isLecture: isLecture(b.activityCode) })).toBe(false);
      }
    }
  });

  it("every deliberately forced clash pair actually overlaps and is non-lecture vs non-lecture", () => {
    // Under the lecture-permissive overlap rule, only a non-lecture/
    // non-lecture overlap is a genuine (disallowed) clash — so this fixture
    // has to stay non-lecture on both sides, or it would silently stop being
    // a clash and spec/timetable.test.ts's rejection tests would break for
    // the wrong reason.
    expect(seed.forcedClashPairs.length).toBeGreaterThan(0);
    for (const [a, b] of seed.forcedClashPairs) {
      expect(a.day).toBe(b.day);
      const overlaps = a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
      expect(overlaps).toBe(true);
      expect(isLecture(a.activityCode)).toBe(false);
      expect(isLecture(b.activityCode)).toBe(false);
    }
  });

  it("every deliberately forced overlap pair actually overlaps, involves a lecture, and spans two different courses", () => {
    // The allowed-overlap counterpart: at least one side must be a lecture,
    // or this fixture wouldn't demonstrate the rule it exists to test. Both
    // sides must be different courses — a course's own two lecture streams
    // (LecA/LecB) must never be forced to overlap each other, since a
    // student genuinely needs to attend both.
    expect(seed.forcedOverlapPairs.length).toBeGreaterThan(0);
    for (const [a, b] of seed.forcedOverlapPairs) {
      expect(a.day).toBe(b.day);
      const overlaps = a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
      expect(overlaps).toBe(true);
      expect(isLecture(a.activityCode) || isLecture(b.activityCode)).toBe(true);
      expect(a.courseCode).not.toBe(b.courseCode);
    }
  });

  it("no lecture activity has more than one session", () => {
    // schema.ts's sessions_lecture_activity_unique: a lecture is one fixed
    // time, full stop — a course that needs two lecture streams models them
    // as two activities (LecA, LecB), not one activity with two sessions.
    const countsByActivity = new Map<string, number>();
    for (const session of seed.sessions) {
      const key = `${session.courseCode}|${session.activityCode}`;
      countsByActivity.set(key, (countsByActivity.get(key) ?? 0) + 1);
    }
    for (const [key, count] of countsByActivity) {
      const activityCode = key.split("|")[1];
      if (isLecture(activityCode)) expect(count).toBe(1);
    }
  });

  it("is deterministic: the same rows come out every run", () => {
    expect(generateSeed()).toEqual(seed);
  });
});
