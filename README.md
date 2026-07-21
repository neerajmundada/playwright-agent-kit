# Playwright + TypeScript Automation Framework

An enterprise-style Playwright + TypeScript test automation framework covering UI and API testing, with structured logging, typed error handling, retry/circuit-breaker resilience, environment validation, test-data cleanup, priority-gated test execution, Allure reporting, and CI/CD.

## Getting started

### Prerequisites

- Node.js >= 18 and npm
- (Optional, to generate/view the Allure report locally) a Java runtime (JRE 8+) - check with `java -version`
- (Optional, for the AI-assisted workflow below) Claude Code - CLI, desktop app, or IDE extension

### Install & first run

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright's browser binaries (chromium + firefox - required once,
#    and again after any @playwright/test version bump)
npx playwright install --with-deps chromium firefox

# 3. Copy the env template and fill in real values (never commit .env)
cp .env.example .env

# 4. Validate your .env against the schema (utils/env-validator.ts) before running anything
npm run validate:env

# 5. Run the fast smoke check to confirm the setup works end to end
npm run test:smoke
```

If step 5 passes, you're set up correctly. See "Environment setup" below for
what each `.env` variable does, and "Running tests" for the full command
reference.

## Project structure

```
.claude/
  skills/playwright-cli/  Native Playwright/npm command reference (running, debugging, reports)
  skills/playwright-mcp/   Live-browser (MCP) reference for selector healing/exploration
  agents/senior-test-engineer.md  Subagent that writes/debugs/heals tests per this repo's rules
docs/
  using-agents.md        Step-by-step guide + examples for the senior-test-engineer agent
  using-skills.md         Step-by-step guide + examples for the playwright-cli/playwright-mcp skills
  mcp-setup.md             How to set up the Playwright MCP server (.mcp.json) from scratch
api/                  ApiClient (Petstore HTTP client: logging, retry, circuit breaker, typed errors)
config/               (none currently - env config lives in utils/env-validator.ts)
fixtures/
  base.fixture.ts     UI test fixture: ProductsPage, telemetry, lifecycle logging + data cleanup
  api.fixture.ts       API test fixture: apiClient, lifecycle logging + data cleanup
pages/
  BasePage.ts          Common Playwright actions (goto/click/type) with retry + typed errors
  ProductsPage.ts       Page object for the react-shopping-cart demo app
tests/
  ui/product.spec.ts    UI test(s) against the shopping cart app
  api/petstore.spec.ts  API test(s) against the Swagger Petstore demo API
  data/test-data.ts     UI test data
utils/
  logger.ts             Winston structured logger (console + rotating file transports)
  errors.ts              Typed error hierarchy (TestAutomationError and subclasses)
  retry.ts               Exponential-backoff retry + circuit breaker
  env-validator.ts        Joi-validated environment config (.env)
  test-data-manager.ts     Per-test cleanup callback registry
scripts/
  validate-env.ts         CLI: validate .env against the schema
  run-tests-and-report.ts Cross-platform wrapper: runs tests then always generates the Allure report
.github/workflows/
  playwright.yml          Auto-runs UI tests on push/PR/manual dispatch
  api-tests.yml            Manual-only: runs the Petstore API tests
playwright.config.ts     Projects: priority-gate, chromium, firefox (UI) + api (independent)
```

## Environment setup

1. Copy `.env.example` to `.env` and fill in real values (never commit `.env`).
2. Required/relevant variables (validated at startup via `utils/env-validator.ts`, backed by Joi):

| Variable | Purpose |
|---|---|
| `BASE_URL` | UI app under test (react-shopping-cart demo) |
| `API_BASE_URL` | API under test - defaults to `https://petstore.swagger.io/v2` |
| `MAX_RETRIES` / `RETRY_DELAY` | Defaults for `utils/retry.ts` exponential backoff; `MAX_RETRIES` also sets Playwright's local test-level `retries` (see `playwright.config.ts`) |
| `LOG_LEVEL` | Winston log level (`error`...`silly`) |
| `BROWSER` | Only affects the `priority-gate` project: set to `chromium` to gate on Chromium, anything else (including unset) gates on Firefox - see "Browser windows" below |

Run `npm run validate:env` to check your `.env` against the schema before running tests - invalid or missing required values fail fast with a clear message instead of a confusing test failure later.

### Browser windows

Headed runs (`headless: false`, the default here) always launch maximized:
Chromium via `--start-maximized`, Firefox via a fixed viewport sized to the
primary display's resolution (Firefox has no native maximize launch flag).
The `priority-gate` project's browser choice follows the `BROWSER` env var
(see table above) since it's a shared dependency of both the `chromium` and
`firefox` projects - set it to match whichever one you're actually running,
e.g.:

