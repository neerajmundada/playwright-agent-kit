# Setting Up MCP Tools (Playwright MCP)

The `playwright-mcp` skill (see [`using-skills.md`](./using-skills.md))
needs a live MCP server to drive a real browser. This doc covers what's
already committed to the repo, what you need to do locally, and how to
confirm it worked.

## What's already in the repo: `.mcp.json`

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

This is a **project-scoped MCP server definition** - it tells Claude Code
"there's a server named `playwright`, launched by running
`npx -y @playwright/mcp@latest`." It's committed to the repo root (no
secrets or machine-specific paths in it), so everyone who clones this repo
gets the same server definition automatically - there's nothing to edit
per-machine.

`@playwright/mcp` itself just launches a real, local, Playwright-controlled
browser process. There's no external API or account involved, so there's
nothing else to keep secret here.

## Steps to get it running

1. **Prerequisite:** Node.js and `npx` on your `PATH` (same requirement as
   the rest of this framework).
2. **Open this repo in Claude Code** (CLI, desktop app, or IDE extension).
   `.mcp.json` at the repo root is auto-detected.
3. **Approve the server.** The first time a session sees a project-scoped
   MCP server it hasn't seen before, Claude Code prompts you to approve it -
   committing `.mcp.json` does not silently grant trust to anyone who clones
   the repo. Approve `playwright` when prompted.

   Alternatively, register/approve it explicitly yourself instead of waiting
   for the prompt:

   ```bash
   claude mcp add playwright -- npx @playwright/mcp@latest
   ```
4. **Your approval is stored locally**, not shared, in
   `.claude/settings.local.json`:

   ```json
   { "enabledMcpjsonServers": ["playwright"] }
   ```

   This file is gitignored (see `.gitignore`) on purpose - it's
   per-developer state, same idea as `.env`. If you're on a fresh clone and
   `playwright-mcp` tools aren't showing up, this is usually why: you
   haven't approved the server on *this* machine/session yet, even if a
   teammate already has on theirs.
5. **Restart or reload your Claude Code session** if you just approved the
   server mid-conversation - like agents and skills, MCP servers are only
   picked up when a session *starts*.

## Verifying it worked

Ask Claude to do something small that requires the live browser, e.g.:

```
Take a browser_snapshot of https://petstore.swagger.io/v2/
```

or just try one of the `playwright-mcp` examples in
[`using-skills.md`](./using-skills.md). If the `mcp__playwright__*` tools
aren't available, the server hasn't been approved/loaded for this session
yet - go back to step 3.

## If MCP isn't available (or you'd rather not set it up)

Nothing in this framework *requires* MCP - it only unlocks the
`playwright-mcp` skill's live-browser workflows (selector healing on a
changed page, exploring a brand-new flow). Everything else - running tests,
reading reports, `codegen` - works with zero MCP setup via the
`playwright-cli` skill. If `mcp__playwright__*` tools aren't available, fall
back to:

```bash
npx playwright codegen <url>
```

to explore a page and generate starting selectors by hand (see
[`using-skills.md`](./using-skills.md) and
`.claude/skills/playwright-cli/SKILL.md`).
