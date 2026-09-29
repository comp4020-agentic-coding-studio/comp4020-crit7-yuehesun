// Stage 2c: the JS partial-update layer (plan.md §5/§8). Every response
// this script consumes is rendered server-side by src/lib/fragments.ts —
// the exact same functions index.astro used for the initial render — so
// there is exactly one implementation of "what a picked session looks
// like" (plan.md §5's stated preference over a client-side reconstruction).
// With JS disabled, the plain <form> POSTs and <a href> dismiss link this
// progressively enhances still work: this file only intercepts events, it
// never introduces a capability the no-JS path lacks.
//
// The preview split (approval addition #1: split whenever the overlap is
// allowed, not only for a lecture candidate) imports the exact same
// computeSlices/isDisallowedClash src/lib/db.ts uses for committed picks
// (approval addition #3 — one shared implementation), so the ghost never
// shows a layout the server would then render differently once committed.
import { computeSlices, isDisallowedClash, timeOverlaps, type OverlapItem } from "../lib/overlap";

const grid = document.getElementById("grid");
const preview = document.getElementById("grid-preview") as HTMLElement | null;

// Real (non-preview) grid picks currently rendered with inline slice styles
// this hover has temporarily overridden — restored to their server-rendered
// values in hidePreview. Only ever holds entries while a preview with a
// multi-way split is showing.
const splitRestore = new Map<HTMLElement, { width: string; marginLeft: string }>();

function applySliceStyle(el: HTMLElement, sliceIndex: number, sliceCount: number) {
  if (sliceCount > 1) {
    el.style.width = `calc(100% / ${sliceCount})`;
    el.style.marginLeft = `calc(100% / ${sliceCount} * ${sliceIndex})`;
  } else {
    el.style.width = "";
    el.style.marginLeft = "";
  }
}

function existingGridPicks(): HTMLElement[] {
  return grid ? Array.from(grid.querySelectorAll<HTMLElement>(".grid-pick[data-activity-id]")) : [];
}

function showPreview(li: HTMLElement) {
  if (!preview) return;
  const { day, row, span, color, kind, label, start, end } = li.dataset;
  if (!day || !row || !span || !color || !start || !end) return;
  preview.style.gridColumn = String(Number(day) + 2);
  preview.style.gridRow = `${row} / span ${span}`;
  preview.style.backgroundColor = color;
  preview.classList.remove("kind-lecture", "kind-other");
  if (kind) preview.classList.add(kind);
  preview.textContent = label ?? "";
  preview.style.width = "";
  preview.style.marginLeft = "";
  preview.hidden = false;

  // The panel <li> belongs to one activity (the wrapping .activity div, not
  // the <li> itself); its own currently-committed pick (if any) is excluded
  // below, exactly the way addOrSwapPick excludes the old pick before
  // clash-checking — hovering an alternative session for an activity you've
  // already picked shouldn't count as clashing with itself.
  const ownActivityId = Number(li.closest(".activity")?.getAttribute("data-activity-id") ?? NaN);
  const candidate: OverlapItem = {
    id: Number.isFinite(ownActivityId) ? ownActivityId : -1,
    day: Number(day),
    startMinutes: Number(start),
    endMinutes: Number(end),
    isLecture: kind === "kind-lecture",
  };

  const others = existingGridPicks()
    .filter((el) => Number(el.dataset.activityId) !== candidate.id)
    .map((el) => ({
      el,
      item: {
        id: Number(el.dataset.activityId),
        day: Number(el.dataset.day),
        startMinutes: Number(el.dataset.start),
        endMinutes: Number(el.dataset.end),
        isLecture: el.classList.contains("kind-lecture"),
      } as OverlapItem,
    }));

  const disallowed = others.some(
    ({ item }) =>
      timeOverlaps(candidate, item) && isDisallowedClash({ isLecture: candidate.isLecture }, { isLecture: item.isLecture }),
  );
  if (disallowed) return; // plain, unsliced ghost — this add would be rejected

  // Connected component containing the candidate, by mutual time overlap
  // (BFS, same grouping computeSlices does internally). Existing picks are
  // never mutually disallowed — addOrSwapPick guarantees that for anything
  // already committed — so every reachable one is safe to include.
  const componentEls: HTMLElement[] = [];
  const componentItems: OverlapItem[] = [candidate];
  const seen = new Set<HTMLElement>();
  let frontier: OverlapItem[] = [candidate];
  while (frontier.length > 0) {
    const next: OverlapItem[] = [];
    for (const { el, item } of others) {
      if (seen.has(el)) continue;
      if (frontier.some((f) => timeOverlaps(f, item))) {
        seen.add(el);
        componentEls.push(el);
        componentItems.push(item);
        next.push(item);
      }
    }
    frontier = next;
  }
  if (componentEls.length === 0) return; // no overlap at all — plain full-width ghost

  computeSlices(componentItems).forEach((s, i) => {
    if (i === 0) {
      applySliceStyle(preview, s.sliceIndex, s.sliceCount);
      return;
    }
    const el = componentEls[i - 1];
    if (!splitRestore.has(el)) splitRestore.set(el, { width: el.style.width, marginLeft: el.style.marginLeft });
    applySliceStyle(el, s.sliceIndex, s.sliceCount);
  });
}

function hidePreview() {
  if (preview) preview.hidden = true;
  for (const [el, style] of splitRestore) {
    el.style.width = style.width;
    el.style.marginLeft = style.marginLeft;
  }
  splitRestore.clear();
}

function sessionLi(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest("li[data-day]") : null;
}

