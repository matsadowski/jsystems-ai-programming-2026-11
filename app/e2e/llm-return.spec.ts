import { expect, test } from "@playwright/test";
import { DISCLAIMER, LLM_STEP_TIMEOUT, RETURN_LABELS, daysAgo, fillCaseForm, needsRealModel, sendChatMessage } from "./helpers";

test.describe("LLM return flow (real model)", () => {
  test.skip(process.env.E2E_REAL_LLM !== "1", "needs the real model");
  test.setTimeout(300_000);

  test("return with a photo: stages, decision invariants, follow-up (AC-13..19, AC-27..29)", async ({ page }) => {
    needsRealModel(test);
    const purchase = daysAgo(3);
    await page.goto("/");
    await fillCaseForm(page, {
      type: "Zwrot",
      category: "Smartfon",
      model: "Samsung Galaxy S24",
      purchaseDate: purchase,
      photo: "phone-1.jpg",
    });
    await page.getByRole("button", { name: "Przeanalizuj zgłoszenie" }).click();

    const status = page.getByRole("status");
    await expect(status).toContainText("Analizuję zdjęcie…", { timeout: 30_000 });
    await expect(status).toContainText("Przygotowuję decyzję…", { timeout: LLM_STEP_TIMEOUT });

    const chat = page.getByRole("region", { name: "Czat" });
    await expect(chat).toBeVisible({ timeout: LLM_STEP_TIMEOUT });
    const panel = page.getByRole("region", { name: "Podsumowanie zgłoszenia" }).first();
    await expect(panel).toBeVisible({ timeout: LLM_STEP_TIMEOUT });

    const badge = panel.getByText(new RegExp(`^(${RETURN_LABELS.join("|")})$`)).first();
    await expect(badge).toBeVisible();
    await expect(panel.getByText("Pełna analiza AI", { exact: true })).toBeVisible();
    const description = panel.getByRole("heading", { name: "Opis zdjęcia (AI)" }).locator("xpath=following-sibling::p[1]");
    await expect(description).toBeVisible();
    expect((await description.innerText()).trim().length).toBeGreaterThan(0);

    const log = page.getByRole("log", { name: "Rozmowa" });
    await expect(log).toContainText("Uzasadnienie", { timeout: LLM_STEP_TIMEOUT });
    await expect(log).toContainText("Kolejne kroki");
    await expect(log).toContainText(/R\d/);
    await expect(log).toContainText(DISCLAIMER);

    // Follow-up question (AC-27..29).
    const agentMessagesBefore = await log.getByText("Asystent pisze…").count();
    expect(agentMessagesBefore).toBe(0);
    const [y, m, d] = purchase.split("-");
    const months = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
    const dateRegex = new RegExp(
      [`${d}\\.${m}\\.${y}`, `${Number(d)}\\.${Number(m)}\\.${y}`, `${y}-${m}-${d}`, `${Number(d)} ${months[Number(m) - 1]} ${y}`, "3 dni", "trzy dni", "3 dni temu"].join("|"),
    );
    const textBefore = await log.innerText();
    await sendChatMessage(page, "Jaka jest data zakupu?");
    await expect(page.getByText("Asystent pisze…")).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Wiadomość").fill("x");
    await expect(page.getByRole("button", { name: "Wyślij" })).toBeDisabled();
    await page.getByLabel("Wiadomość").fill("");

    await expect(page.getByText("Asystent pisze…")).toBeHidden({ timeout: LLM_STEP_TIMEOUT });
    const textAfter = await log.innerText();
    const reply = textAfter.slice(textBefore.length);
    expect(reply.length, "an agent reply appeared").toBeGreaterThan(20);
    expect(textAfter.slice(textAfter.indexOf("Jaka jest data zakupu?") + 22)).toMatch(dateRegex);
  });
});
