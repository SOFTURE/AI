// User-given names and media types, and the Range header parser.
import { formatContentDisposition, normalizeContentType, parseRangeHeader, sanitizeFileName } from "@softure-ai/files/server";
import { describe, expect, it } from "vitest";

describe("sanitizeFileName", () => {
  it.each([
    ["report.pdf", "report.pdf"],
    ["../../etc/passwd", "passwd"],
    ["C:\\Users\\a\\photo.jpg", "photo.jpg"],
    ["  spaced  ", "spaced"],
    ["tab\there\u0000.txt", "tabhere.txt"],
    ["folder/", "file"],
    ["..", "file"],
    ["", "file"],
    ["Größe.txt", "Größe.txt"],
  ])("keeps %j as %j", (input, expected) => {
    expect(sanitizeFileName(input)).toBe(expected);
  });

  it("cuts a long name to 255 characters without splitting one", () => {
    expect([...sanitizeFileName("🎬".repeat(300))].length).toBe(255);
  });
});

describe("normalizeContentType", () => {
  it.each([
    ["video/MP4", "video/mp4"],
    ["Text/Plain; charset=UTF-8", "text/plain; charset=UTF-8"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ])("accepts %j as %j", (input, expected) => {
    expect(normalizeContentType(input)).toBe(expected);
  });

  it.each(["text", "text/", "/plain", "text/plain\r\nx: y", "text plain", `text/${"x".repeat(260)}`])("refuses %j", (input) => {
    expect(normalizeContentType(input)).toBeNull();
  });
});

describe("formatContentDisposition", () => {
  it("quotes an ASCII name and adds the UTF-8 one", () => {
    expect(formatContentDisposition("attachment", "a b.txt")).toBe(`attachment; filename="a b.txt"; filename*=UTF-8''a%20b.txt`);
    expect(formatContentDisposition("inline", "Größe (1).mp4")).toBe(
      `inline; filename="Gr__e (1).mp4"; filename*=UTF-8''Gr%C3%B6%C3%9Fe%20%281%29.mp4`,
    );
  });
});

describe("parseRangeHeader", () => {
  it.each([
    [null, 10, null],
    ["bytes=0-0", 10, { start: 0, end: 0 }],
    ["bytes=9-", 10, { start: 9, end: 9 }],
    [" bytes=2-3 ", 10, { start: 2, end: 3 }],
    ["bytes=-3", 10, { start: 7, end: 9 }],
    ["bytes=10-11", 10, "unsatisfiable"],
    ["bytes=0-", 0, "unsatisfiable"],
    ["bytes=-1", 0, "unsatisfiable"],
    ["bytes=-", 10, null],
    ["bytes=1-2,4-5", 10, null],
    ["bytes=a-b", 10, null],
    ["bytes=3-1", 10, null],
  ])("reads %j for %i bytes as %j", (value, size, expected) => {
    expect(parseRangeHeader(value, size)).toEqual(expected);
  });
});
