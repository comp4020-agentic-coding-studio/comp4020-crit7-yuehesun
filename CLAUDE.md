# Your harness

This file is yours, and it arrives empty on purpose. The rules you hold the
agent to are part of what gets marked, so they should be rules you decided on.

Nothing about the starter is recorded here. What the repo ships is explained
where it lives --- `fly.toml`, the `Dockerfile`, the CI workflow and
`spec/README.md` each say what they fix --- and the
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec. Read them before you plan or build;
what the agent needs to carry from any of it is your call.

## Commits

- Commit incrementally, and tell me after each commit — no batching.

## Process

- Read the `PROCESS.md` template in this repo and the [Assessment
  page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/).
  Watch for harness moments during the work: a real fork where a mistake or
  risk was turned into a rule in `CLAUDE.md`, a check or test in `spec/`, or
  an attempt thrown away and committed as a deletion. When one happens, log
  it in `process-notes.md` and tell me.
- Don't log chat-only corrections, renames, tool workarounds, or progress
  notes.
- For each entry, record: what happened, the obvious alternative, what we
  did instead, why it helped (evidence: a failing-then-passing test, a run
  output, or a before/after), and the commit hash. The commit must really
  exist — get it from `git log`/`git show`, never invent one.
- Before shipping: remind me to write `PROCESS.md` — pick only the most
  important moment from `process-notes.md` and write it up as a coherent,
  clearly reasoned narrative of the whole build, brief to harness. A crit
  week needs 150–300 words; an assignment needs 400–600.
- Also remind me to write `reflections/` from the whole `process-notes.md`,
  kept moments or not.
