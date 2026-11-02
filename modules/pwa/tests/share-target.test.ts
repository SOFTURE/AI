// The share target's options, its manifest member, the accept check and the link found in a share (#959).
import { buildManifest, buildManifestShareTarget, findSharedUrl, isAcceptedFile, isSameOriginPath, resolveShareTarget } from "@softure-ai/pwa";
import { createManifestRoute } from "@softure-ai/pwa/next";
import { describe, expect, it } from "vitest";

import { THEME } from "./support/theme.js";

const COPY = { name: "Inbox", shortName: "Inbox", description: "Send it to me." };

describe("buildManifestShareTarget", () => {
  it("declares a GET share with the default field names when no files are accepted", () => {
    expect(buildManifestShareTarget({ action: "/share" })).toEqual({
      action: "/share",
      method: "GET",
      params: { url: "url", text: "text", title: "title" },
    });
  });

  it("declares a POST of multipart/form-data with the files and the app's field names", () => {
    expect(
      buildManifestShareTarget({
        action: "/inbox/share",
        params: { url: "link", text: "body" },
        files: [{ name: "media", accept: ["image/*", "video/mp4", ".pdf"] }],
      }),
    ).toEqual({
      action: "/inbox/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: { url: "link", text: "body", title: "title", files: [{ name: "media", accept: ["image/*", "video/mp4", ".pdf"] }] },
    });
  });

  it("is written into the manifest as share_target, and left out without the option", () => {
    expect(buildManifest({ theme: THEME, copy: COPY, lang: "en", shareTarget: { action: "/share" } }).share_target).toEqual({
      action: "/share",
      method: "GET",
      params: { url: "url", text: "text", title: "title" },
    });
    expect(buildManifest({ theme: THEME, copy: COPY, lang: "en" })).not.toHaveProperty("share_target");
  });

  it("fails the manifest route when it loads, for a wrong share target", () => {
    expect(() => createManifestRoute({ theme: THEME, copy: COPY, lang: "en", shareTarget: { action: "https://evil.example/share" } })).toThrow(
      'shareTarget.action must be a same-origin path without a query, got "https://evil.example/share"',
    );
  });
});

describe("resolveShareTarget", () => {
  it.each([
    [{ action: "share" }, "shareTarget.action must be a same-origin path"],
    [{ action: "//evil.example/share" }, "shareTarget.action must be a same-origin path"],
    [{ action: "/share?x=1" }, "shareTarget.action must be a same-origin path"],
    [{ action: "/share", params: { url: "text" } }, "shareTarget field names must be unique, got text, text, title"],
    [{ action: "/share", params: { title: " " } }, "shareTarget field names must not be empty"],
    [{ action: "/share", files: [{ name: "url", accept: ["image/*"] }] }, "shareTarget field names must be unique"],
    [{ action: "/share", files: [{ name: "media", accept: [] }] }, 'shareTarget file field "media" accepts nothing'],
    [{ action: "/share", files: [{ name: "media", accept: ["images"] }] }, 'shareTarget file field "media" has an invalid accept entry "images"'],
  ])("refuses %j", (options, message) => {
    expect(() => resolveShareTarget(options)).toThrow(message);
  });
});

describe("isSameOriginPath", () => {
  it.each([
    ["/", true],
    ["/jobs/42?tab=share", true],
    ["//evil.example", false],
    ["/\\evil.example", false],
    ["https://evil.example/", false],
    ["jobs", false],
    ["/a b", false],
    ["/\tevil", false],
    ["", false],
  ])("%j is %s", (value, expected) => {
    expect(isSameOriginPath(value)).toBe(expected);
  });
});

describe("isAcceptedFile", () => {
  const ACCEPT = ["image/*", "video/mp4", ".PDF"];

  it.each([
    [{ contentType: "image/png", name: "a.png" }, true],
    [{ contentType: "IMAGE/JPEG; charset=binary", name: "a.jpg" }, true],
    [{ contentType: "video/mp4", name: "clip" }, true],
    [{ contentType: "application/octet-stream", name: "report.pdf" }, true],
    [{ contentType: "video/webm", name: "clip.webm" }, false],
    [{ contentType: "imagex/png", name: "a.png" }, false],
    [{ contentType: "text/plain", name: "notes.txt" }, false],
  ])("%j is %s", (file, expected) => {
    expect(isAcceptedFile(ACCEPT, file)).toBe(expected);
  });
});

describe("findSharedUrl", () => {
  it.each([
    [{ url: "https://example.com/a?b=1#c", text: null }, "https://example.com/a?b=1#c"],
    [{ url: null, text: "Look at this https://youtu.be/abc123." }, "https://youtu.be/abc123"],
    [{ url: null, text: "Video (https://example.com/watch?v=1), shared" }, "https://example.com/watch?v=1"],
    [{ url: null, text: "https://en.wikipedia.org/wiki/Bracket_(disambiguation)" }, "https://en.wikipedia.org/wiki/Bracket_(disambiguation)"],
    [{ url: null, text: "first http://a.example/x then https://b.example/y" }, "http://a.example/x"],
    [{ url: "https://from-url.example/", text: "https://from-text.example/" }, "https://from-url.example/"],
    [{ url: "not a link", text: "but here: HTTPS://Example.COM/Path" }, "https://example.com/Path"],
    [{ url: "javascript:alert(1)", text: "ftp://files.example/x" }, null],
    [{ url: null, text: "no link at all" }, null],
    [{ url: null, text: null }, null],
    [{ url: "https://", text: null }, null],
  ])("%j finds %j", (share, expected) => {
    expect(findSharedUrl(share)).toBe(expected);
  });
});
