import { test as base, TestInfo } from "@playwright/test";
import { ProductsPage } from "../pages/ProductsPage";
import { logger } from "../utils/logger";
import { TestDataManager } from "../utils/test-data-manager";

type EnterpriseFixtures = {
  productsPage: ProductsPage;
  telemetry: {
    attachElementSnapshot: (locator: any, name: string) => Promise<void>;
  };
};

export const test = base.extend<EnterpriseFixtures>({
  productsPage: async ({ page }, use) => {
    await use(new ProductsPage(page));
  },
  // Playwright requires a literal destructuring pattern here to detect
  // fixture dependencies via toString(), even when none are needed.
  // eslint-disable-next-line no-empty-pattern
  telemetry: async ({}, use, testInfo: TestInfo) => {
    const attachElementSnapshot = async (locator: any, name: string) => {
      await test.step(`[Telemetry] Capture Artifact: ${name}`, async () => {
        const buffer = await locator.screenshot();
        await testInfo.attachments.push({
          name,
          contentType: "image/png",
          body: buffer,
        });
      });
    };
    await use({ attachElementSnapshot });
  },

  // Autouse fixture: logs test lifecycle and guarantees test-data cleanup
  // runs even when the test body throws.
  page: async ({ page }, use, testInfo: TestInfo) => {
    logger.info(`Test started: ${testInfo.title}`, {
      testId: testInfo.testId,
      file: testInfo.file,
      retry: testInfo.retry,
    });

    await use(page);

    try {
      await TestDataManager.cleanup(testInfo.testId);
    } catch (error) {
      logger.error("Test data cleanup failed", {
        testId: testInfo.testId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      logger.info(`Test finished: ${testInfo.title}`, {
        testId: testInfo.testId,
        status: testInfo.status,
        duration: testInfo.duration,
      });
    }
  },
});

export { expect } from "@playwright/test";
