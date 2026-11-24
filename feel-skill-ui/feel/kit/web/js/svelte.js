// FEEL · svelte.ts
// The kit for Svelte (4 and 5): transitions that let feel.css play the enter and the exit, and
// tell Svelte how long the exit takes so it keeps the element until it has played.
// Use both, always:
//
//   {#if open}<div data-feel="sheet" data-feel-state="open" in:enter out:leave>…</div>{/if}
//
// The in: is required: when a sheet is reopened mid-exit, Svelte 5 keeps the same element and
// only plays its intro; without enter() it would stay "closed", off screen.
function remaining(node, cap = 1e3) {
  if (typeof node.getAnimations !== "function") return 0;
  let ms = 0;
  for (const a of node.getAnimations({ subtree: true })) {
    if (!("animationName" in a) && !("transitionProperty" in a)) continue;
    const end = Number(a.effect?.getComputedTiming().endTime ?? 0), now = Number(a.currentTime ?? 0);
    if (Number.isFinite(end)) ms = Math.max(ms, end - now);
  }
  return Math.min(Math.max(ms, 0), cap);
}
function enter(node) {
  node.removeAttribute("data-feel-dragged");
  node.setAttribute("data-feel-state", "open");
  return { duration: remaining(node) };
}
function leave(node) {
  node.setAttribute("data-feel-state", "closed");
  return { duration: remaining(node) };
}
export {
  enter,
  leave
};
