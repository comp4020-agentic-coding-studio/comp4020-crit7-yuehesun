import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, inject, it } from "vitest";
import { activities, courses, picks, sessions } from "../src/lib/schema";
import { DAY_LABELS, formatMinutes } from "../src/lib/format";
import { generateSeed, type GeneratedSession } from "../src/lib/seed";

// Drives the RUNNING built server (spec/global-setup.ts) over real HTTP,
// exercising the write path plan.md §6 specifies: persistence, ownership
// isolation, the swap-into-clash regression, and a genuine fresh clash.
const baseUrl = inject("baseUrl");
const seed = generateSeed();

// src/lib/db.ts's seedIfEmpty inserts these three arrays, in this order,
// into empty autoincrementing tables — so array index + 1 IS the row id the
// running server actually assigned. Not re-derived, just read off the same
// generator seed.test.ts already proves is deterministic.
function courseId(code: string): number {
  const i = seed.courses.findIndex((c) => c.code === code);
  if (i < 0) throw new Error(`no such course ${code}`);
  return i + 1;
}
function activityId(courseCode: string, code: string): number {
  const i = seed.activities.findIndex((a) => a.courseCode === courseCode && a.code === code);
  if (i < 0) throw new Error(`no such activity ${courseCode}/${code}`);
  return i + 1;
}
function sessionRowId(session: GeneratedSession): number {
  const i = seed.sessions.indexOf(session);
  if (i < 0) throw new Error("session not from this seed");
  return i + 1;
}
function findSession(courseCode: string, activityCode: string, baseline: boolean, skip = 0): GeneratedSession {
  const matches = seed.sessions.filter(
    (s) => s.courseCode === courseCode && s.activityCode === activityCode && s.baseline === baseline,
  );
  const found = matches[skip];
  if (!found) throw new Error(`no matching session for ${courseCode}/${activityCode} (baseline=${baseline}, skip=${skip})`);
  return found;
}

interface Jar {
  fetch(path: string, init?: RequestInit): Promise<Response>;
}

// A minimal per-owner cookie jar: captures the owner_id Set-Cookie from the
// first response and replays it, so each Jar behaves like one browser.
function makeJar(): Jar {
  let cookie = "";
  return {
    async fetch(path, init = {}) {
      const headers = new Headers(init.headers);
      if (cookie) headers.set("cookie", cookie);
      // Astro's origin-check middleware (on by default) rejects any
      // form-content-typed non-GET request whose Origin doesn't match the
      // request URL — same protection spec/checks.yml's deploy job proves
      // against a foreign origin. A real same-origin form POST always sends
      // this, so a test client has to as well.
      headers.set("origin", baseUrl);
      const res = await fetch(new URL(path, baseUrl), { ...init, headers, redirect: "manual" });
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      return res;
    },
  };
}

async function addPick(jar: Jar, session: GeneratedSession, courseCode: string): Promise<Response> {
  return jar.fetch("/api/picks", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ sessionId: String(sessionRowId(session)), courseId: String(courseId(courseCode)) }),
  });
}

async function removePick(jar: Jar, activity: number, courseCode: string): Promise<Response> {
  return jar.fetch("/api/picks/remove", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ activityId: String(activity), courseId: String(courseId(courseCode)) }),
  });
}

// Stage 3: the panel shows one activity at a time, so a caller checking a
// specific session's picked state has to say which activity's panel to
// load — the course's default (alphabetically-first) activity otherwise.
async function pageHtml(jar: Jar, courseCode: string, activityCode?: string): Promise<string> {
  const activityQs = activityCode ? `&activity=${activityId(courseCode, activityCode)}` : "";
  const res = await jar.fetch(`/?course=${courseId(courseCode)}${activityQs}`);
  return res.text();
}

function sessionLabel(session: GeneratedSession): string {
  return `${DAY_LABELS[session.day]} ${formatMinutes(session.startMinutes)}–${formatMinutes(session.endMinutes)} · ${session.location}`;
}

