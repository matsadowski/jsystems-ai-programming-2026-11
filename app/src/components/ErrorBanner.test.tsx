// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBanner } from "./ErrorBanner";

afterEach(cleanup);

describe("ErrorBanner", () => {
  it("shows the message as an alert", () => {
    render(<ErrorBanner message="Nie udało się przygotować decyzji. Spróbuj ponownie." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Nie udało się przygotować decyzji. Spróbuj ponownie.");
  });

  it("calls onRetry from the Spróbuj ponownie button", async () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="x" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders no button without onRetry and disables it when disabled", () => {
    const { rerender } = render(<ErrorBanner message="x" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<ErrorBanner message="x" onRetry={() => {}} disabled />);
    expect(screen.getByRole("button", { name: "Spróbuj ponownie" })).toBeDisabled();
  });
});
