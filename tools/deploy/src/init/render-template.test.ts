import { describe, expect, it } from "vitest";
import { renderTemplate } from "./render-template.js";

describe("renderTemplate", () => {
  it("fills every value tag on a line", () => {
    expect(renderTemplate("Host(`{{domain}}`) -> {{name}}:{{domain}}\n", { domain: "example.com", name: "app" })).toBe(
      "Host(`example.com`) -> app:example.com\n",
    );
  });

  it("keeps a # section when its key is true and drops the tag lines", () => {
    const template = "a\n{{#database}}\nb {{name}}\n{{/database}}\nc";
    expect(renderTemplate(template, { database: true, name: "x" })).toBe("a\nb x\nc");
    expect(renderTemplate(template, { database: false, name: "x" })).toBe("a\nc");
  });

  it("keeps a ^ section only when its key is false", () => {
    const template = "{{^database}}\nno db\n{{/database}}\nend";
    expect(renderTemplate(template, { database: false })).toBe("no db\nend");
    expect(renderTemplate(template, { database: true })).toBe("end");
  });

  it("nests sections: an inner shown section inside a hidden one stays hidden", () => {
    const template = "{{#database}}\n{{#health}}\nboth\n{{/health}}\n{{/database}}\nend";
    expect(renderTemplate(template, { database: false, health: true })).toBe("end");
    expect(renderTemplate(template, { database: true, health: true })).toBe("both\nend");
  });

  it("does not fill values inside a hidden section, so a key used only there may be absent", () => {
    expect(renderTemplate("{{#database}}\n{{tables}}\n{{/database}}\nend", { database: false })).toBe("end");
  });

  it("leaves compose and GitHub expressions alone", () => {
    const text = "image: x:${TAG}\ntag: ${{ inputs.tag }}\n";
    expect(renderTemplate(text, {})).toBe(text);
  });

  it("throws on an unknown value key", () => {
    expect(() => renderTemplate("a\n{{missing}}", {})).toThrow('template line 2: "{{missing}}" has no text value');
  });

  it("throws on a section key without a boolean", () => {
    expect(() => renderTemplate("{{#name}}\n{{/name}}", { name: "x" })).toThrow(
      'template line 1: section "name" needs a boolean value',
    );
  });

  it("throws on a mismatched or unclosed section", () => {
    expect(() => renderTemplate("{{#a}}\n{{/b}}", { a: true })).toThrow('template line 2: "{{/b}}" closes no open "b" section');
    expect(() => renderTemplate("x\n{{#a}}\ny", { a: true })).toThrow('template line 2: section "a" is never closed');
  });
});
