import { spawnSync } from "child_process";
import { logger } from "../utils/logger";

// Cross-platform wrapper (Windows/macOS/Linux) that always generates the
// Allure HTML report after a test run, whether the run passed or failed -
// `npm run test && npm run report:allure:generate` would skip report
// generation on failure, and `;` chaining isn't portable across cmd.exe /
// bash.
const args = process.argv.slice(2);
const testResult = spawnSync("npx", ["playwright", "test", ...args], {
  stdio: "inherit",
  shell: true,
});

const reportResult = spawnSync(
  "npx",
  ["allure", "generate", "allure-results", "--clean", "-o", "allure-report"],
  { stdio: "inherit", shell: true },
);

if (reportResult.status !== 0) {
  logger.error("Allure report generation failed", {
    exitCode: reportResult.status,
  });
}

process.exit(testResult.status ?? 1);
