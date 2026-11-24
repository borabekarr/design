// FEEL · svelte.ts
// The kit for Svelte (4 and 5): transitions that let feel.css play the enter and the exit, and
// tell Svelte how long the exit takes so it keeps the element until it has played.
// Use both, always:
//
//   {#if open}<div data-feel="sheet" data-feel-state="open" in:enter out:leave>…</div>{/if}
//
// The in: is required: when a sheet is reopened mid-exit, Svelte 5 keeps the same element and
// only plays its intro; without enter() it would stay "closed", off screen.

type Config = { duration: number };

// What is left of the CSS's own animations on the element (Svelte adds empty ones of its own: skipped).
function remaining(node: Element, cap = 1000): number {
  if (typeof (node as HTMLElement).getAnimations !== "function") return 0;
  let ms = 0;
  for (const a of (node as HTMLElement).getAnimations({ subtree: true })) {
    if (!("animationName" in a) && !("transitionProperty" in a)) continue;
    const end = Number(a.effect?.getComputedTiming().endTime ?? 0), now = Number(a.currentTime ?? 0);
    if (Number.isFinite(end)) ms = Math.max(ms, end - now);
  }
  return Math.min(Math.max(ms, 0), cap);
}

/** in:enter — data-feel-state="open" (the sheet rises again if it was leaving), clears a drag's throw. */
export function enter(node: Element): Config {
  node.removeAttribute("data-feel-dragged");
  node.setAttribute("data-feel-state", "open");
  return { duration: remaining(node) };
}

/** out:leave — data-feel-state="closed"; Svelte removes it when the exit has played. */
export function leave(node: Element): Config {
  node.setAttribute("data-feel-state", "closed");
  return { duration: remaining(node) };
}
