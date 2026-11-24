// FEEL · presence.ts
// Exit animations for things that are removed from the page (a sheet, a toast, a menu):
// keep the element until its own CSS exit animation has finished, then let it go.
// The CSS decides how it leaves (feel.css, [data-feel-state="closed"]); this only waits.
// No dependencies. For React, see react.ts (usePresence).

/** Resolves when every animation and transition running on `el` (and inside it) has finished. Never waits longer than `cap` ms. */
export function settled(el: Element | null, cap = 1000): Promise<void> {
  if (!el || typeof (el as HTMLElement).getAnimations !== "function") return Promise.resolve();
  return new Promise((resolve) => {
    // One frame so the browser has started the animations the new state asked for.
    requestAnimationFrame(() => {
      const running = (el as HTMLElement).getAnimations({ subtree: true }).filter((a) => a.playState === "running" || a.pending);
      if (!running.length) return resolve();
      const t = setTimeout(resolve, cap);
      Promise.allSettled(running.map((a) => a.finished)).then(() => { clearTimeout(t); resolve(); });
    });
  });
}

// Plain JS (no framework): show and hide an element that has a data-feel move on it, keeping the
// exit on screen until it has played. A hide that is interrupted by a show (reopened mid-exit) does
// not hide it afterwards.
//   show(sheet);            // un-hides it, data-feel-state="open": the enter plays
//   await hide(sheet);      // data-feel-state="closed": the exit plays, then hidden
const turns = new WeakMap<Element, number>();

export function show(el: HTMLElement): void {
  turns.set(el, (turns.get(el) ?? 0) + 1);
  el.removeAttribute("data-feel-dragged");
  el.hidden = false;
  el.setAttribute("data-feel-state", "open");
}

export async function hide(el: HTMLElement, cap = 1000): Promise<void> {
  const mine = (turns.get(el) ?? 0) + 1;
  turns.set(el, mine);
  el.setAttribute("data-feel-state", "closed");
  await settled(el, cap);
  if (turns.get(el) === mine) el.hidden = true;
}

// Native <dialog> and [popover]: Chrome keeps a closing one on screen for its CSS exit (the
// `overlay` and `display` transitions in feel.css). Safari and Firefox take it off screen at once
// (tested: WebKit 27.2, Firefox 155), so the exit never plays. shut() plays it while the element is
// still open, then closes it; in Chrome it just closes (the CSS already animates it).
//   shut(dialog);                                    // instead of dialog.close()
//   dialog.addEventListener("cancel", (e) => { e.preventDefault(); shut(dialog); }); // Escape too
//   shut(menu);                                      // instead of menu.hidePopover()
export async function shut(el: HTMLElement, cap = 1000): Promise<void> {
  const keepsExit = typeof CSS !== "undefined" && CSS.supports("overlay", "auto");
  const isOpen = el instanceof HTMLDialogElement ? el.open : el.matches(":popover-open");
  if (!isOpen) return;
  const mine = (turns.get(el) ?? 0) + 1;
  turns.set(el, mine);
  if (!keepsExit) {
    el.setAttribute("data-feel-state", "closed"); // feel.css: the same exit keyframes as hand-made sheets
    await settled(el, cap);
    if (turns.get(el) !== mine) return;           // opened again meanwhile
  }
  if (el instanceof HTMLDialogElement) el.close(); else el.hidePopover();
  if (!keepsExit) el.removeAttribute("data-feel-state");
}
