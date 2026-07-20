import { expect, Locator, Page } from "@playwright/test";
import { logger } from "../utils/logger";
import { ElementInteractionError, PageNavigationError } from "../utils/errors";
import { withRetry } from "../utils/retry";

export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path = "/") {
    try {
      logger.debug("Navigating to page", { path });
      await withRetry(() => this.page.goto(path), {
        operationName: `goto(${path})`,
      });
    } catch (error) {
      throw new PageNavigationError(`Failed to navigate to ${path}`, path, {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async click(locator: Locator) {
    try {
      await withRetry(
        async () => {
          await locator.waitFor({ state: "visible" });
          await locator.click();
        },
        { operationName: "click" },
      );
    } catch (error) {
      throw new ElementInteractionError(
        "Failed to click element",
        locator.toString(),
        "click",
        {
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  async type(locator: Locator, value: string) {
    try {
      await withRetry(
        async () => {
          await locator.waitFor({ state: "visible"});
          await locator.fill(value);
        },
        { operationName: "type" },
      );
    } catch (error) {
      throw new ElementInteractionError(
        "Failed to type into element",
        locator.toString(),
        "type",
        {
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  async waitForVisible(locator: Locator) {
    await locator.waitFor({ state: "visible"});
  }

  async expectToBeVisible(locator: Locator) {
    await expect(locator).toBeVisible();
  }

  async takeScreenshot(name: string) {
    logger.debug("Capturing screenshot", { name });
    await this.page.screenshot({ path: `reports/${name}.png`, fullPage: true });
  }
}
