# Install CONVERT

This folder installs the CONVERT skill for Claude Code. When the user says anything here ("hi",
"install"), install it, check it, and tell them how to use it. Nothing else.

1. Work from the folder that contains this CLAUDE.md (cd there first). It holds a `convert` folder.
2. Look at `~/.claude/skills/convert/SKILL.md`:
   - It doesn't exist: install.
   - It exists and its frontmatter says `name: convert` and its description starts "Rebuilds a
     landing page so it converts": it's an older CONVERT. Update it.
   - It exists and is something else: ask the user before replacing it, and stop if they say no.
3. Copy, with the line for the shell you actually run (Claude Code on Windows usually runs Git Bash:
   use the first line there too; use PowerShell only if that is your shell):
   - macOS, Linux, Git Bash or WSL: `mkdir -p ~/.claude/skills && rm -rf ~/.claude/skills/convert && cp -R convert ~/.claude/skills/convert`
   - PowerShell: `New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null; Remove-Item -Recurse -Force "$HOME\.claude\skills\convert" -ErrorAction SilentlyContinue; Copy-Item -Recurse convert "$HOME\.claude\skills\convert"`
4. Check: `node ~/.claude/skills/convert/scripts/capture.mjs --help` prints a usage line. If `node`
   is missing or older than 18, say CONVERT needs Node 18 or newer (nodejs.org) and stop.
5. Tell the user exactly this, in the language they wrote to you in, with "installed" or "updated"
   as it was, and nothing else:

   **CONVERT is installed.** Type `/convert https://yoursite.com`, or open Claude Code in your
   site's folder and type `/convert`. It reads your page, studies your competitors and what your
   buyers say in reviews, writes one promise, rebuilds the page and shows you the before and after
   side by side in `./convert/<site>/`. Nothing invented: missing proof is marked for you to fill.
   If `/convert` doesn't show up, type `/reload-skills` or restart Claude Code.
