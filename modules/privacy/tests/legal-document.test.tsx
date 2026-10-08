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

  it("renders no h1 and no header when the app's frame owns the title and the meta line", () => {
    const { container } = render(<LegalDocument meta={null} sections={SECTIONS} messages={en} locale="en" />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(container.querySelector("header")).toBeNull();
    expect(container.textContent).not.toContain(en.legal.version);
    expect(container.textContent).not.toContain(en.legal.effectiveFrom);
  });

  it("renders the app's own meta node in place of the version line", () => {
    const { container } = render(
      <LegalDocument title="Terms" meta={<p>In force since 16 September 2026.</p>} sections={SECTIONS} messages={en} locale="en" />,
    );
    const header = container.querySelector("header");
    expect(header?.textContent).toBe("TermsIn force since 16 September 2026.");
  });

  it("renders a change without a version as its summary alone, and one with only a date as the date", () => {
    const changes = [{ summary: "Changed 23 September 2026: paid access." }, { date: "2026-09-16", summary: "First version." }];
    render(<LegalDocument meta={null} sections={SECTIONS} changes={changes} messages={en} locale="en" />);
    const history = screen.getByRole("region", { name: en.legal.changes });
    expect(within(history).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Changed 23 September 2026: paid access.",
      "September 16, 2026First version.",
    ]);
  });

  it("titles the contents with the element the app asks for, keeping the navigation's name", () => {
    const { container } = render(<LegalDocument meta={null} sections={SECTIONS} messages={en} locale="en" contentsTitleAs="p" />);
    const contents = screen.getByRole("navigation", { name: en.legal.contents });
    expect(contents.querySelector("h2")).toBeNull();
    expect(contents.querySelector("p")?.textContent).toBe(en.legal.contents);
    expect(container.querySelectorAll("h2").length).toBe(SECTIONS.length);
  });

  it("lists the change history last in the contents when asked", () => {
    const changes = [{ summary: "First version." }];
    render(<LegalDocument meta={null} sections={SECTIONS} changes={changes} listChangesInContents messages={en} locale="en" />);
    const links = within(screen.getByRole("navigation", { name: en.legal.contents })).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Who we are", "#who-we-are"],
      ["Your rights", "#your-rights"],
      [en.legal.changes, "#legal-changes"],
    ]);
  });

  it("wraps the sections and the history in the body slot, beside the contents", () => {
    const changes = [{ summary: "First version." }];
    render(
      <LegalDocument meta={null} sections={SECTIONS} changes={changes} messages={en} locale="en" unstyled classNames={{ body: "app-body" }} />,
    );
    const body = screen.getByRole("region", { name: "Who we are" }).parentElement;
    expect(body?.className).toBe("app-body");
    expect(within(body as HTMLElement).getByRole("region", { name: en.legal.changes })).toBeDefined();
    expect(within(body as HTMLElement).queryByRole("navigation")).toBeNull();
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

  it("renders as a div inside the app's own footer, with no footer landmark of its own", () => {
    const { container } = render(
      <footer>
        <LegalFooter as="div" links={[{ href: "/legal/terms", label: "Terms" }]} messages={en} />
      </footer>,
    );
    expect(container.querySelectorAll("footer").length).toBe(1);
    expect(screen.getByRole("navigation", { name: en.legal.footer })).toBeDefined();
  });

  it("renders only the named navigation, with the note inside it, as nav", () => {
    const { container } = render(<LegalFooter as="nav" links={[{ href: "/legal/terms", label: "Terms" }]} note="Example Ltd." messages={en} />);
    expect(container.querySelector("footer")).toBeNull();
    expect(container.querySelectorAll("nav").length).toBe(1);
    const nav = screen.getByRole("navigation", { name: en.legal.footer });
    expect(within(nav).getByText("Example Ltd.")).toBeDefined();
  });

  it("puts the separator between links only, hidden from assistive technology", () => {
    render(
      <LegalFooter
        as="div"
        links={[
          { href: "/legal/terms", label: "Terms" },
          { href: "/legal/privacy", label: "Privacy policy" },
        ]}
        separator=" · "
        messages={en}
      />,
    );
    const list = screen.getByRole("list");
    expect(list.textContent).toBe("Terms · Privacy policy");
    const items = within(list).getAllByRole("listitem");
    expect(items[0]?.querySelector("[aria-hidden='true']")).toBeNull();
    expect(items[1]?.querySelector("[aria-hidden='true']")?.textContent).toBe(" · ");
  });
});

