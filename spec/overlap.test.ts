import { describe, expect, it } from "vitest";
import { computeSlices, isDisallowedClash, timeOverlaps, type OverlapItem } from "../src/lib/overlap";

function item(id: number, isLecture: boolean, day: number, startMinutes: number, endMinutes: number): OverlapItem {
  return { id, isLecture, day, startMinutes, endMinutes };
}

describe("timeOverlaps", () => {
  it("is false on different days even at the same time", () => {
    expect(timeOverlaps({ day: 0, startMinutes: 60, endMinutes: 120 }, { day: 1, startMinutes: 60, endMinutes: 120 })).toBe(
      false,
    );
  });

  it("is false for back-to-back sessions (end === start)", () => {
    expect(timeOverlaps({ day: 0, startMinutes: 60, endMinutes: 120 }, { day: 0, startMinutes: 120, endMinutes: 180 })).toBe(
      false,
    );
  });

  it("is true for a genuine overlap", () => {
    expect(timeOverlaps({ day: 0, startMinutes: 60, endMinutes: 120 }, { day: 0, startMinutes: 90, endMinutes: 150 })).toBe(
      true,
    );
  });
});

describe("isDisallowedClash", () => {
  it("allows a lecture overlapping a lecture", () => {
    expect(isDisallowedClash({ isLecture: true }, { isLecture: true })).toBe(false);
  });

  it("allows a lecture overlapping a non-lecture", () => {
    expect(isDisallowedClash({ isLecture: true }, { isLecture: false })).toBe(false);
    expect(isDisallowedClash({ isLecture: false }, { isLecture: true })).toBe(false);
  });

  it("disallows a non-lecture overlapping a non-lecture", () => {
    expect(isDisallowedClash({ isLecture: false }, { isLecture: false })).toBe(true);
  });
});

describe("computeSlices", () => {
  it("gives a lone item the full width", () => {
    const result = computeSlices([item(1, false, 0, 60, 120)]);
    expect(result).toEqual([{ item: item(1, false, 0, 60, 120), sliceIndex: 0, sliceCount: 1 }]);
  });

  it("gives two non-overlapping items each the full width, independently", () => {
    const result = computeSlices([item(1, false, 0, 60, 120), item(2, false, 1, 60, 120)]);
    expect(result.every((r) => r.sliceCount === 1 && r.sliceIndex === 0)).toBe(true);
  });

  it("splits two overlapping items into two equal slices", () => {
    const result = computeSlices([item(1, true, 0, 60, 150), item(2, false, 0, 90, 180)]);
    expect(result.every((r) => r.sliceCount === 2)).toBe(true);
  });

  it("orders a split: lecture left, non-lecture right", () => {
    const lecture = item(1, true, 0, 60, 150);
    const tutorial = item(2, false, 0, 90, 180);
    // Non-lecture pushed first into the input array — order must not matter.
    const result = computeSlices([tutorial, lecture]);
    const byId = new Map(result.map((r) => [r.item.id, r]));
    expect(byId.get(1)?.sliceIndex).toBe(0); // lecture
    expect(byId.get(2)?.sliceIndex).toBe(1); // tutorial
  });

  it("orders two lectures by start time, then by activity id", () => {
    const later = item(5, true, 0, 120, 180);
    const earlier = item(2, true, 0, 60, 150);
    const result = computeSlices([later, earlier]);
    const byId = new Map(result.map((r) => [r.item.id, r]));
    expect(byId.get(2)?.sliceIndex).toBe(0); // earlier start
    expect(byId.get(5)?.sliceIndex).toBe(1);
  });

  it("breaks a same-kind, same-start-time tie by ascending activity id", () => {
    const higherId = item(9, true, 0, 60, 150);
    const lowerId = item(3, true, 0, 60, 150);
    const result = computeSlices([higherId, lowerId]);
    const byId = new Map(result.map((r) => [r.item.id, r]));
    expect(byId.get(3)?.sliceIndex).toBe(0);
    expect(byId.get(9)?.sliceIndex).toBe(1);
  });

  it("groups a whole connected component even when not every pair overlaps directly", () => {
    // A (lecture) overlaps both B and C; B and C don't overlap each other.
    const a = item(1, true, 0, 60, 180);
    const b = item(2, false, 0, 60, 90);
    const c = item(3, false, 0, 150, 180);
    const result = computeSlices([a, b, c]);
    expect(result.every((r) => r.sliceCount === 3)).toBe(true);
    const byId = new Map(result.map((r) => [r.item.id, r]));
    expect(byId.get(1)?.sliceIndex).toBe(0); // lecture, left
    expect(byId.get(2)?.sliceIndex).toBe(1); // earlier start
    expect(byId.get(3)?.sliceIndex).toBe(2);
  });

  it("keeps an unrelated item in its own component at full width", () => {
    const a = item(1, true, 0, 60, 150);
    const b = item(2, false, 0, 90, 180);
    const unrelated = item(3, false, 2, 60, 120);
    const result = computeSlices([a, b, unrelated]);
    const byId = new Map(result.map((r) => [r.item.id, r]));
    expect(byId.get(3)?.sliceCount).toBe(1);
    expect(byId.get(1)?.sliceCount).toBe(2);
  });
});
