import { APIRequestContext, APIResponse, test } from "@playwright/test";
import { logger } from "../utils/logger";
import { APIError, TimeoutError } from "../utils/errors";
import { withRetry, CircuitBreaker } from "../utils/retry";

export interface Pet {
  id?: number;
  category?: { id?: number; name?: string };
  name: string;
  photoUrls: string[];
  tags?: { id?: number; name?: string }[];
  status?: "available" | "pending" | "sold";
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  data?: unknown;
  /** Override retry attempts - use 1 for deliberately-triggered error cases
   *  so a deterministic 5xx isn't retried three times for nothing. */
  maxAttempts?: number;
}

// Shared across every ApiClient instance in this worker process, so a run of
// consecutive failures against the Petstore API trips the breaker for the
// whole test file rather than resetting per test.
const breaker = new CircuitBreaker({
  name: "petstore-api",
  failureThreshold: 5,
  resetTimeoutMs: 30000,
});

/**
 * Thin, typed wrapper around Playwright's APIRequestContext for the
 * Swagger Petstore demo API. Every call is logged, retried on transient
 * (5xx/408/429) failures, guarded by a shared circuit breaker, and raises a
 * typed APIError/TimeoutError on failure instead of a bare Playwright error.
 */
export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseURL: string,
  ) {}

  private async send(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<APIResponse> {
    const url = `${this.baseURL}${path}`;
    const retryOptions = {
      operationName: `${method} ${path}`,
      ...(options.maxAttempts !== undefined && {
        maxAttempts: options.maxAttempts,
      }),
    };

    // maxAttempts: 1 marks a deliberately-triggered error case (a negative
    // test asserting a 4xx/5xx contract) - it isn't a real dependency
    // failure, so it's excluded from the shared breaker's failure count.
    // Otherwise every negative test in the suite would count against the
    // same threshold as genuine outages and could trip the breaker OPEN for
    // unrelated, healthy calls.
    const attempt = () =>
      withRetry(async () => {
        logger.debug(`API request: ${method} ${path}`, {
          url,
          data: options.data,
        });

        let response: APIResponse;
        try {
          response = await this.request.fetch(url, {
            method,
            data: options.data,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          // Playwright throws a plain Error for both connection failures and
          // timeouts; there's no separate status code to distinguish them,
          // so both are treated as the retryable TimeoutError case.
          const message =
            error instanceof Error ? error.message : String(error);
          await this.attachExchange(method, path, options.data, {
            error: message,
          });
          throw new TimeoutError(
            `Request ${method} ${path} failed - network error or timeout`,
            10000,
            `${method} ${path}`,
            { originalError: message },
          );
        }

        // APIResponse buffers its body, so reading it here for the report
        // attachment doesn't consume it - callers can still call .json().
        const body = await response.text().catch(() => "");
        await this.attachExchange(method, path, options.data, {
          status: response.status(),
          body,
        });

        if (!response.ok()) {
          logger.warn("API call returned error status", {
            method,
            path,
            status: response.status(),
            body,
          });
          throw new APIError(
            `${method} ${path} returned ${response.status()}`,
            response.status(),
            path,
            { body },
          );
        }

        logger.info(`API request succeeded: ${method} ${path}`, {
          status: response.status(),
        });
        return response;
      }, retryOptions);

    return options.maxAttempts === 1 ? attempt() : breaker.execute(attempt);
  }

  /**
   * Attaches the request payload and the response (or transport error) for
   * one call attempt to the HTML report, so a failed API test shows exactly
   * what was sent/received without needing to reproduce it locally. A
   * no-op outside a running test (test.info() throws) - a reporting nicety
   * is never worth failing the actual API call over.
   */
  private async attachExchange(
    method: HttpMethod,
    path: string,
    payload: unknown,
    outcome: { status: number; body: string } | { error: string },
  ): Promise<void> {
    try {
      await test.info().attach(`${method} ${path}`, {
        body: JSON.stringify(
          { request: { method, path, payload }, response: outcome },
          null,
          2,
        ),
        contentType: "application/json",
      });
    } catch {
      // Not running inside a Playwright test (e.g. a standalone script).
    }
  }

  async getPetById(
    id: number,
    opts: { maxAttempts?: number } = {},
  ): Promise<Pet> {
    const response = await this.send("GET", `/pet/${id}`, opts);
    return response.json();
  }

  async createPet(pet: Pet, opts: { maxAttempts?: number } = {}): Promise<Pet> {
    const response = await this.send("POST", "/pet", { data: pet, ...opts });
    return response.json();
  }

  async updatePet(pet: Pet, opts: { maxAttempts?: number } = {}): Promise<Pet> {
    const response = await this.send("PUT", "/pet", { data: pet, ...opts });
    return response.json();
  }

  /**
   * The Petstore API has no PATCH endpoint for pets (only POST/PUT/GET/DELETE
   * are defined) - the live server responds to PATCH with 405 Method Not
   * Allowed for every path. This method exists so that's asserted explicitly
   * as a contract test rather than silently unsupported.
   */
  async patchPet(
    id: number,
    data: Record<string, unknown>,
    opts: { maxAttempts?: number } = {},
  ): Promise<APIResponse> {
    return this.send("PATCH", `/pet/${id}`, { data, ...opts });
  }

  async deletePet(
    id: number,
    opts: { maxAttempts?: number } = {},
  ): Promise<{ code: number; message: string }> {
    const response = await this.send("DELETE", `/pet/${id}`, opts);
    return response.json();
  }
}

/** Generates a unique Pet payload so parallel test runs never collide on id. */
export function createTestPet(overrides: Partial<Pet> = {}): Pet {
  const uniqueId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  return {
    id: uniqueId,
    name: `test-pet-${uniqueId}`,
    photoUrls: ["https://example.com/pet.jpg"],
    status: "available",
    ...overrides,
  };
}
