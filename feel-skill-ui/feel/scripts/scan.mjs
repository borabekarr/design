#!/usr/bin/env node
// FEEL · scan.mjs: read the app before touching it.
//
//   node scan.mjs [project dir] [--json]
//
// Finds what the app is built with (web framework, SwiftUI, React Native / Expo), which motion
// and UI libraries it already has (so FEEL uses them instead of adding new ones), and every
// place the five moves live: things you press, sheets and dialogs, toasts, page changes, and
// things you could drag. Also the motion already there: how many durations and curves are in
// use, and whether "reduce motion" is respected anywhere. Construct Design files (components,
// heroes and screens from that library) are listed on their own and left out of the rest: their
// motion is tuned by hand and FEEL leaves it alone.
// Writes .feel/map.json and prints a short summary.
import fs from "node:fs";
import path from "node:path";
import { walk, rel, readJson, lineOf, constructDesign, isKit, libRoots, clickableDivs } from "./lib/files.mjs";

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith("--")) || ".");
const pkg = readJson(path.join(root, "package.json")) || {};
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const has = (n) => (n in deps ? String(deps[n]) : null);
const installed = (n) => readJson(path.join(root, "node_modules", n, "package.json"))?.version || null;
// Only what the app declares counts; node_modules says which version of it is installed.
const ver = (n) => (has(n) ? installed(n) || has(n).replace(/^[^\d]*/, "") : null);
const major = (v) => (v ? parseInt(String(v).replace(/^[^\d]*/, ""), 10) : null);

const files = walk(root);
const exists = (p) => fs.existsSync(path.join(root, p));
const swiftFiles = files.filter((f) => f.endsWith(".swift"));
const swiftUI = swiftFiles.filter((f) => /import SwiftUI/.test(fs.readFileSync(f, "utf8")));

// ── Stack ────────────────────────────────────────────────────────────────────
const stack = [];
const notes = [];
const nextHere = !has("next") && ["next.config.ts", "next.config.js", "next.config.mjs"].some((f) => fs.existsSync(path.join(root, f)));
if (nextHere) { deps.next = installed("next") || "?"; if (installed("react")) deps.react = installed("react"); notes.push("package.json doesn't list next, but this is a Next.js app (next.config): libraries the app doesn't declare are ignored."); }
if (has("react-native") || has("expo")) stack.push(has("expo") ? `Expo ${ver("expo") || ""}`.trim() + " (React Native)" : "React Native");
if (has("next")) {
  const appDir = ["app", "src/app"].some(exists), pagesDir = ["pages", "src/pages"].some(exists);
  stack.push(`Next.js ${ver("next") || ""} (${appDir ? "App Router" : ""}${appDir && pagesDir ? " + " : ""}${pagesDir ? "Pages Router" : ""})`);
} else if (has("nuxt")) stack.push("Nuxt");
else if (has("@sveltejs/kit")) stack.push("SvelteKit");
else if (has("astro")) stack.push("Astro");
else if (has("@remix-run/react") || has("react-router")) stack.push(has("@remix-run/react") ? "Remix" : `React Router ${major(ver("react-router")) || ""}`.trim());
else if (has("vue")) stack.push(has("vue-router") ? "Vue + Vue Router" : "Vue");
else if (has("svelte")) stack.push("Svelte");
else if (has("solid-js")) stack.push("Solid");
else if (has("@angular/core")) stack.push("Angular (FEEL covers it with plain CSS only)");
else if (has("react-dom")) stack.push(`React ${ver("react") || ""}`.trim());
if (swiftUI.length) stack.push(`SwiftUI (${swiftUI.length} files)`);
if (exists("pubspec.yaml")) { stack.push("Flutter"); notes.push("Flutter is not covered by FEEL yet: say so and stop for the Flutter part."); }
if (!stack.length && files.some((f) => f.endsWith(".html"))) stack.push("Plain HTML/CSS/JS");
if (!stack.length) notes.push("No app found here. Run FEEL from the app's folder.");

