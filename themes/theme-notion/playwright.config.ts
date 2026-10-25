import { defineConfig, devices } from "@playwright/test";

// Visual regression and accessibility of the gallery (README, "Testing"). Chromium only: the baselines are pixels of
// one engine. Playwright's own Chromium build (`npx playwright install chromium`), the same in CI and locally.
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const;
const SCHEMES = ["light", "dark"] as const;

export default defineConfig({
  testDir: "./visual",
  testMatch: "*.spec.ts",
  globalSetup: "./visual/global-setup.ts",
  snapshotPathTemplate: "{testDir}/baselines/{projectName}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: process.env["CI"] !== undefined,
  reporter: process.env["CI"] === undefined ? "list" : [["list"], ["html", { open: "never", outputFolder: "visual/report" }]],
  outputDir: "visual/results",
  expect: {
    toHaveScreenshot: {
      // Antialiasing may differ by a few edge pixels between machines on the same build and fonts; a changed colour,
      // size or position changes far more.
      maxDiffPixelRatio: 0.001,
      animations: "disabled",
      caret: "hide",
    },
  },
  projects: Object.entries(VIEWPORTS).flatMap(([device, viewport]) =>
    SCHEMES.map((colorScheme) => ({
      name: `${device}-${colorScheme}`,
      use: {
        ...devices["Desktop Chrome"],
        viewport,
        colorScheme,
        launchOptions: { args: ["--font-render-hinting=none", "--disable-lcd-text"] },
      },
    })),
  ),
});
