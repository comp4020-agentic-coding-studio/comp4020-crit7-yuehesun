# Process overview

<!-- TEMPLATE: this file is a shape to fill in, not a form. Replace everything
     in it with your own overview, and delete this comment — `pnpm
     check:evidence` will remind you if it's still here. -->

Written by you, for a reader: how you got from the brief to the harness and
agentic workflow behind this submission. Markers read this file and follow its
citations; they don't trawl the repo for evidence you didn't point at.

This file is the shape; the course site's
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
is the requirement, and its
[word counts](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#word-counts)
cover every deliverable.

## What I built

A sentence or two. `README.md` is where the account of what the app is and what
good means here lives; this file is how you got there.

## How I got here

**Deciding where the data comes from.** Before writing any schema, I asked
whether the brief expected real ANU data:

> Where does the data come from for this full-stack task? ... Should we use
> real university data or mock data?

Neither the brief nor the spec says, so it was mine to decide. Since the repo
and the running app both go public at the cutoff, the only safe answer was:
nothing real. I chose to write my own seed data rather than scrape or hand-type
anything from an actual ANU system, and to reuse the fictional courses from our
A2 gallery instead of inventing new ones from scratch — already public, already
fictional, so it carries none of the privacy risk real data would. Documented in
`README.md` in [`93dfd7c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yuehesun/commit/93dfd7c).

Cite the record as you go, as links whose text is the commit hash or range and
whose target is this repo's commit or compare URL, so a reader clicks straight
to the evidence:

- one commit: [`a1b2c3d`](https://github.com/YOUR-ORG/YOUR-REPO/commit/a1b2c3d)
- a range:
  [`a1b2c3d...e4f5a6b`](https://github.com/YOUR-ORG/YOUR-REPO/compare/a1b2c3d...e4f5a6b)

Screenshots are welcome where one carries the point better than a sentence does.
Commit the file to this repo and link it with a **relative** path, which is what
makes it render on GitHub: `![alt text](docs/before.png)`. Images don't count
towards the word count and don't replace the citation.

## Before you ship

`pnpm check:evidence` verifies that this comment is gone, that your citations
resolve to real commits, that a crit week's reflection entry is in
`reflections/`, and that your `CLAUDE.md` is there. It checks that your account
is traceable, not that it is good: that is the marker's call.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.
