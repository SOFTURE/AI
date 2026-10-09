// The content file of `softure-mail campaign` and the recipients file.
import { getCampaignProblems, parseCampaignFile, parseRecipientList, type CampaignContent } from "@softure-ai/mailing/server";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { createConfig } from "./support.js";
import { describe, expect, it } from "vitest";

const FILE = ["---", "id: 2026-10-launch", "kind: newsletter", "subject: Something new: version 2", "html: launch.html", "---", "", "Hello,", "", "we shipped.", ""].join("\n");

describe("parseCampaignFile", () => {
  it("reads the frontmatter and the trimmed text body", () => {
    expect(parseCampaignFile(FILE)).toEqual({
      ok: true,
      value: { id: "2026-10-launch", kind: "newsletter", subject: "Something new: version 2", text: "Hello,\n\nwe shipped.", htmlPath: "launch.html" },
    });
  });

  it("accepts Windows line ends, a byte order mark and comments, and needs no html key", () => {
    const file = "\uFEFF---\r\n# draft\r\nid: launch\r\nkind: newsletter\r\nsubject: Hi\r\n---\r\nBody\r\n";
    expect(parseCampaignFile(file)).toEqual({ ok: true, value: { id: "launch", kind: "newsletter", subject: "Hi", text: "Body", htmlPath: null } });
  });

  it("lists every problem at once", () => {
    const file = ["---", "id: Launch Day", "kind: transactional", "colour: blue", "subject:", "kind: digest", "nonsense", "html:", "---", "  "].join("\n");
    expect(parseCampaignFile(file)).toEqual({
      ok: false,
      problems: [
        'unknown frontmatter key "colour"; use id, kind, subject, html',
        'frontmatter key "kind" appears twice',
        'frontmatter line 7 must read "key: value"',
        "id: kebab-case, at most 64 characters, e.g. 2026-10-launch",
        "kind: a kebab-case list name such as newsletter; campaigns are never transactional",
        "subject: one line, 1 to 998 characters",
        "the text body under the frontmatter is empty",
        "html: give a file name or leave the key out",
      ],
    });
  });

  it.each([
    ["no frontmatter", "Hello", "the file must start with a --- line opening the frontmatter"],
    ["an unclosed frontmatter", "---\nid: launch\n", "the frontmatter has no closing --- line"],
  ])("refuses %s", (_case, file, problem) => {
    expect(parseCampaignFile(file)).toEqual({ ok: false, problems: [problem] });
  });
});

describe("parseRecipientList", () => {
  it("reads one address per line, skipping blank lines and comments", () => {
    expect(parseRecipientList("# export of 2026-10-03\nada@example.org\n\n  bob@example.org  \r\n")).toEqual(["ada@example.org", "bob@example.org"]);
  });

  it("reads an empty file as no recipients", () => {
    expect(parseRecipientList("")).toEqual([]);
  });
});

describe("getCampaignProblems with the app's config", () => {
  const CONTENT: CampaignContent = { id: "2026-10-launch", kind: "newsletter", subject: "Hi", text: "Hello.", html: "<p>Hello.</p>" };
  const config = createConfig(fakeMailProvider(), { mailingInput: { from: "Example <hello@mail.example.com>", provider: fakeMailProvider(), routes: { unsubscribe: "/opt-out" } } });

  it("accepts content without a pasted link or footer, and checks nothing of the kind without the config", () => {
    expect(getCampaignProblems(CONTENT, config)).toEqual([]);
    expect(getCampaignProblems({ ...CONTENT, text: "https://app.example.com/opt-out?r=x" })).toEqual([]);
  });

  it.each([
    ["the app's own unsubscribe route", { text: "Leave: https://app.example.com/opt-out?r=abc" }, "the text body carries an unsubscribe link"],
    ["a signed pair of parameters, HTML-escaped", { html: `<a href="https://elsewhere.example/u?r=${"A".repeat(43)}&amp;t=${"B".repeat(43)}">x</a>` }, "the HTML body carries an unsubscribe link"],
    ["the HTML footer", { html: '<p>Hi</p><p>Don\'t want these emails? <a href="https://example.com/x">Unsubscribe</a></p>' }, "the HTML body carries the unsubscribe footer"],
  ])("refuses %s", (_case, change, problem) => {
    expect(getCampaignProblems({ ...CONTENT, ...change }, config)).toEqual([expect.stringMatching(new RegExp(`^${problem}; `))]);
  });

  it("lets a body link to another site's unsubscribe page", () => {
    expect(getCampaignProblems({ ...CONTENT, text: "Partner offer; leave their list at https://partner.example/opt-out?x=1" }, config)).toEqual([]);
  });

  it("lets the footer's lead stand alone in prose", () => {
    expect(getCampaignProblems({ ...CONTENT, text: "Don't want these emails? Reply and tell us.", html: "<p>Don't want these emails? Reply.</p>" }, config)).toEqual([]);
  });
});
