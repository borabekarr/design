# CONVERT

A skill for Claude Code that rebuilds your landing page so it converts, from real context instead
of guesses: your page, 3–5 real competitors, and the words your buyers actually use.

**Install:** unzip, open the folder in Claude Code (`cd` into it, run `claude`) and type `hi`.
Needs Node 18+ and Chrome, Edge, Brave or Chromium (it uses the one you have, headless).

**Use:** `/convert https://yoursite.com`, or in your project's folder type `/convert` or
"my site doesn't convert".

It reads your page (desktop and phone screenshots, the copy, CTAs, colours, fonts), studies your
competitors the same way, collects verbatim reviews with their links, writes a brief with one
promise, rebuilds the page (in your own code, or as a standalone `index.html`) and shows you the
before/after side by side, with `changes.md`: every change, why, and the quote or competitor it
came from. Everything lands in `./convert/<site>/`.

Nothing is invented: no fake testimonials, logos, numbers or features. Missing proof becomes a
`[PROOF NEEDED: …]` placeholder you fill. Works better with Construct Design (its MCP) connected.

What's inside: `convert/SKILL.md` (the run), `convert/references/` (research, copy, design, the
brief template), `convert/scripts/` (capture and compare, no packages).
