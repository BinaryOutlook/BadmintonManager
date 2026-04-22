import { expect, test } from "@playwright/test";

test("can start a tournament run and play through a managed match", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Badminton Manager" })).toBeVisible();

  await page.getByRole("button", { name: "Start tournament run" }).click();
  await expect(page.getByRole("button", { name: "Start managed match" })).toBeVisible();

  await page.getByRole("button", { name: "Start managed match" }).click();
  await expect(page.getByRole("button", { name: "Simulate next set" })).toBeVisible();

  for (let index = 0; index < 3; index += 1) {
    if (await page.getByRole("button", { name: "Advance bracket" }).isVisible().catch(() => false)) {
      break;
    }

    if (await page.getByRole("button", { name: "Encourage" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Encourage" }).click();
    }

    await page.getByRole("button", { name: "Simulate next set" }).click();
  }

  await expect(page.getByRole("button", { name: "Advance bracket" })).toBeVisible();
  await page.getByRole("button", { name: "Advance bracket" }).click();

  await expect(
    page.getByRole("button", { name: /Start managed match|Start new run/ })
  ).toBeVisible();
});
