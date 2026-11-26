import { expect, test } from "@playwright/test";
import { DISCLAIMER, daysAgo, expiredReturn, fillCaseForm } from "./helpers";

test("expired return is rejected by the rules path (AC-20, AC-24, AC-40)", async ({ page }) => {
  // Record processing-stage labels as they appear (observation only, nothing is intercepted).
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __stages: string[] }).__stages = seen;
    const scan = () => {
      const text = document.body?.innerText ?? "";
      for (const label of ["Analizuję zdjęcie…", "Przygotowuję decyzję…"]) {
        if (text.includes(label) && !seen.includes(label)) seen.push(label);
      }
    };
    new MutationObserver(scan).observe(document, { childList: true, subtree: true, characterData: true });
  });

  await page.goto("/");
  await page.screenshot({ path: "test-results/expired-return-1-form.png", fullPage: true });
  await fillCaseForm(page, { ...expiredReturn, purchaseDate: daysAgo(30) });
  await page.screenshot({ path: "test-results/expired-return-2-filled.png", fullPage: true });

  const submit = page.getByRole("button", { name: "Przeanalizuj zgłoszenie" });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText("Zwrot odrzucony").first()).toBeVisible({ timeout: 60_000 });
  const stages = await page.evaluate(() => (window as unknown as { __stages: string[] }).__stages);
  expect(stages).toContain("Analizuję zdjęcie…");
  expect(stages.indexOf("Analizuję zdjęcie…")).toBeLessThan(
    stages.includes("Przygotowuję decyzję…") ? stages.indexOf("Przygotowuję decyzję…") : Infinity,
  );
  await page.screenshot({ path: "test-results/expired-return-3-chat.png", fullPage: true });

  const chat = page.getByRole("region", { name: "Czat" });
  await expect(chat).toContainText("R1.3");
  await expect(chat).toContainText("Uzasadnienie");
  await expect(chat).toContainText("Kolejne kroki");
  await expect(chat).toContainText(DISCLAIMER);
  await expect(page.getByText("Reguła terminu").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Podsumowanie zgłoszenia" })).toBeVisible();
});
