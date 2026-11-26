import { expect, test } from "@playwright/test";
import { COMPLAINT_LABELS, LLM_STEP_TIMEOUT, daysAgo, fillCaseForm, sendChatMessage } from "./helpers";

test.describe("LLM complaint flow (real model)", () => {
  test.skip(process.env.E2E_REAL_LLM !== "1", "needs the real model");
  test.setTimeout(300_000);

  test("complaint: decision label set, then a decision change on new facts (AC-22..26)", async ({ page }) => {
    await page.goto("/");
    await fillCaseForm(page, {
      type: "Reklamacja",
      category: "Laptop",
      model: "Lenovo ThinkPad T14",
      purchaseDate: daysAgo(60),
      reason: "Laptop przestał się ładować, dioda zasilania nie świeci.",
      photo: "laptop-2.webp",
    });
    await page.getByRole("button", { name: "Przeanalizuj zgłoszenie" }).click();

    const panel = page.getByRole("region", { name: "Podsumowanie zgłoszenia" }).first();
    await expect(panel).toBeVisible({ timeout: 2 * LLM_STEP_TIMEOUT });
    const labelRe = new RegExp(`^(${COMPLAINT_LABELS.join("|")})$`);
    const badge = panel.getByText(labelRe).first();
    await expect(badge).toBeVisible();
    const before = (await badge.innerText()).trim();

    const log = page.getByRole("log", { name: "Rozmowa" });
    await expect(log).toContainText(/C\d/, { timeout: LLM_STEP_TIMEOUT });

    await sendChatMessage(page, "Klient przyznał, że laptop został zalany kawą tydzień przed wystąpieniem usterki.");
    await expect(page.getByText("Asystent pisze…")).toBeHidden({ timeout: LLM_STEP_TIMEOUT });
    await expect(log).toContainText("zalany kawą");

    const notice = log.getByText(/Decyzja zmieniona:/);
    if (before === "Reklamacja odrzucona") {
      // Already rejected: no change may be announced and the badge stays.
      await expect(notice).toHaveCount(0);
      await expect(panel.getByText("Reklamacja odrzucona", { exact: true }).first()).toBeVisible();
    } else {
      await expect(notice.first()).toBeVisible({ timeout: LLM_STEP_TIMEOUT });
      await expect(panel.getByText("Reklamacja odrzucona", { exact: true }).first()).toBeVisible();
    }
  });
});
