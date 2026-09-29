import type { APIRoute } from "astro";
import { removePick } from "../../../lib/db";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const activityId = Number(form.get("activityId"));
  const courseId = form.get("courseId");

  removePick(locals.ownerId, activityId);
  return redirect(courseId ? `/?course=${courseId}` : "/", 303);
};
