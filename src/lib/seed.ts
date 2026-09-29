// The deterministic seed generator: fixed inputs in, identical rows out,
// every run — including CI's throwaway database and a fresh clone. Pure and
// DB-free on purpose (see spec/seed.test.ts, which tests it directly); the
// only thing that touches the database is `seedIfEmpty` in src/lib/db.ts.
//
// The 4 courses are real (fictional) entries reused from our A2 gallery
// (https://courses.slop.university/) rather than invented from scratch —
// see README.md/PROCESS.md for the data-sourcing decision. Their activity
// shapes (which activities, how many alternative sessions each) are authored
// by hand per course, on purpose: that variety — a single compulsory
// lecture, two parallel compulsory lecture streams, a lab-style activity, a
// long tutorial list — is the point of the schema redesign in plan.md §2,
// so it's written deliberately rather than randomised. Session *times*
// within each activity are what the seeded PRNG below fills in.

export interface GeneratedSession {
  courseCode: string;
  activityCode: string;
  day: number; // 0=Mon .. 4=Fri
  startMinutes: number;
  endMinutes: number;
  location: string;
  // True for the one session per activity that belongs to the constructed
  // clash-free baseline (see buildBaseline below) — not a column, just a
  // marker spec/seed.test.ts and db.ts can use to find that set again.
  baseline: boolean;
}

interface GeneratedActivity {
  courseCode: string;
  code: string;
}

interface GeneratedCourse {
  code: string;
  title: string;
  color: string;
}

export interface GeneratedSeed {
  courses: GeneratedCourse[];
  activities: GeneratedActivity[];
  sessions: GeneratedSession[];
  baselineSessions: GeneratedSession[];
  forcedClashPairs: [GeneratedSession, GeneratedSession][];
  // A deliberate, guaranteed lecture-involving overlap — the allowed-overlap
  // counterpart to forcedClashPairs, so "lecture overlaps are allowed" is
  // demoable and testable over HTTP rather than left to whatever the PRNG
  // happens to land on.
  forcedOverlapPairs: [GeneratedSession, GeneratedSession][];
}

interface ActivityPlan {
  code: string;
  durationMinutes: number; // multiple of 30
  totalSessions: number; // includes the baseline session
}

interface CoursePlan extends GeneratedCourse {
  activities: ActivityPlan[];
}

// The working window every session is generated inside: Mon–Fri, 09:00–18:00,
// half-hour slots. The grid in Stage 2+ rounds its own range outward to
// whole hours around whatever sessions actually land here.
const DAYS = 5;
const WINDOW_START_MINUTES = 9 * 60;
const WINDOW_END_MINUTES = 18 * 60;
const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = (WINDOW_END_MINUTES - WINDOW_START_MINUTES) / SLOT_MINUTES;

// A fixed numeric seed, so the same rows come out of mulberry32 every run.
const PRNG_SEED = 0x5eed_1234;

// Invented rooms — no real ANU building/room names, per the data-sourcing
// policy in README.md.
const ROOMS = [
  "Slop Hall 1.02",
  "Slop Hall 2.14",
  "Anomaly Lab A",
  "Anomaly Lab B",
  "Birch LT3",
  "Hanna Neumann 1.20",
  "Manning Clark T4",
  "CSIT N101",
  "Marie Reay G12",
  "RSSS Seminar 3",
];

// The 4 courses (code, title straight from the gallery; the colour is our
// own pick — 4 fixed, hand-picked light/pastel hex values, one per course,
// per plan.md §8) and each course's authored activity shape.
const COURSE_PLANS: CoursePlan[] = [
  {
    code: "SLOP4225",
    title: "Budgeted Language Model Training",
    color: "#FDE68A",
    activities: [
      // 2, not 1: needs a non-baseline alternative to plant FORCED_OVERLAPS'
      // guaranteed lecture-involving overlap below (a lecture with only its
      // clash-free baseline session could never demonstrate the allowed-
      // overlap rule over HTTP).
      { code: "LecA", durationMinutes: 90, totalSessions: 2 },
      { code: "TutA", durationMinutes: 60, totalSessions: 6 },
    ],
  },
  {
    code: "SLOP1836",
    title: "Advanced Topics in Human Computer Interaction: Human-Bionic Interaction",
    color: "#BFDBFE",
    activities: [
      // two parallel compulsory lecture streams — each needs its own pick
      { code: "LecA", durationMinutes: 90, totalSessions: 1 },
      { code: "LecB", durationMinutes: 90, totalSessions: 1 },
      { code: "ComA", durationMinutes: 120, totalSessions: 4 },
    ],
  },
  {
    code: "SLOP2805",
    title: "Still Loading: The Design of Progress Bars",
    color: "#BBF7D0",
    activities: [
      { code: "LecA", durationMinutes: 90, totalSessions: 1 },
      // the long list: exercises the scrollable session sub-list (plan.md §4)
      { code: "TutA", durationMinutes: 60, totalSessions: 11 },
    ],
  },
  {
    code: "SLOP3092",
    title: "Try Again, Later",
    color: "#FBCFE8",
    activities: [
      { code: "LecA", durationMinutes: 90, totalSessions: 1 },
      { code: "TutA", durationMinutes: 60, totalSessions: 5 },
      // an assignment-consultation slot, short and lightly alternatived
      { code: "Asm", durationMinutes: 30, totalSessions: 3 },
    ],
  },
];

