// A pixel step names the pages it sits on: an image the browser loads while another page is open
// (a framework prefetching a link to the landing page) answers the same GIF and counts nothing.
import { analytics, type AnalyticsOptionsInput } from "@softure-ai/analytics";
import { handleFunnelPixel } from "@softure-ai/analytics/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_ORIGIN, createTestFunnel, listCounts, type TestFunnel } from "./support.js";

const ENDPOINT = `${APP_ORIGIN}/api/analytics/funnel`;

type StepInput = NonNullable<NonNullable<AnalyticsOptionsInput["funnel"]>["steps"]>[number];

let funnel: TestFunnel | undefined;

afterEach(async () => {
  await funnel?.database.close();
  funnel = undefined;
  vi.restoreAllMocks();
});

async function setUp(steps: StepInput[]): Promise<TestFunnel> {
  funnel = await createTestFunnel({ funnel: { steps } });
  return funnel;
}

async function sendPixel(test: TestFunnel, step: string, page: string): Promise<Response> {
  return handleFunnelPixel(test.ctx, new Request(`${ENDPOINT}?step=${step}`, { headers: { referer: page, "sec-fetch-site": "same-origin" } }));
}

async function countsOf(test: TestFunnel) {
  return (await listCounts(test)).map(({ channel, step, count }) => ({ channel, step, count }));
}

describe("funnel.steps[].pages", () => {
  it("counts a pixel only from a page in its list, and answers the GIF either way", async () => {
    const test = await setUp([{ id: "landing", via: "pixel", pages: ["/"] }]);
    for (const page of [`${APP_ORIGIN}/calculator?z=abc`, `${APP_ORIGIN}/blog/post?z=abc`, `${APP_ORIGIN}/index`]) {
      const response = await sendPixel(test, "landing", page);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/gif");
    }
    expect(await countsOf(test)).toEqual([]);
    await sendPixel(test, "landing", `${APP_ORIGIN}/?z=newsletter`);
    expect(await countsOf(test)).toEqual([{ channel: "newsletter", step: "landing", count: 1 }]);
  });

  it("compares a listed pathname with the page's encoded pathname", async () => {
    const test = await setUp([{ id: "landing", via: "pixel", pages: ["/café"] }]);
    await sendPixel(test, "landing", `${APP_ORIGIN}/caf%C3%A9`);
    expect(await countsOf(test)).toEqual([{ channel: "", step: "landing", count: 1 }]);
  });

  it("asks a predicate with the page's URL", async () => {
    const test = await setUp([{ id: "article", via: "pixel", pages: (page) => page.pathname.startsWith("/blog/") }]);
    await sendPixel(test, "article", `${APP_ORIGIN}/blog`);
    await sendPixel(test, "article", `${APP_ORIGIN}/`);
    await sendPixel(test, "article", `${APP_ORIGIN}/blog/first?z=ads`);
    expect(await countsOf(test)).toEqual([{ channel: "ads", step: "article", count: 1 }]);
  });

  it("counts nothing and logs the step when the predicate throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const test = await setUp([
      {
        id: "landing",
        via: "pixel",
        pages: () => {
          throw new Error("boom");
        },
      },
    ]);
    expect((await sendPixel(test, "landing", `${APP_ORIGIN}/?z=newsletter`)).status).toBe(200);
    expect(await countsOf(test)).toEqual([]);
    expect(log.mock.calls).toEqual([['@softure-ai/analytics: funnel.steps["landing"].pages failed: boom']]);
  });

  it("counts a pixel from any first-party page when the step names no pages", async () => {
    const test = await setUp([{ id: "landing", via: "pixel" }]);
    await sendPixel(test, "landing", `${APP_ORIGIN}/calculator`);
    expect(await countsOf(test)).toEqual([{ channel: "", step: "landing", count: 1 }]);
  });

  it("refuses pages it cannot compare, and pages on a step that is not a pixel", () => {
    expect(() =>
      analytics({
        funnel: {
          steps: [
            { id: "landing", via: "pixel", pages: [] },
            { id: "article", via: "pixel", pages: ["blog", "/a?b", "/c#d", "//evil.example.com/"] },
            { id: "other", via: "pixel", pages: "/" as unknown as string[] },
          ],
        },
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "analytics":',
        "- options.funnel.steps.0.pages: needs at least one page",
        "- options.funnel.steps.1.pages.0: must be a pathname starting with /, without a query or fragment",
        "- options.funnel.steps.1.pages.1: must be a pathname starting with /, without a query or fragment",
        "- options.funnel.steps.1.pages.2: must be a pathname starting with /, without a query or fragment",
        "- options.funnel.steps.1.pages.3: must be a pathname starting with /, without a query or fragment",
        "- options.funnel.steps.2.pages: must be a list of pathnames or a function (page: URL) => boolean",
      ].join("\n"),
    );
    expect(() =>
      analytics({ funnel: { steps: [{ id: "pricing", pages: ["/pricing"] }, { id: "signup", via: "server", pages: () => true }] } }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "analytics":',
        "- options.funnel.steps.0.pages: only a pixel step names its pages",
        "- options.funnel.steps.1.pages: only a pixel step names its pages",
      ].join("\n"),
    );
  });
});