// Preview highlight: hover/focus/touch all show the same ghost block
// (plan §8's touch-parity requirement), on any session row — not just
// unpicked ones — so a visitor can see where an alternative would land.
document.addEventListener("mouseover", (e) => {
  const li = sessionLi(e.target);
  if (li) showPreview(li);
});
document.addEventListener("mouseout", (e) => {
  if (sessionLi(e.target)) hidePreview();
});
document.addEventListener("focusin", (e) => {
  const li = sessionLi(e.target);
  if (li) showPreview(li);
});
document.addEventListener("focusout", (e) => {
  if (sessionLi(e.target)) hidePreview();
});
document.addEventListener(
  "touchstart",
  (e) => {
    const li = sessionLi(e.target);
    if (li) showPreview(li);
  },
  { passive: true },
);
// touchstart has no automatic "leave" counterpart the way mouseover/focusin
// get mouseout/focusout — without this, a touch-shown ghost never clears on
// a device that only ever sends touch events.
document.addEventListener("touchend", hidePreview, { passive: true });
document.addEventListener("touchcancel", hidePreview, { passive: true });

function findGridPick(activityId: string | number): HTMLElement | null {
  return grid ? grid.querySelector(`.grid-pick[data-activity-id="${activityId}"]`) : null;
}

function firstElement(html: string): HTMLElement | null {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  return wrapper.firstElementChild as HTMLElement | null;
}

function applySuccess(data: {
  activityId: number;
  gridPicks: { activityId: number; html: string }[];
  panelHtml: string | null;
}) {
  // A touch-shown preview has no touchend/touchcancel-driven mouseout
  // equivalent (see the touchstart handler below), so a ghost left over from
  // the session the visitor just committed can otherwise survive the panel
  // swap that follows.
  hidePreview();
  // A write can reshuffle slice widths for picks other than the one just
  // changed (e.g. adding a lecture that now overlaps an existing tutorial
  // splits both), so the server sends back the owner's whole current pick
  // set and every existing .grid-pick gets replaced wholesale, not patched.
  if (grid) {
    existingGridPicks().forEach((el) => el.remove());
    for (const gp of data.gridPicks) {
      const el = firstElement(gp.html);
      if (el) grid.insertBefore(el, preview);
    }
  }

  const panel = document.querySelector(`.session-panel .activity[data-activity-id="${data.activityId}"]`);
  const panelReplacement = data.panelHtml ? firstElement(data.panelHtml) : null;
  if (panel && panelReplacement) panel.replaceWith(panelReplacement);

  updateNavStatus(data.activityId, data.gridPicks.some((gp) => gp.activityId === data.activityId));
}

// The course-list checklist (plan.md §4): a fixed-size ✓/✗ per activity.
// "Picked" is read off the same gridPicks the grid itself was just rebuilt
// from, so this can't disagree with what the grid shows.
function updateNavStatus(activityId: number, picked: boolean) {
  const item = document.querySelector<HTMLElement>(`.course-nav-activity[data-activity-id="${activityId}"]`);
  if (!item) return;
  const icon = item.querySelector(".status-icon");
  const label = item.querySelector(".sr-only");
  if (icon) {
    icon.classList.toggle("status-icon--done", picked);
    icon.classList.toggle("status-icon--todo", !picked);
    icon.textContent = picked ? "✓" : "✗";
  }
  if (label) label.textContent = picked ? "picked" : "not yet picked";
}

let clashRestoreEl: HTMLElement | null = null;
let clashRestoreHtml: string | null = null;

function ensureDialog(): HTMLDialogElement {
  let dialog = document.getElementById("clash-dialog") as HTMLDialogElement | null;
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "clash-dialog";
    document.body.appendChild(dialog);
  }
  if (!dialog.dataset.wired) {
    dialog.dataset.wired = "1";
    dialog.addEventListener("close", () => {
      if (clashRestoreEl && clashRestoreHtml) {
        const restored = firstElement(clashRestoreHtml);
        if (restored) clashRestoreEl.replaceWith(restored);
      }
      clashRestoreEl = null;
      clashRestoreHtml = null;
    });
    // The dismiss link (shared with the no-JS render) navigates to a clean
    // `/?course=` URL when there's no JS; here we short-circuit that into a
    // same-page dialog close instead.
    dialog.addEventListener("click", (e) => {
      const link = e.target instanceof Element ? e.target.closest("a.button") : null;
      if (link) {
        e.preventDefault();
        dialog?.close();
      }
    });
  }
  return dialog;
}

function applyClash(data: { clashWithActivityId: number; clashWithGridPickHtml: string | null; dialogHtml: string }) {
  const existing = findGridPick(data.clashWithActivityId);
  if (existing && data.clashWithGridPickHtml) {
    clashRestoreHtml = existing.outerHTML;
    const replacement = firstElement(data.clashWithGridPickHtml);
    if (replacement) {
      existing.replaceWith(replacement);
      // Track the node actually left in the DOM, not the one we just
      // detached — replaceWith() on a parentless node is a silent no-op, so
      // restoring from the old reference would never put anything back.
      clashRestoreEl = replacement;
    }
  }
  hidePreview();
  const dialog = ensureDialog();
  dialog.innerHTML = data.dialogHtml;
  if (dialog.open) dialog.close();
  dialog.showModal();
}

async function handleSubmit(form: HTMLFormElement) {
  const body = new URLSearchParams(new FormData(form) as unknown as Record<string, string>);
  const res = await fetch(form.action, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (res.status === 409) {
    applyClash(await res.json());
    return;
  }
  if (!res.ok) {
    form.submit();
    return;
  }
  applySuccess(await res.json());
}

document.addEventListener("submit", (e) => {
  const form = e.target;
  if (form instanceof HTMLFormElement && (form.action.endsWith("/api/picks") || form.action.endsWith("/api/picks/remove"))) {
    e.preventDefault();
    void handleSubmit(form);
  }
});
