import { test, expect } from "../../fixtures/api.fixture";
import { createTestPet } from "../../api/ApiClient";
import { TestDataManager } from "../../utils/test-data-manager";
import { APIError } from "../../utils/errors";

// One example per HTTP verb against the Swagger Petstore demo API
// (https://petstore.swagger.io/v2), plus one example each for the 400/404/500
// error contracts. Not a full spec sweep by design.
test.describe("Petstore API - Pet resource @api", () => {
  test("GET /pet/{id} - retrieves an existing pet @smoke", async ({
    apiClient,
  }, testInfo) => {
    const pet = createTestPet();
    await apiClient.createPet(pet);
    TestDataManager.registerCleanupCallback(testInfo.testId, async () => {
      await apiClient.deletePet(pet.id!);
    });

    const fetched = await apiClient.getPetById(pet.id!);

    expect(fetched.id).toBe(pet.id);
    expect(fetched.name).toBe(pet.name);
    expect(fetched.status).toBe("available");
  });

  test("POST /pet - creates a new pet @smoke", async ({
    apiClient,
  }, testInfo) => {
    const pet = createTestPet();

    const created = await apiClient.createPet(pet);
    TestDataManager.registerCleanupCallback(testInfo.testId, async () => {
      await apiClient.deletePet(pet.id!);
    });

    expect(created.id).toBe(pet.id);
    expect(created.name).toBe(pet.name);
    expect(created.photoUrls).toEqual(pet.photoUrls);
  });

  test("PUT /pet - updates an existing pet", async ({
    apiClient,
  }, testInfo) => {
    const pet = createTestPet();
    await apiClient.createPet(pet);
    TestDataManager.registerCleanupCallback(testInfo.testId, async () => {
      await apiClient.deletePet(pet.id!);
    });

    const updated = await apiClient.updatePet({
      ...pet,
      name: `${pet.name}-updated`,
      status: "sold",
    });

    expect(updated.name).toBe(`${pet.name}-updated`);
    expect(updated.status).toBe("sold");
  });

  test("PATCH /pet/{id} - not supported by this API, returns 405 @critical", async ({
    apiClient,
  }, testInfo) => {
    const pet = createTestPet();
    await apiClient.createPet(pet);
    TestDataManager.registerCleanupCallback(testInfo.testId, async () => {
      await apiClient.deletePet(pet.id!);
    });

    // Petstore's spec only defines GET/POST/PUT/DELETE for /pet - PATCH is
    // deliberately expected to fail here so that contract is asserted rather
    // than silently assumed.
    const error = await apiClient
      .patchPet(pet.id!, { status: "sold" }, { maxAttempts: 1 })
      .catch((e) => e);

    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).statusCode).toBe(405);
  });

  test("DELETE /pet/{id} - deletes an existing pet", async ({ apiClient }) => {
    const pet = createTestPet();
    await apiClient.createPet(pet);

    const result = await apiClient.deletePet(pet.id!);

    expect(result.code).toBe(200);
  });

  test.describe("Error handling", () => {
    test("400 - malformed JSON payload returns Bad Request @critical", async ({
      apiClient,
    }) => {
      // A raw Buffer body bypasses object serialization and is sent as-is,
      // reproducing a malformed client payload. (A plain JS string here is
      // NOT equivalent - Playwright's fetch transport encodes bare strings
      // differently and the server maps that path to a 500 instead of 400.)
      const error = await apiClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately malformed payload for a negative test
        .createPet(Buffer.from("{not valid json", "utf-8") as any, {
          maxAttempts: 1,
        })
        .catch((e) => e);

      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(400);
    });

    test("404 - fetching a deleted pet returns Not Found @critical", async ({
      apiClient,
    }) => {
      const pet = createTestPet();
      await apiClient.createPet(pet);
      await apiClient.deletePet(pet.id!);

      const error = await apiClient
        .getPetById(pet.id!, { maxAttempts: 1 })
        .catch((e) => e);

      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(404);
    });

    test("500 - invalid field type returns Internal Server Error @critical", async ({
      apiClient,
    }) => {
      const error = await apiClient
        .createPet(
          // id typed as a string instead of the expected number - the demo
          // server's deserializer throws unhandled, surfacing as a 500.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately wrong type for a negative test
          { id: "not-a-number", name: "x", photoUrls: [] } as any,
          { maxAttempts: 1 },
        )
        .catch((e) => e);

      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(500);
    });
  });
});
