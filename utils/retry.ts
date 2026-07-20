import { logger } from "./logger";
import { isRetryable, handleError, TestAutomationError } from "./errors";

/**
 * Options for exponential-backoff retry
 */
export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
  operationName?: string;
  /** Override which errors are considered retryable. Defaults to TestAutomationError.isRetryable */
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "shouldRetry">> = {
  maxAttempts: Number(process.env.MAX_RETRIES ?? 3),
  initialDelayMs: Number(process.env.RETRY_DELAY ?? 1000),
  maxDelayMs: 15000,
  backoffFactor: 2,
  jitter: true,
  operationName: "operation",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes an async operation with exponential backoff retry.
 * Only retries errors classified as retryable (see utils/errors.ts) unless
 * a custom `shouldRetry` predicate is supplied.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const shouldRetry = options.shouldRetry ?? isRetryable;

  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        logger.info(`${opts.operationName} succeeded after retry`, {
          attempt,
          maxAttempts: opts.maxAttempts,
        });
      }
      return result;
    } catch (error) {
      lastError = handleError(error);
      const canRetry = attempt < opts.maxAttempts && shouldRetry(error);

      logger.warn(
        `${opts.operationName} failed on attempt ${attempt}/${opts.maxAttempts}`,
        {
          error:
            lastError instanceof Error ? lastError.message : String(lastError),
          willRetry: canRetry,
        },
      );

      if (!canRetry) {
        break;
      }

      const backoff = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffFactor, attempt - 1),
        opts.maxDelayMs,
      );
      const delay = opts.jitter
        ? backoff * (0.5 + Math.random() * 0.5)
        : backoff;

      await sleep(delay);
    }
  }

  throw lastError instanceof TestAutomationError
    ? lastError
    : handleError(lastError);
}

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  name?: string;
}

/**
 * Simple circuit breaker to stop hammering a consistently failing dependency
 * (e.g. a flaky API or environment) and fail fast instead.
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private nextAttemptTime = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
    this.name = options.name ?? "default";
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() < this.nextAttemptTime) {
        throw new TestAutomationError(
          `Circuit breaker "${this.name}" is OPEN - failing fast`,
          "CIRCUIT_OPEN",
          503,
          false,
          { name: this.name, retryAt: new Date(this.nextAttemptTime) },
        );
      }
      this.state = "HALF_OPEN";
      logger.info(`Circuit breaker "${this.name}" entering HALF_OPEN state`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      logger.info(
        `Circuit breaker "${this.name}" closing after successful probe`,
      );
    }
    this.state = "CLOSED";
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;

    if (
      this.state === "HALF_OPEN" ||
      this.failureCount >= this.failureThreshold
    ) {
      this.state = "OPEN";
      this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
      logger.warn(`Circuit breaker "${this.name}" opened`, {
        failureCount: this.failureCount,
        resetAt: new Date(this.nextAttemptTime),
      });
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.nextAttemptTime = 0;
  }
}
