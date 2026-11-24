#!/usr/bin/env node
// CONVERT · compare: node compare.mjs <before-dir> <after-url-or-html> <outdir> [--after-shots <dir>]
// Captures the after page the way capture.mjs captured the before (into <outdir>/after-shots/ unless
// --after-shots is given, or reuses that folder with --no-capture), then writes:
//   compare-desktop.png  before | after, full page, tops aligned (long pages cut at 4200 px)
//   compare-phone.png    the same at phone width (cut at 3600 px)
//   compare-hero.png     the first screen of each, side by side, 16:9 (3840 x 2160)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { startBrowser, capturePage, toUrl } from "./lib/capture.mjs";
import { sleep } from "./lib/browser.mjs";

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const pos = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1] === "--after-shots"));
if (pos.length < 3) { console.error("Usage: node compare.mjs <before-dir> <after-url-or-html> <outdir> [--after-shots <dir>] [--no-capture]"); process.exit(2); }
const beforeDir = path.resolve(pos[0]);
const out = path.resolve(pos[2]);
const afterDir = path.resolve(opt("after-shots") || path.join(out, "after-shots"));
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(afterDir, { recursive: true });
for (const f of ["desktop.png", "phone.png", "desktop-hero.png"])
  if (!fs.existsSync(path.join(beforeDir, f))) { console.error(`Missing ${path.join(beforeDir, f)}: run capture.mjs on the before page first.`); process.exit(2); }

const b = startBrowser();
if (!argv.includes("--no-capture")) {
  const url = toUrl(pos[1]);
  for (const d of ["desktop", "phone"]) {
    const r = await capturePage(b, url, afterDir, d, { read: d === "desktop" });
    if (r.data) fs.writeFileSync(path.join(afterDir, "page.json"), JSON.stringify(r.data, null, 2));
    console.log(`after ${d.padEnd(7)} ${path.join(afterDir, d + ".png")}  ${r.height}px`);
  }
}

const size = (file) => { // PNG width and height from the header
  const h = fs.readFileSync(file).subarray(16, 24);
  return { w: h.readUInt32BE(0), h: h.readUInt32BE(4) };
};
const src = (f) => pathToFileURL(f).href;

const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
const s = (m, p, t) => b.send(m, p, sessionId, t);
await s("Page.enable");

const FONT = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@500&display=block" rel="stylesheet">`;
const CSS = `*{box-sizing:border-box;margin:0}body{background:#fff;color:#0b0b0b;font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace}
.row{display:flex;align-items:flex-start}.col{display:flex;flex-direction:column}
.lab{font-weight:500;letter-spacing:.14em;text-transform:uppercase;display:flex;align-items:center;gap:.7em;color:#0b0b0b}
.lab i{display:inline-block;width:.62em;height:.62em;border-radius:50%;background:#c9c9c9}.lab.after i{background:#12B76A}
.shot{position:relative;overflow:hidden;border:1px solid #e7e7e7;background:#f4f4f4;box-shadow:0 1px 2px rgba(0,0,0,.04),0 18px 50px -24px rgba(0,0,0,.18)}
.shot img{display:block;width:100%}
.fade{position:absolute;left:0;right:0;bottom:0;height:220px;background:linear-gradient(rgba(255,255,255,0),#fff)}`;

async function render(html, w, h, scale, file) {
  const tmp = path.join(os.tmpdir(), `convert-compare-${process.pid}.html`);
  fs.writeFileSync(tmp, html);
  try {
    await s("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: scale, mobile: false });
    await s("Page.navigate", { url: pathToFileURL(tmp).href });
    await sleep(300);
    await s("Runtime.evaluate", { expression: "Promise.race([Promise.all([].map.call(document.images,function(i){return i.decode().catch(function(){})})).then(function(){return document.fonts.ready}),new Promise(function(r){setTimeout(r,8000)})])", awaitPromise: true }, 20000);
    await sleep(200);
    const shot = await s("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 1 }, captureBeyondViewport: true }, 90000);
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  } finally { fs.rmSync(tmp, { force: true }); }
  console.log(`wrote ${file}`);
}

// Two full pages side by side. cssW is the page width the shots were taken at; colW the column width.
async function pair(name, cssW, colW, maxCss, scale, pad, gap, lab) {
  const files = [path.join(beforeDir, `${name}.png`), path.join(afterDir, `${name}.png`)];
  const cols = files.map((f) => {
    const { w, h } = size(f);
    const pageH = (h / w) * cssW;                 // the page's height in CSS px
    const shownH = Math.min(pageH, maxCss) * (colW / cssW);
    return { f, imgH: pageH * (colW / cssW), shownH, cut: pageH > maxCss };
  });
  const H = Math.ceil(Math.max(...cols.map((c) => c.shownH)));
  const top = pad + lab * 2.6;
  const W = pad * 2 + colW * 2 + gap, total = Math.ceil(top + H + pad);
  const col = (c, i) => `<div class="col" style="width:${colW}px;gap:${lab * 1.2}px">
    <div class="lab${i ? " after" : ""}" style="font-size:${lab}px;height:${lab * 1.4}px"><i></i>${i ? "After" : "Before"}</div>
    <div class="shot" style="height:${Math.ceil(c.shownH)}px;border-radius:${Math.round(colW / 60)}px"><img src="${src(c.f)}" style="height:${c.imgH}px">${c.cut ? '<div class="fade"></div>' : ""}</div></div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${CSS}</style></head><body>
    <div class="row" style="padding:${pad}px;gap:${gap}px">${cols.map(col).join("")}</div></body></html>`;
  await render(html, W, total, scale, path.join(out, `compare-${name}.png`));
}

await pair("desktop", 1440, 960, 4200, 1, 72, 56, 22);
await pair("phone", 390, 390, 3600, 2, 40, 36, 15);

// The first screens, 16:9: 1920 x 1080 at 2x.
{
  const f = ["desktop-hero.png"].map((n) => [path.join(beforeDir, n), path.join(afterDir, n)])[0];
  const colW = 904, colH = Math.round(colW * 900 / 1440), gap = 40;
  const left = Math.round((1920 - colW * 2 - gap) / 2), topY = Math.round((1080 - colH) / 2) + 18;
  const cell = (file, i) => `<div style="position:absolute;left:${left + i * (colW + gap)}px;top:${topY - 46}px;width:${colW}px">
    <div class="lab${i ? " after" : ""}" style="font-size:20px;height:28px;margin-bottom:18px"><i></i>${i ? "After" : "Before"}</div>
    <div class="shot" style="height:${colH}px;border-radius:14px"><img src="${src(file)}"></div></div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${CSS}body{width:1920px;height:1080px;position:relative}</style></head><body>${f.map(cell).join("")}</body></html>`;
  await render(html, 1920, 1080, 2, path.join(out, "compare-hero.png"));
}

await b.send("Target.closeTarget", { targetId }).catch(() => {});
b.child.kill();
process.exit(0);
