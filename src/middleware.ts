import { defineMiddleware } from "astro:middleware";

// Every visitor gets an anonymous, per-browser id: no login, no visible
// identity, just a partition key so simultaneous crit visitors don't
// trample each other's timetable (plan.md §7). Every query and write in
// src/lib/db.ts takes this ownerId explicitly.
const COOKIE_NAME = "owner_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const onRequest = defineMiddleware((context, next) => {
  let ownerId = context.cookies.get(COOKIE_NAME)?.value;
  if (!ownerId) {
    ownerId = crypto.randomUUID();
    context.cookies.set(COOKIE_NAME, ownerId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: ONE_YEAR_SECONDS,
    });
  }
  context.locals.ownerId = ownerId;
  return next();
});