```bash
# PowerShell
$env:BROWSER='firefox'; npx playwright test --project=firefox

# bash
BROWSER=firefox npx playwright test --project=firefox
```

## Running tests

```bash
npm install

npm test                    # all projects (priority-gate, chromium, firefox, api)
npm run test:ui              # UI tests only
npm run test:api             # API tests only (Petstore)
npm run test:smoke           # tests tagged @smoke
npm run test:critical        # tests tagged @critical
npm run test:priority        # just the priority-gate project (fast smoke/critical check)
npm run test:ci              # runs tests, then always generates the Allure report (even on failure)
npm run validate:env         # validate .env against the schema
npm run report:allure:generate   # generate allure-report/ from allure-results/
npm run report:allure:open       # open the generated allure-report/ in a browser
npm run report:allure:serve      # generate + open in one step (temp dir, local dev only)
npm run lint / lint:fix       # ESLint
npm run security:scan        # Snyk scan (requires SNYK_TOKEN)
```

To run only the UI projects (what CI runs automatically):
```bash
npx playwright test --project=priority-gate --project=chromium --project=firefox
```

## Test tagging & prioritization

Tests are tagged in their titles (e.g. `@smoke`, `@critical`, `@api`, `@cart`). The `priority-gate` Playwright project (scoped to `tests/ui`) runs everything tagged `@smoke`/`@critical` first; the `chromium` and `firefox` projects declare it as a `dependencies` project, so if the gate fails, the full browser matrix is skipped instead of burning CI time on a build that's already broken.

The `api` project is intentionally independent - it isn't gated by or dependent on the UI priority-gate, since it's a separate, manually-triggered suite (see CI/CD below).

## API testing (Petstore)

`tests/api/petstore.spec.ts` covers the Swagger Petstore demo API (`https://petstore.swagger.io/v2`) via `api/ApiClient.ts`. By design this is **not** a full spec sweep - it's one example per HTTP verb plus the three most common error contracts:

- `GET /pet/{id}` - retrieve a pet
- `POST /pet` - create a pet
- `PUT /pet` - update a pet
- `PATCH /pet/{id}` - Petstore doesn't define a PATCH endpoint; the live server returns `405 Method Not Allowed` for every path, so this test asserts that contract explicitly rather than leaving it silently unsupported
- `DELETE /pet/{id}` - delete a pet
- **400** - malformed request body
- **404** - fetching a pet that was just deleted
- **500** - a field with the wrong type crashes the server's deserializer

`ApiClient` wraps every call with structured logging, exponential-backoff retry (skipped for the deliberately-triggered error tests via `{ maxAttempts: 1 }`, since those failures are permanent, not transient), a shared circuit breaker, and raises a typed `APIError`/`TimeoutError` instead of a bare Playwright error. Test-created pets are deleted via `TestDataManager.registerCleanupCallback`, guaranteeing cleanup even if an assertion fails.

## Logging & error handling

- `utils/logger.ts` - Winston logger with console + rotating file transports (`logs/combined.log`, `logs/error.log`, `logs/test-execution.log`, `logs/exceptions.log`). Log level and format adapt to `NODE_ENV`/`LOG_LEVEL`.
- `utils/errors.ts` - `TestAutomationError` base class plus `PageNavigationError`, `ElementInteractionError`, `TestDataError`, `APIError`, `ConfigurationError`, `TimeoutError`. Every error carries a code, status code, retryability flag, and structured context, and is logged on construction.
- `utils/retry.ts` - `withRetry()` (exponential backoff with jitter, only retries errors flagged `isRetryable`) and `CircuitBreaker` (fails fast after repeated failures against a dependency).

## Reports

- `reports/results.json` - machine-readable output (the `json` reporter), consumed by the CI job-summary step. Not meant to be browsed directly.
- **Allure** is the human-browsable report. Every run writes raw results to `allure-results/` (the `allure-playwright` reporter, configured in `playwright.config.ts`); turn that into the static site in `allure-report/` with:

  ```bash
  npm run report:allure:generate   # allure-results/ -> allure-report/
  npm run report:allure:open       # open allure-report/ in a browser

  # or, for local dev, one command that does both against a temp dir:
  npm run report:allure:serve
  ```

  **Always open it via one of the commands above - never double-click
  `allure-report/index.html` directly.** It's a single-page app that loads
  its data with `fetch()` calls; opened as a bare `file://` URL, browsers
  block those requests and every panel shows "Failed to fetch." Both
  `report:allure:open` and `report:allure:serve` start a local HTTP server
  for you, which is what makes it work. (Playwright's own native HTML
  reporter has this same restriction, for the same reason - it's not
  specific to Allure.)

  Requires a Java runtime (JRE 8+) - `allure-commandline` (a devDependency here) wraps the Java-based Allure CLI. Check with `java -version`; install a JDK/JRE if it's missing.
