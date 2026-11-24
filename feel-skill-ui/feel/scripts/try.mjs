#!/usr/bin/env node
// FEEL · try.mjs: use the app like a person and measure how it feels.
//
// Opens the running app in the person's own Chrome (headless, throwaway profile), and for each
// step in .feel/plan.json really presses, taps, drags and navigates, with a finger (phone) or a
// mouse (desktop). Every frame it records where things are, what animates, for how long and on
// which properties, then judges each move against references/principles.md, once normally and
// once with "reduce motion" turned on. It saves a filmstrip of every move and a report.
//
//   node try.mjs [project dir] [--plan .feel/plan.json] [--url http://localhost:3000]
//                [--label before|after] [--device phone|desktop] [--only 2,3] [--no-reduced]
//                [--slow]            4x slower CPU, like a mid-range phone
//                [--compare before]  put the "before" strips above these, one picture per step
//
// Exit code: 0 all good, 1 something to fix, 2 could not run.
import fs from "node:fs";
import path from "node:path";
import { findBrowser, launch, sleep, tmpProfile } from "./lib/browser.mjs";
import { RECORDER } from "./lib/recorder.mjs";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const VALUED = new Set(["plan", "url", "label", "device", "only", "compare"]);
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && VALUED.has(argv[i - 1].slice(2))));
if (flag("help")) { console.log(fs.readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 16).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); process.exit(0); }

const dir = path.resolve(positional[0] || ".");
const planFile = path.resolve(dir, opt("plan", ".feel/plan.json"));
if (!fs.existsSync(planFile)) { console.error(`No plan at ${planFile}. Write one first (references/verify.md).`); process.exit(2); }
let plan;
try { plan = JSON.parse(fs.readFileSync(planFile, "utf8")); } catch (e) { console.error(`The plan is not valid JSON: ${e.message}`); process.exit(2); }
const base = (opt("url") || plan.url || "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base) && !/^file:/.test(base)) { console.error("The plan needs \"url\" (the running app, e.g. http://localhost:3000)."); process.exit(2); }
const device = opt("device", plan.device || "phone");
const label = opt("label", "after").replace(/[^a-z0-9_-]/gi, "") || "after";
const only = opt("only") ? new Set(opt("only").split(",").map(Number)) : null;
const outDir = path.join(dir, ".feel", label);
fs.mkdirSync(outDir, { recursive: true });

const PHONE = { w: 390, h: 844, scale: 2, mobile: true, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" };
const DESKTOP = { w: 1280, h: 800, scale: 1, mobile: false };
const SZ = device === "desktop" ? DESKTOP : PHONE;

// Find an element the way a person would name it: a CSS selector, or the words on it.
const FIND = String.raw`(function(q){
  var tryq=function(s){try{return document.querySelector(s)}catch(e){return null}};
  if(/^[#.\[]|[>:\[\]=]|^[a-z]+$/i.test(q)){var el=tryq(q);if(el)return el}
  var low=q.trim().toLowerCase();
  var c=[].slice.call(document.querySelectorAll('button,a,[role=button],[role=tab],[role=menuitem],[role=option],[role=switch],[role=checkbox],summary,label,input[type=submit],input[type=button],[data-feel],[tabindex]'));
  var vis=function(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};
  var norm=function(t){return (t||'').replace(/\s+/g,' ').trim().toLowerCase()};
  var names=function(e){return [norm(e.getAttribute('aria-label')),norm(e.innerText||e.value),norm(e.getAttribute('title'))].filter(Boolean)};
  return c.find(function(e){return vis(e)&&names(e).some(function(n){return n===low})})||c.find(function(e){return vis(e)&&names(e).some(function(n){return n.indexOf(low)>=0})})||null;
})`;

const SHEETS = "dialog[open], [role=dialog], [role=alertdialog], [aria-modal=true], [role=menu], [role=listbox], [popover], [data-feel~=sheet], [data-feel~=dialog], [data-feel~=drawer], [data-vaul-drawer], [data-state=open][data-side], [class*=sheet i]:not(html,body), [class*=modal i]:not(html,body,[class*=backdrop i],[class*=overlay i]), [class*=drawer i]:not(html,body)";
// A step's target is a menu (no dialog semantics or focus trap expected) when it is one of these.
const MENUS = "[role=menu], [role=listbox], [popover]";
const TOASTS = "[data-sonner-toast], [data-feel~=toast], [role=status]:not(:empty), [role=alert]:not(:empty), [aria-live]:not([aria-live=off]) > *, .Toastify__toast, [data-hot-toast], [class*=toast i]:not(body):not(html)";

// Construct Design components on the page (scan.mjs writes their roots into .feel/map.json; a plan
// can add its own with "library": "<selector>"). Their sheet, role="status" and intro motion are
// theirs, not the app's: never taken for the app's sheet, toast or page arrival.
let LIB = typeof plan.library === "string" && plan.library.trim() ? plan.library.trim() : null;
try { const sel = JSON.parse(fs.readFileSync(path.join(dir, ".feel", "map.json"), "utf8")).constructDesign?.selector; if (sel) LIB = LIB ? `${LIB}, ${sel}` : sel; } catch {}

const browserPath = findBrowser();
if (!browserPath) { console.error("No Chrome, Edge, Brave or Chromium found. Set FEEL_BROWSER to one."); process.exit(2); }
const b = launch(browserPath, tmpProfile());
const results = [];

async function newTab({ reduced }) {
  const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
  const s = (m, p, t) => b.send(m, p, sessionId, t);
  const errors = [];
  const frames = [];
  let inflight = new Set(), lastNet = Date.now();
  b.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    const p = msg.params || {};
    if (msg.method === "Page.screencastFrame") {
      frames.push({ data: p.data, ts: (p.metadata?.timestamp || 0) * 1000 });
      s("Page.screencastFrameAck", { sessionId: p.sessionId }).catch(() => {});
    } else if (msg.method === "Runtime.exceptionThrown") {
      errors.push((p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || "error").split("\n")[0]);
    } else if (msg.method === "Network.requestWillBeSent") { inflight.add(p.requestId); lastNet = Date.now(); }
    else if (msg.method === "Network.loadingFinished" || msg.method === "Network.loadingFailed") { inflight.delete(p.requestId); lastNet = Date.now(); }
  });
  await Promise.all([s("Page.enable"), s("Runtime.enable"), s("Network.enable")]);
  await s("Emulation.setDeviceMetricsOverride", { width: SZ.w, height: SZ.h, deviceScaleFactor: SZ.scale, mobile: SZ.mobile, screenWidth: SZ.w, screenHeight: SZ.h });
  if (SZ.mobile) {
    await s("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await s("Network.setUserAgentOverride", { userAgent: SZ.ua, platform: "iPhone" });
  }
  await s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }] });
  if (flag("slow")) await s("Emulation.setCPUThrottlingRate", { rate: 4 });
  if (LIB) await s("Page.addScriptToEvaluateOnNewDocument", { source: `window.__feelLib=${JSON.stringify(LIB)};` });
  await s("Page.addScriptToEvaluateOnNewDocument", { source: RECORDER });
  const quiet = async (max = 8000) => {
    const until = Date.now() + max;
    await sleep(120);
    while (Date.now() < until) { if (inflight.size === 0 && Date.now() - lastNet > 400) return; await sleep(80); }
  };
  const evaluate = async (expr) => {
    const r = await s("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, 20000);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result?.value;
  };
  return { s, targetId, evaluate, quiet, errors, frames };
}

