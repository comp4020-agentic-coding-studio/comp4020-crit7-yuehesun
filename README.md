# Your prototype

<!-- TEMPLATE: this file is yours, and the deployed app publishes it in full at
     /readme/ --- a visitor reads it before they touch the app, and so does the
     marker. Replace everything in it, this comment included. -->

What this is, in a paragraph: the thing, and what it's for.

## What good looks like here

**Data.** This app never seeds real ANU data or personal information: the repo
(and the running app) go public at the cutoff, so anything real landed in the
database — actual course codes tied to actual rooms, anyone's actual name —
would leak. Course/room data is instead handwritten or copied in from
[our A2 gallery](https://courses.slop.university/) (fictional courses already
published, publicly, as part of Assignment 2), landed as a one-off seed rather
than fetched live: the app's own SQLite database stays the single source of
truth at runtime, and doesn't depend on an external site staying up. This is a
judgement call — no check in `spec/` enforces it, only the fact that nothing
real appears in the seed data.
