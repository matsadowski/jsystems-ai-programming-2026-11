// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DecisionBadge } from "./DecisionBadge";
import { DecisionPathLabel } from "./DecisionPathLabel";

describe("DecisionBadge", () => {
  it.each([
    ["positive", "Zwrot zaakceptowany"],
    ["negative", "Zwrot odrzucony"],
    ["warning", "Wymaga weryfikacji"],
  ] as const)("renders label, icon and tone class for %s", (tone, label) => {
    const { container } = render(<DecisionBadge label={label} tone={tone} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain(`status-${tone}`);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("DecisionPathLabel", () => {
  it("renders the label for the decision path", () => {
    render(<DecisionPathLabel decisionPath="LLM_ESCALATED" />);
    expect(screen.getByText("Pełna analiza AI (niepewna ocena wstępna)")).toBeInTheDocument();
  });
});

afterEach(cleanup);
