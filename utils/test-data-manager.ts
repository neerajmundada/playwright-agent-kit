import { logger } from "./logger";
import { TestDataError } from "./errors";

/**
 * Test data manager for handling per-test cleanup and isolation.
 * Tests register a teardown callback (e.g. "delete the pet I just created
 * via the API") and it is guaranteed to run - in reverse registration order -
 * once the test finishes, regardless of whether the test passed or failed.
 */
export class TestDataManager {
  private static readonly cleanupCallbacks: Map<
    string,
    (() => Promise<void>)[]
  > = new Map();

  /**
   * Register cleanup callback
   */
  static registerCleanupCallback(
    testId: string,
    callback: () => Promise<void>,
  ): void {
    if (!this.cleanupCallbacks.has(testId)) {
      this.cleanupCallbacks.set(testId, []);
    }

    this.cleanupCallbacks.get(testId)!.push(callback);

    logger.debug("Cleanup callback registered", { testId });
  }

  /**
   * Execute all registered cleanup callbacks for a test, in reverse
   * registration order (last created, first deleted).
   */
  static async cleanup(testId: string): Promise<void> {
    try {
      const callbacks = this.cleanupCallbacks.get(testId) || [];
      if (callbacks.length === 0) {
        return;
      }

      logger.info("Starting test data cleanup", {
        testId,
        callbackCount: callbacks.length,
      });

      for (let i = callbacks.length - 1; i >= 0; i--) {
        try {
          await callbacks[i]();
        } catch (error) {
          logger.error("Cleanup callback failed", {
            testId,
            callbackIndex: i,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.cleanupCallbacks.delete(testId);

      logger.info("Test data cleanup completed", { testId });
    } catch (error) {
      throw new TestDataError(`Cleanup failed for test ${testId}`, "cleanup", {
        testId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
