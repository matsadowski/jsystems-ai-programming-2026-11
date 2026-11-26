import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

describe("contrastRatio", () => {
  it("returns 21 for black on white and 1 for identical colors", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#79003C", "#79003C")).toBeCloseTo(1, 5);
  });

  it("is symmetric and accepts short hex and lowercase", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#79003C", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "#79003C"), 10);
  });

  it("rejects invalid colors", () => {
    expect(() => contrastRatio("red", "#FFFFFF")).toThrow();
  });

  const pairs: Array<[string, string, string]> = [
    ["status positive on tint", "#1E6B34", "#E6F4EA"],
    ["status negative on tint", "#A1192B", "#FCE8EA"],
    ["status warning on tint", "#7A4B00", "#FFF4D6"],
    ["brand primary on white", "#79003C", "#FFFFFF"],
    ["white on brand primary", "#FFFFFF", "#79003C"],
    ["muted text on light background", "#5E5E6E", "#F7F7F8"],
  ];
  it.each(pairs)("%s is at least 4.5:1", (_name, a, b) => {
    expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(4.5);
  });
});
