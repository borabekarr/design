// Walk a project's own source files (never node_modules, builds, Pods or .git).
import fs from "node:fs";
import path from "node:path";

const SKIP = new Set(["node_modules", ".git", ".next", ".nuxt", ".svelte-kit", ".output", ".vercel", ".turbo", ".expo", "dist", "build", "out", "coverage", "Pods", "DerivedData", ".build", ".feel", ".cache", "vendor", "android", "ios-build", "storybook-static", ".idea", ".vscode", "compiled", "generated", "__generated__"]);
export const SOURCE = /\.(tsx|jsx|ts|js|mjs|vue|svelte|astro|html|css|scss|sass|less|swift)$/i;

export function walk(root, { max = 6000, maxBytes = 400_000 } = {}) {
  const out = [];
  const stack = [root];
  while (stack.length && out.length < max) {
    const d = stack.pop();
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".storybook") { if (e.isDirectory()) continue; }
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.endsWith(".xcassets")) stack.push(p); continue; }
      if (!SOURCE.test(e.name) || /\.(min|bundle|generated)\.|\.d\.ts$/.test(e.name)) continue;
      try { if (fs.statSync(p).size > maxBytes) continue; } catch { continue; }
      out.push(p);
    }
  }
  return out.sort();
}

export const rel = (root, p) => path.relative(root, p).split(path.sep).join("/");
export function readJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }
export function lineOf(text, index) { let n = 1; for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) n++; return n; }

// A Construct Design file: a component, website hero or app screen from that library, as its MCP
// (get_design) or its site wrote it into the project. Its motion is tuned by hand, so FEEL never
// adds or changes motion inside it. Known by the line under "use client"
// ("// Construct Design · <slug>. …", also at the top of a native port), or, for files written
// before that line existed, by the place get_design writes them (components/design/<Name>.tsx)
// together with the library's own header ("One file, React only").
const CD_MARK = /^[ \t]*\/\/[ \t]*Construct Design[ \t]*·[ \t]*([a-z0-9-]+)/m;
export function constructDesign(relPath, text) {
  const head = text.slice(0, 600);
  const m = head.match(CD_MARK);
  if (m) return { file: relPath, slug: m[1], by: "its first comment" };
  if (/(^|\/)components\/design\/[A-Z][A-Za-z0-9]*\.(tsx|jsx)$/.test(relPath) && /^["']use client["']/.test(text) && /One file, React only/.test(text.slice(0, 4000))) {
    return { file: relPath, slug: null, by: "its place and header" };
  }
  return null;
}

// Where a Construct Design file lives in the page: its class prefix ("bs-" for bs, bs-sheet,
// bs-phone…), read from the classes it writes, so try.mjs can leave everything inside it alone
// (its sheet, its role="status", its own intro motion). Null when the classes share no prefix.
export function libRoots(text) {
  const tokens = [];
  for (const m of text.matchAll(/\bclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`)/g)) for (const t of (m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/)) if (/^[a-z][\w-]*$/i.test(t)) tokens.push(t);
  const count = {};
  for (const t of tokens) { const p = t.match(/^([a-z][a-z0-9]{0,9})(?:-|$)/i)?.[1]; if (p) count[p] = (count[p] || 0) + 1; }
  const [best, n] = Object.entries(count).sort((a, b) => b[1] - a[1])[0] || [];
  if (!best || n < 3 || n < tokens.length * 0.4) return null;
  return { prefix: `${best}-`, selector: `.${best}, [class^="${best}-"], [class*=" ${best}-"]` };
}

// Divs (spans, list items…) with a click handler and no role="button" or tabindex: no keyboard, no
// screen reader name for what it does, no press state. A backdrop or scrim (Escape closes it, it is
// not meant to be focused) and a panel that only stops the click going through are left out.
const CLICKABLE = /<(div|span|li|article|section|tr|td|img|figure|p|header)\b/g;
const CLICK_ATTR = /(?:^|\s)(?:@click|v-on:click|on:click|onclick|onClick)(?:\|[\w|]+)?\s*=/;
export function clickableDivs(text) {
  const out = [];
  for (const m of text.matchAll(CLICKABLE)) {
    const attrs = tagAttrs(text, m.index + m[0].length);
    if (attrs == null || !CLICK_ATTR.test(attrs)) continue;
    if (/\brole\s*=|\btab[iI]ndex\s*=|:tabindex\s*=/.test(attrs)) continue;
    if (/backdrop|overlay|scrim|\bmask\b|\bdim\b|curtain|stopPropagation|\|self\b|\.self\b|aria-hidden/i.test(attrs)) continue;
    out.push({ index: m.index, tag: m[1] });
  }
  return out;
}
// The attributes of the tag whose name ends at i, up to its ">" (quotes, {…} and `…` skipped over).
function tagAttrs(text, i) {
  let depth = 0, q = null;
  for (let j = i; j < text.length && j < i + 4000; j++) {
    const c = text[j];
    if (q) { if (c === "\\") j++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth <= 0 && text[j - 1] !== "=") return text.slice(i, j);
  }
  return null;
}

// FEEL's own kit, copied into the app: feel.css, feel.global.js, Feel.swift, feel.tsx, and the
// helpers in a feel/ folder (drag, spring, presence, nav, react, morph, vue, svelte; leave is the
// Svelte exit helper's older name). Not the app's code, so not judged or counted.
export const KIT = /(^|[\\/])(feel\.css|feel\.global\.js|Feel\.swift|feel\.tsx)$|[\\/]feel[\\/](drag|spring|presence|nav|react|morph|vue|svelte|leave)(\.svelte)?\.(ts|js)$/;
export const isKit = (f) => KIT.test(f);
