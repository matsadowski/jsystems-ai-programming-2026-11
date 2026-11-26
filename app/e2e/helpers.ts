import path from "node:path";
import { expect, type Page } from "@playwright/test";

const ZONE = "Europe/Warsaw";

export const DISCLAIMER =
  "Decyzja jest rekomendacją wygenerowaną przez AI na podstawie zdjęcia, danych zgłoszenia i regulaminu. Ostateczną decyzję podejmuje pracownik.";

export function image(name: string): string {
  return path.resolve(__dirname, "../../assets/example-images", name);
}

/** Today's calendar date in Europe/Warsaw as YYYY-MM-DD. */
export function todayWarsaw(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function isoOf(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

export function daysAgo(days: number): string {
  const [y, m, d] = todayWarsaw().split("-").map(Number);
  return isoOf(y, m, d - days);
}

export function monthsAgo(months: number): string {
  const [y, m, d] = todayWarsaw().split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return isoOf(target.getUTCFullYear(), target.getUTCMonth() + 1, Math.min(d, lastDay));
}

export function daysAhead(days: number): string {
  return daysAgo(-days);
}

export interface CaseData {
  type: "Zwrot" | "Reklamacja";
  category: string;
  model: string;
  purchaseDate: string;
  reason?: string;
  photo: string;
}

export async function fillCaseForm(page: Page, data: CaseData): Promise<void> {
  await page.getByRole("radio", { name: data.type }).check();
  await page.getByLabel("Kategoria sprzętu").selectOption({ label: data.category });
  await page.getByLabel("Nazwa / model").fill(data.model);
  await page.getByLabel("Data zakupu").fill(data.purchaseDate);
  if (data.reason !== undefined) await page.getByLabel(/Powód zgłoszenia/).fill(data.reason);
  await page.locator('input[type="file"]').setInputFiles(image(data.photo));
}

export const expiredReturn: CaseData = {
  type: "Zwrot",
  category: "Smartfon",
  model: "Samsung Galaxy S24",
  purchaseDate: "",
  photo: "phone-3.jpeg",
};

/** Opens `/`, submits an expired return (rules path, no model call) and waits for the chat. */
export async function reachChatViaExpiredReturn(page: Page): Promise<void> {
  await page.goto("/");
  await fillCaseForm(page, { ...expiredReturn, purchaseDate: daysAgo(30) });
  await page.getByRole("button", { name: "Przeanalizuj zgłoszenie" }).click();
  await expect(page.getByText("Zwrot odrzucony").first()).toBeVisible({ timeout: 60_000 });
}

export async function noHorizontalScroll(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}
