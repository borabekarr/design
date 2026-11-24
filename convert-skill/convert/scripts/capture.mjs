#!/usr/bin/env node
// CONVERT · capture: node capture.mjs <url-or-file> <outdir> [--desktop-only|--phone-only]
// Writes <outdir>/desktop.png (1440 wide, full page), phone.png (390 wide, full page, 2x),
// desktop-hero.png and phone-hero.png (the first screen), and page.json (what the page says).
import fs from "node:fs";
import path from "node:path";
import { startBrowser, capturePage, toUrl } from "./lib/capture.mjs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
if (args.length < 2) { const u = "Usage: node capture.mjs <url-or-file> <outdir> [--desktop-only|--phone-only]"; if (flags.has("--help")) { console.log(u); process.exit(0); } console.error(u); process.exit(2); }
const url = toUrl(args[0]);
const out = path.resolve(args[1]);
fs.mkdirSync(out, { recursive: true });

const b = startBrowser();
const devices = flags.has("--desktop-only") ? ["desktop"] : flags.has("--phone-only") ? ["phone"] : ["desktop", "phone"];
let page = null, failed = 0;
for (const d of devices) {
  try {
    const r = await capturePage(b, url, out, d, { read: d === "desktop" || devices.length === 1 });
    if (r.data) page = r.data;
    console.log(`${d.padEnd(7)} ${path.join(out, d + ".png")}  ${r.height}px${r.cut ? " (cut: the page is longer)" : ""}${r.consent ? " · cookie banner accepted" : ""}`);
  } catch (e) { failed++; console.log(`${d.padEnd(7)} FAILED: ${e.message.split("\n")[0]}`); }
}
if (page) {
  page.capturedAt = new Date().toISOString();
  fs.writeFileSync(path.join(out, "page.json"), JSON.stringify(page, null, 2));
  const h1 = page.headline ? { text: page.headline } : page.headings?.find((h) => h.level === 1) || page.headings?.[0];
  console.log(`page    ${path.join(out, "page.json")}`);
  console.log(`        "${page.title}" · headline: ${h1 ? `"${h1.text.slice(0, 90)}"` : "none"} · ${page.ctas?.length || 0} buttons · ${page.sections?.length || 0} sections · ${page.words} words`);
  console.log(`        colours ${page.colours?.background} / ${page.colours?.text} / accent ${page.colours?.accent || "none"} · type ${page.fonts?.headings} + ${page.fonts?.body}`);
  if (page.error) console.log(`        (reading the page failed: ${page.error})`);
}
b.child.kill();
process.exit(failed === devices.length ? 1 : 0);
