# Using This Repo's Claude Code Skills

A **skill** is a packaged set of instructions Claude Code loads on demand -
either because you invoked it explicitly (`/skill-name ...`) or because
Claude Code recognized your request matches what the skill covers. This repo
ships two, both scoped to this project (`.claude/skills/`):

| Skill | Purpose | Cost profile |
|---|---|---|
| [`playwright-cli`](../.claude/skills/playwright-cli/SKILL.md) | Run/filter/rerun the suite, read reports/traces/logs, `codegen`, lint/typecheck, validate `.env` | Native commands - no AI/browser tokens |
| [`playwright-mcp`](../.claude/skills/playwright-mcp/SKILL.md) | Live browser inspection - selector healing, exploring an unfamiliar page/flow | Live browser tokens - used surgically, one snapshot at a time |

This doc is a quick-start with worked examples. Each `SKILL.md` file is the
authoritative reference for exact commands and decision rules.

## Prerequisites

- Claude Code, working directory set to this repo (skills are project-scoped
  like the agent).
- If you just pulled changes touching `.claude/skills/`, restart/reload your
  session - same discovery rule as agents and MCP servers.
- `playwright-mcp` additionally needs the Playwright MCP server configured -
  see [`mcp-setup.md`](./mcp-setup.md). If it isn't set up, that skill falls
  back to `npx playwright codegen <url>` automatically.

## How to invoke a skill

**Explicitly**, as a slash command:

```
/playwright-cli <what you want>
/playwright-mcp <what you want>
```

**Implicitly** - just describe the task in plain language and Claude Code
loads the matching skill itself:

```
Rerun only the tests that failed last time and tell me what's still broken.
```

## Example - `playwright-cli`

**Goal:** rerun only what failed last time and get a summary.

**Prompt:**

```
/playwright-cli rerun only the last failed tests and summarize the result
```

**What happens:**

1. Claude loads `.claude/skills/playwright-cli/SKILL.md`.
2. Runs `npx playwright test --last-failed`.
3. If anything still fails, reads `reports/test-artifacts/**` and
   `logs/*.log` (all free, already on disk) instead of guessing.
4. Reports a concise summary - not a raw log/report dump.

**You can run the exact same underlying command yourself, with no AI
involved at all:**

```bash
npx playwright test --last-failed
```

That's the point of this skill's "native commands" framing - anything it
does, you could type by hand from `SKILL.md`; the skill just saves you from
having to remember the flags.

Other things this skill covers (see the file for the full list): running by
project/tag/file, opening the Allure report (`npm run report:allure:generate`
+ `report:allure:open`, or `report:allure:serve` for both in one step),
opening a specific `trace.zip` (`npx playwright show-trace <path>`),
generating a starting point via `codegen`, and `npm run lint` /
`npx tsc --noEmit` / `npm run validate:env`.

## Example - `playwright-mcp`

**Goal:** a locator broke because the live page changed, and the captured
trace/screenshot don't explain why - you need to see the *current* page.

**Prerequisite:** the Playwright MCP server must be approved for your
session - see [`mcp-setup.md`](./mcp-setup.md). If it isn't, skip straight
to `npx playwright codegen <url>` instead (see the `playwright-cli` example
above).

**Prompt:**

```
/playwright-mcp navigate to the petstore swagger UI and find the current
selector for the "Try it out" button on the POST /pet endpoint
```

**What happens:**

1. Claude loads `.claude/skills/playwright-mcp/SKILL.md`.
2. Calls `browser_navigate` once to the target page.
3. Calls `browser_snapshot` **once** (accessibility tree, not a screenshot -
   cheaper and easier to derive a selector from).
4. Extracts the selector from that single snapshot and stops - it does not
   keep re-snapshotting "just to check," and it does not replay your whole
   test flow through MCP clicks.
5. Reports the selector back. If you're healing a Page Object, the actual
   file edit and the verification rerun happen via `playwright-cli`
   afterward, not by continuing to drive the live browser.

## When to use which

**Default to `playwright-cli`.** Given this repo's config (`trace:
on-first-retry`, `video: retain-on-failure`, `screenshot: only-on-failure`),
most "why did this fail" questions are already answerable for free from
`reports/test-artifacts/**` and `logs/*.log`.

**Escalate to `playwright-mcp`** only when you genuinely need to see the
*current live page* and nothing on disk answers it - a selector broke
because the site changed, you're exploring a page/flow that has no existing
Page Object yet, or you need to observe a live timing/race condition a
static trace can't show.

Never use `playwright-mcp` to run or re-verify the existing suite - running
tests is always a `playwright-cli` job.

See also: [`using-agents.md`](./using-agents.md) - the `senior-test-engineer`
agent makes this same CLI-vs-MCP decision automatically, so you often don't
need to pick a skill yourself at all.
