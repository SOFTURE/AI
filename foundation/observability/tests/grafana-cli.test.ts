import { describe, expect, it } from "vitest";

import { EXIT_FAILED, EXIT_OK, EXIT_USAGE, runObservabilityCli } from "../src/cli/run.js";
import { buildServiceSilentRule } from "../src/node/grafana/rule-builders.js";
import { createFakeGrafana, type FakeGrafana } from "./fake-grafana.js";

const ENV = { GRAFANA_URL: "https://grafana.test", GRAFANA_TOKEN: "glsa_secret-token" };
const RULES_FILE = JSON.stringify({
  folder: { uid: "shop-alerts", title: "Shop alerts" },
  receiver: "owner-mail",
  group: "shop",
  rules: [
    buildServiceSilentRule({
      service: { namespace: "shop", name: "web", environment: "production" },
      datasourceUid: "prom",
      uid: "web-silent",
    }),
  ],
});
const FILES: Record<string, string> = {
  "rules.json": RULES_FILE,
  "dashboard.json": JSON.stringify({ uid: "shop-overview", title: "Shop overview" }),
  "broken.json": "{ not json",
  "invalid.json": JSON.stringify({ folder: { uid: "x", title: "X" }, group: "g", rules: [] }),
};

async function run(argv: string[], options: { env?: Record<string, string>; grafana?: FakeGrafana } = {}) {
  const lines: string[] = [];
  const grafana = options.grafana ?? createFakeGrafana({ contactPoints: ["owner-mail"] });
  const code = await runObservabilityCli({
    argv,
    env: options.env ?? ENV,
    output: { log: (line) => lines.push(line), error: (line) => lines.push(line) },
    readTextFile: (path) => {
      const text = FILES[path];
      return text === undefined ? Promise.reject(new Error(`ENOENT: no such file, open '${path}'`)) : Promise.resolve(text);
    },
    fetch: grafana.fetch,
  });
  return { code, text: lines.join("\n"), grafana };
}

describe("softure-observability grafana apply", () => {
  it("prints the plan of a dry run and changes nothing", async () => {
    const { code, text, grafana } = await run(["grafana", "apply", "--rules", "rules.json", "--dashboard=dashboard.json"]);

    expect(code).toBe(EXIT_OK);
    expect(text).toBe(
      [
        'folder "Shop alerts" (shop-alerts): will be created',
        'rule group "shop": will be replaced (add web-silent), 1 rule active, notifying "owner-mail"',
        'dashboard "Shop overview" (shop-overview): will be created',
        "dry run: nothing was changed; pass --commit to apply",
      ].join("\n"),
    );
    expect(grafana.calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("applies paused rules with --commit --paused", async () => {
    const { code, text, grafana } = await run(["grafana", "apply", "--rules=rules.json", "--commit", "--paused"]);

    expect(code).toBe(EXIT_OK);
    expect(text).toBe(
      [
        'folder "Shop alerts" (shop-alerts): created',
        'rule group "shop": replaced (add web-silent), 1 rule paused, notifying "owner-mail"',
      ].join("\n"),
    );
    expect(grafana.state.ruleGroups.has("shop-alerts/shop")).toBe(true);
  });

  it("exits 1 when the contact point is missing", async () => {
    const { code, text } = await run(["grafana", "apply", "--rules", "rules.json", "--commit"], {
      grafana: createFakeGrafana(),
    });

    expect(code).toBe(EXIT_FAILED);
    expect(text).toBe(
      'softure-observability: refused: contact point "owner-mail" does not exist in Grafana; create it there first (it is never created here)',
    );
  });

  it("names the missing variables without calling Grafana", async () => {
    const { code, text, grafana } = await run(["grafana", "apply", "--rules", "rules.json"], { env: {} });

    expect(code).toBe(EXIT_FAILED);
    expect(text).toBe("softure-observability: GRAFANA_URL and GRAFANA_TOKEN must be set");
    expect(grafana.calls).toEqual([]);
  });

  it("names an unreadable, a broken and an invalid file", async () => {
    const missing = await run(["grafana", "apply", "--rules", "nope.json"]);
    const broken = await run(["grafana", "apply", "--rules", "broken.json"]);
    const invalid = await run(["grafana", "apply", "--rules", "invalid.json"]);

    expect(missing.code).toBe(EXIT_FAILED);
    expect(missing.text).toBe("softure-observability: cannot read nope.json: ENOENT: no such file, open 'nope.json'");
    expect(broken.code).toBe(EXIT_FAILED);
    expect(broken.text).toMatch(/^softure-observability: broken\.json is not valid JSON: /);
    expect(invalid.code).toBe(EXIT_FAILED);
    expect(invalid.text.split("\n")).toEqual([
      "softure-observability: invalid.json is not valid:",
      expect.stringMatching(/^ {2}receiver: /),
      expect.stringMatching(/^ {2}rules: /),
    ]);
  });

  it.each([
    [["grafana"], "softure-observability: grafana needs a subcommand"],
    [["grafana", "push"], 'softure-observability: unknown grafana subcommand "push"'],
    [["grafana", "apply"], "softure-observability: grafana apply needs --rules <file>"],
    [["grafana", "apply", "--rules"], "softure-observability: --rules needs a value"],
    [["grafana", "apply", "--rules", "rules.json", "--force"], 'softure-observability: unknown option "--force"'],
  ])("exits 2 on %j", async (argv, firstLine) => {
    const { code, text } = await run(argv);

    expect(code).toBe(EXIT_USAGE);
    expect(text.split("\n")[0]).toBe(firstLine);
  });
});
