// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("renders the product name and no heading", () => {
    render(<AppHeader />);
    expect(screen.getByText("Hardware Service Decision Copilot")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("renders no image by default", () => {
    render(<AppHeader />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("renders the demo logo only when showDemoLogo is set", () => {
    const { container } = render(<AppHeader showDemoLogo />);
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("renders no button without onNewCase", () => {
    render(<AppHeader />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onNewCase when the button is clicked", async () => {
    const onNewCase = vi.fn();
    render(<AppHeader onNewCase={onNewCase} />);
    await userEvent.click(screen.getByRole("button", { name: "Nowe zgłoszenie" }));
    expect(onNewCase).toHaveBeenCalledTimes(1);
  });
});
