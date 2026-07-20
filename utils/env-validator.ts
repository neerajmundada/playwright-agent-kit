import Joi from "joi";
import dotenv from "dotenv";
import path from "path";
import { logger } from "./logger";
import { ConfigurationError } from "./errors";

// Load .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * Schema for environment variables validation
 */
const envSchema = Joi.object({
  // Environment
  NODE_ENV: Joi.string()
    .valid("development", "staging", "production", "test")
    .default("development"),
  LOG_LEVEL: Joi.string()
    .valid("error", "warn", "info", "http", "debug", "verbose", "silly")
    .default("info"),

  // Application URLs
  BASE_URL: Joi.string().uri().required().description("Application base URL"),
  API_BASE_URL: Joi.string()
    .uri()
    .default("https://petstore.swagger.io/v2")
    .description("Petstore API base URL (used by tests/api)"),

  // Authentication
  AUTH_TOKEN: Joi.string().optional().description("Optional auth token"),

  // Test Configuration
  TIMEOUT: Joi.number().default(10000).description("Test timeout in ms"),
  HEADLESS: Joi.boolean()
    .default(false)
    .description("Run tests in headless mode"),
  WORKERS: Joi.number().optional().description("Number of parallel workers"),

  // Retry Configuration
  MAX_RETRIES: Joi.number().default(2).min(0).description("Max retry attempts"),
  RETRY_DELAY: Joi.number()
    .default(1000)
    .min(100)
    .description("Retry delay in ms"),

  // CI/CD Indicators
  CI: Joi.boolean().optional().description("Running in CI environment"),
  CI_COMMIT_SHA: Joi.string().optional().description("CI commit SHA"),
  CI_BUILD_ID: Joi.string().optional().description("CI build ID"),

  // Test Filtering
  TEST_TAGS: Joi.string()
    .optional()
    .description("Comma-separated test tags to run"),
  SMOKE_TESTS_ONLY: Joi.boolean()
    .default(false)
    .description("Run only smoke tests"),

  // Reporting
  REPORT_LEVEL: Joi.string()
    .valid("summary", "detailed", "verbose")
    .default("detailed")
    .description("Test report detail level"),
  ARCHIVE_REPORTS: Joi.boolean()
    .default(true)
    .description("Archive test reports"),

  // Security
  SKIP_SSL_VERIFICATION: Joi.boolean()
    .default(false)
    .description("Skip SSL certificate verification (DEV ONLY)"),
  SECURE_MODE: Joi.boolean()
    .default(true)
    .description("Enable secure mode (production default)"),

  // Snapshot URL (for storing test artifacts)
  ARTIFACT_STORAGE_PATH: Joi.string()
    .optional()
    .description("Path to store test artifacts"),
}).unknown(true);

/**
 * Validated environment object
 */
interface ValidatedEnv {
  NODE_ENV: string;
  LOG_LEVEL: string;
  BASE_URL: string;
  API_BASE_URL: string;
  AUTH_TOKEN?: string;
  TIMEOUT: number;
  HEADLESS: boolean;
  WORKERS?: number;
  MAX_RETRIES: number;
  RETRY_DELAY: number;
  CI?: boolean;
  CI_COMMIT_SHA?: string;
  CI_BUILD_ID?: string;
  TEST_TAGS?: string;
  SMOKE_TESTS_ONLY: boolean;
  REPORT_LEVEL: string;
  ARCHIVE_REPORTS: boolean;
  SKIP_SSL_VERIFICATION: boolean;
  SECURE_MODE: boolean;
  ARTIFACT_STORAGE_PATH?: string;
}

let validatedEnv: ValidatedEnv | null = null;

/**
 * Validate and get environment variables
 */
export function validateEnvironment(): ValidatedEnv {
  if (validatedEnv) {
    return validatedEnv;
  }

  const { error, value } = envSchema.validate(process.env, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errorDetails = error.details
      .map((d) => `${d.path.join(".")}: ${d.message}`)
      .join(", ");

    logger.error("Environment validation failed", { errorDetails });
    throw new ConfigurationError(
      `Invalid environment configuration: ${errorDetails}`,
      "ENVIRONMENT_VALIDATION",
      { validationErrors: error.details },
    );
  }

  // envSchema uses .unknown(true) so Joi doesn't reject the hundreds of
  // unrelated vars normally present in process.env; that also means
  // stripUnknown never strips them from `value`. Explicitly pick only the
  // keys this app defines so we never log or pass around the full OS
  // environment (which may contain unrelated secrets/paths).
  const knownKeys = Object.keys(envSchema.describe().keys);
  const picked: Record<string, unknown> = {};
  for (const key of knownKeys) {
    if (value[key] !== undefined) {
      picked[key] = value[key];
    }
  }
  validatedEnv = picked as unknown as ValidatedEnv;

  logger.info("Environment validated successfully", {
    environment: validatedEnv.NODE_ENV,
    baseUrl: validatedEnv.BASE_URL,
    logLevel: validatedEnv.LOG_LEVEL,
  });

  // Log security warnings if in development
  if (
    validatedEnv.NODE_ENV === "development" &&
    validatedEnv.SKIP_SSL_VERIFICATION
  ) {
    logger.warn("SSL verification disabled - DEV ONLY", {
      severity: "HIGH",
    });
  }

  // Enforce security in production
  if (validatedEnv.NODE_ENV === "production") {
    if (!validatedEnv.SECURE_MODE) {
      throw new ConfigurationError(
        "Secure mode must be enabled in production",
        "SECURE_MODE_DISABLED",
      );
    }
    if (validatedEnv.SKIP_SSL_VERIFICATION) {
      throw new ConfigurationError(
        "SSL verification cannot be disabled in production",
        "SSL_DISABLED_IN_PRODUCTION",
      );
    }
  }

  return validatedEnv;
}

/**
 * Get specific environment variable with validation
 */
export function getEnv<T extends keyof ValidatedEnv>(key: T): ValidatedEnv[T] {
  const env = validateEnvironment();
  const value = env[key];

  if (value === undefined) {
    throw new ConfigurationError(
      `Environment variable ${key} is not defined`,
      key as string,
    );
  }

  return value;
}

/**
 * Get environment configuration object
 */
export function getConfig(): ValidatedEnv {
  return validateEnvironment();
}

/**
 * Mask sensitive data in logs
 */
export function maskSensitiveData(data: any): any {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  const masked = { ...data };
  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "auth",
    "credential",
    "key",
  ];

  for (const key in masked) {
    if (
      sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
    ) {
      masked[key] = "***REDACTED***";
    } else if (typeof masked[key] === "object") {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }

  return masked;
}

export type { ValidatedEnv };
