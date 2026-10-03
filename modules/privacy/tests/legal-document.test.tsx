// @vitest-environment happy-dom
import { privacyMessages } from "@softure-ai/privacy";
import { formatLegalDate, LegalDocument, LegalFooter, LegalSection } from "@softure-ai/privacy/ui";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

const en = privacyMessages.en;
// What Intl prints for 2026-10-01 in Polish; escaped, because repository text outside the message
// dictionaries is English (AGENTS.md, the language gate).
const POLISH_OCTOBER_FIRST = "1 pa\u017Adziernika 2026";

const SECTIONS = [
  { id: "who-we-are", title: "Who we are", content: <p>Example Ltd.</p> },
  { id: "your-rights", title: "Your rights", content: <p>You may ask for your data.</p> },
];

describe("LegalDocument", () => {
  it("shows the title, the version in force and its effective date in the locale", () => {
    render(<LegalDocument title="Terms of service" version="2026-10-01" effectiveFrom="2026-10-01" sections={SECTIONS} messages={en} locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: "Terms of service" })).toBeDefined();
    expect(screen.getByText(`${en.legal.version} 2026-10-01 · ${en.legal.effectiveFrom} October 1, 2026`)).toBeDefined();
  });

  it("links every section from the table of contents to its anchor, in order", () => {
    render(<LegalDocument title="Terms" version="1" effectiveFrom="2026-10-01" sections={SECTIONS} messages={en} locale="en" />);
    const contents = screen.getByRole("navigation", { name: en.legal.contents });
    expect(within(contents).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Who we are", "#who-we-are"],
      ["Your rights", "#your-rights"],
    ]);
    const section = screen.getByRole("region", { name: "Your rights" });
    expect(section.id).toBe("your-rights");
    expect(within(section).getByText("You may ask for your data.")).toBeDefined();
  });

  it("lists the change history with versions and dates, and hides it when there is none", () => {
    const changes = [
      { version: "2", date: "2026-10-01", summary: "Added the newsletter." },
      { version: "1", date: "2026-01-15", summary: "First version." },
    ];
    const { unmount } = render(<LegalDocument title="Terms" version="2" effectiveFrom="2026-10-01" sections={SECTIONS} changes={changes} messages={en} locale="en" />);
    const history = screen.getByRole("region", { name: en.legal.changes });
    expect(within(history).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      `${en.legal.version} 2 · October 1, 2026Added the newsletter.`,
      `${en.legal.version} 1 · January 15, 2026First version.`,
    ]);
    unmount();
    render(<LegalDocument title="Terms" version="2" effectiveFrom="2026-10-01" sections={SECTIONS} messages={en} locale="en" />);
    expect(screen.queryByRole("region", { name: en.legal.changes })).toBeNull();
  });

  it("uses the Polish labels and date format with the Polish messages", () => {
    const pl = privacyMessages.pl;
    render(<LegalDocument title="Regulamin" version="1" effectiveFrom="2026-10-01" sections={SECTIONS} messages={pl} locale="pl" />);
    expect(screen.getByText(`${pl.legal.version} 1 · ${pl.legal.effectiveFrom} ${POLISH_OCTOBER_FIRST}`)).toBeDefined();
    expect(screen.getByRole("navigation", { name: pl.legal.contents })).toBeDefined();
  });

  it("leaves out the table of contents of a document without sections", () => {
    render(<LegalDocument title="Imprint" version="1" effectiveFrom="2026-10-01" intro={<p>Example Ltd.</p>} sections={[]} messages={en} locale="en" />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByText("Example Ltd.")).toBeDefined();
  });

  it("takes classes per slot, or only the app's when unstyled", () => {
    render(<LegalDocument title="Terms" version="1" effectiveFrom="2026-10-01" sections={SECTIONS} messages={en} locale="en" unstyled classNames={{ title: "app-title" }} />);
    expect(screen.getByRole("heading", { level: 1 }).className).toBe("app-title");
  });
});

describe("LegalSection", () => {
  it("is a region named by its title, with its id as the anchor", () => {
    render(
      <LegalSection id="cookies" title="Cookies">
        <p>We use none.</p>
      </LegalSection>,
    );
    expect(screen.getByRole("region", { name: "Cookies" }).id).toBe("cookies");
  });
});

describe("LegalFooter", () => {
  it("links the documents in a navigation named by the module's copy, with an optional note", () => {
    render(
      <LegalFooter
        links={[
          { href: "/legal/terms", label: "Terms" },
          { href: "/legal/privacy", label: "Privacy policy" },
        ]}
        note="Example Ltd., 1 Main Street"
        messages={en}
      />,
    );
    const nav = screen.getByRole("navigation", { name: en.legal.footer });
    expect(within(nav).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/legal/terms", "/legal/privacy"]);
    expect(screen.getByText("Example Ltd., 1 Main Street")).toBeDefined();
  });
});

describe("formatLegalDate", () => {
  it("formats a calendar date the same in every server time zone", () => {
    expect(formatLegalDate("2026-01-01", "en")).toBe("January 1, 2026");
    expect(formatLegalDate("2026-01-01", "pl")).toBe("1 stycznia 2026");
  });

  it("gives back text that is not a valid ISO date unchanged", () => {
    expect(formatLegalDate("soon", "en")).toBe("soon");
    expect(formatLegalDate("2026-02-30", "en")).toBe("2026-02-30");
  });
});
