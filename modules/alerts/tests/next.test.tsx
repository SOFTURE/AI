// The admin page with Next's request scope replaced: `notFound` throws, the guard is a stub, and the config hands the
// test PGlite to the page through `database.handle`, so the real reads run; plus the list's markup guards.
import { join } from "node:path";
import { alerts, type AlertsPanelGuard } from "@softure-ai/alerts";
import { AlertsPage } from "@softure-ai/alerts/next";
import { alert, resolveAlert } from "@softure-ai/alerts/server";
import { defineSoftureConfig, err, ok } from "@softure-ai/core";
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { closeConfiguredDatabases, createPgliteHandle } from "@softure-ai/db";
import { findInlineCopy, findRawColors, readSourceFiles } from "@softure-ai/testing/guards";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestAlerts, recordingChannel, type TestAlerts } from "./support.js";

const scope = vi.hoisted(() => ({ isAdmin: true, checkedRoles: [] as string[] }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("test: notFound");
  },
}));

const guard: AlertsPanelGuard = {
  requireRole: (role) => {
    scope.checkedRoles.push(role);
    if (!scope.isAdmin) throw new Error("test: notFound");
    return Promise.resolve({ id: "admin-1" });
  },
  authorizeRole: (role) => Promise.resolve(scope.isAdmin ? ok({ id: role }) : err("auth.forbidden")),
};


afterEach(async () => {
  clearSoftureConfig();
  // The configured handle wraps the test PGlite, so closing it closes the test database too.
  await closeConfiguredDatabases();
  scope.isAdmin = true;
  scope.checkedRoles.length = 0;
});

async function start(withGuard: boolean): Promise<TestAlerts> {
  const test = await createTestAlerts({ channels: { ops: recordingChannel().channel }, ...(withGuard ? { panelGuard: guard } : {}) });
  const client = test.database.client;
  const modules = test.ctx.config.modules.map((module) => (module.id === "alerts" ? alerts({ channels: { ops: recordingChannel().channel }, ...(withGuard ? { panelGuard: guard } : {}) }) : module));
  registerSoftureConfig(defineSoftureConfig({ ...test.ctx.config, modules, database: { url: "pglite://", handle: () => createPgliteHandle(client) } }));
  return test;
}

describe("AlertsPage", () => {
  it("lists recent alerts with their status and counts for the panel role", async () => {
    const current = await start(true);
    await alert(current.ctx, { key: "health:database", severity: "critical", title: "Health check database is failed", link: "https://app.example.com/api/health" });
    await alert(current.ctx, { key: "health:database", severity: "critical", title: "Health check database is failed" });
    await alert(current.ctx, { key: "jobs.failed:app.sync", severity: "warning", title: "A job failed on queue app.sync" });
    await resolveAlert(current.ctx, "jobs.failed:app.sync");
    const html = renderToStaticMarkup(await AlertsPage());
    expect(scope.checkedRoles).toEqual(["admin"]);
    expect(html).toContain("Alerts");
    expect(html).toContain("Critical: Health check database is failed");
    expect(html).toContain("Firing");
    expect(html).toContain("Occurrences: 2");
    expect(html).toContain("Not yet reported: 1");
    expect(html).toContain("Resolved");
    expect(html).toContain("Key: jobs.failed:app.sync");
  });

  it("is not found without a guard", async () => {
    await start(false);
    await expect(AlertsPage()).rejects.toThrow("test: notFound");
  });

  it("is not found for anyone without the role", async () => {
    await start(true);
    scope.isAdmin = false;
    await expect(AlertsPage()).rejects.toThrow("test: notFound");
  });

  it("says so when there are no alerts", async () => {
    await start(true);
    expect(renderToStaticMarkup(await AlertsPage())).toContain("No alerts yet.");
  });
});

describe("alerts markup", () => {
  const SFT_CLASS = /sft:[^\s"'`]+/g;
  const sources = readSourceFiles(join(import.meta.dirname, "../src"), { dirs: ["ui", "next"] });
  const uiClasses = new Set(
    readSourceFiles(join(import.meta.dirname, "../../../foundation/ui/src/ui")).flatMap(({ source }) => source.match(SFT_CLASS) ?? []),
  );

  it("has no raw colour literal and no inline copy", () => {
    expect(sources.filter(({ file }) => file.endsWith(".tsx")).length).toBeGreaterThanOrEqual(2);
    expect(findRawColors(sources)).toEqual([]);
    expect(findInlineCopy(sources)).toEqual([]);
  });

  it("uses only sft: classes that @softure-ai/ui compiles", () => {
    for (const { file, source } of sources) {
      const missing = (source.match(SFT_CLASS) ?? []).filter((name) => !uiClasses.has(name));
      expect(missing, file).toEqual([]);
    }
  });
});
