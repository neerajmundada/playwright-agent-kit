import { validateEnvironment, maskSensitiveData } from "../utils/env-validator";
import { logger } from "../utils/logger";

try {
  const env = validateEnvironment();
  logger.info("Environment configuration is valid", maskSensitiveData(env));
  console.log("Environment validation passed.");
  process.exit(0);
} catch (error) {
  logger.error("Environment validation failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(
    "Environment validation failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