interface ActivityRef {
  courseCode: string;
  activityCode: string;
}

interface ForcedClash {
  a: ActivityRef;
  b: ActivityRef;
  day: number;
  startMinutes: number;
}

// Deliberate cross-course overlaps, written explicitly so the clash flow is
// guaranteed demoable rather than left to chance. Each side must land among
// its activity's non-baseline sessions (totalSessions - 1 >= 1), which both
// sides here satisfy.
//
// Both pairs are non-lecture vs non-lecture (TutA/TutA/ComA), which
// spec/seed.test.ts asserts directly: under the lecture-permissive overlap
// rule (src/lib/overlap.ts's isDisallowedClash), only a non-lecture/
// non-lecture overlap is a genuine clash, so a forced *clash* fixture would
// silently stop being one if either side were ever changed to a lecture.
const FORCED_CLASHES: ForcedClash[] = [
  {
    a: { courseCode: "SLOP4225", activityCode: "TutA" },
    b: { courseCode: "SLOP1836", activityCode: "ComA" },
    day: 2,
    startMinutes: 10 * 60,
  },
  {
    a: { courseCode: "SLOP2805", activityCode: "TutA" },
    b: { courseCode: "SLOP3092", activityCode: "TutA" },
    day: 3,
    startMinutes: 13 * 60,
  },
];

// The allowed-overlap counterpart: a lecture deliberately overlapping its
// own course's tutorial, so the rule that lecture overlaps are allowed
// (not just "not forced to clash") is demoable and testable over HTTP, the
// same way FORCED_CLASHES makes the disallowed case demoable. At least one
// side of every pair here must be a lecture.
const FORCED_OVERLAPS: ForcedClash[] = [
  {
    a: { courseCode: "SLOP4225", activityCode: "LecA" },
    b: { courseCode: "SLOP4225", activityCode: "TutA" },
    day: 0,
    startMinutes: 9 * 60,
  },
];

// mulberry32: a small seeded PRNG, good enough for placing invented session
// times deterministically — not cryptographic, and doesn't need to be.
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomRoom(rng: () => number): string {
  return ROOMS[Math.floor(rng() * ROOMS.length)] ?? ROOMS[0];
}

function randomSlot(rng: () => number, durationMinutes: number): { day: number; startMinutes: number } {
  const durationSlots = durationMinutes / SLOT_MINUTES;
  const day = Math.floor(rng() * DAYS);
  const lastStartSlot = SLOTS_PER_DAY - durationSlots;
  const slot = Math.floor(rng() * (lastStartSlot + 1));
  return { day, startMinutes: WINDOW_START_MINUTES + slot * SLOT_MINUTES };
}

// Places one baseline session per activity, built directly rather than
// searched for: each activity's baseline goes into the first slot (scanning
// day-major) that's still free relative to every baseline already placed.
// Since every baseline only ever occupies previously-free slots, the whole
// set built this way is mutually non-overlapping by construction — the
// clash-free full selection plan.md §2/§10 requires.
function placeBaseline(
  occupied: boolean[][],
  durationMinutes: number,
): { day: number; startMinutes: number } {
  const durationSlots = durationMinutes / SLOT_MINUTES;
  for (let day = 0; day < DAYS; day++) {
    for (let slot = 0; slot <= SLOTS_PER_DAY - durationSlots; slot++) {
      let free = true;
      for (let offset = 0; offset < durationSlots; offset++) {
        if (occupied[day][slot + offset]) {
          free = false;
          break;
        }
      }
      if (free) {
        for (let offset = 0; offset < durationSlots; offset++) {
          occupied[day][slot + offset] = true;
        }
        return { day, startMinutes: WINDOW_START_MINUTES + slot * SLOT_MINUTES };
      }
    }
  }
  throw new Error("seed generator: no free slot left for a baseline session — trim the activity plans");
}

