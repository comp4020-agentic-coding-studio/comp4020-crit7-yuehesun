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
  Watch for a real fork during the work: a point where the obvious thing
  carried a mistake or risk, and we did something else instead for a
  reason. Log it in `process-notes.md` and tell me — the rule in
  `CLAUDE.md`, check in `spec/`, or deletion it deserves doesn't have to
  exist yet, but say exactly what's missing and which stage adds it.
- Don't log chat-only corrections, renames, tool workarounds, progress
  notes, or mechanical cleanup with no real alternative considered.
- For each entry, record: what happened, the obvious alternative, what we
  did instead, why it helped (evidence, or what's missing), and the commit
  hash — real, from `git log`/`git show`, or `pending: Stage N` if nothing's
  committed yet. Never invent a hash.
- Before shipping: remind me to write `PROCESS.md` — pick only the most
  important moment from `process-notes.md` and write it up as a coherent,
  clearly reasoned narrative of the whole build, brief to harness. A crit
  week needs 150–300 words; an assignment needs 400–600.
- Also remind me to write `reflections/` from the whole `process-notes.md`,
  kept moments or not.
