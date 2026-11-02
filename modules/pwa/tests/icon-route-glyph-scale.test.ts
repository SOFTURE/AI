// The icon route forwards the app's glyph scale to the kit's drawing, shape by shape (#920). The kit's `drawAppIcon`
// is replaced so the test reads what the route asked for; the real drawing is covered in routes.test.ts.
import { createIconRoute } from "@softure-ai/pwa/next";
import { Wallet } from "lucide";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { THEME } from "./support/theme.js";

const drawAppIcon = vi.hoisted(() => vi.fn<(options: { shape: string; glyphScale?: number }) => Response>(() => new Response("png")));

vi.mock("@softure-ai/theme-kit/next", () => ({ drawAppIcon }));

async function drawScales(route: ReturnType<typeof createIconRoute>): Promise<Record<string, number | undefined>> {
  const scales: Record<string, number | undefined> = {};
  for (const { name } of route.generateStaticParams()) {
    drawAppIcon.mockClear();
    await route.GET(new Request(`https://app.example.com/pwa/icons/${name}`), { params: Promise.resolve({ name }) });
    scales[name] = drawAppIcon.mock.calls[0]?.[0].glyphScale;
  }
  return scales;
}

describe("the icon route's glyph scale", () => {
  beforeEach(() => drawAppIcon.mockClear());

  it("draws the rounded and square icons at one scale and leaves the maskable one at the kit's safe default", async () => {
    expect(await drawScales(createIconRoute({ theme: THEME, icon: Wallet, glyphScale: 0.68 }))).toEqual({
      "icon-32.png": 0.68,
      "apple-icon-180.png": 0.68,
      "icon-192.png": 0.68,
      "icon-512.png": 0.68,
      "icon-maskable-512.png": undefined,
    });
  });

  it("takes a scale per shape, the maskable one included", async () => {
    expect(await drawScales(createIconRoute({ theme: THEME, icon: Wallet, glyphScale: { square: 0.7, maskable: 0.55 } }))).toEqual({
      "icon-32.png": undefined,
      "apple-icon-180.png": 0.7,
      "icon-192.png": undefined,
      "icon-512.png": undefined,
      "icon-maskable-512.png": 0.55,
    });
  });

  it("leaves every shape at the kit's default without the option", async () => {
    expect(Object.values(await drawScales(createIconRoute({ theme: THEME, icon: Wallet })))).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });
});
