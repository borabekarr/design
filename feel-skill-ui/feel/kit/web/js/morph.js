// FEEL · morph.ts
// Something small that opens into something big over the page (a mini player into the full
// player, a thumbnail into a viewer sheet, a compose button into the composer): the small one's
// picture flies to its place in the big one while the big one opens, and flies back when it
// closes (also after a drag: call it from drag's onThrow). This is the shared element for things
// that open *over* the page; page changes use View Transitions (nav.ts, references/web.md §6).
//
//   show(player); morph(miniArt, playerArt, { within: player });   // open: mini → big
//   morph(playerArt, miniArt); hide(player);                         // close: big → mini
//
// `within`: the container that is itself moving in (the sheet), so the flight lands where the
// picture will rest, not where it is in the sheet's first frame. A copy of the larger picture
// flies above everything; both real ones are hidden during the flight. It moves on-screen to
// on-screen, so it uses the slow token with ease-in-out; flying back (big to small, a close) takes
// the exit share of that, like every exit. Reduce motion: no flight.
let flying = null;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
function token(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function ms(v) {
  const n = parseFloat(v);
  return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1e3 : n || 300;
}
function morph(from, to, opts = {}) {
  flying?.();
  if (!from || !to || reduced() || typeof to.animate !== "function") return Promise.resolve();
  const a = from.getBoundingClientRect();
  let b = to.getBoundingClientRect();
  const w = opts.within;
  if (w) {
    const r = w.getBoundingClientRect();
    b = new DOMRect(b.left - r.left + w.offsetLeft, b.top - r.top + w.offsetTop, b.width, b.height);
  }
  if (!a.width || !b.width) return Promise.resolve();
  const big = a.width * a.height >= b.width * b.height ? from : to;
  const copy = big.cloneNode(true);
  copy.removeAttribute("id");
  copy.setAttribute("aria-hidden", "true");
  const cs = getComputedStyle(big);
  const ra = parseFloat(getComputedStyle(from).borderTopLeftRadius) || 0;
  const rb = parseFloat(getComputedStyle(to).borderTopLeftRadius) || 0;
  Object.assign(copy.style, {
    position: "fixed",
    left: `${b.left}px`,
    top: `${b.top}px`,
    width: `${b.width}px`,
    height: `${b.height}px`,
    margin: "0",
    transform: "none",
    translate: "none",
    scale: "none",
    transformOrigin: "0 0",
    objectFit: cs.objectFit,
    boxShadow: getComputedStyle(to).boxShadow,
    overflow: "hidden",
    zIndex: "2147483000",
    pointerEvents: "none",
    visibility: "visible",
    transition: "none",
    animation: "none"
  });
  document.body.appendChild(copy);
  const keep = [from.style.visibility, to.style.visibility];
  from.style.visibility = "hidden";
  to.style.visibility = "hidden";
  const sx = a.width / b.width, sy = a.height / b.height;
  const anim = copy.animate(
    [
      { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${sx}, ${sy})`, borderRadius: `${ra / sx}px / ${ra / sy}px` },
      { transform: "none", borderRadius: `${rb}px` }
    ],
    { duration: opts.duration ?? ms(token("--feel-slow", "300ms")) * 1.15 * (big === from ? parseFloat(token("--feel-exit", "0.7")) || 0.7 : 1), easing: opts.easing ?? token("--feel-in-out", "cubic-bezier(0.65, 0, 0.35, 1)") }
  );
  return new Promise((resolve) => {
    const done = () => {
      if (flying !== done) return;
      flying = null;
      from.style.visibility = keep[0];
      to.style.visibility = keep[1];
      copy.remove();
      resolve();
    };
    flying = done;
    anim.finished.then(done, done);
  });
}
export {
  morph
};
