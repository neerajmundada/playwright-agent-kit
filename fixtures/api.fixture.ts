import { test as base, TestInfo } from "@playwright/test";
import { ApiClient } from "../api/ApiClient";
import { getEnv } from "../utils/env-validator";
import { logger } from "../utils/logger";
import { TestDataManager } from "../utils/test-data-manager";

type ApiFixtures = {
  apiClient: ApiClient;
};

export const test = base.extend<ApiFixtures>({
  apiClient: async ({ request }, use) => {
    await use(new ApiClient(request, getEnv("API_BASE_URL")));
  },

  // Autouse-equivalent: wraps Playwright's built-in `request` fixture to add
  // lifecycle logging and guarantee test-data cleanup, mirroring the `page`
  // fixture wiring in fixtures/base.fixture.ts for UI tests.
  request: async ({ request }, use, testInfo: TestInfo) => {
    logger.info(`API test started: ${testInfo.title}`, {
      testId: testInfo.testId,
      file: testInfo.file,
      retry: testInfo.retry,
    });

    await use(request);

    try {
      await TestDataManager.cleanup(testInfo.testId);
    } catch (error) {
      logger.error("Test data cleanup failed", {
        testId: testInfo.testId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      logger.info(`API test finished: ${testInfo.title}`, {
        testId: testInfo.testId,
        status: testInfo.status,
        duration: testInfo.duration,
      });
    }
  },
});

export { expect } from "@playwright/test";