describe("LegalFooter inline form", () => {
  const LINKS = [
    { href: "/legal/terms", label: "Terms" },
    { href: "/legal/privacy", label: "Privacy policy" },
  ];

  it("renders as one paragraph of links with a readable default separator, with no navigation or list", () => {
    const { container } = render(
      <footer>
        <LegalFooter as="p" links={LINKS} messages={en} />
      </footer>,
    );
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBe(1);
    expect(paragraphs[0]?.textContent).toBe("Terms · Privacy policy");
    expect(within(paragraphs[0] as HTMLElement).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/legal/terms",
      "/legal/privacy",
    ]);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });

  it("renders as a span with the app's separator and the note inline after the links", () => {
    const { container } = render(<LegalFooter as="span" links={LINKS} separator=" | " note="Example Ltd." messages={en} classNames={{ note: "note" }} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe("SPAN");
    expect(root.textContent).toBe("Terms | Privacy policy | Example Ltd.");
    expect(root.querySelector(".note")?.textContent).toBe("Example Ltd.");
    expect(container.querySelector("p")).toBeNull();
  });

  it("puts nothing between the links when the separator is null", () => {
    const { container } = render(<LegalFooter as="p" links={LINKS} separator={null} messages={en} />);
    expect(container.querySelector("p")?.textContent).toBe("TermsPrivacy policy");
  });

  it("does not carry the list form's block look onto the inline root", () => {
    const { container } = render(<LegalFooter as="p" links={LINKS} messages={en} />);
    const className = container.querySelector("p")?.className ?? "";
    expect(className).not.toContain("sft:flex");
    expect(className).not.toContain("sft:border-t");
  });
});

describe("LegalDocument on a page with another document", () => {
  it("names each contents navigation by its own title", () => {
    const { container } = render(
      <>
        <LegalDocument title="Terms" version="1" effectiveFrom="2026-10-01" sections={SECTIONS} messages={en} locale="en" />
        <LegalDocument title="Privacy" version="1" effectiveFrom="2026-10-01" sections={SECTIONS} messages={en} locale="en" />
      </>,
    );
    const navs = Array.from(container.querySelectorAll("nav"));
    expect(navs.length).toBe(2);
    const ids = navs.map((nav) => nav.getAttribute("aria-labelledby"));
    expect(new Set(ids).size).toBe(2);
    for (const nav of navs) {
      const titleId = nav.getAttribute("aria-labelledby") ?? "";
      expect(nav.querySelector(`[id="${titleId}"]`)?.textContent).toBe(en.legal.contents);
    }
    expect(screen.getAllByRole("navigation", { name: en.legal.contents }).length).toBe(2);
  });

  it("moves the change history anchor and its contents link with changesId", () => {
    render(
      <LegalDocument
        title="Privacy"
        version="1"
        effectiveFrom="2026-10-01"
        sections={SECTIONS}
        changes={[{ version: "1", date: "2026-10-01", summary: "First version." }]}
        listChangesInContents
        changesId="privacy-changes"
        messages={en}
        locale="en"
      />,
    );
    const history = screen.getByRole("region", { name: en.legal.changes });
    expect(history.id).toBe("privacy-changes");
    const contents = screen.getByRole("navigation", { name: en.legal.contents });
    expect(within(contents).getByRole("link", { name: en.legal.changes }).getAttribute("href")).toBe("#privacy-changes");
  });

  it("renders its root as the element given in as", () => {
    const { container } = render(<LegalDocument as="div" title="Terms" version="1" effectiveFrom="2026-10-01" sections={SECTIONS} messages={en} locale="en" />);
    expect(container.querySelector("article")).toBeNull();
    expect(container.firstElementChild?.tagName).toBe("DIV");
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
