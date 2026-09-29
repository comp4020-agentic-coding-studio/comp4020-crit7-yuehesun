import type { APIRoute } from "astro";
import { gridHourRange, listActivitiesWithSessions, listCourses, listPicksForOwnerWithSlices, removePick } from "../../../lib/db";
import { renderActivityPanel, renderGridPick } from "../../../lib/fragments";

export const prerender = false;

function wantsJson(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("application/json");
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const activityId = Number(form.get("activityId"));
  const courseIdRaw = form.get("courseId");
  const courseId = courseIdRaw ? Number(courseIdRaw) : undefined;

  removePick(locals.ownerId, activityId);

  if (wantsJson(request)) {
    const { startHour } = gridHourRange();
    let panelHtml: string | null = null;
    if (courseId !== undefined) {
      const activity = listActivitiesWithSessions(courseId).find((a) => a.id === activityId);
      const courseColor = listCourses().find((c) => c.id === courseId)?.color;
      if (activity && courseColor) panelHtml = renderActivityPanel(activity, undefined, courseId, startHour, courseColor);
    }
    // Removing a pick can free up space that lets remaining picks re-widen
    // (e.g. removing one side of a split pair), so — same reasoning as
    // /api/picks — the client gets the owner's whole remaining pick set
    // re-rendered rather than a single removed-slot signal.
    const gridPicks = listPicksForOwnerWithSlices(locals.ownerId).map((p) => ({
      activityId: p.activityId,
      html: renderGridPick(p, startHour, false),
    }));
    return new Response(JSON.stringify({ ok: true, activityId, gridPicks, panelHtml }), {
      headers: { "content-type": "application/json" },
    });
  }

  return redirect(courseId ? `/?course=${courseId}` : "/", 303);
};
