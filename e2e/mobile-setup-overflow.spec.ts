import { expect, test } from "@playwright/test";

test("mobile setup recommendation card keeps featured content within bounds", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();

  await expect(page.getByRole("button", { name: "Quick Tournament", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Career" })).toBeVisible();
  await page.getByRole("button", { name: "Quick Tournament", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start Tournament" })).toBeVisible();

  const featuredCard = page.getByLabel(/Featured recommendation:/);
  await featuredCard.scrollIntoViewIfNeeded();

  const metrics = await featuredCard.evaluate((card) => {
    const viewportWidth = window.innerWidth;
    const cardRect = card.getBoundingClientRect();
    const nameRect = card.querySelector(".recommendation-featured-name")?.getBoundingClientRect();
    const profileRect = card.querySelector(".profile-open-button")?.getBoundingClientRect();

    if (!nameRect || !profileRect) {
      throw new Error("Expected featured name and Open Profile action.");
    }

    return {
      viewportWidth,
      cardRight: cardRect.right,
      nameRight: nameRect.right,
      profileRight: profileRect.right,
      cardLeft: cardRect.left,
      nameLeft: nameRect.left,
      profileLeft: profileRect.left,
    };
  });

  expect(metrics.cardRight).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.nameRight).toBeLessThanOrEqual(metrics.cardRight);
  expect(metrics.profileRight).toBeLessThanOrEqual(metrics.cardRight);
  expect(metrics.nameLeft).toBeGreaterThanOrEqual(metrics.cardLeft);
  expect(metrics.profileLeft).toBeGreaterThanOrEqual(metrics.cardLeft);
});
