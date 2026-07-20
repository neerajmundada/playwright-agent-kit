---
name: playwright-mcp
description: >
  Live, interactive browser inspection via the Playwright MCP server, for this
  repo's UI framework. USE FOR: finding a corrected selector when a locator
  broke because the live page changed and captured artifacts (trace/
  screenshot/error-context) don't explain it; exploring an unfamiliar page or
  flow before writing a brand-new test against it; reproducing a live,
  timing-dependent behavior a static trace can't show. DO NOT USE FOR: running
  the existing suite, checking pass/fail results, or anything already
  answerable from reports/test-artifacts/** or logs/*.log - use the
  playwright-cli skill for all of that. Requires the Playwright MCP server to
  be configured (`claude mcp add playwright npx @playwright/mcp@latest`); if
  its tools aren't available, fall back to `npx playwright codegen <url>`
  instead.
metadata:
  version: "1.0.0"
---

# Playwright MCP Skill

Live browser tools (`mcp__playwright__browser_*`) are the most expensive tool
in this framework's kit in AI-token terms - every navigate/snapshot/click
round-trip serializes real page state into the conversation. Use this skill
surgically, not as a default.

## Before using this skill

1. Confirm the failure/question genuinely isn't answered by
   `reports/test-artifacts/**` (trace.zip, screenshot, error-context.md),
   `logs/*.log`, or the code itself. If it is, stop and use `playwright-cli`
   instead - reading a file is free, a live browser round-trip is not.
2. If `mcp__playwright__*` tools aren't available in this session, don't block
   on it - use `npx playwright codegen <url>` (see `playwright-cli` skill) as
   the fallback for discovering selectors/flows.

## Token-discipline rules

- **One snapshot, not many.** Use `browser_snapshot` (accessibility tree - compact,
  structured text) to see the page, extract exactly the selector/state you
  need, then stop. Don't re-snapshot after every click "just to check."
- **Snapshot over screenshot.** A screenshot burns image tokens and is harder
  to derive a selector from than the accessibility tree. Only take a
  screenshot if the question is genuinely visual (layout/rendering), not
  structural.
- **Don't replay the whole user flow.** You're here to find one thing (a
  selector, a piece of live state), not to manually re-run the test via MCP
  clicks. Once you have what you need, close the loop and verify by running
  the *actual* test via `playwright-cli`, not by continuing to drive the
  browser through MCP.
- **Navigate once per unknown page.** If a flow spans multiple pages, batch
  your questions before navigating again rather than bouncing back and forth.

## Workflow: healing a broken locator

1. From the failing test/page object, identify the old selector and what
   element it was supposed to match.
2. `browser_navigate` to the relevant page (or the app's base URL + the
   in-app path the test takes to get there).
3. `browser_snapshot` once. Find the element in the accessibility tree.
4. Derive a selector, preferring stability in this order: role + accessible
   name (`getByRole`) > visible text (`getByText`) > test id > CSS class.
   (Note: this repo's existing `ProductsPage.ts` selectors are mostly CSS
   classes because the react-shopping-cart demo app's classes are
   auto-generated/unstable by build - match the existing file's style unless
   a clearly more robust role/text selector is available.)
5. Update the **Page Object** (never the test file) with the corrected
   selector.
6. Close out of MCP. Verify the fix by running the specific test via
   `playwright-cli` (`npx playwright test <file> -g "<test name>"`), not by
   continuing to drive it through MCP.

## Workflow: exploring a new page/flow before writing a test

1. **First, read what already exists - zero live-browser cost.** Check
   `pages/BasePage.ts` and any Page Object already covering this area (e.g.
   `pages/ProductsPage.ts`), plus `fixtures/base.fixture.ts`. Part of the
   flow you're about to explore live may already be a Page Object method;
   only the genuinely new part needs a live look. This step is what keeps
   the resulting test cheap *and* structured - skipping it produces a raw,
   linear spec that duplicates existing methods and ignores the fixture/tag
   conventions, discovered only after the fact.
2. `browser_navigate` to the starting URL.
3. `browser_snapshot` to see what's there. If the flow requires an action to
   reveal the next state (e.g. opening a modal), perform it, then take one
   more snapshot - not one snapshot per intermediate hover/focus.
4. Note the selectors and flow steps you need.
5. Leave MCP and write the Page Object + test using `playwright-cli` to
   verify (`--headed` or `--debug` if you need to watch it run). Add new
   locators/methods to the Page Object itself (matching its existing
   selector style and error/logging conventions) rather than inlining raw
   locators in the spec file; consume it through `fixtures/base.fixture.ts`
   and tag the test like existing specs do.

## Workflow: reproducing a live timing issue

Only reach for this after `playwright-cli`'s `--repeat-each` and trace
inspection haven't nailed it down. Use `browser_navigate` +
`browser_console_messages` / `browser_network_requests` to observe the
specific race/timing condition directly, then translate the finding into a
proper Playwright wait/assertion in the test - don't leave the fix as "worked
when I watched it."
