import type { APIRoute } from "astro";
import {
  addOrSwapPick,
  getSessionInfo,
  gridHourRange,
  listActivitiesWithSessions,
  listCourses,
  listPicksForOwnerWithSlices,
} from "../../lib/db";
import { renderActivityPanel, renderClashDialogInner, renderGridPick } from "../../lib/fragments";

// Not prerenderable: every request needs the request-scoped owner cookie
// and a live database write.
export const prerender = false;

// The JS fetch-intercepted path (plan.md §5) asks for JSON via this header;
// a plain <form> submit never sends it, so the same handler serves both the
// no-JS 303-redirect path and the JS fragment-response path.
function wantsJson(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("application/json");
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const sessionId = Number(form.get("sessionId"));
  const courseIdRaw = form.get("courseId");
  const courseId = courseIdRaw ? Number(courseIdRaw) : undefined;
  const back = courseId ? `/?course=${courseId}` : "/";
  const json = wantsJson(request);
  const { startHour } = gridHourRange();

  const result = addOrSwapPick(locals.ownerId, sessionId);

  if (!result.ok) {
    if (json) {
      const candidate = getSessionInfo(sessionId);
      const existing = getSessionInfo(result.clashWithSessionId);
      // Nothing was written, so nobody's slice layout changed: only the one
      // already-picked session that clashed needs re-rendering (with the
      // warning icon), not the owner's full pick set.
      const clashPick = listPicksForOwnerWithSlices(locals.ownerId).find((p) => p.sessionId === result.clashWithSessionId);
      if (!candidate || !existing || !clashPick) return new Response("session not found", { status: 404 });
      return new Response(
        JSON.stringify({
          ok: false,
          clashWithActivityId: clashPick.activityId,
          clashWithGridPickHtml: renderGridPick(clashPick, startHour, true),
          dialogHtml: renderClashDialogInner(candidate, existing, courseId ?? clashPick.courseId),
        }),
        { status: 409, headers: { "content-type": "application/json" } },
      );
    }
    const sep = back.includes("?") ? "&" : "?";
    return redirect(`${back}${sep}clash=${sessionId}&with=${result.clashWithSessionId}`, 303);
  }

  if (json) {
    // A write can reshuffle slice widths for picks other than the one just
    // added (e.g. adding a lecture that now overlaps an existing tutorial
    // splits both) — so the client gets the owner's whole current pick set
    // re-rendered, not just the one that changed.
    const picks = listPicksForOwnerWithSlices(locals.ownerId);
    const pick = picks.find((p) => p.sessionId === sessionId);
    if (!pick) return new Response("pick not found", { status: 500 });
    let panelHtml: string | null = null;
    if (courseId !== undefined) {
      const activity = listActivitiesWithSessions(courseId).find((a) => a.id === pick.activityId);
      const courseColor = listCourses().find((c) => c.id === courseId)?.color;
      if (activity && courseColor) panelHtml = renderActivityPanel(activity, pick.sessionId, courseId, startHour, courseColor);
    }
    const gridPicks = picks.map((p) => ({ activityId: p.activityId, html: renderGridPick(p, startHour, false) }));
    return new Response(JSON.stringify({ ok: true, activityId: pick.activityId, gridPicks, panelHtml }), {
      headers: { "content-type": "application/json" },
    });
  }

  return redirect(back, 303);
};
