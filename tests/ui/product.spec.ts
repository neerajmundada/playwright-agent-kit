import { test, expect } from "../../fixtures/base.fixture";
import { TEST_DATA } from "../data/test-data";

test.describe("Product Catalog Management", () => {
  test("Should add items to the cart matching specific target price criteria @test @smoke @cart", async ({
    productsPage,
    telemetry,
  }) => {
    const addedProducts = new Map<string, number>();

    await productsPage.navigate();

    const targetCards = await productsPage.getCardsByPrice(
      TEST_DATA.targetPrice,
    );

    for (const currentCard of targetCards) {
      const productName = await productsPage.getProductName(currentCard);
      addedProducts.set(productName, TEST_DATA.targetPrice);

      await telemetry.attachElementSnapshot(
        currentCard,
        `product-${productName.replace(/\s+/g, "-").toLowerCase()}`,
      );

      await test.step(`Add item to cart: "${productName}"`, async () => {
        await productsPage.addCardToCart(currentCard);
        await productsPage.closeCartDrawer();
      });
    }

    expect(addedProducts.size).toBeGreaterThan(0);

    // --- PHASE 2: Verification & Reconciliation Phase ---
    // This block will now compile cleanly with no TS errors!
    await test.step("Validate Cart Item Integrity", async () => {
      await productsPage.openCartDrawer();

      for (const productName of addedProducts.keys()) {
        const specificCartRow = productsPage.getCartItemByName(productName);
        await expect(specificCartRow).toBeVisible();
      }

      const currentCartItems = await productsPage.getCartItems();
      expect(currentCartItems.length).toBe(addedProducts.size);

      for (const itemRow of currentCartItems) {
        await itemRow.evaluate((el) =>
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
          }),
        );
        const item = await productsPage.getCartItemDetails(itemRow);

        await telemetry.attachElementSnapshot(
          itemRow,
          `cart-item-${item.name.replace(/\s+/g, "-").toLowerCase()}`,
        );

        expect(addedProducts.has(item.name)).toBe(true);
        expect(item.price).toBe(addedProducts.get(item.name));
      }
    });
  });

  test("Should render the product catalog with a valid name and price for every listed product @smoke @catalog", async ({
    productsPage,
  }) => {
    await productsPage.navigate();

    const allCards = await productsPage.getAllProductCards();
    expect(allCards.length).toBeGreaterThan(0);

    for (const card of allCards) {
      const name = await productsPage.getProductName(card);
      const price = await productsPage.getProductPrice(card);

      expect(name.length).toBeGreaterThan(0);
      expect(price).toBeGreaterThan(0);
    }
  });

  test("Should update the cart badge count when an item is added then removed @critical @cart", async ({
    productsPage,
  }) => {
    await productsPage.navigate();

    const [firstCard] = await productsPage.getAllProductCards();
    const productName = await productsPage.getProductName(firstCard);

    await test.step(`Add item to cart: "${productName}"`, async () => {
      await productsPage.addCardToCart(firstCard);
    });

    expect(await productsPage.getCartBadgeCount()).toBe(1);

    await test.step(`Remove item from cart: "${productName}"`, async () => {
      const cartRow = productsPage.getCartItemByName(productName);
      await productsPage.removeCartItem(cartRow);
    });

    expect(await productsPage.getCartBadgeCount()).toBe(0);
    expect((await productsPage.getCartItems()).length).toBe(0);
  });
});
