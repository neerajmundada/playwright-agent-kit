---
name: playwright-cli
description: >
  Run, filter, rerun, and inspect this repo's Playwright suite (UI + API) using
  native `npx playwright` / `npm run` commands - no live browser session or MCP
  round-trip needed. USE FOR: running the full suite or a subset (by project,
  tag, or file), rerunning only failed tests, generating a starting-point test
  via codegen, opening the Allure report, opening a trace.zip from a past
  failure, checking lint/typecheck, validating .env. DO NOT USE FOR: inspecting
  the CURRENT live DOM of a page when nothing on disk (trace/screenshot/log)
  already explains the failure - that needs the playwright-mcp skill instead.
metadata:
  version: "1.0.0"
---

# Playwright CLI Skill

This repo has enterprise scaffolding already wired in (see `README.md`):
Winston logging (`utils/logger.ts`), typed errors (`utils/errors.ts`),
retry/circuit-breaker (`utils/retry.ts`), env validation
(`utils/env-validator.ts`), per-test cleanup (`utils/test-data-manager.ts`),
and a priority-gated Playwright project structure. All of that is
inspectable from disk without spending a single token on a live browser -
that's the point of this skill.

## Principle

Native commands are free (in AI-token terms) and deterministic. Prefer them
over live browser inspection (`playwright-mcp` skill) for anything that
doesn't strictly require *seeing the current live page*. Most "why did this
fail" questions are answerable from artifacts Playwright already captured on
disk - read those first.

## Running tests

```bash
# Everything (priority-gate -> chromium/firefox -> api)
npm test

# Just the UI projects (what CI runs automatically)
npx playwright test --project=priority-gate --project=chromium --project=firefox

# Just the API project (manual-only in CI, see .github/workflows/api-tests.yml)
npm run test:api
# equivalent: npx playwright test --project=api

# By tag
npm run test:smoke        # --grep @smoke
npm run test:critical     # --grep @critical
npm run test:priority     # just the priority-gate project (fast gate only)

# A single file / test
npx playwright test tests/ui/product.spec.ts
npx playwright test -g "GET /pet"

# Only what failed last time (fast iteration while fixing something)
npx playwright test --last-failed

# Repeat a flaky test to gauge stability before declaring it fixed
npx playwright test tests/ui/product.spec.ts --repeat-each=5

# Run + always generate the Allure report (win or lose) - what CI does
npm run test:ci -- --project=priority-gate --project=chromium --project=firefox
```

## Debugging a failure - check artifacts before reaching for a browser

Given this repo's config (`playwright.config.ts`): `trace: on-first-retry`,
`video: retain-on-failure`, `screenshot: only-on-failure`. On any retried
failure you already have, for free, in `reports/test-artifacts/<test-name>/`:

- `error-context.md` - a text snapshot of the page/DOM state at failure time
- `test-failed-*.png` - screenshot at the moment of failure
- `video.webm` - full video of the run
- `trace.zip` - full trace (DOM snapshots, network, console, actions)

```bash
# Open the last Allure report (pass/fail summary, retries, attachments inline)
npm run report:allure:generate && npm run report:allure:open
# or, for a one-shot local view (generates to a temp dir, no separate open step):
npm run report:allure:serve
```

**Never open `allure-report/index.html` directly (double-click / `file://`)**
- it's a single-page app that loads data via `fetch()`, which browsers block
for local files, so every panel shows "Failed to fetch." Always go through
one of the two commands above; both start a local HTTP server for you.

```bash
# Open a specific trace interactively (local web UI - no AI tokens spent)
npx playwright show-trace "reports/test-artifacts/<test-dir>/trace.zip"

# Step through a test live, headed, with the Playwright inspector
npx playwright test tests/ui/product.spec.ts --debug

# Or the Playwright UI mode (time-travel through actions/snapshots)
npx playwright test --ui
```

Also check `logs/test-execution.log` and `logs/error.log` (Winston output
from `utils/logger.ts`) - test-step-level context is already logged there
(navigation, retries, cleanup), often enough to diagnose without any
browser at all.

**Only escalate to `playwright-mcp`** if, after reading the trace/screenshot/
logs, the failure still isn't explained - typically because the live page has
changed since the trace was captured and you need to see its *current*
state to find a new selector.

## Generating a starting point for a new test

**Step 0, before touching codegen: read this repo's own conventions.** Three
free file reads - `pages/BasePage.ts`, one existing Page Object for the area
you're testing (e.g. `pages/ProductsPage.ts`), and `fixtures/base.fixture.ts`
plus one existing spec (e.g. `tests/ui/product.spec.ts`) - tell you the
Page Object's existing method surface, the fixture/tagging conventions, and
often mean the interaction you need is *already written* (e.g.
`addCardToCart`, `getCartBadgeCount`, `getCartItemByName` already exist on
`ProductsPage` - a new "add to cart" test needs zero new locators, let alone
codegen). Skipping this and authoring straight from codegen/live-browser
output produces a raw, linear script that reinvents locators the framework
already has, misses retry/typed-error handling, and has no tags - do this
check first, not as a "rewrite before committing" afterthought once the
draft already exists.

```bash
# Record actions against the UI app and get generated Playwright code
npx playwright codegen https://react-shopping-cart-67954.firebaseapp.com

# Record against a different URL/viewport
npx playwright codegen --viewport-size=1280,720 <url>
```

Only reach for codegen for the genuinely new part of the interaction (one
that isn't already covered by an existing Page Object method). Then fold the
result into this repo's structure rather than dropping it in as a standalone
spec: add the new locator/method to the relevant Page Object (extends
`BasePage`, uses `logger`/typed errors, matches its existing selector
style), consume it through `fixtures/base.fixture.ts` (or `api.fixture.ts`
for API), tag the test title (`@smoke`/`@critical`/`@api` + a domain tag),
and use `test.step` the way existing specs do.

## Code quality

```bash
npx tsc --noEmit -p tsconfig.json   # typecheck
npm run lint                         # ESLint (0 errors is the bar; any-warnings are pre-existing/accepted)
npm run lint:fix                     # auto-fix formatting
npm run validate:env                 # check .env against utils/env-validator.ts schema
npm run report:allure:generate       # manually generate allure-report/ from allure-results/
```

## When NOT to use this skill

If the task is "find the current selector for X because the site changed" or
"explore this page I've never automated before" - there is nothing on disk to
read yet. Use the `playwright-mcp` skill instead.
