In every earlier crit, the lesson I kept relearning was to verify by hand
instead of trusting a green test suite. This time the real breakthrough was
realising planning deserves that same seriousness. I spent real time
refining the plan before writing any code, and it paid off directly:
reviewing the plan, not yet any code, caught that adding a session would
delete an old pick before checking the new one for a clash — a
swap-into-clash bug the plan would otherwise have shipped
([`e07e1ba`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/e07e1ba)).
A careful plan catches mistakes while they're still just sentences, which
is far cheaper than catching them in a running app.

But the plan still wasn't enough by the end. Only once I was actually using
the built page did I find that a "clash" between a lecture and a tutorial
isn't a real clash at ANU — a modelling problem invisible on paper. Fixing
it meant touching the server logic, the seed data, and the client script
across six commits
([`d146d4d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/d146d4d)
through
[`83a575f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/83a575f)).
The further into the build a problem surfaces, the higher it costs to fix —
which is exactly why a plan can never be the whole answer.

So this changed what I think good development looks like. I used to think
it meant catching problems reliably, however late. Now I think it means
catching as many as possible early, by taking planning seriously, while
accepting that some only exist once a human sees the running app — which
is what manual verification is for. I wrote both habits into `CLAUDE.md` so
neither gets skipped again.
