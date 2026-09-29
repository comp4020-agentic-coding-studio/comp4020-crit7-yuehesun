import { describe, expect, it } from "vitest";
import { isLecture } from "../src/lib/activity-kind";
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

  it("the constructed baseline is mutually non-overlapping", () => {
    // The clash-free full-selection guarantee from plan.md §2/§10, checked
    // directly against the known baseline set — not searched for. Still the
    // right guarantee under the lecture-permissive overlap rule
    // (src/lib/overlap.ts): full mutual non-overlap is *stricter* than the
    // rule requires (which only forbids non-lecture/non-lecture overlap), so
    // a baseline built this way trivially satisfies it too.
    for (const a of seed.baselineSessions) {
      for (const b of seed.baselineSessions) {
        if (a === b || a.day !== b.day) continue;
        const overlaps = a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
        expect(overlaps).toBe(false);
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

  it("every deliberately forced overlap pair actually overlaps and includes a lecture", () => {
    // The allowed-overlap counterpart: at least one side must be a lecture,
    // or this fixture wouldn't demonstrate the rule it exists to test.
    expect(seed.forcedOverlapPairs.length).toBeGreaterThan(0);
    for (const [a, b] of seed.forcedOverlapPairs) {
      expect(a.day).toBe(b.day);
      const overlaps = a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
      expect(overlaps).toBe(true);
      expect(isLecture(a.activityCode) || isLecture(b.activityCode)).toBe(true);
    }
  });

  it("is deterministic: the same rows come out every run", () => {
    expect(generateSeed()).toEqual(seed);
  });
});
