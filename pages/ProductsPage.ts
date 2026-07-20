import { Locator, Page, expect } from "@playwright/test";
import { TEST_DATA } from "../tests/data/test-data"; // Ensure this path matches your directory structure
import { BasePage } from "./BasePage";
import { logger } from "../utils/logger";
import { ElementInteractionError } from "../utils/errors";

export class ProductsPage extends BasePage {
  private readonly productCardContainer: Locator;
  private readonly cartCloseButton: Locator;

  // New Private Locators for Phase 2 Validation
  private readonly cartDrawer: Locator;
  private readonly cartItemRows: Locator;

  // Floating cart icon (top-right) and its live item-count badge
  private readonly cartIconWrapper: Locator;
  private readonly cartBadge: Locator;

  // Sidebar "N Product(s) found" label - re-renders asynchronously on filter changes
  private readonly productCountLabel: Locator;

  constructor(page: Page) {
    super(page);
    this.productCardContainer = page.locator(".sc-uhudcz-0.iZZGui > div");
    this.cartCloseButton = page.locator("button span").filter({ hasText: "X" });
    this.productCountLabel = page.getByText(/Product\(s\) found/);

    // Scoping selectors mapped to the application's unique layout classes
    this.cartDrawer = page.locator(".sc-1h98xa9-1.kQlqIC");
    this.cartItemRows = this.cartDrawer.locator(".sc-11uohgb-0");

    this.cartIconWrapper = page.locator(".sc-1h98xa9-2");
    this.cartBadge = this.cartIconWrapper.locator(".sc-1h98xa9-3");
  }

  async navigate(): Promise<void> {
    logger.info("Navigating to Products page");
    await this.goto("/");
  }

  async getCardsByPrice(price: number): Promise<Locator[]> {
    const priceSelector = `p:text("${TEST_DATA.currencySymbol}${price.toFixed(2)}")`;
    const matchedCards = this.productCardContainer.filter({
      has: this.page.locator(priceSelector),
    });

    await expect(matchedCards.first()).toBeVisible();
    return await matchedCards.all();
  }

  async getProductName(card: Locator): Promise<string> {
    const nameText = await card.locator("p").first().textContent();
    if (!nameText) {
      throw new ElementInteractionError(
        "Product title element parsing failed",
        card.toString(),
        "textContent",
      );
    }
    return nameText.trim();
  }

  /**
   * Returns every rendered product card in the catalog grid.
   */
  async getAllProductCards(): Promise<Locator[]> {
    await expect(this.productCardContainer.first()).toBeVisible();
    return await this.productCardContainer.all();
  }

  /**
   * Parses a card's displayed price (e.g. "$10.90") into a float.
   */
  async getProductPrice(card: Locator): Promise<number> {
    const priceLocator = card
      .locator("p")
      .filter({ hasText: TEST_DATA.currencySymbol });
    const priceText = await priceLocator.first().textContent();
    if (!priceText) {
      throw new ElementInteractionError(
        "Product price element parsing failed",
        card.toString(),
        "textContent",
      );
    }
    return parseFloat(priceText.replace(/[^0-9.]/g, ""));
  }

  async addCardToCart(card: Locator): Promise<void> {
    logger.debug("Adding product card to cart");
    await this.click(card.getByRole("button", { name: "Add to cart" }));
  }

  // --- New Methods added to clear the TypeScript errors ---

  /**
   * Opens the cart drawer overlay by clicking the floating bag icon
   */
  async openCartDrawer(): Promise<void> {
    // Target the floating cart bag icon in the upper-right corner
    await this.cartIconWrapper.click();
    await expect(this.cartDrawer).toBeVisible();
  }

  /**
   * Reads the live item-count badge on the floating cart icon.
   */
  async getCartBadgeCount(): Promise<number> {
    const badgeText = await this.cartBadge.textContent();
    if (!badgeText) {
      throw new ElementInteractionError(
        "Cart badge count element parsing failed",
        this.cartBadge.toString(),
        "textContent",
      );
    }
    return parseInt(badgeText.trim(), 10);
  }

  /**
   * Removes a single item from the cart via its row's "remove" control.
   */
  async removeCartItem(itemRow: Locator): Promise<void> {
    logger.debug("Removing item from cart");
    await this.click(
      itemRow.locator('button[title="remove product from cart"]'),
    );
  }

  async closeCartDrawer(): Promise<void> {
    await expect(this.cartDrawer).toBeVisible();
    await this.cartCloseButton.click();
    await expect(this.cartDrawer).toBeHidden();
  }

  /**
   * Scopes inside the checkout drawer and returns all layout row components
   */
  async getCartItems(): Promise<Locator[]> {
    return await this.cartItemRows.all();
  }

  /**
   * Parses title text strings and sanitizes raw price tokens into float values
   */
  async getCartItemDetails(
    itemRow: Locator,
  ): Promise<{ name: string; price: number }> {
    const title = await itemRow.locator(".sc-11uohgb-2").textContent();
    const priceRaw = await itemRow.locator(".sc-11uohgb-4 p").textContent();

    if (!title || !priceRaw) {
      throw new ElementInteractionError(
        "Failed to parse cart item details",
        itemRow.toString(),
        "textContent",
      );
    }

    // Type-safe conversion: Strips characters like "$ " out to safely parse numbers
    const price = parseFloat(priceRaw.replace(/[^0-9.]/g, ""));
    return { name: title.trim(), price };
  }

  /**
   * Helper locator strategy used to execute web-first structural checks by name
   */
  getCartItemByName(name: string): Locator {
    return this.cartItemRows.filter({ hasText: name });
  }

  /**
   * The "N Product(s) found" label. Exposed so callers can assert on it
   * with a web-first assertion after filtering - the grid re-renders
   * asynchronously, so reading getAllProductCards() immediately after a
   * filter action can race a stale DOM snapshot.
   */
  getProductCountLabel(): Locator {
    return this.productCountLabel;
  }

  /**
   * Checks a size checkbox in the sidebar filter, narrowing the visible
   * product grid to items available in that size.
   */
  async filterBySize(size: string): Promise<void> {
    logger.debug("Filtering products by size", { size });
    const checkbox = this.page.getByRole("checkbox", { name: size, exact: true });
    await this.waitForVisible(checkbox);
    // The checkbox itself is visually hidden behind a styled label/checkmark,
    // so a plain click intercepts on some browsers (notably Firefox) - force
    // the state change directly on the input.
    await checkbox.check({ force: true });
  }
}