// ── Input, the way a person gives it ─────────────────────────────────────────
function hands(t) {
  const touch = (type, x, y) => t.s("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" || type === "touchCancel" ? [] : [{ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }] });
  const mouse = (type, x, y) => t.s("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: type === "mouseMoved" ? 0 : 1 });
  return {
    async tap(x, y) {
      if (SZ.mobile) { await touch("touchStart", x, y); await sleep(60); await touch("touchEnd", x, y); }
      else { await mouse("mouseMoved", x, y); await mouse("mousePressed", x, y); await sleep(60); await mouse("mouseReleased", x, y); }
    },
    // Press and hold, then slide off and lift, so it does not count as a tap. Always a mouse:
    // headless Chrome never applies :active to a synthetic touch, though phones do.
    async hold(x, y, ms) {
      await mouse("mouseMoved", x, y); await sleep(350); // a hover finishes first: it is not the press
      await mouse("mousePressed", x, y); await sleep(ms);
      await t.s("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2, button: "left", buttons: 1 }); await mouse("mouseReleased", 2, 2);
    },
    async drag(x, y, dx, dy, ms) {
      const steps = Math.max(6, Math.round(ms / 16));
      if (SZ.mobile) await touch("touchStart", x, y); else { await mouse("mouseMoved", x, y); await mouse("mousePressed", x, y); }
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        const px = x + dx * k, py = y + dy * k;
        if (SZ.mobile) await touch("touchMove", px, py);
        else await t.s("Input.dispatchMouseEvent", { type: "mouseMoved", x: px, y: py, button: "left", buttons: 1 });
        await sleep(ms / steps);
      }
      if (SZ.mobile) await touch("touchEnd", x + dx, y + dy); else await mouse("mouseReleased", x + dx, y + dy);
    },
    async key(k) {
      const code = { Escape: 27, Enter: 13, " ": 32, Tab: 9 }[k] || 0;
      await t.s("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k === " " ? "Space" : k, windowsVirtualKeyCode: code });
      await t.s("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k === " " ? "Space" : k, windowsVirtualKeyCode: code });
    },
  };
}

// Find, scroll into view and watch an element; returns its centre.
async function grab(t, q, name) {
  return t.evaluate(`(function(){var el=${FIND}(${JSON.stringify(q)});if(!el)return null;el.scrollIntoView({block:'center',behavior:'instant'});
    var r=el.getBoundingClientRect();${name ? `window.__feel.track(el,${JSON.stringify(name)});` : ""}window.__feelLast=el;
    return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,top:r.y,left:r.x,desc:(el.innerText||el.getAttribute('aria-label')||el.tagName).replace(/\s+/g,' ').trim().slice(0,40)}})()`);
}

const READ = `JSON.stringify({t0:__feel.t0,timeOrigin:performance.timeOrigin,frames:__feel.frames,anims:__feel.anims,styles:__feel.styles,input:__feel.input,vt:__feel.vt,reveal:__feel.reveal,
  watch:__feel.watch.map(function(w){return {name:w.name,rows:w.rows}}),vw:innerWidth,vh:innerHeight,url:location.pathname+location.search+location.hash})`;
async function read(t) { return JSON.parse(await t.evaluate(READ)); }

async function open(t, page) {
  const url = /^https?:|^file:/.test(page || "") ? page : base + (page || "/");
  const nav = await t.s("Page.navigate", { url }, 30000);
  if (nav.errorText) throw new Error(`Could not open ${url}: ${nav.errorText}${/REFUSED|UNREACHABLE/.test(nav.errorText) ? " (is the app running?)" : ""}`);
  await t.quiet();
  await t.evaluate("document.fonts && document.fonts.ready.then(function(){return 1})").catch(() => {});
  await sleep(250);
}

async function before(t, h, steps = []) {
  for (const st of steps) {
    if (st.tap) { const at = await grab(t, st.tap); if (!at) throw new Error(`"${st.tap}" not found (in "before")`); await h.tap(at.x, at.y); await t.quiet(3000); await sleep(400); }
    else if (st.wait) await sleep(Math.min(10000, +st.wait));
    else if (st.key) { await h.key(st.key); await sleep(300); }
    else if (st.scroll) await t.evaluate(`window.scrollTo(0, ${+st.scroll || 0})`);
  }
}

// ── Reading the record ───────────────────────────────────────────────────────
const LAYOUT = /^(width|height|top|left|right|bottom|inset|margin|padding|max-height|max-width|min-height|min-width|flex-basis|grid-template|font-size|line-height|letter-spacing|border-width)/;
const watchOf = (rec, name) => rec.watch.find((w) => w.name === name)?.rows || [];
const shown = (r) => r && r.c && r.v && r.o > 0.02;
const same = (a, b) => Math.abs(a.x - b.x) < 0.6 && Math.abs(a.y - b.y) < 0.6 && Math.abs(a.w - b.w) < 0.6 && Math.abs(a.h - b.h) < 0.6 && Math.abs(a.o - b.o) < 0.004;
const ms = (n) => `${Math.round(n)} ms`;

/** How an element arrived: the first frame it was visible to the frame it stopped changing. */
function arrival(rows, from) {
  const vis = rows.filter((r) => r.t >= from - 1 && shown(r));
  if (!vis.length) return null;
  const end = vis[vis.length - 1];
  let settle = vis[0].t, moving = 0;
  for (let i = 0; i < vis.length - 1; i++) if (!same(vis[i], vis[i + 1])) { settle = vis[i + 1].t; moving++; }
  const first = vis[0];
  const travel = Math.max(...vis.map((r) => Math.hypot(r.x - end.x, r.y - end.y)));
  const scale = Math.max(...vis.map((r) => Math.abs(1 - r.w / (end.w || 1))));
  // Where it came from: the frame farthest from where it rests (the first visible frame can already
  // be at rest for a frame before the transition takes hold, as a Svelte transition:fly is).
  const far = vis.reduce((p, r) => (Math.hypot(r.x - end.x, r.y - end.y) > Math.hypot(p.x - end.x, p.y - end.y) + 0.5 ? r : p), first);
  const fade = end.o - Math.min(...vis.map((r) => r.o));
  return { first, far, end, start: first.t, settle, ms: settle - first.t, moving, travel, scale, fade, rows: vis };
}
/** How an element left after `from` (the input): from its first visible change to the frame it
 *  was gone, measured like an arrival (so a slow page answering the key isn't counted as exit).
 *  `lag` is input → first change; `sinceInput` input → gone. */
function departure(rows, from) {
  const after = rows.filter((r) => r.t >= from - 1);
  const goneAt = after.find((r) => !shown(r));
  if (!goneAt) return { gone: false };
  const rest = [...rows].reverse().find((r) => r.t < from - 1 && shown(r)) || after.find((r) => shown(r));
  const first = rest ? after.find((r) => !shown(r) || !same(r, rest)) : goneAt;
  const start = first ? first.t : from;
  const vis = after.filter((r) => r.t < goneAt.t && shown(r));
  let moving = 0;
  for (let i = 0; i < vis.length - 1; i++) if (!same(vis[i], vis[i + 1])) moving++;
  const lastVis = vis[vis.length - 1];
  return { gone: true, ms: goneAt.t - start, lag: start - from, sinceInput: goneAt.t - from, moving, faded: lastVis ? 1 - lastVis.o / (vis[0]?.o || 1) : 0, travel: vis.length ? Math.hypot(lastVis.x - vis[0].x, lastVis.y - vis[0].y) : 0 };
}
function layoutAnimated(rec) {
  const out = [];
  for (const a of rec.anims) {
    if (/view-transition/.test(a.pseudo) || a.lib) continue;
    const bad = (a.props || []).filter((p) => LAYOUT.test(p.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())));
    if (bad.length) out.push(`${a.target || "an element"} animates ${bad.join(", ")}`);
  }
  for (const s of rec.styles) out.push(`${s.target} changes ${s.props.join(", ")} frame by frame from script`);
  return [...new Set(out)].slice(0, 4);
}
function jank(rec, from, to) {
  const f = rec.frames.filter((x) => x >= from && x <= to);
  let slow = 0, worst = 0;
  for (let i = 1; i < f.length; i++) { const d = f[i] - f[i - 1]; if (d > 50) slow++; worst = Math.max(worst, d); }
  return { slow, worst };
}
const firstInput = (rec, type, after = 0) => rec.input.find((e) => e.type === type && e.t >= after);

// ── The moves ────────────────────────────────────────────────────────────────
async function runPress(t, h, step, reduced, out) {
  const at = await grab(t, step.target, "target");
  if (!at) return out.cant(`"${step.target}" not found on ${step.page || "/"}`);
  const startUrl = await t.evaluate("location.href");
  await t.evaluate("__feel.start()");
  await sleep(80);
  await h.hold(at.x, at.y, step.hold || 260);
  await sleep(800);
  await t.evaluate("__feel.stop()").catch(() => {});
  const rec = await read(t);
  const navigated = (await t.evaluate("location.href").catch(() => startUrl)) !== startUrl;
  const rows = watchOf(rec, "target").filter((r) => r.c);
  const down = firstInput(rec, "pointerdown");
  if (!down) return out.cant(navigated ? "it went to another page before the press could be read (press it as a page step instead)" : "the press never reached the page");
  const up = rec.input.find((e) => (e.type === "pointercancel" || e.type === "pointerup") && e.t > down.t) || { t: down.t + (step.hold || 260) };
  const rest = [...rows].reverse().find((r) => r.t <= down.t) || rows[0];
  if (!rest) return out.cant(`could not watch the element (${rec.watch.map((w) => w.name + ":" + w.rows.length).join(",")} frames ${rec.frames.length})`);
  const dev = (r) => Math.max(Math.abs(1 - r.w / rest.w), Math.abs(1 - r.h / rest.h), Math.abs(r.o - rest.o)) + (r.bg !== rest.bg || r.sh !== rest.sh ? 0.003 : 0);
  const during = rows.filter((r) => r.t > down.t && r.t <= up.t + 1);
  const peak = Math.max(0, ...during.map(dev));
  const depth = Math.min(1, ...during.map((r) => r.w / rest.w));
  const firstMove = during.find((r) => dev(r) > 0.0015);
  const reach = during.find((r) => dev(r) >= peak * 0.9);
  const moveDev = (r) => Math.max(Math.abs(1 - r.w / rest.w), Math.abs(1 - r.h / rest.h), Math.abs(r.o - rest.o));
  const movePeak = Math.max(0, ...during.map(moveDev));
  const after = rows.filter((r) => r.t > up.t);
  const metric = movePeak > 0.0015 ? moveDev : dev, mPeak = movePeak > 0.0015 ? movePeak : peak;
  const back = after.find((r) => metric(r) <= mPeak * 0.1);
  // It left the page (a link, a card that opens its item): there is nothing to come back.
  const left = navigated || (watchOf(rec, "target").length && !watchOf(rec, "target").slice(-1)[0].c);
  // Back in one frame: the frame before "back" was still (nearly) all the way down.
  const before1 = back ? rows[rows.indexOf(back) - 1] : null;
  const snapsBack = !!(back && before1 && mPeak > 0.01 && metric(before1) >= mPeak * 0.6);
  const last = after[after.length - 1];
  const stuckColour = last && (last.bg !== rest.bg || last.sh !== rest.sh) && movePeak > 0.0015;
  const colourOnly = peak > 0 && Math.abs(1 - depth) < 0.002 && during.every((r) => Math.abs(r.o - rest.o) < 0.01);
  const n = out.numbers;
  n.answers = firstMove ? Math.max(0, firstMove.t - down.t) : null;
  n.depth = +depth.toFixed(3);
  n.pressIn = reach ? reach.t - down.t : null;
  n.back = back ? back.t - up.t : null;
  if (!firstMove) out.fix("nothing happens when it is pressed");
  else {
    if (n.answers > 100) out.fix(`answers ${ms(n.answers)} after the finger lands (it should answer on press, within 100 ms)`);
    if (!reduced && colourOnly) out.look("only its colour changes when pressed (fine for a link; a button or card should also sink)");
    if (reduced && depth < 0.95) out.fix(`shrinks to ${n.depth} with reduce motion on (dim or tint it instead)`);
    if (depth < 0.9) out.look(`sinks to ${n.depth}: more than a press needs (0.95–0.98)`);
    if (n.pressIn != null && n.pressIn > 160) out.look(`takes ${ms(n.pressIn)} to go down (a press should land in under 150 ms)`);
    if (!back && !left) out.fix("does not come back after it is released");
    if (left) { /* it navigated: nothing to come back */ }
    else if (stuckColour) out.look("keeps a different colour after it is released (a :hover that sticks on touch screens? limit it to @media (hover: hover))");
    else if (n.back > 700) out.look(`takes ${ms(n.back)} to come back`);
    const steps = during.filter((r) => firstMove && r.t >= firstMove.t && reach && r.t <= reach.t).length;
    if (!reduced && !colourOnly && steps <= 1 && peak > 0.01) out.look("jumps down in one frame (no transition): give it the press transition");
    // Reduce motion keeps the feedback (a dim), but it still eases: a dim that snaps reads as a flicker.
    const snapsDown = reduced && steps <= 1 && mPeak > 0.01;
    if (reduced && snapsBack && !left) out.look(`with reduce motion on, its dim ${snapsDown ? "jumps down and back" : "snaps back"} in one frame (back in ${ms(n.back)}): keep a short opacity transition on it`);
    else if (snapsDown) out.look("with reduce motion on, it dims in one frame (no transition): keep a short opacity transition on the dim");
    else if (!reduced && snapsBack && !left && !colourOnly) out.look(`snaps back in one frame (back in ${ms(n.back)}): it should spring back`);
  }
  out.say(firstMove ? `answers in ${ms(n.answers)}, sinks to ${n.depth}${n.back != null ? `, back in ${ms(n.back)}` : ""}${left ? " (it goes to another page)" : ""}` : "no response");
  out.common(rec, down.t, down.t + 1200);
  // The press is a few pixels: the strip shows the element close up.
  const m = 28;
  return { from: down.t - 40, to: (back?.t ?? up.t + 400) + 80, rec, crop: { x: at.x - at.w / 2 - m, y: at.y - at.h / 2 - m, w: at.w + 2 * m, h: at.h + 2 * m } };
}

async function openThing(t, h, q, kind, out, selector) {
  const at = await grab(t, q);
  if (!at) { out.cant(`"${q}" (the trigger) not found`); return null; }
  await t.evaluate(`window.__feelTrigger=window.__feelLast;__feel.expect(${JSON.stringify(selector || (kind === "toast" ? TOASTS : SHEETS))},${JSON.stringify(kind)},${selector ? "false" : "true"});__feel.start()`);
  await sleep(60);
  await h.tap(at.x, at.y);
  return at;
}

async function runSheet(t, h, step, reduced, out) {
  const at = await openThing(t, h, step.open, "sheet", out, step.sheet);
  if (!at) return null;
  await sleep(1100);
  let rec = await read(t);
  const tapT = firstInput(rec, "click")?.t ?? firstInput(rec, "pointerdown")?.t ?? rec.t0;
  let rows = watchOf(rec, "sheet");
  if (!rows.length) { await t.evaluate("__feel.stop()"); return out.cant(`nothing like a sheet or dialog appeared after tapping "${step.open}" (name it with "sheet": "<selector>")`); }
  const a = arrival(rows, tapT);
  if (!a) { await t.evaluate("__feel.stop()"); return out.cant("the sheet was found but never visible"); }
  const n = out.numbers;
  n.enter = Math.round(a.ms); n.travel = Math.round(a.travel); n.from = describeFrom(a, rec);
  const bottom = a.end.y + a.end.h >= rec.vh - 2 && a.end.w >= rec.vw * 0.6;
  if (a.moving < 2) out.fix("appears all at once (no entrance)");
  else {
    if (a.ms > 1000) out.fix(`takes ${ms(a.ms)} to arrive (sheets: 250–400 ms)`);
    else if (a.ms > 600) out.look(`takes ${ms(a.ms)} to arrive (sheets: 250–400 ms)`);
    if (!reduced && bottom && a.far.y <= a.end.y + 8 && a.fade < 0.3) out.look("a bottom sheet that does not rise from the bottom edge");
    if (bottom && a.rows.some((r) => r.y < a.end.y - 1.5)) out.look("rises past its resting place and drops back (it shows a gap under it)");
  }
  if (reduced && (a.travel > 8 || a.scale > 0.06)) out.fix(`travels ${Math.round(a.travel)} px with reduce motion on (fade it instead)`);
  const fx = await t.evaluate(`(function(){var w=__feel.watch.find(function(x){return x.name==='sheet'});var el=w&&w.el;if(!el)return {focus:'none',menu:false};var modal=el.matches('dialog,[role=dialog],[role=alertdialog],[aria-modal=true]')||!!el.querySelector('[role=dialog],[aria-modal=true]');var menu=el.matches(${JSON.stringify(MENUS)})||(!modal&&!!el.querySelector('[role=menu],[role=listbox]'));return {focus:(el.contains(document.activeElement)||(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('dialog,[role=dialog]')===el)?'in':'out')+(modal?'':'-plain'),menu:menu}})()`);
  const focus = fx.focus;
  const menu = !!(step.menu || fx.menu);
  if (focus === "out") out.fix("focus stays behind the dialog when it opens (move it inside)");
  if (focus.endsWith("-plain") && step.move !== "dialog" && !menu) out.look("screen readers aren't told it's a dialog (role=\"dialog\" aria-modal=\"true\" and a label), and focus isn't checked until it is");
  // Close it.
  const closeT0 = await t.evaluate("performance.now()");
  const how = step.close || "Escape";
  if (how === "Escape") await h.key("Escape");
  else if (how === "backdrop") await h.tap(rec.vw / 2, bottom ? Math.max(12, a.end.y / 2) : 12);
  else { const c = await grab(t, how); if (!c) return out.cant(`"${how}" (the close control) not found`); await h.tap(c.x, c.y); }
  await sleep(1200);
  await t.evaluate("__feel.stop()");
  rec = await read(t);
  rows = watchOf(rec, "sheet");
  const closeAt = rec.input.find((e) => e.t >= closeT0 && (e.type === "click" || e.type === "keydown"))?.t ?? closeT0;
  const d = departure(rows, closeAt);
  if (!d.gone) out.fix(`does not close with ${how === "Escape" ? "the Escape key" : `"${how}"`}`);
  else {
    n.exit = Math.round(d.ms);
    n.exitLag = Math.round(d.lag);
    if (d.ms < 40 || d.moving < 2) out.fix("vanishes at once when closed (no exit)");
    else if (n.enter && d.ms > n.enter * 1.25 + 60) out.look(`leaves slower (${ms(d.ms)}) than it arrives (${ms(n.enter)}): exits should be quicker`);
    if (d.lag > 200) out.look(`starts leaving ${ms(d.lag)} after ${how === "Escape" ? "the key" : "the tap"} (it should start at once)`);
    if (reduced && d.travel > 8) out.fix(`travels ${Math.round(d.travel)} px on the way out with reduce motion on`);
    const back = await t.evaluate(`(function(){var tr=window.__feelTrigger;if(!tr||!tr.isConnected)return 'gone';return document.activeElement===tr||tr.contains(document.activeElement)?'yes':'no'})()`);
    if (back === "no" && focus !== "out-plain" && focus !== "in-plain") out.fix("focus does not go back to the button that opened it");
  }
  if (d.gone) await reopenChecks(t, h, step, out, { how, closeAt: { x: rec.vw / 2, y: bottom ? Math.max(12, a.end.y / 2) : 12 }, menu, focus });
  out.say(`in ${n.enter} ms from ${n.from}${n.exit != null ? `, out in ${n.exit} ms` : ""}`);
  out.common(rec, tapT, (d.gone ? closeAt + d.ms : closeAt + 1200));
  return { from: tapT - 30, to: a.settle + 80, rec };
}

// Is it on screen at rest? The biggest visible match of the sheet's selector that wasn't already
// visible when marked, and "stuck": a match that is laid out but not visible and wasn't there when
// marked (a sheet that stays in the page while closed was there, so it never counts as stuck).
const REST = String.raw`(function(sel,mark,skipLib){var all=[];try{all=[].slice.call(document.querySelectorAll(sel))}catch(e){}
  if(skipLib&&window.__feel&&__feel.inLib)all=all.filter(function(el){return !__feel.inLib(el)});
  var laid=function(el){var r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).display!=='none'};
  var look=function(el){var r=el.getBoundingClientRect(),cs=getComputedStyle(el);var o=1;for(var e=el;e&&e.nodeType===1;e=e.parentElement){var v=parseFloat(getComputedStyle(e).opacity);if(!isNaN(v))o*=v}
    var inView=r.bottom>2&&r.right>2&&r.top<innerHeight-2&&r.left<innerWidth-2;
    var ae=document.activeElement;var modal=el.matches('dialog,[role=dialog],[role=alertdialog],[aria-modal=true]')||!!el.querySelector('[role=dialog],[aria-modal=true]');
    return {vis:inView&&cs.visibility!=='hidden'&&o>0.9,a:r.width*r.height,o:+o.toFixed(2),state:el.getAttribute('data-feel-state')||el.getAttribute('data-state')||'',modal:modal,focusIn:!!(ae&&ae!==document.body&&(el.contains(ae)||(ae.closest&&ae.closest('dialog,[role=dialog]')===el)))}};
  if(mark){window.__feelSeen=all.filter(function(el){return laid(el)&&look(el).vis});window.__feelThere=all.filter(laid)}
  var seen=window.__feelSeen||[],there=window.__feelThere||[];var shown=null,stuck=null;
  all.forEach(function(el){if(!laid(el))return;var info=look(el);
    if(info.vis){if(seen.indexOf(el)<0&&(!shown||info.a>shown.a))shown=info}else if(there.indexOf(el)<0&&!stuck)stuck=info});
  var tr=window.__feelTrigger;return {shown:shown,stuck:stuck,expanded:tr&&tr.isConnected?tr.getAttribute('aria-expanded'):null}})`;

/** After it has closed: open it again, close it, and open it once more ~60 ms later, while its exit
 *  is still playing; it has to come back and rest on screen (catches a leaving copy being reused
 *  and left invisible). Menus also get their trigger tapped three times quickly. */
async function reopenChecks(t, h, step, out, { how, closeAt, menu, focus }) {
  const sel = step.sheet || SHEETS;
  const rest = (mark) => t.evaluate(`${REST}(${JSON.stringify(sel)},${mark ? "true" : "false"},${step.sheet ? "false" : "true"})`);
  const close = async () => {
    if (how === "Escape") await h.key("Escape");
    else if (how === "backdrop") await h.tap(closeAt.x, closeAt.y);
    else { const c = await grab(t, how); if (!c) return false; await h.tap(c.x, c.y); }
    return true;
  };
  await rest(true);
  const o = await grab(t, step.open);
  if (!o) return;
  await h.tap(o.x, o.y);
  await sleep(700);
  let st = await rest(false);
  if (!st.shown) { out.fix(`does not open a second time (tapped "${step.open}" again after it closed)`); return; }
  if (!(await close())) return;
  await sleep(60);
  await h.tap(o.x, o.y);
  await sleep(1000);
  st = await rest(false);
  const n = out.numbers;
  n.reopen = st.shown ? "ok" : st.stuck ? "stuck" : "closed";
  if (!st.shown && (st.stuck || st.expanded === "true")) out.fix(`opened again 60 ms after closing, it never comes back on screen${st.stuck ? ` (it is there, at opacity ${st.stuck.o}${st.stuck.state ? `, state "${st.stuck.state}"` : ""})` : " (its button says it is open)"}: the leaving copy was reused?`);
  else if (!st.shown) out.look("a tap 60 ms after closing does not open it again (something still in the way while it leaves?)");
  else if (st.expanded === "false") out.look("on screen, but its button says aria-expanded=\"false\"");
  // Back on screen, but focus has to be in it too (a reused leaving copy can come back with focus
  // left behind it). Only for a modal sheet or dialog whose first opening did move focus in.
  if (st.shown && st.shown.modal && !menu && focus === "in" && !st.shown.focusIn) { n.reopen = "ok, focus outside"; out.fix("opened again 60 ms after closing, it is on screen but focus stays outside it (move focus in on every opening, also when the leaving copy is reused)"); }
  if (!menu || !st.shown) return;
  // A menu's trigger, three quick taps: it must end in one clear state.
  await close();
  await sleep(800);
  const reach = await t.evaluate(`(function(x,y){var tr=window.__feelTrigger;var e=document.elementFromPoint(x,y);return !!(tr&&e&&(tr===e||tr.contains(e)))})(${o.x},${o.y})`);
  if (!reach) return;
  for (let i = 0; i < 3; i++) { await h.tap(o.x, o.y); await sleep(70); }
  await sleep(1000);
  st = await rest(false);
  n.toggle3 = st.shown ? "open" : st.stuck ? "stuck" : "closed";
  if (!st.shown && st.stuck) out.fix(`after three quick taps on "${step.open}" it is left half there (opacity ${st.stuck.o}${st.stuck.state ? `, state "${st.stuck.state}"` : ""})`);
  else if (st.shown && st.expanded === "false") out.fix(`after three quick taps on "${step.open}" it is on screen but its button says closed (aria-expanded="false")`);
  else if (!st.shown && st.expanded === "true") out.fix(`after three quick taps on "${step.open}" its button says open but nothing is on screen`);
}

function describeFrom(a, rec) {
  const dy = a.far.y - a.end.y, dx = a.far.x - a.end.x;
  if (Math.abs(dy) < 4 && Math.abs(dx) < 4) return a.scale > 0.02 ? "a smaller size" : a.fade > 0.2 ? "transparent" : "nowhere (it just appears)";
  if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? "below" : "above";
  return dx > 0 ? "the right" : "the left";
}

async function runToast(t, h, step, reduced, out) {
  const at = await openThing(t, h, step.trigger, "toast", out, step.toast);
  if (!at) return null;
  const wait = Math.min(15000, step.wait || 8000);
  await sleep(1000);
  let rec = await read(t);
  const tapT = firstInput(rec, "click")?.t ?? firstInput(rec, "pointerdown")?.t ?? rec.t0;
  let rows = watchOf(rec, "toast");
  if (!rows.length) { await t.evaluate("__feel.stop()"); return out.cant(`no toast appeared after tapping "${step.trigger}" (name it with "toast": "<selector>")`); }
  const a = arrival(rows, tapT);
  const n = out.numbers;
  if (!a) { await t.evaluate("__feel.stop()"); return out.cant("the toast was found but never visible"); }
  n.enter = Math.round(a.ms); n.from = describeFrom(a, rec);
  const announced = await t.evaluate(`(function(){var w=__feel.watch.find(function(x){return x.name==='toast'});var el=w&&w.el;if(!el)return false;for(var e=el;e;e=e.parentElement){var r=e.getAttribute&&e.getAttribute('role');var l=e.getAttribute&&e.getAttribute('aria-live');if(r==='status'||r==='alert'||(l&&l!=='off'))return true}return false})()`);
  if (!announced) out.fix("is not announced to screen readers (role=\"status\" or aria-live=\"polite\")");
  if (a.moving < 2) out.fix("appears all at once (no entrance)");
  else {
    if (a.ms > 800) out.look(`takes ${ms(a.ms)} to arrive (toasts: 200–450 ms)`);
    const nearBottom = a.end.y + a.end.h / 2 > rec.vh / 2;
    if (!reduced && a.travel < 4 && a.fade < 0.3 && a.scale < 0.02) out.look("does not come from its edge");
    if (!reduced && a.travel >= 4 && ((nearBottom && a.far.y < a.end.y) || (!nearBottom && a.far.y > a.end.y))) out.look(`comes from ${n.from} but sits at the ${nearBottom ? "bottom" : "top"}: let it come from that edge`);
  }
  if (reduced && (a.travel > 8 || a.scale > 0.06)) out.fix(`travels ${Math.round(a.travel)} px with reduce motion on (fade it instead)`);
  // Does it leave on its own, and how?
  const until = Date.now() + wait;
  let d = { gone: false };
  while (Date.now() < until) {
    await sleep(500);
    rec = await read(t);
    rows = watchOf(rec, "toast");
    d = departure(rows, a.settle + 50);
    if (d.gone) break;
  }
  await sleep(600);
  await t.evaluate("__feel.stop()");
  rec = await read(t);
  rows = watchOf(rec, "toast");
  d = departure(rows, a.settle + 50);
  if (d.gone) {
    const lastSeen = rows.filter((r) => shown(r)).pop();
    n.stays = Math.round((lastSeen?.t ?? 0) - a.start);
    if (n.stays < 3000) out.fix(`leaves after ${(n.stays / 1000).toFixed(1)} s: too quick to read (at least 4 s, longer for longer text)`);
    if (d.moving < 2) out.fix("vanishes at once when it leaves (no exit)");
    if (reduced && d.travel > 8) out.fix(`travels ${Math.round(d.travel)} px on the way out with reduce motion on`);
  } else n.stays = `over ${(wait / 1000).toFixed(0)} s`;
  out.say(`in ${n.enter} ms from ${n.from}, stays ${typeof n.stays === "number" ? (n.stays / 1000).toFixed(1) + " s" : n.stays}`);
  out.common(rec, tapT, a.settle + 400);
  return { from: tapT - 30, to: a.settle + 80, rec };
}

async function runPage(t, h, step, reduced, out) {
  const at = await grab(t, step.go);
  if (!at) return out.cant(`"${step.go}" (the link) not found`);
  const startUrl = await t.evaluate("location.href");
  await t.evaluate("__feel.start();try{sessionStorage.setItem('__feelNav','1')}catch(e){}");
  await sleep(60);
  const tapEpoch = Date.now();
  await h.tap(at.x, at.y);
  await sleep(500);
  await t.quiet(6000);
  await sleep(900);
  const rec = await read(t);
  await t.evaluate("__feel.stop();try{sessionStorage.removeItem('__feelNav')}catch(e){}");
  const now = await t.evaluate("location.href");
  const n = out.numbers;
  const moved = now !== startUrl;
  if (step.expect && !now.includes(step.expect)) return out.cant(`tapping "${step.go}" went to ${now}, not ${step.expect}`);
  const trim = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  if (step.expectPath) { const p = new URL(now).pathname; if (trim(p) !== trim(step.expectPath)) return out.cant(`tapping "${step.go}" went to ${p}, not exactly ${step.expectPath}`); }
  if (!moved && !step.expect && !step.expectPath && !step.sameUrl) out.look(`tapping "${step.go}" did not change the address (fine for tabs; otherwise check the step)`);
  const vtAnims = rec.anims.filter((a) => /view-transition/.test(a.pseudo));
  // A page arriving: motion on the root, <main>, data-feel="page" or the routed view straight inside
  // one of them. Anything else that moves on arrival (a component's own intro, a Construct Design
  // sheet rising) is not the page's transition.
  const arriving = rec.anims.filter((a) => !a.trig && !a.lib && !/view-transition/.test(a.pseudo) && a.dur >= 80 && a.iter !== Infinity && (a.props || []).some((p) => /opacity|transform|translate|scale|clip/.test(p)));
  const mainAnims = arriving.filter((a) => a.page);
  const others = arriving.filter((a) => !a.page);
  const mpa = rec.timeOrigin > tapEpoch - 50;
  n.kind = rec.vt.length ? "view transition" : rec.reveal?.vt ? "view transition (new page load)" : vtAnims.length ? "view transition" : mainAnims.length ? "CSS on arrival" : "none";
  // How long it is seen to take: the old and new pages' own animations, and any shared element that
  // really flies. Not timed: a group that does not move (the root's, held at its slow token while the
  // pages crossfade faster), and, once the app animates old/new itself, the browser's default
  // crossfade of what did not change (-ua-…, it takes its group's slow duration).
  const own = vtAnims.filter((a) => /::view-transition-(?:old|new)\(/.test(a.pseudo) && !/^-ua-/.test(a.name || ""));
  const seen = vtAnims.filter((a) => {
    if (/^-ua-mix-blend/.test(a.name || "")) return false;
    if (/::view-transition-group\(/.test(a.pseudo)) return !a.kf || groupTravel(a.kf) > 1;
    return !(own.length && /^-ua-/.test(a.name || ""));
  });
  const durs = (vtAnims.length ? (seen.length ? seen : vtAnims) : mainAnims).map((a) => a.dur + a.delay);
  n.ms = durs.length ? Math.round(Math.max(...durs)) : 0;
  // Which way it went: from the old and new page's own keyframes (where they start and end), and
  // what the app said (html[data-feel-nav], or the transition's types).
  const dir = vtAnims.length ? vtDirection(vtAnims, rec) : null;
  const said = rec.vt[0]?.nav || rec.reveal?.nav || wayOfTypes([...(rec.vt[0]?.types || []), ...(rec.reveal?.types || [])]);
  if (dir) n.direction = dir.way;
  if (said) n.nav = said;
  const want = step.direction || (/(^|\W)(back|previous)(\W|$)|←|‹|❮/i.test(`${step.go} ${step.name || ""}`) ? "back" : null);
  if (n.kind === "none") out.fix(`the page swaps with no transition${others.length ? ` (something else moved on arrival: ${others[0].target || "an element"}; if that is the page, put data-feel="page" on its root)` : ""}`);
  else {
    if (n.ms > 700) out.look(`the transition takes ${ms(n.ms)} (pages: 250–450 ms)`);
    const travels = (vtAnims.length ? vtAnims : mainAnims).filter((a) => !/group/.test(a.pseudo) && (a.kf ? kfMoves(a.kf, rec) > 4 : (a.props || []).some((p) => /transform|translate/.test(p))));
    if (reduced && travels.length) out.fix("the page slides with reduce motion on (crossfade it instead)");
    // Shared elements (named groups) fly from their old box to the new one; header and tab bar held
    // still have no travel. With reduce motion on, none should fly.
    if (reduced) for (const g of vtAnims.filter((a) => /::view-transition-group\((?!root\))/.test(a.pseudo) && a.kf)) {
      const px = groupTravel(g.kf);
      if (px > 8) out.fix(`the shared element ${g.pseudo.replace(/^::view-transition-group/, "")} flies ${Math.round(px)} px with reduce motion on (turn ::view-transition-group(*) off under reduce)`);
    }
    if (!reduced && dir) {
      if (said && /^(forward|back)$/.test(said) && /^(forward|back)$/.test(dir.way) && said !== dir.way) out.fix(`the app says "${said}" (data-feel-nav) but the page moves ${dir.way}: the CSS for that direction isn't applied`);
      if (want && /^(forward|back)$/.test(want) && /^(forward|back)$/.test(dir.way) && want !== dir.way) out.fix(`a ${want} step that moves ${dir.way} (${dir.how})`);
      else if (want && /^(forward|back)$/.test(want) && dir.way === "fade") out.look(`a ${want} step that only crossfades: the direction tells people where they are (slide it)`);
      else if (want === "fade" && /^(forward|back|up|down)$/.test(dir.way)) out.look(`slides (${dir.how}) where a tab change should crossfade`);
    }
  }
  out.say(`${n.kind}${dir && !reduced ? `, ${dir.way}${dir.how ? ` (${dir.how})` : ""}` : ""}${said ? `, data-feel-nav "${said}"` : ""}${n.ms ? `, ${n.ms} ms` : ""}${mpa ? " (full page load)" : ""}`);
  const from = rec.input.find((e) => e.type === "click")?.t ?? rec.t0;
  out.common(rec, from, from + 1500);
  // The picture starts when the transition does (a dev server can take a while to answer).
  const began = (vtAnims[0] || mainAnims[0])?.t;
  if (rec.anims.some((a) => a.lib)) n.library = "Construct Design motion left out";
  if (began != null) return { from: began - 30, to: began + Math.max(n.ms, 300) + 120, rec, epochFrom: rec.timeOrigin + began - 50, epochTo: rec.timeOrigin + began + Math.max(n.ms, 300) + 120 };
  return { from: from - 30, to: from + 600, rec, epochFrom: tapEpoch - 30, epochTo: tapEpoch + 900 };
}

// Where a keyframe puts a pseudo-element: x/y in px (percent of the viewport for translate: %).
function offsetOf(f, rec) {
  let x = 0, y = 0;
  const px = (v, size) => (/%$/.test(v) ? (parseFloat(v) / 100) * size : parseFloat(v) || 0);
  if (f.translate && f.translate !== "none") { const [a, b = "0"] = f.translate.trim().split(/\s+/); x += px(a, rec.vw); y += px(b, rec.vh); }
  const m = (f.transform || "").match(/matrix(3d)?\(([^)]+)\)/);
  if (m) { const v = m[2].split(",").map(parseFloat); if (m[1]) { x += v[12]; y += v[13]; } else { x += v[4]; y += v[5]; } }
  else { const tx = (f.transform || "").match(/translate(?:X|3d)?\(\s*([-\d.]+(?:px|%)?)(?:\s*,\s*([-\d.]+(?:px|%)?))?/); if (tx) { x += px(tx[1], rec.vw); y += px(tx[2] || "0", rec.vh); } const ty = (f.transform || "").match(/translateY\(\s*([-\d.]+(?:px|%)?)/); if (ty) y += px(ty[1], rec.vh); }
  return { x, y };
}
const kfMoves = (kf, rec) => { const a = offsetOf(kf[0], rec), b = offsetOf(kf[1], rec); return Math.hypot(a.x - b.x, a.y - b.y); };
function groupTravel(kf) {
  const a = offsetOf(kf[0], { vw: 0, vh: 0 }), b = offsetOf(kf[1], { vw: 0, vh: 0 });
  const size = Math.abs((parseFloat(kf[0].width) || 0) - (parseFloat(kf[1].width) || 0)) + Math.abs((parseFloat(kf[0].height) || 0) - (parseFloat(kf[1].height) || 0));
  return Math.hypot(a.x - b.x, a.y - b.y) + size;
}
/** forward = the new page comes from the right / the old one leaves to the left; back = the other way. */
function vtDirection(vtAnims, rec) {
  const of = (kind) => { const l = vtAnims.filter((a) => a.kf && new RegExp(`::view-transition-${kind}\\(`).test(a.pseudo)); return l.find((a) => /\(root\)/.test(a.pseudo)) || l.sort((p, q) => kfMoves(q.kf, rec) - kfMoves(p.kf, rec))[0]; };
  const nw = of("new"), old = of("old");
  let sx = 0, sy = 0, fades = false;
  for (const a of [nw, old].filter(Boolean)) {
    const s0 = offsetOf(a.kf[0], rec), s1 = offsetOf(a.kf[1], rec);
    sx += s0.x - s1.x; sy += s0.y - s1.y;
    if (a.kf[0].opacity !== a.kf[1].opacity) fades = true;
  }
  if (!nw && !old) return null;
  if (Math.abs(sx) < 4 && Math.abs(sy) < 4) return { way: fades ? "fade" : "still", how: fades ? "crossfade" : "nothing moves" };
  if (Math.abs(sx) >= Math.abs(sy)) return sx > 0 ? { way: "forward", how: "the new page comes from the right" } : { way: "back", how: "the new page comes from the left" };
  return sy > 0 ? { way: "up", how: "the new page rises from below" } : { way: "down", how: "the new page comes from above" };
}
const wayOfTypes = (types) => { const s = types.join(" "); return /forward/.test(s) ? "forward" : /back/.test(s) ? "back" : /fade|tab/.test(s) ? "fade" : ""; };

async function runDrag(t, h, step, reduced, out) {
  let target = step.target;
  if (step.open) {
    const at = await openThing(t, h, step.open, "sheet", out, step.sheet);
    if (!at) return null;
    await sleep(900);
    await t.evaluate("__feel.stop()");
    if (!target) target = "__opened__";
  }
  let box;
  if (target === "__opened__") {
    box = await t.evaluate(`(function(){var w=__feel.watch.find(function(x){return x.name==='opened'||x.name==='sheet'});if(!w)return null;w.name='target';var r=w.el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,top:r.y,left:r.x}})()`);
  } else box = await grab(t, target, "target");
  if (!box) return out.cant(`"${step.target || step.open}" (the thing to drag) not found`);
  let sx = box.x, sy = box.top + Math.min(24, box.h / 4);
  if (!step.handle && target === "__opened__") {
    const hb = await t.evaluate(`(function(){var w=__feel.watch.find(function(x){return x.name==='target'});var h=w&&w.el.querySelector('[data-feel-handle],[data-grab],[class*=grab i],[class*=handle i]');if(!h)return null;var r=h.getBoundingClientRect();return r.width>0?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()`);
    if (hb) { sx = hb.x; sy = hb.y; }
  }
  if (step.handle) { const hb = await grab(t, step.handle); if (!hb) return out.cant(`"${step.handle}" (the handle) not found`); sx = hb.x; sy = hb.y; }
  else if ((step.dx || 0) !== 0 && !step.dy) { sx = box.left + Math.min(24, box.w / 4); sy = box.y; }
  await t.evaluate("__feel.start()");
  await sleep(60);
  const dx = step.dx || 0, dy = step.dy || 0;
  await h.drag(sx, sy, dx, dy, step.ms || (step.fast ? 110 : 320));
  await sleep(1100);
  await t.evaluate("__feel.stop()");
  const rec = await read(t);
  const rows = watchOf(rec, "target");
  const downEv = firstInput(rec, "pointerdown");
  if (!downEv || !rows.length) return out.cant("the drag never reached the element");
  const rest = [...rows].reverse().find((r) => r.t <= downEv.t) || rows[0];
  const upEv = rec.input.find((e) => (e.type === "pointerup" || e.type === "pointercancel") && e.t > downEv.t) || downEv;
  const axisY = Math.abs(dy) >= Math.abs(dx);
  const pos = (r) => (axisY ? r.y - rest.y : r.x - rest.x);
  const moves = rec.input.filter((e) => e.type === "pointermove" && e.t > downEv.t && e.t <= upEv.t);
  const ratios = [];
  // Each frame shows the finger's last move handled before it was drawn.
  for (const r of rows.filter((x) => x.t > downEv.t && x.t <= upEv.t + 1 && shown(x))) {
    const m = [...moves].reverse().find((e) => e.t <= r.t + 16);
    if (!m) continue;
    const finger = axisY ? m.y - downEv.y : m.x - downEv.x;
    if (Math.abs(finger) < 12) continue;
    ratios.push(pos(r) / finger);
  }
  ratios.sort((a, b) => a - b);
  const follow = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0;
  const n = out.numbers;
  n.follows = +follow.toFixed(2);
  const expect = step.expect || "return";
  if (Math.abs(follow) < 0.05) out.fix("does not move with the finger");
  else if (expect !== "resist" && follow < (step.fast || (step.ms && step.ms < 160) ? 0.7 : 0.8) && follow > 0) out.look(`moves ${Math.round(follow * 100)}% of the finger's distance (a drag in its free direction should be 1:1)`);
  if (follow < 0) out.fix("moves against the finger");
  const after = rows.filter((r) => r.t > upEv.t);
  const fingerEnd = axisY ? dy : dx;
  if (Math.abs(follow) < 0.05) {
    // It never moved with the finger (said above): whatever it does next (a toast leaving on its own
    // timer) is not a throw, so there is no "takes N ms to leave" or "jumps back" to judge.
  } else if (expect === "dismiss") {
    const d = departure(rows, upEv.t);
    const left = after.filter(shown);
    const wentBack = left.some((r, i) => i > 0 && Math.sign(pos(r) - pos(left[i - 1])) === -Math.sign(fingerEnd) && Math.abs(pos(r) - pos(left[i - 1])) > 2);
    const offEdge = left.length && (axisY ? (fingerEnd > 0 ? left[left.length - 1].y >= rec.vh - 2 : left[left.length - 1].y + left[left.length - 1].h <= 2) : (fingerEnd > 0 ? left[left.length - 1].x >= rec.vw - 2 : left[left.length - 1].x + left[left.length - 1].w <= 2));
    if (!d.gone && !offEdge) out.fix("is not thrown away when released past the line (it should leave)");
    else {
      n.leaves = d.gone ? Math.round(d.sinceInput) : null;
      if (wentBack) out.fix("jumps back before it leaves");
      if (n.leaves > 600) out.look(`takes ${ms(n.leaves)} to leave after it's thrown (it should be gone in about 300 ms)`);
    }
  } else if (expect === "return" || expect === "resist") {
    const end = after[after.length - 1];
    if (!end || !shown(end)) out.fix("disappears instead of coming back");
    else {
      const off = Math.abs(pos(end));
      if (off > 2) out.fix(`does not come back to rest (${Math.round(off)} px off)`);
      const settled = after.find((r, i) => i > 0 && Math.abs(pos(r)) < 1);
      n.back = settled ? Math.round(settled.t - upEv.t) : null;
      const startOff = Math.abs(pos(after[0] || end));
      const jumps = after.some((r, i) => i > 0 && Math.abs(pos(r) - pos(after[i - 1])) > Math.max(30, startOff * 0.6));
      if (jumps && startOff > 20) out.fix("snaps back in one jump (it should spring back)");
      if (n.back > 800) out.look(`takes ${ms(n.back)} to settle back`);
    }
  }
  out.say(Math.abs(follow) < 0.05 ? "does not move" : `follows ${Math.round(follow * 100)}% of the finger, ${expect === "dismiss" ? (n.leaves != null ? `thrown away in ${n.leaves} ms` : "not thrown") : n.back != null ? `back in ${n.back} ms` : "not back"}`);
  out.common(rec, downEv.t, upEv.t + 900);
  return { from: downEv.t - 30, to: upEv.t + (n.back || n.leaves || 400) + 80, rec };
}

// ── Strips: a row of frames from the screencast, labelled with the time since the action ─
let darkroom = null;
async function strip(frames, epochFrom, epochTo, title, file, crop) {
  // The screencast only sends a frame when the screen changes, so each moment shows the
  // last frame sent before it (a still screen is still a picture of that moment).
  const pool = [...frames].sort((a, c) => a.ts - c.ts);
  if (!pool.length) return null;
  const n = 6, picks = [];
  for (let i = 0; i < n; i++) {
    const want = epochFrom + ((epochTo - epochFrom) * i) / (n - 1);
    let best = pool[0];
    for (const f of pool) if (f.ts <= want + 8) best = f;
    picks.push({ ...best, at: Math.round(want - epochFrom) });
  }
  if (!darkroom) {
    const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
    darkroom = (m, p, tt) => b.send(m, p, sessionId, tt);
    await darkroom("Page.enable");
  }
  const cell = SZ.mobile ? 180 : 300;
  const k = SZ.mobile ? 1 : 0.5; // screencast pixels per CSS pixel
  const pic = (p) => {
    if (!crop) return `<img src="data:image/jpeg;base64,${p.data}" style="width:${cell}px;display:block;border-radius:6px;outline:1px solid #2a2a30">`;
    const z = cell / (crop.w * k), h = Math.round(crop.h * k * z);
    return `<div style="width:${cell}px;height:${h}px;overflow:hidden;position:relative;border-radius:6px;outline:1px solid #2a2a30;background:#fff"><img src="data:image/jpeg;base64,${p.data}" style="position:absolute;left:${-crop.x * k * z}px;top:${-crop.y * k * z}px;width:${SZ.w * k * z}px;max-width:none"></div>`;
  };
  const html = `<!doctype html><html><body style="margin:0;background:#0d0d0f;font:12px -apple-system,Helvetica,Arial,sans-serif;color:#f4f4f5">
    <div style="padding:12px 14px 6px;font-weight:600;font-size:13px">${title.replace(/</g, "&lt;")}${crop ? " (close up)" : ""}</div>
    <div id="row" style="display:flex;gap:8px;padding:0 14px 14px">${picks.map((p) => `<figure style="margin:0;width:${cell}px">${pic(p)}<figcaption style="padding-top:4px;color:#a1a1aa">${p.at} ms</figcaption></figure>`).join("")}</div></body></html>`;
  const w = 28 + n * cell + (n - 1) * 8;
  await darkroom("Emulation.setDeviceMetricsOverride", { width: w, height: 400, deviceScaleFactor: 1, mobile: false });
  const { frameTree } = await darkroom("Page.getFrameTree");
  await darkroom("Page.setDocumentContent", { frameId: frameTree.frame.id, html });
  const { result } = await darkroom("Runtime.evaluate", { expression: "Promise.all([].map.call(document.images,function(i){return i.decode().catch(function(){})})).then(function(){return document.body.scrollHeight})", awaitPromise: true, returnByValue: true });
  const shot = await darkroom("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w, height: result.value, scale: 1 }, captureBeyondViewport: true });
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  return file;
}

// ── One step, start to end ───────────────────────────────────────────────────
const RUN = { press: runPress, sheet: runSheet, dialog: runSheet, toast: runToast, page: runPage, drag: runDrag };
async function runStep(step, i, reduced) {
  const out = {
    n: i + 1, move: step.move, name: step.name || step.target || step.open || step.trigger || step.go || "", reduced,
    checks: [], numbers: {}, summary: "", strip: null,
    fix(s) { this.checks.push({ sev: "fix", says: s }); }, look(s) { this.checks.push({ sev: "look", says: s }); },
    cant(s) { this.checks.push({ sev: "cant", says: s }); return null; }, say(s) { this.summary = s; },
    common(rec, from, to) {
      for (const l of layoutAnimated(rec)) this.fix(`${l}: move it with transform and opacity instead (layout work every frame)`);
      const j = jank(rec, from, to);
      if (j.slow >= 3) this.look(`${j.slow} slow frames while it moved (worst ${ms(j.worst)})${flag("slow") ? " on a 4x slower CPU" : ""}`);
    },
  };
  const run = RUN[step.move];
  if (!run) { out.cant(`unknown move "${step.move}" (press, sheet, toast, page, drag)`); return out; }
  const t = await newTab({ reduced });
  try {
    await open(t, step.page);
    const h = hands(t);
    await before(t, h, step.before);
    if (!reduced) await t.s("Page.startScreencast", { format: "jpeg", quality: 70, maxWidth: SZ.w * (SZ.mobile ? 1 : 0.5), maxHeight: SZ.h * (SZ.mobile ? 1 : 0.5), everyNthFrame: 1 });
    const win = await run(t, h, step, reduced, out);
    if (!reduced) {
      await t.s("Page.stopScreencast").catch(() => {});
      if (win) {
        const origin = win.rec.timeOrigin;
        const f = win.epochFrom ?? origin + win.from, to = win.epochTo ?? origin + Math.min(win.to, win.from + 1600);
        out.strip = await strip(t.frames, f, to, `${i + 1} · ${step.move} · ${out.name} · ${label}`, path.join(outDir, `${String(i + 1).padStart(2, "0")}-${step.move}.png`), win.crop).catch(() => null);
      }
    }
    if (t.errors.length) out.look(`the page threw: ${t.errors[0].slice(0, 160)}`);
  } catch (e) {
    out.cant(e.message.split("\n")[0]);
  } finally {
    await b.send("Target.closeTarget", { targetId: t.targetId }).catch(() => {});
  }
  return out;
}

// ── Run every step, twice ────────────────────────────────────────────────────
const steps = (plan.steps || []).map((s, i) => [s, i]).filter(([, i]) => !only || only.has(i + 1));
if (!steps.length) { console.error("The plan has no steps."); process.exit(2); }
console.log(`FEEL try · ${label} · ${device} · ${base}${flag("slow") ? " · 4x slower CPU" : ""}`);
for (const [step, i] of steps) {
  const r = await runStep(step, i, false);
  results.push(r);
  print(r);
  if (!flag("no-reduced") && step.move !== "drag") {
    const rr = await runStep(step, i, true);
    results.push(rr);
    print(rr);
  }
}
function print(r) {
  const worst = r.checks.find((c) => c.sev === "cant") ? "CAN'T" : r.checks.find((c) => c.sev === "fix") ? "FIX" : r.checks.find((c) => c.sev === "look") ? "LOOK" : "ok";
  r.verdict = worst;
  const tag = `${String(r.n).padStart(2)} ${r.move.padEnd(5)} ${(r.reduced ? "(reduced) " : "") + r.name}`.slice(0, 46).padEnd(46);
  r.summary = r.summary || "";
  console.log(`${tag} ${worst.padEnd(5)} ${r.summary}`);
  for (const c of r.checks) console.log(`${" ".repeat(48)}${c.sev === "fix" ? "✗" : c.sev === "cant" ? "?" : "·"} ${c.says}`);
}

// Before/after pictures.
const cmp = opt("compare");
const pairs = [];
if (cmp) {
  const other = path.join(dir, ".feel", cmp);
  let twins = {};
  try { for (const r of JSON.parse(fs.readFileSync(path.join(other, "report.json"), "utf8")).results) if (!r.reduced && r.strip) twins[`${r.move}|${r.name}`] = path.join(other, path.basename(r.strip)); } catch {}
  for (const r of results.filter((x) => !x.reduced && x.strip)) {
    const twin = twins[`${r.move}|${r.name}`];
    if (!twin) { console.log(`(no "${cmp}" picture for ${r.move} "${r.name}": it wasn't in that run)`); continue; }
    if (!fs.existsSync(twin)) continue;
    const file = path.join(dir, ".feel", `compare-${path.basename(r.strip)}`);
    const a = fs.readFileSync(twin).toString("base64"), c = fs.readFileSync(r.strip).toString("base64");
    const html = `<!doctype html><body style="margin:0;background:#0d0d0f"><img src="data:image/png;base64,${a}" style="display:block"><img src="data:image/png;base64,${c}" style="display:block"></body>`;
    const { frameTree } = await darkroom("Page.getFrameTree");
    await darkroom("Page.setDocumentContent", { frameId: frameTree.frame.id, html });
    const { result } = await darkroom("Runtime.evaluate", { expression: "Promise.all([].map.call(document.images,function(i){return i.decode()})).then(function(){return [Math.max(document.images[0].naturalWidth,document.images[1].naturalWidth),document.body.scrollHeight]})", awaitPromise: true, returnByValue: true });
    await darkroom("Emulation.setDeviceMetricsOverride", { width: result.value[0], height: result.value[1], deviceScaleFactor: 1, mobile: false });
    const shot = await darkroom("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: result.value[0], height: result.value[1], scale: 1 }, captureBeyondViewport: true });
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    pairs.push(file);
  }
}

// --only runs some steps; the label's report keeps the others from its last run (in report.md, the
// summary and report.json alike: a later --compare needs them all).
let all = results;
if (only) {
  let old = [];
  try { old = (JSON.parse(fs.readFileSync(path.join(outDir, "report.json"), "utf8")).results || []).filter((r) => !only.has(r.n)); } catch {}
  if (old.length) {
    console.log(`\nKept from the last "${label}" run (not run now):`);
    for (const r of old) { r.checks = r.checks || []; r.kept = true; print(r); }
    all = [...old, ...results].sort((a, c) => a.n - c.n || Number(a.reduced) - Number(c.reduced));
  }
}

// Report.
const counts = { fix: 0, look: 0, cant: 0 };
for (const r of all) for (const c of r.checks) counts[c.sev]++;
const md = [`# FEEL · ${label} · ${device}`, "", `${base} · ${new Date().toISOString().slice(0, 16).replace("T", " ")}${flag("slow") ? " · 4x slower CPU" : ""}`, "",
  `**${counts.fix} to fix · ${counts.look} to look at · ${counts.cant} could not be tested**`, "",
  "| # | move | what | verdict | measured |", "|---|---|---|---|---|",
  ...all.map((r) => `| ${r.n} | ${r.move}${r.reduced ? " (reduced)" : ""} | ${r.name.replace(/\|/g, "/")} | ${r.verdict}${r.kept ? " (last run)" : ""} | ${(r.summary || "").replace(/\|/g, "/")} |`), "",
  ...all.filter((r) => r.checks.length).flatMap((r) => [`### ${r.n} ${r.move}${r.reduced ? " (reduce motion on)" : ""}: ${r.name}`, ...r.checks.map((c) => `- ${c.sev === "fix" ? "**fix**" : c.sev === "cant" ? "**could not test**" : "look"}: ${c.says}`), ""]),
  "Strips (frames from the moment of the action):", ...all.filter((r) => r.strip).map((r) => `- ${path.relative(dir, r.strip)}`),
  ...(pairs.length ? ["", "Before (top) and after (bottom):", ...pairs.map((p) => `- ${path.relative(dir, p)}`)] : []), ""].join("\n");
fs.writeFileSync(path.join(outDir, "report.md"), md);
const saved = all.map(({ fix, look, cant, say, common, kept, ...r }) => r);
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ label, device, url: base, results: saved }, null, 2));
console.log(`\n${counts.fix} to fix · ${counts.look} to look at · ${counts.cant} could not be tested${all !== results ? ` (all ${new Set(all.map((r) => r.n)).size} steps of "${label}", ${new Set(results.map((r) => r.n)).size} run now)` : ""}`);
console.log(`Report: ${path.relative(process.cwd(), path.join(outDir, "report.md")) || "report.md"}${pairs.length ? ` · before/after: ${pairs.length} pictures in .feel/` : ""}`);
b.child.kill();
process.exit(counts.cant ? 2 : counts.fix ? 1 : 0);