const libs = {};
for (const n of ["motion", "framer-motion", "@react-spring/web", "gsap", "@formkit/auto-animate", "tailwindcss", "tailwindcss-animate", "tw-animate-css", "radix-ui", "@radix-ui/react-dialog", "@radix-ui/react-popover", "@radix-ui/react-dropdown-menu", "@radix-ui/react-toast", "vaul", "sonner", "react-hot-toast", "react-toastify", "@headlessui/react", "@headlessui/vue", "vue-router", "reka-ui", "radix-vue", "vue-sonner", "vue-toastification", "primevue", "vuetify", "naive-ui", "@vueuse/motion", "svelte-sonner", "react-aria-components", "@ark-ui/react", "@mui/material", "@chakra-ui/react", "@mantine/core", "bits-ui", "react-native-reanimated", "react-native-gesture-handler", "react-native-worklets", "expo-haptics", "expo-router", "@react-navigation/native-stack", "@react-navigation/stack", "@gorhom/bottom-sheet", "moti", "react-native-toast-message", "burnt", "lottie-react", "lottie-react-native", "react"]) {
  const v = ver(n); if (v) libs[n] = v;
}
if (exists("components.json")) libs["shadcn/ui"] = "components.json";
const next = libs.next || ver("next");
const reactMajor = major(ver("react"));
const nextCfg = ["next.config.ts", "next.config.js", "next.config.mjs"].map((f) => path.join(root, f)).find((f) => fs.existsSync(f));
const nextCfgText = nextCfg ? fs.readFileSync(nextCfg, "utf8") : "";
const facts = {
  motionLib: libs.motion ? "motion" : libs["framer-motion"] ? "framer-motion" : null,
  tailwind: libs.tailwindcss ? major(libs.tailwindcss) : null,
  nextViewTransition: next ? (/viewTransition\s*:\s*true/.test(nextCfgText) ? "on" : "off") : null,
  reanimated: libs["react-native-reanimated"] ? major(libs["react-native-reanimated"]) : null,
  gestureHandler: libs["react-native-gesture-handler"] ? major(libs["react-native-gesture-handler"]) : null,
  devScript: pkg.scripts?.dev ? "npm run dev" : pkg.scripts?.start ? "npm start" : null,
};
if (has("next")) {
  const nv = ver("next") || "";
  const [M, m] = nv.split(".").map(Number);
  facts.nextPageTransition = M > 16 || (M === 16 && m >= 3) ? "React <ViewTransition> + <Link transitionTypes> (no config needed from 16.3)"
    : M === 16 && m >= 2 ? "React <ViewTransition> + <Link transitionTypes>, with experimental.viewTransition: true"
    : "app/template.tsx with data-feel=\"page\" (arrival only; this Next is too old for <ViewTransition> route types)";
}
if (reactMajor) facts.react = ver("react");

