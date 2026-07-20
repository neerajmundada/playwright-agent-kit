# Using the `senior-test-engineer` Agent

This repo ships one Claude Code subagent, defined in
[`.claude/agents/senior-test-engineer.md`](../.claude/agents/senior-test-engineer.md).
It's a project-scoped agent - only available when this repo is your Claude
Code working directory - that writes and debugs tests the way this framework
already does things, instead of introducing a new style, HTTP client, logger,
or error hierarchy.

This doc is a quick-start with worked examples. The agent file itself is the
authoritative rule set; read it if you want the full list of conventions it
enforces.

## Prerequisites

- Claude Code (CLI, desktop app, or IDE extension), working directory set to
  this repo.
- If you just cloned the repo, or just pulled changes that touched anything
  under `.claude/`, **restart or reload your Claude Code session first.**
  Agents (and skills, and MCP servers) are only discovered when a session
  *starts* - they will not appear mid-conversation, even right after the
  files land on disk.

### Verify it's available

Ask Claude Code to use the agent for something small, e.g.:

```
Use the senior-test-engineer agent to list the tags used in tests/api/petstore.spec.ts
```

If you get back something like "Agent type ... not found," the session
hasn't picked up `.claude/agents/senior-test-engineer.md` yet - reload/restart
and try again.

## How to invoke it

Just name it in a normal prompt - no special syntax required:

```
Use the senior-test-engineer agent to <task>
```

or address it directly:

```
senior-test-engineer: <task>
```

## Example 1 - Add a new API test

**Prompt:**

```
Use the senior-test-engineer agent to add an API test for GET /store/inventory,
following the same pattern as tests/api/petstore.spec.ts.
```

**What the agent does** (per its own instructions):

1. Reads `README.md` if it hasn't already seen this repo in the conversation.
2. Checks `api/ApiClient.ts` for a method that already covers this endpoint;
   adds one (following the existing `getPetById`/`createPet`/... style -
   logged, retried, typed errors) if it doesn't exist yet.
3. Writes the test in `tests/api/petstore.spec.ts`, using
   `fixtures/api.fixture.ts` rather than the raw Playwright `request` fixture.
4. Tags the test `@api` plus `@smoke`/`@critical` if it warrants fast-gate
   protection.
5. Registers any created test data for cleanup via
   `TestDataManager.registerCleanupCallback`.
6. Runs the new test via the CLI and typechecks/lints before calling it done.

**Expect back:** a diff (new `ApiClient` method if needed + the new test
case) and command output proving the test passes - not a wall of raw log
output.

## Example 2 - Debug a failing test

**Prompt:**

```
Ask the senior-test-engineer agent why tests/ui/product.spec.ts keeps failing
on firefox and to fix it if it's a real bug.
```

**What the agent does:**

1. Reruns the failing test via CLI (`--last-failed`, `--trace on`, or
   `--debug`) rather than guessing.
2. Reads what Playwright already captured for free - `error-context.md`,
   the failure screenshot, `video.webm`, `trace.zip` - plus
   `logs/error.log`/`logs/test-execution.log`.
3. Forms a hypothesis from those artifacts. Only escalates to a live browser
   (the `playwright-mcp` skill) if the artifacts don't explain the failure -
   e.g. the live site's structure has since changed.
4. If it's a real bug, fixes it and reruns to confirm; if it's a flaky
   test, says so rather than papering over it with a retry.

## Example 3 - Heal a broken locator

**Prompt:**

```
Have the senior-test-engineer agent heal the broken locator in
ProductsPage.ts's cart drawer selector - the site's layout changed.
```

**What the agent does:**

1. Identifies the old selector and failure reason from the trace/
   `error-context.md` first.
2. If that's not enough (the live page genuinely changed), takes exactly
   **one** live MCP snapshot to find the corrected selector - not an open-
   ended browsing session.
3. Updates the **Page Object** (`pages/ProductsPage.ts`), never the test
   file directly.
4. Reruns the specific test via CLI to confirm, then runs the tag group it
   belongs to (e.g. `npm run test:smoke`) to make sure nothing else broke.

## What this agent will and won't do on its own

- It defaults to free, deterministic CLI commands (the `playwright-cli`
  skill) and only reaches for a live browser (the `playwright-mcp` skill)
  when a CLI/file-based answer genuinely isn't available - see
  [`using-skills.md`](./using-skills.md) for how that decision gets made.
- It won't expand the intentionally-narrow Petstore API suite into a full
  spec sweep unless you explicitly ask for that.
- It won't add auto-triggers to `.github/workflows/api-tests.yml` (manual-
  dispatch only, by design) unless asked.
- After any change, it typechecks (`npx tsc --noEmit -p tsconfig.json`) and
  lints (`npm run lint`) before considering the work done.

See also: [`using-skills.md`](./using-skills.md) for the two skills this
agent relies on, and [`mcp-setup.md`](./mcp-setup.md) for getting the live-
browser tool working.
