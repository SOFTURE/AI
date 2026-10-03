// The footer and headers every list mail carries.
import { mailingMessages } from "@softure-ai/mailing";
import { addHtmlFooter, addTextFooter, getListUnsubscribeHeaders } from "@softure-ai/mailing/server";
import { describe, expect, it } from "vitest";

const LINKS = { page: "https://app.example.com/unsubscribe?r=KEY&t=SIG", oneClick: "https://app.example.com/api/mailing/unsubscribe?r=KEY&t=SIG" };
const COPY = mailingMessages.en.footer;

describe("addTextFooter", () => {
  it("puts the copy and the page link under the signature separator", () => {
    expect(addTextFooter("Hello Ada.", LINKS, COPY)).toBe(
      ["Hello Ada.", "", "-- ", "Don't want these emails? Unsubscribe here:", "https://app.example.com/unsubscribe?r=KEY&t=SIG"].join("\n"),
    );
  });

  it("uses the copy it is given", () => {
    expect(addTextFooter("Hello.", LINKS, mailingMessages.pl.footer)).toContain(mailingMessages.pl.footer.text);
  });
});

describe("addHtmlFooter", () => {
  const FOOTER = `<p>Don't want these emails? <a href="https://app.example.com/unsubscribe?r=KEY&amp;t=SIG">Unsubscribe</a></p>`;

  it("appends a paragraph with the escaped page link to a fragment", () => {
    expect(addHtmlFooter("<p>Hello Ada.</p>", LINKS, COPY)).toBe(`<p>Hello Ada.</p>\n${FOOTER}`);
  });

  it("goes before the last </body>, whatever its case", () => {
    expect(addHtmlFooter("<html><body><p>Hi</p></BODY></html>", LINKS, COPY)).toBe(`<html><body><p>Hi</p>${FOOTER}\n</BODY></html>`);
  });

  it("finds </body> in the original string, even after characters that lowercase to two", () => {
    expect(addHtmlFooter("<p>İ</p></body>", LINKS, COPY)).toBe(`<p>İ</p>${FOOTER}\n</body>`);
  });

  it("escapes the copy", () => {
    const html = addHtmlFooter("<p>Hi</p>", LINKS, { ...COPY, htmlLead: `<script>"x" & y</script>`, htmlLink: "<b>Go</b>" });
    expect(html).toContain("&lt;script&gt;&quot;x&quot; &amp; y&lt;/script&gt;");
    expect(html).toContain(">&lt;b&gt;Go&lt;/b&gt;</a>");
  });
});

describe("getListUnsubscribeHeaders", () => {
  it("returns the RFC 8058 pair with the one-click URL in angle brackets", () => {
    expect(getListUnsubscribeHeaders(LINKS)).toEqual({
      "List-Unsubscribe": "<https://app.example.com/api/mailing/unsubscribe?r=KEY&t=SIG>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
});
