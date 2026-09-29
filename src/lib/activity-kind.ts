// `activities.code` is deliberately free text, not an enum (schema.ts) —
// real course structures vary too much for a fixed set of kinds. This is a
// display-only heuristic on top of that free text, not a new source of
// truth: every seeded activity code follows the "Lec*" convention for
// lectures, so a prefix check is enough to tell lectures apart from
// everything else (tutorials, labs, assessments) without a schema change.
//
// Shared by fragments.ts (rendering), db.ts (the overlap rule) and seed.ts
// (seed invariants), so there is exactly one definition of "is this
// activity a lecture" rather than one per call site.
export function isLecture(activityCode: string): boolean {
  return activityCode.startsWith("Lec");
}

export function kindClass(activityCode: string): string {
  return isLecture(activityCode) ? "kind-lecture" : "kind-other";
}
