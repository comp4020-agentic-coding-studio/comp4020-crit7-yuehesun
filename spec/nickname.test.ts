import { describe, expect, it } from "vitest";
import { nicknameFor } from "../src/lib/nickname";

describe("nicknameFor", () => {
  it("is deterministic: same ownerId, same nickname every time", () => {
    const ownerId = "11111111-1111-4111-8111-111111111111";
    expect(nicknameFor(ownerId)).toBe(nicknameFor(ownerId));
  });

  it("matches the Guest-XXXX display format", () => {
    expect(nicknameFor("11111111-1111-4111-8111-111111111111")).toMatch(/^Guest-[0-9A-F]{4}$/);
  });

  it("differs for different owner ids (not a constant label)", () => {
    const a = nicknameFor("11111111-1111-4111-8111-111111111111");
    const b = nicknameFor("22222222-2222-4222-8222-222222222222");
    expect(a).not.toBe(b);
  });

  it("never contains the raw ownerId as a substring", () => {
    const ownerId = "11111111-1111-4111-8111-111111111111";
    expect(nicknameFor(ownerId)).not.toContain(ownerId);
  });
});
