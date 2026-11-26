// @vitest-environment jsdom
import { useReducer } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { caseAppReducer, createInitialState } from "../case-app-reducer";
import { exampleImage } from "../../../tests/helpers/example-images";
import { CaseForm, type CaseFormProps } from "./CaseForm";

beforeEach(() => {
  let n = 0;
  Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => `blob:p-${++n}`), configurable: true, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true, writable: true });
});

afterEach(cleanup);

type Extra = Partial<Pick<CaseFormProps, "onSubmit" | "onRetry" | "bannerError" | "disabled" | "today">> & {
  serverFieldErrors?: CaseFormProps["fieldErrors"];
};

function Harness({ onSubmit = vi.fn(), serverFieldErrors, today = "2026-11-25", ...rest }: Extra) {
  const [state, dispatch] = useReducer(caseAppReducer, undefined, createInitialState);
  if (state.status !== "editing") return null;
  return (
    <CaseForm
      values={state.values}
      photo={state.photo}
      fieldErrors={serverFieldErrors ?? state.fieldErrors}
      onValuesChange={(patch) => dispatch({ type: "EDIT_VALUES", patch })}
      onPhotoChange={(photo) => dispatch({ type: "PHOTO_CHANGED", photo })}
      onSubmit={onSubmit}
      today={today}
      {...rest}
    />
  );
}

const user = () => userEvent.setup({ applyAccept: false });
const submitButton = () => screen.getByRole("button", { name: "Przeanalizuj zgłoszenie" });
const dateInput = () => screen.getByLabelText("Data zakupu") as HTMLInputElement;
const modelInput = () => screen.getByLabelText("Nazwa / model");
const reasonInput = () => screen.getByLabelText(/Powód zgłoszenia/);
const photoInput = (c: HTMLElement) => c.querySelector<HTMLInputElement>('input[type="file"]')!;

async function fillValid(u: ReturnType<typeof user>, container: HTMLElement) {
  await u.click(screen.getByRole("radio", { name: "Zwrot" }));
  await u.selectOptions(screen.getByLabelText("Kategoria sprzętu"), "SMARTPHONE");
  await u.type(modelInput(), "Pixel 9");
  fireEvent.change(dateInput(), { target: { value: "2026-11-20" } });
  await u.upload(
    photoInput(container),
    new File([new Uint8Array(exampleImage("phone-1.jpg"))], "phone-1.jpg", { type: "image/jpeg" }),
  );
}

