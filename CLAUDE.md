# Your harness

This file is yours, and it arrives empty on purpose. The rules you hold the
agent to are part of what gets marked, so they should be rules you decided on.

Nothing about the starter is recorded here. What the repo ships is explained
where it lives --- `fly.toml`, the `Dockerfile`, the CI workflow and
`spec/README.md` each say what they fix --- and the
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec. Read them before you plan or build;
what the agent needs to carry from any of it is your call.

## Process discipline

- Commit incrementally, and tell me after each commit — no batching.
- A moment = a real fork: the obvious alternative, what we did instead, why
  it helped. Log it in `process-notes.md` with exactly one tag: **harness**
  (a rule/check/test/deletion is actually committed), **pending** (the
  correction is real but nothing enforces it yet — say what's missing and
  which stage adds it), or **retry** (only fixed in chat, not citable).
- `plan.md` is scratch, never citable evidence.
- `PROCESS.md` is curated and citable-only — only I promote into it; don't
  edit its content unless I explicitly ask.
- Before shipping: remind me to trim `PROCESS.md` to 150–300 words and write
  `reflections/crit-7.md` from `process-notes.md`, kept moments or not.
