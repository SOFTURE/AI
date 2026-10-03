// The content file of `softure-mail campaign` and the recipients file.
import { parseCampaignFile, parseRecipientList } from "@softure-ai/mailing/server";
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
