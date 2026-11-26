import { describe, expect, it } from "vitest";
import { captureLogs } from "../helpers/log-capture";
import { fixedClock } from "../helpers/clock";
import { exampleImage, exampleImageNames } from "../helpers/example-images";

describe("log capture helper (TAC-001-05)", () => {
  it("collects console output as strings and restores console", () => {
    const original = console.error;
    const logs = captureLogs();
    console.info("hello", { a: 1 });
    console.error("boom");
    logs.restore();
    expect(console.error).toBe(original);
    expect(logs.lines).toEqual(['hello {"a":1}', "boom"]);
    expect(logs.text()).toContain("boom");
  });
});

describe("injectable clock", () => {
  it("returns the fixed instant and can advance", () => {
    const clock = fixedClock("2026-11-25T10:00:00Z");
    expect(clock.now().toISOString()).toBe("2026-11-25T10:00:00.000Z");
    clock.advanceMinutes(121);
    expect(clock.now().toISOString()).toBe("2026-11-25T12:01:00.000Z");
  });
});

describe("example images (read from ../assets, never copied)", () => {
  it("lists the five real example photos", () => {
    expect(exampleImageNames()).toEqual([
      "laptop-1.png",
      "laptop-2.webp",
      "phone-1.jpg",
      "phone-2.jpeg",
      "phone-3.jpeg",
    ]);
  });

  it("loads the bytes of a photo", () => {
    const bytes = exampleImage("phone-1.jpg");
    expect(bytes.length).toBe(106565);
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });
});
