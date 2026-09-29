import { DAY_LABELS, formatMinutes } from "./format";
import { kindClass } from "./activity-kind";
import type { ActivityWithSessions, PickWithSlice, SessionInfo } from "./db";

// The single implementation of "what a picked session looks like" (plan.md
// §5's option (b)): index.astro's full-page render and the /api/picks*
// JSON-fragment response for the JS partial-update path both call these
// functions, so the two can never drift apart the way a hand-reconstructed
// client-side re-render would.

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function rowSpan(startHour: number, startMinutes: number, endMinutes: number): { row: number; span: number } {
  return { row: 2 + (startMinutes - startHour * 60) / 30, span: (endMinutes - startMinutes) / 30 };
}

// sliceIndex/sliceCount come from the shared computeSlices layout
// (src/lib/overlap.ts, via db.ts's listPicksForOwnerWithSlices) — the one
// place that decides whether a pick is split and where. A sliceCount of 1
// renders exactly as before (full width); sliceCount > 1 narrows the block
// to an equal-width column and offsets it, so two allowed-overlapping picks
// (a lecture and anything else) land side by side in the same grid cell.
export function renderGridPick(pick: PickWithSlice, startHour: number, clash: boolean): string {
  const { row, span } = rowSpan(startHour, pick.startMinutes, pick.endMinutes);
  const warn = clash ? '<span aria-hidden="true">⚠ </span>' : "";
  const classes = ["grid-pick", kindClass(pick.activityCode), clash ? "clash" : ""].filter(Boolean).join(" ");
  const sliceStyle =
    pick.sliceCount > 1
      ? ` width: calc(100% / ${pick.sliceCount}); margin-left: calc(100% / ${pick.sliceCount} * ${pick.sliceIndex});`
      : "";
  return (
    `<a class="${classes}" href="/?course=${pick.courseId}&activity=${pick.activityId}" data-activity-id="${pick.activityId}" ` +
    `data-day="${pick.day}" data-start="${pick.startMinutes}" data-end="${pick.endMinutes}" ` +
    // background-color (not the "background" shorthand) so the kind-based
    // stripe pattern below, set via background-image in styles.css, doesn't
    // get reset to none by this inline style.
    `style="grid-column: ${pick.day + 2}; grid-row: ${row} / span ${span}; background-color: ${pick.courseColor};${sliceStyle}">` +
    `${warn}${escapeHtml(pick.courseCode)} · ${escapeHtml(pick.activityCode)}</a>`
  );
}

// Every session gets the row/span/day/colour data attributes (not just the
// picked one) so the hover/focus/touch preview highlight (plan.md §8) can
// position a ghost block on the grid for ANY session in the list, not only
// committed picks.
export function renderActivityPanel(
  activity: ActivityWithSessions,
  pickedSessionId: number | undefined,
  courseId: number,
  startHour: number,
  courseColor: string,
): string {
  const checkmark =
    pickedSessionId !== undefined ? ' <span aria-hidden="true">✓</span><span class="sr-only">picked</span>' : "";

  const items = activity.sessions
    .map((session) => {
      const picked = session.id === pickedSessionId;
      const { row, span } = rowSpan(startHour, session.startMinutes, session.endMinutes);
      const label = `${escapeHtml(activity.code)} · ${DAY_LABELS[session.day]} ${formatMinutes(session.startMinutes)}–${formatMinutes(session.endMinutes)}`;
      const timeText = `${DAY_LABELS[session.day]} ${formatMinutes(session.startMinutes)}–${formatMinutes(session.endMinutes)} · ${escapeHtml(session.location)}`;
      const action = picked
        ? `<form method="POST" action="/api/picks/remove"><input type="hidden" name="activityId" value="${activity.id}" /><input type="hidden" name="courseId" value="${courseId}" /><button type="submit">Remove</button></form>`
        : `<form method="POST" action="/api/picks"><input type="hidden" name="sessionId" value="${session.id}" /><input type="hidden" name="courseId" value="${courseId}" /><button type="submit">Add</button></form>`;
      return (
        `<li${picked ? ' class="picked"' : ""} data-day="${session.day}" data-row="${row}" data-span="${span}" ` +
        `data-start="${session.startMinutes}" data-end="${session.endMinutes}" ` +
        `data-color="${courseColor}" data-kind="${kindClass(activity.code)}" data-label="${label}" tabindex="0">` +
        `<span>${timeText}</span>${action}</li>`
      );
    })
    .join("");

  return (
    `<div class="activity" data-activity-id="${activity.id}">` +
    `<h3>${escapeHtml(activity.code)}${checkmark}</h3>` +
    `<ul class="session-list">${items}</ul>` +
    `</div>`
  );
}

// Shared by the SSR no-JS clash render (dismissHref navigates to a clean
// URL, clearing ?clash=&with=) and the JS 409 path (the same link is
// intercepted client-side to close the dialog instead) — one markup, two
// dismiss mechanisms, neither of which needs its own copy of the wording.
export function renderClashDialogInner(candidate: SessionInfo, existing: SessionInfo, dismissCourseId: number): string {
  const describe = (s: SessionInfo) =>
    `<strong>${escapeHtml(s.courseCode)} ${escapeHtml(s.activityCode)}</strong> (${DAY_LABELS[s.day]} ${formatMinutes(s.startMinutes)}–${formatMinutes(s.endMinutes)})`;
  return (
    `<h2 id="clash-heading">That clashes with a session you already picked</h2>` +
    `<p>${describe(candidate)} overlaps ${describe(existing)}, which is already on your timetable. Remove it first if you want to make this swap.</p>` +
    `<a class="button" href="/?course=${dismissCourseId}">OK</a>`
  );
}