describe("CaseForm", () => {
  it("has no case type preselected and lists the placeholder plus 9 categories", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: "Zwrot" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Reklamacja" })).not.toBeChecked();
    const select = screen.getByLabelText("Kategoria sprzętu");
    expect(screen.getByRole("option", { name: "Wybierz kategorię" })).toBeInTheDocument();
    expect(select.querySelectorAll("option")).toHaveLength(10);
    expect(screen.getByRole("heading", { name: "Nowe zgłoszenie" })).toBeInTheDocument();
  });

  it("keeps submit disabled until every required field and the photo are valid (AC-11)", async () => {
    const u = user();
    const { container } = render(<Harness />);
    expect(submitButton()).toBeDisabled();
    await u.click(screen.getByRole("radio", { name: "Zwrot" }));
    expect(submitButton()).toBeDisabled();
    await u.selectOptions(screen.getByLabelText("Kategoria sprzętu"), "SMARTPHONE");
    expect(submitButton()).toBeDisabled();
    await u.type(modelInput(), "Pixel 9");
    expect(submitButton()).toBeDisabled();
    fireEvent.change(dateInput(), { target: { value: "2026-11-20" } });
    expect(submitButton()).toBeDisabled();
    await u.upload(
      photoInput(container),
      new File([new Uint8Array(exampleImage("phone-1.jpg"))], "phone-1.jpg", { type: "image/jpeg" }),
    );
    // Return without a reason is valid.
    expect(submitButton()).toBeEnabled();
  });

  it("requires the reason for a complaint (>= 10 chars) before enabling submit", async () => {
    const u = user();
    const { container } = render(<Harness />);
    await fillValid(u, container);
    await u.click(screen.getByRole("radio", { name: "Reklamacja" }));
    expect(submitButton()).toBeDisabled();
    await u.type(reasonInput(), "Ekran migocze od tygodnia");
    expect(submitButton()).toBeEnabled();
  });

  it("calls onSubmit(values, file) only for a valid form, with trimmed parsed values", async () => {
    const onSubmit = vi.fn();
    const u = user();
    const { container } = render(<Harness onSubmit={onSubmit} />);
    await fillValid(u, container);
    await u.click(submitButton());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [values, file] = onSubmit.mock.calls[0];
    expect(values).toEqual({
      caseType: "RETURN",
      category: "SMARTPHONE",
      model: "Pixel 9",
      purchaseDate: "2026-11-20",
      reason: "",
    });
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("phone-1.jpg");
  });

  it("does not call onSubmit on a forced submit of an invalid form; shows all errors and focuses the first invalid field", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.submit(submitButton().closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Wybierz typ zgłoszenia")).toBeInTheDocument();
    expect(screen.getByText("Wybierz kategorię sprzętu")).toBeInTheDocument();
    expect(screen.getByText("Podaj datę zakupu")).toBeInTheDocument();
    expect(screen.getByText("Dodaj zdjęcie sprzętu")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")[0]).toHaveFocus();
  });

  it("shows an error only after the field loses focus (AC-11)", async () => {
    const u = user();
    render(<Harness />);
    expect(screen.queryByText(/Podaj nazwę lub model/)).not.toBeInTheDocument();
    await u.click(modelInput());
    expect(screen.queryByText(/Podaj nazwę lub model/)).not.toBeInTheDocument();
    await u.tab();
    const message = screen.getByText(/Podaj nazwę lub model/);
    expect(modelInput()).toHaveAttribute("aria-invalid", "true");
    expect(modelInput().getAttribute("aria-describedby")).toContain(message.id);
  });

  it("reason requirement switch keeps the text and removes marker and error (AC-07)", async () => {
    const u = user();
    render(<Harness />);
    await u.click(screen.getByRole("radio", { name: "Reklamacja" }));
    expect(screen.getByText(/\(wymagane\)/)).toBeInTheDocument();
    await u.type(reasonInput(), "abcde");
    await u.tab();
    expect(screen.getByText("Opisz powód reklamacji (min. 10 znaków)")).toBeInTheDocument();
    expect(screen.getByText("5/2000")).toBeInTheDocument();

    await u.click(screen.getByRole("radio", { name: "Zwrot" }));
    expect(screen.queryByText("Opisz powód reklamacji (min. 10 znaków)")).not.toBeInTheDocument();
    expect(screen.queryByText(/\(wymagane\)/)).not.toBeInTheDocument();
    expect(screen.getByText(/\(opcjonalne\)/)).toBeInTheDocument();
    expect(reasonInput()).toHaveValue("abcde");
    expect(screen.getByText("Opcjonalny powód zwrotu")).toBeInTheDocument();

    await u.click(screen.getByRole("radio", { name: "Reklamacja" }));
    await u.click(reasonInput());
    await u.tab();
    expect(screen.getByText("Opisz powód reklamacji (min. 10 znaków)")).toBeInTheDocument();
    expect(screen.getByText("Opisz usterkę: co nie działa, od kiedy, w jakich okolicznościach")).toBeInTheDocument();
  });

  it("limits the purchase date to today and rejects a future date (AC-05)", async () => {
    const u = user();
    render(<Harness today="2026-11-25" />);
    expect(dateInput()).toHaveAttribute("max", "2026-11-25");
    expect(dateInput()).toHaveAttribute("type", "date");
    fireEvent.change(dateInput(), { target: { value: "2026-11-26" } });
    await u.click(dateInput());
    await u.tab();
    expect(screen.getByText("Data zakupu nie może być z przyszłości")).toBeInTheDocument();
  });

  it("counts reason characters as {n}/2000", async () => {
    const u = user();
    render(<Harness />);
    expect(screen.getByText("0/2000")).toBeInTheDocument();
    await u.type(reasonInput(), "abc");
    expect(screen.getByText("3/2000")).toBeInTheDocument();
  });

  it("renders bannerError above the button; Spróbuj ponownie calls onRetry", async () => {
    const onRetry = vi.fn();
    render(
      <Harness
        bannerError={{ message: "Nie udało się przygotować decyzji. Spróbuj ponownie." }}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Nie udało się przygotować decyzji. Spróbuj ponownie.");
    await userEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows server-provided fieldErrors under the right field and focuses the first one", () => {
    render(<Harness serverFieldErrors={{ model: "Podaj nazwę lub model (2–100 znaków)", photo: "Plik przekracza limit 10 MB" }} />);
    const modelMsg = screen.getByText("Podaj nazwę lub model (2–100 znaków)");
    expect(modelInput().getAttribute("aria-describedby")).toContain(modelMsg.id);
    expect(modelInput()).toHaveAttribute("aria-invalid", "true");
    expect(modelInput()).toHaveFocus();
    expect(screen.getByText("Plik przekracza limit 10 MB")).toBeInTheDocument();
  });

  it("locks the fields and the submit button while disabled (AC-12)", () => {
    render(<Harness disabled />);
    expect(modelInput()).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Zwrot" })).toBeDisabled();
    expect(submitButton()).toBeDisabled();
  });
});
