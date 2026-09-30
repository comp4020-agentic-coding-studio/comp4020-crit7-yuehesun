# Process overview

## What I built

ANU's timetabling system is hard to use: browsing a course's sessions and checking them against my own timetable happen on separate pages, each switch a full reload. My version shows both at once: choosing an activity lists its sessions on the right; clicking a slot highlights its place on the timetable. Adding or removing one updates only that part of the page. Activities of the same course share one colour, and non-lecture activities get a thick left bar, so a course reads as one unit while its activities stay distinct.

The backend uses four SQLite tables ([README.md](README.md#data-model)). There is no login: an anonymous owner_id cookie identifies each browser as a user, so selections are stored independently and persist across reloads. When a user adds a session, the server checks it against existing selections. If there is a clash, nothing is written and a dialog identifies the conflicting sessions.

The four courses(SLOP4225, SLOP1836, SLOP2805, SLOP3092) come from the
[Slop University gallery](https://courses.slop.university/) of A2 (CC BY 4.0). The agent generated all seed data like sessions and times(live in SQLite database in `.data/`), avoiding leaking personal or university data.


## How I got here


First, the app worked but didn't match the real world, and I caught it by checking by hand. Testing the clash dialog step by step, I found a
display bug (a warning border that never cleared)([`d146d4d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/d146d4d)), but watching that flow
closely showed a deeper modelling issue: lecture–lecture overlaps should not count as clashes in ANU. I changed the rule and required the hover preview to use the same rule and the seed data to demonstrate it. The overlap logic was also consolidated into one shared function.
(the rule change landed across
[`15da208`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/15da208),
[`3f8382c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/3f8382c),
[`1246c98`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/1246c98),
[`9bba39b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/9bba39b),
[`db4be08`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/db4be08),
[`83a575f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/83a575f).)

Catching that depended on small verified steps, so I had the agent write the workflow into `CLAUDE.md`: one plan file kept iterating, a
refine-then-verify pass before each stage, and — most important — diagnose a reported problem before touching any code.
([`6970b4f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/6970b4f))

That rule got tested again later. A lecture in SLOP4225 had two simultaneous sessions, and the agent called it a harmless coincidence. I didn't accept that: a lecture is one class at one time. I ruled that a lecture activity has exactly one session and a second stream is LecB, and the agent added a database constraint and tests.
([`7106ad8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/7106ad8))

