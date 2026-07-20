import { test, expect } from "../../../fixtures/base.fixture";

test.describe("Product Cart Management", () => {
  test("Should show the added product in the cart badge and drawer @smoke @cart @experiment", async ({
    productsPage,
  }) => {
    await productsPage.navigate();

    const [firstCard] = await productsPage.getAllProductCards();
    const productName = await productsPage.getProductName(firstCard);

    await test.step(`Add item to cart: "${productName}"`, async () => {
      await productsPage.addCardToCart(firstCard);
    });

    expect(await productsPage.getCartBadgeCount()).toBe(1);
    await expect(productsPage.getCartItemByName(productName)).toBeVisible();
  });
});
