import { test, expect } from "../../../fixtures/base.fixture";

test.describe("Product Catalog Filtering", () => {
  test("Should narrow the visible product list when filtering by size @smoke @catalog @experiment", async ({
    productsPage,
  }) => {
    await productsPage.navigate();

    const initialCards = await productsPage.getAllProductCards();
    expect(initialCards.length).toBeGreaterThan(1);

    await test.step("Filter by size M", async () => {
      await productsPage.filterBySize("M");
      await expect(productsPage.getProductCountLabel()).toHaveText(
        "1 Product(s) found",
      );
    });

    const filteredCards = await productsPage.getAllProductCards();
    expect(filteredCards.length).toBeLessThan(initialCards.length);

    const remainingNames = await Promise.all(
      filteredCards.map((card) => productsPage.getProductName(card)),
    );
    expect(remainingNames).toContain("Black Tule Oversized");
  });
});
