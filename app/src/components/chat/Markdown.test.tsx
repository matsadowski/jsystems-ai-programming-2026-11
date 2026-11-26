// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders headings, lists and bold without literal markers (AC-26)", () => {
    const { container } = render(
      <Markdown>{"### Decyzja: Zwrot\n\n**Uzasadnienie**\n\n- punkt A\n- punkt B\n\n1. krok\n2. krok"}</Markdown>,
    );
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Decyzja: Zwrot");
    expect(container.querySelector("strong")).toHaveTextContent("Uzasadnienie");
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
    expect(container.textContent).not.toContain("#");
    expect(container.textContent).not.toContain("**");
  });

  it("shows <script> as text and creates no element", () => {
    const { container } = render(<Markdown>{"Test <script>alert(1)</script> koniec"}</Markdown>);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("alert(1)");
  });

  it("renders links as plain text", () => {
    const { container } = render(<Markdown>{"Zobacz [regulamin](https://example.com)"}</Markdown>);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("regulamin");
  });

  it("drops images and tables", () => {
    const { container } = render(<Markdown>{"![x](https://example.com/a.png)"}</Markdown>);
    expect(container.querySelector("img")).toBeNull();
  });
});

afterEach(cleanup);
