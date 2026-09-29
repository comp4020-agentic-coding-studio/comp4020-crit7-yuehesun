// Small formatting helpers shared by the Stage 2 UI (index.astro and, from
// Stage 2c, the fragment API responses) — kept separate from
// scripts/seed-summary.ts's own copy since that script is Stage 1's and
// isn't touched here.
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
