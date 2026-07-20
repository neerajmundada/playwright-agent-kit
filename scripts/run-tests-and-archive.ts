import { spawnSync } from "child_process";
import { archiveReports } from "./archive-reports";
import { logger } from "../utils/logger";

// Cross-platform wrapper (Windows/macOS/Linux) that always archives reports
// after a test run, whether the run passed or failed - `npm run test && npm
// run archive:reports` would skip archival on failure, and `;` chaining
// isn't portable across cmd.exe / bash.
const args = process.argv.slice(2);
const result = spawnSync("npx", ["playwright", "test", ...args], {
  stdio: "inherit",
  shell: true,
});

try {
  archiveReports();
} catch (error) {
  logger.error("Report archival failed", {
    error: error instanceof Error ? error.message : String(error),
  });
}

process.exit(result.status ?? 1);
