import { expect, test } from "@playwright/test";

test("can start a tournament run and play through a managed match", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Tournament Deployment" })).toBeVisible();

  await page.getByRole("button", { name: "Start Tournament" }).click();
  await expect(page.getByRole("button", { name: "Enter Match" })).toBeVisible();

  await page.getByRole("button", { name: "Enter Match" }).click();
  await expect(page.getByRole("button", { name: "Simulate Next Point" })).toBeVisible();

  for (let index = 0; index < 160; index += 1) {
    if (await page.getByRole("button", { name: "Advance Bracket" }).isVisible().catch(() => false)) {
      break;
    }

    if (await page.getByRole("button", { name: "Encourage" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Encourage" }).click();
    }

    if (await page.getByRole("button", { name: "Open Next Set" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Open Next Set" }).click();
    } else {
      await page.getByRole("button", { name: "Simulate Next Point" }).click();
    }
  }

  await expect(page.getByRole("button", { name: "Advance Bracket" })).toBeVisible();
  await page.getByRole("button", { name: "Advance Bracket" }).click();

  await expect(
    page.getByRole("button", { name: /Enter Match|Start New Session/ })
  ).toBeVisible();
});
