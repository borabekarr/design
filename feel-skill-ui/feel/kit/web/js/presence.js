// FEEL · presence.ts
// Exit animations for things that are removed from the page (a sheet, a toast, a menu):
// keep the element until its own CSS exit animation has finished, then let it go.
// The CSS decides how it leaves (feel.css, [data-feel-state="closed"]); this only waits.
// No dependencies. For React, see react.ts (usePresence).
function settled(el, cap = 1e3) {
  if (!el || typeof el.getAnimations !== "function") return Promise.resolve();
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const running = el.getAnimations({ subtree: true }).filter((a) => a.playState === "running" || a.pending);
      if (!running.length) return resolve();
      const t = setTimeout(resolve, cap);
      Promise.allSettled(running.map((a) => a.finished)).then(() => {
        clearTimeout(t);
        resolve();
      });
    });
  });
}
const turns = /* @__PURE__ */ new WeakMap();
function show(el) {
  turns.set(el, (turns.get(el) ?? 0) + 1);
  el.removeAttribute("data-feel-dragged");
  el.hidden = false;
  el.setAttribute("data-feel-state", "open");
}
async function hide(el, cap = 1e3) {
  const mine = (turns.get(el) ?? 0) + 1;
  turns.set(el, mine);
  el.setAttribute("data-feel-state", "closed");
  await settled(el, cap);
  if (turns.get(el) === mine) el.hidden = true;
}
async function shut(el, cap = 1e3) {
  const keepsExit = typeof CSS !== "undefined" && CSS.supports("overlay", "auto");
  const isOpen = el instanceof HTMLDialogElement ? el.open : el.matches(":popover-open");
  if (!isOpen) return;
  const mine = (turns.get(el) ?? 0) + 1;
  turns.set(el, mine);
  if (!keepsExit) {
    el.setAttribute("data-feel-state", "closed");
    await settled(el, cap);
    if (turns.get(el) !== mine) return;
  }
  if (el instanceof HTMLDialogElement) el.close();
  else el.hidePopover();
  if (!keepsExit) el.removeAttribute("data-feel-state");
}
export {
  hide,
  settled,
  show,
  shut
};
