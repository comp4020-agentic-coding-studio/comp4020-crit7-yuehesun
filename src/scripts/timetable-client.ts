// Stage 2c: the JS partial-update layer (plan.md §5/§8). Every response
// this script consumes is rendered server-side by src/lib/fragments.ts —
// the exact same functions index.astro used for the initial render — so
// there is exactly one implementation of "what a picked session looks
// like" (plan.md §5's stated preference over a client-side reconstruction).
// With JS disabled, the plain <form> POSTs and <a href> dismiss link this
// progressively enhances still work: this file only intercepts events, it
// never introduces a capability the no-JS path lacks.

const grid = document.getElementById("grid");
const preview = document.getElementById("grid-preview") as HTMLElement | null;

function showPreview(li: HTMLElement) {
  if (!preview) return;
  const { day, row, span, color, kind, label } = li.dataset;
  if (!day || !row || !span || !color) return;
  preview.style.gridColumn = String(Number(day) + 2);
  preview.style.gridRow = `${row} / span ${span}`;
  preview.style.backgroundColor = color;
  preview.classList.remove("kind-lecture", "kind-other");
  if (kind) preview.classList.add(kind);
  preview.textContent = label ?? "";
  preview.hidden = false;
}

function hidePreview() {
  if (preview) preview.hidden = true;
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

function applySuccess(data: { activityId: number; gridPickHtml: string | null; panelHtml: string | null }) {
  // A touch-shown preview has no touchend/touchcancel-driven mouseout
  // equivalent (see the touchstart handler below), so a ghost left over from
  // the session the visitor just committed can otherwise survive the panel
  // swap that follows.
  hidePreview();
  const old = findGridPick(data.activityId);
  if (old) old.remove();
  const replacement = data.gridPickHtml ? firstElement(data.gridPickHtml) : null;
  if (replacement && grid) grid.insertBefore(replacement, preview);

  const panel = document.querySelector(`.session-panel .activity[data-activity-id="${data.activityId}"]`);
  const panelReplacement = data.panelHtml ? firstElement(data.panelHtml) : null;
  if (panel && panelReplacement) panel.replaceWith(panelReplacement);
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
