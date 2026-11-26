import { expect, test } from "@playwright/test";
import { daysAhead, image } from "./helpers";

test("client validation blocks submission and sends no request to /api/cases", async ({ page }) => {
  const caseRequests: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/cases")) caseRequests.push(r.url());
  });

  await page.goto("/");
  const submit = page.getByRole("button", { name: "Przeanalizuj zgłoszenie" });
  await expect(submit).toBeDisabled();

  // Future date: the native max is not enforced when typing programmatically, the schema is.
  const date = page.getByLabel("Data zakupu");
  await date.fill(daysAhead(3));
  await date.blur();
  await expect(page.getByText("Data zakupu nie może być z przyszłości")).toBeVisible();

  // Complaint with a 5-character reason.
  await page.getByRole("radio", { name: "Reklamacja" }).check();
  await page.getByLabel("Kategoria sprzętu").selectOption({ label: "Laptop" });
  await page.getByLabel("Nazwa / model").fill("Lenovo ThinkPad T14");
  await page.locator('input[type="file"]').setInputFiles(image("laptop-1.png"));
  const reason = page.getByLabel(/Powód zgłoszenia/);
  await reason.fill("Zepsu");
  await reason.blur();
  const reasonError = page.locator("#" + (await reason.getAttribute("aria-describedby"))?.split(" ").pop());
  await expect(reasonError).toBeVisible();
  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(submit).toBeDisabled();

  await page.waitForTimeout(500);
  expect(caseRequests).toEqual([]);
});
