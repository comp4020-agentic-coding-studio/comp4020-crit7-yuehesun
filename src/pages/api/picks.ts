import type { APIRoute } from "astro";
import { addOrSwapPick } from "../../lib/db";

// Not prerenderable: every request needs the request-scoped owner cookie
// and a live database write.
export const prerender = false;

// The no-JS form path (plan.md §5/§6): plain POST, 303 back to the course
// the form was submitted from, clash state carried as query params for
// index.astro to read and render as a <dialog open>. Stage 2c adds a
// JSON/fragment response for the JS fetch-intercepted path alongside this.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const sessionId = Number(form.get("sessionId"));
  const courseId = form.get("courseId");
  const back = courseId ? `/?course=${courseId}` : "/";

  const result = addOrSwapPick(locals.ownerId, sessionId);
  if (!result.ok) {
    const sep = back.includes("?") ? "&" : "?";
    return redirect(`${back}${sep}clash=${sessionId}&with=${result.clashWithSessionId}`, 303);
  }
  return redirect(back, 303);
};