function isPicked(html: string, session: GeneratedSession): boolean {
  const label = sessionLabel(session);
  const blocks = [...html.matchAll(/<li class="picked"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1].replace(/\s+/g, " "));
  return blocks.some((block) => block.includes(label));
}

describe("timetable: add/swap/remove over HTTP", () => {
  it("persists a pick across a reload", async () => {
    const jar = makeJar();
    const session = findSession("SLOP4225", "LecA", true);

    expect((await addPick(jar, session, "SLOP4225")).status).toBe(303);
    expect(isPicked(await pageHtml(jar, "SLOP4225", "LecA"), session)).toBe(true);
    expect(isPicked(await pageHtml(jar, "SLOP4225", "LecA"), session)).toBe(true);
  });

  it("isolates picks between two owners", async () => {
    const jarA = makeJar();
    const jarB = makeJar();
    const session = findSession("SLOP1836", "LecA", true);

    await addPick(jarA, session, "SLOP1836");

    expect(isPicked(await pageHtml(jarB, "SLOP1836", "LecA"), session)).toBe(false);
    expect(isPicked(await pageHtml(jarA, "SLOP1836", "LecA"), session)).toBe(true);
  });

  it("swapping to a different session in the same activity replaces the old pick", async () => {
    const jar = makeJar();
    const first = findSession("SLOP2805", "TutA", true);
    const second = findSession("SLOP2805", "TutA", false, 1);

    await addPick(jar, first, "SLOP2805");
    expect(isPicked(await pageHtml(jar, "SLOP2805", "TutA"), first)).toBe(true);

    await addPick(jar, second, "SLOP2805");
    const html = await pageHtml(jar, "SLOP2805", "TutA");
    expect(isPicked(html, second)).toBe(true);
    expect(isPicked(html, first)).toBe(false);
  });

  it("rejects swapping into a clash with a different activity's pick, leaving the original untouched", async () => {
    // The regression test for the swap/clash ordering bug logged in
    // process-notes.md: the candidate must be checked against every OTHER
    // pick before anything is written, so a rejected swap can't cost the
    // owner their original pick.
    const jar = makeJar();
    const oldSession = findSession("SLOP4225", "TutA", true);
    const otherPick = findSession("SLOP1836", "ComA", false, 0); // forced-clash side b
    const candidate = findSession("SLOP4225", "TutA", false, 0); // forced-clash side a

    await addPick(jar, oldSession, "SLOP4225");
    await addPick(jar, otherPick, "SLOP1836");

    const res = await addPick(jar, candidate, "SLOP4225");
    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("clash=");
    expect(location).toContain(`with=${sessionRowId(otherPick)}`);

    const html = await pageHtml(jar, "SLOP4225", "TutA");
    expect(isPicked(html, oldSession)).toBe(true);
    expect(isPicked(html, candidate)).toBe(false);
  });

  it("rejects a genuinely overlapping add when there is no old pick to replace", async () => {
    // Both sides are non-lecture (TutA/TutA) — still a genuine, disallowed
    // clash under the lecture-permissive overlap rule.
    const jar = makeJar();
    const first = findSession("SLOP3092", "TutA", false, 0); // forced-clash side b
    const second = findSession("SLOP2805", "TutA", false, 0); // forced-clash side a

    await addPick(jar, first, "SLOP3092");
    const res = await addPick(jar, second, "SLOP2805");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("clash=");
    expect(isPicked(await pageHtml(jar, "SLOP2805", "TutA"), second)).toBe(false);
  });

  it("allows a lecture and a non-lecture activity to overlap (lecture-permissive rule)", async () => {
    // ANU lectures aren't attendance- or mark-checked, so overlapping a
    // lecture with anything is allowed — only non-lecture vs non-lecture is
    // a genuine clash (src/lib/overlap.ts's isDisallowedClash). seed.ts's
    // FORCED_OVERLAPS plants this pair deliberately so it's not left to
    // whatever the PRNG happens to generate.
    const jar = makeJar();
    const lecture = findSession("SLOP4225", "LecA", false, 0); // forced-overlap side a
    const tutorial = findSession("SLOP4225", "TutA", false, 1); // forced-overlap side b

    const lectureRes = await addPick(jar, lecture, "SLOP4225");
    expect(lectureRes.status).toBe(303);
    expect(lectureRes.headers.get("location")).not.toContain("clash=");

    const tutorialRes = await addPick(jar, tutorial, "SLOP4225");
    expect(tutorialRes.status).toBe(303);
    expect(tutorialRes.headers.get("location")).not.toContain("clash=");

    // Stage 3: the two activities no longer share one panel render, so each
    // needs its own fetch to check its picked session.
    expect(isPicked(await pageHtml(jar, "SLOP4225", "LecA"), lecture)).toBe(true);
    expect(isPicked(await pageHtml(jar, "SLOP4225", "TutA"), tutorial)).toBe(true);
  });

  it("adds a non-overlapping session from a different course alongside an existing pick", async () => {
    const jar = makeJar();
    const first = findSession("SLOP4225", "LecA", true);
    const second = findSession("SLOP3092", "LecA", true);

    await addPick(jar, first, "SLOP4225");
    const res = await addPick(jar, second, "SLOP3092");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).not.toContain("clash=");

    expect(isPicked(await pageHtml(jar, "SLOP4225", "LecA"), first)).toBe(true);
    expect(isPicked(await pageHtml(jar, "SLOP3092", "LecA"), second)).toBe(true);
  });

  it("removes a pick", async () => {
    const jar = makeJar();
    const session = findSession("SLOP4225", "LecA", true);

    await addPick(jar, session, "SLOP4225");
    expect(isPicked(await pageHtml(jar, "SLOP4225", "LecA"), session)).toBe(true);

    await removePick(jar, activityId("SLOP4225", "LecA"), "SLOP4225");
    expect(isPicked(await pageHtml(jar, "SLOP4225", "LecA"), session)).toBe(false);
  });
});

