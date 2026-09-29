import { describe, expect, it } from "vitest";
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
    // directly against the known baseline set — not searched for.
    for (const a of seed.baselineSessions) {
      for (const b of seed.baselineSessions) {
        if (a === b || a.day !== b.day) continue;
        const overlaps = a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
        expect(overlaps).toBe(false);
      }
    }
  });

  it("every deliberately forced clash pair actually overlaps", () => {
    expect(seed.forcedClashPairs.length).toBeGreaterThan(0);
    for (const [a, b] of seed.forcedClashPairs) {
      expect(a.day).toBe(b.day);
      const overlaps = a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
      expect(overlaps).toBe(true);
    }
  });

  it("is deterministic: the same rows come out every run", () => {
    expect(generateSeed()).toEqual(seed);
  });
});
