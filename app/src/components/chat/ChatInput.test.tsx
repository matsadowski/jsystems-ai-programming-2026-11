// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatInput } from "./ChatInput";

const box = () => screen.getByRole("textbox");
const send = () => screen.getByRole("button", { name: "Wyślij" });

describe("ChatInput", () => {
  it("sends on Enter and clears the field", async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    await userEvent.type(box(), "Cześć{Enter}");
    expect(onSend).toHaveBeenCalledWith("Cześć");
    expect(box()).toHaveValue("");
  });

  it("inserts a newline on Shift+Enter without sending", async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    await userEvent.type(box(), "a{Shift>}{Enter}{/Shift}b");
    expect(onSend).not.toHaveBeenCalled();
    expect(box()).toHaveValue("a\nb");
  });

  it("blocks empty and whitespace-only messages", async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    expect(send()).toBeDisabled();
    await userEvent.type(box(), "   {Enter}");
    expect(onSend).not.toHaveBeenCalled();
    expect(send()).toBeDisabled();
  });

  it("blocks 2001 characters with a visible message, allows 2000 (AC-32)", async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    await userEvent.click(box());
    await userEvent.paste("a".repeat(2001));
    expect(screen.getByText(/maksymalnie 2000 znaków/)).toBeInTheDocument();
    expect(send()).toBeDisabled();
    await userEvent.keyboard("{Enter}");
    expect(onSend).not.toHaveBeenCalled();
    await userEvent.keyboard("{Backspace}");
    expect(send()).toBeEnabled();
  });

  it("shows the counter from 1800 characters only", async () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />);
    await userEvent.click(box());
    await userEvent.paste("a".repeat(1799));
    expect(screen.queryByText("1799/2000")).not.toBeInTheDocument();
    await userEvent.keyboard("a");
    expect(screen.getByText("1800/2000")).toBeInTheDocument();
  });

  it("disables sending while disabled (streaming)", async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled />);
    await userEvent.type(box(), "tekst{Enter}");
    expect(onSend).not.toHaveBeenCalled();
    expect(send()).toBeDisabled();
  });
});

afterEach(cleanup);
