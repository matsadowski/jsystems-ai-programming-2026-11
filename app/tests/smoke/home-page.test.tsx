// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("Home page (smoke)", () => {
  it("shows the application name and the empty case form", () => {
    render(<Home />);
    expect(screen.getByText("Hardware Service Decision Copilot")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Nowe zgłoszenie" })).toBeTruthy();
  });
});
