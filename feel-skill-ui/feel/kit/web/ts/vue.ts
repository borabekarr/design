// FEEL · vue.ts
// The kit for Vue 3: <Transition> hooks that let feel.css play the enter and the exit, and keep
// the element on the page until its exit has finished. Needs nothing but presence.ts.
// feel.css has no .feel-*-enter / -leave classes: the moves read data-feel-state, so turn Vue's
// own CSS classes off with :css="false".
//
//   <Transition :css="false" @enter="feelEnter" @leave="feelLeave">
//     <div v-if="open" data-feel="sheet" data-feel-state="open">…</div>
//   </Transition>
import { settled } from "./presence";

/** @enter: data-feel-state="open" (also for v-show, where the same element comes back), clears a drag's throw. */
export function feelEnter(el: Element, done: () => void): void {
  el.removeAttribute("data-feel-dragged");
  el.setAttribute("data-feel-state", "open");
  settled(el).then(done);
}

/** @leave: data-feel-state="closed", then lets Vue remove (or hide) it once the exit has played. */
export function feelLeave(el: Element, done: () => void): void {
  el.setAttribute("data-feel-state", "closed");
  settled(el).then(done);
}