function activityKey(ref: ActivityRef): string {
  return `${ref.courseCode}|${ref.activityCode}`;
}

export function generateSeed(): GeneratedSeed {
  const rng = mulberry32(PRNG_SEED);
  const occupied: boolean[][] = Array.from({ length: DAYS }, () => Array<boolean>(SLOTS_PER_DAY).fill(false));

  // Which forced slots (clashes, then allowed overlaps) belong to which
  // activity, in that order — an activity referenced by both would take its
  // clash slot as its first non-baseline session and its overlap slot as
  // its second, though today no activity appears in both lists.
  const forcedSlotsByActivity = new Map<string, { day: number; startMinutes: number }[]>();
  for (const forced of [...FORCED_CLASHES, ...FORCED_OVERLAPS]) {
    for (const side of [forced.a, forced.b]) {
      const key = activityKey(side);
      const slots = forcedSlotsByActivity.get(key) ?? [];
      slots.push({ day: forced.day, startMinutes: forced.startMinutes });
      forcedSlotsByActivity.set(key, slots);
    }
  }

  const courses = COURSE_PLANS.map(({ code, title, color }) => ({ code, title, color }));
  const activities: GeneratedActivity[] = [];
  const sessions: GeneratedSession[] = [];
  const baselineSessions: GeneratedSession[] = [];
  // Looked up again below to pair up each forced clash for the test/report.
  const forcedSessionsByKeyAndSlot = new Map<string, GeneratedSession>();

  for (const course of COURSE_PLANS) {
    for (const activity of course.activities) {
      activities.push({ courseCode: course.code, code: activity.code });
      const key = activityKey({ courseCode: course.code, activityCode: activity.code });

      const baselineSlot = placeBaseline(occupied, activity.durationMinutes);
      const baselineSession: GeneratedSession = {
        courseCode: course.code,
        activityCode: activity.code,
        day: baselineSlot.day,
        startMinutes: baselineSlot.startMinutes,
        endMinutes: baselineSlot.startMinutes + activity.durationMinutes,
        location: randomRoom(rng),
        baseline: true,
      };
      sessions.push(baselineSession);
      baselineSessions.push(baselineSession);

      // The remaining alternatives are free to overlap anything — realism
      // is the point here, not clash-freedom. Any forced-clash slot for this
      // activity is spliced in first; the rest come from the seeded PRNG.
      const forcedSlots = forcedSlotsByActivity.get(key) ?? [];
      const extraCount = activity.totalSessions - 1;
      for (let i = 0; i < extraCount; i++) {
        const slot = i < forcedSlots.length ? forcedSlots[i] : randomSlot(rng, activity.durationMinutes);
        const session: GeneratedSession = {
          courseCode: course.code,
          activityCode: activity.code,
          day: slot.day,
          startMinutes: slot.startMinutes,
          endMinutes: slot.startMinutes + activity.durationMinutes,
          location: randomRoom(rng),
          baseline: false,
        };
        sessions.push(session);
        if (i < forcedSlots.length) {
          forcedSessionsByKeyAndSlot.set(`${key}|${slot.day}|${slot.startMinutes}`, session);
        }
      }
    }
  }

  function resolvePairs(forced: ForcedClash[]): [GeneratedSession, GeneratedSession][] {
    return forced.map((entry) => {
      const a = forcedSessionsByKeyAndSlot.get(`${activityKey(entry.a)}|${entry.day}|${entry.startMinutes}`);
      const b = forcedSessionsByKeyAndSlot.get(`${activityKey(entry.b)}|${entry.day}|${entry.startMinutes}`);
      if (!a || !b) {
        throw new Error(
          `seed generator: forced pair between ${activityKey(entry.a)} and ${activityKey(entry.b)} wasn't planted — check totalSessions leaves room for it`,
        );
      }
      return [a, b];
    });
  }

  const forcedClashPairs = resolvePairs(FORCED_CLASHES);
  const forcedOverlapPairs = resolvePairs(FORCED_OVERLAPS);

  return { courses, activities, sessions, baselineSessions, forcedClashPairs, forcedOverlapPairs };
}
