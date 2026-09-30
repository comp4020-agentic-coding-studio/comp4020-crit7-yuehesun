import { createHash } from "node:crypto";

// The owner_id cookie (src/middleware.ts) is httpOnly and unreadable by
// client JS on purpose — a "Hello, Guest-XXXX" greeting must not undo that
// by exposing the raw id or a reversible slice of it. Instead: hash the id
// server-side and show only a short, one-way-derived label. Deterministic
// (same ownerId -> same nickname every render) without needing any new
// storage; not reversible back to the ownerId.
export function nicknameFor(ownerId: string): string {
  const hash = createHash("sha256").update(ownerId).digest("hex");
  return `Guest-${hash.slice(0, 4).toUpperCase()}`;
}
