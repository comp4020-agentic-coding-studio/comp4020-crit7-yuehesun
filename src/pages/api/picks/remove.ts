import type { APIRoute } from "astro";
import { gridHourRange, listActivitiesWithSessions, listCourses, removePick } from "../../../lib/db";
import { renderActivityPanel } from "../../../lib/fragments";

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
    let panelHtml: string | null = null;
    if (courseId !== undefined) {
      const { startHour } = gridHourRange();
      const activity = listActivitiesWithSessions(courseId).find((a) => a.id === activityId);
      const courseColor = listCourses().find((c) => c.id === courseId)?.color;
      if (activity && courseColor) panelHtml = renderActivityPanel(activity, undefined, courseId, startHour, courseColor);
    }
    return new Response(JSON.stringify({ ok: true, activityId, gridPickHtml: null, panelHtml }), {
      headers: { "content-type": "application/json" },
    });
  }

  return redirect(courseId ? `/?course=${courseId}` : "/", 303);
};