// ── Where the moves live ─────────────────────────────────────────────────────
const MOVES = {
  press: /<button\b|<Button\b|<[A-Z]\w*Button\b|role=["']button["']|<Pressable\b|<TouchableOpacity\b|<TouchableHighlight\b|<Link\b[^>]*className|<(?:RouterLink|router-link|NuxtLink)\b[^>]*\bclass=|\bButton\s*\(|\.onTapGesture\b|<IconButton\b|<Card\b[^>]*(?:onClick|@click)|<(?:div|li|span|article|section|tr|td|img|figure|label|p|header)\b[^>]*(?:@click|v-on:click|on:click|\b[oO]n[cC]lick)\s*=/g,
  sheet: /<dialog\b|<Dialog\b|<DialogContent\b|<Sheet\b|<SheetContent\b|<Drawer\b|<DrawerContent\b|<Modal\b|<BottomSheet\b|<Popover\b|<PopoverContent\b|<DropdownMenu\b|<DropdownMenuContent\b|<Menu\b|<Listbox\b|<Select\b|\.sheet\s*\(|\.fullScreenCover\s*\(|\.popover\s*\(|\.confirmationDialog\s*\(|\.alert\s*\(|presentation:\s*["'](?:modal|formSheet|transparentModal)|showModal\s*\(|\bpopover=|role=["'](?:dialog|alertdialog|menu|listbox)["']|aria-haspopup|<Teleport\b|<teleport\b|isOpen|setOpen\(|\b\w*[oO]pen\s*=\s*(?:\$state|\$bindable|ref|useState|signal)\(\s*(?:false|true)?|\b(?:open|\w+Open)\s*=\s*(?:true\b|!\s*\w*[oO]pen\b)|class(?:Name)?=["'][^"']*\b(?:modal|sheet|drawer|dialog)\b/g,
  // Real toast places: where one is shown, the toast element, and the host. Not import paths
  // ("stores/toast.ts"), CSS selectors (".toast {") or the toast's inner parts ("toast__icon").
  toast: /\btoasts?\s*\.\s*(?:show|push|add|success|error|info|warning|warn|message|promise|loading|custom|open|create)\s*\(|\btoast\s*\(|(?<![\w$.])<(?:Toast\w*|Snackbar|Sonner)\b|showToast\s*\(|enqueueSnackbar\s*\(|\bnotify\s*\(|Burnt\.\w+\s*\(|Toast\.show\s*\(|<[a-z][\w-]*\b[^>]*?(?:\bclass(?:Name)?=\{?\s*(?:cn\(|clsx\(|cx\()?\s*["'`][^"'`>]*\btoast(?![-\w])|data-feel=["'][^"']*\btoast\b)|\.className\s*=\s*["'`][^"'`]*\btoast(?![-\w])|classList\.add\(\s*["'`]toast["'`]/g,
  page: /<Link\b|<NavLink\b|<RouterLink\b|<router-link\b|<NuxtLink\b|createRouter\s*\(|useRouter\s*\(|\$router\.|\bgoto\s*\(|router\.(?:push|replace|back)|navigate\s*\(|useNavigate\b|<Route\b|createBrowserRouter|NavigationStack|NavigationLink|navigationDestination|<Stack\.Screen\b|<Tabs\.Screen\b|TabView\b|<a\s+[^>]*href=["']\/|href=["'][^"'#:]+\.html|history\.pushState|location\.hash\s*=|\b(?:app|root|main|view|screen|page|content)\.(?:innerHTML|replaceChildren)\s*[=(]/g,
  drag: /draggable|onDrag|useDrag|DragGesture|Gesture\.Pan|usePanGesture|PanResponder|onSwipe|swipe|Swipe|carousel|Carousel|reorder|Reorder|onPointerMove|touchmove|\.onMove\s*\(/g,
};
const MOTION = /transition\s*:|transition-(?:all|colors|transform|opacity|\[)|\btransition\b(?=["'\s])|animation\s*:|@keyframes|\banimate-[a-z]|<motion\.|motion\(|withAnimation|\.animation\s*\(|\.transition\s*\(|withSpring|withTiming|Animated\.|useSpring|gsap\.|\.animate\s*\(/g;
const REDUCED = /prefers-reduced-motion|motion-reduce:|motion-safe:|useReducedMotion|accessibilityReduceMotion|isReduceMotionEnabled|ReduceMotion|reducedMotion=/;
const DUR = /(?:duration[-:\s(]*\[?|(?:transition|animation)[^;"'}]*?\s)(\d*\.?\d+)(ms|s)\b|duration-(\d{2,4})\b|duration:\s*(0?\.\d+|\d{2,4})\b|\.(?:easeInOut|easeOut|easeIn|linear|spring)\(duration:\s*([\d.]+)/g;
const EASE = /cubic-bezier\([^)]+\)|\bease(?:-in-out|-in|-out)?\b|\blinear\b(?![-(])|\.easeInOut|\.easeOut|\.easeIn|\.spring\b|\.snappy|\.smooth|\.bouncy|Easing\.[a-zA-Z]+/g;

// Also page changes: any link in a tab bar or nav (href={…} included), and toast places: the timer
// in a toast-named file that sends it away.
const NAVFILE = /(?:^|\/)[^/]*(?:tab-?bar|tabs|nav|header|sidebar|footer|menu)[^/]*$/i;
const NAVLINK = /<a\b[^>]*?\bhref\s*=\s*(?!["'`]?(?:#|javascript:))/g;
const TOASTFILE = /(?:^|\/)[^/]*(?:toast|snack)[^/]*$/i;
// Shared components (one change reaches every use): listed first.
const SHARED = /(?:^|\/)[^/]*(?:button|sheet|dialog|toast|menu|drawer|modal|popover)[^/]*$/i;
let clickDivs = 0; const clickDivFiles = {};
const where = Object.fromEntries(Object.keys(MOVES).map((k) => [k, []]));
const perFile = Object.fromEntries(Object.keys(MOVES).map((k) => [k, {}]));
let motionHits = 0, reducedFiles = [];
const library = []; // Construct Design files: not the app's to move
const durations = {}, easings = {};
for (const f of files) {
  if (isKit(f)) { reducedFiles.push(rel(root, f) + " (FEEL's kit)"); continue; } // the kit is not the app, but it does respect reduce motion
  let text;
  try { text = fs.readFileSync(f, "utf8"); } catch { continue; }
  const r = rel(root, f);
  const cd = constructDesign(r, text);
  if (cd) { const roots = libRoots(text); library.push(roots ? { ...cd, ...roots } : cd); continue; }
  for (const [k, re] of Object.entries(MOVES)) {
    re.lastIndex = 0;
    let m, c = 0;
    while ((m = re.exec(text)) && c < 200) {
      c++;
      if (where[k].length < 400) where[k].push(`${r}:${lineOf(text, m.index)}  ${text.slice(m.index, m.index + 70).split("\n")[0].trim()}`);
    }
    // The extra places, where the pattern above didn't already see them.
    const seenAt = new Set();
    if (k === "page" || k === "toast") { re.lastIndex = 0; let q; while ((q = re.exec(text))) seenAt.add(q.index); }
    const extra = k === "page" && (NAVFILE.test(r) || /<nav\b/.test(text)) ? NAVLINK : k === "toast" && TOASTFILE.test(r) ? /\bsetTimeout\s*\(/g : null;
    if (extra) {
      extra.lastIndex = 0;
      let q;
      while ((q = extra.exec(text)) && c < 200) {
        if (seenAt.has(q.index)) continue;
        if (k === "page" && !NAVFILE.test(r) && !inNav(text, q.index)) continue;
        c++;
        if (where[k].length < 400) where[k].push(`${r}:${lineOf(text, q.index)}  ${text.slice(q.index, q.index + 70).split("\n")[0].trim()}`);
      }
    }
    if (c) perFile[k][r] = c;
  }
  // A div you click (no role="button", no tabindex; backdrops left out): it usually needs to become a button.
  const cdv = /\.(tsx|jsx|vue|svelte|astro|html)$/.test(f) ? clickableDivs(text) : [];
  if (cdv.length) { clickDivs += cdv.length; clickDivFiles[r] = cdv.length; }
  MOTION.lastIndex = 0;
  const mm = text.match(MOTION); if (mm) motionHits += mm.length;
  if (REDUCED.test(text)) reducedFiles.push(r);
  DUR.lastIndex = 0;
  let d; while ((d = DUR.exec(text))) {
    let msv;
    if (d[1]) msv = d[2] === "s" ? parseFloat(d[1]) * 1000 : parseFloat(d[1]);
    else if (d[3]) msv = +d[3];
    else { const v = d[4] || d[5]; msv = /\./.test(v) || parseFloat(v) < 10 ? parseFloat(v) * 1000 : parseFloat(v); }
    if (!(msv > 0) || msv > 60000) continue;
    const key = `${Math.round(msv)}ms`; durations[key] = (durations[key] || 0) + 1;
  }
  if (/\.(css|scss|less|tsx|jsx|vue|svelte|swift)$/.test(f)) { const e = text.match(EASE); if (e) for (const x of e) easings[x] = (easings[x] || 0) + 1; }
}
function inNav(text, i) { const a = text.lastIndexOf("<nav", i), b = text.lastIndexOf("</nav", i); return a >= 0 && a > b; }
const top = (o, n = 6) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
const map = {
  root, scanned: files.length, stack, libs, facts, notes,
  moves: Object.fromEntries(Object.keys(MOVES).map((k) => [k, { count: where[k].length, files: top(perFile[k], 12), where: where[k].slice(0, 80) }])),
  clickableDivs: { count: clickDivs, files: top(clickDivFiles, 12) },
  motion: { declarations: motionHits, durations: top(durations, 12), easings: top(easings, 12), reducedMotion: reducedFiles },
  feelInstalled: files.some((f) => isKit(f)),
  constructDesign: { count: library.length, files: library, selector: library.filter((c) => c.selector).map((c) => c.selector).join(", ") || null, rule: "Their motion is tuned by hand: never add or change motion inside these files. Add the five moves around them (the app's own buttons, sheets, toasts, routes). If one of them is itself the sheet or the toast, leave it. try.mjs leaves everything inside their roots (selector) out of its sheet, toast and page checks." },
};
fs.mkdirSync(path.join(root, ".feel"), { recursive: true });
fs.writeFileSync(path.join(root, ".feel", "map.json"), JSON.stringify(map, null, 2));
// Keep .feel out of the person's commits.
const gi = path.join(root, ".gitignore");
if (fs.existsSync(path.join(root, ".git")) || fs.existsSync(gi)) {
  const cur = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
  if (!/^\/?\.feel\/?$/m.test(cur)) { fs.writeFileSync(gi, cur + (cur && !cur.endsWith("\n") ? "\n" : "") + ".feel/\n"); notes.push("Added .feel/ to .gitignore (FEEL's notes and test pictures stay out of commits)."); }
}

if (args.includes("--json")) { console.log(JSON.stringify(map, null, 2)); process.exit(0); }
const line = (s = "") => console.log(s);
line(`FEEL scan · ${path.basename(root)} · ${files.length} source files`);
line(`Built with: ${stack.join(" + ") || "?"}`);
const shown = Object.entries(libs).filter(([n]) => n !== "react").map(([n, v]) => `${n} ${v}`);
if (shown.length) line(`Already has: ${shown.join(", ")}`);
for (const [k, v] of Object.entries(facts)) if (v && !["devScript", "react"].includes(k)) line(`  ${k}: ${v}`);
line();
const label = { press: "Things you press", sheet: "Sheets, dialogs, menus", toast: "Toasts", page: "Page changes", drag: "Could be dragged" };
for (const k of Object.keys(MOVES)) {
  const m = map.moves[k];
  const all = Object.entries(perFile[k]).sort((a, b) => Number(SHARED.test(b[0])) - Number(SHARED.test(a[0])) || b[1] - a[1]);
  line(`${label[k].padEnd(24)} ${String(m.count).padStart(4)}  ${all.slice(0, 4).map(([f, c]) => `${f} (${c})`).join(", ")}${all.length > 4 ? `, +${all.length - 4} more` : ""}`);
}
if (clickDivs) line(`Clickable divs: ${clickDivs} (${top(clickDivFiles, 3).map(([f, c]) => `${f} (${c})`).join(", ")}${Object.keys(clickDivFiles).length > 3 ? ", …" : ""}): a div you click has no press state and no keyboard; make it a <button> (or a link)`);
line("(Sheets, drawers and toasts get drag too: to dismiss and to swipe away.)");
if (library.length) line(`Construct Design: ${library.length} file${library.length === 1 ? "" : "s"} (${library.slice(0, 4).map((c) => c.file + (c.prefix ? ` [${c.prefix}*]` : "")).join(", ")}${library.length > 4 ? ", …" : ""}): their motion is hand-tuned, so FEEL leaves it alone (not counted above).`);
line();
line(`Motion already there: ${motionHits} declarations · ${Object.keys(durations).length} different durations${Object.keys(durations).length ? ` (${top(durations, 6).map(([d]) => d).join(", ")})` : ""} · ${Object.keys(easings).length} curves`);
line(`Reduce motion respected: ${reducedFiles.length ? `yes, in ${reducedFiles.length} file(s): ${reducedFiles.slice(0, 3).join(", ")}` : "nowhere"}`);
if (map.feelInstalled) line("FEEL's kit is already in this project: tune it, don't add a second one.");
for (const n of notes) line(`Note: ${n}`);
if (facts.devScript) line(`Run it with: ${facts.devScript}`);
line(`Map: .feel/map.json`);
