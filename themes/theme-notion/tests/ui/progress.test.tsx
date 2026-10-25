import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Progress } from "../../src/ui/progress.js";

describe("Progress", () => {
  it("hands its value to the progress bar, so it reports aria-valuenow and fills that share", () => {
    const html = renderToStaticMarkup(<Progress value={40} aria-label="Hours" />);

    expect(html).toContain('aria-valuenow="40"');
    expect(html).toContain('aria-label="Hours"');
    expect(html).toContain('data-state="loading"');
    expect(html).toContain('style="transform:translateX(-60%)"');
  });

  it("is indeterminate without a value", () => {
    const html = renderToStaticMarkup(<Progress />);

    expect(html).not.toContain("aria-valuenow");
    expect(html).toContain('data-state="indeterminate"');
  });

  it("merges the caller's indicator classes over the primary fill", () => {
    const html = renderToStaticMarkup(<Progress value={10} indicatorClassName="bg-red" />);

    expect(html).toContain('data-slot="progress-indicator" class="h-full w-full flex-1 transition-all bg-red"');
  });
});
