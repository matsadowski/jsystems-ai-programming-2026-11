// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProcessingPanel } from "./ProcessingPanel";

afterEach(cleanup);

describe("ProcessingPanel", () => {
  it("stage 1 announces the photo analysis politely and marks stage 2 as pending", () => {
    render(<ProcessingPanel stage={1} />);
    const live = screen.getByRole("status");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveTextContent("Analizuję zdjęcie…");
    const steps = within(screen.getByRole("list"));
    expect(steps.getByText("Analizuję zdjęcie…").closest("li")).toHaveAttribute("aria-current", "step");
    expect(steps.getByText("Przygotowuję decyzję…").closest("li")).not.toHaveAttribute("aria-current");
    expect(screen.queryByText("(ukończono)")).not.toBeInTheDocument();
  });

  it("stage 2 marks stage 1 as done with a check mark and makes stage 2 current", () => {
    render(<ProcessingPanel stage={2} />);
    const steps = within(screen.getByRole("list"));
    expect(steps.getByText("Analizuję zdjęcie…").closest("li")).toHaveTextContent("(ukończono)");
    expect(steps.getByText("Przygotowuję decyzję…").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("status")).toHaveTextContent("Przygotowuję decyzję…");
  });

  it("keeps the live region content to the current stage only", () => {
    render(<ProcessingPanel stage={1} />);
    expect(screen.getByRole("status")).not.toHaveTextContent("Przygotowuję decyzję…");
  });
});
