import { expect, test } from "@playwright/test";

test("mobile: bottom navigation, scan entry and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByLabel("E-pošta").fill("demo@rentora.test");
  await page.getByLabel("Geslo").fill("demo-geslo-2026");
  await page.getByRole("button", { name: "Prijava" }).click();
  await page.waitForURL("**/app");
  const nav = page.getByRole("navigation", { name: "Glavna navigacija" }).last();
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Skeniraj" }).click();
  await page.waitForURL("**/app/scan");
  await page.getByLabel("Inventarna ali serijska številka").fill("kld-001");
  await page.getByRole("button", { name: "Odpri" }).click();
  await page.waitForURL(/\/app\/units\/[0-9a-f-]{36}\?scan=1/);
  await expect(page.getByText("KLD-001").first()).toBeVisible();
  // touch targets in bottom nav are at least 44px tall
  const box = await nav.getByRole("link", { name: "Koledar" }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  // no horizontal page overflow
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
