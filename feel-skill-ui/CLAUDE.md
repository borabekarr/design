# Install FEEL

This folder installs the FEEL skill for Claude Code. When the user says anything here ("hi",
"install"), install it, check it, and tell them how to use it. Nothing else.

1. Work from the folder that contains this CLAUDE.md (cd there first). It holds a `feel` folder.
2. Look at `~/.claude/skills/feel/SKILL.md`:
   - It doesn't exist: install.
   - It exists and its frontmatter says `name: feel` and its description starts "Makes an app feel
     good to use": it's an older FEEL. Update it.
   - It exists and is something else: ask the user before replacing it, and stop if they say no.
3. Copy, with the line for the shell you actually run (Claude Code on Windows usually runs Git Bash:
   use the first line there too; use PowerShell only if that is your shell):
   - macOS, Linux, Git Bash or WSL: `mkdir -p ~/.claude/skills && rm -rf ~/.claude/skills/feel && cp -R feel ~/.claude/skills/feel`
   - PowerShell: `New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null; Remove-Item -Recurse -Force "$HOME\.claude\skills\feel" -ErrorAction SilentlyContinue; Copy-Item -Recurse feel "$HOME\.claude\skills\feel"`
4. Check: `node ~/.claude/skills/feel/scripts/spring.mjs 0.3 0` prints a transition. If `node` is
   missing or older than 18, say FEEL needs Node 18 or newer (nodejs.org) and stop.
5. Tell the user exactly this, in the language they wrote to you in, with "installed" or "updated"
   as it was, and nothing else:

   **FEEL is installed.** Open Claude Code in your app's folder and type `/feel`. It reads the app,
   adds press, sheet, toast, page and drag motion into your own code, and tests every move in a real
   browser (web apps). `/feel check` only reports. If `/feel` doesn't show up, type
   `/reload-skills` or restart Claude Code.
