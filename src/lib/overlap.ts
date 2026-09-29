// The lecture-permissive overlap rule: ANU lectures aren't attendance- or
// mark-checked, so a visitor can reasonably "attend" two at once (or a
// lecture alongside a tutorial); only two non-lecture activities (tutorial,
// lab, assessment, ...) overlapping is a genuine, disallowed clash. Pure and
// DB-free — src/lib/db.ts uses isDisallowedClash for the write-path rule,
// and both the server render (fragments.ts via db.ts) and the client
// preview (scripts/timetable-client.ts) import computeSlices, so there is
// exactly one implementation of the side-by-side layout, not two that can
// drift apart.

export interface TimeSpan {
  day: number;
  startMinutes: number;
  endMinutes: number;
}

export function timeOverlaps(a: TimeSpan, b: TimeSpan): boolean {
  return a.day === b.day && a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

export function isDisallowedClash(a: { isLecture: boolean }, b: { isLecture: boolean }): boolean {
  return !a.isLecture && !b.isLecture;
}

export interface OverlapItem extends TimeSpan {
  // The activity id, used only as the final ordering tiebreaker below — not
  // assumed unique across unrelated call sites (the client preview's
  // not-yet-committed candidate uses a sentinel id; see its call site).
  id: number;
  isLecture: boolean;
}

export interface Sliced<T> {
  item: T;
  sliceIndex: number;
  sliceCount: number;
}

// Groups items into connected components by mutual time overlap (any two
// items that overlap land in the same component, even if a third item in
// that component doesn't overlap both of them) and lays each component out
// as N equal-width vertical slices. A component of size 1 gets sliceCount 1
// (full width, no visual change).
//
// Ordering within a component, exactly as approved: lecture(s) first, then
// non-lecture, then ascending start time, then ascending activity id.
//
// Callers must only pass items that are mutually allowed to overlap (no
// disallowed non-lecture/non-lecture pair among them) — addOrSwapPick
// guarantees this for committed picks, and the client preview checks
// isDisallowedClash itself before calling this for a hovered candidate.
export function computeSlices<T extends OverlapItem>(items: T[]): Sliced<T>[] {
  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (timeOverlaps(items[i], items[j])) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const group = groups.get(root) ?? [];
    group.push(i);
    groups.set(root, group);
  }

  const order = (i: number, j: number): number => {
    const a = items[i];
    const b = items[j];
    if (a.isLecture !== b.isLecture) return a.isLecture ? -1 : 1;
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    return a.id - b.id;
  };

  const result: Sliced<T>[] = new Array(n);
  for (const group of groups.values()) {
    group.sort(order);
    group.forEach((index, sliceIndex) => {
      result[index] = { item: items[index], sliceIndex, sliceCount: group.length };
    });
  }
  return result;
}