describe("database constraints (isolated fixture, no HTTP)", () => {
  // Runs against its own throwaway file + the real migrations, never the
  // live app's DATABASE_PATH — importing src/lib/db.ts here would seed and
  // write into whatever local .data/app.db a dev is using.
  function freshFixture() {
    const file = join(mkdtempSync(join(tmpdir(), "constraint-db-")), "test.db");
    const client = new Database(file);
    client.pragma("foreign_keys = ON");
    const db = drizzle(client);
    migrate(db, { migrationsFolder: "./drizzle" });

    const course = db.insert(courses).values({ code: "X", title: "X", color: "#fff" }).returning({ id: courses.id }).get();
    const activityA = db
      .insert(activities)
      .values({ courseId: course.id, code: "A" })
      .returning({ id: activities.id })
      .get();
    const activityB = db
      .insert(activities)
      .values({ courseId: course.id, code: "B" })
      .returning({ id: activities.id })
      .get();
    const sessionA = db
      .insert(sessions)
      .values({ activityId: activityA.id, day: 0, startMinutes: 540, endMinutes: 600, location: "R" })
      .returning({ id: sessions.id })
      .get();

    return { db, activityAId: activityA.id, activityBId: activityB.id, sessionAId: sessionA.id };
  }

  it("refuses a duplicate (owner_id, activity_id) pick", () => {
    const { db, activityAId, sessionAId } = freshFixture();
    db.insert(picks).values({ ownerId: "o1", sessionId: sessionAId, activityId: activityAId }).run();
    expect(() =>
      db.insert(picks).values({ ownerId: "o1", sessionId: sessionAId, activityId: activityAId }).run(),
    ).toThrow();
  });

  it("refuses a mismatched (session_id, activity_id) pair", () => {
    const { db, activityBId, sessionAId } = freshFixture();
    expect(() =>
      db.insert(picks).values({ ownerId: "o1", sessionId: sessionAId, activityId: activityBId }).run(),
    ).toThrow();
  });
});
