import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";

const REPORTS_DIR = path.resolve(__dirname, "../reports");
const ARCHIVE_ROOT = path.resolve(__dirname, "../reports-archive");
const RETENTION_COUNT = Number(process.env.ARCHIVE_RETENTION_COUNT ?? 30);

interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  durationMs: number;
}

function summarizeResults(resultsJsonPath: string): RunSummary | null {
  if (!fs.existsSync(resultsJsonPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(resultsJsonPath, "utf-8"));
    const summary: RunSummary = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      flaky: 0,
      durationMs: 0,
    };

    const walkSuites = (suites: any[]): void => {
      for (const suite of suites ?? []) {
        for (const spec of suite.specs ?? []) {
          for (const test of spec.tests ?? []) {
            summary.total++;
            const status =
              test.status ?? test.results?.[test.results.length - 1]?.status;
            if (status === "expected") summary.passed++;
            else if (status === "unexpected") summary.failed++;
            else if (status === "skipped") summary.skipped++;
            else if (status === "flaky") summary.flaky++;

            for (const result of test.results ?? []) {
              summary.durationMs += result.duration ?? 0;
            }
          }
        }
        walkSuites(suite.suites ?? []);
      }
    };

    walkSuites(raw.suites ?? []);
    return summary;
  } catch (error) {
    logger.warn("Failed to parse results.json for archival summary", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function pruneOldArchives(): void {
  if (!fs.existsSync(ARCHIVE_ROOT)) return;

  const entries = fs
    .readdirSync(ARCHIVE_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(); // ISO timestamp prefix sorts chronologically

  const excess = entries.length - RETENTION_COUNT;
  if (excess <= 0) return;

  for (const name of entries.slice(0, excess)) {
    const dirToRemove = path.join(ARCHIVE_ROOT, name);
    fs.rmSync(dirToRemove, { recursive: true, force: true });
    logger.info("Pruned old report archive", { archive: name });
  }
}

export function archiveReports(): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    logger.warn("No reports directory found - nothing to archive", {
      REPORTS_DIR,
    });
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const buildId =
    process.env.CI_BUILD_ID || process.env.GITHUB_RUN_ID || "local";
  const archiveName = `${timestamp}_${buildId}`;
  const destination = path.join(ARCHIVE_ROOT, archiveName);

  fs.mkdirSync(destination, { recursive: true });

  for (const item of ["html", "results.json"]) {
    const src = path.join(REPORTS_DIR, item);
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(destination, item), { recursive: true });
    }
  }

  const summary = summarizeResults(path.join(REPORTS_DIR, "results.json"));
  const metadata = {
    archivedAt: new Date().toISOString(),
    buildId,
    commitSha: process.env.CI_COMMIT_SHA || process.env.GITHUB_SHA || null,
    summary,
  };
  fs.writeFileSync(
    path.join(destination, "metadata.json"),
    JSON.stringify(metadata, null, 2),
  );

  logger.info("Test reports archived", { archive: archiveName, summary });
  console.log(`Reports archived to reports-archive/${archiveName}`);
  if (summary) {
    console.log(
      `Summary: ${summary.passed}/${summary.total} passed, ${summary.failed} failed, ${summary.flaky} flaky, ${summary.skipped} skipped`,
    );
  }

  pruneOldArchives();
}

if (require.main === module) {
  archiveReports();
}
