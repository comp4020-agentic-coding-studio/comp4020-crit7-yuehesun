import type { APIRoute } from "astro";
import {
  addOrSwapPick,
  getSessionInfo,
  gridHourRange,
  listActivitiesWithSessions,
  listCourses,
  listPicksForOwner,
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
      const clashPick = listPicksForOwner(locals.ownerId).find((p) => p.sessionId === result.clashWithSessionId);
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
    const pick = listPicksForOwner(locals.ownerId).find((p) => p.sessionId === sessionId);
    if (!pick) return new Response("pick not found", { status: 500 });
    let panelHtml: string | null = null;
    if (courseId !== undefined) {
      const activity = listActivitiesWithSessions(courseId).find((a) => a.id === pick.activityId);
      const courseColor = listCourses().find((c) => c.id === courseId)?.color;
      if (activity && courseColor) panelHtml = renderActivityPanel(activity, pick.sessionId, courseId, startHour, courseColor);
    }
    return new Response(
      JSON.stringify({ ok: true, activityId: pick.activityId, gridPickHtml: renderGridPick(pick, startHour, false), panelHtml }),
      { headers: { "content-type": "application/json" } },
    );
  }

  return redirect(back, 303);
};
