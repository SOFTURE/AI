// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { GALLERY_CASES } from "./gallery/cases.js";
import { installDomShims } from "./gallery/dom.js";

beforeAll(installDomShims);
afterEach(cleanup);

describe("every gallery case renders", () => {
  it("has unique case names", () => {
    const names = GALLERY_CASES.map((galleryCase) => galleryCase.name);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  it.each(GALLERY_CASES.map((galleryCase) => [galleryCase.name, galleryCase] as const))("%s renders its root", (_name, galleryCase) => {
    render(galleryCase.render());

    expect(document.body.querySelector(galleryCase.root)).not.toBeNull();
  });
});
