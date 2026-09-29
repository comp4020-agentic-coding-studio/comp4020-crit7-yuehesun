/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    // Set by src/middleware.ts on every request: the anonymous per-browser
    // partition key every query/write in src/lib/db.ts takes explicitly.
    ownerId: string;
  }
}
