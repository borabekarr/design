// FEEL · nav.ts
// Page changes with a direction, for apps that change pages themselves (a client router,
// tabs, steps): the browser's View Transitions, told which way the person is going.
// feel.css draws it: forward slides in from the trailing side, back from the leading side,
// "fade" crossfades (tabs, same place with new content). Where the browser has no
// View Transitions, the page simply changes.
//
//   go(() => router.push("/settings"), "forward");
//   go(() => setTab("billing"), "fade");
//
// Routers that start the change themselves (Vue Router guards, SvelteKit onNavigate) use
// startVT(update, way): the same transition, but it hands back the ViewTransition (or null
// where there is none) so the router can resolve its own step inside `update`.
//
// Next.js App Router (16.2+) does not need this: use <Link transitionTypes={["feel-forward"]}>
// with React's <ViewTransition> (references/web.md, "Page change").
let turn = 0;
let guarded = false;
function guardTaps() {
  if (guarded || typeof document === "undefined") return;
  guarded = true;
  document.documentElement.addEventListener("click", (e) => {
    const vt = document.activeViewTransition;
    if (!vt || e.target !== document.documentElement) return;
    const x = e.clientX, y = e.clientY;
    vt.skipTransition();
    vt.finished.catch(() => {
    }).finally(() => document.elementFromPoint(x, y)?.click());
  });
}
function startVT(update, way = "forward") {
  const doc = document;
  if (typeof doc.startViewTransition !== "function") return null;
  guardTaps();
  const root = document.documentElement;
  const mine = ++turn;
  root.setAttribute("data-feel-nav", way);
  const vt = doc.startViewTransition(update);
  vt.finished.catch(() => {
  }).finally(() => {
    if (turn === mine) root.removeAttribute("data-feel-nav");
  });
  return vt;
}
function go(update, way = "forward") {
  const vt = startVT(update, way);
  if (!vt) return Promise.resolve(update()).then(() => {
  });
  return vt.finished.catch(() => {
  });
}
export {
  go,
  guardTaps,
  startVT
};
