import { logger } from "./logger";

/**
 * Base error class for all application errors
 */
export class TestAutomationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context: Record<string, any>;
  public readonly isRetryable: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isRetryable: boolean = false,
    context: Record<string, any> = {},
  ) {
    super(message);
    Object.setPrototypeOf(this, TestAutomationError.prototype);

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
    this.context = context;
    this.timestamp = new Date();

    logger.error(`${this.name} occurred`, {
      code,
      message,
      statusCode,
      isRetryable,
      context,
      stack: this.stack,
    });
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      isRetryable: this.isRetryable,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Navigation and page load errors
 */
export class PageNavigationError extends TestAutomationError {
  constructor(message: string, url: string, context: Record<string, any> = {}) {
    super(message, "PAGE_NAVIGATION_ERROR", 400, true, { url, ...context });
    Object.setPrototypeOf(this, PageNavigationError.prototype);
  }
}

/**
 * Element interaction errors
 */
export class ElementInteractionError extends TestAutomationError {
  constructor(
    message: string,
    selector: string,
    action: string,
    context: Record<string, any> = {},
  ) {
    super(message, "ELEMENT_INTERACTION_ERROR", 400, true, {
      selector,
      action,
      ...context,
    });
    Object.setPrototypeOf(this, ElementInteractionError.prototype);
  }
}

/**
 * Test data management errors
 */
export class TestDataError extends TestAutomationError {
  constructor(
    message: string,
    operation: string,
    context: Record<string, any> = {},
  ) {
    super(message, "TEST_DATA_ERROR", 400, false, { operation, ...context });
    Object.setPrototypeOf(this, TestDataError.prototype);
  }
}

/**
 * API/Network errors
 */
export class APIError extends TestAutomationError {
  constructor(
    message: string,
    statusCode: number,
    endpoint: string,
    context: Record<string, any> = {},
  ) {
    const isRetryable =
      statusCode >= 500 || statusCode === 429 || statusCode === 408;
    super(message, "API_ERROR", statusCode, isRetryable, {
      endpoint,
      ...context,
    });
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Configuration/Environment errors
 */
export class ConfigurationError extends TestAutomationError {
  constructor(
    message: string,
    configKey: string,
    context: Record<string, any> = {},
  ) {
    super(message, "CONFIGURATION_ERROR", 400, false, {
      configKey,
      ...context,
    });
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends TestAutomationError {
  constructor(
    message: string,
    timeoutMs: number,
    operation: string,
    context: Record<string, any> = {},
  ) {
    super(message, "TIMEOUT_ERROR", 408, true, {
      timeoutMs,
      operation,
      ...context,
    });
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Utility to handle errors uniformly
 */
export function handleError(error: unknown): TestAutomationError {
  if (error instanceof TestAutomationError) {
    return error;
  }

  if (error instanceof Error) {
    return new TestAutomationError(error.message, "UNKNOWN_ERROR", 500, false, {
      originalError: error.name,
    });
  }

  return new TestAutomationError(String(error), "UNKNOWN_ERROR", 500, false, {
    errorType: typeof error,
  });
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof TestAutomationError) {
    return error.isRetryable;
  }
  return false;
}
