import { expect, test, type Page } from "@playwright/test";

const uid = Date.now().toString(36);
const email = `e2e-${uid}@test.rentora.local`;
const password = "e2e-geslo-dolgo-1";

async function signupAndOnboard(page: Page) {
  await page.goto("/signup");
  await page.getByLabel("Ime in priimek").fill("Eva Testna");
  await page.getByLabel("Službena e-pošta").fill(email);
  await page.getByLabel("Geslo").fill(password);
  await page.getByText("Strinjam se s pogoji").click();
  await page.getByRole("button", { name: "Ustvari račun" }).click();
  await page.waitForURL("**/app/onboarding");
  await page.getByLabel("Ime izposojevalnice").fill(`E2E Najem ${uid}`);
  await page.getByLabel("Kraj").fill("Maribor");
  await page.getByRole("button", { name: "Ustvari izposojevalnico" }).click();
  await page.waitForURL("**/app?welcome=1");
}

test.describe.configure({ mode: "serial" });

test("rental business: onboarding → inventory → customer → reservation → lifecycle", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await signupAndOnboard(page);
  await expect(page.getByRole("heading", { name: /Dobrodošli v RENTORA, Eva/ })).toBeVisible();
  await expect(page.getByText("Začetna nastavitev")).toBeVisible();

  // Inventory: one listing, three identical physical units
  await page.goto("/app/inventory/new");
  await page.getByLabel("Naziv artikla").fill("Vrtalno kladivo Hilti TE 30");
  await page.getByLabel("Na dan (€)").fill("29,50");
  await page.getByLabel("Na teden (€)").fill("150");
  await page.getByLabel("Varščina (€)").fill("100");
  await page.getByLabel("Število enot").fill("3");
  await page.getByLabel("Predpona inventarne številke").fill("HLT");
  await page.getByRole("button", { name: "Dodaj artikel" }).click();
  await page.waitForURL(/\/app\/inventory\/[0-9a-f-]{36}\?created=1/);
  for (const code of ["HLT-001", "HLT-002", "HLT-003"]) await expect(page.getByText(code, { exact: true })).toBeVisible();

  // Validation: invalid price is rejected with a field error
  await page.goto("/app/inventory/new");
  await page.getByLabel("Naziv artikla").fill("Napačna cena");
  await page.getByLabel("Na dan (€)").fill("abc");
  await page.getByRole("button", { name: "Dodaj artikel" }).click();
  await expect(page.getByText("Vnesite dnevno ceno")).toBeVisible();

  // Customer
  await page.goto("/app/customers/new");
  await page.getByLabel("Ime in priimek").fill("Gregor Testni");
  await page.getByLabel("Telefon").fill("041 123 456");
  await page.getByRole("button", { name: "Dodaj stranko" }).click();
  await page.waitForURL(/\/app\/customers\/[0-9a-f-]{36}/);

  // Reservation for 3 units with live availability
  await page.getByRole("link", { name: "Nova rezervacija" }).first().click();
  await page.waitForURL(/reservations\/new/);
  await page.getByLabel("Prevzem").fill("2030-03-02T08:00");
  await page.getByLabel("Vračilo").fill("2030-03-05T08:00");
  await page.locator("#add-item").selectOption({ label: "Vrtalno kladivo Hilti TE 30" });
  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(page.getByText("Prosto 3 od 3")).toBeVisible();
  await page.getByLabel("Količina").fill("3");
  await expect(page.getByText("88,50 €").first()).toBeVisible(); // 3 days × 29,50 per unit
  await page.getByRole("button", { name: "Ustvari rezervacijo" }).click();
  await page.waitForURL(/\/app\/reservations\/[0-9a-f-]{36}\?created=1/);
  await expect(page.getByText("265,50 €").first()).toBeVisible();
  const reservationUrl = page.url().split("?")[0];

  // Overlapping booking must be refused by the server even if the client is bypassed
  await page.goto("/app/reservations/new");
  await page.locator("#f-customerId").selectOption({ label: "Gregor Testni" });
  await page.getByLabel("Prevzem").fill("2030-03-03T08:00");
  await page.getByLabel("Vračilo").fill("2030-03-04T08:00");
  await page.locator("#add-item").selectOption({ label: "Vrtalno kladivo Hilti TE 30" });
  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(page.getByText("Prosto 0 od 3")).toBeVisible();
  await page.getByRole("button", { name: "Ustvari rezervacijo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "na voljo je 0 od 1" })).toBeVisible();

  // Lifecycle: hand over → inspection → complete
  await page.goto(reservationUrl);
  await page.getByRole("button", { name: "Predaj opremo" }).click();
  await expect(page.getByText("V najemu").first()).toBeVisible();
  await page.getByRole("button", { name: "Sprejmi vračilo v pregled" }).click();
  await page.getByRole("button", { name: "Zaključi najem" }).click();
  await expect(page.getByText("Zaključena").first()).toBeVisible();
  await expect(page.getByText("Rezervacija je zaključena")).toBeVisible();

  // Calendar renders unit rows
  await page.goto("/app/calendar?days=7&from=2030-03-01");
  await expect(page.getByRole("link", { name: "HLT-001" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("tenant isolation through the UI: another business cannot open foreign records", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("E-pošta").fill(email);
  await page.getByLabel("Geslo").fill(password);
  await page.getByRole("button", { name: "Prijava" }).click();
  await page.waitForURL("**/app");
  await page.goto("/app/inventory");
  const href = await page.getByRole("link", { name: "Vrtalno kladivo Hilti TE 30" }).getAttribute("href");
  await ctx.close();

  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto("/signup");
  await p2.getByLabel("Ime in priimek").fill("Tuja Oseba");
  await p2.getByLabel("Službena e-pošta").fill(`other-${uid}@test.rentora.local`);
  await p2.getByLabel("Geslo").fill(password);
  await p2.getByText("Strinjam se s pogoji").click();
  await p2.getByRole("button", { name: "Ustvari račun" }).click();
  await p2.waitForURL("**/app/onboarding");
  await p2.getByLabel("Ime izposojevalnice").fill(`Tuji najem ${uid}`);
  await p2.getByRole("button", { name: "Ustvari izposojevalnico" }).click();
  await p2.waitForURL("**/app?welcome=1");
  const res = await p2.goto(href!);
  expect(res?.status()).toBe(404);
  await other.close();
});

test("unauthenticated access is redirected and login errors are explicit", async ({ page }) => {
  await page.goto("/app/reservations");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Freservations/);
  await page.getByLabel("E-pošta").fill(email);
  await page.getByLabel("Geslo").fill("napacno-geslo");
  await page.getByRole("button", { name: "Prijava" }).click();
  await expect(page.getByRole("alert")).toHaveText("E-pošta ali geslo ni pravilno.");
});
