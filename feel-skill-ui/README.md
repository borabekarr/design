# FEEL

A skill for Claude Code that makes your app feel good to use: press, sheets, toasts, page changes
and drag, added into your own code, then tested.

**Install:** unzip, open the folder in Claude Code (`cd` into it, run `claude`) and type `hi`.
Needs Node 18+. Web testing uses the Chrome, Edge, Brave or Chromium you already have.

**Use:** in your app's folder type `/feel`. Or `/feel the checkout`, `/feel lively`, `/feel check`.

Works with web apps (React, Next.js, Vue, Svelte, Astro, plain HTML), SwiftUI (iOS 17+) and
React Native / Expo (Reanimated + Gesture Handler). It works in other tools that read skills too
(Codex, Cursor): point them at `feel/SKILL.md`.

What's inside: `feel/SKILL.md` (the run), `feel/references/` (the rules with numbers, and the how
for each stack), `feel/kit/` (small tested files it copies into your app: CSS + drag + presence for
the web, Feel.swift, feel.tsx), `feel/scripts/` (scan, check, try: the real-browser test).