- `npm run test:ci` (and both CI workflows) always run `scripts/run-tests-and-report.ts` afterward - win or lose - which runs the tests, then always generates `allure-report/` regardless of pass/fail, then exits with the tests' own exit code.
- Both `allure-results/` and `allure-report/` are gitignored (generated per run) - CI uploads `allure-report/` as a build artifact instead (see CI/CD below).

## CI/CD

Two independent GitHub Actions workflows:

- **`.github/workflows/playwright.yml`** - runs on push/PR to `main`/`master` and manual dispatch. Validates env, runs an optional Snyk scan, then runs the UI projects only (`priority-gate`, `chromium`, `firefox`), uploads the generated `allure-report/` as a build artifact, and writes a job summary.
- **`.github/workflows/api-tests.yml`** - **manual dispatch only** (no push/PR/schedule trigger). Runs the `api` project against the live Petstore service, since it's a shared third-party demo server and creates real (if disposable) data - trigger it from the Actions tab when you want to check the API suite. Uploads its own `allure-report/` artifact and writes a job summary.

Required repo configuration for CI: repository variables `BASE_URL`, `API_BASE_URL`; optionally the repository secret `SNYK_TOKEN` (the security-scan job skips itself with a warning if absent).

## AI-assisted workflow (Skills & Agent)

This repo ships its own Claude Code customizations so AI help stays fast and
cheap by default, and only pays for a live browser when that's genuinely
necessary:

| | Purpose | Cost profile |
|---|---|---|
| `senior-test-engineer` (subagent) | Writes new tests, debugs failures, heals broken locators - enforces every convention in this README | Delegates to the two skills below itself |
| `playwright-cli` (skill) | Running/filtering/rerunning tests, reading reports/traces/logs, codegen, lint/typecheck | Native commands - no AI/browser tokens |
| `playwright-mcp` (skill) | Live browser inspection for locator healing or exploring an unfamiliar page | Live browser tokens - used surgically, one snapshot at a time |

The core idea: **most debugging is a file-reading problem, not a browser
problem.** This repo's config already captures a trace, screenshot, video,
and structured logs on every failure (see `logs/*.log` and
`reports/test-artifacts/**`). The agent and the `playwright-cli` skill read
those first. The `playwright-mcp` skill only gets used when a selector
genuinely needs to be re-discovered against the *current* live page.

### Setup and usage guides

The skills (`.claude/skills/playwright-cli`, `.claude/skills/playwright-mcp`)
and the agent (`.claude/agents/senior-test-engineer.md`) live in this repo and
need no install step - Claude Code discovers anything under `.claude/`
automatically for this project. The only piece that needs actual setup is
the Playwright MCP server (required only for the `playwright-mcp` skill's
live-browser tools) - see **[`docs/mcp-setup.md`](docs/mcp-setup.md)** for
the full walkthrough, including approving `.mcp.json`'s project-scoped
server.

**Important in all cases:** new MCP servers, skills, and agents are only
discovered when a Claude Code session *starts*. After first setup, or after
pulling changes that add/modify anything under `.claude/`, restart or reload
your session before expecting `senior-test-engineer` or the MCP tools to be
available.

For step-by-step examples with expected prompts and outcomes:

- **[`docs/using-agents.md`](docs/using-agents.md)** - calling
  `senior-test-engineer` to add a test, debug a failure, or heal a broken
  locator, plus how to verify the agent loaded correctly.
- **[`docs/using-skills.md`](docs/using-skills.md)** - calling
  `playwright-cli`/`playwright-mcp` directly (without the agent), and the
  rule of thumb for which one to reach for.

In all cases, prefer letting the agent/skills decide CLI vs. MCP themselves -
that decision (and keeping MCP usage minimal when it is needed) is the whole
point of splitting them this way.

## Design patterns used

- **Page Object Model** - `pages/BasePage.ts` (common actions) and `pages/ProductsPage.ts` (app-specific), keeping selectors and interactions out of test files.
- **Client wrapper** - `api/ApiClient.ts` centralizes HTTP concerns (logging, retry, error typing) so tests only deal with domain calls (`getPetById`, `createPet`, ...).
- **Custom fixtures** - `fixtures/base.fixture.ts` and `fixtures/api.fixture.ts` inject page objects/API clients and wire lifecycle logging + cleanup around every test, without each test file repeating that boilerplate.
- **Typed error hierarchy** - callers can branch on error type/code/retryability instead of parsing message strings.
