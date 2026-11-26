import { describe, expect, it } from "vitest";
import { addCalendarMonths, daysBetween, isValidIsoDate, todayInZone } from "./dates";

describe("todayInZone (Europe/Warsaw)", () => {
  it("23:30 UTC on 2026-11-25 is already 2026-11-26 in Warsaw", () => {
    expect(todayInZone(new Date("2026-11-25T23:30:00Z"), "Europe/Warsaw")).toBe("2026-11-26");
  });
  it("22:59 UTC on 2026-11-25 is still 2026-11-25 in Warsaw", () => {
    expect(todayInZone(new Date("2026-11-25T22:59:00Z"), "Europe/Warsaw")).toBe("2026-11-25");
  });
});

describe("daysBetween", () => {
  it("counts calendar days across the DST change", () => {
    expect(daysBetween("2026-10-20", "2026-11-05")).toBe(16);
  });
  it("same day is 0", () => {
    expect(daysBetween("2026-11-25", "2026-11-25")).toBe(0);
  });
});

describe("isValidIsoDate", () => {
  it("rejects impossible dates and accepts leap days", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2025-02-29")).toBe(false);
  });
});

describe("addCalendarMonths", () => {
  it("adds 24 months and clamps 29 Feb to the month end", () => {
    expect(addCalendarMonths("2024-11-25", 24)).toBe("2026-11-25");
    expect(addCalendarMonths("2024-02-29", 24)).toBe("2026-02-28");
  });
});
