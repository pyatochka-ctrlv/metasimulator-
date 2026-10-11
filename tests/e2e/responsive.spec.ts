import { expect, test } from "@playwright/test";

for (const path of ["/dashboard", "/ads-manager", "/analytics", "/missions", "/knowledge"]) {
  test(`no horizontal page overflow on mobile: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("mobile navigation opens from the menu button", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Відкрити меню" }).click();
  await page.getByRole("link", { name: "Knowledge Base" }).click();
  await expect(page).toHaveURL(/\/knowledge/);
});
