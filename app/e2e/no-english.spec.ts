import { expect, test } from "@playwright/test";
import { LLM_STEP_TIMEOUT, daysAgo, fillCaseForm, sendChatMessage } from "./helpers";

const ENUM_CONSTANTS = ["NEEDS_MANUAL_REVIEW", "ACCEPT", "REJECT", "REPAIR", "REPLACE", "REFUND", "LLM_ONLY", "LLM_ESCALATED"];

test.describe("no English on the LLM chat screen (real model)", () => {
  test.skip(process.env.E2E_REAL_LLM !== "1", "needs the real model");
  test.setTimeout(300_000);

  test("chat screen after a model reply shows no enum constants (AC-37)", async ({ page }) => {
    await page.goto("/");
    await fillCaseForm(page, {
      type: "Zwrot",
      category: "Smartfon",
      model: "Samsung Galaxy S24",
      purchaseDate: daysAgo(3),
      photo: "phone-1.jpg",
    });
    await page.getByRole("button", { name: "Przeanalizuj zgłoszenie" }).click();
    const log = page.getByRole("log", { name: "Rozmowa" });
    await expect(log).toContainText("Uzasadnienie", { timeout: 2 * LLM_STEP_TIMEOUT });
    await sendChatMessage(page, "Jaka jest data zakupu?");
    await expect(page.getByText("Asystent pisze…")).toBeHidden({ timeout: LLM_STEP_TIMEOUT });

    const text = await page.locator("body").innerText();
    for (const c of ENUM_CONSTANTS) {
      expect(text, `enum constant ${c}`).not.toMatch(new RegExp(`\\b${c}\\b`));
    }
    for (const w of ["Submit", "Loading", "Error", "Send", "Cancel", "Upload"]) {
      expect(text, `English word ${w}`).not.toMatch(new RegExp(`\\b${w}\\b`));
    }
  });
});
