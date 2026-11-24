---
name: convert
description: Rebuilds a landing page so it converts, from real context instead of guesses. Reads the page (full-page screenshots at desktop and phone, the copy in order, CTAs, colours, fonts), studies 3-5 real competitors the same way, collects the words buyers actually use (verbatim 1-2 and 4-5 star reviews from G2, Capterra, Trustpilot, App Store, Reddit, Product Hunt, each with its URL), writes a brief (who it's for, their pain in their words, one promise, the objections, the section order, what to keep), rebuilds the page in the project's own code or as a standalone index.html, and shows a before/after picture plus changes.md (every change, why, and the quote or competitor it came from). Nothing invented - no fake testimonials, logos, numbers or features; missing proof becomes a marked placeholder. Uses the Construct Design MCP when connected. Use for "/convert", "convert", "my site doesn't convert", "my landing page doesn't convert", "rebuild my landing page", "redesign my homepage", "improve conversions", "nobody signs up", "make my homepage sell", "conversion rate", "landing page rewrite".
---

# CONVERT

A page converts when the buyer sees, in their own words, that this is the thing for their problem,
and believes it. CONVERT gives Claude that context before it touches the page: the page itself, the
competitors, the buyers' words. Then it rebuilds and shows the difference.

`<skill>` below means this skill's folder. Scripts need Node 18+ and a Chrome, Edge, Brave or
Chromium on the machine (no packages). References: `references/research.md`, `references/copy.md`,
`references/design.md`, `references/brief.md`.

## The hard rule

**Nothing invented.** No testimonial, logo, number, price, feature, rating, review, user count,
award or guarantee that isn't on the old page, in the project, said by the owner, or quoted from a
source with its URL. Competitors' reviews are research, never shown as the owner's. Where the page
needs proof that doesn't exist yet, write a visible placeholder in the page:
`[PROOF NEEDED: a customer quote about saving time on blood work]`, and list every one at the end.
Never promise a conversion number.

## What the person typed

- A URL (`/convert https://site.com`): that page.
- Nothing, in a project folder: the site in this project. Find the landing page (the `/` route or
  `index.html`), start it if needed (its dev script in the background) and use the local URL. If it's
  also deployed (URL in README, package.json `homepage`, vercel/netlify config), note that too.
- Nothing and no site here: ask once, "Which page should I convert? Paste the URL." That's the only
  question you may need. Don't ask about audience, tone or goals: the research answers those.
- A part ("just the hero", "the pricing section"): run every step, rebuild only that part.

`<site>` is the domain without `www.` and the TLD (xeyo.ai → `xeyo`), or the project folder name.
Everything goes in `./convert/<site>/` in the current folder:

```
convert/<site>/
  before/            desktop.png, phone.png, *-hero.png, page.json
  competitors/<name>/  the same, per competitor
  research/          competitors.md, voice.md, facts.md, sources.md
  brief.md
  after/             index.html + assets/ (standalone build only)
  after-shots/       the after page captured (compare.mjs)
  compare-desktop.png  compare-phone.png  compare-hero.png
  changes.md
```

Add `convert/` to `.gitignore` if the folder is a git repo and it isn't there.

## 1. Read the page

```bash
node <skill>/scripts/capture.mjs <url> ./convert/<site>/before
```

Then **look at** `before/desktop.png`, `before/phone.png` and both hero pictures (open the PNGs),
and read `page.json`. Write down: the headline and sub, what the first screen shows, every CTA and
where it leads, what proof exists, the price, the section order, the colours, the fonts, the logo.
If the capture shows a cookie wall, a login page or a blank page, say so and fix it before going on
(a different URL, the local dev server, waiting longer).

If the page is in the project, also read its source: the components, the copy files, the config
with prices and plans. Those are facts too.

## 2. Study 3–5 competitors

`references/research.md`, first half. Find them, capture each one:

```bash
node <skill>/scripts/capture.mjs <competitor-url> ./convert/<site>/competitors/<name>
```

Look at their hero pictures. Write `research/competitors.md`: per competitor the headline, the
promise, the first screen, proof, price, CTA, section order, the look, one thing to take and one to
avoid. End with the patterns (what all of them do, what none of them say).

## 3. Collect the buyers' words

`references/research.md`, second half. Low and high reviews of the person's product and of the
competitors, and the questions people ask before buying. Verbatim, each with the URL you read it
on, in `research/voice.md`, grouped by theme, with the 5 phrases buyers use most at the top. Every
URL opened goes in `research/sources.md`. The person's own facts (from the page and the project) go
in `research/facts.md`, each with where it came from.

No reviews exist yet (a new product): use the competitors' reviews and the category's Reddit
threads, and say so in the brief.

## 4. Write the brief

`references/brief.md` is the template; `references/copy.md` has the rules for the words. Write
`brief.md`: who it's for, their pain in their words (quoted), **the one promise** (one sentence),
the objections and how the page answers each, the section order, the CTA, what stays (brand, logo,
colours, type, real facts, real product pictures), and the proof list (what exists, what's a
placeholder). Every line that will appear on the page points to its source.

Say the promise in one line to the person as you go. Don't stop to ask for approval; they can
change the brief afterwards and you rebuild.

## 5. Rebuild the page

**Where**: in the project's own code when the page lives in this project (Next.js, React, Astro,
Vue, Svelte, plain HTML, anything): edit its components, keep its framework, its routing, its
analytics, its forms and its checkout links working exactly as they were. Otherwise (a URL that
isn't this project) build a standalone `after/index.html`: one file, its CSS inside, Google Fonts
allowed, the real product pictures downloaded from the site into `after/assets/` (`page.json` lists
them; use `curl`). No pictures you didn't take from the site or the project.

**How it looks**: if the Construct Design MCP tools are available (`search_designs`, `get_design`,
`design_guide`), call `design_guide` first, then `search_designs` for the sections the brief needs
(hero, features, pricing, proof, FAQ, CTA) and build from the designs you `get_design`, in the
owner's colours and type. Otherwise follow `references/design.md`. Either way: the owner's brand
stays (logo, colours, type, tone), the product is shown, the page gets shorter and clearer.

**The words**: from the brief only. Real CTA links stay the same URLs. Every `[PROOF NEEDED: …]`
placeholder is visible and styled as a placeholder (dashed outline), never disguised as real proof.

## 6. Show the before and after

```bash
node <skill>/scripts/compare.mjs ./convert/<site>/before <after-url-or-index.html> ./convert/<site>
```

For a change in the project, pass the local URL of the running dev server. It captures the after
page into `after-shots/` and writes `compare-desktop.png`, `compare-phone.png` (before left, after
right) and `compare-hero.png` (the first screens, 16:9).

**Open the three pictures and look at them** like the person will. Broken layout, an empty hero,
text over a busy picture, a section that looks unfinished, a phone layout that overflows: fix it and
run compare again. Then check the after page against the hard rule one last time: every number,
name, quote and claim on it is in `brief.md` with a source, or is a `[PROOF NEEDED: …]`.

Write `changes.md`: one line per change, top to bottom of the page, in the form
**change → why → source** (the quote with its URL, the competitor, or the old page). Then the
placeholders list.

## Hand-over

Short, in the person's language:

- **The promise**: the one line from the brief.
- **Top 5 changes**, each with its source (a quote + URL or a competitor).
- **To fill**: every `[PROOF NEEDED: …]`, one line each, with what would fill it.
- **Before / after**: the paths of `compare-desktop.png`, `compare-phone.png`, `compare-hero.png`,
  and where the new page is (the files changed, or `after/index.html`).
- If the Construct Design MCP wasn't connected, one line: "Connect Construct Design for a stronger
  look next time."

Never claim it will convert better by a number. Say what changed and why.
