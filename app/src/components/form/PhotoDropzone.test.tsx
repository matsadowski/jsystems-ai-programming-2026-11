// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_PHOTO_BYTES } from "@/lib/shared";
import { exampleImage } from "../../../tests/helpers/example-images";
import { PhotoDropzone } from "./PhotoDropzone";
import type { PhotoState } from "./types";

let counter = 0;
const createObjectURL = vi.fn(() => `blob:preview-${++counter}`);
const revokeObjectURL = vi.fn();

beforeEach(() => {
  counter = 0;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true, writable: true });
});
afterEach(cleanup);

function Harness({ caseType }: { caseType?: "RETURN" | "COMPLAINT" }) {
  const [photo, setPhoto] = useState<PhotoState | null>(null);
  return <PhotoDropzone photo={photo} onChange={setPhoto} caseType={caseType} />;
}

const user = () => userEvent.setup({ applyAccept: false });
const fileInput = (c: HTMLElement) => c.querySelector<HTMLInputElement>('input[type="file"]')!;
const realFile = (name: string, type: string) => new File([new Uint8Array(exampleImage(name))], name, { type });

describe("PhotoDropzone", () => {
  it("renders a hidden-from-view file input restricted to the accepted types plus the hint text", () => {
    const { container } = render(<Harness />);
    expect(fileInput(container)).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(screen.getByText("Przeciągnij zdjęcie lub wybierz plik")).toBeInTheDocument();
    expect(screen.getByText(/JPG, PNG, WEBP/)).toBeInTheDocument();
    expect(screen.getByText(/10 MB/)).toBeInTheDocument();
  });

  it("switches the helper text with the case type", () => {
    const { rerender } = render(<PhotoDropzone photo={null} onChange={() => {}} caseType="RETURN" />);
    expect(
      screen.getByText("Pokaż cały sprzęt — zdjęcie ma potwierdzić brak śladów użytkowania"),
    ).toBeInTheDocument();
    rerender(<PhotoDropzone photo={null} onChange={() => {}} caseType="COMPLAINT" />);
    expect(screen.getByText("Pokaż wyraźnie uszkodzenie")).toBeInTheDocument();
  });

  it("accepts a valid jpeg: thumbnail, name, size, Zmień and Usuń", async () => {
    const { container } = render(<Harness />);
    await user().upload(fileInput(container), realFile("phone-1.jpg", "image/jpeg"));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("img", { name: /phone-1\.jpg/ })).toHaveAttribute("src", "blob:preview-1");
    expect(screen.getByText("phone-1.jpg")).toBeInTheDocument();
    expect(screen.getByText(/\d+(,\d)? (KB|MB)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zmień" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usuń" })).toBeInTheDocument();
  });

  it("accepts laptop-1.png whose bytes are JPEG (client check is only a hint)", async () => {
    const { container } = render(<Harness />);
    await user().upload(fileInput(container), realFile("laptop-1.png", "image/png"));
    expect(screen.getByText("laptop-1.png")).toBeInTheDocument();
    expect(screen.queryByText("Dozwolone formaty: JPG, PNG, WEBP")).not.toBeInTheDocument();
  });

  it("accepts by extension when the MIME type is empty", async () => {
    const { container } = render(<Harness />);
    await user().upload(fileInput(container), realFile("laptop-2.webp", ""));
    expect(screen.getByText("laptop-2.webp")).toBeInTheDocument();
  });

  it("rejects a .gif with the format message (AC-08)", async () => {
    const { container } = render(<Harness />);
    const gif = new File([new Uint8Array(exampleImage("phone-1.jpg"))], "anim.gif", { type: "image/gif" });
    await user().upload(fileInput(container), gif);
    expect(screen.getByText("Dozwolone formaty: JPG, PNG, WEBP")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("rejects an 11 MB file with the limit message (AC-09)", async () => {
    const { container } = render(<Harness />);
    const bytes = new Uint8Array(11 * 1024 * 1024);
    bytes.set(exampleImage("phone-1.jpg"));
    expect(bytes.length).toBeGreaterThan(MAX_PHOTO_BYTES);
    await user().upload(fileInput(container), new File([bytes], "big.jpg", { type: "image/jpeg" }));
    expect(screen.getByText("Plik przekracza limit 10 MB")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("Usuń removes the photo and revokes its object URL", async () => {
    const { container } = render(<Harness />);
    const u = user();
    await u.upload(fileInput(container), realFile("phone-1.jpg", "image/jpeg"));
    await u.click(screen.getByRole("button", { name: "Usuń" }));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Przeciągnij zdjęcie lub wybierz plik")).toBeInTheDocument();
  });

  it("replacing the photo revokes the previous URL and clears an earlier rejection", async () => {
    const { container } = render(<Harness />);
    const u = user();
    await u.upload(fileInput(container), new File(["x"], "a.gif", { type: "image/gif" }));
    expect(screen.getByText("Dozwolone formaty: JPG, PNG, WEBP")).toBeInTheDocument();
    await u.upload(fileInput(container), realFile("phone-1.jpg", "image/jpeg"));
    expect(screen.queryByText("Dozwolone formaty: JPG, PNG, WEBP")).not.toBeInTheDocument();
    await u.upload(fileInput(container), realFile("phone-2.jpeg", "image/jpeg"));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    expect(screen.getByText("phone-2.jpeg")).toBeInTheDocument();
  });

  it("is keyboard operable: the picker button is reachable with Tab", async () => {
    render(<Harness />);
    await user().tab();
    expect(screen.getByRole("button", { name: "Wybierz plik" })).toHaveFocus();
  });

  it("shows an externally provided error linked with aria-describedby", () => {
    render(<PhotoDropzone photo={null} onChange={() => {}} error="Dodaj zdjęcie sprzętu" />);
    const err = screen.getByText("Dodaj zdjęcie sprzętu");
    const button = screen.getByRole("button", { name: "Wybierz plik" });
    expect(button.getAttribute("aria-describedby")).toContain(err.id);
  });
});
