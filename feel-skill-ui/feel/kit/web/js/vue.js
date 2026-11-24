// FEEL · vue.ts
// The kit for Vue 3: <Transition> hooks that let feel.css play the enter and the exit, and keep
// the element on the page until its exit has finished. Needs nothing but presence.ts.
// feel.css has no .feel-*-enter / -leave classes: the moves read data-feel-state, so turn Vue's
// own CSS classes off with :css="false".
//
//   <Transition :css="false" @enter="feelEnter" @leave="feelLeave">
//     <div v-if="open" data-feel="sheet" data-feel-state="open">…</div>
//   </Transition>
import { settled } from "./presence.js";
function feelEnter(el, done) {
  el.removeAttribute("data-feel-dragged");
  el.setAttribute("data-feel-state", "open");
  settled(el).then(done);
}
function feelLeave(el, done) {
  el.setAttribute("data-feel-state", "closed");
  settled(el).then(done);
}
export {
  feelEnter,
  feelLeave
};
