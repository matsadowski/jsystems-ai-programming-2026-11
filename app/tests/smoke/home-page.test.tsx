// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("Home page (smoke)", () => {
  it("shows the application name", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "Hardware Service Decision Copilot" }),
    ).toBeTruthy();
  });
});
