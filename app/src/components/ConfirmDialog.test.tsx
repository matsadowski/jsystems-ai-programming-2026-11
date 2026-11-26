// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

describe("ConfirmDialog", () => {
  it("shows the text and both buttons when open", () => {
    render(<ConfirmDialog open onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText("Bieżąca rozmowa zostanie utracona.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anuluj" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rozpocznij nowe" })).toBeInTheDocument();
  });

  it("Anuluj calls onCancel only", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog open onCancel={onCancel} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Rozpocznij nowe calls onConfirm", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open onCancel={vi.fn()} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Rozpocznij nowe" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Escape (dialog cancel event) acts as Anuluj", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(<ConfirmDialog open onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent(container.querySelector("dialog")!, new Event("cancel", { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("is not open when open is false", () => {
    const { container } = render(<ConfirmDialog open={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(container.querySelector("dialog")).not.toHaveAttribute("open");
  });
});

afterEach(cleanup);
